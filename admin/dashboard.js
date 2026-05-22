const SUPABASE_URL = "https://dklfwlgpomnrmxmbjpat.supabase.co";

const SUPABASE_KEY =
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImRrbGZ3bGdwb21ucm14bWJqcGF0Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3Nzg1MDQ5MDAsImV4cCI6MjA5NDA4MDkwMH0.sy8zDIdh9RBhl9TOqg6PnfTehqtV7VcFQSaSPoc4MoI";

const client = supabase.createClient(SUPABASE_URL, SUPABASE_KEY);

const tableBody   = document.getElementById("gameTableBody");
const searchInput = document.getElementById("searchInput");
const modal       = document.getElementById("gameModal");
const addGameBtn  = document.getElementById("addGameBtn");
const closeModalBtn = document.getElementById("closeModalBtn");
const saveBtn     = document.getElementById("saveBtn");
const deleteBtn   = document.getElementById("deleteBtn");
const loadingMsg  = document.getElementById("loadingMsg");
const errorMsg    = document.getElementById("errorMsg");
const gameTable   = document.getElementById("gameTable");

let games = [];

/* ── LOAD GAMES ─────────────────────────────── */

async function loadGames() {
  loadingMsg.classList.remove("hidden");
  errorMsg.classList.add("hidden");
  gameTable.classList.add("hidden");

  const { data, error } = await client
    .from("games")
    .select("*")
    .order("sort_order", { ascending: true });

  loadingMsg.classList.add("hidden");

  if (error) {
    console.error(error);
    errorMsg.textContent = "❌ Lỗi khi tải dữ liệu: " + error.message;
    errorMsg.classList.remove("hidden");
    return;
  }

  games = data || [];
  gameTable.classList.remove("hidden");
  renderGames(games);
  updateStats(games);
}

/* ── STATS ───────────────────────────────────── */

function updateStats(data) {
  document.getElementById("totalGames").innerText = data.length;

  const categories = new Set();
  let youtubeCount = 0;
  let imageCount = 0;

  data.forEach(game => {
    if (game.youtube_url) youtubeCount++;
    if (game.hero_bg) imageCount++;
    if (Array.isArray(game.categories)) {
      game.categories.forEach(cat => categories.add(cat));
    }
  });

  document.getElementById("totalCategories").innerText = categories.size;
  document.getElementById("youtubeCount").innerText   = youtubeCount;
  document.getElementById("imageCount").innerText     = imageCount;
}

/* ── DIFFICULTY ──────────────────────────────── */

function difficultyClass(value) {
  if (!value) return "medium";
  const v = value.toLowerCase();
  if (v.includes("easy") || v.includes("dễ"))   return "easy";
  if (v.includes("hard") || v.includes("khó"))   return "hard";
  return "medium";
}

/* ── RENDER TABLE ────────────────────────────── */

function renderGames(data) {
  tableBody.innerHTML = "";

  if (data.length === 0) {
    tableBody.innerHTML = `
      <tr>
        <td colspan="6" style="text-align:center;padding:40px;color:var(--text-muted);">
          Không tìm thấy game nào.
        </td>
      </tr>`;
    return;
  }

  data.forEach(game => {
    const tr = document.createElement("tr");

    const imgSrc = game.hero_bg || "https://placehold.co/48x48";
    const name   = game.name   || "(không tên)";
    const emoji  = game.emoji  || "🎲";
    const diff   = game.difficulty || "Medium";
    const cat    = (Array.isArray(game.categories) && game.categories[0]) || "Boardgame";
    const yt     = game.youtube_url || "#";

    tr.innerHTML = `
      <td>
        <div class="game-info">
          <img class="game-image" src="${imgSrc}" alt="${name}" onerror="this.src='https://placehold.co/48x48'">
          <div>
            <div class="game-name">${emoji} ${name}</div>
            <div class="game-id">ID: ${game.id}</div>
          </div>
        </div>
      </td>
      <td>${game.players || "—"}</td>
      <td>${game.time    || "—"}</td>
      <td>
        <div class="difficulty ${difficultyClass(diff)}">${diff}</div>
      </td>
      <td>
        <div class="badge">${cat}</div>
      </td>
      <td>
        <div style="display:flex;gap:8px;align-items:center;">
          <button class="btn btn-primary edit-btn" data-id="${game.id}">Edit</button>
          <a class="youtube-link" href="${yt}" target="_blank" title="Xem YouTube">▶</a>
        </div>
      </td>
    `;

    tableBody.appendChild(tr);
  });
}

/* ── SEARCH ──────────────────────────────────── */

searchInput.addEventListener("input", e => {
  const value = e.target.value.toLowerCase();
  const filtered = games.filter(g =>
    (g.name || "").toLowerCase().includes(value)
  );
  renderGames(filtered);
});

/* ── OPEN ADD MODAL ──────────────────────────── */

addGameBtn.addEventListener("click", () => {
  clearForm();
  document.getElementById("modalTitle").innerText = "Thêm Boardgame";
  deleteBtn.style.display = "none";
  modal.classList.remove("hidden");
});

/* ── CLOSE MODAL ─────────────────────────────── */

closeModalBtn.addEventListener("click", () => {
  modal.classList.add("hidden");
});

modal.addEventListener("click", e => {
  if (e.target === modal) modal.classList.add("hidden");
});

/* ── SAVE ────────────────────────────────────── */

async function saveGame() {
  const id = document.getElementById("gameId").value;

  const payload = {
    name:       document.getElementById("nameInput").value.trim(),
    emoji:      document.getElementById("emojiInput").value.trim(),
    players:    document.getElementById("playersInput").value.trim(),
    time:       document.getElementById("timeInput").value.trim(),
    difficulty: document.getElementById("difficultyInput").value.trim(),
    objective:  document.getElementById("objectiveInput").value.trim(),
    hero_bg:    document.getElementById("heroInput").value.trim(),
    youtube_url:document.getElementById("youtubeInput").value.trim(),
    categories: [document.getElementById("categoryInput").value.trim()].filter(Boolean),
  };

  if (!payload.name) {
    alert("Vui lòng nhập tên game.");
    return;
  }

  saveBtn.disabled = true;
  saveBtn.textContent = "Đang lưu...";

  try {
    if (id) {
      const { error } = await client.from("games").update(payload).eq("id", id);
      if (error) throw error;
    } else {
      const { error } = await client.from("games").insert(payload);
      if (error) throw error;
    }
    modal.classList.add("hidden");
    loadGames();
  } catch (err) {
    console.error(err);
    alert("Lỗi: " + err.message);
  } finally {
    saveBtn.disabled = false;
    saveBtn.textContent = "💾 Lưu";
  }
}

saveBtn.addEventListener("click", saveGame);

/* ── DELETE ──────────────────────────────────── */

async function deleteGame() {
  const id = document.getElementById("gameId").value;
  if (!id) return;
  if (!confirm("Xóa boardgame này?")) return;

  deleteBtn.disabled = true;

  try {
    const { error } = await client.from("games").delete().eq("id", id);
    if (error) throw error;
    modal.classList.add("hidden");
    loadGames();
  } catch (err) {
    console.error(err);
    alert("Lỗi: " + err.message);
  } finally {
    deleteBtn.disabled = false;
  }
}

deleteBtn.addEventListener("click", deleteGame);

/* ── CLEAR FORM ──────────────────────────────── */

function clearForm() {
  ["gameId","nameInput","emojiInput","playersInput","timeInput",
   "difficultyInput","objectiveInput","heroInput","youtubeInput","categoryInput"]
    .forEach(id => document.getElementById(id).value = "");
}

/* ── EDIT (event delegation) ─────────────────── */

document.addEventListener("click", e => {
  if (!e.target.classList.contains("edit-btn")) return;

  const id   = Number(e.target.dataset.id);
  const game = games.find(g => g.id === id);
  if (!game) return;

  document.getElementById("modalTitle").innerText = "Chỉnh sửa Boardgame";
  document.getElementById("gameId").value         = game.id;
  document.getElementById("nameInput").value      = game.name        || "";
  document.getElementById("emojiInput").value     = game.emoji       || "";
  document.getElementById("playersInput").value   = game.players     || "";
  document.getElementById("timeInput").value      = game.time        || "";
  document.getElementById("difficultyInput").value= game.difficulty  || "";
  document.getElementById("objectiveInput").value = game.objective   || "";
  document.getElementById("heroInput").value      = game.hero_bg     || "";
  document.getElementById("youtubeInput").value   = game.youtube_url || "";
  document.getElementById("categoryInput").value  = game.categories?.[0] || "";

  deleteBtn.style.display = "inline-flex";
  modal.classList.remove("hidden");
});

/* ── REFRESH ─────────────────────────────────── */

document.getElementById("refreshBtn").addEventListener("click", loadGames);

/* ── INIT ────────────────────────────────────── */

loadGames();
