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
     window.buildGameSlugMap(games)
     window.showConfirm(opts)   ← MỚI (UI/UX audit — ưu tiên cao)
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

/* ── DEBOUNCE — MỚI: dùng chung cho mọi ô search/input cần trì hoãn
   (trước đây mỗi module admin tự viết lại logic clearTimeout/setTimeout
   giống hệt nhau — dashboard-games.js, dashboard-accounts.js,
   dashboard-media.js, dashboard-customers.js...) ── */
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
   SHOW CONFIRM — MỚI (thay window.confirm() native)
   ─────────────────────────────────────────────
   window.confirm()/alert() chặn UI thread, không style được, và
   không nhất quán với phần giao diện còn lại (vốn đã đẹp và có
   showToast()). showConfirm() thay thế bằng modal tùy chỉnh, trả
   về Promise<boolean> nên vẫn dùng được với await y hệt confirm().

   Tự inject <style> + <div> 1 lần duy nhất (lazy, chỉ khi gọi lần
   đầu), dùng namespace "tcq-confirm-*" với màu hard-code riêng
   (không phụ thuộc --accent/--primary của từng trang) để hoạt động
   nhất quán trên CẢ trang khách (css/base/variables.css) LẪN admin
   (admin/dashboard.css) mà không cần sửa 2 bộ CSS khác nhau.

   Dùng:
     const ok = await window.showConfirm({
       title: "Xóa game này?",
       message: "Hành động này không thể hoàn tác.",
       confirmText: "🗑️ Xóa",
       cancelText: "Hủy",
       danger: true,        // true → nút xác nhận màu đỏ
     });
     if (!ok) return;
     // ... tiến hành xóa

   Có thể gọi showConfirm(message) với 1 chuỗi đơn giản, tương thích
   ngược gần giống confirm(message).
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

/* ── GOOGLE DRIVE PDF PREVIEW ──
   Nhận nhiều dạng link Drive (file/d/ID/view, open?id=ID, uc?id=ID...)
   → trả về link dạng .../preview để nhúng <iframe> xem trước,
   không ép tải về như link gốc. */
window.gdrivePreviewUrl = function (url) {
  if (!url) return null;
  url = url.trim();
  let fileId = null, m;
  m = url.match(/drive\.google\.com\/file\/d\/([a-zA-Z0-9_-]+)/);
  if (m) fileId = m[1];
  if (!fileId) { m = url.match(/[?&]id=([a-zA-Z0-9_-]+)/); if (m) fileId = m[1]; }
  if (!fileId) return url; // không nhận diện được → dùng nguyên link (fallback)
  return `https://drive.google.com/file/d/${fileId}/preview`;
};

/* ── SLUG CHO GAME (dùng cho link chia sẻ #game-{slug} + mã QR) ──
   Trả về { slugById, idBySlug }. Tự xử lý trùng tên bằng hậu tố -2, -3...
   Admin và frontend cùng fetch bảng `games` order theo sort_order,
   nên slug sinh ra ở 2 nơi luôn khớp nhau. */
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
