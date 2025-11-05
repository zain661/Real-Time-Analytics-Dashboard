// Dashboard Viewer Simulator
// Simulates multiple engineers viewing the real-time dashboard via SSE

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
const NUM_VIEWERS = parseInt(process.env.NUM_VIEWERS) || 500;  // 500 engineers
const DURATION_SEC = parseInt(process.env.DURATION) || 300;    // 5 minutes

console.log('👥 Dashboard Viewer Simulator');
console.log('='.repeat(60));
console.log(`Target: https://${SERVER_HOST}:${SERVER_PORT}`);
console.log(`Viewers (Engineers): ${NUM_VIEWERS.toLocaleString()}`);
console.log(`Duration: ${DURATION_SEC}s (${(DURATION_SEC / 60).toFixed(1)} minutes)`);
console.log(`Endpoint: /api/dashboard/stream`);
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
  totalViewers: NUM_VIEWERS,
  connectedViewers: 0,
  disconnectedViewers: 0,
  totalEventsReceived: 0,
  errors: [],
  startTime: Date.now(),
  endTime: null,
  eventsPerSecond: [],
};

// Track events per second
let eventsInCurrentSecond = 0;
let lastSecondTimestamp = Date.now();

// ============================================
// Simulate Single Viewer (with Retry)
// ============================================
function simulateViewer(viewerId, index, retryCount = 0) {
  return new Promise((resolve, reject) => {
    // Stagger connections
    setTimeout(() => {
      const client = http2.connect(`https://${SERVER_HOST}:${SERVER_PORT}`, {
        ca: ca,
        rejectUnauthorized: false,
      });

      let eventCount = 0;
      let dataReceived = 0;
      let connectionReady = false;

      // Wait for connection before creating stream
      client.on('connect', () => {
        connectionReady = true;
        
        const stream = client.request({
          ':method': 'GET',
          ':path': '/api/dashboard/stream',
          'accept': 'text/event-stream',
          'cache-control': 'no-cache',
        });
        
        setupStreamHandlers(stream, client, viewerId, eventCount, dataReceived, resolve, reject);
      });
      
      function setupStreamHandlers(stream, client, viewerId, eventCount, dataReceived, resolve, reject) {
        stream.on('response', (headers) => {
          if (headers[':status'] === 200) {
            stats.connectedViewers++;
          }
        });

        stream.on('data', (chunk) => {
          const now = Date.now();
          if (now - lastSecondTimestamp >= 1000) {
            stats.eventsPerSecond.push(eventsInCurrentSecond);
            eventsInCurrentSecond = 0;
            lastSecondTimestamp = now;
          }

          dataReceived += chunk.length;
          
          // Count SSE events (each event ends with \n\n)
          const chunkStr = chunk.toString();
          const eventMatches = chunkStr.match(/data:/g);
          if (eventMatches) {
            eventCount += eventMatches.length;
            stats.totalEventsReceived += eventMatches.length;
            eventsInCurrentSecond += eventMatches.length;
          }
        });

        stream.on('end', () => {
          stats.disconnectedViewers++;
          client.close();
          resolve({
            viewerId,
            eventsReceived: eventCount,
            dataReceived,
          });
        });

        stream.on('error', (error) => {
          // Retry if we haven't exceeded max retries
          if (retryCount < 3) {
            client.close();
            setTimeout(() => {
              simulateViewer(viewerId, index, retryCount + 1)
                .then(resolve)
                .catch(reject);
            }, 2000 * (retryCount + 1));
          } else {
            stats.disconnectedViewers++;
            if (stats.errors.length < 50) {
              stats.errors.push(`${viewerId}: ${error.message}`);
            }
            client.close();
            reject(new Error(`${viewerId}: ${error.message}`));
          }
        });

        // Close after duration
        setTimeout(() => {
          stream.close();
          client.close();
        }, DURATION_SEC * 1000);
      }
      
      // Handle client errors
      client.on('error', (error) => {
        // Retry if we haven't exceeded max retries
        if (retryCount < 3 && !connectionReady) {
          client.close();
          setTimeout(() => {
            simulateViewer(viewerId, index, retryCount + 1)
              .then(resolve)
              .catch(reject);
          }, 2000 * (retryCount + 1));
        } else {
          stats.disconnectedViewers++;
          if (stats.errors.length < 50) {
            stats.errors.push(`${viewerId} (client): ${error.message}`);
          }
          client.close();
          reject(new Error(`${viewerId} (client): ${error.message}`));
        }
      });
      
      // Connection timeout
      client.setTimeout(10000);
      client.on('timeout', () => {
        if (!connectionReady && retryCount < 3) {
          client.close();
          setTimeout(() => {
            simulateViewer(viewerId, index, retryCount + 1)
              .then(resolve)
              .catch(reject);
          }, 2000 * (retryCount + 1));
        }
      });
    }, index * 10); // Stagger connections by 10ms each
  });
}

// ============================================
// Main Execution
// ============================================
console.log('🚀 Starting dashboard viewer simulation...');
console.log(`📊 Connecting ${NUM_VIEWERS.toLocaleString()} viewers...\n`);

const startTime = Date.now();
const promises = [];

for (let i = 0; i < NUM_VIEWERS; i++) {
  const viewerId = `engineer-${i + 1}`;
  promises.push(simulateViewer(viewerId, i));
}

// Progress tracker
const progressInterval = setInterval(() => {
  const elapsed = ((Date.now() - startTime) / 1000).toFixed(1);
  const eventsPerSec = stats.eventsPerSecond.length > 0
    ? stats.eventsPerSecond.slice(-10).reduce((a, b) => a + b, 0) / Math.min(10, stats.eventsPerSecond.length)
    : 0;
  
  console.log(`⏱️  Elapsed: ${elapsed}s | Connected: ${stats.connectedViewers} | Events/sec: ${eventsPerSec.toFixed(0)} | Total Events: ${stats.totalEventsReceived.toLocaleString()}`);
}, 5000);

Promise.allSettled(promises)
  .then(() => {
    clearInterval(progressInterval);
    stats.endTime = Date.now();
    const duration = (stats.endTime - stats.startTime) / 1000;

    console.log('\n' + '='.repeat(60));
    console.log('📊 DASHBOARD VIEWER SIMULATION RESULTS');
    console.log('='.repeat(60));
    console.log(`Duration: ${duration.toFixed(2)}s (${(duration / 60).toFixed(1)} minutes)`);
    console.log(`Total Viewers: ${stats.totalViewers.toLocaleString()}`);
    console.log(`Connected Viewers: ${stats.connectedViewers.toLocaleString()}`);
    console.log(`Disconnected Viewers: ${stats.disconnectedViewers.toLocaleString()}`);
    console.log(`Connection Success Rate: ${((stats.connectedViewers / stats.totalViewers) * 100).toFixed(2)}%`);
    
    if (stats.eventsPerSecond.length > 0) {
      const avgEventsPerSec = stats.eventsPerSecond.reduce((a, b) => a + b, 0) / stats.eventsPerSecond.length;
      const maxEventsPerSec = Math.max(...stats.eventsPerSecond);
      
      console.log(`Average Events/sec: ${avgEventsPerSec.toFixed(2)}`);
      console.log(`Peak Events/sec: ${maxEventsPerSec.toLocaleString()}`);
      console.log(`Total Events Received: ${stats.totalEventsReceived.toLocaleString()}`);
      console.log(`Average Events per Viewer: ${(stats.totalEventsReceived / stats.connectedViewers).toFixed(2)}`);
    }
    
    if (stats.errors.length > 0) {
      console.log(`\n❌ Errors (first 20):`);
      stats.errors.slice(0, 20).forEach(error => console.log(`  - ${error}`));
      if (stats.errors.length > 20) {
        console.log(`  ... and ${stats.errors.length - 20} more errors`);
      }
    }

    console.log('\n' + '='.repeat(60));
    console.log('✅ Dashboard viewer simulation completed!');
  })
  .catch(error => {
    clearInterval(progressInterval);
    console.error('❌ Simulation failed:', error);
    process.exit(1);
  });

