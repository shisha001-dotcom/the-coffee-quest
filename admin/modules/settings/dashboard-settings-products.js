/* ══════════════════════════════════════════════
   DASHBOARD SETTINGS — TAB SẢN PHẨM (ingredients)
   admin/modules/settings/dashboard-settings-products.js
   ─────────────────────────────────────────────
   ⚠️ TÁCH RA từ admin/modules/dashboard-settings.js (file gốc đã
   bị xoá). Giữ NGUYÊN toàn bộ hành vi cũ của tab "📦 Sản phẩm":
   sinh mã sản phẩm tự động, CRUD `ingredients` (nguyên liệu +
   thành phẩm), quy đổi đóng gói, khoá giá khi là thành phẩm.

   ⚠️ MỚI (bổ sung theo yêu cầu): xác nhận trước khi đóng
   #productModal nếu form có thay đổi chưa lưu (đóng bằng nút ✕ /
   click ra ngoài overlay / phím Escape) — áp dụng cho CẢ thêm mới
   lẫn sửa. Xem productFormDirty + attemptCloseProductModal() bên
   dưới. Nút "💾 Lưu" chính (#prodSaveBtn) KHÔNG đổi hành vi — vẫn
   lưu trực tiếp như cũ, không qua showConfirm.

   Cần: client, currentSession, window.Inventory (inventory-shared.js),
   isSettingsReadOnly (settings-shared.js — PHẢI load ngay trước file
   này), window.escHtml / showToast / showConfirm / showReasonPrompt /
   debounce / clearFieldError / showFieldError (shared-utils.js).
   ══════════════════════════════════════════════ */

let stProductSearchQ = "";

/* ⚠️ MỚI: theo dõi "đã chỉnh sửa" (dirty) của form #productModal */
let productFormDirty = false;

/* ══════════════════════════════════════════════
   ⚠️ SINH MÃ SẢN PHẨM TỰ ĐỘNG (Nguyên liệu/Thành phẩm)
   ─────────────────────────────────────────────
   Định dạng: [NL|TP] + 1 chữ A-Z + 4 chữ số (0001-9999).
   Hết 9999 → chữ cái nhảy (A→B), số reset 0001.
   Chỉ đếm mã ĐÚNG định dạng này khi tìm số lớn nhất — mã cũ sai
   định dạng bị bỏ qua, giữ nguyên không đổi.
   ══════════════════════════════════════════════ */
const PRODUCT_TYPE_PREFIX = { ingredient: "NL", finished: "TP" };

function parseProductCodeSeq(code, prefix) {
  if (!code) return null;
  const re = new RegExp("^" + prefix + "([A-Z])(\\d{4})$");
  const m = String(code).match(re);
  if (!m) return null;
  const letterIdx = m[1].charCodeAt(0) - 65; // A=0
  const num = parseInt(m[2], 10);
  return letterIdx * 9999 + (num - 1);
}

function formatProductCodeSeq(prefix, seqIndex) {
  const letterIdx = Math.floor(seqIndex / 9999);
  const num = (seqIndex % 9999) + 1;
  if (letterIdx > 25) return null; // vượt quá [prefix]Z9999 — hết dải mã tự động
  const letter = String.fromCharCode(65 + letterIdx);
  return prefix + letter + String(num).padStart(4, "0");
}

async function fetchAllProductCodes() {
  const { data, error } = await client.from("ingredients").select("code");
  if (error) throw error;
  return (data || []).map(r => r.code).filter(Boolean);
}

async function computeNextProductCodeAsync(type) {
  const prefix = PRODUCT_TYPE_PREFIX[type];
  const codes = await fetchAllProductCodes();
  let maxSeq = -1;
  codes.forEach(code => {
    const seq = parseProductCodeSeq(code, prefix);
    if (seq !== null && seq > maxSeq) maxSeq = seq;
  });
  const next = formatProductCodeSeq(prefix, maxSeq + 1);
  if (!next) throw new Error(`Đã dùng hết dải mã tự động cho ${prefix} (vượt quá ${prefix}Z9999) — liên hệ kỹ thuật để mở rộng định dạng mã.`);
  return next;
}

/* Kiểm tra lại mã có bị trùng ngay trước khi lưu (phòng 2 người cùng
   thao tác gần như đồng thời) — nếu trùng, tính lại mã kế tiếp dựa
   trên dữ liệu MỚI NHẤT và thử lại ĐÚNG 1 lần. */
async function ensureUniqueProductCodeBeforeSave(code, type) {
  const { data: existing } = await client.from("ingredients").select("id").eq("code", code).maybeSingle();
  if (!existing) return code;

  const retryCode = await computeNextProductCodeAsync(type);
  const { data: existing2 } = await client.from("ingredients").select("id").eq("code", retryCode).maybeSingle();
  if (existing2) throw new Error("Không thể sinh mã sản phẩm duy nhất — vui lòng thử lại.");
  return retryCode;
}

/* ══════════════════════════════════════════════
   INJECT TAB CONTENT + MODAL
   ══════════════════════════════════════════════ */
(function injectProductsTab() {
  const container = document.getElementById("stTabProducts");
  if (!container) return;

  container.innerHTML = `
    <div style="font-size:12px;color:var(--text-muted);margin-bottom:14px;">
      🧂 <b>Nguyên liệu</b> = dùng trong công thức pha chế. 🥤 <b>Thành phẩm</b> = sản phẩm bán ra (VD: Trà sữa truyền thống) — chọn được ở trang ☕ Đồ uống khi tạo công thức bán hàng. Cả hai loại đều theo dõi tồn kho như nhau, chỉ khác ở "Loại sản phẩm" bên dưới.
    </div>
    <div class="search-bar"><input type="text" id="prodSearchInput" class="search-input" placeholder="🔍 Tìm theo mã hoặc tên sản phẩm..."></div>
    <div class="table-card">
      <div style="padding:16px 24px 0;display:flex;justify-content:flex-end;">
        <button class="btn btn-primary" id="prodAddBtn">+ Thêm sản phẩm</button>
      </div>
      <table class="game-table">
        <thead><tr><th>Mã</th><th>Sản phẩm</th><th>Loại</th><th>Quy cách</th><th>Đơn vị tính</th><th>Quy đổi đóng gói</th><th>Giá</th><th>Hành động</th></tr></thead>
        <tbody id="prodTableBody"><tr><td colspan="8" style="text-align:center;padding:30px;color:var(--text-muted);">⏳ Đang tải...</td></tr></tbody>
      </table>
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

          <div class="form-group">
            <label for="prodTypeSelect">Loại sản phẩm *</label>
            <select id="prodTypeSelect">
              <option value="ingredient">🧂 Nguyên liệu</option>
              <option value="finished">🥤 Thành phẩm</option>
            </select>
            <div class="hint" id="prodTypeHint">🥤 Thành phẩm sẽ chọn được ở trang ☕ Đồ uống khi tạo công thức bán hàng. Cả hai loại đều theo dõi tồn kho như nhau.</div>
          </div>

          <div class="form-group">
            <label for="prodCode">Mã sản phẩm (tự động)</label>
            <input type="text" id="prodCode" readonly style="background:var(--bg);color:var(--text-muted);font-weight:700;">
            <div class="hint" id="prodCodeHint">Mã được sinh tự động theo thứ tự, không thể sửa tay. Chọn lại "Loại sản phẩm" ở trên nếu cần đổi.</div>
          </div>

          <div class="form-group full-width"><label for="prodName">Tên sản phẩm *</label><input type="text" id="prodName" placeholder="Nước cam, Sữa tươi, Trà sữa truyền thống..."></div>

          <div class="form-group full-width"><label for="prodSpec">Quy cách</label><input type="text" id="prodSpec" placeholder="VD: Hộp giấy nguyên hộp"></div>

          <div class="form-group"><label for="prodUnit">Đơn vị tính *</label><input type="text" id="prodUnit" placeholder="Hộp, Can, Thùng, Chai, Ly..."></div>
          <div class="form-group">
            <label for="prodUnitCost">Giá (đ) *</label>
            <input type="number" id="prodUnitCost" min="0" step="0.01" placeholder="35000">
            <div class="hint" id="prodUnitCostNote" style="display:none;color:#0984e3;">🥤 Thành phẩm: giá được tổng hợp tự động từ công thức nguyên liệu cấu thành (☕ Đồ uống) — để 0 ở đây, không tính giá đầu vào theo cách này.</div>
          </div>

          <div class="section-divider"><span>📐 Quy đổi đóng gói</span></div>

          <div class="form-group full-width" style="flex-direction:row;align-items:center;gap:10px;flex-wrap:wrap;">
            <span style="font-size:13px;color:var(--text-muted);white-space:nowrap;">1 <b id="prodUnitEcho">đơn vị</b> &nbsp;=&nbsp;</span>
            <label for="prodPackageQty" class="visually-hidden">Số lượng đóng gói</label>
            <input type="number" id="prodPackageQty" min="0" step="0.01" placeholder="500" style="width:110px;height:44px;border:1px solid var(--border);border-radius:10px;padding:0 12px;font-size:14px;">
            <label for="prodPackageUnit" class="visually-hidden">Đơn vị đóng gói</label>
            <input type="text" id="prodPackageUnit" placeholder="g, ml, cái..." style="width:120px;height:44px;border:1px solid var(--border);border-radius:10px;padding:0 12px;font-size:14px;">
          </div>
          <div class="full-width" style="font-size:11px;color:var(--text-muted);margin-top:-10px;">
            VD: Nước cam — 1 Hộp = 500 g → Đơn vị tính: "Hộp", số lượng đóng gói: 500, đơn vị đóng gói: "g". Để trống nếu sản phẩm dùng thẳng đơn vị tính trong công thức (không cần quy đổi).
          </div>

          <div class="form-group full-width" id="prodPackageCostWrap" style="display:none;">
            <label>Giá theo quy cách đóng gói</label>
            <div id="prodPackageCostDisplay" style="height:44px;display:flex;align-items:center;padding:0 14px;background:var(--bg);border:1px solid var(--border);border-radius:10px;font-weight:700;color:var(--primary);"></div>
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

  bindProductEvents();
  bindProductDirtyTracking();
})();

function bindProductEvents() {
  document.getElementById("prodAddBtn")?.addEventListener("click", openAddProduct);

  /* ⚠️ MỚI: X / click overlay / Escape đều đi qua attemptCloseProductModal()
     thay vì đóng thẳng — có xác nhận nếu form đang dirty. */
  document.getElementById("closeProductModalBtn")?.addEventListener("click", attemptCloseProductModal);
  const productModal = document.getElementById("productModal");
  productModal?.addEventListener("click", e => { if (e.target === productModal) attemptCloseProductModal(); });
  productModal?.addEventListener("keydown", e => { if (e.key === "Escape") attemptCloseProductModal(); });

  document.getElementById("prodSaveBtn")?.addEventListener("click", saveProduct);
  document.getElementById("prodDeleteBtn")?.addEventListener("click", deleteProduct);
  document.getElementById("prodUnit")?.addEventListener("input", e => {
    document.getElementById("prodUnitEcho").textContent = e.target.value.trim() || "đơn vị";
  });
  ["prodUnitCost", "prodPackageQty", "prodPackageUnit"].forEach(id => {
    document.getElementById(id)?.addEventListener("input", updateProductCostHint);
  });
  /* ⚠️ Dropdown "Loại sản phẩm" VẪN MỞ khi đang thêm mới (không
     khoá) — mỗi lần đổi lựa chọn sẽ tự sinh lại mã đúng loại đó.
     Khi đang SỬA sản phẩm cũ, dropdown bị disabled (xem
     openEditProduct) nên sự kiện này không có tác dụng gì — an toàn. */
  document.getElementById("prodTypeSelect")?.addEventListener("change", handleProductTypeChange);

  document.getElementById("prodSearchInput")?.addEventListener("input", window.debounce(e => {
    stProductSearchQ = e.target.value.trim().toLowerCase();
    renderProductsTable();
  }, 200));

  if (isSettingsReadOnly) {
    const btn = document.getElementById("prodAddBtn");
    if (btn) btn.style.display = "none";
  }
}

/* ⚠️ MỚI: gắn listener 'input'/'change' lên MỌI field trong
   #productModal (kể cả dropdown Loại) để đánh dấu productFormDirty
   = true ngay khi có bất kỳ thay đổi nào do người dùng thao tác.
   Set giá trị bằng JS (.value = ...) KHÔNG tự bắn 2 sự kiện này nên
   việc điền form lúc mở modal không vô tình làm dirty. */
function bindProductDirtyTracking() {
  const modal = document.getElementById("productModal");
  if (!modal) return;
  modal.querySelectorAll("input, select, textarea").forEach(el => {
    el.addEventListener("input", () => { productFormDirty = true; });
    el.addEventListener("change", () => { productFormDirty = true; });
  });
}

/* ⚠️ MỚI: điểm vào DUY NHẤT khi người dùng cố đóng #productModal
   qua nút ✕ / click ra ngoài overlay / phím Escape. */
function attemptCloseProductModal() {
  if (!productFormDirty) {
    document.getElementById("productModal").classList.add("hidden");
    return;
  }

  window.showConfirm({
    title: "Bạn có thay đổi chưa lưu",
    message: "Bạn có muốn lưu lại các thay đổi trước khi thoát không?",
    confirmText: "💾 Lưu lại",
    cancelText: "🚪 Thoát không lưu",
    danger: false,
  }).then(wantsToSave => {
    if (wantsToSave) {
      /* Gọi lại ĐÚNG luồng validate + lưu hiện có — nếu validate lỗi
         (báo lỗi tại field) hoặc lỗi server, saveProduct() sẽ KHÔNG
         đóng modal (return sớm / catch không .add("hidden")), giữ
         nguyên hành vi y hệt khi bấm nút "💾 Lưu" bình thường. Nếu
         lưu thành công, saveProduct() tự đóng modal + reset dirty. */
      saveProduct();
    } else {
      /* "🚪 Thoát không lưu" — đóng modal ngay, bỏ mọi thay đổi. */
      productFormDirty = false;
      document.getElementById("productModal").classList.add("hidden");
    }
  });
}

/* ══════════════════════════════════════════════
   LOAD + RENDER BẢNG
   ══════════════════════════════════════════════ */
async function loadProducts() {
  await window.Inventory.loadIngredients();
  renderProductsTable();
}

function packageDisplay(p) {
  if (!p.package_qty || !p.package_unit) return "—";
  return `1 ${window.escHtml(p.unit || "đv")} = ${Number(p.package_qty).toLocaleString("vi-VN")} ${window.escHtml(p.package_unit)}`;
}

function productTypeBadge(p) {
  return p.is_finished_product
    ? '<span class="badge" style="background:#e0f2ff;color:#0984e3;">🥤 Thành phẩm</span>'
    : '<span class="badge">🧂 Nguyên liệu</span>';
}

function renderProductsTable() {
  const tbody = document.getElementById("prodTableBody");
  if (!tbody) return;
  const q = stProductSearchQ;
  const list = window.Inventory.state.ingredients.filter(p =>
    !q || (p.name || "").toLowerCase().includes(q) || (p.code || "").toLowerCase().includes(q)
  );

  if (!list.length) {
    tbody.innerHTML = `<tr><td colspan="8" style="text-align:center;padding:30px;color:var(--text-muted);">${window.Inventory.state.ingredients.length ? "Không tìm thấy sản phẩm phù hợp." : "Chưa có sản phẩm nào."}</td></tr>`;
    return;
  }

  tbody.innerHTML = list.map(p => `
    <tr style="${p.is_active === false ? 'opacity:.55;' : ''}">
      <td>${window.escHtml(p.code || "—")}</td>
      <td><div class="game-name">${window.escHtml(p.name)}</div>${p.is_active === false ? '<div class="game-id" style="color:var(--danger)">Ngừng dùng</div>' : ''}</td>
      <td>${productTypeBadge(p)}</td>
      <td>${window.escHtml(p.spec || "—")}</td>
      <td>${window.escHtml(p.unit || "—")}</td>
      <td>${packageDisplay(p)}</td>
      <td>${p.is_finished_product
        ? '<span style="color:var(--text-muted);">— (theo công thức)</span>'
        : Number(p.unit_cost || 0).toLocaleString("vi-VN") + " đ"}</td>
      <td><button class="btn btn-primary" style="font-size:12px;padding:6px 10px;" data-prod-edit="${p.id}">✏️ Sửa</button></td>
    </tr>
  `).join("");

  tbody.querySelectorAll("[data-prod-edit]").forEach(btn =>
    btn.addEventListener("click", () => openEditProduct(Number(btn.dataset.prodEdit))));
}

/* Tính & hiển thị "Giá theo quy cách đóng gói" = Giá ÷ Số
   lượng đóng gói (VD: 30.000đ / 300ml = 100 đ/ml). */
function updateProductCostHint() {
  const cost  = Number(document.getElementById("prodUnitCost").value) || 0;
  const qty   = Number(document.getElementById("prodPackageQty").value) || 0;
  const punit = document.getElementById("prodPackageUnit").value.trim();
  const wrap    = document.getElementById("prodPackageCostWrap");
  const display = document.getElementById("prodPackageCostDisplay");
  if (!wrap || !display) return;

  if (cost > 0 && qty > 0 && punit) {
    wrap.style.display = "";
    const perUnit = cost / qty;
    display.textContent = `${perUnit.toLocaleString("vi-VN", { maximumFractionDigits: 4 })} đ / ${punit}`;
  } else {
    wrap.style.display = "none";
    display.textContent = "";
  }
}

/* ⚠️ Khoá/mở khoá ô Giá theo dropdown "Loại sản phẩm". */
function updateFinishedProductPriceState() {
  const finished  = document.getElementById("prodTypeSelect").value === "finished";
  const costInput = document.getElementById("prodUnitCost");
  const note      = document.getElementById("prodUnitCostNote");

  if (finished) {
    costInput.value = "0";
    costInput.disabled = true;
    note.style.display = "block";
  } else {
    costInput.disabled = false;
    note.style.display = "none";
    if (costInput.value === "0") costInput.value = "";
  }
  updateProductCostHint();
}

/* ══════════════════════════════════════════════
   MỞ MODAL THÊM SẢN PHẨM
   ══════════════════════════════════════════════ */
async function openAddProduct() {
  if (isSettingsReadOnly) return;
  document.getElementById("prodId").value = "";
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
  document.getElementById("prodCodeHint").textContent = "Mã được sinh tự động theo thứ tự, không thể sửa tay. Chọn lại \"Loại sản phẩm\" ở trên nếu cần đổi.";

  const typeSelect = document.getElementById("prodTypeSelect");
  typeSelect.value = "ingredient"; // ⚠️ loại mặc định ban đầu
  typeSelect.disabled = false;     // ⚠️ để MỞ khi thêm mới — chọn được bình thường

  updateFinishedProductPriceState();

  const codeInput = document.getElementById("prodCode");
  codeInput.value = "⏳ Đang tạo mã...";
  document.getElementById("productModal").classList.remove("hidden");
  document.getElementById("prodName").focus();

  /* ⚠️ MỚI: reset trạng thái "đã chỉnh sửa" mỗi khi mở modal mới —
     đặt SAU khi mọi field đã được set giá trị ban đầu bằng JS ở
     trên (không tự trigger dirty), TRƯỚC khi người dùng có cơ hội
     gõ/chọn gì. */
  productFormDirty = false;

  /* Sinh mã NGAY khi mở modal, dựa trên loại mặc định ban đầu */
  try {
    codeInput.value = await computeNextProductCodeAsync(typeSelect.value);
  } catch (err) {
    codeInput.value = "";
    window.showToast("❌ " + err.message, "#e17055");
  }
}

/* Khi đang THÊM MỚI và người dùng đổi dropdown "Loại sản phẩm"
   → tự tính lại mã đúng theo loại vừa chọn. */
async function handleProductTypeChange() {
  if (isSettingsReadOnly) return;
  const idInput = document.getElementById("prodId");
  if (idInput.value) return; // an toàn: không tự đổi mã khi đang sửa

  const typeSelect = document.getElementById("prodTypeSelect");
  const codeInput  = document.getElementById("prodCode");

  updateFinishedProductPriceState();

  codeInput.value = "⏳ Đang tạo mã...";
  try {
    codeInput.value = await computeNextProductCodeAsync(typeSelect.value);
  } catch (err) {
    codeInput.value = "";
    window.showToast("❌ " + err.message, "#e17055");
  }
}

function openEditProduct(id) {
  const p = window.Inventory.getIngredientById(id);
  if (!p) return;
  document.getElementById("prodId").value = p.id;
  document.getElementById("prodCode").value = p.code || "(chưa có mã)";
  document.getElementById("prodCodeHint").textContent = "Mã đã gán cho sản phẩm này — không thể đổi (tránh lệch dữ liệu công thức/tồn kho đã liên kết theo mã cũ).";
  document.getElementById("prodName").value = p.name || "";
  document.getElementById("prodSpec").value = p.spec || "";
  document.getElementById("prodUnit").value = p.unit || "";
  document.getElementById("prodUnitEcho").textContent = p.unit || "đơn vị";
  document.getElementById("prodUnitCost").value = p.unit_cost ?? "";
  document.getElementById("prodPackageQty").value = p.package_unit ? (p.package_qty ?? "") : "";
  document.getElementById("prodPackageUnit").value = p.package_unit || "";
  document.getElementById("prodMinStock").value = p.min_stock_qty ?? "";
  document.getElementById("prodIsActive").checked = p.is_active !== false;

  const typeSelect = document.getElementById("prodTypeSelect");
  typeSelect.value = p.is_finished_product ? "finished" : "ingredient";
  typeSelect.disabled = true; // ⚠️ KHÔNG cho đổi Thành phẩm ⇄ Nguyên liệu khi edit

  document.getElementById("productModalTitle").textContent = "✏️ Sửa sản phẩm";
  document.getElementById("prodDeleteBtn").style.display = isSettingsReadOnly ? "none" : "inline-flex";
  window.clearFieldError("prodName");
  window.clearFieldError("prodUnit");
  updateFinishedProductPriceState();
  document.getElementById("productModal").classList.remove("hidden");

  /* ⚠️ MỚI: reset dirty SAU khi toàn bộ field đã được điền xong ở
     trên, giống hệt vị trí trong openAddProduct(). */
  productFormDirty = false;
}

async function saveProduct() {
  if (isSettingsReadOnly) return;
  const rawId = document.getElementById("prodId").value;
  const id    = rawId ? Number(rawId) : null;
  const name  = document.getElementById("prodName").value.trim();
  const type  = document.getElementById("prodTypeSelect").value; // "ingredient" | "finished"
  const is_finished_product = type === "finished";
  const spec  = document.getElementById("prodSpec").value.trim();
  const unit  = document.getElementById("prodUnit").value.trim();
  const unit_cost = Number(document.getElementById("prodUnitCost").value) || 0;
  const package_unit = document.getElementById("prodPackageUnit").value.trim() || null;
  const package_qty  = package_unit ? (Number(document.getElementById("prodPackageQty").value) || 0) : 1;
  const min_stock_qty = Number(document.getElementById("prodMinStock").value) || 0;
  const is_active = document.getElementById("prodIsActive").checked;

  if (!name) { window.showFieldError("prodName", "Vui lòng nhập tên sản phẩm.", { fullWidth: true }); return; }
  window.clearFieldError("prodName");
  if (!unit) { window.showFieldError("prodUnit", "Vui lòng nhập đơn vị tính.", { fullWidth: true }); return; }
  window.clearFieldError("prodUnit");

  if (!is_finished_product && (!unit_cost || unit_cost < 0)) {
    window.showToast("⚠️ Giá không hợp lệ.", "#e17055");
    return;
  }
  if (package_unit && package_qty <= 0) { window.showToast("⚠️ Số lượng đóng gói phải lớn hơn 0.", "#e17055"); return; }

  const staff = currentSession.displayName || currentSession.username;
  const payload = {
    name, spec: spec || null, unit,
    unit_cost: is_finished_product ? 0 : unit_cost,
    package_qty, package_unit, min_stock_qty, is_active,
    is_finished_product,
    updated_by: staff,
  };

  const btn = document.getElementById("prodSaveBtn");
  btn.disabled = true; btn.textContent = "Đang lưu...";
  try {
    if (id) {
      const { error } = await client.from("ingredients").update(payload).eq("id", id);
      if (error) throw error;
    } else {
      const codeInput = document.getElementById("prodCode");
      const displayedCode = codeInput.value.trim();
      if (!displayedCode || displayedCode.startsWith("⏳")) {
        throw new Error("Chưa tạo được mã sản phẩm — vui lòng đóng và mở lại modal.");
      }
      const finalCode = await ensureUniqueProductCodeBeforeSave(displayedCode, type);
      if (finalCode !== displayedCode) codeInput.value = finalCode;

      const { error } = await client.from("ingredients")
        .insert({ ...payload, code: finalCode, created_by: staff });
      if (error) throw error;
    }
    document.getElementById("productModal").classList.add("hidden");
    /* ⚠️ MỚI: lưu thành công → coi như form đã "sạch" trở lại */
    productFormDirty = false;
    window.showToast("✅ Đã lưu sản phẩm!");
    await loadProducts();
  } catch (err) {
    if (err.code === "23505") window.showToast("⚠️ Mã hoặc sản phẩm (tên + đơn vị) này đã tồn tại.", "#e17055");
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
    productFormDirty = false;
    window.showToast("🗑️ Đã ngừng dùng sản phẩm", "#e17055");
    await loadProducts();
  } catch (err) {
    window.showToast("❌ Lỗi: " + err.message, "#e17055");
  }
}

/* ══════════════════════════════════════════════
   ĐĂNG KÝ HOOK CHO SETTINGS SHARED
   ══════════════════════════════════════════════ */
window.SettingsTabs.onShowHandlers.products = loadProducts;

/* ══════════════════════════════════════════════
   ⚠️ EXPOSE ĐIỀU HƯỚNG TỪ NƠI KHÁC (Kho nguyên liệu)
   ─────────────────────────────────────────────
   Được gọi từ admin/modules/inventory/dashboard-ingredients.js —
   GIỮ NGUYÊN chữ ký / tên hàm như bản gốc.
   ══════════════════════════════════════════════ */
window.openProductInSettings = async function (id) {
  document.getElementById("settingsMenuItem")?.click(); // trigger showPage() + onShow() có sẵn
  window.switchSettingsTab("products");
  await window.Inventory.loadIngredients();
  renderProductsTable();
  if (id) openEditProduct(id);
};
