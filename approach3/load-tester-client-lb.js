// HTTP/2 Load Tester with Client-Side Load Balancing
// This keeps HTTP/2 benefits by distributing load at client level

import http2 from 'http2';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// ============================================
// Configuration
// ============================================
const BACKEND_SERVERS = [
  'https://localhost:4002',
  'https://localhost:4003',
  'https://localhost:4004',
  'https://localhost:4005',
  'https://localhost:4006',
];

const NUM_SERVERS = parseInt(process.env.NUM_SERVERS) || 200;
const DURATION_SEC = parseInt(process.env.DURATION) || 60;
const METRICS_PER_SEC = parseInt(process.env.METRICS_PER_SEC) || 10;
const METRIC_TYPES = ['cpu_usage', 'memory_usage', 'disk_io', 'network_rx', 'network_tx'];

console.log('🔥 HTTP/2 Stream Load Tester (Client-Side Load Balancing)');
console.log('='.repeat(60));
console.log(`Backend Servers: ${BACKEND_SERVERS.length} servers`);
BACKEND_SERVERS.forEach((server, i) => {
  console.log(`  Server ${i + 1}: ${server}`);
});
console.log(`Simulated Servers: ${NUM_SERVERS}`);
console.log(`Duration: ${DURATION_SEC}s`);
console.log(`Metrics/sec/server: ${METRICS_PER_SEC}`);
console.log(`Total expected metrics/sec: ${NUM_SERVERS * METRICS_PER_SEC * METRIC_TYPES.length}`);
console.log('='.repeat(60));
console.log('✅ Using CLIENT-SIDE load balancing');
console.log('✅ All connections use HTTP/2 directly (no protocol downgrade)');
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
  errors: [],
  startTime: Date.now(),
  endTime: null,
  serverStats: {}, // Track per-server stats
};

// Initialize server stats
BACKEND_SERVERS.forEach(server => {
  stats.serverStats[server] = {
    connections: 0,
    metrics: 0,
    errors: 0,
  };
});

// ============================================
// Client-Side Load Balancing (Round-Robin)
// ============================================
let currentServerIndex = 0;

function getNextServer() {
  const server = BACKEND_SERVERS[currentServerIndex];
  currentServerIndex = (currentServerIndex + 1) % BACKEND_SERVERS.length;
  return server;
}

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
// Start Server Simulation with Client-Side LB
// ============================================
function startServer(serverId, index) {
  return new Promise((resolve, reject) => {
    setTimeout(() => {
      // Use client-side load balancing - get next server
      const targetServer = getNextServer();
      
      const client = http2.connect(targetServer, {
        ca: ca,
        rejectUnauthorized: false,
      });

      // Track this connection
      stats.serverStats[targetServer].connections++;

      let streamCount = 0;
      let metricsSent = 0;
      const interval = 1000 / METRICS_PER_SEC;

      const sendMetrics = () => {
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
          stats.serverStats[targetServer].metrics++;
          metricsSent++;

          stream.on('response', (headers) => {
            stats.successfulRequests++;
          });

          stream.on('error', (error) => {
            stats.failedRequests++;
            stats.serverStats[targetServer].errors++;
            if (stats.errors.length < 10) {
              stats.errors.push(`${serverId}: ${error.message}`);
            }
          });

          stream.on('data', (chunk) => {
            stats.bytesSent += chunk.length;
          });
        });
      };

      // Start sending metrics
      const sendInterval = setInterval(sendMetrics, interval);

      // Stop after duration
      setTimeout(() => {
        clearInterval(sendInterval);
        client.close();
        stats.totalMetricsSent += metricsSent * METRIC_TYPES.length;
        resolve();
      }, DURATION_SEC * 1000);

      client.on('error', (error) => {
        stats.failedRequests++;
        stats.serverStats[targetServer].errors++;
        clearInterval(sendInterval);
        client.close();
        reject(error);
      });
    }, index * 10); // Stagger connections
  });
}

// ============================================
// Main Test Execution
// ============================================
console.log('🚀 Starting load test...\n');

const startTime = Date.now();
const promises = [];

for (let i = 0; i < NUM_SERVERS; i++) {
  const serverId = `server-${i + 1}`;
  promises.push(startServer(serverId, i));
}

Promise.all(promises)
  .then(() => {
    stats.endTime = Date.now();
    const duration = (stats.endTime - stats.startTime) / 1000;

    console.log('\n' + '='.repeat(60));
    console.log('📊 TEST RESULTS (Client-Side Load Balancing)');
    console.log('='.repeat(60));
    console.log(`Duration: ${duration.toFixed(2)}s`);
    console.log(`Total Metrics Sent: ${stats.totalMetricsSent}`);
    console.log(`Total Metrics/sec: ${(stats.totalMetricsSent / duration).toFixed(2)}`);
    console.log(`Successful Requests: ${stats.successfulRequests}`);
    console.log(`Failed Requests: ${stats.failedRequests}`);
    console.log(`Success Rate: ${((stats.successfulRequests / stats.totalRequests) * 100).toFixed(2)}%`);
    console.log(`Total Bytes Sent: ${(stats.bytesSent / 1024 / 1024).toFixed(2)} MB`);
    console.log('');

    console.log('📊 Per-Server Statistics:');
    console.log('-'.repeat(60));
    Object.keys(stats.serverStats).forEach(server => {
      const s = stats.serverStats[server];
      console.log(`${server}:`);
      console.log(`  Connections: ${s.connections}`);
      console.log(`  Metrics: ${s.metrics}`);
      console.log(`  Errors: ${s.errors}`);
      console.log(`  Load Distribution: ${((s.metrics / stats.totalMetricsSent) * 100).toFixed(2)}%`);
      console.log('');
    });

    if (stats.errors.length > 0) {
      console.log('❌ Errors (first 10):');
      stats.errors.forEach(error => console.log(`  - ${error}`));
    }

    console.log('='.repeat(60));
    console.log('✅ Client-side load balancing maintains HTTP/2 benefits!');
    console.log(`💡 Check your server stats at: https://localhost:4002/api/stats`);
  })
  .catch(error => {
    console.error('❌ Test failed:', error);
    process.exit(1);
  });

