# PowerShell script to start nginx load balancer
# Usage: .\start-nginx.ps1

Write-Host "🚀 Starting Nginx Load Balancer..." -ForegroundColor Green

# Check if nginx is already running
$nginxProcess = Get-Process -Name "nginx" -ErrorAction SilentlyContinue
if ($nginxProcess) {
    Write-Host "⚠️  Nginx is already running. Stopping existing instance..." -ForegroundColor Yellow
    Stop-Process -Name "nginx" -Force -ErrorAction SilentlyContinue
    Start-Sleep -Seconds 2
}

# Check if nginx exists
if (-not (Test-Path "C:\nginx-1.29.3\nginx.exe")) {
    Write-Host "❌ Nginx not found at C:\nginx-1.29.3\nginx.exe" -ForegroundColor Red
    Write-Host "Please install nginx or update the path in this script." -ForegroundColor Yellow
    exit 1
}

# Change to nginx directory and start
Set-Location "C:\nginx-1.29.3"

# Test configuration first
Write-Host "🔍 Testing nginx configuration..." -ForegroundColor Cyan
$testResult = .\nginx.exe -t 2>&1
if ($LASTEXITCODE -ne 0) {
    Write-Host "❌ Configuration test failed:" -ForegroundColor Red
    Write-Host $testResult
    Set-Location $PSScriptRoot
    exit 1
}

Write-Host "✅ Configuration test passed!" -ForegroundColor Green

# Start nginx
Write-Host "🚀 Starting nginx..." -ForegroundColor Cyan
Start-Process -FilePath ".\nginx.exe" -WorkingDirectory "C:\nginx-1.29.3"

Start-Sleep -Seconds 2

# Verify nginx started
$nginxProcess = Get-Process -Name "nginx" -ErrorAction SilentlyContinue
if ($nginxProcess) {
    Write-Host "✅ Nginx started successfully!" -ForegroundColor Green
    Write-Host "📍 Listening on https://localhost:8443" -ForegroundColor Cyan
    Write-Host ""
    Write-Host "💡 To stop nginx, run: .\stop-nginx.ps1" -ForegroundColor Yellow
}
else {
    Write-Host "❌ Failed to start nginx. Check logs at C:\nginx-1.29.3\logs\error.log" -ForegroundColor Red
    Set-Location $PSScriptRoot
    exit 1
}

# Return to original directory
Set-Location $PSScriptRoot
