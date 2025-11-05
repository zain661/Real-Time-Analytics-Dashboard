# Script to test WITHOUT Load Balancer
# This gives you the baseline performance

Write-Host "🧪 Testing WITHOUT Load Balancer" -ForegroundColor Cyan
Write-Host "=" * 60 -ForegroundColor Cyan
Write-Host ""
Write-Host "📋 Steps:" -ForegroundColor Yellow
Write-Host "1. Make sure nginx is STOPPED (or just use port 4002)" -ForegroundColor White
Write-Host "2. Start ONE server:" -ForegroundColor White
Write-Host "   `$env:HTTP2_PORT=4002; npm run start3" -ForegroundColor Gray
Write-Host "3. In another terminal, run this test:" -ForegroundColor White
Write-Host "   `$env:SERVER_PORT=4002; npm run test3" -ForegroundColor Gray
Write-Host ""
Write-Host "✅ This tests DIRECT HTTP/2 connection (best performance)" -ForegroundColor Green
Write-Host ""

