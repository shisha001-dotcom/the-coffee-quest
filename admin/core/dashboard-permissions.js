/* ══════════════════════════════════════════════
   ADMIN PERMISSIONS — admin/core/dashboard-permissions.js
   ─────────────────────────────────────────────
   VAI TRÒ
   Nơi DUY NHẤT định nghĩa:
     - Có những role nào, nhãn + màu hiển thị của từng role.
     - Trang nào bị ẨN với role nào.
     - Role nào chỉ được XEM (không thêm/sửa/xoá).
     - Các quyền riêng của domain Đơn hàng (tạo đơn, xem giá vốn).

   Muốn thêm role mới hoặc đổi quyền → CHỈ sửa các hằng số ở đầu
   file này; các module khác gọi hàm, không so sánh chuỗi role thủ công.

   ⚠️ ĐÂY CHỈ LÀ LỚP GIAO DIỆN. Ẩn/khoá nút ở đây không thay thế được
   phân quyền thật ở phía server (Row Level Security của Supabase).

   THỨ TỰ NẠP
   File này là <script> TĨNH trong dashboard.html (nạp trước
   dashboard-auth.js) vì dashboard-auth.js dùng roleInfo() để vẽ thanh
   người dùng, và mọi module dùng window.AdminPermissions ngay khi chạy.

   NƠI ĐÃ DÙNG TRỰC TIẾP CÁC HÀM Ở ĐÂY
   - can()              → banners, media (dùng RESTRICTED_PAGES)
   - isSuperAdmin()     → customers, accounts, media (quyền xoá)…
   - isReadOnly()       → games, drinks, game-detail, ingredients, settings, orders (huỷ đơn)
   - canCreateOrders()  → orders (nút "Tạo đơn hàng mới")
   - canViewCost()      → orders (ẩn giá vốn / lợi nhuận)
   - applyReadOnlyForm()→ modal game, modal đồ uống, trang chi tiết game
   Riêng trang "Kiểm kê tồn kho" KHÔNG dùng file này — có quy tắc quyền
   riêng khai báo ngay trong dashboard-inventory-count.js.
   ══════════════════════════════════════════════ */

window.AdminPermissions = (function () {

  /* ══════════════════════════════════════════════
     DANH SÁCH ROLE + NHÃN / MÀU HIỂN THỊ
     ─────────────────────────────────────────────
     Key (superadmin/editor/barstaff) khớp với cột `admin_users.role`
     trong database — KHÔNG đổi key nếu chưa đổi dữ liệu DB.

     label → chữ hiển thị (badge trong thanh người dùng, bảng tài khoản)
     color → màu HEX dùng làm: nền avatar tròn, nền badge role, màu chữ/nền
             nhạt của badge ở bảng "Quản lý tài khoản".
       superadmin  tím  #6c5ce7  (trùng màu chủ đạo --primary của admin)
       editor      xanh lá #00b894
       barstaff    xanh dương #0984e3
     ══════════════════════════════════════════════ */
  const ROLES = {
    superadmin: { label: "Super Admin", color: "#6c5ce7" },
    editor:     { label: "Editor",      color: "#00b894" },
    barstaff:   { label: "Bar Staff",   color: "#0984e3" },
  };

  /* ══════════════════════════════════════════════
     TRANG BỊ ẨN THEO ROLE
     ─────────────────────────────────────────────
     Key = role, giá trị = danh sách pageId (đúng id div trang khi
     registerPage()). Super Admin luôn thấy tất cả, không cần liệt kê.
     Hiện có: Bar Staff không thấy Quản lý tài khoản / Banners / Thư viện Media.

     ⚠️ Cơ chế này chỉ có hiệu lực với trang nào GỌI can(role, pageId)
     trong guard (hiện là banners, media). Editor để mảng RỖNG nghĩa là
     "mặc định được xem mọi trang dùng cơ chế này". Trang nhạy cảm chỉ
     dành cho Super Admin (Khách hàng, Tài khoản) tự viết
     guard: () => isSuperAdmin thay vì dựa vào bảng này.
     ══════════════════════════════════════════════ */
  const RESTRICTED_PAGES = {
    barstaff: ["accountsPage", "bannersPage", "mediaPage"],
    editor:   [],
  };

  /* Role CHỈ ĐƯỢC XEM: không thêm/sửa/xoá ở các trang được phép truy cập
     (Boardgames, Đồ uống, Kho nguyên liệu, Settings…). */
  const READONLY_ROLES = ["barstaff"];

  /* Ngoại lệ dành riêng cho Đơn hàng: role trong READONLY_ROLES nhưng
     VẪN được tạo đơn. Không áp dụng cho huỷ đơn/huỷ dòng (việc đó vẫn
     bị chặn bởi isReadOnly). Role KHÔNG nằm trong READONLY_ROLES thì
     luôn được tạo đơn nên không cần khai báo ở đây.
     Muốn chặn 1 role read-only tạo đơn: đừng thêm role đó vào danh sách này. */
  const ORDER_CREATE_EXTRA_ROLES = ["barstaff"];

  /* Role KHÔNG được thấy giá vốn nguyên liệu / lợi nhuận gộp (trong
     preview tạo đơn và file Excel xuất từ trang Đơn hàng). ĐỘC LẬP với
     2 danh sách trên — khai báo tường minh, không suy ra từ nhau. */
  const COST_HIDDEN_ROLES = ["barstaff"];

  /* Trả về { label, color } của role để hiển thị.
     ⚠️ HARDCODE fallback cho role lạ (chưa khai báo trong ROLES):
     label = chính chuỗi role (hoặc "—" nếu rỗng), color = "#888" (xám). */
  function roleInfo(role) {
    return ROLES[role] || { label: role || "—", color: "#888" };
  }

  function isSuperAdmin(role) {
    return role === "superadmin";
  }

  /* can(role, pageId) → true nếu role được phép vào trang pageId.
     Super Admin: luôn true. Role không có trong ROLES: luôn false
     (default-deny, tránh lộ trang khi gõ sai / quên khai báo role mới). */
  function can(role, pageId) {
    if (isSuperAdmin(role)) return true;
    if (!ROLES[role]) return false; // role lạ → default-deny
    const blocked = RESTRICTED_PAGES[role] || [];
    return !blocked.includes(pageId);
  }

  /* isReadOnly(role) → true nếu role chỉ được xem. Dùng cho mọi nơi
     KHÔNG phải "tạo đơn hàng" (kể cả huỷ đơn / huỷ dòng). */
  function isReadOnly(role) {
    return READONLY_ROLES.includes(role);
  }

  /* canCreateOrders(role) → true nếu:
       - role không thuộc READONLY_ROLES (luôn được), HOẶC
       - role thuộc READONLY_ROLES nhưng có trong ORDER_CREATE_EXTRA_ROLES. */
  function canCreateOrders(role) {
    if (!READONLY_ROLES.includes(role)) return true;
    return ORDER_CREATE_EXTRA_ROLES.includes(role);
  }

  /* canViewCost(role) → false nếu role thuộc COST_HIDDEN_ROLES. */
  function canViewCost(role) {
    return !COST_HIDDEN_ROLES.includes(role);
  }

  /* ══════════════════════════════════════════════
     applyReadOnlyForm — hàm DUY NHẤT khoá/mở 1 form (modal hoặc trang
     chi tiết) theo chế độ chỉ xem. Đừng viết lại logic này ở module mới.

     Tham số:
       container     phần tử gốc chứa form (modal-box, div trang…). LƯU Ý: mọi
                     input/textarea/select BÊN TRONG container đều bị disabled,
                     kể cả ô tìm kiếm nếu nó nằm trong container.
       readonly      true = khoá, false = mở
       saveBtn       nút Lưu — ẩn khi readonly
       deleteBtn     nút Xoá — ẩn khi readonly. Khi mở lại, hiện hay không tuỳ
                     deleteBtn.dataset.wasVisible ("1" = đang sửa → hiện,
                     "0" = đang thêm mới → ẩn). Module gọi phải tự gán
                     dataset.wasVisible trước khi gọi hàm này.
       extraDisable  mảng phần tử khác cần disabled thêm (vd nút mở emoji picker)

     ⚠️ HARDCODE: khi hiện lại nút Xoá dùng display:"inline-flex" (khớp
     class .btn trong dashboard.css). Nếu đổi kiểu hiển thị của .btn
     thì đổi giá trị này cho khớp.
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
