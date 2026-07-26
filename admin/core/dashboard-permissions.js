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
   - ⚠️ MỚI (barstaff được tạo đơn hàng nhưng không xem giá vốn):
     Thêm ORDER_CREATE_EXTRA_ROLES + canCreateOrders(role) — cho
     phép 1 số role READ-ONLY vẫn được TẠO đơn hàng (khác với việc
     được sửa/xóa toàn bộ nơi khác, vẫn dùng isReadOnly() như cũ).
     Thêm COST_HIDDEN_ROLES + canViewCost(role) — role trong danh
     sách này KHÔNG được thấy giá vốn nguyên liệu / lợi nhuận gộp,
     dù có được tạo đơn hàng hay không. 2 danh sách này ĐỘC LẬP với
     READONLY_ROLES — không tự suy ra từ nhau, phải khai báo tường
     minh để tránh vô tình cấp nhầm quyền khi thêm role mới.
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

  /* ── ⚠️ MỚI: role trong READONLY_ROLES nhưng vẫn được TẠO đơn
     hàng (KHÔNG áp dụng cho huỷ đơn/huỷ dòng — việc đó vẫn dùng
     isReadOnly() như trước, giữ nguyên bị chặn). Chỉ liệt kê role
     cần ngoại lệ; role không nằm trong READONLY_ROLES thì luôn
     được tạo đơn nên không cần khai báo ở đây. ── */
  const ORDER_CREATE_EXTRA_ROLES = ["barstaff"];

  /* ── ⚠️ MỚI: role KHÔNG được thấy giá vốn nguyên liệu / lợi
     nhuận gộp (trong preview tạo đơn, báo cáo, v.v.). Độc lập với
     READONLY_ROLES/ORDER_CREATE_EXTRA_ROLES — 1 role có thể vừa
     được tạo đơn vừa bị giấu giá vốn, như barstaff hiện tại. ── */
  const COST_HIDDEN_ROLES = ["barstaff"];

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
     thêm/sửa/xóa ở bất kỳ trang nào. Dùng nguyên như cũ cho mọi nơi
     KHÔNG phải "tạo đơn hàng" (bao gồm cả huỷ đơn/huỷ dòng). */
  function isReadOnly(role) {
    return READONLY_ROLES.includes(role);
  }

  /* ── ⚠️ MỚI: canCreateOrders(role) ──
     true nếu role được phép tạo đơn hàng mới:
       - Role KHÔNG thuộc READONLY_ROLES → luôn được (hành vi cũ).
       - Role thuộc READONLY_ROLES NHƯNG có trong
         ORDER_CREATE_EXTRA_ROLES → vẫn được (ngoại lệ mới).
     Không ảnh hưởng tới huỷ đơn/huỷ dòng — chỗ đó tiếp tục dùng
     isReadOnly() như trước. */
  function canCreateOrders(role) {
    if (!READONLY_ROLES.includes(role)) return true;
    return ORDER_CREATE_EXTRA_ROLES.includes(role);
  }

  /* ── ⚠️ MỚI: canViewCost(role) ──
     true nếu role được phép thấy giá vốn nguyên liệu / lợi nhuận
     gộp. Mặc định TRUE cho mọi role, trừ role nằm trong
     COST_HIDDEN_ROLES. */
  function canViewCost(role) {
    return !COST_HIDDEN_ROLES.includes(role);
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

  return {
    ROLES, roleInfo, isSuperAdmin, can, isReadOnly,
    canCreateOrders, canViewCost,
    applyReadOnlyForm,
  };
})();
