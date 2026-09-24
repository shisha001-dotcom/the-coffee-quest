/* ══════════════════════════════════════════════
   DASHBOARD QUESTS — admin/modules/membership/dashboard-quests.js
   ─────────────────────────────────────────────
   VAI TRÒ
   Tab "🗺️ Nhiệm vụ" trong trang Khách hàng: xem, thêm, sửa, bật/tắt, xoá
   ĐỊNH NGHĨA nhiệm vụ (bảng `quests`). Chỉ Super Admin dùng được.

   KHÔNG tự đăng ký trang: file chỉ vẽ vào vùng #custTabQuests đã có sẵn
   trong trang do dashboard-customers.js tạo, và xuất window.renderQuestsTab()
   để file đó gọi khi chuyển sang tab này.

   QUEST HỆ THỐNG (CHECK-IN)
   Quest có is_checkin = true là quest hệ thống, tự hoàn thành khi khách có
   đơn hàng đầu tiên trong ngày (logic ở dashboard-orders.js). Nó hiện với
   biểu tượng 🔒 và KHÔNG được sửa / tắt / xoá ở đây (chặn ở cả giao diện
   lẫn từng hàm xử lý).

   ⚠️ QUEST THƯỜNG CHƯA CÓ CHỖ ĐỂ CỘNG TIẾN ĐỘ
   Quest is_checkin = false chỉ được tạo/sửa định nghĩa ở đây; hiện không có
   giao diện nào để ghi nhận khách đã làm nhiệm vụ đó, nên chúng không tự cộng
   XP. Hiện chỉ quest check-in thực sự phát XP.

   XOÁ = XOÁ MỀM
   customer_quests.quest_id là khoá ngoại ON DELETE RESTRICT, xoá cứng sẽ lỗi
   nếu đã có khách hoàn thành. Nên "xoá" chỉ ghi deleted_at, active=false,
   lý do và người xoá (lý do là BẮT BUỘC).

   PHỤ THUỘC
   window.Membership (alias M_Q), `client`, `currentSession`,
   window.showToast, window.showReasonPrompt, window.escHtml.
   Quyền: mọi thao tác đều kiểm tra Super Admin; popup chỉ được inject nếu là
   Super Admin.
   ══════════════════════════════════════════════ */

const M_Q = window.Membership;
const isSuperAdminQuests = M_Q.isSuperAdmin;

/* ══════════════════════════════════════════════
   POPUP THÊM/SỬA NHIỆM VỤ — inject 1 lần (chỉ Super Admin)
   ─────────────────────────────────────────────
   Bảng tra "sửa ở đâu" (HTML trong chuỗi bên dưới):
     · Tiêu đề: "➕ Thêm nhiệm vụ" (mặc định) / "✏️ Sửa nhiệm vụ".
     · Nhãn/placeholder: Mã nhiệm vụ (VD "2604T01", tuỳ chọn), Tên nhiệm vụ *
       (VD "Uống 3 ly cà phê trong tuần"), Mô tả, Loại *, XP thưởng *,
       Số lần cần hoàn thành *.
     · 3 loại nhiệm vụ: value daily / weekly / onetime — hiển thị "Hàng ngày /
       Hàng tuần / Một lần". Giá trị value khớp với logic chu kỳ
       (periodKeyFor) và cột `type` trong DB, KHÔNG đổi tuỳ tiện.
     · Mặc định: XP thưởng 10, số lần cần hoàn thành 1 (tối thiểu 1).
     · Kích thước: popup rộng tối đa 480px, form 1 cột; ô chọn Loại cao 44px,
       bo 10px, chữ 14px (style inline).
   Đóng popup: nút ✕, phím Escape, hoặc bấm ra ngoài lớp nền.
   ══════════════════════════════════════════════ */
(function injectQuestModal() {
  if (!isSuperAdminQuests || document.getElementById("questModal")) return;

  const modal = document.createElement("div");
  modal.className = "modal-overlay hidden";
  modal.id = "questModal";
  modal.setAttribute("role", "dialog");
  modal.setAttribute("aria-modal", "true");
  modal.setAttribute("aria-labelledby", "questModalTitle");
  modal.innerHTML = `
    <div class="modal-box" style="max-width:480px;">
      <div class="modal-header">
        <h2 id="questModalTitle">➕ Thêm nhiệm vụ</h2>
        <button class="close-btn" id="closeQuestModalBtn" aria-label="Đóng cửa sổ">✕</button>
      </div>
      <input type="hidden" id="questId">
      <div class="form-grid" style="grid-template-columns:1fr;">
        <div class="form-group"><label for="questCode">Mã nhiệm vụ</label><input type="text" id="questCode" placeholder="VD: 2604T01 (tuỳ chọn)"></div>
        <div class="form-group"><label for="questTitle">Tên nhiệm vụ *</label><input type="text" id="questTitle" placeholder="Uống 3 ly cà phê trong tuần"></div>
        <div class="form-group"><label for="questDesc">Mô tả</label><input type="text" id="questDesc" placeholder="Mô tả ngắn (tuỳ chọn)"></div>
        <div class="form-group">
          <label for="questType">Loại *</label>
          <select id="questType" style="height:44px;border-radius:10px;border:1px solid var(--border);padding:0 14px;font-size:14px;font-family:'Inter',sans-serif;">
            <option value="daily">Hàng ngày</option>
            <option value="weekly">Hàng tuần</option>
            <option value="onetime">Một lần</option>
          </select>
        </div>
        <div class="form-group"><label for="questXp">XP thưởng *</label><input type="number" id="questXp" min="1" value="10"></div>
        <div class="form-group"><label for="questTarget">Số lần cần hoàn thành *</label><input type="number" id="questTarget" min="1" value="1"></div>
      </div>
      <div class="modal-actions" style="justify-content:flex-end;">
        <button class="btn btn-primary" id="saveQuestBtn">💾 Lưu nhiệm vụ</button>
      </div>
    </div>
  `;
  document.body.appendChild(modal);

  modal.addEventListener("click", e => { if (e.target === modal) closeQuestModal(); });
  modal.addEventListener("keydown", e => { if (e.key === "Escape") closeQuestModal(); });
  document.getElementById("closeQuestModalBtn").addEventListener("click", closeQuestModal);
  document.getElementById("saveQuestBtn").addEventListener("click", saveQuest);
})();

/* ══════════════════════════════════════════════
   VẼ TAB
   ─────────────────────────────────────────────
   Bảng gồm: Tên (+ mã + mô tả) / Loại / XP / Mục tiêu / Trạng thái /
   Hành động. Chữ và kiểu ghi cứng:
     · Ghi chú đầu tab: "🔒 Nhiệm vụ đánh dấu khoá là nhiệm vụ check-in hệ
       thống…" (12px, var(--text-muted)).
     · Nhãn loại: Hàng ngày / Hàng tuần / Một lần (hàm typeLabel).
     · Trạng thái: "Đang mở" (.badge mặc định) hoặc "Tắt" (nền #f1f5f9,
       chữ #888).
     · Mô tả dưới tên: 11px; mã nhiệm vụ dùng kiểu .game-id.
     · Nút thường: "✏️ Sửa", "Tắt"/"Bật", "🗑️" (btn-danger); cỡ chữ 12px,
       padding 6px 10px. Quest hệ thống thay bằng dòng "Quest hệ thống — không
       thể chỉnh sửa".
     · Rỗng: "Chưa có nhiệm vụ nào.".
   ══════════════════════════════════════════════ */
function renderQuestsTab() {
  const wrap = document.getElementById("custTabQuests");
  if (!wrap) return;
  const typeLabel = t => t === "daily" ? "Hàng ngày" : t === "weekly" ? "Hàng tuần" : "Một lần";
  const quests = M_Q.state.quests;

  wrap.innerHTML = `
    <div class="table-card" style="padding:20px 24px;">
      <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:16px;">
        <div style="font-size:14px;font-weight:700;">Danh sách nhiệm vụ</div>
        <button class="btn btn-primary" id="addQuestBtn">+ Thêm nhiệm vụ</button>
      </div>
      <div style="font-size:12px;color:var(--text-muted);margin-bottom:14px;">
        🔒 Nhiệm vụ đánh dấu khoá là nhiệm vụ <b>check-in hệ thống</b> — tự động hoàn thành khi khách có đơn hàng đầu tiên trong ngày, không thể sửa/tắt/xoá tại đây.
      </div>
      <table class="game-table">
        <thead><tr><th>Tên</th><th>Loại</th><th>XP</th><th>Mục tiêu</th><th>Trạng thái</th><th>Hành động</th></tr></thead>
        <tbody>
          ${quests.length ? quests.map(q => `
            <tr>
              <td>
                <b>${q.is_checkin ? "🔒 " : ""}${window.escHtml(q.title)}</b>
                ${q.code ? `<span class="game-id" style="margin-left:6px;">${window.escHtml(q.code)}</span>` : ""}
                <div style="font-size:11px;color:var(--text-muted);">${window.escHtml(q.description || "")}</div>
              </td>
              <td>${typeLabel(q.type)}</td>
              <td>${q.xp_reward} XP</td>
              <td>${q.target_count}</td>
              <td>${q.active ? '<span class="badge">Đang mở</span>' : '<span class="badge" style="background:#f1f5f9;color:#888;">Tắt</span>'}</td>
              <td style="display:flex;gap:6px;flex-wrap:wrap;">
                ${q.is_checkin ? '<span style="font-size:12px;color:var(--text-muted);padding:6px 4px;">Quest hệ thống — không thể chỉnh sửa</span>' : `
                  <button class="btn btn-secondary" style="font-size:12px;padding:6px 10px;" data-quest-edit="${q.id}">✏️ Sửa</button>
                  <button class="btn btn-secondary" style="font-size:12px;padding:6px 10px;" data-quest-toggle="${q.id}">${q.active ? "Tắt" : "Bật"}</button>
                  <button class="btn btn-danger" style="font-size:12px;padding:6px 10px;" data-quest-delete="${q.id}">🗑️</button>
                `}
              </td>
            </tr>
          `).join("") : `<tr><td colspan="6" style="text-align:center;padding:30px;color:var(--text-muted);">Chưa có nhiệm vụ nào.</td></tr>`}
        </tbody>
      </table>
    </div>
  `;

  document.getElementById("addQuestBtn")?.addEventListener("click", () => openQuestModal(null));
  wrap.querySelectorAll("[data-quest-edit]").forEach(b => b.addEventListener("click", () => openQuestModal(Number(b.dataset.questEdit))));
  wrap.querySelectorAll("[data-quest-toggle]").forEach(b => b.addEventListener("click", () => toggleQuestActive(Number(b.dataset.questToggle))));
  wrap.querySelectorAll("[data-quest-delete]").forEach(b => b.addEventListener("click", () => deleteQuest(Number(b.dataset.questDelete))));
}
window.renderQuestsTab = renderQuestsTab;

/* ══════════════════════════════════════════════
   BẬT/TẮT VÀ XOÁ MỀM
   ══════════════════════════════════════════════ */

/* Đảo trạng thái active của 1 quest rồi tải lại danh sách. Bỏ qua quest hệ thống. */
async function toggleQuestActive(id) {
  if (!isSuperAdminQuests) return;
  const q = M_Q.state.quests.find(x => x.id === id);
  if (!q || q.is_checkin) return; // chặn quest hệ thống
  try {
    const { error } = await client.from("quests").update({ active: !q.active }).eq("id", id);
    if (error) throw error;
    await M_Q.loadQuests();
    renderQuestsTab();
  } catch (err) {
    window.showToast("❌ Lỗi: " + err.message, "#e17055");
  }
}

/* Xoá mềm 1 quest. Hộp thoại lý do: tiêu đề "Xoá nhiệm vụ này?", nút
   "🗑️ Xoá nhiệm vụ", ô "Lý do xoá *" (bắt buộc). Xong: toast "🗑️ Đã xoá
   nhiệm vụ" (nền #e17055). Lịch sử EXP của khách đã hoàn thành trước đó
   vẫn được giữ. */
async function deleteQuest(id) {
  if (!isSuperAdminQuests) return;
  const q = M_Q.state.quests.find(x => x.id === id);
  if (!q || q.is_checkin) return; // chặn quest hệ thống

  const reason = await window.showReasonPrompt({
    title: "Xoá nhiệm vụ này?",
    message: "Nhiệm vụ sẽ bị ẩn khỏi danh sách nhưng vẫn giữ lại lịch sử EXP của khách hàng đã hoàn thành trước đó.",
    reasonLabel: "Lý do xoá *",
    reasonPlaceholder: "VD: không còn phù hợp, đổi sang nhiệm vụ khác...",
    confirmText: "🗑️ Xoá nhiệm vụ",
    cancelText: "Huỷ",
  });
  if (reason === null) return;

  try {
    const { error } = await client.from("quests")
      .update({
        deleted_at: new Date().toISOString(), active: false,
        deleted_reason: reason, deleted_by: currentSession.displayName || currentSession.username,
      }).eq("id", id);
    if (error) throw error;
    window.showToast("🗑️ Đã xoá nhiệm vụ", "#e17055");
    await M_Q.loadQuests();
    renderQuestsTab();
  } catch (err) {
    window.showToast("❌ Lỗi: " + err.message, "#e17055");
  }
}

/* ══════════════════════════════════════════════
   MỞ / ĐÓNG POPUP
   Truyền id = null để thêm mới (giá trị mặc định: loại "daily", XP 10,
   số lần 1); có id thì nạp dữ liệu quest đó để sửa. Quest hệ thống không
   mở được.
   ══════════════════════════════════════════════ */
function openQuestModal(id) {
  if (!isSuperAdminQuests) return;
  const q = id ? M_Q.state.quests.find(x => x.id === id) : null;
  if (q?.is_checkin) return; // chặn quest hệ thống

  document.getElementById("questId").value    = q ? q.id : "";
  document.getElementById("questCode").value  = q?.code || "";
  document.getElementById("questTitle").value = q?.title || "";
  document.getElementById("questDesc").value  = q?.description || "";
  document.getElementById("questType").value  = q?.type || "daily";
  document.getElementById("questXp").value    = q?.xp_reward ?? 10;
  document.getElementById("questTarget").value = q?.target_count ?? 1;
  document.getElementById("questModalTitle").textContent = q ? "✏️ Sửa nhiệm vụ" : "➕ Thêm nhiệm vụ";
  M_Q.clearFieldError("questTitle");

  document.getElementById("questModal").classList.remove("hidden");
  document.getElementById("questTitle").focus();
}
function closeQuestModal() {
  document.getElementById("questModal").classList.add("hidden");
}

/* ══════════════════════════════════════════════
   LƯU NHIỆM VỤ
   ─────────────────────────────────────────────
   Kiểm tra: tên bắt buộc (lỗi tại ô "Vui lòng nhập tên nhiệm vụ."), XP thưởng
   > 0 và số lần > 0 (toast "⚠️ XP thưởng phải lớn hơn 0." / "⚠️ Số lần hoàn
   thành phải lớn hơn 0.", nền #e17055). Mã nhiệm vụ và mô tả rỗng được lưu
   thành null. Quest tạo mới mặc định active = true, is_checkin = false.
   Trùng mã (lỗi DB 23505) → toast "⚠️ Mã nhiệm vụ này đã tồn tại.".
   Thành công: toast "✅ Đã lưu nhiệm vụ!" (xanh mặc định).
   ══════════════════════════════════════════════ */
async function saveQuest() {
  if (!isSuperAdminQuests) return;

  const rawId = document.getElementById("questId").value;
  const id    = rawId ? Number(rawId) : null;
  const code  = document.getElementById("questCode").value.trim();
  const title = document.getElementById("questTitle").value.trim();
  const description = document.getElementById("questDesc").value.trim();
  const type  = document.getElementById("questType").value;
  const xp_reward    = Number(document.getElementById("questXp").value);
  const target_count = Number(document.getElementById("questTarget").value);

  M_Q.clearFieldError("questTitle");
  if (!title) { M_Q.showFieldError("questTitle", "Vui lòng nhập tên nhiệm vụ."); return; }
  if (!xp_reward || xp_reward <= 0)       { window.showToast("⚠️ XP thưởng phải lớn hơn 0.", "#e17055"); return; }
  if (!target_count || target_count <= 0) { window.showToast("⚠️ Số lần hoàn thành phải lớn hơn 0.", "#e17055"); return; }

  const payload = {
    code: code || null,
    title, description: description || null, type, xp_reward, target_count,
  };

  try {
    if (id) {
      const { error } = await client.from("quests").update(payload).eq("id", id);
      if (error) throw error;
    } else {
      const { error } = await client.from("quests").insert({ ...payload, active: true, is_checkin: false });
      if (error) throw error;
    }
    closeQuestModal();
    window.showToast("✅ Đã lưu nhiệm vụ!");
    await M_Q.loadQuests();
    renderQuestsTab();
  } catch (err) {
    if (err.code === "23505") window.showToast("⚠️ Mã nhiệm vụ này đã tồn tại.", "#e17055");
    else window.showToast("❌ Lỗi: " + err.message, "#e17055");
  }
}
