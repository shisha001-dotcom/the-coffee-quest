/* ══════════════════════════════════════════════
   DASHBOARD GAME DETAIL + QR — admin/modules/dashboard-game-detail.js
   ─────────────────────────────────────────────
   Tính năng 1: Trang CHI TIẾT chỉnh sửa game (thay thế popup khi cần
   thao tác trực quan hơn) — tách rời hoàn toàn với modal popup trong
   dashboard-games.js, ai muốn sửa nhanh vẫn dùng popup bình thường.

   Tính năng 2: Mã QR dẫn tới trang luật chơi của game trên site chính.
   Link dạng #game-{slug-ten-game} (không dấu, có gạch nối) thay vì
   #game-{id} để người quét link dễ nhận biết đang xem game nào.
   Có 2 điểm truy cập:
     - Nút "📱 QR" trong bảng  → mở modal nhỏ, xem/tải QR nhanh
     - Trang chi tiết          → luôn hiển thị QR kèm nút tải

   KHÔNG dùng AdminDashboard.registerPage() vì đây không phải trang
   có mục cố định trên sidebar — nó chỉ mở khi bấm vào 1 game cụ thể
   từ bảng Boardgames, giống cách dashboardPage/boardgamesPage/drinksPage
   dùng thẳng window.__showPage().

   Cần: `client`, `currentSession`, `isGamesReadOnly`, `games`, `parseLines`,
   `parseImages`, `setLines`, `setImages` (tất cả từ dashboard-games.js —
   load TRƯỚC file này), window.escHtml / window.showToast / window.slugify /
   window.buildGameSlugMap (shared-utils.js), thư viện QRCode (CDN, load
   trước file này).

   ⚠️ FIX (2026-07): renderGameQR() trước đây fail-silent khi thư viện
   QRCode (CDN) load thất bại/bị chặn mạng — canvas trắng tinh, không có
   bất kỳ log/cảnh báo nào, khiến lỗi rất khó phát hiện. Giờ đây nếu
   window.QRCode không tồn tại, hàm sẽ:
     - In cảnh báo rõ ràng ra console
     - Chèn thông báo lỗi ngay trong khung canvas (cả modal nhanh lẫn
       trang chi tiết) để người dùng biết ngay thay vì đoán mò
   ══════════════════════════════════════════════ */

/* ⚠️ Đổi domain tại đây nếu deploy sang địa chỉ khác */
const SITE_BASE_URL = "https://shisha001-dotcom.github.io/the-coffee-quest/";

/* ══════════════════════════════════════════════
   HELPER DÙNG CHUNG: sinh URL + render QR vào canvas + tải PNG
   ══════════════════════════════════════════════ */
function gameQrUrl(gameId) {
  /* `games` là mảng global từ dashboard-games.js — cùng thứ tự
     (sort_order ascending) với GAMES bên frontend nên slug sinh
     ra ở 2 nơi luôn khớp nhau */
  const { slugById } = window.buildGameSlugMap(games || []);
  const slug = slugById[gameId] || String(gameId);
  return `${SITE_BASE_URL}#game-${slug}`;
}

/* ── Hiển thị lỗi ngay tại vị trí canvas khi thư viện QRCode
   chưa sẵn sàng (CDN load thất bại / bị chặn mạng / v.v.) ── */
function showQrLoadError(canvasEl) {
  console.error(
    "[dashboard-game-detail] window.QRCode không tồn tại — thư viện QRCode " +
    "(CDN qrcode.js) chưa load được. Kiểm tra thẻ <script> CDN trong " +
    "dashboard.html, kết nối mạng, hoặc CDN có bị chặn không."
  );
  if (!canvasEl || !canvasEl.parentElement) return;

  /* Tránh chèn nhiều thông báo lỗi trùng lặp nếu gọi lại nhiều lần */
  const existing = canvasEl.parentElement.querySelector(".qr-load-error");
  if (existing) existing.remove();

  canvasEl.style.display = "none";
  const errBox = document.createElement("div");
  errBox.className = "qr-load-error";
  errBox.style.cssText =
    "width:220px;min-height:120px;margin:0 auto;display:flex;flex-direction:column;" +
    "align-items:center;justify-content:center;gap:6px;text-align:center;" +
    "background:#fff5f5;border:1.5px dashed var(--danger,#e17055);border-radius:10px;" +
    "color:var(--danger,#e17055);font-size:12px;font-weight:600;padding:14px;";
  errBox.innerHTML = `
    <span style="font-size:22px;">⚠️</span>
    <span>Không tải được thư viện tạo mã QR.</span>
    <span style="font-weight:400;color:var(--text-muted,#718096);">
      Kiểm tra kết nối mạng hoặc CDN đang bị chặn.
    </span>
  `;
  canvasEl.parentElement.insertBefore(errBox, canvasEl);
}

/* ── Xóa thông báo lỗi (nếu có) khi render QR thành công trở lại ── */
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
    alert("Mã QR chưa được tạo (thư viện QRCode chưa load) — không thể tải xuống.");
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
    alert("Không tải được mã QR: " + err.message);
  }
}

/* ══════════════════════════════════════════════
   QR QUICK MODAL — mở nhanh từ nút "📱 QR" trong bảng
   ══════════════════════════════════════════════ */
(function injectQrQuickModal() {
  if (document.getElementById("qrQuickModal")) return;

  const modal = document.createElement("div");
  modal.className = "modal-overlay hidden";
  modal.id = "qrQuickModal";
  modal.innerHTML = `
    <div class="modal-box" style="max-width:340px;text-align:center;">
      <div class="modal-header">
        <h2 id="qrQuickTitle">📱 Mã QR</h2>
        <button class="close-btn" id="qrQuickCloseBtn">✕</button>
      </div>
      <canvas id="qrQuickCanvas" width="220" height="220"
        style="margin:0 auto;display:block;border-radius:10px;border:1px solid var(--border);"></canvas>
      <div id="qrQuickUrl" style="font-size:11px;color:var(--text-muted);margin:12px 0;word-break:break-all;"></div>
      <button class="btn btn-primary" id="qrQuickDownloadBtn" style="width:100%;">⬇️ Tải mã QR (PNG)</button>
    </div>
  `;
  document.body.appendChild(modal);

  modal.addEventListener("click", e => { if (e.target === modal) modal.classList.add("hidden"); });
  document.getElementById("qrQuickCloseBtn").addEventListener("click", () => modal.classList.add("hidden"));
})();

window.openGameQR = function (id) {
  const game = window.getGameById ? window.getGameById(id) : null;
  if (!game) { alert("Không tìm thấy game."); return; }

  document.getElementById("qrQuickTitle").textContent = "📱 QR — " + game.name;
  const canvas = document.getElementById("qrQuickCanvas");
  const url = renderGameQR(id, canvas);
  document.getElementById("qrQuickUrl").textContent = url;
  document.getElementById("qrQuickDownloadBtn").onclick = () => downloadCanvasQR(canvas, game.name);
  document.getElementById("qrQuickModal").classList.remove("hidden");
};

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
            <label>Tên game *</label>
            <input type="text" id="gdName" placeholder="Catan, Cluedo...">
          </div>

          <div class="form-group">
            <label>Emoji</label>
            <div class="emoji-field">
              <div class="emoji-preview" id="gdEmojiPreview">🎲</div>
              <input type="text" id="gdEmoji" placeholder="🎲" autocomplete="off">
            </div>
          </div>

          <div class="form-group">
            <label>Màu chủ đạo</label>
            <div class="color-row">
              <input type="color" id="gdColorPicker" value="#6c5ce7"
                     oninput="document.getElementById('gdColorInput').value=this.value">
              <input type="text" id="gdColorInput" placeholder="#6c5ce7"
                     oninput="document.getElementById('gdColorPicker').value=this.value">
            </div>
          </div>

          <div class="form-group">
            <label>Thứ tự hiển thị</label>
            <input type="number" id="gdSort" placeholder="1, 2, 3...">
          </div>

          <div class="form-group">
            <label>Số người chơi</label>
            <input type="text" id="gdPlayers" placeholder="2-4 người">
          </div>

          <div class="form-group">
            <label>Thời gian</label>
            <input type="text" id="gdTime" placeholder="30-60 phút">
          </div>

          <div class="form-group">
            <label>Độ khó</label>
            <input type="text" id="gdDifficulty" placeholder="Dễ / Trung bình / Khó">
          </div>

          <div class="form-group">
            <label>Thể loại</label>
            <input type="text" id="gdCategory" placeholder="🎉 Party, ♟️ Chiến lược">
            <div class="hint">Nhiều thể loại: phân cách bằng dấu phẩy</div>
          </div>

          <div class="section-divider"><span>🎯 Nội dung game</span></div>

          <div class="form-group full-width">
            <label>Mục tiêu</label>
            <textarea id="gdObjective" placeholder="Mô tả mục tiêu của game..."></textarea>
          </div>

          <div class="form-group full-width">
            <label>Điều kiện thắng</label>
            <textarea id="gdWin" placeholder="Người đầu tiên gom đủ... / Người có điểm cao nhất..."></textarea>
          </div>

          <div class="form-group full-width">
            <label>Các bước chuẩn bị</label>
            <textarea id="gdSetup" class="tall" placeholder="Mỗi dòng = 1 bước"></textarea>
            <div class="hint">Mỗi bước = 1 dòng</div>
          </div>

          <div class="form-group full-width">
            <label>Các bước lượt chơi</label>
            <textarea id="gdTurn" class="tall" placeholder="Mỗi dòng = 1 bước"></textarea>
            <div class="hint">Mỗi bước = 1 dòng</div>
          </div>

          <div class="form-group full-width">
            <label>Mẹo chơi</label>
            <textarea id="gdTips" placeholder="Mỗi dòng = 1 mẹo"></textarea>
            <div class="hint">Mỗi mẹo = 1 dòng (có thể để trống)</div>
          </div>

          <div class="section-divider"><span>🖼️ Media</span></div>

          <div class="form-group full-width">
            <label>Ảnh hướng dẫn</label>
            <textarea id="gdImages" placeholder="https://... | Chú thích"></textarea>
            <div class="hint">Mỗi dòng: <code style="background:#f1f5f9;padding:1px 5px;border-radius:4px">URL ảnh | Chú thích</code></div>
          </div>

          <div class="form-group full-width">
            <label>Hero Background URL</label>
            <input type="text" id="gdHero" placeholder="https://...">
          </div>

          <div class="form-group full-width">
            <label>YouTube URL</label>
            <input type="text" id="gdYoutube" placeholder="https://youtube.com/watch?v=...">
          </div>

        </div>
      </div>

      <!-- ── SIDEBAR: QR ── -->
      <div style="display:flex;flex-direction:column;gap:20px;">
        <div class="table-card" style="padding:22px;text-align:center;">
          <div style="font-size:12px;font-weight:700;color:var(--text-muted);text-transform:uppercase;letter-spacing:.8px;margin-bottom:14px;">
            📱 Mã QR luật chơi
          </div>
          <canvas id="gdQrCanvas" width="220" height="220"
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
  if (!game) { alert("Không tìm thấy game — thử refresh lại bảng."); return; }
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
  if (!name) { alert("Vui lòng nhập tên game."); return; }

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
    alert("❌ Lỗi khi lưu:\n\n" + err.message);
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
  if (!confirm(`Xóa "${name}"?\n\nHành động này không thể hoàn tác!`)) return;

  const btn = document.getElementById("gdDeleteBtn");
  btn.disabled = true; btn.textContent = "Đang xóa...";

  try {
    const { error } = await client.from("games").delete().eq("id", id);
    if (error) throw error;
    window.showToast("🗑️ Đã xóa thành công!", "#e17055");
    if (typeof loadGames === "function") await loadGames();
    if (typeof window.showBoardgames === "function") window.showBoardgames();
  } catch (err) {
    alert("Lỗi: " + err.message);
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
}
