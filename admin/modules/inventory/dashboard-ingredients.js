/* ══════════════════════════════════════════════
   DASHBOARD INGREDIENTS — admin/modules/inventory/dashboard-ingredients.js
   ─────────────────────────────────────────────
   ⚠️ VIẾT LẠI (2026-08-18) — bỏ tạo mới/sửa/xoá sản phẩm ở trang
   này. Lý do: "Mã sản phẩm" từng bị tạo được ở 2 nơi khác nhau
   (Settings → 📦 Sản phẩm VÀ Kho nguyên liệu) cùng ghi 1 bảng
   `ingredients`, nhưng modal ở đây THIẾU 2 trường quy đổi đóng gói
   (package_qty/package_unit) mà Settings có → tạo nguyên liệu qua
   đường này bị thiếu dữ liệu, công thức ở Đồ uống không tự điền
   được hệ số quy đổi.

   GIỜ: trang này CHỈ còn 2 việc:
     1. Xem danh sách nguyên liệu + tồn kho hiện tại + cảnh báo
        dưới ngưỡng tối thiểu.
     2. 📥 Nhập kho / Điều chỉnh tồn kho / Hao hụt (ingredient_stock_logs)
        — chức năng CHÍNH của trang, không đổi gì so với trước.

   Tạo mới / sửa thông tin / ngừng dùng sản phẩm → ĐÃ CHUYỂN HẲN
   sang ⚙️ Settings → 📦 Sản phẩm (dashboard-settings.js). Nút
   "✏️ Sửa" ở đây giờ chỉ là 1 LINK điều hướng sang đúng sản phẩm
   bên Settings (window.openProductInSettings(id)), không tự mở
   modal sửa tại chỗ nữa.

   ⚠️ MỚI (2026-09 — thành phẩm & nguyên liệu gộp chung 1 bảng, phân
   biệt bằng ingredients.is_finished_product — xem dashboard-settings.js
   và dashboard-drinks.js): bảng ở trang này giờ có thêm cột "Loại"
   (🥤 Thành phẩm / 🧂 Nguyên liệu) để nhân viên nhập/điều chỉnh kho
   dễ phân biệt — cả 2 loại đều nhập/điều chỉnh tồn kho HỆT NHAU,
   không có gì khác trong logic saveStockLog()/openStockModal().

   Cần: client, currentSession, window.AdminPermissions,
   window.Inventory (inventory-shared.js — PHẢI load trước file này),
   window.escHtml / window.showToast / window.showConfirm / window.debounce
   (shared-utils.js), window.Membership.formatVND (nếu đã load),
   window.openProductInSettings (dashboard-settings.js — PHẢI load
   trước file này, xem SCRIPT_SEQUENCE trong dashboard-auth.js).
   ══════════════════════════════════════════════ */

const INV = window.Inventory;
const isIngredientsReadOnly = INV.isReadOnly;
let ingSearchQ = "";

window.AdminDashboard.registerPage({
  pageId: "ingredientsPage",
  menuId: "ingredientsMenuItem",
  icon: "📦",
  label: "Kho nguyên liệu",
  onShow: () => loadAndRenderIngredients(),
});

(function injectIngredientsPage() {
  const main = document.querySelector(".main-content");
  if (!main) return;

  const page = document.createElement("div");
  page.id = "ingredientsPage";
  page.style.display = "none";
  page.innerHTML = `
    <div class="page-header">
      <div>
        <h1 class="page-title">📦 Kho nguyên liệu</h1>
        <p class="page-subtitle">Tồn kho hiện tại &amp; nhập/điều chỉnh kho (áp dụng cho cả 🧂 nguyên liệu và 🥤 thành phẩm). Tạo mới hoặc sửa thông tin sản phẩm ở ⚙️ Settings → 📦 Sản phẩm.</p>
      </div>
      <div class="header-actions">
        <button class="btn btn-secondary" id="ingRefreshBtn">🔄 Refresh</button>
        <button class="btn btn-primary" id="ingGoToSettingsBtn">📦 Quản lý sản phẩm (Settings)</button>
      </div>
    </div>

    <div class="stats-grid" style="grid-template-columns:repeat(3,1fr);margin-bottom:20px;">
      <div class="stat-card">
        <div class="stat-icon" aria-hidden="true">📦</div>
        <div><div class="stat-value" id="ingStatTotal">—</div><div class="stat-label">Nguyên liệu &amp; thành phẩm đang theo dõi</div></div>
      </div>
      <div class="stat-card">
        <div class="stat-icon" aria-hidden="true">⚠️</div>
        <div><div class="stat-value" id="ingStatLow" style="color:var(--danger)">—</div><div class="stat-label">Sắp hết hàng (dưới mức tối thiểu)</div></div>
      </div>
      <div class="stat-card">
        <div class="stat-icon" aria-hidden="true">💰</div>
        <div><div class="stat-value" id="ingStatValue" style="font-size:20px;">—</div><div class="stat-label">Tổng giá trị tồn kho ước tính</div></div>
      </div>
    </div>

    <div class="search-bar"><input type="text" id="ingSearchInput" class="search-input" placeholder="🔍 Tìm theo tên hoặc mã sản phẩm..."></div>

    <div id="ingLowStockBanner" role="alert" style="display:none;background:#fff5f5;border:1px solid #e1705544;color:var(--danger);border-radius:10px;padding:12px 18px;font-size:13px;font-weight:600;margin-bottom:16px;"></div>

    <div class="table-card">
      <table class="game-table">
        <thead><tr>
          <th>Mã SP</th><th>Nguyên liệu / Thành phẩm</th><th>Loại</th><th>Đơn vị</th><th>Giá/đơn vị</th><th>Tồn kho hiện tại</th><th>Tối thiểu</th><th>Hành động</th>
        </tr></thead>
        <tbody id="ingTableBody"><tr><td colspan="8" style="text-align:center;padding:40px;color:var(--text-muted);">⏳ Đang tải...</td></tr></tbody>
      </table>
    </div>

    <!-- Modal Nhập kho / Điều chỉnh tồn kho — DUY NHẤT còn lại ở trang này -->
    <div class="modal-overlay hidden" id="stockModal" role="dialog" aria-modal="true" aria-labelledby="stockModalTitle">
      <div class="modal-box" style="max-width:440px;">
        <div class="modal-header">
          <h2 id="stockModalTitle">📥 Nhập / điều chỉnh kho</h2>
          <button class="close-btn" id="closeStockModalBtn" aria-label="Đóng cửa sổ">✕</button>
        </div>
        <input type="hidden" id="stockIngId">
        <div id="stockIngName" style="font-weight:700;margin-bottom:14px;"></div>
        <div class="form-grid" style="grid-template-columns:1fr;">
          <div class="form-group">
            <label for="stockLogType">Loại thao tác *</label>
            <select id="stockLogType" style="height:44px;border-radius:10px;border:1px solid var(--border);padding:0 14px;font-size:14px;font-family:'Inter',sans-serif;">
              <option value="import">📥 Nhập kho (mua hàng mới)</option>
              <option value="manual_adjust">⚖️ Điều chỉnh tồn kho (kiểm kê)</option>
              <option value="expired">🗑️ Hao hụt / hết hạn</option>
            </select>
          </div>
          <div class="form-group" id="stockQtyGroup">
            <label for="stockQty">Số lượng thay đổi *</label>
            <input type="number" id="stockQty" step="0.01" placeholder="VD: 5000">
            <div class="hint" id="stockQtyHint">Dương = nhập thêm vào kho, âm = trừ khỏi kho</div>
          </div>
          <div class="form-group" id="stockBatchGroup">
            <label for="stockBatchRef">Mã lô hàng *</label>
            <input type="text" id="stockBatchRef" placeholder="VD: LOT-20260716-01">
          </div>
          <div class="form-group" id="stockCostGroup">
            <label for="stockUnitCost">Giá nhập / đơn vị (đ) *</label>
            <input type="number" id="stockUnitCost" min="0" step="0.01">
            <div class="hint">Có thể khác giá bán hiện tại — hệ thống sẽ hỏi có muốn cập nhật giá tham chiếu không</div>
          </div>
          <div class="form-group" id="stockExpiryGroup">
            <label for="stockExpiry">Hạn sử dụng</label>
            <input type="date" id="stockExpiry">
          </div>
          <div class="form-group"><label for="stockNote">Ghi chú</label><input type="text" id="stockNote" placeholder="Tuỳ chọn"></div>
          <div style="font-size:13px;color:var(--text-muted);">Tồn kho hiện tại: <b id="stockCurrentQty">0</b> → Sau thao tác: <b id="stockAfterQty" style="color:var(--primary)">0</b></div>
        </div>
        <div class="modal-actions" style="justify-content:flex-end;">
          <button class="btn btn-primary" id="stockSaveBtn">💾 Ghi nhận</button>
        </div>
      </div>
    </div>
  `;
  main.appendChild(page);
  bindIngredientEvents();
})();

function bindIngredientEvents() {
  document.getElementById("ingRefreshBtn")?.addEventListener("click", loadAndRenderIngredients);

  /* ⚠️ Nút header chỉ điều hướng sang Settings, không mở modal tại chỗ */
  document.getElementById("ingGoToSettingsBtn")?.addEventListener("click", () => window.openProductInSettings());

  document.getElementById("closeStockModalBtn")?.addEventListener("click", () => document.getElementById("stockModal").classList.add("hidden"));
  document.getElementById("stockSaveBtn")?.addEventListener("click", saveStockLog);
  document.getElementById("stockLogType")?.addEventListener("change", updateStockModalFields);
  document.getElementById("stockQty")?.addEventListener("input", updateStockPreview);

  document.getElementById("ingSearchInput")?.addEventListener("input", window.debounce(e => {
    ingSearchQ = e.target.value.toLowerCase();
    renderIngredientsTable();
  }, 200));

  const stockModal = document.getElementById("stockModal");
  stockModal?.addEventListener("click", e => { if (e.target === stockModal) stockModal.classList.add("hidden"); });
  stockModal?.addEventListener("keydown", e => { if (e.key === "Escape") stockModal.classList.add("hidden"); });
}

async function loadAndRenderIngredients() {
  try {
    await INV.loadIngredients();
    renderIngredientsTable();
    updateIngredientStats();
  } catch (err) {
    window.showToast("❌ Lỗi khi tải kho nguyên liệu: " + err.message, "#e17055");
  }
}

function fmtVND(n) {
  return window.Membership ? window.Membership.formatVND(n) : Math.round(n).toLocaleString("vi-VN") + " đ";
}

/* ⚠️ MỚI: badge phân biệt 🥤 Thành phẩm / 🧂 Nguyên liệu — dùng
   chung style với productTypeBadge() bên dashboard-settings.js
   (không import chung được vì 2 file độc lập, nhưng markup giống
   hệt để nhất quán trực quan). */
function ingTypeBadge(i) {
  return i.is_finished_product
    ? '<span class="badge" style="background:#e0f2ff;color:#0984e3;">🥤 Thành phẩm</span>'
    : '<span class="badge">🧂 Nguyên liệu</span>';
}

function updateIngredientStats() {
  const list = INV.state.ingredients;
  const low = list.filter(i => i.min_stock_qty > 0 && i.current_stock < i.min_stock_qty);
  const noCode = list.filter(i => !i.code);
  const totalValue = list.reduce((s, i) => s + i.current_stock * Number(i.unit_cost || 0), 0);

  document.getElementById("ingStatTotal").textContent = list.length;
  document.getElementById("ingStatLow").textContent = low.length;
  document.getElementById("ingStatValue").textContent = fmtVND(totalValue);

  const banner = document.getElementById("ingLowStockBanner");
  const messages = [];
  if (low.length) messages.push(`⚠️ ${low.length} nguyên liệu/thành phẩm sắp hết: ${low.map(i => i.name).join(", ")}`);
  /* ⚠️ Trỏ người dùng sang Settings thay vì "nút Sửa" (đã bỏ khỏi trang này) */
  if (noCode.length) messages.push(`🔖 ${noCode.length} mục <b>chưa có Mã sản phẩm</b> — bổ sung tại ⚙️ Settings → 📦 Sản phẩm trước khi nhập kho: ${noCode.map(i => i.name).join(", ")}`);

  if (messages.length) {
    banner.style.display = "block";
    banner.innerHTML = messages.join("<br>");
  } else {
    banner.style.display = "none";
  }
}

function renderIngredientsTable() {
  const tbody = document.getElementById("ingTableBody");
  if (!tbody) return;

  const list = INV.state.ingredients.filter(i =>
    !ingSearchQ || i.name.toLowerCase().includes(ingSearchQ) || (i.code || "").toLowerCase().includes(ingSearchQ)
  );

  if (!list.length) {
    tbody.innerHTML = `<tr><td colspan="8" style="text-align:center;padding:40px;color:var(--text-muted);">${INV.state.ingredients.length ? "Không tìm thấy nguyên liệu/thành phẩm phù hợp." : "Chưa có sản phẩm nào — tạo mới tại ⚙️ Settings → 📦 Sản phẩm."}</td></tr>`;
    return;
  }

  tbody.innerHTML = list.map(i => {
    const low = i.min_stock_qty > 0 && i.current_stock < i.min_stock_qty;
    const noCode = !i.code;
    return `<tr>
      <td>${noCode ? '<span class="badge" style="background:#fff5f5;color:var(--danger);">⚠️ Chưa có mã</span>' : `<b>${window.escHtml(i.code)}</b>`}</td>
      <td><div class="game-name">${window.escHtml(i.name)}</div>${!i.is_active ? '<div class="game-id" style="color:var(--danger)">Ngừng dùng</div>' : ''}</td>
      <td>${ingTypeBadge(i)}</td>
      <td>${window.escHtml(i.unit)}</td>
      <td>${Number(i.unit_cost).toLocaleString("vi-VN")} đ</td>
      <td style="font-weight:700;${low ? 'color:var(--danger)' : ''}">${i.current_stock.toLocaleString("vi-VN")} ${window.escHtml(i.unit)} ${low ? '⚠️' : ''}</td>
      <td>${Number(i.min_stock_qty || 0).toLocaleString("vi-VN")}</td>
      <td style="display:flex;gap:6px;flex-wrap:wrap;">
        <button class="btn btn-secondary" style="font-size:12px;padding:6px 10px;" data-ing-stock="${i.id}" ${noCode ? 'disabled title="Bổ sung Mã sản phẩm ở Settings trước khi nhập/điều chỉnh kho"' : ''}>📥 Nhập/Điều chỉnh</button>
        <button class="btn btn-primary" style="font-size:12px;padding:6px 10px;" data-ing-edit-settings="${i.id}" title="Mở sửa sản phẩm này ở ⚙️ Settings">✏️ Sửa ở Settings</button>
      </td>
    </tr>`;
  }).join("");

  /* ⚠️ Nút Sửa giờ chỉ điều hướng, không mở modal tại chỗ nữa */
  tbody.querySelectorAll("[data-ing-edit-settings]").forEach(b =>
    b.addEventListener("click", () => window.openProductInSettings(Number(b.dataset.ingEditSettings)))
  );
  tbody.querySelectorAll("[data-ing-stock]:not([disabled])").forEach(b =>
    b.addEventListener("click", () => openStockModal(Number(b.dataset.ingStock)))
  );
}

/* ══════════════════════════════════════════════
   NHẬP KHO / ĐIỀU CHỈNH TỒN KHO — không đổi so với bản trước.
   Áp dụng HỆT NHAU cho cả nguyên liệu và thành phẩm — không phân
   biệt is_finished_product ở logic này.
   ══════════════════════════════════════════════ */
function openStockModal(ingId) {
  if (isIngredientsReadOnly) return;
  const ing = INV.getIngredientById(ingId);
  if (!ing) return;

  if (!ing.code) {
    window.showToast("⚠️ Sản phẩm này chưa có Mã sản phẩm — bổ sung tại ⚙️ Settings → 📦 Sản phẩm trước khi nhập/điều chỉnh kho.", "#e17055");
    return;
  }

  document.getElementById("stockIngId").value = ingId;
  document.getElementById("stockIngName").textContent = `${ing.code} — ${ing.name} (${ing.unit})${ing.is_finished_product ? ' · 🥤 Thành phẩm' : ' · 🧂 Nguyên liệu'}`;
  document.getElementById("stockLogType").value = "import";
  document.getElementById("stockQty").value = "";
  document.getElementById("stockBatchRef").value = "";
  document.getElementById("stockUnitCost").value = ing.unit_cost;
  document.getElementById("stockExpiry").value = "";
  document.getElementById("stockNote").value = "";
  document.getElementById("stockCurrentQty").textContent = ing.current_stock.toLocaleString("vi-VN") + " " + ing.unit;
  document.getElementById("stockAfterQty").textContent = ing.current_stock.toLocaleString("vi-VN") + " " + ing.unit;

  updateStockModalFields();
  document.getElementById("stockModal").classList.remove("hidden");
  document.getElementById("stockQty").focus();
}

function updateStockModalFields() {
  const type = document.getElementById("stockLogType").value;
  const isImport = type === "import";
  document.getElementById("stockBatchGroup").style.display  = isImport ? "" : "none";
  document.getElementById("stockCostGroup").style.display   = isImport ? "" : "none";
  document.getElementById("stockExpiryGroup").style.display = isImport ? "" : "none";
  document.getElementById("stockQtyHint").textContent = isImport
    ? "Nhập số lượng nhập thêm vào kho (luôn là số dương)"
    : "Điền số dương để cộng vào kho, số âm để trừ khỏi kho";
  updateStockPreview();
}

function updateStockPreview() {
  const ingId = Number(document.getElementById("stockIngId").value);
  const ing = INV.getIngredientById(ingId);
  if (!ing) return;
  const type = document.getElementById("stockLogType").value;
  let qtyChange = Number(document.getElementById("stockQty").value) || 0;
  if (type === "import")  qtyChange = Math.abs(qtyChange);
  if (type === "expired") qtyChange = -Math.abs(qtyChange);
  const after = ing.current_stock + qtyChange;
  const afterEl = document.getElementById("stockAfterQty");
  afterEl.textContent = after.toLocaleString("vi-VN") + " " + ing.unit;
  afterEl.style.color = after < 0 ? "var(--danger)" : "var(--primary)";
}

async function saveStockLog() {
  if (isIngredientsReadOnly) return;
  const ingId = Number(document.getElementById("stockIngId").value);
  const ing = INV.getIngredientById(ingId);
  if (!ing) return;

  if (!ing.code) {
    window.showToast("⚠️ Sản phẩm này chưa có Mã sản phẩm — không thể ghi nhận thay đổi tồn kho.", "#e17055");
    return;
  }

  const type = document.getElementById("stockLogType").value;
  let qty = Number(document.getElementById("stockQty").value);
  if (!qty) { window.showToast("⚠️ Vui lòng nhập số lượng.", "#e17055"); return; }
  if (type === "import")  qty = Math.abs(qty);
  if (type === "expired") qty = -Math.abs(qty);

  const afterQty = ing.current_stock + qty;
  if (afterQty < 0) { window.showToast("⚠️ Số lượng sau thao tác không được âm — kiểm tra lại tồn kho.", "#e17055"); return; }

  const staff = currentSession.displayName || currentSession.username;
  const payload = {
    ingredient_id: ingId,
    log_type: type,
    qty_change: qty,
    qty_after: afterQty,
    note: document.getElementById("stockNote").value.trim() || null,
    staff_name: staff,
  };

  let newUnitCost = null;
  if (type === "import") {
    const batch = document.getElementById("stockBatchRef").value.trim();
    const cost  = Number(document.getElementById("stockUnitCost").value);
    if (!batch)          { window.showToast("⚠️ Vui lòng nhập mã lô hàng.", "#e17055"); return; }
    if (!cost || cost < 0) { window.showToast("⚠️ Vui lòng nhập giá nhập hợp lệ.", "#e17055"); return; }
    payload.batch_ref = batch;
    payload.unit_cost_at_import = cost;
    const expiry = document.getElementById("stockExpiry").value;
    if (expiry) payload.expiry_date = expiry;
    if (cost !== Number(ing.unit_cost)) newUnitCost = cost;
  }

  const btn = document.getElementById("stockSaveBtn");
  btn.disabled = true; btn.textContent = "Đang lưu...";
  try {
    const { error } = await client.from("ingredient_stock_logs").insert(payload);
    if (error) throw error;

    if (newUnitCost !== null) {
      const updatePrice = await window.showConfirm({
        title: "Cập nhật giá tham chiếu?",
        message: `Giá nhập lần này (${newUnitCost.toLocaleString('vi-VN')}đ) khác giá hiện tại (${Number(ing.unit_cost).toLocaleString('vi-VN')}đ). Cập nhật làm giá tính giá thành mặc định cho các lần bán sau?`,
        confirmText: "Cập nhật",
        cancelText: "Giữ nguyên",
        danger: false,
      });
      if (updatePrice) {
        await client.from("ingredients").update({ unit_cost: newUnitCost }).eq("id", ingId);
      }
    }

    document.getElementById("stockModal").classList.add("hidden");
    window.showToast("✅ Đã ghi nhận thay đổi tồn kho!");
    await loadAndRenderIngredients();
  } catch (err) {
    window.showToast("❌ Lỗi: " + err.message, "#e17055");
  } finally {
    btn.disabled = false; btn.textContent = "💾 Ghi nhận";
  }
}
