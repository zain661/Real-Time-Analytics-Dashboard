// // Dashboard Controller (Server-Sent Events)
// // Sends real-time updates to dashboard clients

// import { getDashboardSummary, getAggregationStats } from '../services/aggregation.service.js';
// import { sseConfig } from '../config/http2.config.js';

// // ============================================
// // Track SSE Clients
// // ============================================
// // Set of all connected dashboard clients
// const sseClients = new Set();

// // ============================================
// // Handle SSE Connection
// // ============================================
// /**
//  * Handles incoming SSE connection from dashboard
//  * GET /api/dashboard/stream
//  * @param {Http2Stream} stream - HTTP/2 stream object
//  * @param {Object} headers - HTTP/2 headers
//  */
// export function handleDashboardSSE(stream, headers) {
//   const clientId = `client-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
  
//   console.log(`📊 Dashboard client connected: ${clientId}`);
  
//   // ============================================
//   // 1. Send SSE Headers
//   // ============================================
//   // These headers are REQUIRED for Server-Sent Events
//   stream.respond({
//     ':status': 200,
//     'content-type': 'text/event-stream',  // MUST be text/event-stream
//     'cache-control': 'no-cache',          // Don't cache SSE streams
//     // 'connection': 'keep-alive',            // Keep connection open
//     'x-accel-buffering': 'no',            // Disable nginx buffering
//   });
  
//   // ============================================
//   // 2. Send Initial Data
//   // ============================================
//   // Send current state immediately when client connects
//   const initialData = getDashboardSummary();
//   sendSSEEvent(stream, {
//     type: 'init',
//     data: initialData,
//     timestamp: Date.now(),
//   });
  
//   console.log(`✅ Sent initial data to ${clientId} (${initialData.length} aggregations)`);
  
//   // ============================================
//   // 3. Add to Client List
//   // ============================================
//   const clientInfo = {
//     id: clientId,
//     stream,
//     connectedAt: Date.now(),
//     eventsSent: 1, // We already sent init event
//   };
//   sseClients.add(clientInfo);
  
//   // ============================================
//   // 4. Setup Heartbeat
//   // ============================================
//   // SSE requires periodic data to keep connection alive
//   // Send a comment every 30 seconds
//   const heartbeat = setInterval(() => {
//     try {
//       // SSE comment format: ": comment\n\n"
//       stream.write(': heartbeat\n\n');
//     } catch (error) {
//       console.warn(`⚠️ Heartbeat failed for ${clientId}:`, error.message);
//       clearInterval(heartbeat);
//       removeClient(clientInfo);
//     }
//   }, sseConfig.HEARTBEAT_INTERVAL_MS);
  
//   // ============================================
//   // 5. Handle Client Disconnect
//   // ============================================
//   stream.on('close', () => {
//     console.log(`👋 Dashboard client disconnected: ${clientId}`);
//     const duration = ((Date.now() - clientInfo.connectedAt) / 1000).toFixed(2);
//     console.log(`   Duration: ${duration}s, Events sent: ${clientInfo.eventsSent}`);
    
//     clearInterval(heartbeat);
//     removeClient(clientInfo);
//   });
  
//   stream.on('error', (error) => {
//     console.error(`❌ Dashboard client ${clientId} error:`, error.message);
//     clearInterval(heartbeat);
//     removeClient(clientInfo);
//   });
  
//   // ============================================
//   // Helper: Remove Client
//   // ============================================
//   function removeClient(client) {
//     sseClients.delete(client);
//     try {
//       if (!client.stream.closed && !client.stream.destroyed) {
//         client.stream.close();
//       }
//     } catch (error) {
//       // Already closed
//     }
//   }
// }

// // ============================================
// // Send SSE Event
// // ============================================
// /**
//  * Sends a properly formatted SSE event
//  * SSE format:
//  *   event: eventType\n
//  *   data: JSON\n
//  *   \n
//  * @param {Http2Stream} stream - Stream to send to
//  * @param {Object} event - Event object
//  * @param {string} event.type - Event type (e.g., 'update', 'init')
//  * @param {any} event.data - Event data (will be JSON stringified)
//  */
// function sendSSEEvent(stream, event) {
//   try {
//     // SSE format requires this exact structure
//     const message = 
//       `event: ${event.type}\n` +              // Event type
//       `data: ${JSON.stringify(event)}\n` +    // Data as JSON
//       `\n`;                                    // Empty line to end event
    
//     stream.write(message);
    
//   } catch (error) {
//     console.error('❌ Failed to send SSE event:', error.message);
//   }
// }

// // ============================================
// // Broadcast to All Clients
// // ============================================
// /**
//  * Sends an event to ALL connected dashboard clients
//  * @param {Object} event - Event object to broadcast
//  */
// export function broadcastToSSE(event) {
//   if (sseClients.size === 0) {
//     return; // No clients connected
//   }
  
//   const deadClients = [];
  
//   // Send to each client
//   for (const client of sseClients) {
//     try {
//       sendSSEEvent(client.stream, event);
//       client.eventsSent++;
      
//     } catch (error) {
//       console.warn(`⚠️ Failed to send to client ${client.id}:`, error.message);
//       deadClients.push(client);
//     }
//   }
  
//   // Remove dead clients
//   for (const client of deadClients) {
//     sseClients.delete(client);
//   }
// }

// // ============================================
// // Start Periodic Updates
// // ============================================
// /**
//  * Starts a timer that sends dashboard updates every second
//  * This pushes the latest aggregated data to all clients
//  */
// export function startPeriodicUpdates() {
//   setInterval(() => {
//     if (sseClients.size === 0) {
//       return; // No clients, skip
//     }
    
//     // Get latest aggregations
//     const data = getDashboardSummary();
    
//     // Broadcast to all clients
//     broadcastToSSE({
//       type: 'update',
//       data,
//       timestamp: Date.now(),
//     });
    
//   }, sseConfig.UPDATE_INTERVAL_MS);
  
//   console.log(`✅ Periodic dashboard updates started (every ${sseConfig.UPDATE_INTERVAL_MS}ms)`);
// }

// // ============================================
// // Get SSE Statistics
// // ============================================
// /**
//  * Returns statistics about connected SSE clients
//  */
// export function getSSEStats() {
//   const clients = Array.from(sseClients);
  
//   return {
//     connectedClients: sseClients.size,
//     totalEventsSent: clients.reduce((sum, c) => sum + c.eventsSent, 0),
//     clients: clients.map(c => ({
//       id: c.id,
//       uptime: Math.floor((Date.now() - c.connectedAt) / 1000),
//       eventsSent: c.eventsSent,
//     })),
//   };
// }

// export default {
//   handleDashboardSSE,
//   broadcastToSSE,
//   startPeriodicUpdates,
//   getSSEStats,
// };
// Dashboard Controller (Server-Sent Events)
// Sends real-time updates to dashboard clients

import { getDashboardSummary, getAggregationStats } from '../services/aggregation.service.js';
import { sseConfig } from '../config/http2.config.js';

// ============================================
// Track SSE Clients
// ============================================
// Set of all connected dashboard clients
const sseClients = new Set();

// ============================================
// Handle SSE Connection
// ============================================
/**
 * Handles incoming SSE connection from dashboard
 * GET /api/dashboard/stream
 * @param {Http2Stream} stream - HTTP/2 stream object
 * @param {Object} headers - HTTP/2 headers
 */
export function handleDashboardSSE(stream, headers) {
  const clientId = `client-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
  
  console.log(`📊 Dashboard client connected: ${clientId}`);
  
  // ============================================
  // 1. Send SSE Headers (HTTP/2 Compatible)
  // ============================================
  // These headers are REQUIRED for Server-Sent Events
  // Note: HTTP/2 doesn't support 'connection' header
  stream.respond({
    ':status': 200,
    'content-type': 'text/event-stream',  // MUST be text/event-stream
    'cache-control': 'no-cache',          // Don't cache SSE streams
    'x-accel-buffering': 'no',            // Disable nginx buffering (if behind nginx)
  });
  
  // ============================================
  // 2. Send Initial Data
  // ============================================
  // Send current state immediately when client connects
  const initialData = getDashboardSummary();
  sendSSEEvent(stream, {
    type: 'init',
    data: initialData,
    timestamp: Date.now(),
  });
  
  console.log(`✅ Sent initial data to ${clientId} (${initialData.length} aggregations)`);
  
  // ============================================
  // 3. Add to Client List
  // ============================================
  const clientInfo = {
    id: clientId,
    stream,
    connectedAt: Date.now(),
    eventsSent: 1, // We already sent init event
  };
  sseClients.add(clientInfo);
  
  // ============================================
  // 4. Setup Heartbeat
  // ============================================
  // SSE requires periodic data to keep connection alive
  // Send a comment every 30 seconds
  const heartbeat = setInterval(() => {
    try {
      // SSE comment format: ": comment\n\n"
      stream.write(': heartbeat\n\n');
    } catch (error) {
      console.warn(`⚠️ Heartbeat failed for ${clientId}:`, error.message);
      clearInterval(heartbeat);
      removeClient(clientInfo);
    }
  }, sseConfig.HEARTBEAT_INTERVAL_MS);
  
  // ============================================
  // 5. Handle Client Disconnect
  // ============================================
  stream.on('close', () => {
    console.log(`👋 Dashboard client disconnected: ${clientId}`);
    const duration = ((Date.now() - clientInfo.connectedAt) / 1000).toFixed(2);
    console.log(`   Duration: ${duration}s, Events sent: ${clientInfo.eventsSent}`);
    
    clearInterval(heartbeat);
    removeClient(clientInfo);
  });
  
  stream.on('error', (error) => {
    console.error(`❌ Dashboard client ${clientId} error:`, error.message);
    clearInterval(heartbeat);
    removeClient(clientInfo);
  });
  
  // ============================================
  // Helper: Remove Client
  // ============================================
  function removeClient(client) {
    sseClients.delete(client);
    try {
      if (!client.stream.closed && !client.stream.destroyed) {
        client.stream.close();
      }
    } catch (error) {
      // Already closed
    }
  }
}

// ============================================
// Send SSE Event
// ============================================
/**
 * Sends a properly formatted SSE event
 * SSE format:
 *   event: eventType\n
 *   data: JSON\n
 *   \n
 * @param {Http2Stream} stream - Stream to send to
 * @param {Object} event - Event object
 * @param {string} event.type - Event type (e.g., 'update', 'init')
 * @param {any} event.data - Event data (will be JSON stringified)
 */
function sendSSEEvent(stream, event) {
  try {
    // SSE format requires this exact structure
    const message = 
      `event: ${event.type}\n` +              // Event type
      `data: ${JSON.stringify(event)}\n` +    // Data as JSON
      `\n`;                                    // Empty line to end event
    
    stream.write(message);
    
  } catch (error) {
    console.error('❌ Failed to send SSE event:', error.message);
  }
}

// ============================================
// Broadcast to All Clients
// ============================================
/**
 * Sends an event to ALL connected dashboard clients
 * @param {Object} event - Event object to broadcast
 */
export function broadcastToSSE(event) {
  if (sseClients.size === 0) {
    return; // No clients connected
  }
  
  const deadClients = [];
  
  // Send to each client
  for (const client of sseClients) {
    try {
      sendSSEEvent(client.stream, event);
      client.eventsSent++;
      
    } catch (error) {
      console.warn(`⚠️ Failed to send to client ${client.id}:`, error.message);
      deadClients.push(client);
    }
  }
  
  // Remove dead clients
  for (const client of deadClients) {
    sseClients.delete(client);
  }
}

// ============================================
// Start Periodic Updates
// ============================================
/**
 * Starts a timer that sends dashboard updates every second
 * This pushes the latest aggregated data to all clients
 */
export function startPeriodicUpdates() {
  setInterval(() => {
    if (sseClients.size === 0) {
      return; // No clients, skip
    }
    
    // Get latest aggregations
    const data = getDashboardSummary();
    
    // Broadcast to all clients
    broadcastToSSE({
      type: 'update',
      data,
      timestamp: Date.now(),
    });
    
  }, sseConfig.UPDATE_INTERVAL_MS);
  
  console.log(`✅ Periodic dashboard updates started (every ${sseConfig.UPDATE_INTERVAL_MS}ms)`);
}

// ============================================
// Get SSE Statistics
// ============================================
/**
 * Returns statistics about connected SSE clients
 */
export function getSSEStats() {
  const clients = Array.from(sseClients);
  
  return {
    connectedClients: sseClients.size,
    totalEventsSent: clients.reduce((sum, c) => sum + c.eventsSent, 0),
    clients: clients.map(c => ({
      id: c.id,
      uptime: Math.floor((Date.now() - c.connectedAt) / 1000),
      eventsSent: c.eventsSent,
    })),
  };
}

export default {
  handleDashboardSSE,
  broadcastToSSE,
  startPeriodicUpdates,
  getSSEStats,
};