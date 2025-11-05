# Complete script to start all services for load balancer testing
# Usage: .\start-load-balancer.ps1

Write-Host "🚀 Starting Load Balancer Setup..." -ForegroundColor Green
Write-Host "=" * 60 -ForegroundColor Cyan
Write-Host ""

# Step 1: Check if SSL certificates exist
Write-Host "📋 Step 1: Checking SSL certificates..." -ForegroundColor Cyan
if (-not ((Test-Path "approach4\certs\server-key.pem") -and (Test-Path "approach4\certs\server-cert.pem"))) {
    Write-Host "❌ SSL certificates not found in approach4\certs\" -ForegroundColor Red
    Write-Host "💡 Generating certificates..." -ForegroundColor Yellow
    node generate-certs.js
    if ($LASTEXITCODE -ne 0) {
        Write-Host "❌ Failed to generate certificates!" -ForegroundColor Red
        exit 1
    }
}

# Copy certificates to nginx
Write-Host "📋 Copying certificates to nginx..." -ForegroundColor Cyan
if (-not (Test-Path "C:\nginx-1.29.3\ssl")) {
    New-Item -ItemType Directory -Path "C:\nginx-1.29.3\ssl" -Force | Out-Null
}
Copy-Item "approach4\certs\server-cert.pem" -Destination "C:\nginx-1.29.3\ssl\my-cert.pem" -Force
Copy-Item "approach4\certs\server-key.pem" -Destination "C:\nginx-1.29.3\ssl\my-key.pem" -Force
Write-Host "✅ Certificates ready" -ForegroundColor Green
Write-Host ""

# Step 2: Copy nginx configuration
Write-Host "📋 Step 2: Configuring nginx..." -ForegroundColor Cyan
Copy-Item "nginx.conf" -Destination "C:\nginx-1.29.3\conf\nginx.conf" -Force
Write-Host "✅ Configuration copied" -ForegroundColor Green
Write-Host ""

# Step 3: Start nginx
Write-Host "📋 Step 3: Starting nginx..." -ForegroundColor Cyan
& ".\start-nginx.ps1"
if ($LASTEXITCODE -ne 0) {
    exit 1
}
Write-Host ""

# Step 4: Instructions for starting backend servers
Write-Host "=" * 60 -ForegroundColor Cyan
Write-Host "✅ Setup Complete!" -ForegroundColor Green
Write-Host ""
Write-Host "📋 Next Steps:" -ForegroundColor Yellow
Write-Host ""
Write-Host "Open 3 separate terminal windows and run:" -ForegroundColor Cyan
Write-Host ""
Write-Host "  Terminal 1 (Port 4002):" -ForegroundColor White
Write-Host "    `$env:HTTP2_PORT=4002; npm run start3" -ForegroundColor Gray
Write-Host ""
Write-Host "  Terminal 2 (Port 4003):" -ForegroundColor White
Write-Host "    `$env:HTTP2_PORT=4003; npm run start3" -ForegroundColor Gray
Write-Host ""
Write-Host "  Terminal 3 (Port 4004):" -ForegroundColor White
Write-Host "    `$env:HTTP2_PORT=4004; npm run start3" -ForegroundColor Gray
Write-Host ""
Write-Host "Then run the load test:" -ForegroundColor Cyan
Write-Host "  `$env:SERVER_PORT=8443; npm run test3" -ForegroundColor Gray
Write-Host ""
Write-Host "To stop nginx, run: .\stop-nginx.ps1" -ForegroundColor Yellow
Write-Host ""

