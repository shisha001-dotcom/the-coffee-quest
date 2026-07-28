/* ══════════════════════════════════════════════
   ADMIN PERMISSIONS — admin/core/dashboard-permissions.js
   ─────────────────────────────────────────────
   Nơi DUY NHẤT định nghĩa các role quản trị, trang nào mỗi
   role được phép xem, và role nào chỉ được XEM (không được
   thêm/sửa/xóa bất kỳ mục nào).

   Muốn thêm role mới hoặc đổi quyền truy cập → CHỈ sửa
   ROLES / RESTRICTED_PAGES / READONLY_ROLES ở đây, không cần
   đụng vào từng module khác.

   THAY ĐỔI:
   - can(role, pageId): role KHÔNG tồn tại trong ROLES (vd role
     lạ/bị gõ sai, hoặc role mới thêm ở DB nhưng quên khai báo
     ở đây) → mặc định BỊ CHẶN (an toàn hơn là mặc định cho xem
     hết như bản cũ). Role đã biết vẫn hoạt động y hệt bản cũ.
   - applyReadOnlyForm(container, opts): hàm DUY NHẤT khóa/mở
     form khi ở chế độ chỉ xem — thay thế 3 bản gần giống hệt
     nhau từng nằm rải rác ở dashboard-games.js, dashboard-drinks.js
     và dashboard-game-detail.js (setModalReadOnly / setDrinkModalReadOnly
     / setGameDetailReadOnly). Dùng được cho cả modal lẫn page
     chi tiết vì chỉ cần 1 container gốc (modal-box hoặc page div).

   ⚠️ Load file này TRƯỚC admin/core/dashboard-auth.js
      (auth.js dùng AdminPermissions.roleInfo() để vẽ user bar)
      và TRƯỚC mọi module có dùng AdminPermissions.can() /
      isReadOnly() / applyReadOnlyForm() trong guard hoặc render.
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

  /* ── Role nào CHỈ ĐƯỢC XEM — không được thêm/sửa/xóa bất kỳ
     mục nào ở TẤT CẢ các trang mà role đó được phép truy cập
     (Boardgames, Đồ uống...). ── */
  const READONLY_ROLES = ["barstaff"];

  function roleInfo(role) {
    return ROLES[role] || { label: role || "—", color: "#888" };
  }

  function isSuperAdmin(role) {
    return role === "superadmin";
  }

  /* can(role, pageId) → true nếu role được phép thấy/vào trang đó.
     Role không tồn tại trong ROLES (vd bị gõ sai / role mới chưa
     khai báo) → mặc định BỊ CHẶN, tránh lộ trang nhạy cảm ngoài ý muốn. */
  function can(role, pageId) {
    if (isSuperAdmin(role)) return true;
    if (!ROLES[role]) return false; // role lạ → default-deny
    const blocked = RESTRICTED_PAGES[role] || [];
    return !blocked.includes(pageId);
  }

  /* isReadOnly(role) → true nếu role chỉ được xem, không được
     thêm/sửa/xóa ở bất kỳ trang nào */
  function isReadOnly(role) {
    return READONLY_ROLES.includes(role);
  }

  /* ══════════════════════════════════════════════
     applyReadOnlyForm — nơi DUY NHẤT khóa/mở 1 form (modal
     hoặc page chi tiết) theo chế độ chỉ xem.

     Tham số:
       container   phần tử gốc chứa form (vd modal-box, page div)
       readonly    true/false
       saveBtn     nút Lưu — ẩn khi readonly
       deleteBtn   nút Xóa — ẩn khi readonly; khi KHÔNG readonly,
                   hiện lại đúng theo trạng thái trước đó qua
                   deleteBtn.dataset.wasVisible ("1"/"0"), để phân
                   biệt "đang thêm mới" (không có nút xóa) và
                   "đang sửa" (có nút xóa)
       extraDisable  mảng thêm các phần tử khác cần disabled
                     (vd: nút toggle emoji picker)
     ══════════════════════════════════════════════ */
  function applyReadOnlyForm(container, { readonly, saveBtn, deleteBtn, extraDisable = [] } = {}) {
    if (!container) return;

    container.querySelectorAll("input, textarea, select").forEach(el => { el.disabled = readonly; });
    extraDisable.forEach(el => { if (el) el.disabled = readonly; });

    if (saveBtn) saveBtn.style.display = readonly ? "none" : "";

    if (deleteBtn) {
      deleteBtn.style.display = readonly
        ? "none"
        : (deleteBtn.dataset.wasVisible === "1" ? "inline-flex" : "none");
    }
  }

  return { ROLES, roleInfo, isSuperAdmin, can, isReadOnly, applyReadOnlyForm };
})();
