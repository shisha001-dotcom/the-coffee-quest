// ═══════════════════════════════════════════════
// SUPABASE DATA LOADER — js/data.js
// ─────────────────────────────────────────────
// ⚠️ FIX (mobile treo mãi ở "Đang tải danh sách game..."):
// - Trước đây import() thư viện supabase-js từ 1 CDN duy nhất
//   (jsdelivr) KHÔNG có timeout — nếu request bị treo (mạng di
//   động chặn/DNS lỗi/trình duyệt trong app như Zalo, Facebook...)
//   thì Promise không bao giờ resolve/reject, khiến toàn bộ trang
//   kẹt ở trạng thái loading vĩnh viễn dù máy tính cùng mạng vẫn
//   chạy bình thường.
// - Giờ: mỗi lần thử tải có timeout cứng (10s). Nếu jsdelivr fail/
//   timeout, tự động thử CDN dự phòng (unpkg) trước khi báo lỗi.
// - Thêm window.retryLoadGamesNow() để nút "Thử lại" (thêm ở
//   app-boardgame-list.js / app-daily-pick.js) có thể ép tải lại
//   NGAY thay vì phải chờ backoff timer.
// ═══════════════════════════════════════════════

window.GAMES = [];
window.BANNER_CONFIG = [
  { key: 'banner_1', url: 'assets/img/banner_001.png', visible: true },
  { key: 'banner_2', url: 'assets/img/banner2.jpg',    visible: true },
];
window.GAMES_LOAD_ERROR = false;
window.GAMES_LOAD_ERROR_MESSAGE = '';

const SUPABASE_ESM_CDNS = [
  'https://cdn.jsdelivr.net/npm/@supabase/supabase-js/+esm',
  'https://esm.sh/@supabase/supabase-js',
];

function withTimeout(promise, ms, label) {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error(`Hết thời gian chờ (${label})`)), ms);
    promise.then(
      v => { clearTimeout(timer); resolve(v); },
      e => { clearTimeout(timer); reject(e); }
    );
  });
}

/* Thử lần lượt từng CDN cho tới khi import() thành công — mỗi CDN
   có timeout riêng 10s, tránh treo vô thời hạn như trước. */
async function importSupabaseJs() {
  let lastErr;
  for (const url of SUPABASE_ESM_CDNS) {
    try {
      return await withTimeout(import(url), 10000, 'tải thư viện Supabase');
    } catch (err) {
      console.warn('⚠️ Không tải được supabase-js từ', url, err);
      lastErr = err;
    }
  }
  throw lastErr || new Error('Không tải được thư viện Supabase từ bất kỳ CDN nào.');
}

async function fetchGamesOnce() {
  const { createClient } = await importSupabaseJs();
  const supabase = createClient(
    window.APP_CONFIG.supabaseUrl,
    window.APP_CONFIG.supabaseKey
  );

  const [gamesResult, settingsResult] = await withTimeout(
    Promise.all([
      supabase.from('games').select('*').order('sort_order', { ascending: true }),
      supabase.from('site_settings').select('key, value').in('key', ['banner_1', 'banner_2']),
    ]),
    10000,
    'tải dữ liệu game'
  );

  // ⚠️ FIX: trước đây lỗi query (vd RLS, sai cột...) bị nuốt im lặng
  // (chỉ console.error trong nhánh else cũ) → GAMES kẹt rỗng mãi mãi.
  if (gamesResult.error) throw gamesResult.error;

  const mapped = gamesResult.data.map(g => ({
    id:         g.id,
    name:       g.name        || '',
    emoji:      g.emoji       || '🎲',
    color:      g.color       || '#6c5ce7',
    categories: Array.isArray(g.categories) ? g.categories : [],
    players:    g.players     || '',
    time:       g.time        || '',
    difficulty: g.difficulty  || '',
    objective:  g.objective   || '',
    win:        g.win         || '',
    setup:      Array.isArray(g.setup)  ? g.setup  : [],
    turn:       Array.isArray(g.turn)   ? g.turn   : [],
    tips:       Array.isArray(g.tips)   ? g.tips   : [],
    images:     Array.isArray(g.images) ? g.images : [],
    youtubeUrl: g.youtube_url || '',
    heroBg:     g.hero_bg     || '',
    rulesPdfUrl: g.rules_pdf_url || '',
  }));

  window.GAMES.length = 0;
  window.GAMES.push(...mapped);
  console.log('✅ Loaded:', window.GAMES.length, 'games');

  if (!settingsResult.error && settingsResult.data?.length) {
    settingsResult.data.forEach(row => {
      const item = window.BANNER_CONFIG.find(b => b.key === row.key);
      if (!item) return;
      try {
        const parsed = JSON.parse(row.value);
        item.url     = parsed.url     ?? item.url;
        item.visible = parsed.visible ?? true;
      } catch {
        item.url     = row.value || item.url;
        item.visible = true;
      }
    });
    console.log('✅ Banner config loaded:', window.BANNER_CONFIG);
  }
}

let _retryTimer = null;
let _retryDelay = 800;

function scheduleRetry() {
  clearTimeout(_retryTimer);
  const attempt = () => {
    fetchGamesOnce().then(() => {
      window.GAMES_LOAD_ERROR = false;
      window.GAMES_LOAD_ERROR_MESSAGE = '';
      window.dispatchEvent(new CustomEvent('tcq:games-updated'));
    }).catch(err => {
      console.error('❌ data.js retry error:', err);
      window.GAMES_LOAD_ERROR = true;
      window.GAMES_LOAD_ERROR_MESSAGE = err?.message || String(err);
      window.dispatchEvent(new CustomEvent('tcq:games-updated'));
      _retryDelay = Math.min(_retryDelay * 1.8, 20000); // backoff, tối đa 20s
      _retryTimer = setTimeout(attempt, _retryDelay);
    });
  };
  _retryTimer = setTimeout(attempt, _retryDelay);
}

/* ⚠️ MỚI: cho phép UI (nút "Thử lại") ép tải lại NGAY LẬP TỨC,
   không cần chờ hết thời gian backoff hiện tại. */
window.retryLoadGamesNow = function () {
  _retryDelay = 800;
  clearTimeout(_retryTimer);
  fetchGamesOnce().then(() => {
    window.GAMES_LOAD_ERROR = false;
    window.GAMES_LOAD_ERROR_MESSAGE = '';
    window.dispatchEvent(new CustomEvent('tcq:games-updated'));
  }).catch(err => {
    console.error('❌ data.js manual retry error:', err);
    window.GAMES_LOAD_ERROR = true;
    window.GAMES_LOAD_ERROR_MESSAGE = err?.message || String(err);
    window.dispatchEvent(new CustomEvent('tcq:games-updated'));
    scheduleRetry();
  });
};

window.GAMES_READY = fetchGamesOnce().catch(err => {
  console.error('❌ data.js error:', err);
  window.GAMES_LOAD_ERROR = true;
  window.GAMES_LOAD_ERROR_MESSAGE = err?.message || String(err);
  scheduleRetry(); // không chặn app-init.js, cứ resolve rồi retry ngầm
});
