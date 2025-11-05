import http from 'k6/http';
import { check, sleep } from 'k6';

export const options = {
  scenarios: {
    servers: {
      executor: 'constant-vus',
      vus: 200,              // simulate 200 servers (adjust)
      duration: '60s',
    },
  },
  thresholds: {
    http_req_failed: ['rate<0.01'],
    http_req_duration: ['p(95)<500'],
  },
  // Note: Set K6_INSECURE_SKIP_TLS_VERIFY=true environment variable before running
  // This is required because the server uses self-signed certificates
  // Example: $env:K6_INSECURE_SKIP_TLS_VERIFY="true" (PowerShell)
};

const BASE = 'https://localhost:4002';
const METRIC_TYPES = ['cpu_usage','memory_usage','disk_io','network_rx','network_tx'];

function genMetricLine(serverId, metric) {
  const value = (Math.random() * (metric === 'cpu_usage' ? 100 : 10000)).toFixed(2);
  const body = {
    server_id: serverId,
    metric_name: metric,
    value: parseFloat(value),
    labels: { region: 'us-east-1', env: 'prod' },
    ts: Date.now(),
  };
  return JSON.stringify(body) + '\n';
}

export default function () {
  // Each VU acts as one server with stable id
  const serverId = `k6-${__VU}`;

  // Send a burst of NDJSON lines in one POST
  let ndjson = '';
  for (let i = 0; i < METRIC_TYPES.length; i++) {
    ndjson += genMetricLine(serverId, METRIC_TYPES[i]);
  }

  const res = http.post(`${BASE}/api/metrics/stream`, ndjson, { 
    headers: { 
      'content-type': 'application/x-ndjson', 
      'x-server-id': serverId  // Use actual serverId for each VU
    } 
  });

  check(res, { 'status 200': (r) => r.status === 200 });

  // Pace per-server send rate
  sleep(1);
}