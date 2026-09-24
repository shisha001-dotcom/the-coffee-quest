/* ══════════════════════════════════════════════
   DASHBOARD CUSTOMER DETAIL — admin/modules/membership/dashboard-customer-detail.js
   ─────────────────────────────────────────────
   VAI TRÒ
   Trang chi tiết 1 khách hàng (#customerDetailPage), CHỈ ĐỂ XEM. Gồm:
     1. Khung tóm tắt: cấp độ, XP, thanh tiến độ lên cấp, streak, tổng chi
        tiêu, lợi nhuận gộp.
     2. Bảng "🧾 Lịch sử đơn hàng": mỗi dòng bấm để xổ ra danh sách món
        (accordion). KHÔNG có nút huỷ ở đây — muốn huỷ đơn/dòng phải sang
        trang "🧾 Đơn hàng".
     3. Bảng "⭐ Lịch sử EXP": các nhiệm vụ đã hoàn thành và XP nhận được.

   CÁCH MỞ
   - Nút "🔍 Chi tiết" ở bảng khách hàng (dashboard-customers.js) hoặc sau
     khi tạo khách mới gọi window.openCustomerDetailPage(customerId).
   - Không có mục menu riêng và không dùng registerPage(): mở bằng
     window.__showPage("customerDetailPage"). Vì mở trang xoá hết trạng thái
     `active` của menu nên nút "← Quay lại Khách hàng" gắn lại `active` cho
     #customersMenuItem. Quay lại KHÔNG tải lại danh sách khách.
   - Id trang kết thúc bằng "Page" để bộ chuyển trang (page-registry) ẩn/hiện được.

   PHỤ THUỘC
   window.Membership (membership-shared.js; alias M_CD), `client`,
   window.__showPage, window.escHtml, window.showToast.
   Khách được tra trong M_CD.state.customers — state này chỉ có với Super Admin
   (xem ghi chú ở membership-shared.js).

   GIỚI HẠN ĐANG GHI CỨNG
   Chỉ tải 30 đơn hàng mới nhất và 30 dòng lịch sử EXP mới nhất của khách
   (.limit(30) ở 2 truy vấn trong openCustomerDetailPage).
   ══════════════════════════════════════════════ */

const M_CD = window.Membership;
let cdCurrentCustomerId = null;

/* ══════════════════════════════════════════════
   DỰNG TRANG — inject 1 lần lúc file chạy
   ─────────────────────────────────────────────
   Bảng tra "sửa ở đâu" (HTML nằm trong chuỗi, không chèn comment giữa được):
     · Chữ: "← Quay lại Khách hàng", "👤 Chi tiết khách hàng" (tiêu đề tạm, được
       đổi thành "👤 <tên khách>" khi mở), "🧾 Lịch sử đơn hàng", "⭐ Lịch sử EXP".
     · Cột bảng đơn: Mã đơn / Ngày / Số món / Khách trả / Trạng thái.
       Cột bảng EXP: Thời gian / Lý do / XP.
     · Khoảng cách: mỗi khối thẻ padding 22px 24px, cách nhau 24px; tiêu đề khối
       cỡ 14px đậm. Kiểu bảng/thẻ lấy từ .table-card, .game-table trong dashboard.css.
     · Chữ "⏳ Đang tải..." (padding 30px, màu var(--text-muted)) là trạng thái chờ.
   ══════════════════════════════════════════════ */
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

/* ══════════════════════════════════════════════
   MỞ TRANG CHI TIẾT 1 KHÁCH
   ─────────────────────────────────────────────
   1. Tra khách trong state; không thấy → toast "⚠️ Không tìm thấy khách
      hàng." (nền #e17055).
   2. Điền tiêu đề "👤 <tên>", phụ đề "📞 <SĐT>" và khung tóm tắt ngay.
   3. Chuyển sang trang, bỏ `active` mọi menu, cuộn lên đầu.
   4. Tải song song: 30 đơn gần nhất (kèm các dòng món) và 30 nhiệm vụ đã
      hoàn thành gần nhất (kèm tên quest và mã đơn liên quan).
   ══════════════════════════════════════════════ */
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

/* ══════════════════════════════════════════════
   KHUNG TÓM TẮT
   ─────────────────────────────────────────────
   Dòng đầu: "<icon> <hạng> · <XP> XP" (14px đậm) và bên phải hiện số XP
   cần để lên hạng kế (chữ 14px màu var(--text-muted)), hoặc "Cấp cao nhất 🎉".
   Thanh tiến độ: cao 10px, nền #e2e8f0, phần đã đạt màu var(--primary);
   % = (XP hiện tại − mốc cấp hiện tại) / (mốc cấp kế − mốc cấp hiện tại);
   ở cấp cao nhất luôn 100%.
   Dòng cuối (12px, var(--text-muted)): 🔥 Streak · 💰 Tổng chi tiêu ·
   📈 Lợi nhuận gộp (màu #00b894 khi ≥ 0, var(--danger) khi âm).
   ══════════════════════════════════════════════ */
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

/* ══════════════════════════════════════════════
   BẢNG LỊCH SỬ ĐƠN HÀNG
   ─────────────────────────────────────────────
   Mỗi đơn 1 dòng chính + 1 dòng chi tiết ẩn (class `hidden`) xổ ra khi bấm
   (mũi tên ▸ ↔ ▾). "Số món" và "Khách trả" chỉ tính các dòng CHƯA huỷ.
   Trạng thái: "Hoàn tất" (nhãn .badge mặc định) / "Đã huỷ" (nền #fdecea,
   chữ var(--danger)); đơn đã huỷ cả dòng mờ 55%. Dòng món bị huỷ: mờ 50%,
   gạch ngang, kèm "(Đã huỷ: <lý do>)" chữ đỏ 11px. Chi tiết mỗi món cỡ 13px.
   Rỗng: "Chưa có đơn hàng nào.".
   ══════════════════════════════════════════════ */
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

/* ══════════════════════════════════════════════
   BẢNG LỊCH SỬ EXP
   ─────────────────────────────────────────────
   Cột "Lý do":
     · quest check-in → "Check-in hàng ngày — từ đơn hàng <mã đơn>"
     · quest thường   → tên quest (hoặc "Nhiệm vụ" nếu thiếu)
   Cột XP: "+<số> XP", chữ đậm màu var(--primary). Cột thời gian cỡ 12px,
   cột lý do 13px. Rỗng: "Chưa có lịch sử EXP.".
   ⚠️ Tên quest (quest?.title) được chèn vào innerHTML KHÔNG qua escHtml
   (mã đơn thì có escape). Tên quest do Super Admin tự nhập nên rủi ro thấp,
   nhưng nếu sửa code nên thêm window.escHtml cho nhất quán.
   ══════════════════════════════════════════════ */
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
