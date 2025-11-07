// HTTP/2 Server Configuration
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

// Get current directory (ES module doesn't have __dirname)
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

export const http2Options = {
  // TLS certificates (required for HTTP/2)
  key: fs.readFileSync(path.join(__dirname, '../certs/server-key.pem')),
  cert: fs.readFileSync(path.join(__dirname, '../certs/server-cert.pem')),

  // Allow HTTP/1.1 fallback (for compatibility)
  // This lets older clients connect using HTTP/1.1
  allowHTTP1: true,

  // HTTP/2 specific settings
  settings: {
    enableConnectProtocol: false,
    
    // Max concurrent streams per connection
    // With 10,000 servers, we might have multiple connections
    // Each connection can handle up to 1000 streams
    maxConcurrentStreams: 1000,
    
    // Initial flow control window size (bytes)
    // Larger = more data can be sent before waiting for ACK "كمية البيانات المسموح إرسالها دفعة واحدة قبل انتظار رد من الطرف الآخر."
    // Default is 65535, we multiply by 10 for better performance
    initialWindowSize: 65535 * 10, // ~655KB
    
    // Max size of header list (compressed) "الحد الأعلى المسموح لحجم الـ headers في كل stream."
    // Larger headers need more space
    maxHeaderListSize: 65536, // 64KB
  },
};

// ============================================
// Batching Configuration
// ============================================
export const batchConfig = {
  // How many metrics to batch before inserting to DB
  // Larger = fewer DB calls, but more memory usage
  BATCH_SIZE: 100,
  
  // Max time to wait before flushing batch (milliseconds)
  // Even if batch isn't full, flush after this time
  BATCH_INTERVAL_MS: 5000, // 5 seconds
};

// ============================================
// Streaming Configuration
// ============================================
export const streamConfig = {
  // Heartbeat interval to keep connections alive (milliseconds)
  // HTTP/2 can timeout if no data is sent
  HEARTBEAT_INTERVAL_MS: 15000, // 15 seconds
  
  // Max buffer size before applying backpressure
  // If client sends too fast, we pause reading
  MAX_BUFFER_SIZE: 1000,
};

// ============================================
// SSE (Server-Sent Events) Configuration
// ============================================
export const sseConfig = {
  // How often to send aggregated data to dashboard (milliseconds)
  UPDATE_INTERVAL_MS: 1000, // 1 second
  
  // Heartbeat for SSE connections (milliseconds) 
  HEARTBEAT_INTERVAL_MS: 30000, // 30 seconds
};

// ============================================
// Server Configuration
// ============================================
export const serverConfig = {
  // HTTP/2 port for metric ingestion
  HTTP2_PORT: process.env.HTTP2_PORT || 4002,
  
  // Host
  HOST: '0.0.0.0',
};

export default {
  http2Options,
  batchConfig,
  streamConfig,
  sseConfig,
  serverConfig,
};