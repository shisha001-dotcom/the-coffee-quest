/* ══════════════════════════════════════════════
   DASHBOARD DRINKS MODULE — admin/modules/drinks/dashboard-drinks.js
   ─────────────────────────────────────────────
   ⚠️ TỐI ƯU (bổ sung so với bản trước):
   - saveDrink()/deleteDrink(): PATCH trực tiếp mảng `allDrinks` từ
     dữ liệu Supabase trả về (.select()), thay vì loadDrinks() gọi
     lại toàn bảng mỗi lần lưu/xoá 1 công thức.

   Cần: `client`, `currentSession`, window.AdminPermissions,
   window.showConfirm/showToast (shared-utils.js).
   ══════════════════════════════════════════════ */

window.activeDrinkFilter = 'all';
let allDrinks = [];

const isDrinksReadOnly = window.AdminPermissions.isReadOnly(currentSession.role);

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
          <select id="drinkCategory">
            <option value="">-- Chọn loại --</option>
            <option value="Cà phê">☕ Cà phê</option>
            <option value="Trà hoa quả">🍓 Trà hoa quả</option>
            <option value="Trà sữa">🧋 Trà sữa</option>
            <option value="Sữa chua">🥛 Sữa chua</option>
          </select>
        </div>

        <div class="form-group">
          <label for="drinkEmoji">Emoji</label>
          <input type="text" id="drinkEmoji" placeholder="☕" maxlength="4">
        </div>

        <div class="form-group">
          <label for="drinkSort">Thứ tự hiển thị</label>
          <input type="number" id="drinkSort" placeholder="1, 2, 3...">
        </div>

        <div class="form-group full-width">
          <label for="drinkDesc">Mô tả ngắn</label>
          <input type="text" id="drinkDesc" placeholder="Thức uống đặc trưng của quán...">
        </div>

        <div class="section-divider"><span>🧪 Công thức</span></div>

        <div class="form-group full-width">
          <label for="drinkIngredients">Nguyên liệu</label>
          <textarea id="drinkIngredients" class="tall"
            placeholder="20ml espresso&#10;150ml sữa tươi&#10;30ml sữa đặc&#10;Đá viên vừa đủ"></textarea>
          <div class="hint">Mỗi nguyên liệu = 1 dòng</div>
        </div>

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
        <button class="btn btn-danger"  id="drinkDeleteBtn" style="display:none;">🗑️ Xóa</button>
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
})();

/* ── Ẩn nút "+ Thêm công thức" nếu chỉ được xem + gắn sự kiện thay onclick inline ── */
(function bindAddDrinkBtn() {
  const btn = document.getElementById('addDrinkBtn');
  if (!btn) return;
  if (isDrinksReadOnly) { btn.style.display = 'none'; return; }
  btn.addEventListener('click', openAddDrink);
})();

async function loadDrinks() {
  const grid = document.getElementById('drinkGrid');
  grid.innerHTML = '<div style="text-align:center;color:var(--text-muted);padding:60px 0;grid-column:1/-1;">⏳ Đang tải...</div>';

  const { data, error } = await client
    .from('drinks')
    .select('*')
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

function renderDrinkGrid() {
  const grid = document.getElementById('drinkGrid');
  const list = window.activeDrinkFilter === 'all'
    ? allDrinks
    : allDrinks.filter(d => d.category === window.activeDrinkFilter);

  if (!list.length) {
    grid.innerHTML = '<div style="text-align:center;color:var(--text-muted);padding:60px 0;grid-column:1/-1;">Chưa có công thức nào.</div>';
    return;
  }

  const catColor = {
    'Cà phê':      '#6f4e37',
    'Trà hoa quả': '#e17055',
    'Trà sữa':     '#6c5ce7',
    'Sữa chua':    '#00b894',
  };

  const actionLabel = isDrinksReadOnly ? '👁️ Xem' : '✏️ Sửa';

  grid.innerHTML = list.map(d => {
    const color = catColor[d.category] || '#888';
    const ing   = Array.isArray(d.ingredients) ? d.ingredients : [];
    return `
      <div style="background:var(--card);border-radius:var(--radius);border:1px solid var(--border);box-shadow:var(--shadow);overflow:hidden;display:flex;flex-direction:column;">
        <div style="height:5px;background:${color};"></div>
        ${d.image_url ? `<img src="${window.escHtml(d.image_url)}" alt="Ảnh minh hoạ ${window.escHtml(d.name)}" style="width:100%;height:160px;object-fit:cover;" onerror="this.style.display='none'">` : ''}
        <div style="padding:16px 18px;flex:1;display:flex;flex-direction:column;gap:10px;">
          <div style="display:flex;align-items:center;gap:10px;">
            <span style="font-size:24px;" aria-hidden="true">${d.emoji || '☕'}</span>
            <div>
              <div style="font-weight:700;font-size:15px;color:var(--text);">${window.escHtml(d.name)}</div>
              <div style="font-size:11px;font-weight:600;color:${color};margin-top:2px;">${window.escHtml(d.category)}</div>
            </div>
          </div>
          ${d.description ? `<div style="font-size:13px;color:var(--text-muted);line-height:1.5;">${window.escHtml(d.description)}</div>` : ''}
          ${ing.length ? `<div style="font-size:12px;color:var(--text-muted);">🧪 ${ing.length} nguyên liệu</div>` : ''}
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
  window.AdminPermissions.applyReadOnlyForm(modal, { readonly, saveBtn, deleteBtn });
}

function clearDrinkFieldError(id) {
  const el = document.getElementById(id);
  if (!el) return;
  el.style.borderColor = '';
  document.getElementById(id + 'Error')?.remove();
}
function showDrinkFieldError(id, msg) {
  const el = document.getElementById(id);
  if (!el) return;
  el.style.borderColor = 'var(--danger)';
  el.focus();
  let err = document.getElementById(id + 'Error');
  if (!err) {
    err = document.createElement('div');
    err.id = id + 'Error';
    err.setAttribute('role', 'alert');
    err.style.cssText = 'color:var(--danger);font-size:12px;font-weight:600;margin-top:-6px;';
    el.insertAdjacentElement('afterend', err);
  }
  err.textContent = msg;
  el.addEventListener('input', () => clearDrinkFieldError(id), { once: true });
}

function openAddDrink() {
  if (isDrinksReadOnly) return;

  document.getElementById('drinkId').value   = '';
  document.getElementById('drinkName').value = '';
  document.getElementById('drinkCategory').value = '';
  document.getElementById('drinkEmoji').value = '';
  document.getElementById('drinkSort').value  = '';
  document.getElementById('drinkDesc').value  = '';
  document.getElementById('drinkIngredients').value = '';
  document.getElementById('drinkSteps').value = '';
  document.getElementById('drinkTips').value  = '';
  document.getElementById('drinkImage').value = '';
  clearDrinkFieldError('drinkName');
  document.getElementById('drinkModalTitle').textContent = 'Thêm công thức';
  document.getElementById('drinkDeleteBtn').style.display = 'none';
  document.getElementById('drinkDeleteBtn').dataset.wasVisible = '0';
  setDrinkModalReadOnly(false);
  document.getElementById('drinkModal').classList.remove('hidden');
  document.getElementById('drinkName').focus();
}

function editDrink(id) {
  const d = allDrinks.find(x => x.id === id);
  if (!d) return;
  document.getElementById('drinkId').value        = d.id;
  document.getElementById('drinkName').value      = d.name || '';
  document.getElementById('drinkCategory').value  = d.category || '';
  document.getElementById('drinkEmoji').value     = d.emoji || '';
  document.getElementById('drinkSort').value      = d.sort_order ?? '';
  document.getElementById('drinkDesc').value      = d.description || '';
  document.getElementById('drinkIngredients').value = Array.isArray(d.ingredients) ? d.ingredients.join('\n') : '';
  document.getElementById('drinkSteps').value     = Array.isArray(d.steps) ? d.steps.join('\n') : '';
  document.getElementById('drinkTips').value      = Array.isArray(d.tips) ? d.tips.join('\n') : '';
  document.getElementById('drinkImage').value     = d.image_url || '';
  clearDrinkFieldError('drinkName');

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
   SAVE — ⚠️ TỐI ƯU: PATCH mảng `allDrinks` tại chỗ bằng dữ liệu
   Supabase trả về (.select()), thay vì loadDrinks() refetch toàn bảng.
   ══════════════════════════════════════════════ */
async function saveDrink() {
  if (isDrinksReadOnly) return;

  const rawId = document.getElementById('drinkId').value;
  const id    = rawId ? Number(rawId) : null;
  const name  = document.getElementById('drinkName').value.trim();

  if (!name) { showDrinkFieldError('drinkName', 'Vui lòng nhập tên đồ uống.'); return; }
  clearDrinkFieldError('drinkName');

  const payload = {
    name,
    category:    document.getElementById('drinkCategory').value,
    emoji:       document.getElementById('drinkEmoji').value.trim() || '☕',
    description: document.getElementById('drinkDesc').value.trim(),
    ingredients: parseDrinkLines('drinkIngredients'),
    steps:       parseDrinkLines('drinkSteps'),
    tips:        parseDrinkLines('drinkTips'),
    image_url:   document.getElementById('drinkImage').value.trim(),
    sort_order:  Number(document.getElementById('drinkSort').value) || null,
  };

  const saveBtn = document.getElementById('drinkSaveBtn');
  saveBtn.disabled = true;
  const origText = saveBtn.textContent;
  saveBtn.textContent = 'Đang lưu...';

  try {
    if (id) {
      const { data, error } = await client.from('drinks').update(payload).eq('id', id).select();
      if (error) throw error;

      /* ⚠️ TỐI ƯU: patch tại chỗ thay vì loadDrinks() refetch toàn bảng */
      const idx = allDrinks.findIndex(d => d.id === id);
      if (idx !== -1 && data?.[0]) allDrinks[idx] = data[0];
    } else {
      const { data, error } = await client.from('drinks').insert(payload).select();
      if (error) throw error;

      /* ⚠️ TỐI ƯU: thêm trực tiếp vào mảng thay vì refetch */
      if (data?.[0]) allDrinks.push(data[0]);
    }
    allDrinks.sort((a, b) => (a.sort_order ?? 0) - (b.sort_order ?? 0));

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
   DELETE — ⚠️ TỐI ƯU: xoá tại chỗ trong mảng `allDrinks` thay vì
   loadDrinks() refetch toàn bảng.
   ══════════════════════════════════════════════ */
async function deleteDrink() {
  if (isDrinksReadOnly) return;

  const id = document.getElementById('drinkId').value;
  if (!id) return;

  const name = document.getElementById('drinkName').value || 'công thức này';

  const ok = await window.showConfirm({
    title: `Xóa "${name}"?`,
    message: 'Hành động này không thể hoàn tác.',
    confirmText: '🗑️ Xóa',
    cancelText: 'Hủy',
    danger: true,
  });
  if (!ok) return;

  try {
    const { error } = await client.from('drinks').delete().eq('id', id);
    if (error) throw error;

    /* ⚠️ TỐI ƯU: xoá tại chỗ thay vì loadDrinks() refetch toàn bảng */
    allDrinks = allDrinks.filter(d => String(d.id) !== String(id));

    document.getElementById('drinkModal').classList.add('hidden');
    renderDrinkGrid();
    const totalEl = document.getElementById('totalDrinks');
    if (totalEl) totalEl.textContent = allDrinks.length;
    window.showToast('🗑️ Đã xóa công thức', '#e17055');
  } catch (err) {
    window.showToast('❌ Lỗi: ' + err.message, '#e17055');
  }
}

/* Expose cho nav.js */
window.loadDrinks      = loadDrinks;
window.renderDrinkGrid = renderDrinkGrid;
window.openAddDrink    = openAddDrink;
window.editDrink       = editDrink;
window.saveDrink       = saveDrink;
window.deleteDrink     = deleteDrink;
