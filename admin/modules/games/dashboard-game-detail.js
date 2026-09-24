/* ══════════════════════════════════════════════
   DASHBOARD GAME DETAIL — admin/modules/games/dashboard-game-detail.js
   ─────────────────────────────────────────────
   VAI TRÒ
   Trang chi tiết để chỉnh sửa 1 game (#gameDetailPage) — 1 trang đầy đủ
   thay cho popup, có xem trước trực tiếp ảnh nền / ảnh hướng dẫn /
   YouTube / PDF luật chơi. Popup #gameModal trong dashboard-games.js vẫn
   tồn tại độc lập; 2 nơi cùng sửa 1 bảng `games`.

   CÁCH MỞ
   - Bấm nút "📄 Chi tiết" ở bảng Boardgames → dashboard-games.js gọi
     window.openGameDetail(id) (định nghĩa ở file này).
   - Trang KHÔNG có mục menu riêng và KHÔNG gọi registerPage(): mở bằng
     window.__showPage("gameDetailPage"), nên mục "Boardgames" trong sidebar
     vẫn giữ trạng thái active. Nút "← Quay lại Boardgames" gọi
     window.showBoardgames() (core/dashboard-nav.js).
   - Trang được inject vào .main-content và có id kết thúc bằng "Page"
     để bộ chuyển trang (page-registry) ẩn/hiện được.

   PHỤ THUỘC (nạp TRƯỚC file này)
   dashboard-games.js cung cấp các biến/hàm toàn cục: `client`,
   `currentSession`, `isGamesReadOnly`, `games` (qua window.getGameById),
   `parseLines`, `parseImages`, `setLines`, `setImages`, `loadGames`.
   Ngoài ra: window.AdminPermissions, window.escHtml, window.showToast,
   window.showConfirm, window.getYoutubeId, window.gdrivePreviewUrl
   (js/shared-utils.js).

   KHÁC BIỆT SO VỚI POPUP TRONG dashboard-games.js
     · Thể loại và Độ khó ở đây là ô CHỮ TỰ DO (thể loại cách nhau bằng dấu
       phẩy), chưa dùng chip chọn / dropdown chuẩn như popup — có thể gõ giá
       trị không nằm trong danh sách chuẩn của shared-categories.js.
     · Emoji chỉ có ô nhập tay + xem trước, không có bảng chọn emoji.
     · Sau khi Lưu/Xoá gọi loadGames() tải lại toàn bảng (popup thì chỉ vá
       tại chỗ), nên danh sách Boardgames quay về trang 1.
   Ô "Độ khó" (#gdDifficulty) dùng chung kiểu ô chọn trong
   dashboard-shared.css (cao 44px, bo 10px, nền trắng).

   GIÁ TRỊ MẶC ĐỊNH ĐANG GHI CỨNG
     · Emoji "🎲" (khi ô trống): fillGameDetailForm() và saveGameDetail().
     · Màu "#6c5ce7": form HTML, fillGameDetailForm(), saveGameDetail().
   ══════════════════════════════════════════════ */

/* ══════════════════════════════════════════════
   XEM TRƯỚC TRỰC TIẾP (Hero / Ảnh hướng dẫn / YouTube / PDF)
   ─────────────────────────────────────────────
   4 hàm dưới đây vẽ khung xem trước ngay dưới từng ô nhập; được gọi
   khi mở form và khi gõ/dán link (chờ 300ms sau lần gõ cuối).
   Kích thước & chữ đang ghi cứng (tất cả là inline style):
     · Hero  : khung cao 140px, chữ giữ chỗ "Chưa có ảnh".
     · Ảnh HD: lưới ô tối thiểu 120px, mỗi ô ảnh cao 80px, chú thích chữ 10px.
     · YouTube: khung rộng 220px, cao tối thiểu 120px; ảnh thu nhỏ lấy từ
       https://img.youtube.com/vi/<id>/hqdefault.jpg
     · PDF   : khung cao 240px, nhúng iframe qua window.gdrivePreviewUrl().
   Chữ báo lỗi màu var(--danger) (#e17055):
     "⚠️ Không tải được ảnh — kiểm tra lại URL", "⚠️ Lỗi ảnh",
     "⚠️ Link YouTube không hợp lệ", "⚠️ Không tải được thumbnail".
   Chữ trạng thái trống màu var(--text-muted), cỡ 12px.
   (Khung xem trước có viền nét đứt 1.5px màu var(--border), nền var(--bg).)
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

/* Xem trước PDF luật chơi: nhúng iframe bằng link /preview do
   window.gdrivePreviewUrl() tạo (cùng helper trang khách dùng), kèm link
   "↗️ Mở file gốc trên Google Drive" trỏ đúng URL admin đã dán.
   Không có link → hiện chữ giữ chỗ và ẩn link "Mở file gốc". */
function updateGdPdfPreview() {
  const url = document.getElementById("gdRulesPdf")?.value.trim();
  const box = document.getElementById("gdPdfPreview");
  const openLink = document.getElementById("gdPdfOpenLink");
  if (!box) return;

  if (!url) {
    box.innerHTML = '<span style="font-size:12px;color:var(--text-muted);">Chưa có link luật chơi PDF</span>';
    if (openLink) openLink.style.display = "none";
    return;
  }

  const previewUrl = window.gdrivePreviewUrl(url);
  box.innerHTML = `<iframe src="${window.escHtml(previewUrl)}" title="Xem trước luật chơi PDF" loading="lazy"
    style="width:100%;height:100%;border:none;"></iframe>`;

  if (openLink) {
    openLink.href = url;
    openLink.style.display = "inline-flex";
  }
}

/* ══════════════════════════════════════════════
   BÁO LỖI TẠI Ô NHẬP
   ─────────────────────────────────────────────
   Viền ô đổi sang var(--danger), dòng chữ lỗi đỏ 12px đậm ngay dưới ô
   (id = <id ô> + "Error"), tự cuộn ô lỗi vào giữa màn hình, tự xoá khi
   gõ lại. Tên hàm có tiền tố Gd để không đụng với hàm cùng chức năng
   của dashboard-games.js.
   ══════════════════════════════════════════════ */
function clearGdFieldError(id) {
  const el = document.getElementById(id);
  if (!el) return;
  el.style.borderColor = "";
  document.getElementById(id + "Error")?.remove();
}
function showGdFieldError(id, msg) {
  const el = document.getElementById(id);
  if (!el) return;
  el.style.borderColor = "var(--danger)";
  el.focus();
  el.scrollIntoView({ behavior: "smooth", block: "center" });
  let err = document.getElementById(id + "Error");
  if (!err) {
    err = document.createElement("div");
    err.id = id + "Error";
    err.setAttribute("role", "alert");
    err.style.cssText = "color:var(--danger);font-size:12px;font-weight:600;margin-top:-6px;grid-column:1/-1;";
    el.closest(".form-group")?.insertAdjacentElement("afterend", err) ?? el.insertAdjacentElement("afterend", err);
  }
  err.textContent = msg;
  el.addEventListener("input", () => clearGdFieldError(id), { once: true });
}

/* ══════════════════════════════════════════════
   DỰNG TRANG — inject vào .main-content 1 lần lúc file chạy
   ─────────────────────────────────────────────
   Nội dung là chuỗi HTML bên dưới (không chèn comment vào giữa được).
   Bảng tra "muốn đổi X thì sửa ở đâu":
     · Tiêu đề "📄 Chi tiết Boardgame" + nút "← Quay lại Boardgames",
       "🗑️ Xóa game", "💾 Lưu thay đổi": sửa chữ trong chuỗi.
       Kiểu nút lấy từ .btn / .btn-primary / .btn-danger / .btn-secondary
       trong dashboard.css.
     · Khung form: rộng tối đa 900px, padding 28px 30px (style inline trên
       thẻ .table-card). Lưới 2 cột: .form-grid (dashboard.css).
     · Tên 3 nhóm: "📋 Thông tin cơ bản", "🎯 Nội dung game", "🖼️ Media".
     · Placeholder / gợi ý: sửa trực tiếp; ô <code> dùng nền #f1f5f9,
       padding 1px 5px, bo 4px.
     · Ô màu: 2 ô đồng bộ nhau bằng thuộc tính oninput viết thẳng trong HTML
       (khác quy ước dự án là addEventListener); màu mặc định #6c5ce7.
     · Kích thước các khung xem trước: xem chú thích ở khối "XEM TRƯỚC".
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

    <div class="table-card" style="padding:28px 30px;max-width:900px;">
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

        <div class="form-group full-width">
          <label for="gdRulesPdf">Link luật chơi PDF (Google Drive)</label>
          <input type="text" id="gdRulesPdf" placeholder="https://drive.google.com/file/d/.../view">
          <div class="hint">Dán link chia sẻ Drive — nhớ để chế độ "Anyone with the link". Hệ thống tự chuyển sang link xem trước, không cần link trực tiếp.</div>
          <div id="gdPdfPreview" style="width:100%;height:240px;border-radius:10px;border:1.5px dashed var(--border);background:var(--bg);display:flex;align-items:center;justify-content:center;overflow:hidden;margin-top:6px;">
            <span style="font-size:12px;color:var(--text-muted);">Chưa có link luật chơi PDF</span>
          </div>
          <a id="gdPdfOpenLink" href="#" target="_blank" rel="noopener" style="display:none;font-size:12px;font-weight:700;color:var(--primary);margin-top:8px;">↗️ Mở file gốc trên Google Drive</a>
        </div>

      </div>
    </div>
  `;

  main.appendChild(page);
  bindGameDetailEvents();
})();

/* ══════════════════════════════════════════════
   ĐỔ DỮ LIỆU 1 GAME VÀO FORM
   ─────────────────────────────────────────────
   - Danh sách thể loại (mảng) hiển thị thành chuỗi cách nhau ", ".
   - Dòng phụ đề dưới tiêu đề: "ID: <id> · <thể loại 1, thể loại 2>".
   - Ô emoji cập nhật ô xem trước ngay khi gõ (handler gán bằng `oninput`,
     mỗi lần mở form được gán lại nên không bị nhân đôi).
   - Cuối hàm vẽ lại cả 4 khung xem trước.
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
  document.getElementById("gdRulesPdf").value = game.rules_pdf_url || "";
  document.getElementById("gdSort").value = game.sort_order ?? "";
  clearGdFieldError("gdName");

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

  const emojiInput = document.getElementById("gdEmoji");
  emojiInput.oninput = () => {
    document.getElementById("gdEmojiPreview").textContent = emojiInput.value.trim() || "🎲";
  };

  updateGdHeroPreview();
  updateGdImagesPreview();
  updateGdYoutubePreview();
  updateGdPdfPreview();
}

/* ══════════════════════════════════════════════
   CHẾ ĐỘ CHỈ XEM (Bar Staff)
   Khoá MỌI ô nhập trong trang + ẩn nút Lưu/Xoá, dùng chung logic
   AdminPermissions.applyReadOnlyForm.
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
   Tra game theo id (window.getGameById của dashboard-games.js). Không thấy →
   toast "⚠️ Không tìm thấy game — thử refresh lại bảng." (nền #e17055).
   dataset.wasVisible="1" báo cho applyReadOnlyForm biết đây là trang
   ĐANG SỬA (nút Xoá được phép hiện lại khi không ở chế độ chỉ xem).
   ══════════════════════════════════════════════ */
window.openGameDetail = function (id) {
  const game = window.getGameById ? window.getGameById(id) : null;
  if (!game) { window.showToast("⚠️ Không tìm thấy game — thử refresh lại bảng.", "#e17055"); return; }
  document.getElementById("gdDeleteBtn").dataset.wasVisible = "1";
  fillGameDetailForm(game);
  setGameDetailReadOnly(typeof isGamesReadOnly !== "undefined" && isGamesReadOnly);

  window.__showPage("gameDetailPage");
  window.scrollTo(0, 0);
};

/* ══════════════════════════════════════════════
   LƯU
   ─────────────────────────────────────────────
   - Chỉ tên game là bắt buộc (báo lỗi tại ô, chữ "Vui lòng nhập tên game.").
   - Thể loại: tách bởi dấu phẩy hoặc xuống dòng, bỏ mục rỗng.
   - Mặc định khi để trống: emoji "🎲", màu "#6c5ce7". sort_order rỗng/0 → null.
   - UPDATE không ảnh hưởng dòng nào → coi là lỗi.
   - Thành công: toast "✅ Đã lưu thành công!" rồi loadGames() tải lại bảng.
     Lỗi: toast nền #e17055. Nút Lưu đổi chữ "Đang lưu..." trong lúc chờ.
   ══════════════════════════════════════════════ */
async function saveGameDetail() {
  if (typeof isGamesReadOnly !== "undefined" && isGamesReadOnly) return;

  const id = Number(document.getElementById("gdId").value);
  if (!id) return;

  const name = document.getElementById("gdName").value.trim();
  if (!name) { showGdFieldError("gdName", "Vui lòng nhập tên game."); return; }
  clearGdFieldError("gdName");

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
    rules_pdf_url: document.getElementById("gdRulesPdf").value.trim(),
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

    window.showToast("✅ Đã lưu thành công!");
    if (typeof loadGames === "function") await loadGames();
  } catch (err) {
    window.showToast("❌ Lỗi khi lưu: " + err.message, "#e17055");
  } finally {
    btn.disabled = false; btn.textContent = "💾 Lưu thay đổi";
  }
}

/* ══════════════════════════════════════════════
   XOÁ
   Xoá CỨNG (bảng `games` không có khoá ngoại trỏ tới). Hỏi xác nhận bằng
   window.showConfirm ("Xóa "<tên>"?" / "Hành động này không thể hoàn
   tác."). Xong: toast "🗑️ Đã xóa thành công!" (nền #e17055), tải lại
   bảng và quay về trang Boardgames.
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
   GẮN SỰ KIỆN (chạy 1 lần ngay sau khi dựng trang)
   Xem trước trực tiếp: chờ 300ms sau lần gõ/dán cuối (mỗi ô có bộ đếm
   giờ riêng) rồi mới vẽ lại khung xem trước tương ứng.
   ══════════════════════════════════════════════ */
function bindGameDetailEvents() {
  document.getElementById("gdBackBtn")?.addEventListener("click", () => {
    if (typeof window.showBoardgames === "function") window.showBoardgames();
  });
  document.getElementById("gdSaveBtn")?.addEventListener("click", saveGameDetail);
  document.getElementById("gdDeleteBtn")?.addEventListener("click", deleteGameDetail);

  let _gdHeroTimer, _gdImagesTimer, _gdYoutubeTimer, _gdPdfTimer;
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
  document.getElementById("gdRulesPdf")?.addEventListener("input", () => {
    clearTimeout(_gdPdfTimer);
    _gdPdfTimer = setTimeout(updateGdPdfPreview, 300);
  });
}
