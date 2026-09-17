/* ══════════════════════════════════════════════
   DASHBOARD INGREDIENTS — admin/modules/inventory/dashboard-ingredients.js
   ─────────────────────────────────────────────
   ⚠️ VIẾT LẠI — "Điều chỉnh kho" theo yêu cầu:
   - Bỏ nút "📦 Quản lý sản phẩm (Settings)" ở đầu trang. Vẫn giữ
     nút "✏️ Sửa ở Settings" trên từng dòng vì đó là nơi DUY NHẤT
     sửa thông tin GỐC của sản phẩm (tên/đơn vị/giá tham chiếu) —
     trang này không có chỗ nào khác để làm việc đó.
   - Modal "📥 Nhập/Điều chỉnh" cũ (không phân biệt kho) bị THAY
     bằng modal "🔄 Điều chỉnh kho" MỚI, đúng 3 loại phiếu:
       1. 📥 Nhập kho  — cộng vào 1 kho được chọn
       2. 📤 Xuất kho  — trừ khỏi 1 kho, bắt buộc còn đủ tồn tại
          ĐÚNG kho đó, không cho phép trừ xuống dưới 0
       3. 🔀 Chuyển kho — trừ ở kho nguồn + cộng ở kho đích, ghi
          2 dòng log liên kết qua transfer_group; cũng kiểm tra đủ
          tồn ở kho nguồn trước khi cho lưu, không cho nguồn = đích
   - Mỗi phiếu bắt buộc chọn 1 sản phẩm đã khai báo ở Settings
     (tham chiếu ingredients.id, không gõ tay) → tự hiện đơn vị
     tính + đơn giá tham chiếu (vẫn sửa lại được riêng cho phiếu
     này, VD giá nhập đợt này khác giá cũ).
   - Tự tính Tiền chưa thuế / Tiền thuế / Tiền có thuế theo Số
     lượng × Đơn giá × Thuế suất — có nút "🔓 Cho sửa tay" nếu hoá
     đơn thực tế lệch khỏi công thức thuần (làm tròn, chiết khấu...).
   - Thêm: lý do (bán hàng/hao hụt/kiểm kê/nội bộ...), đối tác
     (NCC/người nhận), ngày lập phiếu (cho phép nhập liệu trễ), số
     phiếu tự sinh (PNK/PXK/PCK — nếu đã chạy migration trigger).
   - Mỗi dòng sản phẩm giờ xem được tồn kho theo TỪNG KHO (▸ để xổ
     ra) — trước đây chỉ có 1 con số gộp chung mọi kho.

   ⚠️ CẦN CHẠY MIGRATION SQL (branch_id/tax_rate/unit_price/
   amount_pre_tax/tax_amount/amount_with_tax/transfer_group/
   related_branch_id/reason/voucher_number trên
   ingredient_stock_logs) TRƯỚC khi dùng — xem file đính kèm.

   Cần: client, currentSession, window.AdminPermissions,
   window.Inventory (đã nâng cấp — getStockInBranch/getStockBreakdown),
   window.Branches (dashboard-inventory-count.js — chỉ cần tồn tại
   lúc onShow, không cần lúc file này load), window.escHtml /
   window.showToast / window.debounce (shared-utils.js),
   window.Membership.formatVND (nếu đã load),
   window.openProductInSettings (dashboard-settings.js).
   ══════════════════════════════════════════════ */

const INV = window.Inventory;
const isIngredientsReadOnly = INV.isReadOnly;
let ingSearchQ = "";
let saCurrentType = "in"; // "in" | "out" | "transfer" — loại phiếu đang mở trong modal

const SA_REASONS = {
  in: [
    { v: "purchase", l: "Mua hàng mới" },
    { v: "count_adjust_up", l: "Kiểm kê điều chỉnh tăng" },
    { v: "customer_return", l: "Khách trả hàng" },
    { v: "other", l: "Khác" },
  ],
  out: [
    { v: "sale_consume", l: "Bán hàng / tiêu hao" },
    { v: "damaged", l: "Hao hụt / hư hỏng / hết hạn" },
    { v: "count_adjust_down", l: "Kiểm kê điều chỉnh giảm" },
    { v: "internal_use", l: "Dùng nội bộ" },
    { v: "other", l: "Khác" },
  ],
  transfer: [
    { v: "rebalance", l: "Điều chuyển cân đối giữa các kho" },
    { v: "count_adjust", l: "Kiểm kê điều chỉnh" },
    { v: "other", l: "Khác" },
  ],
};

function round2(n) { return Math.round((Number(n) || 0) * 100) / 100; }
function fmtVND(n) {
  return window.Membership ? window.Membership.formatVND(n) : Math.round(n).toLocaleString("vi-VN") + " đ";
}

window.AdminDashboard.registerPage({
  pageId: "ingredientsPage",
  menuId: "ingredientsMenuItem",
  icon: "📦",
  label: "Kho nguyên liệu",
  onShow: () => {
    window.Branches?.loadBranches?.().then(populateStockBranchSelects);
    loadAndRenderIngredients();
  },
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
        <p class="page-subtitle">Tồn kho hiện tại theo từng kho &amp; lập phiếu Nhập/Xuất/Chuyển kho. Tạo mới hoặc sửa thông tin gốc của sản phẩm ở ⚙️ Settings → 📦 Sản phẩm.</p>
      </div>
      <div class="header-actions">
        <button class="btn btn-secondary" id="ingRefreshBtn">🔄 Refresh</button>
        <button class="btn btn-primary" id="ingOpenAdjustBtn">🔄 Điều chỉnh kho</button>
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
          <th></th><th>Mã SP</th><th>Nguyên liệu / Thành phẩm</th><th>Loại</th><th>Đơn vị</th><th>Giá/đơn vị</th><th>Tồn kho (mọi kho)</th><th>Tối thiểu</th><th>Hành động</th>
        </tr></thead>
        <tbody id="ingTableBody"><tr><td colspan="9" style="text-align:center;padding:40px;color:var(--text-muted);">⏳ Đang tải...</td></tr></tbody>
      </table>
    </div>

    <!-- ═══ MODAL: ĐIỀU CHỈNH KHO (Nhập / Xuất / Chuyển) ═══ -->
    <div class="modal-overlay hidden" id="stockAdjustModal" role="dialog" aria-modal="true" aria-labelledby="stockAdjustTitle">
      <div class="modal-box" style="max-width:640px;">
        <div class="modal-header">
          <h2 id="stockAdjustTitle">🔄 Điều chỉnh kho</h2>
          <button class="close-btn" id="closeStockAdjustBtn" aria-label="Đóng cửa sổ">✕</button>
        </div>

        <div style="display:flex;gap:8px;margin-bottom:18px;">
          <button type="button" class="btn btn-primary sa-type-btn"   data-type="in"       id="saTypeInBtn">📥 Nhập kho</button>
          <button type="button" class="btn btn-secondary sa-type-btn" data-type="out"      id="saTypeOutBtn">📤 Xuất kho</button>
          <button type="button" class="btn btn-secondary sa-type-btn" data-type="transfer" id="saTypeTransferBtn">🔀 Chuyển kho</button>
        </div>

        <div class="form-grid">
          <div class="form-group full-width">
            <label for="saProduct">Sản phẩm (Mã — Tên) *</label>
            <select id="saProduct"><option value="">-- Chọn sản phẩm đã khai báo ở Settings --</option></select>
          </div>

          <div class="form-group">
            <label for="saUnit">Đơn vị tính</label>
            <input type="text" id="saUnit" readonly style="background:var(--bg);color:var(--text-muted);">
          </div>
          <div class="form-group">
            <label for="saUnitPrice">Đơn giá cho phiếu này (đ) *</label>
            <input type="number" id="saUnitPrice" min="0" step="0.01">
            <div class="hint" id="saUnitPriceHint"></div>
          </div>

          <div class="form-group" id="saBranchFromGroup">
            <label for="saBranchFrom" id="saBranchFromLabel">Kho xuất *</label>
            <select id="saBranchFrom"></select>
          </div>
          <div class="form-group" id="saBranchToGroup">
            <label for="saBranchTo" id="saBranchToLabel">Kho nhận *</label>
            <select id="saBranchTo"></select>
          </div>

          <div class="form-group">
            <label for="saQty">Số lượng *</label>
            <input type="number" id="saQty" min="0.01" step="0.01">
          </div>
          <div class="form-group">
            <label for="saTaxRate">Thuế suất (%)</label>
            <input type="number" id="saTaxRate" min="0" max="100" step="0.1" value="0" list="saTaxPresets">
            <datalist id="saTaxPresets">
              <option value="0"><option value="5"><option value="8"><option value="10">
            </datalist>
          </div>

          <div class="section-divider"><span>💵 Giá trị phiếu</span></div>

          <div class="form-group full-width" style="flex-direction:row;align-items:center;gap:8px;">
            <input type="checkbox" id="saManualMoney" style="width:18px;height:18px;">
            <label for="saManualMoney" style="margin:0;">🔓 Cho sửa tay 3 ô tiền bên dưới (mặc định tự tính Số lượng × Đơn giá × Thuế suất)</label>
          </div>
          <div class="form-group"><label for="saPreTax">Tiền chưa thuế (đ)</label><input type="number" id="saPreTax" readonly></div>
          <div class="form-group"><label for="saTaxAmount">Tiền thuế (đ)</label><input type="number" id="saTaxAmount" readonly></div>
          <div class="form-group"><label for="saTotal">Tiền có thuế (đ)</label><input type="number" id="saTotal" readonly></div>

          <div class="section-divider" id="saImportOnlyDivider" style="display:none;"><span>📦 Thông tin nhập kho</span></div>
          <div class="form-group" id="saBatchGroup" style="display:none;"><label for="saBatchRef">Mã lô hàng *</label><input type="text" id="saBatchRef" placeholder="VD: LOT-20260917-01"></div>
          <div class="form-group" id="saExpiryGroup" style="display:none;"><label for="saExpiry">Hạn sử dụng</label><input type="date" id="saExpiry"></div>

          <div class="form-group" id="saReasonGroup">
            <label for="saReason">Lý do</label>
            <select id="saReason"></select>
          </div>
          <div class="form-group"><label for="saPartner">Đối tác (NCC / người nhận — tuỳ chọn)</label><input type="text" id="saPartner" placeholder="Tên nhà cung cấp hoặc người nhận hàng"></div>

          <div class="form-group full-width"><label for="saDate">Ngày lập phiếu</label><input type="date" id="saDate"></div>
          <div class="form-group full-width"><label for="saNote">Ghi chú</label><input type="text" id="saNote" placeholder="Tuỳ chọn"></div>

          <div id="saStockPreviewBox" class="full-width" style="font-size:13px;color:var(--text-muted);background:var(--bg);border-radius:10px;padding:12px 16px;"></div>
        </div>

        <div class="modal-actions" style="justify-content:flex-end;">
          <button class="btn btn-primary" id="saSaveBtn">💾 Lưu phiếu</button>
        </div>
      </div>
    </div>
  `;
  main.appendChild(page);
  bindIngredientEvents();
})();

/* ══════════════════════════════════════════════
   BIND EVENTS
   ══════════════════════════════════════════════ */
function bindIngredientEvents() {
  document.getElementById("ingRefreshBtn")?.addEventListener("click", loadAndRenderIngredients);
  document.getElementById("ingOpenAdjustBtn")?.addEventListener("click", () => openStockAdjustModal(null));

  document.getElementById("closeStockAdjustBtn")?.addEventListener("click", () =>
    document.getElementById("stockAdjustModal").classList.add("hidden"));
  document.getElementById("saSaveBtn")?.addEventListener("click", saveStockAdjust);

  document.querySelectorAll(".sa-type-btn").forEach(btn => {
    btn.addEventListener("click", () => switchStockAdjustType(btn.dataset.type));
  });

  document.getElementById("saProduct")?.addEventListener("change", handleSaProductChange);
  document.getElementById("saBranchFrom")?.addEventListener("change", updateStockPreviewBox);
  document.getElementById("saBranchTo")?.addEventListener("change", updateStockPreviewBox);
  ["saQty", "saUnitPrice", "saTaxRate"].forEach(id => {
    document.getElementById(id)?.addEventListener("input", () => { recalcMoneyFields(); updateStockPreviewBox(); });
  });
  document.getElementById("saManualMoney")?.addEventListener("change", e => {
    const readOnly = !e.target.checked;
    ["saPreTax", "saTaxAmount", "saTotal"].forEach(id => { document.getElementById(id).readOnly = readOnly; });
    if (readOnly) recalcMoneyFields();
  });

  document.getElementById("ingSearchInput")?.addEventListener("input", window.debounce(e => {
    ingSearchQ = e.target.value.toLowerCase();
    renderIngredientsTable();
  }, 200));

  const modal = document.getElementById("stockAdjustModal");
  modal?.addEventListener("click", e => { if (e.target === modal) modal.classList.add("hidden"); });
  modal?.addEventListener("keydown", e => { if (e.key === "Escape") modal.classList.add("hidden"); });

  if (isIngredientsReadOnly) {
    const topBtn = document.getElementById("ingOpenAdjustBtn");
    if (topBtn) topBtn.style.display = "none";
  }
}

function populateStockBranchSelects() {
  const active = (window.Branches?.state?.list || []).filter(b => b.is_active);
  const optionsHtml = active.length
    ? active.map(b => `<option value="${b.id}">${window.escHtml(b.name)}</option>`).join("")
    : '<option value="">-- Chưa có kho nào, tạo ở ⚙️ Settings → 🏬 Kho --</option>';
  const fromSel = document.getElementById("saBranchFrom");
  const toSel   = document.getElementById("saBranchTo");
  if (fromSel) fromSel.innerHTML = optionsHtml;
  if (toSel)   toSel.innerHTML   = optionsHtml;
}

/* ══════════════════════════════════════════════
   LOAD + RENDER BẢNG
   ══════════════════════════════════════════════ */
async function loadAndRenderIngredients() {
  try {
    await INV.loadIngredients();
    renderIngredientsTable();
    updateIngredientStats();
  } catch (err) {
    window.showToast("❌ Lỗi khi tải kho nguyên liệu: " + err.message, "#e17055");
  }
}

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
  if (noCode.length) messages.push(`🔖 ${noCode.length} mục <b>chưa có Mã sản phẩm</b> — bổ sung tại ⚙️ Settings → 📦 Sản phẩm trước khi lập phiếu: ${noCode.map(i => i.name).join(", ")}`);

  if (messages.length) { banner.style.display = "block"; banner.innerHTML = messages.join("<br>"); }
  else banner.style.display = "none";
}

function renderIngredientsTable() {
  const tbody = document.getElementById("ingTableBody");
  if (!tbody) return;

  const list = INV.state.ingredients.filter(i =>
    !ingSearchQ || i.name.toLowerCase().includes(ingSearchQ) || (i.code || "").toLowerCase().includes(ingSearchQ)
  );

  if (!list.length) {
    tbody.innerHTML = `<tr><td colspan="9" style="text-align:center;padding:40px;color:var(--text-muted);">${INV.state.ingredients.length ? "Không tìm thấy nguyên liệu/thành phẩm phù hợp." : "Chưa có sản phẩm nào — tạo mới tại ⚙️ Settings → 📦 Sản phẩm."}</td></tr>`;
    return;
  }

  tbody.innerHTML = list.map(i => {
    const low = i.min_stock_qty > 0 && i.current_stock < i.min_stock_qty;
    const noCode = !i.code;
    const breakdown = INV.getStockBreakdown(i.id);
    return `<tr>
      <td style="width:24px;cursor:pointer;" data-ing-caret="${i.id}">${breakdown.length ? "▸" : ""}</td>
      <td>${noCode ? '<span class="badge" style="background:#fff5f5;color:var(--danger);">⚠️ Chưa có mã</span>' : `<b>${window.escHtml(i.code)}</b>`}</td>
      <td><div class="game-name">${window.escHtml(i.name)}</div>${!i.is_active ? '<div class="game-id" style="color:var(--danger)">Ngừng dùng</div>' : ''}</td>
      <td>${ingTypeBadge(i)}</td>
      <td>${window.escHtml(i.unit)}</td>
      <td>${Number(i.unit_cost).toLocaleString("vi-VN")} đ</td>
      <td style="font-weight:700;${low ? 'color:var(--danger)' : ''}">${i.current_stock.toLocaleString("vi-VN")} ${window.escHtml(i.unit)} ${low ? '⚠️' : ''}</td>
      <td>${Number(i.min_stock_qty || 0).toLocaleString("vi-VN")}</td>
      <td style="display:flex;gap:6px;flex-wrap:wrap;">
        ${isIngredientsReadOnly ? '' : `<button class="btn btn-secondary" style="font-size:12px;padding:6px 10px;" data-ing-adjust="${i.id}" ${noCode ? 'disabled title="Bổ sung Mã sản phẩm ở Settings trước"' : ''}>🔄 Điều chỉnh</button>`}
        <button class="btn btn-primary" style="font-size:12px;padding:6px 10px;" data-ing-edit-settings="${i.id}" title="Mở sửa sản phẩm này ở ⚙️ Settings">✏️ Sửa ở Settings</button>
      </td>
    </tr>
    <tr class="hidden" id="ingBreakdown-${i.id}">
      <td></td>
      <td colspan="8" style="background:var(--bg);padding:10px 18px;">
        ${breakdown.length
          ? breakdown.map(b => {
              const label = b.branchId ? window.escHtml(window.Branches?.getBranchName?.(b.branchId) || `Kho #${b.branchId}`) : "Chưa gán kho (dữ liệu cũ)";
              return `<span class="badge" style="margin-right:8px;margin-bottom:6px;display:inline-block;">${label}: <b>${b.qty.toLocaleString("vi-VN")} ${window.escHtml(i.unit)}</b></span>`;
            }).join("")
          : '<span style="color:var(--text-muted);">Chưa có phát sinh tồn kho.</span>'}
      </td>
    </tr>`;
  }).join("");

  tbody.querySelectorAll("[data-ing-caret]").forEach(el => {
    el.addEventListener("click", () => {
      const id = el.dataset.ingCaret;
      const row = document.getElementById(`ingBreakdown-${id}`);
      if (!row) return;
      const willOpen = row.classList.contains("hidden");
      row.classList.toggle("hidden", !willOpen);
      el.textContent = willOpen ? "▾" : "▸";
    });
  });
  tbody.querySelectorAll("[data-ing-edit-settings]").forEach(b =>
    b.addEventListener("click", () => window.openProductInSettings(Number(b.dataset.ingEditSettings)))
  );
  tbody.querySelectorAll("[data-ing-adjust]:not([disabled])").forEach(b =>
    b.addEventListener("click", () => openStockAdjustModal(Number(b.dataset.ingAdjust)))
  );
}

/* ══════════════════════════════════════════════
   MODAL "🔄 ĐIỀU CHỈNH KHO"
   ══════════════════════════════════════════════ */
function stockAdjustProductOptionsHtml(selectedId) {
  const list = INV.state.ingredients.filter(i => i.is_active && i.code);
  return '<option value="">-- Chọn sản phẩm --</option>' + list.map(i =>
    `<option value="${i.id}" ${i.id === selectedId ? "selected" : ""}>${window.escHtml(i.code)} — ${window.escHtml(i.name)} (${window.escHtml(i.unit)})</option>`
  ).join("");
}

function openStockAdjustModal(presetIngredientId) {
  if (isIngredientsReadOnly) return;
  if (!window.Branches?.state?.list?.length) {
    window.showToast("⏳ Đang tải danh sách kho, vui lòng thử lại sau giây lát.", "#e17055");
    return;
  }

  document.getElementById("saProduct").innerHTML = stockAdjustProductOptionsHtml(presetIngredientId);
  document.getElementById("saQty").value = "";
  document.getElementById("saTaxRate").value = 0;
  document.getElementById("saManualMoney").checked = false;
  ["saPreTax", "saTaxAmount", "saTotal"].forEach(id => { const el = document.getElementById(id); el.value = ""; el.readOnly = true; });
  document.getElementById("saBatchRef").value = "";
  document.getElementById("saExpiry").value = "";
  document.getElementById("saPartner").value = "";
  document.getElementById("saNote").value = "";
  document.getElementById("saDate").value = new Date().toISOString().slice(0, 10);
  populateStockBranchSelects();

  switchStockAdjustType("in");
  if (presetIngredientId) handleSaProductChange();
  else { document.getElementById("saUnit").value = ""; document.getElementById("saUnitPrice").value = ""; }

  document.getElementById("stockAdjustModal").classList.remove("hidden");
  document.getElementById("saProduct").focus();
}

function switchStockAdjustType(type) {
  saCurrentType = type;
  document.querySelectorAll(".sa-type-btn").forEach(b => {
    const active = b.dataset.type === type;
    b.classList.toggle("btn-primary", active);
    b.classList.toggle("btn-secondary", !active);
  });

  const titleMap = { in: "📥 Nhập kho", out: "📤 Xuất kho", transfer: "🔀 Chuyển kho" };
  document.getElementById("stockAdjustTitle").textContent = "🔄 Điều chỉnh kho — " + titleMap[type];

  const fromGroup = document.getElementById("saBranchFromGroup");
  const toGroup   = document.getElementById("saBranchToGroup");
  const fromLabel = document.getElementById("saBranchFromLabel");
  const toLabel   = document.getElementById("saBranchToLabel");

  if (type === "in") {
    fromGroup.style.display = "none";
    toGroup.style.display = "";
    toLabel.textContent = "Kho nhận hàng *";
  } else if (type === "out") {
    fromGroup.style.display = "";
    toGroup.style.display = "none";
    fromLabel.textContent = "Kho xuất hàng *";
  } else {
    fromGroup.style.display = "";
    toGroup.style.display = "";
    fromLabel.textContent = "Từ kho *";
    toLabel.textContent = "Đến kho *";
  }

  document.getElementById("saImportOnlyDivider").style.display = type === "in" ? "" : "none";
  document.getElementById("saBatchGroup").style.display = type === "in" ? "" : "none";
  document.getElementById("saExpiryGroup").style.display = type === "in" ? "" : "none";

  document.getElementById("saReason").innerHTML =
    SA_REASONS[type].map(r => `<option value="${r.v}">${r.l}</option>`).join("");

  recalcMoneyFields();
  updateStockPreviewBox();
}

function handleSaProductChange() {
  const id = Number(document.getElementById("saProduct").value) || null;
  const ing = id ? INV.getIngredientById(id) : null;
  document.getElementById("saUnit").value = ing ? ing.unit : "";
  document.getElementById("saUnitPrice").value = ing ? (ing.unit_cost || 0) : "";
  document.getElementById("saUnitPriceHint").textContent = ing
    ? `Giá tham chiếu hiện tại: ${Number(ing.unit_cost || 0).toLocaleString("vi-VN")} đ/${ing.unit}` +
      (ing.is_finished_product ? " (thành phẩm — giá gốc tính theo công thức pha chế, có thể để 0 nếu chỉ theo dõi số lượng)" : "")
    : "";
  recalcMoneyFields();
  updateStockPreviewBox();
}

function recalcMoneyFields() {
  if (document.getElementById("saManualMoney").checked) return;
  const qty    = Number(document.getElementById("saQty").value) || 0;
  const price  = Number(document.getElementById("saUnitPrice").value) || 0;
  const taxPct = Number(document.getElementById("saTaxRate").value) || 0;
  const pre   = round2(qty * price);
  const tax   = round2(pre * taxPct / 100);
  const total = round2(pre + tax);
  document.getElementById("saPreTax").value = pre;
  document.getElementById("saTaxAmount").value = tax;
  document.getElementById("saTotal").value = total;
}

function updateStockPreviewBox() {
  const box = document.getElementById("saStockPreviewBox");
  const id  = Number(document.getElementById("saProduct").value) || null;
  const qty = Number(document.getElementById("saQty").value) || 0;
  if (!id) { box.innerHTML = "Chọn sản phẩm để xem tồn kho."; return; }

  const unit   = INV.getIngredientById(id)?.unit || "";
  const fromId = Number(document.getElementById("saBranchFrom").value) || null;
  const toId   = Number(document.getElementById("saBranchTo").value) || null;
  const lines  = [];

  if (saCurrentType === "in") {
    const cur = INV.getStockInBranch(id, toId);
    lines.push(`Tồn kho tại kho nhận: <b>${cur.toLocaleString("vi-VN")} ${unit}</b> → sau khi nhập: <b style="color:var(--primary)">${(cur + qty).toLocaleString("vi-VN")} ${unit}</b>`);
  } else if (saCurrentType === "out") {
    const cur = INV.getStockInBranch(id, fromId);
    const after = cur - qty;
    lines.push(`Tồn kho tại kho xuất: <b>${cur.toLocaleString("vi-VN")} ${unit}</b> → sau khi xuất: <b style="color:${after < 0 ? "var(--danger)" : "var(--primary)"}">${after.toLocaleString("vi-VN")} ${unit}</b>`);
    if (after < 0) lines.push(`<span style="color:var(--danger);font-weight:700;">⚠️ Không đủ tồn kho — chỉ được xuất tối đa ${cur.toLocaleString("vi-VN")} ${unit}.</span>`);
  } else {
    const curFrom = INV.getStockInBranch(id, fromId);
    const curTo   = INV.getStockInBranch(id, toId);
    const afterFrom = curFrom - qty;
    lines.push(`Kho nguồn: <b>${curFrom.toLocaleString("vi-VN")} ${unit}</b> → sau chuyển: <b style="color:${afterFrom < 0 ? "var(--danger)" : "var(--primary)"}">${afterFrom.toLocaleString("vi-VN")} ${unit}</b>`);
    lines.push(`Kho đích: <b>${curTo.toLocaleString("vi-VN")} ${unit}</b> → sau chuyển: <b style="color:var(--primary)">${(curTo + qty).toLocaleString("vi-VN")} ${unit}</b>`);
    if (afterFrom < 0) lines.push(`<span style="color:var(--danger);font-weight:700;">⚠️ Kho nguồn không đủ tồn — chỉ được chuyển tối đa ${curFrom.toLocaleString("vi-VN")} ${unit}.</span>`);
    if (fromId && toId && fromId === toId) lines.push(`<span style="color:var(--danger);font-weight:700;">⚠️ Kho nguồn và kho đích phải khác nhau.</span>`);
  }
  box.innerHTML = lines.join("<br>");
}

async function saveStockAdjust() {
  if (isIngredientsReadOnly) return;

  const productId  = Number(document.getElementById("saProduct").value) || null;
  const qty        = Number(document.getElementById("saQty").value) || 0;
  const fromId     = Number(document.getElementById("saBranchFrom").value) || null;
  const toId       = Number(document.getElementById("saBranchTo").value) || null;
  const taxRate    = Number(document.getElementById("saTaxRate").value) || 0;
  const unitPrice  = Number(document.getElementById("saUnitPrice").value) || 0;
  const preTax     = Number(document.getElementById("saPreTax").value) || 0;
  const taxAmount  = Number(document.getElementById("saTaxAmount").value) || 0;
  const total      = Number(document.getElementById("saTotal").value) || 0;
  const reason     = document.getElementById("saReason").value;
  const partner    = document.getElementById("saPartner").value.trim();
  const note       = document.getElementById("saNote").value.trim();
  const dateVal    = document.getElementById("saDate").value;
  const batchRef   = document.getElementById("saBatchRef").value.trim();
  const expiry     = document.getElementById("saExpiry").value || null;
  const staff      = currentSession.displayName || currentSession.username;

  if (!productId) { window.showToast("⚠️ Vui lòng chọn sản phẩm.", "#e17055"); return; }
  if (!qty || qty <= 0) { window.showToast("⚠️ Vui lòng nhập số lượng lớn hơn 0.", "#e17055"); return; }
  if (!unitPrice && unitPrice !== 0) { window.showToast("⚠️ Vui lòng nhập đơn giá.", "#e17055"); return; }

  if (saCurrentType === "in" && !toId) { window.showToast("⚠️ Vui lòng chọn kho nhận hàng.", "#e17055"); return; }
  if (saCurrentType === "out" && !fromId) { window.showToast("⚠️ Vui lòng chọn kho xuất hàng.", "#e17055"); return; }
  if (saCurrentType === "transfer") {
    if (!fromId || !toId) { window.showToast("⚠️ Vui lòng chọn đủ kho nguồn và kho đích.", "#e17055"); return; }
    if (fromId === toId) { window.showToast("⚠️ Kho nguồn và kho đích phải khác nhau.", "#e17055"); return; }
  }
  if (saCurrentType === "in" && !batchRef) { window.showToast("⚠️ Vui lòng nhập mã lô hàng.", "#e17055"); return; }

  /* ⚠️ KIỂM TRA TỒN KHO — không cho phép xuất/chuyển vượt tồn tại
     đúng kho nguồn, không cho phép kết quả âm. */
  if (saCurrentType === "out") {
    const cur = INV.getStockInBranch(productId, fromId);
    if (qty > cur) { window.showToast(`⚠️ Kho xuất chỉ còn ${cur.toLocaleString("vi-VN")} — không thể xuất ${qty.toLocaleString("vi-VN")}.`, "#e17055"); return; }
  }
  if (saCurrentType === "transfer") {
    const curFrom = INV.getStockInBranch(productId, fromId);
    if (qty > curFrom) { window.showToast(`⚠️ Kho nguồn chỉ còn ${curFrom.toLocaleString("vi-VN")} — không thể chuyển ${qty.toLocaleString("vi-VN")}.`, "#e17055"); return; }
  }

  const common = {
    ingredient_id: productId,
    tax_rate: taxRate,
    unit_price: unitPrice,
    amount_pre_tax: preTax,
    tax_amount: taxAmount,
    amount_with_tax: total,
    reason,
    note: partner ? `${note ? note + " — " : ""}Đối tác: ${partner}` : (note || null),
    staff_name: staff,
  };
  if (dateVal) common.created_at = new Date(dateVal + "T" + new Date().toTimeString().slice(0, 8)).toISOString();

  const btn = document.getElementById("saSaveBtn");
  btn.disabled = true; btn.textContent = "Đang lưu...";

  try {
    let voucher = null;

    if (saCurrentType === "in") {
      const afterQty = INV.getStockInBranch(productId, toId) + qty;
      const payload = { ...common, branch_id: toId, log_type: "stock_in", qty_change: qty, qty_after: afterQty, batch_ref: batchRef };
      if (expiry) payload.expiry_date = expiry;
      const { data, error } = await client.from("ingredient_stock_logs").insert(payload).select();
      if (error) throw error;
      voucher = data?.[0]?.voucher_number;

    } else if (saCurrentType === "out") {
      const afterQty = INV.getStockInBranch(productId, fromId) - qty;
      const payload = { ...common, branch_id: fromId, log_type: "stock_out", qty_change: -qty, qty_after: afterQty };
      const { data, error } = await client.from("ingredient_stock_logs").insert(payload).select();
      if (error) throw error;
      voucher = data?.[0]?.voucher_number;

    } else {
      const transferGroup = "TG-" + Date.now() + "-" + Math.random().toString(36).slice(2, 8);
      const afterFrom = INV.getStockInBranch(productId, fromId) - qty;
      const afterTo   = INV.getStockInBranch(productId, toId) + qty;
      const rows = [
        { ...common, branch_id: fromId, related_branch_id: toId, transfer_group: transferGroup, log_type: "transfer_out", qty_change: -qty, qty_after: afterFrom },
        { ...common, branch_id: toId,   related_branch_id: fromId, transfer_group: transferGroup, log_type: "transfer_in",  qty_change: qty,  qty_after: afterTo },
      ];
      const { data, error } = await client.from("ingredient_stock_logs").insert(rows).select();
      if (error) throw error;
      voucher = data?.[0]?.voucher_number;
    }

    document.getElementById("stockAdjustModal").classList.add("hidden");
    window.showToast(voucher ? `✅ Đã lưu phiếu ${voucher}!` : "✅ Đã ghi nhận thay đổi tồn kho!");
    await loadAndRenderIngredients();
  } catch (err) {
    window.showToast("❌ Lỗi: " + err.message, "#e17055");
  } finally {
    btn.disabled = false; btn.textContent = "💾 Lưu phiếu";
  }
}
