const SUPABASE_URL = "https://dklfwlgpomnrmxmbjpat.supabase.co";

const SUPABASE_KEY =
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImRrbGZ3bGdwb21ucm14bWJqcGF0Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3Nzg1MDQ5MDAsImV4cCI6MjA5NDA4MDkwMH0.sy8zDIdh9RBhl9TOqg6PnfTehqtV7VcFQSaSPoc4MoI";

const client = supabase.createClient(SUPABASE_URL, SUPABASE_KEY);

const tableBody     = document.getElementById("gameTableBody");
const searchInput   = document.getElementById("searchInput");
const modal         = document.getElementById("gameModal");
const addGameBtn    = document.getElementById("addGameBtn");
const closeModalBtn = document.getElementById("closeModalBtn");
const saveBtn       = document.getElementById("saveBtn");
const deleteBtn     = document.getElementById("deleteBtn");
const loadingMsg    = document.getElementById("loadingMsg");
const errorMsg      = document.getElementById("errorMsg");
const gameTable     = document.getElementById("gameTable");

let games = [];

/* ══════════════════════════════════════════════
   EMOJI PICKER
   ══════════════════════════════════════════════ */

const EMOJI_CATEGORIES = [
  {
    label: "Yêu thích",
    icon: "⭐",
    emojis: ["🎲","🃏","♟️","🎯","🧩","🎮","🏆","🥇","🎪","🎭","🎨","🎬","🎤","🎸","🎺","🎻"]
  },
  {
    label: "Mặt",
    icon: "😀",
    emojis: ["😀","😁","😂","🤣","😃","😄","😅","😆","😇","😈","😉","😊","😋","😌","😍","😎",
             "😏","😐","😑","😒","😓","😔","😕","😖","😗","😘","😙","😚","😛","😜","😝","😞",
             "😟","😠","😡","😢","😣","😤","😥","😦","😧","😨","😩","😪","😫","😬","😭","😮",
             "😯","😰","😱","😲","😳","😴","😵","😶","😷","🤐","🤑","🤒","🤓","🤔","🤕","🤗"]
  },
  {
    label: "Động vật",
    icon: "🐶",
    emojis: ["🐶","🐱","🐭","🐹","🐰","🦊","🐻","🐼","🐨","🐯","🦁","🐮","🐷","🐸","🐵","🙈",
             "🙉","🙊","🐔","🐧","🐦","🐤","🦆","🦅","🦉","🦇","🐺","🐗","🐴","🦄","🐝","🐛",
             "🦋","🐌","🐞","🐜","🦟","🦗","🦂","🐢","🐍","🦎","🦖","🦕","🐙","🦑","🦐","🦞"]
  },
  {
    label: "Thực vật",
    icon: "🌿",
    emojis: ["🌸","🌺","🌻","🌹","🌷","🌼","💐","🍀","🍁","🍂","🍃","🌿","☘️","🎋","🎍","🍄",
             "🌾","🌵","🌴","🌳","🌲","🎄","🌱","🌰","🌙","⭐","🌟","💫","✨","🔥","🌊","🌈"]
  },
  {
    label: "Đồ ăn",
    icon: "🍕",
    emojis: ["🍕","🍔","🍟","🌭","🥪","🥙","🧆","🌮","🌯","🥗","🥘","🥫","🍝","🍜","🍲","🍛",
             "🍣","🍱","🥟","🦪","🍤","🍙","🍚","🍘","🍥","🥮","🍢","🧁","🎂","🍰","🍮","🍭",
             "🍬","🍫","🍿","🍩","🍪","🌰","🥜","🍯","🧃","🥤","☕","🍵","🧊","🥛","🍺","🍸"]
  },
  {
    label: "Hoạt động",
    icon: "⚽",
    emojis: ["⚽","🏀","🏈","⚾","🥎","🏐","🏉","🎾","🥏","🎳","🏏","🏑","🏒","🥍","🏓","🏸",
             "🥊","🥋","🎽","⛸️","🛹","🛼","🛷","🎿","🤸","🏋️","🤼","🤺","🤾","🏇","⛹️","🤽",
             "🧗","🏄","🚣","🧘","🏊","🚴","🏆","🥇","🥈","🥉","🏅","🎖️","🎗️","🎫","🎟️","🎪"]
  },
  {
    label: "Vật thể",
    icon: "💎",
    emojis: ["💎","🔮","🎱","🧿","🪬","🗝️","🔑","💡","🔦","🕯️","🪔","🧲","💰","💵","💳","📱",
             "💻","🖥️","⌨️","🖱️","🖨️","📷","📸","📹","🎥","📽️","🎞️","📞","☎️","📟","📠","📺",
             "📻","🧭","⏱️","⌚","⏰","🕰️","📡","🔭","🔬","🧬","🧪","🧫","🧯","🔧","🔨","⚙️"]
  },
  {
    label: "Ký hiệu",
    icon: "❤️",
    emojis: ["❤️","🧡","💛","💚","💙","💜","🖤","🤍","🤎","💔","❣️","💕","💞","💓","💗","💖",
             "💘","💝","💟","☮️","✝️","☪️","🕉️","☸️","✡️","🔯","🕎","☯️","☦️","🛐","⛎","♈",
             "♉","♊","♋","♌","♍","♎","♏","♐","♑","♒","♓","⛔","🚫","💯","🔞","📵","🚳","🚭"]
  }
];

// flat map for search
const ALL_EMOJIS = EMOJI_CATEGORIES.flatMap(c => c.emojis);
const UNIQUE_EMOJIS = [...new Set(ALL_EMOJIS)];

let currentCategory = 0;
let currentEmoji    = "🎲";
let pickerOpen      = false;

const emojiInput      = document.getElementById("emojiInput");
const emojiPreview    = document.getElementById("emojiPreview");
const emojiToggleBtn  = document.getElementById("emojiToggleBtn");
const emojiPicker     = document.getElementById("emojiPicker");
const emojiGrid       = document.getElementById("emojiGrid");
const emojiCategories = document.getElementById("emojiCategories");
const emojiSearch     = document.getElementById("emojiSearch");

function buildCategoryTabs() {
  emojiCategories.innerHTML = "";
  EMOJI_CATEGORIES.forEach((cat, i) => {
    const btn = document.createElement("button");
    btn.className = "emoji-cat-btn" + (i === currentCategory ? " active" : "");
    btn.textContent = cat.icon;
    btn.title = cat.label;
    btn.addEventListener("click", () => {
      currentCategory = i;
      emojiSearch.value = "";
      buildCategoryTabs();
      renderEmojiGrid(EMOJI_CATEGORIES[i].emojis);
    });
    emojiCategories.appendChild(btn);
  });
}

function renderEmojiGrid(list) {
  emojiGrid.innerHTML = "";
  list.forEach(emoji => {
    const btn = document.createElement("button");
    btn.className = "emoji-item" + (emoji === currentEmoji ? " selected" : "");
    btn.textContent = emoji;
    btn.title = emoji;
    btn.addEventListener("click", () => selectEmoji(emoji));
    emojiGrid.appendChild(btn);
  });
}

function selectEmoji(emoji) {
  currentEmoji        = emoji;
  emojiInput.value    = emoji;
  emojiPreview.textContent = emoji;
  closePicker();
}

function openPicker() {
  pickerOpen = true;
  emojiPicker.classList.remove("hidden");
  emojiToggleBtn.textContent = "▲";
  buildCategoryTabs();
  renderEmojiGrid(EMOJI_CATEGORIES[currentCategory].emojis);
  emojiSearch.focus();
}

function closePicker() {
  pickerOpen = false;
  emojiPicker.classList.add("hidden");
  emojiToggleBtn.textContent = "▼";
}

emojiToggleBtn.addEventListener("click", e => {
  e.stopPropagation();
  pickerOpen ? closePicker() : openPicker();
});

emojiInput.addEventListener("click", e => {
  e.stopPropagation();
  if (!pickerOpen) openPicker();
});

emojiSearch.addEventListener("input", e => {
  const q = e.target.value.trim();
  if (!q) {
    renderEmojiGrid(EMOJI_CATEGORIES[currentCategory].emojis);
    return;
  }
  // simple search: show emojis whose unicode name fragment matches (we approximate via array position)
  const filtered = UNIQUE_EMOJIS.filter(em => em.includes(q));
  renderEmojiGrid(filtered.length ? filtered : UNIQUE_EMOJIS.slice(0, 64));
});

// Close picker when clicking outside
document.addEventListener("click", e => {
  if (pickerOpen && !emojiPicker.contains(e.target) && e.target !== emojiToggleBtn && e.target !== emojiInput) {
    closePicker();
  }
});

// Prevent picker from closing when clicking inside it
emojiPicker.addEventListener("click", e => e.stopPropagation());

/* ══════════════════════════════════════════════
   LOAD GAMES
   ══════════════════════════════════════════════ */

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

/* ══════════════════════════════════════════════
   STATS
   ══════════════════════════════════════════════ */

function updateStats(data) {
  document.getElementById("totalGames").innerText = data.length;

  const categories = new Set();
  let youtubeCount = 0;
  let imageCount   = 0;

  data.forEach(game => {
    if (game.youtube_url) youtubeCount++;
    if (game.hero_bg) imageCount++;
    if (Array.isArray(game.categories)) {
      game.categories.forEach(cat => categories.add(cat));
    }
  });

  document.getElementById("totalCategories").innerText = categories.size;
  document.getElementById("youtubeCount").innerText    = youtubeCount;
  document.getElementById("imageCount").innerText      = imageCount;
}

/* ══════════════════════════════════════════════
   DIFFICULTY
   ══════════════════════════════════════════════ */

function difficultyClass(value) {
  if (!value) return "medium";
  const v = value.toLowerCase();
  if (v.includes("easy") || v.includes("dễ"))   return "easy";
  if (v.includes("hard") || v.includes("khó"))   return "hard";
  return "medium";
}

/* ══════════════════════════════════════════════
   RENDER TABLE
   ══════════════════════════════════════════════ */

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
      <td><div class="difficulty ${difficultyClass(diff)}">${diff}</div></td>
      <td><div class="badge">${cat}</div></td>
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

/* ══════════════════════════════════════════════
   SEARCH
   ══════════════════════════════════════════════ */

searchInput.addEventListener("input", e => {
  const value = e.target.value.toLowerCase();
  const filtered = games.filter(g =>
    (g.name || "").toLowerCase().includes(value)
  );
  renderGames(filtered);
});

/* ══════════════════════════════════════════════
   OPEN ADD MODAL
   ══════════════════════════════════════════════ */

addGameBtn.addEventListener("click", () => {
  clearForm();
  document.getElementById("modalTitle").innerText = "Thêm Boardgame";
  deleteBtn.style.display = "none";
  modal.classList.remove("hidden");
});

/* ══════════════════════════════════════════════
   CLOSE MODAL
   ══════════════════════════════════════════════ */

closeModalBtn.addEventListener("click", () => modal.classList.add("hidden"));

modal.addEventListener("click", e => {
  if (e.target === modal) modal.classList.add("hidden");
});

/* ══════════════════════════════════════════════
   SAVE
   ══════════════════════════════════════════════ */

async function saveGame() {
  const rawId = document.getElementById("gameId").value;
  const id    = rawId ? Number(rawId) : null;

  const payload = {
    name:        document.getElementById("nameInput").value.trim(),
    emoji:       emojiInput.value.trim() || currentEmoji,
    players:     document.getElementById("playersInput").value.trim(),
    time:        document.getElementById("timeInput").value.trim(),
    difficulty:  document.getElementById("difficultyInput").value.trim(),
    objective:   document.getElementById("objectiveInput").value.trim(),
    hero_bg:     document.getElementById("heroInput").value.trim(),
    youtube_url: document.getElementById("youtubeInput").value.trim(),
    categories:  [document.getElementById("categoryInput").value.trim()].filter(Boolean),
  };

  if (!payload.name) {
    alert("Vui lòng nhập tên game.");
    return;
  }

  saveBtn.disabled    = true;
  saveBtn.textContent = "Đang lưu...";

  console.log("💾 saveGame →", id ? `UPDATE id=${id}` : "INSERT", payload);

  try {
    if (id) {
      const { data, error, status, statusText } = await client
        .from("games")
        .update(payload)
        .eq("id", id)
        .select();

      console.log("Supabase UPDATE response:", { data, error, status, statusText });

      if (error) throw error;
      if (!data || data.length === 0) {
        throw new Error(
          `UPDATE không ảnh hưởng dòng nào (id=${id}). Có thể RLS đang chặn — hãy kiểm tra Supabase > Authentication > Policies.`
        );
      }
    } else {
      const { data, error, status } = await client
        .from("games")
        .insert(payload)
        .select();

      console.log("Supabase INSERT response:", { data, error, status });

      if (error) throw error;
    }

    modal.classList.add("hidden");
    await loadGames();

    // flash thông báo thành công
    const toast = document.createElement("div");
    toast.textContent = "✅ Đã lưu thành công!";
    Object.assign(toast.style, {
      position: "fixed", bottom: "28px", right: "28px",
      background: "#00b894", color: "#fff",
      padding: "12px 22px", borderRadius: "10px",
      fontWeight: "600", fontSize: "14px",
      boxShadow: "0 4px 16px rgba(0,0,0,0.15)", zIndex: "9999"
    });
    document.body.appendChild(toast);
    setTimeout(() => toast.remove(), 3000);

  } catch (err) {
    console.error("❌ saveGame error:", err);
    alert("❌ Lỗi khi lưu:\n\n" + err.message);
  } finally {
    saveBtn.disabled    = false;
    saveBtn.textContent = "💾 Lưu";
  }
}

saveBtn.addEventListener("click", saveGame);

/* ══════════════════════════════════════════════
   DELETE
   ══════════════════════════════════════════════ */

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

/* ══════════════════════════════════════════════
   CLEAR FORM
   ══════════════════════════════════════════════ */

function clearForm() {
  ["gameId","nameInput","playersInput","timeInput","difficultyInput",
   "objectiveInput","heroInput","youtubeInput","categoryInput"]
    .forEach(id => document.getElementById(id).value = "");

  // reset emoji
  currentEmoji = "🎲";
  emojiInput.value = "🎲";
  emojiPreview.textContent = "🎲";
  closePicker();
}

/* ══════════════════════════════════════════════
   EDIT (event delegation)
   ══════════════════════════════════════════════ */

document.addEventListener("click", e => {
  if (!e.target.classList.contains("edit-btn")) return;

  const id   = Number(e.target.dataset.id);
  const game = games.find(g => g.id === id);
  if (!game) return;

  document.getElementById("modalTitle").innerText   = "Chỉnh sửa Boardgame";
  document.getElementById("gameId").value           = game.id;
  document.getElementById("nameInput").value        = game.name        || "";
  document.getElementById("playersInput").value     = game.players     || "";
  document.getElementById("timeInput").value        = game.time        || "";
  document.getElementById("difficultyInput").value  = game.difficulty  || "";
  document.getElementById("objectiveInput").value   = game.objective   || "";
  document.getElementById("heroInput").value        = game.hero_bg     || "";
  document.getElementById("youtubeInput").value     = game.youtube_url || "";
  document.getElementById("categoryInput").value    = game.categories?.[0] || "";

  // set emoji
  const em = game.emoji || "🎲";
  currentEmoji             = em;
  emojiInput.value         = em;
  emojiPreview.textContent = em;
  closePicker();

  deleteBtn.style.display = "inline-flex";
  modal.classList.remove("hidden");
});

/* ══════════════════════════════════════════════
   REFRESH
   ══════════════════════════════════════════════ */

document.getElementById("refreshBtn").addEventListener("click", loadGames);

/* ══════════════════════════════════════════════
   INIT
   ══════════════════════════════════════════════ */

loadGames();
