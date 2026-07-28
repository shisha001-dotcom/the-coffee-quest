/* ══════════════════════════════════════════════
   DASHBOARD ACCOUNTS MODULE — admin/modules/dashboard-accounts.js
   ─────────────────────────────────────────────
   ⚠️ CẬP NHẬT THEO MIGRATION V3 (2026-07-17) — THAY ĐỔI QUAN TRỌNG:
   - TRƯỚC ĐÂY: deleteAccount() gọi DELETE FROM admin_users thật sự
     — mất VĨNH VIỄN thông tin tài khoản, không truy soát lại được
     ai đã tạo/sửa game, media, chat... (các bảng khác lưu tên nhân
     viên dạng text qua created_by/staff_name, không phải FK, nên
     xoá tài khoản gốc sẽ làm mất "nguồn" nhưng vẫn còn record —
     nhưng tự thân việc mất hẳn tài khoản vẫn là rủi ro không đáng).
   - GIỜ: đổi hẳn sang VÔ HIỆU HOÁ (is_active = FALSE) — giữ nguyên
     dữ liệu, không cho đăng nhập nữa (chặn ở login.html), có thể
     "Kích hoạt lại" bất cứ lúc nào. Bắt buộc nhập lý do vô hiệu hoá
     qua window.showReasonPrompt() (shared-utils.js).
   - Không tự xoá được tài khoản đang đăng nhập (giữ nguyên rule cũ).

   ⚠️ TỐI ƯU (giữ nguyên từ bản trước):
   - bindSearch(): dùng window.debounce().
   - saveAccount()/deactivateAccount()/reactivateAccount(): PATCH
     trực tiếp mảng `accounts` từ dữ liệu Supabase trả về, không
     refetch toàn bảng mỗi lần.
   ══════════════════════════════════════════════ */

const isSuperAdmin = window.AdminPermissions.isSuperAdmin(currentSession.role);

async function sha256(text) {
  const buf = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(text));
  return Array.from(new Uint8Array(buf)).map(b => b.toString(16).padStart(2, '0')).join('');
}

window.AdminDashboard.registerPage({
  pageId: "accountsPage",
  menuId: "accountsMenuItem",
  icon: "👤",
  label: "Quản lý tài khoản",
  guard: () => isSuperAdmin,
  onShow: () => loadAccounts(),
});

(function injectAccountsPage() {
  if (!isSuperAdmin) return;

  const main = document.querySelector('.main-content');
  if (!main) return;

  const page = document.createElement('div');
  page.id = 'accountsPage';
  page.style.display = 'none';

  page.innerHTML = `
    <div class="page-header">
      <div>
        <h1 class="page-title">👤 Quản lý tài khoản</h1>
        <p class="page-subtitle">Tổng hợp tài khoản quản trị viên &amp; nhân viên</p>
      </div>
      <div class="header-actions">
        <button class="btn btn-secondary" id="accountsRefreshBtn">🔄 Refresh</button>
        <button class="btn btn-primary" id="addAccountBtn">+ Thêm tài khoản</button>
      </div>
    </div>

    <div class="search-bar">
      <label for="accountSearchInput" class="visually-hidden">Tìm tài khoản</label>
      <input type="text" id="accountSearchInput" placeholder="🔍 Tìm theo tên đăng nhập / tên hiển thị..." class="search-input">
    </div>

    <div class="table-card">
      <div id="accountsLoadingMsg" class="loading-msg">⏳ Đang tải dữ liệu...</div>
      <div id="accountsErrorMsg" class="error-msg hidden" role="alert"></div>
      <table class="game-table hidden" id="accountsTable">
        <thead>
          <tr>
            <th>Tài khoản</th>
            <th>Vai trò</th>
            <th>Đăng nhập gần nhất</th>
            <th>Hành động</th>
          </tr>
        </thead>
        <tbody id="accountsTableBody"></tbody>
      </table>
    </div>

    <div class="modal-overlay hidden" id="accountModal" role="dialog" aria-modal="true" aria-labelledby="accountModalTitle">
      <div class="modal-box" style="max-width:480px;">
        <div class="modal-header">
          <h2 id="accountModalTitle">Thêm tài khoản</h2>
          <button class="close-btn" id="closeAccountModalBtn" aria-label="Đóng cửa sổ">✕</button>
        </div>

        <input type="hidden" id="accountId">

        <div class="form-grid" style="grid-template-columns:1fr;">
          <div class="form-group">
            <label for="accountUsername">Tên đăng nhập *</label>
            <input type="text" id="accountUsername" placeholder="ten.dangnhap" autocomplete="off" autocapitalize="none">
          </div>
          <div class="form-group">
            <label for="accountDisplayName">Tên hiển thị</label>
            <input type="text" id="accountDisplayName" placeholder="Nguyễn Văn A" autocomplete="off">
          </div>
          <div class="form-group">
            <label for="accountPassword" id="accountPasswordLabel">Mật khẩu *</label>
            <input type="password" id="accountPassword" placeholder="••••••••" autocomplete="new-password">
            <div class="hint" id="accountPasswordHint">Mật khẩu sẽ được mã hoá (hash) tự động trước khi lưu.</div>
          </div>
          <div class="form-group">
            <label for="accountRole">Vai trò *</label>
            <select id="accountRole" style="height:44px;border-radius:10px;border:1px solid var(--border);padding:0 14px;font-size:14px;font-family:'Inter',sans-serif;color:var(--text);outline:none;background:var(--card);">
              <option value="editor">Editor — chỉnh sửa nội dung</option>
              <option value="barstaff">Bar Staff — chỉ xem, phục vụ quầy</option>
              <option value="superadmin">Super Admin — toàn quyền + quản lý tài khoản</option>
            </select>
          </div>
        </div>

        <div id="accountInactiveNotice" class="hint" style="display:none;color:var(--danger);margin-top:-8px;"></div>

        <div class="modal-actions">
          <button class="btn btn-danger" id="deactivateAccountBtn" style="display:none;">🚫 Vô hiệu hoá tài khoản</button>
          <button class="btn btn-primary" id="saveAccountBtn">💾 Lưu</button>
        </div>
      </div>
    </div>
  `;

  main.appendChild(page);
  bindAccountEvents();
  loadAccounts();
})();

let accounts = [];

/* ══════════════════════════════════════════════
   VALIDATE FIELD ERROR
   ══════════════════════════════════════════════ */
function clearAccFieldError(id) {
  const el = document.getElementById(id);
  if (!el) return;
  el.style.borderColor = "";
  document.getElementById(id + "Error")?.remove();
}
function showAccFieldError(id, msg) {
  const el = document.getElementById(id);
  if (!el) return;
  el.style.borderColor = "var(--danger)";
  el.focus();
  let err = document.getElementById(id + "Error");
  if (!err) {
    err = document.createElement("div");
    err.id = id + "Error";
    err.setAttribute("role", "alert");
    err.style.cssText = "color:var(--danger);font-size:12px;font-weight:600;margin-top:-6px;";
    el.insertAdjacentElement("afterend", err);
  }
  err.textContent = msg;
  el.addEventListener("input", () => clearAccFieldError(id), { once: true });
}

async function loadAccounts() {
  const loadingMsg = document.getElementById('accountsLoadingMsg');
  const errorMsg   = document.getElementById('accountsErrorMsg');
  const table      = document.getElementById('accountsTable');
  if (!loadingMsg) return;

  loadingMsg.classList.remove('hidden');
  errorMsg.classList.add('hidden');
  table.classList.add('hidden');

  const { data, error } = await client
    .from('admin_users')
    .select('id, username, display_name, role, last_login, is_active, deactivated_reason, deactivated_by, deactivated_at')
    .order('username', { ascending: true });

  loadingMsg.classList.add('hidden');

  if (error) {
    errorMsg.textContent = '❌ Lỗi khi tải dữ liệu: ' + error.message;
    errorMsg.classList.remove('hidden');
    return;
  }

  accounts = data || [];
  table.classList.remove('hidden');
  renderAccountsTable(accounts);
}

function fmtLastLogin(v) {
  if (!v) return '—';
  try {
    return new Date(v).toLocaleString('vi-VN', {
      day: '2-digit', month: '2-digit', year: 'numeric',
      hour: '2-digit', minute: '2-digit'
    });
  } catch { return '—'; }
}

function renderAccountsTable(list) {
  const tbody = document.getElementById('accountsTableBody');
  if (!tbody) return;

  if (!list.length) {
    tbody.innerHTML = `<tr><td colspan="4" style="text-align:center;padding:40px;color:var(--text-muted);">Chưa có tài khoản nào.</td></tr>`;
    return;
  }

  tbody.innerHTML = list.map(acc => {
    const { label: roleLabel, color: roleBg } = window.AdminPermissions.roleInfo(acc.role);
    const initial   = (acc.display_name || acc.username || 'A')[0].toUpperCase();
    const isSelf    = acc.id === currentSession.id;
    const inactive  = acc.is_active === false;

    return `<tr style="${inactive ? 'opacity:.6;' : ''}">
      <td>
        <div class="game-info">
          <div style="width:40px;height:40px;border-radius:50%;background:${roleBg};display:flex;align-items:center;justify-content:center;font-size:16px;font-weight:700;color:#fff;flex-shrink:0;" aria-hidden="true">${window.escHtml(initial)}</div>
          <div>
            <div class="game-name">${window.escHtml(acc.display_name || acc.username)}${isSelf ? ' <span style="font-size:11px;color:var(--text-muted);font-weight:500;">(bạn)</span>' : ''}</div>
            <div class="game-id">@${window.escHtml(acc.username)}</div>
            ${inactive ? `<div class="game-id" style="color:var(--danger);">🚫 Đã vô hiệu hoá${acc.deactivated_reason ? ': ' + window.escHtml(acc.deactivated_reason) : ''}</div>` : ''}
          </div>
        </div>
      </td>
      <td><span class="badge" style="background:${roleBg}22;color:${roleBg};">${window.escHtml(roleLabel)}</span></td>
      <td>${fmtLastLogin(acc.last_login)}</td>
      <td>
        <div style="display:flex;gap:8px;align-items:center;flex-wrap:wrap;">
          <button class="btn btn-primary edit-account-btn" data-id="${acc.id}" aria-label="Sửa tài khoản ${window.escHtml(acc.username)}">✏️ Sửa</button>
          ${inactive
            ? `<button class="btn btn-secondary reactivate-account-btn" data-id="${acc.id}">♻️ Kích hoạt lại</button>`
            : ''}
        </div>
      </td>
    </tr>`;
  }).join('');

  tbody.querySelectorAll('.edit-account-btn').forEach(btn => {
    btn.addEventListener('click', () => openEditAccount(Number(btn.dataset.id)));
  });
  tbody.querySelectorAll('.reactivate-account-btn').forEach(btn => {
    btn.addEventListener('click', () => reactivateAccount(Number(btn.dataset.id)));
  });
}

function bindSearch() {
  const input = document.getElementById('accountSearchInput');
  input?.addEventListener('input', window.debounce(e => {
    const v = e.target.value.toLowerCase();
    renderAccountsTable(accounts.filter(a =>
      (a.username || '').toLowerCase().includes(v) ||
      (a.display_name || '').toLowerCase().includes(v)
    ));
  }, 200));
}

function clearAccountForm() {
  document.getElementById('accountId').value = '';
  document.getElementById('accountUsername').value = '';
  document.getElementById('accountUsername').disabled = false;
  document.getElementById('accountDisplayName').value = '';
  document.getElementById('accountPassword').value = '';
  document.getElementById('accountRole').value = 'editor';
  document.getElementById('accountInactiveNotice').style.display = 'none';
  clearAccFieldError('accountUsername');
  clearAccFieldError('accountPassword');
}

function openAddAccount() {
  clearAccountForm();
  document.getElementById('accountModalTitle').textContent = '➕ Thêm tài khoản';
  document.getElementById('accountPasswordLabel').textContent = 'Mật khẩu *';
  document.getElementById('accountPasswordHint').textContent = 'Mật khẩu sẽ được mã hoá (hash) tự động trước khi lưu.';
  document.getElementById('deactivateAccountBtn').style.display = 'none';
  document.getElementById('accountModal').classList.remove('hidden');
  document.getElementById('accountUsername').focus();
}

function openEditAccount(id) {
  const acc = accounts.find(a => a.id === id);
  if (!acc) return;
  clearAccountForm();
  document.getElementById('accountId').value = acc.id;
  document.getElementById('accountUsername').value = acc.username || '';
  document.getElementById('accountUsername').disabled = true;
  document.getElementById('accountDisplayName').value = acc.display_name || '';
  document.getElementById('accountRole').value =
    ['superadmin', 'barstaff'].includes(acc.role) ? acc.role : 'editor';

  document.getElementById('accountModalTitle').textContent = '✏️ Chỉnh sửa tài khoản';
  document.getElementById('accountPasswordLabel').textContent = 'Mật khẩu mới';
  document.getElementById('accountPasswordHint').textContent = 'Để trống nếu không muốn đổi mật khẩu.';

  const inactiveNotice = document.getElementById('accountInactiveNotice');
  if (acc.is_active === false) {
    inactiveNotice.style.display = 'block';
    inactiveNotice.textContent = `🚫 Tài khoản đang bị vô hiệu hoá${acc.deactivated_reason ? ' — Lý do: ' + acc.deactivated_reason : ''}. Bấm "Kích hoạt lại" ở bảng danh sách để mở lại quyền đăng nhập.`;
  } else {
    inactiveNotice.style.display = 'none';
  }

  const deactivateBtn = document.getElementById('deactivateAccountBtn');
  const isSelf = acc.id === currentSession.id;
  deactivateBtn.style.display = (!isSelf && acc.is_active !== false) ? 'inline-flex' : 'none';

  document.getElementById('accountModal').classList.remove('hidden');
}

/* ══════════════════════════════════════════════
   SAVE
   ══════════════════════════════════════════════ */
async function saveAccount() {
  const rawId       = document.getElementById('accountId').value;
  const id          = rawId ? Number(rawId) : null;
  const username    = document.getElementById('accountUsername').value.trim();
  const displayName = document.getElementById('accountDisplayName').value.trim();
  const password    = document.getElementById('accountPassword').value;
  const role        = document.getElementById('accountRole').value;

  if (!id && !username) { showAccFieldError('accountUsername', 'Vui lòng nhập tên đăng nhập.'); return; }
  if (!id && !password) { showAccFieldError('accountPassword', 'Vui lòng nhập mật khẩu cho tài khoản mới.'); return; }
  clearAccFieldError('accountUsername');
  clearAccFieldError('accountPassword');

  const saveBtn = document.getElementById('saveAccountBtn');
  saveBtn.disabled = true;
  saveBtn.textContent = 'Đang lưu...';

  try {
    if (!id) {
      const { data: existing } = await client
        .from('admin_users').select('id').eq('username', username).maybeSingle();
      if (existing) { showAccFieldError('accountUsername', 'Tên đăng nhập đã tồn tại.'); throw new Error('__handled__'); }

      const payload = {
        username,
        display_name: displayName || username,
        password_hash: await sha256(password),
        role,
      };
      const { data, error } = await client.from('admin_users').insert(payload).select();
      if (error) throw error;

      if (data?.[0]) accounts.push(data[0]);
    } else {
      const payload = { display_name: displayName, role };
      if (password) payload.password_hash = await sha256(password);

      const { data, error } = await client.from('admin_users').update(payload).eq('id', id).select();
      if (error) throw error;
      if (!data?.length) throw new Error(`UPDATE không ảnh hưởng dòng nào (id=${id}).`);

      const idx = accounts.findIndex(a => a.id === id);
      if (idx !== -1) accounts[idx] = data[0];
    }
    accounts.sort((a, b) => (a.username || '').localeCompare(b.username || ''));

    document.getElementById('accountModal').classList.add('hidden');
    renderAccountsTable(accounts);
    window.showToast('✅ Đã lưu tài khoản thành công!');
  } catch (err) {
    if (err.message !== '__handled__') window.showToast('❌ Lỗi khi lưu: ' + err.message, '#e17055');
  } finally {
    saveBtn.disabled = false;
    saveBtn.textContent = '💾 Lưu';
  }
}

/* ══════════════════════════════════════════════
   VÔ HIỆU HOÁ TÀI KHOẢN — ⚠️ THAY CHO XOÁ CỨNG (migration V3).
   Chặn đăng nhập ở login.html qua is_active, KHÔNG mất dữ liệu.
   ══════════════════════════════════════════════ */
async function deactivateAccount() {
  const id = document.getElementById('accountId').value;
  if (!id) return;
  if (Number(id) === currentSession.id) {
    window.showToast('⚠️ Không thể tự vô hiệu hoá tài khoản đang đăng nhập.', '#e17055');
    return;
  }

  const acc = accounts.find(a => a.id === Number(id));
  const label = acc ? `@${acc.username}` : `ID=${id}`;

  const reason = await window.showReasonPrompt({
    title: `Vô hiệu hoá tài khoản "${label}"?`,
    message: 'Tài khoản sẽ KHÔNG đăng nhập được nữa nhưng dữ liệu vẫn được giữ nguyên — có thể "Kích hoạt lại" bất cứ lúc nào.',
    reasonLabel: 'Lý do vô hiệu hoá *',
    reasonPlaceholder: 'VD: nhân viên nghỉ việc, tạm khoá do vi phạm quy định...',
    confirmText: '🚫 Vô hiệu hoá',
    cancelText: 'Hủy',
  });
  if (reason === null) return;

  const deactivateBtn = document.getElementById('deactivateAccountBtn');
  deactivateBtn.disabled = true;
  deactivateBtn.textContent = 'Đang xử lý...';

  try {
    const { data, error } = await client.from('admin_users').update({
      is_active: false,
      deactivated_reason: reason,
      deactivated_by: currentSession.displayName || currentSession.username,
      deactivated_at: new Date().toISOString(),
    }).eq('id', id).select();
    if (error) throw error;

    const idx = accounts.findIndex(a => String(a.id) === String(id));
    if (idx !== -1 && data?.[0]) accounts[idx] = data[0];

    document.getElementById('accountModal').classList.add('hidden');
    window.showToast('🚫 Đã vô hiệu hoá tài khoản!', '#e17055');
    renderAccountsTable(accounts);
  } catch (err) {
    window.showToast('❌ Lỗi: ' + err.message, '#e17055');
  } finally {
    deactivateBtn.disabled = false;
    deactivateBtn.textContent = '🚫 Vô hiệu hoá tài khoản';
  }
}

/* ══════════════════════════════════════════════
   KÍCH HOẠT LẠI — MỚI (migration V3)
   ══════════════════════════════════════════════ */
async function reactivateAccount(id) {
  const acc = accounts.find(a => a.id === id);
  if (!acc) return;

  const ok = await window.showConfirm({
    title: `Kích hoạt lại tài khoản "@${acc.username}"?`,
    message: 'Tài khoản sẽ đăng nhập được trở lại ngay sau khi kích hoạt.',
    confirmText: '♻️ Kích hoạt lại',
    cancelText: 'Huỷ',
    danger: false,
  });
  if (!ok) return;

  try {
    const { data, error } = await client.from('admin_users').update({
      is_active: true,
      deactivated_reason: null,
      deactivated_by: null,
      deactivated_at: null,
    }).eq('id', id).select();
    if (error) throw error;

    const idx = accounts.findIndex(a => a.id === id);
    if (idx !== -1 && data?.[0]) accounts[idx] = data[0];

    window.showToast('✅ Đã kích hoạt lại tài khoản!');
    renderAccountsTable(accounts);
  } catch (err) {
    window.showToast('❌ Lỗi: ' + err.message, '#e17055');
  }
}

function bindAccountEvents() {
  document.getElementById('addAccountBtn')?.addEventListener('click', openAddAccount);
  document.getElementById('accountsRefreshBtn')?.addEventListener('click', loadAccounts);
  document.getElementById('closeAccountModalBtn')?.addEventListener('click', () =>
    document.getElementById('accountModal').classList.add('hidden'));
  document.getElementById('accountModal')?.addEventListener('click', e => {
    if (e.target === document.getElementById('accountModal')) e.target.classList.add('hidden');
  });
  document.getElementById('accountModal')?.addEventListener('keydown', e => {
    if (e.key === 'Escape') document.getElementById('accountModal').classList.add('hidden');
  });
  document.getElementById('saveAccountBtn')?.addEventListener('click', saveAccount);
  document.getElementById('deactivateAccountBtn')?.addEventListener('click', deactivateAccount);

  bindSearch();
}
