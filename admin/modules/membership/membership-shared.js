/* ══════════════════════════════════════════════
   MEMBERSHIP SHARED — admin/modules/membership/membership-shared.js
   ─────────────────────────────────────────────
   ⚠️ CẬP NHẬT THEO SCHEMA SQL V1 (2026-07-16):
   - customers: bỏ `age`/`last_checkin` → dùng `date_of_birth`/
     `last_checkin_date`; thêm `total_profit`; lọc `deleted_at IS NULL`.
   - quests: thêm `code`, `is_checkin`, `deleted_at`. Thêm helper
     getCheckinQuest().
   - Bỏ hoàn toàn: customer_checkins, customer_transactions.

   ⚠️ SỬA (dedupe — chuẩn hoá SĐT VN): normalizePhone() alias thẳng
   về window.normalizePhoneVN (js/shared-utils.js).

   ⚠️ DEDUPE (mới): clearFieldError/showFieldError cục bộ đã bị xoá
   — expose ở đây giờ chỉ alias thẳng về window.clearFieldError /
   window.showFieldError (js/shared-utils.js), dùng chung với
   dashboard-games.js, dashboard-game-detail.js, dashboard-accounts.js,
   dashboard-drinks.js. Tên gọi qua M.clearFieldError()/M.showFieldError()
   ở dashboard-customers.js/dashboard-quests.js KHÔNG cần đổi.

   ⚠️ Load file này TRƯỚC 3 file kia, NGAY SAU
      core/dashboard-auth.js + core/dashboard-page-registry.js.
      (Cần js/shared-utils.js đã load TRƯỚC file này.)

   Exports (window.Membership.*):
     state, isSuperAdmin
     getLevelForXp(xp) / getLevelInfo(level) / getNextLevelInfo(level)
     getCheckinQuest()
     formatVND(n)
     getISOWeek(d) / periodKeyFor(type)
     normalizePhone(raw)
     clearFieldError(id) / showFieldError(id, msg, opts?)
     loadCustomers() / loadLevels() / loadQuests()
   ══════════════════════════════════════════════ */

window.Membership = (function () {

  const isSuperAdmin = window.AdminPermissions.isSuperAdmin(currentSession.role);

  const state = {
    customers: [],
    levels: [],
    quests: [],
  };

  /* ── HELPERS THUẦN ── */
  function getLevelForXp(xp) {
    const sorted = [...state.levels].sort((a, b) => a.level - b.level);
    let lvl = sorted[0]?.level || 1;
    for (const l of sorted) if (xp >= l.xp_required) lvl = l.level;
    return lvl;
  }
  function getLevelInfo(level) {
    return state.levels.find(l => l.level === level) || { rank_name: "—", rank_icon: "⭐", xp_required: 0 };
  }
  function getNextLevelInfo(level) {
    return state.levels.find(l => l.level === level + 1) || null;
  }
  function getCheckinQuest() {
    return state.quests.find(q => q.is_checkin) || null;
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
  const normalizePhone = window.normalizePhoneVN;

  /* ── FETCH — cập nhật state, các module con tự render sau khi await ── */
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

  return {
    isSuperAdmin, state,
    getLevelForXp, getLevelInfo, getNextLevelInfo, getCheckinQuest,
    formatVND, getISOWeek, periodKeyFor, normalizePhone,
    clearFieldError: window.clearFieldError, showFieldError: window.showFieldError,
    loadCustomers, loadLevels, loadQuests,
  };
})();
