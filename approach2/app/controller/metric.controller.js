const { addMetric } = require("../utils/memoryAggregator");
const { MetricRaw } = require("../../../db/models");

exports.ingestMetric = async (req, res) => {
  try {
    const { server_id, metric_name, value, labels } = req.body;
    if (!server_id || !metric_name || value === undefined)
      return res.status(400).json({ message: "Missing required fields" });

    const ts = new Date();

    // store in DB
    await MetricRaw.create({ server_id, metric_name, value, labels, ts });

    // store in memory for real-time aggregation
    addMetric(server_id, metric_name, Number(value));

    res.status(201).json({ message: "Metric received and processed" });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Internal error" });
  }
};
