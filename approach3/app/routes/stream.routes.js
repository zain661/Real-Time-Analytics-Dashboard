// approach3/app/routes/stream.routes.js
const express = require("express");
const router = express.Router();
const controller = require("../controller/stream.controller");

// stream endpoint expects NDJSON POST body on a long-lived connection
router.post("/stream", controller.ingestStream);

module.exports = router;
