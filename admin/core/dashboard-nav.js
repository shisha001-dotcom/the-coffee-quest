/* ══════════════════════════════════════════════
   ADMIN NAV — admin/core/dashboard-nav.js
   ─────────────────────────────────────────────
   TRƯỚC ĐÂY: toàn bộ hàm điều hướng (showDashboard,
   toggleBgMenu, showBoardgames, showDrinks...) nằm trong
   1 khối <script> ~300 dòng viết thẳng trong admin/dashboard.html.

   BÂY GIỜ: chuyển hẳn ra file .js riêng.

   THAY ĐỔI SO VỚI BẢN TRƯỚC:
   - Bỏ toggleBgMenu()/toggleDrinkMenu() và các menu-sub-item
     (submenu "Tất cả game"/"+ Thêm game mới"/"Tìm kiếm" và
     tương tự cho Đồ uống) — Boardgames & Đồ uống giờ là
     menu-item đơn, bấm là vào thẳng trang (search bar/nút thêm/
     tab lọc đã có sẵn ngay trên trang rồi, không cần sổ ra ở
     sidebar nữa).
   - Bỏ openAddGame() (không còn nơi gọi).

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

/* ── Show Boardgames page ──
   Search bar + nút "+ Thêm Game" đã hiển thị sẵn trên trang này,
   sidebar chỉ còn 1 mục "Boardgames" duy nhất, bấm là vào thẳng. */
function showBoardgames() {
  clearActive();
  document.getElementById('bgParent').classList.add('active');
  window.__showPage('boardgamesPage');
  loadGames();
}

/* ── Show Drinks page ──
   Tương tự: filter theo loại đã có sẵn tab ngay trên trang. */
function showDrinks(cat) {
  clearActive();
  document.getElementById('drinkParent').classList.add('active');

  cat = cat || 'all';
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

/* ── Filter drinks bằng tab ngay trên trang (không đổi trang) ── */
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
