const SUPABASE_URL = "https://dklfwlgpomnrmxmbjpat.supabase.co";
const SUPABASE_KEY =
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImRrbGZ3bGdwb21ucm14bWJqcGF0Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3Nzg1MDQ5MDAsImV4cCI6MjA5NDA4MDkwMH0.sy8zDIdh9RBhl9TOqg6PnfTehqtV7VcFQSaSPoc4MoI";

const client = supabase.createClient(SUPABASE_URL, SUPABASE_KEY);

/* ─── DOM refs ─── */
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
  { label:"Yêu thích", icon:"⭐", emojis:["🎲","🃏","♟️","🎯","🧩","🎮","🏆","🥇","🎪","🎭","🎨","🎬","🎤","🎸","🎺","🎻"] },
  { label:"Mặt", icon:"😀", emojis:["😀","😁","😂","🤣","😃","😄","😅","😆","😇","😈","😉","😊","😋","😌","😍","😎","😏","😐","😑","😒","😓","😔","😕","😖","😗","😘","😙","😚","😛","😜","😝","😞","😟","😠","😡","😢","😣","😤","😥","😦","😧","😨","😩","😪","😫","😬","😭","😮","😯","😰","😱","😲","😳","😴","😵","😶","😷","🤐","🤑","🤒","🤓","🤔","🤕","🤗"] },
  { label:"Động vật", icon:"🐶", emojis:["🐶","🐱","🐭","🐹","🐰","🦊","🐻","🐼","🐨","🐯","🦁","🐮","🐷","🐸","🐵","🙈","🙉","🙊","🐔","🐧","🐦","🐤","🦆","🦅","🦉","🦇","🐺","🐗","🐴","🦄","🐝","🐛","🦋","🐌","🐞","🐜","🦟","🦗","🦂","🐢","🐍","🦎","🦖","🦕","🐙","🦑","🦐","🦞"] },
  { label:"Thực vật", icon:"🌿", emojis:["🌸","🌺","🌻","🌹","🌷","🌼","💐","🍀","🍁","🍂","🍃","🌿","☘️","🎋","🎍","🍄","🌾","🌵","🌴","🌳","🌲","🎄","🌱","🌰","🌙","⭐","🌟","💫","✨","🔥","🌊","🌈"] },
  { label:"Đồ ăn", icon:"🍕", emojis:["🍕","🍔","🍟","🌭","🥪","🥙","🧆","🌮","🌯","🥗","🥘","🥫","🍝","🍜","🍲","🍛","🍣","🍱","🥟","🦪","🍤","🍙","🍚","🍘","🍥","🥮","🍢","🧁","🎂","🍰","🍮","🍭","🍬","🍫","🍿","🍩","🍪","🌰","🥜","🍯","🧃","🥤","☕","🍵","🧊","🥛","🍺","🍸"] },
  { label:"Hoạt động", icon:"⚽", emojis:["⚽","🏀","🏈","⚾","🥎","🏐","🏉","🎾","🥏","🎳","🏏","🏑","🏒","🥍","🏓","🏸","🥊","🥋","🎽","⛸️","🛹","🛼","🛷","🎿","🤸","🏋️","🤼","🤺","🤾","🏇","⛹️","🤽","🧗","🏄","🚣","🧘","🏊","🚴","🏆","🥇","🥈","🥉","🏅","🎖️","🎗️","🎫","🎟️","🎪"] },
  { label:"Vật thể", icon:"💎", emojis:["💎","🔮","🎱","🧿","🪬","🗝️","🔑","💡","🔦","🕯️","🪔","🧲","💰","💵","💳","📱","💻","🖥️","⌨️","🖱️","🖨️","📷","📸","📹","🎥","📽️","🎞️","📞","☎️","📟","📠","📺","📻","🧭","⏱️","⌚","⏰","🕰️","📡","🔭","🔬","🧬","🧪","🧫","🧯","🔧","🔨","⚙️"] },
  { label:"Ký hiệu", icon:"❤️", emojis:["❤️","🧡","💛","💚","💙","💜","🖤","🤍","🤎","💔","❣️","💕","💞","💓","💗","💖","💘","💝","💟","☮️","✝️","☪️","🕉️","☸️","✡️","🔯","🕎","☯️","☦️","🛐","⛎","♈","♉","♊","♋","♌","♍","♎","♏","♐","♑","♒","♓","⛔","🚫","💯","🔞","📵","🚳","🚭"] }
];

const ALL_EMOJIS    = EMOJI_CATEGORIES.flatMap(c => c.emojis);
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

function buildCategoryTabs(){
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

function renderEmojiGrid(list){
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

function selectEmoji(emoji){
  currentEmoji = emoji;
  emojiInput.value = emoji;
  emojiPreview.textContent = emoji;
  closePicker();
}

function openPicker(){
  pickerOpen = true;
  emojiPicker.classList.remove("hidden");
  emojiToggleBtn.textContent = "▲";
  buildCategoryTabs();
  renderEmojiGrid(EMOJI_CATEGORIES[currentCategory].emojis);
  emojiSearch.focus();
}

function closePicker(){
  pickerOpen = false;
  emojiPicker.classList.add("hidden");
  emojiToggleBtn.textContent = "▼";
}

emojiToggleBtn.addEventListener("click", e => { e.stopPropagation(); pickerOpen ? closePicker() : openPicker(); });
emojiInput.addEventListener("click", e => { e.stopPropagation(); if(!pickerOpen) openPicker(); });
emojiSearch.addEventListener("input", e => {
  const q = e.target.value.trim();
  if(!q){ renderEmojiGrid(EMOJI_CATEGORIES[currentCategory].emojis); return; }
  const filtered = UNIQUE_EMOJIS.filter(em => em.includes(q));
  renderEmojiGrid(filtered.length ? filtered : UNIQUE_EMOJIS.slice(0, 64));
});
document.addEventListener("click", e => {
  if(pickerOpen && !emojiPicker.contains(e.target) && e.target !== emojiToggleBtn && e.target !== emojiInput) closePicker();
});
emojiPicker.addEventListener("click", e => e.stopPropagation());

/* ══════════════════════════════════════════════
   ARRAY FIELD HELPERS
   ══════════════════════════════════════════════ */

/** Parse textarea value → string array (split by newline, filter blank) */
function parseLines(id){
  const val = document.getElementById(id)?.value || "";
  return val.split("\n").map(s => s.trim()).filter(Boolean);
}

/** Parse "url | caption" lines → [{url, caption}] array */
function parseImages(id){
  const val = document.getElementById(id)?.value || "";
  return val.split("\n").map(line => {
    const parts = line.split("|");
    return { url: (parts[0]||"").trim(), caption: (parts[1]||"").trim() };
  }).filter(img => img.url);
}

/** Set textarea from string array */
function setLines(id, arr){
  const el = document.getElementById(id);
  if(el) el.value = Array.isArray(arr) ? arr.join("\n") : "";
}

/** Set textarea from [{url, caption}] array */
function setImages(id, arr){
  const el = document.getElementById(id);
  if(el) el.value = Array.isArray(arr) ? arr.map(img => `${img.url} | ${img.caption||""}`).join("\n") : "";
}

/* ══════════════════════════════════════════════
   INJECT EXTRA FIELDS INTO MODAL
   ══════════════════════════════════════════════ */

function injectExtraFields(){
  // Check if already injected
  if(document.getElementById("colorInput")) return;

  const formGrid = document.querySelector(".form-grid");
  if(!formGrid) return;

  const extra = `
    <!-- Color -->
    <div class="form-group">
      <label>Màu chủ đạo (hex)</label>
      <div style="display:flex;gap:8px;align-items:center">
        <input type="color" id="colorPicker" value="#6c5ce7"
               style="width:44px;height:44px;border:1px solid var(--border);border-radius:10px;padding:2px;cursor:pointer;background:#fff">
        <input type="text"  id="colorInput" placeholder="#6c5ce7"
               style="flex:1" oninput="document.getElementById('colorPicker').value=this.value">
      </div>
    </div>

    <!-- Sort order -->
    <div class="form-group">
      <label>Thứ tự hiển thị</label>
      <input type="number" id="sortInput" placeholder="1, 2, 3...">
    </div>

    <!-- Win condition -->
    <div class="form-group full-width">
      <label>Điều kiện thắng</label>
      <textarea id="winInput" placeholder="Người đầu tiên gom đủ... / Người có điểm cao nhất..."></textarea>
    </div>

    <!-- Setup steps -->
    <div class="form-group full-width">
      <label>Các bước chuẩn bị <span style="color:var(--text-muted);font-weight:400">(mỗi bước 1 dòng)</span></label>
      <textarea id="setupInput" rows="5" placeholder="Đặt bảng chơi vào giữa bàn&#10;Mỗi người lấy 5 lá bài&#10;Xáo trộn bộ bài..."></textarea>
    </div>

    <!-- Turn steps -->
    <div class="form-group full-width">
      <label>Các bước lượt chơi <span style="color:var(--text-muted);font-weight:400">(mỗi bước 1 dòng)</span></label>
      <textarea id="turnInput" rows="5" placeholder="Rút 2 lá bài&#10;Thực hiện 1 hành động&#10;Kết thúc lượt..."></textarea>
    </div>

    <!-- Tips -->
    <div class="form-group full-width">
      <label>Mẹo chơi <span style="color:var(--text-muted);font-weight:400">(mỗi mẹo 1 dòng)</span></label>
      <textarea id="tipsInput" rows="4" placeholder="Ưu tiên tích điểm sớm&#10;Chú ý bài của đối thủ..."></textarea>
    </div>

    <!-- Images -->
    <div class="form-group full-width">
      <label>Ảnh hướng dẫn <span style="color:var(--text-muted);font-weight:400">(mỗi dòng: URL | caption)</span></label>
      <textarea id="imagesInput" rows="4" placeholder="https://... | Sắp xếp bảng cờ&#10;https://... | Bộ bài ban đầu"></textarea>
    </div>
  `;

  formGrid.insertAdjacentHTML("beforeend", extra);

  // Sync color picker ↔ text input
  document.getElementById("colorPicker").addEventListener("input", e => {
    document.getElementById("colorInput").value = e.target.value;
  });
}

/* ══════════════════════════════════════════════
   LOAD GAMES
   ══════════════════════════════════════════════ */

async function loadGames(){
  loadingMsg.classList.remove("hidden");
  errorMsg.classList.add("hidden");
  gameTable.classList.add("hidden");

  const { data, error } = await client
    .from("games")
    .select("*")
    .order("sort_order", { ascending: true });

  loadingMsg.classList.add("hidden");

  if(error){
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

function updateStats(data){
  document.getElementById("totalGames").innerText = data.length;
  const categories = new Set();
  let youtubeCount = 0, imageCount = 0;
  data.forEach(game => {
    if(game.youtube_url) youtubeCount++;
    if(game.hero_bg) imageCount++;
    if(Array.isArray(game.categories)) game.categories.forEach(cat => categories.add(cat));
  });
  document.getElementById("totalCategories").innerText = categories.size;
  document.getElementById("youtubeCount").innerText    = youtubeCount;
  document.getElementById("imageCount").innerText      = imageCount;
}

/* ══════════════════════════════════════════════
   DIFFICULTY
   ══════════════════════════════════════════════ */

function difficultyClass(value){
  if(!value) return "medium";
  const v = value.toLowerCase();
  if(v.includes("easy") || v.includes("dễ"))  return "easy";
  if(v.includes("hard") || v.includes("khó")) return "hard";
  return "medium";
}

/* ══════════════════════════════════════════════
   RENDER TABLE
   ══════════════════════════════════════════════ */

function renderGames(data){
  tableBody.innerHTML = "";
  if(!data.length){
    tableBody.innerHTML = `<tr><td colspan="6" style="text-align:center;padding:40px;color:var(--text-muted);">Không tìm thấy game nào.</td></tr>`;
    return;
  }
  data.forEach(game => {
    const tr = document.createElement("tr");
    const imgSrc = game.hero_bg || "https://placehold.co/48x48";
    const name   = game.name   || "(không tên)";
    const emoji  = game.emoji  || "🎲";
    const diff   = game.difficulty || "Medium";
    const cats   = Array.isArray(game.categories) ? game.categories : [];
    const cat    = cats[0] || "Boardgame";
    const yt     = game.youtube_url || "#";
    const colorDot = game.color ? `<span style="display:inline-block;width:10px;height:10px;border-radius:50%;background:${game.color};margin-right:4px;vertical-align:middle"></span>` : "";

    tr.innerHTML = `
      <td>
        <div class="game-info">
          <img class="game-image" src="${imgSrc}" alt="${name}" onerror="this.src='https://placehold.co/48x48'">
          <div>
            <div class="game-name">${emoji} ${name}</div>
            <div class="game-id">${colorDot}ID: ${game.id} · Order: ${game.sort_order ?? '—'}</div>
          </div>
        </div>
      </td>
      <td>${game.players || "—"}</td>
      <td>${game.time    || "—"}</td>
      <td><div class="difficulty ${difficultyClass(diff)}">${diff}</div></td>
      <td>${cats.map(c => `<div class="badge" style="margin-bottom:3px">${c}</div>`).join("") || `<div class="badge">${cat}</div>`}</td>
      <td>
        <div style="display:flex;gap:8px;align-items:center;">
          <button class="btn btn-primary edit-btn" data-id="${game.id}">✏️ Sửa</button>
          <a class="youtube-link" href="${yt}" target="_blank" title="YouTube">▶</a>
        </div>
      </td>`;
    tableBody.appendChild(tr);
  });
}

/* ══════════════════════════════════════════════
   SEARCH
   ══════════════════════════════════════════════ */

searchInput.addEventListener("input", e => {
  const v = e.target.value.toLowerCase();
  renderGames(games.filter(g => (g.name||"").toLowerCase().includes(v)));
});

/* ══════════════════════════════════════════════
   OPEN ADD MODAL
   ══════════════════════════════════════════════ */

addGameBtn.addEventListener("click", () => {
  injectExtraFields();
  clearForm();
  document.getElementById("modalTitle").innerText = "➕ Thêm Boardgame";
  deleteBtn.style.display = "none";
  modal.classList.remove("hidden");
});

/* ══════════════════════════════════════════════
   CLOSE MODAL
   ══════════════════════════════════════════════ */

closeModalBtn.addEventListener("click", () => modal.classList.add("hidden"));
modal.addEventListener("click", e => { if(e.target === modal) modal.classList.add("hidden"); });

/* ══════════════════════════════════════════════
   SAVE (INSERT + UPDATE)
   ══════════════════════════════════════════════ */

async function saveGame(){
  const rawId = document.getElementById("gameId").value;
  const id    = rawId ? Number(rawId) : null;

  const colorVal = document.getElementById("colorInput")?.value.trim() || "#6c5ce7";

  // Parse categories: comma or newline separated
  const catRaw = document.getElementById("categoryInput").value.trim();
  const categories = catRaw
    ? catRaw.split(/[,\n]/).map(s=>s.trim()).filter(Boolean)
    : [];

  const payload = {
    name:        document.getElementById("nameInput").value.trim(),
    emoji:       emojiInput.value.trim() || currentEmoji,
    color:       colorVal,
    players:     document.getElementById("playersInput").value.trim(),
    time:        document.getElementById("timeInput").value.trim(),
    difficulty:  document.getElementById("difficultyInput").value.trim(),
    objective:   document.getElementById("objectiveInput").value.trim(),
    win:         document.getElementById("winInput")?.value.trim() || "",
    hero_bg:     document.getElementById("heroInput").value.trim(),
    youtube_url: document.getElementById("youtubeInput").value.trim(),
    categories,
    setup:       parseLines("setupInput"),
    turn:        parseLines("turnInput"),
    tips:        parseLines("tipsInput"),
    images:      parseImages("imagesInput"),
    sort_order:  Number(document.getElementById("sortInput")?.value) || null,
  };

  if(!payload.name){
    alert("Vui lòng nhập tên game.");
    return;
  }

  saveBtn.disabled    = true;
  saveBtn.textContent = "Đang lưu...";

  console.log("💾 saveGame →", id ? `UPDATE id=${id}` : "INSERT", payload);

  try {
    if(id){
      const { data, error } = await client.from("games").update(payload).eq("id", id).select();
      console.log("UPDATE →", { data, error });
      if(error) throw error;
      if(!data || !data.length) throw new Error(`UPDATE không ảnh hưởng dòng nào (id=${id}). Kiểm tra RLS Supabase.`);
    } else {
      const { data, error } = await client.from("games").insert(payload).select();
      console.log("INSERT →", { data, error });
      if(error) throw error;
    }

    modal.classList.add("hidden");
    await loadGames();
    showToast("✅ Đã lưu thành công!");

  } catch(err){
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

async function deleteGame(){
  const id = document.getElementById("gameId").value;
  if(!id) return;
  const name = document.getElementById("nameInput").value || `ID=${id}`;
  if(!confirm(`Xóa "${name}"?\n\nHành động này không thể hoàn tác!`)) return;

  deleteBtn.disabled    = true;
  deleteBtn.textContent = "Đang xóa...";

  try {
    const { error } = await client.from("games").delete().eq("id", id);
    if(error) throw error;
    modal.classList.add("hidden");
    showToast("🗑️ Đã xóa thành công!", "#e17055");
    await loadGames();
  } catch(err){
    console.error(err);
    alert("Lỗi: " + err.message);
  } finally {
    deleteBtn.disabled    = false;
    deleteBtn.textContent = "🗑️ Xóa";
  }
}

deleteBtn.addEventListener("click", deleteGame);

/* ══════════════════════════════════════════════
   CLEAR FORM
   ══════════════════════════════════════════════ */

function clearForm(){
  ["gameId","nameInput","playersInput","timeInput","difficultyInput",
   "objectiveInput","heroInput","youtubeInput","categoryInput",
   "winInput","setupInput","turnInput","tipsInput","imagesInput","sortInput"]
    .forEach(id => { const el = document.getElementById(id); if(el) el.value = ""; });

  const ci = document.getElementById("colorInput");
  if(ci) ci.value = "#6c5ce7";
  const cp = document.getElementById("colorPicker");
  if(cp) cp.value = "#6c5ce7";

  currentEmoji = "🎲";
  emojiInput.value = "🎲";
  emojiPreview.textContent = "🎲";
  closePicker();
}

/* ══════════════════════════════════════════════
   EDIT — event delegation
   ══════════════════════════════════════════════ */

document.addEventListener("click", e => {
  if(!e.target.classList.contains("edit-btn")) return;
  injectExtraFields();

  const id   = Number(e.target.dataset.id);
  const game = games.find(g => g.id === id);
  if(!game) return;

  document.getElementById("modalTitle").innerText   = "✏️ Chỉnh sửa Boardgame";
  document.getElementById("gameId").value           = game.id;
  document.getElementById("nameInput").value        = game.name        || "";
  document.getElementById("playersInput").value     = game.players     || "";
  document.getElementById("timeInput").value        = game.time        || "";
  document.getElementById("difficultyInput").value  = game.difficulty  || "";
  document.getElementById("objectiveInput").value   = game.objective   || "";
  document.getElementById("heroInput").value        = game.hero_bg     || "";
  document.getElementById("youtubeInput").value     = game.youtube_url || "";

  // Categories — join by comma
  const cats = Array.isArray(game.categories) ? game.categories : [];
  document.getElementById("categoryInput").value = cats.join(", ");

  // Color
  const colorVal = game.color || "#6c5ce7";
  const ci = document.getElementById("colorInput");
  const cp = document.getElementById("colorPicker");
  if(ci) ci.value = colorVal;
  if(cp) cp.value = colorVal;

  // Sort order
  const so = document.getElementById("sortInput");
  if(so) so.value = game.sort_order ?? "";

  // Win
  const wi = document.getElementById("winInput");
  if(wi) wi.value = game.win || "";

  // Array fields
  setLines("setupInput",  game.setup);
  setLines("turnInput",   game.turn);
  setLines("tipsInput",   game.tips);
  setImages("imagesInput", game.images);

  // Emoji
  const em = game.emoji || "🎲";
  currentEmoji = em;
  emojiInput.value = em;
  emojiPreview.textContent = em;
  closePicker();

  deleteBtn.style.display = "inline-flex";
  modal.classList.remove("hidden");
});

/* ══════════════════════════════════════════════
   TOAST
   ══════════════════════════════════════════════ */

function showToast(msg, bg="#00b894"){
  const t = document.createElement("div");
  t.textContent = msg;
  Object.assign(t.style, {
    position:"fixed", bottom:"28px", right:"28px",
    background: bg, color:"#fff",
    padding:"12px 22px", borderRadius:"10px",
    fontWeight:"600", fontSize:"14px",
    boxShadow:"0 4px 16px rgba(0,0,0,0.15)", zIndex:"9999",
    animation:"none"
  });
  document.body.appendChild(t);
  setTimeout(() => t.remove(), 3000);
}

/* ══════════════════════════════════════════════
   REFRESH
   ══════════════════════════════════════════════ */

document.getElementById("refreshBtn").addEventListener("click", loadGames);

/* ══════════════════════════════════════════════
   INIT
   ══════════════════════════════════════════════ */

loadGames();
