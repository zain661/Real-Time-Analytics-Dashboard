// HTTP/2 Stream Controller
// Handles incoming metric streams from servers

import { addMetricToBuffer, ensureServerExists } from '../services/metric.service.js';
import { updateAggregation } from '../services/aggregation.service.js';
import { streamConfig } from '../config/http2.config.js';

// ============================================
// Track Active Streams
// ============================================
// Map<streamId, streamInfo>
// Keeps track of all active HTTP/2 streams
const activeStreams = new Map();

// ============================================
// Handle HTTP/2 Stream
// ============================================
/**
 * Main handler for incoming metric streams
 * Called when a server opens a POST /api/metrics/stream connection
 * @param {Http2Stream} stream - HTTP/2 stream object
 * @param {Object} headers - HTTP/2 headers
 */
export async function handleMetricStream(stream, headers) {
  // Extract stream information
  const streamId = stream.id; // HTTP/2 stream ID (unique per connection)
  const serverId = headers['x-server-id'] || `unknown-${Date.now()}`;
  const contentType = headers['content-type'] || 'application/x-ndjson';
  
  console.log(`🚀 Stream ${streamId} opened for server: ${serverId}`);
  console.log(`   Content-Type: ${contentType}`);
  
  // ============================================
  // 1. Respond with HTTP 200 OK
  // ============================================
  // This tells the client we're ready to receive data
  stream.respond({
    ':status': 200,                    // HTTP status code
    'content-type': 'text/plain',      // We send back text acknowledgments
    'x-stream-id': streamId.toString(), // Echo back stream ID
  });
  
  console.log(`✅ Stream ${streamId} acknowledged (200 OK)`);
  
  // ============================================
  // 2. Ensure Server Exists in Database
  // ============================================
  // Check if this server is registered, create if not
  try {
    await ensureServerExists(serverId);
  } catch (error) {
    console.error(`❌ Failed to register server ${serverId}:`, error.message);
    stream.close();
    return;
  }
  
  // ============================================
  // 3. Track Stream
  // ============================================
  // Store information about this stream
  const streamInfo = {
    streamId,
    serverId,
    startTime: Date.now(),
    metricsReceived: 0,
    bytesReceived: 0,
    lastActivity: Date.now(),
  };
  activeStreams.set(streamId, streamInfo);
  
  // ============================================
  // 4. Setup Heartbeat
  // ============================================
  // Send periodic "pings" to keep connection alive
  // HTTP/2 can timeout if no data flows
  const heartbeat = setInterval(() => {
    try {
      // Send a comment line (SSE-style heartbeat)
      // This doesn't interfere with NDJSON parsing
      stream.write(': heartbeat\n');
    } catch (error) {
      console.warn(`⚠️ Heartbeat failed for stream ${streamId}:`, error.message);
      clearInterval(heartbeat);
    }
  }, streamConfig.HEARTBEAT_INTERVAL_MS);
  
  // ============================================
  // 5. Setup Data Buffer
  // ============================================
  // For NDJSON parsing (Newline-Delimited JSON)
  // Each line is a separate JSON object
  let buffer = '';
  
  // ============================================
  // 6. Handle Incoming Data
  // ============================================
  stream.on('data', async (chunk) => {
    // Update statistics
    streamInfo.bytesReceived += chunk.length;
    streamInfo.lastActivity = Date.now();
    
    // ============================================
    // Parse NDJSON Stream
    // ============================================
    // Append chunk to buffer
    buffer += chunk.toString('utf8');
    
    // Split by newlines
    const lines = buffer.split('\n');
    
    // Last line might be incomplete, keep it in buffer
    buffer = lines.pop() || '';
    
    // Process each complete line
    for (const line of lines) {
      // Skip empty lines
      if (!line.trim()) continue;
      
      // Skip heartbeat comments
      if (line.startsWith(':')) continue;
      
      // ============================================
      // Parse and Validate Metric
      // ============================================
      let metric;
      try {
        metric = JSON.parse(line);
      } catch (error) {
        console.warn(`⚠️ Invalid JSON from stream ${streamId}:`, line.substring(0, 50));
        continue; // Skip this line
      }
      
      // Validate required fields
      if (!metric.server_id || !metric.metric_name || metric.value === undefined) {
        console.warn(`⚠️ Invalid metric from stream ${streamId}:`, metric);
        continue;
      }
      
      // ============================================
      // Process Metric
      // ============================================
      try {
        // Add timestamp if not provided
        if (!metric.ts) {
          metric.ts = new Date();
        } else if (typeof metric.ts === 'number') {
          // Convert Unix timestamp to Date
          metric.ts = new Date(metric.ts);
        }
        
        // Add to batch buffer (for DB insert) - with backpressure check
        const accepted = await addMetricToBuffer(metric);
        
        if (!accepted) {
          // Buffer full - apply backpressure
          console.warn(`⚠️ Stream ${streamId}: Backpressure - buffer full, metric dropped`);
          
          // Send backpressure signal to client
          try {
            stream.write('BACKPRESSURE:SLOW_DOWN\n');
          } catch (err) {
            // Stream might be closed
          }
          
          continue; // Skip this metric
        }
        
        // Update in-memory aggregation (for real-time dashboard)
        updateAggregation(metric);
        
        // Update stream statistics
        streamInfo.metricsReceived++;
        
      } catch (error) {
        console.error(`❌ Error processing metric from stream ${streamId}:`, error.message);
      }
    }
    
    // ============================================
    // 7. Send Acknowledgment (Optional)
    // ============================================
    // Every 100 metrics, send ACK back to client
    if (streamInfo.metricsReceived % 100 === 0) {
      try {
        stream.write(`ACK:${streamInfo.metricsReceived}\n`);
      } catch (error) {
        console.warn(`⚠️ Failed to send ACK to stream ${streamId}`);
      }
    }
    
    // ============================================
    // 8. Backpressure Handling
    // ============================================
    // If too many metrics in buffer, apply backpressure
    // This tells the client to slow down
    if (streamInfo.metricsReceived % streamConfig.MAX_BUFFER_SIZE === 0) {
      console.warn(`⚠️ Stream ${streamId}: Backpressure detected (${streamInfo.metricsReceived} metrics)`);
      // HTTP/2 has built-in flow control, no action needed
    }
  });
  
  // ============================================
  // 9. Handle Stream End
  // ============================================
  stream.on('end', () => {
    const duration = ((Date.now() - streamInfo.startTime) / 1000).toFixed(2);
    const throughput = (streamInfo.metricsReceived / duration).toFixed(2);
    
    console.log(`🔌 Stream ${streamId} ended gracefully`);
    console.log(`   Server: ${serverId}`);
    console.log(`   Duration: ${duration}s`);
    console.log(`   Metrics: ${streamInfo.metricsReceived}`);
    console.log(`   Throughput: ${throughput} metrics/sec`);
    
    cleanup();
  });
  
  // ============================================
  // 10. Handle Stream Close
  // ============================================
  stream.on('close', () => {
    console.log(`🔻 Stream ${streamId} closed by client`);
    cleanup();
  });
  
  // ============================================
  // 11. Handle Stream Errors
  // ============================================
  stream.on('error', (error) => {
    console.error(`❌ Stream ${streamId} error:`, error.message);
    cleanup();
  });
  
  // ============================================
  // Cleanup Function
  // ============================================
  function cleanup() {
    // Stop heartbeat
    clearInterval(heartbeat);
    
    // Remove from active streams
    activeStreams.delete(streamId);
    
    // Try to close stream
    try {
      if (!stream.closed && !stream.destroyed) {
        stream.close();
      }
    } catch (error) {
      // Already closed
    }
    
    console.log(`🧹 Cleaned up stream ${streamId}`);
  }
}

// ============================================
// Get Active Streams Statistics
// ============================================
/**
 * Returns statistics about active streams
 * Used for monitoring and debugging
 */
export function getStreamStats() {
  const streams = Array.from(activeStreams.values());
  
  return {
    activeStreams: activeStreams.size,
    totalMetrics: streams.reduce((sum, s) => sum + s.metricsReceived, 0),
    totalBytes: streams.reduce((sum, s) => sum + s.bytesReceived, 0),
    streams: streams.map(s => ({
      streamId: s.streamId,
      serverId: s.serverId,
      uptime: Math.floor((Date.now() - s.startTime) / 1000),
      metricsReceived: s.metricsReceived,
      throughput: (s.metricsReceived / ((Date.now() - s.startTime) / 1000)).toFixed(2),
    })),
  };
}

export default {
  handleMetricStream,
  getStreamStats,
};