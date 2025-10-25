const { MetricRaw, MetricMinuteAgg } = require("../../db/models");
const { Op } = require("sequelize");

async function aggregateMetrics(server_id, metric_name) {
  const now = new Date();
  const ts_min = new Date(now);
  ts_min.setSeconds(0, 0); // round to the minute

  const metrics = await MetricRaw.findAll({
    where: {
      server_id,
      metric_name,
      ts: {
        [Op.gte]: ts_min,
        [Op.lt]: new Date(ts_min.getTime() + 60000),
      },
    },
  });

  if (metrics.length === 0) return;

  const values = metrics.map((m) => m.value);
  const count = values.length;
  const sum = values.reduce((a, b) => a + b, 0);
  const min = Math.min(...values);
  const max = Math.max(...values);
  const p95 = values.sort((a, b) => a - b)[Math.floor(values.length * 0.95)];

  await MetricMinuteAgg.upsert({
    server_id,
    metric_name,
    ts_min,
    count,
    sum,
    min,
    max,
    p95,
  });
}

module.exports = aggregateMetrics;
