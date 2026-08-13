/* ══════════════════════════════════════════════
   DASHBOARD DRINKS MODULE — admin/modules/drinks/dashboard-drinks.js
   ─────────────────────────────────────────────
   ⚠️ VIẾT LẠI THEO SCHEMA SQL V1 (2026-07-16):
   - `category` (text tự do) → `category_id` (FK → drink_categories).
   - Thêm `price` (giá bán) — bắt buộc, dùng snapshot khi tạo đơn hàng.
   - Thêm `is_active`.
   - `ingredients` (textarea tự do) → `drink_ingredients` (recipe builder
     thật) — chọn nguyên liệu có sẵn trong kho + số lượng/ly, preview
     giá thành 1 ly trực tiếp trong modal (INV.computeRecipeCost).
   - Xoá đồ uống = SOFT DELETE (`deleted_at` + `is_active=false`).

   ⚠️ DEDUPE: clearDrinkFieldError/showDrinkFieldError cục bộ đã bị
   xoá — dùng thẳng window.clearFieldError/window.showFieldError
   (js/shared-utils.js) với opts.fullWidth vì #drinkModal cũng dùng
   .form-grid 2 cột giống #gameModal (trước đây bản cũ KHÔNG có
   grid-column:1/-1 nên lỗi bị bó hẹp 1 cột — nay đã khớp behaviour
   với dashboard-games.js).

   ⚠️ MỚI (đồng bộ với Settings → 📦 Sản phẩm): đã KIỂM TRA LẠI logic
   tính giá thành hiện có — computeRecipeCost() = qty_per_serving ×
   conversion_rate × unit_cost là ĐÚNG và tương thích ngay với 2 cột
   package_qty/package_unit mới thêm ở `ingredients` (VD: 1 Hộp =
   500g, unit_cost = giá/Hộp → conversion_rate = 1/500 quy đổi đúng
   sang giá/gam). KHÔNG đổi công thức — chỉ cải thiện addRecipeRow():
   khi chọn nguyên liệu có khai báo quy đổi đóng gói, tự điền sẵn
   "Đơn vị" = đơn vị đóng gói (VD "g") + "Hệ số" = 1/package_qty
   (VD 0.002) thay vì phải tính tay; vẫn sửa tay lại được bình thường.
   ingredientOptionsHtml() cũng hiện thêm quy đổi đóng gói (nếu có)
   ngay trong dropdown để dễ đối chiếu lúc chọn.

   ⚠️ MỚI (2026-08-12 — "khởi tạo mã sản phẩm" là bước bắt buộc trước
   khi có công thức, đồng bộ với admin/modules/settings/dashboard-
   settings.js và admin/modules/inventory/dashboard-ingredients.js):
   ingredientOptionsHtml() giờ CHỈ liệt kê nguyên liệu ĐÃ có Mã sản
   phẩm (`ingredient.code`) — nguyên liệu chưa "khởi tạo mã" sẽ không
   chọn được vào công thức. Có đúng 1 ngoại lệ: nguyên liệu ĐANG được
   chọn sẵn ở dòng công thức đó (dữ liệu công thức cũ, lưu từ trước
   khi yêu cầu này có hiệu lực) — vẫn hiện để không làm mất/ẩn lựa
   chọn đã lưu, nhưng có đánh dấu cảnh báo ngay trong tên option để
   admin biết cần bổ sung mã cho nguyên liệu đó.

   Cần: `client`, `currentSession`, window.AdminPermissions,
   window.Inventory (inventory-shared.js — PHẢI load TRƯỚC file này),
   window.showConfirm/showToast (shared-utils.js).
   ══════════════════════════════════════════════ */

window.activeDrinkFilter = 'all';
let allDrinks = [];
let recipeRowSeq = 0; // id tạm cho mỗi dòng recipe trong modal (chưa lưu DB)

const isDrinksReadOnly = window.AdminPermissions.isReadOnly(currentSession.role);
const INVD = window.Inventory;

/* ⚠️ MỚI: làm tròn 6 chữ số cho hệ số quy đổi tự điền (1/500=0.002,
   1/300=0.003333...) — tránh số thập phân dài vô ích, vẫn sửa tay
   được bình thường nếu cần chính xác hơn. */
function round6(n) { return Math.round(n * 1e6) / 1e6; }

/* ══════════════════════════════════════════════
   INJECT MODAL HTML — 1 lần duy nhất lúc file load
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

      <div class="form-grid">
        <div class="section-divider"><span>📋 Thông tin cơ bản</span></div>

        <div class="form-group">
          <label for="drinkName">Tên đồ uống *</label>
          <input type="text" id="drinkName" placeholder="Cà phê sữa đá, Trà đào...">
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
})();

/* ── Ẩn nút "+ Thêm công thức" nếu chỉ được xem ── */
(function bindAddDrinkBtn() {
  const btn = document.getElementById('addDrinkBtn');
  if (!btn) return;
  if (isDrinksReadOnly) { btn.style.display = 'none'; return; }
  btn.addEventListener('click', openAddDrink);
})();

/* ══════════════════════════════════════════════
   LOAD — đồ uống + (đảm bảo) danh mục/nguyên liệu đã có sẵn
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
   TAB LỌC — render động từ drink_categories (thay hard-code cũ)
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

/* Tương thích: dashboard-nav.js gọi showDrinks(cat) → filterDrinks giữ API cũ */
window.filterDrinks = function (cat, btnEl) {
  window.activeDrinkFilter = cat;
  document.querySelectorAll('.drink-tab').forEach(b => {
    const active = btnEl ? b === btnEl : b.dataset.cat === cat;
    b.classList.toggle('btn-primary', active);
    b.classList.toggle('btn-secondary', !active);
  });
  renderDrinkGrid();
};

function populateDrinkCategorySelect() {
  const sel = document.getElementById('drinkCategory');
  if (!sel) return;
  const current = sel.value;
  sel.innerHTML = '<option value="">-- Chọn loại --</option>' +
    INVD.state.categories.map(c => `<option value="${c.id}">${c.icon || ''} ${window.escHtml(c.name)}</option>`).join('');
  if (current) sel.value = current;
}

/* ══════════════════════════════════════════════
   RENDER GRID
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
   READ-ONLY MODE cho modal
   ══════════════════════════════════════════════ */
function setDrinkModalReadOnly(readonly) {
  const modal     = document.getElementById('drinkModal');
  const saveBtn   = document.getElementById('drinkSaveBtn');
  const deleteBtn = document.getElementById('drinkDeleteBtn');
  window.AdminPermissions.applyReadOnlyForm(modal, {
    readonly, saveBtn, deleteBtn,
    extraDisable: [document.getElementById('addRecipeRowBtn')],
  });
  modal.querySelectorAll('.recipe-row-remove').forEach(b => b.disabled = readonly);
}

/* ══════════════════════════════════════════════
   RECIPE BUILDER — dòng công thức (drink_ingredients)
   ══════════════════════════════════════════════ */
function ingredientOptionsHtml(selectedId) {
  /* ⚠️ MỚI (2026-08-12): chỉ liệt kê nguyên liệu ĐÃ có Mã sản phẩm
     (đã "khởi tạo" tại Settings → 📦 Sản phẩm hoặc Kho nguyên liệu).
     Ngoại lệ DUY NHẤT: nguyên liệu đang được chọn sẵn ở dòng này
     (selectedId, dữ liệu công thức cũ) — vẫn hiện để không làm mất/
     ẩn lựa chọn đã lưu trước đây dù nó thiếu mã, nhưng đánh dấu cảnh
     báo ngay trong tên để admin biết cần bổ sung mã. */
  const active = INVD.state.ingredients.filter(i => i.is_active && (i.code || i.id === selectedId));
  return '<option value="">-- Chọn nguyên liệu --</option>' + active.map(i => {
    const pkg = i.package_unit
      ? ` · 1 ${window.escHtml(i.unit)} = ${Number(i.package_qty).toLocaleString('vi-VN')}${window.escHtml(i.package_unit)}`
      : '';
    const warn = !i.code ? ' — ⚠️ CHƯA CÓ MÃ SẢN PHẨM' : '';
    return `<option value="${i.id}" ${i.id === selectedId ? 'selected' : ''}>${window.escHtml(i.name)} (${window.escHtml(i.unit)} — ${Number(i.unit_cost).toLocaleString('vi-VN')}đ${pkg})${warn}</option>`;
  }).join('');
}

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
      /* ⚠️ MỚI: nếu sản phẩm có khai báo quy đổi đóng gói (Settings →
         📦 Sản phẩm, VD "1 Hộp = 500 g") → tự điền đơn vị công thức +
         hệ số quy đổi theo đúng tỷ lệ đó, thay vì mặc định điền đơn vị
         TÍNH (Hộp) như trước — vì công thức luôn cần viết theo đơn vị
         nhỏ (g/ml), không phải đơn vị đóng gói lớn. KHÔNG đổi công
         thức tính giá thành (qty × rate × unit_cost) — chỉ tự điền
         sẵn giá trị đúng để đỡ phải tính tay. Vẫn sửa tay được sau đó. */
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

function readRecipeRows() {
  return [...document.querySelectorAll('#drinkRecipeRows .recipe-row')].map(div => ({
    ingredient_id: Number(div.querySelector('.recipe-ingredient').value) || null,
    qty_per_serving: Number(div.querySelector('.recipe-qty').value) || 0,
    unit: div.querySelector('.recipe-unit').value.trim(),
    conversion_rate: Number(div.querySelector('.recipe-rate').value) || 1,
  })).filter(r => r.ingredient_id && r.qty_per_serving > 0);
}

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
   OPEN ADD / EDIT
   ══════════════════════════════════════════════ */
function openAddDrink() {
  if (isDrinksReadOnly) return;

  document.getElementById('drinkId').value   = '';
  document.getElementById('drinkName').value = '';
  document.getElementById('drinkCategory').value = '';
  document.getElementById('drinkEmoji').value = '';
  document.getElementById('drinkPrice').value = '';
  document.getElementById('drinkSort').value  = '';
  document.getElementById('drinkIsActive').checked = true;
  document.getElementById('drinkDesc').value  = '';
  document.getElementById('drinkSteps').value = '';
  document.getElementById('drinkTips').value  = '';
  document.getElementById('drinkImage').value = '';
  window.clearFieldError('drinkName');
  clearRecipeRows();
  addRecipeRow();
  updateDrinkCostPreview();

  document.getElementById('drinkModalTitle').textContent = 'Thêm công thức';
  document.getElementById('drinkDeleteBtn').style.display = 'none';
  document.getElementById('drinkDeleteBtn').dataset.wasVisible = '0';
  setDrinkModalReadOnly(false);
  document.getElementById('drinkModal').classList.remove('hidden');
  document.getElementById('drinkName').focus();
}

async function editDrink(id) {
  const d = allDrinks.find(x => x.id === id);
  if (!d) return;
  document.getElementById('drinkId').value        = d.id;
  document.getElementById('drinkName').value      = d.name || '';
  document.getElementById('drinkCategory').value  = d.category_id || '';
  document.getElementById('drinkEmoji').value     = d.emoji || '';
  document.getElementById('drinkPrice').value     = d.price ?? '';
  document.getElementById('drinkSort').value      = d.sort_order ?? '';
  document.getElementById('drinkIsActive').checked = d.is_active !== false;
  document.getElementById('drinkDesc').value      = d.description || '';
  document.getElementById('drinkSteps').value     = Array.isArray(d.steps) ? d.steps.join('\n') : '';
  document.getElementById('drinkTips').value      = Array.isArray(d.tips) ? d.tips.join('\n') : '';
  document.getElementById('drinkImage').value     = d.image_url || '';
  window.clearFieldError('drinkName');

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

function parseDrinkLines(id) {
  return (document.getElementById(id)?.value || '').split('\n').map(s => s.trim()).filter(Boolean);
}

/* ══════════════════════════════════════════════
   SAVE — upsert `drinks` rồi đồng bộ lại toàn bộ `drink_ingredients`
   ══════════════════════════════════════════════ */
async function saveDrink() {
  if (isDrinksReadOnly) return;

  const rawId = document.getElementById('drinkId').value;
  const id    = rawId ? Number(rawId) : null;
  const name  = document.getElementById('drinkName').value.trim();
  const categoryId = Number(document.getElementById('drinkCategory').value) || null;
  const price = Number(document.getElementById('drinkPrice').value);

  if (!name) { window.showFieldError('drinkName', 'Vui lòng nhập tên đồ uống.', { fullWidth: true }); return; }
  window.clearFieldError('drinkName');
  if (!categoryId) { window.showFieldError('drinkCategory', 'Vui lòng chọn loại đồ uống.', { fullWidth: true }); return; }
  window.clearFieldError('drinkCategory');
  if (!price || price <= 0) { window.showFieldError('drinkPrice', 'Vui lòng nhập giá bán hợp lệ.', { fullWidth: true }); return; }
  window.clearFieldError('drinkPrice');

  const recipeRows = readRecipeRows();

  const payload = {
    name,
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
   DELETE — SOFT DELETE
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

/* Expose cho nav.js / dashboard-customers.js (chọn đồ uống khi tạo đơn)
   / dashboard-settings.js (tab 🧪 Công thức — mở đúng modal này) */
window.loadDrinks      = loadDrinks;
window.renderDrinkGrid = renderDrinkGrid;
window.openAddDrink    = openAddDrink;
window.editDrink       = editDrink;
window.saveDrink       = saveDrink;
window.deleteDrink     = deleteDrink;
