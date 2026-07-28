// ═══════════════════════════════════════════════
// SUPABASE DATA LOADER — js/data.js
// ═══════════════════════════════════════════════

window.GAMES = [];
window.BANNER_CONFIG = [
  { key: 'banner_1', url: 'assets/img/banner_001.png', visible: true },
  { key: 'banner_2', url: 'assets/img/banner2.jpg',    visible: true },
];
window.GAMES_LOAD_ERROR = false;

async function fetchGamesOnce() {
  const { createClient } = await import(
    'https://cdn.jsdelivr.net/npm/@supabase/supabase-js/+esm'
  );
  const supabase = createClient(
    window.APP_CONFIG.supabaseUrl,
    window.APP_CONFIG.supabaseKey
  );

  const [gamesResult, settingsResult] = await Promise.all([
    supabase.from('games').select('*').order('sort_order', { ascending: true }),
    supabase.from('site_settings').select('key, value').in('key', ['banner_1', 'banner_2']),
  ]);

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

/* ⚠️ FIX CHÍNH: retry nền có backoff khi lần đầu thất bại (mất mạng,
   CDN chậm trên mobile...) — set window.GAMES_LOAD_ERROR (đã được
   app-boardgame-list.js/app-daily-pick.js đọc sẵn để hiện "Đang kết
   nối lại...") và bắn 'tcq:games-updated' khi thành công (đã được
   app-state.js::attachAutoReloadOnGamesUpdate() lắng nghe sẵn để tự
   vẽ lại trang) — 2 cơ chế này TỒN TẠI SẴN ở phía UI nhưng chưa bao
   giờ được data.js kích hoạt. */
function retryGamesInBackground() {
  let delay = 3000;
  const attempt = () => {
    fetchGamesOnce().then(() => {
      window.GAMES_LOAD_ERROR = false;
      window.dispatchEvent(new CustomEvent('tcq:games-updated'));
    }).catch(err => {
      console.error('❌ data.js retry error:', err);
      window.GAMES_LOAD_ERROR = true;
      delay = Math.min(delay * 1.5, 20000); // backoff, tối đa 20s
      setTimeout(attempt, delay);
    });
  };
  setTimeout(attempt, delay);
}

window.GAMES_READY = fetchGamesOnce().catch(err => {
  console.error('❌ data.js error:', err);
  window.GAMES_LOAD_ERROR = true;
  retryGamesInBackground(); // không chặn app-init.js, cứ resolve rồi retry ngầm
});
