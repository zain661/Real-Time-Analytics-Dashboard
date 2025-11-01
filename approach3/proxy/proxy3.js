// approach3/proxy/proxy3.js
// Reverse proxy + load balancer for Approach 3
// - /api/stream -> proxied using HTTP/2 client (preserves HTTP/2 for backend)
// - other requests -> round-robin via http-proxy (supports websockets)
// - serves dashboard static files

const fs = require("fs");
const path = require("path");
const express = require("express");
const http2 = require("http2");
const https = require("https");
const httpProxy = require("http-proxy");
require("dotenv").config();

const proxyApp = express();

// serve static dashboard
proxyApp.use(express.static(path.join(__dirname, "../app/public")));

// --- backend pools ---
const BACKENDS_H2 = [
  { host: "localhost", port: 5001 },
  { host: "localhost", port: 5003 },
];

const BACKENDS_STD = [
  { host: "localhost", port: 5002 },
  { host: "localhost", port: 5004 },
];

let rrH2 = 0;
let rrStd = 0;

function pickH2() {
  const target = BACKENDS_H2[rrH2];
  rrH2 = (rrH2 + 1) % BACKENDS_H2.length;
  return target;
}
function pickStd() {
  const target = BACKENDS_STD[rrStd];
  rrStd = (rrStd + 1) % BACKENDS_STD.length;
  return target;
}

// --- HTTP proxy for non-stream requests / WebSockets ---
const proxy = httpProxy.createProxyServer({
  secure: false,
  changeOrigin: true,
});

proxyApp.use((req, res, next) => {
  if (req.path === "/api/stream") return next();

  const t = pickStd();
  const targetUrl = `https://${t.host}:${t.port}`;
  proxy.web(req, res, { target: targetUrl }, (err) => {
    console.error("Proxy error (web):", err && err.message);
    if (!res.headersSent) res.writeHead(502, { "Content-Type": "text/plain" });
    res.end("Bad gateway");
  });
});

// --- persistent HTTP/2 sessions for H2 backends ---
const h2Sessions = BACKENDS_H2.map((b) => {
  const client = http2.connect(`https://${b.host}:${b.port}`, {
    rejectUnauthorized: false,
    settings: { enablePush: false, maxConcurrentStreams: 1000 },
  });
  client.on("error", (err) =>
    console.error("HTTP/2 client session error:", err.message)
  );
  return client;
});

// --- /api/stream handler ---
proxyApp.post(
  "/api/stream",
  express.raw({ type: "*/*", limit: "10mb" }),
  (req, res) => {
    const idx = rrH2;
    rrH2 = (rrH2 + 1) % h2Sessions.length;
    const client = h2Sessions[idx];

    const headers = {
      ":method": "POST",
      ":path": "/api/stream",
      "content-type": req.headers["content-type"] || "application/x-ndjson",
    };

    const stream = client.request(headers);

    const timeout = setTimeout(() => {
      console.error("HTTP/2 request timed out");
      if (!res.headersSent) res.writeHead(504).end("Gateway Timeout");
      stream.close();
    }, 30000); // 30s timeout

    stream.on("response", (headers) => {
      if (!res.headersSent) res.statusCode = headers[":status"] || 200;
      Object.keys(headers).forEach((k) => {
        if (!k.startsWith(":")) res.setHeader(k, headers[k]);
      });
    });

    stream.on("data", (chunk) => res.write(chunk));
    stream.on("end", () => {
      clearTimeout(timeout);
      if (!res.headersSent) res.writeHead(204);
      res.end();
    });

    stream.on("error", (err) => {
      console.error("Stream error:", err.message);
      clearTimeout(timeout);
      if (!res.headersSent) res.writeHead(502).end("Bad gateway");
    });

    if (Buffer.isBuffer(req.body) && req.body.length > 0)
      stream.write(req.body);
    stream.end();

    req.on("close", () => stream.close());
  }
);

// --- HTTPS server ---
const options = {
  key: fs.readFileSync(path.join(__dirname, "../certs/server.key")),
  cert: fs.readFileSync(path.join(__dirname, "../certs/server.crt")),
  allowHTTP1: true,
};

const server = https.createServer(options, proxyApp);

// WebSocket upgrade
server.on("upgrade", (req, socket, head) => {
  const t = pickStd();
  const targetUrl = `https://${t.host}:${t.port}`;
  proxy.ws(req, socket, head, { target: targetUrl }, (err) => {
    if (err) console.error("WebSocket proxy error:", err.message);
    try {
      socket.end();
    } catch {}
  });
});

// Start proxy
const PORT = process.env.PROXY_PORT || 5555;
server.listen(PORT, () => {
  console.log(`HTTPS proxy running at https://localhost:${PORT}`);
  console.log(
    `Forwarding HTTP/2 stream to: ${BACKENDS_H2.map(
      (b) => `${b.host}:${b.port}`
    ).join(", ")}`
  );
  console.log(
    `Forwarding other traffic to: ${BACKENDS_STD.map(
      (b) => `${b.host}:${b.port}`
    ).join(", ")}`
  );
});
