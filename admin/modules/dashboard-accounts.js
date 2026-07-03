/* ══════════════════════════════════════════════
   DASHBOARD ACCOUNTS MODULE — admin/modules/dashboard-accounts.js
   ─────────────────────────────────────────────
   THAY ĐỔI so với bản trước:
   - Thêm role "Bar Staff" (barstaff) vào select chọn vai trò.
   - isSuperAdmin / roleLabel / roleBg giờ đọc từ
     window.AdminPermissions (nơi DUY NHẤT định nghĩa role)
     thay vì so sánh chuỗi thủ công.
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
      <input type="text" id="accountSearchInput" placeholder="🔍 Tìm theo tên đăng nhập / tên hiển thị..." class="search-input">
    </div>

    <div class="table-card">
      <div id="accountsLoadingMsg" class="loading-msg">⏳ Đang tải dữ liệu...</div>
      <div id="accountsErrorMsg" class="error-msg hidden"></div>
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

    <div class="modal-overlay hidden" id="accountModal">
      <div class="modal-box" style="max-width:480px;">
        <div class="modal-header">
          <h2 id="accountModalTitle">Thêm tài khoản</h2>
          <button class="close-btn" id="closeAccountModalBtn">✕</button>
        </div>

        <input type="hidden" id="accountId">

        <div class="form-grid" style="grid-template-columns:1fr;">
          <div class="form-group">
            <label>Tên đăng nhập *</label>
            <input type="text" id="accountUsername" placeholder="ten.dangnhap" autocomplete="off" autocapitalize="none">
          </div>
          <div class="form-group">
            <label>Tên hiển thị</label>
            <input type="text" id="accountDisplayName" placeholder="Nguyễn Văn A" autocomplete="off">
          </div>
          <div class="form-group">
            <label id="accountPasswordLabel">Mật khẩu *</label>
            <input type="password" id="accountPassword" placeholder="••••••••" autocomplete="new-password">
            <div class="hint" id="accountPasswordHint">Mật khẩu sẽ được mã hoá (hash) tự động trước khi lưu.</div>
          </div>
          <div class="form-group">
            <label>Vai trò *</label>
            <select id="accountRole" style="height:44px;border-radius:10px;border:1px solid var(--border);padding:0 14px;font-size:14px;font-family:'Inter',sans-serif;color:var(--text);outline:none;background:var(--card);">
              <option value="editor">Editor — chỉnh sửa nội dung</option>
              <option value="barstaff">Bar Staff — chỉ xem, phục vụ quầy</option>
              <option value="superadmin">Super Admin — toàn quyền + quản lý tài khoản</option>
            </select>
          </div>
        </div>

        <div class="modal-actions">
          <button class="btn btn-danger" id="deleteAccountBtn" style="display:none;">🗑️ Xóa tài khoản</button>
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
    .select('id, username, display_name, role, last_login')
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

    return `<tr>
      <td>
        <div class="game-info">
          <div style="width:40px;height:40px;border-radius:50%;background:${roleBg};display:flex;align-items:center;justify-content:center;font-size:16px;font-weight:700;color:#fff;flex-shrink:0;">${window.escHtml(initial)}</div>
          <div>
            <div class="game-name">${window.escHtml(acc.display_name || acc.username)}${isSelf ? ' <span style="font-size:11px;color:var(--text-muted);font-weight:500;">(bạn)</span>' : ''}</div>
            <div class="game-id">@${window.escHtml(acc.username)}</div>
          </div>
        </div>
      </td>
      <td><span class="badge" style="background:${roleBg}22;color:${roleBg};">${window.escHtml(roleLabel)}</span></td>
      <td>${fmtLastLogin(acc.last_login)}</td>
      <td>
        <div style="display:flex;gap:8px;align-items:center;">
          <button class="btn btn-primary edit-account-btn" data-id="${acc.id}">✏️ Sửa</button>
        </div>
      </td>
    </tr>`;
  }).join('');
}

let _accSearchTimer;
function bindSearch() {
  const input = document.getElementById('accountSearchInput');
  input?.addEventListener('input', e => {
    clearTimeout(_accSearchTimer);
    _accSearchTimer = setTimeout(() => {
      const v = e.target.value.toLowerCase();
      renderAccountsTable(accounts.filter(a =>
        (a.username || '').toLowerCase().includes(v) ||
        (a.display_name || '').toLowerCase().includes(v)
      ));
    }, 200);
  });
}

function clearAccountForm() {
  document.getElementById('accountId').value = '';
  document.getElementById('accountUsername').value = '';
  document.getElementById('accountUsername').disabled = false;
  document.getElementById('accountDisplayName').value = '';
  document.getElementById('accountPassword').value = '';
  document.getElementById('accountRole').value = 'editor';
}

function openAddAccount() {
  clearAccountForm();
  document.getElementById('accountModalTitle').textContent = '➕ Thêm tài khoản';
  document.getElementById('accountPasswordLabel').textContent = 'Mật khẩu *';
  document.getElementById('accountPasswordHint').textContent = 'Mật khẩu sẽ được mã hoá (hash) tự động trước khi lưu.';
  document.getElementById('deleteAccountBtn').style.display = 'none';
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

  const delBtn = document.getElementById('deleteAccountBtn');
  delBtn.style.display = acc.id === currentSession.id ? 'none' : 'inline-flex';
  document.getElementById('accountModal').classList.remove('hidden');
}

async function saveAccount() {
  const rawId       = document.getElementById('accountId').value;
  const id          = rawId ? Number(rawId) : null;
  const username    = document.getElementById('accountUsername').value.trim();
  const displayName = document.getElementById('accountDisplayName').value.trim();
  const password    = document.getElementById('accountPassword').value;
  const role        = document.getElementById('accountRole').value;

  if (!id && !username) { alert('Vui lòng nhập tên đăng nhập.'); return; }
  if (!id && !password) { alert('Vui lòng nhập mật khẩu cho tài khoản mới.'); return; }

  const saveBtn = document.getElementById('saveAccountBtn');
  saveBtn.disabled = true;
  saveBtn.textContent = 'Đang lưu...';

  try {
    if (!id) {
      const { data: existing } = await client
        .from('admin_users').select('id').eq('username', username).maybeSingle();
      if (existing) throw new Error('Tên đăng nhập đã tồn tại.');

      const payload = {
        username,
        display_name: displayName || username,
        password_hash: await sha256(password),
        role,
      };
      const { error } = await client.from('admin_users').insert(payload).select();
      if (error) throw error;
    } else {
      const payload = { display_name: displayName, role };
      if (password) payload.password_hash = await sha256(password);

      const { data, error } = await client.from('admin_users').update(payload).eq('id', id).select();
      if (error) throw error;
      if (!data?.length) throw new Error(`UPDATE không ảnh hưởng dòng nào (id=${id}).`);
    }

    document.getElementById('accountModal').classList.add('hidden');
    await loadAccounts();
    window.showToast('✅ Đã lưu tài khoản thành công!');
  } catch (err) {
    alert('❌ Lỗi khi lưu:\n\n' + err.message);
  } finally {
    saveBtn.disabled = false;
    saveBtn.textContent = '💾 Lưu';
  }
}

async function deleteAccount() {
  const id = document.getElementById('accountId').value;
  if (!id) return;
  if (Number(id) === currentSession.id) { alert('Không thể tự xóa tài khoản đang đăng nhập.'); return; }

  const acc = accounts.find(a => a.id === Number(id));
  const label = acc ? `@${acc.username}` : `ID=${id}`;
  if (!confirm(`Xóa tài khoản "${label}"?\n\nHành động này không thể hoàn tác!`)) return;

  const delBtn = document.getElementById('deleteAccountBtn');
  delBtn.disabled = true;
  delBtn.textContent = 'Đang xóa...';

  try {
    const { error } = await client.from('admin_users').delete().eq('id', id);
    if (error) throw error;
    document.getElementById('accountModal').classList.add('hidden');
    window.showToast('🗑️ Đã xóa tài khoản!', '#e17055');
    await loadAccounts();
  } catch (err) {
    alert('Lỗi: ' + err.message);
  } finally {
    delBtn.disabled = false;
    delBtn.textContent = '🗑️ Xóa tài khoản';
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
  document.getElementById('saveAccountBtn')?.addEventListener('click', saveAccount);
  document.getElementById('deleteAccountBtn')?.addEventListener('click', deleteAccount);

  document.getElementById('accountsTableBody')?.addEventListener('click', e => {
    const btn = e.target.closest('.edit-account-btn');
    if (!btn) return;
    openEditAccount(Number(btn.dataset.id));
  });

  bindSearch();
}
