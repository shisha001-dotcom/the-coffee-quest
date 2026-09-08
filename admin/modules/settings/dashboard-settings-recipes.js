/* ══════════════════════════════════════════════
   DASHBOARD SETTINGS — TAB CÔNG THỨC
   admin/modules/settings/dashboard-settings-recipes.js
   ─────────────────────────────────────────────
   ⚠️ TÁCH RA từ admin/modules/dashboard-settings.js (file gốc đã
   bị xoá). Chỉ còn lo tab "🧪 Công thức" — bảng tổng hợp CHỈ ĐỌC,
   thao tác sửa công thức thật vẫn nằm ở modal có sẵn của trang
   ☕ Đồ uống (window.editDrink()), KHÔNG xây lại UI công thức lần 2.

   Cần: client, window.escHtml, window.showToast, window.editDrink
   (đã load ở modules/drinks/dashboard-drinks.js — trước đó rất xa
   trong SCRIPT_SEQUENCE).
   ══════════════════════════════════════════════ */

(function injectRecipesTab() {
  const container = document.getElementById("stTabRecipes");
  if (!container) return;

  container.innerHTML = `
    <div style="font-size:12px;color:var(--text-muted);margin-bottom:14px;">
      Tổng hợp công thức của mọi đồ uống. Bấm "✏️ Sửa công thức" để mở đúng công thức pha chế của món đó (dùng chung modal với trang ☕ Đồ uống).
    </div>
    <div class="table-card">
      <table class="game-table">
        <thead><tr><th>Đồ uống</th><th>Số nguyên liệu</th><th>Giá vốn NL/ly</th><th>Giá bán</th><th>Lợi nhuận gộp</th><th>Hành động</th></tr></thead>
        <tbody id="recipeTableBody"><tr><td colspan="6" style="text-align:center;padding:30px;color:var(--text-muted);">⏳ Đang tải...</td></tr></tbody>
      </table>
    </div>
  `;
})();

async function loadRecipeOverview() {
  const tbody = document.getElementById("recipeTableBody");
  if (!tbody) return;
  tbody.innerHTML = `<tr><td colspan="6" style="text-align:center;padding:30px;color:var(--text-muted);">⏳ Đang tải...</td></tr>`;

  try {
    const [{ data: drinks, error: dErr }, { data: costs, error: cErr }, { data: recipeRows, error: rErr }] = await Promise.all([
      client.from("drinks").select("id, name, emoji, price, is_active").is("deleted_at", null).order("sort_order", { ascending: true }),
      client.from("v_drink_cost").select("*"),
      client.from("drink_ingredients").select("drink_id"),
    ]);
    if (dErr) throw dErr;
    if (cErr) throw cErr;
    if (rErr) throw rErr;

    const costMap = new Map((costs || []).map(c => [c.drink_id, Number(c.ingredient_cost) || 0]));
    const countMap = new Map();
    (recipeRows || []).forEach(r => countMap.set(r.drink_id, (countMap.get(r.drink_id) || 0) + 1));

    renderRecipeTable(drinks || [], costMap, countMap);
  } catch (err) {
    tbody.innerHTML = `<tr><td colspan="6" style="text-align:center;padding:30px;color:var(--danger);">Lỗi: ${window.escHtml(err.message)}</td></tr>`;
  }
}

function renderRecipeTable(drinks, costMap, countMap) {
  const tbody = document.getElementById("recipeTableBody");
  if (!tbody) return;

  if (!drinks.length) {
    tbody.innerHTML = `<tr><td colspan="6" style="text-align:center;padding:30px;color:var(--text-muted);">Chưa có đồ uống nào — vào trang ☕ Đồ uống để thêm.</td></tr>`;
    return;
  }

  tbody.innerHTML = drinks.map(d => {
    const cost   = costMap.get(d.id) || 0;
    const count  = countMap.get(d.id) || 0;
    const price  = Number(d.price) || 0;
    const profit = price - cost;
    return `<tr style="${d.is_active === false ? 'opacity:.55;' : ''}">
      <td><div class="game-name">${d.emoji || '☕'} ${window.escHtml(d.name)}</div>${d.is_active === false ? '<div class="game-id" style="color:var(--danger)">Ngừng bán</div>' : ''}</td>
      <td>${count ? count + ' nguyên liệu' : '<span style="color:var(--danger);">⚠️ Chưa có công thức</span>'}</td>
      <td>${Math.round(cost).toLocaleString('vi-VN')} đ</td>
      <td>${price.toLocaleString('vi-VN')} đ</td>
      <td style="color:${profit >= 0 ? '#00b894' : 'var(--danger)'};font-weight:600;">${Math.round(profit).toLocaleString('vi-VN')} đ</td>
      <td><button class="btn btn-primary" style="font-size:12px;padding:6px 10px;" data-recipe-edit="${d.id}">✏️ Sửa công thức</button></td>
    </tr>`;
  }).join("");

  tbody.querySelectorAll("[data-recipe-edit]").forEach(btn => {
    btn.addEventListener("click", () => {
      if (typeof window.editDrink === "function") {
        window.editDrink(Number(btn.dataset.recipeEdit));
      } else {
        window.showToast("⚠️ Module Đồ uống chưa sẵn sàng, thử tải lại trang.", "#e17055");
      }
    });
  });
}

/* ══════════════════════════════════════════════
   ĐĂNG KÝ HOOK CHO SETTINGS SHARED
   ══════════════════════════════════════════════ */
window.SettingsTabs.onShowHandlers.recipes = loadRecipeOverview;
