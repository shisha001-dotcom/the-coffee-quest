// ═══════════════════════════════════════════════
// SUPABASE DATA LOADER — js/data.js
// ─────────────────────────────────────────────
// ⚠️ VIẾT LẠI (fix "không hiện game trên mobile"):
// - Bọc timeout cho cả import() CDN lẫn query Supabase — tránh
//   treo vô hạn khi mobile chuyển mạng giữa chừng (Wi-Fi ↔ 4G).
// - Tự động retry NỀN, không giới hạn số lần, không cần người
//   dùng bấm nút — thử lại với backoff tăng dần rồi giữ nguyên
//   ở mức tối đa, cho tới khi thành công.
// - window.GAMES_READY vẫn giữ nguyên API cũ (Promise) để không
//   phải sửa chỗ khác — resolve ngay sau lần thử ĐẦU TIÊN (thành
//   công hoặc thất bại), không chặn UI vô thời hạn.
// - Khi tải thành công (kể cả ở lần retry nền sau đó), bắn sự kiện
//   'tcq:games-updated' trên window để app.js tự render lại mà
//   không cần người dùng reload/bấm gì.
// - window.GAMES_LOAD_ERROR: true nếu lần thử gần nhất thất bại —
//   app.js dùng để phân biệt "đang tải/lỗi mạng" với "lọc không
//   ra kết quả".
// ═══════════════════════════════════════════════

window.GAMES = [];
window.BANNER_CONFIG = [
  { key: 'banner_1', url: 'assets/img/banner_001.png', visible: true },
  { key: 'banner_2', url: 'assets/img/banner2.jpg',    visible: true },
];
window.GAMES_LOAD_ERROR = false;

/* ── Helper: race 1 promise với timeout, để không bao giờ treo vô hạn ── */
function withTimeout(promise, ms, label) {
  return Promise.race([
    promise,
    new Promise((_, reject) =>
      setTimeout(() => reject(new Error(`Timeout (${ms}ms) khi ${label}`)), ms)
    ),
  ]);
}

/* ── 1 lần thử tải toàn bộ dữ liệu games + banner ── */
async function attemptLoadGamesData() {
  const { createClient } = await withTimeout(
    import('https://cdn.jsdelivr.net/npm/@supabase/supabase-js/+esm'),
    10000,
    'tải thư viện Supabase'
  );

  const supabase = createClient(
    window.APP_CONFIG.supabaseUrl,
    window.APP_CONFIG.supabaseKey
  );

  const [gamesResult, settingsResult] = await withTimeout(
    Promise.all([
      supabase.from('games').select('*').order('sort_order', { ascending: true }),
      supabase.from('site_settings').select('key, value').in('key', ['banner_1', 'banner_2']),
    ]),
    12000,
    'tải dữ liệu game/banner'
  );

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
  }

  console.log('✅ Loaded:', window.GAMES.length, 'games');
}

/* ── Vòng lặp retry nền — chạy tới khi thành công, không cần người
   dùng thao tác. Backoff tăng dần: 1.5s → 3s → 6s → 10s (giữ mức
   10s cho các lần sau, tránh spam liên tục vô hạn). ── */
const RETRY_DELAYS = [1500, 3000, 6000, 10000];

function scheduleBackgroundRetry(attemptCount) {
  const delay = RETRY_DELAYS[Math.min(attemptCount, RETRY_DELAYS.length - 1)];
  setTimeout(async () => {
    try {
      await attemptLoadGamesData();
      window.GAMES_LOAD_ERROR = false;
      console.log('✅ Retry nền thành công sau', attemptCount + 1, 'lần thử.');
      /* Báo cho UI biết để tự render lại — không cần người dùng làm gì */
      window.dispatchEvent(new CustomEvent('tcq:games-updated'));
    } catch (err) {
      window.GAMES_LOAD_ERROR = true;
      console.warn('⚠️ Retry nền lần', attemptCount + 1, 'thất bại:', err.message);
      scheduleBackgroundRetry(attemptCount + 1);
    }
  }, delay);
}

/* ── Khởi động: thử ngay lập tức. GAMES_READY resolve sau lần thử
   ĐẦU TIÊN này (không chờ các lần retry nền) để không chặn UI —
   nếu fail, UI hiện trạng thái "đang tải lại" và tự cập nhật khi
   scheduleBackgroundRetry() thành công. ── */
window.GAMES_READY = (async () => {
  try {
    await attemptLoadGamesData();
    window.GAMES_LOAD_ERROR = false;
  } catch (err) {
    window.GAMES_LOAD_ERROR = true;
    console.error('❌ data.js — lần thử đầu thất bại, sẽ tự thử lại nền:', err.message);
    scheduleBackgroundRetry(0);
  }
})();

/* Cho phép gọi thủ công nếu cần (vd người dùng đổi mạng, hoặc
   dev muốn ép tải lại) — không bắt buộc dùng, nhưng vẫn expose
   để tương thích nếu sau này cần. */
window.retryLoadGames = async function () {
  try {
    await attemptLoadGamesData();
    window.GAMES_LOAD_ERROR = false;
    window.dispatchEvent(new CustomEvent('tcq:games-updated'));
    return true;
  } catch (err) {
    window.GAMES_LOAD_ERROR = true;
    console.warn('retryLoadGames thất bại:', err.message);
    return false;
  }
};
