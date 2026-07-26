/* ══════════════════════════════════════════════
   DASHBOARD ORDERS — admin/modules/orders/dashboard-orders.js
   ─────────────────────────────────────────────
   ⚠️ VIẾT LẠI (UX tạo đơn hàng):
   - Tra cứu SĐT không còn là bước bắt buộc đầu tiên để tạo đơn —
     khách vãng lai (không muốn/không có SĐT đăng ký) giờ tạo đơn
     được ngay, gán vào 1 khách hàng cố định "Khách vãng lai"
     (phone = WALKIN_PHONE, tự tạo trong bảng `customers` nếu chưa
     có — cần vì customer_orders.customer_id là NOT NULL/FK).
   - Toàn bộ luồng "Tạo đơn hàng mới" giờ là 1 POPUP (orderCreateModal):
       Bước 1: chọn "🎫 Thành viên" hay "🚶 Khách vãng lai"
       Bước 2 (chỉ Thành viên): nhập SĐT → tra cứu
       Bước 3: chọn sản phẩm + giảm giá + preview + submit
     (Khách vãng lai bỏ qua Bước 2, vào thẳng Bước 3, giảm giá mặc
     định luôn là 0% — không áp theo cấp độ vì không phải thành viên.)
   - Tra cứu theo SĐT/tên khách giờ nằm ở khối "📅 Lịch sử đơn hàng"
     (lọc client-side trên danh sách đơn đã tải theo khoảng ngày).
   - ⚠️ MỚI: Khách vãng lai KHÔNG được tích XP / streak / check-in tự
     động (maybeAutoCheckin() bị bỏ qua hoàn toàn cho đơn của khách
     vãng lai) — vì hàng "Khách vãng lai" là 1 customer dùng CHUNG
     cho mọi lượt khách không đăng ký, tích XP/streak vào đó sẽ vô
     nghĩa và gây lệch số liệu.

   Cần: client, currentSession, window.Membership (M),
   window.Inventory (INV), window.AdminPermissions.
   ══════════════════════════════════════════════ */

const M_O = window.Membership;

/* Khách hàng cố định dùng cho "Khách vãng lai" — không cần đăng ký SĐT thật.
   ⚠️ Đổi số này ở ĐÚNG 1 CHỖ nếu cần thay đổi sau này. */
const WALKIN_PHONE = "0000136631";
const WALKIN_NAME  = "Khách vãng lai";

const isOrdersReadOnly = window.AdminPermissions.isReadOnly(currentSession.role);
const canCreateOrders  = window.AdminPermissions.canCreateOrders(currentSession.role);
const canViewOrderCost = window.AdminPermissions.canViewCost(currentSession.role);

let orderDrinksCache = [];
let orderDraftRows   = [];
let orderRowSeq      = 0;
let ordFoundCustomer = null;
let ordCustomerType  = null; // "member" | "guest" | null

const _todayStr = new Date().toISOString().slice(0, 10);
let currentOrderFrom = _todayStr;
let currentOrderTo   = _todayStr;
let ordersOfDay      = [];
let ordHistorySearchQ = "";

function round2(n) { return Math.round((Number(n) || 0) * 100) / 100; }

/* ══════════════════════════════════════════════
   STYLES riêng cho khối chọn loại khách (bước 1)
   ══════════════════════════════════════════════ */
(function injectOrdersStyles() {
  if (document.getElementById("ordersModuleStyles")) return;
  const style = document.createElement("style");
  style.id = "ordersModuleStyles";
  style.textContent = `
    .ord-type-btn {
      display:flex;flex-direction:column;align-items:flex-start;gap:2px;
      padding:22px 20px;border:2px solid var(--border);border-radius:14px;
      background:var(--card);cursor:pointer;text-align:left;
      font-family:'Inter',sans-serif;transition:border-color .15s,background .15s,transform .1s;
    }
    .ord-type-btn:hover { border-color:var(--primary); background:#faf9ff; }
    .ord-type-btn:active { transform:scale(.98); }
    .ord-type-icon { font-size:28px; line-height:1; }
    .ord-type-name { font-weight:700; font-size:14px; color:var(--text); margin-top:8px; }
    .ord-type-desc { font-size:12px; color:var(--text-muted); margin-top:4px; line-height:1.4; }
  `;
  document.head.appendChild(style);
})();

/* ══════════════════════════════════════════════
   ĐĂNG KÝ PAGE
   ══════════════════════════════════════════════ */
window.AdminDashboard.registerPage({
  pageId: "ordersPage",
  menuId: "ordersMenuItem",
  placeholderId: "ordersMenuItemPlaceholder", // ⚠️ đã có sẵn trong dashboard.html
  icon: "🧾",
  label: "Đơn hàng",
  insertBeforeMenuId: "chatMenuItem",
  onShow: () => {
    closeOrderCreateModal();
    loadOrderDrinksCache();
    loadOrdersByDate(currentOrderFrom, currentOrderTo);
  },
});

/* ══════════════════════════════════════════════
   INJECT PAGE HTML
   ══════════════════════════════════════════════ */
(function injectOrdersPage() {
  const main = document.querySelector(".main-content");
  if (!main) return;

  const page = document.createElement("div");
  page.id = "ordersPage";
  page.style.display = "none";
  page.innerHTML = `
    <div class="page-header">
      <div>
        <h1 class="page-title">🧾 Đơn hàng</h1>
        <p class="page-subtitle">Tạo đơn hàng mới &amp; tra cứu lịch sử đơn theo khoảng ngày hoặc SĐT</p>
      </div>
      <div class="header-actions">
        <button class="btn btn-primary" id="ordOpenCreateBtn">➕ Tạo đơn hàng mới</button>
      </div>
    </div>

    <!-- ═══ LỊCH SỬ + TRA CỨU ═══ -->
    <div class="table-card" style="padding:22px 24px;">
      <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:14px;flex-wrap:wrap;gap:10px;">
        <div style="font-size:14px;font-weight:700;">📅 Lịch sử đơn hàng</div>
        <div style="display:flex;gap:6px;align-items:center;flex-wrap:wrap;">
          <input type="date" id="ordDateFrom" style="height:38px;border:1px solid var(--border);border-radius:8px;padding:0 10px;font-size:13px;">
          <span style="color:var(--text-muted);font-size:13px;">→</span>
          <input type="date" id="ordDateTo" style="height:38px;border:1px solid var(--border);border-radius:8px;padding:0 10px;font-size:13px;">
          <button class="btn btn-secondary" id="ordDateRefreshBtn">🔄</button>
        </div>
      </div>

      <div style="margin-bottom:16px;">
        <label for="ordHistorySearchInput" class="visually-hidden">Tìm theo SĐT hoặc tên khách</label>
        <input type="text" id="ordHistorySearchInput" class="search-input" style="max-width:340px;"
          placeholder="🔍 Tìm theo SĐT hoặc tên khách trong khoảng ngày này...">
      </div>

      <table class="game-table">
        <thead><tr><th></th><th>Mã đơn</th><th>Khách hàng</th><th>Thời gian</th><th>Số món</th><th>Khách trả</th><th>Trạng thái</th></tr></thead>
        <tbody id="ordDateTableBody"><tr><td colspan="7" style="text-align:center;padding:30px;color:var(--text-muted);">⏳ Đang tải...</td></tr></tbody>
      </table>
    </div>

    <!-- ═══ MODAL: TẠO ĐƠN HÀNG ═══ -->
    <div class="modal-overlay hidden" id="orderCreateModal" role="dialog" aria-modal="true" aria-labelledby="orderCreateModalTitle">
      <div class="modal-box" style="max-width:640px;">
        <div class="modal-header">
          <h2 id="orderCreateModalTitle">➕ Tạo đơn hàng mới</h2>
          <button class="close-btn" id="closeOrderCreateModalBtn" aria-label="Đóng cửa sổ">✕</button>
        </div>

        <!-- BƯỚC 1: chọn loại khách -->
        <div id="ordStepType">
          <div style="font-size:13px;color:var(--text-muted);margin-bottom:16px;">Đơn hàng này dành cho ai?</div>
          <div style="display:grid;grid-template-columns:1fr 1fr;gap:14px;">
            <button type="button" class="ord-type-btn" data-type="member">
              <span class="ord-type-icon" aria-hidden="true">🎫</span>
              <span class="ord-type-name">Thành viên</span>
              <span class="ord-type-desc">Tra SĐT đã đăng ký — tích XP &amp; áp dụng ưu đãi theo cấp độ</span>
            </button>
            <button type="button" class="ord-type-btn" data-type="guest">
              <span class="ord-type-icon" aria-hidden="true">🚶</span>
              <span class="ord-type-name">Khách vãng lai</span>
              <span class="ord-type-desc">Không cần SĐT / đăng ký — không tích điểm, vào thẳng chọn món</span>
            </button>
          </div>
        </div>

        <!-- BƯỚC 2: nhập SĐT (chỉ khi chọn Thành viên) -->
        <div id="ordStepPhone" class="hidden">
          <button type="button" class="btn btn-secondary" id="ordBackToTypeBtn" style="margin-bottom:16px;">← Quay lại</button>
          <div style="display:flex;gap:10px;align-items:center;margin-bottom:12px;flex-wrap:wrap;">
            <input type="tel" id="ordLookupPhone" placeholder="Nhập SĐT khách hàng..." inputmode="tel"
              style="height:44px;border:1px solid var(--border);border-radius:10px;padding:0 14px;font-size:14px;flex:1;min-width:220px;">
            <button class="btn btn-primary" id="ordLookupBtn">🔍 Tìm khách</button>
          </div>
          <div id="ordCustomerNotFound" class="hidden" style="color:var(--danger);font-size:13px;">
            ⚠️ Không tìm thấy khách hàng với SĐT này. Vào tab Khách hàng để tạo mới trước, hoặc chọn "Khách vãng lai".
          </div>
        </div>

        <!-- BƯỚC 3: chọn sản phẩm -->
        <div id="ordFormArea" class="hidden">
          <div id="ordSelectedCustomerBar" style="background:var(--bg);border-radius:10px;padding:12px 16px;margin-bottom:14px;font-size:13px;display:flex;justify-content:space-between;align-items:center;gap:10px;flex-wrap:wrap;"></div>

          <div id="orderDraftRows" style="display:flex;flex-direction:column;gap:8px;margin-bottom:8px;"></div>
          <button type="button" class="btn btn-secondary" id="ordAddRowBtn" style="margin-bottom:12px;">+ Thêm sản phẩm</button>
          <div id="ordDiscountRow" style="display:flex;gap:10px;align-items:center;margin-bottom:10px;flex-wrap:wrap;">
            <label style="font-size:12px;color:var(--text-muted);">Giảm giá áp dụng (%)</label>
            <input type="number" id="ordDiscountPct" min="0" max="100" value="0" style="width:80px;height:36px;border:1px solid var(--border);border-radius:8px;padding:0 8px;">
          </div>
          <div id="ordPreviewBox" style="background:var(--bg);border-radius:10px;padding:12px 16px;margin-bottom:14px;font-size:13px;"></div>
          <button class="btn btn-primary" id="ordSubmitBtn">✅ Tạo đơn hàng</button>
        </div>
      </div>
    </div>

    <!-- Modal huỷ (dùng chung order/item) -->
    <div class="modal-overlay hidden" id="voidOrderModal" role="dialog" aria-modal="true" aria-labelledby="voidOrderModalTitle">
      <div class="modal-box" style="max-width:420px;">
        <div class="modal-header">
          <h2 id="voidOrderModalTitle">Huỷ đơn hàng</h2>
          <button class="close-btn" id="closeVoidOrderModalBtn" aria-label="Đóng cửa sổ">✕</button>
        </div>
        <input type="hidden" id="voidTargetType">
        <input type="hidden" id="voidOrderId">
        <div id="voidTargetSummary" style="font-size:13px;color:var(--text-muted);margin-bottom:12px;"></div>
        <div class="form-group"><label for="voidReasonInput">Lý do huỷ *</label><input type="text" id="voidReasonInput" placeholder="VD: khách đặt nhầm, lên món sai..."></div>
        <div class="modal-actions" style="justify-content:flex-end;">
          <button class="btn btn-danger" id="confirmVoidOrderBtn">🗑️ Xác nhận huỷ</button>
        </div>
      </div>
    </div>
  `;
  main.appendChild(page);
  bindOrdersPageEvents();
})();

function bindOrdersPageEvents() {
  /* ── Mở/đóng popup tạo đơn ── */
  document.getElementById("ordOpenCreateBtn")?.addEventListener("click", openOrderCreateModal);
  document.getElementById("closeOrderCreateModalBtn")?.addEventListener("click", closeOrderCreateModal);
  const createModal = document.getElementById("orderCreateModal");
  createModal?.addEventListener("click", e => { if (e.target === createModal) closeOrderCreateModal(); });
  createModal?.addEventListener("keydown", e => { if (e.key === "Escape") closeOrderCreateModal(); });

  /* ── Bước 1: chọn loại khách ── */
  document.querySelectorAll(".ord-type-btn").forEach(btn => {
    btn.addEventListener("click", () => selectOrderType(btn.dataset.type));
  });
  document.getElementById("ordBackToTypeBtn")?.addEventListener("click", goBackToType);

  /* ── Bước 2: tra SĐT ── */
  document.getElementById("ordLookupBtn")?.addEventListener("click", lookupCustomerForOrder);
  document.getElementById("ordLookupPhone")?.addEventListener("keydown", e => {
    if (e.key === "Enter") lookupCustomerForOrder();
  });

  /* ── Bước 3: chọn sản phẩm ── */
  document.getElementById("ordAddRowBtn")?.addEventListener("click", () => addOrderDraftRow());
  document.getElementById("ordDiscountPct")?.addEventListener("input", updateOrderPreview);
  document.getElementById("ordSubmitBtn")?.addEventListener("click", submitOrder);

  /* ── Lịch sử theo khoảng ngày + tìm SĐT/tên ── */
  document.getElementById("ordDateFrom").value = currentOrderFrom;
  document.getElementById("ordDateTo").value   = currentOrderTo;
  document.getElementById("ordDateFrom")?.addEventListener("change", handleOrderDateRangeChange);
  document.getElementById("ordDateTo")?.addEventListener("change", handleOrderDateRangeChange);
  document.getElementById("ordDateRefreshBtn")?.addEventListener("click", () => loadOrdersByDate(currentOrderFrom, currentOrderTo));
  document.getElementById("ordHistorySearchInput")?.addEventListener("input", window.debounce(e => {
    ordHistorySearchQ = e.target.value.trim().toLowerCase();
    renderOrdersOfDayTable();
  }, 200));

  /* ── Modal huỷ ── */
  document.getElementById("closeVoidOrderModalBtn")?.addEventListener("click", () =>
    document.getElementById("voidOrderModal").classList.add("hidden"));
  document.getElementById("confirmVoidOrderBtn")?.addEventListener("click", confirmVoidOrder);

  const voidModal = document.getElementById("voidOrderModal");
  voidModal?.addEventListener("click", e => { if (e.target === voidModal) voidModal.classList.add("hidden"); });
  voidModal?.addEventListener("keydown", e => { if (e.key === "Escape") voidModal.classList.add("hidden"); });

  if (!canCreateOrders) {
    const btn = document.getElementById("ordOpenCreateBtn");
    if (btn) { btn.disabled = true; btn.title = "Tài khoản của bạn không có quyền tạo đơn hàng."; }
  }
}

/* Đổi "Từ ngày"/"Đến ngày" → tự hoán đổi nếu nhập ngược, rồi tải lại */
function handleOrderDateRangeChange() {
  currentOrderFrom = document.getElementById("ordDateFrom").value || currentOrderFrom;
  currentOrderTo   = document.getElementById("ordDateTo").value   || currentOrderTo;
  if (currentOrderFrom > currentOrderTo) [currentOrderFrom, currentOrderTo] = [currentOrderTo, currentOrderFrom];
  document.getElementById("ordDateFrom").value = currentOrderFrom;
  document.getElementById("ordDateTo").value   = currentOrderTo;
  loadOrdersByDate(currentOrderFrom, currentOrderTo);
}

/* ══════════════════════════════════════════════
   POPUP TẠO ĐƠN — mở/đóng/điều hướng bước
   ══════════════════════════════════════════════ */
function openOrderCreateModal() {
  if (!canCreateOrders) return;
  resetOrderCreateState();
  document.getElementById("orderCreateModal").classList.remove("hidden");
}

function closeOrderCreateModal() {
  document.getElementById("orderCreateModal")?.classList.add("hidden");
}

function resetOrderCreateState() {
  ordCustomerType  = null;
  ordFoundCustomer = null;
  orderDraftRows   = [];

  document.getElementById("orderDraftRows").innerHTML = "";
  document.getElementById("ordLookupPhone").value = "";
  document.getElementById("ordCustomerNotFound").classList.add("hidden");
  document.getElementById("ordDiscountPct").value = 0;
  document.getElementById("ordDiscountPct").disabled = false;
  document.getElementById("ordSelectedCustomerBar").innerHTML = "";

  document.getElementById("ordStepType").classList.remove("hidden");
  document.getElementById("ordStepPhone").classList.add("hidden");
  document.getElementById("ordFormArea").classList.add("hidden");
}

function selectOrderType(type) {
  if (!canCreateOrders) return;
  ordCustomerType = type;
  document.getElementById("ordStepType").classList.add("hidden");

  if (type === "member") {
    document.getElementById("ordStepPhone").classList.remove("hidden");
    document.getElementById("ordLookupPhone").focus();
  } else {
    useWalkInCustomer();
  }
}

function goBackToType() {
  ordFoundCustomer = null;
  document.getElementById("ordStepPhone").classList.add("hidden");
  document.getElementById("ordFormArea").classList.add("hidden");
  document.getElementById("ordCustomerNotFound").classList.add("hidden");
  document.getElementById("ordLookupPhone").value = "";
  document.getElementById("ordStepType").classList.remove("hidden");
}

function showOrderFormArea() {
  document.getElementById("ordStepPhone").classList.add("hidden");
  document.getElementById("ordStepType").classList.add("hidden");
  document.getElementById("ordFormArea").classList.remove("hidden");
  renderSelectedCustomerBar();
  updateOrderPreview();
}

function renderSelectedCustomerBar() {
  const bar = document.getElementById("ordSelectedCustomerBar");
  if (!bar || !ordFoundCustomer) return;

  const isWalkIn = ordFoundCustomer.phone === WALKIN_PHONE;
  let infoHtml;
  if (isWalkIn) {
    infoHtml = `🚶 <b>Khách vãng lai</b> <span style="color:var(--text-muted);font-weight:500;">— không tích điểm/ưu đãi thành viên</span>`;
  } else {
    const info = M_O.getLevelInfo(ordFoundCustomer.level);
    infoHtml = `${info.rank_icon} <b>${window.escHtml(ordFoundCustomer.name)}</b> — ${window.escHtml(info.rank_name)} · ${ordFoundCustomer.xp} XP`;
  }

  bar.innerHTML = `
    <span>${infoHtml}</span>
    <button type="button" class="btn btn-secondary" id="ordChangeCustomerBtn" style="font-size:12px;padding:6px 10px;">↺ Đổi khách hàng</button>
  `;
  document.getElementById("ordChangeCustomerBtn")?.addEventListener("click", goBackToType);
}

/* ══════════════════════════════════════════════
   KHÁCH VÃNG LAI — dùng chung 1 hàng customers cố định.
   ⚠️ KHÔNG tích XP/streak/check-in (xem submitOrder()).
   ══════════════════════════════════════════════ */
async function useWalkInCustomer() {
  try {
    let { data, error } = await client
      .from("customers").select("*").eq("phone", WALKIN_PHONE).is("deleted_at", null).maybeSingle();
    if (error) throw error;

    if (!data) {
      const { data: created, error: insErr } = await client
        .from("customers")
        .insert({ name: WALKIN_NAME, phone: WALKIN_PHONE, created_by: currentSession.displayName || currentSession.username })
        .select().single();
      if (insErr) throw insErr;
      data = created;
    }

    ordFoundCustomer = data;
    /* ⚠️ Khách vãng lai: giảm giá luôn mặc định 0%, KHÔNG lấy theo
       cấp độ (vì không phải thành viên thật). Nhân viên vẫn có thể
       tự sửa tay nếu quán có chính sách giảm giá riêng cho trường hợp cụ thể. */
    document.getElementById("ordDiscountPct").value = 0;
    orderDraftRows = [];
    document.getElementById("orderDraftRows").innerHTML = "";
    addOrderDraftRow();
    showOrderFormArea();
  } catch (err) {
    window.showToast("❌ Không thể tạo đơn cho khách vãng lai: " + err.message, "#e17055");
    goBackToType();
  }
}

/* ══════════════════════════════════════════════
   TRA SĐT — chỉ dùng khi chọn "Thành viên"
   ══════════════════════════════════════════════ */
async function lookupCustomerForOrder() {
  if (!canCreateOrders) return;
  const phone = M_O.normalizePhone(document.getElementById("ordLookupPhone").value);
  const notFoundBox = document.getElementById("ordCustomerNotFound");

  if (!/^0\d{9,10}$/.test(phone)) { window.showToast("⚠️ SĐT không hợp lệ.", "#e17055"); return; }

  const { data, error } = await client
    .from("customers").select("*").eq("phone", phone).is("deleted_at", null).maybeSingle();

  if (error || !data) {
    notFoundBox.classList.remove("hidden");
    return;
  }

  notFoundBox.classList.add("hidden");
  ordFoundCustomer = data;
  const info = M_O.getLevelInfo(data.level);
  document.getElementById("ordDiscountPct").value = info.discount_pct || 0;
  orderDraftRows = [];
  document.getElementById("orderDraftRows").innerHTML = "";
  addOrderDraftRow();
  showOrderFormArea();
}

async function loadOrderDrinksCache() {
  try {
    const [{ data: drinks, error: dErr }, { data: costs, error: cErr }] = await Promise.all([
      client.from("drinks").select("id, name, price").is("deleted_at", null).eq("is_active", true).order("sort_order"),
      client.from("v_drink_cost").select("*"),
    ]);
    if (dErr) throw dErr;
    if (cErr) throw cErr;
    const costMap = new Map((costs || []).map(c => [c.drink_id, Number(c.ingredient_cost) || 0]));
    orderDrinksCache = (drinks || []).map(d => ({
      id: d.id, name: d.name, price: Number(d.price) || 0,
      ingredient_cost: costMap.get(d.id) || 0,
    }));
  } catch (err) {
    console.warn("loadOrderDrinksCache:", err.message);
  }
}

/* ══════════════════════════════════════════════
   DÒNG SẢN PHẨM TRONG FORM TẠO ĐƠN
   ══════════════════════════════════════════════ */
function drinkOptionsHtml(selectedId) {
  return '<option value="">-- Chọn đồ uống --</option>' + orderDrinksCache.map(d =>
    `<option value="${d.id}" ${d.id === selectedId ? 'selected' : ''}>${window.escHtml(d.name)} — ${d.price.toLocaleString('vi-VN')}đ</option>`
  ).join('');
}

function addOrderDraftRow() {
  const wrap = document.getElementById("orderDraftRows");
  if (!wrap) return;
  const rowId = 'or' + (++orderRowSeq);
  const div = document.createElement('div');
  div.className = 'order-draft-row';
  div.dataset.rowId = rowId;
  div.style.cssText = 'display:grid;grid-template-columns:2fr 1fr auto;gap:8px;align-items:center;';
  div.innerHTML = `
    <select class="order-drink-select" style="height:40px;border:1px solid var(--border);border-radius:8px;padding:0 8px;font-size:13px;">
      ${drinkOptionsHtml()}
    </select>
    <input type="number" class="order-qty-input" min="1" step="1" value="1" style="height:40px;border:1px solid var(--border);border-radius:8px;padding:0 8px;font-size:13px;">
    <button type="button" class="close-btn order-row-remove" title="Xoá dòng" style="width:36px;height:36px;">✕</button>
  `;
  wrap.appendChild(div);

  div.querySelector('.order-drink-select').addEventListener('change', updateOrderPreview);
  div.querySelector('.order-qty-input').addEventListener('input', updateOrderPreview);
  div.querySelector('.order-row-remove').addEventListener('click', () => { div.remove(); updateOrderPreview(); });

  updateOrderPreview();
}

function readOrderDraftRows() {
  return [...document.querySelectorAll('#orderDraftRows .order-draft-row')].map(div => ({
    drink_id: Number(div.querySelector('.order-drink-select').value) || null,
    quantity: Math.max(1, Number(div.querySelector('.order-qty-input').value) || 0),
  })).filter(r => r.drink_id && r.quantity > 0);
}

function updateOrderPreview() {
  const box = document.getElementById("ordPreviewBox");
  if (!box) return;
  const discountPct = Number(document.getElementById("ordDiscountPct")?.value) || 0;
  const rows = readOrderDraftRows();

  if (!rows.length) { box.innerHTML = '<span style="color:var(--text-muted);">Chưa chọn sản phẩm nào.</span>'; return; }

  let totalPaid = 0, totalProfit = 0;
  const lines = rows.map(r => {
    const d = orderDrinksCache.find(x => x.id === r.drink_id);
    if (!d) return '';
    const subtotal = round2(d.price * r.quantity);
    const customerPaid = round2(subtotal * (1 - discountPct / 100));
    const costTotal = round2(d.ingredient_cost * r.quantity);
    const profit = round2(customerPaid - costTotal);
    totalPaid += customerPaid;
    totalProfit += profit;
    return `<div style="display:flex;justify-content:space-between;"><span>${window.escHtml(d.name)} ×${r.quantity}</span><span>${customerPaid.toLocaleString('vi-VN')}đ</span></div>`;
  }).join('');

  const totalPaidBlock = `
    <div style="border-top:1px solid var(--border);margin-top:8px;padding-top:8px;display:flex;justify-content:space-between;font-weight:700;">
      <span>Khách trả</span><span>${totalPaid.toLocaleString('vi-VN')}đ</span>
    </div>`;

  const profitBlock = canViewOrderCost ? `
    <div style="display:flex;justify-content:space-between;color:${totalProfit >= 0 ? '#00b894' : 'var(--danger)'};font-weight:600;">
      <span>Lợi nhuận gộp</span><span>${totalProfit.toLocaleString('vi-VN')}đ</span>
    </div>` : '';

  box.innerHTML = lines + totalPaidBlock + profitBlock;
}

/* ══════════════════════════════════════════════
   SUBMIT ĐƠN — kho + auto check-in (CHỈ cho thành viên thật)
   ══════════════════════════════════════════════ */
async function submitOrder() {
  if (!canCreateOrders || !ordFoundCustomer) return;
  const rows = readOrderDraftRows();
  if (!rows.length) { window.showToast("⚠️ Vui lòng chọn ít nhất 1 sản phẩm.", "#e17055"); return; }

  const customerId = ordFoundCustomer.id;
  const isWalkInOrder = ordFoundCustomer.phone === WALKIN_PHONE; // ⚠️ MỚI
  const discountPct = Number(document.getElementById("ordDiscountPct").value) || 0;
  const staff = currentSession.displayName || currentSession.username;
  const btn = document.getElementById("ordSubmitBtn");

  btn.disabled = true; btn.textContent = "Đang tạo...";

  try {
    const { data: order, error: orderErr } = await client
      .from("customer_orders").insert({ customer_id: customerId, staff_name: staff }).select().single();
    if (orderErr) throw orderErr;

    const itemsToInsert = rows.map(r => {
      const d = orderDrinksCache.find(x => x.id === r.drink_id);
      const subtotal = round2(d.price * r.quantity);
      const customerPaid = round2(subtotal * (1 - discountPct / 100));
      const ingredientCostTotal = round2(d.ingredient_cost * r.quantity);
      const profit = round2(customerPaid - ingredientCostTotal);
      return {
        order_id: order.id, drink_id: d.id, product_name: d.name,
        quantity: r.quantity, unit_price: d.price, discount_pct: discountPct,
        subtotal, customer_paid: customerPaid,
        ingredient_unit_cost: d.ingredient_cost, ingredient_cost_total: ingredientCostTotal,
        profit,
      };
    });

    const { data: insertedItems, error: itemsErr } = await client
      .from("customer_order_items").insert(itemsToInsert).select();
    if (itemsErr) throw itemsErr;

    await consumeStockForOrderItems(insertedItems);

    /* ⚠️ MỚI: khách vãng lai KHÔNG check-in / KHÔNG tích XP / KHÔNG
       streak. Đơn hàng vẫn lưu đầy đủ để tổng kết doanh thu/lợi nhuận
       chung của quán, nhưng không đụng tới customer_quests/xp/level
       của hàng "Khách vãng lai" dùng chung cho mọi lượt khách khác nhau. */
    if (!isWalkInOrder) {
      await maybeAutoCheckin(customerId, order.id, staff);
    }

    window.showToast(`✅ Đã tạo đơn hàng ${order.order_number}!`);
    closeOrderCreateModal();

    /* Chỉ tự tải lại bảng nếu khoảng ngày đang xem có bao gồm hôm nay */
    const todayStr = new Date().toISOString().slice(0, 10);
    if (todayStr >= currentOrderFrom && todayStr <= currentOrderTo) {
      loadOrdersByDate(currentOrderFrom, currentOrderTo);
    }
  } catch (err) {
    window.showToast("❌ Lỗi khi tạo đơn hàng: " + err.message, "#e17055");
  } finally {
    btn.disabled = false; btn.textContent = "✅ Tạo đơn hàng";
  }
}

async function consumeStockForOrderItems(items) {
  const warnings = [];
  for (const item of items) {
    const { data: recipe, error } = await client
      .from("drink_ingredients").select("*").eq("drink_id", item.drink_id);
    if (error || !recipe?.length) continue;

    for (const r of recipe) {
      const ing = window.Inventory.getIngredientById(r.ingredient_id);
      const currentStock = ing ? ing.current_stock : 0;
      const qtyNeeded = Number(r.qty_per_serving) * item.quantity * Number(r.conversion_rate || 1);
      let qtyChange = -qtyNeeded;
      let qtyAfter = currentStock + qtyChange;
      if (qtyAfter < 0) {
        warnings.push(ing?.name || `#${r.ingredient_id}`);
        qtyAfter = 0;
        qtyChange = -currentStock;
      }
      await client.from("ingredient_stock_logs").insert({
        ingredient_id: r.ingredient_id, order_item_id: item.id,
        log_type: "order_consume", qty_change: qtyChange, qty_after: qtyAfter,
        staff_name: currentSession.displayName || currentSession.username,
      });
      if (ing) ing.current_stock = qtyAfter;
    }
  }
  if (warnings.length) {
    window.showToast(`⚠️ Kho không đủ cho: ${[...new Set(warnings)].join(", ")} — đã trừ về 0, cần nhập thêm.`, "#e17055");
  }
}

async function maybeAutoCheckin(customerId, orderId, staff) {
  const checkinQuest = M_O.getCheckinQuest();
  if (!checkinQuest) return;

  const todayStr = new Date().toISOString().slice(0, 10);
  const { data: todaysOrders, error } = await client
    .from("customer_orders")
    .select("id")
    .eq("customer_id", customerId)
    .eq("status", "completed")
    .gte("created_at", todayStr + "T00:00:00")
    .lt("created_at", todayStr + "T23:59:59.999");
  if (error) { console.warn("maybeAutoCheckin:", error.message); return; }
  if ((todaysOrders || []).length !== 1) return;

  const { data: custRow } = await client.from("customers").select("*").eq("id", customerId).single();
  const lastCheckin = custRow?.last_checkin_date;
  let newStreak = 1;
  if (lastCheckin) {
    const diffDays = Math.round((new Date(todayStr) - new Date(lastCheckin)) / 86400000);
    newStreak = diffDays === 1 ? (custRow.streak_days || 0) + 1 : 1;
  }
  const bonus = newStreak % 7 === 0 ? 20 : 0;
  const xpEarned = checkinQuest.xp_reward + bonus;
  const newXp = (custRow?.xp || 0) + xpEarned;
  const newLevel = M_O.getLevelForXp(newXp);

  try {
    await client.from("customer_quests").insert({
      customer_id: customerId, quest_id: checkinQuest.id, related_order_id: orderId,
      period_key: todayStr, progress: 1, is_completed: true, xp_awarded: xpEarned,
      completed_by: staff, completed_at: new Date().toISOString(),
    });
    await client.from("customers").update({
      xp: newXp, level: newLevel, streak_days: newStreak, last_checkin_date: todayStr,
    }).eq("id", customerId);
    window.showToast(`✅ Check-in tự động! +${xpEarned} XP (streak ${newStreak} ngày)` + (bonus ? ` 🔥 +${bonus} XP thưởng chuỗi 7 ngày!` : ""));
  } catch (err) {
    console.warn("maybeAutoCheckin insert:", err.message);
  }
}

/* ══════════════════════════════════════════════
   TRA CỨU THEO KHOẢNG NGÀY + TÌM SĐT/TÊN + ACCORDION
   ⚠️ Bảng này chỉ hiện "Khách trả", KHÔNG hiện giá vốn/lợi nhuận.
   ══════════════════════════════════════════════ */
async function loadOrdersByDate(fromStr, toStr) {
  const tbody = document.getElementById("ordDateTableBody");
  tbody.innerHTML = `<tr><td colspan="7" style="text-align:center;padding:30px;color:var(--text-muted);">⏳ Đang tải...</td></tr>`;

  const { data, error } = await client
    .from("customer_orders")
    .select("*, customers(name, phone), customer_order_items(*)")
    .gte("created_at", fromStr + "T00:00:00")
    .lt("created_at", toStr + "T23:59:59.999")
    .order("created_at", { ascending: false });

  if (error) {
    tbody.innerHTML = `<tr><td colspan="7" style="text-align:center;padding:30px;color:var(--danger);">Lỗi: ${window.escHtml(error.message)}</td></tr>`;
    return;
  }

  ordersOfDay = data || [];
  renderOrdersOfDayTable();
}

function renderOrdersOfDayTable() {
  const tbody = document.getElementById("ordDateTableBody");

  const filtered = ordHistorySearchQ
    ? ordersOfDay.filter(o => {
        const name  = (o.customers?.name  || "").toLowerCase();
        const phone = (o.customers?.phone || "").toLowerCase();
        const num   = (o.order_number || "").toLowerCase();
        return name.includes(ordHistorySearchQ) || phone.includes(ordHistorySearchQ) || num.includes(ordHistorySearchQ);
      })
    : ordersOfDay;

  if (!filtered.length) {
    tbody.innerHTML = `<tr><td colspan="7" style="text-align:center;padding:30px;color:var(--text-muted);">${
      ordHistorySearchQ ? "Không tìm thấy đơn hàng phù hợp với SĐT/tên này trong khoảng ngày đã chọn." : "Không có đơn hàng nào trong khoảng ngày này."
    }</td></tr>`;
    return;
  }

  tbody.innerHTML = filtered.map(o => {
    const items = o.customer_order_items || [];
    const activeItems = items.filter(it => !it.is_void);
    const totalPaid = activeItems.reduce((s, it) => s + Number(it.customer_paid), 0);
    const isVoided = o.status === "voided";

    return `
      <tr class="ord-row" data-order-row="${o.id}" style="cursor:pointer;${isVoided ? 'opacity:.55;' : ''}">
        <td style="width:28px;"><span class="ord-caret" data-caret="${o.id}">▸</span></td>
        <td><b>${window.escHtml(o.order_number)}</b></td>
        <td>${window.escHtml(o.customers?.name || "—")}<div class="game-id">${window.escHtml(o.customers?.phone || "")}</div></td>
        <td>${new Date(o.created_at).toLocaleString("vi-VN", { day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" })}</td>
        <td>${activeItems.length} món</td>
        <td style="font-weight:700;">${totalPaid.toLocaleString('vi-VN')}đ</td>
        <td>${isVoided ? '<span class="badge" style="background:#fdecea;color:var(--danger);">Đã huỷ</span>' : '<span class="badge">Hoàn tất</span>'}</td>
      </tr>
      <tr class="ord-detail-row hidden" id="ordDetailRow-${o.id}">
        <td></td>
        <td colspan="6" style="background:var(--bg);padding:14px 20px;">
          ${items.map(it => `
            <div style="display:flex;align-items:center;justify-content:space-between;gap:10px;padding:6px 0;border-bottom:1px solid var(--border);${it.is_void ? 'opacity:.5;text-decoration:line-through;' : ''}">
              <span>${window.escHtml(it.product_name)} ×${it.quantity} — ${Number(it.customer_paid).toLocaleString('vi-VN')}đ</span>
              ${(!isVoided && !it.is_void) ? `<button class="btn btn-secondary" style="font-size:11px;padding:4px 10px;" data-void-item="${it.id}" data-void-cust="${o.customer_id}">Huỷ dòng</button>` : ''}
              ${it.is_void ? `<span style="font-size:11px;color:var(--danger);">Đã huỷ${it.void_reason ? ': ' + window.escHtml(it.void_reason) : ''}</span>` : ''}
            </div>`).join('') || '<span style="color:var(--text-muted);">Không có sản phẩm.</span>'}
          ${!isVoided ? `<button class="btn btn-danger" style="font-size:12px;padding:6px 12px;margin-top:10px;" data-void-order="${o.id}" data-void-cust="${o.customer_id}">🗑️ Huỷ cả đơn</button>` : (o.void_reason ? `<div style="font-size:11px;color:var(--text-muted);margin-top:8px;">Lý do huỷ: ${window.escHtml(o.void_reason)}</div>` : '')}
        </td>
      </tr>
    `;
  }).join("");

  tbody.querySelectorAll(".ord-row").forEach(row => {
    row.addEventListener("click", () => {
      const id = row.dataset.orderRow;
      const detailRow = document.getElementById(`ordDetailRow-${id}`);
      const caret = row.querySelector(`[data-caret="${id}"]`);
      const isOpen = !detailRow.classList.contains("hidden");
      detailRow.classList.toggle("hidden", isOpen);
      caret.textContent = isOpen ? "▸" : "▾";
    });
  });
  tbody.querySelectorAll("[data-void-order]").forEach(btn => {
    btn.addEventListener("click", e => { e.stopPropagation(); openVoidModal("order", Number(btn.dataset.voidOrder), Number(btn.dataset.voidCust)); });
  });
  tbody.querySelectorAll("[data-void-item]").forEach(btn => {
    btn.addEventListener("click", e => { e.stopPropagation(); openVoidModal("item", Number(btn.dataset.voidItem), Number(btn.dataset.voidCust)); });
  });
}

/* ══════════════════════════════════════════════
   HUỶ ĐƠN / HUỶ DÒNG (giữ nguyên logic gốc — vẫn dùng
   isOrdersReadOnly, KHÔNG đổi sang canCreateOrders. Barstaff được
   tạo đơn nhưng vẫn KHÔNG được huỷ đơn/huỷ dòng.)
   ══════════════════════════════════════════════ */
function openVoidModal(type, targetId, customerId) {
  if (isOrdersReadOnly) return;
  document.getElementById("voidTargetType").value = type;
  document.getElementById("voidOrderId").value = targetId;
  document.getElementById("voidOrderId").dataset.customerId = customerId;
  document.getElementById("voidReasonInput").value = "";
  document.getElementById("voidOrderModalTitle").textContent =
    type === "order" ? "Huỷ cả đơn hàng" : "Huỷ dòng sản phẩm";
  document.getElementById("voidTargetSummary").textContent =
    type === "order"
      ? "Toàn bộ đơn hàng này sẽ được đánh dấu là đã huỷ — kho sẽ được hoàn lại tự động."
      : "Chỉ dòng sản phẩm này bị huỷ — kho của riêng dòng này sẽ được hoàn lại tự động.";
  document.getElementById("confirmVoidOrderBtn").textContent =
    type === "order" ? "🗑️ Xác nhận huỷ cả đơn" : "🗑️ Xác nhận huỷ dòng";
  document.getElementById("voidOrderModal").classList.remove("hidden");
  document.getElementById("voidReasonInput").focus();
}

async function confirmVoidOrder() {
  const type = document.getElementById("voidTargetType").value;
  const targetId = Number(document.getElementById("voidOrderId").value);
  const customerId = Number(document.getElementById("voidOrderId").dataset.customerId);
  const reason = document.getElementById("voidReasonInput").value.trim();
  if (!reason) { window.showToast("⚠️ Vui lòng nhập lý do huỷ.", "#e17055"); return; }

  const btn = document.getElementById("confirmVoidOrderBtn");
  btn.disabled = true; btn.textContent = "Đang huỷ...";
  const staff = currentSession.displayName || currentSession.username;

  try {
    if (type === "item") {
      const { error } = await client.from("customer_order_items").update({
        is_void: true, void_reason: reason, voided_by: staff, voided_at: new Date().toISOString(),
      }).eq("id", targetId);
      if (error) throw error;
      window.showToast("🗑️ Đã huỷ dòng sản phẩm — kho đã được hoàn lại tự động.", "#e17055");
    } else {
      const { error: voidErr } = await client.from("customer_orders").update({
        status: "voided", voided_by: staff, voided_at: new Date().toISOString(), void_reason: reason,
      }).eq("id", targetId);
      if (voidErr) throw voidErr;

      const { data: completedItems, error: sumErr } = await client
        .from("customer_order_items")
        .select("customer_paid, profit, customer_orders!inner(customer_id, status)")
        .eq("customer_orders.customer_id", customerId)
        .eq("customer_orders.status", "completed")
        .eq("is_void", false);
      if (sumErr) throw sumErr;

      const totalSpent  = (completedItems || []).reduce((s, it) => s + Number(it.customer_paid), 0);
      const totalProfit = (completedItems || []).reduce((s, it) => s + Number(it.profit), 0);

      const { error: updErr } = await client
        .from("customers").update({ total_spent: totalSpent, total_profit: totalProfit })
        .eq("id", customerId);
      if (updErr) throw updErr;

      window.showToast("🗑️ Đã huỷ đơn hàng — kho đã được hoàn lại tự động.", "#e17055");
    }

    document.getElementById("voidOrderModal").classList.add("hidden");
    loadOrdersByDate(currentOrderFrom, currentOrderTo);
  } catch (err) {
    window.showToast("❌ Lỗi: " + err.message, "#e17055");
  } finally {
    btn.disabled = false;
  }
}
