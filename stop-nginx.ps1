# PowerShell script to stop nginx load balancer
# Usage: .\stop-nginx.ps1

Write-Host "🛑 Stopping Nginx Load Balancer..." -ForegroundColor Yellow

$nginxProcess = Get-Process -Name "nginx" -ErrorAction SilentlyContinue

if ($nginxProcess) {
    Stop-Process -Name "nginx" -Force -ErrorAction SilentlyContinue
    Start-Sleep -Seconds 1
    
    $stillRunning = Get-Process -Name "nginx" -ErrorAction SilentlyContinue
    if (-not $stillRunning) {
        Write-Host "✅ Nginx stopped successfully!" -ForegroundColor Green
    } else {
        Write-Host "⚠️  Some nginx processes may still be running. Try running as administrator." -ForegroundColor Yellow
    }
} else {
    Write-Host "ℹ️  Nginx is not running." -ForegroundColor Cyan
}

