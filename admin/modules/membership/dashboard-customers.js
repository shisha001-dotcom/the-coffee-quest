/* ══════════════════════════════════════════════
   DASHBOARD CUSTOMERS — admin/modules/membership/dashboard-customers.js
   ─────────────────────────────────────────────
   ⚠️ VIẾT LẠI TOÀN BỘ THEO SCHEMA SQL V1 (2026-07-16):

   1. customer_checkins + customer_transactions ĐÃ BỊ XOÁ khỏi DB.
      - Nút "Check-in" thủ công ĐÃ BỊ BỎ HẲN (quyết định của chủ quán).
        Check-in giờ 100% TỰ ĐỘNG: quest hệ thống (is_checkin=true,
        M.getCheckinQuest()) tự hoàn thành khi khách có ĐƠN HÀNG đầu
        tiên trong ngày — xử lý ngay trong createOrder() bên dưới.
      - "Ghi nhận giao dịch" (số tiền + ghi chú tự do) → thay bằng
        TẠO ĐƠN HÀNG thật: chọn đồ uống + số lượng, hệ thống tự:
          a) snapshot unit_price từ drinks.price
          b) snapshot ingredient_unit_cost từ view v_drink_cost
          c) tính subtotal/customer_paid/profit đúng công thức mà
             DB đã CHECK constraint (phải làm tròn y hệt, xem round2())
          d) ghi ingredient_stock_logs (log_type=order_consume) để
             trừ kho theo công thức — nếu tồn kho không đủ, trừ tối
             đa đến 0 (không chặn đơn hàng) và cảnh báo qua toast.
      - customers.total_spent / total_profit được TRIGGER DB tự tính
        lại khi insert customer_order_items — KHÔNG tự set tay nữa,
        chỉ cần refetch customer sau khi tạo đơn.
      - ⚠️ LƯU Ý: trigger tự tính tổng CHỈ gắn trên customer_order_items,
        KHÔNG gắn trên customer_orders (voiding không tự trigger lại).
        Vì vậy voidOrder() bên dưới phải TỰ tính lại total_spent/
        total_profit sau khi huỷ đơn.

   2. customers.age → date_of_birth; customers.last_checkin →
      last_checkin_date. Đổi tên field ở mọi nơi.

   3. customer_quests: field completed→is_completed, thêm xp_awarded
      (snapshot XP thực nhận) + related_order_id (chỉ có ở quest
      check-in). quest_id có ON DELETE RESTRICT nên deleteQuest() ở
      file khác đã đổi sang soft-delete — không ảnh hưởng file này.

   4. customers.deleted_at — xoá khách hàng giờ là SOFT DELETE vì
      customer_orders.customer_id có ON DELETE RESTRICT.

   5. MỚI theo yêu cầu: trang chi tiết khách hàng giờ có 2 khối:
      "Đơn hàng gần đây" (kèm nút Huỷ đơn) và "Lịch sử EXP" (mỗi dòng
      nêu rõ lý do — tên nhiệm vụ, có phải từ đơn hàng nào không).

   Cần: client, currentSession, window.AdminPermissions,
   window.Membership (M), window.Inventory (INV) — cả 2 PHẢI load
   trước file này, window.escHtml, window.showToast, window.showConfirm.
   ══════════════════════════════════════════════ */

const M = window.Membership;
const isSuperAdminCust = M.isSuperAdmin;

let custActiveTab = "list";
let custSearchQ   = "";
let _custActionBusy = false;

/* Cache đồ uống đang bán + giá thành (view v_drink_cost) — dùng khi
   tạo đơn hàng trong modal chi tiết khách. Nạp 1 lần khi vào trang,
   refresh lại mỗi khi mở form tạo đơn để giá luôn mới nhất. */
let orderDrinksCache = []; // [{id, name, price, ingredient_cost}]
let orderDraftRows   = []; // dòng sản phẩm đang nhập trong form tạo đơn (id tạm client-side)
let orderRowSeq = 0;

function round2(n) { return Math.round((Number(n) || 0) * 100) / 100; }

/* ══════════════════════════════════════════════
   ĐĂNG KÝ MENU + PAGE
   ══════════════════════════════════════════════ */
window.AdminDashboard.registerPage({
  pageId: "customersPage",
  menuId: "customersMenuItem",
  icon: "🎮",
  label: "Khách hàng",
  guard: () => isSuperAdminCust,
  onShow: () => {
    M.loadLevels().then(renderIfLevelsTabActive);
    M.loadQuests().then(renderIfQuestsTabActive);
    loadCustomers();
    loadOrderDrinksCache();
  },
});

function renderIfLevelsTabActive() { if (custActiveTab === "levels" && window.renderLevelsTab) window.renderLevelsTab(); }
function renderIfQuestsTabActive() { if (custActiveTab === "quests" && window.renderQuestsTab) window.renderQuestsTab(); }

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
   INJECT PAGE HTML
   ══════════════════════════════════════════════ */
(function injectCustomersPage() {
  if (!isSuperAdminCust) return;

  const main = document.querySelector(".main-content");
  if (!main) return;

  const page = document.createElement("div");
  page.id = "customersPage";
  page.style.display = "none";
  page.innerHTML = `
    <div class="page-header">
      <div>
        <h1 class="page-title">🎮 Khách hàng — Coffee Quest</h1>
        <p class="page-subtitle">Quản lý nhân vật, cấp độ, nhiệm vụ &amp; lịch sử đơn hàng</p>
      </div>
      <div class="header-actions">
        <button class="btn btn-secondary" id="custRefreshBtn">🔄 Refresh</button>
        <button class="btn btn-primary" id="custAddBtn">+ Thêm khách hàng</button>
      </div>
    </div>

    <div style="display:flex;gap:8px;margin-bottom:20px;flex-wrap:wrap;">
      <button class="btn btn-primary cust-tab-btn"   data-tab="list"   id="custTabBtnList">👥 Danh sách</button>
      <button class="btn btn-secondary cust-tab-btn" data-tab="quests" id="custTabBtnQuests">🗺️ Nhiệm vụ</button>
      <button class="btn btn-secondary cust-tab-btn" data-tab="levels" id="custTabBtnLevels">🏆 Cấp độ</button>
    </div>

    <div id="custTabList">
      <div class="search-bar">
        <input type="text" id="custSearchInput" class="search-input" placeholder="🔍 Tìm theo tên hoặc số điện thoại...">
      </div>
      <div class="table-card">
        <div id="custErrorMsg" class="error-msg hidden" role="alert"></div>
        <table class="game-table">
          <thead><tr>
            <th>Khách hàng</th><th>Cấp độ</th><th>XP</th><th>Đã chi tiêu</th><th>Lợi nhuận gộp</th><th>Check-in gần nhất</th><th>Hành động</th>
          </tr></thead>
          <tbody id="custTableBody"><tr><td colspan="7" style="text-align:center;padding:40px;color:var(--text-muted);">⏳ Đang tải...</td></tr></tbody>
        </table>
      </div>
    </div>

    <div id="custTabQuests" style="display:none;"></div>
    <div id="custTabLevels" style="display:none;"></div>

    <!-- Modal thêm khách -->
    <div class="modal-overlay hidden" id="addCustomerModal" role="dialog" aria-modal="true" aria-labelledby="addCustomerModalTitle">
      <div class="modal-box" style="max-width:480px;">
        <div class="modal-header">
          <h2 id="addCustomerModalTitle">➕ Thêm khách hàng mới</h2>
          <button class="close-btn" id="closeAddCustomerBtn" aria-label="Đóng cửa sổ">✕</button>
        </div>
        <div class="form-grid" style="grid-template-columns:1fr;">
          <div class="form-group"><label for="newCustName">Tên *</label><input type="text" id="newCustName" placeholder="Nguyễn Văn A"></div>
          <div class="form-group"><label for="newCustPhone">Số điện thoại *</label><input type="tel" id="newCustPhone" placeholder="09xxxxxxxx" inputmode="tel"></div>
          <div class="form-group"><label for="newCustDob">Ngày sinh</label><input type="date" id="newCustDob"></div>
          <div class="form-group">
            <label for="newCustGender">Giới tính</label>
            <select id="newCustGender" style="height:44px;border-radius:10px;border:1px solid var(--border);padding:0 14px;font-size:14px;font-family:'Inter',sans-serif;">
              <option value="">-- Không rõ --</option>
              <option value="nam">Nam</option>
              <option value="nu">Nữ</option>
              <option value="khac">Khác</option>
            </select>
          </div>
        </div>
        <div class="modal-actions" style="justify-content:flex-end;">
          <button class="btn btn-primary" id="saveNewCustomerBtn">💾 Tạo khách hàng</button>
        </div>
      </div>
    </div>

    <!-- Modal huỷ (dùng chung cho huỷ CẢ ĐƠN và huỷ TỪNG DÒNG sản phẩm —
         phân biệt qua #voidTargetType: "order" | "item") -->
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

    <!-- Modal chi tiết khách -->
    <div class="modal-overlay hidden" id="customerDetailModal" role="dialog" aria-modal="true">
      <div class="modal-box" style="max-width:720px;" id="customerDetailBox"></div>
    </div>
  `;
  main.appendChild(page);

  bindTabButtons();
  bindTopLevelEvents();

  const searchInput = document.getElementById("custSearchInput");
  searchInput.addEventListener("input", window.debounce(e => {
    custSearchQ = e.target.value.toLowerCase();
    renderCustomerTable();
  }, 200));

  ["addCustomerModal", "customerDetailModal", "voidOrderModal"].forEach(id => {
    const modal = document.getElementById(id);
    modal?.addEventListener("click", e => { if (e.target === modal) modal.classList.add("hidden"); });
    modal?.addEventListener("keydown", e => { if (e.key === "Escape") modal.classList.add("hidden"); });
  });
})();

function bindTabButtons() {
  document.getElementById("custTabBtnList")?.addEventListener("click", () => switchCustTab("list"));
  document.getElementById("custTabBtnQuests")?.addEventListener("click", () => switchCustTab("quests"));
  document.getElementById("custTabBtnLevels")?.addEventListener("click", () => switchCustTab("levels"));
}
function bindTopLevelEvents() {
  document.getElementById("custRefreshBtn")?.addEventListener("click", loadCustomers);
  document.getElementById("custAddBtn")?.addEventListener("click", openAddCustomer);
  document.getElementById("closeAddCustomerBtn")?.addEventListener("click", () =>
    document.getElementById("addCustomerModal").classList.add("hidden"));
  document.getElementById("saveNewCustomerBtn")?.addEventListener("click", saveNewCustomer);
  document.getElementById("closeVoidOrderModalBtn")?.addEventListener("click", () =>
    document.getElementById("voidOrderModal").classList.add("hidden"));
  document.getElementById("confirmVoidOrderBtn")?.addEventListener("click", confirmVoidOrder);
}

/* ══════════════════════════════════════════════
   TABS
   ══════════════════════════════════════════════ */
function switchCustTab(tab) {
  if (!isSuperAdminCust) return;
  custActiveTab = tab;
  document.querySelectorAll(".cust-tab-btn").forEach(b => {
    const active = b.dataset.tab === tab;
    b.classList.toggle("btn-primary", active);
    b.classList.toggle("btn-secondary", !active);
  });
  document.getElementById("custTabList").style.display   = tab === "list"   ? "" : "none";
  document.getElementById("custTabQuests").style.display = tab === "quests" ? "" : "none";
  document.getElementById("custTabLevels").style.display = tab === "levels" ? "" : "none";

  if (tab === "quests" && window.renderQuestsTab) window.renderQuestsTab();
  if (tab === "levels" && window.renderLevelsTab) window.renderLevelsTab();
}

/* ══════════════════════════════════════════════
   LOAD + RENDER BẢNG KHÁCH HÀNG
   ══════════════════════════════════════════════ */
async function loadCustomers() {
  if (!isSuperAdminCust) return;
  const errorEl = document.getElementById("custErrorMsg");
  errorEl?.classList.add("hidden");
  try {
    await M.loadCustomers();
    renderCustomerTable();
  } catch (err) {
    if (errorEl) { errorEl.textContent = "❌ Lỗi khi tải danh sách khách hàng: " + err.message; errorEl.classList.remove("hidden"); }
    const tbody = document.getElementById("custTableBody");
    if (tbody) tbody.innerHTML = `<tr><td colspan="7" style="text-align:center;padding:40px;color:var(--danger);">Không tải được dữ liệu.</td></tr>`;
  }
}
window.loadCustomers = loadCustomers;

function renderCustomerTable() {
  const tbody = document.getElementById("custTableBody");
  if (!tbody) return;

  const list = M.state.customers.filter(c => {
    if (!custSearchQ) return true;
    const name  = (c.name  || "").toLowerCase();
    const phone = c.phone || "";
    return name.includes(custSearchQ) || phone.includes(custSearchQ);
  });

  if (!list.length) {
    tbody.innerHTML = `<tr><td colspan="7" style="text-align:center;padding:40px;color:var(--text-muted);">${M.state.customers.length ? "Không tìm thấy khách hàng phù hợp." : "Chưa có khách hàng nào."}</td></tr>`;
    return;
  }

  tbody.innerHTML = list.map(c => {
    const info = M.getLevelInfo(c.level);
    return `<tr>
      <td>
        <div class="game-name">${window.escHtml(c.name || "(chưa có tên)")}</div>
        <div class="game-id">📞 ${window.escHtml(c.phone || "—")}</div>
      </td>
      <td><span class="badge">${info.rank_icon} ${window.escHtml(info.rank_name)}</span></td>
      <td style="font-weight:700;color:var(--primary);">${c.xp} XP</td>
      <td>${M.formatVND(c.total_spent)}</td>
      <td style="color:${Number(c.total_profit) >= 0 ? 'var(--easy,#00b894)' : 'var(--danger)'};font-weight:600;">${M.formatVND(c.total_profit)}</td>
      <td>${c.last_checkin_date || "—"}${c.streak_days ? ` <span style="color:#e17055;font-size:12px;">🔥${c.streak_days}</span>` : ""}</td>
      <td><button class="btn btn-primary" data-cust-detail="${c.id}">🔍 Chi tiết</button></td>
    </tr>`;
  }).join("");

  tbody.querySelectorAll("[data-cust-detail]").forEach(btn => {
    btn.addEventListener("click", () => openCustomerDetail(Number(btn.dataset.custDetail)));
  });
}

/* ══════════════════════════════════════════════
   THÊM KHÁCH HÀNG MỚI
   ══════════════════════════════════════════════ */
function openAddCustomer() {
  if (!isSuperAdminCust) return;
  ["newCustName", "newCustPhone", "newCustDob"].forEach(id => document.getElementById(id).value = "");
  document.getElementById("newCustGender").value = "";
  M.clearFieldError("newCustName");
  M.clearFieldError("newCustPhone");
  document.getElementById("addCustomerModal").classList.remove("hidden");
  document.getElementById("newCustName").focus();
}

async function saveNewCustomer() {
  if (!isSuperAdminCust || _custActionBusy) return;

  const nameInput  = document.getElementById("newCustName");
  const phoneInput = document.getElementById("newCustPhone");
  const name  = nameInput.value.trim();
  const phone = M.normalizePhone(phoneInput.value);
  const dob    = document.getElementById("newCustDob").value || null;
  const gender = document.getElementById("newCustGender").value || null;

  M.clearFieldError("newCustName");
  M.clearFieldError("newCustPhone");

  if (!name) { M.showFieldError("newCustName", "Vui lòng nhập tên."); return; }
  if (!phone || !/^0\d{9,10}$/.test(phone)) {
    M.showFieldError("newCustPhone", "Số điện thoại không hợp lệ (VD: 0912345678).");
    return;
  }

  const btn = document.getElementById("saveNewCustomerBtn");
  _custActionBusy = true;
  btn.disabled = true; btn.textContent = "Đang tạo...";

  try {
    const { data: existing, error: checkErr } = await client
      .from("customers").select("id").eq("phone", phone).is("deleted_at", null).maybeSingle();
    if (checkErr) throw checkErr;
    if (existing) { M.showFieldError("newCustPhone", "Số điện thoại này đã tồn tại trong hệ thống."); return; }

    const { data, error } = await client.from("customers")
      .insert({ name, phone, date_of_birth: dob, gender, created_by: currentSession.displayName || currentSession.username })
      .select().single();
    if (error) throw error;

    M.state.customers.unshift(data);

    document.getElementById("addCustomerModal").classList.add("hidden");
    window.showToast("✅ Đã tạo khách hàng mới!");
    renderCustomerTable();
    openCustomerDetail(data.id);
  } catch (err) {
    window.showToast("❌ Lỗi: " + err.message, "#e17055");
  } finally {
    _custActionBusy = false;
    btn.disabled = false; btn.textContent = "💾 Tạo khách hàng";
  }
}

/* ══════════════════════════════════════════════
   CHI TIẾT KHÁCH HÀNG (modal)
   ══════════════════════════════════════════════ */
async function openCustomerDetail(id) {
  if (!isSuperAdminCust) return;

  const cust = M.state.customers.find(c => c.id === id);
  if (!cust) return;

  orderDraftRows = [];
  await loadOrderDrinksCache();

  const [{ data: orders }, { data: cqRows }] = await Promise.all([
    client.from("customer_orders")
      .select("*, customer_order_items(*)")
      .eq("customer_id", id)
      .order("created_at", { ascending: false })
      .limit(10),
    client.from("customer_quests")
      .select("*, quests(title, description, is_checkin), customer_orders(order_number)")
      .eq("customer_id", id)
      .order("completed_at", { ascending: false, nullsFirst: false })
      .limit(15),
  ]);

  renderCustomerDetailBox(cust, orders || [], cqRows || []);
  document.getElementById("customerDetailModal").classList.remove("hidden");
}

function renderCustomerDetailBox(cust, orders, cqRows) {
  const info     = M.getLevelInfo(cust.level);
  const nextInfo = M.getNextLevelInfo(cust.level);

  let pct = 100;
  if (nextInfo && nextInfo.xp_required > info.xp_required) {
    pct = Math.max(0, Math.min(100, Math.round((cust.xp - info.xp_required) / (nextInfo.xp_required - info.xp_required) * 100)));
  }

  const today = new Date().toISOString().slice(0, 10);
  const checkedInToday = cust.last_checkin_date === today;

  const perkChips = [
    info.discount_pct > 0 ? `<span class="badge">💸 Giảm ${info.discount_pct}%</span>` : "",
    info.free_item        ? `<span class="badge">🎁 ${window.escHtml(info.free_item)}</span>` : "",
    info.priority_booking  ? `<span class="badge">⭐ Ưu tiên đặt bàn/slot game</span>` : "",
  ].filter(Boolean).join(" ") || `<span style="color:var(--text-muted);font-size:13px;">Chưa có ưu đãi ở cấp này</span>`;

  /* Nhiệm vụ đang diễn ra — LOẠI quest check-in hệ thống (tự động,
     không cho tick tay) */
  const activeQuests = M.state.quests.filter(q => q.active && !q.is_checkin).map(q => {
    const pk  = M.periodKeyFor(q.type);
    const cqForQuest = cqRows.find(r => r.quest_id === q.id && r.period_key === pk);
    const progress = cqForQuest?.progress || 0;
    const done = cqForQuest?.is_completed || false;
    return `
      <div style="display:flex;align-items:center;justify-content:space-between;gap:10px;padding:10px 14px;border:1px solid var(--border);border-radius:10px;margin-bottom:8px;${done ? 'background:#e8f8f0;' : ''}">
        <div>
          <div style="font-weight:700;font-size:13px;">${done ? "✅" : "▫️"} ${window.escHtml(q.title)}</div>
          <div style="font-size:11px;color:var(--text-muted);">${q.type === 'daily' ? 'Hàng ngày' : q.type === 'weekly' ? 'Hàng tuần' : 'Một lần'} · +${q.xp_reward} XP · ${progress}/${q.target_count}</div>
        </div>
        <button class="btn btn-secondary" style="font-size:12px;padding:6px 12px;" ${done ? 'disabled' : ''} data-quest-progress="${cust.id}|${q.id}">${done ? 'Đã xong' : '+1 tiến độ'}</button>
      </div>`;
  }).join("");

  /* Đơn hàng gần đây — MỚI: liệt kê TỪNG DÒNG sản phẩm, mỗi dòng có
     nút "Huỷ dòng" riêng (is_void ở customer_order_items) — không
     cần huỷ nguyên cả đơn nếu chỉ 1 món bị lên nhầm. Tổng theo đơn
     tự loại trừ các dòng đã void. */
  const orderRows = orders.length ? orders.map(o => {
    const items = o.customer_order_items || [];
    const activeItems = items.filter(it => !it.is_void);
    const totalPaid   = activeItems.reduce((s, it) => s + Number(it.customer_paid), 0);
    const totalProfit = activeItems.reduce((s, it) => s + Number(it.profit), 0);
    const isVoided = o.status === "voided"; // huỷ CẢ đơn (khác với huỷ từng dòng)

    const itemsHtml = items.map(it => `
      <div style="display:flex;align-items:center;justify-content:space-between;gap:8px;padding:3px 0;${it.is_void ? 'opacity:.5;text-decoration:line-through;' : ''}">
        <span>${window.escHtml(it.product_name)} ×${it.quantity}</span>
        ${(!isVoided && !it.is_void) ? `<button class="btn btn-secondary" style="font-size:10px;padding:2px 8px;flex-shrink:0;" data-void-item="${it.id}">Huỷ dòng</button>` : ''}
        ${it.is_void ? `<span style="font-size:10px;color:var(--danger);flex-shrink:0;white-space:nowrap;">Đã huỷ${it.void_reason ? ': ' + window.escHtml(it.void_reason) : ''}</span>` : ''}
      </div>`).join('');

    return `
      <tr style="${isVoided ? 'opacity:.55;' : ''}">
        <td>
          <div style="font-weight:700;${isVoided ? 'text-decoration:line-through;' : ''}">${window.escHtml(o.order_number)}</div>
          <div style="font-size:11px;color:var(--text-muted);">${new Date(o.created_at).toLocaleString('vi-VN')}</div>
        </td>
        <td style="font-size:12px;max-width:260px;">${itemsHtml || '—'}</td>
        <td style="font-weight:700;">${M.formatVND(totalPaid)}</td>
        <td style="color:${totalProfit >= 0 ? '#00b894' : 'var(--danger)'};">${M.formatVND(totalProfit)}</td>
        <td>${isVoided ? `<span class="badge" style="background:#fdecea;color:var(--danger);">Đã huỷ cả đơn</span>` : `<span class="badge">Hoàn tất</span>`}</td>
        <td>${!isVoided ? `<button class="btn btn-danger" style="font-size:12px;padding:6px 10px;" data-void-order="${o.id}">🗑️ Huỷ cả đơn</button>` : (o.void_reason ? `<span style="font-size:11px;color:var(--text-muted);">${window.escHtml(o.void_reason)}</span>` : '')}</td>
      </tr>`;
  }).join("") : `<tr><td colspan="6" style="text-align:center;color:var(--text-muted);padding:14px;">Chưa có đơn hàng nào</td></tr>`;

  /* Lịch sử EXP — MỚI: nêu rõ lý do (tên nhiệm vụ) và nếu là check-in
     thì link tới đơn hàng đã kích hoạt nó */
  const xpRows = cqRows.length ? cqRows.filter(r => r.is_completed).map(r => {
    const quest = r.quests;
    const orderNo = r.customer_orders?.order_number;
    const reason = quest?.is_checkin
      ? `Check-in hàng ngày${orderNo ? ` — từ đơn hàng <b>${window.escHtml(orderNo)}</b>` : ''}`
      : (quest?.title || 'Nhiệm vụ');
    return `
      <tr>
        <td style="font-size:12px;">${r.completed_at ? new Date(r.completed_at).toLocaleString('vi-VN') : '—'}</td>
        <td style="font-size:13px;">${reason}</td>
        <td style="font-weight:700;color:var(--primary);">+${r.xp_awarded} XP</td>
      </tr>`;
  }).join("") : "";

  document.getElementById("customerDetailBox").innerHTML = `
    <div class="modal-header">
      <h2>${info.rank_icon} ${window.escHtml(cust.name)}</h2>
      <button class="close-btn" aria-label="Đóng cửa sổ" id="closeCustDetailBtn">✕</button>
    </div>

    <div style="font-size:13px;color:var(--text-muted);margin-bottom:16px;">
      📞 ${window.escHtml(cust.phone)}
      ${cust.date_of_birth ? '· 🎂 ' + new Date(cust.date_of_birth).toLocaleDateString('vi-VN') : ''}
      ${cust.gender ? '· ' + window.escHtml(cust.gender) : ''}
    </div>

    <div style="background:var(--bg);border-radius:12px;padding:16px 18px;margin-bottom:18px;">
      <div style="display:flex;justify-content:space-between;font-size:13px;font-weight:700;margin-bottom:6px;">
        <span>${info.rank_icon} ${window.escHtml(info.rank_name)} · ${cust.xp} XP</span>
        <span style="color:var(--text-muted);font-weight:500;">${nextInfo ? `Cần ${nextInfo.xp_required} XP để lên ${nextInfo.rank_icon} ${window.escHtml(nextInfo.rank_name)}` : 'Cấp cao nhất 🎉'}</span>
      </div>
      <div style="height:10px;background:#e2e8f0;border-radius:6px;overflow:hidden;margin-bottom:10px;">
        <div style="height:100%;width:${pct}%;background:var(--primary);"></div>
      </div>
      <div style="display:flex;gap:6px;flex-wrap:wrap;">${perkChips}</div>
    </div>

    <div style="display:flex;gap:16px;flex-wrap:wrap;align-items:center;margin-bottom:18px;font-size:12px;color:var(--text-muted);">
      <span>${checkedInToday ? '✅ Đã check-in hôm nay' : '⏳ Chưa check-in hôm nay — tự động khi có đơn hàng đầu tiên'}</span>
      <span>🔥 Streak: <b>${cust.streak_days || 0}</b> ngày</span>
      <span>💰 Tổng chi tiêu: <b>${M.formatVND(cust.total_spent)}</b></span>
      <span>📈 Lợi nhuận gộp: <b style="color:${Number(cust.total_profit) >= 0 ? '#00b894' : 'var(--danger)'}">${M.formatVND(cust.total_profit)}</b></span>
    </div>

    <div style="font-size:13px;font-weight:700;margin-bottom:10px;">🧾 Tạo đơn hàng mới</div>
    <div id="orderDraftRows" style="display:flex;flex-direction:column;gap:8px;margin-bottom:8px;"></div>
    <button type="button" class="btn btn-secondary" id="addOrderRowBtn" style="margin-bottom:12px;">+ Thêm sản phẩm</button>
    <div style="display:flex;gap:10px;align-items:center;margin-bottom:10px;flex-wrap:wrap;">
      <label style="font-size:12px;color:var(--text-muted);">Giảm giá áp dụng (%)</label>
      <input type="number" id="orderDiscountPct" min="0" max="100" value="${info.discount_pct || 0}" style="width:80px;height:36px;border:1px solid var(--border);border-radius:8px;padding:0 8px;">
      <span style="font-size:11px;color:var(--text-muted);">(mặc định theo cấp độ — có thể sửa)</span>
    </div>
    <div id="orderPreviewBox" style="background:var(--bg);border-radius:10px;padding:12px 16px;margin-bottom:14px;font-size:13px;"></div>
    <button class="btn btn-primary" id="submitOrderBtn" style="margin-bottom:24px;">✅ Tạo đơn hàng</button>

    <div style="font-size:13px;font-weight:700;margin-bottom:8px;">🗺️ Nhiệm vụ đang diễn ra</div>
    ${activeQuests || '<div style="color:var(--text-muted);font-size:13px;margin-bottom:14px;">Chưa có nhiệm vụ nào đang mở.</div>'}

    <div style="font-size:13px;font-weight:700;margin:18px 0 8px;">🧾 Đơn hàng gần đây</div>
    <table class="game-table"><thead><tr><th>Mã đơn</th><th>Sản phẩm</th><th>Khách trả</th><th>Lợi nhuận</th><th>Trạng thái</th><th></th></tr></thead><tbody>${orderRows}</tbody></table>

    <div style="font-size:13px;font-weight:700;margin:18px 0 8px;">⭐ Lịch sử EXP</div>
    <table class="game-table">
      <thead><tr><th>Thời gian</th><th>Lý do</th><th>XP</th></tr></thead>
      <tbody>${xpRows || '<tr><td colspan="3" style="text-align:center;color:var(--text-muted);padding:14px;">Chưa có lịch sử EXP</td></tr>'}</tbody>
    </table>

    <div class="modal-actions">
      <button class="btn btn-danger" id="deleteCustBtn">🗑️ Xoá khách hàng</button>
    </div>
  `;

  document.getElementById("closeCustDetailBtn")?.addEventListener("click", () =>
    document.getElementById("customerDetailModal").classList.add("hidden"));
  document.getElementById("deleteCustBtn")?.addEventListener("click", () => deleteCustomer(cust.id));
  document.querySelectorAll("[data-quest-progress]").forEach(btn => {
    btn.addEventListener("click", () => {
      const [custId, questId] = btn.dataset.questProgress.split("|").map(Number);
      markQuestProgress(custId, questId);
    });
  });
  document.querySelectorAll("[data-void-order]").forEach(btn => {
    btn.addEventListener("click", () => openVoidModal('order', Number(btn.dataset.voidOrder), cust.id));
  });
  document.querySelectorAll("[data-void-item]").forEach(btn => {
    btn.addEventListener("click", () => openVoidModal('item', Number(btn.dataset.voidItem), cust.id));
  });

  document.getElementById("addOrderRowBtn")?.addEventListener("click", () => addOrderDraftRow());
  document.getElementById("orderDiscountPct")?.addEventListener("input", updateOrderPreview);
  document.getElementById("submitOrderBtn")?.addEventListener("click", () => submitOrder(cust.id));
  addOrderDraftRow();
}

/* ══════════════════════════════════════════════
   TẠO ĐƠN HÀNG — chọn sản phẩm + số lượng, preview giá vốn/lợi nhuận
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
  const box = document.getElementById("orderPreviewBox");
  if (!box) return;
  const discountPct = Number(document.getElementById("orderDiscountPct")?.value) || 0;
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

async function submitOrder(customerId) {
  if (!isSuperAdminCust || _custActionBusy) return;
  const rows = readOrderDraftRows();
  if (!rows.length) { window.showToast("⚠️ Vui lòng chọn ít nhất 1 sản phẩm.", "#e17055"); return; }

  const discountPct = Number(document.getElementById("orderDiscountPct").value) || 0;
  const staff = currentSession.displayName || currentSession.username;
  const btn = document.getElementById("submitOrderBtn");

  _custActionBusy = true;
  btn.disabled = true; btn.textContent = "Đang tạo...";

  try {
    /* 1) Tạo đơn hàng (order_number tự sinh bởi trigger DB) */
    const { data: order, error: orderErr } = await client
      .from("customer_orders").insert({ customer_id: customerId, staff_name: staff }).select().single();
    if (orderErr) throw orderErr;

    /* 2) Tạo từng dòng sản phẩm — tính đúng công thức DB đã CHECK */
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

    /* 3) Trừ kho theo công thức từng sản phẩm (order_consume) —
       không chặn đơn hàng nếu thiếu kho, chỉ cảnh báo. */
    await consumeStockForOrderItems(insertedItems);

    /* 4) Check-in tự động nếu đây là đơn hàng ĐẦU TIÊN trong ngày */
    await maybeAutoCheckin(customerId, order.id, staff);

    /* 5) Refetch khách hàng (total_spent/total_profit đã được trigger
       DB tự cập nhật khi insert order_items ở bước 2) */
    const { data: freshCust, error: custErr } = await client
      .from("customers").select("*").eq("id", customerId).single();
    if (custErr) throw custErr;
    const idx = M.state.customers.findIndex(c => c.id === customerId);
    if (idx !== -1) M.state.customers[idx] = freshCust;

    window.showToast(`✅ Đã tạo đơn hàng ${order.order_number}!`);
    renderCustomerTable();
    openCustomerDetail(customerId);
  } catch (err) {
    window.showToast("❌ Lỗi khi tạo đơn hàng: " + err.message, "#e17055");
  } finally {
    _custActionBusy = false;
    btn.disabled = false; btn.textContent = "✅ Tạo đơn hàng";
  }
}

/* Trừ kho theo công thức (drink_ingredients) cho từng dòng đơn hàng.
   Nếu tồn kho không đủ, trừ tối đa đến 0 (không để âm — khớp CHECK
   constraint chk_no_negative_stock) và cảnh báo qua toast thay vì
   chặn đơn hàng (ưu tiên không làm gián đoạn bán hàng). */
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
      if (ing) ing.current_stock = qtyAfter; // cập nhật cache tạm trong phiên
    }
  }
  if (warnings.length) {
    window.showToast(`⚠️ Kho không đủ cho: ${[...new Set(warnings)].join(", ")} — đã trừ về 0, cần nhập thêm.`, "#e17055");
  }
}

/* Check-in tự động: nếu đơn hàng vừa tạo là đơn ĐẦU TIÊN trong ngày
   của khách → hoàn thành quest hệ thống (is_checkin), cộng XP + streak. */
async function maybeAutoCheckin(customerId, orderId, staff) {
  const checkinQuest = M.getCheckinQuest();
  if (!checkinQuest) return; // chưa cấu hình quest check-in — bỏ qua

  const todayStr = new Date().toISOString().slice(0, 10);
  const { data: todaysOrders, error } = await client
    .from("customer_orders")
    .select("id")
    .eq("customer_id", customerId)
    .eq("status", "completed")
    .gte("created_at", todayStr + "T00:00:00")
    .lt("created_at", todayStr + "T23:59:59.999");
  if (error) { console.warn("maybeAutoCheckin:", error.message); return; }
  if ((todaysOrders || []).length !== 1) return; // không phải đơn đầu tiên hôm nay

  const cust = M.state.customers.find(c => c.id === customerId);
  const lastCheckin = cust?.last_checkin_date;
  let newStreak = 1;
  if (lastCheckin) {
    const diffDays = Math.round((new Date(todayStr) - new Date(lastCheckin)) / 86400000);
    newStreak = diffDays === 1 ? (cust.streak_days || 0) + 1 : 1;
  }
  const bonus = newStreak % 7 === 0 ? 20 : 0;
  const xpEarned = checkinQuest.xp_reward + bonus;
  const newXp = (cust?.xp || 0) + xpEarned;
  const newLevel = M.getLevelForXp(newXp);

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
   HUỶ ĐƠN HÀNG / HUỶ TỪNG DÒNG SẢN PHẨM
   ─────────────────────────────────────────────
   ⚠️ Migration V2: KHÔNG xoá dữ liệu khi huỷ — mọi thao tác "xoá"
   giao dịch đều chuyển thành VOID (giữ nguyên dòng, chỉ đánh dấu
   is_void/status='voided' + void_reason). Tổng total_spent/
   total_profit của khách sẽ TỰ ĐỘNG loại trừ các dòng đã void nhờ
   trigger DB `sync_customer_totals_on_order` (đã cập nhật ở migration
   V2 để lọc thêm `oi.is_void = FALSE`).

   Có 2 loại void độc lập:
   - "order" — huỷ NGUYÊN CẢ ĐƠN (customer_orders.status='voided').
     Trigger reverse_stock_on_void (V1) tự đảo ngược kho CẢ đơn.
     ⚠️ Riêng total_spent/total_profit KHÔNG tự trigger lại khi chỉ
     đổi status của customer_orders (trigger chỉ gắn trên
     customer_order_items) → phải tự tính lại tổng ở JS sau khi huỷ.
   - "item" — huỷ 1 DÒNG sản phẩm (customer_order_items.is_void=true).
     Trigger reverse_stock_on_item_void (V2, MỚI) tự đảo ngược kho
     ĐÚNG dòng đó. Việc UPDATE is_void trên customer_order_items vẫn
     là 1 lượt UPDATE trên đúng bảng đó nên trigger
     sync_customer_totals_on_order (V1) TỰ CHẠY LẠI bình thường —
     không cần tự tính tổng tay như trường hợp "order".
   ══════════════════════════════════════════════ */
function openVoidModal(type, targetId, customerId) {
  document.getElementById("voidTargetType").value = type;
  document.getElementById("voidOrderId").value = targetId;
  document.getElementById("voidOrderId").dataset.customerId = customerId;
  document.getElementById("voidReasonInput").value = "";
  document.getElementById("voidOrderModalTitle").textContent =
    type === "order" ? "Huỷ cả đơn hàng" : "Huỷ dòng sản phẩm";
  document.getElementById("voidTargetSummary").textContent =
    type === "order"
      ? "Toàn bộ đơn hàng này sẽ được đánh dấu là đã huỷ — kho sẽ được hoàn lại tự động."
      : "Chỉ dòng sản phẩm này bị huỷ — các dòng khác trong đơn vẫn giữ nguyên, kho của riêng dòng này sẽ được hoàn lại tự động.";
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
      /* ── HUỶ 1 DÒNG SẢN PHẨM ── */
      const { error } = await client.from("customer_order_items").update({
        is_void: true, void_reason: reason, voided_by: staff, voided_at: new Date().toISOString(),
      }).eq("id", targetId);
      if (error) throw error;

      /* Trigger DB đã tự tính lại total_spent/total_profit — chỉ
         cần refetch khách hàng để đồng bộ lại state phía client */
      const { data: freshCust, error: custErr } = await client
        .from("customers").select("*").eq("id", customerId).single();
      if (custErr) throw custErr;
      const idx = M.state.customers.findIndex(c => c.id === customerId);
      if (idx !== -1) M.state.customers[idx] = freshCust;

      window.showToast("🗑️ Đã huỷ dòng sản phẩm — kho đã được hoàn lại tự động.", "#e17055");
    } else {
      /* ── HUỶ CẢ ĐƠN ── */
      const { error: voidErr } = await client.from("customer_orders").update({
        status: "voided", voided_by: staff, voided_at: new Date().toISOString(), void_reason: reason,
      }).eq("id", targetId);
      if (voidErr) throw voidErr;

      /* Tự tính lại total_spent/total_profit vì trigger DB không tự
         chạy lại khi chỉ đổi status của customer_orders (không đụng
         customer_order_items) — loại trừ cả đơn 'voided' LẪN các dòng
         is_void=true còn sót trong các đơn 'completed' khác. */
      const { data: completedItems, error: sumErr } = await client
        .from("customer_order_items")
        .select("customer_paid, profit, customer_orders!inner(customer_id, status)")
        .eq("customer_orders.customer_id", customerId)
        .eq("customer_orders.status", "completed")
        .eq("is_void", false);
      if (sumErr) throw sumErr;

      const totalSpent  = (completedItems || []).reduce((s, it) => s + Number(it.customer_paid), 0);
      const totalProfit = (completedItems || []).reduce((s, it) => s + Number(it.profit), 0);

      const { data: freshCust, error: updErr } = await client
        .from("customers").update({ total_spent: totalSpent, total_profit: totalProfit })
        .eq("id", customerId).select().single();
      if (updErr) throw updErr;

      const idx = M.state.customers.findIndex(c => c.id === customerId);
      if (idx !== -1) M.state.customers[idx] = freshCust;

      window.showToast("🗑️ Đã huỷ đơn hàng — kho đã được hoàn lại tự động.", "#e17055");
    }

    document.getElementById("voidOrderModal").classList.add("hidden");
    renderCustomerTable();
    openCustomerDetail(customerId);
  } catch (err) {
    window.showToast("❌ Lỗi: " + err.message, "#e17055");
  } finally {
    btn.disabled = false;
  }
}

/* ══════════════════════════════════════════════
   NHIỆM VỤ — CẬP NHẬT TIẾN ĐỘ (không áp dụng cho quest check-in —
   quest đó đã bị loại khỏi danh sách "Nhiệm vụ đang diễn ra" ở trên)
   ══════════════════════════════════════════════ */
async function markQuestProgress(customerId, questId) {
  if (!isSuperAdminCust || _custActionBusy) return;
  const quest = M.state.quests.find(q => q.id === questId);
  const cust  = M.state.customers.find(c => c.id === customerId);
  if (!quest || !cust || quest.is_checkin) return;

  const pk = M.periodKeyFor(quest.type);
  _custActionBusy = true;

  try {
    const { data: existing } = await client.from("customer_quests")
      .select("*").eq("customer_id", customerId).eq("quest_id", questId).eq("period_key", pk).maybeSingle();

    if (existing?.is_completed) { window.showToast("Nhiệm vụ này đã hoàn thành trong kỳ hiện tại rồi.", "#e17055"); return; }

    const newProgress = (existing?.progress || 0) + 1;
    const isDone = newProgress >= quest.target_count;
    const staff = currentSession.displayName || currentSession.username;

    if (existing) {
      const { error: upErr } = await client.from("customer_quests").update({
        progress: newProgress, is_completed: isDone,
        xp_awarded: isDone ? quest.xp_reward : 0,
        completed_by: isDone ? staff : null,
        completed_at: isDone ? new Date().toISOString() : null,
      }).eq("id", existing.id);
      if (upErr) throw upErr;
    } else {
      const { error: insErr } = await client.from("customer_quests").insert({
        customer_id: customerId, quest_id: questId, period_key: pk,
        progress: newProgress, is_completed: isDone,
        xp_awarded: isDone ? quest.xp_reward : 0,
        completed_by: isDone ? staff : null,
        completed_at: isDone ? new Date().toISOString() : null,
      });
      if (insErr) throw insErr;
    }

    if (isDone) {
      const newXp    = cust.xp + quest.xp_reward;
      const newLevel = M.getLevelForXp(newXp);
      const { data, error: xpErr } = await client.from("customers")
        .update({ xp: newXp, level: newLevel }).eq("id", customerId).select().single();
      if (xpErr) throw xpErr;

      const idx = M.state.customers.findIndex(c => c.id === customerId);
      if (idx !== -1) M.state.customers[idx] = data;

      window.showToast(`🎉 Hoàn thành "${quest.title}"! +${quest.xp_reward} XP`);
    } else {
      window.showToast(`Tiến độ: ${newProgress}/${quest.target_count}`);
    }

    renderCustomerTable();
    openCustomerDetail(customerId);
  } catch (err) {
    window.showToast("❌ Lỗi: " + err.message, "#e17055");
  } finally {
    _custActionBusy = false;
  }
}

/* ══════════════════════════════════════════════
   XOÁ KHÁCH HÀNG — SOFT DELETE (customer_orders.customer_id là
   ON DELETE RESTRICT, xoá cứng sẽ lỗi nếu khách đã từng có đơn hàng)
   ══════════════════════════════════════════════ */
async function deleteCustomer(id) {
  if (!isSuperAdminCust) return;
  const cust = M.state.customers.find(c => c.id === id);

  const reason = await window.showReasonPrompt({
    title: `Xoá khách hàng "${cust?.name || ''}"?`,
    message: "Khách hàng sẽ bị ẩn khỏi danh sách nhưng lịch sử đơn hàng/EXP vẫn được giữ lại để tra soát khi cần.",
    reasonLabel: "Lý do xoá *",
    reasonPlaceholder: "VD: trùng số điện thoại, khách yêu cầu xoá dữ liệu...",
    confirmText: "🗑️ Xoá",
    cancelText: "Huỷ",
  });
  if (reason === null) return;

  try {
    const { error } = await client.from("customers")
      .update({
        deleted_at: new Date().toISOString(),
        deleted_reason: reason,
        deleted_by: currentSession.displayName || currentSession.username,
      }).eq("id", id);
    if (error) throw error;

    M.state.customers = M.state.customers.filter(c => c.id !== id);

    document.getElementById("customerDetailModal").classList.add("hidden");
    window.showToast("🗑️ Đã xoá khách hàng", "#e17055");
    renderCustomerTable();
  } catch (err) {
    window.showToast("❌ Lỗi: " + err.message, "#e17055");
  }
}
