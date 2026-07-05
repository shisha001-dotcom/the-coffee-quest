/* ══════════════════════════════════════════════
   DASHBOARD GAMES MODULE — admin/modules/dashboard-games.js
   ─────────────────────────────────────────────
   THAY ĐỔI:
   - Thêm window.getGameById(id) để module dashboard-game-detail.js
     dùng lại dữ liệu games đã fetch, không cần gọi Supabase lại.
   - Thêm 2 nút trong cột "Hành động": "📄 Chi tiết" (mở trang chi
     tiết chỉnh sửa trực quan) và "📱 QR" (xem/tải nhanh mã QR).
   - Role "chỉ xem" (window.AdminPermissions.isReadOnly) sẽ:
     + Không thấy nút "+ Thêm Game"
     + Nút trong bảng đổi thành "👁️ Xem" thay vì "✏️ Sửa"
     + Modal mở ra ở chế độ chỉ đọc: mọi input/textarea bị
       khóa (disabled), ẩn nút "💾 Lưu" và "🗑️ Xóa game"
     + saveGame()/deleteGame() cũng chặn ở tầng hàm — phòng
       trường hợp bị gọi trực tiếp qua console.
   - MỚI: Thể loại giờ là category-picker (chip chọn nhiều, render
     bởi window.renderCategoryPicker/getSelectedCategories từ
     js/shared-categories.js) thay vì input text gõ tay. Độ khó
     giờ là <select> (window.populateDifficultySelect) thay vì
     input text tự do — tránh gõ sai chính tả / không đồng nhất
     dữ liệu giữa các game.

   Cần: `client` (từ dashboard-auth.js), `currentSession`,
   window.AdminPermissions (từ core/dashboard-permissions.js),
   window.GAME_CATEGORIES/DIFFICULTY_LEVELS + các hàm picker
   (từ js/shared-categories.js — PHẢI load trước file này).
   ══════════════════════════════════════════════ */

const isGamesReadOnly = window.AdminPermissions.isReadOnly(currentSession.role);

/* ══════════════════════════════════════════════
   DOM REFS
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

/* MỚI: refs cho category picker + difficulty select */
const categoryPicker   = document.getElementById("categoryPicker");
const difficultySelect = document.getElementById("difficultyInput");

let games = [];

/* Expose cho dashboard-game-detail.js truy cập không cần load lại */
window.getGameById = id => games.find(g => g.id === id);

/* ── Ẩn nút "+ Thêm Game" nếu chỉ được xem ── */
if (isGamesReadOnly && addGameBtn) addGameBtn.style.display = "none";

/* ══════════════════════════════════════════════
   EMOJI PICKER
   ══════════════════════════════════════════════ */
const EMOJI_CATEGORIES = window.EMOJI_CATEGORIES;
const ALL_EMOJIS       = window.ALL_EMOJIS;
const UNIQUE_EMOJIS    = window.UNIQUE_EMOJIS;

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
  emojiGrid.innerHTML = list.map(emoji =>
    `<button class="emoji-item${emoji === currentEmoji ? ' selected' : ''}" data-emoji="${emoji}" title="${emoji}">${emoji}</button>`
  ).join('');
}

emojiGrid.addEventListener("click", e => {
  if (isGamesReadOnly) return;
  const btn = e.target.closest(".emoji-item[data-emoji]");
  if (btn) selectEmoji(btn.dataset.emoji);
});

function selectEmoji(emoji) {
  currentEmoji = emoji;
  emojiInput.value = emoji;
  emojiPreview.textContent = emoji;
  closePicker();
}
function openPicker() {
  if (isGamesReadOnly) return;
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
  renderEmojiGrid(q ? UNIQUE_EMOJIS.filter(em => em.includes(q)) || UNIQUE_EMOJIS.slice(0, 64) : EMOJI_CATEGORIES[currentCategory].emojis);
});
document.addEventListener("click", e => {
  if (pickerOpen && !emojiPicker.contains(e.target) && e.target !== emojiToggleBtn && e.target !== emojiInput) closePicker();
});
emojiPicker.addEventListener("click", e => e.stopPropagation());

/* ══════════════════════════════════════════════
   READ-ONLY MODE cho modal
   (dùng chung window.AdminPermissions.applyReadOnlyForm —
   không tự viết lại logic disable/ẩn nút ở đây nữa)

   Lưu ý: category-picker (button.cat-chip) được disable ngay tại
   thời điểm render (renderCategoryPicker(..., readonly)) chứ không
   qua applyReadOnlyForm, vì applyReadOnlyForm chỉ quét
   input/textarea/select.
   ══════════════════════════════════════════════ */
function setModalReadOnly(readonly) {
  window.AdminPermissions.applyReadOnlyForm(modal, {
    readonly,
    saveBtn,
    deleteBtn,
    extraDisable: [emojiToggleBtn],
  });
}

/* ══════════════════════════════════════════════
   ARRAY FIELD HELPERS
   ══════════════════════════════════════════════ */
function parseLines(id) {
  return (document.getElementById(id)?.value || "").split("\n").map(s => s.trim()).filter(Boolean);
}
function parseImages(id) {
  return (document.getElementById(id)?.value || "").split("\n")
    .map(line => { const [url, caption] = line.split("|"); return { url: (url||"").trim(), caption: (caption||"").trim() }; })
    .filter(img => img.url);
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
    .from("games").select("*").order("sort_order", { ascending: true });

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
   STATS
   ══════════════════════════════════════════════ */
function updateStats(data) {
  let youtubeCount = 0, imageCount = 0;
  for (const game of data) {
    if (game.youtube_url) youtubeCount++;
    if (game.hero_bg)     imageCount++;
  }
  const set = (id, val) => { const el = document.getElementById(id); if (el) el.textContent = val; };
  set("totalGames",   data.length);
  set("youtubeCount", youtubeCount);
  set("imageCount",   imageCount);
}

/* ══════════════════════════════════════════════
   DIFFICULTY
   ══════════════════════════════════════════════ */
function difficultyClass(value) {
  const v = (value || "").toLowerCase();
  return v.includes("dễ") || v.includes("easy") ? "easy"
    : v.includes("khó") || v.includes("hard")   ? "hard"
    : "medium";
}

/* ══════════════════════════════════════════════
   RENDER TABLE
   ══════════════════════════════════════════════ */
function renderGames(data) {
  if (!data.length) {
    tableBody.innerHTML = `<tr><td colspan="6" style="text-align:center;padding:40px;color:var(--text-muted);">Không tìm thấy game nào.</td></tr>`;
    return;
  }
  const actionLabel = isGamesReadOnly ? "👁️ Xem" : "✏️ Sửa";

  tableBody.innerHTML = data.map(game => {
    const name   = window.escHtml(game.name || "(không tên)");
    const emoji  = game.emoji  || "🎲";
    const diff   = window.escHtml(game.difficulty || "Medium");
    const cats   = Array.isArray(game.categories) ? game.categories : [];
    const imgSrc = window.escHtml(game.hero_bg || "https://placehold.co/48x48");
    const ytHref = window.escHtml(game.youtube_url || "#");
    const color  = game.color
      ? `<span style="display:inline-block;width:10px;height:10px;border-radius:50%;background:${game.color};margin-right:4px;vertical-align:middle"></span>`
      : "";
    return `<tr>
      <td>
        <div class="game-info">
          <img class="game-image" src="${imgSrc}" alt="${name}" onerror="this.src='https://placehold.co/48x48'">
          <div>
            <div class="game-name">${emoji} ${name}</div>
            <div class="game-id">${color}ID: ${game.id} · Order: ${game.sort_order ?? '—'}</div>
          </div>
        </div>
      </td>
      <td>${window.escHtml(game.players) || "—"}</td>
      <td>${window.escHtml(game.time) || "—"}</td>
      <td><div class="difficulty ${difficultyClass(game.difficulty)}">${diff}</div></td>
      <td>${cats.map(c => `<div class="badge" style="margin-bottom:3px">${window.escHtml(c)}</div>`).join("") || '<div class="badge">Boardgame</div>'}</td>
      <td>
        <div style="display:flex;gap:6px;align-items:center;flex-wrap:wrap;">
          <button class="btn btn-primary edit-btn" data-id="${game.id}">${actionLabel}</button>
          <button class="btn btn-secondary detail-btn" data-id="${game.id}"
            style="font-size:12px;padding:6px 10px;" title="Trang chi tiết">📄 Chi tiết</button>
          <button class="btn btn-secondary qr-btn" data-id="${game.id}"
            style="font-size:12px;padding:6px 10px;" title="Mã QR luật chơi">📱 QR</button>
          <a class="youtube-link" href="${ytHref}" target="_blank" title="YouTube">▶</a>
        </div>
      </td>
    </tr>`;
  }).join('');
}

/* ══════════════════════════════════════════════
   SEARCH — debounce
   ══════════════════════════════════════════════ */
let _searchTimer;
searchInput?.addEventListener("input", e => {
  clearTimeout(_searchTimer);
  _searchTimer = setTimeout(() => {
    const v = e.target.value.toLowerCase();
    renderGames(games.filter(g => (g.name || "").toLowerCase().includes(v)));
  }, 200);
});

/* ══════════════════════════════════════════════
   MODAL OPEN/CLOSE
   ══════════════════════════════════════════════ */
addGameBtn?.addEventListener("click", () => {
  if (isGamesReadOnly) return; /* chặn tầng hàm, phòng khi nút bị bỏ ẩn thủ công */
  clearForm();
  document.getElementById("modalTitle").innerText = "➕ Thêm Boardgame";
  deleteBtn.style.display = "none";
  deleteBtn.dataset.wasVisible = "0";
  setModalReadOnly(false);
  modal.classList.remove("hidden");
});
closeModalBtn?.addEventListener("click", () => modal.classList.add("hidden"));
modal?.addEventListener("click", e => { if (e.target === modal) modal.classList.add("hidden"); });

/* ══════════════════════════════════════════════
   SAVE
   ══════════════════════════════════════════════ */
async function saveGame() {
  if (isGamesReadOnly) return; /* chặn tầng hàm */

  const rawId = document.getElementById("gameId").value;
  const id    = rawId ? Number(rawId) : null;
  const name  = document.getElementById("nameInput").value.trim();
  if (!name) { alert("Vui lòng nhập tên game."); return; }

  const colorVal   = document.getElementById("colorInput")?.value.trim() || "#6c5ce7";
  const categories = window.getSelectedCategories(categoryPicker);

  const payload = {
    name,
    emoji:       emojiInput.value.trim() || currentEmoji,
    color:       colorVal,
    players:     document.getElementById("playersInput").value.trim(),
    time:        document.getElementById("timeInput").value.trim(),
    difficulty:  difficultySelect.value.trim(),
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

  saveBtn.disabled    = true;
  saveBtn.textContent = "Đang lưu...";

  try {
    if (id) {
      const { data, error } = await client.from("games").update(payload).eq("id", id).select();
      if (error) throw error;
      if (!data?.length) throw new Error(`UPDATE không ảnh hưởng dòng nào (id=${id}).`);
    } else {
      const { error } = await client.from("games").insert(payload).select();
      if (error) throw error;
    }
    modal.classList.add("hidden");
    await loadGames();
    window.showToast("✅ Đã lưu thành công!");
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
  if (isGamesReadOnly) return; /* chặn tầng hàm */

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
    window.showToast("🗑️ Đã xóa thành công!", "#e17055");
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
  [
    "gameId","nameInput","playersInput","timeInput",
    "objectiveInput","heroInput","youtubeInput",
    "winInput","setupInput","turnInput","tipsInput","imagesInput","sortInput"
  ].forEach(id => { const el = document.getElementById(id); if (el) el.value = ""; });

  document.getElementById("colorInput") && (document.getElementById("colorInput").value  = "#6c5ce7");
  document.getElementById("colorPicker") && (document.getElementById("colorPicker").value = "#6c5ce7");

  /* MỚI: reset category picker (bỏ chọn hết) + difficulty select */
  window.renderCategoryPicker(categoryPicker, [], isGamesReadOnly);
  window.populateDifficultySelect(difficultySelect, "");

  currentEmoji = "🎲";
  if (emojiInput)   emojiInput.value         = "🎲";
  if (emojiPreview) emojiPreview.textContent  = "🎲";
  closePicker();
}

/* ══════════════════════════════════════════════
   EDIT / VIEW — event delegation
   ══════════════════════════════════════════════ */
document.addEventListener("click", e => {
  const btn = e.target.closest(".edit-btn");
  if (!btn) return;

  const id   = Number(btn.dataset.id);
  const game = games.find(g => g.id === id);
  if (!game) return;

  document.getElementById("modalTitle").innerText = isGamesReadOnly
    ? "👁️ Xem chi tiết Boardgame"
    : "✏️ Chỉnh sửa Boardgame";

  const fields = {
    gameId: game.id, nameInput: game.name, playersInput: game.players,
    timeInput: game.time, objectiveInput: game.objective,
    heroInput: game.hero_bg, youtubeInput: game.youtube_url,
    sortInput: game.sort_order ?? "", winInput: game.win || "",
  };
  Object.entries(fields).forEach(([id, val]) => {
    const el = document.getElementById(id);
    if (el) el.value = val || "";
  });

  /* MỚI: điền difficulty select + category picker thay vì input text */
  window.populateDifficultySelect(difficultySelect, game.difficulty || "");

  const cats = Array.isArray(game.categories) ? game.categories : [];
  window.renderCategoryPicker(categoryPicker, cats, isGamesReadOnly);

  const colorVal = game.color || "#6c5ce7";
  document.getElementById("colorInput")  && (document.getElementById("colorInput").value  = colorVal);
  document.getElementById("colorPicker") && (document.getElementById("colorPicker").value = colorVal);

  setLines("setupInput",   game.setup);
  setLines("turnInput",    game.turn);
  setLines("tipsInput",    game.tips);
  setImages("imagesInput", game.images);

  const em = game.emoji || "🎲";
  currentEmoji = em;
  if (emojiInput)   emojiInput.value         = em;
  if (emojiPreview) emojiPreview.textContent  = em;
  closePicker();

  deleteBtn.dataset.wasVisible = "1";
  deleteBtn.style.display = "inline-flex";
  setModalReadOnly(isGamesReadOnly);
  modal.classList.remove("hidden");
});

/* ══════════════════════════════════════════════
   DETAIL PAGE + QR — event delegation
   ══════════════════════════════════════════════ */
document.addEventListener("click", e => {
  const detailBtn = e.target.closest(".detail-btn");
  if (detailBtn && typeof window.openGameDetail === "function") {
    window.openGameDetail(Number(detailBtn.dataset.id));
    return;
  }
  const qrBtn = e.target.closest(".qr-btn");
  if (qrBtn && typeof window.openGameQR === "function") {
    window.openGameQR(Number(qrBtn.dataset.id));
  }
});

/* ══════════════════════════════════════════════
   REFRESH
   ══════════════════════════════════════════════ */
document.getElementById("refreshBtn")?.addEventListener("click", async () => {
  await loadGames();
  if (typeof loadDrinks === "function") await loadDrinks();
});

/* Expose cho nav.js */
window.loadGames = loadGames;

/* ══════════════════════════════════════════════
   INIT
   ══════════════════════════════════════════════ */
loadGames();
