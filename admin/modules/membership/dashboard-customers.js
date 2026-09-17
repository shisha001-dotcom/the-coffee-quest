/* ══════════════════════════════════════════════
   DASHBOARD CUSTOMERS — admin/modules/membership/dashboard-customers.js
   ─────────────────────────────────────────────
   ⚠️ VIẾT LẠI THEO YÊU CẦU TÁCH TÍNH NĂNG (2026-07-23):

   - Phần "Tạo đơn hàng" (chọn sản phẩm, số lượng, submit, trừ kho,
     auto check-in) ĐÃ CHUYỂN HẲN sang tab "Đơn hàng" riêng
     (admin/modules/orders/dashboard-orders.js). File này KHÔNG còn
     orderDrinksCache/orderDraftRows/submitOrder/consumeStockForOrderItems/
     maybeAutoCheckin nữa.
   - Phần "Huỷ đơn / huỷ dòng sản phẩm" (voidOrderModal, openVoidModal,
     confirmVoidOrder) ĐÃ CHUYỂN sang tab "Đơn hàng" — thao tác huỷ
     chỉ làm ở bảng tra cứu theo ngày bên đó, KHÔNG còn ở đây.
   - Modal "Chi tiết khách hàng" (customerDetailModal) ĐÃ BỎ HẲN —
     thay bằng 1 PAGE riêng (customerDetailPage, kiểu gameDetailPage —
     giữ sideMenu, có nút Quay lại), xử lý bởi file MỚI
     admin/modules/membership/dashboard-customer-detail.js. File này
     chỉ còn trách nhiệm: bảng danh sách khách hàng + thêm khách mới +
     xoá khách hàng (soft delete) + điều hướng sang customerDetailPage.
   - Khối "Nhiệm vụ đang diễn ra" (tick tiến độ quest thường,
     markQuestProgress) ĐÃ BỎ HẲN theo yêu cầu — không còn ở đâu trong
     lần cập nhật này.

   ⚠️ SỬA (dedupe — validate SĐT VN): saveNewCustomer() KHÔNG còn tự
   viết regex ^0\d{9,10}$ nữa — gọi window.isValidPhoneVN(phone) dùng
   chung (js/shared-utils.js), cùng logic với js/membership.js (frontend)
   và dashboard-orders.js::lookupCustomerForOrder(). Trước đây 3 nơi
   này tự copy-paste y hệt 1 regex — sửa 1 chỗ quên 2 chỗ còn lại sẽ
   khiến validate lệch nhau giữa các form.

   ⚠️ MỚI (yêu cầu bổ sung — xuất Excel + lọc theo ngày):
   - Thêm bộ lọc "📅 Lọc theo ngày đăng ký" (custDateFrom/custDateTo)
     ngay trên bảng danh sách — lọc CỤC BỘ trên dữ liệu đã tải sẵn
     trong M.state.customers (không gọi lại Supabase), áp dụng ĐỒNG
     THỜI với ô tìm kiếm tên/SĐT hiện có.
   - Thêm nút "⬇️ Xuất Excel" (dùng window.XLSX/SheetJS — đã có sẵn
     qua CDN trong admin/dashboard.html, cùng thư viện dùng bởi
     admin/modules/orders/dashboard-orders.js::exportOrdersToExcel())
     — xuất ĐÚNG danh sách khách hàng ĐANG hiển thị (đã áp mọi bộ lọc
     ở trên), 1 sheet chi tiết đầy đủ cột.
   - ⚠️ GIẢ ĐỊNH SCHEMA: dùng cột `customers.created_at` làm "ngày
     đăng ký" (Supabase mặc định luôn tự thêm cột timestamptz này cho
     bảng mới, và M.loadCustomers() đã SELECT * nên cột này tự có
     trong state nếu tồn tại). Nếu bảng `customers` thực tế KHÔNG có
     cột này, đổi lại tên cột ở 3 chỗ: getFilteredCustomers() (dòng
     đọc c.created_at để lọc) và exportCustomersToExcel() (cột "Ngày
     đăng ký" trong header/rows) — không có chỗ nào khác phụ thuộc.

   Cần: client, currentSession, window.AdminPermissions,
   window.Membership (M) — PHẢI load trước file này,
   window.escHtml, window.showToast, window.showReasonPrompt, window.debounce,
   window.isValidPhoneVN, window.slugify, window.formatDateVN
   (js/shared-utils.js), window.XLSX (CDN SheetJS — đã load sẵn trong
   admin/dashboard.html, dùng chung với dashboard-orders.js).
   ══════════════════════════════════════════════ */

const M = window.Membership;
const isSuperAdminCust = M.isSuperAdmin;

let custActiveTab = "list";
let custSearchQ   = "";
let _custActionBusy = false;

/* ⚠️ MỚI: bộ lọc theo khoảng ngày đăng ký (customers.created_at) +
   xuất Excel danh sách khách hàng đang hiển thị (đã áp search + lọc
   ngày). Xem ghi chú giả định schema ở đầu file. */
let custDateFrom = ""; // "" = không giới hạn
let custDateTo   = "";

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
  },
});

function renderIfLevelsTabActive() { if (custActiveTab === "levels" && window.renderLevelsTab) window.renderLevelsTab(); }
function renderIfQuestsTabActive() { if (custActiveTab === "quests" && window.renderQuestsTab) window.renderQuestsTab(); }

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
        <p class="page-subtitle">Quản lý nhân vật, cấp độ &amp; nhiệm vụ. Tạo/tra cứu đơn hàng ở tab 🧾 Đơn hàng.</p>
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

      <!-- ⚠️ MỚI: lọc theo khoảng ngày đăng ký + xuất Excel danh sách đang hiển thị -->
      <div style="display:flex;gap:8px;align-items:center;flex-wrap:wrap;margin-bottom:20px;">
        <span style="font-size:12px;font-weight:700;color:var(--text-muted);">📅 Lọc theo ngày đăng ký:</span>
        <label for="custDateFrom" class="visually-hidden">Từ ngày</label>
        <input type="date" id="custDateFrom" style="height:38px;border:1px solid var(--border);border-radius:8px;padding:0 10px;font-size:13px;">
        <span style="color:var(--text-muted);font-size:13px;">→</span>
        <label for="custDateTo" class="visually-hidden">Đến ngày</label>
        <input type="date" id="custDateTo" style="height:38px;border:1px solid var(--border);border-radius:8px;padding:0 10px;font-size:13px;">
        <button class="btn btn-secondary" id="custDateClearBtn" style="font-size:13px;">↺ Xoá lọc ngày</button>
        <button class="btn btn-secondary" id="custExportExcelBtn" style="font-size:13px;">⬇️ Xuất Excel</button>
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
  `;
  main.appendChild(page);

  bindTabButtons();
  bindTopLevelEvents();

  const searchInput = document.getElementById("custSearchInput");
  searchInput.addEventListener("input", window.debounce(e => {
    custSearchQ = e.target.value.toLowerCase();
    renderCustomerTable();
  }, 200));

  const addModal = document.getElementById("addCustomerModal");
  addModal?.addEventListener("click", e => { if (e.target === addModal) addModal.classList.add("hidden"); });
  addModal?.addEventListener("keydown", e => { if (e.key === "Escape") addModal.classList.add("hidden"); });
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

  /* ⚠️ MỚI: lọc theo khoảng ngày đăng ký + xuất Excel */
  document.getElementById("custDateFrom")?.addEventListener("change", handleCustDateRangeChange);
  document.getElementById("custDateTo")?.addEventListener("change", handleCustDateRangeChange);
  document.getElementById("custDateClearBtn")?.addEventListener("click", clearCustDateFilter);
  document.getElementById("custExportExcelBtn")?.addEventListener("click", exportCustomersToExcel);
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

/* ⚠️ MỚI: điểm lọc DUY NHẤT — dùng chung bởi renderCustomerTable()
   VÀ exportCustomersToExcel(), để bảng hiển thị và file Excel xuất
   ra LUÔN khớp nhau (đúng nguyên tắc đã áp dụng ở
   dashboard-orders.js::getFilteredOrdersOfDay()). */
function getFilteredCustomers() {
  return M.state.customers.filter(c => {
    if (custSearchQ) {
      const name  = (c.name  || "").toLowerCase();
      const phone = c.phone || "";
      if (!name.includes(custSearchQ) && !phone.includes(custSearchQ)) return false;
    }

    if (custDateFrom || custDateTo) {
      /* ⚠️ Giả định cột customers.created_at tồn tại — xem ghi chú
         đầu file nếu schema thật dùng tên cột khác. */
      const created = (c.created_at || "").slice(0, 10); // "YYYY-MM-DD"
      if (!created) return false; // không xác định được ngày đăng ký → loại khỏi kết quả khi đang lọc theo ngày
      if (custDateFrom && created < custDateFrom) return false;
      if (custDateTo   && created > custDateTo)   return false;
    }

    return true;
  });
}

function renderCustomerTable() {
  const tbody = document.getElementById("custTableBody");
  if (!tbody) return;

  const list = getFilteredCustomers();

  if (!list.length) {
    tbody.innerHTML = `<tr><td colspan="7" style="text-align:center;padding:40px;color:var(--text-muted);">${M.state.customers.length ? "Không tìm thấy khách hàng phù hợp với bộ lọc hiện tại." : "Chưa có khách hàng nào."}</td></tr>`;
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
      <td style="display:flex;gap:6px;flex-wrap:wrap;">
        <button class="btn btn-primary" data-cust-detail="${c.id}">🔍 Chi tiết</button>
        <button class="btn btn-danger" style="font-size:12px;padding:6px 10px;" data-cust-delete="${c.id}" title="Xoá khách hàng">🗑️</button>
      </td>
    </tr>`;
  }).join("");

  tbody.querySelectorAll("[data-cust-detail]").forEach(btn => {
    btn.addEventListener("click", () => {
      if (typeof window.openCustomerDetailPage === "function") {
        window.openCustomerDetailPage(Number(btn.dataset.custDetail));
      } else {
        window.showToast("⚠️ Trang chi tiết khách hàng chưa sẵn sàng.", "#e17055");
      }
    });
  });
  tbody.querySelectorAll("[data-cust-delete]").forEach(btn => {
    btn.addEventListener("click", () => deleteCustomer(Number(btn.dataset.custDelete)));
  });
}

/* ⚠️ MỚI: thay đổi khoảng ngày lọc — tự hoán đổi nếu nhập ngược,
   giống hệt handleOrderDateRangeChange() ở dashboard-orders.js. */
function handleCustDateRangeChange() {
  custDateFrom = document.getElementById("custDateFrom").value || "";
  custDateTo   = document.getElementById("custDateTo").value   || "";
  if (custDateFrom && custDateTo && custDateFrom > custDateTo) {
    [custDateFrom, custDateTo] = [custDateTo, custDateFrom];
    document.getElementById("custDateFrom").value = custDateFrom;
    document.getElementById("custDateTo").value   = custDateTo;
  }
  renderCustomerTable();
}

function clearCustDateFilter() {
  custDateFrom = "";
  custDateTo   = "";
  document.getElementById("custDateFrom").value = "";
  document.getElementById("custDateTo").value   = "";
  renderCustomerTable();
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
  /* ⚠️ SỬA (dedupe): dùng window.isValidPhoneVN() dùng chung thay vì
     regex ^0\d{9,10}$ viết tay riêng ở đây (js/shared-utils.js). */
  if (!phone || !window.isValidPhoneVN(phone)) {
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

    if (typeof window.openCustomerDetailPage === "function") {
      window.openCustomerDetailPage(data.id);
    }
  } catch (err) {
    window.showToast("❌ Lỗi: " + err.message, "#e17055");
  } finally {
    _custActionBusy = false;
    btn.disabled = false; btn.textContent = "💾 Tạo khách hàng";
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

    window.showToast("🗑️ Đã xoá khách hàng", "#e17055");
    renderCustomerTable();
  } catch (err) {
    window.showToast("❌ Lỗi: " + err.message, "#e17055");
  }
}

/* ══════════════════════════════════════════════
   ⚠️ MỚI — XUẤT EXCEL DANH SÁCH KHÁCH HÀNG
   ─────────────────────────────────────────────
   Xuất ĐÚNG danh sách khách hàng ĐANG hiển thị (đã áp ô tìm kiếm
   tên/SĐT + bộ lọc khoảng ngày đăng ký ở trên — dùng chung
   getFilteredCustomers() để không bao giờ lệch giữa bảng và file
   Excel). 1 sheet chi tiết đầy đủ cột, dùng window.XLSX (SheetJS —
   đã tải sẵn qua CDN trong admin/dashboard.html).
   ══════════════════════════════════════════════ */
function exportCustomersToExcel() {
  if (typeof window.XLSX === "undefined") {
    window.showToast("⚠️ Chưa tải được thư viện xuất Excel — kiểm tra kết nối mạng hoặc CDN xlsx trong dashboard.html.", "#e17055");
    return;
  }

  const list = getFilteredCustomers();
  if (!list.length) {
    window.showToast("⚠️ Không có khách hàng nào để xuất theo bộ lọc hiện tại.", "#e17055");
    return;
  }

  const genderLabel = g => g === "nam" ? "Nam" : g === "nu" ? "Nữ" : g === "khac" ? "Khác" : "—";
  const fmtDate = iso => {
    if (!iso) return "";
    try { return new Date(iso).toLocaleDateString("vi-VN"); } catch { return iso; }
  };
  const fmtDateTime = iso => {
    if (!iso) return "";
    try { return new Date(iso).toLocaleString("vi-VN"); } catch { return iso; }
  };

  const header = [
    "STT", "Tên", "Số điện thoại", "Ngày sinh", "Giới tính",
    "Ngày đăng ký", "Cấp độ", "Hạng", "XP",
    "Tổng chi tiêu (đ)", "Lợi nhuận gộp (đ)", "Streak (ngày)", "Check-in gần nhất",
  ];

  const rows = list.map((c, i) => {
    const info = M.getLevelInfo(c.level);
    return [
      i + 1,
      c.name || "",
      c.phone || "",
      fmtDate(c.date_of_birth),
      genderLabel(c.gender),
      fmtDateTime(c.created_at), // ⚠️ xem ghi chú giả định schema đầu file
      c.level,
      `${info.rank_icon || ""} ${info.rank_name || ""}`.trim(),
      c.xp || 0,
      Math.round(Number(c.total_spent) || 0),
      Math.round(Number(c.total_profit) || 0),
      c.streak_days || 0,
      c.last_checkin_date ? window.formatDateVN(c.last_checkin_date) : "",
    ];
  });

  const wb = window.XLSX.utils.book_new();
  const ws = window.XLSX.utils.aoa_to_sheet([header, ...rows]);
  ws['!cols'] = header.map((_, i) => ({ wch: i === 1 ? 22 : i === 7 ? 18 : 14 }));
  window.XLSX.utils.book_append_sheet(wb, ws, "Khách hàng");

  const rangeLabel = (custDateFrom || custDateTo)
    ? `${custDateFrom || "truoc"}_den_${custDateTo || "nay"}`
    : "tat-ca";
  const searchSuffix = custSearchQ ? `_loc-${window.slugify(custSearchQ)}` : "";
  const filename = `khach-hang_${rangeLabel}${searchSuffix}.xlsx`;

  try {
    window.XLSX.writeFile(wb, filename);
    window.showToast(`✅ Đã xuất file "${filename}"!`);
  } catch (err) {
    window.showToast("❌ Lỗi khi xuất Excel: " + err.message, "#e17055");
  }
}
