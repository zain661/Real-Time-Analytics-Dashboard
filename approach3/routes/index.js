// Routes Handler
// Maps HTTP/2 requests to controllers

import { handleMetricStream, getStreamStats } from '../controllers/stream.controller.js';
import { handleDashboardSSE, getSSEStats } from '../controllers/dashboard.controller.js';
import { getBufferStats } from '../services/metric.service.js';
import { getAggregationStats } from '../services/aggregation.service.js';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);


// ============================================
// Main Route Handler
// ============================================
/**
 * Routes incoming HTTP/2 requests to appropriate handlers
 * @param {Http2Stream} stream - HTTP/2 stream object
 * @param {Object} headers - HTTP/2 headers
 */
export function handleRequest(stream, headers) {
  const path = headers[':path'];
  const method = headers[':method'];
  
  console.log(`📥 ${method} ${path}`);
  const cleanPath = path.split('?')[0];

  if (cleanPath === '/health' && method === 'GET') {
    stream.respond({ ':status': 200, 'content-type': 'application/json' });
    stream.end(JSON.stringify({ status: 'healthy', instance: process.env.INSTANCE_NAME }));
    return;
}

  // ============================================
  // 1. Metric Streaming Endpoint
  // ============================================
  // POST /api/metrics/stream
  // Servers send metrics here via HTTP/2 streaming
  if (cleanPath === '/api/metrics/stream' && method === 'POST') {
    handleMetricStream(stream, headers);
    return;
  }
  
  // ============================================
  // 2. Dashboard SSE Endpoint
  // ============================================
  // GET /api/dashboard/stream
  // Dashboard connects here for real-time updates
  if (cleanPath === '/api/dashboard/stream' && method === 'GET') {
    handleDashboardSSE(stream, headers);
    return;
  }
  
  // ============================================
  // 3. Statistics Endpoint
  // ============================================
  // GET /api/stats
  // Returns JSON with all system statistics
  if (cleanPath === '/api/stats' && method === 'GET') {
    handleStats(stream);
    return;
  }
  
  // ============================================
  // 4. Health Check Endpoint
  // ============================================
  // GET /health
  // Simple health check (returns 200 OK)
  // if (cleanPath === '/health' && method === 'GET') {
  //   handleHealth(stream);
  //   return;
  // }

  // ============================================
  // 5. Static files and dashboard HTML
  // ============================================
  if (method === 'GET') {
    // Map root to public/index.html
    if (cleanPath === '/' || cleanPath === '/index.html') {
      handleStaticFile(stream, '/index.html');
      return;
    }
    // Optionally support /dashboard.html from public
    if (cleanPath === '/dashboard.html') {
      handleStaticFile(stream, '/dashboard.html');
      return;
    }
    // Serve assets from /public or common static extensions
    if (cleanPath.startsWith('/public/') || cleanPath.match(/\.(html|css|js|png|jpg|jpeg|gif|svg|ico)$/)) {
      handleStaticFile(stream, cleanPath);
      return;
    }
  }

  // ============================================
  // 5. 404 Not Found
  // ============================================
  stream.respond({
    ':status': 404,
    'content-type': 'application/json',
  });
  
  stream.end(JSON.stringify({
    error: 'Not Found',
    path: cleanPath,
    method,
  }));
}

// ============================================
// Stats Endpoint Handler (Enhanced)
// ============================================
/**
 * Returns comprehensive system statistics
 * Useful for monitoring and debugging
 */
function handleStats(stream) {
  try {
    const bufferStats = getBufferStats();
    
    // Gather statistics from all services
    const stats = {
      timestamp: new Date().toISOString(),
      uptime: process.uptime(),
      memory: {
        rss: (process.memoryUsage().rss / 1024 / 1024).toFixed(2) + ' MB',
        heapUsed: (process.memoryUsage().heapUsed / 1024 / 1024).toFixed(2) + ' MB',
        heapTotal: (process.memoryUsage().heapTotal / 1024 / 1024).toFixed(2) + ' MB',
      },
      
      // Health status
      health: {
        status: bufferStats.isHealthy ? 'healthy' : 'degraded',
        bufferFull: bufferStats.isBufferFull,
        timeSinceLastFlush: (bufferStats.timeSinceLastFlush / 1000).toFixed(2) + 's',
      },
      
      // Stream statistics
      streams: getStreamStats(),
      
      // SSE client statistics
      sse: getSSEStats(),
      
      // Buffer statistics (detailed)
      buffer: {
        ...bufferStats,
        dropRate: bufferStats.totalProcessed > 0 
          ? ((bufferStats.totalDropped / bufferStats.totalProcessed) * 100).toFixed(2) + '%'
          : '0%',
        flushRate: bufferStats.totalProcessed > 0
          ? ((bufferStats.totalFlushed / bufferStats.totalProcessed) * 100).toFixed(2) + '%'
          : '0%',
      },
      
      // Aggregation statistics
      aggregations: getAggregationStats(),
    };
    
    // Send JSON response
    stream.respond({
      ':status': 200,
      'content-type': 'application/json',
    });
    
    stream.end(JSON.stringify(stats, null, 2));
    
  } catch (error) {
    console.error('❌ Error in stats endpoint:', error.message);
    
    stream.respond({
      ':status': 500,
      'content-type': 'application/json',
    });
    
    stream.end(JSON.stringify({
      error: 'Internal Server Error',
      message: error.message,
    }));
  }
}

// ============================================
// Health Check Handler
// ============================================
/**
 * Simple health check endpoint
 * Returns 200 OK if server is running
 */
// في الـ handleHealth function
// function handleHealth(stream) {
//   stream.respond({
//     ':status': 200,
//     'content-type': 'application/json',
//     'cache-control': 'no-cache',
//     'x-instance-name': process.env.INSTANCE_NAME || 'unknown',
//   });
  
//   stream.end(JSON.stringify({
//     status: 'healthy',
//     instance: process.env.INSTANCE_NAME || 'unknown',
//     timestamp: new Date().toISOString(),
//     uptime: process.uptime(),
//   }));
// }

export default {
  handleRequest,
};

// ============================================
// Static File Handler
// ============================================
function handleStaticFile(stream, filePath) {
  try {
    if (filePath.includes('..')) {
      stream.respond({ ':status': 403 });
      stream.end('Forbidden');
      return;
    }

    let fsPath;
    if (filePath.startsWith('/public/')) {
      fsPath = path.join(__dirname, '..', filePath);
    } else {
      fsPath = path.join(__dirname, '../public', filePath);
    }

    if (!fs.existsSync(fsPath)) {
      stream.respond({ ':status': 404 });
      stream.end('Not Found');
      return;
    }

    const content = fs.readFileSync(fsPath);
    const ext = path.extname(filePath).toLowerCase();
    const contentTypes = {
      '.html': 'text/html',
      '.css': 'text/css',
      '.js': 'application/javascript',
      '.json': 'application/json',
      '.png': 'image/png',
      '.jpg': 'image/jpeg',
      '.jpeg': 'image/jpeg',
      '.gif': 'image/gif',
      '.svg': 'image/svg+xml',
      '.ico': 'image/x-icon',
    };
    const contentType = contentTypes[ext] || 'application/octet-stream';

    stream.respond({
      ':status': 200,
      'content-type': contentType,
      'content-length': content.length,
    });
    stream.end(content);

  } catch (error) {
    console.error('❌ Error serving static file:', error.message);
    stream.respond({ ':status': 500 });
    stream.end('Internal Server Error');
  }
}
