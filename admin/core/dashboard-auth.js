/* ══════════════════════════════════════════════
   ADMIN AUTH — admin/core/dashboard-auth.js
   ─────────────────────────────────────────────
   ⚠️ SỬA LẦN 2 (2026-07-18): bỏ hẳn cách dùng 1 script riêng
   type="module" để "gác cổng" (auth gate) đặt TRƯỚC file này.

   LÝ DO: <script type="module"> được trình duyệt xử lý như
   "deferred" — nó chỉ thực thi SAU KHI toàn bộ HTML đã parse
   xong. Trong khi đó <script src="..."> THƯỜNG (không có
   defer/async) lại thực thi NGAY LẬP TỨC khi trình duyệt gặp
   nó trong lúc parse. Vì vậy dù đặt script module TRƯỚC
   dashboard-auth.js trong file HTML, dashboard-auth.js (script
   thường) vẫn chạy TRƯỚC khi module kịp gán window.__authSession
   → luôn thấy "chưa xác thực" → redirect login.html ngay lập
   tức → gây vòng lặp nhấp nháy login ⇄ dashboard.

   CÁCH SỬA: gộp toàn bộ việc (1) tạo client, (2) kiểm tra
   session Supabase Auth, (3) lấy hồ sơ admin_users, và (4) TỰ
   TẢI các <script> còn lại của Dashboard bằng JavaScript
   (createElement + appendChild theo đúng thứ tự tuần tự) — chỉ
   sau khi xác thực xong. Nhờ vậy không còn phụ thuộc vào việc
   trình duyệt tự sắp thứ tự thực thi giữa module và script
   thường nữa; toàn bộ nằm trong 1 luồng JS do chính ta điều
   khiển.

   ⚠️ QUAN TRỌNG: vì vậy, `admin/dashboard.html` giờ CHỈ còn cần
   các <script> "hạ tầng" (shared-config, shared-emoji, shared-
   categories, shared-utils, dashboard-permissions, Supabase SDK,
   QRCode SDK) và DUY NHẤT 1 dòng
   <script src="./core/dashboard-auth.js"></script> — KHÔNG còn
   bất kỳ <script> nào khác phía sau nó trong HTML nữa. Toàn bộ
   phần còn lại (page-registry, inventory, games, drinks,
   membership, orders, nav, chat, analytics, banners, media,
   accounts, mobile-menu) được chính file này tải bằng JS theo
   đúng thứ tự cũ (xem SCRIPT_SEQUENCE / MODULE_SEQUENCE bên dưới).

   ⚠️ SỬA (bổ sung — fix "Đơn hàng" không hoạt động + nút "Chi tiết"
   khách hàng không mở được trang): SCRIPT_SEQUENCE trước đây bị
   THIẾU "./modules/orders/dashboard-orders.js" và
   "./modules/membership/dashboard-customer-detail.js" — đã bổ sung
   lại đúng vị trí bên dưới.
   ══════════════════════════════════════════════ */

/* Khai báo ở scope ngoài cùng (không bọc trong function) để các
   <script> thường load SAU (được tự động chèn bên dưới) vẫn đọc
   được `client` / `currentSession` như 1 biến toàn cục — giữ
   đúng "hợp đồng" (contract) cũ mà mọi module admin đang dựa vào. */
let client;
let currentSession;

/* ══════════════════════════════════════════════
   DANH SÁCH SCRIPT CẦN TẢI TIẾP — ĐÚNG THỨ TỰ CŨ
   ══════════════════════════════════════════════ */
const SCRIPT_SEQUENCE = [
  "./core/dashboard-page-registry.js",

  "./modules/inventory/inventory-shared.js",

  "./modules/games/dashboard-games.js",
  "./modules/drinks/dashboard-drinks.js",
  "./modules/games/dashboard-game-detail.js",

  "./modules/membership/membership-shared.js",
  "./modules/membership/dashboard-customers.js",
  "./modules/membership/dashboard-customer-detail.js",
  "./modules/membership/dashboard-quests.js",
  "./modules/membership/dashboard-levels.js",

  "./modules/orders/dashboard-orders.js",

  "./modules/inventory/dashboard-ingredients.js",

  "./core/dashboard-nav.js",
];

/* Các module ES (type="module") — không bắt buộc thứ tự nghiêm
   ngặt với nhau, nhưng phải load SAU toàn bộ SCRIPT_SEQUENCE ở
   trên (vì chúng cần window.AdminDashboard, currentSession...) */
const MODULE_SEQUENCE = [
  "./modules/chat/dashboard-chat.js",
  "./modules/analytics/dashboard-analytics.js",
  "./modules/banners/dashboard-banners.js",
  "./modules/media/dashboard-media.js",
  "./modules/accounts/dashboard-accounts.js",
];

const FINAL_SCRIPT = "./dashboard-mobile-menu.js";

function loadScriptsSequentially(paths, index, onDone) {
  if (index >= paths.length) { onDone(); return; }
  const s = document.createElement("script");
  s.src = paths[index];
  s.onload = () => loadScriptsSequentially(paths, index + 1, onDone);
  s.onerror = () => {
    console.error("[dashboard-auth] Không tải được script:", paths[index]);
    loadScriptsSequentially(paths, index + 1, onDone); // vẫn cố tải tiếp phần còn lại
  };
  document.body.appendChild(s);
}

function loadRemainingDashboardScripts() {
  loadScriptsSequentially(SCRIPT_SEQUENCE, 0, () => {
    // Module scripts — thứ tự giữa chúng không quan trọng, chèn cùng lúc
    MODULE_SEQUENCE.forEach(src => {
      const s = document.createElement("script");
      s.type = "module";
      s.src = src;
      document.body.appendChild(s);
    });

    // Cuối cùng: dashboard-mobile-menu.js (chỉ cần .sidebar đã có sẵn trong DOM — luôn đúng)
    const s = document.createElement("script");
    s.src = FINAL_SCRIPT;
    document.body.appendChild(s);
  });
}

function logout() {
  client.auth.signOut().finally(() => location.replace("login.html"));
}

/* ══════════════════════════════════════════════
   USER BAR — chèn vào cuối sidebar (giữ nguyên như cũ)
   ══════════════════════════════════════════════ */
function injectUserBar() {
  const sidebar = document.querySelector(".sidebar");
  if (!sidebar) return;

  const { label: roleLabel, color: roleBg } = window.AdminPermissions.roleInfo(currentSession.role);
  const initial     = (currentSession.displayName || "A")[0].toUpperCase();
  const displayName = currentSession.displayName || currentSession.username;

  const userBar = document.createElement("div");
  userBar.style.cssText = "margin-top:auto;border-top:1px solid rgba(255,255,255,.08);padding:16px 20px;display:flex;align-items:center;gap:12px;";
  userBar.innerHTML = `
    <div style="width:38px;height:38px;border-radius:50%;background:${roleBg};display:flex;align-items:center;justify-content:center;font-size:16px;font-weight:700;color:#fff;flex-shrink:0;">${window.escHtml(initial)}</div>
    <div style="flex:1;min-width:0;">
      <div style="font-size:13px;font-weight:600;color:#fff;white-space:nowrap;overflow:hidden;text-overflow:ellipsis">${window.escHtml(displayName)}</div>
      <div style="margin-top:4px"><span style="background:${roleBg};color:#fff;font-size:10px;font-weight:700;padding:2px 8px;border-radius:20px;letter-spacing:.4px">${window.escHtml(roleLabel)}</span></div>
    </div>
    <button id="logoutBtn" title="Đăng xuất"
      style="background:rgba(255,255,255,.08);border:none;border-radius:8px;width:32px;height:32px;cursor:pointer;color:#a0a8c0;font-size:16px;display:flex;align-items:center;justify-content:center;transition:background .2s,color .2s;flex-shrink:0;"
      onmouseover="this.style.background='rgba(225,112,85,.25)';this.style.color='#e17055'"
      onmouseout="this.style.background='rgba(255,255,255,.08)';this.style.color='#a0a8c0'">⏏</button>
  `;
  sidebar.appendChild(userBar);
  document.getElementById("logoutBtn")?.addEventListener("click", () => {
    if (confirm("Bạn muốn đăng xuất?")) logout();
  });
}

/* ══════════════════════════════════════════════
   MAIN — chạy ngay khi file load (IIFE async).
   `client`/`currentSession` được gán vào 2 biến khai báo ở
   scope ngoài cùng phía trên (không phải bên trong IIFE này),
   nên vẫn là "toàn cục" theo đúng nghĩa các script thường load
   sau có thể đọc được.
   ══════════════════════════════════════════════ */
(async function initAuth() {
  client = supabase.createClient(
    window.APP_CONFIG.supabaseUrl,
    window.APP_CONFIG.supabaseKey
  );

  const { data: { session } } = await client.auth.getSession();

  if (!session) {
    location.replace("login.html");
    return;
  }

  const { data: profile, error } = await client
    .from("admin_users")
    .select("id, username, display_name, role, is_active")
    .eq("auth_user_id", session.user.id)
    .maybeSingle();

  if (error || !profile || profile.is_active === false) {
    await client.auth.signOut();
    location.replace("login.html");
    return;
  }

  currentSession = {
    id:          profile.id,
    username:    profile.username || session.user.email,
    displayName: profile.display_name || session.user.email,
    role:        profile.role,
    authUserId:  session.user.id,
    email:       session.user.email,
  };

  /* Tự đăng xuất nếu tài khoản vừa bị vô hiệu hoá trong lúc phiên đang mở */
  client.auth.onAuthStateChange((event) => {
    if (event === "SIGNED_OUT") location.replace("login.html");
  });

  injectUserBar();

  /* Xác thực xong — giờ mới tải phần còn lại của Dashboard */
  loadRemainingDashboardScripts();

  /* Kiểm tra định kỳ is_active — giữ hành vi cũ, chạy sau khi
     mọi thứ đã tải xong, không chặn luồng tải script */
  try {
    const { data, error: checkErr } = await client
      .from("admin_users")
      .select("is_active")
      .eq("id", currentSession.id)
      .single();
    if (!checkErr && data && data.is_active === false) {
      window.showToast?.("🚫 Tài khoản của bạn đã bị vô hiệu hoá — đang đăng xuất...", "#e17055");
      setTimeout(logout, 1200);
    }
  } catch (err) {
    console.warn("[dashboard-auth] verifyStillActive:", err.message);
  }
})();
