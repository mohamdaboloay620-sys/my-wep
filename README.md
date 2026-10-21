# نظام تتبع السويفتات – شركة صافي

موقع محمي بكلمة مرور، مرفوع على **Vercel**، وبياناته تنحفظ داخل مستودع **GitHub** خاص (كل تعديل = commit، فيك ترجع لأي نسخة قديمة).

## كيف يشتغل
```
المتصفح  ──►  Vercel (index.html + api/)  ──►  مستودع GitHub خاص للبيانات
              │ تسجيل الدخول بالسيرفر          data/swifts.json
              │ كوكي موقّع (12 ساعة)           data/creds.json (اسم المستخدم وباسورد مشفّر)
```
- اسم المستخدم وكلمة المرور **ما بينكتبوا بالكود** أبداً، بيكونوا بإعدادات Vercel.
- أي طلب للبيانات بدون تسجيل دخول بيرجع 401.
- إذا موظفين عدّلوا بنفس اللحظة، الثاني بيطلعله تنبيه ويتحدث تلقائياً (ما في تعديل بيضيع بصمت).

---

## الخطوات

### 1) أنشئ مستودعين على GitHub (الاثنين **Private**)
| المستودع | الاسم المقترح | شو بيحتوي |
|---|---|---|
| الكود | `safi-swift` | محتويات هالمجلد |
| البيانات | `safi-swift-data` | فاضي (بس README) |

> ليش مستودعين؟ لو انحفظت البيانات بنفس مستودع الكود، كل حفظ رح يعمل نشر جديد على Vercel. وكمان بتبقى البيانات منفصلة وخاصة.

عند إنشاء `safi-swift-data` فعّل خيار **Add a README file** (لازم يكون فيه فرع `main`).

### 2) اعمل Token للوصول للبيانات
GitHub ← Settings ← Developer settings ← **Fine-grained personal access tokens** ← Generate new token
- **Repository access:** Only select repositories ← اختار `safi-swift-data` فقط
- **Permissions ← Repository permissions ← Contents:** `Read and write`
- انسخ الـ Token (بيبدأ بـ `github_pat_`). بيظهر مرة وحدة.
- حط تاريخ انتهاء، ولا تنسى تجدده قبل ما ينتهي، وإلا الموقع بيوقف عن الحفظ.

### 3) ارفع الكود لمستودع `safi-swift`
```bash
cd safi-swift          # مجلد المشروع
git init
git add .
git commit -m "first version"
git branch -M main
git remote add origin https://github.com/USERNAME/safi-swift.git
git push -u origin main
```
(أو بالسحب والإفلات من واجهة GitHub: Add file ← Upload files.)

### 4) اربطه مع Vercel
1. Vercel ← **Add New… ← Project** ← اختار `safi-swift` ← Import
2. قبل ما تضغط Deploy، افتح **Environment Variables** وأضف:

| الاسم | القيمة |
|---|---|
| `APP_USER` | اسم المستخدم الأولي |
| `APP_PASS` | كلمة المرور الأولية (قوية) |
| `SESSION_SECRET` | نص عشوائي 32 حرف أو أكثر (شوف تحت) |
| `GITHUB_TOKEN` | الـ Token من الخطوة 2 |
| `GITHUB_REPO` | `USERNAME/safi-swift-data` |

للحصول على `SESSION_SECRET`، نفّذ:
```bash
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
```
3. اضغط **Deploy**. بعد دقيقة بيعطيك رابط الموقع.

> أي تعديل على Environment Variables لاحقاً لازم يتبعه **Redeploy** حتى يتفعّل.

### 5) جرّب
- افتح الرابط ← لازم تظهر شاشة الدخول ← سجّل بـ `APP_USER` و`APP_PASS`.
- أضف سويفت ← روح على `safi-swift-data` ← لازم تلاقي `data/swifts.json` وcommit جديد.
- افتح الموقع من جهاز تاني: لازم تشوف نفس البيانات.

---

## نقل البيانات القديمة
الموقع الجديد على رابط جديد، فبيانات المتصفح القديمة ما بتنتقل لحالها.
من الموقع القديم اضغط **تصدير Excel**، وبالموقع الجديد اضغط **استيراد Excel**.

## تغيير اسم المستخدم وكلمة المرور
من زر **الحساب** داخل الموقع (بيطلب كلمة المرور الحالية). بينحفظوا مشفّرين في `data/creds.json`.
- **نسيت كلمة المرور؟** احذف الملف `data/creds.json` من مستودع البيانات، وبيرجع الدخول بقيم `APP_USER` و`APP_PASS` من Vercel.

## ملاحظات مهمة
- **بيانات تجريبية:** الموقع بيبدأ فاضي. إذا بدك أمثلة جاهزة، غيّر `SEED_DEMO_DATA` إلى `true` في `index.html`.
- **حدود GitHub:** حد الطلبات 5000 بالساعة، والموقع بيتحدّث كل 15 ثانية ويتوقف لما الصفحة تكون مخفية، فهاد كافي لفريق صغير. وحجم ملف البيانات أفضل أن يبقى تحت 1MB.
- **تجارب محلية:** `npm i -g vercel` ثم `vercel dev`، ضع المتغيرات بملف `.env` (مو بالمستودع، `.gitignore` بيتجاهله).
- **خطة Vercel:** الخطة المجانية (Hobby) للاستخدام الشخصي غير التجاري حسب شروط Vercel. لشركة، الأنسب خطة Pro.
- **الإنترنت:** الصفحة بتحمّل Tailwind وFont Awesome من CDN، فلازم الأجهزة يكون عندها إنترنت.
- **منع تخمين الباسورد:** كل محاولة غلط بتتأخر ثانية وشوي. إذا بدك حماية أقوى (حظر بعد عدة محاولات) بنضيف Vercel KV أو Upstash.
