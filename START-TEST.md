# 🚀 كيفية تشغيل الاختبارات - دليل سريع

## 📍 المسار الصحيح

### **المجلد:**
```
C:\Users\2024\Downloads\Real-Time-Analytics-Dashboard
```

**يجب أن تكون في هذا المجلد لتشغيل الأوامر!**

---

## ✅ الطريقة 1: تشغيل السكريبت التلقائي (الأسهل)

### **خطوة 1: افتح PowerShell في مجلد المشروع**

**الطريقة السهلة:**
1. افتح File Explorer
2. اذهب إلى: `C:\Users\2024\Downloads\Real-Time-Analytics-Dashboard`
3. اضغط `Shift + Right Click` (زر الفأرة الأيمن + Shift)
4. اختر **"Open PowerShell window here"**

**أو افتح PowerShell واكتب:**
```powershell
cd C:\Users\2024\Downloads\Real-Time-Analytics-Dashboard
```

### **خطوة 2: تحقق من المسار**
```powershell
pwd
# يجب أن يظهر: C:\Users\2024\Downloads\Real-Time-Analytics-Dashboard

Get-Location
# أو استخدم هذا الأمر
```

### **خطوة 3: شغل السكريبت**
```powershell
.\test-high-scale.ps1
```

---

## ✅ الطريقة 2: استخدام npm (بدون سكريبت)

### **بدون Load Balancer:**

#### **Terminal 1: شغل السيرفر**
```powershell
cd C:\Users\2024\Downloads\Real-Time-Analytics-Dashboard
$env:HTTP2_PORT=4002
npm run start3
```

#### **Terminal 2: شغل Metrics (10,000 servers)**
```powershell
cd C:\Users\2024\Downloads\Real-Time-Analytics-Dashboard
$env:NUM_SERVERS=10000
$env:DURATION=300
$env:SERVER_PORT=4002
npm run loadtest3-high
```

#### **Terminal 3: شغل Dashboard Viewers (500 engineers)**
```powershell
cd C:\Users\2024\Downloads\Real-Time-Analytics-Dashboard
$env:NUM_VIEWERS=500
$env:DURATION=300
$env:SERVER_PORT=4002
npm run dashboard-viewers
```

---

## ✅ الطريقة 3: تشغيل مباشر (Node.js)

```powershell
cd C:\Users\2024\Downloads\Real-Time-Analytics-Dashboard

# Set environment variables
$env:NUM_SERVERS=10000
$env:DURATION=300
$env:SERVER_PORT=4002

# Run directly
node --max-old-space-size=4096 approach4/load-tester-high-scale.js
```

---

## 🔍 التحقق السريع

### **اكتب هذا في PowerShell:**
```powershell
# 1. تحقق من المسار
pwd
# النتيجة المتوقعة: C:\Users\2024\Downloads\Real-Time-Analytics-Dashboard

# 2. تحقق من وجود السكريبت
Test-Path "test-high-scale.ps1"
# النتيجة المتوقعة: True

# 3. تحقق من ملفات المشروع
Test-Path "package.json"
Test-Path "approach4/load-tester-high-scale.js"
# النتيجة المتوقعة: True
```

---

## 🛠️ حل مشكلة "Execution Policy"

إذا ظهرت رسالة "execution policy":

```powershell
# سمح بتشغيل السكريبتات
Set-ExecutionPolicy -ExecutionPolicy RemoteSigned -Scope CurrentUser

# ثم شغل السكريبت مرة أخرى
.\test-high-scale.ps1
```

---

## 📋 الطريقة الموصى بها

### **الأسهل:**
```powershell
# من مجلد المشروع
.\test-high-scale.ps1
```

### **للمزيد من التحكم:**
استخدم npm scripts (الطريقة 2)

---

## 📝 مثال كامل

```powershell
# افتح PowerShell

# 1. اذهب لمجلد المشروع
cd C:\Users\2024\Downloads\Real-Time-Analytics-Dashboard

# 2. تحقق من المسار
pwd

# 3. شغل السكريبت
.\test-high-scale.ps1
```

---

## ✅ ملخص

**المسار:** `C:\Users\2024\Downloads\Real-Time-Analytics-Dashboard`  
**الأمر:** `.\test-high-scale.ps1`  
**البديل:** استخدم npm scripts (الطريقة 2)

**جاهز للاختبار!** 🚀

