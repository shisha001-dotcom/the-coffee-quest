// ═══════════════════════════════════════════════
// SUPABASE DATA LOADER
// Loads: games (window.GAMES) + banner settings (window.BANNER_CONFIG)
// ═══════════════════════════════════════════════

const SUPABASE_URL = window.APP_CONFIG.supabaseUrl;
const SUPABASE_KEY = window.APP_CONFIG.supabaseKey;

window.GAMES = [];
window.GAMES_READY = null;

/* Banner config mặc định — bị ghi đè khi fetch xong */
window.BANNER_CONFIG = [
  { key: 'banner_1', url: 'assets/img/banner_001.png', visible: true },
  { key: 'banner_2', url: 'assets/img/banner2.jpg',    visible: true },
];

// expose global variable thật sự
var GAMES = window.GAMES;

window.GAMES_READY = (async () => {

  try {

    const { createClient } = await import(
      'https://cdn.jsdelivr.net/npm/@supabase/supabase-js/+esm'
    );

    const supabase = createClient(
      SUPABASE_URL,
      SUPABASE_KEY
    );

    /* ── Fetch games + banner settings song song ── */
    const [gamesResult, settingsResult] = await Promise.all([
      supabase
        .from('games')
        .select('*')
        .order('sort_order', { ascending: true }),
      supabase
        .from('site_settings')
        .select('key, value')
        .in('key', ['banner_1', 'banner_2']),
    ]);

    /* ── Xử lý games ── */
    if (gamesResult.error) {
      console.error(gamesResult.error);
    } else {
      window.GAMES.length = 0;

      gamesResult.data.forEach(g => {

        window.GAMES.push({

          id: g.id,
          name: g.name || '',
          emoji: g.emoji || '🎲',
          color: g.color || '#6c5ce7',

          categories: Array.isArray(g.categories)
            ? g.categories
            : [],

          players: g.players || '',
          time: g.time || '',
          difficulty: g.difficulty || '',

          objective: g.objective || '',

          setup: Array.isArray(g.setup)
            ? g.setup
            : [],

          turn: Array.isArray(g.turn)
            ? g.turn
            : [],

          win: g.win || '',

          tips: Array.isArray(g.tips)
            ? g.tips
            : [],

          youtubeUrl: g.youtube_url || '',
          heroBg: g.hero_bg || '',

          images: Array.isArray(g.images)
            ? g.images
            : []

        });

      });

      // cập nhật biến global
      GAMES = window.GAMES;

      console.log(
        '✅ Loaded:',
        window.GAMES.length,
        'games'
      );
    }

    /* ── Xử lý banner settings ── */
    if (!settingsResult.error && settingsResult.data && settingsResult.data.length) {
      settingsResult.data.forEach(row => {
        const item = window.BANNER_CONFIG.find(b => b.key === row.key);
        if (!item) return;
        try {
          const parsed    = JSON.parse(row.value);
          item.url        = parsed.url     ?? item.url;
          item.visible    = parsed.visible ?? true;
        } catch {
          /* fallback: value là plain URL string */
          item.url     = row.value || item.url;
          item.visible = true;
        }
      });
    }

    console.log('✅ Banner config loaded:', window.BANNER_CONFIG);

  } catch(err) {

    console.error(
      '❌ data.js error:',
      err
    );

  }

})();
