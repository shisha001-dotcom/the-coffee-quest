/* ══════════════════════════════════════════════
   DASHBOARD CUSTOMERS — admin/modules/membership/dashboard-customers.js
   ─────────────────────────────────────────────
   VAI TRÒ
   Trang "🎮 Khách hàng — Coffee Quest" (#customersPage), chỉ Super Admin
   truy cập. Gồm 3 tab: 👥 Danh sách (file này) / 🗺️ Nhiệm vụ
   (dashboard-quests.js) / 🏆 Cấp độ (dashboard-levels.js) — 2 tab sau vẽ
   vào #custTabQuests / #custTabLevels do file này tạo sẵn.

   PHẠM VI CỦA FILE NÀY (đã tách bớt sang nơi khác)
     - Tạo đơn hàng / Huỷ đơn / Huỷ dòng: đã chuyển sang trang "🧾 Đơn hàng"
       (dashboard-orders.js). File này KHÔNG còn liên quan.
     - Xem chi tiết khách: mở trang riêng customerDetailPage
       (dashboard-customer-detail.js) qua nút "🔍 Chi tiết".
     - Cộng tiến độ nhiệm vụ thường: hiện KHÔNG có giao diện nào (xem ghi
       chú ở dashboard-quests.js).
   File này chỉ còn: bảng danh sách khách + lọc/tìm kiếm + xuất Excel +
   thêm khách mới + xoá khách (xoá mềm).

   TÍNH NĂNG XUẤT EXCEL (nút "⬇️ Xuất Excel")
   Xuất ĐÚNG danh sách khách đang hiển thị (đã áp tìm kiếm + lọc ngày đăng
   ký) kèm TOÀN BỘ hoặc 1 khoảng ngày lịch sử đơn hàng của các khách đó
   (lọc RIÊNG bằng 2 ô ngày "🧾 Chỉ lấy đơn hàng trong khoảng ngày" — không
   ảnh hưởng bảng trên màn hình). File .xlsx có 3 sheet: "Khách hàng" (tổng
   hợp), "Đơn hàng" (mỗi dòng = 1 đơn), "Chi tiết sản phẩm" (mỗi dòng = 1
   sản phẩm trong 1 đơn) — cấu trúc 2 sheet sau lấy theo đúng mẫu ở
   dashboard-orders.js::exportOrdersToExcel() để nhất quán trong dự án.
   Trang này chỉ Super Admin vào được nên KHÔNG cần ẩn giá vốn/lợi nhuận
   như cách dashboard-orders.js phải làm cho Bar Staff.

   ⚠️ GIẢ ĐỊNH SCHEMA — "NGÀY ĐĂNG KÝ"
   Bộ lọc theo ngày đăng ký (custDateFrom/custDateTo) và cột "Ngày đăng ký"
   trong Excel đều đọc customers.created_at. Nếu bảng `customers` không có
   cột này, sửa lại ở getFilteredCustomers() (dòng đọc c.created_at) và
   buildAndDownloadCustomerWorkbook() (cột "Ngày đăng ký").

   ⚠️ GIỚI HẠN ĐỘ DÀI URL KHI XUẤT EXCEL
   Truy vấn đơn hàng dùng .in("customer_id", ids) — gửi toàn bộ danh sách id
   trong query string. Nếu không lọc gì (chọn hết khách) và số khách lên tới
   hàng nghìn, có thể chạm giới hạn độ dài URL của PostgREST. Quy mô 1 quán
   thông thường thì không đáng lo.

   PHỤ THUỘC
   client, currentSession, window.AdminPermissions, window.Membership
   (alias M), window.escHtml, showToast, showReasonPrompt, debounce,
   isValidPhoneVN, slugify, formatDateVN (js/shared-utils.js), window.XLSX
   (CDN SheetJS, dùng chung với dashboard-orders.js).
   ══════════════════════════════════════════════ */

const M = window.Membership;
const isSuperAdminCust = M.isSuperAdmin;

let custActiveTab = "list";
let custSearchQ   = "";
let _custActionBusy = false;

/* Bộ lọc theo khoảng ngày ĐĂNG KÝ (customers.created_at) — ảnh hưởng CẢ
   bảng hiển thị lẫn danh sách khách được đưa vào Excel. "" = không giới hạn. */
let custDateFrom = "";
let custDateTo   = "";

/* Bộ lọc ngày RIÊNG cho ĐƠN HÀNG — chỉ dùng lúc xuất Excel, không đụng tới
   bảng khách hàng trên màn hình. Để trống = lấy toàn bộ lịch sử đơn hàng
   của các khách đang được lọc ở trên. */
let custOrderDateFrom = "";
let custOrderDateTo   = "";

/* ══════════════════════════════════════════════
   ĐĂNG KÝ TRANG
   onShow: tải cấp độ + nhiệm vụ (chỉ vẽ lại nếu đúng tab đang mở) rồi tải
   danh sách khách hàng.
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
   DỰNG TRANG — inject 1 lần lúc file chạy (chỉ khi Super Admin)
   ─────────────────────────────────────────────
   Bảng tra "sửa ở đâu" (HTML trong chuỗi bên dưới):
     · Tiêu đề "🎮 Khách hàng — Coffee Quest" + phụ đề.
     · 3 nút tab: "👥 Danh sách" / "🗺️ Nhiệm vụ" / "🏆 Cấp độ".
     · Placeholder ô tìm kiếm: "🔍 Tìm theo tên hoặc số điện thoại...".
     · 2 cụm lọc ngày: "📅 Lọc khách hàng theo ngày đăng ký" và
       "🧾 Chỉ lấy đơn hàng trong khoảng ngày (áp dụng khi xuất Excel)"
       (cụm sau có nền var(--bg), bo 10px, để phân biệt trực quan với bảng
       chính — không ảnh hưởng gì tới bảng hiển thị).
     · Cột bảng: Khách hàng / Cấp độ / XP / Đã chi tiêu / Lợi nhuận gộp /
       Check-in gần nhất / Hành động.
     · Popup thêm khách: rộng tối đa 480px, các ô Tên *, Số điện thoại *,
       Ngày sinh, Giới tính (Không rõ / Nam / Nữ / Khác).
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

      <!-- Lọc theo khoảng ngày đăng ký — ảnh hưởng cả bảng lẫn Excel -->
      <div style="display:flex;gap:8px;align-items:center;flex-wrap:wrap;margin-bottom:12px;">
        <span style="font-size:12px;font-weight:700;color:var(--text-muted);">📅 Lọc khách hàng theo ngày đăng ký:</span>
        <label for="custDateFrom" class="visually-hidden">Từ ngày đăng ký</label>
        <input type="date" id="custDateFrom" style="height:38px;border:1px solid var(--border);border-radius:8px;padding:0 10px;font-size:13px;">
        <span style="color:var(--text-muted);font-size:13px;">→</span>
        <label for="custDateTo" class="visually-hidden">Đến ngày đăng ký</label>
        <input type="date" id="custDateTo" style="height:38px;border:1px solid var(--border);border-radius:8px;padding:0 10px;font-size:13px;">
        <button class="btn btn-secondary" id="custDateClearBtn" style="font-size:13px;">↺ Xoá lọc ngày</button>
      </div>

      <!-- Lọc ngày RIÊNG cho đơn hàng — chỉ dùng khi xuất Excel -->
      <div style="display:flex;gap:8px;align-items:center;flex-wrap:wrap;margin-bottom:8px;padding:12px 16px;background:var(--bg);border-radius:10px;">
        <span style="font-size:12px;font-weight:700;color:var(--text-muted);">🧾 Chỉ lấy đơn hàng trong khoảng ngày (áp dụng khi xuất Excel):</span>
        <label for="custOrderDateFrom" class="visually-hidden">Từ ngày (đơn hàng)</label>
        <input type="date" id="custOrderDateFrom" style="height:38px;border:1px solid var(--border);border-radius:8px;padding:0 10px;font-size:13px;">
        <span style="color:var(--text-muted);font-size:13px;">→</span>
        <label for="custOrderDateTo" class="visually-hidden">Đến ngày (đơn hàng)</label>
        <input type="date" id="custOrderDateTo" style="height:38px;border:1px solid var(--border);border-radius:8px;padding:0 10px;font-size:13px;">
        <button class="btn btn-secondary" id="custOrderDateClearBtn" style="font-size:13px;">↺ Xoá lọc đơn hàng</button>
      </div>
      <div style="font-size:11px;color:var(--text-muted);margin-bottom:16px;">
        Để trống 2 ô "đơn hàng" ở trên = xuất Excel kèm <b>toàn bộ</b> lịch sử đơn hàng của các khách hàng đang được lọc phía trên.
      </div>

      <div style="margin-bottom:20px;">
        <button class="btn btn-secondary" id="custExportExcelBtn" style="font-size:13px;">⬇️ Xuất Excel (kèm chi tiết đơn hàng)</button>
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

  document.getElementById("custDateFrom")?.addEventListener("change", handleCustDateRangeChange);
  document.getElementById("custDateTo")?.addEventListener("change", handleCustDateRangeChange);
  document.getElementById("custDateClearBtn")?.addEventListener("click", clearCustDateFilter);

  document.getElementById("custOrderDateFrom")?.addEventListener("change", handleCustOrderDateRangeChange);
  document.getElementById("custOrderDateTo")?.addEventListener("change", handleCustOrderDateRangeChange);
  document.getElementById("custOrderDateClearBtn")?.addEventListener("click", clearCustOrderDateFilter);

  document.getElementById("custExportExcelBtn")?.addEventListener("click", exportCustomersToExcel);
}

/* ══════════════════════════════════════════════
   CHUYỂN TAB (Danh sách / Nhiệm vụ / Cấp độ)
   Nút đang chọn dùng btn-primary, còn lại btn-secondary.
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
   TẢI + VẼ BẢNG KHÁCH HÀNG
   Lỗi tải: hiện hộp #custErrorMsg với chữ "❌ Lỗi khi tải danh sách khách
   hàng: …" và bảng báo "Không tải được dữ liệu." (chữ var(--danger)).
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

/* ══════════════════════════════════════════════
   ĐIỂM LỌC DUY NHẤT CHO DANH SÁCH KHÁCH
   ─────────────────────────────────────────────
   Dùng chung bởi renderCustomerTable() VÀ exportCustomersToExcel(), để
   bảng hiển thị và file Excel LUÔN khớp nhau (đúng nguyên tắc đã áp dụng ở
   dashboard-orders.js::getFilteredOrdersOfDay()). Điều kiện (AND):
     · tên hoặc SĐT chứa từ khoá tìm kiếm
     · nếu có lọc ngày đăng ký: created_at (cắt lấy "YYYY-MM-DD") nằm trong
       khoảng đã chọn — khách KHÔNG XÁC ĐỊNH được ngày đăng ký sẽ bị loại
       khỏi kết quả khi đang lọc theo ngày (xem ghi chú giả định schema ở
       đầu file).
   ══════════════════════════════════════════════ */
function getFilteredCustomers() {
  return M.state.customers.filter(c => {
    if (custSearchQ) {
      const name  = (c.name  || "").toLowerCase();
      const phone = c.phone || "";
      if (!name.includes(custSearchQ) && !phone.includes(custSearchQ)) return false;
    }

    if (custDateFrom || custDateTo) {
      const created = (c.created_at || "").slice(0, 10); // "YYYY-MM-DD"
      if (!created) return false;
      if (custDateFrom && created < custDateFrom) return false;
      if (custDateTo   && created > custDateTo)   return false;
    }

    return true;
  });
}

/* ══════════════════════════════════════════════
   VẼ BẢNG
   ─────────────────────────────────────────────
   Mỗi dòng: tên (+ SĐT chữ nhỏ), cấp độ (nhãn .badge "<icon> <tên rank>"),
   XP (đậm màu var(--primary)), tổng chi tiêu, lợi nhuận gộp (màu
   var(--easy,#00b894) khi ≥ 0, var(--danger) khi âm), check-in gần nhất
   kèm "🔥<số>" nếu có streak, và 2 nút: "🔍 Chi tiết" / "🗑️" (xoá).
   Rỗng: "Không tìm thấy khách hàng phù hợp với bộ lọc hiện tại." (khi đã có
   dữ liệu nhưng lọc hết) hoặc "Chưa có khách hàng nào." (khi thật sự trống).
   ══════════════════════════════════════════════ */
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

/* ══════════════════════════════════════════════
   BỘ LỌC NGÀY ĐĂNG KÝ — tự hoán đổi nếu nhập ngược (giống
   handleOrderDateRangeChange() trong dashboard-orders.js).
   ══════════════════════════════════════════════ */
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

/* Bộ lọc ngày ĐƠN HÀNG (chỉ dùng khi xuất Excel) — KHÔNG vẽ lại bảng khách. */
function handleCustOrderDateRangeChange() {
  custOrderDateFrom = document.getElementById("custOrderDateFrom").value || "";
  custOrderDateTo   = document.getElementById("custOrderDateTo").value   || "";
  if (custOrderDateFrom && custOrderDateTo && custOrderDateFrom > custOrderDateTo) {
    [custOrderDateFrom, custOrderDateTo] = [custOrderDateTo, custOrderDateFrom];
    document.getElementById("custOrderDateFrom").value = custOrderDateFrom;
    document.getElementById("custOrderDateTo").value   = custOrderDateTo;
  }
}

function clearCustOrderDateFilter() {
  custOrderDateFrom = "";
  custOrderDateTo   = "";
  document.getElementById("custOrderDateFrom").value = "";
  document.getElementById("custOrderDateTo").value   = "";
}

/* ══════════════════════════════════════════════
   THÊM KHÁCH HÀNG MỚI
   ─────────────────────────────────────────────
   Kiểm tra: tên bắt buộc, SĐT hợp lệ theo window.isValidPhoneVN (lỗi tại
   ô "Vui lòng nhập tên." / "Số điện thoại không hợp lệ (VD: 0912345678)."),
   và SĐT chưa tồn tại trong hệ thống ("Số điện thoại này đã tồn tại trong
   hệ thống."). Tạo xong: thêm vào ĐẦU danh sách trong bộ nhớ, đóng popup,
   toast "✅ Đã tạo khách hàng mới!", rồi MỞ LUÔN trang chi tiết của khách
   vừa tạo.
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
   XOÁ KHÁCH HÀNG — XOÁ MỀM
   customer_orders.customer_id là khoá ngoại ON DELETE RESTRICT: xoá cứng sẽ
   lỗi nếu khách đã từng có đơn hàng. Bắt buộc nhập lý do (hộp thoại
   window.showReasonPrompt). Xong: toast "🗑️ Đã xoá khách hàng" (nền #e17055).
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
   XUẤT EXCEL (KÈM CHI TIẾT ĐƠN HÀNG)
   ─────────────────────────────────────────────
   Trình tự:
     1. Lấy danh sách khách ĐANG hiển thị (getFilteredCustomers()).
     2. Truy vấn customer_orders (kèm customer_order_items) của ĐÚNG các
        customer_id đó, lọc thêm theo custOrderDateFrom/To nếu có.
     3. Dựng workbook 3 sheet rồi tải xuống.
   Không có khách nào theo bộ lọc → toast "⚠️ Không có khách hàng nào để
   xuất theo bộ lọc hiện tại." Trong lúc tải dữ liệu, nút đổi chữ
   "⏳ Đang tải dữ liệu đơn hàng...".
   ══════════════════════════════════════════════ */
async function exportCustomersToExcel() {
  if (typeof window.XLSX === "undefined") {
    window.showToast("⚠️ Chưa tải được thư viện xuất Excel — kiểm tra kết nối mạng hoặc CDN xlsx trong dashboard.html.", "#e17055");
    return;
  }

  const list = getFilteredCustomers();
  if (!list.length) {
    window.showToast("⚠️ Không có khách hàng nào để xuất theo bộ lọc hiện tại.", "#e17055");
    return;
  }

  const btn = document.getElementById("custExportExcelBtn");
  const origText = btn ? btn.textContent : "";
  if (btn) { btn.disabled = true; btn.textContent = "⏳ Đang tải dữ liệu đơn hàng..."; }

  try {
    const customerIds = list.map(c => c.id);

    let ordersQuery = client
      .from("customer_orders")
      .select("*, customers(name, phone), customer_order_items(*)")
      .in("customer_id", customerIds)
      .order("created_at", { ascending: false });

    if (custOrderDateFrom) ordersQuery = ordersQuery.gte("created_at", custOrderDateFrom + "T00:00:00");
    if (custOrderDateTo)   ordersQuery = ordersQuery.lt("created_at", custOrderDateTo + "T23:59:59.999");

    const { data: orders, error: ordersErr } = await ordersQuery;
    if (ordersErr) throw ordersErr;

    buildAndDownloadCustomerWorkbook(list, orders || []);
  } catch (err) {
    window.showToast("❌ Lỗi khi tải dữ liệu đơn hàng để xuất Excel: " + err.message, "#e17055");
  } finally {
    if (btn) { btn.disabled = false; btn.textContent = origText || "⬇️ Xuất Excel (kèm chi tiết đơn hàng)"; }
  }
}

/* ══════════════════════════════════════════════
   DỰNG WORKBOOK 3 SHEET + TẢI XUỐNG
   ─────────────────────────────────────────────
   Sheet 1 "Khách hàng": STT, Tên, SĐT, Ngày sinh, Giới tính (Nam/Nữ/Khác/—),
     Ngày đăng ký, Cấp độ, Hạng, XP, Tổng chi tiêu, Lợi nhuận gộp, Streak,
     Check-in gần nhất.
   Sheet 2 "Đơn hàng": tổng hợp theo đơn — Mã đơn, Khách hàng, SĐT, Thời
     gian, Số món còn hiệu lực, Tổng khách trả, Tổng lợi nhuận gộp, Trạng
     thái (Hoàn tất/Đã huỷ), Lý do huỷ, Nhân viên tạo đơn.
   Sheet 3 "Chi tiết sản phẩm": mỗi dòng = 1 sản phẩm trong 1 đơn, gồm cả
     giá vốn nguyên liệu và lợi nhuận từng dòng; đơn không có sản phẩm vẫn
     ra 1 dòng ghi "(Không có sản phẩm)".
   Tên file: "khach-hang-chi-tiet_<khoảng ngày đăng ký>[_don-<khoảng ngày
   đơn hàng>][_loc-<từ khoá>].xlsx" — ví dụ khoảng ngày trống thì dùng chữ
   "tat-ca" / "truoc" / "nay".
   Toast kết quả: có đơn hàng → "✅ Đã xuất file "<tên file>" (X khách, Y
   đơn hàng)!"; không có đơn nào trong khoảng đã chọn → câu báo khác nhưng
   vẫn coi là thành công (không phải lỗi).
   ══════════════════════════════════════════════ */
function buildAndDownloadCustomerWorkbook(customerList, orders) {
  const genderLabel = g => g === "nam" ? "Nam" : g === "nu" ? "Nữ" : g === "khac" ? "Khác" : "—";
  const fmtDate = iso => {
    if (!iso) return "";
    try { return new Date(iso).toLocaleDateString("vi-VN"); } catch { return iso; }
  };
  const fmtDateTime = iso => {
    if (!iso) return "";
    try { return new Date(iso).toLocaleString("vi-VN"); } catch { return iso; }
  };

  /* ── SHEET 1: Khách hàng (tổng hợp) ── */
  const custHeader = [
    "STT", "Tên", "Số điện thoại", "Ngày sinh", "Giới tính",
    "Ngày đăng ký", "Cấp độ", "Hạng", "XP",
    "Tổng chi tiêu (đ)", "Lợi nhuận gộp (đ)", "Streak (ngày)", "Check-in gần nhất",
  ];
  const custRows = customerList.map((c, i) => {
    const info = M.getLevelInfo(c.level);
    return [
      i + 1,
      c.name || "",
      c.phone || "",
      fmtDate(c.date_of_birth),
      genderLabel(c.gender),
      fmtDateTime(c.created_at), // xem ghi chú giả định schema đầu file
      c.level,
      `${info.rank_icon || ""} ${info.rank_name || ""}`.trim(),
      c.xp || 0,
      Math.round(Number(c.total_spent) || 0),
      Math.round(Number(c.total_profit) || 0),
      c.streak_days || 0,
      c.last_checkin_date ? window.formatDateVN(c.last_checkin_date) : "",
    ];
  });

  /* ── SHEET 2: Đơn hàng (tổng hợp theo đơn) ── */
  const orderHeader = [
    "Mã đơn", "Khách hàng", "SĐT", "Thời gian tạo đơn", "Số món (còn hiệu lực)",
    "Tổng khách trả (đ)", "Tổng lợi nhuận gộp (đ)", "Trạng thái", "Lý do huỷ", "Nhân viên tạo đơn",
  ];
  const orderRows = orders.map(o => {
    const items = o.customer_order_items || [];
    const activeItems = items.filter(it => !it.is_void);
    const totalPaid   = activeItems.reduce((s, it) => s + Number(it.customer_paid), 0);
    const totalProfit = activeItems.reduce((s, it) => s + Number(it.profit || 0), 0);
    return [
      o.order_number,
      o.customers?.name  || "",
      o.customers?.phone || "",
      fmtDateTime(o.created_at),
      activeItems.length,
      Math.round(totalPaid),
      Math.round(totalProfit),
      o.status === "voided" ? "Đã huỷ" : "Hoàn tất",
      o.void_reason || "",
      o.staff_name || "",
    ];
  });

  /* ── SHEET 3: Chi tiết sản phẩm (mỗi dòng = 1 sản phẩm trong 1 đơn) ── */
  const lineHeader = [
    "Mã đơn", "Khách hàng", "SĐT", "Thời gian tạo đơn",
    "Sản phẩm", "Số lượng", "Đơn giá", "Giảm giá (%)", "Thành tiền (Khách trả)",
    "Giá vốn NL/đơn vị", "Tổng giá vốn NL", "Lợi nhuận",
    "Trạng thái dòng", "Lý do huỷ dòng", "Trạng thái đơn", "Lý do huỷ đơn", "Nhân viên tạo đơn",
  ];
  const lineRows = [];
  orders.forEach(o => {
    const items = o.customer_order_items || [];
    const custName  = o.customers?.name  || "";
    const custPhone = o.customers?.phone || "";
    const orderStatusLabel = o.status === "voided" ? "Đã huỷ" : "Hoàn tất";

    if (!items.length) {
      lineRows.push([
        o.order_number, custName, custPhone, fmtDateTime(o.created_at),
        "(Không có sản phẩm)", "", "", "", "",
        "", "", "",
        "", "", orderStatusLabel, o.void_reason || "", o.staff_name || "",
      ]);
      return;
    }

    items.forEach(it => {
      lineRows.push([
        o.order_number, custName, custPhone, fmtDateTime(o.created_at),
        it.product_name, it.quantity, Number(it.unit_price), Number(it.discount_pct),
        Number(it.customer_paid),
        Number(it.ingredient_unit_cost || 0),
        Number(it.ingredient_cost_total || 0),
        Number(it.profit || 0),
        it.is_void ? "Đã huỷ" : "Bình thường",
        it.void_reason || "",
        orderStatusLabel,
        o.void_reason || "",
        o.staff_name || "",
      ]);
    });
  });

  const wb = window.XLSX.utils.book_new();

  const wsCust = window.XLSX.utils.aoa_to_sheet([custHeader, ...custRows]);
  wsCust['!cols'] = custHeader.map((_, i) => ({ wch: i === 1 ? 22 : i === 7 ? 18 : 14 }));
  window.XLSX.utils.book_append_sheet(wb, wsCust, "Khách hàng");

  const wsOrders = window.XLSX.utils.aoa_to_sheet([orderHeader, ...orderRows]);
  wsOrders['!cols'] = orderHeader.map((_, i) => ({ wch: i === 0 ? 14 : i === 1 ? 22 : 16 }));
  window.XLSX.utils.book_append_sheet(wb, wsOrders, "Đơn hàng");

  const wsLines = window.XLSX.utils.aoa_to_sheet([lineHeader, ...lineRows]);
  wsLines['!cols'] = lineHeader.map((_, i) => ({ wch: i === 0 ? 14 : i === 4 ? 26 : 16 }));
  window.XLSX.utils.book_append_sheet(wb, wsLines, "Chi tiết sản phẩm");

  const custRangeLabel = (custDateFrom || custDateTo)
    ? `${custDateFrom || "truoc"}_den_${custDateTo || "nay"}`
    : "tat-ca";
  const orderRangeLabel = (custOrderDateFrom || custOrderDateTo)
    ? `_don-${custOrderDateFrom || "truoc"}_den_${custOrderDateTo || "nay"}`
    : "";
  const searchSuffix = custSearchQ ? `_loc-${window.slugify(custSearchQ)}` : "";
  const filename = `khach-hang-chi-tiet_${custRangeLabel}${orderRangeLabel}${searchSuffix}.xlsx`;

  try {
    window.XLSX.writeFile(wb, filename);
    window.showToast(
      orders.length
        ? `✅ Đã xuất file "${filename}" (${customerList.length} khách, ${orders.length} đơn hàng)!`
        : `✅ Đã xuất file "${filename}" — không có đơn hàng nào trong khoảng ngày đã chọn cho ${customerList.length} khách này.`
    );
  } catch (err) {
    window.showToast("❌ Lỗi khi xuất Excel: " + err.message, "#e17055");
  }
}
