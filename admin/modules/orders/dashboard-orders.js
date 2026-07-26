/* ══════════════════════════════════════════════
   DASHBOARD ORDERS — admin/modules/orders/dashboard-orders.js
   ─────────────────────────────────────────────
   Tab "Đơn hàng" — tách từ dashboard-customers.js:
   - Tạo đơn hàng mới (tra SĐT → chọn món → submit → auto check-in)
   - Tra cứu đơn hàng theo ngày (accordion xem món tại chỗ)
   - Huỷ đơn / huỷ dòng sản phẩm

   Cần: client, currentSession, window.Membership (M),
   window.Inventory (INV), window.AdminPermissions.
   ══════════════════════════════════════════════ */

const M_O = window.Membership;
const isOrdersReadOnly = window.AdminPermissions.isReadOnly(currentSession.role);

let orderDrinksCache = [];
let orderDraftRows   = [];
let orderRowSeq      = 0;
let ordFoundCustomer = null;
let currentOrderDate = new Date().toISOString().slice(0, 10);
let ordersOfDay      = [];

function round2(n) { return Math.round((Number(n) || 0) * 100) / 100; }

/* ══════════════════════════════════════════════
   ĐĂNG KÝ PAGE
   ══════════════════════════════════════════════ */
window.AdminDashboard.registerPage({
  pageId: "ordersPage",
  menuId: "ordersMenuItem",
  placeholderId: "ordersMenuItemPlaceholder", // ⚠️ MỚI — đã có sẵn trong dashboard.html
  icon: "🧾",
  label: "Đơn hàng",
  insertBeforeMenuId: "chatMenuItem",
  onShow: () => {
    loadOrderDrinksCache();
    resetOrderForm();
    loadOrdersByDate(currentOrderDate);
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
        <p class="page-subtitle">Tạo đơn hàng mới &amp; tra cứu lịch sử đơn theo ngày</p>
      </div>
    </div>

    <!-- ═══ TẠO ĐƠN HÀNG ═══ -->
    <div class="table-card" style="padding:22px 24px;margin-bottom:24px;">
      <div style="font-size:14px;font-weight:700;margin-bottom:14px;">➕ Tạo đơn hàng mới</div>

      <div style="display:flex;gap:10px;align-items:center;margin-bottom:14px;flex-wrap:wrap;">
        <input type="tel" id="ordLookupPhone" placeholder="Nhập SĐT khách hàng..." inputmode="tel"
          style="height:44px;border:1px solid var(--border);border-radius:10px;padding:0 14px;font-size:14px;min-width:220px;">
        <button class="btn btn-primary" id="ordLookupBtn">🔍 Tìm khách</button>
      </div>

      <div id="ordCustomerFound" class="hidden" style="background:var(--bg);border-radius:10px;padding:12px 16px;margin-bottom:14px;font-size:13px;"></div>
      <div id="ordCustomerNotFound" class="hidden" style="color:var(--danger);font-size:13px;margin-bottom:14px;">
        ⚠️ Không tìm thấy khách hàng với SĐT này. Vào tab Khách hàng để tạo mới trước.
      </div>

      <div id="ordFormArea" class="hidden">
        <div id="orderDraftRows" style="display:flex;flex-direction:column;gap:8px;margin-bottom:8px;"></div>
        <button type="button" class="btn btn-secondary" id="ordAddRowBtn" style="margin-bottom:12px;">+ Thêm sản phẩm</button>
        <div style="display:flex;gap:10px;align-items:center;margin-bottom:10px;flex-wrap:wrap;">
          <label style="font-size:12px;color:var(--text-muted);">Giảm giá áp dụng (%)</label>
          <input type="number" id="ordDiscountPct" min="0" max="100" value="0" style="width:80px;height:36px;border:1px solid var(--border);border-radius:8px;padding:0 8px;">
        </div>
        <div id="ordPreviewBox" style="background:var(--bg);border-radius:10px;padding:12px 16px;margin-bottom:14px;font-size:13px;"></div>
        <button class="btn btn-primary" id="ordSubmitBtn">✅ Tạo đơn hàng</button>
      </div>
    </div>

    <!-- ═══ TRA CỨU THEO NGÀY ═══ -->
    <div class="table-card" style="padding:22px 24px;">
      <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:14px;flex-wrap:wrap;gap:10px;">
        <div style="font-size:14px;font-weight:700;">📅 Lịch sử đơn hàng</div>
        <div style="display:flex;gap:8px;align-items:center;">
          <input type="date" id="ordDateFilter" style="height:38px;border:1px solid var(--border);border-radius:8px;padding:0 10px;font-size:13px;">
          <button class="btn btn-secondary" id="ordDateRefreshBtn">🔄</button>
        </div>
      </div>
      <table class="game-table">
        <thead><tr><th></th><th>Mã đơn</th><th>Khách hàng</th><th>Giờ tạo</th><th>Số món</th><th>Khách trả</th><th>Trạng thái</th></tr></thead>
        <tbody id="ordDateTableBody"><tr><td colspan="7" style="text-align:center;padding:30px;color:var(--text-muted);">⏳ Đang tải...</td></tr></tbody>
      </table>
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
  document.getElementById("ordLookupBtn")?.addEventListener("click", lookupCustomerForOrder);
  document.getElementById("ordLookupPhone")?.addEventListener("keydown", e => {
    if (e.key === "Enter") lookupCustomerForOrder();
  });
  document.getElementById("ordAddRowBtn")?.addEventListener("click", () => addOrderDraftRow());
  document.getElementById("ordDiscountPct")?.addEventListener("input", updateOrderPreview);
  document.getElementById("ordSubmitBtn")?.addEventListener("click", submitOrder);

  document.getElementById("ordDateFilter").value = currentOrderDate;
  document.getElementById("ordDateFilter")?.addEventListener("change", e => {
    currentOrderDate = e.target.value;
    loadOrdersByDate(currentOrderDate);
  });
  document.getElementById("ordDateRefreshBtn")?.addEventListener("click", () => loadOrdersByDate(currentOrderDate));

  document.getElementById("closeVoidOrderModalBtn")?.addEventListener("click", () =>
    document.getElementById("voidOrderModal").classList.add("hidden"));
  document.getElementById("confirmVoidOrderBtn")?.addEventListener("click", confirmVoidOrder);

  const voidModal = document.getElementById("voidOrderModal");
  voidModal?.addEventListener("click", e => { if (e.target === voidModal) voidModal.classList.add("hidden"); });
  voidModal?.addEventListener("keydown", e => { if (e.key === "Escape") voidModal.classList.add("hidden"); });

  if (isOrdersReadOnly) {
    document.getElementById("ordFormArea").style.display = "none";
    document.getElementById("ordLookupBtn").disabled = true;
  }
}

function resetOrderForm() {
  ordFoundCustomer = null;
  document.getElementById("ordLookupPhone").value = "";
  document.getElementById("ordCustomerFound").classList.add("hidden");
  document.getElementById("ordCustomerNotFound").classList.add("hidden");
  document.getElementById("ordFormArea").classList.add("hidden");
  orderDraftRows = [];
  document.getElementById("orderDraftRows").innerHTML = "";
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
   TRA SĐT
   ══════════════════════════════════════════════ */
async function lookupCustomerForOrder() {
  if (isOrdersReadOnly) return;
  const phone = M_O.normalizePhone(document.getElementById("ordLookupPhone").value);
  const foundBox    = document.getElementById("ordCustomerFound");
  const notFoundBox = document.getElementById("ordCustomerNotFound");
  const formArea    = document.getElementById("ordFormArea");

  if (!/^0\d{9,10}$/.test(phone)) { window.showToast("⚠️ SĐT không hợp lệ.", "#e17055"); return; }

  const { data, error } = await client
    .from("customers").select("*").eq("phone", phone).is("deleted_at", null).maybeSingle();

  if (error || !data) {
    foundBox.classList.add("hidden");
    notFoundBox.classList.remove("hidden");
    formArea.classList.add("hidden");
    ordFoundCustomer = null;
    return;
  }

  ordFoundCustomer = data;
  const info = M_O.getLevelInfo(data.level);
  foundBox.innerHTML = `${info.rank_icon} <b>${window.escHtml(data.name)}</b> — ${window.escHtml(info.rank_name)} · ${data.xp} XP`;
  foundBox.classList.remove("hidden");
  notFoundBox.classList.add("hidden");
  formArea.classList.remove("hidden");

  document.getElementById("ordDiscountPct").value = info.discount_pct || 0;
  orderDraftRows = [];
  document.getElementById("orderDraftRows").innerHTML = "";
  addOrderDraftRow();
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

  box.innerHTML = lines +
    `<div style="border-top:1px solid var(--border);margin-top:8px;padding-top:8px;display:flex;justify-content:space-between;font-weight:700;">
      <span>Khách trả</span><span>${totalPaid.toLocaleString('vi-VN')}đ</span>
    </div>
    <div style="display:flex;justify-content:space-between;color:${totalProfit >= 0 ? '#00b894' : 'var(--danger)'};font-weight:600;">
      <span>Lợi nhuận gộp</span><span>${totalProfit.toLocaleString('vi-VN')}đ</span>
    </div>`;
}

/* ══════════════════════════════════════════════
   SUBMIT ĐƠN — giữ nguyên logic gốc (kho + auto check-in)
   ══════════════════════════════════════════════ */
async function submitOrder() {
  if (isOrdersReadOnly || !ordFoundCustomer) return;
  const rows = readOrderDraftRows();
  if (!rows.length) { window.showToast("⚠️ Vui lòng chọn ít nhất 1 sản phẩm.", "#e17055"); return; }

  const customerId = ordFoundCustomer.id;
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
    await maybeAutoCheckin(customerId, order.id, staff);

    window.showToast(`✅ Đã tạo đơn hàng ${order.order_number}!`);
    resetOrderForm();
    if (currentOrderDate === new Date().toISOString().slice(0, 10)) loadOrdersByDate(currentOrderDate);
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
   TRA CỨU THEO NGÀY + ACCORDION
   ══════════════════════════════════════════════ */
async function loadOrdersByDate(dateStr) {
  const tbody = document.getElementById("ordDateTableBody");
  tbody.innerHTML = `<tr><td colspan="7" style="text-align:center;padding:30px;color:var(--text-muted);">⏳ Đang tải...</td></tr>`;

  const { data, error } = await client
    .from("customer_orders")
    .select("*, customers(name, phone), customer_order_items(*)")
    .gte("created_at", dateStr + "T00:00:00")
    .lt("created_at", dateStr + "T23:59:59.999")
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
  if (!ordersOfDay.length) {
    tbody.innerHTML = `<tr><td colspan="7" style="text-align:center;padding:30px;color:var(--text-muted);">Không có đơn hàng nào trong ngày này.</td></tr>`;
    return;
  }

  tbody.innerHTML = ordersOfDay.map(o => {
    const items = o.customer_order_items || [];
    const activeItems = items.filter(it => !it.is_void);
    const totalPaid = activeItems.reduce((s, it) => s + Number(it.customer_paid), 0);
    const isVoided = o.status === "voided";

    return `
      <tr class="ord-row" data-order-row="${o.id}" style="cursor:pointer;${isVoided ? 'opacity:.55;' : ''}">
        <td style="width:28px;"><span class="ord-caret" data-caret="${o.id}">▸</span></td>
        <td><b>${window.escHtml(o.order_number)}</b></td>
        <td>${window.escHtml(o.customers?.name || "—")}<div class="game-id">${window.escHtml(o.customers?.phone || "")}</div></td>
        <td>${new Date(o.created_at).toLocaleTimeString("vi-VN", { hour: "2-digit", minute: "2-digit" })}</td>
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
   HUỶ ĐƠN / HUỶ DÒNG (giữ nguyên logic gốc)
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
    loadOrdersByDate(currentOrderDate);
  } catch (err) {
    window.showToast("❌ Lỗi: " + err.message, "#e17055");
  } finally {
    btn.disabled = false;
  }
}
