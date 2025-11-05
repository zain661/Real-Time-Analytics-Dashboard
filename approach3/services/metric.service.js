// Enhanced Metric Processing Service
// Addresses: concurrency, buffer limits, retry strategy, ordering, monitoring

import db from '../../db/models/index.cjs';
import { batchConfig } from '../config/http2.config.js';
import { Mutex } from 'async-mutex';

// ============================================
// Configuration
// ============================================
const MAX_BUFFER_SIZE = 10000; // Max metrics in buffer before applying backpressure
const MAX_RETRY_ATTEMPTS = 3;
const RETRY_DELAY_MS = 1000; // Initial retry delay (exponential backoff)

// ============================================
// In-Memory Batch Buffer (Thread-safe)
// ============================================
const metricsBuffer = [];
const bufferMutex = new Mutex(); // Prevents race conditions

// ============================================
// Retry Queue (for failed batches)
// ============================================
const retryQueue = [];
const retryMutex = new Mutex();

// ============================================
// Statistics
// ============================================
let totalProcessed = 0;
let totalFlushed = 0;
let totalDropped = 0; // Dropped due to buffer overflow
let totalFailed = 0;  // Failed after max retries
let lastFlushTime = Date.now();
let isBufferFull = false;

// ============================================
// Add Metric to Buffer (Thread-safe)
// ============================================
/**
 * Adds a metric to the buffer with overflow protection
 * @param {Object} metric - Metric object
 * @returns {boolean} true if added, false if buffer full
 */
export async function addMetricToBuffer(metric) {
  // Acquire lock to prevent race conditions
  const release = await bufferMutex.acquire();
  
  try {
    // Check buffer size BEFORE adding
    if (metricsBuffer.length >= MAX_BUFFER_SIZE) {
      isBufferFull = true;
      totalDropped++;
      
      // Log warning every 100 drops
      if (totalDropped % 100 === 0) {
        console.warn(`⚠️ Buffer full! Dropped ${totalDropped} metrics total`);
      }
      
      return false; // Signal backpressure to caller
    }
    
    // Add to buffer
    metricsBuffer.push({
      server_id: metric.server_id,
      metric_name: metric.metric_name,
      value: parseFloat(metric.value),
      labels: metric.labels || {},
      ts: metric.ts || new Date(),
    });
    
    totalProcessed++;
    isBufferFull = false;
    
    // Auto-flush if batch size reached
    if (metricsBuffer.length >= batchConfig.BATCH_SIZE) {
      // Don't wait for flush (async)
      setImmediate(() => flushMetrics());
    }
    
    return true; // Successfully added
    
  } finally {
    release(); // Always release lock
  }
}

// ============================================
// Flush Metrics to Database (with Retry)
// ============================================
/**
 * Flushes buffered metrics with retry logic
 * @returns {Promise<Object>} Flush result
 */
export async function flushMetrics() {
  // Acquire lock
  const release = await bufferMutex.acquire();
  let batch = [];
  
  try {
    if (metricsBuffer.length === 0) return { flushed: 0, failed: 0 };
    
    // Extract batch while maintaining order
    batch = metricsBuffer.splice(0, metricsBuffer.length);
    
  } finally {
    release(); // Release lock immediately
  }
  
  // Flush outside of lock (don't block buffer writes)
  return await flushBatch(batch, 0);
}

// ============================================
// Flush Batch with Exponential Backoff Retry
// ============================================
/**
 * Internal function to flush a batch with retry logic
 * @param {Array} batch - Metrics batch
 * @param {number} attempt - Current retry attempt
 * @returns {Promise<Object>} Result
 */
async function flushBatch(batch, attempt = 0) {
  const startTime = Date.now();
  
  try {
    // Use transaction for atomicity
    await db.sequelize.transaction(async (transaction) => {
      await db.MetricRaw.bulkCreate(batch, {
        validate: false,        // Skip validation for speed
        hooks: false,           // Skip hooks for speed
        ignoreDuplicates: true, // Ignore duplicates (if any)
        transaction,
      });
    });
    
    const duration = Date.now() - startTime;
    totalFlushed += batch.length;
    lastFlushTime = Date.now();
    
    console.log(`✅ Flushed ${batch.length} metrics in ${duration}ms (Total: ${totalFlushed})`);
    
    return { flushed: batch.length, failed: 0 };
    
  } catch (error) {
    console.error(`❌ Flush attempt ${attempt + 1}/${MAX_RETRY_ATTEMPTS} failed:`, error.message);
    
    // Retry with exponential backoff
    if (attempt < MAX_RETRY_ATTEMPTS - 1) {
      const delay = RETRY_DELAY_MS * Math.pow(2, attempt); // Exponential backoff
      console.log(`🔄 Retrying in ${delay}ms...`);
      
      await new Promise(resolve => setTimeout(resolve, delay));
      return await flushBatch(batch, attempt + 1);
      
    } else {
      // Max retries reached - move to retry queue
      console.error(`❌ Max retries reached for batch of ${batch.length} metrics`);
      totalFailed += batch.length;
      
      // Add to retry queue (with limit)
      await addToRetryQueue(batch);
      
      return { flushed: 0, failed: batch.length };
    }
  }
}

// ============================================
// Retry Queue Management
// ============================================
/**
 * Adds failed batch to retry queue
 * @param {Array} batch - Failed batch
 */
async function addToRetryQueue(batch) {
  const release = await retryMutex.acquire();
  
  try {
    // Limit retry queue size (prevent memory leak)
    const MAX_RETRY_QUEUE_SIZE = 50000;
    
    if (retryQueue.length + batch.length > MAX_RETRY_QUEUE_SIZE) {
      const dropCount = (retryQueue.length + batch.length) - MAX_RETRY_QUEUE_SIZE;
      console.warn(`⚠️ Retry queue full, dropping ${dropCount} oldest metrics`);
      retryQueue.splice(0, dropCount);
    }
    
    retryQueue.push(...batch);
    console.log(`📋 Added ${batch.length} metrics to retry queue (Total: ${retryQueue.length})`);
    
  } finally {
    release();
  }
}

/**
 * Process retry queue
 */
async function processRetryQueue() {
  if (retryQueue.length === 0) return;
  
  const release = await retryMutex.acquire();
  let batch = [];
  
  try {
    // Take small batch from retry queue
    batch = retryQueue.splice(0, Math.min(batchConfig.BATCH_SIZE, retryQueue.length));
  } finally {
    release();
  }
  
  if (batch.length > 0) {
    console.log(`🔄 Processing ${batch.length} metrics from retry queue`);
    await flushBatch(batch, 0);
  }
}

// ============================================
// Aggregate Metrics (Optimized with SQL)
// ============================================
/**
 * Aggregates metrics using SQL (much faster than in-memory)
 * @param {string} serverId - Server UUID
 * @param {string} metricName - Metric name
 * @param {Date} startTime - Start time
 * @param {Date} endTime - End time
 */
export async function aggregateMetrics(serverId, metricName, startTime, endTime) {
  try {
    // Use SQL aggregation (GROUP BY) - MUCH faster
    const [results] = await db.sequelize.query(`
      SELECT 
        COUNT(*) as count,
        SUM(value) as sum,
        MIN(value) as min,
        MAX(value) as max,
        AVG(value) as avg
      FROM MetricRaws
      WHERE server_id = :serverId
        AND metric_name = :metricName
        AND ts >= :startTime
        AND ts < :endTime
        AND deleted_at IS NULL
    `, {
      replacements: { serverId, metricName, startTime, endTime },
      type: db.Sequelize.QueryTypes.SELECT,
    });
    
    if (!results || results.count === 0) {
      console.log(`⚠️ No metrics found for ${serverId}/${metricName}`);
      return null;
    }
    
    const { count, sum, min, max, avg } = results;
    
    // Calculate P95 (requires separate query)
    const p95 = await calculateP95SQL(serverId, metricName, startTime, endTime, count);
    
    // Round start time to minute
    const tsMin = new Date(startTime);
    tsMin.setSeconds(0, 0);
    
    // Upsert aggregation
    const [aggregation] = await db.MetricMinuteAgg.findOrCreate({
      where: {
        server_id: serverId,
        metric_name: metricName,
        ts_min: tsMin,
      },
      defaults: {
        count: parseInt(count),
        sum: parseFloat(sum),
        min: parseFloat(min),
        max: parseFloat(max),
        p95: p95 ? parseFloat(p95) : null,
      },
    });
    
    // Update if already exists
    if (aggregation) {
      await aggregation.update({
        count: parseInt(count),
        sum: parseFloat(sum),
        min: parseFloat(min),
        max: parseFloat(max),
        p95: p95 ? parseFloat(p95) : null,
      });
    }
    
    console.log(`✅ Aggregated ${count} metrics for ${serverId}/${metricName}`);
    return aggregation;
    
  } catch (error) {
    console.error('❌ Error aggregating metrics:', error.message);
    throw error;
  }
}

// ============================================
// Calculate P95 using SQL
// ============================================
/**
 * Calculates P95 using SQL (database-specific)
 * MySQL doesn't have native percentile, so we use offset
 */
async function calculateP95SQL(serverId, metricName, startTime, endTime, count) {
  try {
    const offset = Math.ceil(count * 0.95) - 1; // More accurate P95 index
    
    if (offset < 0) return null;
    
    const [results] = await db.sequelize.query(`
      SELECT value
      FROM MetricRaws
      WHERE server_id = :serverId
        AND metric_name = :metricName
        AND ts >= :startTime
        AND ts < :endTime
        AND deleted_at IS NULL
      ORDER BY value ASC
      LIMIT 1 OFFSET :offset
    `, {
      replacements: { serverId, metricName, startTime, endTime, offset },
      type: db.Sequelize.QueryTypes.SELECT,
    });
    
    return results?.value || null;
    
  } catch (error) {
    console.warn('⚠️ Failed to calculate P95:', error.message);
    return null;
  }
}

// ============================================
// Ensure Server Exists
// ============================================
export async function ensureServerExists(serverId, hostname = null) {
  try {
    const [server, created] = await db.Server.findOrCreate({
      where: { id: serverId },
      defaults: {
        id: serverId,
        hostname: hostname || serverId,
        tags: {},
        meta: {},
      },
    });
    
    if (created) {
      console.log(`✅ Registered new server: ${serverId}`);
    }
    
    return server;
    
  } catch (error) {
    console.error('❌ Error ensuring server exists:', error.message);
    throw error;
  }
}

// ============================================
// Enhanced Buffer Statistics
// ============================================
export function getBufferStats() {
  return {
    // Buffer stats
    bufferSize: metricsBuffer.length,
    bufferLimit: MAX_BUFFER_SIZE,
    bufferUtilization: ((metricsBuffer.length / MAX_BUFFER_SIZE) * 100).toFixed(2) + '%',
    isBufferFull,
    
    // Retry queue
    retryQueueSize: retryQueue.length,
    
    // Counters
    totalProcessed,
    totalFlushed,
    totalDropped,
    totalFailed,
    
    // Timing
    lastFlushTime,
    timeSinceLastFlush: Date.now() - lastFlushTime,
    
    // Health
    isHealthy: !isBufferFull && (Date.now() - lastFlushTime) < 30000,
  };
}

// ============================================
// Check if Buffer is Accepting
// ============================================
export function canAcceptMetrics() {
  return metricsBuffer.length < MAX_BUFFER_SIZE;
}

// ============================================
// Start Periodic Services
// ============================================
export function startPeriodicFlush() {
  // Regular flush
  setInterval(() => {
    if (metricsBuffer.length > 0) {
      console.log(`⏰ Periodic flush (${metricsBuffer.length} metrics)`);
      flushMetrics();
    }
  }, batchConfig.BATCH_INTERVAL_MS);
  
  // Retry queue processing (every 30 seconds)
  setInterval(() => {
    processRetryQueue();
  }, 30000);
  
  console.log(`✅ Periodic flush started (every ${batchConfig.BATCH_INTERVAL_MS}ms)`);
  console.log(`✅ Retry queue processing started (every 30s)`);
}

export default {
  addMetricToBuffer,
  flushMetrics,
  aggregateMetrics,
  ensureServerExists,
  getBufferStats,
  canAcceptMetrics,
  startPeriodicFlush,
};