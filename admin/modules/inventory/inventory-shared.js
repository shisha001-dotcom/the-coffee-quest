/* ══════════════════════════════════════════════
   INVENTORY SHARED — admin/modules/inventory/inventory-shared.js
   ─────────────────────────────────────────────
   VAI TRÒ
   State + hàm dùng chung cho mọi nơi cần dữ liệu nguyên liệu / thành
   phẩm / loại đồ uống. Xuất ra `window.Inventory`.

   NƠI DÙNG
     - dashboard-drinks.js       : recipe builder, dropdown thành phẩm
     - dashboard-orders.js       : trừ kho khi bán, cache giá vốn
     - dashboard-ingredients.js  : trang Kho nguyên liệu, phiếu nhập/xuất/chuyển
     - dashboard-inventory-count.js: danh sách nguyên liệu khi tạo phiếu kiểm kê
     - settings-products.js      : tab Sản phẩm

   THỨ TỰ NẠP
   Là file thứ 2 trong SCRIPT_SEQUENCE (core/dashboard-auth.js), ngay sau
   page-registry, vì các file trên dùng window.Inventory ngay khi chạy.
   Cần sẵn: `client`, `currentSession`, window.AdminPermissions.

   CÁCH TÍNH TỒN KHO (quan trọng)
   Bảng `ingredients` KHÔNG có cột tồn kho. Tồn kho được suy ra từ bảng
   nhật ký `ingredient_stock_logs`: với mỗi cặp (nguyên liệu, kho), lấy
   dòng log MỚI NHẤT (theo created_at) và đọc cột `qty_after`.
     → Vì vậy mọi nơi ghi log PHẢI ghi đúng `qty_after` (tồn sau thao tác)
       và đúng `branch_id`.
     → Log cũ chưa gán kho có branch_id = null; được coi như 1 "kho ảo"
       riêng, vẫn cộng vào tổng tồn, hiển thị là "Chưa gán kho".

   Mỗi phần tử trong state.ingredients là 1 dòng `ingredients` cộng thêm:
     current_stock   TỔNG tồn của mọi kho (kể cả kho ảo null)
     _stockByBranch  Map(branch_id → tồn) — dùng nội bộ, đọc qua
                     getStockInBranch() / getStockBreakdown()
   ══════════════════════════════════════════════ */

window.Inventory = (function () {
  /* true nếu role hiện tại chỉ được xem (theo core/dashboard-permissions.js).
     Các module kho dùng cờ này để ẩn nút thao tác. */
  const isReadOnly = window.AdminPermissions.isReadOnly(currentSession.role);

  const state = {
    ingredients: [], // nạp bởi loadIngredients()
    categories: [],  // nạp bởi loadCategories() — bảng drink_categories
  };

  function getIngredientById(id) {
    return state.ingredients.find(i => i.id === id) || null;
  }
  function getCategoryById(id) {
    return state.categories.find(c => c.id === id) || null;
  }

  /* Giá thành ƯỚC TÍNH 1 ly = Σ (qty_per_serving × conversion_rate × unit_cost).
     - conversion_rate rỗng/0 được coi là 1.
     - Nguyên liệu không tìm thấy trong state bị bỏ qua (tính 0).
     ⚠️ Chỉ dùng để PREVIEW trong modal đồ uống. Giá vốn thật khi bán được
     lấy từ view v_drink_cost và chụp lại (snapshot) trên đơn hàng. */
  function computeRecipeCost(rows) {
    return (rows || []).reduce((sum, r) => {
      const ing = getIngredientById(r.ingredient_id);
      if (!ing) return sum;
      const qty  = Number(r.qty_per_serving) || 0;
      const rate = Number(r.conversion_rate) || 1;
      return sum + qty * rate * Number(ing.unit_cost || 0);
    }, 0);
  }

  /* Tải nguyên liệu + tính tồn kho. Trả về state.ingredients.
     - Bỏ nguyên liệu đã xoá mềm (deleted_at IS NOT NULL), sắp theo tên A→Z.
     - KHÔNG lọc is_active ở đây → nơi dùng tự lọc theo nhu cầu.
     - Lỗi tải nguyên liệu → ném lỗi; lỗi tải log chỉ cảnh báo console
       (khi đó mọi tồn kho hiện 0).
     ⚠️ Hiệu năng: tải TOÀN BỘ lịch sử ingredient_stock_logs mỗi lần gọi.
     Log càng nhiều thì càng chậm. */
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

    /* Log đã sắp mới→cũ, nên dòng ĐẦU TIÊN gặp của mỗi cặp
       (ingredient_id, branch_id) chính là tồn hiện tại của cặp đó. */
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

  /* Tồn của 1 sản phẩm TẠI ĐÚNG 1 kho (0 nếu chưa có phát sinh).
     Dùng để kiểm tra đủ hàng trước khi xuất/chuyển kho. */
  function getStockInBranch(ingredientId, branchId) {
    const ing = getIngredientById(ingredientId);
    if (!ing || !ing._stockByBranch) return 0;
    return ing._stockByBranch.get(branchId) || 0;
  }

  /* Danh sách tồn theo từng kho: [{ branchId, qty }, ...].
     branchId = null nghĩa là "Chưa gán kho (dữ liệu cũ)".
     Dùng cho phần xổ chi tiết (▸) trong bảng Kho nguyên liệu. */
  function getStockBreakdown(ingredientId) {
    const ing = getIngredientById(ingredientId);
    if (!ing || !ing._stockByBranch) return [];
    return [...ing._stockByBranch.entries()].map(([branchId, qty]) => ({ branchId, qty }));
  }

  /* Tải loại đồ uống (bảng drink_categories) sắp theo sort_order.
     Chưa có giao diện thêm/sửa/xoá loại đồ uống — muốn thêm loại mới
     phải làm trực tiếp trên Supabase. */
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
