# 🚀 Quick Start Guide: Load Balancer Setup

## ✅ All Issues Fixed!

The nginx configuration has been updated with the following fixes:
- ✅ Fixed SSL certificate paths
- ✅ Updated deprecated HTTP/2 directives
- ✅ Fixed log file paths
- ✅ Added PID file configuration
- ✅ Copied certificates to nginx directory

## 📋 Setup Steps

### Option 1: Automated Setup (Easiest)
```powershell
.\start-load-balancer.ps1
```

This script will:
1. ✅ Check and generate SSL certificates if needed
2. ✅ Copy certificates to nginx directory
3. ✅ Copy nginx configuration
4. ✅ Start nginx

### Option 2: Manual Setup

#### Step 1: Ensure SSL certificates exist
```powershell
# Check if certificates exist
if (-not (Test-Path "approach3\certs\server-cert.pem")) {
    node generate-certs.js
}

# Copy to nginx
Copy-Item "approach3\certs\server-cert.pem" -Destination "C:\nginx-1.29.3\ssl\my-cert.pem" -Force
Copy-Item "approach3\certs\server-key.pem" -Destination "C:\nginx-1.29.3\ssl\my-key.pem" -Force
```

#### Step 2: Copy nginx configuration
```powershell
Copy-Item "nginx.conf" -Destination "C:\nginx-1.29.3\conf\nginx.conf" -Force
```

#### Step 3: Test configuration
```powershell
Set-Location C:\nginx-1.29.3
.\nginx.exe -t
```

#### Step 4: Start nginx
```powershell
.\start-nginx.ps1
```

## 🎯 Starting Backend Servers

Open **3 separate terminal windows** and run:

**Terminal 1** - Server on port 4002:
```powershell
$env:HTTP2_PORT=4002
npm run start3
```

**Terminal 2** - Server on port 4003:
```powershell
$env:HTTP2_PORT=4003
npm run start3
```

**Terminal 3** - Server on port 4004:
```powershell
$env:HTTP2_PORT=4004
npm run start3
```

## 🧪 Running Tests

### Test with Load Balancer:
```powershell
$env:SERVER_PORT=8443
npm run test3
```

### Test without Load Balancer (Direct):
```powershell
$env:SERVER_PORT=4002
npm run test3
```

## 🛑 Stopping Services

### Stop nginx:
```powershell
.\stop-nginx.ps1
```

### Stop backend servers:
Press `Ctrl+C` in each terminal window.

## 📊 Verification

Check if nginx is running:
```powershell
Get-Process -Name "nginx"
```

Check nginx logs:
```powershell
Get-Content C:\nginx-1.29.3\logs\error.log -Tail 20
```

Test nginx endpoint:
```powershell
# This should connect (may show SSL warning)
curl -k https://localhost:8443/health
```

## 🔧 Troubleshooting

### Issue: "Cannot load certificate"
**Solution**: Make sure certificates are copied to `C:\nginx-1.29.3\ssl\`

### Issue: "Port 8443 already in use"
**Solution**: Stop existing nginx: `.\stop-nginx.ps1`

### Issue: "Backend servers not responding"
**Solution**: 
1. Verify all 3 backend servers are running on ports 4002, 4003, 4004
2. Check nginx error log: `C:\nginx-1.29.3\logs\error.log`

### Issue: "Configuration test failed"
**Solution**: 
1. Make sure you're running `nginx.exe -t` from `C:\nginx-1.29.3` directory
2. Check that `nginx.conf` has correct paths (all paths should be `C:/nginx-1.29.3/...`)

## 📝 What Changed

The `nginx.conf` file was updated with:
- ✅ Fixed SSL paths: `C:/nginx-1.29.3/ssl/my-cert.pem`
- ✅ Modern HTTP/2 syntax: `http2 on;` instead of deprecated `listen ... http2`
- ✅ Fixed log paths: `C:/nginx-1.29.3/logs/access.log`
- ✅ Added PID file: `C:/nginx-1.29.3/logs/nginx.pid`

## 🎉 You're Ready!

Now you can run your load balancer tests and compare:
- **Without LB**: Single server performance
- **With LB**: Distributed load across 3 servers

Happy testing! 🚀

