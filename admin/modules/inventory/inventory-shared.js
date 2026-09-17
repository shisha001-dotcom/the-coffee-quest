/* ══════════════════════════════════════════════
   INVENTORY SHARED — admin/modules/inventory/inventory-shared.js
   ─────────────────────────────────────────────
   ⚠️ MỚI: tồn kho giờ theo dõi RIÊNG theo từng kho
   (ingredient_stock_logs.branch_id) thay vì gộp chung 1 con số
   duy nhất như trước. current_stock (field cũ, dùng bởi
   dashboard-drinks.js/dashboard-orders.js) VẪN giữ nguyên ý nghĩa
   "tổng tồn mọi kho cộng lại" để không phá vỡ 2 nơi đó — chỉ thêm
   getStockInBranch()/getStockBreakdown() để tra theo từng kho.

   Log cũ (trước khi có tính năng nhiều kho) có branch_id = null —
   được gộp vào 1 "kho ảo" riêng (key branch_id=null) khi tính tổng,
   không mất dữ liệu, chỉ hiển thị là "Chưa gán kho" ở phần chi tiết.
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

  function computeRecipeCost(rows) {
    return (rows || []).reduce((sum, r) => {
      const ing = getIngredientById(r.ingredient_id);
      if (!ing) return sum;
      const qty  = Number(r.qty_per_serving) || 0;
      const rate = Number(r.conversion_rate) || 1;
      return sum + qty * rate * Number(ing.unit_cost || 0);
    }, 0);
  }

  async function loadIngredients() {
    const { data: ings, error } = await client
      .from("ingredients")
      .select("*")
      .is("deleted_at", null)
      .order("name", { ascending: true });
    if (error) { console.error(error); throw error; }

    const { data: logs, error: logErr } = await client
      .from("ingredient_stock_logs")
      .select("ingredient_id, branch_id, qty_after, created_at")
      .order("created_at", { ascending: false });
    if (logErr) console.warn("[Inventory] loadIngredients (stock logs):", logErr.message);

    /* Với mỗi cặp (ingredient_id, branch_id) — kể cả branch_id=null
       (log cũ) — giữ dòng MỚI NHẤT làm tồn kho hiện tại của kho đó. */
    const latestByKey = new Map();
    (logs || []).forEach(l => {
      const key = `${l.ingredient_id}::${l.branch_id ?? "null"}`;
      if (!latestByKey.has(key)) latestByKey.set(key, l);
    });

    const stockMapByIngredient = new Map(); // ingredient_id -> Map(branch_id -> qty)
    latestByKey.forEach(l => {
      if (!stockMapByIngredient.has(l.ingredient_id)) stockMapByIngredient.set(l.ingredient_id, new Map());
      stockMapByIngredient.get(l.ingredient_id).set(l.branch_id, Number(l.qty_after) || 0);
    });

    state.ingredients = (ings || []).map(i => {
      const byBranch = stockMapByIngredient.get(i.id) || new Map();
      const total = [...byBranch.values()].reduce((s, v) => s + v, 0);
      return { ...i, current_stock: total, _stockByBranch: byBranch };
    });
    return state.ingredients;
  }

  /* ⚠️ MỚI: tồn kho của 1 sản phẩm TẠI ĐÚNG 1 KHO — dùng để kiểm tra
     đủ hàng trước khi xuất/chuyển kho. */
  function getStockInBranch(ingredientId, branchId) {
    const ing = getIngredientById(ingredientId);
    if (!ing || !ing._stockByBranch) return 0;
    return ing._stockByBranch.get(branchId) || 0;
  }

  /* ⚠️ MỚI: liệt kê tồn kho theo từng kho — dùng để hiển thị chi tiết
     (▸ xổ ra) trong bảng Kho nguyên liệu. */
  function getStockBreakdown(ingredientId) {
    const ing = getIngredientById(ingredientId);
    if (!ing || !ing._stockByBranch) return [];
    return [...ing._stockByBranch.entries()].map(([branchId, qty]) => ({ branchId, qty }));
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
    getStockInBranch, getStockBreakdown,
  };
})();
