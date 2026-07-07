/* ══════════════════════════════════════════════
   MEMBERSHIP SHARED — admin/modules/membership/membership-shared.js
   ─────────────────────────────────────────────
   Hàm THUẦN (không đụng DOM) dùng chung giữa 3 file con của domain
   Membership: dashboard-customers.js / dashboard-quests.js /
   dashboard-levels.js. Tách ra để tránh copy-paste khi 3 file trước
   đây từng nằm chung trong 1 file dashboard-customers.js ~700 dòng.

   ⚠️ Load file này TRƯỚC 3 file kia (dashboard-customers.js,
      dashboard-quests.js, dashboard-levels.js), NGAY SAU
      core/dashboard-auth.js + core/dashboard-page-registry.js.

   Exports (window.Membership.*):
     state           — kho dữ liệu dùng chung (allCustomers/allLevels/allQuests)
     isSuperAdmin    — boolean, tính 1 lần khi module load
     getLevelForXp(xp)
     getLevelInfo(level)
     getNextLevelInfo(level)
     formatVND(n)
     getISOWeek(d)
     periodKeyFor(type)
     normalizePhone(raw)
     clearFieldError(id) / showFieldError(id, msg)   — validate UI dùng chung
     loadCustomers() / loadLevels() / loadQuests()   — fetch Supabase, cập nhật state
   ══════════════════════════════════════════════ */

window.Membership = (function () {

  const isSuperAdmin = window.AdminPermissions.isSuperAdmin(currentSession.role);

  /* ── STATE DÙNG CHUNG — 3 module con đọc/ghi qua đây thay vì
     mỗi file tự giữ 1 bản riêng (tránh lệch dữ liệu giữa các tab) ── */
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

  /* ── VALIDATE FIELD ERROR — style dùng chung (giống các module khác) ── */
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
    const { data, error } = await client.from("customers").select("*").order("xp", { ascending: false });
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
    const { data, error } = await client.from("quests").select("*").order("id", { ascending: true });
    if (error) { console.error(error); throw error; }
    state.quests = data || [];
    return state.quests;
  }

  return {
    isSuperAdmin, state,
    getLevelForXp, getLevelInfo, getNextLevelInfo,
    formatVND, getISOWeek, periodKeyFor, normalizePhone,
    clearFieldError, showFieldError,
    loadCustomers, loadLevels, loadQuests,
  };
})();
