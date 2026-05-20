// ═══════════════════════════════════════════════
// SUPABASE DATA LOADER
// ═══════════════════════════════════════════════

const SUPABASE_URL =
  'https://dklfwlgpomnrmxmbjpat.supabase.co';

const SUPABASE_KEY =
  'YOUR_SUPABASE_ANON_KEY';

window.GAMES = [];
window.GAMES_READY = null;

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

    const { data, error } = await supabase
      .from('games')
      .select('*')
      .order('sort_order', { ascending: true });

    if (error) {
      console.error(error);
      return;
    }

    window.GAMES.length = 0;

    data.forEach(g => {

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

  } catch(err) {

    console.error(
      '❌ data.js error:',
      err
    );

  }

})();
