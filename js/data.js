// js/data.js
import { createClient } from 'https://cdn.jsdelivr.net/npm/@supabase/supabase-js/+esm'

const SUPABASE_URL = 'https://dklfwlgpomnrmxmbjpat.supabase.co'   // thay bằng URL của bạn
const SUPABASE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImRrbGZ3bGdwb21ucm14bWJqcGF0Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3Nzg1MDQ5MDAsImV4cCI6MjA5NDA4MDkwMH0.sy8zDIdh9RBhl9TOqg6PnfTehqtV7VcFQSaSPoc4MoI'          // thay bằng anon key

const supabase = createClient(SUPABASE_URL, SUPABASE_KEY)

const GAMES = []

window.GAMES_READY = (async () => {
  const { data, error } = await supabase
    .from('games')
    .select('*')
    .order('sort_order')

  if (error) { console.error('Supabase error:', error); return }

  // Map tên cột snake_case → camelCase cho app.js dùng
  data.forEach(g => {
    GAMES.push({
      name:       g.name,
      emoji:      g.emoji,
      color:      g.color,
      categories: g.categories || [],
      players:    g.players,
      time:       g.time,
      difficulty: g.difficulty,
      objective:  g.objective,
      setup:      g.setup      || [],
      turn:       g.turn       || [],
      win:        g.win,
      tips:       g.tips       || [],
      youtubeUrl: g.youtube_url,
      heroBg:     g.hero_bg,
      images:     g.images     || [],
    })
  })
})()
