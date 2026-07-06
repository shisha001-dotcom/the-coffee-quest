/* ══════════════════════════════════════════════
   DASHBOARD CUSTOMERS MODULE — admin/modules/dashboard-customers.js
   ─────────────────────────────────────────────
   Hệ thống "Coffee Quest": quản lý khách hàng như nhân vật game —
   check-in, XP, cấp độ (rank), nhiệm vụ, lịch sử thanh toán.

   ⚠️ PHÂN QUYỀN (cập nhật mới nhất):
   - CHỈ Super Admin được thấy và thao tác trang này. Editor và
     Bar Staff KHÔNG thấy mục "Khách hàng" trong sidebar và không
     gọi được bất kỳ hàm nào ở đây (chặn cả ở guard đăng ký trang
     lẫn ở tầng từng hàm, phòng trường hợp gọi trực tiếp qua console).
   - Áp dụng đúng pattern như admin/modules/dashboard-accounts.js
     (guard: () => isSuperAdmin).

   ══════════════════════════════════════════════
   ⚠️ SỬA (audit membership — 2026):
   1) BUG NGHIÊM TRỌNG (data integrity): checkinCustomer(),
      addTransaction(), markQuestProgress() trước đây KHÔNG kiểm
      tra lỗi của lệnh insert/update đầu tiên (customer_checkins /
      customer_transactions / customer_quests) — nếu ghi thất bại,
      code vẫn cộng XP / tiền / hoàn thành nhiệm vụ như thành công,
      gây lệch dữ liệu giữa các bảng. Đã bắt lỗi + throw đúng chỗ.
   2) renderCustomerTable(): filter theo tên/SĐT có thể throw nếu
      c.name/c.phone null → vỡ cả bảng khách hàng. Đã thêm guard.
   3) Thanh tiến độ XP (pct) trong openCustomerDetail() có thể ra
      NaN% (chia cho 0 khi 2 cấp có xp_required bằng nhau) hoặc %
      âm nếu dữ liệu khách lệch cấp. Đã guard + clamp 0-100.
   4) Toàn bộ alert()/confirm()/prompt() native → thay bằng
      showToast/showConfirm + lỗi báo ngay tại field. addQuestRow()
      dùng 4 prompt() liên tiếp → thay bằng modal "Nhiệm vụ" dùng
      chung cho thêm/sửa.
   5) addCustomerModal/customerDetailModal/questModal: bổ sung đóng
      bằng Escape + click nền.
   6) Thêm debounce cho ô tìm kiếm khách hàng (200ms).
   7) loadCustomers/loadLevels/loadQuests: hiển thị lỗi rõ ràng
      thay vì chỉ console.error() im lặng.
   8) Chuẩn hoá số điện thoại (bỏ khoảng trắng/dấu gạch, +84 → 0)
      trước khi tạo khách / kiểm tra trùng SĐT.
   9) Khoá nút khi đang xử lý (check-in, giao dịch, tiến độ nhiệm
      vụ, tạo khách) để tránh double-click cộng XP/tiền 2 lần.
   10) saveLevels(): thêm validate (XP không âm, % giảm giá 0-100,
       XP phải tăng dần theo cấp) trước khi lưu.
   11) [MỚI] Giới hạn toàn bộ trang chỉ Super Admin được truy cập
       và thao tác (trước đây mọi role đăng nhập đều vận hành được).

   Cần: client, currentSession, window.AdminPermissions,
   window.escHtml, window.showToast, window.showConfirm (đã load từ trước).
   ══════════════════════════════════════════════ */

const isSuperAdminCust = window.AdminPermissions.isSuperAdmin(currentSession.role);

/* Giữ tên biến cũ để không phải sửa các nơi gọi bên dưới —
   giờ cả 2 đều chỉ true khi là Super Admin. */
const canOperate            = isSuperAdminCust;
const canManageQuestSystem  = isSuperAdminCust;

let allCustomers = [];
let allLevels    = [];
let allQuests    = [];
let custActiveTab = "list";
let custSearchQ    = "";
let openDetailId   = null;

/* Khoá thao tác nhanh (check-in / giao dịch / tiến độ nhiệm vụ / tạo khách)
   để tránh double-click gây cộng XP/tiền 2 lần. */
let _custActionBusy = false;

/* Chuẩn hoá số điện thoại VN: "+84 912 345 678" / "0912-345-678" → "0912345678" */
function normalizeCustPhone(raw) {
  let p = (raw || "").trim().replace(/[\s.\-()]/g, "");
  if (p.startsWith("+84")) p = "0" + p.slice(3);
  else if (p.startsWith("84") && p.length > 9) p = "0" + p.slice(2);
  return p;
}

/* ══════════════════════════════════════════════
   ĐĂNG KÝ MENU + PAGE — CHỈ SUPER ADMIN
   ══════════════════════════════════════════════ */
window.AdminDashboard.registerPage({
  pageId: "customersPage",
  menuId: "customersMenuItem",
  icon: "🎮",
  label: "Khách hàng",
  guard: () => isSuperAdminCust,
  onShow: () => { loadLevels(); loadQuests(); loadCustomers(); },
});

(function injectCustomersPage() {
  if (!isSuperAdminCust) return; /* Editor/Bar Staff: không chèn HTML vào DOM luôn */

  const main = document.querySelector(".main-content");
  if (!main) return;

  const page = document.createElement("div");
  page.id = "customersPage";
  page.style.display = "none";
  page.innerHTML = `
    <div class="page-header">
      <div>
        <h1 class="page-title">🎮 Khách hàng — Coffee Quest</h1>
        <p class="page-subtitle">Quản lý nhân vật, cấp độ, nhiệm vụ &amp; lịch sử thanh toán</p>
      </div>
      <div class="header-actions">
        <button class="btn btn-secondary" onclick="loadCustomers()">🔄 Refresh</button>
        <button class="btn btn-primary" onclick="openAddCustomer()">+ Thêm khách hàng</button>
      </div>
    </div>

    <div style="display:flex;gap:8px;margin-bottom:20px;flex-wrap:wrap;">
      <button class="btn btn-primary cust-tab-btn"   data-tab="list"   onclick="switchCustTab('list')">👥 Danh sách</button>
      <button class="btn btn-secondary cust-tab-btn" data-tab="quests" onclick="switchCustTab('quests')">🗺️ Nhiệm vụ</button>
      <button class="btn btn-secondary cust-tab-btn" data-tab="levels" onclick="switchCustTab('levels')">🏆 Cấp độ</button>
    </div>

    <div id="custTabList">
      <div class="search-bar">
        <input type="text" id="custSearchInput" class="search-input" placeholder="🔍 Tìm theo tên hoặc số điện thoại...">
      </div>
      <div class="table-card">
        <div id="custErrorMsg" class="error-msg hidden" role="alert"></div>
        <table class="game-table">
          <thead><tr>
            <th>Khách hàng</th><th>Cấp độ</th><th>XP</th><th>Đã chi tiêu</th><th>Check-in gần nhất</th><th>Hành động</th>
          </tr></thead>
          <tbody id="custTableBody"><tr><td colspan="6" style="text-align:center;padding:40px;color:var(--text-muted);">⏳ Đang tải...</td></tr></tbody>
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
          <button class="close-btn" aria-label="Đóng cửa sổ" onclick="document.getElementById('addCustomerModal').classList.add('hidden')">✕</button>
        </div>
        <div class="form-grid" style="grid-template-columns:1fr;">
          <div class="form-group"><label for="newCustName">Tên *</label><input type="text" id="newCustName" placeholder="Nguyễn Văn A"></div>
          <div class="form-group"><label for="newCustPhone">Số điện thoại *</label><input type="tel" id="newCustPhone" placeholder="09xxxxxxxx" inputmode="tel"></div>
          <div class="form-group"><label for="newCustAge">Tuổi</label><input type="number" id="newCustAge" placeholder="25" min="0"></div>
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
          <button class="btn btn-primary" onclick="saveNewCustomer()">💾 Tạo khách hàng</button>
        </div>
      </div>
    </div>

    <!-- Modal chi tiết khách -->
    <div class="modal-overlay hidden" id="customerDetailModal" role="dialog" aria-modal="true">
      <div class="modal-box" style="max-width:640px;" id="customerDetailBox"></div>
    </div>

    <!-- Modal thêm/sửa nhiệm vụ -->
    <div class="modal-overlay hidden" id="questModal" role="dialog" aria-modal="true" aria-labelledby="questModalTitle">
      <div class="modal-box" style="max-width:480px;">
        <div class="modal-header">
          <h2 id="questModalTitle">➕ Thêm nhiệm vụ</h2>
          <button class="close-btn" aria-label="Đóng cửa sổ" onclick="closeQuestModal()">✕</button>
        </div>
        <input type="hidden" id="questId">
        <div class="form-grid" style="grid-template-columns:1fr;">
          <div class="form-group"><label for="questTitle">Tên nhiệm vụ *</label><input type="text" id="questTitle" placeholder="Uống 3 ly cà phê trong tuần"></div>
          <div class="form-group"><label for="questDesc">Mô tả</label><input type="text" id="questDesc" placeholder="Mô tả ngắn (tuỳ chọn)"></div>
          <div class="form-group">
            <label for="questType">Loại *</label>
            <select id="questType" style="height:44px;border-radius:10px;border:1px solid var(--border);padding:0 14px;font-size:14px;font-family:'Inter',sans-serif;">
              <option value="daily">Hàng ngày</option>
              <option value="weekly">Hàng tuần</option>
              <option value="onetime">Một lần</option>
            </select>
          </div>
          <div class="form-group"><label for="questXp">XP thưởng *</label><input type="number" id="questXp" min="1" value="10"></div>
          <div class="form-group"><label for="questTarget">Số lần cần hoàn thành *</label><input type="number" id="questTarget" min="1" value="1"></div>
        </div>
        <div class="modal-actions" style="justify-content:flex-end;">
          <button class="btn btn-primary" onclick="saveQuest()">💾 Lưu nhiệm vụ</button>
        </div>
      </div>
    </div>
  `;
  main.appendChild(page);

  const searchInput = document.getElementById("custSearchInput");
  let _custSearchTimer;
  searchInput.addEventListener("input", e => {
    clearTimeout(_custSearchTimer);
    const val = e.target.value;
    _custSearchTimer = setTimeout(() => {
      custSearchQ = val.toLowerCase();
      renderCustomerTable();
    }, 200);
  });

  bindCustomerModalEvents();
})();

/* ══════════════════════════════════════════════
   ĐÓNG MODAL BẰNG ESCAPE / CLICK NỀN
   ══════════════════════════════════════════════ */
function bindCustomerModalEvents() {
  ["addCustomerModal", "customerDetailModal", "questModal"].forEach(id => {
    const modal = document.getElementById(id);
    if (!modal) return;
    modal.addEventListener("click", e => { if (e.target === modal) modal.classList.add("hidden"); });
    modal.addEventListener("keydown", e => { if (e.key === "Escape") modal.classList.add("hidden"); });
  });
}

/* ══════════════════════════════════════════════
   VALIDATE FIELD ERROR (đồng bộ style với các module khác)
   ══════════════════════════════════════════════ */
function clearCustFieldError(id) {
  const el = document.getElementById(id);
  if (!el) return;
  el.style.borderColor = "";
  document.getElementById(id + "Error")?.remove();
}
function showCustFieldError(id, msg) {
  const el = document.getElementById(id);
  if (!el) return;
  el.style.borderColor = "var(--danger)";
  el.focus();
  let err = document.getElementById(id + "Error");
  if (!err) {
    err = document.createElement("div");
    err.id = id + "Error";
    err.setAttribute("role", "alert");
    err.style.cssText = "color:var(--danger);font-size:12px;font-weight:600;margin-top:-6px;";
    el.insertAdjacentElement("afterend", err);
  }
  err.textContent = msg;
  el.addEventListener("input", () => clearCustFieldError(id), { once: true });
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

  if (tab === "quests") renderQuestsTab();
  if (tab === "levels") renderLevelsTab();
}
window.switchCustTab = switchCustTab;

/* ══════════════════════════════════════════════
   HELPERS: LEVEL / XP / PERIOD
   ══════════════════════════════════════════════ */
function getLevelForXp(xp) {
  const sorted = [...allLevels].sort((a, b) => a.level - b.level);
  let lvl = sorted[0]?.level || 1;
  for (const l of sorted) if (xp >= l.xp_required) lvl = l.level;
  return lvl;
}
function getLevelInfo(level) {
  return allLevels.find(l => l.level === level) || { rank_name: "—", rank_icon: "⭐", xp_required: 0 };
}
function getNextLevelInfo(level) {
  return allLevels.find(l => l.level === level + 1) || null;
}
function formatVND(n) {
  return Number(n || 0).toLocaleString("vi-VN") + " đ";
}
function getISOWeek(d) {
  d = new Date(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()));
  const dayNum = d.getUTCDay() || 7;
  d.setUTCDate(d.getUTCDate() + 4 - dayNum);
  const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1));
  const weekNo = Math.ceil((((d - yearStart) / 86400000) + 1) / 7);
  return `${d.getUTCFullYear()}-W${String(weekNo).padStart(2, "0")}`;
}
function periodKeyFor(type) {
  if (type === "daily")  return new Date().toISOString().slice(0, 10);
  if (type === "weekly") return getISOWeek(new Date());
  return "once";
}

/* ══════════════════════════════════════════════
   LOAD DATA
   ══════════════════════════════════════════════ */
async function loadCustomers() {
  if (!isSuperAdminCust) return;

  const tbody    = document.getElementById("custTableBody");
  const errorEl  = document.getElementById("custErrorMsg");
  errorEl?.classList.add("hidden");

  const { data, error } = await client.from("customers").select("*").order("xp", { ascending: false });
  if (error) {
    console.error(error);
    if (errorEl) { errorEl.textContent = "❌ Lỗi khi tải danh sách khách hàng: " + error.message; errorEl.classList.remove("hidden"); }
    if (tbody) tbody.innerHTML = `<tr><td colspan="6" style="text-align:center;padding:40px;color:var(--danger);">Không tải được dữ liệu.</td></tr>`;
    return;
  }
  allCustomers = data || [];
  renderCustomerTable();
}
async function loadLevels() {
  if (!isSuperAdminCust) return;
  const { data, error } = await client.from("membership_levels").select("*").order("level", { ascending: true });
  if (error) { console.error(error); window.showToast("❌ Lỗi tải cấu hình cấp độ: " + error.message, "#e17055"); return; }
  allLevels = data || [];
}
async function loadQuests() {
  if (!isSuperAdminCust) return;
  const { data, error } = await client.from("quests").select("*").order("id", { ascending: true });
  if (error) { console.error(error); window.showToast("❌ Lỗi tải danh sách nhiệm vụ: " + error.message, "#e17055"); return; }
  allQuests = data || [];
}
window.loadCustomers = loadCustomers;

/* ══════════════════════════════════════════════
   RENDER: BẢNG KHÁCH HÀNG
   ══════════════════════════════════════════════ */
function renderCustomerTable() {
  const tbody = document.getElementById("custTableBody");
  if (!tbody) return;

  const list = allCustomers.filter(c => {
    if (!custSearchQ) return true;
    const name  = (c.name  || "").toLowerCase();
    const phone = c.phone || "";
    return name.includes(custSearchQ) || phone.includes(custSearchQ);
  });

  if (!list.length) {
    tbody.innerHTML = `<tr><td colspan="6" style="text-align:center;padding:40px;color:var(--text-muted);">${allCustomers.length ? "Không tìm thấy khách hàng phù hợp." : "Chưa có khách hàng nào."}</td></tr>`;
    return;
  }

  tbody.innerHTML = list.map(c => {
    const info = getLevelInfo(c.level);
    return `<tr>
      <td>
        <div class="game-name">${window.escHtml(c.name || "(chưa có tên)")}</div>
        <div class="game-id">📞 ${window.escHtml(c.phone || "—")}</div>
      </td>
      <td><span class="badge">${info.rank_icon} ${window.escHtml(info.rank_name)}</span></td>
      <td style="font-weight:700;color:var(--primary);">${c.xp} XP</td>
      <td>${formatVND(c.total_spent)}</td>
      <td>${c.last_checkin || "—"}${c.streak_days ? ` <span style="color:#e17055;font-size:12px;">🔥${c.streak_days}</span>` : ""}</td>
      <td><button class="btn btn-primary" onclick="openCustomerDetail(${c.id})">🔍 Chi tiết</button></td>
    </tr>`;
  }).join("");
}

/* ══════════════════════════════════════════════
   THÊM KHÁCH HÀNG MỚI
   ══════════════════════════════════════════════ */
function openAddCustomer() {
  if (!isSuperAdminCust) return;
  ["newCustName", "newCustPhone", "newCustAge"].forEach(id => document.getElementById(id).value = "");
  document.getElementById("newCustGender").value = "";
  clearCustFieldError("newCustName");
  clearCustFieldError("newCustPhone");
  document.getElementById("addCustomerModal").classList.remove("hidden");
  document.getElementById("newCustName").focus();
}
window.openAddCustomer = openAddCustomer;

async function saveNewCustomer() {
  if (!isSuperAdminCust || _custActionBusy) return;

  const nameInput  = document.getElementById("newCustName");
  const phoneInput = document.getElementById("newCustPhone");
  const name  = nameInput.value.trim();
  const phone = normalizeCustPhone(phoneInput.value);
  const age   = Number(document.getElementById("newCustAge").value) || null;
  const gender = document.getElementById("newCustGender").value || null;

  clearCustFieldError("newCustName");
  clearCustFieldError("newCustPhone");

  if (!name) { showCustFieldError("newCustName", "Vui lòng nhập tên."); return; }
  if (!phone || !/^0\d{9,10}$/.test(phone)) {
    showCustFieldError("newCustPhone", "Số điện thoại không hợp lệ (VD: 0912345678).");
    return;
  }

  const btn = document.querySelector("#addCustomerModal .btn-primary");
  _custActionBusy = true;
  if (btn) { btn.disabled = true; btn.textContent = "Đang tạo..."; }

  try {
    const { data: existing, error: checkErr } = await client
      .from("customers").select("id").eq("phone", phone).maybeSingle();
    if (checkErr) throw checkErr;
    if (existing) { showCustFieldError("newCustPhone", "Số điện thoại này đã tồn tại trong hệ thống."); return; }

    const { data, error } = await client.from("customers")
      .insert({ name, phone, age, gender }).select().single();
    if (error) throw error;

    document.getElementById("addCustomerModal").classList.add("hidden");
    window.showToast("✅ Đã tạo khách hàng mới!");
    await loadCustomers();
    openCustomerDetail(data.id);
  } catch (err) {
    window.showToast("❌ Lỗi: " + err.message, "#e17055");
  } finally {
    _custActionBusy = false;
    if (btn) { btn.disabled = false; btn.textContent = "💾 Tạo khách hàng"; }
  }
}
window.saveNewCustomer = saveNewCustomer;

/* ══════════════════════════════════════════════
   CHI TIẾT KHÁCH HÀNG (modal)
   ══════════════════════════════════════════════ */
async function openCustomerDetail(id) {
  if (!isSuperAdminCust) return;

  openDetailId = id;
  const cust = allCustomers.find(c => c.id === id);
  if (!cust) return;

  const { data: txs }   = await client.from("customer_transactions").select("*").eq("customer_id", id).order("created_at", { ascending: false }).limit(5);
  const { data: cqRows } = await client.from("customer_quests").select("*").eq("customer_id", id);

  const info      = getLevelInfo(cust.level);
  const nextInfo  = getNextLevelInfo(cust.level);

  let pct = 100;
  if (nextInfo && nextInfo.xp_required > info.xp_required) {
    pct = Math.max(0, Math.min(100, Math.round((cust.xp - info.xp_required) / (nextInfo.xp_required - info.xp_required) * 100)));
  }

  const today     = new Date().toISOString().slice(0, 10);
  const checkedInToday = cust.last_checkin === today;

  const perkChips = [
    info.discount_pct > 0 ? `<span class="badge">💸 Giảm ${info.discount_pct}%</span>` : "",
    info.free_item        ? `<span class="badge">🎁 ${window.escHtml(info.free_item)}</span>` : "",
    info.priority_booking  ? `<span class="badge">⭐ Ưu tiên đặt bàn/slot game</span>` : "",
  ].filter(Boolean).join(" ") || `<span style="color:var(--text-muted);font-size:13px;">Chưa có ưu đãi ở cấp này</span>`;

  const activeQuests = allQuests.filter(q => q.active).map(q => {
    const pk  = periodKeyFor(q.type);
    const row = (cqRows || []).find(r => r.quest_id === q.id && r.period_key === pk);
    const progress = row?.progress || 0;
    const done = row?.completed || false;
    return `
      <div style="display:flex;align-items:center;justify-content:space-between;gap:10px;padding:10px 14px;border:1px solid var(--border);border-radius:10px;margin-bottom:8px;${done ? 'background:#e8f8f0;' : ''}">
        <div>
          <div style="font-weight:700;font-size:13px;">${done ? "✅" : "▫️"} ${window.escHtml(q.title)}</div>
          <div style="font-size:11px;color:var(--text-muted);">${q.type === 'daily' ? 'Hàng ngày' : q.type === 'weekly' ? 'Hàng tuần' : 'Một lần'} · +${q.xp_reward} XP · ${progress}/${q.target_count}</div>
        </div>
        <button class="btn btn-secondary" style="font-size:12px;padding:6px 12px;" ${done ? 'disabled' : ''} onclick="markQuestProgress(${id},${q.id})">${done ? 'Đã xong' : '+1 tiến độ'}</button>
      </div>`;
  }).join("");

  const txRows = (txs || []).map(t => `
    <tr><td>${new Date(t.created_at).toLocaleDateString('vi-VN')}</td><td>${formatVND(t.amount)}</td><td>${window.escHtml(t.note || '—')}</td></tr>
  `).join("") || `<tr><td colspan="3" style="text-align:center;color:var(--text-muted);padding:14px;">Chưa có giao dịch nào</td></tr>`;

  document.getElementById("customerDetailBox").innerHTML = `
    <div class="modal-header">
      <h2>${info.rank_icon} ${window.escHtml(cust.name)}</h2>
      <button class="close-btn" aria-label="Đóng cửa sổ" onclick="document.getElementById('customerDetailModal').classList.add('hidden')">✕</button>
    </div>

    <div style="font-size:13px;color:var(--text-muted);margin-bottom:16px;">📞 ${window.escHtml(cust.phone)} ${cust.age ? '· ' + cust.age + ' tuổi' : ''} ${cust.gender ? '· ' + window.escHtml(cust.gender) : ''}</div>

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

    <div style="display:flex;gap:10px;margin-bottom:18px;flex-wrap:wrap;">
      <button class="btn ${checkedInToday ? 'btn-secondary' : 'btn-primary'}" ${checkedInToday ? 'disabled' : ''} onclick="checkinCustomer(${id})">
        ${checkedInToday ? '✅ Đã check-in hôm nay' : '✅ Check-in hôm nay'}
      </button>
      <div style="font-size:12px;color:var(--text-muted);align-self:center;">🔥 Streak: ${cust.streak_days || 0} ngày · Tổng chi tiêu: <b>${formatVND(cust.total_spent)}</b></div>
    </div>

    <div style="display:flex;gap:8px;margin-bottom:20px;">
      <input type="number" id="txAmountInput" placeholder="Số tiền (đ)" min="0" style="flex:1;height:40px;border:1px solid var(--border);border-radius:8px;padding:0 12px;">
      <input type="text" id="txNoteInput" placeholder="Ghi chú (vd: 2 cà phê sữa)" style="flex:2;height:40px;border:1px solid var(--border);border-radius:8px;padding:0 12px;">
      <button class="btn btn-primary" onclick="addTransaction(${id})">💰 Ghi nhận</button>
    </div>

    <div style="font-size:13px;font-weight:700;margin-bottom:8px;">🗺️ Nhiệm vụ đang diễn ra</div>
    ${activeQuests || '<div style="color:var(--text-muted);font-size:13px;">Chưa có nhiệm vụ nào đang mở.</div>'}

    <div style="font-size:13px;font-weight:700;margin:18px 0 8px;">💰 Giao dịch gần nhất</div>
    <table class="game-table"><thead><tr><th>Ngày</th><th>Số tiền</th><th>Ghi chú</th></tr></thead><tbody>${txRows}</tbody></table>

    <div class="modal-actions">
      <button class="btn btn-danger" onclick="deleteCustomer(${id})">🗑️ Xoá khách hàng</button>
    </div>
  `;

  document.getElementById("customerDetailModal").classList.remove("hidden");
}
window.openCustomerDetail = openCustomerDetail;

/* ══════════════════════════════════════════════
   CHECK-IN
   ══════════════════════════════════════════════ */
async function checkinCustomer(id) {
  if (!isSuperAdminCust || _custActionBusy) return;
  const cust = allCustomers.find(c => c.id === id);
  if (!cust) return;

  const today = new Date().toISOString().slice(0, 10);
  if (cust.last_checkin === today) { window.showToast("Khách đã check-in hôm nay rồi.", "#e17055"); return; }

  let newStreak = 1;
  if (cust.last_checkin) {
    const diffDays = Math.round((new Date(today) - new Date(cust.last_checkin)) / 86400000);
    newStreak = diffDays === 1 ? (cust.streak_days || 0) + 1 : 1;
  }
  const bonus     = newStreak % 7 === 0 ? 20 : 0;
  const xpEarned  = 10 + bonus;
  const newXp     = cust.xp + xpEarned;
  const newLevel  = getLevelForXp(newXp);

  _custActionBusy = true;
  try {
    const { error: ckErr } = await client.from("customer_checkins").insert({ customer_id: id, xp_earned: xpEarned });
    if (ckErr) throw ckErr;

    const { error } = await client.from("customers")
      .update({ xp: newXp, level: newLevel, streak_days: newStreak, last_checkin: today })
      .eq("id", id);
    if (error) throw error;

    window.showToast(`✅ Check-in! +${xpEarned} XP (streak ${newStreak} ngày)` + (bonus ? ` 🔥 +${bonus} XP thưởng chuỗi 7 ngày!` : ""));
    await loadCustomers();
    openCustomerDetail(id);
  } catch (err) {
    window.showToast("❌ Lỗi: " + err.message, "#e17055");
  } finally {
    _custActionBusy = false;
  }
}
window.checkinCustomer = checkinCustomer;

/* ══════════════════════════════════════════════
   GHI NHẬN GIAO DỊCH
   ══════════════════════════════════════════════ */
async function addTransaction(id) {
  if (!isSuperAdminCust || _custActionBusy) return;
  const amountInput = document.getElementById("txAmountInput");
  const noteInput    = document.getElementById("txNoteInput");
  const amount = Number(amountInput.value);
  if (!amount || amount <= 0 || !Number.isFinite(amount)) {
    window.showToast("⚠️ Vui lòng nhập số tiền hợp lệ.", "#e17055");
    amountInput.focus();
    return;
  }
  const note = noteInput.value.trim();

  _custActionBusy = true;
  try {
    const cust = allCustomers.find(c => c.id === id);

    const { error: txErr } = await client.from("customer_transactions").insert({
      customer_id: id, amount, note,
      staff_name: currentSession.displayName || currentSession.username,
    });
    if (txErr) throw txErr;

    const { error } = await client.from("customers")
      .update({ total_spent: (cust.total_spent || 0) + amount }).eq("id", id);
    if (error) throw error;

    window.showToast("💰 Đã ghi nhận giao dịch!");
    await loadCustomers();
    openCustomerDetail(id);
  } catch (err) {
    window.showToast("❌ Lỗi: " + err.message, "#e17055");
  } finally {
    _custActionBusy = false;
  }
}
window.addTransaction = addTransaction;

/* ══════════════════════════════════════════════
   NHIỆM VỤ — CẬP NHẬT TIẾN ĐỘ
   ══════════════════════════════════════════════ */
async function markQuestProgress(customerId, questId) {
  if (!isSuperAdminCust || _custActionBusy) return;
  const quest = allQuests.find(q => q.id === questId);
  const cust  = allCustomers.find(c => c.id === customerId);
  if (!quest || !cust) return;

  const pk = periodKeyFor(quest.type);
  _custActionBusy = true;

  try {
    const { data: existing } = await client.from("customer_quests")
      .select("*").eq("customer_id", customerId).eq("quest_id", questId).eq("period_key", pk).maybeSingle();

    if (existing?.completed) { window.showToast("Nhiệm vụ này đã hoàn thành trong kỳ hiện tại rồi.", "#e17055"); return; }

    const newProgress = (existing?.progress || 0) + 1;
    const isDone = newProgress >= quest.target_count;

    if (existing) {
      const { error: upErr } = await client.from("customer_quests").update({
        progress: newProgress, completed: isDone, completed_at: isDone ? new Date().toISOString() : null,
      }).eq("id", existing.id);
      if (upErr) throw upErr;
    } else {
      const { error: insErr } = await client.from("customer_quests").insert({
        customer_id: customerId, quest_id: questId, period_key: pk,
        progress: newProgress, completed: isDone, completed_at: isDone ? new Date().toISOString() : null,
      });
      if (insErr) throw insErr;
    }

    if (isDone) {
      const newXp    = cust.xp + quest.xp_reward;
      const newLevel = getLevelForXp(newXp);
      const { error: xpErr } = await client.from("customers").update({ xp: newXp, level: newLevel }).eq("id", customerId);
      if (xpErr) throw xpErr;
      window.showToast(`🎉 Hoàn thành "${quest.title}"! +${quest.xp_reward} XP`);
    } else {
      window.showToast(`Tiến độ: ${newProgress}/${quest.target_count}`);
    }

    await loadCustomers();
    openCustomerDetail(customerId);
  } catch (err) {
    window.showToast("❌ Lỗi: " + err.message, "#e17055");
  } finally {
    _custActionBusy = false;
  }
}
window.markQuestProgress = markQuestProgress;

/* ══════════════════════════════════════════════
   XOÁ KHÁCH HÀNG
   ══════════════════════════════════════════════ */
async function deleteCustomer(id) {
  if (!isSuperAdminCust) return;
  const cust = allCustomers.find(c => c.id === id);

  const ok = await window.showConfirm({
    title: `Xoá khách hàng "${cust?.name || ''}"?`,
    message: "Toàn bộ lịch sử check-in, giao dịch và tiến độ nhiệm vụ liên quan cũng sẽ bị xoá. Hành động này không thể hoàn tác.",
    confirmText: "🗑️ Xoá",
    cancelText: "Huỷ",
    danger: true,
  });
  if (!ok) return;

  try {
    const { error } = await client.from("customers").delete().eq("id", id);
    if (error) throw error;
    document.getElementById("customerDetailModal").classList.add("hidden");
    window.showToast("🗑️ Đã xoá khách hàng", "#e17055");
    await loadCustomers();
  } catch (err) {
    window.showToast("❌ Lỗi: " + err.message, "#e17055");
  }
}
window.deleteCustomer = deleteCustomer;

/* ══════════════════════════════════════════════
   TAB: CẤU HÌNH NHIỆM VỤ
   ══════════════════════════════════════════════ */
function renderQuestsTab() {
  const wrap = document.getElementById("custTabQuests");
  const typeLabel = t => t === "daily" ? "Hàng ngày" : t === "weekly" ? "Hàng tuần" : "Một lần";

  wrap.innerHTML = `
    <div class="table-card" style="padding:20px 24px;">
      <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:16px;">
        <div style="font-size:14px;font-weight:700;">Danh sách nhiệm vụ</div>
        <button class="btn btn-primary" onclick="openQuestModal(null)">+ Thêm nhiệm vụ</button>
      </div>
      <table class="game-table">
        <thead><tr><th>Tên</th><th>Loại</th><th>XP</th><th>Mục tiêu</th><th>Trạng thái</th><th>Hành động</th></tr></thead>
        <tbody>
          ${allQuests.length ? allQuests.map(q => `
            <tr>
              <td><b>${window.escHtml(q.title)}</b><div style="font-size:11px;color:var(--text-muted);">${window.escHtml(q.description || "")}</div></td>
              <td>${typeLabel(q.type)}</td>
              <td>${q.xp_reward} XP</td>
              <td>${q.target_count}</td>
              <td>${q.active ? '<span class="badge">Đang mở</span>' : '<span class="badge" style="background:#f1f5f9;color:#888;">Tắt</span>'}</td>
              <td style="display:flex;gap:6px;flex-wrap:wrap;">
                <button class="btn btn-secondary" style="font-size:12px;padding:6px 10px;" onclick="editQuestRow(${q.id})">✏️ Sửa</button>
                <button class="btn btn-secondary" style="font-size:12px;padding:6px 10px;" onclick="toggleQuestActive(${q.id})">${q.active ? "Tắt" : "Bật"}</button>
                <button class="btn btn-danger" style="font-size:12px;padding:6px 10px;" onclick="deleteQuest(${q.id})">🗑️</button>
              </td>
            </tr>
          `).join("") : `<tr><td colspan="6" style="text-align:center;padding:30px;color:var(--text-muted);">Chưa có nhiệm vụ nào.</td></tr>`}
        </tbody>
      </table>
    </div>
  `;
}

async function toggleQuestActive(id) {
  if (!isSuperAdminCust) return;
  const q = allQuests.find(x => x.id === id);
  if (!q) return;
  try {
    const { error } = await client.from("quests").update({ active: !q.active }).eq("id", id);
    if (error) throw error;
    await loadQuests();
    renderQuestsTab();
  } catch (err) {
    window.showToast("❌ Lỗi: " + err.message, "#e17055");
  }
}
window.toggleQuestActive = toggleQuestActive;

async function deleteQuest(id) {
  if (!isSuperAdminCust) return;
  const ok = await window.showConfirm({
    title: "Xoá nhiệm vụ này?",
    message: "Tiến độ khách hàng liên quan đến nhiệm vụ này cũng sẽ bị xoá. Hành động không thể hoàn tác.",
    confirmText: "🗑️ Xoá",
    cancelText: "Huỷ",
    danger: true,
  });
  if (!ok) return;
  try {
    const { error } = await client.from("quests").delete().eq("id", id);
    if (error) throw error;
    window.showToast("🗑️ Đã xoá nhiệm vụ", "#e17055");
    await loadQuests();
    renderQuestsTab();
  } catch (err) {
    window.showToast("❌ Lỗi: " + err.message, "#e17055");
  }
}
window.deleteQuest = deleteQuest;

/* ══════════════════════════════════════════════
   MODAL NHIỆM VỤ
   ══════════════════════════════════════════════ */
function openQuestModal(id) {
  if (!isSuperAdminCust) return;
  const q = id ? allQuests.find(x => x.id === id) : null;

  document.getElementById("questId").value    = q ? q.id : "";
  document.getElementById("questTitle").value = q?.title || "";
  document.getElementById("questDesc").value  = q?.description || "";
  document.getElementById("questType").value  = q?.type || "daily";
  document.getElementById("questXp").value    = q?.xp_reward ?? 10;
  document.getElementById("questTarget").value = q?.target_count ?? 1;
  document.getElementById("questModalTitle").textContent = q ? "✏️ Sửa nhiệm vụ" : "➕ Thêm nhiệm vụ";
  clearCustFieldError("questTitle");

  document.getElementById("questModal").classList.remove("hidden");
  document.getElementById("questTitle").focus();
}
function closeQuestModal() {
  document.getElementById("questModal").classList.add("hidden");
}
async function saveQuest() {
  if (!isSuperAdminCust) return;

  const rawId = document.getElementById("questId").value;
  const id    = rawId ? Number(rawId) : null;
  const title = document.getElementById("questTitle").value.trim();
  const description = document.getElementById("questDesc").value.trim();
  const type  = document.getElementById("questType").value;
  const xp_reward     = Number(document.getElementById("questXp").value);
  const target_count  = Number(document.getElementById("questTarget").value);

  clearCustFieldError("questTitle");
  if (!title) { showCustFieldError("questTitle", "Vui lòng nhập tên nhiệm vụ."); return; }
  if (!xp_reward || xp_reward <= 0)       { window.showToast("⚠️ XP thưởng phải lớn hơn 0.", "#e17055"); return; }
  if (!target_count || target_count <= 0) { window.showToast("⚠️ Số lần hoàn thành phải lớn hơn 0.", "#e17055"); return; }

  const payload = { title, description: description || null, type, xp_reward, target_count };

  try {
    if (id) {
      const { error } = await client.from("quests").update(payload).eq("id", id);
      if (error) throw error;
    } else {
      const { error } = await client.from("quests").insert({ ...payload, active: true });
      if (error) throw error;
    }
    closeQuestModal();
    window.showToast("✅ Đã lưu nhiệm vụ!");
    await loadQuests();
    renderQuestsTab();
  } catch (err) {
    window.showToast("❌ Lỗi: " + err.message, "#e17055");
  }
}
window.openQuestModal = openQuestModal;
window.closeQuestModal = closeQuestModal;
window.saveQuest = saveQuest;
window.editQuestRow = id => openQuestModal(id);
window.addQuestRow  = () => openQuestModal(null);

/* ══════════════════════════════════════════════
   TAB: CẤU HÌNH CẤP ĐỘ
   ══════════════════════════════════════════════ */
function renderLevelsTab() {
  const wrap = document.getElementById("custTabLevels");

  wrap.innerHTML = `
    <div class="table-card" style="padding:20px 24px;">
      <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:16px;">
        <div style="font-size:14px;font-weight:700;">Cấu hình cấp độ &amp; ưu đãi</div>
        <button class="btn btn-primary" onclick="saveLevels()">💾 Lưu tất cả</button>
      </div>
      <table class="game-table">
        <thead><tr><th>Cấp</th><th>XP tối thiểu</th><th>Tên rank</th><th>Icon</th><th>Giảm giá %</th><th>Quà tặng</th><th>Ưu tiên đặt bàn</th></tr></thead>
        <tbody>
          ${allLevels.map(l => `
            <tr data-level="${l.level}">
              <td><b>${l.level}</b></td>
              <td><input type="number" class="lv-xp" value="${l.xp_required}" min="0" style="width:90px;height:34px;border:1px solid var(--border);border-radius:6px;padding:0 8px;"></td>
              <td><input type="text" class="lv-name" value="${window.escHtml(l.rank_name)}" style="width:120px;height:34px;border:1px solid var(--border);border-radius:6px;padding:0 8px;"></td>
              <td><input type="text" class="lv-icon" value="${l.rank_icon || ''}" style="width:50px;height:34px;border:1px solid var(--border);border-radius:6px;padding:0 8px;text-align:center;"></td>
              <td><input type="number" class="lv-discount" value="${l.discount_pct}" min="0" max="100" style="width:70px;height:34px;border:1px solid var(--border);border-radius:6px;padding:0 8px;"></td>
              <td><input type="text" class="lv-freeitem" value="${window.escHtml(l.free_item || '')}" style="width:160px;height:34px;border:1px solid var(--border);border-radius:6px;padding:0 8px;"></td>
              <td style="text-align:center;"><input type="checkbox" class="lv-priority" ${l.priority_booking ? "checked" : ""} style="width:18px;height:18px;"></td>
            </tr>
          `).join("")}
        </tbody>
      </table>
      <div style="font-size:12px;color:var(--text-muted);margin-top:10px;">Sửa giá trị trong bảng rồi bấm "💾 Lưu tất cả" ở trên để áp dụng.</div>
    </div>
  `;
}

async function saveLevels() {
  if (!isSuperAdminCust) return;
  const rows = [...document.querySelectorAll("#custTabLevels tbody tr")].map(tr => ({
    level: Number(tr.dataset.level),
    xp_required: Number(tr.querySelector(".lv-xp").value) || 0,
    rank_name: tr.querySelector(".lv-name").value.trim(),
    rank_icon: tr.querySelector(".lv-icon").value.trim() || "⭐",
    discount_pct: Number(tr.querySelector(".lv-discount").value) || 0,
    free_item: tr.querySelector(".lv-freeitem").value.trim() || null,
    priority_booking: tr.querySelector(".lv-priority").checked,
  }));

  for (const r of rows) {
    if (!r.rank_name) { window.showToast(`⚠️ Cấp ${r.level}: vui lòng nhập tên rank.`, "#e17055"); return; }
    if (r.xp_required < 0) { window.showToast(`⚠️ Cấp ${r.level}: XP tối thiểu không được âm.`, "#e17055"); return; }
    if (r.discount_pct < 0 || r.discount_pct > 100) { window.showToast(`⚠️ Cấp ${r.level}: % giảm giá phải từ 0 đến 100.`, "#e17055"); return; }
  }
  const sortedByLevel = [...rows].sort((a, b) => a.level - b.level);
  for (let i = 1; i < sortedByLevel.length; i++) {
    if (sortedByLevel[i].xp_required <= sortedByLevel[i - 1].xp_required) {
      window.showToast(`⚠️ XP tối thiểu phải tăng dần theo cấp (lỗi tại cấp ${sortedByLevel[i].level}).`, "#e17055");
      return;
    }
  }

  try {
    const { error } = await client.from("membership_levels").upsert(rows, { onConflict: "level" });
    if (error) throw error;
    window.showToast("✅ Đã lưu cấu hình cấp độ!");
    await loadLevels();
    await loadCustomers();
  } catch (err) {
    window.showToast("❌ Lỗi: " + err.message, "#e17055");
  }
}
window.saveLevels = saveLevels;
