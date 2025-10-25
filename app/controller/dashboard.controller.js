const { MetricMinuteAgg } = require("../../db/models");
const { Op } = require("sequelize");

exports.getDashboardData = async (req, res) => {
  try {
    const { server_id, metric_name, minutes = 60 } = req.query;

    const ts_start = new Date(Date.now() - minutes * 60 * 1000);

    const metrics = await MetricMinuteAgg.findAll({
      where: {
        server_id,
        metric_name,
        ts_min: {
          [Op.gte]: ts_start,
        },
      },
      order: [["ts_min", "ASC"]],
    });

    res.json({ data: metrics });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Internal server error" });
  }
};
