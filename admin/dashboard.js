```javascript
const SUPABASE_URL = "https://dklfwlgpomnrmxmbjpat.supabase.co";

const SUPABASE_KEY =
"eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImRrbGZ3bGdwb21ucm14bWJqcGF0Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3Nzg1MDQ5MDAsImV4cCI6MjA5NDA4MDkwMH0.sy8zDIdh9RBhl9TOqg6PnfTehqtV7VcFQSaSPoc4MoI";

const client = supabase.createClient(
  SUPABASE_URL,
  SUPABASE_KEY
);

const tableBody = document.getElementById("gameTableBody");
const searchInput = document.getElementById("searchInput");

const modal = document.getElementById("gameModal");

const addGameBtn = document.getElementById("addGameBtn");
const closeModalBtn = document.getElementById("closeModalBtn");

const saveBtn = document.getElementById("saveBtn");
const deleteBtn = document.getElementById("deleteBtn");

let games = [];

/* LOAD GAMES */

async function loadGames(){

  const { data, error } = await client
    .from("games")
    .select("*")
    .order("sort_order", { ascending:true });

  if(error){
    console.error(error);
    return;
  }

  games = data || [];

  renderGames(games);

  updateStats(games);

}

/* STATS */

function updateStats(data){

  document.getElementById("totalGames").innerText =
    data.length;

  const categories = new Set();

  let youtubeCount = 0;
  let imageCount = 0;

  data.forEach(game => {

    if(game.youtube_url){
      youtubeCount++;
    }

    if(game.hero_bg){
      imageCount++;
    }

    if(Array.isArray(game.categories)){

      game.categories.forEach(cat => {
        categories.add(cat);
      });

    }

  });

  document.getElementById("totalCategories").innerText =
    categories.size;

  document.getElementById("youtubeCount").innerText =
    youtubeCount;

  document.getElementById("imageCount").innerText =
    imageCount;

}

/* DIFFICULTY */

function difficultyClass(value){

  if(!value) return "medium";

  value = value.toLowerCase();

  if(value.includes("easy")) return "easy";

  if(value.includes("hard")) return "hard";

  return "medium";

}

/* RENDER */

function renderGames(data){

  tableBody.innerHTML = "";

  data.forEach(game => {

    const tr = document.createElement("tr");

    tr.innerHTML = `

      <td>

        <div class="game-info">

          <img
            class="game-image"
            src="${game.hero_bg || 'https://placehold.co/200x200'}"
          >

          <div>

            <div class="game-name">
              ${game.emoji || '🎲'} ${game.name}
            </div>

            <div class="game-id">
              ID: ${game.id}
            </div>

          </div>

        </div>

      </td>

      <td>
        ${game.players || '-'}
      </td>

      <td>
        ${game.time || '-'}
      </td>

      <td>

        <div class="difficulty ${difficultyClass(game.difficulty)}">
          ${game.difficulty || 'Medium'}
        </div>

      </td>

      <td>

        <div class="badge">
          ${game.categories?.[0] || 'Boardgame'}
        </div>

      </td>

      <td>

        <div style="display:flex;gap:8px;">

          <button
            class="btn btn-primary edit-btn"
            data-id="${game.id}"
          >
            Edit
          </button>

          <a
            class="youtube-link"
            href="${game.youtube_url || '#'}"
            target="_blank"
          >
            ▶
          </a>

        </div>

      </td>

    `;

    tableBody.appendChild(tr);

  });

}

/* SEARCH */

searchInput.addEventListener("input", (e)=>{

  const value = e.target.value.toLowerCase();

  const filtered = games.filter(game => {

    return game.name
      ?.toLowerCase()
      .includes(value);

  });

  renderGames(filtered);

});

/* OPEN ADD MODAL */

addGameBtn.addEventListener("click", ()=>{

  clearForm();

  document.getElementById("modalTitle").innerText =
    "Thêm Boardgame";

  deleteBtn.style.display = "none";

  modal.classList.remove("hidden");

});

/* CLOSE MODAL */

closeModalBtn.addEventListener("click", ()=>{

  modal.classList.add("hidden");

});

/* SAVE */

async function saveGame(){

  const id = document.getElementById("gameId").value;

  const payload = {

    name:
      document.getElementById("nameInput").value,

    emoji:
      document.getElementById("emojiInput").value,

    players:
      document.getElementById("playersInput").value,

    time:
      document.getElementById("timeInput").value,

    difficulty:
      document.getElementById("difficultyInput").value,

    objective:
      document.getElementById("objectiveInput").value,

    hero_bg:
      document.getElementById("heroInput").value,

    youtube_url:
      document.getElementById("youtubeInput").value,

    categories: [
      document.getElementById("categoryInput").value
    ]

  };

  try{

    if(id){

      const { error } = await client
        .from("games")
        .update(payload)
        .eq("id", id);

      if(error) throw error;

    }else{

      const { error } = await client
        .from("games")
        .insert(payload);

      if(error) throw error;

    }

    modal.classList.add("hidden");

    loadGames();

  }catch(err){

    console.error(err);

    alert(err.message);

  }

}

saveBtn.addEventListener("click", saveGame);

/* DELETE */

async function deleteGame(){

  const id = document.getElementById("gameId").value;

  if(!id) return;

  const confirmDelete =
    confirm("Xóa boardgame này?");

  if(!confirmDelete) return;

  try{

    const { error } = await client
      .from("games")
      .delete()
      .eq("id", id);

    if(error) throw error;

    modal.classList.add("hidden");

    loadGames();

  }catch(err){

    console.error(err);

    alert(err.message);

  }

}

deleteBtn.addEventListener("click", deleteGame);

/* CLEAR FORM */

function clearForm(){

  document.getElementById("gameId").value = "";

  document.getElementById("nameInput").value = "";

  document.getElementById("emojiInput").value = "";

  document.getElementById("playersInput").value = "";

  document.getElementById("timeInput").value = "";

  document.getElementById("difficultyInput").value = "";

  document.getElementById("objectiveInput").value = "";

  document.getElementById("heroInput").value = "";

  document.getElementById("youtubeInput").value = "";

  document.getElementById("categoryInput").value = "";

}

/* EDIT */

document.addEventListener("click", (e)=>{

  if(e.target.classList.contains("edit-btn")){

    const id = Number(e.target.dataset.id);

    const game = games.find(g => g.id === id);

    if(!game) return;

    document.getElementById("modalTitle").innerText =
      "Chỉnh sửa Boardgame";

    document.getElementById("gameId").value =
      game.id;

    document.getElementById("nameInput").value =
      game.name || "";

    document.getElementById("emojiInput").value =
      game.emoji || "";

    document.getElementById("playersInput").value =
      game.players || "";

    document.getElementById("timeInput").value =
      game.time || "";

    document.getElementById("difficultyInput").value =
      game.difficulty || "";

    document.getElementById("objectiveInput").value =
      game.objective || "";

    document.getElementById("heroInput").value =
      game.hero_bg || "";

    document.getElementById("youtubeInput").value =
      game.youtube_url || "";

    document.getElementById("categoryInput").value =
      game.categories?.[0] || "";

    deleteBtn.style.display = "inline-flex";

    modal.classList.remove("hidden");

  }

});

/* REFRESH */

document
.getElementById("refreshBtn")
.addEventListener("click", ()=>{

  loadGames();

});

/* INIT */

loadGames();
```
