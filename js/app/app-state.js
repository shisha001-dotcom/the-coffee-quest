/* ══════════════════════════════════════════════
   APP STATE & HELPERS — js/app/app-state.js
   ─────────────────────────────────────────────
   ⚠️ CẬP NHẬT (fix lỗi "không tra cứu được luật chơi trên điện thoại"):

   NGUYÊN NHÂN: Trên mạng di động, lần fetch Supabase ĐẦU TIÊN khi
   quét QR mở thẳng #game-{slug} dễ bị timeout/lỗi hơn desktop.
   window.GAMES_READY vẫn resolve nhưng GAMES rỗng → routeFromHash()
   chạy lần đầu không tìm thấy slug nào → không mở được trang luật.
   data.js sau đó tự retry nền và bắn 'tcq:games-updated' khi thành
   công, NHƯNG listener cũ ở đây chỉ vẽ lại Grid/Daily-pick — quên
   mất việc phải thử MỞ LẠI đúng trang chi tiết game theo hash cũ
   (vd người dùng đang đứng ở #game-catan mà chưa thấy nội dung).

   FIX: attachAutoReloadOnGamesUpdate() giờ kiểm tra thêm — nếu
   location.hash đang là dạng #game-{slug} mà currentIdx vẫn đang là
   -1 (nghĩa là lần trước KHÔNG mở được game nào), gọi lại
   routeFromHash() để thử mở lại trang chi tiết đúng game đó, thay
   vì chỉ render Grid/Daily-pick như cũ.
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

   ⚠️ FIX MOBILE: nếu người dùng đang ở link luật chơi trực tiếp
   (#game-{slug}) mà trang chi tiết CHƯA mở được (currentIdx === -1,
   do lần fetch đầu bị lỗi mạng) → gọi lại routeFromHash() để tự mở
   đúng trang luật chơi ngay khi dữ liệu vừa tải xong, thay vì chỉ
   vẽ lại Grid/Daily-pick như trước (khiến người dùng mobile kẹt ở
   trang trống/"Không tìm thấy"). */
function attachAutoReloadOnGamesUpdate(){
  if (_gamesUpdateListenerAttached) return;
  _gamesUpdateListenerAttached = true;

  window.addEventListener('tcq:games-updated', () => {
    ensureGameIndexBuiltForce();

    const hash = location.hash.replace('#', '');
    const isPendingGameDeepLink = hash.startsWith('game-') && currentIdx === -1;

    if (isPendingGameDeepLink) {
      /* Thử mở lại đúng trang luật chơi theo hash hiện tại — quan
         trọng nhất cho trường hợp quét QR trên mobile khi lần đầu
         mạng chập chờn. routeFromHash() tự xử lý toàn bộ (load
         trang boardgame + goDetail đúng slug) nên gọi lại an toàn. */
      if (typeof window.routeFromHash === 'function') {
        window.routeFromHash();
      }
      return;
    }

    if (document.getElementById('grid')) {
      renderGrid();
    }
    if (document.getElementById('daily-pick-card')) {
      renderDailyPick();
    }
  });
}
