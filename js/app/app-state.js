/* ══════════════════════════════════════════════
   APP STATE & HELPERS — js/app/app-state.js
   ─────────────────────────────────────────────
   ⚠️ TÁCH RA từ js/app.js (bản cũ quá dài, khó bảo trì).
   File này PHẢI load ĐẦU TIÊN trong nhóm js/app/*.js vì:
   - Khai báo các biến trạng thái dùng chung (activeFilter,
     searchQ, currentIdx, gameSlugs, gameIndexById...) bằng
     let/const ở top-level — các file js/app/*.js load SAU vẫn
     đọc/ghi được các biến này trực tiếp (không cần window.),
     vì mọi <script> thường (không type="module") trong cùng
     trang chia sẻ chung 1 scope top-level. Đây là quy ước đã
     dùng xuyên suốt dự án (VD: `client`/`currentSession` khai
     báo ở admin/core/dashboard-auth.js, dùng trực tiếp ở các
     module admin khác).
   - Khai báo các helper thuần (không đụng DOM): diffClass,
     getCategories, rebuildGameIndex, gameIndex, ensureGameIndexBuilt...

   Cần: js/shared-utils.js (window.escHtml, window.debounce...),
   js/data.js (window.GAMES, window.GAMES_READY) — load TRƯỚC file này.
   ══════════════════════════════════════════════ */

let activeFilter = '🧩 Tất cả', searchQ = '', currentIdx = -1;
let gameSlugs = { slugById: {}, idBySlug: {} };
let gameIndexById = new Map();
let _gamesUpdateListenerAttached = false;

const esc = window.escHtml;

function diffClass(d){ return d==='Dễ'?'diff-easy':d==='Khó'?'diff-hard':'diff-medium' }

/* ── Helper: lấy categories chuẩn (luôn trả về array) ── */
function getCategories(g){
  return Array.isArray(g.categories) && g.categories.length
    ? g.categories
    : (g.category ? [g.category] : []);
}

/* ── Helper: chỉ số của game trong GAMES — O(1) thay vì GAMES.indexOf() O(n) ── */
function rebuildGameIndex(){
  gameIndexById = new Map(GAMES.map((g, i) => [g.id, i]));
}
function gameIndex(g){
  const idx = gameIndexById.get(g.id);
  return idx === undefined ? GAMES.indexOf(g) : idx; // fallback an toàn nếu index chưa build kịp
}

/* Đảm bảo gameSlugs/gameIndexById đã build — gọi mỗi khi cần render
   dữ liệu phụ thuộc GAMES, an toàn để gọi nhiều lần. */
function ensureGameIndexBuilt(){
  if (!gameSlugs.slugById || !Object.keys(gameSlugs.slugById).length) {
    gameSlugs = window.buildGameSlugMap(GAMES);
  }
  if (!gameIndexById.size && GAMES.length) {
    rebuildGameIndex();
  }
}

/* Bản "ép build lại" — dùng khi GAMES vừa được cập nhật sau retry
   nền (dữ liệu đổi từ [] sang có game thật), khác ensureGameIndexBuilt()
   ở chỗ luôn build lại bất kể trạng thái cũ. */
function ensureGameIndexBuiltForce(){
  gameSlugs = window.buildGameSlugMap(GAMES);
  rebuildGameIndex();
}

/* ⚠️ Lắng nghe sự kiện 'tcq:games-updated' (bắn ra từ data.js khi
   retry nền tải game thành công) — tự render lại trang hiện tại,
   KHÔNG cần người dùng bấm gì hay reload trang. Chỉ gắn 1 lần duy
   nhất trong suốt vòng đời trang (dù loadPage() gọi lại nhiều lần
   khi chuyển trang).
   Gọi renderGrid()/renderDailyPick() (định nghĩa ở
   app-boardgame-list.js / app-daily-pick.js) — an toàn dù các hàm
   đó nằm ở file khác, vì callback này chỉ chạy SAU khi mọi
   <script> đã load xong (event bất đồng bộ). */
function attachAutoReloadOnGamesUpdate(){
  if (_gamesUpdateListenerAttached) return;
  _gamesUpdateListenerAttached = true;

  window.addEventListener('tcq:games-updated', () => {
    ensureGameIndexBuiltForce();
    if (document.getElementById('grid')) {
      renderGrid();
    }
    if (document.getElementById('daily-pick-card')) {
      renderDailyPick();
    }
  });
}
