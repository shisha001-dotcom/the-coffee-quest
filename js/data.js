// ═══════════════════════════════════════════════════════════════
//  data.js — Supabase Loader
// ═══════════════════════════════════════════════════════════════

const SUPABASE_URL = 'https://dklfwlgpomnrmxmbjpat.supabase.co';
const SUPABASE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImRrbGZ3bGdwb21ucm14bWJqcGF0Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3Nzg1MDQ5MDAsImV4cCI6MjA5NDA4MDkwMH0.sy8zDIdh9RBhl9TOqg6PnfTehqtV7VcFQSaSPoc4MoI';

window.GAMES = [];

window.GAMES_READY = (async () => {

  try {

    // Load thư viện Supabase động
    const { createClient } = await import(
      'https://cdn.jsdelivr.net/npm/@supabase/supabase-js/+esm'
    );

    const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

    const { data, error } = await supabase
      .from('games')
      .select('*')
      .order('sort_order', { ascending: true });

    if (error) {
      console.error('❌ Supabase error:', error);
      return;
    }

    if (!data || !Array.isArray(data)) {
      console.error('❌ Không có dữ liệu games');
      return;
    }

    data.forEach(g => {

      window.GAMES.push({
        id:          g.id,
        name:        g.name || '',
        emoji:       g.emoji || '🎲',
        color:       g.color || '#6c5ce7',

        categories:  Array.isArray(g.categories)
          ? g.categories
          : [],

        players:     g.players || '',
        time:        g.time || '',
        difficulty:  g.difficulty || 'Trung bình',
        objective:   g.objective || '',

        setup: Array.isArray(g.setup)
          ? g.setup
          : [],

        turn: Array.isArray(g.turn)
          ? g.turn
          : [],
})();
