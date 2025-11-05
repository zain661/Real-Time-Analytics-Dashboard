# Simple script to start nginx
# Usage: .\start-nginx-simple.ps1

# Stop any existing nginx
Get-Process -Name "nginx" -ErrorAction SilentlyContinue | Stop-Process -Force -ErrorAction SilentlyContinue
Start-Sleep -Seconds 1

# Change to nginx directory and start
cd C:\nginx-1.29.3
.\nginx.exe -t
if ($LASTEXITCODE -eq 0) {
    .\nginx.exe
    Write-Host "✅ Nginx started!" -ForegroundColor Green
} else {
    Write-Host "❌ Configuration error!" -ForegroundColor Red
}

# Return to project directory
cd $PSScriptRoot

