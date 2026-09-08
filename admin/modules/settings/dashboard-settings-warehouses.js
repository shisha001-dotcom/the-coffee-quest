/* ══════════════════════════════════════════════
   DASHBOARD SETTINGS — TAB KHO (branches)
   admin/modules/settings/dashboard-settings-warehouses.js
   ─────────────────────────────────────────────
   ⚠️ TÁCH RA từ admin/modules/dashboard-settings.js (file gốc đã
   bị xoá). Chỉ còn lo tab "🏬 Kho": CRUD bảng `branches`.

   Cần: client, currentSession, window.Branches (đã load ở
   modules/inventory/dashboard-inventory-count.js — trước đó rất
   xa trong SCRIPT_SEQUENCE), isSettingsReadOnly (settings-shared.js
   — PHẢI load ngay trước file này), window.escHtml / showToast /
   showFieldError / clearFieldError (shared-utils.js).
   ══════════════════════════════════════════════ */

(function injectWarehousesTab() {
  const container = document.getElementById("stTabWarehouses");
  if (!container) return;

  container.innerHTML = `
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
  `;

  bindWarehouseEvents();
})();

function bindWarehouseEvents() {
  document.getElementById("whAddBtn")?.addEventListener("click", openAddWarehouse);
  document.getElementById("closeWarehouseModalBtn")?.addEventListener("click", () =>
    document.getElementById("warehouseModal").classList.add("hidden"));
  document.getElementById("whSaveBtn")?.addEventListener("click", saveWarehouse);

  const m = document.getElementById("warehouseModal");
  m?.addEventListener("click", e => { if (e.target === m) m.classList.add("hidden"); });
  m?.addEventListener("keydown", e => { if (e.key === "Escape") m.classList.add("hidden"); });

  if (isSettingsReadOnly) {
    const btn = document.getElementById("whAddBtn");
    if (btn) btn.style.display = "none";
  }
}

/* ══════════════════════════════════════════════
   LOAD + RENDER
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

  tbody.querySelectorAll("[data-wh-edit]").forEach(btn =>
    btn.addEventListener("click", () => openEditWarehouse(Number(btn.dataset.whEdit))));
}

/* ══════════════════════════════════════════════
   ADD / EDIT / SAVE
   ══════════════════════════════════════════════ */
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
   ĐĂNG KÝ HOOK CHO SETTINGS SHARED
   ══════════════════════════════════════════════ */
window.SettingsTabs.onShowHandlers.warehouses = loadWarehouses;
