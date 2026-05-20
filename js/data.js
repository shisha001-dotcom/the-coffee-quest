// ═══════════════════════════════════════════════
// SUPABASE DATA LOADER
// ═══════════════════════════════════════════════

const SUPABASE_URL =
  'https://dklfwlgpomnrmxmbjpat.supabase.co';

const SUPABASE_KEY =
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImRrbGZ3bGdwb21ucm14bWJqcGF0Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3Nzg1MDQ5MDAsImV4cCI6MjA5NDA4MDkwMH0.sy8zDIdh9RBhl9TOqg6PnfTehqtV7VcFQSaSPoc4MoI';

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
