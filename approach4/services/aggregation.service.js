// Real-Time Aggregation Service
// Maintains in-memory aggregations for fast dashboard updates

// ============================================
// In-Memory Aggregation Map
// ============================================
// Structure: Map<"server_id:metric_name", AggregationObject>
// Example: Map<"srv-001:cpu_usage", { count: 100, sum: 4523.5, ... }>
const serverAggregations = new Map();

// ============================================
// Aggregation Object Structure
// ============================================
/**
 * Each aggregation contains:
 * {
 *   server_id: "srv-001",
 *   metric_name: "cpu_usage",
 *   count: 100,           // Number of data points
 *   sum: 4523.5,          // Sum of all values
 *   min: 12.3,            // Minimum value
 *   max: 98.7,            // Maximum value
 *   avg: 45.235,          // Average (sum / count)
 *   lastValue: 47.2,      // Most recent value
 *   lastUpdate: 1234567890, // Timestamp of last update
 *   values: [45.2, 46.1, ...] // Recent values (for P95 calculation)
 * }
 */

// ============================================
// Update Aggregation with New Metric
// ============================================
/**
 * Updates in-memory aggregation with a new metric value
 * This is called for EVERY incoming metric
 * @param {Object} metric - The metric object
 */
export function updateAggregation(metric) {
  const { server_id, metric_name, value, ts } = metric;
  
  // Create unique key for this server+metric combination
  // Example: "srv-001:cpu_usage"
  const key = `${server_id}:${metric_name}`;
  
  // Get existing aggregation or create new one
  let agg = serverAggregations.get(key);
  
  if (!agg) {
    // First time seeing this server+metric
    // Initialize new aggregation object
    agg = {
      server_id,
      metric_name,
      count: 0,
      sum: 0,
      min: Infinity,  // Start with max possible value
      max: -Infinity, // Start with min possible value
      avg: 0,
      lastValue: value,
      lastUpdate: ts || Date.now(),
      values: [], // Keep last 100 values for P95 calculation
    };
    
    serverAggregations.set(key, agg);
    console.log(`📊 Created new aggregation for ${key}`);
  }
  
  // Update aggregation with new value
  agg.count++;
  agg.sum += value;
  agg.min = Math.min(agg.min, value);
  agg.max = Math.max(agg.max, value);
  agg.avg = agg.sum / agg.count; // Recalculate average
  agg.lastValue = value;
  agg.lastUpdate = ts || Date.now();
  
  // Add to values array (for P95 calculation)
  agg.values.push(value);
  
  // Keep only last 100 values (memory optimization)
  if (agg.values.length > 100) {
    agg.values.shift(); // Remove oldest value
  }
}

// ============================================
// Get Aggregation for Server+Metric
// ============================================
/**
 * Gets aggregation for a specific server and metric
 * @param {string} serverId - Server UUID
 * @param {string} metricName - Metric name
 * @returns {Object|null} Aggregation object or null if not found
 */
export function getAggregation(serverId, metricName) {
  const key = `${serverId}:${metricName}`;
  return serverAggregations.get(key) || null;
}

// ============================================
// Get All Aggregations
// ============================================
/**
 * Returns all aggregations as an array
 * Used for dashboard updates
 * @returns {Array} Array of aggregation objects
 */
export function getAllAggregations() {
  // Convert Map to Array
  return Array.from(serverAggregations.values());
}

// ============================================
// Get Aggregations by Server
// ============================================
/**
 * Gets all aggregations for a specific server
 * @param {string} serverId - Server UUID
 * @returns {Array} Array of aggregation objects
 */
export function getServerAggregations(serverId) {
  const aggregations = [];
  
  // Iterate through all aggregations
  for (const [key, agg] of serverAggregations) {
    if (agg.server_id === serverId) {
      aggregations.push(agg);
    }
  }
  
  return aggregations;
}

// ============================================
// Calculate P95 for Aggregation (Improved)
// ============================================
/**
 * Calculates 95th percentile with improved accuracy
 * @param {string} serverId - Server UUID
 * @param {string} metricName - Metric name
 * @returns {number|null} P95 value or null
 */
export function calculateP95(serverId, metricName) {
  const key = `${serverId}:${metricName}`;
  const agg = serverAggregations.get(key);
  
  if (!agg || agg.values.length === 0) {
    return null;
  }
  
  // Sort values in ascending order
  const sortedValues = [...agg.values].sort((a, b) => a - b);
  
  // More accurate P95 index calculation
  // Use ceil instead of floor for better accuracy
  const index = Math.ceil(sortedValues.length * 0.95) - 1;
  
  // Ensure index is within bounds
  const safeIndex = Math.max(0, Math.min(index, sortedValues.length - 1));
  
  return sortedValues[safeIndex];
}

// ============================================
// Get Dashboard Summary
// ============================================
/**
 * Returns a summary suitable for dashboard display
 * Includes only essential fields to reduce payload size
 * @returns {Array} Array of simplified aggregation objects
 */
export function getDashboardSummary() {
  const summary = [];
  
  for (const agg of serverAggregations.values()) {
    // Calculate P95 on-the-fly
    const p95 = calculateP95(agg.server_id, agg.metric_name);
    
    summary.push({
      server_id: agg.server_id,
      metric_name: agg.metric_name,
      avg: parseFloat(agg.avg.toFixed(2)),     // Round to 2 decimals
      min: parseFloat(agg.min.toFixed(2)),
      max: parseFloat(agg.max.toFixed(2)),
      last: parseFloat(agg.lastValue.toFixed(2)),
      count: agg.count,
      p95: p95 ? parseFloat(p95.toFixed(2)) : null,
      lastUpdate: agg.lastUpdate,
    });
  }
  
  return summary;
}

// ============================================
// Reset Aggregation (for testing)
// ============================================
/**
 * Resets a specific aggregation
 * Useful for testing or clearing stale data
 * @param {string} serverId - Server UUID
 * @param {string} metricName - Metric name
 */
export function resetAggregation(serverId, metricName) {
  const key = `${serverId}:${metricName}`;
  serverAggregations.delete(key);
  console.log(`🗑️ Reset aggregation for ${key}`);
}

// ============================================
// Reset All Aggregations
// ============================================
/**
 * Clears all in-memory aggregations
 * Useful for testing or freeing memory
 */
export function resetAllAggregations() {
  const count = serverAggregations.size;
  serverAggregations.clear();
  console.log(`🗑️ Reset ${count} aggregations`);
}

// ============================================
// Get Statistics
// ============================================
/**
 * Returns statistics about aggregations
 * Used for monitoring
 */
export function getAggregationStats() {
  const aggregations = getAllAggregations();
  
  // Calculate total data points across all aggregations
  const totalDataPoints = aggregations.reduce((sum, agg) => sum + agg.count, 0);
  
  // Calculate memory usage estimate
  // Each aggregation: ~100 values × 8 bytes + overhead ≈ 1KB
  const memoryEstimateMB = (serverAggregations.size * 1) / 1024;
  
  return {
    totalAggregations: serverAggregations.size,
    totalDataPoints,
    memoryEstimateMB: memoryEstimateMB.toFixed(2),
    servers: new Set(aggregations.map(a => a.server_id)).size,
    metrics: new Set(aggregations.map(a => a.metric_name)).size,
  };
}

export default {
  updateAggregation,
  getAggregation,
  getAllAggregations,
  getServerAggregations,
  calculateP95,
  getDashboardSummary,
  resetAggregation,
  resetAllAggregations,
  getAggregationStats,
};