const { MetricRaw } = require("../../db/models");
const aggregateMetrics = require("../utils/aggregateMetrics");

exports.ingestMetric = async (req, res) => {
  try {
    const { server_id, metric_name, value, labels } = req.body;

    if (!server_id || !metric_name || value === undefined) {
      return res.status(400).json({ message: "Missing required fields" });
    }

    const ts = new Date();

    await MetricRaw.create({
      server_id,
      metric_name,
      value,
      labels,
      ts,
    });

    // Call aggregation (stateless)
    await aggregateMetrics(server_id, metric_name);

    res.status(201).json({ message: "Metric received" });
  } catch (error) {
    console.error("Error ingesting metric:", error);
    res.status(500).json({ message: "Internal server error" });
  }
};
