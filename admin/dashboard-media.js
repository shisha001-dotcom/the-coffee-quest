/* ══════════════════════════════════════════════
   DASHBOARD MEDIA LIBRARY MODULE
   File: admin/dashboard-media.js

   Chức năng:
   - Lưu trữ danh sách ảnh (URL) dùng làm banner / poster
   - Ai cũng thêm được link mới (mọi role đã đăng nhập)
   - Chỉ superadmin mới được xóa
   - Xem trước ảnh + copy link + tải ảnh xuống máy

   Bảng Supabase cần tạo: media_library
   (xem SQL trong README.md hoặc phần chú thích cuối file)
   ══════════════════════════════════════════════ */

/* ── Supabase client + currentSession dùng lại từ dashboard.js ── */
const isSuperAdminMedia = currentSession.role === 'superadmin';

/* ══════════════════════════════════════════════
   INJECT MENU ITEM — ai cũng thấy (thêm được),
   chỉ khác là nút xóa sẽ ẩn/hiện theo role bên trong trang
   ══════════════════════════════════════════════ */
(function injectMediaMenu() {
  const tryInject = () => {
    const menuGroups = document.querySelectorAll('.menu-group');
    if (!menuGroups.length) { setTimeout(tryInject, 100); return; }
    const target = menuGroups[1] || menuGroups[0];
    const item = document.createElement('a');
    item.className = 'menu-item';
    item.id        = 'mediaMenuItem';
    item.style.cssText = 'cursor:pointer;';
    item.innerHTML = `<span>🗂️</span> Thư viện Media`;
    item.addEventListener('click', () => showMediaPage());

    /* chèn trước mục "Cộng đồng" (nếu có) để giữ thứ tự Banners → Media → Cộng đồng → Settings */
    const chatItem = target.querySelector('#chatMenuItemPlaceholder');
    if (chatItem) target.insertBefore(item, chatItem);
    else target.appendChild(item);
  };
  tryInject();
})();

/* ══════════════════════════════════════════════
   INJECT PAGE HTML
   ══════════════════════════════════════════════ */
(function injectMediaPage() {
  const main = document.querySelector('.main-content');
  if (!main) return;

  const page = document.createElement('div');
  page.id = 'mediaPage';
  page.style.display = 'none';

  page.innerHTML = `
    <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:22px;flex-wrap:wrap;gap:12px;">
      <div>
        <h1 style="font-size:26px;font-weight:700;color:var(--text)">🗂️ Thư viện Media</h1>
        <p style="font-size:14px;color:var(--text-muted);margin-top:4px">Lưu link ảnh banner/poster để dễ dàng copy hoặc tải xuống đăng mạng xã hội</p>
      </div>
    </div>

    <!-- ── Form thêm link mới ── -->
    <div style="background:var(--card);border:1px solid var(--border);border-radius:var(--radius);box-shadow:var(--shadow);padding:20px 22px;margin-bottom:26px;">
      <div style="font-size:14px;font-weight:700;color:var(--text);margin-bottom:14px;">➕ Thêm ảnh mới</div>
      <div style="display:grid;grid-template-columns:2fr 1fr auto;gap:14px;align-items:flex-end;">

        <div style="display:flex;flex-direction:column;gap:6px;">
          <label style="font-size:12px;font-weight:700;color:var(--text-muted);text-transform:uppercase;letter-spacing:.6px;">URL ảnh *</label>
          <input type="text" id="mediaUrlInput" placeholder="https://..."
            style="height:44px;border:1.5px solid var(--border);border-radius:10px;padding:0 14px;font-size:14px;font-family:'Inter',sans-serif;color:var(--text);outline:none;">
        </div>

        <div style="display:flex;flex-direction:column;gap:6px;">
          <label style="font-size:12px;font-weight:700;color:var(--text-muted);text-transform:uppercase;letter-spacing:.6px;">Ghi chú (tuỳ chọn)</label>
          <input type="text" id="mediaLabelInput" placeholder="VD: Banner sự kiện Noel"
            style="height:44px;border:1.5px solid var(--border);border-radius:10px;padding:0 14px;font-size:14px;font-family:'Inter',sans-serif;color:var(--text);outline:none;">
        </div>

        <button id="mediaAddBtn" class="btn btn-primary" style="height:44px;white-space:nowrap;" onclick="addMedia()">➕ Thêm vào thư viện</button>
      </div>

      <!-- Live preview khi gõ URL -->
      <div id="mediaAddPreviewWrap" style="display:none;margin-top:16px;">
        <div style="font-size:12px;font-weight:700;color:var(--text-muted);text-transform:uppercase;letter-spacing:.6px;margin-bottom:8px;">Xem trước</div>
        <div id="mediaAddPreview" style="width:220px;height:120px;border-radius:10px;border:1.5px solid var(--border);overflow:hidden;background:var(--bg);display:flex;align-items:center;justify-content:center;"></div>
      </div>
    </div>

    <div id="mediaMsg" style="display:none;margin-bottom:20px;padding:12px 18px;border-radius:10px;font-size:14px;font-weight:600;"></div>

    <!-- ── Grid danh sách ── -->
    <div id="mediaGrid" style="display:grid;grid-template-columns:repeat(auto-fill,minmax(260px,1fr));gap:18px;"></div>

    <div id="mediaEmptyState" style="display:none;text-align:center;padding:60px 20px;color:var(--text-muted);">
      <div style="font-size:40px;margin-bottom:10px;">🖼️</div>
      <div style="font-size:14px;">Chưa có ảnh nào trong thư viện — thêm link đầu tiên ở form phía trên</div>
    </div>

    <div style="background:var(--card);border:1px solid var(--border);border-radius:var(--radius);padding:20px 24px;margin-top:28px;">
      <div style="font-size:13px;font-weight:700;color:var(--text);margin-bottom:10px;">📌 Lưu ý</div>
      <ul style="font-size:13px;color:var(--text-muted);display:flex;flex-direction:column;gap:6px;padding-left:16px;">
        <li>Mọi tài khoản đăng nhập đều có thể <strong>thêm</strong> link ảnh mới</li>
        <li>Chỉ tài khoản <strong>Super Admin</strong> mới có thể <strong>xóa</strong> ảnh khỏi thư viện</li>
        <li>Nút <strong>📋 Copy link</strong> để dán nhanh vào ô banner; nút <strong>⬇️ Tải xuống</strong> để lưu ảnh về máy đăng lên mạng xã hội</li>
        <li>Dữ liệu lưu vào bảng <code style="background:#f1f5f9;padding:1px 6px;border-radius:4px">media_library</code> trên Supabase</li>
      </ul>
    </div>
  `;

  main.appendChild(page);

  /* live preview khi gõ URL ở form thêm mới */
  const urlInput = page.querySelector('#mediaUrlInput');
  urlInput.addEventListener('input', () => {
    const url = urlInput.value.trim();
    const wrap = page.querySelector('#mediaAddPreviewWrap');
    const box  = page.querySelector('#mediaAddPreview');
    if (!url) { wrap.style.display = 'none'; return; }
    wrap.style.display = 'block';
    box.innerHTML = `<img src="${escMediaAttr(url)}" alt="Preview"
        style="width:100%;height:100%;object-fit:cover;display:block;"
        onerror="this.parentElement.innerHTML='<span style=\\'font-size:11px;color:var(--text-muted);text-align:center;padding:8px;\\'>⚠️ Không tải được ảnh — kiểm tra lại URL</span>'">`;
  });

  loadMedia();
})();

/* ══════════════════════════════════════════════
   STATE
   ══════════════════════════════════════════════ */
let mediaList = [];

/* ══════════════════════════════════════════════
   SHOW PAGE
   ══════════════════════════════════════════════ */
window.showMediaPage = function () {
  if (typeof window.__showPage === 'function') {
    window.__showPage('mediaPage');
  } else {
    ['dashboardPage','boardgamesPage','drinksPage','analyticsPage','chatAdminPage','bannersPage','accountsPage']
      .forEach(id => { const el = document.getElementById(id); if (el) el.style.display = 'none'; });
    document.getElementById('mediaPage').style.display = '';
  }
  document.querySelectorAll('.menu-item, .menu-item-parent').forEach(el => el.classList.remove('active'));
  document.getElementById('mediaMenuItem')?.classList.add('active');
};

/* ══════════════════════════════════════════════
   LOAD
   ══════════════════════════════════════════════ */
async function loadMedia() {
  try {
    const { data, error } = await client
      .from('media_library')
      .select('*')
      .order('created_at', { ascending: false });
    if (error) throw error;
    mediaList = data || [];
  } catch (err) {
    console.warn('loadMedia:', err.message);
    mediaList = [];
    showMediaMsg('❌ Không tải được thư viện: ' + err.message, 'error');
  }
  renderMediaGrid();
}

/* ══════════════════════════════════════════════
   RENDER
   ══════════════════════════════════════════════ */
function renderMediaGrid() {
  const grid  = document.getElementById('mediaGrid');
  const empty = document.getElementById('mediaEmptyState');
  if (!grid) return;

  if (!mediaList.length) {
    grid.innerHTML = '';
    if (empty) empty.style.display = 'block';
    return;
  }
  if (empty) empty.style.display = 'none';

  grid.innerHTML = mediaList.map(m => `
    <div style="background:var(--card);border:1px solid var(--border);border-radius:var(--radius);overflow:hidden;box-shadow:var(--shadow);display:flex;flex-direction:column;">

      <div style="width:100%;height:150px;background:var(--bg);display:flex;align-items:center;justify-content:center;overflow:hidden;">
        <img src="${escMediaAttr(m.url)}" alt="${escMediaAttr(m.label || 'media')}"
          style="width:100%;height:100%;object-fit:cover;display:block;"
          onerror="this.parentElement.innerHTML='<span style=\\'font-size:11px;color:var(--text-muted);text-align:center;padding:8px;\\'>⚠️ Không tải được ảnh</span>'">
      </div>

      <div style="padding:14px 16px;display:flex;flex-direction:column;gap:8px;flex:1;">
        <div style="font-size:13px;font-weight:700;color:var(--text);min-height:18px;">
          ${m.label ? escMediaAttr(m.label) : '<span style="color:var(--text-muted);font-weight:500;">Không có ghi chú</span>'}
        </div>

        <div title="${escMediaAttr(m.url)}"
          style="font-size:11px;color:var(--text-muted);background:var(--bg);border:1px solid var(--border);border-radius:6px;padding:6px 8px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;font-family:monospace;">
          ${escMediaAttr(m.url)}
        </div>

        <div style="font-size:10px;color:var(--text-muted);">
          ${m.added_by ? '👤 ' + escMediaAttr(m.added_by) + ' · ' : ''}${formatMediaDate(m.created_at)}
        </div>

        <div style="display:flex;gap:8px;margin-top:auto;padding-top:6px;flex-wrap:wrap;">
          <button class="btn" data-media-copy="${m.id}"
            style="flex:1;min-width:90px;height:36px;font-size:12px;border:1px solid var(--border);background:var(--bg);border-radius:8px;cursor:pointer;">📋 Copy</button>
          <button class="btn" data-media-download="${m.id}"
            style="flex:1;min-width:90px;height:36px;font-size:12px;border:1px solid var(--border);background:var(--bg);border-radius:8px;cursor:pointer;">⬇️ Tải xuống</button>
          ${isSuperAdminMedia
            ? `<button class="btn btn-danger" data-media-delete="${m.id}"
                style="height:36px;width:36px;font-size:14px;border-radius:8px;cursor:pointer;flex-shrink:0;">🗑️</button>`
            : ''
          }
        </div>
      </div>
    </div>
  `).join('');

  attachMediaEvents();
}

/* ══════════════════════════════════════════════
   EVENTS
   ══════════════════════════════════════════════ */
function attachMediaEvents() {
  document.querySelectorAll('[data-media-copy]').forEach(btn => {
    btn.addEventListener('click', () => {
      const item = mediaList.find(m => String(m.id) === btn.dataset.mediaCopy);
      if (item) copyMediaLink(item.url);
    });
  });
  document.querySelectorAll('[data-media-download]').forEach(btn => {
    btn.addEventListener('click', () => {
      const item = mediaList.find(m => String(m.id) === btn.dataset.mediaDownload);
      if (item) downloadMedia(item.url, item.label);
    });
  });
  document.querySelectorAll('[data-media-delete]').forEach(btn => {
    btn.addEventListener('click', () => {
      const item = mediaList.find(m => String(m.id) === btn.dataset.mediaDelete);
      if (item) deleteMedia(item.id);
    });
  });
}

/* ══════════════════════════════════════════════
   ADD
   ══════════════════════════════════════════════ */
window.addMedia = async function () {
  const urlInput   = document.getElementById('mediaUrlInput');
  const labelInput = document.getElementById('mediaLabelInput');
  const btn        = document.getElementById('mediaAddBtn');

  const url   = urlInput.value.trim();
  const label = labelInput.value.trim();

  if (!url) { showMediaMsg('⚠️ Vui lòng nhập URL ảnh', 'error'); urlInput.focus(); return; }
  try { new URL(url); } catch { showMediaMsg('⚠️ URL không hợp lệ', 'error'); urlInput.focus(); return; }

  btn.disabled = true; btn.textContent = 'Đang thêm...';
  try {
    const { error } = await client.from('media_library').insert({
      url,
      label: label || null,
      added_by: currentSession.displayName || currentSession.username,
    });
    if (error) throw error;

    urlInput.value = '';
    labelInput.value = '';
    document.getElementById('mediaAddPreviewWrap').style.display = 'none';

    showMediaMsg('✅ Đã thêm ảnh vào thư viện!', 'success');
    await loadMedia();
  } catch (err) {
    showMediaMsg('❌ Lỗi: ' + err.message, 'error');
  } finally {
    btn.disabled = false; btn.textContent = '➕ Thêm vào thư viện';
  }
};

/* ══════════════════════════════════════════════
   DELETE — chỉ superadmin (double-guard: UI + hàm)
   ══════════════════════════════════════════════ */
async function deleteMedia(id) {
  if (!isSuperAdminMedia) {
    showMediaMsg('⛔ Chỉ Super Admin mới có quyền xóa', 'error');
    return;
  }
  if (!confirm('Xóa ảnh này khỏi thư viện? Hành động không thể hoàn tác.')) return;

  try {
    const { error } = await client.from('media_library').delete().eq('id', id);
    if (error) throw error;
    showMediaMsg('🗑️ Đã xóa ảnh khỏi thư viện', 'success');
    await loadMedia();
  } catch (err) {
    showMediaMsg('❌ Lỗi khi xóa: ' + err.message, 'error');
  }
}

/* ══════════════════════════════════════════════
   COPY LINK
   ══════════════════════════════════════════════ */
async function copyMediaLink(url) {
  try {
    await navigator.clipboard.writeText(url);
    showMediaMsg('📋 Đã copy link ảnh!', 'success');
  } catch {
    /* fallback cho trình duyệt cũ / không có quyền clipboard */
    const ta = document.createElement('textarea');
    ta.value = url;
    document.body.appendChild(ta);
    ta.select();
    document.execCommand('copy');
    ta.remove();
    showMediaMsg('📋 Đã copy link ảnh!', 'success');
  }
}

/* ══════════════════════════════════════════════
   DOWNLOAD — fetch blob rồi tải, fallback mở tab mới nếu bị chặn CORS
   ══════════════════════════════════════════════ */
async function downloadMedia(url, label) {
  try {
    const res = await fetch(url, { mode: 'cors' });
    if (!res.ok) throw new Error('fetch failed');
    const blob = await res.blob();
    const blobUrl = URL.createObjectURL(blob);
    const ext = guessMediaExt(url, blob.type);
    const a = document.createElement('a');
    a.href = blobUrl;
    a.download = (slugifyMedia(label) || 'the-coffee-quest-media') + ext;
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(blobUrl);
    showMediaMsg('⬇️ Đã tải ảnh xuống!', 'success');
  } catch (err) {
    window.open(url, '_blank');
    showMediaMsg('⚠️ Không tải trực tiếp được (ảnh chặn CORS) — đã mở ảnh ở tab mới, bấm chuột phải → "Lưu ảnh"', 'error');
  }
}

/* ══════════════════════════════════════════════
   HELPERS
   ══════════════════════════════════════════════ */
function showMediaMsg(text, type) {
  const el = document.getElementById('mediaMsg');
  if (!el) return;
  el.textContent = text;
  el.style.display = 'block';
  if (type === 'success') {
    el.style.background = '#e6f9f5';
    el.style.color      = '#00b894';
    el.style.border     = '1px solid #00b89444';
  } else {
    el.style.background = '#fff5f5';
    el.style.color      = '#e17055';
    el.style.border     = '1px solid #e1705544';
  }
  clearTimeout(el._timer);
  el._timer = setTimeout(() => { el.style.display = 'none'; }, 4000);
}

function formatMediaDate(iso) {
  if (!iso) return '';
  try {
    const d = new Date(iso);
    return d.toLocaleDateString('vi-VN', { day: '2-digit', month: '2-digit', year: 'numeric' });
  } catch { return ''; }
}

function guessMediaExt(url, mimeType) {
  const fromMime = { 'image/jpeg': '.jpg', 'image/png': '.png', 'image/webp': '.webp', 'image/gif': '.gif', 'image/svg+xml': '.svg' };
  if (mimeType && fromMime[mimeType]) return fromMime[mimeType];
  const m = url.split('?')[0].match(/\.(jpg|jpeg|png|webp|gif|svg)$/i);
  return m ? '.' + m[1].toLowerCase() : '.jpg';
}

function slugifyMedia(s) {
  if (!s) return '';
  return s.toString().trim().toLowerCase()
    .normalize('NFD').replace(/[\u0300-\u036f]/g, '')
    .replace(/đ/g, 'd').replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '');
}

function escMediaAttr(s) {
  return String(s || '')
    .replace(/&/g, '&amp;')
    .replace(/"/g, '&quot;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
}

/* ══════════════════════════════════════════════
   SQL — chạy 1 lần trong Supabase SQL Editor:

   create table if not exists media_library (
     id         bigint generated always as identity primary key,
     url        text not null,
     label      text,
     added_by   text,
     created_at timestamptz not null default now()
   );

   -- Bảng này dùng chung anon key như các bảng games/drinks hiện có
   -- (phân quyền thêm/xóa được kiểm soát ở giao diện dashboard,
   --  giống cơ chế đang áp dụng cho toàn bộ admin panel).
   ══════════════════════════════════════════════ */
