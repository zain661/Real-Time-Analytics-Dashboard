// // Main HTTP/2 Server (h2c - Cleartext)
// // Entry point for the application
// // Main HTTP/2 Server with proper HTTP/1.1 fallback
// // Entry point for the application

// import http2 from 'http2';
// import { serverConfig } from './config/http2.config.js';
// import { handleRequest } from './routes/index.js';
// import { startPeriodicFlush } from './services/metric.service.js';
// import { startPeriodicUpdates } from './controllers/dashboard.controller.js';

// // ============================================
// // Create HTTP/2 server with HTTP/1.1 support
// // ============================================
// const server = http2.createServer({
//   allowHTTP1: true, // Enable HTTP/1.1 fallback
// });

// console.log('🔧 HTTP/2 Server Configuration:');
// console.log(`   Allow HTTP/1.1 Fallback: true`);
// console.log(`   Port: ${serverConfig.HTTP2_PORT}`);
// console.log(`   Host: ${serverConfig.HOST}`);

// // ============================================
// // Handle HTTP/1.1 Requests (for health checks)
// // ============================================
// server.on('request', (req, res) => {
//   const path = req.url;
//   const method = req.method;
  
//   console.log(`📥 HTTP/1.1 ${method} ${path}`);
  
//   // Health check endpoint
//   if (path === '/health' && method === 'GET') {
//     res.writeHead(200, { 
//       'Content-Type': 'application/json',
//       'X-Instance-Name': process.env.INSTANCE_NAME || 'unknown'
//     });
//     res.end(JSON.stringify({ 
//       status: 'healthy', 
//       instance: process.env.INSTANCE_NAME || 'unknown',
//       protocol: 'HTTP/1.1',
//       timestamp: new Date().toISOString()
//     }));
//     return;
//   }
  
//   // Other HTTP/1.1 requests
//   res.writeHead(200, { 'Content-Type': 'text/plain' });
//   res.end('HTTP/1.1 fallback active. Use HTTP/2 for full features.\n');
// });

// // ============================================
// // Handle HTTP/2 Streams
// // ============================================
// server.on('stream', (stream, headers) => {
//   // Log stream creation
//   const streamId = stream.id;
//   const path = headers[':path'];
//   const method = headers[':method'];
  
//   console.log(`📡 Stream ${streamId} created: ${method} ${path}`);
//   console.log(`📋 All headers:`, JSON.stringify(headers, null, 2)); // ADD THIS LINE

  
//   // Route to appropriate handler
//   handleRequest(stream, headers);
  
//   // Handle stream errors
//   stream.on('error', (error) => {
//     console.error(`❌ Stream ${streamId} error:`, error.message);
//   });
  
//   // Log when stream closes
//   stream.on('close', () => {
//     console.log(`🔻 Stream ${streamId} closed`);
//   });
// });

// // ============================================
// // Handle HTTP/2 Session Events
// // ============================================
// // A "session" is the underlying HTTP/2 connection
// // Multiple streams can share one session (multiplexing!)

// server.on('session', (session) => {
//   const sessionId = `session-${Date.now()}`;
//   console.log(`🔗 New HTTP/2 session established: ${sessionId}`);
  
//   // Log session errors
//   session.on('error', (error) => {
//     console.error(`❌ Session ${sessionId} error:`, error.message);
//   });
  
//   // Log when session closes
//   session.on('close', () => {
//     console.log(`🔌 Session ${sessionId} closed`);
//   });
  
//   // Monitor stream creation on this session
//   session.on('stream', (stream) => {
//     console.log(`   Stream ${stream.id} created on ${sessionId}`);
//   });
// });

// server.on('sessionError', (error) => {
//   console.error('❌ HTTP/2 Session Error:', error.message);
// });

// // ============================================
// // Start Background Services
// // ============================================

// // 1. Start periodic metric flushing to database
// // This runs every 5 seconds and inserts batched metrics
// startPeriodicFlush();

// // 2. Start periodic dashboard updates
// // This pushes latest data to SSE clients every second
// startPeriodicUpdates();

// console.log('✅ Background services started');

// // ============================================
// // Graceful Shutdown Handler
// // ============================================
// // Handle CTRL+C and other termination signals
// function gracefulShutdown(signal) {
//   console.log(`\n⚠️ Received ${signal}, shutting down gracefully...`);
  
//   // Stop accepting new connections
//   server.close(() => {
//     console.log('✅ HTTP/2 server closed');
    
//     // Close database connection
//     // (if you want to add this later)
    
//     // Exit process
//     process.exit(0);
//   });
  
//   // Force exit after 10 seconds
//   setTimeout(() => {
//     console.error('❌ Forced shutdown after timeout');
//     process.exit(1);
//   }, 10000);
// }

// // Register shutdown handlers
// process.on('SIGINT', () => gracefulShutdown('SIGINT'));   // CTRL+C
// process.on('SIGTERM', () => gracefulShutdown('SIGTERM')); // kill command

// // ============================================
// // Start Server
// // ============================================
// const PORT = serverConfig.HTTP2_PORT;
// const HOST = serverConfig.HOST;

// server.listen(PORT, HOST, () => {
//   console.log('\n' + '='.repeat(60));
//   console.log('🚀 HTTP/2 + HTTP/1.1 SERVER STARTED');
//   console.log('='.repeat(60));
//   console.log(`📍 Host: ${HOST}`);
//   console.log(`🔌 Port: ${PORT}`);
//   console.log(`🔒 Protocol: HTTP/2 (h2c) + HTTP/1.1 fallback`);
//   console.log(`🏷️  Instance: ${process.env.INSTANCE_NAME || 'unknown'}`);
//   console.log('\n📡 Endpoints:');
//   console.log(`   GET  http://${HOST}:${PORT}/health`);
//   console.log(`        ↳ Health check (HTTP/1.1 & HTTP/2)`);
//   console.log(`   POST http://${HOST}:${PORT}/api/metrics/stream`);
//   console.log(`        ↳ Metric streaming (HTTP/2)`);
//   console.log(`   GET  http://${HOST}:${PORT}/api/dashboard/stream`);
//   console.log(`        ↳ Dashboard SSE (HTTP/2)`);
//   console.log(`   GET  http://${HOST}:${PORT}/api/stats`);
//   console.log(`        ↳ System statistics`);
//   console.log('='.repeat(60) + '\n');
// });

// // Handle server errors
// server.on('error', (error) => {
//   console.error('❌ Server error:', error.message);
//   process.exit(1);
// });

//without proxy
// Main HTTP/2 Server
// Entry point for the application

import http2 from 'http2';
// import path from 'path';
// import { fileURLToPath } from 'url';
import { http2Options, serverConfig } from './config/http2.config.js';
import { handleRequest } from './routes/index.js';
import { startPeriodicFlush } from './services/metric.service.js';
import { startPeriodicUpdates } from './controllers/dashboard.controller.js';

// const __filename = fileURLToPath(import.meta.url);
// const __dirname = path.dirname(__filename);

// // ============================================
// // Express app
// // ============================================
// const app = express();

// // Serve frontend
// app.use(express.static(path.join(__dirname, 'public')));

// ============================================
// Create HTTP/2 Secure Server
// ============================================
// HTTP/2 requires TLS (HTTPS)
// This creates a server that can handle:
// - Multiple concurrent streams per connection (multiplexing)
// - Binary framing (faster than HTTP/1.1 text)
// - Header compression (HPACK)
const server = http2.createSecureServer(http2Options);


console.log('🔧 HTTP/2 Server Configuration:');
console.log(`   Max Concurrent Streams: ${http2Options.settings.maxConcurrentStreams}`);
console.log(`   Initial Window Size: ${http2Options.settings.initialWindowSize} bytes`);
console.log(`   Allow HTTP/1.1 Fallback: ${http2Options.allowHTTP1}`);

// ============================================
// Handle HTTP/2 Streams
// ============================================
// This event fires for EVERY incoming request
// In HTTP/2, each request is a "stream" on the connection
server.on('stream', (stream, headers) => {
  // Log stream creation
  const streamId = stream.id;
  const path = headers[':path'];
  const method = headers[':method'];
  
  console.log(`📡 Stream ${streamId} created: ${method} ${path}`);
  console.log(`📋 All headers:`, JSON.stringify(headers, null, 2)); // ADD THIS LINE

  
  // Route to appropriate handler
  handleRequest(stream, headers);
  
  // Handle stream errors
  stream.on('error', (error) => {
    console.error(`❌ Stream ${streamId} error:`, error.message);
  });
  
  // Log when stream closes
  stream.on('close', () => {
    console.log(`🔻 Stream ${streamId} closed`);
  });
});

// ============================================
// Handle HTTP/2 Session Events
// ============================================
// A "session" is the underlying HTTP/2 connection
// Multiple streams can share one session (multiplexing!)

server.on('session', (session) => {
  const sessionId = `session-${Date.now()}`;
  console.log(`🔗 New HTTP/2 session established: ${sessionId}`);
  
  // Log session errors
  session.on('error', (error) => {
    console.error(`❌ Session ${sessionId} error:`, error.message);
  });
  
  // Log when session closes
  session.on('close', () => {
    console.log(`🔌 Session ${sessionId} closed`);
  });
  
  // Monitor stream creation on this session
  session.on('stream', (stream) => {
    console.log(`   Stream ${stream.id} created on ${sessionId}`);
  });
});

// Handle session-level errors
server.on('sessionError', (error) => {
  console.error('❌ HTTP/2 Session Error:', error.message);
});

// ============================================
// Start Background Services
// ============================================

// 1. Start periodic metric flushing to database
// This runs every 5 seconds and inserts batched metrics
startPeriodicFlush();

// 2. Start periodic dashboard updates
// This pushes latest data to SSE clients every second
startPeriodicUpdates();

console.log('✅ Background services started');

// ============================================
// Graceful Shutdown Handler
// ============================================
// Handle CTRL+C and other termination signals
function gracefulShutdown(signal) {
  console.log(`\n⚠️ Received ${signal}, shutting down gracefully...`);
  
  // Stop accepting new connections
  server.close(() => {
    console.log('✅ HTTP/2 server closed');
    
    // Close database connection
    // (if you want to add this later)
    
    // Exit process
    process.exit(0);
  });
  
  // Force exit after 10 seconds
  setTimeout(() => {
    console.error('❌ Forced shutdown after timeout');
    process.exit(1);
  }, 10000);
}

// Register shutdown handlers
process.on('SIGINT', () => gracefulShutdown('SIGINT'));   // CTRL+C
process.on('SIGTERM', () => gracefulShutdown('SIGTERM')); // kill command

// ============================================
// Start Server
// ============================================
const PORT = serverConfig.HTTP2_PORT;
const HOST = serverConfig.HOST;

server.listen(PORT, HOST, () => {
  console.log(`✅ HTTP/2 Server listening on port ${PORT}`);
  console.log(`Instance: ${process.env.INSTANCE_NAME || 'unknown'}`);
  console.log('\n' + '='.repeat(60));
  console.log('🚀 HTTP/2 STREAMING SERVER STARTED');
  console.log('='.repeat(60));
  console.log(`📍 Host: ${HOST}`);
  console.log(`🔌 Port: ${PORT}`);
  console.log(`🔒 Protocol: HTTP/2 (TLS)`);
  console.log('\n📡 Endpoints:');
  console.log(`   POST https://${HOST}:${PORT}/api/metrics/stream`);
  console.log(`        ↳ For servers to stream metrics`);
  console.log(`   GET  https://${HOST}:${PORT}/api/dashboard/stream`);
  console.log(`        ↳ For dashboard SSE connection`);
  console.log(`   GET  https://${HOST}:${PORT}/api/stats`);
  console.log(`        ↳ System statistics (JSON)`);
  console.log(`   GET  https://${HOST}:${PORT}/health`);
  console.log(`        ↳ Health check`);
  console.log('\n💡 Tips:');
  console.log('   - Use simulator.js to send test metrics');
  console.log('   - Open dashboard.html in browser for real-time view');
  console.log('   - Check /api/stats for monitoring');
  console.log('='.repeat(60) + '\n');
});

// Handle server errors
server.on('error', (error) => {
  console.error('❌ Server error:', error.message);
  process.exit(1);
});