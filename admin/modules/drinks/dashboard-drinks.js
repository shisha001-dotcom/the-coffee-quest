/* ══════════════════════════════════════════════
   DASHBOARD DRINKS MODULE — admin/modules/drinks/dashboard-drinks.js
   ─────────────────────────────────────────────
   VAI TRÒ
   Toàn bộ trang "☕ Đồ uống" (công thức bán hàng): lưới thẻ đồ uống, tab
   lọc theo loại, và popup Thêm/Sửa/Xem công thức có "recipe builder"
   (chọn nguyên liệu + số lượng cho 1 ly, xem trước giá thành và lợi nhuận).

   TRANG TĨNH & POPUP
   - Trang #drinksPage (#drinkTabsWrap, #drinkGrid, nút #addDrinkBtn…)
     nằm sẵn trong admin/dashboard.html; mở/đóng do core/dashboard-nav.js.
   - Popup #drinkModal được file này tự inject vào <body> khi chạy.

   DỮ LIỆU LIÊN QUAN
     drinks               : đồ uống (giá bán, loại, trạng thái, hướng dẫn…)
     drink_categories     : loại đồ uống (nạp qua window.Inventory)
     drink_ingredients    : công thức — mỗi dòng = 1 nguyên liệu của 1 đồ uống
     ingredients          : nguyên liệu VÀ thành phẩm (nạp qua window.Inventory)

   LIÊN KẾT "THÀNH PHẨM"
   - Mỗi đồ uống có cột `product_ingredient_id` trỏ tới 1 dòng `ingredients`
     có is_finished_product = true (khai báo ở ⚙️ Settings → 📦 Sản phẩm).
   - Khi TẠO MỚI: bắt buộc chọn 1 thành phẩm; tên đồ uống tự lấy theo tên
     thành phẩm (ô tên bị ẩn, không gõ tay) để tránh lệch tên giữa 2 nơi.
   - Đồ uống cũ chưa có liên kết vẫn sửa được bình thường; popup hiện
     ghi chú nhắc liên kết chứ không ép buộc.
   - Dropdown nguyên liệu trong recipe builder LOẠI TRỪ các thành phẩm, và
     chỉ hiện nguyên liệu ĐÃ CÓ Mã sản phẩm.

   CẦN CHẠY TRƯỚC 1 LẦN (Supabase SQL Editor)
     alter table ingredients
       add column if not exists is_finished_product boolean not null default false;
     alter table drinks
       add column if not exists product_ingredient_id bigint references ingredients(id);

   XOÁ = XOÁ MỀM
   Nút "🗑️ Ngừng bán" đặt deleted_at + is_active=false và lưu lý do
   (bắt buộc) — không xoá dòng, để giữ lịch sử đơn hàng đã bán.

   ⚠️ LƯU CÔNG THỨC KHÔNG NẰM TRONG 1 GIAO DỊCH
   saveDrink() xoá TOÀN BỘ dòng cũ của drink_ingredients rồi mới chèn lại
   các dòng mới. Nếu bước chèn lỗi (mất mạng…) thì công thức cũ đã bị xoá.

   PHỤ THUỘC (nạp TRƯỚC)
   client, currentSession, window.AdminPermissions, window.Inventory
   (inventory-shared.js), window.escHtml, showToast, showReasonPrompt,
   clearFieldError, showFieldError (js/shared-utils.js).

   XUẤT RA WINDOW (cho module khác dùng)
   loadDrinks, renderDrinkGrid, openAddDrink, editDrink, saveDrink, deleteDrink,
   filterDrinks. Trang Settings → tab Công thức gọi window.editDrink() để mở
   đúng popup này.
   ══════════════════════════════════════════════ */

/* Tên loại đang lọc ('all' hoặc drink_categories.name). Dùng chung với
   core/dashboard-nav.js nên để trên window. */
window.activeDrinkFilter = 'all';
let allDrinks = [];
let recipeRowSeq = 0; // bộ đếm để đặt id tạm cho từng dòng công thức trong popup

/* true nếu role chỉ được xem: ẩn nút "+ Thêm công thức", khoá popup. */
const isDrinksReadOnly = window.AdminPermissions.isReadOnly(currentSession.role);
const INVD = window.Inventory;

/* Làm tròn 6 chữ số thập phân — chỉ dùng cho hệ số quy đổi tự điền
   (vd 1/500 = 0.002, 1/300 = 0.003333…), tránh số quá dài. */
function round6(n) { return Math.round(n * 1e6) / 1e6; }

/* ══════════════════════════════════════════════
   POPUP THÊM/SỬA CÔNG THỨC — inject 1 lần lúc file chạy
   ─────────────────────────────────────────────
   Nội dung là chuỗi HTML bên dưới. Bảng tra "sửa ở đâu":
     · Chữ nhãn / placeholder / gợi ý (.hint): sửa trực tiếp trong chuỗi.
     · Tiêu đề: mặc định "Thêm công thức"; khi mở được đặt lại thành
       "Thêm công thức" / "✏️ Chỉnh sửa công thức" / "👁️ Xem chi tiết công thức".
     · 5 nhóm: "📋 Thông tin cơ bản", "🧪 Công thức pha chế (tính giá thành)",
       "📝 Hướng dẫn pha chế", "🖼️ Media".
     · Khung giá thành: nền var(--bg), padding 12px 16px, bo 10px; số tiền cỡ
       16px, đậm, màu var(--primary) (tím).
     · Ô giá bán: bước nhảy 1000 (step), placeholder 35000; ô emoji tối đa 4
       ký tự, placeholder "☕".
     · Ô chọn (select) trong popup lấy kiểu từ dashboard-shared.css
       (#drinkModal .form-group select: cao 44px, bo 10px).
     · Khung popup: rộng/padding/bo góc từ .modal-box trong dashboard.css.
   Popup đóng bằng nút ✕, phím Escape hoặc bấm ra ngoài lớp nền.
   Có 2 ô ẩn: #drinkName (tên đồ uống) và #drinkProductIngredientId (id thành
   phẩm) — cả 2 được tự điền khi chọn ở ô #drinkProductSelect.
   ══════════════════════════════════════════════ */
(function injectDrinkModal() {
  if (document.getElementById("drinkModal")) return;

  const modal = document.createElement("div");
  modal.className = "modal-overlay hidden";
  modal.id = "drinkModal";
  modal.setAttribute("role", "dialog");
  modal.setAttribute("aria-modal", "true");
  modal.setAttribute("aria-labelledby", "drinkModalTitle");
  modal.innerHTML = `
    <div class="modal-box">
      <div class="modal-header">
        <h2 id="drinkModalTitle">Thêm công thức</h2>
        <button class="close-btn" id="closeDrinkModalBtn" aria-label="Đóng cửa sổ">✕</button>
      </div>

      <input type="hidden" id="drinkId">
      <input type="hidden" id="drinkProductIngredientId">
      <input type="hidden" id="drinkName">

      <div class="form-grid">
        <div class="section-divider"><span>📋 Thông tin cơ bản</span></div>

        <div class="form-group full-width">
          <label for="drinkProductSelect">Thành phẩm (sản phẩm bán ra) *</label>
          <select id="drinkProductSelect"><option value="">-- Chọn thành phẩm --</option></select>
          <div class="hint">Chỉ hiện sản phẩm đã tick "🥤 Đây là thành phẩm" ở ⚙️ Settings → 📦 Sản phẩm. Chưa thấy sản phẩm cần tìm? Vào đó khai báo trước.</div>
          <div id="drinkLegacyNote" class="hint" style="display:none;color:var(--danger);"></div>
        </div>

        <div class="form-group">
          <label for="drinkCategory">Loại *</label>
          <select id="drinkCategory"><option value="">-- Chọn loại --</option></select>
        </div>

        <div class="form-group">
          <label for="drinkEmoji">Emoji</label>
          <input type="text" id="drinkEmoji" placeholder="☕" maxlength="4">
        </div>

        <div class="form-group">
          <label for="drinkPrice">Giá bán (đ) *</label>
          <input type="number" id="drinkPrice" min="0" step="1000" placeholder="35000">
        </div>

        <div class="form-group">
          <label for="drinkSort">Thứ tự hiển thị</label>
          <input type="number" id="drinkSort" placeholder="1, 2, 3...">
        </div>

        <div class="form-group" style="flex-direction:row;align-items:center;gap:8px;">
          <input type="checkbox" id="drinkIsActive" style="width:18px;height:18px;" checked>
          <label for="drinkIsActive" style="margin:0;">Đang bán</label>
        </div>

        <div class="form-group full-width">
          <label for="drinkDesc">Mô tả ngắn</label>
          <input type="text" id="drinkDesc" placeholder="Thức uống đặc trưng của quán...">
        </div>

        <div class="section-divider"><span>🧪 Công thức pha chế (tính giá thành)</span></div>

        <div class="form-group full-width">
          <div id="drinkRecipeRows" style="display:flex;flex-direction:column;gap:8px;"></div>
          <button type="button" class="btn btn-secondary" id="addRecipeRowBtn" style="margin-top:10px;width:fit-content;">+ Thêm nguyên liệu</button>
          <div style="margin-top:12px;padding:12px 16px;background:var(--bg);border-radius:10px;display:flex;justify-content:space-between;align-items:center;">
            <span style="font-size:13px;font-weight:700;">💰 Giá thành ước tính / ly</span>
            <span id="drinkCostPreview" style="font-size:16px;font-weight:700;color:var(--primary);">0 đ</span>
          </div>
          <div id="drinkProfitPreview" style="margin-top:6px;font-size:12px;color:var(--text-muted);"></div>
          <div class="hint">Chưa có nguyên liệu nào trong kho, hoặc không thấy nguyên liệu cần tìm trong danh sách? Vào <b>⚙️ Settings → 📦 Sản phẩm</b> để khai báo trước — nguyên liệu phải có <b>Mã sản phẩm</b> (bước "khởi tạo") mới hiện được ở đây.</div>
        </div>

        <div class="section-divider"><span>📝 Hướng dẫn pha chế</span></div>

        <div class="form-group full-width">
          <label for="drinkSteps">Các bước pha chế</label>
          <textarea id="drinkSteps" class="tall"
            placeholder="Pha espresso vào ly&#10;Thêm sữa đặc, khuấy đều&#10;Cho đá viên vào ly&#10;Rót sữa tươi từ từ&#10;Thưởng thức ngay"></textarea>
          <div class="hint">Mỗi bước = 1 dòng</div>
        </div>

        <div class="form-group full-width">
          <label for="drinkTips">Mẹo pha chế</label>
          <textarea id="drinkTips"
            placeholder="Nên dùng sữa ở nhiệt độ phòng&#10;Pha espresso đậm hơn bình thường 20%"></textarea>
          <div class="hint">Mỗi mẹo = 1 dòng (có thể để trống)</div>
        </div>

        <div class="section-divider"><span>🖼️ Media</span></div>

        <div class="form-group full-width">
          <label for="drinkImage">URL ảnh minh hoạ</label>
          <input type="text" id="drinkImage" placeholder="https://...">
        </div>
      </div>

      <div class="modal-actions">
        <button class="btn btn-danger"  id="drinkDeleteBtn" style="display:none;">🗑️ Ngừng bán</button>
        <button class="btn btn-primary" id="drinkSaveBtn">💾 Lưu</button>
      </div>
    </div>
  `;
  document.body.appendChild(modal);

  modal.addEventListener("click", e => { if (e.target === modal) modal.classList.add("hidden"); });
  modal.addEventListener("keydown", e => { if (e.key === "Escape") modal.classList.add("hidden"); });
  document.getElementById("closeDrinkModalBtn").addEventListener("click", () => modal.classList.add("hidden"));
  document.getElementById("drinkSaveBtn").addEventListener("click", saveDrink);
  document.getElementById("drinkDeleteBtn").addEventListener("click", deleteDrink);
  document.getElementById("addRecipeRowBtn").addEventListener("click", () => addRecipeRow());

  /* Chọn thành phẩm → điền id vào ô ẩn + tự lấy TÊN đồ uống từ tên thành
     phẩm (thuộc tính data-name của <option>), rồi xoá lỗi/ghi chú cũ. */
  document.getElementById("drinkProductSelect").addEventListener("change", function () {
    const opt = this.selectedOptions[0];
    document.getElementById("drinkProductIngredientId").value = this.value || "";
    if (this.value) {
      document.getElementById("drinkName").value = opt.dataset.name || "";
      window.clearFieldError("drinkProductSelect");
      document.getElementById("drinkLegacyNote").style.display = "none";
    }
  });
})();

/* Nút "+ Thêm công thức" (#addDrinkBtn, trong dashboard.html): ẩn nếu role chỉ xem. */
(function bindAddDrinkBtn() {
  const btn = document.getElementById('addDrinkBtn');
  if (!btn) return;
  if (isDrinksReadOnly) { btn.style.display = 'none'; return; }
  btn.addEventListener('click', openAddDrink);
})();

/* ══════════════════════════════════════════════
   TẢI DỮ LIỆU
   ─────────────────────────────────────────────
   Trình tự: hiện "⏳ Đang tải..." → nạp loại + nguyên liệu (qua
   window.Inventory) → vẽ tab lọc + đổ dropdown Loại → tải đồ uống chưa xoá
   mềm (sắp theo sort_order) → vẽ lưới và cập nhật số "Công thức đồ uống"
   (#totalDrinks) trên Dashboard. Lỗi tải đồ uống hiện chữ đỏ
   "❌ Lỗi: …" trong lưới.
   ══════════════════════════════════════════════ */
async function loadDrinks() {
  const grid = document.getElementById('drinkGrid');
  grid.innerHTML = '<div style="text-align:center;color:var(--text-muted);padding:60px 0;grid-column:1/-1;">⏳ Đang tải...</div>';

  try {
    await Promise.all([INVD.loadCategories(), INVD.loadIngredients()]);
  } catch (err) {
    console.warn('loadDrinks (inventory):', err.message);
  }
  renderDrinkTabs();
  populateDrinkCategorySelect();

  const { data, error } = await client
    .from('drinks')
    .select('*')
    .is('deleted_at', null)
    .order('sort_order', { ascending: true });

  if (error) {
    grid.innerHTML = `<div style="color:var(--danger);padding:32px;grid-column:1/-1;">❌ Lỗi: ${window.escHtml(error.message)}</div>`;
    return;
  }

  allDrinks = data || [];
  renderDrinkGrid();

  const el = document.getElementById('totalDrinks');
  if (el) el.textContent = allDrinks.length;
}

/* ══════════════════════════════════════════════
   TAB LỌC THEO LOẠI
   ─────────────────────────────────────────────
   Không ghi cứng trong HTML: vẽ động từ bảng drink_categories, nên thêm
   loại mới chỉ cần thêm dòng trong DB. Tab "🍹 Tất cả" luôn có sẵn. Nút đang
   chọn dùng btn-primary, còn lại btn-secondary (màu ở dashboard.css). Mỗi
   nút hiển thị "<icon> <tên loại>" (icon lấy từ cột `icon` của loại).
   ══════════════════════════════════════════════ */
function renderDrinkTabs() {
  const wrap = document.getElementById('drinkTabsWrap');
  if (!wrap) return;

  const cats = INVD.state.categories;
  wrap.innerHTML = `
    <button class="btn ${window.activeDrinkFilter === 'all' ? 'btn-primary' : 'btn-secondary'} drink-tab" data-cat="all">🍹 Tất cả</button>
    ${cats.map(c => `
      <button class="btn ${window.activeDrinkFilter === c.name ? 'btn-primary' : 'btn-secondary'} drink-tab" data-cat="${window.escHtml(c.name)}">${c.icon || ''} ${window.escHtml(c.name)}</button>
    `).join('')}
  `;
  wrap.querySelectorAll('.drink-tab').forEach(btn => {
    btn.addEventListener('click', () => window.filterDrinks(btn.dataset.cat, btn));
  });
}

/* Đổi loại đang lọc + đổi màu nút + vẽ lại lưới.
   ⚠️ core/dashboard-nav.js cũng khai báo hàm filterDrinks cùng tên và được
   nạp SAU file này, nên bản đó ghi đè bản dưới đây. Bản dưới đây hiện
   không chạy; muốn sửa cách lọc hãy sửa ở nav (hoặc gộp về 1 nơi). */
window.filterDrinks = function (cat, btnEl) {
  window.activeDrinkFilter = cat;
  document.querySelectorAll('.drink-tab').forEach(b => {
    const active = btnEl ? b === btnEl : b.dataset.cat === cat;
    b.classList.toggle('btn-primary', active);
    b.classList.toggle('btn-secondary', !active);
  });
  renderDrinkGrid();
};

/* Đổ danh sách loại vào dropdown "Loại" của popup (giữ lại lựa chọn hiện tại). */
function populateDrinkCategorySelect() {
  const sel = document.getElementById('drinkCategory');
  if (!sel) return;
  const current = sel.value;
  sel.innerHTML = '<option value="">-- Chọn loại --</option>' +
    INVD.state.categories.map(c => `<option value="${c.id}">${c.icon || ''} ${window.escHtml(c.name)}</option>`).join('');
  if (current) sel.value = current;
}

/* ══════════════════════════════════════════════
   VẼ LƯỚI THẺ ĐỒ UỐNG
   ─────────────────────────────────────────────
   Bố cục lưới (cột tối thiểu 280px, khoảng cách 18px) đặt trong
   admin/dashboard.html (#drinkGrid). Mỗi thẻ (style inline, sửa tại đây):
     · Nền var(--card), viền var(--border), bo theo var(--radius), đổ bóng.
     · Dải màu trên cùng cao 5px = màu của LOẠI đồ uống (cột `color` của
       drink_categories; thiếu thì xám "#888").
     · Ảnh minh hoạ (nếu có) cao 160px; ảnh lỗi thì tự ẩn.
     · Emoji cỡ 24px (mặc định "☕"); tên 15px đậm; tên loại 11px đậm, tô
       màu của loại; mô tả 13px màu var(--text-muted); giá 14px đậm màu
       var(--primary), định dạng kiểu Việt "35.000 đ".
     · Đồ uống ngừng bán: cả thẻ mờ 60% + nhãn "Ngừng bán" (nền #f1f5f9,
       chữ #888).
     · Nút: "✏️ Sửa <tên>" / "👁️ Xem <tên>" (role chỉ xem), chữ 12px.
   Lưới rỗng hiện chữ "Chưa có công thức nào.".
   ══════════════════════════════════════════════ */
function renderDrinkGrid() {
  const grid = document.getElementById('drinkGrid');
  const list = window.activeDrinkFilter === 'all'
    ? allDrinks
    : allDrinks.filter(d => INVD.getCategoryById(d.category_id)?.name === window.activeDrinkFilter);

  if (!list.length) {
    grid.innerHTML = '<div style="text-align:center;color:var(--text-muted);padding:60px 0;grid-column:1/-1;">Chưa có công thức nào.</div>';
    return;
  }

  const actionLabel = isDrinksReadOnly ? '👁️ Xem' : '✏️ Sửa';

  grid.innerHTML = list.map(d => {
    const cat = INVD.getCategoryById(d.category_id);
    const color = cat?.color || '#888';
    return `
      <div style="background:var(--card);border-radius:var(--radius);border:1px solid var(--border);box-shadow:var(--shadow);overflow:hidden;display:flex;flex-direction:column;${!d.is_active ? 'opacity:.6;' : ''}">
        <div style="height:5px;background:${color};"></div>
        ${d.image_url ? `<img src="${window.escHtml(d.image_url)}" alt="Ảnh minh hoạ ${window.escHtml(d.name)}" style="width:100%;height:160px;object-fit:cover;" onerror="this.style.display='none'">` : ''}
        <div style="padding:16px 18px;flex:1;display:flex;flex-direction:column;gap:10px;">
          <div style="display:flex;align-items:center;gap:10px;">
            <span style="font-size:24px;" aria-hidden="true">${d.emoji || '☕'}</span>
            <div>
              <div style="font-weight:700;font-size:15px;color:var(--text);">${window.escHtml(d.name)} ${!d.is_active ? '<span class="badge" style="background:#f1f5f9;color:#888;">Ngừng bán</span>' : ''}</div>
              <div style="font-size:11px;font-weight:600;color:${color};margin-top:2px;">${window.escHtml(cat?.name || '—')}</div>
            </div>
          </div>
          ${d.description ? `<div style="font-size:13px;color:var(--text-muted);line-height:1.5;">${window.escHtml(d.description)}</div>` : ''}
          <div style="font-size:14px;font-weight:700;color:var(--primary);">${Number(d.price || 0).toLocaleString('vi-VN')} đ</div>
        </div>
        <div style="padding:10px 18px;border-top:1px solid var(--border);display:flex;gap:8px;">
          <button class="btn btn-primary" style="font-size:12px;padding:6px 14px;" data-drink-edit="${d.id}">${actionLabel} ${window.escHtml(d.name)}</button>
        </div>
      </div>
    `;
  }).join('');

  grid.querySelectorAll('[data-drink-edit]').forEach(btn => {
    btn.addEventListener('click', () => editDrink(Number(btn.dataset.drinkEdit)));
  });
}

/* ══════════════════════════════════════════════
   CHẾ ĐỘ CHỈ XEM CHO POPUP
   Khoá mọi ô nhập + ẩn nút Lưu/Xoá (logic chung ở
   AdminPermissions.applyReadOnlyForm); khoá thêm nút "+ Thêm nguyên liệu",
   dropdown thành phẩm và các nút ✕ xoá dòng công thức.
   ══════════════════════════════════════════════ */
function setDrinkModalReadOnly(readonly) {
  const modal     = document.getElementById('drinkModal');
  const saveBtn   = document.getElementById('drinkSaveBtn');
  const deleteBtn = document.getElementById('drinkDeleteBtn');
  window.AdminPermissions.applyReadOnlyForm(modal, {
    readonly, saveBtn, deleteBtn,
    extraDisable: [document.getElementById('addRecipeRowBtn'), document.getElementById('drinkProductSelect')],
  });
  modal.querySelectorAll('.recipe-row-remove').forEach(b => b.disabled = readonly);
}

/* ══════════════════════════════════════════════
   DROPDOWN "THÀNH PHẨM" (sản phẩm bán ra)
   ─────────────────────────────────────────────
   Chỉ liệt kê ingredients có is_finished_product = true, còn dùng
   (is_active) và đã có Mã sản phẩm. Ngoại lệ để không mất dữ liệu cũ: mục
   ĐANG được chọn (selectedId) vẫn hiện dù ngừng dùng hoặc thiếu mã.
   Mỗi tuỳ chọn hiển thị "<Mã> — <Tên>"; thiếu mã thêm chữ
   "— ⚠️ CHƯA CÓ MÃ SẢN PHẨM".
   ══════════════════════════════════════════════ */
function finishedProductOptionsHtml(selectedId) {
  const list = INVD.state.ingredients.filter(i =>
    i.is_finished_product && (i.is_active || i.id === selectedId) && (i.code || i.id === selectedId)
  );
  return '<option value="">-- Chọn thành phẩm --</option>' + list.map(i => {
    const warn = !i.code ? ' — ⚠️ CHƯA CÓ MÃ SẢN PHẨM' : '';
    return `<option value="${i.id}" data-name="${window.escHtml(i.name)}" ${i.id === selectedId ? 'selected' : ''}>${window.escHtml(i.code || '?')} — ${window.escHtml(i.name)}${warn}</option>`;
  }).join('');
}

/* ══════════════════════════════════════════════
   RECIPE BUILDER — các dòng công thức (drink_ingredients)
   ─────────────────────────────────────────────
   Mỗi dòng gồm: [nguyên liệu] [số lượng/ly] [đơn vị] [hệ số quy đổi] [✕].
   Giá thành 1 ly = Σ (số lượng × hệ số × giá đơn vị của nguyên liệu) —
   công thức nằm ở Inventory.computeRecipeCost().

   Dropdown nguyên liệu: chỉ hiện nguyên liệu còn dùng, KHÔNG phải thành
   phẩm, và đã có Mã (mục đang chọn sẵn vẫn hiện dù thiếu mã). Mỗi tuỳ chọn
   hiển thị "Tên (đơn vị — giá đ[ · 1 đơn vị = N đơn-vị-đóng-gói])".
   ══════════════════════════════════════════════ */
function ingredientOptionsHtml(selectedId) {
  const active = INVD.state.ingredients.filter(i =>
    i.is_active && !i.is_finished_product && (i.code || i.id === selectedId)
  );
  return '<option value="">-- Chọn nguyên liệu --</option>' + active.map(i => {
    const pkg = i.package_unit
      ? ` · 1 ${window.escHtml(i.unit)} = ${Number(i.package_qty).toLocaleString('vi-VN')}${window.escHtml(i.package_unit)}`
      : '';
    const warn = !i.code ? ' — ⚠️ CHƯA CÓ MÃ SẢN PHẨM' : '';
    return `<option value="${i.id}" ${i.id === selectedId ? 'selected' : ''}>${window.escHtml(i.name)} (${window.escHtml(i.unit)} — ${Number(i.unit_cost).toLocaleString('vi-VN')}đ${pkg})${warn}</option>`;
  }).join('');
}

/* Thêm 1 dòng công thức vào popup. Bố cục ghi cứng:
     · Lưới 5 cột `2fr 1fr 1fr 0.8fr auto`, khoảng cách 8px.
     · Ô chọn/ô nhập cao 40px, bo 8px, chữ 13px, viền var(--border).
     · Nút ✕ xoá dòng 36×36px.
     · Placeholder: "Số lượng/ly", "Đơn vị", "Hệ số"; hệ số mặc định 1.
   Trên điện thoại (≤640px) lưới này được sắp lại thành nhiều hàng bởi
   dashboard-mobile.css (class `.recipe-row`).

   TỰ ĐIỀN khi đổi nguyên liệu (vẫn sửa tay được):
     · Đơn vị (nếu đang trống): lấy đơn vị đóng gói (package_unit) hoặc đơn vị tính.
     · Hệ số (nếu đang trống hoặc bằng 1) và nguyên liệu có quy đổi đóng gói:
       hệ số = 1 / package_qty (vd 1 Hộp = 500 g → 0.002 cho công thức tính theo g).
   Thông tin quy đổi khai báo ở ⚙️ Settings → 📦 Sản phẩm. Công thức tính giá
   thành KHÔNG đổi — chỉ điền sẵn giá trị đúng. */
function addRecipeRow(row = {}) {
  const wrap = document.getElementById('drinkRecipeRows');
  const rowId = 'rr' + (++recipeRowSeq);
  const div = document.createElement('div');
  div.className = 'recipe-row';
  div.dataset.rowId = rowId;
  div.style.cssText = 'display:grid;grid-template-columns:2fr 1fr 1fr 0.8fr auto;gap:8px;align-items:center;';
  div.innerHTML = `
    <select class="recipe-ingredient" style="height:40px;border:1px solid var(--border);border-radius:8px;padding:0 8px;font-size:13px;">
      ${ingredientOptionsHtml(row.ingredient_id)}
    </select>
    <input type="number" class="recipe-qty" placeholder="Số lượng/ly" min="0" step="0.01" value="${row.qty_per_serving ?? ''}" style="height:40px;border:1px solid var(--border);border-radius:8px;padding:0 8px;font-size:13px;">
    <input type="text" class="recipe-unit" placeholder="Đơn vị" value="${window.escHtml(row.unit || '')}" style="height:40px;border:1px solid var(--border);border-radius:8px;padding:0 8px;font-size:13px;">
    <input type="number" class="recipe-rate" placeholder="Hệ số" min="0" step="0.000001" value="${row.conversion_rate ?? 1}" title="Hệ số quy đổi về đơn vị tính của sản phẩm — tự điền theo quy đổi đóng gói khai báo ở Settings → 📦 Sản phẩm (VD: 1 Hộp=500g → 0.002 cho công thức tính theo g), vẫn sửa tay được." style="height:40px;border:1px solid var(--border);border-radius:8px;padding:0 8px;font-size:13px;">
    <button type="button" class="close-btn recipe-row-remove" title="Xoá dòng" style="width:36px;height:36px;">✕</button>
  `;
  wrap.appendChild(div);

  const ingSelect = div.querySelector('.recipe-ingredient');
  const unitInput = div.querySelector('.recipe-unit');
  const rateInput = div.querySelector('.recipe-rate');
  ingSelect.addEventListener('change', () => {
    const ing = INVD.getIngredientById(Number(ingSelect.value));
    if (ing) {
      if (!unitInput.value) {
        unitInput.value = ing.package_unit || ing.unit;
      }
      if ((!rateInput.value || Number(rateInput.value) === 1) && ing.package_unit && Number(ing.package_qty) > 0) {
        rateInput.value = round6(1 / Number(ing.package_qty));
      }
    }
    updateDrinkCostPreview();
  });
  div.querySelectorAll('.recipe-qty, .recipe-rate').forEach(inp => inp.addEventListener('input', updateDrinkCostPreview));
  div.querySelector('.recipe-row-remove').addEventListener('click', () => { div.remove(); updateDrinkCostPreview(); });

  updateDrinkCostPreview();
}

/* Đọc các dòng công thức đang có trên popup. Bỏ dòng chưa chọn nguyên liệu
   hoặc số lượng ≤ 0; hệ số rỗng/0 được coi là 1. */
function readRecipeRows() {
  return [...document.querySelectorAll('#drinkRecipeRows .recipe-row')].map(div => ({
    ingredient_id: Number(div.querySelector('.recipe-ingredient').value) || null,
    qty_per_serving: Number(div.querySelector('.recipe-qty').value) || 0,
    unit: div.querySelector('.recipe-unit').value.trim(),
    conversion_rate: Number(div.querySelector('.recipe-rate').value) || 1,
  })).filter(r => r.ingredient_id && r.qty_per_serving > 0);
}

/* Cập nhật khung "💰 Giá thành ước tính / ly" và dòng lợi nhuận bên dưới:
   "Lợi nhuận gộp ước tính: X đ / ly (~Y%)". Chữ chuyển sang màu
   var(--danger) khi lợi nhuận âm. Chỉ hiện dòng lợi nhuận khi đã nhập giá bán. */
function updateDrinkCostPreview() {
  const rows = readRecipeRows();
  const cost = INVD.computeRecipeCost(rows);
  document.getElementById('drinkCostPreview').textContent = Math.round(cost).toLocaleString('vi-VN') + ' đ';

  const price = Number(document.getElementById('drinkPrice').value) || 0;
  const profitEl = document.getElementById('drinkProfitPreview');
  if (price > 0) {
    const profit = price - cost;
    const marginPct = price ? Math.round((profit / price) * 100) : 0;
    profitEl.textContent = `Lợi nhuận gộp ước tính: ${Math.round(profit).toLocaleString('vi-VN')} đ / ly (~${marginPct}%)`;
    profitEl.style.color = profit < 0 ? 'var(--danger)' : 'var(--text-muted)';
  } else {
    profitEl.textContent = '';
  }
}

function clearRecipeRows() {
  document.getElementById('drinkRecipeRows').innerHTML = '';
  recipeRowSeq = 0;
}

/* ══════════════════════════════════════════════
   MỞ POPUP THÊM MỚI
   Đặt lại mọi ô, thêm sẵn 1 dòng công thức trống, dropdown thành phẩm
   đổ lại danh sách, ẩn nút Xoá (dataset.wasVisible="0"), rồi focus vào
   ô chọn thành phẩm.
   ══════════════════════════════════════════════ */
function openAddDrink() {
  if (isDrinksReadOnly) return;

  document.getElementById('drinkId').value   = '';
  document.getElementById('drinkProductIngredientId').value = '';
  document.getElementById('drinkName').value = '';
  document.getElementById('drinkProductSelect').innerHTML = finishedProductOptionsHtml();
  document.getElementById('drinkLegacyNote').style.display = 'none';
  window.clearFieldError('drinkProductSelect');

  document.getElementById('drinkCategory').value = '';
  document.getElementById('drinkEmoji').value = '';
  document.getElementById('drinkPrice').value = '';
  document.getElementById('drinkSort').value  = '';
  document.getElementById('drinkIsActive').checked = true;
  document.getElementById('drinkDesc').value  = '';
  document.getElementById('drinkSteps').value = '';
  document.getElementById('drinkTips').value  = '';
  document.getElementById('drinkImage').value = '';
  clearRecipeRows();
  addRecipeRow();
  updateDrinkCostPreview();

  document.getElementById('drinkModalTitle').textContent = 'Thêm công thức';
  document.getElementById('drinkDeleteBtn').style.display = 'none';
  document.getElementById('drinkDeleteBtn').dataset.wasVisible = '0';
  setDrinkModalReadOnly(false);
  document.getElementById('drinkModal').classList.remove('hidden');
  document.getElementById('drinkProductSelect').focus();
}

/* ══════════════════════════════════════════════
   MỞ POPUP ĐỂ SỬA / XEM
   Nạp thông tin đồ uống, rồi tải các dòng công thức từ drink_ingredients
   (không có dòng nào hoặc lỗi → thêm 1 dòng trống). Đồ uống cũ chưa liên
   kết thành phẩm: hiện ghi chú đỏ (#drinkLegacyNote) nhắc chọn thành phẩm
   để liên kết chính thức (sẽ đổi tên theo mã đã khai báo), hoặc bỏ qua để
   giữ nguyên như cũ.
   ══════════════════════════════════════════════ */
async function editDrink(id) {
  const d = allDrinks.find(x => x.id === id);
  if (!d) return;
  document.getElementById('drinkId').value        = d.id;

  document.getElementById('drinkProductIngredientId').value = d.product_ingredient_id || '';
  document.getElementById('drinkProductSelect').innerHTML = finishedProductOptionsHtml(d.product_ingredient_id);
  document.getElementById('drinkName').value = d.name || '';
  window.clearFieldError('drinkProductSelect');

  const legacyNote = document.getElementById('drinkLegacyNote');
  if (!d.product_ingredient_id) {
    legacyNote.style.display = 'block';
    legacyNote.textContent = `⚠️ Đồ uống này được tạo trước khi có tính năng liên kết mã sản phẩm — tên hiện tại: "${d.name}". Chọn 1 thành phẩm ở trên để liên kết chính thức (sẽ đổi tên theo đúng mã đã khai báo), hoặc bỏ qua để giữ nguyên như cũ.`;
  } else {
    legacyNote.style.display = 'none';
  }

  document.getElementById('drinkCategory').value  = d.category_id || '';
  document.getElementById('drinkEmoji').value     = d.emoji || '';
  document.getElementById('drinkPrice').value     = d.price ?? '';
  document.getElementById('drinkSort').value      = d.sort_order ?? '';
  document.getElementById('drinkIsActive').checked = d.is_active !== false;
  document.getElementById('drinkDesc').value      = d.description || '';
  document.getElementById('drinkSteps').value     = Array.isArray(d.steps) ? d.steps.join('\n') : '';
  document.getElementById('drinkTips').value      = Array.isArray(d.tips) ? d.tips.join('\n') : '';
  document.getElementById('drinkImage').value     = d.image_url || '';

  clearRecipeRows();
  try {
    const { data: rows, error } = await client
      .from('drink_ingredients').select('*').eq('drink_id', id);
    if (error) throw error;
    (rows || []).forEach(r => addRecipeRow(r));
    if (!rows?.length) addRecipeRow();
  } catch (err) {
    console.warn('editDrink (recipe):', err.message);
    addRecipeRow();
  }
  updateDrinkCostPreview();

  document.getElementById('drinkModalTitle').textContent = isDrinksReadOnly
    ? '👁️ Xem chi tiết công thức'
    : '✏️ Chỉnh sửa công thức';

  const delBtn = document.getElementById('drinkDeleteBtn');
  delBtn.dataset.wasVisible = '1';
  delBtn.style.display = 'inline-flex';

  setDrinkModalReadOnly(isDrinksReadOnly);
  document.getElementById('drinkModal').classList.remove('hidden');
}

/* Tách textarea nhiều dòng thành mảng (mỗi dòng 1 phần tử, bỏ dòng trống). */
function parseDrinkLines(id) {
  return (document.getElementById(id)?.value || '').split('\n').map(s => s.trim()).filter(Boolean);
}

/* ══════════════════════════════════════════════
   LƯU CÔNG THỨC
   ─────────────────────────────────────────────
   Bước kiểm tra (báo lỗi tại ô, chữ đỏ):
     - Tạo mới mà chưa chọn thành phẩm → "Vui lòng chọn thành phẩm trước khi tạo công thức."
     - Không xác định được tên      → "Không xác định được tên — chọn lại thành phẩm."
     - Chưa chọn loại               → "Vui lòng chọn loại đồ uống."
     - Giá bán ≤ 0 / trống          → "Vui lòng nhập giá bán hợp lệ."
   Giá trị mặc định khi để trống: emoji "☕"; sort_order rỗng → null.
   Trình tự lưu: cập nhật/chèn `drinks` → xoá hết dòng cũ của
   drink_ingredients theo drink_id → chèn lại các dòng công thức mới.
   (Xem cảnh báo "không nằm trong 1 giao dịch" ở đầu file.)
   Ghi nhận người thao tác: updated_by (luôn), created_by (khi tạo mới) =
   tên hiển thị của tài khoản đăng nhập.
   Thông báo: "✅ Đã lưu công thức!" (xanh mặc định); lỗi nền #e17055.
   ══════════════════════════════════════════════ */
async function saveDrink() {
  if (isDrinksReadOnly) return;

  const rawId = document.getElementById('drinkId').value;
  const id    = rawId ? Number(rawId) : null;

  const name = document.getElementById('drinkName').value.trim();
  const productIngredientId = Number(document.getElementById('drinkProductIngredientId').value) || null;
  const isNewDrink = !id;

  if (isNewDrink && !productIngredientId) {
    window.showFieldError('drinkProductSelect', 'Vui lòng chọn thành phẩm trước khi tạo công thức.', { fullWidth: true });
    return;
  }
  if (!name) {
    window.showFieldError('drinkProductSelect', 'Không xác định được tên — chọn lại thành phẩm.', { fullWidth: true });
    return;
  }
  window.clearFieldError('drinkProductSelect');

  const categoryId = Number(document.getElementById('drinkCategory').value) || null;
  const price = Number(document.getElementById('drinkPrice').value);

  if (!categoryId) { window.showFieldError('drinkCategory', 'Vui lòng chọn loại đồ uống.', { fullWidth: true }); return; }
  window.clearFieldError('drinkCategory');
  if (!price || price <= 0) { window.showFieldError('drinkPrice', 'Vui lòng nhập giá bán hợp lệ.', { fullWidth: true }); return; }
  window.clearFieldError('drinkPrice');

  const recipeRows = readRecipeRows();

  const payload = {
    name,
    product_ingredient_id: productIngredientId,
    category_id: categoryId,
    emoji:       document.getElementById('drinkEmoji').value.trim() || '☕',
    price,
    is_active:   document.getElementById('drinkIsActive').checked,
    description: document.getElementById('drinkDesc').value.trim(),
    steps:       parseDrinkLines('drinkSteps'),
    tips:        parseDrinkLines('drinkTips'),
    image_url:   document.getElementById('drinkImage').value.trim(),
    sort_order:  Number(document.getElementById('drinkSort').value) || null,
    updated_by:  currentSession.displayName || currentSession.username,
  };

  const saveBtn = document.getElementById('drinkSaveBtn');
  saveBtn.disabled = true;
  const origText = saveBtn.textContent;
  saveBtn.textContent = 'Đang lưu...';

  try {
    let drinkId = id;
    if (id) {
      const { data, error } = await client.from('drinks').update(payload).eq('id', id).select();
      if (error) throw error;
      if (data?.[0]) { const idx = allDrinks.findIndex(d => d.id === id); if (idx !== -1) allDrinks[idx] = data[0]; }
    } else {
      const { data, error } = await client.from('drinks')
        .insert({ ...payload, created_by: currentSession.displayName || currentSession.username })
        .select();
      if (error) throw error;
      drinkId = data?.[0]?.id;
      if (data?.[0]) allDrinks.push(data[0]);
    }
    allDrinks.sort((a, b) => (a.sort_order ?? 0) - (b.sort_order ?? 0));

    if (drinkId) {
      const { error: delErr } = await client.from('drink_ingredients').delete().eq('drink_id', drinkId);
      if (delErr) throw delErr;
      if (recipeRows.length) {
        const { error: insErr } = await client.from('drink_ingredients').insert(
          recipeRows.map(r => ({ ...r, drink_id: drinkId }))
        );
        if (insErr) throw insErr;
      }
    }

    document.getElementById('drinkModal').classList.add('hidden');
    renderDrinkGrid();
    const totalEl = document.getElementById('totalDrinks');
    if (totalEl) totalEl.textContent = allDrinks.length;
    window.showToast('✅ Đã lưu công thức!');
  } catch (err) {
    window.showToast('❌ Lỗi: ' + err.message, '#e17055');
  } finally {
    saveBtn.disabled = false;
    saveBtn.textContent = origText;
  }
}

/* ══════════════════════════════════════════════
   NGỪNG BÁN (XOÁ MỀM)
   Bắt buộc nhập lý do (hộp thoại window.showReasonPrompt). Ghi
   deleted_at, is_active=false, deleted_reason, deleted_by; bỏ đồ uống
   khỏi mảng `allDrinks` rồi vẽ lại lưới. Toast "🗑️ Đã ngừng bán công thức"
   nền #e17055 (đỏ cam).
   ══════════════════════════════════════════════ */
async function deleteDrink() {
  if (isDrinksReadOnly) return;

  const id = document.getElementById('drinkId').value;
  if (!id) return;

  const name = document.getElementById('drinkName').value || 'công thức này';

  const reason = await window.showReasonPrompt({
    title: `Ngừng bán "${name}"?`,
    message: 'Đồ uống sẽ bị ẩn khỏi danh sách bán nhưng vẫn giữ lại lịch sử đơn hàng đã bán trước đó.',
    reasonLabel: 'Lý do ngừng bán *',
    reasonPlaceholder: 'VD: hết nguyên liệu lâu dài, không còn bán món này...',
    confirmText: '🗑️ Ngừng bán',
    cancelText: 'Hủy',
  });
  if (reason === null) return;

  try {
    const { error } = await client.from('drinks')
      .update({
        deleted_at: new Date().toISOString(), is_active: false,
        deleted_reason: reason, deleted_by: currentSession.displayName || currentSession.username,
      }).eq('id', id);
    if (error) throw error;

    allDrinks = allDrinks.filter(d => String(d.id) !== String(id));

    document.getElementById('drinkModal').classList.add('hidden');
    renderDrinkGrid();
    const totalEl = document.getElementById('totalDrinks');
    if (totalEl) totalEl.textContent = allDrinks.length;
    window.showToast('🗑️ Đã ngừng bán công thức', '#e17055');
  } catch (err) {
    window.showToast('❌ Lỗi: ' + err.message, '#e17055');
  }
}

/* Xuất ra window cho module khác gọi:
   nav (loadDrinks/renderDrinkGrid), Settings → tab Công thức (editDrink). */
window.loadDrinks      = loadDrinks;
window.renderDrinkGrid = renderDrinkGrid;
window.openAddDrink    = openAddDrink;
window.editDrink       = editDrink;
window.saveDrink       = saveDrink;
window.deleteDrink     = deleteDrink;
