const fs = require("fs");
const path = require("path");
const http2 = require("http2");
const https = require("https");
const express = require("express");
const { Server: SocketServer } = require("socket.io");
require("dotenv").config();

const db = require("../../db/models");
const app = express();

app.use(express.json());
app.use(express.static(path.join(__dirname, "public")));
app.use("/api/", require("./routes/server.routes"));
app.use("/api/", require("./routes/stream.routes"));

const options = {
  key: fs.readFileSync(path.join(__dirname, "../certs/server.key")),
  cert: fs.readFileSync(path.join(__dirname, "../certs/server.crt")),
  allowHTTP1: true,
};

// --- HTTP/2 metrics server ---
const h2server = http2.createSecureServer(options);
h2server.on("stream", (stream, headers) => {
  if (headers[":path"] === "/api/stream" && headers[":method"] === "POST") {
    let body = "";
    stream.on("data", (chunk) => (body += chunk));
    stream.on("end", () => {
      try {
        const lines = body.trim().split("\n");
        const { handleLine } = require("./utils/streamAggregator");
        lines.forEach((line) => {
          const metric = JSON.parse(line);
          handleLine(metric); // <-- ensure DB + dashboard
        });
        stream.respond({ ":status": 204 });
        stream.end();
      } catch {
        stream.respond({ ":status": 400 });
        stream.end("Invalid JSON");
      }
    });
  } else {
    stream.respond({ ":status": 404 });
    stream.end("Not Found");
  }
});

// --- HTTPS + Socket.IO for dashboard ---
const dashboardServer = https.createServer(options, app);
const io = new SocketServer(dashboardServer, { cors: { origin: "*" } });
global.io = io;
io.on("connection", () => console.log("Dashboard connected"));

// --- Start servers ---
const PORT_H2 = process.env.PORT3 || 5001;
const PORT_DASH = 5002;

db.sequelize
  .authenticate()
  .then(() => {
    h2server.listen(PORT_H2, () =>
      console.log(
        `HTTP/2 metrics server running on https://localhost:${PORT_H2}`
      )
    );
    dashboardServer.listen(PORT_DASH, () =>
      console.log(`Dashboard (HTTPS) on https://localhost:${PORT_DASH}`)
    );
  })
  .catch((err) => {
    console.error("DB connection failed", err);
    process.exit(1);
  });
