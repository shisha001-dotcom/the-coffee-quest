/* ══════════════════════════════════════════════
   DASHBOARD LEVELS — admin/modules/membership/dashboard-levels.js
   ─────────────────────────────────────────────
   ĐÃ TÁCH khỏi dashboard-customers.js cũ. File này CHỈ lo tab
   "🏆 Cấp độ": cấu hình bảng `membership_levels` (XP tối thiểu,
   tên rank, icon, % giảm giá, quà tặng, ưu tiên đặt bàn).

   KHÔNG tự gọi registerPage() — render vào #custTabLevels, vùng
   đã có sẵn trong page do dashboard-customers.js đăng ký.

   Expose: window.renderLevelsTab()
   ══════════════════════════════════════════════ */

const M_L = window.Membership;
const isSuperAdminLevels = M_L.isSuperAdmin;

function renderLevelsTab() {
  const wrap = document.getElementById("custTabLevels");
  if (!wrap) return;

  wrap.innerHTML = `
    <div class="table-card" style="padding:20px 24px;">
      <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:16px;">
        <div style="font-size:14px;font-weight:700;">Cấu hình cấp độ &amp; ưu đãi</div>
        <button class="btn btn-primary" id="saveLevelsBtn">💾 Lưu tất cả</button>
      </div>
      <table class="game-table">
        <thead><tr><th>Cấp</th><th>XP tối thiểu</th><th>Tên rank</th><th>Icon</th><th>Giảm giá %</th><th>Quà tặng</th><th>Ưu tiên đặt bàn</th></tr></thead>
        <tbody>
          ${M_L.state.levels.map(l => `
            <tr data-level="${l.level}">
              <td><b>${l.level}</b></td>
              <td><input type="number" class="lv-xp" value="${l.xp_required}" min="0" style="width:90px;height:34px;border:1px solid var(--border);border-radius:6px;padding:0 8px;"></td>
              <td><input type="text" class="lv-name" value="${window.escHtml(l.rank_name)}" style="width:120px;height:34px;border:1px solid var(--border);border-radius:6px;padding:0 8px;"></td>
              <td><input type="text" class="lv-icon" value="${l.rank_icon || ''}" style="width:50px;height:34px;border:1px solid var(--border);border-radius:6px;padding:0 8px;text-align:center;"></td>
              <td><input type="number" class="lv-discount" value="${l.discount_pct}" min="0" max="100" style="width:70px;height:34px;border:1px solid var(--border);border-radius:6px;padding:0 8px;"></td>
              <td><input type="text" class="lv-freeitem" value="${window.escHtml(l.free_item || '')}" style="width:160px;height:34px;border:1px solid var(--border);border-radius:6px;padding:0 8px;"></td>
              <td style="text-align:center;"><input type="checkbox" class="lv-priority" ${l.priority_booking ? "checked" : ""} style="width:18px;height:18px;"></td>
            </tr>
          `).join("")}
        </tbody>
      </table>
      <div style="font-size:12px;color:var(--text-muted);margin-top:10px;">Sửa giá trị trong bảng rồi bấm "💾 Lưu tất cả" ở trên để áp dụng.</div>
    </div>
  `;

  document.getElementById("saveLevelsBtn")?.addEventListener("click", saveLevels);
}
window.renderLevelsTab = renderLevelsTab;

async function saveLevels() {
  if (!isSuperAdminLevels) return;
  const rows = [...document.querySelectorAll("#custTabLevels tbody tr")].map(tr => ({
    level: Number(tr.dataset.level),
    xp_required: Number(tr.querySelector(".lv-xp").value) || 0,
    rank_name: tr.querySelector(".lv-name").value.trim(),
    rank_icon: tr.querySelector(".lv-icon").value.trim() || "⭐",
    discount_pct: Number(tr.querySelector(".lv-discount").value) || 0,
    free_item: tr.querySelector(".lv-freeitem").value.trim() || null,
    priority_booking: tr.querySelector(".lv-priority").checked,
  }));

  for (const r of rows) {
    if (!r.rank_name) { window.showToast(`⚠️ Cấp ${r.level}: vui lòng nhập tên rank.`, "#e17055"); return; }
    if (r.xp_required < 0) { window.showToast(`⚠️ Cấp ${r.level}: XP tối thiểu không được âm.`, "#e17055"); return; }
    if (r.discount_pct < 0 || r.discount_pct > 100) { window.showToast(`⚠️ Cấp ${r.level}: % giảm giá phải từ 0 đến 100.`, "#e17055"); return; }
  }
  const sortedByLevel = [...rows].sort((a, b) => a.level - b.level);
  for (let i = 1; i < sortedByLevel.length; i++) {
    if (sortedByLevel[i].xp_required <= sortedByLevel[i - 1].xp_required) {
      window.showToast(`⚠️ XP tối thiểu phải tăng dần theo cấp (lỗi tại cấp ${sortedByLevel[i].level}).`, "#e17055");
      return;
    }
  }

  try {
    const { error } = await client.from("membership_levels").upsert(rows, { onConflict: "level" });
    if (error) throw error;
    window.showToast("✅ Đã lưu cấu hình cấp độ!");
    await M_L.loadLevels();
    await M_L.loadCustomers();
    if (window.loadCustomers) window.loadCustomers(); // đồng bộ lại tab Danh sách nếu đang mở
  } catch (err) {
    window.showToast("❌ Lỗi: " + err.message, "#e17055");
  }
}
