// HTTP/2 Load Tester for Load Balancer Testing
// Same as load-tester.js but configurable to test via LB

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
// Default port 8443 for nginx LB, or 4002 for direct
const SERVER_PORT = parseInt(process.env.SERVER_PORT) || 8443;
const NUM_SERVERS = parseInt(process.env.NUM_SERVERS) || 200;
const DURATION_SEC = parseInt(process.env.DURATION) || 60;
const METRICS_PER_SEC = parseInt(process.env.METRICS_PER_SEC) || 10;
const METRIC_TYPES = ['cpu_usage', 'memory_usage', 'disk_io', 'network_rx', 'network_tx'];

console.log('🔥 HTTP/2 Stream Load Tester (with Load Balancer support)');
console.log('='.repeat(60));
console.log(`Target: https://${SERVER_HOST}:${SERVER_PORT}`);
console.log(`Servers: ${NUM_SERVERS}`);
console.log(`Duration: ${DURATION_SEC}s`);
console.log(`Metrics/sec/server: ${METRICS_PER_SEC}`);
console.log(`Total expected metrics/sec: ${NUM_SERVERS * METRICS_PER_SEC * METRIC_TYPES.length}`);
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
  errors: [],
  startTime: Date.now(),
  endTime: null,
};

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
// Start Server Simulation
// ============================================
function startServer(serverId, index) {
  return new Promise((resolve, reject) => {
    setTimeout(() => {
      const client = http2.connect(`https://${SERVER_HOST}:${SERVER_PORT}`, {
        ca: ca,
        rejectUnauthorized: false,
      });

      let connected = false;
      let metricsSent = 0;
      let bytesSent = 0;
      let intervalId = null;
      let heartbeatId = null;
      const startTime = Date.now();

      // Connection errors
      client.on('error', (error) => {
        stats.failedRequests++;
        stats.errors.push({ serverId, error: error.message });
        cleanup();
        resolve({ serverId, success: false, error: error.message });
      });

      // Create request
      const req = client.request({
        ':method': 'POST',
        ':path': '/api/metrics/stream',
        'content-type': 'application/x-ndjson',
        'x-server-id': serverId,
      });

      // Handle response
      req.on('response', (headers) => {
        connected = true;
        stats.successfulRequests++;
        stats.totalRequests++;
      });

      // Handle ACKs from server
      req.on('data', (chunk) => {
        const data = chunk.toString();
        // Ignore heartbeats and ACKs
      });

      // Send metrics periodically
      const sendMetrics = () => {
        if (!connected) return;

        for (const metricType of METRIC_TYPES) {
          const line = generateMetricLine(serverId, metricType);
          try {
            req.write(line);
            metricsSent++;
            bytesSent += line.length;
            stats.totalMetricsSent++;
            stats.bytesSent += line.length;
          } catch (error) {
            stats.errors.push({ serverId, error: error.message });
            cleanup();
            return;
          }
        }
      };

      // Heartbeat
      heartbeatId = setInterval(() => {
        try {
          req.write(':\n');
        } catch (error) {
          // Connection closed
        }
      }, 15000);

      // Send metrics at configured rate
      const interval = 1000 / METRICS_PER_SEC;
      intervalId = setInterval(sendMetrics, interval);

      // Cleanup function
      function cleanup() {
        if (intervalId) clearInterval(intervalId);
        if (heartbeatId) clearInterval(heartbeatId);
        try {
          req.end();
          client.close();
        } catch (error) {
          // Already closed
        }
      }

      // Auto-cleanup after duration
      setTimeout(() => {
        cleanup();
        const duration = ((Date.now() - startTime) / 1000).toFixed(2);
        const throughput = (metricsSent / duration).toFixed(2);
        resolve({
          serverId,
          success: true,
          metricsSent,
          bytesSent,
          duration,
          throughput,
        });
      }, DURATION_SEC * 1000);

    }, index * 50);
  });
}

// ============================================
// Main Test Execution
// ============================================
async function runLoadTest() {
  console.log(`🚀 Starting ${NUM_SERVERS} server simulations...\n`);

  const serverPromises = [];
  for (let i = 0; i < NUM_SERVERS; i++) {
    const serverId = `lb-test-${i + 1}`;
    serverPromises.push(startServer(serverId, i));
  }

  // Progress indicator
  const progressInterval = setInterval(() => {
    const elapsed = ((Date.now() - stats.startTime) / 1000).toFixed(1);
    const metricsPerSec = (stats.totalMetricsSent / elapsed).toFixed(2);
    process.stdout.write(`\r⏱️  ${elapsed}s | 📊 Metrics: ${stats.totalMetricsSent.toLocaleString()} | 📈 Rate: ${metricsPerSec}/s | ✅ Success: ${stats.successfulRequests} | ❌ Failed: ${stats.failedRequests}`);
  }, 1000);

  // Wait for all servers to complete
  const results = await Promise.all(serverPromises);
  clearInterval(progressInterval);

  stats.endTime = Date.now();
  const totalDuration = ((stats.endTime - stats.startTime) / 1000).toFixed(2);

  // ============================================
  // Print Final Statistics
  // ============================================
  console.log('\n\n' + '='.repeat(60));
  console.log('📊 LOAD TEST RESULTS');
  console.log('='.repeat(60));
  console.log(`Duration: ${totalDuration}s`);
  console.log(`Total Servers: ${NUM_SERVERS}`);
  console.log(`Successful Connections: ${stats.successfulRequests}`);
  console.log(`Failed Connections: ${stats.failedRequests}`);
  console.log(`Total Metrics Sent: ${stats.totalMetricsSent.toLocaleString()}`);
  console.log(`Average Metrics/sec: ${(stats.totalMetricsSent / totalDuration).toFixed(2)}`);
  console.log(`Total Bytes Sent: ${(stats.bytesSent / 1024 / 1024).toFixed(2)} MB`);
  console.log(`Success Rate: ${((stats.successfulRequests / NUM_SERVERS) * 100).toFixed(2)}%`);

  const successfulResults = results.filter(r => r.success);
  if (successfulResults.length > 0) {
    const avgThroughput = successfulResults.reduce((sum, r) => sum + parseFloat(r.throughput || 0), 0) / successfulResults.length;
    console.log(`Average Throughput per Server: ${avgThroughput.toFixed(2)} metrics/sec`);
  }

  if (stats.errors.length > 0) {
    console.log(`\n⚠️  Errors (first 10):`);
    stats.errors.slice(0, 10).forEach(err => {
      console.log(`   ${err.serverId}: ${err.error}`);
    });
  }

  console.log('='.repeat(60));
  console.log('\n✅ Test completed!');
  console.log(`💡 Check your server stats at: https://${SERVER_HOST}:${SERVER_PORT}/api/stats`);
}

// Handle termination
process.on('SIGINT', () => {
  console.log('\n\n⚠️  Test interrupted by user');
  process.exit(0);
});

process.on('SIGTERM', () => {
  console.log('\n\n⚠️  Test terminated');
  process.exit(0);
});

// Run test
runLoadTest().catch(error => {
  console.error('❌ Test failed:', error);
  process.exit(1);
});

// // HTTP/2 Load Tester for Load Balancer Testing (up to 10,000 servers)
// import http2 from 'http2';
// import fs from 'fs';
// import path from 'path';
// import { fileURLToPath } from 'url';

// const __filename = fileURLToPath(import.meta.url);
// const __dirname = path.dirname(__filename);

// // ============================================
// // Configuration
// // ============================================
// const SERVER_HOST = process.env.SERVER_HOST || 'localhost';
// const SERVER_PORT = parseInt(process.env.SERVER_PORT) || 8443;
// const NUM_SERVERS = parseInt(process.env.NUM_SERVERS) || 10000; // default now 10k
// const DURATION_SEC = parseInt(process.env.DURATION) || 60;
// const METRICS_PER_SEC = parseInt(process.env.METRICS_PER_SEC) || 10;
// const METRIC_TYPES = ['cpu_usage', 'memory_usage', 'disk_io', 'network_rx', 'network_tx'];

// console.log('🔥 HTTP/2 Stream Load Tester (with Load Balancer support)');
// console.log('='.repeat(60));
// console.log(`Target: https://${SERVER_HOST}:${SERVER_PORT}`);
// console.log(`Servers: ${NUM_SERVERS}`);
// console.log(`Duration: ${DURATION_SEC}s`);
// console.log(`Metrics/sec/server: ${METRICS_PER_SEC}`);
// console.log(`Total expected metrics/sec: ${NUM_SERVERS * METRICS_PER_SEC * METRIC_TYPES.length}`);
// console.log('='.repeat(60));
// console.log('');

// // ============================================
// // Load TLS Certificate
// // ============================================
// const ca = fs.readFileSync(path.join(__dirname, 'certs/server-cert.pem'));

// // ============================================
// // Statistics
// // ============================================
// const stats = {
//   totalMetricsSent: 0,
//   totalRequests: 0,
//   successfulRequests: 0,
//   failedRequests: 0,
//   bytesSent: 0,
//   errors: [],
//   startTime: Date.now(),
//   endTime: null,
// };

// // ============================================
// // Generate Metric Line
// // ============================================
// function generateMetricLine(serverId, metricType) {
//   let value;
//   switch (metricType) {
//     case 'cpu_usage':
//       value = Math.random() * 100;
//       break;
//     case 'memory_usage':
//       value = 20 + Math.random() * 75;
//       break;
//     case 'disk_io':
//       value = Math.random() * 1000;
//       break;
//     case 'network_rx':
//     case 'network_tx':
//       value = Math.random() * 10000;
//       break;
//     default:
//       value = Math.random() * 100;
//   }

//   const metric = {
//     server_id: serverId,
//     metric_name: metricType,
//     value: parseFloat(value.toFixed(2)),
//     labels: {
//       region: ['us-east-1', 'us-west-2', 'eu-west-1'][Math.floor(Math.random() * 3)],
//       env: ['prod', 'staging', 'dev'][Math.floor(Math.random() * 3)],
//     },
//     ts: Date.now(),
//   };

//   return JSON.stringify(metric) + '\n';
// }

// // ============================================
// // Start Server Simulation
// // ============================================
// function startServer(serverId, index) {
//   return new Promise((resolve) => {
//     setTimeout(() => {
//       const client = http2.connect(`https://${SERVER_HOST}:${SERVER_PORT}`, {
//         ca: ca,
//         rejectUnauthorized: false,
//       });

//       let connected = false;
//       let metricsSent = 0;
//       let bytesSent = 0;
//       let intervalId = null;
//       let heartbeatId = null;
//       const startTime = Date.now();

//       client.on('error', (error) => {
//         stats.failedRequests++;
//         stats.errors.push({ serverId, error: error.message });
//         cleanup();
//         resolve({ serverId, success: false, error: error.message });
//       });

//       const req = client.request({
//         ':method': 'POST',
//         ':path': '/api/metrics/stream',
//         'content-type': 'application/x-ndjson',
//         'x-server-id': serverId,
//       });

//       req.on('response', () => {
//         connected = true;
//         stats.successfulRequests++;
//         stats.totalRequests++;
//       });

//       req.on('data', () => {});

//       const sendMetrics = () => {
//         if (!connected) return;

//         for (const metricType of METRIC_TYPES) {
//           const line = generateMetricLine(serverId, metricType);
//           try {
//             req.write(line);
//             metricsSent++;
//             bytesSent += line.length;
//             stats.totalMetricsSent++;
//             stats.bytesSent += line.length;
//           } catch (error) {
//             stats.errors.push({ serverId, error: error.message });
//             cleanup();
//             return;
//           }
//         }
//       };

//       heartbeatId = setInterval(() => {
//         try { req.write(':\n'); } catch {}
//       }, 15000);

//       const interval = 1000 / METRICS_PER_SEC;
//       intervalId = setInterval(sendMetrics, interval);

//       function cleanup() {
//         if (intervalId) clearInterval(intervalId);
//         if (heartbeatId) clearInterval(heartbeatId);
//         try { req.end(); client.close(); } catch {}
//       }

//       setTimeout(() => {
//         cleanup();
//         const duration = ((Date.now() - startTime) / 1000).toFixed(2);
//         const throughput = (metricsSent / duration).toFixed(2);
//         resolve({ serverId, success: true, metricsSent, bytesSent, duration, throughput });
//       }, DURATION_SEC * 1000);

//     }, index * 1); // small stagger
//   });
// }

// // ============================================
// // Main Test Execution
// // ============================================
// async function runLoadTest() {
//   console.log(`🚀 Starting ${NUM_SERVERS} server simulations...\n`);

//   const serverPromises = [];
//   for (let i = 0; i < NUM_SERVERS; i++) {
//     const serverId = `lb-test-${i + 1}`;
//     serverPromises.push(startServer(serverId, i));
//   }

//   const progressInterval = setInterval(() => {
//     const elapsed = ((Date.now() - stats.startTime) / 1000).toFixed(1);
//     const metricsPerSec = (stats.totalMetricsSent / elapsed).toFixed(2);
//     process.stdout.write(`\r⏱️  ${elapsed}s | 📊 Metrics: ${stats.totalMetricsSent.toLocaleString()} | 📈 Rate: ${metricsPerSec}/s | ✅ Success: ${stats.successfulRequests} | ❌ Failed: ${stats.failedRequests}`);
//   }, 1000);

//   const results = await Promise.all(serverPromises);
//   clearInterval(progressInterval);

//   stats.endTime = Date.now();
//   const totalDuration = ((stats.endTime - stats.startTime) / 1000).toFixed(2);

//   console.log('\n\n' + '='.repeat(60));
//   console.log('📊 LOAD TEST RESULTS');
//   console.log('='.repeat(60));
//   console.log(`Duration: ${totalDuration}s`);
//   console.log(`Total Servers: ${NUM_SERVERS}`);
//   console.log(`Successful Connections: ${stats.successfulRequests}`);
//   console.log(`Failed Connections: ${stats.failedRequests}`);
//   console.log(`Total Metrics Sent: ${stats.totalMetricsSent.toLocaleString()}`);
//   console.log(`Average Metrics/sec: ${(stats.totalMetricsSent / totalDuration).toFixed(2)}`);
//   console.log(`Total Bytes Sent: ${(stats.bytesSent / 1024 / 1024).toFixed(2)} MB`);
//   console.log(`Success Rate: ${((stats.successfulRequests / NUM_SERVERS) * 100).toFixed(2)}%`);

//   const successfulResults = results.filter(r => r.success);
//   if (successfulResults.length > 0) {
//     const avgThroughput = successfulResults.reduce((sum, r) => sum + parseFloat(r.throughput || 0), 0) / successfulResults.length;
//     console.log(`Average Throughput per Server: ${avgThroughput.toFixed(2)} metrics/sec`);
//   }

//   if (stats.errors.length > 0) {
//     console.log(`\n⚠️  Errors (first 10):`);
//     stats.errors.slice(0, 10).forEach(err => {
//       console.log(`   ${err.serverId}: ${err.error}`);
//     });
//   }

//   console.log('='.repeat(60));
//   console.log('\n✅ Test completed!');
//   console.log(`💡 Check your server stats at: https://${SERVER_HOST}:${SERVER_PORT}/api/stats`);
// }

// // Termination handlers
// process.on('SIGINT', () => { console.log('\n\n⚠️  Test interrupted by user'); process.exit(0); });
// process.on('SIGTERM', () => { console.log('\n\n⚠️  Test terminated'); process.exit(0); });

// runLoadTest().catch(error => {
//   console.error('❌ Test failed:', error);
//   process.exit(1);
// });
