/* ══════════════════════════════════════════════
   DASHBOARD SETTINGS — admin/modules/settings/dashboard-settings.js
   ─────────────────────────────────────────────
   MỚI. Biến mục "⚙️ Settings" (trước đây là link tĩnh, chưa gắn
   chức năng gì — chỉ dùng làm điểm neo mặc định cho registerPage())
   thành 1 trang thật, 3 tab:

     🏬 Kho       — CRUD bảng `branches` (mã kho, tên kho, trạng
                    thái). Bảng này ĐÃ CÓ SẴN (dùng bởi "📋 Kiểm kê
                    tồn kho") nhưng trước giờ CHƯA có màn hình tạo/
                    sửa — chỉ đọc qua window.Branches.loadBranches().
                    Lưu ở đây tự refresh lại window.Branches để
                    "Kiểm kê tồn kho" thấy ngay kho mới (trước đây
                    branches trống thì tính năng đó không tạo phiếu
                    được vì không có kho nào để chọn).

     📦 Sản phẩm  — vẫn là bảng `ingredients` NHƯ CŨ (không tạo bảng
                    mới), chỉ bổ sung mã sản phẩm, quy cách, và quy
                    đổi đóng gói (VD: 1 Hộp = 500 g) — 4 cột mới:
                    code/spec/package_qty/package_unit. Ghi/đọc qua
                    window.Inventory nên đồng bộ 100% với "📦 Kho
                    nguyên liệu" (nhập/điều chỉnh tồn kho vẫn thao
                    tác ở trang đó như cũ) và công thức pha chế bên
                    "☕ Đồ uống".

     🧪 Công thức — bảng tổng hợp toàn bộ đồ uống + số nguyên liệu +
                    giá vốn/lợi nhuận, bấm "✏️ Sửa công thức" mở
                    ĐÚNG modal công thức có sẵn ở trang "☕ Đồ uống"
                    (window.editDrink()) — KHÔNG xây lại UI công
                    thức lần 2 để tránh 2 nơi lệch dữ liệu. Đã kiểm
                    tra logic tính giá thành hiện tại
                    (qty_per_serving × conversion_rate × unit_cost
                    trong INV.computeRecipeCost()) — ĐÚNG, giữ
                    nguyên. Chỉ cải thiện UX chọn nguyên liệu trong
                    dashboard-drinks.js để tự tính hệ số quy đổi từ
                    quy cách đóng gói khai báo ở tab Sản phẩm.

   ⚠️ SQL CẦN CHẠY TRƯỚC (Supabase SQL Editor, 1 lần) — xem file
      migration.sql đi kèm. Chỉ ALTER TABLE ADD COLUMN IF NOT EXISTS,
      KHÔNG tạo bảng mới.

   ⚠️ Load SAU: core/dashboard-page-registry.js,
      modules/drinks/dashboard-drinks.js (window.editDrink),
      modules/inventory/inventory-shared.js (window.Inventory),
      modules/inventory/dashboard-inventory-count.js (window.Branches).
      Xem admin/core/dashboard-auth.js::SCRIPT_SEQUENCE.

   Cần: client, currentSession, window.AdminDashboard,
   window.AdminPermissions, window.Inventory, window.Branches,
   window.escHtml / showToast / showConfirm / showReasonPrompt /
   debounce / clearFieldError / showFieldError (shared-utils.js).
   ══════════════════════════════════════════════ */

const isSettingsReadOnly = window.AdminPermissions.isReadOnly(currentSession.role);
let stActiveTab = "warehouses";
let stProductSearchQ = "";

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
    loadWarehouses();
    loadProducts();
    if (stActiveTab === "recipes") loadRecipeOverview();
  },
});

/* ══════════════════════════════════════════════
   INJECT PAGE HTML
   ══════════════════════════════════════════════ */
(function injectSettingsPage() {
  const main = document.querySelector(".main-content");
  if (!main || document.getElementById("settingsPage")) return;

  const page = document.createElement("div");
  page.id = "settingsPage";
  page.style.display = "none";
  page.innerHTML = `
    <div class="page-header">
      <div>
        <h1 class="page-title">⚙️ Settings</h1>
        <p class="page-subtitle">Khai báo kho, sản phẩm &amp; xem tổng hợp công thức pha chế</p>
      </div>
    </div>

    <div style="display:flex;gap:8px;margin-bottom:20px;flex-wrap:wrap;">
      <button class="btn btn-primary st-tab-btn"   data-tab="warehouses" id="stTabBtnWarehouses">🏬 Kho</button>
      <button class="btn btn-secondary st-tab-btn" data-tab="products"   id="stTabBtnProducts">📦 Sản phẩm</button>
      <button class="btn btn-secondary st-tab-btn" data-tab="recipes"    id="stTabBtnRecipes">🧪 Công thức</button>
    </div>

    <!-- ═══ TAB: KHO ═══ -->
    <div id="stTabWarehouses">
      <div class="table-card" style="padding:20px 24px;">
        <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:16px;flex-wrap:wrap;gap:10px;">
          <div style="font-size:14px;font-weight:700;">Danh sách kho</div>
          <button class="btn btn-primary" id="whAddBtn">+ Thêm kho</button>
        </div>
        <table class="game-table">
          <thead><tr><th>Mã kho</th><th>Tên kho</th><th>Trạng thái</th><th>Hành động</th></tr></thead>
          <tbody id="whTableBody"><tr><td colspan="4" style="text-align:center;padding:30px;color:var(--text-muted);">⏳ Đang tải...</td></tr></tbody>
        </table>
      </div>
    </div>

    <!-- ═══ TAB: SẢN PHẨM ═══ -->
    <div id="stTabProducts" style="display:none;">
      <div class="search-bar"><input type="text" id="prodSearchInput" class="search-input" placeholder="🔍 Tìm theo mã hoặc tên sản phẩm..."></div>
      <div class="table-card">
        <div style="padding:16px 24px 0;display:flex;justify-content:flex-end;">
          <button class="btn btn-primary" id="prodAddBtn">+ Thêm sản phẩm</button>
        </div>
        <table class="game-table">
          <thead><tr><th>Mã</th><th>Sản phẩm</th><th>Quy cách</th><th>Đơn vị tính</th><th>Quy đổi đóng gói</th><th>Giá/đơn vị</th><th>Hành động</th></tr></thead>
          <tbody id="prodTableBody"><tr><td colspan="7" style="text-align:center;padding:30px;color:var(--text-muted);">⏳ Đang tải...</td></tr></tbody>
        </table>
      </div>
    </div>

    <!-- ═══ TAB: CÔNG THỨC ═══ -->
    <div id="stTabRecipes" style="display:none;">
      <div style="font-size:12px;color:var(--text-muted);margin-bottom:14px;">
        Tổng hợp công thức của mọi đồ uống. Bấm "✏️ Sửa công thức" để mở đúng công thức pha chế của món đó (dùng chung modal với trang ☕ Đồ uống).
      </div>
      <div class="table-card">
        <table class="game-table">
          <thead><tr><th>Đồ uống</th><th>Số nguyên liệu</th><th>Giá vốn NL/ly</th><th>Giá bán</th><th>Lợi nhuận gộp</th><th>Hành động</th></tr></thead>
          <tbody id="recipeTableBody"><tr><td colspan="6" style="text-align:center;padding:30px;color:var(--text-muted);">⏳ Đang tải...</td></tr></tbody>
        </table>
      </div>
    </div>

    <!-- ═══ MODAL: KHO ═══ -->
    <div class="modal-overlay hidden" id="warehouseModal" role="dialog" aria-modal="true" aria-labelledby="warehouseModalTitle">
      <div class="modal-box" style="max-width:420px;">
        <div class="modal-header">
          <h2 id="warehouseModalTitle">➕ Thêm kho</h2>
          <button class="close-btn" id="closeWarehouseModalBtn" aria-label="Đóng cửa sổ">✕</button>
        </div>
        <input type="hidden" id="whId">
        <div class="form-grid" style="grid-template-columns:1fr;">
          <div class="form-group"><label for="whCode">Mã kho</label><input type="text" id="whCode" placeholder="VD: KHO01"></div>
          <div class="form-group"><label for="whName">Tên kho *</label><input type="text" id="whName" placeholder="Kho trung tâm, Kho quầy bar..."></div>
          <div class="form-group" style="flex-direction:row;align-items:center;gap:8px;">
            <input type="checkbox" id="whIsActive" style="width:18px;height:18px;" checked>
            <label for="whIsActive" style="margin:0;">Đang hoạt động</label>
          </div>
        </div>
        <div class="modal-actions" style="justify-content:flex-end;">
          <button class="btn btn-primary" id="whSaveBtn">💾 Lưu</button>
        </div>
      </div>
    </div>

    <!-- ═══ MODAL: SẢN PHẨM ═══ -->
    <div class="modal-overlay hidden" id="productModal" role="dialog" aria-modal="true" aria-labelledby="productModalTitle">
      <div class="modal-box" style="max-width:540px;">
        <div class="modal-header">
          <h2 id="productModalTitle">➕ Thêm sản phẩm</h2>
          <button class="close-btn" id="closeProductModalBtn" aria-label="Đóng cửa sổ">✕</button>
        </div>
        <input type="hidden" id="prodId">
        <div class="form-grid">
          <div class="form-group"><label for="prodCode">Mã sản phẩm</label><input type="text" id="prodCode" placeholder="VD: NL001"></div>
          <div class="form-group"><label for="prodName">Tên sản phẩm *</label><input type="text" id="prodName" placeholder="Nước cam, Sữa tươi..."></div>

          <div class="form-group full-width"><label for="prodSpec">Quy cách</label><input type="text" id="prodSpec" placeholder="VD: Hộp giấy nguyên hộp"></div>

          <div class="form-group"><label for="prodUnit">Đơn vị tính *</label><input type="text" id="prodUnit" placeholder="Hộp, Can, Thùng, Chai..."></div>
          <div class="form-group"><label for="prodUnitCost">Giá / đơn vị tính (đ) *</label><input type="number" id="prodUnitCost" min="0" step="0.01" placeholder="35000"></div>

          <div class="section-divider"><span>📐 Quy đổi đóng gói</span></div>

          <div class="form-group full-width" style="flex-direction:row;align-items:center;gap:10px;flex-wrap:wrap;">
            <span style="font-size:13px;color:var(--text-muted);white-space:nowrap;">1 <b id="prodUnitEcho">đơn vị</b> &nbsp;=&nbsp;</span>
            <label for="prodPackageQty" class="visually-hidden">Số lượng đóng gói</label>
            <input type="number" id="prodPackageQty" min="0" step="0.01" placeholder="500" style="width:110px;height:44px;border:1px solid var(--border);border-radius:10px;padding:0 12px;font-size:14px;">
            <label for="prodPackageUnit" class="visually-hidden">Đơn vị đóng gói</label>
            <input type="text" id="prodPackageUnit" placeholder="g, ml, cái..." style="width:120px;height:44px;border:1px solid var(--border);border-radius:10px;padding:0 12px;font-size:14px;">
            <span id="prodCostHint" style="font-size:12px;color:var(--primary);font-weight:700;"></span>
          </div>
          <div class="full-width" style="font-size:11px;color:var(--text-muted);margin-top:-10px;">
            VD: Nước cam — 1 Hộp = 500 g → Đơn vị tính: "Hộp", số lượng đóng gói: 500, đơn vị đóng gói: "g". Để trống nếu sản phẩm dùng thẳng đơn vị tính trong công thức (không cần quy đổi).
          </div>

          <div class="form-group"><label for="prodMinStock">Ngưỡng tồn kho tối thiểu</label><input type="number" id="prodMinStock" min="0" step="0.01" placeholder="10"></div>
          <div class="form-group" style="flex-direction:row;align-items:center;gap:8px;">
            <input type="checkbox" id="prodIsActive" style="width:18px;height:18px;" checked>
            <label for="prodIsActive" style="margin:0;">Đang sử dụng</label>
          </div>
        </div>
        <div class="modal-actions">
          <button class="btn btn-danger" id="prodDeleteBtn" style="display:none;">🗑️ Ngừng dùng</button>
          <button class="btn btn-primary" id="prodSaveBtn">💾 Lưu</button>
        </div>
      </div>
    </div>
  `;
  main.appendChild(page);
  bindSettingsPageEvents();
})();

function bindSettingsPageEvents() {
  document.querySelectorAll(".st-tab-btn").forEach(btn => btn.addEventListener("click", () => switchSettingsTab(btn.dataset.tab)));

  document.getElementById("whAddBtn")?.addEventListener("click", openAddWarehouse);
  document.getElementById("closeWarehouseModalBtn")?.addEventListener("click", () => document.getElementById("warehouseModal").classList.add("hidden"));
  document.getElementById("whSaveBtn")?.addEventListener("click", saveWarehouse);

  document.getElementById("prodAddBtn")?.addEventListener("click", openAddProduct);
  document.getElementById("closeProductModalBtn")?.addEventListener("click", () => document.getElementById("productModal").classList.add("hidden"));
  document.getElementById("prodSaveBtn")?.addEventListener("click", saveProduct);
  document.getElementById("prodDeleteBtn")?.addEventListener("click", deleteProduct);
  document.getElementById("prodUnit")?.addEventListener("input", e => {
    document.getElementById("prodUnitEcho").textContent = e.target.value.trim() || "đơn vị";
  });
  ["prodUnitCost", "prodPackageQty", "prodPackageUnit"].forEach(id => {
    document.getElementById(id)?.addEventListener("input", updateProductCostHint);
  });

  document.getElementById("prodSearchInput")?.addEventListener("input", window.debounce(e => {
    stProductSearchQ = e.target.value.trim().toLowerCase();
    renderProductsTable();
  }, 200));

  ["warehouseModal", "productModal"].forEach(id => {
    const m = document.getElementById(id);
    m?.addEventListener("click", e => { if (e.target === m) m.classList.add("hidden"); });
    m?.addEventListener("keydown", e => { if (e.key === "Escape") m.classList.add("hidden"); });
  });

  if (isSettingsReadOnly) {
    document.getElementById("whAddBtn").style.display = "none";
    document.getElementById("prodAddBtn").style.display = "none";
  }
}

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
  if (tab === "recipes") loadRecipeOverview();
}

/* ══════════════════════════════════════════════
   TAB 1 — KHO (branches)
   ══════════════════════════════════════════════ */
async function loadWarehouses() {
  await window.Branches.loadBranches();
  renderWarehousesTable();
}

function renderWarehousesTable() {
  const tbody = document.getElementById("whTableBody");
  if (!tbody) return;
  const list = window.Branches.state.list;

  if (!list.length) {
    tbody.innerHTML = `<tr><td colspan="4" style="text-align:center;padding:30px;color:var(--text-muted);">Chưa có kho nào — bấm "+ Thêm kho" để tạo mới.</td></tr>`;
    return;
  }

  tbody.innerHTML = list.map(b => `
    <tr style="${b.is_active === false ? 'opacity:.55;' : ''}">
      <td><b>${window.escHtml(b.code || "—")}</b></td>
      <td>${window.escHtml(b.name)}</td>
      <td>${b.is_active === false ? '<span class="badge" style="background:#f1f5f9;color:#888;">Ngừng hoạt động</span>' : '<span class="badge">Đang hoạt động</span>'}</td>
      <td><button class="btn btn-primary" style="font-size:12px;padding:6px 10px;" data-wh-edit="${b.id}">✏️ Sửa</button></td>
    </tr>
  `).join("");

  tbody.querySelectorAll("[data-wh-edit]").forEach(btn => btn.addEventListener("click", () => openEditWarehouse(Number(btn.dataset.whEdit))));
}

function openAddWarehouse() {
  if (isSettingsReadOnly) return;
  document.getElementById("whId").value = "";
  document.getElementById("whCode").value = "";
  document.getElementById("whName").value = "";
  document.getElementById("whIsActive").checked = true;
  document.getElementById("warehouseModalTitle").textContent = "➕ Thêm kho";
  window.clearFieldError("whName");
  document.getElementById("warehouseModal").classList.remove("hidden");
  document.getElementById("whCode").focus();
}

function openEditWarehouse(id) {
  const b = window.Branches.state.list.find(x => x.id === id);
  if (!b) return;
  document.getElementById("whId").value = b.id;
  document.getElementById("whCode").value = b.code || "";
  document.getElementById("whName").value = b.name || "";
  document.getElementById("whIsActive").checked = b.is_active !== false;
  document.getElementById("warehouseModalTitle").textContent = "✏️ Sửa kho";
  window.clearFieldError("whName");
  document.getElementById("warehouseModal").classList.remove("hidden");
}

async function saveWarehouse() {
  if (isSettingsReadOnly) return;
  const rawId = document.getElementById("whId").value;
  const id    = rawId ? Number(rawId) : null;
  const code  = document.getElementById("whCode").value.trim();
  const name  = document.getElementById("whName").value.trim();
  const is_active = document.getElementById("whIsActive").checked;

  if (!name) { window.showFieldError("whName", "Vui lòng nhập tên kho."); return; }
  window.clearFieldError("whName");

  const staff = currentSession.displayName || currentSession.username;
  const payload = { code: code || null, name, is_active };

  const btn = document.getElementById("whSaveBtn");
  btn.disabled = true; btn.textContent = "Đang lưu...";
  try {
    if (id) {
      const { error } = await client.from("branches").update(payload).eq("id", id);
      if (error) throw error;
    } else {
      const { error } = await client.from("branches").insert({ ...payload, created_by: staff });
      if (error) throw error;
    }
    document.getElementById("warehouseModal").classList.add("hidden");
    window.showToast("✅ Đã lưu kho!");
    await loadWarehouses();
  } catch (err) {
    if (err.code === "23505") window.showToast("⚠️ Mã kho này đã tồn tại.", "#e17055");
    else window.showToast("❌ Lỗi: " + err.message, "#e17055");
  } finally {
    btn.disabled = false; btn.textContent = "💾 Lưu";
  }
}

/* ══════════════════════════════════════════════
   TAB 2 — SẢN PHẨM (ingredients + quy cách đóng gói)
   ══════════════════════════════════════════════ */
async function loadProducts() {
  await window.Inventory.loadIngredients();
  renderProductsTable();
}

function packageDisplay(p) {
  if (!p.package_qty || !p.package_unit) return "—";
  return `1 ${window.escHtml(p.unit || "đv")} = ${Number(p.package_qty).toLocaleString("vi-VN")} ${window.escHtml(p.package_unit)}`;
}

function renderProductsTable() {
  const tbody = document.getElementById("prodTableBody");
  if (!tbody) return;
  const q = stProductSearchQ;
  const list = window.Inventory.state.ingredients.filter(p =>
    !q || (p.name || "").toLowerCase().includes(q) || (p.code || "").toLowerCase().includes(q)
  );

  if (!list.length) {
    tbody.innerHTML = `<tr><td colspan="7" style="text-align:center;padding:30px;color:var(--text-muted);">${window.Inventory.state.ingredients.length ? "Không tìm thấy sản phẩm phù hợp." : "Chưa có sản phẩm nào."}</td></tr>`;
    return;
  }

  tbody.innerHTML = list.map(p => `
    <tr style="${p.is_active === false ? 'opacity:.55;' : ''}">
      <td>${window.escHtml(p.code || "—")}</td>
      <td><div class="game-name">${window.escHtml(p.name)}</div>${p.is_active === false ? '<div class="game-id" style="color:var(--danger)">Ngừng dùng</div>' : ''}</td>
      <td>${window.escHtml(p.spec || "—")}</td>
      <td>${window.escHtml(p.unit || "—")}</td>
      <td>${packageDisplay(p)}</td>
      <td>${Number(p.unit_cost || 0).toLocaleString("vi-VN")} đ</td>
      <td><button class="btn btn-primary" style="font-size:12px;padding:6px 10px;" data-prod-edit="${p.id}">✏️ Sửa</button></td>
    </tr>
  `).join("");

  tbody.querySelectorAll("[data-prod-edit]").forEach(btn => btn.addEventListener("click", () => openEditProduct(Number(btn.dataset.prodEdit))));
}

function updateProductCostHint() {
  const cost  = Number(document.getElementById("prodUnitCost").value) || 0;
  const qty   = Number(document.getElementById("prodPackageQty").value) || 0;
  const punit = document.getElementById("prodPackageUnit").value.trim();
  const el = document.getElementById("prodCostHint");
  if (!el) return;
  el.textContent = (cost > 0 && qty > 0 && punit)
    ? `≈ ${(cost / qty).toLocaleString("vi-VN", { maximumFractionDigits: 4 })} đ / ${punit}`
    : "";
}

function openAddProduct() {
  if (isSettingsReadOnly) return;
  document.getElementById("prodId").value = "";
  document.getElementById("prodCode").value = "";
  document.getElementById("prodName").value = "";
  document.getElementById("prodSpec").value = "";
  document.getElementById("prodUnit").value = "";
  document.getElementById("prodUnitEcho").textContent = "đơn vị";
  document.getElementById("prodUnitCost").value = "";
  document.getElementById("prodPackageQty").value = "";
  document.getElementById("prodPackageUnit").value = "";
  document.getElementById("prodMinStock").value = "";
  document.getElementById("prodIsActive").checked = true;
  document.getElementById("productModalTitle").textContent = "➕ Thêm sản phẩm";
  document.getElementById("prodDeleteBtn").style.display = "none";
  window.clearFieldError("prodName");
  window.clearFieldError("prodUnit");
  updateProductCostHint();
  document.getElementById("productModal").classList.remove("hidden");
  document.getElementById("prodName").focus();
}

function openEditProduct(id) {
  const p = window.Inventory.getIngredientById(id);
  if (!p) return;
  document.getElementById("prodId").value = p.id;
  document.getElementById("prodCode").value = p.code || "";
  document.getElementById("prodName").value = p.name || "";
  document.getElementById("prodSpec").value = p.spec || "";
  document.getElementById("prodUnit").value = p.unit || "";
  document.getElementById("prodUnitEcho").textContent = p.unit || "đơn vị";
  document.getElementById("prodUnitCost").value = p.unit_cost ?? "";
  document.getElementById("prodPackageQty").value = p.package_unit ? (p.package_qty ?? "") : "";
  document.getElementById("prodPackageUnit").value = p.package_unit || "";
  document.getElementById("prodMinStock").value = p.min_stock_qty ?? "";
  document.getElementById("prodIsActive").checked = p.is_active !== false;
  document.getElementById("productModalTitle").textContent = "✏️ Sửa sản phẩm";
  document.getElementById("prodDeleteBtn").style.display = isSettingsReadOnly ? "none" : "inline-flex";
  window.clearFieldError("prodName");
  window.clearFieldError("prodUnit");
  updateProductCostHint();
  document.getElementById("productModal").classList.remove("hidden");
}

async function saveProduct() {
  if (isSettingsReadOnly) return;
  const rawId = document.getElementById("prodId").value;
  const id    = rawId ? Number(rawId) : null;
  const code  = document.getElementById("prodCode").value.trim();
  const name  = document.getElementById("prodName").value.trim();
  const spec  = document.getElementById("prodSpec").value.trim();
  const unit  = document.getElementById("prodUnit").value.trim();
  const unit_cost = Number(document.getElementById("prodUnitCost").value);
  const package_unit = document.getElementById("prodPackageUnit").value.trim() || null;
  const package_qty  = package_unit ? (Number(document.getElementById("prodPackageQty").value) || 0) : 1;
  const min_stock_qty = Number(document.getElementById("prodMinStock").value) || 0;
  const is_active = document.getElementById("prodIsActive").checked;

  if (!name) { window.showFieldError("prodName", "Vui lòng nhập tên sản phẩm.", { fullWidth: true }); return; }
  window.clearFieldError("prodName");
  if (!unit) { window.showFieldError("prodUnit", "Vui lòng nhập đơn vị tính.", { fullWidth: true }); return; }
  window.clearFieldError("prodUnit");
  if (!unit_cost || unit_cost < 0) { window.showToast("⚠️ Giá/đơn vị không hợp lệ.", "#e17055"); return; }
  if (package_unit && package_qty <= 0) { window.showToast("⚠️ Số lượng đóng gói phải lớn hơn 0.", "#e17055"); return; }

  const staff = currentSession.displayName || currentSession.username;
  const payload = {
    code: code || null, name, spec: spec || null, unit, unit_cost,
    package_qty, package_unit, min_stock_qty, is_active,
    updated_by: staff,
  };

  const btn = document.getElementById("prodSaveBtn");
  btn.disabled = true; btn.textContent = "Đang lưu...";
  try {
    if (id) {
      const { error } = await client.from("ingredients").update(payload).eq("id", id);
      if (error) throw error;
    } else {
      const { error } = await client.from("ingredients").insert({ ...payload, created_by: staff });
      if (error) throw error;
    }
    document.getElementById("productModal").classList.add("hidden");
    window.showToast("✅ Đã lưu sản phẩm!");
    await loadProducts();
  } catch (err) {
    if (err.code === "23505") window.showToast("⚠️ Sản phẩm này (tên + đơn vị) đã tồn tại.", "#e17055");
    else window.showToast("❌ Lỗi: " + err.message, "#e17055");
  } finally {
    btn.disabled = false; btn.textContent = "💾 Lưu";
  }
}

async function deleteProduct() {
  if (isSettingsReadOnly) return;
  const id = Number(document.getElementById("prodId").value);
  if (!id) return;
  const p = window.Inventory.getIngredientById(id);

  const reason = await window.showReasonPrompt({
    title: `Ngừng dùng "${p?.name || ''}"?`,
    message: "Sản phẩm sẽ bị ẩn khỏi danh sách chọn công thức/kho nhưng vẫn giữ lịch sử đã dùng trong các công thức/đơn hàng cũ.",
    reasonLabel: "Lý do ngừng dùng *",
    reasonPlaceholder: "VD: đổi nhà cung cấp, không còn dùng sản phẩm này...",
    confirmText: "🗑️ Ngừng dùng",
    cancelText: "Huỷ",
  });
  if (reason === null) return;

  try {
    const { error } = await client.from("ingredients")
      .update({
        deleted_at: new Date().toISOString(), is_active: false,
        deleted_reason: reason, deleted_by: currentSession.displayName || currentSession.username,
      }).eq("id", id);
    if (error) throw error;
    document.getElementById("productModal").classList.add("hidden");
    window.showToast("🗑️ Đã ngừng dùng sản phẩm", "#e17055");
    await loadProducts();
  } catch (err) {
    window.showToast("❌ Lỗi: " + err.message, "#e17055");
  }
}

/* ══════════════════════════════════════════════
   TAB 3 — CÔNG THỨC (chỉ TỔNG HỢP + điều hướng — thao tác sửa
   công thức thật vẫn nằm ở modal có sẵn của trang ☕ Đồ uống,
   window.editDrink(), KHÔNG xây lại UI công thức lần 2)
   ══════════════════════════════════════════════ */
async function loadRecipeOverview() {
  const tbody = document.getElementById("recipeTableBody");
  if (!tbody) return;
  tbody.innerHTML = `<tr><td colspan="6" style="text-align:center;padding:30px;color:var(--text-muted);">⏳ Đang tải...</td></tr>`;

  try {
    const [{ data: drinks, error: dErr }, { data: costs, error: cErr }, { data: recipeRows, error: rErr }] = await Promise.all([
      client.from("drinks").select("id, name, emoji, price, is_active").is("deleted_at", null).order("sort_order", { ascending: true }),
      client.from("v_drink_cost").select("*"),
      client.from("drink_ingredients").select("drink_id"),
    ]);
    if (dErr) throw dErr;
    if (cErr) throw cErr;
    if (rErr) throw rErr;

    const costMap = new Map((costs || []).map(c => [c.drink_id, Number(c.ingredient_cost) || 0]));
    const countMap = new Map();
    (recipeRows || []).forEach(r => countMap.set(r.drink_id, (countMap.get(r.drink_id) || 0) + 1));

    renderRecipeTable(drinks || [], costMap, countMap);
  } catch (err) {
    tbody.innerHTML = `<tr><td colspan="6" style="text-align:center;padding:30px;color:var(--danger);">Lỗi: ${window.escHtml(err.message)}</td></tr>`;
  }
}

function renderRecipeTable(drinks, costMap, countMap) {
  const tbody = document.getElementById("recipeTableBody");
  if (!tbody) return;

  if (!drinks.length) {
    tbody.innerHTML = `<tr><td colspan="6" style="text-align:center;padding:30px;color:var(--text-muted);">Chưa có đồ uống nào — vào trang ☕ Đồ uống để thêm.</td></tr>`;
    return;
  }

  tbody.innerHTML = drinks.map(d => {
    const cost   = costMap.get(d.id) || 0;
    const count  = countMap.get(d.id) || 0;
    const price  = Number(d.price) || 0;
    const profit = price - cost;
    return `<tr style="${d.is_active === false ? 'opacity:.55;' : ''}">
      <td><div class="game-name">${d.emoji || '☕'} ${window.escHtml(d.name)}</div>${d.is_active === false ? '<div class="game-id" style="color:var(--danger)">Ngừng bán</div>' : ''}</td>
      <td>${count ? count + ' nguyên liệu' : '<span style="color:var(--danger);">⚠️ Chưa có công thức</span>'}</td>
      <td>${Math.round(cost).toLocaleString('vi-VN')} đ</td>
      <td>${price.toLocaleString('vi-VN')} đ</td>
      <td style="color:${profit >= 0 ? '#00b894' : 'var(--danger)'};font-weight:600;">${Math.round(profit).toLocaleString('vi-VN')} đ</td>
      <td><button class="btn btn-primary" style="font-size:12px;padding:6px 10px;" data-recipe-edit="${d.id}">✏️ Sửa công thức</button></td>
    </tr>`;
  }).join("");

  tbody.querySelectorAll("[data-recipe-edit]").forEach(btn => {
    btn.addEventListener("click", () => {
      if (typeof window.editDrink === "function") {
        window.editDrink(Number(btn.dataset.recipeEdit));
      } else {
        window.showToast("⚠️ Module Đồ uống chưa sẵn sàng, thử tải lại trang.", "#e17055");
      }
    });
  });
}

/* ══════════════════════════════════════════════
   ⚠️ MỚI: EXPOSE ĐIỀU HƯỚNG TỪ NƠI KHÁC (Kho nguyên liệu)
   ─────────────────────────────────────────────
   Kho nguyên liệu (dashboard-ingredients.js) không còn tự tạo/sửa/
   xoá sản phẩm nữa — mọi thao tác đó dồn về đây. 2 hàm dưới đây là
   "cửa vào" duy nhất để trang khác điều hướng sang đúng tab/đúng
   sản phẩm ở Settings.
   ══════════════════════════════════════════════ */
window.switchSettingsTab = switchSettingsTab;

window.openProductInSettings = async function (id) {
  document.getElementById("settingsMenuItem")?.click(); // trigger showPage() + onShow() có sẵn
  switchSettingsTab("products");
  await window.Inventory.loadIngredients();
  renderProductsTable();
  if (id) openEditProduct(id);
};
