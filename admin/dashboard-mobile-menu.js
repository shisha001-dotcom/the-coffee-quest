/* ══════════════════════════════════════════════
   ADMIN MOBILE MENU — admin/dashboard-mobile-menu.js
   ─────────────────────────────────────────────
   VAI TRÒ
   Đóng/mở sidebar dạng drawer (trượt từ trái) trên tablet/điện thoại.
   File này CHỈ bật/tắt class — toàn bộ hình dạng, màu sắc, hiệu ứng
   trượt nằm trong CSS.

   PHỤ THUỘC HTML (có sẵn trong admin/dashboard.html)
     #adminMenuToggle   nút hamburger góc trên trái
     #adminMenuOverlay  lớp nền tối phía sau drawer
     .sidebar           thanh menu bên trái
   Thiếu 1 trong 3 phần tử → file tự thoát, không báo lỗi.

   CÁCH HOẠT ĐỘNG
     - Mở  : thêm class `open` cho .sidebar + class `show` cho overlay.
     - Đóng: gỡ 2 class đó.
     - Bấm nút hamburger → đảo trạng thái; bấm overlay → đóng.
     - Bấm 1 mục menu (.menu-item / .menu-sub-item) khi màn hình hẹp → đóng.
       Mục `.menu-item-parent` (mục cha có submenu) thì KHÔNG đóng, để còn
       xem được submenu. Sidebar hiện tại không còn submenu nên nhánh này
       chỉ là phần dự phòng.
     - Khi cửa sổ giãn rộng qua ngưỡng desktop → tự đóng.

   ⚠️ HARDCODE — NGƯỠNG 900px
   Con số 900 (2 chỗ bên dưới) phải KHỚP với `@media (max-width: 900px)`
   trong admin/dashboard.css (phần "ADMIN MOBILE MENU") và
   admin/dashboard-mobile.css. Đổi ngưỡng ở 1 nơi thì phải đổi cả các nơi còn lại.

   ĐỔI GIAO DIỆN Ở ĐÂU (admin/dashboard.css, mục "ADMIN MOBILE MENU")
     - Nút hamburger #adminMenuToggle: kích thước 44×44px, vị trí
       top/left 14px, nền var(--sidebar-bg), chữ trắng, icon 20px.
       (Icon là SVG 3 gạch trong dashboard.html.)
     - Lớp nền #adminMenuOverlay: rgba(0,0,0,.5), mờ dần .25s.
     - Drawer .sidebar (≤900px): trượt .3s, rộng tối đa 85vw, đổ bóng.

   ⚠️ Nút hamburger có aria-expanded="false" ghi cứng trong HTML nhưng
   script này KHÔNG cập nhật thuộc tính đó khi mở/đóng.

   THỨ TỰ NẠP
   Là FINAL_SCRIPT trong core/dashboard-auth.js — nạp sau cùng, khi
   .sidebar và các mục menu do registerPage() tạo đã có trong DOM.
   ══════════════════════════════════════════════ */
(function () {
  const toggle  = document.getElementById("adminMenuToggle");
  const overlay = document.getElementById("adminMenuOverlay");
  const sidebar = document.querySelector(".sidebar");

  if (!toggle || !overlay || !sidebar) return;

  function openMenu() {
    sidebar.classList.add("open");
    overlay.classList.add("show");
  }

  function closeMenu() {
    sidebar.classList.remove("open");
    overlay.classList.remove("show");
  }

  toggle.addEventListener("click", () => {
    sidebar.classList.contains("open") ? closeMenu() : openMenu();
  });

  overlay.addEventListener("click", closeMenu);

  /* Chọn 1 mục lá → đóng drawer (chỉ khi màn hình ≤ 900px). */
  sidebar.addEventListener("click", e => {
    if (e.target.closest(".menu-item-parent")) return;
    const item = e.target.closest(".menu-item, .menu-sub-item");
    if (item && window.innerWidth <= 900) closeMenu();
  });

  /* Xoay ngang / kéo rộng cửa sổ sang desktop → đóng drawer. */
  window.addEventListener("resize", () => {
    if (window.innerWidth > 900) closeMenu();
  });
})();
