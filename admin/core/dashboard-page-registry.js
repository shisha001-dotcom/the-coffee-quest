/* ══════════════════════════════════════════════
   ADMIN PAGE REGISTRY — admin/core/dashboard-page-registry.js
   ─────────────────────────────────────────────
   Nơi DUY NHẤT quản lý việc: hiện/ẩn page trong .main-content
   + tạo menu item tương ứng trong sidebar.

   TRƯỚC ĐÂY: mỗi module (chat, analytics, banners, media,
   accounts) tự viết một IIFE riêng để:
     - poll bằng setTimeout(tryInject, 100) chờ .menu-group
       xuất hiện trong DOM
     - tự tìm menu item có text "Settings" để chèn trước nó
     - tự định nghĩa lại logic ẩn/hiện page (window.__showPage)

   → 5 bản gần giống hệt nhau, rất dễ lệch nhau khi sửa 1 chỗ
     quên sửa chỗ khác, và cơ chế polling che giấu lỗi thật
     (nếu .menu-group đổi cấu trúc, module âm thầm không hoạt
     động thay vì báo lỗi rõ ràng).

   BÂY GIỜ: các module gọi AdminDashboard.registerPage({...})
   một lần duy nhất. File này đảm bảo DOM đã sẵn sàng (không cần
   polling vì script đặt cuối <body>, DOM sidebar đã tồn tại).

   ⚠️ Load file này TRƯỚC mọi module admin khác (nhưng SAU
      admin/core/dashboard-auth.js vì cần .sidebar đã có sẵn
      user bar để chèn menu item phía trên nó).
   ══════════════════════════════════════════════ */

window.AdminDashboard = (function () {

  /* ── Chờ DOM sẵn sàng — chỉ 1 lần, không polling lặp lại ── */
  function ready(fn) {
    if (document.readyState !== 'loading') fn();
    else document.addEventListener('DOMContentLoaded', fn);
  }

  function findSettingsItem(groupEl) {
    return [...groupEl.querySelectorAll('.menu-item')]
      .find(el => el.textContent.includes('Settings'));
  }

  /* ══════════════════════════════════════════════
     registerPage — đăng ký 1 trang admin (page div + menu item)

     Tham số:
       pageId            id của <div> page trong .main-content (bắt buộc)
       menuId            id của menu item sẽ tạo (bắt buộc)
       icon, label       nội dung hiển thị trên menu item
       badgeHtml         HTML phụ chèn thêm sau label (vd: badge unread)
       group             index của .menu-group (mặc định 1 = "Quản trị")
       placeholderId     nếu HTML đã có sẵn 1 <a id="..."> làm chỗ giữ
                         (như #chatMenuItemPlaceholder) → nâng cấp tại
                         chỗ thay vì tạo mới, giữ đúng vị trí cố định
       insertBeforeMenuId  chèn menu item mới ngay trước 1 menu item
                         khác theo id (nếu không truyền → chèn trước
                         mục "Settings")
       onShow            callback chạy mỗi khi trang được mở (vd:
                         loadAnalytics(), loadMedia()...)
       guard             hàm trả về true/false — nếu false thì KHÔNG
                         đăng ký trang (dùng cho quyền hạn, vd chỉ
                         superadmin mới thấy "Quản lý tài khoản")
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
        if (beforeEl) target.insertBefore(item, beforeEl);
        else target.appendChild(item);
      }

      item.id = menuId;
      item.className = 'menu-item';
      item.style.cssText = 'cursor:pointer;position:relative;';
      item.innerHTML = `<span>${icon}</span> ${label} ${badgeHtml}`;
      item.onclick = () => showPage(pageId, menuId, onShow);
    });
  }

  /* ══════════════════════════════════════════════
     showPage — ẩn tất cả page, hiện đúng 1 page,
     đánh dấu menu item active, gọi onShow nếu có.
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

  /* Tương thích ngược: một số nơi (nav.js, dashboard-media.js cũ)
     vẫn có thể gọi window.__showPage('someId') trực tiếp mà không
     cần quan tâm menu item — giữ lại hàm rút gọn này. */
  window.__showPage = function (pageId) {
    document.querySelectorAll('.main-content > div[id$="Page"]')
      .forEach(el => { el.style.display = 'none'; });
    const el = document.getElementById(pageId);
    if (el) el.style.display = '';
  };

  return { registerPage, showPage, ready };
})();
