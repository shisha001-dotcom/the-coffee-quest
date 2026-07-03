/* ══════════════════════════════════════════════
   ADMIN PERMISSIONS — admin/core/dashboard-permissions.js
   ─────────────────────────────────────────────
   Nơi DUY NHẤT định nghĩa các role quản trị và trang nào
   mỗi role được phép xem trong sidebar.

   Muốn thêm role mới hoặc đổi quyền truy cập → CHỈ sửa
   ROLES / RESTRICTED_PAGES ở đây, không cần đụng vào
   từng module khác.

   ⚠️ Load file này TRƯỚC admin/core/dashboard-auth.js
      (auth.js dùng AdminPermissions.roleInfo() để vẽ user bar)
      và TRƯỚC mọi module có dùng AdminPermissions.can()
      trong guard.
   ══════════════════════════════════════════════ */

window.AdminPermissions = (function () {

  /* ── Danh sách role + nhãn/màu hiển thị ── */
  const ROLES = {
    superadmin: { label: "Super Admin", color: "#6c5ce7" },
    editor:     { label: "Editor",      color: "#00b894" },
    barstaff:   { label: "Bar Staff",   color: "#0984e3" },
  };

  /* ── Trang nào (pageId trong registerPage) bị ẨN với role nào ──
     Super Admin luôn thấy tất cả (không cần liệt kê ở đây).
     Bar Staff: xem được mọi mục TRỪ Quản lý tài khoản / Banner /
     Thư viện Media. */
  const RESTRICTED_PAGES = {
    barstaff: ["accountsPage", "bannersPage", "mediaPage"],
    editor:   [],
  };

  function roleInfo(role) {
    return ROLES[role] || { label: role || "—", color: "#888" };
  }

  function isSuperAdmin(role) {
    return role === "superadmin";
  }

  /* can(role, pageId) → true nếu role được phép thấy/vào trang đó */
  function can(role, pageId) {
    if (isSuperAdmin(role)) return true;
    const blocked = RESTRICTED_PAGES[role] || [];
    return !blocked.includes(pageId);
  }

  return { ROLES, roleInfo, isSuperAdmin, can };
})();
