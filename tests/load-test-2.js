import http from "k6/http";
import { check } from "k6";

export let options = {
  vus: 100, // 100 virtual users (same as first approach)
  duration: "1m", // run for 1 minute (same)
  insecureSkipTLSVerify: true, // <--- must be here, not inside http.post
};

export default function () {
  const payload = JSON.stringify({
    server_id: "356536e2-e9b3-4738-9648-88a10c04d8af",
    metric_name: "cpu_usage-2",
    value: Math.random(),
  });

  const headers = { "Content-Type": "application/json" };

  //without proxy
  // const res = http.post("https://localhost:4002/api/metrics", payload, {
  //   headers,
  // });

  //with proxy
  const res = http.post("https://localhost:4444/api/metrics", payload, {
    headers,
  });

  check(res, { "status 201": (r) => r.status === 201 });
}
