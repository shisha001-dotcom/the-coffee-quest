/* ══════════════════════════════════════════════
   ADMIN NAV — admin/core/dashboard-nav.js
   ─────────────────────────────────────────────
   TRƯỚC ĐÂY: toàn bộ hàm điều hướng (showDashboard,
   toggleBgMenu, showBoardgames, showDrinks...) nằm trong
   1 khối <script> ~300 dòng viết thẳng trong admin/dashboard.html
   — không đúng chỗ, khó tìm, không được lint/format như các
   file .js khác.

   BÂY GIỜ: chuyển hẳn ra file .js riêng, cùng vị trí với các
   module admin khác. dashboard.html chỉ còn HTML thuần + 1
   dòng <script src="...">.

   Chỉ xử lý 3 page TĨNH đã có sẵn trong HTML (Dashboard,
   Boardgames, Drinks) — các page ĐỘNG (chat/analytics/banners/
   media/accounts) tự đăng ký qua AdminDashboard.registerPage()
   trong module riêng của chúng.
   ══════════════════════════════════════════════ */

function clearActive() {
  document.querySelectorAll('.menu-item, .menu-item-parent, .menu-sub-item')
    .forEach(el => el.classList.remove('active'));
}

/* ── Show Dashboard ── */
function showDashboard() {
  clearActive();
  document.getElementById('dashboardMenuItem').classList.add('active');
  window.__showPage('dashboardPage');
}

/* ── Toggle Boardgames sub-menu ── */
function toggleBgMenu() {
  const parent   = document.getElementById('bgParent');
  const children = document.getElementById('bgChildren');
  const isOpen   = children.classList.contains('open');
  document.getElementById('drinkChildren').classList.remove('open');
  document.getElementById('drinkParent').classList.remove('open');
  parent.classList.toggle('open', !isOpen);
  children.classList.toggle('open', !isOpen);
  if (!isOpen) showBoardgames('all');
}

/* ── Show Boardgames page ── */
function showBoardgames(mode) {
  clearActive();
  document.getElementById('bgParent').classList.add('open');
  document.getElementById('bgChildren').classList.add('open');
  const itemId = mode === 'search' ? 'bgSearchItem' : 'bgAllItem';
  document.getElementById(itemId)?.classList.add('active');

  window.__showPage('boardgamesPage');

  if (mode === 'search') {
    document.getElementById('searchInput')?.focus();
  }
  loadGames();
}

/* ── Open Add Game directly from sidebar ── */
function openAddGame() {
  showBoardgames('all');
  setTimeout(() => document.getElementById('addGameBtn')?.click(), 150);
}

/* ── Toggle Drinks sub-menu ── */
function toggleDrinkMenu() {
  const parent   = document.getElementById('drinkParent');
  const children = document.getElementById('drinkChildren');
  const isOpen   = children.classList.contains('open');
  document.getElementById('bgChildren').classList.remove('open');
  document.getElementById('bgParent').classList.remove('open');
  parent.classList.toggle('open', !isOpen);
  children.classList.toggle('open', !isOpen);
  if (!isOpen) showDrinks('all');
}

/* ── Show Drinks page ── */
function showDrinks(cat) {
  clearActive();
  document.getElementById('drinkParent').classList.add('open');
  document.getElementById('drinkChildren').classList.add('open');

  const subMap = {
    'all': 'drinkAllItem', 'Cà phê': 'drinkCoffeeItem',
    'Trà hoa quả': 'drinkTeaItem', 'Trà sữa': 'drinkMilkTeaItem', 'Sữa chua': 'drinkYogurtItem'
  };
  document.getElementById(subMap[cat] || 'drinkAllItem')?.classList.add('active');

  window.__showPage('drinksPage');

  document.querySelectorAll('.drink-tab').forEach(btn => {
    btn.classList.toggle('btn-primary',   btn.dataset.cat === cat);
    btn.classList.toggle('btn-secondary', btn.dataset.cat !== cat);
  });

  window.activeDrinkFilter = cat;
  document.getElementById('drinkPageSubtitle').textContent =
    cat === 'all' ? 'Công thức & hướng dẫn pha chế' : `Loại: ${cat}`;

  loadDrinks();
}

/* ── Filter drinks by tab click ── */
function filterDrinks(cat, btnEl) {
  document.querySelectorAll('.drink-tab').forEach(b => {
    b.classList.toggle('btn-primary',   b === btnEl);
    b.classList.toggle('btn-secondary', b !== btnEl);
  });
  window.activeDrinkFilter = cat;
  renderDrinkGrid();
}

/* ══════════════════════════════════════════════
   ONLINE COUNT trên Dashboard — mirror từ #adminOnlineCount
   (được cập nhật bởi dashboard-chat.js) sang #dashOnlineCount.
   Dùng MutationObserver thay vì setTimeout polling liên tục.
   ══════════════════════════════════════════════ */
function syncOnlineCountToDashboard() {
  const src = document.getElementById('adminOnlineCount');
  const dst = document.getElementById('dashOnlineCount');
  if (!src || !dst) { setTimeout(syncOnlineCountToDashboard, 500); return; }
  const observer = new MutationObserver(() => { dst.textContent = src.textContent; });
  observer.observe(src, { childList: true, characterData: true, subtree: true });
  dst.textContent = src.textContent;
}
syncOnlineCountToDashboard();
