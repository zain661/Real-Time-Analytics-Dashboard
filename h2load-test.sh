#!/bin/bash

# ============================================
# h2load Testing Script for Real-Time Analytics
# ============================================

echo "🔥 h2load Load Testing for HAProxy + HTTP/2 + SSE"
echo "=================================================="
echo ""

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Configuration
TARGET_HOST="https://localhost:443"
CERT_PATH="/app/approach3/certs/server-cert.pem"

# ============================================
# Test 1: Basic Health Check
# ============================================
echo -e "${YELLOW}Test 1: Basic Health Check${NC}"
echo "Command: h2load -n 100 -c 10 -m 10 ${TARGET_HOST}/health"
echo ""

docker exec analytics-h2load h2load \
  -n 100 \
  -c 10 \
  -m 10 \
  --h1 \
  ${TARGET_HOST}/health

echo ""
echo "=================================================="
echo ""

# ============================================
# Test 2: HTTP/2 Performance Test
# ============================================
echo -e "${YELLOW}Test 2: HTTP/2 Performance Test (1000 requests, 50 concurrent)${NC}"
echo "Command: h2load -n 1000 -c 50 -m 10 ${TARGET_HOST}/health"
echo ""

docker exec analytics-h2load h2load \
  -n 1000 \
  -c 50 \
  -m 10 \
  ${TARGET_HOST}/health

echo ""
echo "=================================================="
echo ""

# ============================================
# Test 3: High Concurrency Test
# ============================================
echo -e "${YELLOW}Test 3: High Concurrency (10,000 requests, 100 concurrent)${NC}"
echo "Command: h2load -n 10000 -c 100 -m 10 ${TARGET_HOST}/health"
echo ""

docker exec analytics-h2load h2load \
  -n 10000 \
  -c 100 \
  -m 10 \
  ${TARGET_HOST}/health

echo ""
echo "=================================================="
echo ""

# ============================================
# Test 4: Duration-based Test
# ============================================
echo -e "${YELLOW}Test 4: Duration Test (30 seconds, 100 clients)${NC}"
echo "Command: h2load -D 30 -c 100 -m 10 ${TARGET_HOST}/health"
echo ""

docker exec analytics-h2load h2load \
  -D 30 \
  -c 100 \
  -m 10 \
  ${TARGET_HOST}/health

echo ""
echo "=================================================="
echo ""

# ============================================
# Test 5: Streaming POST Test (Metrics Upload)
# ============================================
echo -e "${YELLOW}Test 5: POST Metrics Stream Test${NC}"
echo "Simulating metric uploads..."
echo ""

# Create test payload
TEST_PAYLOAD='{"server_id":"test-server","metric_name":"cpu_usage","value":75.5,"labels":{"region":"us-east-1"},"ts":'$(date +%s000)'}'

docker exec analytics-h2load sh -c "echo '${TEST_PAYLOAD}' | h2load \
  -n 100 \
  -c 10 \
  -m 10 \
  -d - \
  -H 'Content-Type: application/json' \
  ${TARGET_HOST}/api/metrics/stream"

echo ""
echo "=================================================="
echo ""

# ============================================
# Summary
# ============================================
echo -e "${GREEN}✅ All tests completed!${NC}"
echo ""
echo "📊 Check HAProxy stats: http://localhost:8404"
echo "   Username: admin"
echo "   Password: admin123"
echo ""
echo "💡 Metrics to watch:"
echo "   - Total requests per backend"
echo "   - Response times"
echo "   - Error rate"
echo "   - Active connections"
echo ""

# ============================================
# h2load Command Reference
# ============================================
echo -e "${YELLOW}📖 h2load Command Reference:${NC}"
echo ""
echo "  -n NUM    Total number of requests"
echo "  -c NUM    Number of concurrent clients"
echo "  -t NUM    Number of threads"
echo "  -m NUM    Max concurrent streams per client"
echo "  -D SEC    Duration in seconds"
echo "  -H        Add custom header"
echo "  -d FILE   Request body data"
echo "  --h1      Force HTTP/1.1"
echo ""
echo "Example custom test:"
echo "  h2load -n 5000 -c 100 -m 20 -D 60 https://localhost/api/stats"
echo ""