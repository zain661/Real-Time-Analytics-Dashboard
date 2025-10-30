const fs = require("fs");
const path = require("path");
const https = require("https");
const http2 = require("http2"); // optional, for API endpoints
const express = require("express");
const { Server: SocketServer } = require("socket.io");

const app = express();
require("dotenv").config();

// parse JSON
app.use(express.json());

// serve static dashboard
app.use(express.static(path.join(__dirname, "public")));

// routes
app.use("/api/", require("./routes/server.routes"));
app.use("/api/", require("./routes/metric.routes"));
app.use("/api/", require("./routes/dashboard.routes"));

// certificates
const options = {
  key: fs.readFileSync(path.join(__dirname, "../certs/server.key")),
  cert: fs.readFileSync(path.join(__dirname, "../certs/server.crt")),
  allowHTTP1: true, // fallback for HTTP/1.1 requests
};

// HTTPS server
const server = https.createServer(options, app);
// const server = http2.createSecureServer(options, app);

// Socket.IO
const io = new SocketServer(server, { cors: { origin: "*" } });
global.io = io;

io.on("connection", (socket) => {
  console.log("Dashboard client connected");
  socket.on("disconnect", () => console.log("Dashboard client disconnected"));
});

// Start server
const PORT = process.env.PORT || 4002; // fallback only if PORT not set
server.listen(PORT, () =>
  console.log(`HTTPS/HTTP2 server running on port ${PORT}`)
);
