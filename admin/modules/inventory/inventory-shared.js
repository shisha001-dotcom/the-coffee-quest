/* ══════════════════════════════════════════════
   INVENTORY SHARED — admin/modules/inventory/inventory-shared.js
   ─────────────────────────────────────────────
   MỚI (theo schema SQL v1) — state + helper dùng chung cho domain
   Kho nguyên liệu, đọc bởi:
     - dashboard-ingredients.js  (CRUD nguyên liệu + nhập/điều chỉnh kho)
     - dashboard-drinks.js       (recipe builder — cần state.ingredients
                                   + state.categories để render dropdown)
     - dashboard-customers.js    (tạo đơn hàng — cần giá vốn nguyên liệu
                                   để snapshot ingredient_unit_cost)

   ⚠️ Load file này TRƯỚC modules/drinks/dashboard-drinks.js VÀ TRƯỚC
      modules/inventory/dashboard-ingredients.js, NGAY SAU
      core/dashboard-page-registry.js (cùng vị trí như
      membership-shared.js — hạ tầng dùng chung load sớm).

   Exports (window.Inventory.*):
     state.ingredients   — [{id,name,unit,unit_cost,min_stock_qty,is_active,current_stock}]
     state.categories    — [{id,name,icon,color,sort_order}]
     isReadOnly
     loadIngredients() / loadCategories()
     getIngredientById(id) / getCategoryById(id)
     computeRecipeCost(rows) — preview giá thành từ danh sách dòng công thức
   ══════════════════════════════════════════════ */

window.Inventory = (function () {
  const isReadOnly = window.AdminPermissions.isReadOnly(currentSession.role);

  const state = {
    ingredients: [],
    categories: [],
  };

  function getIngredientById(id) {
    return state.ingredients.find(i => i.id === id) || null;
  }
  function getCategoryById(id) {
    return state.categories.find(c => c.id === id) || null;
  }

  /* Preview giá thành — dùng cho UI trực tiếp (modal sửa đồ uống /
     tạo đơn hàng). Giá thành THẬT lúc lưu đơn hàng nên snapshot lại
     tại thời điểm tạo (không phụ thuộc hàm này) để không đổi ngược
     khi giá nguyên liệu thay đổi sau này. */
  function computeRecipeCost(rows) {
    return (rows || []).reduce((sum, r) => {
      const ing = getIngredientById(r.ingredient_id);
      if (!ing) return sum;
      const qty  = Number(r.qty_per_serving) || 0;
      const rate = Number(r.conversion_rate) || 1;
      return sum + qty * rate * Number(ing.unit_cost || 0);
    }, 0);
  }

  /* ── Tồn kho hiện tại = qty_after của log gần nhất mỗi ingredient_id.
     Supabase JS không hỗ trợ DISTINCT ON tiện lợi → lấy toàn bộ log
     sắp created_at desc, giữ dòng đầu tiên gặp mỗi ingredient_id. Với
     quy mô 1 quán, số dòng log là chấp nhận được. ── */
  async function loadIngredients() {
    const { data: ings, error } = await client
      .from("ingredients")
      .select("*")
      .is("deleted_at", null)
      .order("name", { ascending: true });
    if (error) { console.error(error); throw error; }

    const { data: logs, error: logErr } = await client
      .from("ingredient_stock_logs")
      .select("ingredient_id, qty_after, created_at")
      .order("created_at", { ascending: false });
    if (logErr) console.warn("[Inventory] loadIngredients (stock logs):", logErr.message);

    const latestStock = new Map();
    (logs || []).forEach(l => {
      if (!latestStock.has(l.ingredient_id)) latestStock.set(l.ingredient_id, Number(l.qty_after));
    });

    state.ingredients = (ings || []).map(i => ({
      ...i,
      current_stock: latestStock.has(i.id) ? latestStock.get(i.id) : 0,
    }));
    return state.ingredients;
  }

  async function loadCategories() {
    const { data, error } = await client
      .from("drink_categories")
      .select("*")
      .order("sort_order", { ascending: true });
    if (error) { console.error(error); throw error; }
    state.categories = data || [];
    return state.categories;
  }

  return {
    isReadOnly, state,
    getIngredientById, getCategoryById, computeRecipeCost,
    loadIngredients, loadCategories,
  };
})();
