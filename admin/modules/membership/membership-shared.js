/* ══════════════════════════════════════════════
   MEMBERSHIP SHARED — admin/modules/membership/membership-shared.js
   ─────────────────────────────────────────────
   ⚠️ CẬP NHẬT THEO SCHEMA SQL V1 (2026-07-16):
   - customers: bỏ `age`/`last_checkin` → dùng `date_of_birth`/
     `last_checkin_date`; thêm `total_profit`; lọc `deleted_at IS NULL`
     (soft delete) ở loadCustomers().
   - quests: thêm `code`, `is_checkin`, `deleted_at` → loadQuests()
     lọc deleted_at IS NULL. Thêm helper getCheckinQuest() để các
     module khác (dashboard-customers.js) biết quest nào là quest
     check-in hệ thống (không cho sửa/xoá/tick tay).
   - customer_quests: đã đổi field `completed`→`is_completed`,
     thêm `xp_awarded`, `related_order_id`. KHÔNG còn state riêng ở
     đây vì dữ liệu này gắn theo từng khách hàng (đã fetch riêng
     trong dashboard-customers.js::openCustomerDetail() — không đổi
     vị trí, chỉ đổi tên field khi dùng).
   - Bỏ hoàn toàn: customer_checkins, customer_transactions (2 bảng
     đã bị DROP) — không còn helper nào tham chiếu chúng.

   Hàm THUẦN (không đụng DOM) dùng chung giữa 3 file con của domain
   Membership: dashboard-customers.js / dashboard-quests.js /
   dashboard-levels.js.

   ⚠️ Load file này TRƯỚC 3 file kia, NGAY SAU
      core/dashboard-auth.js + core/dashboard-page-registry.js.

   Exports (window.Membership.*):
     state           — kho dữ liệu dùng chung (customers/levels/quests)
     isSuperAdmin
     getLevelForXp(xp) / getLevelInfo(level) / getNextLevelInfo(level)
     getCheckinQuest()    — MỚI: trả về quest hệ thống is_checkin=true
     formatVND(n)
     getISOWeek(d) / periodKeyFor(type)
     normalizePhone(raw)
     clearFieldError(id) / showFieldError(id, msg)
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
  /* MỚI: quest hệ thống check-in — chỉ có đúng 1 dòng is_checkin=true
     (đảm bảo bởi unique index ở DB). Dùng để: (1) ẩn nút tick tay
     "+1 tiến độ" cho quest này trong modal chi tiết khách (check-in
     giờ HOÀN TOÀN tự động theo đơn hàng đầu ngày), (2) chặn sửa/xoá
     trong tab Nhiệm vụ. */
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
  /* Chuẩn hoá SĐT VN: "+84 912 345 678" / "0912-345-678" → "0912345678" */
  function normalizePhone(raw) {
    let p = (raw || "").trim().replace(/[\s.\-()]/g, "");
    if (p.startsWith("+84")) p = "0" + p.slice(3);
    else if (p.startsWith("84") && p.length > 9) p = "0" + p.slice(2);
    return p;
  }

  /* ── VALIDATE FIELD ERROR ── */
  function clearFieldError(id) {
    const el = document.getElementById(id);
    if (!el) return;
    el.style.borderColor = "";
    document.getElementById(id + "Error")?.remove();
  }
  function showFieldError(id, msg) {
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
    el.addEventListener("input", () => clearFieldError(id), { once: true });
  }

  /* ── FETCH — cập nhật state, các module con tự render sau khi await ── */
  async function loadCustomers() {
    if (!isSuperAdmin) return state.customers;
    const { data, error } = await client
      .from("customers")
      .select("*")
      .is("deleted_at", null)             // ⚠️ MỚI: soft-delete filter
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
      .is("deleted_at", null)             // ⚠️ MỚI: soft-delete filter
      .order("id", { ascending: true });
    if (error) { console.error(error); throw error; }
    state.quests = data || [];
    return state.quests;
  }

  return {
    isSuperAdmin, state,
    getLevelForXp, getLevelInfo, getNextLevelInfo, getCheckinQuest,
    formatVND, getISOWeek, periodKeyFor, normalizePhone,
    clearFieldError, showFieldError,
    loadCustomers, loadLevels, loadQuests,
  };
})();
