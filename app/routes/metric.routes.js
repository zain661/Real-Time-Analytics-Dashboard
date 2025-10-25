const express = require("express");
const router = express.Router();
const { ingestMetric } = require("../controller/metric.controller");

router.post("/metrics", ingestMetric);

module.exports = router;
