/* ══════════════════════════════════════════════
   ADMIN PAGE REGISTRY — admin/core/dashboard-page-registry.js
   ─────────────────────────────────────────────
   VAI TRÒ
   Nơi DUY NHẤT lo 2 việc cho các trang "động" của Admin:
     (a) Tạo (hoặc nâng cấp) 1 mục menu trong sidebar.
     (b) Hiện đúng 1 trang trong .main-content và ẩn các trang còn lại.

   Mỗi module chỉ cần gọi AdminDashboard.registerPage({...}) MỘT LẦN.

   QUY ƯỚC BẮT BUỘC ĐỂ showPage() HOẠT ĐỘNG
   - Div của trang phải là con TRỰC TIẾP của .main-content và có id
     KẾT THÚC bằng chữ "Page" (vd: ordersPage, customerDetailPage).
     Selector ẩn/hiện là  `.main-content > div[id$="Page"]`  —
     đặt id không kết thúc bằng "Page" thì trang sẽ KHÔNG bị ẩn khi
     chuyển sang trang khác.
   - pageId / menuId phải DUY NHẤT toàn hệ thống. Hàm này KHÔNG kiểm
     tra trùng: trùng thì module nạp sau âm thầm ghi đè `onclick` của
     module nạp trước, không có cảnh báo nào.

   THỨ TỰ NẠP
   File này là script đầu tiên trong SCRIPT_SEQUENCE
   (core/dashboard-auth.js), nên khi các module khác chạy thì
   window.AdminDashboard đã tồn tại. Các module gọi registerPage() ngay
   ở top-level file của chúng.
   ══════════════════════════════════════════════ */

window.AdminDashboard = (function () {

  /* Chạy fn khi DOM sẵn sàng. Vì script được nạp SAU khi xác thực
     xong (DOM đã parse), thực tế fn chạy ngay lập tức. Nhánh
     DOMContentLoaded chỉ là phòng hờ. */
  function ready(fn) {
    if (document.readyState !== 'loading') fn();
    else document.addEventListener('DOMContentLoaded', fn);
  }

  /* Tìm mục menu "⚙️ Settings" tĩnh trong 1 group — dùng làm điểm neo
     để chèn các mục mới ngay TRƯỚC nó.
     ⚠️ HARDCODE: so khớp theo CHỮ "Settings" trong nội dung menu
     (xem sidebar trong dashboard.html). Đổi chữ hiển thị của mục này
     thì phải đổi cả chuỗi 'Settings' ở đây (settings-shared.js cũng
     tìm theo đúng chữ này). */
  function findSettingsItem(groupEl) {
    return [...groupEl.querySelectorAll('.menu-item')]
      .find(el => el.textContent.includes('Settings'));
  }

  /* ══════════════════════════════════════════════
     registerPage — đăng ký 1 trang admin (menu item + hành vi mở trang)

     Tham số:
       pageId             id của <div> trang trong .main-content (bắt buộc,
                          phải kết thúc bằng "Page" — xem đầu file)
       menuId             id gán cho menu item (bắt buộc)
       icon               emoji hiển thị đầu dòng menu (mặc định '📄')
       label              chữ hiển thị trên menu
       badgeHtml          HTML chèn thêm sau label (vd: chấm số tin chưa
                          đọc của Chat). Nó được đặt position:absolute nên
                          cần menu item có position:relative (đã có bên dưới)
       group              chỉ số của .menu-group trong sidebar:
                            0 = nhóm "Hệ thống", 1 = nhóm "Quản trị"
                          (mặc định 1). Nếu chỉ số không tồn tại → dùng nhóm 0.
       placeholderId      id của 1 <a> ĐÃ CÓ SẴN trong dashboard.html (vd
                          chatMenuItemPlaceholder, ordersMenuItemPlaceholder)
                          → nâng cấp tại chỗ, giữ đúng vị trí cố định thay vì
                          tạo mới. Khi đó insertBeforeMenuId bị bỏ qua.
       insertBeforeMenuId chèn menu item mới ngay trước 1 menu item khác
                          (theo id). Không truyền → chèn trước mục "Settings";
                          không tìm thấy điểm neo → thêm vào cuối group.
       onShow             callback chạy MỖI LẦN trang được mở (vd: tải lại dữ liệu)
       guard              hàm trả true/false; false → KHÔNG đăng ký gì cả
                          (dùng cho phân quyền). Lưu ý: nếu trang dùng
                          placeholderId, phần tử placeholder tĩnh vẫn nằm trong
                          HTML — module đó phải tự remove()/ẩn nó (xem
                          dashboard-inventory-count.js).
     ══════════════════════════════════════════════ */
  function registerPage({
    pageId, menuId, icon = '📄', label = '', badgeHtml = '',
    group = 1, placeholderId = null, insertBeforeMenuId = null,
    onShow = null, guard = null,
  }) {
    if (typeof guard === 'function' && !guard()) return;

    ready(() => {
      const groups = document.querySelectorAll('.menu-group');
      const target = groups[group] || groups[0];
      if (!target) {
        console.warn('[AdminDashboard] Không tìm thấy .menu-group cho', menuId);
        return;
      }

let item = placeholderId ? document.getElementById(placeholderId) : null;
      if (!item) {
        item = document.createElement('a');
        const beforeEl = insertBeforeMenuId
          ? document.getElementById(insertBeforeMenuId)
          : findSettingsItem(target);
        if (beforeEl && beforeEl.parentElement === target) {
          target.insertBefore(item, beforeEl);
        } else {
          target.appendChild(item);
        }
      }

      /* Giao diện menu item lấy từ class `.menu-item` (dashboard.css) —
         chỉnh màu/cỡ chữ/bo góc ở đó. Chuỗi style inline dưới đây chỉ
         thêm 2 thứ: con trỏ bàn tay và position:relative (để badge
         position:absolute bám theo dòng menu). */
      item.id = menuId;
      item.className = 'menu-item';
      item.style.cssText = 'cursor:pointer;position:relative;';
      item.innerHTML = `<span>${icon}</span> ${label} ${badgeHtml}`;
      item.onclick = () => showPage(pageId, menuId, onShow);
    });
  }

  /* ══════════════════════════════════════════════
     showPage — chuyển trang:
       1. Ẩn mọi trang `.main-content > div[id$="Page"]`.
       2. Hiện trang pageId (bỏ display để về giá trị mặc định của CSS).
       3. Xoá class `active` khỏi mọi mục menu, gắn lại cho menuId.
       4. Gọi onShow() nếu có.
     ══════════════════════════════════════════════ */
  function showPage(pageId, menuId, onShow) {
    document.querySelectorAll('.main-content > div[id$="Page"]')
      .forEach(el => { el.style.display = 'none'; });

    const el = document.getElementById(pageId);
    if (el) el.style.display = '';

    document.querySelectorAll('.menu-item, .menu-item-parent, .menu-sub-item')
      .forEach(el => el.classList.remove('active'));
    document.getElementById(menuId)?.classList.add('active');

    if (typeof onShow === 'function') onShow();
  }

  /* Bản rút gọn: CHỈ ẩn/hiện trang, KHÔNG đổi menu active và KHÔNG gọi
     onShow. Dùng cho:
       - 3 trang tĩnh (Dashboard/Boardgames/Drinks) trong core/dashboard-nav.js
         — nơi tự quản lý class `active` bằng clearActive();
       - các trang "chi tiết" không có menu riêng (gameDetailPage,
         customerDetailPage) — mở từ nút bên trong trang khác. */
  window.__showPage = function (pageId) {
    document.querySelectorAll('.main-content > div[id$="Page"]')
      .forEach(el => { el.style.display = 'none'; });
    const el = document.getElementById(pageId);
    if (el) el.style.display = '';
  };

  return { registerPage, showPage, ready };
})();
