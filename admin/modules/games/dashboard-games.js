/* ══════════════════════════════════════════════
   DASHBOARD GAMES MODULE — admin/modules/games/dashboard-games.js
   ─────────────────────────────────────────────
   ⚠️ TỐI ƯU (bổ sung so với bản trước):
   - Search dùng window.debounce() dùng chung (shared-utils.js)
     thay vì tự viết lại clearTimeout/setTimeout.
   - saveGame()/deleteGame(): PATCH trực tiếp vào mảng `games` từ
     dữ liệu Supabase trả về (.select()), thay vì loadGames() gọi
     lại toàn bảng — giảm 1 round-trip mạng không cần thiết mỗi
     lần lưu/xoá 1 game.
   ══════════════════════════════════════════════ */

const isGamesReadOnly = window.AdminPermissions.isReadOnly(currentSession.role);

/* ══════════════════════════════════════════════
   INJECT MODAL HTML — 1 lần duy nhất lúc file load
   (thay cho HTML tĩnh #gameModal từng nằm trong dashboard.html)
   ══════════════════════════════════════════════ */
(function injectGameModal() {
  if (document.getElementById("gameModal")) return;

  const modal = document.createElement("div");
  modal.className = "modal-overlay hidden";
  modal.id = "gameModal";
  modal.setAttribute("role", "dialog");
  modal.setAttribute("aria-modal", "true");
  modal.setAttribute("aria-labelledby", "modalTitle");
  modal.innerHTML = `
    <div class="modal-box">
      <div class="modal-header">
        <h2 id="modalTitle">Thêm Boardgame</h2>
        <button class="close-btn" id="closeModalBtn" aria-label="Đóng cửa sổ">✕</button>
      </div>

      <input type="hidden" id="gameId">

      <div class="form-grid">
        <div class="section-divider"><span>📋 Thông tin cơ bản</span></div>

        <div class="form-group">
          <label for="nameInput">Tên game *</label>
          <input type="text" id="nameInput" placeholder="Catan, Cluedo...">
        </div>

        <div class="form-group">
          <label for="emojiInput">Emoji</label>
          <div class="emoji-field">
            <div class="emoji-preview" id="emojiPreview" aria-hidden="true">🎲</div>
            <input type="text" id="emojiInput" placeholder="Chọn emoji..." autocomplete="off" readonly>
            <button type="button" class="emoji-toggle-btn" id="emojiToggleBtn" title="Chọn emoji" aria-label="Mở bảng chọn emoji" aria-expanded="false">▼</button>
          </div>
          <div class="emoji-picker hidden" id="emojiPicker" role="dialog" aria-label="Chọn emoji cho game">
            <div class="emoji-picker-search">
              <label for="emojiSearch" class="visually-hidden">Tìm emoji</label>
              <input type="text" id="emojiSearch" placeholder="🔍 Tìm emoji...">
            </div>
            <div class="emoji-categories" id="emojiCategories" role="tablist" aria-label="Danh mục emoji"></div>
            <div class="emoji-grid"       id="emojiGrid"></div>
          </div>
        </div>

        <div class="form-group">
          <label for="colorInput">Màu chủ đạo</label>
          <div class="color-row">
            <input type="color" id="colorPicker" value="#6c5ce7" aria-label="Chọn màu bằng bảng màu">
            <input type="text"  id="colorInput"  placeholder="#6c5ce7">
          </div>
        </div>

        <div class="form-group">
          <label for="sortInput">Thứ tự hiển thị</label>
          <input type="number" id="sortInput" placeholder="1, 2, 3...">
        </div>

        <div class="form-group">
          <label for="playersInput">Số người chơi</label>
          <input type="text" id="playersInput" placeholder="2-4 người">
        </div>

        <div class="form-group">
          <label for="timeInput">Thời gian</label>
          <input type="text" id="timeInput" placeholder="30-60 phút">
        </div>

        <div class="form-group">
          <label for="difficultyInput">Độ khó</label>
          <select id="difficultyInput"></select>
        </div>

        <div class="form-group full-width">
          <label id="categoryPickerLabel">Thể loại</label>
          <div class="category-picker" id="categoryPicker" role="group" aria-labelledby="categoryPickerLabel"></div>
          <div class="hint">Bấm để chọn/bỏ chọn — có thể chọn nhiều thể loại</div>
        </div>

        <div class="section-divider"><span>🎯 Nội dung game</span></div>

        <div class="form-group full-width">
          <label for="objectiveInput">Mục tiêu</label>
          <textarea id="objectiveInput" placeholder="Mô tả mục tiêu của game..."></textarea>
        </div>

        <div class="form-group full-width">
          <label for="winInput">Điều kiện thắng</label>
          <textarea id="winInput" placeholder="Người đầu tiên gom đủ... / Người có điểm cao nhất..."></textarea>
        </div>

        <div class="form-group full-width">
          <label for="setupInput">Các bước chuẩn bị</label>
          <textarea id="setupInput" class="tall" placeholder="Đặt bảng chơi vào giữa bàn&#10;Mỗi người lấy 5 lá bài&#10;Xáo trộn bộ bài..."></textarea>
          <div class="hint">Mỗi bước = 1 dòng</div>
        </div>

        <div class="form-group full-width">
          <label for="turnInput">Các bước lượt chơi</label>
          <textarea id="turnInput" class="tall" placeholder="Rút 2 lá bài&#10;Thực hiện 1 hành động&#10;Kết thúc lượt..."></textarea>
          <div class="hint">Mỗi bước = 1 dòng</div>
        </div>

        <div class="form-group full-width">
          <label for="tipsInput">Mẹo chơi</label>
          <textarea id="tipsInput" placeholder="Ưu tiên tích điểm sớm&#10;Chú ý bài của đối thủ&#10;Không nên giữ bài quá nhiều..."></textarea>
          <div class="hint">Mỗi mẹo = 1 dòng (có thể để trống)</div>
        </div>

        <div class="section-divider"><span>🖼️ Media</span></div>

        <div class="form-group full-width">
          <label for="imagesInput">Ảnh hướng dẫn</label>
          <textarea id="imagesInput" placeholder="https://i.imgur.com/abc.jpg | Sắp xếp bảng cờ&#10;https://i.imgur.com/xyz.jpg | Bộ bài ban đầu"></textarea>
          <div class="hint">Mỗi dòng: <code style="background:#f1f5f9;padding:1px 5px;border-radius:4px">URL ảnh | Chú thích</code></div>
        </div>

        <div class="form-group full-width">
          <label for="heroInput">Hero Background URL</label>
          <input type="text" id="heroInput" placeholder="https://...">
        </div>

        <div class="form-group full-width">
          <label for="youtubeInput">YouTube URL</label>
          <input type="text" id="youtubeInput" placeholder="https://youtube.com/watch?v=...">
        </div>
      </div>

      <div class="form-group full-width">
  <label for="rulesPdfInput">Link luật chơi PDF (Google Drive)</label>
  <input type="text" id="rulesPdfInput" placeholder="https://drive.google.com/file/d/.../view">
  <div class="hint">Dán link chia sẻ Drive — nhớ để chế độ "Anyone with the link". Hệ thống tự chuyển sang link xem trước, không cần link trực tiếp.</div>
</div>

      <div class="modal-actions">
        <button class="btn btn-danger"  id="deleteBtn" style="display:none;">🗑️ Xóa game</button>
        <button class="btn btn-primary" id="saveBtn">💾 Lưu</button>
      </div>
    </div>
  `;
  document.body.appendChild(modal);
})();

/* ══════════════════════════════════════════════
   DOM REFS (sau khi modal đã inject ở trên)
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

const categoryPicker   = document.getElementById("categoryPicker");
const difficultySelect = document.getElementById("difficultyInput");
const colorInput       = document.getElementById("colorInput");
const colorPicker      = document.getElementById("colorPicker");

let games = [];
window.getGameById = id => games.find(g => g.id === id);

if (isGamesReadOnly && addGameBtn) addGameBtn.style.display = "none";

/* ── Sync 2 ô màu (color text ⇄ color picker) — thay cho oninput="" inline ── */
function bindColorPickerSync() {
  colorPicker?.addEventListener("input", () => { colorInput.value = colorPicker.value; });
  colorInput?.addEventListener("input",  () => { colorPicker.value = colorInput.value || "#6c5ce7"; });
}
bindColorPickerSync();

/* ══════════════════════════════════════════════
   EMOJI PICKER (không đổi so với bản gốc)
   ══════════════════════════════════════════════ */
const EMOJI_CATEGORIES = window.EMOJI_CATEGORIES;
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
    btn.setAttribute("aria-label", cat.label);
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
    `<button class="emoji-item${emoji === currentEmoji ? ' selected' : ''}" data-emoji="${emoji}" title="${emoji}" aria-label="Chọn emoji ${emoji}">${emoji}</button>`
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
  emojiToggleBtn.setAttribute("aria-expanded", "true");
  buildCategoryTabs();
  renderEmojiGrid(EMOJI_CATEGORIES[currentCategory].emojis);
  emojiSearch.focus();
}
function closePicker() {
  pickerOpen = false;
  emojiPicker.classList.add("hidden");
  emojiToggleBtn.textContent = "▼";
  emojiToggleBtn.setAttribute("aria-expanded", "false");
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
emojiPicker.addEventListener("keydown", e => { if (e.key === "Escape") { closePicker(); emojiToggleBtn.focus(); } });

/* ══════════════════════════════════════════════
   READ-ONLY MODE
   ══════════════════════════════════════════════ */
function setModalReadOnly(readonly) {
  window.AdminPermissions.applyReadOnlyForm(modal, {
    readonly, saveBtn, deleteBtn, extraDisable: [emojiToggleBtn],
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
   VALIDATE FIELD ERROR
   ══════════════════════════════════════════════ */
function clearFieldError(id) {
  const el = document.getElementById(id);
  if (!el) return;
  el.style.borderColor = "";
  document.getElementById(id + "Error")?.remove();
}
function showFieldError(id, msg) {
  const el = document.getElementById(id);
  if (!el) return;
  el.style.borderColor = "var(--danger)";
  el.focus();
  let err = document.getElementById(id + "Error");
  if (!err) {
    err = document.createElement("div");
    err.id = id + "Error";
    err.setAttribute("role", "alert");
    err.style.cssText = "color:var(--danger);font-size:12px;font-weight:600;margin-top:-6px;grid-column:1/-1;";
    el.closest(".form-group")?.insertAdjacentElement("afterend", err) ?? el.insertAdjacentElement("afterend", err);
  }
  err.textContent = msg;
  el.addEventListener("input", () => clearFieldError(id), { once: true });
}

/* ══════════════════════════════════════════════
   LOAD GAMES
   ══════════════════════════════════════════════ */
async function loadGames() {
  loadingMsg.classList.remove("hidden");
  errorMsg.classList.add("hidden");
  gameTable.classList.add("hidden");

  const { data, error } = await client.from("games").select("*").order("sort_order", { ascending: true });
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

function difficultyClass(value) {
  const v = (value || "").toLowerCase();
  return v.includes("dễ") || v.includes("easy") ? "easy"
    : v.includes("khó") || v.includes("hard")   ? "hard"
    : "medium";
}

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
    const color  = game.color
      ? `<span style="display:inline-block;width:10px;height:10px;border-radius:50%;background:${game.color};margin-right:4px;vertical-align:middle" aria-hidden="true"></span>`
      : "";
    return `<tr>
      <td>
        <div class="game-info">
          <img class="game-image" src="${imgSrc}" alt="Ảnh minh hoạ ${name}" onerror="this.src='https://placehold.co/48x48'">
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
            style="font-size:12px;padding:6px 10px;" title="Trang chi tiết" aria-label="Xem trang chi tiết ${name}">📄 Chi tiết</button>
        </div>
      </td>
    </tr>`;
  }).join('');
}

/* ══════════════════════════════════════════════
   SEARCH — ⚠️ TỐI ƯU: dùng window.debounce() dùng chung
   (shared-utils.js) thay vì tự viết clearTimeout/setTimeout
   ══════════════════════════════════════════════ */
searchInput?.addEventListener("input", window.debounce(e => {
  const v = e.target.value.toLowerCase();
  renderGames(games.filter(g => (g.name || "").toLowerCase().includes(v)));
}, 200));

/* ══════════════════════════════════════════════
   MODAL OPEN/CLOSE
   ══════════════════════════════════════════════ */
addGameBtn?.addEventListener("click", () => {
  if (isGamesReadOnly) return;
  clearForm();
  document.getElementById("modalTitle").innerText = "➕ Thêm Boardgame";
  deleteBtn.style.display = "none";
  deleteBtn.dataset.wasVisible = "0";
  setModalReadOnly(false);
  modal.classList.remove("hidden");
  document.getElementById("nameInput")?.focus();
});
closeModalBtn?.addEventListener("click", () => modal.classList.add("hidden"));
modal?.addEventListener("keydown", e => { if (e.key === "Escape") modal.classList.add("hidden"); });

/* ══════════════════════════════════════════════
   SAVE — ⚠️ TỐI ƯU: PATCH mảng `games` tại chỗ bằng dữ liệu
   Supabase trả về (.select()), thay vì gọi lại loadGames() —
   trước đây mỗi lần lưu 1 game là refetch TOÀN BỘ bảng.
   ══════════════════════════════════════════════ */
async function saveGame() {
  if (isGamesReadOnly) return;

  const rawId = document.getElementById("gameId").value;
  const id    = rawId ? Number(rawId) : null;
  const name  = document.getElementById("nameInput").value.trim();

  if (!name) { showFieldError("nameInput", "Vui lòng nhập tên game."); return; }
  clearFieldError("nameInput");

  const colorVal   = colorInput?.value.trim() || "#6c5ce7";
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
    rules_pdf_url: document.getElementById("rulesPdfInput").value.trim(),
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

      /* ⚠️ TỐI ƯU: patch tại chỗ thay vì loadGames() refetch toàn bảng */
      const idx = games.findIndex(g => g.id === id);
      if (idx !== -1) games[idx] = data[0];
      else games.push(data[0]);
      games.sort((a, b) => (a.sort_order ?? 0) - (b.sort_order ?? 0));
    } else {
      const { data, error } = await client.from("games").insert(payload).select();
      if (error) throw error;

      /* ⚠️ TỐI ƯU: thêm trực tiếp vào mảng thay vì refetch */
      if (data?.[0]) games.push(data[0]);
      games.sort((a, b) => (a.sort_order ?? 0) - (b.sort_order ?? 0));
    }

    modal.classList.add("hidden");
    renderGames(games);
    updateStats(games);
    window.showToast("✅ Đã lưu thành công!");
  } catch(err) {
    window.showToast("❌ Lỗi khi lưu: " + err.message, "#e17055");
  } finally {
    saveBtn.disabled    = false;
    saveBtn.textContent = "💾 Lưu";
  }
}
saveBtn?.addEventListener("click", saveGame);

/* ══════════════════════════════════════════════
   DELETE — ⚠️ TỐI ƯU: xoá tại chỗ trong mảng `games` thay vì
   loadGames() refetch toàn bảng.
   ══════════════════════════════════════════════ */
async function deleteGame() {
  if (isGamesReadOnly) return;

  const id   = document.getElementById("gameId").value;
  if (!id) return;
  const name = document.getElementById("nameInput").value || `ID=${id}`;

  const ok = await window.showConfirm({
    title: `Xóa "${name}"?`,
    message: "Hành động này không thể hoàn tác.",
    confirmText: "🗑️ Xóa",
    cancelText: "Hủy",
    danger: true,
  });
  if (!ok) return;

  deleteBtn.disabled    = true;
  deleteBtn.textContent = "Đang xóa...";

  try {
    const { error } = await client.from("games").delete().eq("id", id);
    if (error) throw error;

    /* ⚠️ TỐI ƯU: xoá tại chỗ thay vì loadGames() refetch toàn bảng */
    games = games.filter(g => String(g.id) !== String(id));

    modal.classList.add("hidden");
    renderGames(games);
    updateStats(games);
    window.showToast("🗑️ Đã xóa thành công!", "#e17055");
  } catch(err) {
    window.showToast("❌ Lỗi: " + err.message, "#e17055");
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

  clearFieldError("nameInput");

  if (colorInput)  colorInput.value  = "#6c5ce7";
  if (colorPicker) colorPicker.value = "#6c5ce7";

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

  clearForm();

  document.getElementById("modalTitle").innerText = isGamesReadOnly
    ? "👁️ Xem chi tiết Boardgame"
    : "✏️ Chỉnh sửa Boardgame";

  const fields = {
    gameId: game.id, nameInput: game.name, playersInput: game.players,
    timeInput: game.time, objectiveInput: game.objective,
    heroInput: game.hero_bg, youtubeInput: game.youtube_url,
    rulesPdfInput: game.rules_pdf_url,
    sortInput: game.sort_order ?? "", winInput: game.win || "",
  };
  Object.entries(fields).forEach(([id, val]) => {
    const el = document.getElementById(id);
    if (el) el.value = val || "";
  });

  window.populateDifficultySelect(difficultySelect, game.difficulty || "");

  const cats = Array.isArray(game.categories) ? game.categories : [];
  window.renderCategoryPicker(categoryPicker, cats, isGamesReadOnly);

  const colorVal = game.color || "#6c5ce7";
  if (colorInput)  colorInput.value  = colorVal;
  if (colorPicker) colorPicker.value = colorVal;

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
   TRANG CHI TIẾT — event delegation
   ══════════════════════════════════════════════ */
document.addEventListener("click", e => {
  const detailBtn = e.target.closest(".detail-btn");
  if (detailBtn && typeof window.openGameDetail === "function") {
    window.openGameDetail(Number(detailBtn.dataset.id));
  }
});

/* ══════════════════════════════════════════════
   REFRESH
   ══════════════════════════════════════════════ */
document.getElementById("refreshBtn")?.addEventListener("click", async () => {
  await loadGames();
  if (typeof loadDrinks === "function") await loadDrinks();
});

window.loadGames = loadGames;

/* ══════════════════════════════════════════════
   INIT
   ══════════════════════════════════════════════ */
loadGames();
