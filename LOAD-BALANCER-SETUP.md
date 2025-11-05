# Load Balancer Setup Guide

## المطلوب: اختبار approach4 مع وبدون Load Balancer

---

## الخيار 1: Without Load Balancer (Direct Testing) - السهل

### الخطوات:
```powershell
# Terminal 1: شغل السيرفر
npm run start3

# Terminal 2: شغل الاختبار
npm run test3

# احفظ النتيجة! (عندي: بدون LB)
```

### النتيجة:
- الاتصال مباشر إلى `https://localhost:4002`
- جميع الطلبات تذهب لسيرفر واحد فقط
- **هذه هي النتيجة الأساسية** للمقارنة

---

## الخيار 2: With Load Balancer (Using Multiple Local Servers)

### المتطلبات:
- **nginx** مثبت على Windows
- تشغيل 3 نسخ من السيرفر على منافذ مختلفة

### خطوات الإعداد:

#### 1. تثبيت nginx على Windows:
```powershell
# Download nginx from: http://nginx.org/en/download.html
# Extract to C:\nginx
# Verify installation:
C:\nginx\nginx.exe -v
```

#### 2. تعديل nginx.conf:
- تم إصلاح ملف `nginx.conf` في المشروع تلقائياً
- نسخ الملف إلى `C:\nginx-1.29.3\conf\nginx.conf`:
```powershell
Copy-Item "nginx.conf" -Destination "C:\nginx-1.29.3\conf\nginx.conf" -Force
```
- أو استخدم السكريبت المساعد: `.\start-load-balancer.ps1`

#### 3. إنشاء 3 نُسخ من السيرفر على منافذ مختلفة:

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

#### 4. تعديل nginx.conf للمنافذ الصحيحة:
```nginx
upstream backend_servers {
    least_conn;
    server 127.0.0.1:4002 max_fails=3 fail_timeout=30s;
    server 127.0.0.1:4003 max_fails=3 fail_timeout=30s;
    server 127.0.0.1:4004 max_fails=3 fail_timeout=30s;
}
```

#### 5. تشغيل nginx:
```powershell
# الطريقة السهلة (من دليل المشروع):
.\start-nginx.ps1

# أو يدوياً:
Set-Location C:\nginx-1.29.3
.\nginx.exe
```

**ملاحظة مهمة**: تأكد من تشغيل nginx من دليله (`C:\nginx-1.29.3`) لتجنب مشاكل المسارات.

#### 6. تعديل load-tester.js للاتصال عبر Load Balancer:
```javascript
const SERVER_PORT = parseInt(process.env.SERVER_PORT) || 8443;  // nginx port
```

#### 7. تشغيل الاختبار:
```powershell
$env:SERVER_PORT=8443
npm run test3
```

---

## الخيار 3: Docker Compose (Recommended)

### المتطلبات:
- Docker Desktop for Windows

### التشغيل:

#### بدون Load Balancer:
```powershell
docker-compose up db redis app
```

#### مع Load Balancer:
```powershell
docker-compose -f docker-compose.proxy.yml up
```

---

## مقارنة النتائج

### بدون Load Balancer:
```powershell
npm run start3
# في terminal آخر:
npm run test3
# انسخ النتائج
```

### مع Load Balancer:
```powershell
# شغل 3 نسخ من السيرفر + nginx
# ثم:
$env:SERVER_PORT=8443
npm run test3
# انسخ النتائج
```

---

## المؤشرات للمقارنة:

1. **Total Metrics/sec** - عدد metrics المعالجة في الثانية
2. **Average Metrics/sec** - المتوسط
3. **Success Rate** - نسبة نجاح الاتصالات
4. **Response Time** - زمن الاستجابة
5. **Resource Usage** - استخدام CPU/RAM لكل سيرفر

---

## ملاحظات مهمة:

⚠️ **HTTP/2 Streaming عبر nginx**: 
- nginx قد لا يدعم HTTP/2 upstream بشكل كامل
- قد يحدث downgrade من HTTP/2 إلى HTTP/1.1
- اختر الخيار 1 (Direct) أو الخيار 3 (Docker) للحصول على نتائج أفضل

💡 **بديل بسيط**: استخدم الخيار 1 فقط ثم قارن:
- Single server vs. نُسخ متعددة بدون nginx
- ادرس تأثير scale على الأداء

---

## 🚀 خطوات الاختبار السريع (Easy Way):

```powershell
# ==========================================
# الاختبار 1: بدون Load Balancer
# ==========================================

# Terminal 1: شغل السيرفر
npm run start3

# Terminal 2: شغل الاختبار (اتصال مباشر)
npm run test3

# انسخ النتيجة واحفظها!

# ==========================================
# الاختبار 2: مع Load Balancer (ماذا لو!)
# ==========================================
# ملاحظة: HTTP/2 streaming معقد عبر nginx
# الأفضل: اختبر Multiple Instances بدون nginx

# Terminal 1-3: شغل 3 نسخ من السيرفر
$env:HTTP2_PORT=4002; npm run start3
$env:HTTP2_PORT=4003; npm run start3  
$env:HTTP2_PORT=4004; npm run start3

# Terminal 4: شغل الاختبار على واحد منهم
$env:SERVER_PORT=4002
npm run loadtest3-lb

# قارن: هل 3 سيرفرات أفضل من واحد؟
```

## 📊 ما تقارنه:

1. **Without LB**: Single server on port 4002
2. **With LB**: Multiple servers (4002, 4003, 4004) + nginx on 8443
3. **Direct Multi**: Test each server separately بدون nginx

## 💡 خلاصة:

- **الأفضل للتطبيق**: بدون nginx (HTTP/2 streams معقدة)
- **لفهم Load Balancing**: اختبر 3 سيرفرات مباشرة
- **للإنتاج**: استخدم cloud-native LB (AWS ELB, GCP LB, etc.)

