import { handleMetricStream, getStreamStats } from '../controllers/stream.controller.js';
import { handleDashboardSSE, getSSEStats } from '../controllers/dashboard.controller.js';
import { getBufferStats } from '../services/metric.service.js';
import { getAggregationStats } from '../services/aggregation.service.js';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

/**
 * Routes incoming HTTP/2 requests to appropriate handlers
 * @param {Http2Stream} stream
 * @param {Object} headers
 */
export function handleRequest(stream, headers) {
  const pathHeader = headers[':path'];
  const method = headers[':method'];
  const cleanPath = pathHeader.split('?')[0];

  console.log(`📥 ${method} ${cleanPath}`);

  // Health Check
  if (cleanPath === '/health' && method === 'GET') {
    stream.respond({ ':status': 200, 'content-type': 'application/json' });
    stream.end(JSON.stringify({ status: 'healthy', instance: process.env.INSTANCE_NAME }));
    return;
  }

  // Metric Streaming
  if (cleanPath === '/api/metrics/stream' && method === 'POST') {
    handleMetricStream(stream, headers);
    return;
  }

  // Dashboard SSE
  if (cleanPath === '/api/dashboard/stream' && method === 'GET') {
    handleDashboardSSE(stream, headers);
    return;
  }

  // Stats Endpoint
  if (cleanPath === '/api/stats' && method === 'GET') {
    handleStats(stream);
    return;
  }

  // Serve static files
  if (method === 'GET') {
    if (cleanPath === '/' || cleanPath === '/index.html') {
      handleStaticFile(stream, '/index.html');
      return;
    }
    if (cleanPath === '/dashboard.html') {
      handleStaticFile(stream, '/dashboard.html');
      return;
    }
    if (cleanPath.startsWith('/public/') || cleanPath.match(/\.(html|css|js|png|jpg|jpeg|gif|svg|ico)$/)) {
      handleStaticFile(stream, cleanPath);
      return;
    }
  }

  // 404 Not Found
  stream.respond({ ':status': 404, 'content-type': 'application/json' });
  stream.end(JSON.stringify({ error: 'Not Found', path: cleanPath, method }));
}

// ============================================
// Stats Endpoint
// ============================================
function handleStats(stream) {
  try {
    const bufferStats = getBufferStats();
    const stats = {
      timestamp: new Date().toISOString(),
      uptime: process.uptime(),
      memory: {
        rss: (process.memoryUsage().rss / 1024 / 1024).toFixed(2) + ' MB',
        heapUsed: (process.memoryUsage().heapUsed / 1024 / 1024).toFixed(2) + ' MB',
        heapTotal: (process.memoryUsage().heapTotal / 1024 / 1024).toFixed(2) + ' MB',
      },
      health: {
        status: bufferStats.isHealthy ? 'healthy' : 'degraded',
        bufferFull: bufferStats.isBufferFull,
        timeSinceLastFlush: (bufferStats.timeSinceLastFlush / 1000).toFixed(2) + 's',
      },
      streams: getStreamStats(),
      sse: getSSEStats(),
      buffer: {
        ...bufferStats,
        dropRate: bufferStats.totalProcessed > 0 ? ((bufferStats.totalDropped / bufferStats.totalProcessed) * 100).toFixed(2) + '%' : '0%',
        flushRate: bufferStats.totalProcessed > 0 ? ((bufferStats.totalFlushed / bufferStats.totalProcessed) * 100).toFixed(2) + '%' : '0%',
      },
      aggregations: getAggregationStats(),
    };

    stream.respond({ ':status': 200, 'content-type': 'application/json' });
    stream.end(JSON.stringify(stats, null, 2));
  } catch (error) {
    console.error('❌ Error in stats endpoint:', error.message);
    stream.respond({ ':status': 500, 'content-type': 'application/json' });
    stream.end(JSON.stringify({ error: 'Internal Server Error', message: error.message }));
  }
}

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

    let fsPath = filePath.startsWith('/public/') ? path.join(__dirname, '..', filePath) : path.join(__dirname, '../public', filePath);

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

    stream.respond({ ':status': 200, 'content-type': contentType, 'content-length': content.length });
    stream.end(content);

  } catch (error) {
    console.error('❌ Error serving static file:', error.message);
    stream.respond({ ':status': 500 });
    stream.end('Internal Server Error');
  }
}

export default { handleRequest };

