import http from "k6/http";
import { check } from "k6";

export let options = {
  vus: 100, // 100 virtual users
  duration: "1m", // run for 1 minute
};

export default function () {
  const payload = JSON.stringify({
    server_id: "471b3dc8-b549-465f-ac45-a341aef7233d",
    metric_name: "cpu_usage-try",
    value: Math.random(),
  });

  const headers = { "Content-Type": "application/json" };

  //without proxy
  // const res = http.post("http://localhost:3001/api/metrics", payload, {
  //   headers,
  // });

  //with proxy
  const res = http.post("http://localhost:4000/api/metrics", payload, {
    headers,
  });
  check(res, { "status 201": (r) => r.status === 201 });
}
