// approach3/agent/client.js
const http2 = require("http2");
const fs = require("fs");
const path = require("path");

const client = http2.connect("https://localhost:4002", {
  ca: fs.readFileSync(path.join(__dirname, "../certs/server.crt")),
  rejectUnauthorized: false, // ignore hostname mismatch for local dev
});

const req = client.request({
  ":method": "POST",
  ":path": "/api/stream",
  "content-type": "application/x-ndjson",
});

req.setEncoding("utf8");

function sendMetric() {
  const metric = {
    server_id: "409213d4-7dca-4f45-9d18-e3ab9374ea73",
    metric_name: "cpu-stream",
    value: (Math.random() * 100).toFixed(2),
    labels: { region: "eu" },
    ts: new Date().toISOString(),
  };
  req.write(JSON.stringify(metric) + "\n");
}

// send 10 metrics per second
const interval = setInterval(sendMetric, 100);

req.on("response", (headers, flags) => {
  // do nothing; server will reply 204 on end
});

req.on("close", () => {
  console.log("stream closed");
  client.close();
});

// after N seconds close
setTimeout(() => {
  clearInterval(interval);
  req.end();
}, 20000);
