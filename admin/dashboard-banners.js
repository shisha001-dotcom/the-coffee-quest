/* ══════════════════════════════════════════════
   DASHBOARD BANNERS MODULE
   File: admin/dashboard-banners.js
   Quản lý ảnh bìa trang News — URL + hiển thị/ẩn
   Import sau dashboard.js trong dashboard.html
   ══════════════════════════════════════════════ */

/* ── Supabase client (dùng lại từ dashboard.js) ── */
/* client được khai báo global trong dashboard.js   */

/* ══════════════════════════════════════════════
   INJECT MENU ITEM VÀO SIDEBAR
   ══════════════════════════════════════════════ */
(function injectBannersMenu() {
  const tryInject = () => {
    const menuGroups = document.querySelectorAll('.menu-group');
    if (!menuGroups.length) { setTimeout(tryInject, 100); return; }

    /* Tìm group QUẢN TRỊ (group thứ 2) */
    const target = menuGroups[1] || menuGroups[0];

    /* Chèn trước item Settings */
    const settingsItem = [...target.querySelectorAll('.menu-item')]
      .find(el => el.textContent.includes('Settings'));

    const item = document.createElement('a');
    item.className  = 'menu-item';
    item.id         = 'bannersMenuItem';
    item.style.cssText = 'cursor:pointer;';
    item.innerHTML  = `<span>🖼️</span> Banners`;
    item.addEventListener('click', () => showBannersPage());

    if (settingsItem) {
      target.insertBefore(item, settingsItem);
    } else {
      target.appendChild(item);
    }
  };
  tryInject();
})();

/* ══════════════════════════════════════════════
   INJECT PAGE HTML
   ══════════════════════════════════════════════ */
(function injectBannersPage() {
  const main = document.querySelector('.main-content');
  if (!main) return;

  const page = document.createElement('div');
  page.id = 'bannersPage';
  page.style.display = 'none';

  page.innerHTML = `
    <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:28px;flex-wrap:wrap;gap:12px;">
      <div>
        <h1 style="font-size:26px;font-weight:700;color:var(--text)">🖼️ Banners</h1>
        <p style="font-size:14px;color:var(--text-muted);margin-top:4px">
          Quản lý ảnh bìa hiển thị trên trang News
        </p>
      </div>
      <button id="bannerSaveAllBtn" class="btn btn-primary" onclick="saveBanners()">
        💾 Lưu thay đổi
      </button>
    </div>

    <!-- THÔNG BÁO -->
    <div id="bannerMsg" style="display:none;margin-bottom:20px;padding:12px 18px;border-radius:10px;font-size:14px;font-weight:600;"></div>

    <!-- DANH SÁCH BANNER -->
    <div id="bannerList" style="display:flex;flex-direction:column;gap:20px;">
      <!-- render bởi renderBanners() -->
    </div>

    <!-- HƯỚNG DẪN -->
    <div style="background:var(--card);border:1px solid var(--border);border-radius:var(--radius);padding:20px 24px;margin-top:28px;">
      <div style="font-size:13px;font-weight:700;color:var(--text);margin-bottom:10px;">📌 Lưu ý</div>
      <ul style="font-size:13px;color:var(--text-muted);display:flex;flex-direction:column;gap:6px;padding-left:16px;">
        <li>Dán URL ảnh trực tiếp vào ô — hỗ trợ mọi link ảnh công khai (Imgur, Cloudinary, Supabase Storage...)</li>
        <li>Tắt hiển thị: banner đó sẽ biến mất trên trang News, nội dung tự dồn lên</li>
        <li>Thay đổi chỉ có hiệu lực sau khi nhấn <strong>Lưu thay đổi</strong></li>
        <li>Cài đặt được lưu vào bảng <code style="background:#f1f5f9;padding:1px 6px;border-radius:4px">site_settings</code> trên Supabase</li>
      </ul>
    </div>
  `;

  main.appendChild(page);
  loadBanners();
})();

/* ══════════════════════════════════════════════
   STATE
   ══════════════════════════════════════════════ */
let bannerData = [
  { key: 'banner_1', label: 'Banner 1', url: '', visible: true },
  { key: 'banner_2', label: 'Banner 2', url: '', visible: true },
];

/* ══════════════════════════════════════════════
   SHOW PAGE
   ══════════════════════════════════════════════ */
window.showBannersPage = function () {
  if (typeof window.__showPage === 'function') {
    window.__showPage('bannersPage');
  } else {
    ['dashboardPage','boardgamesPage','drinksPage','analyticsPage','chatAdminPage']
      .forEach(id => { const el = document.getElementById(id); if (el) el.style.display = 'none'; });
    document.getElementById('bannersPage').style.display = '';
  }

  document.querySelectorAll('.menu-item, .menu-item-parent').forEach(el => el.classList.remove('active'));
  document.getElementById('bannersMenuItem')?.classList.add('active');
};

/* ══════════════════════════════════════════════
   LOAD — đọc từ site_settings
   ══════════════════════════════════════════════ */
async function loadBanners() {
  try {
    /* client là biến global từ dashboard.js */
    const { data, error } = await client
      .from('site_settings')
      .select('key, value')
      .in('key', ['banner_1', 'banner_2']);

    if (error) throw error;

    if (data && data.length) {
      data.forEach(row => {
        const item = bannerData.find(b => b.key === row.key);
        if (item) {
          try {
            const parsed = JSON.parse(row.value);
            item.url     = parsed.url     ?? '';
            item.visible = parsed.visible ?? true;
          } catch {
            /* value cũ dạng plain string → dùng làm url */
            item.url     = row.value || '';
            item.visible = true;
          }
        }
      });
    }
  } catch (err) {
    console.warn('loadBanners:', err.message);
  }

  renderBanners();
}

/* ══════════════════════════════════════════════
   RENDER
   ══════════════════════════════════════════════ */
function renderBanners() {
  const list = document.getElementById('bannerList');
  if (!list) return;

  list.innerHTML = bannerData.map((b, i) => `
    <div style="background:var(--card);border:1px solid var(--border);border-radius:var(--radius);overflow:hidden;box-shadow:var(--shadow);">

      <!-- Header card -->
      <div style="padding:16px 22px;border-bottom:1px solid var(--border);display:flex;align-items:center;justify-content:space-between;gap:14px;flex-wrap:wrap;">
        <div style="font-size:15px;font-weight:700;color:var(--text);">🖼️ ${b.label}</div>

        <!-- Toggle hiển thị -->
        <label style="display:flex;align-items:center;gap:10px;cursor:pointer;user-select:none;">
          <div style="position:relative;width:44px;height:24px;">
            <input type="checkbox" id="bannerVisible_${i}"
              ${b.visible ? 'checked' : ''}
              onchange="onBannerToggle(${i},this.checked)"
              style="opacity:0;width:0;height:0;position:absolute;">
            <div id="bannerTrack_${i}" style="
              position:absolute;inset:0;
              border-radius:12px;
              background:${b.visible ? 'var(--primary)' : '#cbd5e0'};
              transition:background .2s;
              cursor:pointer;
            " onclick="document.getElementById('bannerVisible_${i}').click()"></div>
            <div id="bannerThumb_${i}" style="
              position:absolute;
              top:3px;left:${b.visible ? '23px' : '3px'};
              width:18px;height:18px;
              border-radius:50%;background:#fff;
              box-shadow:0 1px 4px rgba(0,0,0,.2);
              transition:left .2s;
              pointer-events:none;
            "></div>
          </div>
          <span style="font-size:13px;font-weight:600;color:${b.visible ? 'var(--primary)' : 'var(--text-muted)'};" id="bannerVisibleLabel_${i}">
            ${b.visible ? 'Hiển thị' : 'Đã ẩn'}
          </span>
        </label>
      </div>

      <!-- Body card -->
      <div style="padding:20px 22px;display:grid;grid-template-columns:1fr auto;gap:16px;align-items:flex-start;">

        <!-- URL input -->
        <div style="display:flex;flex-direction:column;gap:8px;">
          <label style="font-size:12px;font-weight:700;color:var(--text-muted);text-transform:uppercase;letter-spacing:.8px;">URL ảnh</label>
          <div style="position:relative;">
            <input type="text" id="bannerUrl_${i}"
              value="${escBannerAttr(b.url)}"
              placeholder="https://... (URL ảnh công khai)"
              oninput="onBannerUrlChange(${i},this.value)"
              style="
                width:100%;height:44px;
                border:1.5px solid var(--border);border-radius:10px;
                padding:0 14px;font-size:14px;
                font-family:'Inter',sans-serif;color:var(--text);
                outline:none;transition:border-color .2s;
              "
              onfocus="this.style.borderColor='var(--primary)'"
              onblur="this.style.borderColor='var(--border)'">
          </div>
          <div style="font-size:11px;color:var(--text-muted);">Dán link ảnh trực tiếp — Imgur, Cloudinary, Supabase Storage, v.v.</div>
        </div>

        <!-- Preview -->
        <div style="flex-shrink:0;">
          <div style="font-size:12px;font-weight:700;color:var(--text-muted);text-transform:uppercase;letter-spacing:.8px;margin-bottom:8px;">Xem trước</div>
          <div id="bannerPreviewWrap_${i}" style="
            width:180px;height:90px;
            border-radius:10px;
            border:1.5px solid var(--border);
            overflow:hidden;
            background:var(--bg);
            display:flex;align-items:center;justify-content:center;
          ">
            ${b.url
              ? `<img id="bannerPreviewImg_${i}" src="${escBannerAttr(b.url)}" alt="Preview"
                  style="width:100%;height:100%;object-fit:cover;display:block;"
                  onerror="this.parentElement.innerHTML='<span style=\\'font-size:11px;color:var(--text-muted);text-align:center;padding:8px;\\'>⚠️ Không tải được ảnh</span>';">`
              : `<span id="bannerPreviewImg_${i}" style="font-size:11px;color:var(--text-muted);text-align:center;padding:8px;">Chưa có ảnh</span>`
            }
          </div>
        </div>

      </div>

      <!-- Opacity overlay khi ẩn -->
      ${!b.visible ? `<div style="position:absolute;inset:0;background:rgba(255,255,255,.5);border-radius:var(--radius);pointer-events:none;"></div>` : ''}
    </div>
  `).join('');
}

/* ══════════════════════════════════════════════
   EVENT HANDLERS
   ══════════════════════════════════════════════ */
window.onBannerToggle = function (i, checked) {
  bannerData[i].visible = checked;

  /* Cập nhật visual toggle */
  const track = document.getElementById(`bannerTrack_${i}`);
  const thumb = document.getElementById(`bannerThumb_${i}`);
  const label = document.getElementById(`bannerVisibleLabel_${i}`);
  if (track) track.style.background = checked ? 'var(--primary)' : '#cbd5e0';
  if (thumb) thumb.style.left = checked ? '23px' : '3px';
  if (label) {
    label.textContent = checked ? 'Hiển thị' : 'Đã ẩn';
    label.style.color = checked ? 'var(--primary)' : 'var(--text-muted)';
  }
};

window.onBannerUrlChange = function (i, val) {
  bannerData[i].url = val.trim();

  /* Live preview */
  const wrap = document.getElementById(`bannerPreviewWrap_${i}`);
  if (!wrap) return;
  const url = bannerData[i].url;
  if (url) {
    wrap.innerHTML = `<img src="${escBannerAttr(url)}" alt="Preview"
      style="width:100%;height:100%;object-fit:cover;display:block;"
      onerror="this.parentElement.innerHTML='<span style=\\'font-size:11px;color:var(--text-muted);text-align:center;padding:8px;\\'>⚠️ Không tải được ảnh</span>';">`;
  } else {
    wrap.innerHTML = `<span style="font-size:11px;color:var(--text-muted);text-align:center;padding:8px;">Chưa có ảnh</span>`;
  }
};

/* ══════════════════════════════════════════════
   SAVE — upsert vào site_settings
   ══════════════════════════════════════════════ */
window.saveBanners = async function () {
  const btn = document.getElementById('bannerSaveAllBtn');
  if (btn) { btn.disabled = true; btn.textContent = 'Đang lưu...'; }

  try {
    const rows = bannerData.map(b => ({
      key:        b.key,
      value:      JSON.stringify({ url: b.url, visible: b.visible }),
      updated_at: new Date().toISOString(),
    }));

    const { error } = await client
      .from('site_settings')
      .upsert(rows, { onConflict: 'key' });

    if (error) throw error;

    showBannerMsg('✅ Đã lưu cài đặt banner!', '#00b894');
  } catch (err) {
    showBannerMsg('❌ Lỗi: ' + err.message, '#e17055');
  } finally {
    if (btn) { btn.disabled = false; btn.textContent = '💾 Lưu thay đổi'; }
  }
};

/* ══════════════════════════════════════════════
   HELPERS
   ══════════════════════════════════════════════ */
function showBannerMsg(text, bg) {
  const el = document.getElementById('bannerMsg');
  if (!el) return;
  el.textContent   = text;
  el.style.display = 'block';
  el.style.background = bg === '#00b894' ? '#e6f9f5' : '#fff5f5';
  el.style.color      = bg;
  el.style.border     = `1px solid ${bg}44`;
  clearTimeout(el._timer);
  el._timer = setTimeout(() => { el.style.display = 'none'; }, 4000);
}

function escBannerAttr(s) {
  return String(s || '')
    .replace(/&/g, '&amp;')
    .replace(/"/g, '&quot;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
}
