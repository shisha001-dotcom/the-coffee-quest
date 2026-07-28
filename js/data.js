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

/* ⚠️ FIX (mobile — tra cứu luật chơi qua QR/link trực tiếp):
   - Trước đây lần retry đầu tiên đợi tới 3000ms mới thử lại. Trên
     mạng di động chập chờn (lý do phổ biến nhất khiến lần fetch đầu
     tiên fail khi vừa quét QR mở thẳng #game-{slug}), 3s là khá lâu
     và người dùng dễ tưởng trang bị lỗi rồi thoát ra trước khi kịp
     tự phục hồi.
   - Giờ retry lần đầu chỉ sau 800ms (phục hồi nhanh hơn với lỗi
     mạng thoáng qua/timeout ngắn), các lần sau mới backoff tăng dần
     như cũ (tối đa 20s) để tránh spam request nếu mất mạng thật sự.
   - Kết hợp với app-state.js::attachAutoReloadOnGamesUpdate() đã
     được sửa để tự mở lại đúng trang luật chơi theo hash khi
     'tcq:games-updated' bắn ra (xem app-state.js). */
function retryGamesInBackground() {
  let delay = 800;
  const attempt = () => {
    fetchGamesOnce().then(() => {
      window.GAMES_LOAD_ERROR = false;
      window.dispatchEvent(new CustomEvent('tcq:games-updated'));
    }).catch(err => {
      console.error('❌ data.js retry error:', err);
      window.GAMES_LOAD_ERROR = true;
      delay = Math.min(delay * 1.8, 20000); // backoff, tối đa 20s
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
