#!/bin/sh
set -e

echo "=========================================="
echo "Real-Time Analytics Dashboard - Load Tests"
echo "=========================================="
echo ""

# -----------------------------
# Wait for app readiness
# -----------------------------
echo "⏳ Waiting for app1 to be ready..."
sleep 8
until curl -skI https://app1:4002 >/dev/null 2>&1; do
  echo "   Waiting for app1..."
  sleep 2
done
echo "✅ App is ready!"
echo ""


# -----------------------------
# Helper: generate temp JSON
# -----------------------------
make_payload() {
  id=$1
  cpu=$2
  mem=$3
  ts=$(date +%s000)
  echo "{\"agentId\":\"agent-${id}\",\"cpu\":${cpu},\"memory\":${mem},\"timestamp\":${ts}}" > /tmp/payload-${id}.json
}

# -----------------------------
# TEST 1: 10 Engineers (SSE)
# -----------------------------
# echo "=========================================="
# echo "TEST 1: 10 Engineers (SSE Connections)"
# echo "=========================================="

# h2load -n10 -c10 -t2 -D10s https://app1:4002/api/dashboard/stream
# echo "✅ SSE connections stable for 10 engineers"
# echo ""

# # -----------------------------
# # TEST 2: 500 Engineers
# # -----------------------------
# echo "=========================================="
# echo "TEST 2: 500 Engineers (Dashboard Load)"
# echo "=========================================="

# h2load -n500 -c500 -t4 -D10s https://app1:4002/api/dashboard/stream
# echo "✅ 500 concurrent SSE streams simulated"
# echo ""
# Before Test 3

# -----------------------------
# TEST 3: 100 Agents Sending Metrics
# -----------------------------
echo "=========================================="
echo "TEST 3: 100 Agents Sending Metrics"
echo "=========================================="

make_payload 1 45.2 78.5
h2load -n100 -c100 -m1 -t4 \
  -H "content-type: application/json" \
  -d /tmp/payload-1.json \
  https://app1:4002/api/metrics/stream

echo "✅ 100 metrics requests sent"
echo ""



# -----------------------------
# TEST 4: Mixed Load
# -----------------------------
# echo "=========================================="
# echo "TEST 4: Mixed Load (SSE + Metrics)"
# echo "=========================================="

# # Start 100 SSE clients in background
# h2load -n100 -c100 -t4 https://app1:4002/api/dashboard/stream &
# SSE_PID=$!

# sleep 5
# make_payload 2 67.8 89.1

# h2load -n1000 -c100 -m100 -t4 \
#   -H "content-type: application/json" \
#   -d /tmp/payload-2.json \
#   https://app1:4002/api/metrics/stream

# wait $SSE_PID
# echo "✅ Mixed test completed (SSE + Metrics)"
# echo ""

# -----------------------------
# TEST 6: Agents Only (No SSE)
# -----------------------------
# echo "=========================================="
# echo "TEST 6: Agents Only (No SSE)"
# echo "=========================================="

# make_payload 4 55.5 72.1
# h2load -n1000 -c100 -m100 -t4 \
#   -H "content-type: application/json" \
#   -d /tmp/payload-4.json \
#   https://app1:4002/api/metrics/stream

# echo "✅ 100 Agents sent metrics without SSE"
# echo ""

# -----------------------------
# TEST 5: Stress Test
# -----------------------------
# echo "=========================================="
# echo "TEST 5: Stress Test (10,000 Requests)"
# echo "=========================================="

# make_payload 3 23.4 56.7
# h2load -n10000 -c500 -m20 -t4 \
#   -H "content-type: application/json" \
#   -d /tmp/payload-3.json \
#   https://app1:4002/api/metrics/stream

# echo "✅ Stress test completed successfully"
# echo ""

# -----------------------------
# Summary
# -----------------------------
echo "=========================================="
echo "ALL TESTS COMPLETED"
echo "=========================================="
echo ""
echo "Next Steps:"
echo "  1️⃣ Check app logs → docker-compose logs app1"
echo "  2️⃣ Monitor containers → docker stats analytics-app1"
echo "  3️⃣ Review DB → validate ingestion throughput"
echo ""
echo "Key Metrics to Watch:"
echo "  • SSE stability (keepalive >30s)"
echo "  • Request error % (should stay <1%)"
echo "  • Broadcast latency"
echo "  • Memory usage growth"
echo ""
