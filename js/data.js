// ═══════════════════════════════════════════════
// SUPABASE DATA LOADER — js/data.js
// ─────────────────────────────────────────────
// ⚠️ ĐÃ QUAY VỀ LOGIC ĐƠN GIẢN CỦA BẢN CŨ (ver1.2): 1 lần tải
// DUY NHẤT, KHÔNG timeout, KHÔNG multi-CDN fallback, KHÔNG tự
// retry nền. Lỗi thì chỉ console.error, GAMES giữ nguyên rỗng —
// đúng hành vi đã hoạt động ổn định trước đây.
// ═══════════════════════════════════════════════

window.GAMES = [];
window.BANNER_CONFIG = [
  { key: 'banner_1', url: 'assets/img/banner_001.png', visible: true },
  { key: 'banner_2', url: 'assets/img/banner2.jpg',    visible: true },
];

window.GAMES_READY = (async () => {
  try {
    const { createClient } = await import(
      'https://cdn.jsdelivr.net/npm/@supabase/supabase-js/+esm'
    );
    const supabase = createClient(
      window.APP_CONFIG.supabaseUrl,
      window.APP_CONFIG.supabaseKey
    );

    /* Fetch song song */
    const [gamesResult, settingsResult] = await Promise.all([
      supabase.from('games').select('*').order('sort_order', { ascending: true }),
      supabase.from('site_settings').select('key, value').in('key', ['banner_1', 'banner_2']),
    ]);

    /* ── Games ── */
    if (gamesResult.error) {
      console.error('games fetch error:', gamesResult.error);
    } else {
      const mapped = gamesResult.data.map(g => ({
        id:          g.id,
        name:        g.name        || '',
        emoji:       g.emoji       || '🎲',
        color:       g.color       || '#6c5ce7',
        categories:  Array.isArray(g.categories) ? g.categories : [],
        players:     g.players     || '',
        time:        g.time        || '',
        difficulty:  g.difficulty  || '',
        objective:   g.objective   || '',
        win:         g.win         || '',
        setup:       Array.isArray(g.setup)  ? g.setup  : [],
        turn:        Array.isArray(g.turn)   ? g.turn   : [],
        tips:        Array.isArray(g.tips)   ? g.tips   : [],
        images:      Array.isArray(g.images) ? g.images : [],
        youtubeUrl:  g.youtube_url    || '',
        heroBg:      g.hero_bg        || '',
        rulesPdfUrl: g.rules_pdf_url  || '',
      }));

      /* Gán vào window.GAMES giữ nguyên reference */
      window.GAMES.length = 0;
      window.GAMES.push(...mapped);

      console.log('✅ Loaded:', window.GAMES.length, 'games');
    }

    /* ── Banner settings ── */
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

  } catch(err) {
    console.error('❌ data.js error:', err);
  }
})();
