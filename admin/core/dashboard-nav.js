/* ══════════════════════════════════════════════
   ADMIN NAV — admin/core/dashboard-nav.js
   ─────────────────────────────────────────────
   VAI TRÒ
   Điều hướng cho 3 trang TĨNH có sẵn trong admin/dashboard.html:
     - #dashboardPage   (menu #dashboardMenuItem)
     - #boardgamesPage  (menu #bgParent)
     - #drinksPage      (menu #drinkParent)
   Các trang ĐỘNG (Đơn hàng, Kho, Khách hàng, Chat, Thống kê, Settings…)
   tự đăng ký qua AdminDashboard.registerPage() trong module của chúng,
   không đi qua file này.

   CÁCH GỌI
   - Các hàm dưới đây là hàm toàn cục (file này là classic script) và
     được gọi bằng onclick="" ngay trong dashboard.html:
       showDashboard()   showBoardgames()   showDrinks('all')
     Các module khác (chat, …) cũng gọi qua window.showDashboard().
   - ⚠️ ID `bgParent` và `drinkParent` là tên cũ từ thời sidebar còn
     submenu. Nay chúng chỉ là menu item đơn nhưng giữ nguyên id — đổi id
     trong HTML thì phải đổi cả ở đây.

   PHỤ THUỘC (đã nạp TRƯỚC file này trong SCRIPT_SEQUENCE)
   - loadGames()                 ← dashboard-games.js
   - loadDrinks(), renderDrinkGrid() ← dashboard-drinks.js
   - window.__showPage()         ← dashboard-page-registry.js
   ══════════════════════════════════════════════ */

/* Bỏ class `active` (nền tím nổi bật của mục đang chọn — style trong
   dashboard.css) khỏi MỌI mục menu, kể cả mục do registerPage() tạo. */
function clearActive() {
  document.querySelectorAll('.menu-item, .menu-item-parent, .menu-sub-item')
    .forEach(el => el.classList.remove('active'));
}

/* ── Trang Dashboard (tổng quan) ── */
function showDashboard() {
  clearActive();
  document.getElementById('dashboardMenuItem').classList.add('active');
  window.__showPage('dashboardPage');
}

/* ── Trang Boardgames ──
   Mỗi lần mở đều gọi loadGames() để tải lại danh sách từ Supabase. */
function showBoardgames() {
  clearActive();
  document.getElementById('bgParent').classList.add('active');
  window.__showPage('boardgamesPage');
  loadGames();
}

/* ── Trang Đồ uống ──
   cat = tên loại đồ uống cần lọc (khớp drink_categories.name), hoặc 'all'.
   Chữ phụ đề dưới tiêu đề (#drinkPageSubtitle) được đặt lại ở đây:
     - 'all'   → "Công thức & hướng dẫn pha chế"
     - có loại → "Loại: <tên loại>"
   ⚠️ Chữ này GHI ĐÈ chữ mặc định trong dashboard.html ("Công thức, giá
   bán & giá thành pha chế") ngay khi mở trang — muốn đổi câu hiển thị
   thì đổi ở ĐÂY, không phải ở HTML.

   Nút lọc (.drink-tab): nút đang chọn dùng class btn-primary (tím),
   các nút còn lại btn-secondary (trắng viền) — màu định nghĩa trong
   dashboard.css. */
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

/* ── Lọc đồ uống bằng tab ngay trên trang (không đổi trang) ──
   Được gọi khi bấm 1 nút .drink-tab (sự kiện gắn trong
   dashboard-drinks.js::renderDrinkTabs()).
   ⚠️ dashboard-drinks.js cũng gán 1 hàm window.filterDrinks cùng tên.
   Vì file này nạp SAU nên bản dưới đây là bản đang chạy thật; bản kia bị
   ghi đè. Nếu sửa cách lọc, hãy sửa ở đây (hoặc gộp về 1 nơi). */
function filterDrinks(cat, btnEl) {
  document.querySelectorAll('.drink-tab').forEach(b => {
    b.classList.toggle('btn-primary',   b === btnEl);
    b.classList.toggle('btn-secondary', b !== btnEl);
  });
  window.activeDrinkFilter = cat;
  renderDrinkGrid();
}

/* ══════════════════════════════════════════════
   SỐ NGƯỜI ĐANG ONLINE trên trang Dashboard
   ─────────────────────────────────────────────
   Nguồn dữ liệu: #adminOnlineCount — do module Chat (dashboard-chat.js,
   nạp SAU bằng type="module") tạo ra và cập nhật từ Firebase.
   Đích hiển thị: #dashOnlineCount (số lớn trong khung "Người dùng đang
   online" của trang Dashboard).

   Cách hoạt động:
     - Chat module tạo sau file này, nên nếu chưa thấy #adminOnlineCount thì
       hẹn thử lại mỗi 500ms cho tới khi cả 2 phần tử cùng tồn tại
       (chỉ thử lại lúc chờ, KHÔNG phải polling liên tục).
     - Khi đã có đủ: copy giá trị hiện tại, rồi dùng MutationObserver theo
       dõi nguồn để tự cập nhật đích mỗi khi số thay đổi.
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
