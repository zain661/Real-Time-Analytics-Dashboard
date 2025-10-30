// approach2/proxy/proxy.js
const express = require("express");
const proxyApp = express();
const https = require("https");
const httpProxy = require("http-proxy");
const fs = require("fs");
const path = require("path");
require("dotenv").config();

// serve static dashboard
proxyApp.use(express.static(path.join(__dirname, "../app/public")));

proxyApp.get("/", (req, res) => {
  res.sendFile(path.join(__dirname, "../app/public/dashboard.html"));
});

// Backend servers to balance (run 2 instances of your HTTPS backend)
const BACKENDS = [
  { host: "localhost", port: 4003 },
  { host: "localhost", port: 4002 },
];

let current = 0; // round-robin counter

// Create a proxy server
const proxy = httpProxy.createProxyServer({
  secure: false, // ignore self-signed certificates
});

// handle / routes
proxyApp.use("/", (req, res) => {
  const target = BACKENDS[current];
  current = (current + 1) % BACKENDS.length;
  const targetUrl = `https://${target.host}:${target.port}`;
  proxy.web(req, res, { target: targetUrl }, (err) => {
    console.error("Proxy error:", err);
    res.writeHead(502, { "Content-Type": "text/plain" });
    res.end("Bad gateway");
  });
});

// Create HTTPS proxy/load balancer server
const options = {
  key: fs.readFileSync(path.join(__dirname, "../certs/server.key")),
  cert: fs.readFileSync(path.join(__dirname, "../certs/server.crt")),
  allowHTTP1: true,
};

const server = https.createServer(options, proxyApp);

// handle WebSocket upgrades
server.on("upgrade", (req, socket, head) => {
  const target = BACKENDS[current];
  current = (current + 1) % BACKENDS.length;
  const targetUrl = `https://${target.host}:${target.port}`;
  proxy.ws(req, socket, head, { target: targetUrl }, (err) => {
    console.error("WebSocket proxy error:", err);
    socket.end();
  });
});

const PORT = process.env.PROXY_PORT || 4444;
server.listen(PORT, () => {
  console.log(`HTTPS Proxy/Load balancer running at https://localhost:${PORT}`);
  console.log(
    `Forwarding requests to: ${BACKENDS.map((b) => `${b.host}:${b.port}`).join(
      ", "
    )}`
  );
});
