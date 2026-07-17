/* ══════════════════════════════════════════════
   DASHBOARD INGREDIENTS — admin/modules/inventory/dashboard-ingredients.js
   ─────────────────────────────────────────────
   MỚI (theo schema SQL v1). Quản lý kho nguyên liệu:
     - CRUD bảng `ingredients` (tên, đơn vị, giá/đơn vị, ngưỡng tồn tối thiểu)
     - Nhập kho / điều chỉnh tồn kho / hao hụt qua `ingredient_stock_logs`
       (bảng CHỈ INSERT theo thiết kế DB — không sửa/xoá log cũ, muốn
       sửa sai thì insert thêm 1 dòng điều chỉnh đối ứng)
     - Cảnh báo nguyên liệu dưới ngưỡng tồn kho tối thiểu

   Xoá nguyên liệu = SOFT DELETE (set deleted_at + is_active=false) vì
   `drink_ingredients.ingredient_id` có ON DELETE RESTRICT — xoá cứng
   sẽ lỗi FK nếu nguyên liệu đã từng được gắn vào công thức nào.

   Cần: client, currentSession, window.AdminPermissions,
   window.Inventory (inventory-shared.js — PHẢI load trước file này),
   window.escHtml / window.showToast / window.showConfirm / window.debounce
   (shared-utils.js), window.Membership.formatVND (nếu đã load, để hiển
   thị tổng giá trị tồn kho — không bắt buộc).
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
        <p class="page-subtitle">Giá nguyên liệu dùng để tính giá thành đồ uống &amp; lợi nhuận</p>
      </div>
      <div class="header-actions">
        <button class="btn btn-secondary" id="ingRefreshBtn">🔄 Refresh</button>
        <button class="btn btn-primary" id="ingAddBtn">+ Thêm nguyên liệu</button>
      </div>
    </div>

    <div class="stats-grid" style="grid-template-columns:repeat(3,1fr);margin-bottom:20px;">
      <div class="stat-card">
        <div class="stat-icon" aria-hidden="true">📦</div>
        <div><div class="stat-value" id="ingStatTotal">—</div><div class="stat-label">Nguyên liệu đang theo dõi</div></div>
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

    <div class="search-bar"><input type="text" id="ingSearchInput" class="search-input" placeholder="🔍 Tìm theo tên nguyên liệu..."></div>

    <div id="ingLowStockBanner" role="alert" style="display:none;background:#fff5f5;border:1px solid #e1705544;color:var(--danger);border-radius:10px;padding:12px 18px;font-size:13px;font-weight:600;margin-bottom:16px;"></div>

    <div class="table-card">
      <table class="game-table">
        <thead><tr>
          <th>Nguyên liệu</th><th>Đơn vị</th><th>Giá/đơn vị</th><th>Tồn kho hiện tại</th><th>Tối thiểu</th><th>Hành động</th>
        </tr></thead>
        <tbody id="ingTableBody"><tr><td colspan="6" style="text-align:center;padding:40px;color:var(--text-muted);">⏳ Đang tải...</td></tr></tbody>
      </table>
    </div>

    <!-- Modal CRUD nguyên liệu -->
    <div class="modal-overlay hidden" id="ingredientModal" role="dialog" aria-modal="true" aria-labelledby="ingredientModalTitle">
      <div class="modal-box" style="max-width:460px;">
        <div class="modal-header">
          <h2 id="ingredientModalTitle">➕ Thêm nguyên liệu</h2>
          <button class="close-btn" id="closeIngredientModalBtn" aria-label="Đóng cửa sổ">✕</button>
        </div>
        <input type="hidden" id="ingId">
        <div class="form-grid" style="grid-template-columns:1fr;">
          <div class="form-group"><label for="ingName">Tên nguyên liệu *</label><input type="text" id="ingName" placeholder="Sữa tươi, Đường, Trân châu..."></div>
          <div class="form-group"><label for="ingUnit">Đơn vị lưu kho *</label><input type="text" id="ingUnit" placeholder="ml, g, gói, lít..."></div>
          <div class="form-group"><label for="ingUnitCost">Giá / đơn vị (đ) *</label><input type="number" id="ingUnitCost" min="0" step="0.01" placeholder="150"></div>
          <div class="form-group"><label for="ingMinStock">Ngưỡng tồn kho tối thiểu</label><input type="number" id="ingMinStock" min="0" step="0.01" placeholder="1000"></div>
          <div class="form-group" style="flex-direction:row;align-items:center;gap:8px;">
            <input type="checkbox" id="ingIsActive" style="width:18px;height:18px;" checked>
            <label for="ingIsActive" style="margin:0;">Đang sử dụng</label>
          </div>
        </div>
        <div class="modal-actions">
          <button class="btn btn-danger" id="ingDeleteBtn" style="display:none;">🗑️ Ngừng dùng</button>
          <button class="btn btn-primary" id="ingSaveBtn">💾 Lưu</button>
        </div>
      </div>
    </div>

    <!-- Modal Nhập kho / Điều chỉnh tồn kho -->
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
  document.getElementById("ingAddBtn")?.addEventListener("click", openAddIngredient);
  document.getElementById("closeIngredientModalBtn")?.addEventListener("click", () => document.getElementById("ingredientModal").classList.add("hidden"));
  document.getElementById("ingSaveBtn")?.addEventListener("click", saveIngredient);
  document.getElementById("ingDeleteBtn")?.addEventListener("click", deleteIngredient);
  document.getElementById("closeStockModalBtn")?.addEventListener("click", () => document.getElementById("stockModal").classList.add("hidden"));
  document.getElementById("stockSaveBtn")?.addEventListener("click", saveStockLog);
  document.getElementById("stockLogType")?.addEventListener("change", updateStockModalFields);
  document.getElementById("stockQty")?.addEventListener("input", updateStockPreview);

  document.getElementById("ingSearchInput")?.addEventListener("input", window.debounce(e => {
    ingSearchQ = e.target.value.toLowerCase();
    renderIngredientsTable();
  }, 200));

  ["ingredientModal", "stockModal"].forEach(id => {
    const m = document.getElementById(id);
    m?.addEventListener("click", e => { if (e.target === m) m.classList.add("hidden"); });
    m?.addEventListener("keydown", e => { if (e.key === "Escape") m.classList.add("hidden"); });
  });

  if (isIngredientsReadOnly) document.getElementById("ingAddBtn").style.display = "none";
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

function updateIngredientStats() {
  const list = INV.state.ingredients;
  const low = list.filter(i => i.min_stock_qty > 0 && i.current_stock < i.min_stock_qty);
  const totalValue = list.reduce((s, i) => s + i.current_stock * Number(i.unit_cost || 0), 0);

  document.getElementById("ingStatTotal").textContent = list.length;
  document.getElementById("ingStatLow").textContent = low.length;
  document.getElementById("ingStatValue").textContent = fmtVND(totalValue);

  const banner = document.getElementById("ingLowStockBanner");
  if (low.length) {
    banner.style.display = "block";
    banner.textContent = `⚠️ ${low.length} nguyên liệu sắp hết: ${low.map(i => i.name).join(", ")}`;
  } else {
    banner.style.display = "none";
  }
}

function renderIngredientsTable() {
  const tbody = document.getElementById("ingTableBody");
  if (!tbody) return;

  const list = INV.state.ingredients.filter(i => !ingSearchQ || i.name.toLowerCase().includes(ingSearchQ));

  if (!list.length) {
    tbody.innerHTML = `<tr><td colspan="6" style="text-align:center;padding:40px;color:var(--text-muted);">${INV.state.ingredients.length ? "Không tìm thấy nguyên liệu phù hợp." : "Chưa có nguyên liệu nào."}</td></tr>`;
    return;
  }

  tbody.innerHTML = list.map(i => {
    const low = i.min_stock_qty > 0 && i.current_stock < i.min_stock_qty;
    return `<tr>
      <td><div class="game-name">${window.escHtml(i.name)}</div>${!i.is_active ? '<div class="game-id" style="color:var(--danger)">Ngừng dùng</div>' : ''}</td>
      <td>${window.escHtml(i.unit)}</td>
      <td>${Number(i.unit_cost).toLocaleString("vi-VN")} đ</td>
      <td style="font-weight:700;${low ? 'color:var(--danger)' : ''}">${i.current_stock.toLocaleString("vi-VN")} ${window.escHtml(i.unit)} ${low ? '⚠️' : ''}</td>
      <td>${Number(i.min_stock_qty || 0).toLocaleString("vi-VN")}</td>
      <td style="display:flex;gap:6px;flex-wrap:wrap;">
        <button class="btn btn-secondary" style="font-size:12px;padding:6px 10px;" data-ing-stock="${i.id}">📥 Nhập/Điều chỉnh</button>
        <button class="btn btn-primary" style="font-size:12px;padding:6px 10px;" data-ing-edit="${i.id}">✏️ Sửa</button>
      </td>
    </tr>`;
  }).join("");

  tbody.querySelectorAll("[data-ing-edit]").forEach(b => b.addEventListener("click", () => openEditIngredient(Number(b.dataset.ingEdit))));
  tbody.querySelectorAll("[data-ing-stock]").forEach(b => b.addEventListener("click", () => openStockModal(Number(b.dataset.ingStock))));
}

/* ══════════════════════════════════════════════
   CRUD NGUYÊN LIỆU
   ══════════════════════════════════════════════ */
function openAddIngredient() {
  if (isIngredientsReadOnly) return;
  document.getElementById("ingId").value = "";
  document.getElementById("ingName").value = "";
  document.getElementById("ingUnit").value = "";
  document.getElementById("ingUnitCost").value = "";
  document.getElementById("ingMinStock").value = "";
  document.getElementById("ingIsActive").checked = true;
  document.getElementById("ingredientModalTitle").textContent = "➕ Thêm nguyên liệu";
  document.getElementById("ingDeleteBtn").style.display = "none";
  document.getElementById("ingredientModal").classList.remove("hidden");
  document.getElementById("ingName").focus();
}

function openEditIngredient(id) {
  const ing = INV.getIngredientById(id);
  if (!ing) return;
  document.getElementById("ingId").value = ing.id;
  document.getElementById("ingName").value = ing.name;
  document.getElementById("ingUnit").value = ing.unit;
  document.getElementById("ingUnitCost").value = ing.unit_cost;
  document.getElementById("ingMinStock").value = ing.min_stock_qty ?? "";
  document.getElementById("ingIsActive").checked = ing.is_active;
  document.getElementById("ingredientModalTitle").textContent = "✏️ Sửa nguyên liệu";
  document.getElementById("ingDeleteBtn").style.display = isIngredientsReadOnly ? "none" : "inline-flex";
  document.getElementById("ingredientModal").classList.remove("hidden");
}

async function saveIngredient() {
  if (isIngredientsReadOnly) return;
  const rawId = document.getElementById("ingId").value;
  const id = rawId ? Number(rawId) : null;
  const name = document.getElementById("ingName").value.trim();
  const unit = document.getElementById("ingUnit").value.trim();
  const unit_cost = Number(document.getElementById("ingUnitCost").value);
  const min_stock_qty = Number(document.getElementById("ingMinStock").value) || 0;
  const is_active = document.getElementById("ingIsActive").checked;

  if (!name) { window.showToast("⚠️ Vui lòng nhập tên nguyên liệu.", "#e17055"); return; }
  if (!unit) { window.showToast("⚠️ Vui lòng nhập đơn vị.", "#e17055"); return; }
  if (!unit_cost || unit_cost < 0) { window.showToast("⚠️ Giá/đơn vị không hợp lệ.", "#e17055"); return; }

  const staff = currentSession.displayName || currentSession.username;
  const payload = { name, unit, unit_cost, min_stock_qty, is_active, updated_by: staff };

  try {
    if (id) {
      const { error } = await client.from("ingredients").update(payload).eq("id", id);
      if (error) throw error;
    } else {
      const { error } = await client.from("ingredients").insert({ ...payload, created_by: staff });
      if (error) throw error;
    }
    document.getElementById("ingredientModal").classList.add("hidden");
    window.showToast("✅ Đã lưu nguyên liệu!");
    await loadAndRenderIngredients();
  } catch (err) {
    if (err.code === "23505") window.showToast("⚠️ Nguyên liệu này (tên + đơn vị) đã tồn tại.", "#e17055");
    else window.showToast("❌ Lỗi: " + err.message, "#e17055");
  }
}

async function deleteIngredient() {
  if (isIngredientsReadOnly) return;
  const id = Number(document.getElementById("ingId").value);
  if (!id) return;
  const ing = INV.getIngredientById(id);

  const reason = await window.showReasonPrompt({
    title: `Ngừng dùng "${ing?.name || ''}"?`,
    message: "Nguyên liệu sẽ bị ẩn khỏi danh sách chọn công thức nhưng vẫn giữ lịch sử đã dùng trong các công thức/đơn hàng cũ.",
    reasonLabel: "Lý do ngừng dùng *",
    reasonPlaceholder: "VD: đổi nhà cung cấp, không còn dùng nguyên liệu này...",
    confirmText: "🗑️ Ngừng dùng",
    cancelText: "Huỷ",
  });
  if (reason === null) return;

  try {
    /* ⚠️ SOFT DELETE — drink_ingredients.ingredient_id là ON DELETE
       RESTRICT, xoá cứng sẽ lỗi FK nếu nguyên liệu đã gắn vào công
       thức nào. */
    const { error } = await client.from("ingredients")
      .update({
        deleted_at: new Date().toISOString(), is_active: false,
        deleted_reason: reason, deleted_by: currentSession.displayName || currentSession.username,
      }).eq("id", id);
    if (error) throw error;
    document.getElementById("ingredientModal").classList.add("hidden");
    window.showToast("🗑️ Đã ngừng dùng nguyên liệu", "#e17055");
    await loadAndRenderIngredients();
  } catch (err) {
    window.showToast("❌ Lỗi: " + err.message, "#e17055");
  }
}

/* ══════════════════════════════════════════════
   NHẬP KHO / ĐIỀU CHỈNH TỒN KHO
   ══════════════════════════════════════════════ */
function openStockModal(ingId) {
  if (isIngredientsReadOnly) return;
  const ing = INV.getIngredientById(ingId);
  if (!ing) return;

  document.getElementById("stockIngId").value = ingId;
  document.getElementById("stockIngName").textContent = `${ing.name} (${ing.unit})`;
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
