/* ══════════════════════════════════════════════
   ADMIN AUTH — admin/core/dashboard-auth.js
   ─────────────────────────────────────────────
   ⚠️ ĐÃ ĐỔI (2026-07-18): chuyển từ tự quản lý session bằng
   sessionStorage + so sánh password_hash thủ công sang dùng
   THẲNG Supabase Auth (client.auth.*).

   Khác biệt so với bản trước:
   - Không còn getSession()/requireAuth() đọc sessionStorage
     "bg_admin_session" — giờ đọc qua client.auth.getSession().
   - `currentSession` giờ được build từ (a) auth.users (email,
     id) + (b) bảng admin_users (role, display_name, is_active) —
     query 1 lần lúc khởi tạo trang, y hệt logic đã làm ở
     login.html.
   - File này giờ PHẢI dùng IIFE async để "await" được việc lấy
     session TRƯỚC khi các script khác (đọc `currentSession` ở
     top-level) chạy. Vì các module admin khác (dashboard-page-
     registry.js, dashboard-games.js...) là <script> thường (không
     phải type="module") và đọc `currentSession`/`client` ngay khi
     load, ta phải chặn (block) bằng cách... KHÔNG dùng async ở
     top-level nữa mà tự vẽ 1 "màn hình chờ" rồi reload lại toàn
     bộ dashboard sau khi xác thực xong (xem giải thích bên dưới).

   ⚠️ QUAN TRỌNG — ĐỌC KỸ TRƯỚC KHI DÙNG:
   Vì toàn bộ kiến trúc admin/dashboard.html hiện tại dựa trên việc
   `client` và `currentSession` là 2 hằng số CÓ SẴN NGAY LẬP TỨC ở
   top-level (không phải Promise), mà việc lấy session Supabase Auth
   lại là bất đồng bộ (async), file này dùng chiến lược:

     1. Chạy đồng bộ: tạo `client` ngay (không cần async).
     2. Gọi `client.auth.getSession()` (bất đồng bộ) NGAY LẬP TỨC,
        nhưng chặn toàn bộ trang bằng 1 overlay "Đang xác thực..."
        cho tới khi có kết quả.
     3. Nếu có session hợp lệ → gán currentSession rồi GỠ overlay,
        cho phép các script phía sau (đã nằm chờ nhờ overlay che)
        chạy bình thường.
     4. Nếu không có session → redirect login.html ngay.

   Cách làm sạch nhất với kiến trúc nhiều <script> thường (không
   module) là dùng `document.write`-block bằng cách: kiểm tra
   session bằng XHR đồng bộ giả lập là không khả thi với Supabase
   SDK (chỉ có async), nên ta chuyển toàn bộ phần "gate" này thành
   một bước kiểm tra CHẶN TRÌNH DUYỆT bằng cách tạm dừng parser:
   dùng `await` trong 1 <script type="module"> RIÊNG đặt TRƯỚC file
   này trong dashboard.html để lấy session, lưu tạm vào
   `window.__authSession`, rồi file dashboard-auth.js (script
   thường) đọc lại biến đó — xem HƯỚNG DẪN SỬA dashboard.html bên
   dưới cùng file này.
   ══════════════════════════════════════════════ */

const client = supabase.createClient(
  window.APP_CONFIG.supabaseUrl,
  window.APP_CONFIG.supabaseKey
);

/* `window.__authSession` phải được set TRƯỚC khi file này chạy —
   xem <script type="module"> cần thêm vào dashboard.html (mục
   HƯỚNG DẪN SỬA dashboard.html ở cuối file). Nếu vì lý do gì đó
   biến này chưa có (thiếu script "auth-gate"), coi như chưa đăng
   nhập và đá về login.html để an toàn. */
if (!window.__authSession || !window.__authSession.profile) {
  sessionStorage.clear();
  location.replace("login.html");
  throw new Error("Unauthenticated");
}

/* Toàn cục — mọi module admin (kể cả type="module") đọc qua
   global scope, giữ đúng contract cũ (`client`, `currentSession`). */
const currentSession = {
  id:          window.__authSession.profile.id,
  username:    window.__authSession.profile.username || window.__authSession.user.email,
  displayName: window.__authSession.profile.display_name || window.__authSession.user.email,
  role:        window.__authSession.profile.role,
  authUserId:  window.__authSession.user.id,
  email:       window.__authSession.user.email,
};

function logout() {
  client.auth.signOut().finally(() => location.replace("login.html"));
}

/* ══════════════════════════════════════════════
   ⚠️ TỰ ĐĂNG XUẤT NẾU TÀI KHOẢN VỪA BỊ VÔ HIỆU HOÁ TRONG LÚC
   PHIÊN ĐANG MỞ (giữ nguyên hành vi cũ, chỉ đổi nguồn session)
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
   AUTO SIGN-OUT KHI SESSION SUPABASE HẾT HẠN / BỊ THU HỒI
   (vd token hết hạn, bị revoke ở tab khác) — Supabase tự bắn
   sự kiện SIGNED_OUT / TOKEN_REFRESHED qua onAuthStateChange.
   ══════════════════════════════════════════════ */
client.auth.onAuthStateChange((event) => {
  if (event === "SIGNED_OUT") {
    location.replace("login.html");
  }
});

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

/* ══════════════════════════════════════════════════════════════════
   HƯỚNG DẪN SỬA admin/dashboard.html — BẮT BUỘC, KHÔNG THÌ FILE
   NÀY SẼ LUÔN ĐÁ VỀ LOGIN.HTML (vì window.__authSession không tồn tại)
   ─────────────────────────────────────────────────────────────────
   Thêm ĐOẠN SCRIPT SAU vào dashboard.html, đặt TRƯỚC dòng
   <script src="./core/dashboard-auth.js"></script> (nhưng SAU
   shared-config.js và sau <script src=".../supabase-js@2">):

   <script type="module">
     const { createClient } = supabase; // dùng lại global `supabase` từ CDN UMD build
     // Lưu ý: bản CDN @supabase/supabase-js@2 expose global `supabase`,
     // nên KHÔNG cần import lại — chỉ cần tạo client 1 lần dùng chung.
     const _client = window.supabase.createClient(
       window.APP_CONFIG.supabaseUrl,
       window.APP_CONFIG.supabaseKey
     );

     const { data: { session } } = await _client.auth.getSession();

     if (!session) {
       location.replace("login.html");
     } else {
       const { data: profile, error } = await _client
         .from("admin_users")
         .select("id, username, display_name, role, is_active")
         .eq("auth_user_id", session.user.id)
         .maybeSingle();

       if (error || !profile || profile.is_active === false) {
         await _client.auth.signOut();
         location.replace("login.html");
       } else {
         window.__authSession = { user: session.user, profile };
       }
     }
   </script>

   Script này PHẢI dùng type="module" để được phép "await" ở
   top-level (top-level await chỉ hợp lệ trong module) — điều đó
   khiến trình duyệt tự động CHỜ nó chạy xong (bao gồm cả await
   bên trong) trước khi thực thi các <script> thường phía sau
   trong cùng luồng parse HTML, nên `dashboard-auth.js` phía sau
   luôn thấy `window.__authSession` đã sẵn sàng (hoặc trang đã bị
   redirect trước đó rồi).
   ══════════════════════════════════════════════════════════════════ */
