const db = require("../../../db/models");
const { MetricRaw, MetricMinuteAgg } = db;

// in-memory stateful aggregation
const aggMap = new Map();

// batch buffers for DB writes
const rawBuffer = [];
const minuteAggBuffer = [];

/**
 * Called for each parsed JSON line from agent stream.
 * Keep this synchronous and fast.
 */
function handleLine({ server_id, metric_name, value, labels, ts }) {
  const now = ts ? new Date(ts) : new Date();

  // buffer raw metric for periodic batch insert
  rawBuffer.push({
    server_id,
    metric_name,
    value: Number(value),
    labels: labels || null,
    ts: now,
  });

  // stateful aggregation per (server,metric,minute)
  const windowKey = `${server_id}|${metric_name}|${Math.floor(
    now.getTime() / (60 * 1000)
  )}`;
  let entry = aggMap.get(windowKey);
  if (!entry) {
    entry = {
      sum: 0,
      count: 0,
      min: Number(value),
      max: Number(value),
      values: [],
      ts_min: new Date(Math.floor(now.getTime() / (60 * 1000)) * (60 * 1000)),
    };
    aggMap.set(windowKey, entry);
  }
  entry.sum += Number(value);
  entry.count += 1;
  entry.min = Math.min(entry.min, Number(value));
  entry.max = Math.max(entry.max, Number(value));
  entry.values.push(Number(value));

  // emit lightweight real-time update to dashboard
  const avg = entry.sum / entry.count;
  global.io &&
    global.io.emit("metric_update", {
      server_id,
      metric_name,
      avg,
      min: entry.min,
      max: entry.max,
      timestamp: now,
    });
}

// flush rawBuffer to MetricRaw every 2s
setInterval(async () => {
  if (rawBuffer.length === 0) return;
  const batch = rawBuffer.splice(0, rawBuffer.length);
  try {
    await MetricRaw.bulkCreate(batch);
  } catch (err) {
    console.error("bulk MetricRaw insert failed", err);
    rawBuffer.unshift(...batch); // retry
  }
}, 2000);

// flush minute aggregates every 5s (windows older than 2 minutes)
setInterval(async () => {
  const cutoff = Date.now() - 2 * 60 * 1000;
  const toPersist = [];
  for (const [key, data] of aggMap.entries()) {
    const [server_id, metric_name, windowMin] = key.split("|");
    const windowStartMs = Number(windowMin) * 60000;
    if (windowStartMs < cutoff) {
      data.values.sort((a, b) => a - b);
      const p95 = data.values.length
        ? data.values[Math.floor(0.95 * data.values.length)]
        : null;
      toPersist.push({
        server_id,
        metric_name,
        ts_min: new Date(windowStartMs),
        count: data.count,
        sum: data.sum,
        min: data.min,
        max: data.max,
        p95,
      });
      aggMap.delete(key);
    }
  }
  if (toPersist.length === 0) return;
  try {
    await MetricMinuteAgg.bulkCreate(toPersist);
  } catch (err) {
    console.error("bulk MetricMinuteAgg insert failed", err);
    minuteAggBuffer.push(...toPersist);
  }
}, 5000);

module.exports = { handleLine };
