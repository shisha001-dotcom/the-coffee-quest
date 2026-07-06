/* ══════════════════════════════════════════════
   DASHBOARD CUSTOMERS MODULE — admin/modules/dashboard-customers.js
   ─────────────────────────────────────────────
   Hệ thống "Coffee Quest": quản lý khách hàng như nhân vật game —
   check-in, XP, cấp độ (rank), nhiệm vụ, lịch sử thanh toán.

   ⚠️ NGOẠI LỆ PHÂN QUYỀN có chủ đích (khác AdminPermissions.isReadOnly
   toàn cục — vốn chặn Bar Staff ghi dữ liệu ở MỌI trang khác):
     - MỌI role đã đăng nhập (kể cả Bar Staff) được: tạo khách mới,
       check-in, ghi nhận giao dịch, đánh dấu tiến độ nhiệm vụ —
       vì đây là thao tác vận hành hàng ngày ở quầy.
     - CHỈ Super Admin & Editor được: xoá khách hàng, cấu hình lại
       Cấp độ (membership_levels) và Nhiệm vụ (quests).
   Nếu muốn đổi lại theo đúng rule Bar Staff = chỉ xem như các trang
   khác, đổi biến `canOperate` bên dưới thành `canManageQuestSystem`.

   Cần: client, currentSession, window.AdminPermissions,
   window.escHtml, window.showToast (đã load từ trước).
   ══════════════════════════════════════════════ */

const canManageQuestSystem =
  window.AdminPermissions.isSuperAdmin(currentSession.role) ||
  currentSession.role === "editor";
const canOperate = true; /* mọi role đăng nhập đều thao tác vận hành được — xem ghi chú trên */

let allCustomers = [];
let allLevels    = [];
let allQuests    = [];
let custActiveTab = "list";
let custSearchQ    = "";
let openDetailId   = null;

/* ══════════════════════════════════════════════
   ĐĂNG KÝ MENU + PAGE
   ══════════════════════════════════════════════ */
window.AdminDashboard.registerPage({
  pageId: "customersPage",
  menuId: "customersMenuItem",
  icon: "🎮",
  label: "Khách hàng",
  onShow: () => { loadLevels(); loadQuests(); loadCustomers(); },
});

(function injectCustomersPage() {
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
    <div class="modal-overlay hidden" id="addCustomerModal">
      <div class="modal-box" style="max-width:480px;">
        <div class="modal-header">
          <h2>➕ Thêm khách hàng mới</h2>
          <button class="close-btn" onclick="document.getElementById('addCustomerModal').classList.add('hidden')">✕</button>
        </div>
        <div class="form-grid" style="grid-template-columns:1fr;">
          <div class="form-group"><label>Tên *</label><input type="text" id="newCustName" placeholder="Nguyễn Văn A"></div>
          <div class="form-group"><label>Số điện thoại *</label><input type="text" id="newCustPhone" placeholder="09xxxxxxxx"></div>
          <div class="form-group"><label>Tuổi</label><input type="number" id="newCustAge" placeholder="25"></div>
          <div class="form-group">
            <label>Giới tính</label>
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
    <div class="modal-overlay hidden" id="customerDetailModal">
      <div class="modal-box" style="max-width:640px;" id="customerDetailBox"></div>
    </div>
  `;
  main.appendChild(page);

  document.getElementById("custSearchInput").addEventListener("input", e => {
    custSearchQ = e.target.value.toLowerCase();
    renderCustomerTable();
  });
})();

/* ══════════════════════════════════════════════
   TABS
   ══════════════════════════════════════════════ */
function switchCustTab(tab) {
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
  return allLevels.find(l => l.level === level) || { rank_name: "—", rank_icon: "⭐" };
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
  const { data, error } = await client.from("customers").select("*").order("xp", { ascending: false });
  if (error) { console.error(error); return; }
  allCustomers = data || [];
  renderCustomerTable();
}
async function loadLevels() {
  const { data, error } = await client.from("membership_levels").select("*").order("level", { ascending: true });
  if (error) { console.error(error); return; }
  allLevels = data || [];
}
async function loadQuests() {
  const { data, error } = await client.from("quests").select("*").order("id", { ascending: true });
  if (error) { console.error(error); return; }
  allQuests = data || [];
}
window.loadCustomers = loadCustomers;

/* ══════════════════════════════════════════════
   RENDER: BẢNG KHÁCH HÀNG
   ══════════════════════════════════════════════ */
function renderCustomerTable() {
  const tbody = document.getElementById("custTableBody");
  if (!tbody) return;

  const list = allCustomers.filter(c =>
    !custSearchQ || c.name.toLowerCase().includes(custSearchQ) || c.phone.includes(custSearchQ)
  );

  if (!list.length) {
    tbody.innerHTML = `<tr><td colspan="6" style="text-align:center;padding:40px;color:var(--text-muted);">Chưa có khách hàng nào.</td></tr>`;
    return;
  }

  tbody.innerHTML = list.map(c => {
    const info = getLevelInfo(c.level);
    return `<tr>
      <td>
        <div class="game-name">${window.escHtml(c.name)}</div>
        <div class="game-id">📞 ${window.escHtml(c.phone)}</div>
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
  ["newCustName", "newCustPhone", "newCustAge"].forEach(id => document.getElementById(id).value = "");
  document.getElementById("newCustGender").value = "";
  document.getElementById("addCustomerModal").classList.remove("hidden");
}
window.openAddCustomer = openAddCustomer;

async function saveNewCustomer() {
  const name  = document.getElementById("newCustName").value.trim();
  const phone = document.getElementById("newCustPhone").value.trim();
  const age   = Number(document.getElementById("newCustAge").value) || null;
  const gender = document.getElementById("newCustGender").value || null;

  if (!name)  { alert("Vui lòng nhập tên."); return; }
  if (!phone) { alert("Vui lòng nhập số điện thoại."); return; }

  try {
    const { data: existing } = await client.from("customers").select("id").eq("phone", phone).maybeSingle();
    if (existing) { alert("Số điện thoại này đã tồn tại trong hệ thống."); return; }

    const { data, error } = await client.from("customers")
      .insert({ name, phone, age, gender }).select().single();
    if (error) throw error;

    document.getElementById("addCustomerModal").classList.add("hidden");
    window.showToast("✅ Đã tạo khách hàng mới!");
    await loadCustomers();
    openCustomerDetail(data.id);
  } catch (err) {
    alert("Lỗi: " + err.message);
  }
}
window.saveNewCustomer = saveNewCustomer;

/* ══════════════════════════════════════════════
   CHI TIẾT KHÁCH HÀNG (modal)
   ══════════════════════════════════════════════ */
async function openCustomerDetail(id) {
  openDetailId = id;
  const cust = allCustomers.find(c => c.id === id);
  if (!cust) return;

  const { data: txs }   = await client.from("customer_transactions").select("*").eq("customer_id", id).order("created_at", { ascending: false }).limit(5);
  const { data: cqRows } = await client.from("customer_quests").select("*").eq("customer_id", id);

  const info      = getLevelInfo(cust.level);
  const nextInfo  = getNextLevelInfo(cust.level);
  const pct       = nextInfo ? Math.min(100, Math.round((cust.xp - info.xp_required) / (nextInfo.xp_required - info.xp_required) * 100)) : 100;
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
        ${canOperate ? `<button class="btn btn-secondary" style="font-size:12px;padding:6px 12px;" ${done ? 'disabled' : ''} onclick="markQuestProgress(${id},${q.id})">${done ? 'Đã xong' : '+1 tiến độ'}</button>` : ''}
      </div>`;
  }).join("");

  const txRows = (txs || []).map(t => `
    <tr><td>${new Date(t.created_at).toLocaleDateString('vi-VN')}</td><td>${formatVND(t.amount)}</td><td>${window.escHtml(t.note || '—')}</td></tr>
  `).join("") || `<tr><td colspan="3" style="text-align:center;color:var(--text-muted);padding:14px;">Chưa có giao dịch nào</td></tr>`;

  document.getElementById("customerDetailBox").innerHTML = `
    <div class="modal-header">
      <h2>${info.rank_icon} ${window.escHtml(cust.name)}</h2>
      <button class="close-btn" onclick="document.getElementById('customerDetailModal').classList.add('hidden')">✕</button>
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
      <button class="btn ${checkedInToday ? 'btn-secondary' : 'btn-primary'}" ${checkedInToday || !canOperate ? 'disabled' : ''} onclick="checkinCustomer(${id})">
        ${checkedInToday ? '✅ Đã check-in hôm nay' : '✅ Check-in hôm nay'}
      </button>
      <div style="font-size:12px;color:var(--text-muted);align-self:center;">🔥 Streak: ${cust.streak_days || 0} ngày · Tổng chi tiêu: <b>${formatVND(cust.total_spent)}</b></div>
    </div>

    ${canOperate ? `
    <div style="display:flex;gap:8px;margin-bottom:20px;">
      <input type="number" id="txAmountInput" placeholder="Số tiền (đ)" style="flex:1;height:40px;border:1px solid var(--border);border-radius:8px;padding:0 12px;">
      <input type="text" id="txNoteInput" placeholder="Ghi chú (vd: 2 cà phê sữa)" style="flex:2;height:40px;border:1px solid var(--border);border-radius:8px;padding:0 12px;">
      <button class="btn btn-primary" onclick="addTransaction(${id})">💰 Ghi nhận</button>
    </div>` : ''}

    <div style="font-size:13px;font-weight:700;margin-bottom:8px;">🗺️ Nhiệm vụ đang diễn ra</div>
    ${activeQuests || '<div style="color:var(--text-muted);font-size:13px;">Chưa có nhiệm vụ nào đang mở.</div>'}

    <div style="font-size:13px;font-weight:700;margin:18px 0 8px;">💰 Giao dịch gần nhất</div>
    <table class="game-table"><thead><tr><th>Ngày</th><th>Số tiền</th><th>Ghi chú</th></tr></thead><tbody>${txRows}</tbody></table>

    ${canManageQuestSystem ? `
    <div class="modal-actions">
      <button class="btn btn-danger" onclick="deleteCustomer(${id})">🗑️ Xoá khách hàng</button>
    </div>` : ''}
  `;

  document.getElementById("customerDetailModal").classList.remove("hidden");
}
window.openCustomerDetail = openCustomerDetail;

/* ══════════════════════════════════════════════
   CHECK-IN
   ══════════════════════════════════════════════ */
async function checkinCustomer(id) {
  if (!canOperate) return;
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

  try {
    await client.from("customer_checkins").insert({ customer_id: id, xp_earned: xpEarned });
    const { error } = await client.from("customers")
      .update({ xp: newXp, level: newLevel, streak_days: newStreak, last_checkin: today })
      .eq("id", id);
    if (error) throw error;

    window.showToast(`✅ Check-in! +${xpEarned} XP (streak ${newStreak} ngày)` + (bonus ? ` 🔥 +${bonus} XP thưởng chuỗi 7 ngày!` : ""));
    await loadCustomers();
    openCustomerDetail(id);
  } catch (err) {
    alert("Lỗi: " + err.message);
  }
}
window.checkinCustomer = checkinCustomer;

/* ══════════════════════════════════════════════
   GHI NHẬN GIAO DỊCH (không tự sinh XP)
   ══════════════════════════════════════════════ */
async function addTransaction(id) {
  if (!canOperate) return;
  const amountInput = document.getElementById("txAmountInput");
  const noteInput    = document.getElementById("txNoteInput");
  const amount = Number(amountInput.value);
  if (!amount || amount <= 0) { alert("Nhập số tiền hợp lệ."); return; }
  const note = noteInput.value.trim();

  try {
    const cust = allCustomers.find(c => c.id === id);
    await client.from("customer_transactions").insert({
      customer_id: id, amount, note,
      staff_name: currentSession.displayName || currentSession.username,
    });
    const { error } = await client.from("customers")
      .update({ total_spent: (cust.total_spent || 0) + amount }).eq("id", id);
    if (error) throw error;

    window.showToast("💰 Đã ghi nhận giao dịch!");
    await loadCustomers();
    openCustomerDetail(id);
  } catch (err) {
    alert("Lỗi: " + err.message);
  }
}
window.addTransaction = addTransaction;

/* ══════════════════════════════════════════════
   NHIỆM VỤ — CẬP NHẬT TIẾN ĐỘ
   ══════════════════════════════════════════════ */
async function markQuestProgress(customerId, questId) {
  if (!canOperate) return;
  const quest = allQuests.find(q => q.id === questId);
  const cust  = allCustomers.find(c => c.id === customerId);
  if (!quest || !cust) return;

  const pk = periodKeyFor(quest.type);

  try {
    const { data: existing } = await client.from("customer_quests")
      .select("*").eq("customer_id", customerId).eq("quest_id", questId).eq("period_key", pk).maybeSingle();

    if (existing?.completed) { window.showToast("Nhiệm vụ này đã hoàn thành trong kỳ hiện tại rồi.", "#e17055"); return; }

    const newProgress = (existing?.progress || 0) + 1;
    const isDone = newProgress >= quest.target_count;

    if (existing) {
      await client.from("customer_quests").update({
        progress: newProgress, completed: isDone, completed_at: isDone ? new Date().toISOString() : null,
      }).eq("id", existing.id);
    } else {
      await client.from("customer_quests").insert({
        customer_id: customerId, quest_id: questId, period_key: pk,
        progress: newProgress, completed: isDone, completed_at: isDone ? new Date().toISOString() : null,
      });
    }

    if (isDone) {
      const newXp    = cust.xp + quest.xp_reward;
      const newLevel = getLevelForXp(newXp);
      await client.from("customers").update({ xp: newXp, level: newLevel }).eq("id", customerId);
      window.showToast(`🎉 Hoàn thành "${quest.title}"! +${quest.xp_reward} XP`);
    } else {
      window.showToast(`Tiến độ: ${newProgress}/${quest.target_count}`);
    }

    await loadCustomers();
    openCustomerDetail(customerId);
  } catch (err) {
    alert("Lỗi: " + err.message);
  }
}
window.markQuestProgress = markQuestProgress;

/* ══════════════════════════════════════════════
   XOÁ KHÁCH HÀNG (chỉ Editor/Super Admin)
   ══════════════════════════════════════════════ */
async function deleteCustomer(id) {
  if (!canManageQuestSystem) return;
  const cust = allCustomers.find(c => c.id === id);
  if (!confirm(`Xoá khách hàng "${cust?.name}"?\n\nHành động này không thể hoàn tác!`)) return;

  try {
    const { error } = await client.from("customers").delete().eq("id", id);
    if (error) throw error;
    document.getElementById("customerDetailModal").classList.add("hidden");
    window.showToast("🗑️ Đã xoá khách hàng", "#e17055");
    await loadCustomers();
  } catch (err) {
    alert("Lỗi: " + err.message);
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
        ${canManageQuestSystem ? `<button class="btn btn-primary" onclick="addQuestRow()">+ Thêm nhiệm vụ</button>` : ""}
      </div>
      <table class="game-table">
        <thead><tr><th>Tên</th><th>Loại</th><th>XP</th><th>Mục tiêu</th><th>Trạng thái</th>${canManageQuestSystem ? "<th>Hành động</th>" : ""}</tr></thead>
        <tbody>
          ${allQuests.map(q => `
            <tr>
              <td><b>${window.escHtml(q.title)}</b><div style="font-size:11px;color:var(--text-muted);">${window.escHtml(q.description || "")}</div></td>
              <td>${typeLabel(q.type)}</td>
              <td>${q.xp_reward} XP</td>
              <td>${q.target_count}</td>
              <td>${q.active ? '<span class="badge">Đang mở</span>' : '<span class="badge" style="background:#f1f5f9;color:#888;">Tắt</span>'}</td>
              ${canManageQuestSystem ? `<td>
                <button class="btn btn-secondary" style="font-size:12px;padding:6px 10px;" onclick="toggleQuestActive(${q.id})">${q.active ? "Tắt" : "Bật"}</button>
                <button class="btn btn-danger" style="font-size:12px;padding:6px 10px;" onclick="deleteQuest(${q.id})">🗑️</button>
              </td>` : ""}
            </tr>
          `).join("")}
        </tbody>
      </table>
    </div>
  `;
}

async function toggleQuestActive(id) {
  if (!canManageQuestSystem) return;
  const q = allQuests.find(x => x.id === id);
  await client.from("quests").update({ active: !q.active }).eq("id", id);
  await loadQuests();
  renderQuestsTab();
}
window.toggleQuestActive = toggleQuestActive;

async function deleteQuest(id) {
  if (!canManageQuestSystem) return;
  if (!confirm("Xoá nhiệm vụ này? Tiến độ khách hàng liên quan cũng sẽ bị xoá.")) return;
  await client.from("quests").delete().eq("id", id);
  await loadQuests();
  renderQuestsTab();
}
window.deleteQuest = deleteQuest;

function addQuestRow() {
  if (!canManageQuestSystem) return;
  const title = prompt("Tên nhiệm vụ:");
  if (!title) return;
  const type = prompt("Loại (daily / weekly / onetime):", "daily");
  if (!["daily", "weekly", "onetime"].includes(type)) { alert("Loại không hợp lệ."); return; }
  const xp = Number(prompt("XP thưởng:", "10")) || 10;
  const target = Number(prompt("Số lần cần hoàn thành:", "1")) || 1;

  client.from("quests").insert({ title, type, xp_reward: xp, target_count: target })
    .then(({ error }) => {
      if (error) { alert("Lỗi: " + error.message); return; }
      loadQuests().then(renderQuestsTab);
    });
}
window.addQuestRow = addQuestRow;

/* ══════════════════════════════════════════════
   TAB: CẤU HÌNH CẤP ĐỘ
   ══════════════════════════════════════════════ */
function renderLevelsTab() {
  const wrap = document.getElementById("custTabLevels");
  const editable = canManageQuestSystem;

  wrap.innerHTML = `
    <div class="table-card" style="padding:20px 24px;">
      <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:16px;">
        <div style="font-size:14px;font-weight:700;">Cấu hình cấp độ &amp; ưu đãi</div>
        ${editable ? `<button class="btn btn-primary" onclick="saveLevels()">💾 Lưu tất cả</button>` : ""}
      </div>
      <table class="game-table">
        <thead><tr><th>Cấp</th><th>XP tối thiểu</th><th>Tên rank</th><th>Icon</th><th>Giảm giá %</th><th>Quà tặng</th><th>Ưu tiên đặt bàn</th></tr></thead>
        <tbody>
          ${allLevels.map(l => `
            <tr data-level="${l.level}">
              <td><b>${l.level}</b></td>
              <td><input type="number" class="lv-xp" value="${l.xp_required}" ${editable ? "" : "disabled"} style="width:90px;height:34px;border:1px solid var(--border);border-radius:6px;padding:0 8px;"></td>
              <td><input type="text" class="lv-name" value="${window.escHtml(l.rank_name)}" ${editable ? "" : "disabled"} style="width:120px;height:34px;border:1px solid var(--border);border-radius:6px;padding:0 8px;"></td>
              <td><input type="text" class="lv-icon" value="${l.rank_icon || ''}" ${editable ? "" : "disabled"} style="width:50px;height:34px;border:1px solid var(--border);border-radius:6px;padding:0 8px;text-align:center;"></td>
              <td><input type="number" class="lv-discount" value="${l.discount_pct}" ${editable ? "" : "disabled"} style="width:70px;height:34px;border:1px solid var(--border);border-radius:6px;padding:0 8px;"></td>
              <td><input type="text" class="lv-freeitem" value="${window.escHtml(l.free_item || '')}" ${editable ? "" : "disabled"} style="width:160px;height:34px;border:1px solid var(--border);border-radius:6px;padding:0 8px;"></td>
              <td style="text-align:center;"><input type="checkbox" class="lv-priority" ${l.priority_booking ? "checked" : ""} ${editable ? "" : "disabled"} style="width:18px;height:18px;"></td>
            </tr>
          `).join("")}
        </tbody>
      </table>
      ${editable ? `<div style="font-size:12px;color:var(--text-muted);margin-top:10px;">Sửa giá trị trong bảng rồi bấm "💾 Lưu tất cả" ở trên để áp dụng.</div>` : ""}
    </div>
  `;
}

async function saveLevels() {
  if (!canManageQuestSystem) return;
  const rows = [...document.querySelectorAll("#custTabLevels tbody tr")].map(tr => ({
    level: Number(tr.dataset.level),
    xp_required: Number(tr.querySelector(".lv-xp").value) || 0,
    rank_name: tr.querySelector(".lv-name").value.trim(),
    rank_icon: tr.querySelector(".lv-icon").value.trim() || "⭐",
    discount_pct: Number(tr.querySelector(".lv-discount").value) || 0,
    free_item: tr.querySelector(".lv-freeitem").value.trim() || null,
    priority_booking: tr.querySelector(".lv-priority").checked,
  }));

  try {
    const { error } = await client.from("membership_levels").upsert(rows, { onConflict: "level" });
    if (error) throw error;
    window.showToast("✅ Đã lưu cấu hình cấp độ!");
    await loadLevels();
    await loadCustomers();
  } catch (err) {
    alert("Lỗi: " + err.message);
  }
}
window.saveLevels = saveLevels;
