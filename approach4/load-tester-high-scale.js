// High-Scale HTTP/2 Load Tester
// Designed for 10,000+ servers sending metrics every second

import http2 from 'http2';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// ============================================
// Configuration
// ============================================
const SERVER_HOST = process.env.SERVER_HOST || 'localhost';
const SERVER_PORT = parseInt(process.env.SERVER_PORT) || 4002;
const NUM_SERVERS = parseInt(process.env.NUM_SERVERS) || 10000;  // 10,000 servers
const DURATION_SEC = parseInt(process.env.DURATION) || 300;      // 5 minutes
const METRICS_PER_SEC = parseInt(process.env.METRICS_PER_SEC) || 1; // 1 metric per second per server
const METRIC_TYPES = ['cpu_usage', 'memory_usage', 'disk_io', 'network_rx', 'network_tx'];

// Optimized for high concurrency - memory efficient
const CONNECTION_BATCH_SIZE = 50; // Smaller batches to reduce memory
const BATCH_DELAY_MS = 100; // Longer delay between batches (was 50ms)
const MAX_CONCURRENT_CONNECTIONS = 1000; // Increased from 500 (server can handle more)
const CONNECTION_RETRY_DELAY = 2000; // Retry connection after 2 seconds if failed
const MAX_CONNECTION_RETRIES = 3; // Max retries per connection

console.log('🔥 High-Scale HTTP/2 Stream Load Tester');
console.log('='.repeat(60));
console.log(`Target: https://${SERVER_HOST}:${SERVER_PORT}`);
console.log(`Servers: ${NUM_SERVERS.toLocaleString()}`);
console.log(`Duration: ${DURATION_SEC}s (${(DURATION_SEC / 60).toFixed(1)} minutes)`);
console.log(`Metrics/sec/server: ${METRICS_PER_SEC}`);
console.log(`Metric types: ${METRIC_TYPES.length}`);
console.log(`Total expected metrics/sec: ${(NUM_SERVERS * METRICS_PER_SEC * METRIC_TYPES.length).toLocaleString()}`);
console.log(`Total metrics over test: ${(NUM_SERVERS * METRICS_PER_SEC * METRIC_TYPES.length * DURATION_SEC).toLocaleString()}`);
console.log('='.repeat(60));
console.log('');

// ============================================
// Load TLS Certificate
// ============================================
const ca = fs.readFileSync(path.join(__dirname, 'certs/server-cert.pem'));

// ============================================
// Statistics
// ============================================
const stats = {
  totalMetricsSent: 0,
  totalRequests: 0,
  successfulRequests: 0,
  failedRequests: 0,
  bytesSent: 0,
  connectionsEstablished: 0,
  connectionsFailed: 0,
  errors: [],
  startTime: Date.now(),
  endTime: null,
  metricsPerSecond: [],
};

// Track metrics per second
let metricsInCurrentSecond = 0;
let lastSecondTimestamp = Date.now();

// ============================================
// Generate Metric Line
// ============================================
function generateMetricLine(serverId, metricType) {
  let value;
  switch (metricType) {
    case 'cpu_usage':
      value = Math.random() * 100;
      break;
    case 'memory_usage':
      value = 20 + Math.random() * 75;
      break;
    case 'disk_io':
      value = Math.random() * 1000;
      break;
    case 'network_rx':
    case 'network_tx':
      value = Math.random() * 10000;
      break;
    default:
      value = Math.random() * 100;
  }

  const metric = {
    server_id: serverId,
    metric_name: metricType,
    value: parseFloat(value.toFixed(2)),
    labels: {
      region: ['us-east-1', 'us-west-2', 'eu-west-1'][Math.floor(Math.random() * 3)],
      env: ['prod', 'staging', 'dev'][Math.floor(Math.random() * 3)],
    },
    ts: Date.now(),
  };

  return JSON.stringify(metric) + '\n';
}

// ============================================
// Connection Pool Management
// ============================================
let activeConnections = 0;
const connectionQueue = [];

function waitForConnectionSlot() {
  return new Promise((resolve) => {
    if (activeConnections < MAX_CONCURRENT_CONNECTIONS) {
      activeConnections++;
      resolve();
    } else {
      connectionQueue.push(resolve);
    }
  });
}

function releaseConnectionSlot() {
  activeConnections--;
  if (connectionQueue.length > 0) {
    const next = connectionQueue.shift();
    activeConnections++;
    next();
  }
}

// ============================================
// Start Server Simulation (Memory Optimized with Retries)
// ============================================
function startServer(serverId, index, retryCount = 0) {
  return new Promise(async (resolve, reject) => {
    // Wait for available connection slot
    await waitForConnectionSlot();
    
    // Stagger connections
    setTimeout(() => {
      const client = http2.connect(`https://${SERVER_HOST}:${SERVER_PORT}`, {
        ca: ca,
        rejectUnauthorized: false,
      });

      let connectionEstablished = false;
      let sendInterval = null;
      let metricsSent = 0;

      // Wait for connection to be ready before sending data
      client.on('connect', () => {
        connectionEstablished = true;
        stats.connectionsEstablished++;
      });
      
      // Start sending only after connection is ready
      const connectionReadyCheck = setInterval(() => {
        if (connectionEstablished && sendInterval === null) {
          clearInterval(connectionReadyCheck);
          
          const interval = 1000 / METRICS_PER_SEC;
          sendInterval = setInterval(sendMetrics, interval);
        }
      }, 100);

      const sendMetrics = () => {
        if (!connectionEstablished) {
          return; // Don't send if not connected
        }
        const now = Date.now();
        if (now - lastSecondTimestamp >= 1000) {
          stats.metricsPerSecond.push(metricsInCurrentSecond);
          metricsInCurrentSecond = 0;
          lastSecondTimestamp = now;
        }

        METRIC_TYPES.forEach(metricType => {
          const metricLine = generateMetricLine(serverId, metricType);
          
          const stream = client.request({
            ':method': 'POST',
            ':path': '/api/metrics/stream',
            'content-type': 'application/json',
            'x-server-id': serverId,
          });

          stream.write(metricLine);
          stream.end();

          stats.totalRequests++;
          metricsInCurrentSecond++;
          metricsSent++;

          stream.on('response', () => {
            stats.successfulRequests++;
          });

          stream.on('error', (error) => {
            stats.failedRequests++;
            if (stats.errors.length < 50) {
              stats.errors.push(`${serverId}: ${error.message}`);
            }
          });

          stream.on('data', (chunk) => {
            stats.bytesSent += chunk.length;
          });
        });
      };

      // Stop after duration
      const stopTimeout = setTimeout(() => {
        if (sendInterval) clearInterval(sendInterval);
        clearInterval(connectionReadyCheck); // Clean up connection check
        try {
          client.close();
        } catch (e) {
          // Ignore close errors
        }
        releaseConnectionSlot(); // Release connection slot
        stats.totalMetricsSent += metricsSent * METRIC_TYPES.length;
        resolve();
      }, DURATION_SEC * 1000);
      
      // Clean up on client close
      client.on('close', () => {
        clearTimeout(stopTimeout);
        clearInterval(connectionReadyCheck);
        if (sendInterval) clearInterval(sendInterval);
        releaseConnectionSlot();
        if (connectionEstablished) {
          stats.totalMetricsSent += metricsSent * METRIC_TYPES.length;
        }
      });
      
      // Set connection timeout
      client.setTimeout(10000); // 10 second timeout for connection

      client.on('error', (error) => {
        if (sendInterval) clearInterval(sendInterval);
        
        // Retry connection if we haven't exceeded max retries
        if (retryCount < MAX_CONNECTION_RETRIES) {
          releaseConnectionSlot();
          setTimeout(() => {
            startServer(serverId, index, retryCount + 1)
              .then(resolve)
              .catch(reject);
          }, CONNECTION_RETRY_DELAY * (retryCount + 1)); // Exponential backoff
        } else {
          stats.connectionsFailed++;
          releaseConnectionSlot();
          reject(error);
        }
      });
      
      // Handle case where connection fails before 'connect' event
      client.on('timeout', () => {
        if (!connectionEstablished && retryCount < MAX_CONNECTION_RETRIES) {
          client.close();
          releaseConnectionSlot();
          setTimeout(() => {
            startServer(serverId, index, retryCount + 1)
              .then(resolve)
              .catch(reject);
          }, CONNECTION_RETRY_DELAY * (retryCount + 1));
        }
      });
    }, Math.floor(index / CONNECTION_BATCH_SIZE) * BATCH_DELAY_MS);
  });
}

// ============================================
// Main Test Execution
// ============================================
console.log('🚀 Starting high-scale load test...');
console.log(`📊 Connecting ${NUM_SERVERS.toLocaleString()} servers in batches...\n`);

const startTime = Date.now();
const promises = [];

// Connect in batches to avoid overwhelming the system
for (let i = 0; i < NUM_SERVERS; i++) {
  const serverId = `server-${i + 1}`;
  promises.push(startServer(serverId, i));
}

// Progress tracker
let completedCount = 0;
const progressInterval = setInterval(() => {
  const elapsed = ((Date.now() - startTime) / 1000).toFixed(1);
  const metricsPerSec = stats.metricsPerSecond.length > 0
    ? stats.metricsPerSecond.slice(-10).reduce((a, b) => a + b, 0) / Math.min(10, stats.metricsPerSecond.length)
    : 0;
  
  console.log(`⏱️  Elapsed: ${elapsed}s | Metrics/sec: ${metricsPerSec.toFixed(0)} | Success: ${stats.successfulRequests.toLocaleString()} | Failed: ${stats.failedRequests.toLocaleString()}`);
}, 5000);

Promise.allSettled(promises)
  .then(() => {
    clearInterval(progressInterval);
    stats.endTime = Date.now();
    const duration = (stats.endTime - stats.startTime) / 1000;

    console.log('\n' + '='.repeat(60));
    console.log('📊 HIGH-SCALE TEST RESULTS');
    console.log('='.repeat(60));
    console.log(`Duration: ${duration.toFixed(2)}s (${(duration / 60).toFixed(1)} minutes)`);
    console.log(`Total Servers: ${NUM_SERVERS.toLocaleString()}`);
    console.log(`Connections Established: ${stats.connectionsEstablished.toLocaleString()}`);
    console.log(`Connections Failed: ${stats.connectionsFailed.toLocaleString()}`);
    console.log(`Total Metrics Sent: ${stats.totalMetricsSent.toLocaleString()}`);
    
    if (stats.metricsPerSecond.length > 0) {
      const avgMetricsPerSec = stats.metricsPerSecond.reduce((a, b) => a + b, 0) / stats.metricsPerSecond.length;
      const maxMetricsPerSec = Math.max(...stats.metricsPerSecond);
      const minMetricsPerSec = Math.min(...stats.metricsPerSecond);
      
      console.log(`Average Metrics/sec: ${avgMetricsPerSec.toFixed(2)}`);
      console.log(`Peak Metrics/sec: ${maxMetricsPerSec.toLocaleString()}`);
      console.log(`Min Metrics/sec: ${minMetricsPerSec.toLocaleString()}`);
    }
    
    console.log(`Total Requests: ${stats.totalRequests.toLocaleString()}`);
    console.log(`Successful Requests: ${stats.successfulRequests.toLocaleString()}`);
    console.log(`Failed Requests: ${stats.failedRequests.toLocaleString()}`);
    console.log(`Success Rate: ${((stats.successfulRequests / stats.totalRequests) * 100).toFixed(2)}%`);
    console.log(`Total Bytes Sent: ${(stats.bytesSent / 1024 / 1024 / 1024).toFixed(2)} GB`);
    
    if (stats.errors.length > 0) {
      console.log(`\n❌ Errors (first 20):`);
      stats.errors.slice(0, 20).forEach(error => console.log(`  - ${error}`));
      if (stats.errors.length > 20) {
        console.log(`  ... and ${stats.errors.length - 20} more errors`);
      }
    }

    console.log('\n' + '='.repeat(60));
    console.log('✅ High-scale test completed!');
    console.log(`💡 Check server stats at: https://${SERVER_HOST}:${SERVER_PORT}/api/stats`);
  })
  .catch(error => {
    clearInterval(progressInterval);
    console.error('❌ Test failed:', error);
    process.exit(1);
  });

