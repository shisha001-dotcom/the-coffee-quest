/* ══════════════════════════════════════════════
   APP STATE & HELPERS — js/app/app-state.js
   ─────────────────────────────────────────────
   ⚠️ ĐÃ QUAY VỀ LOGIC ĐƠN GIẢN CỦA BẢN CŨ (ver1.2): bỏ hẳn cơ chế
   lắng nghe sự kiện 'tcq:games-updated' / tự động mở lại trang chi
   tiết khi dữ liệu tới muộn. GAMES chỉ được tải 1 LẦN DUY NHẤT lúc
   khởi động (xem js/data.js + js/app/app-init.js) — không còn retry
   nền nên không cần theo dõi thay đổi GAMES sau đó nữa.

   Vẫn giữ map tra index O(1) (gameIndexById/gameIndex) vì đây chỉ là
   tối ưu hiệu năng thuần tuý, không liên quan gì tới việc tải dữ
   liệu, nên không ảnh hưởng tới hành vi tra cứu luật game.
   ══════════════════════════════════════════════ */

let activeFilter = '🧩 Tất cả', searchQ = '', currentIdx = -1;
let gameSlugs = { slugById: {}, idBySlug: {} };
let gameIndexById = new Map();

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

/* Đảm bảo gameSlugs/gameIndexById đã build — an toàn để gọi nhiều lần. */
function ensureGameIndexBuilt(){
  if (!gameSlugs.slugById || !Object.keys(gameSlugs.slugById).length) {
    gameSlugs = window.buildGameSlugMap(GAMES);
  }
  if (!gameIndexById.size && GAMES.length) {
    rebuildGameIndex();
  }
}
