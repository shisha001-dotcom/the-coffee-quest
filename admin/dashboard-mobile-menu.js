/* ══════════════════════════════════════════════
   ADMIN MOBILE MENU — admin/dashboard-mobile-menu.js
   ─────────────────────────────────────────────
   Đóng/mở sidebar dạng off-canvas trên mobile/tablet (≤900px),
   giống hành vi #side-menu của frontend (index.html + js/app.js).

   Yêu cầu HTML có sẵn (đặt trong dashboard.html):
     <button id="adminMenuToggle" aria-label="Menu">☰</button>
     <div id="adminMenuOverlay"></div>
     <div class="dashboard-layout"> ... <aside class="sidebar">...</aside> ... </div>

   Đặt <script> này SAU khi .sidebar đã tồn tại trong DOM
   (cuối body, sau các script khác).
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

  /* Đóng menu khi chọn 1 mục lá (không đóng khi bấm mục cha
     có submenu — Boardgames / Đồ uống — để còn xem được submenu) */
  sidebar.addEventListener("click", e => {
    if (e.target.closest(".menu-item-parent")) return;
    const item = e.target.closest(".menu-item, .menu-sub-item");
    if (item && window.innerWidth <= 900) closeMenu();
  });

  /* Đóng menu nếu xoay ngang / resize sang desktop */
  window.addEventListener("resize", () => {
    if (window.innerWidth > 900) closeMenu();
  });
})();
