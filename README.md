# TECH ZONE — GEAR UP YOUR GAME

## 0) تشغيل تجريبي (بدون Firebase)
`python3 -m http.server 8000` ثم افتح http://localhost:8000
يعمل بوضع تجريبي (تصفح، فلاتر، سلة، مقارنة، مفضلة). الطلبات والحسابات تحتاج Firebase.

## 1) أين أضع صورنا وأسماءنا؟ 👥
- ملف **`js/firebase-config.js`** ← قسم `team` (5 أعضاء) و `doctor`.
  الأسماء المكتوبة: حسين أحمد محمود، يوسف حسن، والدكتور **سعيد نظمي**. غيّر باقي الأسماء هناك.
- الصور ضعها في **`images/team/`** بالأسماء `member1.jpg … member5.jpg` و `doctor.jpg`
  (أو غيّر المسارات في نفس الملف). لو الصورة غير موجودة يظهر رمز بديل بدل صورة مكسورة.
- القسم يظهر في الصفحة الرئيسية **فوق قسم آراء العملاء** (ابحث عن `TEAM SECTION` في `js/app.js`).

## 2) أين أضع بيانات الدفع والاتصال؟ 💳
- **إعدادات Firebase:** `js/firebase-config.js` (قيم عامة؛ الأمان يأتي من قواعد Firestore).
- **الهاتف / واتساب / الإيميل / الشحن:** نفس الملف (`storeDefaults`) أو من لوحة الأدمن ← settings.
- **Paymob (بيانات سرّية، لا توضع في الواجهة أبداً):**
  ```
  cd functions && npm install && cd ..
  firebase functions:secrets:set PAYMOB_API_KEY
  firebase functions:secrets:set PAYMOB_INTEGRATION_ID
  firebase functions:secrets:set PAYMOB_HMAC
  firebase functions:secrets:set PAYMOB_IFRAME_ID
  ```
  ثم في لوحة Paymob اجعل Transaction processed callback = رابط دالة `paymobWebhook` بعد النشر.
  الطلب الإلكتروني يبقى "غير مدفوع" حتى يصل تأكيد حقيقي من Paymob (مُتحقق منه بـ HMAC).
  ⚠ Cloud Functions تتطلب خطة **Blaze** في Firebase (الدفع عند الاستلام أيضاً يمر عبر الدالة للتحقق من الأسعار والمخزون).

## 3) خطوات النشر
1. أنشئ مشروعاً في console.firebase.google.com وفعّل: Authentication (Email/Password)، Firestore، Storage، Hosting.
2. أضف Web App؛ إعدادات Web App الخاصة بمشروع `tech-zone-86d68` أُضيفت بالفعل إلى `js/firebase-config.js`.
3. `npm i -g firebase-tools && firebase login && firebase use <project-id>`
4. `firebase deploy --only firestore:rules,storage,functions,hosting`
5. أنشئ حسابك من الموقع، ثم حوّله لأدمن (على جهازك فقط):
   `cd functions && npm i && cd .. && node scripts/set-admin.js your@email.com`
   (يحتاج `scripts/serviceAccount.json` من Firebase ← Service accounts. لا ترفعه ولا تشاركه.)
6. افتح `/admin.html` ← products ← **Import catalog.json** لرفع المنتجات (177 منتج) إلى Firestore.
7. عدّل `YOUR-DOMAIN` في `robots.txt` و `sitemap.xml`.

## 4) مراجعة مهمة قبل الإطلاق
- **الأسعار تقديرية** بالجنيه المصري (لم أتحقق منها من متاجر حية). راجعها من لوحة الأدمن.
- المنتجات المعلّمة ⚠ في الأدمن (`needsReview`) صورها لا تُظهر الموديل بوضوح، تأكد من الاسم والمواصفات.
- مواصفات المنتجات مبنية على الموديل الظاهر في الصورة، راجع الموديلات المتشابهة.
- آراء العملاء في الصفحة الرئيسية نماذج، استبدلها بتقييمات حقيقية.
- مزودات الطاقة (9 منتجات p178–p186) مضافة؛ الأسعار من CompuMarts مصر لـ TUF 850W وROG Thor 1000W وMEG Ai1300P، والباقي تقديري ومعلّم ⚠ للمراجعة. راجع القدرة/الموديل لـ FSP وbe quiet! وMSI قبل الإطلاق.

## 5) الحسابات والمقارنة (جديد)
- فعّل في Firebase: Authentication ← Email/Password **و Google**، وأضف نطاق موقعك في Authorized domains.
- انشر القواعد: `firebase deploy --only firestore:rules,storage,functions,hosting` (القواعد الجديدة: users/wishlists/comparisons/addresses لصاحبها فقط، وصور البروفايل avatars/<uid>).
- المقارنة تُحفظ في localStorage للزائر وفي `comparisons/<uid>` للمسجّل، وتُدمج عند تسجيل الدخول.
- الدفع بفودافون كاش: الرقم في `storeDefaults.cashNumber` (أو settings في الأدمن). الطلب يبقى "غير مدفوع" حتى تضغط 💰 في الأدمن بعد وصول التحويل.
