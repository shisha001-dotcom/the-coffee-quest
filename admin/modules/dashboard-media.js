/* ══════════════════════════════════════════════
   DASHBOARD MEDIA LIBRARY MODULE — admin/modules/dashboard-media.js
   ─────────────────────────────────────────────
   THAY ĐỔI so với bản gốc:
   - Xóa IIFE injectMediaMenu() (polling) → AdminDashboard.registerPage
     với insertBeforeMenuId: "chatMenuItem" (giữ đúng vị trí "trước
     mục Cộng đồng" như bản gốc).
   - escMediaAttr() → dùng window.escHtml dùng chung.
   - slugifyMedia() → dùng window.slugify dùng chung.
   ══════════════════════════════════════════════ */

const isSuperAdminMedia = currentSession.role === 'superadmin';

(function injectMediaStyles() {
  if (document.getElementById('mediaLibraryStyles')) return;
  const style = document.createElement('style');
  style.id = 'mediaLibraryStyles';
  style.textContent = `
    #mediaGrid .media-card { transition: transform .16s ease, box-shadow .16s ease; }
    #mediaGrid .media-card:hover { transform: translateY(-3px); box-shadow: 0 14px 28px rgba(20,20,40,.10); }
    #mediaGrid .media-thumb img { transition: transform .35s ease; display:block; }
    #mediaGrid .media-card:hover .media-thumb img { transform: scale(1.05); }

    .media-icon-btn {
      width: 36px; height: 36px; border-radius: 10px;
      border: 1px solid var(--border); background: var(--bg);
      display: flex; align-items: center; justify-content: center;
      cursor: pointer; font-size: 14px; flex-shrink: 0;
      transition: background .15s, border-color .15s, transform .1s;
      color: var(--text);
    }
    .media-icon-btn:hover { background: #eef1f8; border-color: #d8dcec; }
    .media-icon-btn:active { transform: scale(.94); }
    .media-icon-btn.grow { flex: 1; width: auto; gap: 6px; font-size: 12px; font-weight: 600; }
    .media-icon-btn.danger { background: var(--danger); border-color: var(--danger); color: #fff; }
    .media-icon-btn.danger:hover { background: var(--danger-dark); }

    .media-size-badge {
      position: absolute; top: 8px; right: 8px;
      background: rgba(15,15,25,.62); color: #fff;
      font-size: 10px; font-weight: 700; letter-spacing: .2px;
      padding: 4px 9px; border-radius: 20px;
      display: flex; align-items: center; gap: 5px;
      backdrop-filter: blur(3px);
    }
    .media-spinner {
      width: 9px; height: 9px; border-radius: 50%;
      border: 2px solid rgba(255,255,255,.35); border-top-color: #fff;
      animation: mediaSpin .6s linear infinite;
    }
    @keyframes mediaSpin { to { transform: rotate(360deg); } }

    .media-tag-chip { transition: all .15s ease; }
    .media-tag-chip:hover { filter: brightness(0.97); }
    .media-card-tag { transition: background .15s ease, color .15s ease; }
    .media-card-tag:hover { background: var(--primary) !important; color: #fff !important; }

    #mediaModal .modal-box { max-width: 560px; }
    .media-preview-box {
      width: 100%; height: 200px; border-radius: 12px;
      border: 1.5px dashed var(--border); overflow: hidden;
      background: var(--bg); display: flex; align-items: center; justify-content: center;
      position: relative;
    }
    .media-gdrive-hint {
      font-size: 12px; color: #0984e3; background: #e8f3ff;
      border: 1px solid #0984e344; border-radius: 8px; padding: 8px 12px;
      display: flex; align-items: center; gap: 6px;
    }
  `;
  document.head.appendChild(style);
})();

window.AdminDashboard.registerPage({
  pageId: "mediaPage",
  menuId: "mediaMenuItem",
  icon: "🗂️",
  label: "Thư viện Media",
  insertBeforeMenuId: "chatMenuItem", // giữ đúng vị trí: trước mục "Cộng đồng"
});

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
      <button class="btn btn-primary" onclick="openMediaModal()">➕ Thêm ảnh mới</button>
    </div>

    <div style="display:flex;gap:16px;flex-wrap:wrap;margin-bottom:24px;">
      <div class="stat-card" style="flex:1;min-width:180px;">
        <div class="stat-icon">🖼️</div>
        <div>
          <div class="stat-value" id="mediaStatCount">0</div>
          <div class="stat-label">Ảnh trong thư viện</div>
        </div>
      </div>
      <div class="stat-card" style="flex:1;min-width:180px;">
        <div class="stat-icon">🏷️</div>
        <div>
          <div class="stat-value" id="mediaStatTags">0</div>
          <div class="stat-label">Tag đang sử dụng</div>
        </div>
      </div>
    </div>

    <div class="search-bar" style="display:flex;gap:12px;flex-wrap:wrap;align-items:center;">
      <input type="text" id="mediaSearchInput" class="search-input" style="max-width:420px;" placeholder="🔍 Tìm theo ghi chú, URL hoặc tag...">
    </div>
    <div id="mediaTagFilterWrap" style="display:flex;gap:8px;flex-wrap:wrap;margin-bottom:22px;"></div>

    <div id="mediaMsg" style="display:none;margin-bottom:20px;padding:12px 18px;border-radius:10px;font-size:14px;font-weight:600;"></div>

    <div id="mediaGrid" style="display:grid;grid-template-columns:repeat(auto-fill,minmax(260px,1fr));gap:18px;"></div>

    <div id="mediaEmptyState" style="display:none;text-align:center;padding:60px 20px;color:var(--text-muted);">
      <div style="font-size:40px;margin-bottom:10px;">🖼️</div>
      <div id="mediaEmptyStateText" style="font-size:14px;margin-bottom:16px;">Chưa có ảnh nào trong thư viện</div>
      <button class="btn btn-primary" onclick="openMediaModal()">➕ Thêm ảnh đầu tiên</button>
    </div>

    <div style="background:var(--card);border:1px solid var(--border);border-radius:var(--radius);padding:20px 24px;margin-top:28px;">
      <div style="font-size:13px;font-weight:700;color:var(--text);margin-bottom:10px;">📌 Lưu ý</div>
      <ul style="font-size:13px;color:var(--text-muted);display:flex;flex-direction:column;gap:6px;padding-left:16px;">
        <li>Dán link Google Drive (dạng .../file/d/ID/view) → hệ thống <strong>tự động chuyển</strong> sang link ảnh trực tiếp, nhớ để chế độ chia sẻ file là "Anyone with the link"</li>
        <li>Mọi tài khoản đăng nhập đều có thể <strong>thêm</strong> link ảnh mới; chỉ <strong>Super Admin</strong> mới <strong>xóa</strong> được</li>
        <li>Gắn tag để lọc nhanh (VD: banner, poster, sukien, noel...) — bấm vào tag trên thẻ ảnh để lọc nhanh theo tag đó</li>
        <li>Dung lượng ảnh hiển thị dạng ước tính — một số nguồn ảnh không cho phép đọc dung lượng từ trình duyệt nên sẽ hiện dấu "—"</li>
      </ul>
    </div>
  `;

  main.appendChild(page);

  const searchInput = page.querySelector('#mediaSearchInput');
  searchInput.addEventListener('input', () => {
    mediaSearchQuery = searchInput.value;
    renderMediaGrid();
  });

  loadMedia();
})();

(function injectMediaModal() {
  const modal = document.createElement('div');
  modal.className = 'modal-overlay hidden';
  modal.id = 'mediaModal';
  modal.innerHTML = `
    <div class="modal-box">
      <div class="modal-header">
        <h2>➕ Thêm ảnh vào thư viện</h2>
        <button class="close-btn" onclick="closeMediaModal()">✕</button>
      </div>

      <div style="display:flex;flex-direction:column;gap:16px;">
        <div class="form-group">
          <label>URL ảnh *</label>
          <input type="text" id="mediaUrlInput" placeholder="https://... (dán cả link Google Drive cũng được)">
        </div>

        <div id="mediaGDriveHint" class="media-gdrive-hint hidden">
          🔄 Đã phát hiện link Google Drive — sẽ tự động chuyển sang link ảnh trực tiếp khi thêm.
        </div>

        <div class="form-group">
          <label>Xem trước</label>
          <div class="media-preview-box" id="mediaAddPreview">
            <span style="font-size:12px;color:var(--text-muted);">Dán URL ảnh phía trên để xem trước</span>
          </div>
        </div>

        <div class="form-group">
          <label>Ghi chú (tuỳ chọn)</label>
          <input type="text" id="mediaLabelInput" placeholder="VD: Banner sự kiện Noel">
        </div>

        <div class="form-group">
          <label>Tag (phân cách bằng dấu phẩy)</label>
          <input type="text" id="mediaTagsInput" placeholder="VD: banner, noel, sukien">
        </div>
      </div>

      <div class="modal-actions">
        <button class="btn btn-secondary" onclick="closeMediaModal()">Hủy</button>
        <button id="mediaAddBtn" class="btn btn-primary" onclick="addMedia()">➕ Thêm vào thư viện</button>
      </div>
    </div>
  `;
  document.body.appendChild(modal);

  modal.addEventListener('click', (e) => { if (e.target === modal) closeMediaModal(); });

  const urlInput = modal.querySelector('#mediaUrlInput');
  let previewDebounce;
  urlInput.addEventListener('input', () => {
    clearTimeout(previewDebounce);
    const raw = urlInput.value.trim();
    previewDebounce = setTimeout(() => updateAddPreview(raw), 350);
  });
  urlInput.addEventListener('blur', () => {
    const converted = convertGDriveUrl(urlInput.value.trim());
    if (converted && converted !== urlInput.value.trim()) {
      urlInput.value = converted;
      updateAddPreview(converted);
    }
  });
})();

window.openMediaModal = function () {
  document.getElementById('mediaUrlInput').value = '';
  document.getElementById('mediaLabelInput').value = '';
  document.getElementById('mediaTagsInput').value = '';
  document.getElementById('mediaGDriveHint').classList.add('hidden');
  document.getElementById('mediaAddPreview').innerHTML =
    '<span style="font-size:12px;color:var(--text-muted);">Dán URL ảnh phía trên để xem trước</span>';
  document.getElementById('mediaModal').classList.remove('hidden');
  setTimeout(() => document.getElementById('mediaUrlInput').focus(), 50);
};
window.closeMediaModal = function () {
  document.getElementById('mediaModal').classList.add('hidden');
};

async function updateAddPreview(url) {
  const hint = document.getElementById('mediaGDriveHint');
  const box  = document.getElementById('mediaAddPreview');

  hint.classList.toggle('hidden', !(url && isGDriveUrl(url) && !isDirectGDriveUrl(url)));

  const previewUrl = convertGDriveUrl(url) || url;
  if (!previewUrl) {
    box.innerHTML = '<span style="font-size:12px;color:var(--text-muted);">Dán URL ảnh phía trên để xem trước</span>';
    return;
  }

  box.innerHTML = `
    <img src="${window.escHtml(previewUrl)}" alt="Preview"
      style="width:100%;height:100%;object-fit:cover;display:block;"
      onerror="this.parentElement.innerHTML='<span style=&quot;font-size:12px;color:var(--text-muted);text-align:center;padding:8px;&quot;>⚠️ Không tải được ảnh — kiểm tra lại URL / quyền chia sẻ</span>'">
    <span id="mediaAddPreviewSize" class="media-size-badge"><span class="media-spinner"></span> đang đo...</span>
  `;

  const sizeEl = document.getElementById('mediaAddPreviewSize');
  const size = await fetchMediaSize(previewUrl);
  if (!sizeEl || !document.body.contains(sizeEl)) return;
  sizeEl.innerHTML = size ? size : '— KB';
}

let mediaList = [];
let mediaSearchQuery = '';
let mediaActiveTag = null;
const mediaSizeCache = new Map();

function isGDriveUrl(url) { return /drive\.google\.com|googleusercontent\.com/i.test(url || ''); }
function isDirectGDriveUrl(url) { return /^https:\/\/lh3\.googleusercontent\.com\/d\//i.test(url || ''); }
function convertGDriveUrl(url) {
  if (!url) return null;
  url = url.trim();
  if (isDirectGDriveUrl(url)) return url;

  let fileId = null, m;
  m = url.match(/drive\.google\.com\/file\/d\/([a-zA-Z0-9_-]+)/);
  if (m) fileId = m[1];
  if (!fileId) { m = url.match(/drive\.google\.com\/open\?id=([a-zA-Z0-9_-]+)/); if (m) fileId = m[1]; }
  if (!fileId) { m = url.match(/drive\.google\.com\/uc\?.*[?&]id=([a-zA-Z0-9_-]+)/); if (m) fileId = m[1]; }
  if (!fileId && isGDriveUrl(url)) { m = url.match(/[?&]id=([a-zA-Z0-9_-]+)/); if (m) fileId = m[1]; }
  if (!fileId) return null;
  return `https://lh3.googleusercontent.com/d/${fileId}`;
}

function formatBytes(bytes) {
  if (bytes === null || bytes === undefined || isNaN(bytes)) return null;
  if (bytes < 1024) return bytes + ' B';
  if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(0) + ' KB';
  return (bytes / 1024 / 1024).toFixed(1) + ' MB';
}

async function fetchMediaSize(url) {
  if (mediaSizeCache.has(url)) return mediaSizeCache.get(url);
  try {
    const timeout = new Promise((_, rej) => setTimeout(() => rej(new Error('timeout')), 6000));
    const res = await Promise.race([fetch(url, { method: 'HEAD', mode: 'cors' }), timeout]);
    const len = res.headers.get('content-length');
    const result = len ? formatBytes(Number(len)) : null;
    mediaSizeCache.set(url, result);
    return result;
  } catch {
    mediaSizeCache.set(url, null);
    return null;
  }
}

async function loadMedia() {
  try {
    const { data, error } = await client
      .from('media_library').select('*').order('created_at', { ascending: false });
    if (error) throw error;
    mediaList = (data || []).map(m => ({ ...m, tags: Array.isArray(m.tags) ? m.tags : [] }));
  } catch (err) {
    console.warn('loadMedia:', err.message);
    mediaList = [];
    showMediaMsg('❌ Không tải được thư viện: ' + err.message, 'error');
  }
  updateMediaStats();
  renderTagFilters();
  renderMediaGrid();
}

function updateMediaStats() {
  const countEl = document.getElementById('mediaStatCount');
  const tagsEl  = document.getElementById('mediaStatTags');
  if (countEl) countEl.textContent = mediaList.length;
  if (tagsEl)  tagsEl.textContent  = new Set(mediaList.flatMap(m => m.tags || [])).size;
}

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

function renderTagFilters() {
  const wrap = document.getElementById('mediaTagFilterWrap');
  if (!wrap) return;

  const allTags = [...new Set(mediaList.flatMap(m => m.tags || []))].sort((a, b) => a.localeCompare(b, 'vi'));
  if (!allTags.length) { wrap.innerHTML = ''; return; }

  const chip = (label, value, active) => `
    <button class="media-tag-chip" data-tag-value="${window.escHtml(value ?? '')}"
      style="height:32px;padding:0 14px;border-radius:20px;font-size:12px;font-weight:600;cursor:pointer;
      border:1.5px solid ${active ? 'var(--primary)' : 'var(--border)'};
      background:${active ? 'var(--primary)' : 'var(--card)'};
      color:${active ? '#fff' : 'var(--text-muted)'};">
      ${window.escHtml(label)}
    </button>`;

  wrap.innerHTML =
    chip('Tất cả', '', !mediaActiveTag) +
    allTags.map(t => chip('#' + t, t, mediaActiveTag === t)).join('');

  wrap.querySelectorAll('.media-tag-chip').forEach(btn => {
    btn.addEventListener('click', () => {
      mediaActiveTag = btn.dataset.tagValue || null;
      renderTagFilters();
      renderMediaGrid();
    });
  });
}

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
          : 'Chưa có ảnh nào trong thư viện';
      }
    }
    return;
  }
  if (empty) empty.style.display = 'none';

  grid.innerHTML = filtered.map(m => `
    <div class="media-card" style="background:var(--card);border:1px solid var(--border);border-radius:16px;overflow:hidden;box-shadow:var(--shadow);display:flex;flex-direction:column;">
      <div class="media-thumb" style="position:relative;width:100%;aspect-ratio:16/10;background:var(--bg);display:flex;align-items:center;justify-content:center;overflow:hidden;">
        <img src="${window.escHtml(m.url)}" alt="${window.escHtml(m.label || 'media')}"
          style="width:100%;height:100%;object-fit:cover;"
          onerror="this.parentElement.innerHTML='<span style=&quot;font-size:11px;color:var(--text-muted);text-align:center;padding:8px;&quot;>⚠️ Không tải được ảnh</span>'">
        <span class="media-size-badge" id="media-size-${m.id}"><span class="media-spinner"></span></span>
      </div>

      <div style="padding:14px 16px;display:flex;flex-direction:column;gap:8px;flex:1;">
        <div style="font-size:13px;font-weight:700;color:var(--text);min-height:18px;">
          ${m.label ? window.escHtml(m.label) : '<span style="color:var(--text-muted);font-weight:500;">Không có ghi chú</span>'}
        </div>

        ${(m.tags && m.tags.length) ? `
        <div style="display:flex;flex-wrap:wrap;gap:6px;">
          ${m.tags.map(t => `
            <span class="media-card-tag" data-tag-value="${window.escHtml(t)}"
              style="font-size:10px;font-weight:700;color:var(--primary);background:#f0edff;border-radius:12px;padding:3px 9px;cursor:pointer;">#${window.escHtml(t)}</span>
          `).join('')}
        </div>` : ''}

        <div title="${window.escHtml(m.url)}"
          style="font-size:11px;color:var(--text-muted);background:var(--bg);border:1px solid var(--border);border-radius:6px;padding:6px 8px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;font-family:monospace;">
          ${window.escHtml(m.url)}
        </div>

        <div style="font-size:10px;color:var(--text-muted);">
          ${m.added_by ? '👤 ' + window.escHtml(m.added_by) + ' · ' : ''}${formatMediaDate(m.created_at)}
        </div>

        <div style="display:flex;gap:8px;margin-top:auto;padding-top:6px;">
          <button class="media-icon-btn grow" data-media-copy="${m.id}" title="Copy link">📋 Copy</button>
          <button class="media-icon-btn grow" data-media-download="${m.id}" title="Tải xuống">⬇️ Tải</button>
          ${isSuperAdminMedia
            ? `<button class="media-icon-btn danger" data-media-delete="${m.id}" title="Xóa">🗑️</button>`
            : ''
          }
        </div>
      </div>
    </div>
  `).join('');

  attachMediaEvents();
  loadCardSizes(filtered);
}

function loadCardSizes(items) {
  items.forEach(async m => {
    const el = document.getElementById(`media-size-${m.id}`);
    if (!el) return;
    const size = await fetchMediaSize(m.url);
    const stillThere = document.getElementById(`media-size-${m.id}`);
    if (!stillThere) return;
    stillThere.innerHTML = size || '—';
  });
}

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
  document.querySelectorAll('.media-card-tag').forEach(el => {
    el.addEventListener('click', () => {
      mediaActiveTag = el.dataset.tagValue;
      renderTagFilters();
      renderMediaGrid();
    });
  });
}

window.addMedia = async function () {
  const urlInput   = document.getElementById('mediaUrlInput');
  const labelInput = document.getElementById('mediaLabelInput');
  const tagsInput  = document.getElementById('mediaTagsInput');
  const btn        = document.getElementById('mediaAddBtn');

  let url     = urlInput.value.trim();
  const label = labelInput.value.trim();
  const tags  = parseMediaTags(tagsInput.value);

  if (!url) { showMediaMsg('⚠️ Vui lòng nhập URL ảnh', 'error'); urlInput.focus(); return; }

  const converted = convertGDriveUrl(url);
  const wasGDriveConverted = converted && converted !== url;
  if (converted) url = converted;

  try { new URL(url); } catch { showMediaMsg('⚠️ URL không hợp lệ', 'error'); urlInput.focus(); return; }

  btn.disabled = true; btn.textContent = 'Đang thêm...';
  try {
    const { error } = await client.from('media_library').insert({
      url, label: label || null, tags,
      added_by: currentSession.displayName || currentSession.username,
    });
    if (error) throw error;

    closeMediaModal();
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
  return [...new Set(raw.split(',').map(t => t.trim().toLowerCase()).filter(Boolean))];
}

async function deleteMedia(id) {
  if (!isSuperAdminMedia) { showMediaMsg('⛔ Chỉ Super Admin mới có quyền xóa', 'error'); return; }
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

async function downloadMedia(url, label) {
  try {
    const res = await fetch(url, { mode: 'cors' });
    if (!res.ok) throw new Error('fetch failed');
    const blob = await res.blob();
    const blobUrl = URL.createObjectURL(blob);
    const ext = guessMediaExt(url, blob.type);
    const a = document.createElement('a');
    a.href = blobUrl;
    a.download = (window.slugify(label) || 'the-coffee-quest-media') + ext;
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

function showMediaMsg(text, type) {
  const el = document.getElementById('mediaMsg');
  if (!el) return;
  el.textContent = text;
  el.style.display = 'block';
  if (type === 'success') {
    el.style.background = '#e6f9f5'; el.style.color = '#00b894'; el.style.border = '1px solid #00b89444';
  } else {
    el.style.background = '#fff5f5'; el.style.color = '#e17055'; el.style.border = '1px solid #e1705544';
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

/* ══════════════════════════════════════════════
   SQL — chạy trong Supabase SQL Editor

   create table if not exists media_library (
     id         bigint generated always as identity primary key,
     url        text not null,
     label      text,
     tags       text[] not null default '{}',
     added_by   text,
     created_at timestamptz not null default now()
   );

   alter table media_library add column if not exists tags text[] not null default '{}';
   ══════════════════════════════════════════════ */
