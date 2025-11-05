# 🔧 Memory Optimization Guide

## ⚠️ Problem: JavaScript Heap Out of Memory

When testing with 10,000 servers, Node.js runs out of memory (default heap limit: ~2GB).

## ✅ Solutions Applied

### 1. **Increased Node.js Heap Memory**
- Added `--max-old-space-size=4096` (4GB)
- Applied to all high-scale load testers

### 2. **Connection Pool Management**
- Limited concurrent connections to 500 (instead of 10,000)
- Queued connections when limit reached
- Prevents memory exhaustion

### 3. **Optimized Batching**
- Reduced batch size: 50 (was 100)
- Increased delay: 50ms (was 10ms)
- Better memory distribution

---

## 🚀 Usage

### **Automatic (Recommended):**
```powershell
.\test-high-scale.ps1
```
Now includes memory optimization automatically.

### **Manual:**
```powershell
# With memory flag
node --max-old-space-size=4096 approach3/load-tester-high-scale.js

# Or use npm script
npm run loadtest3-high
```

---

## ⚙️ Configuration

Edit `approach3/load-tester-high-scale.js` to adjust:

```javascript
const MAX_CONCURRENT_CONNECTIONS = 500; // Increase if you have more RAM
const CONNECTION_BATCH_SIZE = 50;      // Reduce if memory issues persist
const BATCH_DELAY_MS = 50;             // Increase for slower ramp-up
```

---

## 💡 Alternative: Reduce Test Scale

If memory issues persist, reduce the test scale:

```powershell
$env:NUM_SERVERS=5000   # Instead of 10000
$env:NUM_VIEWERS=250    # Instead of 500
```

---

## 📊 Expected Results

With optimizations:
- ✅ No memory errors
- ✅ Stable connection management
- ✅ Better resource usage
- ⚠️ Slightly slower ramp-up (but more stable)

---

## 🔍 Monitoring

Watch for:
- Connection queue building up
- Memory usage staying below 4GB
- Stable metrics/sec after ramp-up

---

**The test should now run successfully!** ✅

