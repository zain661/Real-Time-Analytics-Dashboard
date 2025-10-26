const express = require("express");
const http = require("http");
require("dotenv").config();

const app = express();
const server = http.createServer(app);

app.use(express.json());
app.use(express.urlencoded({ extended: true }));

const db = require("../../db/models");
db.sequelize.sync({ force: false }, { alter: true });

const serverRoutes = require("./routes/server.routes");
const metricRoutes = require("./routes/metric.routes");
const dashboardRoutes = require("./routes/dashboard.routes");

app.use("/api", serverRoutes);
app.use("/api", metricRoutes);
app.use("/api", dashboardRoutes);

const PORT = process.env.PORT || 3001;
server.listen(PORT, () => {
  console.log(`Server is running on port ${PORT}.`);
});
