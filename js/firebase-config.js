// ============================================================
// 🔧 ضع هنا إعدادات مشروع Firebase الخاص بك (Project settings > Your apps > Web app)
// PUT YOUR FIREBASE WEB CONFIG HERE. These values are public by design; security comes from Firestore Rules.
// ============================================================
export const firebaseConfig = {
  apiKey: "AIzaSyBfOWJaDdyWpxY3MIBAkAtNbhCTfK_6NSM",
  authDomain: "tech-zone-384a3.firebaseapp.com",
  projectId: "tech-zone-384a3",
  storageBucket: "tech-zone-384a3.firebasestorage.app",
  messagingSenderId: "652518276422",
  appId: "1:652518276422:web:aeaefbe20314008c81f947",
  measurementId: "G-V1MC4R9CM8"
};
// ============================================================
// 📞 بيانات المتجر (تظهر في الهيدر والفوتر) — STORE CONTACT INFO (also editable from admin > settings)
// ============================================================
export const storeDefaults = {
  phone: "01100984141",              // رقم الدعم
  whatsapp: "201100984141",          // واتساب بدون +
  email: "2hussa2021@gmail.com",     // الإيميل
  cashNumber: "01065630974",         // رقم فودافون كاش
  social: { tiktok: "https://www.tiktok.com/@3ashik_1", instagram: "https://www.instagram.com/hussain_20_266", facebook: "https://www.facebook.com/share/1A7tXbHZ7z/" },
  shippingFee: 80,                   // الشحن بالجنيه
  freeShippingOver: 15000            // شحن مجاني فوق هذا المبلغ
};
// ============================================================
// 👥 فريق العمل — TEAM SECTION (يظهر فوق قسم الفيدباك)
// ضع صورك في images/team/ وغيّر الأسماء هنا.
// ============================================================
export const team = [
  { name_ar: "حسين أحمد محمود", name_en: "Hussein Ahmed Mahmoud", img: "images/team/member1.jpg" }, // ← اكتبت الاسم، ضع الصورة
  { name_ar: "يوسف حسن",        name_en: "Youssef Hassan",         img: "images/team/member2.jpg" },
  { name_ar: "اسم العضو 3",     name_en: "Member 3 name",          img: "images/team/member3.jpg" }, // ← اكتب اسمك هنا
  { name_ar: "اسم العضو 4",     name_en: "Member 4 name",          img: "images/team/member4.jpg" }, // ← اكتب اسمك هنا
  { name_ar: "اسم العضو 5",     name_en: "Member 5 name",          img: "images/team/member5.jpg" }  // ← اكتب اسمك هنا
];
export const doctor = { name_ar: "سعيد نظمي", name_en: "Saeed Nazmy", img: "images/team/doctor.jpg" }; // ← صورة الدكتور
