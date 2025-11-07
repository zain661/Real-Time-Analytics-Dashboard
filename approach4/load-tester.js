// // HTTP/2 Load Tester for Streams
// // Tests the /api/metrics/stream endpoint with proper HTTP/2 streaming

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
// const SERVER_PORT = parseInt(process.env.SERVER_PORT) || 4002;  // Default: direct connection
// // For Load Balancer testing, set: $env:SERVER_PORT=8443 
// const NUM_SERVERS = parseInt(process.env.NUM_SERVERS) || 200;  // Number of concurrent servers
// const DURATION_SEC = parseInt(process.env.DURATION) || 60;     // Test duration in seconds
// const METRICS_PER_SEC = parseInt(process.env.METRICS_PER_SEC) || 10; // Metrics per second per server
// const METRIC_TYPES = ['cpu_usage', 'memory_usage', 'disk_io', 'network_rx', 'network_tx'];

// console.log('🔥 HTTP/2 Stream Load Tester');
// console.log('='.repeat(50));
// console.log(`Target: https://${SERVER_HOST}:${SERVER_PORT}`);
// console.log(`Servers: ${NUM_SERVERS}`);
// console.log(`Duration: ${DURATION_SEC}s`);
// console.log(`Metrics/sec/server: ${METRICS_PER_SEC}`);
// console.log(`Total expected metrics/sec: ${NUM_SERVERS * METRICS_PER_SEC * METRIC_TYPES.length}`);
// console.log('='.repeat(50));
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
//   return new Promise((resolve, reject) => {
//     // Stagger connections
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

//       // Connection errors
//       client.on('error', (error) => {
//         stats.failedRequests++;
//         stats.errors.push({ serverId, error: error.message });
//         cleanup();
//         resolve({ serverId, success: false, error: error.message });
//       });

//       // Create request
//       const req = client.request({
//         ':method': 'POST',
//         ':path': '/api/metrics/stream',
//         'content-type': 'application/x-ndjson',
//         'x-server-id': serverId,
//       });

//       // Handle response
//       req.on('response', (headers) => {
//         connected = true;
//         stats.successfulRequests++;
//         stats.totalRequests++;
//       });

//       // Handle ACKs from server
//       req.on('data', (chunk) => {
//         const data = chunk.toString();
//         // Ignore heartbeats and ACKs
//       });

//       // Send metrics periodically
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

//       // Heartbeat
//       heartbeatId = setInterval(() => {
//         try {
//           req.write(':\n');
//         } catch (error) {
//           // Connection closed
//         }
//       }, 15000);

//       // Send metrics at configured rate
//       const interval = 1000 / METRICS_PER_SEC;
//       intervalId = setInterval(sendMetrics, interval);

//       // Cleanup function
//       function cleanup() {
//         if (intervalId) clearInterval(intervalId);
//         if (heartbeatId) clearInterval(heartbeatId);
//         try {
//           req.end();
//           client.close();
//         } catch (error) {
//           // Already closed
//         }
//       }

//       // Auto-cleanup after duration
//       setTimeout(() => {
//         cleanup();
//         const duration = ((Date.now() - startTime) / 1000).toFixed(2);
//         const throughput = (metricsSent / duration).toFixed(2);
//         resolve({
//           serverId,
//           success: true,
//           metricsSent,
//           bytesSent,
//           duration,
//           throughput,
//         });
//       }, DURATION_SEC * 1000);

//     }, index * 50); // Stagger by 50ms
//   });
// }

// // ============================================
// // Main Test Execution
// // ============================================
// async function runLoadTest() {
//   console.log(`🚀 Starting ${NUM_SERVERS} server simulations...\n`);

//   const serverPromises = [];
//   for (let i = 0; i < NUM_SERVERS; i++) {
//     const serverId = `load-test-${i + 1}`;
//     serverPromises.push(startServer(serverId, i));
//   }

//   // Progress indicator
//   const progressInterval = setInterval(() => {
//     const elapsed = ((Date.now() - stats.startTime) / 1000).toFixed(1);
//     const metricsPerSec = (stats.totalMetricsSent / elapsed).toFixed(2);
//     process.stdout.write(`\r⏱️  ${elapsed}s | 📊 Metrics: ${stats.totalMetricsSent.toLocaleString()} | 📈 Rate: ${metricsPerSec}/s | ✅ Success: ${stats.successfulRequests} | ❌ Failed: ${stats.failedRequests}`);
//   }, 1000);

//   // Wait for all servers to complete
//   const results = await Promise.all(serverPromises);
//   clearInterval(progressInterval);

//   stats.endTime = Date.now();
//   const totalDuration = ((stats.endTime - stats.startTime) / 1000).toFixed(2);

//   // ============================================
//   // Print Final Statistics
//   // ============================================
//   console.log('\n\n' + '='.repeat(50));
//   console.log('📊 LOAD TEST RESULTS');
//   console.log('='.repeat(50));
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

//   console.log('='.repeat(50));
//   console.log('\n✅ Test completed!');
//   console.log(`💡 Check your server stats at: https://${SERVER_HOST}:${SERVER_PORT}/api/stats`);
// }

// // Handle termination
// process.on('SIGINT', () => {
//   console.log('\n\n⚠️  Test interrupted by user');
//   process.exit(0);
// });

// process.on('SIGTERM', () => {
//   console.log('\n\n⚠️  Test terminated');
//   process.exit(0);
// });

// // Run test
// runLoadTest().catch(error => {
//   console.error('❌ Test failed:', error);
//   process.exit(1);
// });

// HTTP/2 Load Tester for SSE Dashboard
// Simulates multiple servers sending metrics via SSE
// import http2 from 'http2';
// import fs from 'fs';
// import path from 'path';
// import { fileURLToPath } from 'url';
// import { v4 as uuidv4 } from 'uuid';

// const __filename = fileURLToPath(import.meta.url);
// const __dirname = path.dirname(__filename);

// // ============================================
// // Configuration
// // ============================================
// const SERVER_HOST = process.env.SERVER_HOST || 'localhost';
// const SERVER_PORT = parseInt(process.env.SERVER_PORT) || 4002;
// const NUM_SERVERS = parseInt(process.env.NUM_SERVERS) || 10;
// const METRICS_PER_SECOND = parseInt(process.env.METRICS_PER_SECOND) || 1;
// const METRIC_TYPES = ['cpu_usage', 'memory_usage', 'disk_io', 'network_rx', 'network_tx'];

// // Load TLS Certificate
// const ca = fs.readFileSync(path.join(__dirname, 'certs/server-cert.pem'));

// console.log('🎯 Load Tester Configuration:');
// console.log(`   Target: https://${SERVER_HOST}:${SERVER_PORT}`);
// console.log(`   Servers: ${NUM_SERVERS}`);
// console.log(`   Metrics/sec per server: ${METRICS_PER_SECOND}`);
// console.log(`   Total metrics/sec: ${NUM_SERVERS * METRICS_PER_SECOND}`);
// console.log('');

// // ============================================
// // Generate random metric
// // ============================================
// function generateMetric(serverId, type) {
//   let value;
//   switch (type) {
//     case 'cpu_usage': value = Math.random() * 100; break;
//     case 'memory_usage': value = 20 + Math.random() * 75; break;
//     case 'disk_io': value = Math.random() * 1000; break;
//     case 'network_rx':
//     case 'network_tx': value = Math.random() * 10000; break;
//     default: value = Math.random() * 100;
//   }
//   return {
//     server_id: serverId,
//     metric_name: type,
//     value: parseFloat(value.toFixed(2)),
//     labels: {
//       region: ['us-east-1','us-west-2','eu-west-1'][Math.floor(Math.random()*3)],
//       env: ['prod','staging','dev'][Math.floor(Math.random()*3)]
//     },
//     ts: Date.now()
//   };
// }

// // ============================================
// // SSE write helper
// // ============================================
// function sendSSEMetric(req, serverId, metric) {
//   if (!req || req.destroyed || req.closed) return;
//   try {
//     req.write(`event: update\n`);
//     req.write(`data: ${JSON.stringify(metric)}\n\n`);
//   } catch (err) {
//     console.warn(`⚠️ SSE write failed for ${serverId}: ${err.message}`);
//   }
// }

// // ============================================
// // Start one server simulation
// // ============================================
// function startServer(serverId, index) {
//   setTimeout(() => {
//     const client = http2.connect(`https://${SERVER_HOST}:${SERVER_PORT}`, {
//       ca,
//       rejectUnauthorized: false,
//     });

//     client.on('error', (err) => {
//       console.warn(`⚠️ HTTP2 client error for ${serverId}: ${err.message}`);
//     });

//     const req = client.request({
//       ':method': 'POST',
//       ':path': '/api/dashboard/stream',
//       'content-type': 'text/event-stream',
//       'x-server-id': serverId,
//     });

//     req.on('error', (err) => {
//       console.warn(`⚠️ SSE request error for ${serverId}: ${err.message}`);
//     });

//     let connected = false;

//     req.on('response', (headers) => {
//       connected = true;
//       console.log(`✅ ${serverId} connected - Status: ${headers[':status']}`);
//     });

//     req.on('close', () => {
//       console.log(`🔻 ${serverId} stream closed`);
//     });

//     req.on('end', () => {
//       console.log(`🔴 ${serverId} stream ended`);
//     });

//     // Heartbeat every 15s
//     const heartbeat = setInterval(() => {
//       if (!req.destroyed && !req.closed) {
//         try { req.write(':\n'); } catch {}
//       } else clearInterval(heartbeat);
//     }, 15000);

//     // Metric sending interval
//     const intervalMs = 1000 / METRICS_PER_SECOND;
//     const metricInterval = setInterval(() => {
//       if (!connected || req.destroyed || req.closed) return clearInterval(metricInterval);
//       METRIC_TYPES.forEach(type => {
//         const metric = generateMetric(serverId, type);
//         sendSSEMetric(req, serverId, metric);
//       });
//     }, intervalMs);

//   }, index * 100); // stagger by 100ms
// }

// // ============================================
// // Start all servers
// // ============================================
// console.log('🎬 Starting load test...\n');

// for (let i = 0; i < NUM_SERVERS; i++) {
//   const serverId = uuidv4();
//   startServer(serverId, i);
// }

// console.log(`\n✅ All ${NUM_SERVERS} servers started streaming SSE metrics.`);
// console.log('Press CTRL+C to stop.\n');

// // Graceful shutdown
// process.on('SIGINT', () => {
//   console.log('\n⚠️ Terminating load test...');
//   process.exit(0);
// });

// process.on('SIGTERM', () => {
//   console.log('\n⚠️ Terminating load test...');
//   process.exit(0);
// });
// HTTP/2 SSE Load Tester for Dashboard
// approach4/load-tester.js
// HTTP/2 SSE Load Tester for Dashboard
// ============================================
// HTTP/2 Load Tester & Simulator for Dashboard
// Simulates multiple servers sending metrics to your HTTP/2 endpoint
// ============================================

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
const SERVER_HOST = process.env.SERVER_HOST || 'localhost';
const SERVER_PORT = parseInt(process.env.SERVER_PORT) || 4002;
const NUM_SERVERS = parseInt(process.env.NUM_SERVERS) || 200;   // 200 servers
const METRICS_PER_SECOND = parseInt(process.env.METRICS_PER_SECOND) || 5;
const METRIC_TYPES = ['cpu_usage','memory_usage','disk_io','network_rx','network_tx'];

console.log('🎯 Load Tester Configuration:');
console.log(`   Target: https://${SERVER_HOST}:${SERVER_PORT}`);
console.log(`   Servers: ${NUM_SERVERS}`);
console.log(`   Metrics/sec per server: ${METRICS_PER_SECOND}`);
console.log(`   Total metrics/sec: ${NUM_SERVERS * METRICS_PER_SECOND}\n`);

// ============================================
// Load TLS Certificate
// ============================================
const ca = fs.readFileSync(path.join(__dirname,'certs/server-cert.pem'));

// ============================================
// Global Statistics
// ============================================
const stats = {
  totalMetricsSent: 0,
  totalBytesSent: 0,
  successfulConnections: 0,
  failedConnections: 0,
  startTime: Date.now(),
  errors: [],
};

// ============================================
// Helper: Generate random metric
// ============================================
function generateMetric(serverId, type) {
  let value;
  switch(type){
    case 'cpu_usage': value = Math.random()*100; break;
    case 'memory_usage': value = 20+Math.random()*75; break;
    case 'disk_io': value = Math.random()*1000; break;
    case 'network_rx':
    case 'network_tx': value = Math.random()*10000; break;
    default: value = Math.random()*100;
  }
  return {
    server_id: serverId,
    metric_name: type,
    value: parseFloat(value.toFixed(2)),
    labels: {
      region: ['us-east-1','us-west-2','eu-west-1'][Math.floor(Math.random()*3)],
      env: ['prod','staging','dev'][Math.floor(Math.random()*3)],
    },
    ts: Date.now()
  };
}

// ============================================
// SSE/NDJSON write helper
// ============================================
function sendMetric(req, serverId, metric) {
  if(!req || req.destroyed || req.closed) return;
  const line = JSON.stringify(metric)+'\n';
  const ok = req.write(line);
  stats.totalMetricsSent++;
  stats.totalBytesSent += line.length;

  if(!ok) {
    req.once('drain', ()=>{ /* resume writing */ });
  }
}

// ============================================
// Start a single server simulation
// ============================================
function startServer(serverId, index){
  setTimeout(()=>{
    const client = http2.connect(`https://${SERVER_HOST}:${SERVER_PORT}`, {
      ca,
      rejectUnauthorized:false
    });

    client.on('error', err => {
      stats.failedConnections++;
      stats.errors.push({serverId, error: err.message});
      console.warn(`❌ Client error for ${serverId}: ${err.message}`);
      setTimeout(()=>startServer(serverId,index),5000); // Retry
    });

    const req = client.request({
      ':method': 'POST',
      ':path': '/api/metrics/stream',
      'content-type':'application/x-ndjson',
      'x-server-id': serverId,
    });

    let connected = false;
    let metricsSent = 0;
    let bytesSent = 0;
    const startTime = Date.now();

    req.on('response', headers=>{
      connected = true;
      stats.successfulConnections++;
      console.log(`✅ ${serverId} connected - Status: ${headers[':status']}`);
    });

    req.on('error', err=>{
      stats.failedConnections++;
      stats.errors.push({serverId, error: err.message});
      console.warn(`❌ ${serverId} request error: ${err.message}`);
      cleanup();
    });

    req.on('close', cleanup);
    req.on('end', cleanup);

    // Heartbeat
    const heartbeat = setInterval(()=>{
      if(req.destroyed || req.closed) return clearInterval(heartbeat);
      try{ req.write(':\n'); }catch{}
    },15000);

    // Send metrics at configured rate
    const intervalMs = 1000 / METRICS_PER_SECOND;
    const metricInterval = setInterval(()=>{
      if(!connected || req.destroyed || req.closed) return clearInterval(metricInterval);
      for(const type of METRIC_TYPES){
        const metric = generateMetric(serverId,type);
        sendMetric(req,serverId,metric);
        metricsSent++;
        bytesSent += JSON.stringify(metric).length;
      }
    },intervalMs);

    // Cleanup function
    function cleanup(){
      clearInterval(metricInterval);
      clearInterval(heartbeat);
      const duration = ((Date.now()-startTime)/1000).toFixed(2);
      const throughput = (metricsSent/duration).toFixed(2);
      console.log(`\n📊 ${serverId} Statistics: Sent ${metricsSent} metrics (${throughput} metrics/sec), ${(bytesSent/1024).toFixed(2)} KB, Duration: ${duration}s`);
      try{ if(!req.destroyed && !req.closed) req.end(); client.close(); }catch{}
    }

    // Termination handling
    process.on('SIGINT', cleanup);
    process.on('SIGTERM', cleanup);

  }, index*50); // stagger connections by 50ms
}

// ============================================
// Start all servers
// ============================================
console.log('🎬 Starting simulation...\n');

for(let i=0;i<NUM_SERVERS;i++){
  const serverId = uuidv4();
  startServer(serverId,i);
}

// Periodic global stats display
const progressInterval = setInterval(()=>{
  const duration = ((Date.now()-stats.startTime)/1000).toFixed(1);
  const metricsPerSec = (stats.totalMetricsSent/duration).toFixed(2);
  process.stdout.write(`\r⏱ ${duration}s | Total Metrics Sent: ${stats.totalMetricsSent} | Rate: ${metricsPerSec}/s | ✅ Success: ${stats.successfulConnections} | ❌ Failed: ${stats.failedConnections}`);
},1000);

// Graceful shutdown
process.on('SIGINT', ()=>{
  clearInterval(progressInterval);
  console.log('\n\n⚠️ Shutting down all simulators...');
  const totalDuration = ((Date.now()-stats.startTime)/1000).toFixed(2);
  const avgRate = (stats.totalMetricsSent/totalDuration).toFixed(2);
  console.log('\n📊 FINAL LOAD TEST REPORT');
  console.log('='.repeat(50));
  console.log(`Duration: ${totalDuration}s`);
  console.log(`Total Servers: ${NUM_SERVERS}`);
  console.log(`Successful Connections: ${stats.successfulConnections}`);
  console.log(`Failed Connections: ${stats.failedConnections}`);
  console.log(`Total Metrics Sent: ${stats.totalMetricsSent}`);
  console.log(`Average Metrics/sec: ${avgRate}`);
  console.log(`Total Bytes Sent: ${(stats.totalBytesSent/1024/1024).toFixed(2)} MB`);
  console.log('='.repeat(50));
  process.exit(0);
});

process.on('SIGTERM', ()=>{
  process.exit(0);
});
