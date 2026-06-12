/* ══════════════════════════════════════════════
   AUTH GUARD
   ══════════════════════════════════════════════ */
const SESSION_KEY = "bg_admin_session";

function getSession() {
  try { return JSON.parse(sessionStorage.getItem(SESSION_KEY)); }
  catch { return null; }
}

function requireAuth() {
  const session = getSession();
  if (!session || !session.username) {
    sessionStorage.removeItem(SESSION_KEY);
    location.replace("login.html");
    throw new Error("Unauthenticated");
  }
  return session;
}

function logout() {
  sessionStorage.removeItem(SESSION_KEY);
  location.replace("login.html");
}

const currentSession = requireAuth();

/* ══════════════════════════════════════════════
   SUPABASE
   ══════════════════════════════════════════════ */
const SUPABASE_URL = window.APP_CONFIG.supabaseUrl;
const SUPABASE_KEY = window.APP_CONFIG.supabaseKey;

const client = supabase.createClient(SUPABASE_URL, SUPABASE_KEY);

/* ══════════════════════════════════════════════
   INJECT USER BAR
   ══════════════════════════════════════════════ */
(function injectUserBar() {
  const sidebar = document.querySelector(".sidebar");
  if (!sidebar) return;

  const roleLabel = currentSession.role === "superadmin" ? "Super Admin" : "Editor";
  const roleBadge = currentSession.role === "superadmin"
    ? `<span style="background:#6c5ce7;color:#fff;font-size:10px;font-weight:700;padding:2px 8px;border-radius:20px;letter-spacing:.4px">${roleLabel}</span>`
    : `<span style="background:#00b894;color:#fff;font-size:10px;font-weight:700;padding:2px 8px;border-radius:20px;letter-spacing:.4px">${roleLabel}</span>`;

  const userBar = document.createElement("div");
  userBar.style.cssText = `
    margin-top: auto;
    border-top: 1px solid rgba(255,255,255,.08);
    padding: 16px 20px;
    display: flex;
    align-items: center;
    gap: 12px;
  `;
  userBar.innerHTML = `
    <div style="width:38px;height:38px;border-radius:50%;background:#6c5ce7;display:flex;align-items:center;justify-content:center;font-size:16px;font-weight:700;color:#fff;flex-shrink:0;">
      ${(currentSession.displayName||"A")[0].toUpperCase()}
    </div>
    <div style="flex:1;min-width:0;">
      <div style="font-size:13px;font-weight:600;color:#fff;white-space:nowrap;overflow:hidden;text-overflow:ellipsis">
        ${currentSession.displayName || currentSession.username}
      </div>
      <div style="margin-top:4px">${roleBadge}</div>
    </div>
    <button id="logoutBtn" title="Đăng xuất"
      style="background:rgba(255,255,255,.08);border:none;border-radius:8px;width:32px;height:32px;cursor:pointer;color:#a0a8c0;font-size:16px;display:flex;align-items:center;justify-content:center;transition:background .2s,color .2s;flex-shrink:0;"
      onmouseover="this.style.background='rgba(225,112,85,.25)';this.style.color='#e17055'"
      onmouseout="this.style.background='rgba(255,255,255,.08)';this.style.color='#a0a8c0'">
      ⏏
    </button>
  `;
  sidebar.appendChild(userBar);
  document.getElementById("logoutBtn")?.addEventListener("click", () => {
    if (confirm("Bạn muốn đăng xuất?")) logout();
  });
})();

/* ══════════════════════════════════════════════
   DOM REFS (Boardgames page)
   ══════════════════════════════════════════════ */
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
  currentEmoji = emoji;
  emojiInput.value = emoji;
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

emojiToggleBtn.addEventListener("click", e => { e.stopPropagation(); pickerOpen ? closePicker() : openPicker(); });
emojiInput.addEventListener("click", e => { e.stopPropagation(); if (!pickerOpen) openPicker(); });
emojiSearch.addEventListener("input", e => {
  const q = e.target.value.trim();
  if (!q) { renderEmojiGrid(EMOJI_CATEGORIES[currentCategory].emojis); return; }
  const filtered = UNIQUE_EMOJIS.filter(em => em.includes(q));
  renderEmojiGrid(filtered.length ? filtered : UNIQUE_EMOJIS.slice(0, 64));
});
document.addEventListener("click", e => {
  if (pickerOpen && !emojiPicker.contains(e.target) && e.target !== emojiToggleBtn && e.target !== emojiInput) closePicker();
});
emojiPicker.addEventListener("click", e => e.stopPropagation());

/* ══════════════════════════════════════════════
   ARRAY FIELD HELPERS
   ══════════════════════════════════════════════ */
function parseLines(id) {
  const val = document.getElementById(id)?.value || "";
  return val.split("\n").map(s => s.trim()).filter(Boolean);
}

function parseImages(id) {
  const val = document.getElementById(id)?.value || "";
  return val.split("\n").map(line => {
    const parts = line.split("|");
    return { url: (parts[0]||"").trim(), caption: (parts[1]||"").trim() };
  }).filter(img => img.url);
}

function setLines(id, arr) {
  const el = document.getElementById(id);
  if (el) el.value = Array.isArray(arr) ? arr.join("\n") : "";
}

function setImages(id, arr) {
  const el = document.getElementById(id);
  if (el) el.value = Array.isArray(arr) ? arr.map(img => `${img.url} | ${img.caption||""}`).join("\n") : "";
}

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
   STATS (updated from dashboard.html structure)
   ══════════════════════════════════════════════ */
function updateStats(data) {
  const totalEl = document.getElementById("totalGames");
  if (totalEl) totalEl.textContent = data.length;

  let youtubeCount = 0, imageCount = 0;
  data.forEach(game => {
    if (game.youtube_url) youtubeCount++;
    if (game.hero_bg)     imageCount++;
  });

  const ytEl  = document.getElementById("youtubeCount");
  const imgEl = document.getElementById("imageCount");
  if (ytEl)  ytEl.textContent  = youtubeCount;
  if (imgEl) imgEl.textContent = imageCount;
}

/* ══════════════════════════════════════════════
   DIFFICULTY
   ══════════════════════════════════════════════ */
function difficultyClass(value) {
  if (!value) return "medium";
  const v = value.toLowerCase();
  if (v.includes("easy") || v.includes("dễ"))  return "easy";
  if (v.includes("hard") || v.includes("khó")) return "hard";
  return "medium";
}

/* ══════════════════════════════════════════════
   RENDER TABLE
   ══════════════════════════════════════════════ */
function renderGames(data) {
  tableBody.innerHTML = "";
  if (!data.length) {
    tableBody.innerHTML = `<tr><td colspan="6" style="text-align:center;padding:40px;color:var(--text-muted);">Không tìm thấy game nào.</td></tr>`;
    return;
  }
  data.forEach(game => {
    const tr      = document.createElement("tr");
    const imgSrc  = game.hero_bg || "https://placehold.co/48x48";
    const name    = game.name   || "(không tên)";
    const emoji   = game.emoji  || "🎲";
    const diff    = game.difficulty || "Medium";
    const cats    = Array.isArray(game.categories) ? game.categories : [];
    const yt      = game.youtube_url || "#";
    const colorDot = game.color
      ? `<span style="display:inline-block;width:10px;height:10px;border-radius:50%;background:${game.color};margin-right:4px;vertical-align:middle"></span>`
      : "";

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
      <td>${cats.map(c => `<div class="badge" style="margin-bottom:3px">${c}</div>`).join("") || '<div class="badge">Boardgame</div>'}</td>
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
searchInput?.addEventListener("input", e => {
  const v = e.target.value.toLowerCase();
  renderGames(games.filter(g => (g.name||"").toLowerCase().includes(v)));
});

/* ══════════════════════════════════════════════
   OPEN ADD MODAL
   ══════════════════════════════════════════════ */
addGameBtn?.addEventListener("click", () => {
  clearForm();
  document.getElementById("modalTitle").innerText = "➕ Thêm Boardgame";
  deleteBtn.style.display = "none";
  modal.classList.remove("hidden");
});

/* ══════════════════════════════════════════════
   CLOSE MODAL
   ══════════════════════════════════════════════ */
closeModalBtn?.addEventListener("click", () => modal.classList.add("hidden"));
modal?.addEventListener("click", e => { if (e.target === modal) modal.classList.add("hidden"); });

/* ══════════════════════════════════════════════
   SAVE (INSERT + UPDATE)
   ══════════════════════════════════════════════ */
async function saveGame() {
  const rawId = document.getElementById("gameId").value;
  const id    = rawId ? Number(rawId) : null;

  const colorVal = document.getElementById("colorInput")?.value.trim() || "#6c5ce7";

  const catRaw = document.getElementById("categoryInput").value.trim();
  const categories = catRaw
    ? catRaw.split(/[,\n]/).map(s => s.trim()).filter(Boolean)
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

  if (!payload.name) { alert("Vui lòng nhập tên game."); return; }

  saveBtn.disabled    = true;
  saveBtn.textContent = "Đang lưu...";

  try {
    if (id) {
      const { data, error } = await client.from("games").update(payload).eq("id", id).select();
      if (error) throw error;
      if (!data || !data.length) throw new Error(`UPDATE không ảnh hưởng dòng nào (id=${id}).`);
    } else {
      const { data, error } = await client.from("games").insert(payload).select();
      if (error) throw error;
    }
    modal.classList.add("hidden");
    await loadGames();
    showToast("✅ Đã lưu thành công!");
  } catch(err) {
    alert("❌ Lỗi khi lưu:\n\n" + err.message);
  } finally {
    saveBtn.disabled    = false;
    saveBtn.textContent = "💾 Lưu";
  }
}

saveBtn?.addEventListener("click", saveGame);

/* ══════════════════════════════════════════════
   DELETE
   ══════════════════════════════════════════════ */
async function deleteGame() {
  const id   = document.getElementById("gameId").value;
  if (!id) return;
  const name = document.getElementById("nameInput").value || `ID=${id}`;
  if (!confirm(`Xóa "${name}"?\n\nHành động này không thể hoàn tác!`)) return;

  deleteBtn.disabled    = true;
  deleteBtn.textContent = "Đang xóa...";

  try {
    const { error } = await client.from("games").delete().eq("id", id);
    if (error) throw error;
    modal.classList.add("hidden");
    showToast("🗑️ Đã xóa thành công!", "#e17055");
    await loadGames();
  } catch(err) {
    alert("Lỗi: " + err.message);
  } finally {
    deleteBtn.disabled    = false;
    deleteBtn.textContent = "🗑️ Xóa";
  }
}

deleteBtn?.addEventListener("click", deleteGame);

/* ══════════════════════════════════════════════
   CLEAR FORM
   ══════════════════════════════════════════════ */
function clearForm() {
  ["gameId","nameInput","playersInput","timeInput","difficultyInput",
   "objectiveInput","heroInput","youtubeInput","categoryInput",
   "winInput","setupInput","turnInput","tipsInput","imagesInput","sortInput"]
    .forEach(id => { const el = document.getElementById(id); if (el) el.value = ""; });

  const ci = document.getElementById("colorInput");
  if (ci) ci.value = "#6c5ce7";
  const cp = document.getElementById("colorPicker");
  if (cp) cp.value = "#6c5ce7";

  currentEmoji = "🎲";
  if (emojiInput) emojiInput.value = "🎲";
  if (emojiPreview) emojiPreview.textContent = "🎲";
  closePicker();
}

/* ══════════════════════════════════════════════
   EDIT — event delegation
   ══════════════════════════════════════════════ */
document.addEventListener("click", e => {
  if (!e.target.classList.contains("edit-btn")) return;

  const id   = Number(e.target.dataset.id);
  const game = games.find(g => g.id === id);
  if (!game) return;

  document.getElementById("modalTitle").innerText          = "✏️ Chỉnh sửa Boardgame";
  document.getElementById("gameId").value                  = game.id;
  document.getElementById("nameInput").value               = game.name        || "";
  document.getElementById("playersInput").value            = game.players     || "";
  document.getElementById("timeInput").value               = game.time        || "";
  document.getElementById("difficultyInput").value         = game.difficulty  || "";
  document.getElementById("objectiveInput").value          = game.objective   || "";
  document.getElementById("heroInput").value               = game.hero_bg     || "";
  document.getElementById("youtubeInput").value            = game.youtube_url || "";

  const cats = Array.isArray(game.categories) ? game.categories : [];
  document.getElementById("categoryInput").value = cats.join(", ");

  const colorVal = game.color || "#6c5ce7";
  const ci = document.getElementById("colorInput");
  const cp = document.getElementById("colorPicker");
  if (ci) ci.value = colorVal;
  if (cp) cp.value = colorVal;

  const so = document.getElementById("sortInput");
  if (so) so.value = game.sort_order ?? "";

  const wi = document.getElementById("winInput");
  if (wi) wi.value = game.win || "";

  setLines("setupInput",   game.setup);
  setLines("turnInput",    game.turn);
  setLines("tipsInput",    game.tips);
  setImages("imagesInput", game.images);

  const em = game.emoji || "🎲";
  currentEmoji = em;
  if (emojiInput)   emojiInput.value          = em;
  if (emojiPreview) emojiPreview.textContent  = em;
  closePicker();

  deleteBtn.style.display = "inline-flex";
  modal.classList.remove("hidden");
});

/* ══════════════════════════════════════════════
   TOAST
   ══════════════════════════════════════════════ */
function showToast(msg, bg = "#00b894") {
  const t = document.createElement("div");
  t.textContent = msg;
  Object.assign(t.style, {
    position:"fixed", bottom:"28px", right:"28px",
    background: bg, color:"#fff",
    padding:"12px 22px", borderRadius:"10px",
    fontWeight:"600", fontSize:"14px",
    boxShadow:"0 4px 16px rgba(0,0,0,.15)", zIndex:"9999",
  });
  document.body.appendChild(t);
  setTimeout(() => t.remove(), 3000);
}

/* ══════════════════════════════════════════════
   REFRESH (dashboard page)
   ══════════════════════════════════════════════ */
document.getElementById("refreshBtn")?.addEventListener("click", async () => {
  await loadGames();
  // also reload drinks total if table exists
  if (typeof loadDrinks === "function") await loadDrinks();
});

/* ══════════════════════════════════════════════
   INIT — preload stats for dashboard
   ══════════════════════════════════════════════ */
loadGames();
