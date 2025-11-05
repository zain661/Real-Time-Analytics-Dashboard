# 🚀 طرق بسيطة لتشغيل nginx

## ✅ الطريقة الأبسط (بدون سكريبت)

### تشغيل nginx:
```powershell
cd C:\nginx-1.29.3
.\nginx.exe
```

### إيقاف nginx:
```powershell
Get-Process -Name "nginx" | Stop-Process -Force
```

### اختبار التكوين:
```powershell
cd C:\nginx-1.29.3
.\nginx.exe -t
```

---

## 📋 الخطوات الكاملة (يدوياً)

### 1. إيقاف nginx السابق (إن وجد):
```powershell
Get-Process -Name "nginx" | Stop-Process -Force
```

### 2. الانتقال لمجلد nginx:
```powershell
cd C:\nginx-1.29.3
```

### 3. اختبار التكوين:
```powershell
.\nginx.exe -t
```

### 4. تشغيل nginx:
```powershell
.\nginx.exe
```

### 5. العودة لمجلد المشروع:
```powershell
cd C:\Users\2024\Downloads\Real-Time-Analytics-Dashboard
```

---

## 🎯 سكريبت بسيط (بدون مشاكل syntax)

استخدم `start-nginx-simple.ps1`:
```powershell
.\start-nginx-simple.ps1
```

---

## ✅ التحقق من أن nginx يعمل:

```powershell
# تحقق من العمليات
Get-Process -Name "nginx"

# تحقق من المنفذ
netstat -ano | findstr ":8443"
```

---

## 🛑 إيقاف nginx:

```powershell
Get-Process -Name "nginx" | Stop-Process -Force
```

---

## 💡 ملاحظة:

**الأهم:** يجب تشغيل nginx من مجلده (`C:\nginx-1.29.3`) لتجنب مشاكل المسارات!

