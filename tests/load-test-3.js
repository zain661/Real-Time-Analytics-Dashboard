import http from "k6/http";
import { check } from "k6";

export let options = {
  vus: 100,
  duration: "1m",
  insecureSkipTLSVerify: true, // required for self-signed HTTPS
};

export default function () {
  // NDJSON payload (each metric on its own line)
  const payload =
    `{"server_id":"356536e2-e9b3-4738-9648-88a10c04d8af","metric_name":"cpu_usage","value":${Math.random()}}\n` +
    `{"server_id":"356536e2-e9b3-4738-9648-88a10c04d8af","metric_name":"mem_usage","value":${Math.random()}}\n`;

  const headers = { "Content-Type": "application/x-ndjson" };

  // POST to the stream endpoint (HTTP/2)
  const res = http.post("https://localhost:4003/api/stream", payload, {
    headers,
  });

  check(res, { "status 204": (r) => r.status === 204 }); // stream responds 204 on success
}
