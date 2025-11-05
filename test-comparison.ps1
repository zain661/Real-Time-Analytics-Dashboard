# Comprehensive Load Balancer Comparison Test
# Tests: Direct, nginx LB, Client-Side LB

Write-Host "🧪 Load Balancer Comparison Test Suite" -ForegroundColor Cyan
Write-Host "=" * 70 -ForegroundColor Cyan
Write-Host ""

# Configuration
$NUM_SERVERS = 500  # Increase for more load
$DURATION = 60
$BACKEND_SERVERS = 5  # Number of backend servers to run

Write-Host "📋 Test Configuration:" -ForegroundColor Yellow
Write-Host "  Simulated Servers: $NUM_SERVERS" -ForegroundColor White
Write-Host "  Duration: ${DURATION}s" -ForegroundColor White
Write-Host "  Backend Servers: $BACKEND_SERVERS" -ForegroundColor White
Write-Host ""

$results = @{}

# ============================================
# Test 1: Direct Connection (Baseline)
# ============================================
Write-Host "📊 Test 1: Direct HTTP/2 Connection (Baseline)" -ForegroundColor Green
Write-Host "-" * 70 -ForegroundColor Gray
Write-Host "Starting backend server on port 4002..." -ForegroundColor Cyan

# Start one server
Start-Process powershell -ArgumentList "-NoExit", "-Command", "cd '$PWD'; `$env:HTTP2_PORT=4002; npm run start3"

Write-Host "Waiting 5 seconds for server to start..." -ForegroundColor Yellow
Start-Sleep -Seconds 5

Write-Host "Running load test..." -ForegroundColor Cyan
$env:NUM_SERVERS = $NUM_SERVERS
$env:DURATION = $DURATION
$env:SERVER_PORT = 4002

$output1 = npm run test3 2>&1 | Out-String
$results['direct'] = $output1

Write-Host "✅ Test 1 Complete!" -ForegroundColor Green
Write-Host ""
Write-Host "Press Enter to continue to next test..." -ForegroundColor Yellow
Read-Host

# ============================================
# Test 2: nginx Load Balancer (5 servers)
# ============================================
Write-Host "📊 Test 2: nginx Load Balancer (5 backend servers)" -ForegroundColor Green
Write-Host "-" * 70 -ForegroundColor Gray

# Start nginx with larger config
Write-Host "Copying nginx-large-servers.conf..." -ForegroundColor Cyan
Copy-Item "nginx-large-servers.conf" -Destination "C:\nginx-1.29.3\conf\nginx.conf" -Force

Write-Host "Starting nginx..." -ForegroundColor Cyan
cd C:\nginx-1.29.3
.\nginx.exe -t
if ($LASTEXITCODE -eq 0) {
    Get-Process -Name "nginx" -ErrorAction SilentlyContinue | Stop-Process -Force
    Start-Sleep -Seconds 1
    .\nginx.exe
    Write-Host "✅ Nginx started" -ForegroundColor Green
}
cd $PSScriptRoot

# Start 5 backend servers
Write-Host "Starting $BACKEND_SERVERS backend servers..." -ForegroundColor Cyan
for ($i = 2; $i -le $BACKEND_SERVERS; $i++) {
    $port = 4000 + $i
    Start-Process powershell -ArgumentList "-NoExit", "-Command", "cd '$PWD'; `$env:HTTP2_PORT=$port; npm run start3"
}

Write-Host "Waiting 10 seconds for all servers to start..." -ForegroundColor Yellow
Start-Sleep -Seconds 10

Write-Host "Running load test via nginx LB..." -ForegroundColor Cyan
$env:NUM_SERVERS = $NUM_SERVERS
$env:DURATION = $DURATION
$env:SERVER_PORT = 8443

$output2 = npm run test3 2>&1 | Out-String
$results['nginx'] = $output2

Write-Host "✅ Test 2 Complete!" -ForegroundColor Green
Write-Host ""
Write-Host "Press Enter to continue to next test..." -ForegroundColor Yellow
Read-Host

# ============================================
# Test 3: Client-Side Load Balancing
# ============================================
Write-Host "📊 Test 3: Client-Side Load Balancing (HTTP/2 Direct)" -ForegroundColor Green
Write-Host "-" * 70 -ForegroundColor Gray

Write-Host "Running load test with client-side LB..." -ForegroundColor Cyan
$env:NUM_SERVERS = $NUM_SERVERS
$env:DURATION = $DURATION

$output3 = node approach4/load-tester-client-lb.js 2>&1 | Out-String
$results['client-lb'] = $output3

Write-Host "✅ Test 3 Complete!" -ForegroundColor Green
Write-Host ""

# ============================================
# Results Summary
# ============================================
Write-Host "=" * 70 -ForegroundColor Cyan
Write-Host "📊 COMPARISON RESULTS SUMMARY" -ForegroundColor Cyan
Write-Host "=" * 70 -ForegroundColor Cyan
Write-Host ""

Write-Host "✅ All tests completed!" -ForegroundColor Green
Write-Host ""
Write-Host "Review the output above to compare:" -ForegroundColor Yellow
Write-Host "  1. Direct Connection (Baseline)" -ForegroundColor White
Write-Host "  2. nginx Load Balancer" -ForegroundColor White
Write-Host "  3. Client-Side Load Balancing" -ForegroundColor White
Write-Host ""
Write-Host "Key Metrics to Compare:" -ForegroundColor Yellow
Write-Host "  - Total Metrics/sec" -ForegroundColor White
Write-Host "  - Success Rate" -ForegroundColor White
Write-Host "  - Average Response Time" -ForegroundColor White
Write-Host ""

# Save results to file
$results | ConvertTo-Json -Depth 5 | Out-File "test-results-$(Get-Date -Format 'yyyyMMdd-HHmmss').json"
Write-Host "Results saved to JSON file" -ForegroundColor Cyan

