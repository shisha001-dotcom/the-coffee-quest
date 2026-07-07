/* ══════════════════════════════════════════════
   DASHBOARD CUSTOMERS — admin/modules/membership/dashboard-customers.js
   ─────────────────────────────────────────────
   ĐÃ TÁCH khỏi file dashboard-customers.js cũ (~700 dòng, gộp 3 domain).
   File này giờ CHỈ lo: bảng khách hàng, check-in, giao dịch, modal
   chi tiết khách hàng, thêm khách hàng mới.

   Tab "Nhiệm vụ" → admin/modules/membership/dashboard-quests.js
   Tab "Cấp độ"   → admin/modules/membership/dashboard-levels.js

   Đây là file DUY NHẤT gọi registerPage() cho domain Membership
   (pageId "customersPage") — 2 file kia chỉ render nội dung vào các
   div tab đã có sẵn trong page này (#custTabQuests / #custTabLevels),
   không tự đăng ký page riêng.

   Cần: client, currentSession, window.AdminPermissions,
   window.Membership (membership-shared.js — PHẢI load trước file này),
   window.escHtml, window.showToast, window.showConfirm.
   ══════════════════════════════════════════════ */

const M = window.Membership;
const isSuperAdminCust = M.isSuperAdmin;

let custActiveTab = "list";
let custSearchQ   = "";
let _custActionBusy = false; /* khoá double-click check-in/giao dịch */

/* ══════════════════════════════════════════════
   ĐĂNG KÝ MENU + PAGE — CHỈ SUPER ADMIN
   (nơi DUY NHẤT của cả domain Membership gọi registerPage)
   ══════════════════════════════════════════════ */
window.AdminDashboard.registerPage({
  pageId: "customersPage",
  menuId: "customersMenuItem",
  icon: "🎮",
  label: "Khách hàng",
  guard: () => isSuperAdminCust,
  onShow: () => { M.loadLevels().then(renderIfLevelsTabActive); M.loadQuests().then(renderIfQuestsTabActive); loadCustomers(); },
});

/* Cầu nối gọi sang 2 module con nếu tab đó đang mở lúc registerPage onShow chạy
   (tránh phải import trực tiếp — 2 file kia tự expose ra window) */
function renderIfLevelsTabActive()  { if (custActiveTab === "levels" && window.renderLevelsTab)  window.renderLevelsTab(); }
function renderIfQuestsTabActive()  { if (custActiveTab === "quests" && window.renderQuestsTab)  window.renderQuestsTab(); }

/* ══════════════════════════════════════════════
   INJECT PAGE HTML — khung chung + 3 vùng tab
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
        <p class="page-subtitle">Quản lý nhân vật, cấp độ, nhiệm vụ &amp; lịch sử thanh toán</p>
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
            <th>Khách hàng</th><th>Cấp độ</th><th>XP</th><th>Đã chi tiêu</th><th>Check-in gần nhất</th><th>Hành động</th>
          </tr></thead>
          <tbody id="custTableBody"><tr><td colspan="6" style="text-align:center;padding:40px;color:var(--text-muted);">⏳ Đang tải...</td></tr></tbody>
        </table>
      </div>
    </div>

    <!-- Nội dung 2 vùng dưới do dashboard-quests.js / dashboard-levels.js tự render -->
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
          <button class="btn btn-primary" id="saveNewCustomerBtn">💾 Tạo khách hàng</button>
        </div>
      </div>
    </div>

    <!-- Modal chi tiết khách -->
    <div class="modal-overlay hidden" id="customerDetailModal" role="dialog" aria-modal="true">
      <div class="modal-box" style="max-width:640px;" id="customerDetailBox"></div>
    </div>
  `;
  main.appendChild(page);

  bindTabButtons();
  bindTopLevelEvents();

  const searchInput = document.getElementById("custSearchInput");
  let _t;
  searchInput.addEventListener("input", e => {
    clearTimeout(_t);
    const val = e.target.value;
    _t = setTimeout(() => { custSearchQ = val.toLowerCase(); renderCustomerTable(); }, 200);
  });

  ["addCustomerModal", "customerDetailModal"].forEach(id => {
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
    if (tbody) tbody.innerHTML = `<tr><td colspan="6" style="text-align:center;padding:40px;color:var(--danger);">Không tải được dữ liệu.</td></tr>`;
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
    tbody.innerHTML = `<tr><td colspan="6" style="text-align:center;padding:40px;color:var(--text-muted);">${M.state.customers.length ? "Không tìm thấy khách hàng phù hợp." : "Chưa có khách hàng nào."}</td></tr>`;
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
      <td>${c.last_checkin || "—"}${c.streak_days ? ` <span style="color:#e17055;font-size:12px;">🔥${c.streak_days}</span>` : ""}</td>
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
  ["newCustName", "newCustPhone", "newCustAge"].forEach(id => document.getElementById(id).value = "");
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
  const age   = Number(document.getElementById("newCustAge").value) || null;
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
      .from("customers").select("id").eq("phone", phone).maybeSingle();
    if (checkErr) throw checkErr;
    if (existing) { M.showFieldError("newCustPhone", "Số điện thoại này đã tồn tại trong hệ thống."); return; }

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

  const { data: txs }   = await client.from("customer_transactions").select("*").eq("customer_id", id).order("created_at", { ascending: false }).limit(5);
  const { data: cqRows } = await client.from("customer_quests").select("*").eq("customer_id", id);

  const info     = M.getLevelInfo(cust.level);
  const nextInfo = M.getNextLevelInfo(cust.level);

  let pct = 100;
  if (nextInfo && nextInfo.xp_required > info.xp_required) {
    pct = Math.max(0, Math.min(100, Math.round((cust.xp - info.xp_required) / (nextInfo.xp_required - info.xp_required) * 100)));
  }

  const today = new Date().toISOString().slice(0, 10);
  const checkedInToday = cust.last_checkin === today;

  const perkChips = [
    info.discount_pct > 0 ? `<span class="badge">💸 Giảm ${info.discount_pct}%</span>` : "",
    info.free_item        ? `<span class="badge">🎁 ${window.escHtml(info.free_item)}</span>` : "",
    info.priority_booking  ? `<span class="badge">⭐ Ưu tiên đặt bàn/slot game</span>` : "",
  ].filter(Boolean).join(" ") || `<span style="color:var(--text-muted);font-size:13px;">Chưa có ưu đãi ở cấp này</span>`;

  const activeQuests = M.state.quests.filter(q => q.active).map(q => {
    const pk  = M.periodKeyFor(q.type);
    const row = (cqRows || []).find(r => r.quest_id === q.id && r.period_key === pk);
    const progress = row?.progress || 0;
    const done = row?.completed || false;
    return `
      <div style="display:flex;align-items:center;justify-content:space-between;gap:10px;padding:10px 14px;border:1px solid var(--border);border-radius:10px;margin-bottom:8px;${done ? 'background:#e8f8f0;' : ''}">
        <div>
          <div style="font-weight:700;font-size:13px;">${done ? "✅" : "▫️"} ${window.escHtml(q.title)}</div>
          <div style="font-size:11px;color:var(--text-muted);">${q.type === 'daily' ? 'Hàng ngày' : q.type === 'weekly' ? 'Hàng tuần' : 'Một lần'} · +${q.xp_reward} XP · ${progress}/${q.target_count}</div>
        </div>
        <button class="btn btn-secondary" style="font-size:12px;padding:6px 12px;" ${done ? 'disabled' : ''} data-quest-progress="${id}|${q.id}">${done ? 'Đã xong' : '+1 tiến độ'}</button>
      </div>`;
  }).join("");

  const txRows = (txs || []).map(t => `
    <tr><td>${new Date(t.created_at).toLocaleDateString('vi-VN')}</td><td>${M.formatVND(t.amount)}</td><td>${window.escHtml(t.note || '—')}</td></tr>
  `).join("") || `<tr><td colspan="3" style="text-align:center;color:var(--text-muted);padding:14px;">Chưa có giao dịch nào</td></tr>`;

  document.getElementById("customerDetailBox").innerHTML = `
    <div class="modal-header">
      <h2>${info.rank_icon} ${window.escHtml(cust.name)}</h2>
      <button class="close-btn" aria-label="Đóng cửa sổ" id="closeCustDetailBtn">✕</button>
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
      <button class="btn ${checkedInToday ? 'btn-secondary' : 'btn-primary'}" ${checkedInToday ? 'disabled' : ''} id="checkinBtn">
        ${checkedInToday ? '✅ Đã check-in hôm nay' : '✅ Check-in hôm nay'}
      </button>
      <div style="font-size:12px;color:var(--text-muted);align-self:center;">🔥 Streak: ${cust.streak_days || 0} ngày · Tổng chi tiêu: <b>${M.formatVND(cust.total_spent)}</b></div>
    </div>

    <div style="display:flex;gap:8px;margin-bottom:20px;">
      <input type="number" id="txAmountInput" placeholder="Số tiền (đ)" min="0" style="flex:1;height:40px;border:1px solid var(--border);border-radius:8px;padding:0 12px;">
      <input type="text" id="txNoteInput" placeholder="Ghi chú (vd: 2 cà phê sữa)" style="flex:2;height:40px;border:1px solid var(--border);border-radius:8px;padding:0 12px;">
      <button class="btn btn-primary" id="addTxBtn">💰 Ghi nhận</button>
    </div>

    <div style="font-size:13px;font-weight:700;margin-bottom:8px;">🗺️ Nhiệm vụ đang diễn ra</div>
    ${activeQuests || '<div style="color:var(--text-muted);font-size:13px;">Chưa có nhiệm vụ nào đang mở.</div>'}

    <div style="font-size:13px;font-weight:700;margin:18px 0 8px;">💰 Giao dịch gần nhất</div>
    <table class="game-table"><thead><tr><th>Ngày</th><th>Số tiền</th><th>Ghi chú</th></tr></thead><tbody>${txRows}</tbody></table>

    <div class="modal-actions">
      <button class="btn btn-danger" id="deleteCustBtn">🗑️ Xoá khách hàng</button>
    </div>
  `;

  document.getElementById("closeCustDetailBtn")?.addEventListener("click", () =>
    document.getElementById("customerDetailModal").classList.add("hidden"));
  document.getElementById("checkinBtn")?.addEventListener("click", () => checkinCustomer(id));
  document.getElementById("addTxBtn")?.addEventListener("click", () => addTransaction(id));
  document.getElementById("deleteCustBtn")?.addEventListener("click", () => deleteCustomer(id));
  document.querySelectorAll("[data-quest-progress]").forEach(btn => {
    btn.addEventListener("click", () => {
      const [custId, questId] = btn.dataset.questProgress.split("|").map(Number);
      markQuestProgress(custId, questId);
    });
  });

  document.getElementById("customerDetailModal").classList.remove("hidden");
}

/* ══════════════════════════════════════════════
   CHECK-IN
   ══════════════════════════════════════════════ */
async function checkinCustomer(id) {
  if (!isSuperAdminCust || _custActionBusy) return;
  const cust = M.state.customers.find(c => c.id === id);
  if (!cust) return;

  const today = new Date().toISOString().slice(0, 10);
  if (cust.last_checkin === today) { window.showToast("Khách đã check-in hôm nay rồi.", "#e17055"); return; }

  let newStreak = 1;
  if (cust.last_checkin) {
    const diffDays = Math.round((new Date(today) - new Date(cust.last_checkin)) / 86400000);
    newStreak = diffDays === 1 ? (cust.streak_days || 0) + 1 : 1;
  }
  const bonus    = newStreak % 7 === 0 ? 20 : 0;
  const xpEarned = 10 + bonus;
  const newXp    = cust.xp + xpEarned;
  const newLevel = M.getLevelForXp(newXp);

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

/* ══════════════════════════════════════════════
   GHI NHẬN GIAO DỊCH
   ══════════════════════════════════════════════ */
async function addTransaction(id) {
  if (!isSuperAdminCust || _custActionBusy) return;
  const amountInput = document.getElementById("txAmountInput");
  const noteInput   = document.getElementById("txNoteInput");
  const amount = Number(amountInput.value);
  if (!amount || amount <= 0 || !Number.isFinite(amount)) {
    window.showToast("⚠️ Vui lòng nhập số tiền hợp lệ.", "#e17055");
    amountInput.focus();
    return;
  }
  const note = noteInput.value.trim();

  _custActionBusy = true;
  try {
    const cust = M.state.customers.find(c => c.id === id);

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

/* ══════════════════════════════════════════════
   NHIỆM VỤ — CẬP NHẬT TIẾN ĐỘ (gọi từ modal chi tiết khách)
   ══════════════════════════════════════════════ */
async function markQuestProgress(customerId, questId) {
  if (!isSuperAdminCust || _custActionBusy) return;
  const quest = M.state.quests.find(q => q.id === questId);
  const cust  = M.state.customers.find(c => c.id === customerId);
  if (!quest || !cust) return;

  const pk = M.periodKeyFor(quest.type);
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
      const newLevel = M.getLevelForXp(newXp);
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

/* ══════════════════════════════════════════════
   XOÁ KHÁCH HÀNG
   ══════════════════════════════════════════════ */
async function deleteCustomer(id) {
  if (!isSuperAdminCust) return;
  const cust = M.state.customers.find(c => c.id === id);

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
