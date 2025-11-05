# 🔥 High-Scale Test Guide: 10,000 Servers + 500 Engineers

## 🎯 Test Scenario

- **10,000 servers** sending metrics every second
- **500 engineers** viewing real-time dashboard simultaneously
- Compare **with** and **without** nginx Load Balancer

### Expected Load:
- ~50,000 metrics/second (10,000 servers × 5 metric types)
- 500 concurrent SSE connections for dashboard
- ~1 event/second per viewer = 500 events/second

---

## 🚀 Quick Start

### **Automated Test (Recommended):**

```powershell
.\test-high-scale.ps1
```

This will:
1. ✅ Test WITHOUT LB (single server)
2. ✅ Test WITH LB (nginx + 5 backend servers)
3. ✅ Run both tests simultaneously
4. ✅ Show comparison results

---

## 📋 Manual Testing

### **Test 1: WITHOUT Load Balancer**

#### Step 1: Start Backend Server
```powershell
# Terminal 1
$env:HTTP2_PORT=4002
npm run start3
```

#### Step 2: Start Metrics Load (10,000 servers)
```powershell
# Terminal 2
$env:NUM_SERVERS=10000
$env:DURATION=300
$env:SERVER_PORT=4002
npm run loadtest3-high
```

#### Step 3: Start Dashboard Viewers (500 engineers)
```powershell
# Terminal 3
$env:NUM_VIEWERS=500
$env:DURATION=300
$env:SERVER_PORT=4002
npm run dashboard-viewers
```

---

### **Test 2: WITH Load Balancer**

#### Step 1: Setup nginx
```powershell
Copy-Item "nginx-large-servers.conf" -Destination "C:\nginx-1.29.3\conf\nginx.conf" -Force
cd C:\nginx-1.29.3
.\nginx.exe -s reload
cd ..
```

#### Step 2: Start 5 Backend Servers
```powershell
# Terminal 1-5
$env:HTTP2_PORT=4002; npm run start3
$env:HTTP2_PORT=4003; npm run start3
$env:HTTP2_PORT=4004; npm run start3
$env:HTTP2_PORT=4005; npm run start3
$env:HTTP2_PORT=4006; npm run start3
```

#### Step 3: Start Metrics Load (via nginx)
```powershell
# Terminal 6
$env:NUM_SERVERS=10000
$env:DURATION=300
$env:SERVER_PORT=8443
npm run loadtest3-high
```

#### Step 4: Start Dashboard Viewers (via nginx)
```powershell
# Terminal 7
$env:NUM_VIEWERS=500
$env:DURATION=300
$env:SERVER_PORT=8443
npm run dashboard-viewers
```

---

## 📊 Metrics to Compare

| Metric | Without LB | With LB (nginx) |
|--------|-----------|----------------|
| **Metrics/sec** | ? | ? |
| **Success Rate** | ? | ? |
| **Dashboard Connections** | ? | ? |
| **Events Received/Viewer** | ? | ? |
| **Average Latency** | ? | ? |
| **Peak Metrics/sec** | ? | ? |
| **CPU Usage** | ? | ? |
| **Memory Usage** | ? | ? |

---

## ⚠️ Important Notes

### **System Requirements:**
- **CPU**: Multi-core recommended (8+ cores)
- **RAM**: 8GB+ recommended
- **Network**: Sufficient bandwidth
- **Node.js**: Latest LTS version

### **Test Duration:**
- Default: 300 seconds (5 minutes)
- Adjust with `$env:DURATION=<seconds>`

### **Scale Down for Testing:**
If your system can't handle 10,000 servers, test with smaller numbers:

```powershell
# Test with 1,000 servers first
$env:NUM_SERVERS=1000
$env:NUM_VIEWERS=50
```

---

## 🔍 Expected Results

### **Without Load Balancer:**
- ✅ Higher metrics/sec (direct HTTP/2)
- ✅ Better latency
- ✅ More efficient
- ⚠️ Single server may saturate

### **With Load Balancer:**
- ⚠️ Lower metrics/sec (HTTP/2 → HTTP/1.1 conversion)
- ⚠️ Higher latency (nginx overhead)
- ✅ Better distribution across servers
- ✅ High availability

---

## 📈 Performance Expectations

### **Without LB (Single Server):**
- Can handle: 30,000-50,000 metrics/sec
- Dashboard viewers: 500 concurrent
- Success rate: 95%+

### **With LB (5 Servers):**
- Can handle: 25,000-40,000 metrics/sec per server
- Total: 125,000-200,000 metrics/sec (theoretical)
- But limited by nginx HTTP/1.1 conversion
- Dashboard viewers: Distributed across servers

---

## 🎓 Analysis

### **Key Questions:**
1. Does nginx LB help at this scale?
2. Is single server sufficient?
3. What's the bottleneck?
4. How does HTTP/2 downgrade affect performance?

### **What to Look For:**
- **Saturation point**: When does single server max out?
- **Distribution**: Does LB distribute load evenly?
- **Dashboard performance**: Can 500 viewers get updates in real-time?
- **Error rates**: Connection failures, timeouts

---

## 🛠️ Troubleshooting

### **Issue: Test takes too long**
- Reduce `NUM_SERVERS` or `DURATION`
- Start with smaller scale

### **Issue: Too many connection errors**
- System may be overwhelmed
- Reduce concurrent connections
- Check server resources

### **Issue: Dashboard viewers disconnect**
- Server may be overloaded
- Check server logs
- Monitor CPU/RAM usage

---

## 📝 Report Template

```
## High-Scale Test Results

### Configuration:
- Servers: 10,000
- Viewers: 500
- Duration: 300s

### Without Load Balancer:
- Metrics/sec: _______
- Success Rate: _______
- Dashboard Connections: _______
- Events/Viewer: _______

### With Load Balancer:
- Metrics/sec: _______
- Success Rate: _______
- Dashboard Connections: _______
- Events/Viewer: _______

### Conclusion:
_________________________________________________
_________________________________________________
```

---

## ✅ Ready to Test!

Run `.\test-high-scale.ps1` and let it complete both tests. Then compare the results!

**Good luck!** 🚀

