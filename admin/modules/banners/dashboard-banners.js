/* ══════════════════════════════════════════════
   DASHBOARD BANNERS MODULE — admin/modules/dashboard-banners.js
   ─────────────────────────────────────────────
   THAY ĐỔI so với bản trước:
   - Thêm guard + early-return dựa trên window.AdminPermissions
     để chặn role "Bar Staff" xem trang này.
   - ⚠️ DEDUPE (mới): showBannerMsg() cục bộ đã bị xoá — dùng thẳng
     window.showInlineMsg(elId, text, type) (js/shared-utils.js),
     dùng chung với dashboard-media.js.
   ══════════════════════════════════════════════ */

const canAccessBannersPage = window.AdminPermissions.can(currentSession.role, "bannersPage");

window.AdminDashboard.registerPage({
  pageId: "bannersPage",
  menuId: "bannersMenuItem",
  icon: "🖼️",
  label: "Banners",
  guard: () => canAccessBannersPage,
});

(function injectBannersPage() {
  if (!canAccessBannersPage) return;

  const main = document.querySelector('.main-content');
  if (!main) return;

  const page = document.createElement('div');
  page.id = 'bannersPage';
  page.style.display = 'none';

  page.innerHTML = `
    <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:28px;flex-wrap:wrap;gap:12px;">
      <div>
        <h1 style="font-size:26px;font-weight:700;color:var(--text)">🖼️ Banners</h1>
        <p style="font-size:14px;color:var(--text-muted);margin-top:4px">Quản lý ảnh bìa hiển thị trên trang News</p>
      </div>
      <button id="bannerSaveAllBtn" class="btn btn-primary" onclick="saveBanners()">💾 Lưu thay đổi</button>
    </div>

    <div id="bannerMsg" style="display:none;margin-bottom:20px;padding:12px 18px;border-radius:10px;font-size:14px;font-weight:600;"></div>

    <div id="bannerList" style="display:flex;flex-direction:column;gap:20px;"></div>

    <div style="background:var(--card);border:1px solid var(--border);border-radius:var(--radius);padding:20px 24px;margin-top:28px;">
      <div style="font-size:13px;font-weight:700;color:var(--text);margin-bottom:10px;">📌 Lưu ý</div>
      <ul style="font-size:13px;color:var(--text-muted);display:flex;flex-direction:column;gap:6px;padding-left:16px;">
        <li>Dán URL ảnh trực tiếp vào ô — hỗ trợ mọi link ảnh công khai</li>
        <li>Tắt hiển thị: banner đó sẽ biến mất trên trang News</li>
        <li>Thay đổi chỉ có hiệu lực sau khi nhấn <strong>Lưu thay đổi</strong></li>
        <li>Cài đặt lưu vào bảng <code style="background:#f1f5f9;padding:1px 6px;border-radius:4px">site_settings</code> trên Supabase</li>
      </ul>
    </div>
  `;

  main.appendChild(page);
  loadBanners();
})();

let bannerData = [
  { key: 'banner_1', label: 'Banner 1', url: '', visible: true },
  { key: 'banner_2', label: 'Banner 2', url: '', visible: true },
];

async function loadBanners() {
  try {
    const { data, error } = await client
      .from('site_settings')
      .select('key, value')
      .in('key', ['banner_1', 'banner_2']);
    if (error) throw error;
    if (data && data.length) {
      data.forEach(row => {
        const item = bannerData.find(b => b.key === row.key);
        if (!item) return;
        try {
          const parsed = JSON.parse(row.value);
          item.url     = parsed.url     ?? '';
          item.visible = parsed.visible ?? true;
        } catch {
          item.url     = row.value || '';
          item.visible = true;
        }
      });
    }
  } catch (err) {
    console.warn('loadBanners:', err.message);
  }
  renderBannerList();
}

function renderBannerList() {
  const list = document.getElementById('bannerList');
  if (!list) return;

  list.innerHTML = bannerData.map((b, i) => `
    <div style="background:var(--card);border:1px solid var(--border);border-radius:var(--radius);overflow:hidden;box-shadow:var(--shadow);">

      <div style="padding:16px 22px;border-bottom:1px solid var(--border);display:flex;align-items:center;justify-content:space-between;gap:14px;flex-wrap:wrap;">
        <div style="font-size:15px;font-weight:700;color:var(--text);">🖼️ ${window.escHtml(b.label)}</div>

        <label style="display:flex;align-items:center;gap:10px;cursor:pointer;user-select:none;">
          <div style="position:relative;width:44px;height:24px;flex-shrink:0;">
            <input type="checkbox" data-banner-index="${i}" class="banner-visible-cb" ${b.visible ? 'checked' : ''}
              style="opacity:0;width:0;height:0;position:absolute;">
            <div class="banner-track" data-banner-index="${i}" style="
              position:absolute;inset:0;border-radius:12px;
              background:${b.visible ? 'var(--primary)' : '#cbd5e0'};
              transition:background .2s;cursor:pointer;"></div>
            <div class="banner-thumb" data-banner-index="${i}" style="
              position:absolute;top:3px;left:${b.visible ? '23px' : '3px'};
              width:18px;height:18px;border-radius:50%;background:#fff;
              box-shadow:0 1px 4px rgba(0,0,0,.2);transition:left .2s;pointer-events:none;"></div>
          </div>
          <span class="banner-visible-label" data-banner-index="${i}" style="
            font-size:13px;font-weight:600;color:${b.visible ? 'var(--primary)' : 'var(--text-muted)'};">
            ${b.visible ? 'Hiển thị' : 'Đã ẩn'}</span>
        </label>
      </div>

      <div style="padding:20px 22px;display:grid;grid-template-columns:1fr auto;gap:16px;align-items:flex-start;${!b.visible ? 'opacity:.5;' : ''}transition:opacity .2s;" class="banner-body" data-banner-index="${i}">
        <div style="display:flex;flex-direction:column;gap:8px;">
          <label style="font-size:12px;font-weight:700;color:var(--text-muted);text-transform:uppercase;letter-spacing:.8px;">URL ảnh</label>
          <input type="text" class="banner-url-input" data-banner-index="${i}" value="${window.escHtml(b.url)}"
            placeholder="https://... (URL ảnh công khai)"
            style="width:100%;height:44px;border:1.5px solid var(--border);border-radius:10px;padding:0 14px;font-size:14px;font-family:'Inter',sans-serif;color:var(--text);outline:none;transition:border-color .2s;">
          <div style="font-size:11px;color:var(--text-muted);">Imgur, Cloudinary, Supabase Storage, v.v.</div>
        </div>

        <div>
          <div style="font-size:12px;font-weight:700;color:var(--text-muted);text-transform:uppercase;letter-spacing:.8px;margin-bottom:8px;">Xem trước</div>
          <div class="banner-preview-wrap" data-banner-index="${i}" style="
            width:180px;height:90px;border-radius:10px;border:1.5px solid var(--border);overflow:hidden;
            background:var(--bg);display:flex;align-items:center;justify-content:center;">
            ${b.url
              ? `<img src="${window.escHtml(b.url)}" alt="Preview" style="width:100%;height:100%;object-fit:cover;display:block;"
                  onerror="this.parentElement.innerHTML='<span style=\\'font-size:11px;color:var(--text-muted);text-align:center;padding:8px;\\'>⚠️ Không tải được ảnh</span>'">`
              : `<span style="font-size:11px;color:var(--text-muted);text-align:center;padding:8px;">Chưa có ảnh</span>`
            }
          </div>
        </div>
      </div>
    </div>
  `).join('');

  attachBannerEvents();
}

function attachBannerEvents() {
  document.querySelectorAll('.banner-track').forEach(track => {
    track.addEventListener('click', () => {
      const i  = Number(track.dataset.bannerIndex);
      const cb = document.querySelector(`.banner-visible-cb[data-banner-index="${i}"]`);
      if (cb) { cb.checked = !cb.checked; cb.dispatchEvent(new Event('change')); }
    });
  });

  document.querySelectorAll('.banner-visible-cb').forEach(cb => {
    cb.addEventListener('change', () => {
      const i       = Number(cb.dataset.bannerIndex);
      const checked = cb.checked;
      bannerData[i].visible = checked;

      const track = document.querySelector(`.banner-track[data-banner-index="${i}"]`);
      if (track) track.style.background = checked ? 'var(--primary)' : '#cbd5e0';
      const thumb = document.querySelector(`.banner-thumb[data-banner-index="${i}"]`);
      if (thumb) thumb.style.left = checked ? '23px' : '3px';
      const label = document.querySelector(`.banner-visible-label[data-banner-index="${i}"]`);
      if (label) { label.textContent = checked ? 'Hiển thị' : 'Đã ẩn'; label.style.color = checked ? 'var(--primary)' : 'var(--text-muted)'; }
      const body = document.querySelector(`.banner-body[data-banner-index="${i}"]`);
      if (body) body.style.opacity = checked ? '1' : '0.5';
    });
  });

  document.querySelectorAll('.banner-url-input').forEach(input => {
    input.addEventListener('focus', () => { input.style.borderColor = 'var(--primary)'; });
    input.addEventListener('blur',  () => { input.style.borderColor = 'var(--border)'; });

    input.addEventListener('input', () => {
      const i   = Number(input.dataset.bannerIndex);
      const url = input.value.trim();
      bannerData[i].url = url;

      const wrap = document.querySelector(`.banner-preview-wrap[data-banner-index="${i}"]`);
      if (!wrap) return;
      wrap.innerHTML = url
        ? `<img src="${window.escHtml(url)}" alt="Preview" style="width:100%;height:100%;object-fit:cover;display:block;"
            onerror="this.parentElement.innerHTML='<span style=\\'font-size:11px;color:var(--text-muted);text-align:center;padding:8px;\\'>⚠️ Không tải được ảnh</span>'">`
        : `<span style="font-size:11px;color:var(--text-muted);text-align:center;padding:8px;">Chưa có ảnh</span>`;
    });
  });
}

window.saveBanners = async function () {
  const btn = document.getElementById('bannerSaveAllBtn');
  if (btn) { btn.disabled = true; btn.textContent = 'Đang lưu...'; }

  try {
    const rows = bannerData.map(b => ({
      key:        b.key,
      value:      JSON.stringify({ url: b.url, visible: b.visible }),
      updated_at: new Date().toISOString(),
    }));
    const { error } = await client.from('site_settings').upsert(rows, { onConflict: 'key' });
    if (error) throw error;
    window.showInlineMsg('bannerMsg', '✅ Đã lưu cài đặt banner!', 'success');
  } catch (err) {
    window.showInlineMsg('bannerMsg', '❌ Lỗi: ' + err.message, 'error');
  } finally {
    if (btn) { btn.disabled = false; btn.textContent = '💾 Lưu thay đổi'; }
  }
};
