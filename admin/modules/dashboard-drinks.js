/* ══════════════════════════════════════════════
   DASHBOARD DRINKS MODULE — admin/modules/dashboard-drinks.js
   ─────────────────────────────────────────────
   THAY ĐỔI:
   - Thêm isDrinksReadOnly (window.AdminPermissions.isReadOnly)
     để đồng bộ với dashboard-games.js: Bar Staff chỉ được XEM,
     không được thêm/sửa/xóa công thức đồ uống.
     + Ẩn nút "+ Thêm công thức"
     + Nút trên card đổi thành "👁️ Xem" thay vì "✏️ Sửa"
     + Modal mở ở chế độ readonly: input/textarea/select bị khóa,
       ẩn nút "💾 Lưu" và "🗑️ Xóa"
     + saveDrink()/deleteDrink()/openAddDrink() chặn ở tầng hàm
       (phòng khi bị gọi trực tiếp qua console)

   ⚠️ SỬA (UI/UX audit — ưu tiên cao):
   - deleteDrink(): thay window.confirm() bằng window.showConfirm()
     (modal tùy chỉnh, không chặn UI thread, style nhất quán, hỗ trợ
     Escape/Enter/focus — xem js/shared-utils.js).
   - saveDrink(): thay alert() lỗi validate bằng lỗi hiển thị ngay
     tại field (border đỏ + text lỗi dưới input), giống cách
     admin/login.html đã làm — thay vì popup chặn màn hình.

   Cần: `client` (từ dashboard-auth.js), `currentSession`,
   window.AdminPermissions (từ core/dashboard-permissions.js),
   window.showConfirm / window.showToast (từ shared-utils.js).
   ══════════════════════════════════════════════ */

window.activeDrinkFilter = 'all';
let allDrinks = [];

const isDrinksReadOnly = window.AdminPermissions.isReadOnly(currentSession.role);

/* ── Ẩn nút "+ Thêm công thức" nếu chỉ được xem ── */
(function hideAddDrinkBtnIfReadOnly() {
  const btn = document.getElementById('addDrinkBtn');
  if (isDrinksReadOnly && btn) btn.style.display = 'none';
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
          <button class="btn btn-primary" style="font-size:12px;padding:6px 14px;" onclick="editDrink(${d.id})">${actionLabel} ${window.escHtml(d.name)}</button>
        </div>
      </div>
    `;
  }).join('');
}

/* ══════════════════════════════════════════════
   READ-ONLY MODE cho modal (dùng chung AdminPermissions.applyReadOnlyForm)
   ══════════════════════════════════════════════ */
function setDrinkModalReadOnly(readonly) {
  const modal     = document.getElementById('drinkModal');
  const saveBtn   = document.getElementById('drinkSaveBtn');
  const deleteBtn = document.getElementById('drinkDeleteBtn');

  window.AdminPermissions.applyReadOnlyForm(modal, { readonly, saveBtn, deleteBtn });
}

/* ── Xóa lỗi field khi người dùng gõ lại (dùng cho validate mới) ── */
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
  if (isDrinksReadOnly) return; /* chặn tầng hàm, phòng nút bị lộ */

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

async function saveDrink() {
  if (isDrinksReadOnly) return; /* chặn tầng hàm */

  const rawId = document.getElementById('drinkId').value;
  const id    = rawId ? Number(rawId) : null;
  const name  = document.getElementById('drinkName').value.trim();

  /* ⚠️ SỬA: lỗi hiển thị ngay tại field thay vì alert() chặn màn hình */
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
      const { error } = await client.from('drinks').update(payload).eq('id', id);
      if (error) throw error;
    } else {
      const { error } = await client.from('drinks').insert(payload);
      if (error) throw error;
    }
    document.getElementById('drinkModal').classList.add('hidden');
    window.showToast('✅ Đã lưu công thức!');
    loadDrinks();
  } catch (err) {
    /* ⚠️ SỬA: lỗi từ server hiện qua toast đỏ thay vì alert() */
    window.showToast('❌ Lỗi: ' + err.message, '#e17055');
  } finally {
    saveBtn.disabled = false;
    saveBtn.textContent = origText;
  }
}

async function deleteDrink() {
  if (isDrinksReadOnly) return; /* chặn tầng hàm */

  const id = document.getElementById('drinkId').value;
  if (!id) return;

  const name = document.getElementById('drinkName').value || 'công thức này';

  /* ⚠️ SỬA: window.confirm() → window.showConfirm() (không chặn UI
     thread, style nhất quán, hỗ trợ Escape/Enter/focus-trap). */
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
    document.getElementById('drinkModal').classList.add('hidden');
    window.showToast('🗑️ Đã xóa công thức', '#e17055');
    loadDrinks();
  } catch (err) {
    window.showToast('❌ Lỗi: ' + err.message, '#e17055');
  }
}

/* Expose cho onclick="" trong HTML modal + nav.js */
window.loadDrinks      = loadDrinks;
window.renderDrinkGrid = renderDrinkGrid;
window.openAddDrink    = openAddDrink;
window.editDrink       = editDrink;
window.saveDrink       = saveDrink;
window.deleteDrink     = deleteDrink;
