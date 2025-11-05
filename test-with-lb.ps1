# Script to test WITH Load Balancer
# This tests distributed load across 3 servers

Write-Host "🧪 Testing WITH Load Balancer" -ForegroundColor Cyan
Write-Host "=" * 60 -ForegroundColor Cyan
Write-Host ""

# Check if nginx is running
$nginxRunning = Get-Process -Name "nginx" -ErrorAction SilentlyContinue
if (-not $nginxRunning) {
    Write-Host "⚠️  Nginx is not running!" -ForegroundColor Yellow
    Write-Host "   Starting nginx..." -ForegroundColor Cyan
    & ".\start-nginx.ps1"
    Start-Sleep -Seconds 2
}

# Check backend servers
Write-Host "📋 Prerequisites:" -ForegroundColor Yellow
Write-Host ""
Write-Host "Make sure these 3 servers are running in separate terminals:" -ForegroundColor White
Write-Host ""
Write-Host "Terminal 1: `$env:HTTP2_PORT=4002; npm run start3" -ForegroundColor Gray
Write-Host "Terminal 2: `$env:HTTP2_PORT=4003; npm run start3" -ForegroundColor Gray
Write-Host "Terminal 3: `$env:HTTP2_PORT=4004; npm run start3" -ForegroundColor Gray
Write-Host ""
Write-Host "Press Enter when all 3 servers are ready..." -ForegroundColor Yellow
Read-Host

Write-Host ""
Write-Host "🚀 Running load test through Load Balancer..." -ForegroundColor Green
Write-Host ""
$env:SERVER_PORT = 8443
npm run test3

Write-Host ""
Write-Host "✅ Test complete! Compare results with baseline." -ForegroundColor Green
Write-Host ""

