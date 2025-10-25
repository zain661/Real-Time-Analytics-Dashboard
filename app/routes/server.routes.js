const express = require("express");
const router = express.Router();
const controller = require("../controller/server.controller");

router.post("/servers", controller.createServer); // create
router.get("/servers", controller.listServers); // list
router.get("/servers/:id", controller.getServer); // get one
router.patch("/servers/:id", controller.updateServer); // update
router.delete("/servers/:id", controller.deleteServer); // delete

module.exports = router;
