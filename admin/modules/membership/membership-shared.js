/* ══════════════════════════════════════════════
   MEMBERSHIP SHARED — admin/modules/membership/membership-shared.js
   ─────────────────────────────────────────────
   VAI TRÒ
   State + hàm dùng chung cho domain Khách hàng / Cấp độ / Nhiệm vụ.
   Xuất ra `window.Membership` (các file khác thường đặt alias ngắn:
   M, M_CD, M_L, M_Q, M_O).

   NƠI DÙNG
     - dashboard-customers.js, dashboard-customer-detail.js,
       dashboard-quests.js, dashboard-levels.js
     - dashboard-orders.js (tra cấp độ để gợi ý % giảm giá, tìm quest
       check-in, tính lại cấp độ sau khi cộng XP)

   THỨ TỰ NẠP
   Nạp trong SCRIPT_SEQUENCE ngay TRƯỚC 4 file membership và trước
   dashboard-orders.js. Cần sẵn: `client`, `currentSession`,
   window.AdminPermissions, window.normalizePhoneVN (js/shared-utils.js),
   window.clearFieldError / showFieldError.

   DỮ LIỆU (state)
     customers : bảng `customers`, chưa xoá mềm, sắp theo XP giảm dần
     levels    : bảng `membership_levels`, sắp theo level tăng dần
     quests    : bảng `quests`, chưa xoá mềm, sắp theo id tăng dần

   ⚠️ CHỈ SUPER ADMIN MỚI NẠP ĐƯỢC STATE
   3 hàm loadCustomers / loadLevels / loadQuests KHÔNG làm gì (trả về state
   hiện có) nếu tài khoản không phải Super Admin. Và state chỉ được nạp khi
   Super Admin mở trang "🎮 Khách hàng" (onShow của dashboard-customers.js).
   Hệ quả với dashboard-orders.js (dùng chung state này):
     · Editor / Bar Staff: state luôn rỗng → không có % giảm giá mặc định theo
       cấp độ và KHÔNG tự check-in khi tạo đơn cho thành viên.
     · Super Admin chưa từng mở trang Khách hàng trong phiên: cũng như trên.
   Nếu muốn các quyền khác dùng được, phải nạp levels/quests ở nơi khác.

   ⚠️ NGÀY THEO GIỜ UTC
   periodKeyFor('daily') dùng new Date().toISOString() — tức ngày theo UTC,
   trong khi getISOWeek() dùng ngày theo giờ máy. Ở Việt Nam (UTC+7), từ
   0h–7h sáng ngày theo UTC vẫn là hôm qua. Cùng cách lấy ngày này cũng được
   dùng trong dashboard-orders.js khi xét "đơn đầu tiên trong ngày".
   ══════════════════════════════════════════════ */

window.Membership = (function () {

  /* true nếu đang đăng nhập bằng Super Admin (xem ghi chú đầu file). */
  const isSuperAdmin = window.AdminPermissions.isSuperAdmin(currentSession.role);

  const state = {
    customers: [],
    levels: [],
    quests: [],
  };

  /* ── HÀM THUẦN (không gọi mạng) ── */

  /* Cấp độ tương ứng với số XP: lấy cấp CAO NHẤT có xp_required ≤ xp.
     Chưa có dữ liệu cấp độ → trả 1. */
  function getLevelForXp(xp) {
    const sorted = [...state.levels].sort((a, b) => a.level - b.level);
    let lvl = sorted[0]?.level || 1;
    for (const l of sorted) if (xp >= l.xp_required) lvl = l.level;
    return lvl;
  }
  /* Thông tin 1 cấp. ⚠️ HARDCODE: không tìm thấy → trả tên rank "—",
     icon "⭐", xp_required 0 (hiển thị khi chưa nạp state hoặc cấp lạ). */
  function getLevelInfo(level) {
    return state.levels.find(l => l.level === level) || { rank_name: "—", rank_icon: "⭐", xp_required: 0 };
  }
  /* Cấp kế tiếp; null nếu đã ở cấp cao nhất. */
  function getNextLevelInfo(level) {
    return state.levels.find(l => l.level === level + 1) || null;
  }
  /* Quest hệ thống dùng cho check-in tự động (is_checkin = true). Chỉ có 1. */
  function getCheckinQuest() {
    return state.quests.find(q => q.is_checkin) || null;
  }
  /* Định dạng tiền kiểu Việt: 35000 → "35.000 đ". (Đổi đuôi " đ" ở đây nếu
     muốn đổi cách hiển thị tiền ở toàn bộ trang khách hàng.) */
  function formatVND(n) {
    return Number(n || 0).toLocaleString("vi-VN") + " đ";
  }
  /* Tuần ISO của ngày d, dạng "YYYY-Www" (vd "2026-W38"). */
  function getISOWeek(d) {
    d = new Date(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()));
    const dayNum = d.getUTCDay() || 7;
    d.setUTCDate(d.getUTCDate() + 4 - dayNum);
    const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1));
    const weekNo = Math.ceil((((d - yearStart) / 86400000) + 1) / 7);
    return `${d.getUTCFullYear()}-W${String(weekNo).padStart(2, "0")}`;
  }
  /* Khoá chu kỳ của 1 loại quest: daily → "YYYY-MM-DD" (UTC), weekly →
     "YYYY-Www", còn lại (onetime) → "once". Khớp cột customer_quests.period_key. */
  function periodKeyFor(type) {
    if (type === "daily")  return new Date().toISOString().slice(0, 10);
    if (type === "weekly") return getISOWeek(new Date());
    return "once";
  }
  /* Chuẩn hoá SĐT Việt Nam — dùng chung hàm ở js/shared-utils.js. */
  const normalizePhone = window.normalizePhoneVN;

  /* ── TẢI DỮ LIỆU — cập nhật state; nơi gọi tự vẽ lại giao diện sau khi await ── */
  async function loadCustomers() {
    if (!isSuperAdmin) return state.customers;
    const { data, error } = await client
      .from("customers")
      .select("*")
      .is("deleted_at", null)
      .order("xp", { ascending: false });
    if (error) { console.error(error); throw error; }
    state.customers = data || [];
    return state.customers;
  }
  async function loadLevels() {
    if (!isSuperAdmin) return state.levels;
    const { data, error } = await client.from("membership_levels").select("*").order("level", { ascending: true });
    if (error) { console.error(error); throw error; }
    state.levels = data || [];
    return state.levels;
  }
  async function loadQuests() {
    if (!isSuperAdmin) return state.quests;
    const { data, error } = await client
      .from("quests")
      .select("*")
      .is("deleted_at", null)
      .order("id", { ascending: true });
    if (error) { console.error(error); throw error; }
    state.quests = data || [];
    return state.quests;
  }

  /* clearFieldError / showFieldError chỉ là alias trỏ tới hàm đang có trên
     window LÚC FILE NÀY CHẠY. Vì dashboard-games.js (nạp trước) ghi đè 2 hàm
     này bằng bản cục bộ của nó, nên thực tế alias trỏ tới bản đó. */
  return {
    isSuperAdmin, state,
    getLevelForXp, getLevelInfo, getNextLevelInfo, getCheckinQuest,
    formatVND, getISOWeek, periodKeyFor, normalizePhone,
    clearFieldError: window.clearFieldError, showFieldError: window.showFieldError,
    loadCustomers, loadLevels, loadQuests,
  };
})();
