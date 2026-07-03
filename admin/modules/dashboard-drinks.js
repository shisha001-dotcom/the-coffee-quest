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

   Cần: `client` (từ dashboard-auth.js), `currentSession`,
   window.AdminPermissions (từ core/dashboard-permissions.js).
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
        ${d.image_url ? `<img src="${window.escHtml(d.image_url)}" alt="${window.escHtml(d.name)}" style="width:100%;height:160px;object-fit:cover;" onerror="this.style.display='none'">` : ''}
        <div style="padding:16px 18px;flex:1;display:flex;flex-direction:column;gap:10px;">
          <div style="display:flex;align-items:center;gap:10px;">
            <span style="font-size:24px;">${d.emoji || '☕'}</span>
            <div>
              <div style="font-weight:700;font-size:15px;color:var(--text);">${window.escHtml(d.name)}</div>
              <div style="font-size:11px;font-weight:600;color:${color};margin-top:2px;">${window.escHtml(d.category)}</div>
            </div>
          </div>
          ${d.description ? `<div style="font-size:13px;color:var(--text-muted);line-height:1.5;">${window.escHtml(d.description)}</div>` : ''}
          ${ing.length ? `<div style="font-size:12px;color:var(--text-muted);">🧪 ${ing.length} nguyên liệu</div>` : ''}
        </div>
        <div style="padding:10px 18px;border-top:1px solid var(--border);display:flex;gap:8px;">
          <button class="btn btn-primary" style="font-size:12px;padding:6px 14px;" onclick="editDrink(${d.id})">${actionLabel}</button>
        </div>
      </div>
    `;
  }).join('');
}

/* ══════════════════════════════════════════════
   READ-ONLY MODE cho modal (giống dashboard-games.js)
   ══════════════════════════════════════════════ */
function setDrinkModalReadOnly(readonly) {
  const modal = document.getElementById('drinkModal');
  if (!modal) return;

  modal.querySelectorAll('input, textarea, select').forEach(el => { el.disabled = readonly; });

  const saveBtn   = document.getElementById('drinkSaveBtn');
  const deleteBtn = document.getElementById('drinkDeleteBtn');

  if (saveBtn) saveBtn.style.display = readonly ? 'none' : '';
  if (deleteBtn) {
    deleteBtn.style.display = readonly
      ? 'none'
      : (deleteBtn.dataset.wasVisible === '1' ? 'inline-flex' : 'none');
  }
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
  document.getElementById('drinkModalTitle').textContent = 'Thêm công thức';
  document.getElementById('drinkDeleteBtn').style.display = 'none';
  document.getElementById('drinkDeleteBtn').dataset.wasVisible = '0';
  setDrinkModalReadOnly(false);
  document.getElementById('drinkModal').classList.remove('hidden');
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
  if (!name) { alert('Vui lòng nhập tên đồ uống.'); return; }

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
    alert('❌ Lỗi: ' + err.message);
  }
}

async function deleteDrink() {
  if (isDrinksReadOnly) return; /* chặn tầng hàm */

  const id = document.getElementById('drinkId').value;
  if (!id) return;
  if (!confirm('Xóa công thức này?\n\nHành động này không thể hoàn tác!')) return;
  try {
    const { error } = await client.from('drinks').delete().eq('id', id);
    if (error) throw error;
    document.getElementById('drinkModal').classList.add('hidden');
    window.showToast('🗑️ Đã xóa công thức', '#e17055');
    loadDrinks();
  } catch (err) {
    alert('Lỗi: ' + err.message);
  }
}

/* Expose cho onclick="" trong HTML modal + nav.js */
window.loadDrinks      = loadDrinks;
window.renderDrinkGrid = renderDrinkGrid;
window.openAddDrink    = openAddDrink;
window.editDrink       = editDrink;
window.saveDrink       = saveDrink;
window.deleteDrink     = deleteDrink;
