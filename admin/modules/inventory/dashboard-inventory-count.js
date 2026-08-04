/* ══════════════════════════════════════════════
   DASHBOARD INVENTORY COUNT — admin/modules/inventory/dashboard-inventory-count.js
   ─────────────────────────────────────────────
   MỚI. Tính năng "📋 Kiểm kê tồn kho" — phiếu đối chiếu tồn đầu ca /
   tồn cuối ca theo từng nguyên liệu, tách biệt hoàn toàn với tồn kho
   "đang chạy" (ingredient_stock_logs) — KHÔNG tự động ghi đè
   current_stock, chỉ dùng để đối chiếu/báo cáo.

   ⚠️ LUỒNG NGHIỆP VỤ (đã chốt với người dùng):
   1. Tạo phiếu: chọn cơ sở + ngày, thêm N dòng nguyên liệu kèm tồn
      đầu ca → sau khi tạo, KHÔNG thể thêm/bớt dòng hay đổi cơ sở/
      ngày nữa (kể cả Super Admin) — mã phiếu đã "đóng băng" theo
      ngày lúc tạo.
   2. Nộp tồn cuối: điền tồn cuối ca cho TẤT CẢ các dòng → bấm
      "Nộp tồn cuối" → khoá CẢ PHIẾU cùng lúc (status → completed).
   3. Sau khi khoá: Bar Staff không sửa được nữa (đúng "1 lần duy
      nhất"). Chỉ Super Admin sửa lại được (số lượng từng dòng),
      không giới hạn số lần, mỗi lần sửa đều ghi log.
   4. Vô hiệu hoá: CHỈ Super Admin, áp dụng cho TOÀN BỘ phiếu (không
      vô hiệu hoá từng dòng riêng lẻ), bắt buộc nhập lý do, không xoá
      cứng dữ liệu.

   ⚠️ QUYỀN HẠN RIÊNG — KHÔNG dùng chung window.AdminPermissions.
   isReadOnly()/RESTRICTED_PAGES như các module khác. Lý do: ở MỌI
   tính năng khác trong dự án, thứ tự quyền luôn là
   superadmin > editor > barstaff. Riêng tính năng này, Editor bị
   CHẶN HOÀN TOÀN trong khi Bar Staff vẫn tạo phiếu + nộp tồn cuối
   được — tức Editor < Bar Staff về quyền ở đúng trang này, ngược
   hẳn quy luật thông thường. Ép hình dạng quyền này vào
   READONLY_ROLES/RESTRICTED_PAGES dùng chung sẽ gây hiểu nhầm cho
   người đọc code sau (mặc định Editor luôn ≥ Bar Staff), nên định
   nghĩa RIÊNG, cục bộ trong file này.

   ⚠️ Cần chạy trước: migration SQL `sql/2026-08-inventory-count.sql`
   (tạo bảng branches, voucher_types, voucher_number_counters,
   inventory_counts, inventory_count_items, inventory_count_edit_logs).

   Cần: client, currentSession, window.AdminDashboard,
   window.AdminPermissions (chỉ dùng isSuperAdmin), window.Inventory
   (inventory-shared.js — PHẢI load trước file này để có danh sách
   nguyên liệu), window.escHtml / window.showToast / window.showConfirm /
   window.showReasonPrompt / window.debounce / window.formatDateVN
   (shared-utils.js).
   ══════════════════════════════════════════════ */

const isSuperAdminIC = window.AdminPermissions.isSuperAdmin(currentSession.role);
const isBarstaffIC   = currentSession.role === "barstaff";
const canAccessInventoryCountPage = isSuperAdminIC || isBarstaffIC; // ⚠️ Editor bị chặn hẳn

/* ══════════════════════════════════════════════
   window.Branches — helper DÙNG CHUNG nhẹ cho danh sách cơ sở
   (bảng multi-branch ĐẦU TIÊN trong dự án). Để ở đây vì hiện chỉ
   tính năng này cần tới; nếu sau này có thêm module dùng chung
   (nhập/xuất kho theo cơ sở...), có thể tách ra thành
   admin/modules/branches/branches-shared.js theo đúng pattern
   membership-shared.js / inventory-shared.js đã có.
   ══════════════════════════════════════════════ */
window.Branches = (function () {
  const state = { list: [] };

  async function loadBranches() {
    const { data, error } = await client.from("branches").select("*").order("id", { ascending: true });
    if (error) { console.error("[Branches] loadBranches:", error.message); return state.list; }
    state.list = data || [];
    return state.list;
  }

  function getBranchName(id) {
    const b = state.list.find(x => x.id === id);
    return b ? b.name : `Cơ sở #${id}`;
  }

  return { state, loadBranches, getBranchName };
})();

/* ══════════════════════════════════════════════
   Ẩn menu item tĩnh nếu role không được truy cập (Editor) — vì
   registerPage() bên dưới dùng placeholderId trỏ tới 1 phần tử ĐÃ
   CÓ SẴN trong dashboard.html; nếu guard() trả về false, registerPage
   sẽ return sớm và KHÔNG đụng gì tới phần tử đó — phải tự ẩn ở đây
   để Editor không thấy 1 link "chết" không bấm được trong sidebar.
   ══════════════════════════════════════════════ */
(function hideInventoryCountMenuIfNoAccess() {
  if (canAccessInventoryCountPage) return;
  document.getElementById("inventoryCountMenuItemPlaceholder")?.remove();
})();

/* ══════════════════════════════════════════════
   ĐĂNG KÝ MENU ITEM + PAGE
   ══════════════════════════════════════════════ */
window.AdminDashboard.registerPage({
  pageId: "inventoryCountPage",
  menuId: "inventoryCountMenuItem",
  placeholderId: "inventoryCountMenuItemPlaceholder", // đã có sẵn trong dashboard.html, ngay dưới "Đơn hàng"
  icon: "📋",
  label: "Kiểm kê tồn kho",
  guard: () => canAccessInventoryCountPage,
  onShow: () => {
    icOnShow();
  },
});

/* ══════════════════════════════════════════════
   STATE
   ══════════════════════════════════════════════ */
let icDateFrom      = new Date().toISOString().slice(0, 10);
let icDateTo        = icDateFrom;
let icBranchFilter  = "all";
let icStatusFilter  = "all";
let icSearchQ       = "";
let icListCache     = [];
let icCurrentDetail = null; // phiếu đang mở trong modal chi tiết

/* ══════════════════════════════════════════════
   INJECT PAGE HTML
   ══════════════════════════════════════════════ */
(function injectInventoryCountPage() {
  if (!canAccessInventoryCountPage) return;

  const main = document.querySelector(".main-content");
  if (!main) return;

  const page = document.createElement("div");
  page.id = "inventoryCountPage";
  page.style.display = "none";
  page.innerHTML = `
    <div class="page-header">
      <div>
        <h1 class="page-title">📋 Kiểm kê tồn kho</h1>
        <p class="page-subtitle">Đối chiếu tồn đầu ca / tồn cuối ca theo từng nguyên liệu — không ảnh hưởng tồn kho đang chạy</p>
      </div>
      <div class="header-actions">
        <button class="btn btn-primary" id="icOpenCreateBtn">➕ Tạo phiếu kiểm kê mới</button>
      </div>
    </div>

    <div class="table-card" style="padding:22px 24px;">
      <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:14px;flex-wrap:wrap;gap:10px;">
        <div style="font-size:14px;font-weight:700;">📅 Danh sách phiếu kiểm kê</div>
        <div style="display:flex;gap:6px;align-items:center;flex-wrap:wrap;">
          <input type="date" id="icDateFrom" style="height:38px;border:1px solid var(--border);border-radius:8px;padding:0 10px;font-size:13px;">
          <span style="color:var(--text-muted);font-size:13px;">→</span>
          <input type="date" id="icDateTo" style="height:38px;border:1px solid var(--border);border-radius:8px;padding:0 10px;font-size:13px;">
          <select id="icBranchFilterSelect" style="height:38px;border:1px solid var(--border);border-radius:8px;padding:0 10px;font-size:13px;">
            <option value="all">Tất cả cơ sở</option>
          </select>
          <select id="icStatusFilterSelect" style="height:38px;border:1px solid var(--border);border-radius:8px;padding:0 10px;font-size:13px;">
            <option value="all">Tất cả trạng thái</option>
            <option value="open">🟡 Đang mở</option>
            <option value="completed">🟢 Đã hoàn tất</option>
            <option value="voided">🔴 Đã vô hiệu hóa</option>
          </select>
          <button class="btn btn-secondary" id="icDateRefreshBtn">🔄</button>
        </div>
      </div>

      <div style="margin-bottom:16px;">
        <label for="icSearchInput" class="visually-hidden">Tìm theo mã phiếu hoặc tên nhân viên</label>
        <input type="text" id="icSearchInput" class="search-input" style="max-width:340px;" placeholder="🔍 Tìm theo mã phiếu hoặc tên nhân viên...">
      </div>

      <table class="game-table">
        <thead><tr><th></th><th>Mã phiếu</th><th>Ngày</th><th>Cơ sở</th><th>Số nguyên liệu</th><th>Người tạo</th><th>Trạng thái</th></tr></thead>
        <tbody id="icTableBody"><tr><td colspan="7" style="text-align:center;padding:30px;color:var(--text-muted);">⏳ Đang tải...</td></tr></tbody>
      </table>
    </div>

    <!-- ═══ MODAL: TẠO PHIẾU ═══ -->
    <div class="modal-overlay hidden" id="icCreateModal" role="dialog" aria-modal="true" aria-labelledby="icCreateModalTitle">
      <div class="modal-box" style="max-width:620px;">
        <div class="modal-header">
          <h2 id="icCreateModalTitle">➕ Tạo phiếu kiểm kê mới</h2>
          <button class="close-btn" id="closeICCreateModalBtn" aria-label="Đóng cửa sổ">✕</button>
        </div>

        <div class="form-grid" style="grid-template-columns:1fr 1fr;">
          <div class="form-group">
            <label for="icCreateBranch">Cơ sở *</label>
            <select id="icCreateBranch"></select>
          </div>
          <div class="form-group">
            <label for="icCreateDate">Ngày kiểm kê *</label>
            <input type="date" id="icCreateDate">
          </div>
        </div>

        <div style="margin-top:6px;">
          <label style="font-size:13px;font-weight:700;color:var(--text);margin-bottom:8px;display:block;">Nguyên liệu &amp; tồn đầu ca</label>
          <div id="icCreateRows" style="display:flex;flex-direction:column;gap:8px;"></div>
          <button type="button" class="btn btn-secondary" id="icCreateAddRowBtn" style="margin-top:10px;">+ Thêm nguyên liệu</button>
          <div class="hint" style="margin-top:8px;">Sau khi tạo phiếu, KHÔNG thể thêm/bớt nguyên liệu hay đổi cơ sở/ngày nữa — kiểm tra kỹ trước khi lưu.</div>
        </div>

        <div class="modal-actions" style="justify-content:flex-end;">
          <button class="btn btn-primary" id="icCreateSaveBtn">💾 Tạo phiếu</button>
        </div>
      </div>
    </div>

    <!-- ═══ MODAL: CHI TIẾT / NỘP TỒN CUỐI / SỬA / VÔ HIỆU HÓA ═══ -->
    <div class="modal-overlay hidden" id="icDetailModal" role="dialog" aria-modal="true" aria-labelledby="icDetailTitle">
      <div class="modal-box" style="max-width:700px;">
        <div class="modal-header">
          <h2 id="icDetailTitle">📋 Chi tiết phiếu</h2>
          <button class="close-btn" id="closeICDetailModalBtn" aria-label="Đóng cửa sổ">✕</button>
        </div>

        <div id="icDetailMeta" style="font-size:13px;color:var(--text-muted);display:flex;flex-direction:column;gap:4px;margin-bottom:16px;background:var(--bg);border-radius:10px;padding:12px 16px;"></div>

        <table class="game-table">
          <thead><tr><th>Nguyên liệu</th><th>Đơn vị</th><th>Tồn đầu ca</th><th>Tồn cuối ca</th></tr></thead>
          <tbody id="icDetailRows"></tbody>
        </table>

        <div style="margin-top:16px;">
          <div style="font-size:12px;font-weight:700;color:var(--text-muted);margin-bottom:6px;">🕘 Lịch sử chỉnh sửa</div>
          <div id="icDetailLogs" style="max-height:140px;overflow-y:auto;"></div>
        </div>

        <div class="modal-actions" style="justify-content:space-between;flex-wrap:wrap;gap:10px;">
          <button class="btn btn-danger" id="icDetailVoidBtn" style="display:none;">🗑️ Vô hiệu hóa phiếu</button>
          <div style="display:flex;gap:10px;">
            <button class="btn btn-secondary" id="icDetailSaveBtn" style="display:none;">💾 Lưu thay đổi</button>
            <button class="btn btn-primary" id="icDetailSubmitBtn" style="display:none;">✅ Nộp tồn cuối</button>
          </div>
        </div>
      </div>
    </div>
  `;

  main.appendChild(page);
  bindICPageEvents();
})();

/* ══════════════════════════════════════════════
   ON SHOW — mỗi lần vào trang: tải cơ sở, nguyên liệu, danh sách phiếu
   ══════════════════════════════════════════════ */
async function icOnShow() {
  await Promise.all([window.Branches.loadBranches(), window.Inventory.loadIngredients()]);
  icPopulateBranchSelects();
  loadInventoryCounts();
}

function icPopulateBranchSelects() {
  const active = window.Branches.state.list.filter(b => b.is_active);

  const filterSel = document.getElementById("icBranchFilterSelect");
  if (filterSel) {
    const current = filterSel.value || "all";
    filterSel.innerHTML = '<option value="all">Tất cả cơ sở</option>' +
      active.map(b => `<option value="${b.id}">${window.escHtml(b.name)}</option>`).join("");
    filterSel.value = current;
  }

  const createSel = document.getElementById("icCreateBranch");
  if (createSel) {
    createSel.innerHTML = active.map(b => `<option value="${b.id}">${window.escHtml(b.name)}</option>`).join("");
  }
}

/* ══════════════════════════════════════════════
   BIND EVENTS (chạy 1 lần lúc inject trang)
   ══════════════════════════════════════════════ */
function bindICPageEvents() {
  document.getElementById("icOpenCreateBtn")?.addEventListener("click", icOpenCreateModal);
  document.getElementById("closeICCreateModalBtn")?.addEventListener("click", closeICCreateModal);
  document.getElementById("icCreateAddRowBtn")?.addEventListener("click", () => icAddCreateRow());
  document.getElementById("icCreateSaveBtn")?.addEventListener("click", icSaveCreate);

  const createModal = document.getElementById("icCreateModal");
  createModal?.addEventListener("click", e => { if (e.target === createModal) closeICCreateModal(); });
  createModal?.addEventListener("keydown", e => { if (e.key === "Escape") closeICCreateModal(); });

  document.getElementById("closeICDetailModalBtn")?.addEventListener("click", closeICDetailModal);
  document.getElementById("icDetailSaveBtn")?.addEventListener("click", icSaveDetailEdit);
  document.getElementById("icDetailSubmitBtn")?.addEventListener("click", icSubmitClosing);
  document.getElementById("icDetailVoidBtn")?.addEventListener("click", icVoid);

  const detailModal = document.getElementById("icDetailModal");
  detailModal?.addEventListener("click", e => { if (e.target === detailModal) closeICDetailModal(); });
  detailModal?.addEventListener("keydown", e => { if (e.key === "Escape") closeICDetailModal(); });

  document.getElementById("icDateFrom").value = icDateFrom;
  document.getElementById("icDateTo").value   = icDateTo;
  document.getElementById("icDateFrom")?.addEventListener("change", icHandleDateRangeChange);
  document.getElementById("icDateTo")?.addEventListener("change", icHandleDateRangeChange);
  document.getElementById("icDateRefreshBtn")?.addEventListener("click", loadInventoryCounts);

  document.getElementById("icBranchFilterSelect")?.addEventListener("change", e => {
    icBranchFilter = e.target.value; renderICTable();
  });
  document.getElementById("icStatusFilterSelect")?.addEventListener("change", e => {
    icStatusFilter = e.target.value; renderICTable();
  });
  document.getElementById("icSearchInput")?.addEventListener("input", window.debounce(e => {
    icSearchQ = e.target.value.trim().toLowerCase();
    renderICTable();
  }, 200));
}

function icHandleDateRangeChange() {
  icDateFrom = document.getElementById("icDateFrom").value || icDateFrom;
  icDateTo   = document.getElementById("icDateTo").value   || icDateTo;
  if (icDateFrom > icDateTo) [icDateFrom, icDateTo] = [icDateTo, icDateFrom];
  document.getElementById("icDateFrom").value = icDateFrom;
  document.getElementById("icDateTo").value   = icDateTo;
  loadInventoryCounts();
}

/* ══════════════════════════════════════════════
   TẠO PHIẾU — modal + dòng động (thêm/xoá nguyên liệu)
   ══════════════════════════════════════════════ */
function icOpenCreateModal() {
  if (!canAccessInventoryCountPage) return;
  if (!window.Branches.state.list.length) {
    window.showToast("⏳ Đang tải dữ liệu cơ sở, vui lòng thử lại sau giây lát.", "#e17055");
    return;
  }
  document.getElementById("icCreateRows").innerHTML = "";
  document.getElementById("icCreateDate").value = new Date().toISOString().slice(0, 10);
  icPopulateBranchSelects();
  icAddCreateRow();
  document.getElementById("icCreateModal").classList.remove("hidden");
}
function closeICCreateModal() {
  document.getElementById("icCreateModal")?.classList.add("hidden");
}

function icIngredientOptionsHtml(selectedId) {
  const active = (window.Inventory.state.ingredients || []).filter(i => i.is_active);
  return '<option value="">-- Chọn nguyên liệu --</option>' + active.map(i =>
    `<option value="${i.id}" data-unit="${window.escHtml(i.unit)}" ${i.id === selectedId ? "selected" : ""}>${window.escHtml(i.name)}</option>`
  ).join("");
}

function icAddCreateRow() {
  const wrap = document.getElementById("icCreateRows");
  if (!wrap) return;

  const div = document.createElement("div");
  div.className = "ic-create-row";
  div.style.cssText = "display:grid;grid-template-columns:2fr 0.8fr 1fr auto;gap:8px;align-items:center;";
  div.innerHTML = `
    <select class="ic-row-ingredient" style="height:40px;border:1px solid var(--border);border-radius:8px;padding:0 8px;font-size:13px;">
      ${icIngredientOptionsHtml()}
    </select>
    <div class="ic-row-unit" style="font-size:13px;color:var(--text-muted);text-align:center;">—</div>
    <input type="number" class="ic-row-opening" min="0" step="0.01" placeholder="Tồn đầu ca" style="height:40px;border:1px solid var(--border);border-radius:8px;padding:0 8px;font-size:13px;">
    <button type="button" class="close-btn ic-row-remove" title="Xoá dòng" style="width:36px;height:36px;">✕</button>
  `;
  wrap.appendChild(div);

  const select = div.querySelector(".ic-row-ingredient");
  const unitEl = div.querySelector(".ic-row-unit");
  select.addEventListener("change", () => {
    const opt = select.selectedOptions[0];
    unitEl.textContent = (opt && opt.value) ? opt.dataset.unit : "—";
  });
  div.querySelector(".ic-row-remove").addEventListener("click", () => div.remove());
}

function icReadCreateRows() {
  return [...document.querySelectorAll("#icCreateRows .ic-create-row")].map(div => {
    const select = div.querySelector(".ic-row-ingredient");
    const opt = select.selectedOptions[0];
    return {
      ingredient_id: Number(select.value) || null,
      ingredient_name: (opt && opt.value) ? opt.textContent.trim() : "",
      unit: (opt && opt.value) ? opt.dataset.unit : "",
      opening_qty: div.querySelector(".ic-row-opening").value,
    };
  }).filter(r => r.ingredient_id);
}

async function icSaveCreate() {
  if (!canAccessInventoryCountPage) return;

  const branchId  = Number(document.getElementById("icCreateBranch").value) || null;
  const countDate = document.getElementById("icCreateDate").value;
  if (!branchId)  { window.showToast("⚠️ Vui lòng chọn cơ sở.", "#e17055"); return; }
  if (!countDate) { window.showToast("⚠️ Vui lòng chọn ngày kiểm kê.", "#e17055"); return; }

  const rows = icReadCreateRows();
  if (!rows.length) { window.showToast("⚠️ Vui lòng thêm ít nhất 1 nguyên liệu.", "#e17055"); return; }

  const seen = new Set();
  for (const r of rows) {
    if (seen.has(r.ingredient_id)) {
      window.showToast(`⚠️ Nguyên liệu "${r.ingredient_name}" bị chọn trùng — mỗi nguyên liệu chỉ được 1 dòng.`, "#e17055");
      return;
    }
    seen.add(r.ingredient_id);
    if (r.opening_qty === "" || r.opening_qty === null || Number(r.opening_qty) < 0) {
      window.showToast(`⚠️ Vui lòng nhập tồn đầu ca hợp lệ cho "${r.ingredient_name}".`, "#e17055");
      return;
    }
  }

  const staff = currentSession.displayName || currentSession.username;
  const btn = document.getElementById("icCreateSaveBtn");
  btn.disabled = true; btn.textContent = "Đang tạo...";

  let headerId = null;
  try {
    const { data: header, error: hErr } = await client.from("inventory_counts")
      .insert({ branch_id: branchId, count_date: countDate, created_by: staff })
      .select().single();
    if (hErr) throw hErr;
    headerId = header.id;

    const itemsPayload = rows.map(r => ({
      inventory_count_id: header.id,
      ingredient_id: r.ingredient_id,
      ingredient_name_snapshot: r.ingredient_name,
      unit_snapshot: r.unit,
      opening_qty: Number(r.opening_qty),
    }));

    try {
      const { error: iErr } = await client.from("inventory_count_items").insert(itemsPayload);
      if (iErr) throw iErr;
    } catch (itemErr) {
      /* Không có transaction đa câu lệnh qua REST API → tự "rollback"
         bằng cách xoá header vừa tạo nếu phần dòng nguyên liệu lỗi,
         tránh để lại 1 phiếu rỗng không có dòng nào. */
      await client.from("inventory_counts").delete().eq("id", header.id);
      throw itemErr;
    }

    await client.from("inventory_count_edit_logs").insert({
      inventory_count_id: header.id, action: "create", edited_by: staff,
      note: `Tạo phiếu với ${rows.length} nguyên liệu`,
    });

    window.showToast(`✅ Đã tạo phiếu ${header.voucher_number}!`);
    closeICCreateModal();
    loadInventoryCounts();
  } catch (err) {
    window.showToast("❌ Lỗi: " + err.message, "#e17055");
  } finally {
    btn.disabled = false; btn.textContent = "💾 Tạo phiếu";
  }
}

/* ══════════════════════════════════════════════
   DANH SÁCH PHIẾU — tải theo khoảng ngày, lọc theo cơ sở/trạng thái/tìm kiếm
   ══════════════════════════════════════════════ */
async function loadInventoryCounts() {
  const tbody = document.getElementById("icTableBody");
  tbody.innerHTML = `<tr><td colspan="7" style="text-align:center;padding:30px;color:var(--text-muted);">⏳ Đang tải...</td></tr>`;

  const { data, error } = await client
    .from("inventory_counts")
    .select("*, inventory_count_items(*)")
    .gte("count_date", icDateFrom)
    .lte("count_date", icDateTo)
    .order("created_at", { ascending: false });

  if (error) {
    tbody.innerHTML = `<tr><td colspan="7" style="text-align:center;padding:30px;color:var(--danger);">Lỗi: ${window.escHtml(error.message)}</td></tr>`;
    return;
  }

  icListCache = data || [];
  renderICTable();
}

function getFilteredIC() {
  return icListCache.filter(h => {
    if (icBranchFilter !== "all" && String(h.branch_id) !== icBranchFilter) return false;
    if (icStatusFilter !== "all" && h.status !== icStatusFilter) return false;
    if (icSearchQ) {
      const hay = `${h.voucher_number} ${h.created_by} ${h.closing_submitted_by || ""}`.toLowerCase();
      if (!hay.includes(icSearchQ)) return false;
    }
    return true;
  });
}

function icStatusBadge(status) {
  if (status === "open")      return '<span class="badge" style="background:#fff3cd;color:#7d5a00;">🟡 Đang mở</span>';
  if (status === "completed") return '<span class="badge" style="background:#e8f8f0;color:#00b894;">🟢 Đã hoàn tất</span>';
  return '<span class="badge" style="background:#fdecea;color:var(--danger);">🔴 Đã vô hiệu hóa</span>';
}

function icActionLabel(action) {
  return {
    create: "➕ Tạo phiếu",
    admin_edit: "✏️ Super Admin sửa",
    submit_closing: "✅ Nộp tồn cuối",
    void: "🗑️ Vô hiệu hóa",
  }[action] || action;
}

function renderICTable() {
  const tbody = document.getElementById("icTableBody");
  const list = getFilteredIC();

  if (!list.length) {
    tbody.innerHTML = `<tr><td colspan="7" style="text-align:center;padding:30px;color:var(--text-muted);">${
      icListCache.length ? "Không tìm thấy phiếu phù hợp với bộ lọc hiện tại." : "Không có phiếu kiểm kê nào trong khoảng ngày này."
    }</td></tr>`;
    return;
  }

  tbody.innerHTML = list.map(h => {
    const items = h.inventory_count_items || [];
    const branchName = window.Branches.getBranchName(h.branch_id);
    return `
      <tr class="ic-row" data-ic-row="${h.id}" style="cursor:pointer;${h.status === "voided" ? "opacity:.55;" : ""}">
        <td style="width:28px;"><span data-ic-caret="${h.id}">▸</span></td>
        <td><b>${window.escHtml(h.voucher_number)}</b></td>
        <td>${window.formatDateVN(h.count_date)}</td>
        <td>${window.escHtml(branchName)}</td>
        <td>${items.length} nguyên liệu</td>
        <td>${window.escHtml(h.created_by)}</td>
        <td>${icStatusBadge(h.status)}</td>
      </tr>
      <tr class="hidden" id="icDetailRow-${h.id}">
        <td></td>
        <td colspan="6" style="background:var(--bg);padding:14px 20px;">
          ${items.map(it => `
            <div style="display:flex;justify-content:space-between;padding:4px 0;font-size:13px;border-bottom:1px solid var(--border);">
              <span>${window.escHtml(it.ingredient_name_snapshot)} <span style="color:var(--text-muted);">(${window.escHtml(it.unit_snapshot)})</span></span>
              <span>Đầu ca: <b>${it.opening_qty}</b> · Cuối ca: <b>${it.closing_qty ?? "—"}</b></span>
            </div>`).join("") || '<span style="color:var(--text-muted);">Không có nguyên liệu.</span>'}
          <button class="btn btn-secondary" style="margin-top:10px;font-size:12px;padding:6px 12px;" data-ic-open="${h.id}">🔍 Xem chi tiết / thao tác</button>
        </td>
      </tr>
    `;
  }).join("");

  tbody.querySelectorAll(".ic-row").forEach(row => {
    row.addEventListener("click", () => {
      const id = row.dataset.icRow;
      const detailRow = document.getElementById(`icDetailRow-${id}`);
      const caret = row.querySelector(`[data-ic-caret="${id}"]`);
      const isOpenNow = !detailRow.classList.contains("hidden");
      detailRow.classList.toggle("hidden", isOpenNow);
      caret.textContent = isOpenNow ? "▸" : "▾";
    });
  });
  tbody.querySelectorAll("[data-ic-open]").forEach(btn => {
    btn.addEventListener("click", e => { e.stopPropagation(); icOpenDetail(Number(btn.dataset.icOpen)); });
  });
}

/* ══════════════════════════════════════════════
   CHI TIẾT PHIẾU — nộp tồn cuối / sửa (Super Admin) / vô hiệu hóa
   ══════════════════════════════════════════════ */
async function icOpenDetail(id) {
  const { data: header, error } = await client
    .from("inventory_counts")
    .select("*, inventory_count_items(*)")
    .eq("id", id).single();
  if (error || !header) { window.showToast("⚠️ Không tải được phiếu.", "#e17055"); return; }

  const { data: logs } = await client
    .from("inventory_count_edit_logs")
    .select("*").eq("inventory_count_id", id)
    .order("edited_at", { ascending: false });

  icCurrentDetail = header;
  icRenderDetail(header, logs || []);
  document.getElementById("icDetailModal").classList.remove("hidden");
}

function closeICDetailModal() {
  document.getElementById("icDetailModal")?.classList.add("hidden");
  icCurrentDetail = null;
}

function icRenderDetail(header, logs) {
  const isVoided    = header.status === "voided";
  const isOpenPhieu = header.status === "open";

  const canEditOpening   = !isVoided && isSuperAdminIC;
  const canEditClosing   = !isVoided && (isSuperAdminIC || (isBarstaffIC && isOpenPhieu));
  const canSubmitClosing = isOpenPhieu && (isSuperAdminIC || isBarstaffIC);
  const canSaveEdit      = !isVoided && isSuperAdminIC;
  const canVoid          = !isVoided && isSuperAdminIC;

  document.getElementById("icDetailTitle").textContent = `📋 Phiếu ${header.voucher_number}`;

  document.getElementById("icDetailMeta").innerHTML = `
    <div>Cơ sở: <b>${window.escHtml(window.Branches.getBranchName(header.branch_id))}</b> · Ngày kiểm kê: <b>${window.formatDateVN(header.count_date)}</b></div>
    <div>Người tạo: <b>${window.escHtml(header.created_by)}</b></div>
    ${header.closing_submitted_by ? `<div>Người nộp tồn cuối: <b>${window.escHtml(header.closing_submitted_by)}</b> · ${new Date(header.closing_submitted_at).toLocaleString("vi-VN")}</div>` : ""}
    <div>Trạng thái: ${icStatusBadge(header.status)}</div>
    ${isVoided ? `<div style="color:var(--danger);">⚠️ Lý do vô hiệu hóa: ${window.escHtml(header.voided_reason || "")} — bởi ${window.escHtml(header.voided_by || "")} lúc ${header.voided_at ? new Date(header.voided_at).toLocaleString("vi-VN") : ""}</div>` : ""}
  `;

  const items = header.inventory_count_items || [];
  document.getElementById("icDetailRows").innerHTML = items.map(it => `
    <tr data-item-id="${it.id}">
      <td>${window.escHtml(it.ingredient_name_snapshot)}</td>
      <td>${window.escHtml(it.unit_snapshot)}</td>
      <td>${canEditOpening
          ? `<input type="number" class="ic-edit-opening" min="0" step="0.01" value="${it.opening_qty}" style="width:110px;height:36px;border:1px solid var(--border);border-radius:8px;padding:0 8px;">`
          : `<b>${it.opening_qty}</b>`}</td>
      <td>${canEditClosing
          ? `<input type="number" class="ic-edit-closing" min="0" step="0.01" value="${it.closing_qty ?? ""}" placeholder="Nhập tồn cuối" style="width:110px;height:36px;border:1px solid var(--border);border-radius:8px;padding:0 8px;">`
          : (it.closing_qty !== null && it.closing_qty !== undefined ? `<b>${it.closing_qty}</b>` : '<span style="color:var(--text-muted);">— chưa nhập —</span>')}
      </td>
    </tr>
  `).join("");

  const saveBtn   = document.getElementById("icDetailSaveBtn");
  const submitBtn = document.getElementById("icDetailSubmitBtn");
  const voidBtn   = document.getElementById("icDetailVoidBtn");
  saveBtn.style.display   = canSaveEdit      ? "inline-flex" : "none";
  submitBtn.style.display = canSubmitClosing ? "inline-flex" : "none";
  voidBtn.style.display   = canVoid          ? "inline-flex" : "none";

  document.getElementById("icDetailLogs").innerHTML = logs.length
    ? logs.map(l => `
        <div style="font-size:12px;color:var(--text-muted);padding:5px 0;border-bottom:1px solid var(--border);">
          ${icActionLabel(l.action)} · <b style="color:var(--text);">${window.escHtml(l.edited_by)}</b> · ${new Date(l.edited_at).toLocaleString("vi-VN")}
          ${l.note ? `<div style="margin-top:2px;">${window.escHtml(l.note)}</div>` : ""}
        </div>`).join("")
    : '<div style="font-size:12px;color:var(--text-muted);">Chưa có log.</div>';
}

/* ── Super Admin: Lưu thay đổi (không đổi trạng thái phiếu) ── */
async function icSaveDetailEdit() {
  if (!icCurrentDetail || !isSuperAdminIC) return;

  const rows = [...document.querySelectorAll("#icDetailRows tr")].map(tr => {
    const openingInput = tr.querySelector(".ic-edit-opening");
    const closingInput = tr.querySelector(".ic-edit-closing");
    const payload = {};
    if (openingInput) payload.opening_qty = Number(openingInput.value) || 0;
    if (closingInput) payload.closing_qty = closingInput.value === "" ? null : Number(closingInput.value);
    return { id: Number(tr.dataset.itemId), payload };
  });

  const staff = currentSession.displayName || currentSession.username;
  const btn = document.getElementById("icDetailSaveBtn");
  btn.disabled = true; btn.textContent = "Đang lưu...";

  try {
    for (const r of rows) {
      if (!Object.keys(r.payload).length) continue;
      const { error } = await client.from("inventory_count_items").update(r.payload).eq("id", r.id);
      if (error) throw error;
    }

    await client.from("inventory_count_edit_logs").insert({
      inventory_count_id: icCurrentDetail.id, action: "admin_edit", edited_by: staff,
      note: "Cập nhật số liệu (không đổi trạng thái phiếu)",
    });

    window.showToast("✅ Đã lưu thay đổi!");
    await icOpenDetail(icCurrentDetail.id);
    loadInventoryCounts();
  } catch (err) {
    window.showToast("❌ Lỗi: " + err.message, "#e17055");
  } finally {
    btn.disabled = false; btn.textContent = "💾 Lưu thay đổi";
  }
}

/* ── Nộp tồn cuối — khoá CẢ PHIẾU cùng lúc ── */
async function icSubmitClosing() {
  if (!icCurrentDetail) return;

  const rows = [...document.querySelectorAll("#icDetailRows tr")].map(tr => ({
    id: Number(tr.dataset.itemId),
    input: tr.querySelector(".ic-edit-closing"),
    name: tr.children[0].textContent,
  }));

  const missing = rows.filter(r => !r.input || r.input.value === "" || Number(r.input.value) < 0);
  if (missing.length) {
    window.showToast(`⚠️ Vui lòng nhập đủ tồn cuối ca cho: ${missing.map(m => m.name).join(", ")}`, "#e17055");
    return;
  }

  const ok = await window.showConfirm({
    title: "Nộp tồn cuối ca?",
    message: isSuperAdminIC
      ? 'Phiếu sẽ chuyển sang trạng thái "Đã hoàn tất". Bạn (Super Admin) vẫn có thể sửa lại sau nếu cần.'
      : "Sau khi nộp, phiếu sẽ bị KHOÁ — bạn không thể sửa lại tồn cuối ca nữa. Chỉ Super Admin mới sửa được.",
    confirmText: "✅ Xác nhận nộp",
    cancelText: "Để sau",
    danger: false,
  });
  if (!ok) return;

  const staff = currentSession.displayName || currentSession.username;
  const btn = document.getElementById("icDetailSubmitBtn");
  btn.disabled = true; btn.textContent = "Đang nộp...";

  try {
    for (const r of rows) {
      const { error } = await client.from("inventory_count_items")
        .update({ closing_qty: Number(r.input.value) }).eq("id", r.id);
      if (error) throw error;
    }

    const { error: hErr } = await client.from("inventory_counts").update({
      status: "completed",
      closing_submitted_by: staff,
      closing_submitted_at: new Date().toISOString(),
    }).eq("id", icCurrentDetail.id);
    if (hErr) throw hErr;

    await client.from("inventory_count_edit_logs").insert({
      inventory_count_id: icCurrentDetail.id, action: "submit_closing", edited_by: staff,
      note: "Nộp tồn cuối ca — phiếu đã khoá",
    });

    window.showToast("✅ Đã nộp tồn cuối — phiếu đã khoá!");
    closeICDetailModal();
    loadInventoryCounts();
  } catch (err) {
    window.showToast("❌ Lỗi: " + err.message, "#e17055");
  } finally {
    btn.disabled = false; btn.textContent = "✅ Nộp tồn cuối";
  }
}

/* ── Vô hiệu hóa — chỉ Super Admin, cả phiếu, bắt buộc lý do ── */
async function icVoid() {
  if (!icCurrentDetail || !isSuperAdminIC) return;

  const reason = await window.showReasonPrompt({
    title: `Vô hiệu hóa phiếu ${icCurrentDetail.voucher_number}?`,
    message: "Phiếu sẽ bị ẩn khỏi các phiếu đang hoạt động nhưng toàn bộ dữ liệu vẫn được giữ nguyên để tra soát khi cần — không xoá cứng.",
    reasonLabel: "Lý do vô hiệu hóa *",
    reasonPlaceholder: "VD: tạo nhầm, trùng phiếu, sai cơ sở...",
    confirmText: "🗑️ Vô hiệu hóa",
    cancelText: "Huỷ",
  });
  if (reason === null) return;

  const staff = currentSession.displayName || currentSession.username;

  try {
    const { error } = await client.from("inventory_counts").update({
      status: "voided",
      voided_at: new Date().toISOString(),
      voided_by: staff,
      voided_reason: reason,
    }).eq("id", icCurrentDetail.id);
    if (error) throw error;

    await client.from("inventory_count_edit_logs").insert({
      inventory_count_id: icCurrentDetail.id, action: "void", edited_by: staff, note: reason,
    });

    window.showToast("🗑️ Đã vô hiệu hóa phiếu", "#e17055");
    closeICDetailModal();
    loadInventoryCounts();
  } catch (err) {
    window.showToast("❌ Lỗi: " + err.message, "#e17055");
  }
}
