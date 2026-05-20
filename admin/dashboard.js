import { createClient }
from 'https://cdn.jsdelivr.net/npm/@supabase/supabase-js/+esm'

const supabase = createClient(
  'https://dklfwlgpomnrmxmbjpat.supabase.co',
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImRrbGZ3bGdwb21ucm14bWJqcGF0Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3Nzg1MDQ5MDAsImV4cCI6MjA5NDA4MDkwMH0.sy8zDIdh9RBhl9TOqg6PnfTehqtV7VcFQSaSPoc4MoI'
)

const statusEl =
  document.getElementById('status')

document
  .getElementById('uploadBtn')
  .addEventListener('click', uploadGame)

async function uploadGame(){

  statusEl.innerHTML =
    '⏳ Đang upload...'

  try{

    const payload = {

      name:
        document.getElementById('name').value,

      emoji:
        document.getElementById('emoji').value,

      color:
        document.getElementById('color').value,

      categories:
        JSON.parse(
          document.getElementById('categories').value || '[]'
        ),

      players:
        document.getElementById('players').value,

      time:
        document.getElementById('time').value,

      difficulty:
        document.getElementById('difficulty').value,

      objective:
        document.getElementById('objective').value,

      setup:
        JSON.parse(
          document.getElementById('setup').value || '[]'
        ),

      turn:
        JSON.parse(
          document.getElementById('turn').value || '[]'
        ),

      win:
        document.getElementById('win').value,

      tips:
        JSON.parse(
          document.getElementById('tips').value || '[]'
        ),

      youtube_url:
        document.getElementById('youtube_url').value,

      hero_bg:
        document.getElementById('hero_bg').value,

      images:
        JSON.parse(
          document.getElementById('images').value || '[]'
        )

    }

    const { error } = await supabase
      .from('games')
      .insert([payload])

    if(error){
      throw error
    }

    statusEl.innerHTML = `
      <div class="success">
        ✅ Upload game thành công!
      </div>
    `

  }
  catch(err){

    console.error(err)

    statusEl.innerHTML = `
      <div class="error">
        ❌ ${err.message}
      </div>
    `
  }
}
