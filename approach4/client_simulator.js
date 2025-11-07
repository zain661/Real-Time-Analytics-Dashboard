// HTTP/2 Client Simulator
// Simulates multiple servers sending metrics

import http2 from 'http2';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { v4 as uuidv4 } from 'uuid';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// ============================================
// Configuration
// ============================================
const SERVER_HOST = 'localhost';
const SERVER_PORT = process.env.SERVER_PORT || 4002;
const NUM_SERVERS = parseInt(process.env.NUM_SERVERS) || 10;
const METRICS_PER_SECOND = parseInt(process.env.METRICS_PER_SECOND) || 1;
const METRIC_TYPES = ['cpu_usage', 'memory_usage', 'disk_io', 'network_rx', 'network_tx'];

console.log('🎯 Simulator Configuration:');
console.log(`   Target: https://${SERVER_HOST}:${SERVER_PORT}`);
console.log(`   Servers: ${NUM_SERVERS}`);
console.log(`   Metrics/second per server: ${METRICS_PER_SECOND}`);
console.log(`   Total metrics/second: ${NUM_SERVERS * METRICS_PER_SECOND}`);
console.log('');

// ============================================
// Load TLS Certificate
// ============================================
// For self-signed certificates in development
const ca = fs.readFileSync(path.join(__dirname, 'certs/server-cert.pem'));

// ============================================
// Generate Random Metric
// ============================================
/**
 * Generates a realistic metric value
 * @param {string} serverId - Server UUID
 * @param {string} metricType - Type of metric
 * @returns {Object} Metric object
 */
function generateMetric(serverId, metricType) {
  let value;
  
  // Generate realistic values based on metric type
  switch (metricType) {
    case 'cpu_usage':
      // CPU: 0-100%
      value = Math.random() * 100;
      break;
    case 'memory_usage':
      // Memory: 20-95%
      value = 20 + Math.random() * 75;
      break;
    case 'disk_io':
      // Disk I/O: 0-1000 MB/s
      value = Math.random() * 1000;
      break;
    case 'network_rx':
      // Network RX: 0-10000 Mbps
      value = Math.random() * 10000;
      break;
    case 'network_tx':
      // Network TX: 0-10000 Mbps
      value = Math.random() * 10000;
      break;
    default:
      value = Math.random() * 100;
  }
  
  return {
    server_id: serverId,
    metric_name: metricType,
    value: parseFloat(value.toFixed(2)),
    labels: {
      region: ['us-east-1', 'us-west-2', 'eu-west-1'][Math.floor(Math.random() * 3)],
      env: ['prod', 'staging', 'dev'][Math.floor(Math.random() * 3)],
    },
    ts: Date.now(),
  };
}

// ============================================
// Start Server Simulation
// ============================================
/**
 * Starts streaming metrics for a single simulated server
 * @param {string} serverId - Server UUID
 * @param {number} index - Server index (for staggering)
 */
function startServer(serverId, index) {
  // Stagger connections to avoid thundering herd
  setTimeout(() => {
    console.log(`🚀 Starting server ${index + 1}/${NUM_SERVERS}: ${serverId}`);
    
    // ============================================
    // Create HTTP/2 Client Connection
    // ============================================
    const client = http2.connect(`https://${SERVER_HOST}:${SERVER_PORT}`, {
      ca: ca,
      rejectUnauthorized: false, // For self-signed certs in development
    });
    
    // Handle connection errors
    client.on('error', (error) => {
      console.error(`❌ Client ${serverId} connection error:`, error.message);
      // Retry after 5 seconds
      setTimeout(() => {
        console.log(`🔄 Retrying connection for ${serverId}...`);
        startServer(serverId, index);
      }, 5000);
    });
    
    client.on('close', () => {
      console.log(`🔌 Client ${serverId} connection closed`);
    });
    
    // ============================================
    // Create Streaming Request
    // ============================================
    const req = client.request({
      ':method': 'POST',
      ':path': '/api/metrics/stream',
      'content-type':'text/event-stream',
      'x-server-id': serverId,
    });
    
    let connected = false;
    let metricsSent = 0;
    let bytesSent = 0;
    let streamId = null;
    
    // ============================================
    // Handle Response
    // ============================================
    req.on('response', (headers) => {
      connected = true;
      streamId = headers['x-stream-id'] || req.stream.id;
      const status = headers[':status'];
      
      console.log(`✅ ${serverId} connected - Status: ${status}, Stream ID: ${streamId}`);
    });
    
    // ============================================
    // Handle Incoming Data (ACKs)
    // ============================================
    req.on('data', (chunk) => {
      const data = chunk.toString();
      
      // Log ACKs from server
      if (data.startsWith('ACK:')) {
        const count = data.split(':')[1];
        console.log(`📬 ${serverId} ACK received: ${count} metrics processed`);
      }
      
      // Ignore heartbeats
      if (data.includes('heartbeat')) {
        // Heartbeat acknowledged
      }
    });
    
    // ============================================
    // Handle Errors
    // ============================================
    req.on('error', (error) => {
      console.error(`❌ ${serverId} request error:`, error.message);
      cleanup();
    });
    
    req.on('close', () => {
      console.log(`🔻 ${serverId} stream closed (Stream ID: ${streamId})`);
      cleanup();
    });
    
    req.on('end', () => {
      console.log(`🔴 ${serverId} stream ended`);
      cleanup();
    });
    
    // ============================================
    // Heartbeat (keep connection alive)
    // ============================================
    const heartbeat = setInterval(() => {
      try {
        req.write(':\n'); // SSE-style comment (won't interfere with NDJSON)
      } catch (error) {
        console.warn(`⚠️ ${serverId} heartbeat failed:`, error.message);
        clearInterval(heartbeat);
      }
    }, 15000);
    
    // ============================================
    // Send Metrics Continuously
    // ============================================
    const sendMetrics = () => {
      if (!connected) return;
      
      // Send metrics for all metric types
      for (const metricType of METRIC_TYPES) {
        const metric = generateMetric(serverId, metricType);
        const line = JSON.stringify(metric) + '\n'; // NDJSON format
        
        try {
          const writeOk = req.write(line);
          metricsSent++;
          bytesSent += line.length;
          
          // Handle backpressure
          if (!writeOk) {
            console.warn(`⚠️ ${serverId}: Backpressure detected, pausing...`);
            req.once('drain', () => {
              console.log(`✅ ${serverId}: Drain received, resuming`);
            });
          }
          
        } catch (error) {
          console.error(`❌ ${serverId} write error:`, error.message);
          cleanup();
          return;
        }
      }
      
      // Log progress every 100 metrics
      if (metricsSent % 100 === 0) {
        const throughput = (metricsSent / ((Date.now() - startTime) / 1000)).toFixed(2);
        process.stdout.write(
          `\r${serverId}: ${metricsSent} metrics sent (${throughput} metrics/sec, ${(bytesSent / 1024).toFixed(2)} KB)`
        );
      }
    };
    
    // Start sending metrics at configured interval
    const startTime = Date.now();
    const interval = 1000 / METRICS_PER_SECOND;
    const sendInterval = setInterval(sendMetrics, interval);
    
    // ============================================
    // Cleanup Function
    // ============================================
    function cleanup() {
      clearInterval(sendInterval);
      clearInterval(heartbeat);
      
      const duration = ((Date.now() - startTime) / 1000).toFixed(2);
      const throughput = (metricsSent / duration).toFixed(2);
      
      console.log(`\n📊 ${serverId} Statistics:`);
      console.log(`   Duration: ${duration}s`);
      console.log(`   Metrics sent: ${metricsSent}`);
      console.log(`   Throughput: ${throughput} metrics/sec`);
      console.log(`   Data sent: ${(bytesSent / 1024).toFixed(2)} KB`);
      
      try {
        if (!req.destroyed && !req.closed) {
          req.end();
        }
        client.close();
      } catch (error) {
        // Already closed
      }
    }
    
    // Handle termination signals
    process.on('SIGINT', () => {
      console.log(`\n⚠️ Shutting down ${serverId}...`);
      cleanup();
    });
    
  }, index * 100); // Stagger by 100ms
}

// ============================================
// Start All Servers
// ============================================
console.log('🎬 Starting simulation...\n');

for (let i = 0; i < NUM_SERVERS; i++) {
  const serverId = uuidv4(); // Generate unique UUID for each server
  startServer(serverId, i);
}

console.log(`\n✅ All ${NUM_SERVERS} servers started!`);
console.log('📡 Streaming metrics to server...');
console.log('Press CTRL+C to stop\n');

// Graceful shutdown
process.on('SIGINT', () => {
  console.log('\n\n⚠️ Shutting down all simulators...');
  process.exit(0);
});

process.on('SIGTERM', () => {
  console.log('\n\n⚠️ Terminating all simulators...');
  process.exit(0);
});