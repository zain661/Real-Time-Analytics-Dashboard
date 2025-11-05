# High-Scale Test Script
# Tests: 10,000 servers + 500 engineers with and without nginx LB

Write-Host "🔥 High-Scale Load Test: 10,000 Servers + 500 Engineers" -ForegroundColor Cyan
Write-Host "=" * 70 -ForegroundColor Cyan
Write-Host ""

$NUM_SERVERS = 10000
$NUM_VIEWERS = 500
$DURATION = 300  # 5 minutes
$BACKEND_SERVERS = 5

Write-Host "📋 Test Configuration:" -ForegroundColor Yellow
Write-Host "  Simulated Servers: $NUM_SERVERS" -ForegroundColor White
Write-Host "  Dashboard Viewers: $NUM_VIEWERS" -ForegroundColor White
Write-Host "  Duration: ${DURATION}s (5 minutes)" -ForegroundColor White
Write-Host "  Backend Servers: $BACKEND_SERVERS" -ForegroundColor White
Write-Host ""
Write-Host "⚠️  WARNING: This is a HIGH-SCALE test!" -ForegroundColor Red
Write-Host "  Make sure you have sufficient resources." -ForegroundColor Yellow
Write-Host "  This will generate ~50,000 metrics/sec!" -ForegroundColor Yellow
Write-Host ""
Write-Host "Press Enter to continue or Ctrl+C to cancel..." -ForegroundColor Yellow
Read-Host

# ============================================
# Test 1: WITHOUT Load Balancer
# ============================================
Write-Host ""
Write-Host "=" * 70 -ForegroundColor Cyan
Write-Host "📊 Test 1: WITHOUT Load Balancer (Direct Connection)" -ForegroundColor Green
Write-Host "=" * 70 -ForegroundColor Cyan
Write-Host ""

# Start single server
Write-Host "Starting backend server on port 4002..." -ForegroundColor Cyan
$server1 = Start-Process powershell -ArgumentList "-NoExit", "-Command", "cd '$PWD'; `$env:HTTP2_PORT=4002; npm run start3" -PassThru

Write-Host "Waiting 10 seconds for server to start..." -ForegroundColor Yellow
Start-Sleep -Seconds 10

# Start metrics load in background
Write-Host 'Starting metrics load (10,000 servers)...' -ForegroundColor Cyan
$env:NUM_SERVERS = $NUM_SERVERS
$env:DURATION = $DURATION
$env:SERVER_PORT = 4002

$metricsJob = Start-Job -ScriptBlock {
    param($numServers, $duration, $serverPort, $pwd)
    Set-Location $pwd
    $env:NUM_SERVERS = $numServers
    $env:DURATION = $duration
    $env:SERVER_PORT = $serverPort
    # Increase Node.js heap memory to 4GB
    node --max-old-space-size=4096 approach4/load-tester-high-scale.js
} -ArgumentList $NUM_SERVERS, $DURATION, 4002, $PWD

# Wait 5 seconds, then start dashboard viewers
Start-Sleep -Seconds 5

Write-Host 'Starting dashboard viewers (500 engineers)...' -ForegroundColor Cyan
$env:NUM_VIEWERS = $NUM_VIEWERS
$env:DURATION = $DURATION
$env:SERVER_PORT = 4002

$viewersJob = Start-Job -ScriptBlock {
    param($numViewers, $duration, $serverPort, $pwd)
    Set-Location $pwd
    $env:NUM_VIEWERS = $numViewers
    $env:DURATION = $duration
    $env:SERVER_PORT = $serverPort
    node approach4/dashboard-viewer-simulator.js
} -ArgumentList $NUM_VIEWERS, $DURATION, 4002, $PWD

Write-Host ""
Write-Host "✅ Both tests started!" -ForegroundColor Green
$durationMsg1 = "⏱️  Waiting for tests to complete (${DURATION}s)..."
Write-Host $durationMsg1 -ForegroundColor Yellow
Write-Host ""

# Monitor progress
$startTime = Get-Date
while ($metricsJob.State -eq 'Running' -or $viewersJob.State -eq 'Running') {
    $elapsed = ((Get-Date) - $startTime).TotalSeconds
    $elapsedRounded = [math]::Round($elapsed, 0)
    $elapsedMsg = "⏱️  Elapsed: ${elapsedRounded}s / ${DURATION}s"
    Write-Host $elapsedMsg -ForegroundColor Cyan
    Start-Sleep -Seconds 30
}

# Wait for jobs to complete
Wait-Job $metricsJob, $viewersJob | Out-Null

Write-Host ""
Write-Host "📊 Test 1 Results (Without LB):" -ForegroundColor Green
Write-Host "-" * 70 -ForegroundColor Gray
Receive-Job $metricsJob
Write-Host ""
Receive-Job $viewersJob

Remove-Job $metricsJob, $viewersJob

Write-Host ""
Write-Host "Press Enter to continue to next test..." -ForegroundColor Yellow
Read-Host

# Stop server
Stop-Process -Id $server1.Id -Force -ErrorAction SilentlyContinue

# ============================================
# Test 2: WITH Load Balancer
# ============================================
Write-Host ""
Write-Host "=" * 70 -ForegroundColor Cyan
Write-Host "📊 Test 2: WITH Load Balancer (nginx)" -ForegroundColor Green
Write-Host "=" * 70 -ForegroundColor Cyan
Write-Host ""

# Setup nginx
Write-Host "Setting up nginx..." -ForegroundColor Cyan
Copy-Item "nginx-large-servers.conf" -Destination "C:\nginx-1.29.3\conf\nginx.conf" -Force
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
$servers = @()
for ($i = 2; $i -le $BACKEND_SERVERS; $i++) {
    $port = 4000 + $i
    $servers += Start-Process powershell -ArgumentList "-NoExit", "-Command", "cd '$PWD'; `$env:HTTP2_PORT=$port; npm run start3" -PassThru
}

Write-Host "Waiting 15 seconds for all servers to start..." -ForegroundColor Yellow
Start-Sleep -Seconds 15

# Start metrics load
Write-Host 'Starting metrics load (10,000 servers) via nginx...' -ForegroundColor Cyan
$env:NUM_SERVERS = $NUM_SERVERS
$env:DURATION = $DURATION
$env:SERVER_PORT = 8443

$metricsJob2 = Start-Job -ScriptBlock {
    param($numServers, $duration, $serverPort, $pwd)
    Set-Location $pwd
    $env:NUM_SERVERS = $numServers
    $env:DURATION = $duration
    $env:SERVER_PORT = $serverPort
    # Increase Node.js heap memory to 4GB
    node --max-old-space-size=4096 approach4/load-tester-high-scale.js
} -ArgumentList $NUM_SERVERS, $DURATION, 8443, $PWD

# Wait 5 seconds, then start dashboard viewers
Start-Sleep -Seconds 5

Write-Host 'Starting dashboard viewers (500 engineers) via nginx...' -ForegroundColor Cyan
$env:NUM_VIEWERS = $NUM_VIEWERS
$env:DURATION = $DURATION
$env:SERVER_PORT = 8443

$viewersJob2 = Start-Job -ScriptBlock {
    param($numViewers, $duration, $serverPort, $pwd)
    Set-Location $pwd
    $env:NUM_VIEWERS = $numViewers
    $env:DURATION = $duration
    $env:SERVER_PORT = $serverPort
    node approach4/dashboard-viewer-simulator.js
} -ArgumentList $NUM_VIEWERS, $DURATION, 8443, $PWD

Write-Host ""
Write-Host "✅ Both tests started!" -ForegroundColor Green
$durationMsg2 = "⏱️  Waiting for tests to complete (${DURATION}s)..."
Write-Host $durationMsg2 -ForegroundColor Yellow
Write-Host ""

# Monitor progress
$startTime2 = Get-Date
while ($metricsJob2.State -eq 'Running' -or $viewersJob2.State -eq 'Running') {
    $elapsed = ((Get-Date) - $startTime2).TotalSeconds
    $elapsedRounded = [math]::Round($elapsed, 0)
    $elapsedMsg = "⏱️  Elapsed: ${elapsedRounded}s / ${DURATION}s"
    Write-Host $elapsedMsg -ForegroundColor Cyan
    Start-Sleep -Seconds 30
}

Wait-Job $metricsJob2, $viewersJob2 | Out-Null

Write-Host ""
Write-Host "📊 Test 2 Results (With LB):" -ForegroundColor Green
Write-Host "-" * 70 -ForegroundColor Gray
Receive-Job $metricsJob2
Write-Host ""
Receive-Job $viewersJob2

Remove-Job $metricsJob2, $viewersJob2

# Cleanup
Get-Process -Name "nginx" -ErrorAction SilentlyContinue | Stop-Process -Force
$servers | ForEach-Object { Stop-Process -Id $_.Id -Force -ErrorAction SilentlyContinue }

Write-Host ""
Write-Host "=" * 70 -ForegroundColor Cyan
Write-Host "✅ ALL TESTS COMPLETED!" -ForegroundColor Green
Write-Host "=" * 70 -ForegroundColor Cyan
Write-Host ""
Write-Host "📊 Compare the results above:" -ForegroundColor Yellow
Write-Host "  - Metrics/sec" -ForegroundColor White
Write-Host "  - Success rate" -ForegroundColor White
Write-Host "  - Dashboard viewer connections" -ForegroundColor White
Write-Host "  - Events received per viewer" -ForegroundColor White
Write-Host ""

