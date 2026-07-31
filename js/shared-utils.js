/* ══════════════════════════════════════════════
   SHARED UTILS — js/shared-utils.js
   ─────────────────────────────────────────────
   Nơi DUY NHẤT chứa các hàm tiện ích dùng chung cho
   TOÀN BỘ dự án (frontend + admin).

   ⚠️ Load file này SAU shared-config.js, TRƯỚC mọi
      script khác cần dùng escHtml / showToast / formatTime
      (app.js, chat.js, admin/*.js).

   Exports (window globals):
     window.escHtml(s)
     window.formatTime(ts)
     window.formatDateVN(dateStr)
     window.showToast(msg, bg)
     window.slugify(s)
     window.normalizePhoneVN(raw)    — ⚠️ MỚI (dedupe): chuẩn hoá số
                                        điện thoại VN. Nơi DUY NHẤT chứa
                                        logic này — dùng chung bởi
                                        js/membership.js (frontend) và
                                        admin/modules/membership/membership-shared.js
                                        (window.Membership.normalizePhone
                                        giờ chỉ là alias trỏ về đây).
                                        Trước đây 2 file tự viết lại y
                                        hệt công thức này dưới 2 cái tên
                                        khác nhau.
     window.isValidPhoneVN(phone)    — ⚠️ MỚI (dedupe): validate định
                                        dạng SĐT VN đã chuẩn hoá
                                        (0xxxxxxxxx, 10-11 số) — dùng
                                        chung thay cho regex
                                        ^0\d{9,10}$ từng bị copy-paste
                                        độc lập ở 3 nơi khác nhau
                                        (js/membership.js,
                                        dashboard-customers.js,
                                        dashboard-orders.js). Sửa 1 chỗ
                                        ở đây là áp dụng cho toàn bộ dự
                                        án, không còn nguy cơ lệch nhau
                                        giữa các form nếu SĐT VN đổi
                                        định dạng trong tương lai.
     window.debounce(fn, delay)
     window.buildGameSlugMap(games)
     window.showConfirm(opts)        — modal xác nhận (Đồng ý/Huỷ)
     window.showReasonPrompt(opts)   — modal xác nhận CÓ Ô NHẬP LÝ DO bắt buộc
     window.getYoutubeId(url)        — MỚI: parse ID từ 4 dạng URL YouTube,
                                        dùng chung bởi js/app.js (frontend)
                                        và admin/modules/games/dashboard-game-detail.js
     window.extractGDriveFileId(url) — MỚI: trích fileId từ mọi dạng link
                                        Google Drive, dùng chung bởi
                                        gdrivePreviewUrl() (PDF) và
                                        dashboard-media.js::convertGDriveUrl()
   ══════════════════════════════════════════════ */

/* ── ESCAPE HTML ── */
window.escHtml = function (s) {
  return String(s == null ? '' : s)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
};

/* ── FORMAT THỜI GIAN ── */
window.formatTime = function (ts) {
  if (!ts) return '';
  const d = new Date(ts);
  return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
};

window.formatDateVN = function (dateStr) {
  if (!dateStr) return '';
  const [y, m, d] = dateStr.split('-');
  return `${d}/${m}/${y}`;
};

/* ── SLUGIFY ── */
window.slugify = function (s) {
  if (!s) return '';
  return s.toString().trim().toLowerCase()
    .normalize('NFD').replace(/[\u0300-\u036f]/g, '')
    .replace(/đ/g, 'd').replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '');
};

/* ══════════════════════════════════════════════
   SỐ ĐIỆN THOẠI VN — nơi DUY NHẤT chứa logic này
   ─────────────────────────────────────────────
   ⚠️ DEDUPE (audit): trước đây có 2 hàm chuẩn hoá khác tên nhưng
   cùng 1 công thức —
     - normalizePhoneVN() trong js/membership.js (bản frontend)
     - normalizePhone() trong
       admin/modules/membership/membership-shared.js (bản admin)
   — cộng thêm regex validate ^0\d{9,10}$ bị copy-paste độc lập ở
   3 nơi khác nhau (js/membership.js, dashboard-customers.js,
   dashboard-orders.js). Rủi ro thật: SĐT Việt Nam từng đổi định
   dạng ngoài đời (đổi đầu số 2018) — sửa 1 chỗ quên 3 chỗ còn lại
   sẽ khiến các form validate lệch nhau. Giờ CHỈ sửa ở đây; mọi nơi
   khác chỉ GỌI LẠI 2 hàm này, không tự viết lại công thức.

   window.normalizePhoneVN(raw)
     "+84 912 345 678" / "84912345678" / "0912-345-678" → "0912345678"
   window.isValidPhoneVN(phone)
     true nếu phone (đã normalize) khớp định dạng 0xxxxxxxxx (10-11 số)
   ══════════════════════════════════════════════ */
window.normalizePhoneVN = function (raw) {
  let p = (raw || '').trim().replace(/[\s.\-()]/g, '');
  if (p.startsWith('+84')) p = '0' + p.slice(3);
  else if (p.startsWith('84') && p.length > 9) p = '0' + p.slice(2);
  return p;
};

window.isValidPhoneVN = function (phone) {
  return /^0\d{9,10}$/.test(phone || '');
};

/* ── DEBOUNCE ── */
window.debounce = function (fn, delay = 200) {
  let timer;
  return (...args) => {
    clearTimeout(timer);
    timer = setTimeout(() => fn(...args), delay);
  };
};

/* ── TOAST NOTIFICATION ── */
window.showToast = function (msg, bg = '#00b894') {
  const existing = document.getElementById('_toast');
  if (existing) existing.remove();

  const t = document.createElement('div');
  t.id = '_toast';
  t.textContent = msg;
  t.setAttribute('role', 'status');
  t.setAttribute('aria-live', 'polite');
  Object.assign(t.style, {
    position: 'fixed', bottom: '28px', right: '28px',
    background: bg, color: '#fff',
    padding: '12px 22px', borderRadius: '10px',
    fontWeight: '600', fontSize: '14px',
    boxShadow: '0 4px 16px rgba(0,0,0,.15)', zIndex: '9900',
    transition: 'opacity .3s',
    maxWidth: 'calc(100vw - 56px)',
  });
  document.body.appendChild(t);
  setTimeout(() => { t.style.opacity = '0'; setTimeout(() => t.remove(), 300); }, 2700);
};

/* ══════════════════════════════════════════════
   SHOW CONFIRM — thay window.confirm() native
   ══════════════════════════════════════════════ */
(function setupConfirmDialog() {
  let resolvePromise = null;

  function ensureDom() {
    if (document.getElementById('tcq-confirm-overlay')) return;

    const style = document.createElement('style');
    style.id = 'tcq-confirm-styles';
    style.textContent = `
      #tcq-confirm-overlay {
        position: fixed; inset: 0; z-index: 999999;
        background: rgba(20,20,25,.55);
        display: none; align-items: center; justify-content: center;
        padding: 20px; backdrop-filter: blur(2px);
        font-family: 'Nunito', 'Inter', sans-serif;
      }
      #tcq-confirm-overlay.show { display: flex; }
      #tcq-confirm-box {
        width: 100%; max-width: 380px;
        background: #fff; border-radius: 18px;
        padding: 28px 26px 22px;
        box-shadow: 0 20px 60px rgba(0,0,0,.28);
        animation: tcqConfirmPop .18s cubic-bezier(.34,1.56,.64,1) both;
      }
      @keyframes tcqConfirmPop {
        from { opacity: 0; transform: translateY(18px) scale(.96); }
        to   { opacity: 1; transform: none; }
      }
      #tcq-confirm-title {
        font-size: 17px; font-weight: 800; color: #1a1a1a;
        margin-bottom: 8px; line-height: 1.4;
      }
      #tcq-confirm-msg {
        font-size: 14px; color: #666; line-height: 1.6;
        margin-bottom: 22px; white-space: pre-line;
      }
      #tcq-confirm-actions { display: flex; gap: 10px; justify-content: flex-end; }
      #tcq-confirm-actions button {
        border: none; border-radius: 12px; padding: 0 20px;
        min-height: 44px; font-size: 14px; font-weight: 700;
        font-family: inherit; cursor: pointer;
        transition: opacity .15s ease, transform .1s ease;
      }
      #tcq-confirm-actions button:hover { opacity: .88; }
      #tcq-confirm-actions button:active { transform: scale(.97); }
      #tcq-confirm-cancel  { background: #f0ebe0; color: #1a1a1a; }
      #tcq-confirm-ok      { background: #e63946; color: #fff; }
      #tcq-confirm-ok.is-neutral { background: #6c5ce7; }
      #tcq-confirm-overlay :focus-visible {
        outline: 3px solid #e63946; outline-offset: 2px;
      }
    `;
    document.head.appendChild(style);

    const overlay = document.createElement('div');
    overlay.id = 'tcq-confirm-overlay';
    overlay.setAttribute('role', 'alertdialog');
    overlay.setAttribute('aria-modal', 'true');
    overlay.setAttribute('aria-labelledby', 'tcq-confirm-title');
    overlay.setAttribute('aria-describedby', 'tcq-confirm-msg');
    overlay.innerHTML = `
      <div id="tcq-confirm-box">
        <div id="tcq-confirm-title"></div>
        <div id="tcq-confirm-msg"></div>
        <div id="tcq-confirm-actions">
          <button type="button" id="tcq-confirm-cancel"></button>
          <button type="button" id="tcq-confirm-ok"></button>
        </div>
      </div>
    `;
    document.body.appendChild(overlay);

    const close = (result) => {
      overlay.classList.remove('show');
      document.removeEventListener('keydown', onKeydown);
      if (resolvePromise) { resolvePromise(result); resolvePromise = null; }
    };
    function onKeydown(e) {
      if (e.key === 'Escape') close(false);
      if (e.key === 'Enter') close(true);
    }

    overlay.addEventListener('click', (e) => { if (e.target === overlay) close(false); });
    document.getElementById('tcq-confirm-cancel').addEventListener('click', () => close(false));
    document.getElementById('tcq-confirm-ok').addEventListener('click', () => close(true));
    overlay._tcqClose = close;
    overlay._tcqOnKeydown = onKeydown;
  }

  window.showConfirm = function (opts) {
    ensureDom();
    if (typeof opts === 'string') opts = { message: opts };
    const {
      title = 'Xác nhận',
      message = '',
      confirmText = 'Đồng ý',
      cancelText = 'Hủy',
      danger = true,
    } = opts || {};

    const overlay = document.getElementById('tcq-confirm-overlay');
    document.getElementById('tcq-confirm-title').textContent = title;
    document.getElementById('tcq-confirm-msg').textContent = message;

    const okBtn = document.getElementById('tcq-confirm-ok');
    okBtn.textContent = confirmText;
    okBtn.classList.toggle('is-neutral', !danger);
    document.getElementById('tcq-confirm-cancel').textContent = cancelText;

    return new Promise((resolve) => {
      resolvePromise = resolve;
      overlay.classList.add('show');
      document.addEventListener('keydown', overlay._tcqOnKeydown);
      requestAnimationFrame(() => okBtn.focus());
    });
  };
})();

/* ══════════════════════════════════════════════
   SHOW REASON PROMPT — MỚI (migration V3)
   ─────────────────────────────────────────────
   Giống showConfirm() nhưng có THÊM Ô NHẬP LÝ DO bắt buộc. Dùng
   cho mọi thao tác "xoá" giờ là soft-delete/vô hiệu hoá (không mất
   dữ liệu) và cần ghi lại vì sao — khách hàng, nhiệm vụ, đồ uống,
   nguyên liệu, tài khoản nhân viên...

   Dùng:
     const reason = await window.showReasonPrompt({
       title: "Xoá khách hàng này?",
       message: "Khách hàng sẽ bị ẩn khỏi danh sách nhưng vẫn giữ lịch sử.",
       reasonLabel: "Lý do xoá *",
       reasonPlaceholder: "VD: trùng số điện thoại...",
       confirmText: "🗑️ Xoá",
       cancelText: "Hủy",
     });
     if (reason === null) return; // người dùng bấm Huỷ / Escape
     // reason là chuỗi lý do đã nhập (không rỗng) — dùng để lưu vào
     // deleted_reason / void_reason / deactivated_reason...
   ══════════════════════════════════════════════ */
(function setupReasonPromptDialog() {
  let resolvePromise = null;

  function ensureDom() {
    if (document.getElementById('tcq-reason-overlay')) return;

    const style = document.createElement('style');
    style.id = 'tcq-reason-styles';
    style.textContent = `
      #tcq-reason-overlay {
        position: fixed; inset: 0; z-index: 999999;
        background: rgba(20,20,25,.55);
        display: none; align-items: center; justify-content: center;
        padding: 20px; backdrop-filter: blur(2px);
        font-family: 'Nunito', 'Inter', sans-serif;
      }
      #tcq-reason-overlay.show { display: flex; }
      #tcq-reason-box {
        width: 100%; max-width: 420px;
        background: #fff; border-radius: 18px;
        padding: 28px 26px 22px;
        box-shadow: 0 20px 60px rgba(0,0,0,.28);
        animation: tcqReasonPop .18s cubic-bezier(.34,1.56,.64,1) both;
      }
      @keyframes tcqReasonPop {
        from { opacity: 0; transform: translateY(18px) scale(.96); }
        to   { opacity: 1; transform: none; }
      }
      #tcq-reason-title {
        font-size: 17px; font-weight: 800; color: #1a1a1a;
        margin-bottom: 8px; line-height: 1.4;
      }
      #tcq-reason-msg {
        font-size: 14px; color: #666; line-height: 1.6;
        margin-bottom: 16px; white-space: pre-line;
      }
      #tcq-reason-label {
        font-size: 12px; font-weight: 700; color: #1a1a1a;
        display: block; margin-bottom: 6px;
      }
      #tcq-reason-input {
        width: 100%; min-height: 60px; resize: vertical;
        border: 1.5px solid #e0d8cc; border-radius: 10px;
        padding: 10px 12px; font-size: 14px; font-family: inherit;
        outline: none; margin-bottom: 6px;
      }
      #tcq-reason-input:focus { border-color: #e63946; }
      #tcq-reason-input.error { border-color: #e63946; box-shadow: 0 0 0 3px rgba(230,57,70,.12); }
      #tcq-reason-error {
        display: none; font-size: 12px; color: #e63946;
        font-weight: 600; margin-bottom: 12px;
      }
      #tcq-reason-error.show { display: block; }
      #tcq-reason-actions { display: flex; gap: 10px; justify-content: flex-end; margin-top: 10px; }
      #tcq-reason-actions button {
        border: none; border-radius: 12px; padding: 0 20px;
        min-height: 44px; font-size: 14px; font-weight: 700;
        font-family: inherit; cursor: pointer;
        transition: opacity .15s ease, transform .1s ease;
      }
      #tcq-reason-actions button:hover { opacity: .88; }
      #tcq-reason-actions button:active { transform: scale(.97); }
      #tcq-reason-cancel  { background: #f0ebe0; color: #1a1a1a; }
      #tcq-reason-ok      { background: #e63946; color: #fff; }
      #tcq-reason-ok.is-neutral { background: #6c5ce7; }
      #tcq-reason-overlay :focus-visible {
        outline: 3px solid #e63946; outline-offset: 2px;
      }
    `;
    document.head.appendChild(style);

    const overlay = document.createElement('div');
    overlay.id = 'tcq-reason-overlay';
    overlay.setAttribute('role', 'alertdialog');
    overlay.setAttribute('aria-modal', 'true');
    overlay.setAttribute('aria-labelledby', 'tcq-reason-title');
    overlay.innerHTML = `
      <div id="tcq-reason-box">
        <div id="tcq-reason-title"></div>
        <div id="tcq-reason-msg"></div>
        <label id="tcq-reason-label" for="tcq-reason-input"></label>
        <textarea id="tcq-reason-input"></textarea>
        <div id="tcq-reason-error" role="alert">Vui lòng nhập lý do.</div>
        <div id="tcq-reason-actions">
          <button type="button" id="tcq-reason-cancel"></button>
          <button type="button" id="tcq-reason-ok"></button>
        </div>
      </div>
    `;
    document.body.appendChild(overlay);

    const input = document.getElementById('tcq-reason-input');
    const errEl = document.getElementById('tcq-reason-error');

    const close = (result) => {
      overlay.classList.remove('show');
      document.removeEventListener('keydown', onKeydown);
      if (resolvePromise) { resolvePromise(result); resolvePromise = null; }
    };
    function trySubmit() {
      const val = input.value.trim();
      if (!val) {
        input.classList.add('error');
        errEl.classList.add('show');
        input.focus();
        return;
      }
      close(val);
    }
    function onKeydown(e) {
      if (e.key === 'Escape') close(null);
    }

    overlay.addEventListener('click', (e) => { if (e.target === overlay) close(null); });
    document.getElementById('tcq-reason-cancel').addEventListener('click', () => close(null));
    document.getElementById('tcq-reason-ok').addEventListener('click', trySubmit);
    input.addEventListener('input', () => {
      input.classList.remove('error');
      errEl.classList.remove('show');
    });
    overlay._tcqClose = close;
    overlay._tcqOnKeydown = onKeydown;
  }

  window.showReasonPrompt = function (opts) {
    ensureDom();
    const {
      title = 'Xác nhận',
      message = '',
      reasonLabel = 'Lý do *',
      reasonPlaceholder = '',
      confirmText = 'Xác nhận',
      cancelText = 'Hủy',
      danger = true,
    } = opts || {};

    const overlay = document.getElementById('tcq-reason-overlay');
    document.getElementById('tcq-reason-title').textContent = title;
    document.getElementById('tcq-reason-msg').textContent = message;
    document.getElementById('tcq-reason-label').textContent = reasonLabel;

    const input = document.getElementById('tcq-reason-input');
    input.value = '';
    input.placeholder = reasonPlaceholder;
    input.classList.remove('error');
    document.getElementById('tcq-reason-error').classList.remove('show');

    const okBtn = document.getElementById('tcq-reason-ok');
    okBtn.textContent = confirmText;
    okBtn.classList.toggle('is-neutral', !danger);
    document.getElementById('tcq-reason-cancel').textContent = cancelText;

    return new Promise((resolve) => {
      resolvePromise = resolve;
      overlay.classList.add('show');
      document.addEventListener('keydown', overlay._tcqOnKeydown);
      requestAnimationFrame(() => input.focus());
    });
  };
})();

/* ── YOUTUBE ID ──
   Parse ID từ 4 dạng URL YouTube (watch?v=, youtu.be/, embed/, shorts/).
   Dùng chung bởi js/app.js (trang chi tiết game — frontend) và
   admin/modules/games/dashboard-game-detail.js (preview thumbnail khi
   admin nhập link) — trước đây mỗi nơi tự viết lại y hệt logic này. */
window.getYoutubeId = function (url) {
  if (!url || url.includes('/None')) return null;
  const patterns = [
    /[?&]v=([a-zA-Z0-9_-]{11})/,
    /youtu\.be\/([a-zA-Z0-9_-]{11})/,
    /embed\/([a-zA-Z0-9_-]{11})/,
    /shorts\/([a-zA-Z0-9_-]{11})/,
  ];
  for (const p of patterns) { const m = url.match(p); if (m) return m[1]; }
  return null;
};

/* ── GOOGLE DRIVE FILE ID ──
   Trích fileId từ mọi dạng link chia sẻ Google Drive gặp trong dự án
   (/file/d/{id}/, ?id={id}, open?id={id}, uc?...&id={id}). Dùng chung
   bởi gdrivePreviewUrl() (PDF luật chơi) và
   admin/modules/media/dashboard-media.js::convertGDriveUrl() (ảnh) —
   trước đây mỗi nơi tự viết lại 1 chuỗi regex gần giống hệt nhau. */
window.extractGDriveFileId = function (url) {
  if (!url) return null;
  url = url.trim();
  let m = url.match(/drive\.google\.com\/file\/d\/([a-zA-Z0-9_-]+)/);
  if (m) return m[1];
  m = url.match(/drive\.google\.com\/open\?id=([a-zA-Z0-9_-]+)/);
  if (m) return m[1];
  m = url.match(/[?&]id=([a-zA-Z0-9_-]+)/);
  if (m) return m[1];
  return null;
};

/* ── GOOGLE DRIVE PDF PREVIEW ── */
window.gdrivePreviewUrl = function (url) {
  if (!url) return null;
  const fileId = window.extractGDriveFileId(url.trim());
  if (!fileId) return url.trim();
  return `https://drive.google.com/file/d/${fileId}/preview`;
};

/* ── SLUG CHO GAME ── */
window.buildGameSlugMap = function (games) {
  const slugById = {};
  const idBySlug = {};
  const seen = {};

  (games || []).forEach(g => {
    const base = window.slugify(g.name) || 'game';
    let slug = base;
    let n = 2;
    while (seen[slug] && seen[slug] !== g.id) {
      slug = `${base}-${n}`;
      n++;
    }
    seen[slug] = g.id;
    slugById[g.id] = slug;
    idBySlug[slug] = g.id;
  });

  return { slugById, idBySlug };
};
