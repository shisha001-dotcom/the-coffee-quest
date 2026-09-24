/* ══════════════════════════════════════════════
   ADMIN AUTH — admin/core/dashboard-auth.js
   ─────────────────────────────────────────────
   VAI TRÒ
   Đây là "cổng vào" DUY NHẤT của Admin Dashboard. Trình tự:
     1. Tạo Supabase client (biến toàn cục `client`).
     2. Kiểm tra session Supabase Auth → không có thì về login.html.
     3. Tra hồ sơ trong bảng `admin_users` (qua cột auth_user_id)
        → không có hồ sơ / bị vô hiệu hoá thì đăng xuất + về login.html.
     4. Gán `currentSession` (role, tên hiển thị...) cho mọi module dùng.
     5. Chèn thanh người dùng (avatar + tên + nút đăng xuất) vào sidebar.
     6. TỰ TẢI toàn bộ script còn lại của Dashboard bằng JavaScript
        (xem SCRIPT_SEQUENCE / MODULE_SEQUENCE / FINAL_SCRIPT bên dưới).

   VÌ SAO TỰ TẢI SCRIPT BẰNG JS (không khai báo <script> trong HTML)?
   - Script thường (<script src>) chạy NGAY khi trình duyệt gặp nó,
     còn bước xác thực ở trên là bất đồng bộ (async). Nếu các module
     nằm sẵn trong HTML thì chúng chạy TRƯỚC khi `client` /
     `currentSession` được gán → lỗi "client is undefined".
   - Script type="module" lại bị hoãn tới khi HTML parse xong, nên
     không thể dùng nó để "gác cổng" cho script thường phía sau.
   → Giải pháp: chỉ xác thực xong mới nạp các module.

   ⚠️ QUY TẮC KHI SỬA:
   - admin/dashboard.html chỉ được có các <script> hạ tầng + đúng 1
     dòng <script src="./core/dashboard-auth.js">. KHÔNG thêm <script>
     nào khác phía sau nó.
   - Muốn thêm 1 file JS mới cho Admin → thêm đường dẫn vào
     SCRIPT_SEQUENCE (cần biến toàn cục kiểu classic script) hoặc
     MODULE_SEQUENCE (dùng import / muốn cô lập scope) ở dưới.
   ══════════════════════════════════════════════ */

/* `client` (Supabase) và `currentSession` (thông tin người đăng nhập)
   được khai báo `let` Ở NGOÀI CÙNG file (không bọc trong function).
   Nhờ vậy mọi classic script nạp SAU có thể dùng thẳng tên `client`
   / `currentSession` như biến toàn cục (không cần `window.` phía trước). */
let client;
let currentSession;

/* ══════════════════════════════════════════════
   DANH SÁCH SCRIPT CLASSIC — nạp TUẦN TỰ
   ─────────────────────────────────────────────
   File sau chỉ bắt đầu tải khi file trước đã chạy xong phần code
   đồng bộ ở top-level (nhưng KHÔNG chờ các fetch/Promise bên
   trong file đó, ví dụ loadGames()). Thứ tự dưới đây là thứ tự
   PHỤ THUỘC — đổi chỗ sẽ gây lỗi "X is not defined":

   - page-registry       → tạo window.AdminDashboard (mọi module cần)
   - inventory-shared    → tạo window.Inventory (drinks/orders/ingredients/settings cần)
   - games               → inject #gameModal; khai báo games, isGamesReadOnly,
                           parseLines, parseImages, setLines, setImages
   - drinks              → cần window.Inventory
   - game-detail         → cần các biến/hàm của dashboard-games.js ở trên
   - membership-shared   → tạo window.Membership (4 file membership + orders cần)
   - customers / customer-detail / quests / levels → domain Khách hàng
   - orders              → cần window.Membership + window.Inventory
   - ingredients         → trang Kho nguyên liệu (cần window.Inventory)
   - inventory-count     → trang Kiểm kê + tạo window.Branches
                           (settings-warehouses và ingredients dùng lại)
   - settings-shared     → dựng khung trang Settings; PHẢI đứng trước 3 file
                           settings-* phía sau vì chúng cần các div
                           #stTabWarehouses / #stTabProducts / #stTabRecipes
   - settings-warehouses → cần window.Branches
   - settings-products   → cần window.Inventory
   - settings-recipes    → cần window.editDrink (từ dashboard-drinks.js)
   - nav                 → showDashboard / showBoardgames / showDrinks
   - mobile-tables       → chỉ thao tác DOM, không phụ thuộc gì, đặt vị trí nào cũng được
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
  "./modules/inventory/dashboard-inventory-count.js",
  "./modules/settings/settings-shared.js",
  "./modules/settings/dashboard-settings-warehouses.js",
  "./modules/settings/dashboard-settings-products.js",
  "./modules/settings/dashboard-settings-recipes.js",
  "./core/dashboard-nav.js",
  "./dashboard-mobile-tables.js",
];

/* ══════════════════════════════════════════════
   DANH SÁCH MODULE ES (type="module")
   ─────────────────────────────────────────────
   Chèn cùng lúc (không cần đúng thứ tự giữa chúng) nhưng luôn SAU
   khi toàn bộ SCRIPT_SEQUENCE đã chạy xong, vì chúng cần
   window.AdminDashboard, window.AdminPermissions, currentSession...
   Module ES có scope riêng nên biến top-level trong các file này
   KHÔNG lộ ra ngoài (khác với SCRIPT_SEQUENCE).
   ══════════════════════════════════════════════ */
const MODULE_SEQUENCE = [
  "./modules/chat/dashboard-chat.js",
  "./modules/analytics/dashboard-analytics.js",
  "./modules/banners/dashboard-banners.js",
  "./modules/media/dashboard-media.js",
  /* Module "Quản lý tài khoản" đang được TẮT (comment dòng dưới).
     Lý do: nút "+ Thêm tài khoản" chỉ ghi vào admin_users mà không
     tạo user Supabase Auth → tài khoản tạo ra không đăng nhập được.
     Muốn bật lại: bỏ dấu // ở đầu dòng VÀ đổi `guard: () => false`
     trong dashboard-accounts.js thành điều kiện quyền phù hợp. */
  //"./modules/accounts/dashboard-accounts.js",//
];

/* Script nạp CUỐI CÙNG — chỉ cần .sidebar đã có trong DOM (luôn đúng
   vào thời điểm này). Xử lý đóng/mở menu dạng drawer trên mobile. */
const FINAL_SCRIPT = "./dashboard-mobile-menu.js";

/* ══════════════════════════════════════════════
   NẠP SCRIPT TUẦN TỰ
   ─────────────────────────────────────────────
   Tạo thẻ <script> cho paths[index]; khi onload xong mới tải file
   kế tiếp (nối chuỗi bằng callback để giữ đúng thứ tự — script
   chèn động mặc định chạy bất đồng bộ nên KHÔNG tự đảm bảo thứ tự).
   Nếu 1 file lỗi (404, mạng...) chỉ ghi console.error rồi vẫn tải
   tiếp file sau → 1 module hỏng không làm sập cả Dashboard, nhưng
   tính năng của module đó sẽ vắng mặt mà không có thông báo cho
   người dùng (chỉ thấy trong Console).
   ══════════════════════════════════════════════ */
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

/* Trình tự tổng: SCRIPT_SEQUENCE → MODULE_SEQUENCE → FINAL_SCRIPT */
function loadRemainingDashboardScripts() {
  loadScriptsSequentially(SCRIPT_SEQUENCE, 0, () => {
    MODULE_SEQUENCE.forEach(src => {
      const s = document.createElement("script");
      s.type = "module";
      s.src = src;
      document.body.appendChild(s);
    });

    const s = document.createElement("script");
    s.src = FINAL_SCRIPT;
    document.body.appendChild(s);
  });
}

/* Đăng xuất: huỷ session Supabase rồi về trang login
   (chạy về login kể cả khi signOut báo lỗi nhờ .finally). */
function logout() {
  client.auth.signOut().finally(() => location.replace("login.html"));
}

/* ══════════════════════════════════════════════
   USER BAR — thanh người dùng ở đáy sidebar
   ─────────────────────────────────────────────
   Vì HTML nằm trong template string (không chèn được comment vào
   giữa), bảng tra "chỗ nào chỉnh gì" ở đây:

   ► Khung ngoài (userBar.style.cssText)
       margin-top:auto        → đẩy thanh xuống đáy sidebar
       border-top             → viền trên rgba(255,255,255,.08) (trắng mờ, hợp nền sidebar tối)
       padding                → 16px (trên/dưới) × 20px (trái/phải)
       gap                    → 12px khoảng cách avatar ↔ tên ↔ nút
   ► Avatar tròn: 38×38px, chữ cái đầu 16px đậm (700), chữ trắng #fff,
       nền = MÀU CỦA ROLE (lấy từ ROLES trong core/dashboard-permissions.js,
       KHÔNG đổi ở đây)
   ► Tên hiển thị: 13px, đậm 600, trắng #fff; quá dài thì cắt "…"
   ► Nhãn role (badge): 10px, đậm 700, trắng #fff, nền = màu role,
       padding 2px 8px, bo tròn 20px, giãn chữ .4px
   ► Nút đăng xuất (icon ⏏): 32×32px, bo 8px, icon 16px
       - bình thường: nền rgba(255,255,255,.08), icon xám xanh #a0a8c0
       - khi rê chuột: nền rgba(225,112,85,.25) + icon #e17055 (đỏ cam,
         cùng màu --danger trong dashboard.css)
       - tooltip: chữ "Đăng xuất" (thuộc tính title)
   ► Hộp thoại xác nhận: chữ "Bạn muốn đăng xuất?" (dòng confirm bên dưới)
       ⚠️ Đang dùng confirm() của trình duyệt — chưa đồng bộ với quy ước
       dự án (window.showConfirm). Đổi khi được phép sửa code.
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
   MAIN — IIFE async chạy ngay khi file được nạp
   ─────────────────────────────────────────────
   `supabase` (global) do thẻ CDN supabase-js trong dashboard.html cung
   cấp — phải nằm TRƯỚC thẻ <script> của file này.
   Các URL/khoá lấy từ window.APP_CONFIG (js/shared-config.js).
   Trang đích khi chưa đăng nhập / bị chặn: "login.html".
   ══════════════════════════════════════════════ */
(async function initAuth() {
  client = supabase.createClient(
    window.APP_CONFIG.supabaseUrl,
    window.APP_CONFIG.supabaseKey
  );

  /* Bước 1: có session Supabase Auth chưa? Chưa → về trang đăng nhập */
  const { data: { session } } = await client.auth.getSession();

  if (!session) {
    location.replace("login.html");
    return;
  }

  /* Bước 2: map user Auth → hồ sơ nhân viên trong admin_users.
     Không có hồ sơ, lỗi truy vấn, hoặc is_active=false → đăng xuất. */
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

  /* Bước 3: dữ liệu phiên dùng chung cho mọi module.
     role là 1 trong "superadmin" | "editor" | "barstaff"
     (định nghĩa ở core/dashboard-permissions.js). */
  currentSession = {
    id:          profile.id,
    username:    profile.username || session.user.email,
    displayName: profile.display_name || session.user.email,
    role:        profile.role,
    authUserId:  session.user.id,
    email:       session.user.email,
  };

  /* Nếu phiên bị huỷ ở nơi khác (hết hạn token, đăng xuất tab khác...)
     → tự về trang đăng nhập. */
  client.auth.onAuthStateChange((event) => {
    if (event === "SIGNED_OUT") location.replace("login.html");
  });

  injectUserBar();

  /* Xác thực xong → mới nạp phần còn lại của Dashboard */
  loadRemainingDashboardScripts();

  /* Kiểm tra lại is_active ĐÚNG 1 LẦN sau khi đã khởi động (phòng trường
     hợp tài khoản vừa bị vô hiệu hoá giữa lúc tải trang). Không chặn
     việc nạp script. Nếu bị vô hiệu hoá → hiện toast + đăng xuất sau
     1200ms. Toast: chữ "🚫 Tài khoản của bạn đã bị vô hiệu hoá — đang
     đăng xuất...", nền #e17055 (đỏ cam). */
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
