/* ══════════════════════════════════════════════
   MENU & HEADER — js/app/app-menu-header.js
   ─────────────────────────────────────────────
   ⚠️ TÁCH RA từ js/app.js. Xử lý side-menu (mở/đóng), và
   chuyển đổi header giữa 2 chế độ (news-mode / boardgame-mode
   có search + đếm số game). Cũng chứa setActive() — đánh dấu
   menu item đang active theo tên hàm điều hướng, dùng bởi
   routeFromHash() ở app-router.js.
   ══════════════════════════════════════════════ */

/* ═══ MENU ═══ */
const menuToggle  = document.getElementById('menu-toggle');
const sideMenu    = document.getElementById('side-menu');
const menuOverlay = document.getElementById('menu-overlay');

function openMenu(){ sideMenu.classList.add('open'); menuOverlay.classList.add('show'); }
function closeMenu(){ sideMenu.classList.remove('open'); menuOverlay.classList.remove('show'); }

menuToggle?.addEventListener('click', openMenu);
menuOverlay?.addEventListener('click', closeMenu);

/* ═══ HEADER ═══ */
function updateHeader(type){
  const search = document.getElementById('header-search');
  const count  = document.getElementById('header-count-wrap');
  const header = document.querySelector('.site-header');
  if(type === 'boardgame'){
    search.style.display = 'flex';
    count.style.display  = 'block';
    header.classList.remove('news-mode');
  } else {
    search.style.display = 'none';
    count.style.display  = 'none';
    header.classList.add('news-mode');
  }
}

/* ═══ NAVIGATION — đánh dấu menu item active ═══ */
function setActive(fn){
  document.querySelectorAll('.menu-item').forEach(el=>{
    el.classList.toggle('active', (el.getAttribute('onclick')||'').includes(fn));
  });
}
