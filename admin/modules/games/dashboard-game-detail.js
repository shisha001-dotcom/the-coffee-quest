/* ══════════════════════════════════════════════
   DASHBOARD GAME DETAIL + QR — admin/modules/dashboard-game-detail.js
   ─────────────────────────────────────────────
   Trang CHI TIẾT chỉnh sửa game — thay thế popup khi cần thao tác
   trực quan hơn, tách rời hoàn toàn với modal popup trong
   dashboard-games.js.

   ⚠️ SỬA (UI/UX audit — ưu tiên cao):
   - saveGameDetail(): validate tên game báo lỗi ngay tại field
     (#gdName) thay vì alert(); lỗi server báo qua toast.
   - deleteGameDetail(): window.confirm() → window.showConfirm().

   ⚠️ SỬA (ponytail dedupe): getGdYoutubeId() cục bộ đã bị xoá —
   trùng y hệt window.getYoutubeId() trong js/shared-utils.js (dùng
   chung với js/app.js — trang chi tiết game phía frontend). Dùng
   thẳng window.getYoutubeId() thay vì giữ 2 bản giống nhau.

   ⚠️ DEDUPE: clearGdFieldError/showGdFieldError cục bộ đã bị xoá —
   dùng thẳng window.clearFieldError/window.showFieldError
   (js/shared-utils.js), dùng chung với dashboard-games.js,
   dashboard-accounts.js, dashboard-drinks.js, membership-shared.js.

   Cần: `client`, `currentSession`, `isGamesReadOnly`, `games`, `parseLines`,
   `parseImages`, `setLines`, `setImages` (tất cả từ dashboard-games.js —
   load TRƯỚC file này), window.escHtml / window.showToast / window.showConfirm /
   window.slugify / window.buildGameSlugMap / window.getYoutubeId (shared-utils.js),
   thư viện QRCode (CDN, load trước file này).
   ══════════════════════════════════════════════ */

/* ⚠️ Đổi domain tại đây nếu deploy sang địa chỉ khác */
const SITE_BASE_URL = "https://shisha001-dotcom.github.io/the-coffee-quest/";

/* ══════════════════════════════════════════════
   HELPER DÙNG CHUNG: sinh URL + render QR vào canvas + tải PNG
   ══════════════════════════════════════════════ */
function gameQrUrl(gameId) {
  const { slugById } = window.buildGameSlugMap(games || []);
  const slug = slugById[gameId] || String(gameId);
  return `${SITE_BASE_URL}#game-${slug}`;
}

function showQrLoadError(canvasEl) {
  console.error(
    "[dashboard-game-detail] window.QRCode không tồn tại — thư viện QRCode " +
    "(CDN qrcode.js) chưa load được. Kiểm tra thẻ <script> CDN trong " +
    "dashboard.html, kết nối mạng, hoặc CDN có bị chặn không."
  );
  if (!canvasEl || !canvasEl.parentElement) return;

  const existing = canvasEl.parentElement.querySelector(".qr-load-error");
  if (existing) existing.remove();

  canvasEl.style.display = "none";
  const errBox = document.createElement("div");
  errBox.className = "qr-load-error";
  errBox.setAttribute("role", "alert");
  errBox.style.cssText =
    "width:220px;min-height:120px;margin:0 auto;display:flex;flex-direction:column;" +
    "align-items:center;justify-content:center;gap:6px;text-align:center;" +
    "background:#fff5f5;border:1.5px dashed var(--danger,#e17055);border-radius:10px;" +
    "color:var(--danger,#e17055);font-size:12px;font-weight:600;padding:14px;";
  errBox.innerHTML = `
    <span style="font-size:22px;" aria-hidden="true">⚠️</span>
    <span>Không tải được thư viện tạo mã QR.</span>
    <span style="font-weight:400;color:var(--text-muted,#718096);">
      Kiểm tra kết nối mạng hoặc CDN đang bị chặn.
    </span>
  `;
  canvasEl.parentElement.insertBefore(errBox, canvasEl);
}

function clearQrLoadError(canvasEl) {
  if (!canvasEl || !canvasEl.parentElement) return;
  canvasEl.style.display = "";
  canvasEl.parentElement.querySelector(".qr-load-error")?.remove();
}

function renderGameQR(gameId, canvasEl) {
  const url = gameQrUrl(gameId);

  if (!canvasEl) return url;

  if (!window.QRCode) {
    showQrLoadError(canvasEl);
    return url;
  }

  clearQrLoadError(canvasEl);
  QRCode.toCanvas(canvasEl, url, {
    width: 220,
    margin: 1,
    color: { dark: "#1a1a1a", light: "#ffffff" },
  }, err => {
    if (err) {
      console.error("QR render error:", err);
      showQrLoadError(canvasEl);
    }
  });
  return url;
}

function downloadCanvasQR(canvasEl, gameName) {
  if (!canvasEl) return;
  if (!window.QRCode || canvasEl.style.display === "none") {
    window.showToast("⚠️ Mã QR chưa được tạo — không thể tải xuống.", "#e17055");
    return;
  }
  try {
    const dataUrl = canvasEl.toDataURL("image/png");
    const a = document.createElement("a");
    a.href = dataUrl;
    a.download = "qr-" + (window.slugify(gameName) || "boardgame") + ".png";
    document.body.appendChild(a);
    a.click();
    a.remove();
  } catch (err) {
    window.showToast("❌ Không tải được mã QR: " + err.message, "#e17055");
  }
}

/* ══════════════════════════════════════════════
   LIVE PREVIEW — Hero / Ảnh hướng dẫn / YouTube
   ══════════════════════════════════════════════ */
function updateGdHeroPreview() {
  const url = document.getElementById("gdHero")?.value.trim();
  const box = document.getElementById("gdHeroPreview");
  if (!box) return;
  if (!url) {
    box.innerHTML = '<span style="font-size:12px;color:var(--text-muted);">Chưa có ảnh</span>';
    return;
  }
  box.innerHTML = `<img src="${window.escHtml(url)}" alt="Xem trước ảnh nền hero"
    style="width:100%;height:100%;object-fit:cover;"
    onerror="this.parentElement.innerHTML='<span role=&quot;alert&quot; style=&quot;font-size:12px;color:var(--danger);text-align:center;padding:8px;&quot;>⚠️ Không tải được ảnh — kiểm tra lại URL</span>'">`;
}

function updateGdImagesPreview() {
  const box = document.getElementById("gdImagesPreview");
  if (!box) return;
  const images = parseImages("gdImages");
  if (!images.length) {
    box.innerHTML = '<span style="font-size:12px;color:var(--text-muted);">Chưa có ảnh hướng dẫn</span>';
    return;
  }
  box.innerHTML = images.map(img => `
    <div style="border:1px solid var(--border);border-radius:8px;overflow:hidden;background:var(--card);">
      <div style="width:100%;height:80px;background:var(--bg);display:flex;align-items:center;justify-content:center;overflow:hidden;">
        <img src="${window.escHtml(img.url)}" alt="${window.escHtml(img.caption || 'Ảnh hướng dẫn')}"
          style="width:100%;height:100%;object-fit:cover;"
          onerror="this.parentElement.innerHTML='<span role=&quot;alert&quot; style=&quot;font-size:10px;color:var(--danger);text-align:center;padding:4px;&quot;>⚠️ Lỗi ảnh</span>'">
      </div>
      <div style="font-size:10px;color:var(--text-muted);padding:4px 6px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;">
        ${window.escHtml(img.caption || '(không có chú thích)')}
      </div>
    </div>
  `).join('');
}

function updateGdYoutubePreview() {
  const url = document.getElementById("gdYoutube")?.value.trim();
  const box = document.getElementById("gdYoutubePreview");
  if (!box) return;
  const ytId = window.getYoutubeId(url);
  if (!ytId) {
    box.innerHTML = url
      ? '<span role="alert" style="font-size:12px;color:var(--danger);text-align:center;padding:8px;">⚠️ Link YouTube không hợp lệ</span>'
      : '<span style="font-size:12px;color:var(--text-muted);">Chưa có video hướng dẫn</span>';
    return;
  }
  box.innerHTML = `<img src="https://img.youtube.com/vi/${ytId}/hqdefault.jpg" alt="Ảnh xem trước video YouTube hướng dẫn"
    style="width:100%;display:block;"
    onerror="this.parentElement.innerHTML='<span role=&quot;alert&quot; style=&quot;font-size:12px;color:var(--danger);&quot;>⚠️ Không tải được thumbnail</span>'">`;
}

/* ══════════════════════════════════════════════
   TRANG CHI TIẾT GAME — inject vào .main-content
   ══════════════════════════════════════════════ */
(function injectGameDetailPage() {
  const main = document.querySelector(".main-content");
  if (!main || document.getElementById("gameDetailPage")) return;

  const page = document.createElement("div");
  page.id = "gameDetailPage";
  page.style.display = "none";

  page.innerHTML = `
    <div class="page-header" style="align-items:flex-start;">
      <div>
        <button class="btn btn-secondary" id="gdBackBtn" style="margin-bottom:14px;">← Quay lại Boardgames</button>
        <h1 class="page-title">📄 Chi tiết Boardgame</h1>
        <p class="page-subtitle" id="gdSubtitle">—</p>
      </div>
      <div class="header-actions">
        <button class="btn btn-danger" id="gdDeleteBtn">🗑️ Xóa game</button>
        <button class="btn btn-primary" id="gdSaveBtn">💾 Lưu thay đổi</button>
      </div>
    </div>

    <input type="hidden" id="gdId">

    <div style="display:grid;grid-template-columns:1fr 300px;gap:24px;align-items:start;">

      <!-- ── FORM ── -->
      <div class="table-card" style="padding:28px 30px;">
        <div class="form-grid">

          <div class="section-divider"><span>📋 Thông tin cơ bản</span></div>

          <div class="form-group">
            <label for="gdName">Tên game *</label>
            <input type="text" id="gdName" placeholder="Catan, Cluedo...">
          </div>

          <div class="form-group">
            <label for="gdEmoji">Emoji</label>
            <div class="emoji-field">
              <div class="emoji-preview" id="gdEmojiPreview" aria-hidden="true">🎲</div>
              <input type="text" id="gdEmoji" placeholder="🎲" autocomplete="off">
            </div>
          </div>

          <div class="form-group">
            <label for="gdColorInput">Màu chủ đạo</label>
            <div class="color-row">
              <input type="color" id="gdColorPicker" value="#6c5ce7" aria-label="Chọn màu bằng bảng màu"
                     oninput="document.getElementById('gdColorInput').value=this.value">
              <input type="text" id="gdColorInput" placeholder="#6c5ce7"
                     oninput="document.getElementById('gdColorPicker').value=this.value">
            </div>
          </div>

          <div class="form-group">
            <label for="gdSort">Thứ tự hiển thị</label>
            <input type="number" id="gdSort" placeholder="1, 2, 3...">
          </div>

          <div class="form-group">
            <label for="gdPlayers">Số người chơi</label>
            <input type="text" id="gdPlayers" placeholder="2-4 người">
          </div>

          <div class="form-group">
            <label for="gdTime">Thời gian</label>
            <input type="text" id="gdTime" placeholder="30-60 phút">
          </div>

          <div class="form-group">
            <label for="gdDifficulty">Độ khó</label>
            <input type="text" id="gdDifficulty" placeholder="Dễ / Trung bình / Khó">
          </div>

          <div class="form-group">
            <label for="gdCategory">Thể loại</label>
            <input type="text" id="gdCategory" placeholder="🎉 Party, ♟️ Chiến lược">
            <div class="hint">Nhiều thể loại: phân cách bằng dấu phẩy</div>
          </div>

          <div class="section-divider"><span>🎯 Nội dung game</span></div>

          <div class="form-group full-width">
            <label for="gdObjective">Mục tiêu</label>
            <textarea id="gdObjective" placeholder="Mô tả mục tiêu của game..."></textarea>
          </div>

          <div class="form-group full-width">
            <label for="gdWin">Điều kiện thắng</label>
            <textarea id="gdWin" placeholder="Người đầu tiên gom đủ... / Người có điểm cao nhất..."></textarea>
          </div>

          <div class="form-group full-width">
            <label for="gdSetup">Các bước chuẩn bị</label>
            <textarea id="gdSetup" class="tall" placeholder="Mỗi dòng = 1 bước"></textarea>
            <div class="hint">Mỗi bước = 1 dòng</div>
          </div>

          <div class="form-group full-width">
            <label for="gdTurn">Các bước lượt chơi</label>
            <textarea id="gdTurn" class="tall" placeholder="Mỗi dòng = 1 bước"></textarea>
            <div class="hint">Mỗi bước = 1 dòng</div>
          </div>

          <div class="form-group full-width">
            <label for="gdTips">Mẹo chơi</label>
            <textarea id="gdTips" placeholder="Mỗi dòng = 1 mẹo"></textarea>
            <div class="hint">Mỗi mẹo = 1 dòng (có thể để trống)</div>
          </div>

          <div class="section-divider"><span>🖼️ Media</span></div>

          <div class="form-group full-width">
            <label for="gdImages">Ảnh hướng dẫn</label>
            <textarea id="gdImages" placeholder="https://... | Chú thích"></textarea>
            <div class="hint">Mỗi dòng: <code style="background:#f1f5f9;padding:1px 5px;border-radius:4px">URL ảnh | Chú thích</code></div>
            <div id="gdImagesPreview" style="display:grid;grid-template-columns:repeat(auto-fill,minmax(120px,1fr));gap:10px;margin-top:6px;">
              <span style="font-size:12px;color:var(--text-muted);">Chưa có ảnh hướng dẫn</span>
            </div>
          </div>

          <div class="form-group full-width">
            <label for="gdHero">Hero Background URL</label>
            <input type="text" id="gdHero" placeholder="https://...">
            <div id="gdHeroPreview" style="width:100%;height:140px;border-radius:10px;border:1.5px dashed var(--border);background:var(--bg);display:flex;align-items:center;justify-content:center;overflow:hidden;margin-top:6px;">
              <span style="font-size:12px;color:var(--text-muted);">Chưa có ảnh</span>
            </div>
          </div>

          <div class="form-group full-width">
            <label for="gdYoutube">YouTube URL</label>
            <input type="text" id="gdYoutube" placeholder="https://youtube.com/watch?v=...">
            <div id="gdYoutubePreview" style="width:220px;border-radius:10px;overflow:hidden;border:1.5px dashed var(--border);background:var(--bg);display:flex;align-items:center;justify-content:center;min-height:120px;margin-top:6px;">
              <span style="font-size:12px;color:var(--text-muted);">Chưa có video hướng dẫn</span>
            </div>
          </div>

        </div>
      </div>

      <!-- ── SIDEBAR: QR ── -->
      <div style="display:flex;flex-direction:column;gap:20px;">
        <div class="table-card" style="padding:22px;text-align:center;">
          <div style="font-size:12px;font-weight:700;color:var(--text-muted);text-transform:uppercase;letter-spacing:.8px;margin-bottom:14px;">
            📱 Mã QR luật chơi
          </div>
          <canvas id="gdQrCanvas" width="220" height="220" role="img" aria-label="Mã QR dẫn tới trang luật chơi"
            style="margin:0 auto;display:block;border-radius:10px;border:1px solid var(--border);"></canvas>
          <div id="gdQrUrl" style="font-size:11px;color:var(--text-muted);margin-top:10px;word-break:break-all;"></div>
          <button class="btn btn-primary" id="gdQrDownloadBtn" style="width:100%;margin-top:14px;">⬇️ Tải mã QR (PNG)</button>
          <div style="font-size:11px;color:var(--text-muted);margin-top:10px;line-height:1.5;">
            Quét mã sẽ dẫn thẳng tới trang luật chơi của game này trên website.
          </div>
        </div>
      </div>

    </div>
  `;

  main.appendChild(page);
  bindGameDetailEvents();
})();

/* ══════════════════════════════════════════════
   FILL FORM TỪ DỮ LIỆU GAME
   ══════════════════════════════════════════════ */
function fillGameDetailForm(game) {
  document.getElementById("gdId").value = game.id;
  document.getElementById("gdName").value = game.name || "";
  document.getElementById("gdEmoji").value = game.emoji || "🎲";
  document.getElementById("gdEmojiPreview").textContent = game.emoji || "🎲";
  document.getElementById("gdPlayers").value = game.players || "";
  document.getElementById("gdTime").value = game.time || "";
  document.getElementById("gdDifficulty").value = game.difficulty || "";
  document.getElementById("gdObjective").value = game.objective || "";
  document.getElementById("gdWin").value = game.win || "";
  document.getElementById("gdHero").value = game.hero_bg || "";
  document.getElementById("gdYoutube").value = game.youtube_url || "";
  document.getElementById("gdSort").value = game.sort_order ?? "";
  window.clearFieldError("gdName");

  const cats = Array.isArray(game.categories) ? game.categories : [];
  document.getElementById("gdCategory").value = cats.join(", ");

  const colorVal = game.color || "#6c5ce7";
  document.getElementById("gdColorInput").value = colorVal;
  document.getElementById("gdColorPicker").value = colorVal;

  setLines("gdSetup", game.setup);
  setLines("gdTurn", game.turn);
  setLines("gdTips", game.tips);
  setImages("gdImages", game.images);

  document.getElementById("gdSubtitle").textContent =
    `ID: ${game.id}` + (cats.length ? " · " + cats.join(", ") : "");

  /* Emoji preview live-update khi gõ tay */
  const emojiInput = document.getElementById("gdEmoji");
  emojiInput.oninput = () => {
    document.getElementById("gdEmojiPreview").textContent = emojiInput.value.trim() || "🎲";
  };

  /* MỚI: cập nhật preview ngay khi mở form */
  updateGdHeroPreview();
  updateGdImagesPreview();
  updateGdYoutubePreview();
}

/* ══════════════════════════════════════════════
   READ-ONLY (Bar Staff chỉ xem) — dùng chung AdminPermissions.applyReadOnlyForm
   ══════════════════════════════════════════════ */
function setGameDetailReadOnly(readonly) {
  const page = document.getElementById("gameDetailPage");
  window.AdminPermissions.applyReadOnlyForm(page, {
    readonly,
    saveBtn:   document.getElementById("gdSaveBtn"),
    deleteBtn: document.getElementById("gdDeleteBtn"),
  });
}

/* ══════════════════════════════════════════════
   MỞ TRANG CHI TIẾT
   ══════════════════════════════════════════════ */
window.openGameDetail = function (id) {
  const game = window.getGameById ? window.getGameById(id) : null;
  if (!game) { window.showToast("⚠️ Không tìm thấy game — thử refresh lại bảng.", "#e17055"); return; }
  document.getElementById("gdDeleteBtn").dataset.wasVisible = "1";
  fillGameDetailForm(game);
  setGameDetailReadOnly(typeof isGamesReadOnly !== "undefined" && isGamesReadOnly);

  const url = renderGameQR(game.id, document.getElementById("gdQrCanvas"));
  document.getElementById("gdQrUrl").textContent = url;

  window.__showPage("gameDetailPage");
  window.scrollTo(0, 0);
};

/* ══════════════════════════════════════════════
   SAVE
   ══════════════════════════════════════════════ */
async function saveGameDetail() {
  if (typeof isGamesReadOnly !== "undefined" && isGamesReadOnly) return;

  const id = Number(document.getElementById("gdId").value);
  if (!id) return;

  const name = document.getElementById("gdName").value.trim();
  if (!name) { window.showFieldError("gdName", "Vui lòng nhập tên game.", { fullWidth: true, scrollIntoView: true }); return; }
  window.clearFieldError("gdName");

  const catRaw = document.getElementById("gdCategory").value.trim();
  const categories = catRaw ? catRaw.split(/[,\n]/).map(s => s.trim()).filter(Boolean) : [];

  const payload = {
    name,
    emoji:       document.getElementById("gdEmoji").value.trim() || "🎲",
    color:       document.getElementById("gdColorInput").value.trim() || "#6c5ce7",
    players:     document.getElementById("gdPlayers").value.trim(),
    time:        document.getElementById("gdTime").value.trim(),
    difficulty:  document.getElementById("gdDifficulty").value.trim(),
    objective:   document.getElementById("gdObjective").value.trim(),
    win:         document.getElementById("gdWin").value.trim(),
    hero_bg:     document.getElementById("gdHero").value.trim(),
    youtube_url: document.getElementById("gdYoutube").value.trim(),
    categories,
    setup:       parseLines("gdSetup"),
    turn:        parseLines("gdTurn"),
    tips:        parseLines("gdTips"),
    images:      parseImages("gdImages"),
    sort_order:  Number(document.getElementById("gdSort").value) || null,
  };

  const btn = document.getElementById("gdSaveBtn");
  btn.disabled = true; btn.textContent = "Đang lưu...";

  try {
    const { data, error } = await client.from("games").update(payload).eq("id", id).select();
    if (error) throw error;
    if (!data?.length) throw new Error(`UPDATE không ảnh hưởng dòng nào (id=${id}).`);

    document.getElementById("gdSubtitle").textContent =
      `ID: ${id}` + (categories.length ? " · " + categories.join(", ") : "");

    /* Slug có thể đổi nếu vừa sửa tên game → vẽ lại QR cho khớp link mới */
    const url = renderGameQR(id, document.getElementById("gdQrCanvas"));
    document.getElementById("gdQrUrl").textContent = url;

    window.showToast("✅ Đã lưu thành công!");
    if (typeof loadGames === "function") await loadGames();
  } catch (err) {
    window.showToast("❌ Lỗi khi lưu: " + err.message, "#e17055");
  } finally {
    btn.disabled = false; btn.textContent = "💾 Lưu thay đổi";
  }
}

/* ══════════════════════════════════════════════
   DELETE
   ══════════════════════════════════════════════ */
async function deleteGameDetail() {
  if (typeof isGamesReadOnly !== "undefined" && isGamesReadOnly) return;

  const id = document.getElementById("gdId").value;
  if (!id) return;
  const name = document.getElementById("gdName").value || `ID=${id}`;

  const ok = await window.showConfirm({
    title: `Xóa "${name}"?`,
    message: "Hành động này không thể hoàn tác.",
    confirmText: "🗑️ Xóa",
    cancelText: "Hủy",
    danger: true,
  });
  if (!ok) return;

  const btn = document.getElementById("gdDeleteBtn");
  btn.disabled = true; btn.textContent = "Đang xóa...";

  try {
    const { error } = await client.from("games").delete().eq("id", id);
    if (error) throw error;
    window.showToast("🗑️ Đã xóa thành công!", "#e17055");
    if (typeof loadGames === "function") await loadGames();
    if (typeof window.showBoardgames === "function") window.showBoardgames();
  } catch (err) {
    window.showToast("❌ Lỗi: " + err.message, "#e17055");
  } finally {
    btn.disabled = false; btn.textContent = "🗑️ Xóa game";
  }
}

/* ══════════════════════════════════════════════
   BIND EVENTS (chạy 1 lần lúc inject trang)
   ══════════════════════════════════════════════ */
function bindGameDetailEvents() {
  document.getElementById("gdBackBtn")?.addEventListener("click", () => {
    if (typeof window.showBoardgames === "function") window.showBoardgames();
  });
  document.getElementById("gdSaveBtn")?.addEventListener("click", saveGameDetail);
  document.getElementById("gdDeleteBtn")?.addEventListener("click", deleteGameDetail);
  document.getElementById("gdQrDownloadBtn")?.addEventListener("click", () => {
    const canvas = document.getElementById("gdQrCanvas");
    const name = document.getElementById("gdName").value || "boardgame";
    downloadCanvasQR(canvas, name);
  });

  /* MỚI: live preview khi nhập/dán link — debounce 300ms */
  let _gdHeroTimer, _gdImagesTimer, _gdYoutubeTimer;
  document.getElementById("gdHero")?.addEventListener("input", () => {
    clearTimeout(_gdHeroTimer);
    _gdHeroTimer = setTimeout(updateGdHeroPreview, 300);
  });
  document.getElementById("gdImages")?.addEventListener("input", () => {
    clearTimeout(_gdImagesTimer);
    _gdImagesTimer = setTimeout(updateGdImagesPreview, 300);
  });
  document.getElementById("gdYoutube")?.addEventListener("input", () => {
    clearTimeout(_gdYoutubeTimer);
    _gdYoutubeTimer = setTimeout(updateGdYoutubePreview, 300);
  });
}
