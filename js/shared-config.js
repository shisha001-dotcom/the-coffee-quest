/* ══════════════════════════════════════════════
   SHARED CONFIG — js/shared-config.js
   ─────────────────────────────────────────────
   Nơi DUY NHẤT chứa Supabase URL/Key và Firebase config.
   Mọi file khác (data.js, app.js, chat.js, admin/*.js)
   đều đọc từ window.APP_CONFIG — KHÔNG hardcode lại.

   ⚠️ Phải load file này TRƯỚC mọi script khác
      (đặt <script> đầu tiên trong <head> hoặc đầu <body>).

   File này là plain script (KHÔNG type="module") nên
   cả script thường và script module (chạy sau khi parse
   xong HTML) đều đọc được window.APP_CONFIG.
   ══════════════════════════════════════════════ */

window.APP_CONFIG = Object.freeze({

  /* ── SUPABASE ──
     Dùng cho: js/data.js, admin/dashboard.js, admin/login.html */
  supabaseUrl: "https://dklfwlgpomnrmxmbjpat.supabase.co",
  supabaseKey:
    "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImRrbGZ3bGdwb21ucm14bWJqcGF0Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3Nzg1MDQ5MDAsImV4cCI6MjA5NDA4MDkwMH0.sy8zDIdh9RBhl9TOqg6PnfTehqtV7VcFQSaSPoc4MoI",

  /* ── FIREBASE ──
     Dùng cho: js/chat.js, admin/dashboard-chat.js, admin/dashboard-analytics.js */
  firebaseConfig: Object.freeze({
    apiKey:            "AIzaSyBIn1bj6ndt8Yy5AiPFdeKtI5MrZnaNugc",
    authDomain:        "doublevcute.firebaseapp.com",
    databaseURL:       "https://doublevcute-default-rtdb.asia-southeast1.firebasedatabase.app",
    projectId:         "doublevcute",
    storageBucket:     "doublevcute.firebasestorage.app",
    messagingSenderId: "31483876077",
    appId:             "1:31483876077:web:f2efbb34d8a2c6dcb532e4",
    measurementId:     "G-EKGL5TN6NY",
  }),

});
