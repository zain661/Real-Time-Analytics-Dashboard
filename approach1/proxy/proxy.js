// approach1/proxy/proxy.js
const http = require("http");
const httpProxy = require("http-proxy");

// Backend servers to balance
const BACKENDS = [
  { host: "localhost", port: 3001 },
  { host: "localhost", port: 3002 }, // run a second instance of your backend
];

let current = 0; // round-robin counter

// Create a proxy server
const proxy = httpProxy.createProxyServer({});

// Create the load balancer server
const server = http.createServer((req, res) => {
  // Round-robin backend selection
  const target = BACKENDS[current];
  current = (current + 1) % BACKENDS.length;

  const targetUrl = `http://${target.host}:${target.port}`;
  proxy.web(req, res, { target: targetUrl }, (err) => {
    console.error("Proxy error:", err);
    res.writeHead(502, { "Content-Type": "text/plain" });
    res.end("Bad gateway");
  });
});

const PORT = 4000;
server.listen(PORT, () => {
  console.log(`Proxy/load balancer running at http://localhost:${PORT}`);
  console.log(
    `Forwarding requests to:`,
    BACKENDS.map((b) => `${b.host}:${b.port}`).join(", ")
  );
});
