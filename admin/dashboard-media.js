/* ══════════════════════════════════════════════
   DASHBOARD MEDIA LIBRARY MODULE
   File: admin/dashboard-media.js

   Chức năng:
   - Lưu trữ danh sách ảnh (URL) dùng làm banner / poster
   - Tự động nhận diện link Google Drive → chuyển sang link ảnh trực tiếp
   - Gắn tag + tìm kiếm/lọc theo tag hoặc từ khóa ghi chú
   - Ai cũng thêm được link mới (mọi role đã đăng nhập)
   - Chỉ superadmin mới được xóa
   - Xem trước ảnh + copy link + tải ảnh xuống máy

   Bảng Supabase cần tạo: media_library
   (xem SQL trong phần chú thích cuối file)
   ══════════════════════════════════════════════ */

/* ── Supabase client + currentSession dùng lại từ dashboard.js ── */
const isSuperAdminMedia = currentSession.role === 'superadmin';

/* ══════════════════════════════════════════════
   INJECT MENU ITEM
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
      <div style="display:grid;grid-template-columns:1.6fr 1fr auto;gap:14px;align-items:flex-end;">

        <div style="display:flex;flex-direction:column;gap:6px;">
          <label style="font-size:12px;font-weight:700;color:var(--text-muted);text-transform:uppercase;letter-spacing:.6px;">URL ảnh *</label>
          <input type="text" id="mediaUrlInput" placeholder="https://... (dán cả link Google Drive cũng được)"
            style="height:44px;border:1.5px solid var(--border);border-radius:10px;padding:0 14px;font-size:14px;font-family:'Inter',sans-serif;color:var(--text);outline:none;">
        </div>

        <div style="display:flex;flex-direction:column;gap:6px;">
          <label style="font-size:12px;font-weight:700;color:var(--text-muted);text-transform:uppercase;letter-spacing:.6px;">Ghi chú (tuỳ chọn)</label>
          <input type="text" id="mediaLabelInput" placeholder="VD: Banner sự kiện Noel"
            style="height:44px;border:1.5px solid var(--border);border-radius:10px;padding:0 14px;font-size:14px;font-family:'Inter',sans-serif;color:var(--text);outline:none;">
        </div>

        <button id="mediaAddBtn" class="btn btn-primary" style="height:44px;white-space:nowrap;" onclick="addMedia()">➕ Thêm vào thư viện</button>
      </div>

      <div style="display:flex;flex-direction:column;gap:6px;margin-top:14px;">
        <label style="font-size:12px;font-weight:700;color:var(--text-muted);text-transform:uppercase;letter-spacing:.6px;">Tag (phân cách bằng dấu phẩy)</label>
        <input type="text" id="mediaTagsInput" placeholder="VD: banner, noel, sukien"
          style="height:44px;border:1.5px solid var(--border);border-radius:10px;padding:0 14px;font-size:14px;font-family:'Inter',sans-serif;color:var(--text);outline:none;max-width:480px;">
      </div>

      <!-- Thông báo tự động chuyển link Google Drive -->
      <div id="mediaGDriveHint" style="display:none;margin-top:12px;font-size:12px;color:#0984e3;background:#e8f3ff;border:1px solid #0984e344;border-radius:8px;padding:8px 12px;">
        🔄 Đã phát hiện link Google Drive — sẽ tự động chuyển sang link ảnh trực tiếp khi thêm.
      </div>

      <!-- Live preview khi gõ URL -->
      <div id="mediaAddPreviewWrap" style="display:none;margin-top:16px;">
        <div style="font-size:12px;font-weight:700;color:var(--text-muted);text-transform:uppercase;letter-spacing:.6px;margin-bottom:8px;">Xem trước</div>
        <div id="mediaAddPreview" style="width:220px;height:120px;border-radius:10px;border:1.5px solid var(--border);overflow:hidden;background:var(--bg);display:flex;align-items:center;justify-content:center;"></div>
      </div>
    </div>

    <div id="mediaMsg" style="display:none;margin-bottom:20px;padding:12px 18px;border-radius:10px;font-size:14px;font-weight:600;"></div>

    <!-- ── Tìm kiếm + lọc tag ── -->
    <div style="display:flex;gap:12px;flex-wrap:wrap;align-items:center;margin-bottom:14px;">
      <input type="text" id="mediaSearchInput" placeholder="🔍 Tìm theo ghi chú, URL hoặc tag..."
        style="flex:1;min-width:220px;height:42px;border:1.5px solid var(--border);border-radius:10px;padding:0 14px;font-size:14px;font-family:'Inter',sans-serif;color:var(--text);outline:none;">
    </div>
    <div id="mediaTagFilterWrap" style="display:flex;gap:8px;flex-wrap:wrap;margin-bottom:20px;"></div>

    <!-- ── Grid danh sách ── -->
    <div id="mediaGrid" style="display:grid;grid-template-columns:repeat(auto-fill,minmax(260px,1fr));gap:18px;"></div>

    <div id="mediaEmptyState" style="display:none;text-align:center;padding:60px 20px;color:var(--text-muted);">
      <div style="font-size:40px;margin-bottom:10px;">🖼️</div>
      <div id="mediaEmptyStateText" style="font-size:14px;">Chưa có ảnh nào trong thư viện — thêm link đầu tiên ở form phía trên</div>
    </div>

    <div style="background:var(--card);border:1px solid var(--border);border-radius:var(--radius);padding:20px 24px;margin-top:28px;">
      <div style="font-size:13px;font-weight:700;color:var(--text);margin-bottom:10px;">📌 Lưu ý</div>
      <ul style="font-size:13px;color:var(--text-muted);display:flex;flex-direction:column;gap:6px;padding-left:16px;">
        <li>Dán link Google Drive (dạng .../file/d/ID/view) → hệ thống <strong>tự động chuyển</strong> sang link ảnh trực tiếp, nhớ để chế độ chia sẻ file là "Anyone with the link"</li>
        <li>Mọi tài khoản đăng nhập đều có thể <strong>thêm</strong> link ảnh mới; chỉ <strong>Super Admin</strong> mới <strong>xóa</strong> được</li>
        <li>Gắn tag để lọc nhanh (VD: banner, poster, sukien, noel...) — bấm vào tag trên thẻ ảnh để lọc nhanh theo tag đó</li>
        <li>Dữ liệu lưu vào bảng <code style="background:#f1f5f9;padding:1px 6px;border-radius:4px">media_library</code> trên Supabase</li>
      </ul>
    </div>
  `;

  main.appendChild(page);

  /* live preview + phát hiện Google Drive khi gõ URL ở form thêm mới */
  const urlInput = page.querySelector('#mediaUrlInput');
  urlInput.addEventListener('input', () => {
    updateAddPreview(urlInput.value.trim());
  });
  /* tự chuyển link Google Drive ngay khi rời khỏi ô nhập, để người dùng thấy trước link đã đổi */
  urlInput.addEventListener('blur', () => {
    const converted = convertGDriveUrl(urlInput.value.trim());
    if (converted && converted !== urlInput.value.trim()) {
      urlInput.value = converted;
      updateAddPreview(converted);
    }
  });

  /* tìm kiếm */
  const searchInput = page.querySelector('#mediaSearchInput');
  searchInput.addEventListener('input', () => {
    mediaSearchQuery = searchInput.value;
    renderMediaGrid();
  });

  loadMedia();
})();

function updateAddPreview(url) {
  const hint = document.getElementById('mediaGDriveHint');
  const wrap = document.getElementById('mediaAddPreviewWrap');
  const box  = document.getElementById('mediaAddPreview');

  hint.style.display = (url && isGDriveUrl(url) && !isDirectGDriveUrl(url)) ? 'block' : 'none';

  const previewUrl = convertGDriveUrl(url) || url;
  if (!previewUrl) { wrap.style.display = 'none'; return; }
  wrap.style.display = 'block';
  box.innerHTML = `<img src="${escMediaAttr(previewUrl)}" alt="Preview"
      style="width:100%;height:100%;object-fit:cover;display:block;"
      onerror="this.parentElement.innerHTML='<span style=\\'font-size:11px;color:var(--text-muted);text-align:center;padding:8px;\\'>⚠️ Không tải được ảnh — kiểm tra lại URL / quyền chia sẻ</span>'">`;
}

/* ══════════════════════════════════════════════
   STATE
   ══════════════════════════════════════════════ */
let mediaList = [];
let mediaSearchQuery = '';
let mediaActiveTag = null;

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
   GOOGLE DRIVE — nhận diện & tự chuyển sang link ảnh trực tiếp
   ══════════════════════════════════════════════ */
function isGDriveUrl(url) {
  return /drive\.google\.com|googleusercontent\.com/i.test(url || '');
}
function isDirectGDriveUrl(url) {
  return /^https:\/\/lh3\.googleusercontent\.com\/d\//i.test(url || '');
}
/* Trả về link ảnh trực tiếp nếu nhận diện được link Google Drive, ngược lại trả về null */
function convertGDriveUrl(url) {
  if (!url) return null;
  url = url.trim();

  if (isDirectGDriveUrl(url)) return url; // đã đúng định dạng rồi

  let fileId = null;
  let m;

  // https://drive.google.com/file/d/FILE_ID/view?usp=sharing
  m = url.match(/drive\.google\.com\/file\/d\/([a-zA-Z0-9_-]+)/);
  if (m) fileId = m[1];

  // https://drive.google.com/open?id=FILE_ID
  if (!fileId) {
    m = url.match(/drive\.google\.com\/open\?.*[?&]id=([a-zA-Z0-9_-]+)/) || url.match(/drive\.google\.com\/open\?id=([a-zA-Z0-9_-]+)/);
    if (m) fileId = m[1];
  }

  // https://drive.google.com/uc?id=FILE_ID&export=download  (hoặc export=view)
  if (!fileId) {
    m = url.match(/drive\.google\.com\/uc\?.*[?&]id=([a-zA-Z0-9_-]+)/);
    if (m) fileId = m[1];
  }

  // fallback: bất kỳ id=FILE_ID nào trong URL drive
  if (!fileId && isGDriveUrl(url)) {
    m = url.match(/[?&]id=([a-zA-Z0-9_-]+)/);
    if (m) fileId = m[1];
  }

  if (!fileId) return null;
  return `https://lh3.googleusercontent.com/d/${fileId}`;
}

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
    mediaList = (data || []).map(m => ({ ...m, tags: Array.isArray(m.tags) ? m.tags : [] }));
  } catch (err) {
    console.warn('loadMedia:', err.message);
    mediaList = [];
    showMediaMsg('❌ Không tải được thư viện: ' + err.message, 'error');
  }
  renderTagFilters();
  renderMediaGrid();
}

/* ══════════════════════════════════════════════
   FILTER — theo tag đang chọn + từ khóa tìm kiếm
   ══════════════════════════════════════════════ */
function getFilteredMedia() {
  const q = mediaSearchQuery.trim().toLowerCase();
  return mediaList.filter(m => {
    const matchesTag = !mediaActiveTag || (m.tags || []).includes(mediaActiveTag);
    if (!matchesTag) return false;
    if (!q) return true;
    const inLabel = (m.label || '').toLowerCase().includes(q);
    const inUrl   = (m.url || '').toLowerCase().includes(q);
    const inTags  = (m.tags || []).some(t => t.toLowerCase().includes(q));
    return inLabel || inUrl || inTags;
  });
}

/* ══════════════════════════════════════════════
   RENDER — thanh lọc tag
   ══════════════════════════════════════════════ */
function renderTagFilters() {
  const wrap = document.getElementById('mediaTagFilterWrap');
  if (!wrap) return;

  const allTags = [...new Set(mediaList.flatMap(m => m.tags || []))].sort((a, b) => a.localeCompare(b, 'vi'));

  if (!allTags.length) { wrap.innerHTML = ''; return; }

  const chip = (label, value, active) => `
    <button class="media-tag-chip" data-tag-value="${escMediaAttr(value ?? '')}"
      style="height:30px;padding:0 14px;border-radius:20px;font-size:12px;font-weight:600;cursor:pointer;
      border:1.5px solid ${active ? 'var(--primary)' : 'var(--border)'};
      background:${active ? 'var(--primary)' : 'var(--card)'};
      color:${active ? '#fff' : 'var(--text-muted)'};transition:all .15s;">
      ${escMediaAttr(label)}
    </button>`;

  wrap.innerHTML =
    chip('Tất cả', '', !mediaActiveTag) +
    allTags.map(t => chip('#' + t, t, mediaActiveTag === t)).join('');

  wrap.querySelectorAll('.media-tag-chip').forEach(btn => {
    btn.addEventListener('click', () => {
      const v = btn.dataset.tagValue;
      mediaActiveTag = v ? v : null;
      renderTagFilters();
      renderMediaGrid();
    });
  });
}

/* ══════════════════════════════════════════════
   RENDER — grid ảnh
   ══════════════════════════════════════════════ */
function renderMediaGrid() {
  const grid  = document.getElementById('mediaGrid');
  const empty = document.getElementById('mediaEmptyState');
  const emptyText = document.getElementById('mediaEmptyStateText');
  if (!grid) return;

  const filtered = getFilteredMedia();

  if (!filtered.length) {
    grid.innerHTML = '';
    if (empty) {
      empty.style.display = 'block';
      if (emptyText) {
        emptyText.textContent = mediaList.length
          ? 'Không tìm thấy ảnh phù hợp — thử từ khóa hoặc tag khác'
          : 'Chưa có ảnh nào trong thư viện — thêm link đầu tiên ở form phía trên';
      }
    }
    return;
  }
  if (empty) empty.style.display = 'none';

  grid.innerHTML = filtered.map(m => `
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

        ${(m.tags && m.tags.length) ? `
        <div style="display:flex;flex-wrap:wrap;gap:6px;">
          ${m.tags.map(t => `
            <span class="media-card-tag" data-tag-value="${escMediaAttr(t)}"
              style="font-size:10px;font-weight:700;color:var(--primary);background:#f0edff;border-radius:12px;padding:3px 9px;cursor:pointer;">#${escMediaAttr(t)}</span>
          `).join('')}
        </div>` : ''}

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
  /* bấm vào tag trên thẻ ảnh → lọc nhanh theo tag đó */
  document.querySelectorAll('.media-card-tag').forEach(el => {
    el.addEventListener('click', () => {
      mediaActiveTag = el.dataset.tagValue;
      renderTagFilters();
      renderMediaGrid();
      document.getElementById('mediaTagFilterWrap')?.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
    });
  });
}

/* ══════════════════════════════════════════════
   ADD
   ══════════════════════════════════════════════ */
window.addMedia = async function () {
  const urlInput   = document.getElementById('mediaUrlInput');
  const labelInput = document.getElementById('mediaLabelInput');
  const tagsInput  = document.getElementById('mediaTagsInput');
  const btn        = document.getElementById('mediaAddBtn');

  let url     = urlInput.value.trim();
  const label = labelInput.value.trim();
  const tags  = parseMediaTags(tagsInput.value);

  if (!url) { showMediaMsg('⚠️ Vui lòng nhập URL ảnh', 'error'); urlInput.focus(); return; }

  /* tự động chuyển link Google Drive sang link ảnh trực tiếp */
  const converted = convertGDriveUrl(url);
  const wasGDriveConverted = converted && converted !== url;
  if (converted) url = converted;

  try { new URL(url); } catch { showMediaMsg('⚠️ URL không hợp lệ', 'error'); urlInput.focus(); return; }

  btn.disabled = true; btn.textContent = 'Đang thêm...';
  try {
    const { error } = await client.from('media_library').insert({
      url,
      label: label || null,
      tags,
      added_by: currentSession.displayName || currentSession.username,
    });
    if (error) throw error;

    urlInput.value = '';
    labelInput.value = '';
    tagsInput.value = '';
    document.getElementById('mediaAddPreviewWrap').style.display = 'none';
    document.getElementById('mediaGDriveHint').style.display = 'none';

    showMediaMsg(
      wasGDriveConverted
        ? '✅ Đã thêm ảnh! (Link Google Drive đã được tự động chuyển sang link ảnh trực tiếp)'
        : '✅ Đã thêm ảnh vào thư viện!',
      'success'
    );
    await loadMedia();
  } catch (err) {
    showMediaMsg('❌ Lỗi: ' + err.message, 'error');
  } finally {
    btn.disabled = false; btn.textContent = '➕ Thêm vào thư viện';
  }
};

function parseMediaTags(raw) {
  if (!raw) return [];
  return [...new Set(
    raw.split(',')
      .map(t => t.trim().toLowerCase())
      .filter(Boolean)
  )];
}

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
  el._timer = setTimeout(() => { el.style.display = 'none'; }, 4500);
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
   SQL — chạy trong Supabase SQL Editor

   -- Nếu CHƯA có bảng media_library, tạo mới với đầy đủ cột (bao gồm tags):
   create table if not exists media_library (
     id         bigint generated always as identity primary key,
     url        text not null,
     label      text,
     tags       text[] not null default '{}',
     added_by   text,
     created_at timestamptz not null default now()
   );

   -- Nếu ĐÃ có bảng media_library từ trước (chưa có cột tags), chạy thêm dòng này:
   alter table media_library add column if not exists tags text[] not null default '{}';

   -- Bảng này dùng chung anon key như các bảng games/drinks hiện có
   -- (phân quyền thêm/xóa được kiểm soát ở giao diện dashboard,
   --  giống cơ chế đang áp dụng cho toàn bộ admin panel).
   ══════════════════════════════════════════════ */
