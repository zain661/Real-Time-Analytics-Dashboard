# 🚀 كيفية تشغيل الاختبارات - دليل شامل

## 📍 أين تكتب الأوامر؟

### **المسار الصحيح:**
```
C:\Users\2024\Downloads\Real-Time-Analytics-Dashboard
```

هذا هو مجلد المشروع الرئيسي. **يجب أن تكون فيه** لتشغيل السكريبتات.

---

## ✅ طريقة 1: تشغيل السكريبت (الأسهل)

### **خطوة 1: افتح PowerShell في مجلد المشروع**

**الطريقة السهلة:**
1. اذهب إلى مجلد المشروع في File Explorer
2. اضغط `Shift + Right Click` على المجلد
3. اختر "Open PowerShell window here"

**أو:**
1. افتح PowerShell
2. اكتب:
```powershell
cd C:\Users\2024\Downloads\Real-Time-Analytics-Dashboard
```

### **خطوة 2: شغل السكريبت**
```powershell
.\test-high-scale.ps1
```

---

## ✅ طريقة 2: استخدام npm scripts

### **بدون Load Balancer:**
```powershell
# Terminal 1: شغل السيرفر
$env:HTTP2_PORT=4002
npm run start3

# Terminal 2: شغل Metrics (10,000 servers)
$env:NUM_SERVERS=10000
$env:DURATION=300
$env:SERVER_PORT=4002
npm run loadtest3-high

# Terminal 3: شغل Dashboard Viewers (500 engineers)
$env:NUM_VIEWERS=500
$env:DURATION=300
$env:SERVER_PORT=4002
npm run dashboard-viewers
```

### **مع Load Balancer (nginx):**
```powershell
# Terminal 1: Setup nginx
Copy-Item "nginx-large-servers.conf" -Destination "C:\nginx-1.29.3\conf\nginx.conf" -Force
cd C:\nginx-1.29.3
.\nginx.exe
cd ..

# Terminal 2-6: شغل 5 سيرفرات
$env:HTTP2_PORT=4002; npm run start3
$env:HTTP2_PORT=4003; npm run start3
$env:HTTP2_PORT=4004; npm run start3
$env:HTTP2_PORT=4005; npm run start3
$env:HTTP2_PORT=4006; npm run start3

# Terminal 7: شغل Metrics (via nginx)
$env:NUM_SERVERS=10000
$env:DURATION=300
$env:SERVER_PORT=8443
npm run loadtest3-high

# Terminal 8: شغل Dashboard Viewers (via nginx)
$env:NUM_VIEWERS=500
$env:DURATION=300
$env:SERVER_PORT=8443
npm run dashboard-viewers
```

---

## ✅ طريقة 3: تشغيل مباشر (Node.js)

### **بدون npm:**
```powershell
# من مجلد المشروع
node --max-old-space-size=4096 approach4/load-tester-high-scale.js

# مع Environment Variables:
$env:NUM_SERVERS=10000
$env:DURATION=300
$env:SERVER_PORT=4002
node --max-old-space-size=4096 approach4/load-tester-high-scale.js
```

---

## 🔍 التحقق من المسار الصحيح

### **اكتب هذا في PowerShell:**
```powershell
# تحقق من المسار الحالي
pwd
# يجب أن يظهر: C:\Users\2024\Downloads\Real-Time-Analytics-Dashboard

# تحقق من وجود السكريبت
Test-Path "test-high-scale.ps1"
# يجب أن يظهر: True

# تحقق من وجود الملفات المهمة
Test-Path "package.json"
Test-Path "approach4/load-tester-high-scale.js"
# يجب أن يظهر: True لكلاهما
```

---

## 📋 الأوامر الكاملة حسب السيناريو

### **سيناريو 1: اختبار سريع (1000 server فقط)**

```powershell
# Terminal 1
$env:HTTP2_PORT=4002
npm run start3

# Terminal 2
$env:NUM_SERVERS=1000
$env:SERVER_PORT=4002
npm run loadtest3-high
```

### **سيناريو 2: اختبار كامل (10,000 servers)**

**استخدم السكريبت التلقائي:**
```powershell
.\test-high-scale.ps1
```

**أو يدوياً (3 terminals):**
```powershell
# Terminal 1: Server
$env:HTTP2_PORT=4002
npm run start3

# Terminal 2: Metrics
$env:NUM_SERVERS=10000
$env:DURATION=300
$env:SERVER_PORT=4002
npm run loadtest3-high

# Terminal 3: Viewers
$env:NUM_VIEWERS=500
$env:DURATION=300
$env:SERVER_PORT=4002
npm run dashboard-viewers
```

---

## 🛠️ حل المشاكل الشائعة

### **مشكلة: "cannot find path"**
```powershell
# تأكد من المسار
cd C:\Users\2024\Downloads\Real-Time-Analytics-Dashboard
pwd
```

### **مشكلة: "script not found"**
```powershell
# افحص الملفات
Get-ChildItem *.ps1
# يجب أن ترى: test-high-scale.ps1
```

### **مشكلة: "execution policy"**
```powershell
# سمح بتشغيل السكريبتات
Set-ExecutionPolicy -ExecutionPolicy RemoteSigned -Scope CurrentUser
```

---

## 📊 ملخص الطرق

| الطريقة | السهولة | الموصى به |
|---------|---------|-----------|
| `.\test-high-scale.ps1` | ⭐⭐⭐ | ✅ نعم |
| npm scripts | ⭐⭐ | ✅ جيد |
| node مباشر | ⭐ | ⚠️ متقدم |

---

## 💡 نصيحة

**الأسهل والأفضل:**
```powershell
# من مجلد المشروع
.\test-high-scale.ps1
```

هذا السكريبت يفعل كل شيء تلقائياً! 🚀

