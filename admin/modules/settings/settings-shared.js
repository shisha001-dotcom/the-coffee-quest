/* ══════════════════════════════════════════════
   SETTINGS SHARED — admin/modules/settings/settings-shared.js
   ─────────────────────────────────────────────
   ⚠️ TÁCH RA từ admin/modules/dashboard-settings.js (file gốc đã
   bị xoá). File này CHỈ còn lo phần khung chung của trang Settings:
     - Claim lại link "⚙️ Settings" tĩnh có sẵn trong dashboard.html
     - registerPage() + onShow (gọi qua các hook do 3 module con tự
       đăng ký vào window.SettingsTabs.onShowHandlers)
     - Inject KHUNG trang: page-header + 3 nút tab + 3 div rỗng
       (#stTabWarehouses / #stTabProducts / #stTabRecipes) — nội
       dung bên trong mỗi div do đúng module con của tab đó tự
       inject vào khi file nó chạy (ngay sau file này trong
       SCRIPT_SEQUENCE).
     - switchSettingsTab(tab) — dùng chung bởi cả 3 module con.

   ⚠️ PHẢI load TRƯỚC 3 file:
     dashboard-settings-warehouses.js
     dashboard-settings-products.js
     dashboard-settings-recipes.js
   vì các file đó cần #stTabWarehouses/#stTabProducts/#stTabRecipes
   đã tồn tại trong DOM để appendChild/innerHTML vào.

   isSettingsReadOnly khai báo ở đây bằng `const` — vì đây là các
   classic script (không phải module) chạy chung 1 global scope,
   3 file con phía sau tham chiếu thẳng biến này bằng tên, không
   cần window. prefix (giống cách isGamesReadOnly dùng chung giữa
   dashboard-games.js và dashboard-game-detail.js).

   Cần: client, currentSession, window.AdminDashboard,
   window.AdminPermissions.
   ══════════════════════════════════════════════ */

const isSettingsReadOnly = window.AdminPermissions.isReadOnly(currentSession.role);
let stActiveTab = "warehouses";

/* Nơi 3 module con (Kho/Sản phẩm/Công thức) đăng ký hàm load của
   riêng tab đó — onShow() của registerPage() bên dưới sẽ gọi lại
   đúng các hàm này, giữ nguyên hành vi cũ (Kho + Sản phẩm luôn tải
   lại mỗi khi vào trang Settings; Công thức chỉ tải khi đang đứng
   ở đúng tab đó). */
window.SettingsTabs = window.SettingsTabs || { onShowHandlers: {} };

/* ── Gắn id vào link "⚙️ Settings" tĩnh có sẵn để registerPage()
   nâng cấp TẠI CHỖ (đúng vị trí cũ trong sidebar) thay vì tạo thêm
   1 mục mới chồng lên nó. KHÔNG cần sửa admin/dashboard.html. ── */
(function claimSettingsPlaceholder() {
  if (document.getElementById("settingsMenuItemPlaceholder")) return;
  for (const g of document.querySelectorAll(".menu-group")) {
    const item = [...g.querySelectorAll(".menu-item")].find(el => el.textContent.includes("Settings"));
    if (item) { item.id = "settingsMenuItemPlaceholder"; return; }
  }
})();

window.AdminDashboard.registerPage({
  pageId: "settingsPage",
  menuId: "settingsMenuItem",
  placeholderId: "settingsMenuItemPlaceholder",
  icon: "⚙️",
  label: "Settings",
  group: 1,
  onShow: () => {
    window.SettingsTabs.onShowHandlers.warehouses?.();
    window.SettingsTabs.onShowHandlers.products?.();
    if (stActiveTab === "recipes") window.SettingsTabs.onShowHandlers.recipes?.();
  },
});

/* ══════════════════════════════════════════════
   INJECT KHUNG TRANG (chỉ tab bar + 3 div rỗng — nội dung bên
   trong do 3 module con tự inject)
   ══════════════════════════════════════════════ */
(function injectSettingsPageSkeleton() {
  const main = document.querySelector(".main-content");
  if (!main || document.getElementById("settingsPage")) return;

  const page = document.createElement("div");
  page.id = "settingsPage";
  page.style.display = "none";
  page.innerHTML = `
    <div class="page-header">
      <div>
        <h1 class="page-title">⚙️ Settings</h1>
        <p class="page-subtitle">Khai báo kho, sản phẩm (nguyên liệu &amp; thành phẩm) &amp; xem tổng hợp công thức pha chế</p>
      </div>
    </div>

    <div style="display:flex;gap:8px;margin-bottom:20px;flex-wrap:wrap;">
      <button class="btn btn-primary st-tab-btn"   data-tab="warehouses" id="stTabBtnWarehouses">🏬 Kho</button>
      <button class="btn btn-secondary st-tab-btn" data-tab="products"   id="stTabBtnProducts">📦 Sản phẩm</button>
      <button class="btn btn-secondary st-tab-btn" data-tab="recipes"    id="stTabBtnRecipes">🧪 Công thức</button>
    </div>

    <div id="stTabWarehouses"></div>
    <div id="stTabProducts" style="display:none;"></div>
    <div id="stTabRecipes" style="display:none;"></div>
  `;
  main.appendChild(page);

  document.querySelectorAll(".st-tab-btn").forEach(btn =>
    btn.addEventListener("click", () => switchSettingsTab(btn.dataset.tab))
  );
})();

/* ══════════════════════════════════════════════
   SWITCH TAB — dùng chung bởi cả 3 module con
   ══════════════════════════════════════════════ */
function switchSettingsTab(tab) {
  stActiveTab = tab;
  document.querySelectorAll(".st-tab-btn").forEach(b => {
    const active = b.dataset.tab === tab;
    b.classList.toggle("btn-primary", active);
    b.classList.toggle("btn-secondary", !active);
  });
  document.getElementById("stTabWarehouses").style.display = tab === "warehouses" ? "" : "none";
  document.getElementById("stTabProducts").style.display   = tab === "products"   ? "" : "none";
  document.getElementById("stTabRecipes").style.display    = tab === "recipes"    ? "" : "none";
  if (tab === "recipes") window.SettingsTabs.onShowHandlers.recipes?.();
}
window.switchSettingsTab = switchSettingsTab;
