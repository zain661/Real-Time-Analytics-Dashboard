const metricsBuffer = new Map();

function addMetric(server_id, metric_name, value) {
  const key = `${server_id}|${metric_name}`;
  const now = Date.now();

  if (!metricsBuffer.has(key)) {
    metricsBuffer.set(key, {
      sum: 0,
      count: 0,
      min: value,
      max: value,
      values: [],
      lastUpdate: now,
    });
  }

  const entry = metricsBuffer.get(key);
  entry.sum += value;
  entry.count += 1;
  entry.min = Math.min(entry.min, value);
  entry.max = Math.max(entry.max, value);
  entry.values.push(value);
  entry.lastUpdate = now;
}

function aggregateAndEmit() {
  const now = new Date();
  for (const [key, data] of metricsBuffer.entries()) {
    const [server_id, metric_name] = key.split("|");
    const avg = data.sum / data.count;
    const sorted = data.values.sort((a, b) => a - b);
    const p95 = sorted[Math.floor(0.95 * sorted.length)];

    global.io.emit("metric_update", {
      server_id,
      metric_name,
      avg,
      min: data.min,
      max: data.max,
      p95,
      timestamp: now,
    });
    metricsBuffer.delete(key);
  }
}

setInterval(aggregateAndEmit, 1000);

module.exports = { addMetric };
