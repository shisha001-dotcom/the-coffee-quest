/* ══════════════════════════════════════════════
   SHARED GAME CATEGORIES & DIFFICULTY — js/shared-categories.js
   ─────────────────────────────────────────────
   Nơi DUY NHẤT chứa danh sách thể loại game + mức độ khó,
   dùng chung cho:
     - Frontend: pages/boardgame.html (chip lọc) — render bởi
       renderCategoryChips() trong js/app.js
     - Admin: modal thêm/sửa game (dashboard-games.js) + trang
       chi tiết game (dashboard-game-detail.js) — chọn bằng
       chip-picker/dropdown thay vì gõ tay

   ⚠️ Muốn THÊM/XÓA/ĐỔI TÊN thể loại → CHỈ sửa GAME_CATEGORIES
      ở đây. Không cần sửa pages/boardgame.html hay bất kỳ
      module admin nào khác — tất cả đều tự đọc từ đây.

   ⚠️ Load file này SAU shared-config.js, TRƯỚC:
      - js/app.js (frontend)
      - admin/modules/dashboard-games.js + dashboard-game-detail.js (admin)
   ══════════════════════════════════════════════ */

window.GAME_CATEGORIES = [
  "🎉 Party",
  "👨‍👩‍👧 Gia đình",
  "♟️ Chiến lược",
  "🤝 Hợp tác",
  "🕵️ Suy luận",
  "🎭 Ẩn vai trò",
  "🃏 Deck Building",
  "🏗️ Xây dựng",
  "💰 Giao thương",
  "🎲 Dice Game",
  "🧸 Trẻ em",
];

window.DIFFICULTY_LEVELS = ["Dễ", "Trung bình", "Khó"];

/* ══════════════════════════════════════════════
   CATEGORY PICKER (dùng ở admin) — chip chọn nhiều
   ─────────────────────────────────────────────
   renderCategoryPicker(container, selected, readonly)
     - container: phần tử <div> sẽ chứa các nút chip
     - selected:  mảng string thể loại đang được chọn sẵn
     - readonly:  true → chip bị khóa (disabled), không bấm được

   getSelectedCategories(container)
     - đọc lại mảng thể loại đang được chọn từ container
   ══════════════════════════════════════════════ */
window.renderCategoryPicker = function (container, selected = [], readonly = false) {
  if (!container) return;
  const sel = new Set(selected);

  container.innerHTML = window.GAME_CATEGORIES.map(cat => `
    <button type="button" class="cat-chip${sel.has(cat) ? ' selected' : ''}"
      data-cat="${window.escHtml(cat)}" ${readonly ? 'disabled' : ''}>${window.escHtml(cat)}</button>
  `).join('');

  if (readonly) return;
  container.querySelectorAll('.cat-chip').forEach(btn => {
    btn.addEventListener('click', () => btn.classList.toggle('selected'));
  });
};

window.getSelectedCategories = function (container) {
  if (!container) return [];
  return [...container.querySelectorAll('.cat-chip.selected')].map(b => b.dataset.cat);
};

/* ══════════════════════════════════════════════
   DIFFICULTY SELECT (dùng ở admin) — dropdown chọn 1
   ─────────────────────────────────────────────
   populateDifficultySelect(selectEl, currentValue)
     - Điền option Dễ / Trung bình / Khó + option rỗng đầu tiên
       ("-- Chọn độ khó --") để không ép buộc phải chọn.
     - Nếu currentValue là dữ liệu cũ không khớp danh sách chuẩn
       (vd game cũ lỡ gõ tay giá trị lạ) → tự thêm option đó vào
       cuối danh sách để không mất/méo dữ liệu khi hiển thị.
   ══════════════════════════════════════════════ */
window.populateDifficultySelect = function (selectEl, currentValue = '') {
  if (!selectEl) return;

  const options = [...window.DIFFICULTY_LEVELS];
  if (currentValue && !options.includes(currentValue)) options.push(currentValue);

  const optionsHtml = options.map(d =>
    `<option value="${window.escHtml(d)}" ${d === currentValue ? 'selected' : ''}>${window.escHtml(d)}</option>`
  ).join('');

  selectEl.innerHTML =
    `<option value="" ${!currentValue ? 'selected' : ''}>-- Chọn độ khó --</option>` + optionsHtml;
};
