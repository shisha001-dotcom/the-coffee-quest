/* ══════════════════════════════════════════════
   ADMIN AUTH — admin/core/dashboard-auth.js
   ─────────────────────────────────────────────
   TRƯỚC ĐÂY: nằm lẫn ở đầu admin/dashboard.js cùng với
   toàn bộ CRUD game — khiến file đó vừa lo auth vừa lo
   nghiệp vụ, khó đọc.

   BÂY GIỜ: file này CHỈ lo 1 việc — xác thực phiên đăng
   nhập + tạo Supabase client dùng chung + user bar.

   ⚠️ MỚI (migration V3): thêm verifyStillActive() — session lưu
   trong sessionStorage vẫn còn hiệu lực cho tới khi đóng tab/đăng
   xuất, kể cả khi Super Admin vừa vô hiệu hoá tài khoản đó ở tab
   khác. Hàm này kiểm tra lại is_active ngay sau khi Dashboard tải
   xong và TỰ ĐỘNG đăng xuất nếu tài khoản đã bị vô hiệu hoá —
   tránh trường hợp nhân viên đã nghỉ việc vẫn thao tác được tiếp
   cho tới khi tự đóng trình duyệt.

   Khai báo `client` và `currentSession` bằng const ở top-level
   của 1 <script> thường (không phải type="module") để các
   script/module admin khác load SAU đều đọc được qua global
   scope, giống hệt cơ chế cũ — KHÔNG cần import/export.

   ⚠️ Bắt buộc load ĐẦU TIÊN trong các script admin (chỉ sau
      shared-config.js, shared-emoji.js, shared-utils.js,
      core/dashboard-permissions.js và Supabase SDK CDN).
   ══════════════════════════════════════════════ */

const SESSION_KEY = "bg_admin_session";

function getSession() {
  try { return JSON.parse(sessionStorage.getItem(SESSION_KEY)); }
  catch { return null; }
}

function requireAuth() {
  const session = getSession();
  if (!session?.username) {
    sessionStorage.removeItem(SESSION_KEY);
    location.replace("login.html");
    throw new Error("Unauthenticated");
  }
  return session;
}

function logout() {
  sessionStorage.removeItem(SESSION_KEY);
  location.replace("login.html");
}

/* Toàn cục — mọi module admin (kể cả type="module") đọc qua
   global scope, y hệt cơ chế trong bản gốc. */
const currentSession = requireAuth();

const client = supabase.createClient(
  window.APP_CONFIG.supabaseUrl,
  window.APP_CONFIG.supabaseKey
);

/* ══════════════════════════════════════════════
   ⚠️ MỚI (migration V3): TỰ ĐĂNG XUẤT NẾU TÀI KHOẢN VỪA BỊ
   VÔ HIỆU HOÁ TRONG LÚC PHIÊN ĐANG MỞ
   ══════════════════════════════════════════════ */
(async function verifyStillActive() {
  try {
    const { data, error } = await client
      .from("admin_users")
      .select("is_active")
      .eq("id", currentSession.id)
      .single();
    if (!error && data && data.is_active === false) {
      window.showToast?.("🚫 Tài khoản của bạn đã bị vô hiệu hoá — đang đăng xuất...", "#e17055");
      setTimeout(logout, 1200);
    }
  } catch (err) {
    console.warn("[dashboard-auth] verifyStillActive:", err.message);
  }
})();

/* ══════════════════════════════════════════════
   USER BAR — chèn vào cuối sidebar
   ══════════════════════════════════════════════ */
(function injectUserBar() {
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
})();
