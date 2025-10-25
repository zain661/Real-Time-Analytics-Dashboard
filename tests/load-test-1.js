import http from "k6/http";
import { check } from "k6";

export let options = {
  vus: 100, // 100 virtual users
  duration: "1m", // run for 1 minute
};

export default function () {
  const payload = JSON.stringify({
    server_id: "64f37728-5c01-4639-a696-aa2501bc83d7",
    metric_name: "cpu_usage-first",
    value: Math.random(),
  });

  const headers = { "Content-Type": "application/json" };

  const res = http.post("http://localhost:3001/api/metrics", payload, {
    headers,
  });
  check(res, { "status 201": (r) => r.status === 201 });
}
