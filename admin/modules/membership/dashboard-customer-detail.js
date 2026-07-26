/* ══════════════════════════════════════════════
   DASHBOARD CUSTOMER DETAIL — dashboard-customer-detail.js
   ─────────────────────────────────────────────
   Page riêng (kiểu gameDetailPage — giữ sideMenu, có nút Quay lại).
   2 khối TÁCH BIỆT: Lịch sử đơn hàng (accordion, chỉ xem, không huỷ)
   và Lịch sử EXP (bảng riêng). KHÔNG có form tạo đơn / tick nhiệm vụ.
   ══════════════════════════════════════════════ */

const M_CD = window.Membership;
let cdCurrentCustomerId = null;

(function injectCustomerDetailPage() {
  const main = document.querySelector(".main-content");
  if (!main || document.getElementById("customerDetailPage")) return;

  const page = document.createElement("div");
  page.id = "customerDetailPage";
  page.style.display = "none";
  page.innerHTML = `
    <div class="page-header" style="align-items:flex-start;">
      <div>
        <button class="btn btn-secondary" id="cdBackBtn" style="margin-bottom:14px;">← Quay lại Khách hàng</button>
        <h1 class="page-title" id="cdTitle">👤 Chi tiết khách hàng</h1>
        <p class="page-subtitle" id="cdSubtitle">—</p>
      </div>
    </div>

    <div id="cdSummaryBox" class="table-card" style="padding:22px 24px;margin-bottom:24px;"></div>

    <div class="table-card" style="padding:22px 24px;margin-bottom:24px;">
      <div style="font-size:14px;font-weight:700;margin-bottom:14px;">🧾 Lịch sử đơn hàng</div>
      <table class="game-table">
        <thead><tr><th></th><th>Mã đơn</th><th>Ngày</th><th>Số món</th><th>Khách trả</th><th>Trạng thái</th></tr></thead>
        <tbody id="cdOrdersBody"><tr><td colspan="6" style="text-align:center;padding:30px;color:var(--text-muted);">⏳ Đang tải...</td></tr></tbody>
      </table>
    </div>

    <div class="table-card" style="padding:22px 24px;">
      <div style="font-size:14px;font-weight:700;margin-bottom:14px;">⭐ Lịch sử EXP</div>
      <table class="game-table">
        <thead><tr><th>Thời gian</th><th>Lý do</th><th>XP</th></tr></thead>
        <tbody id="cdExpBody"><tr><td colspan="3" style="text-align:center;padding:30px;color:var(--text-muted);">⏳ Đang tải...</td></tr></tbody>
      </table>
    </div>
  `;
  main.appendChild(page);

  document.getElementById("cdBackBtn")?.addEventListener("click", () => {
    if (typeof window.showDashboard === "function") { /* no-op, giữ context */ }
    window.__showPage("customersPage");
    document.getElementById("customersMenuItem")?.classList.add("active");
  });
})();

window.openCustomerDetailPage = async function (customerId) {
  cdCurrentCustomerId = customerId;
  const cust = M_CD.state.customers.find(c => c.id === customerId);
  if (!cust) { window.showToast("⚠️ Không tìm thấy khách hàng.", "#e17055"); return; }

  document.getElementById("cdTitle").textContent = `👤 ${cust.name}`;
  document.getElementById("cdSubtitle").textContent = `📞 ${cust.phone || "—"}`;
  renderCdSummary(cust);

  document.getElementById("cdOrdersBody").innerHTML = `<tr><td colspan="6" style="text-align:center;padding:30px;color:var(--text-muted);">⏳ Đang tải...</td></tr>`;
  document.getElementById("cdExpBody").innerHTML = `<tr><td colspan="3" style="text-align:center;padding:30px;color:var(--text-muted);">⏳ Đang tải...</td></tr>`;

  window.__showPage("customerDetailPage");
  document.querySelectorAll(".menu-item, .menu-item-parent, .menu-sub-item").forEach(el => el.classList.remove("active"));
  window.scrollTo(0, 0);

  const [{ data: orders }, { data: cqRows }] = await Promise.all([
    client.from("customer_orders")
      .select("*, customer_order_items(*)")
      .eq("customer_id", customerId)
      .order("created_at", { ascending: false })
      .limit(30),
    client.from("customer_quests")
      .select("*, quests(title, is_checkin), customer_orders(order_number)")
      .eq("customer_id", customerId)
      .eq("is_completed", true)
      .order("completed_at", { ascending: false })
      .limit(30),
  ]);

  renderCdOrders(orders || []);
  renderCdExp(cqRows || []);
};

function renderCdSummary(cust) {
  const info = M_CD.getLevelInfo(cust.level);
  const nextInfo = M_CD.getNextLevelInfo(cust.level);
  let pct = 100;
  if (nextInfo && nextInfo.xp_required > info.xp_required) {
    pct = Math.max(0, Math.min(100, Math.round((cust.xp - info.xp_required) / (nextInfo.xp_required - info.xp_required) * 100)));
  }
  document.getElementById("cdSummaryBox").innerHTML = `
    <div style="display:flex;justify-content:space-between;font-size:14px;font-weight:700;margin-bottom:8px;">
      <span>${info.rank_icon} ${window.escHtml(info.rank_name)} · ${cust.xp} XP</span>
      <span style="color:var(--text-muted);font-weight:500;">${nextInfo ? `Cần ${nextInfo.xp_required} XP để lên ${nextInfo.rank_icon} ${window.escHtml(nextInfo.rank_name)}` : 'Cấp cao nhất 🎉'}</span>
    </div>
    <div style="height:10px;background:#e2e8f0;border-radius:6px;overflow:hidden;margin-bottom:14px;">
      <div style="height:100%;width:${pct}%;background:var(--primary);"></div>
    </div>
    <div style="display:flex;gap:20px;flex-wrap:wrap;font-size:12px;color:var(--text-muted);">
      <span>🔥 Streak: <b>${cust.streak_days || 0}</b> ngày</span>
      <span>💰 Tổng chi tiêu: <b>${M_CD.formatVND(cust.total_spent)}</b></span>
      <span>📈 Lợi nhuận gộp: <b style="color:${Number(cust.total_profit) >= 0 ? '#00b894' : 'var(--danger)'}">${M_CD.formatVND(cust.total_profit)}</b></span>
    </div>
  `;
}

function renderCdOrders(orders) {
  const tbody = document.getElementById("cdOrdersBody");
  if (!orders.length) {
    tbody.innerHTML = `<tr><td colspan="6" style="text-align:center;padding:30px;color:var(--text-muted);">Chưa có đơn hàng nào.</td></tr>`;
    return;
  }

  tbody.innerHTML = orders.map(o => {
    const items = o.customer_order_items || [];
    const activeItems = items.filter(it => !it.is_void);
    const totalPaid = activeItems.reduce((s, it) => s + Number(it.customer_paid), 0);
    const isVoided = o.status === "voided";
    return `
      <tr class="cd-ord-row" data-cd-order="${o.id}" style="cursor:pointer;${isVoided ? 'opacity:.55;' : ''}">
        <td style="width:28px;"><span data-cd-caret="${o.id}">▸</span></td>
        <td><b>${window.escHtml(o.order_number)}</b></td>
        <td>${new Date(o.created_at).toLocaleString("vi-VN")}</td>
        <td>${activeItems.length} món</td>
        <td style="font-weight:700;">${totalPaid.toLocaleString('vi-VN')}đ</td>
        <td>${isVoided ? '<span class="badge" style="background:#fdecea;color:var(--danger);">Đã huỷ</span>' : '<span class="badge">Hoàn tất</span>'}</td>
      </tr>
      <tr class="hidden" id="cdDetailRow-${o.id}">
        <td></td>
        <td colspan="5" style="background:var(--bg);padding:12px 18px;">
          ${items.map(it => `
            <div style="padding:4px 0;font-size:13px;${it.is_void ? 'opacity:.5;text-decoration:line-through;' : ''}">
              ${window.escHtml(it.product_name)} ×${it.quantity} — ${Number(it.customer_paid).toLocaleString('vi-VN')}đ
              ${it.is_void ? ` <span style="color:var(--danger);font-size:11px;">(Đã huỷ${it.void_reason ? ': ' + window.escHtml(it.void_reason) : ''})</span>` : ''}
            </div>`).join('') || '<span style="color:var(--text-muted);">Không có sản phẩm.</span>'}
        </td>
      </tr>
    `;
  }).join("");

  tbody.querySelectorAll(".cd-ord-row").forEach(row => {
    row.addEventListener("click", () => {
      const id = row.dataset.cdOrder;
      const detailRow = document.getElementById(`cdDetailRow-${id}`);
      const caret = row.querySelector(`[data-cd-caret="${id}"]`);
      const isOpen = !detailRow.classList.contains("hidden");
      detailRow.classList.toggle("hidden", isOpen);
      caret.textContent = isOpen ? "▸" : "▾";
    });
  });
}

function renderCdExp(cqRows) {
  const tbody = document.getElementById("cdExpBody");
  if (!cqRows.length) {
    tbody.innerHTML = `<tr><td colspan="3" style="text-align:center;padding:30px;color:var(--text-muted);">Chưa có lịch sử EXP.</td></tr>`;
    return;
  }
  tbody.innerHTML = cqRows.map(r => {
    const quest = r.quests;
    const orderNo = r.customer_orders?.order_number;
    const reason = quest?.is_checkin
      ? `Check-in hàng ngày${orderNo ? ` — từ đơn hàng <b>${window.escHtml(orderNo)}</b>` : ''}`
      : (quest?.title || 'Nhiệm vụ');
    return `<tr>
      <td style="font-size:12px;">${r.completed_at ? new Date(r.completed_at).toLocaleString('vi-VN') : '—'}</td>
      <td style="font-size:13px;">${reason}</td>
      <td style="font-weight:700;color:var(--primary);">+${r.xp_awarded} XP</td>
    </tr>`;
  }).join("");
}
