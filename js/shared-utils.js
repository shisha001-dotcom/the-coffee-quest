/* ══════════════════════════════════════════════
   SHARED UTILS — js/shared-utils.js
   ─────────────────────────────────────────────
   Nơi DUY NHẤT chứa các hàm tiện ích dùng chung cho
   TOÀN BỘ dự án (frontend + admin).

   ⚠️ Load file này SAU shared-config.js, TRƯỚC mọi
      script khác cần dùng escHtml / showToast / formatTime
      (app.js, chat.js, admin/*.js).

   Trước đây các hàm này bị viết lại 5 lần với 5 tên khác
   nhau (esc, escHtml, escAcc, escBannerAttr, escMediaAttr)
   rải rác trong app.js, dashboard-chat.js, dashboard-
   accounts.js, dashboard-banners.js, dashboard-media.js.
   Từ nay chỉ sửa 1 chỗ duy nhất là ở đây.

   Exports (window globals):
     window.escHtml(s)          → escape HTML an toàn khi
                                   chèn text động vào innerHTML
     window.formatTime(ts)      → timestamp → "HH:MM"
     window.formatDateVN(dateStr) → "2026-06-11" → "11/06/2026"
     window.showToast(msg, bg)  → toast notification góc phải
                                   dưới (dùng chung frontend & admin)
     window.slugify(s)          → chuỗi → dạng slug an toàn cho
                                   tên file / URL (bỏ dấu tiếng Việt)
   ══════════════════════════════════════════════ */

/* ── ESCAPE HTML ──
   Dùng khi chèn dữ liệu người dùng / dữ liệu động vào innerHTML
   để tránh XSS và lỗi hiển thị ký tự đặc biệt (&, <, >, ", ').
   Bản đầy đủ nhất (escape cả " và ') — an toàn để dùng cả trong
   text node lẫn trong thuộc tính HTML (value="...", title="..."). */
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
  // "2026-06-11" → "11/06/2026"
  if (!dateStr) return '';
  const [y, m, d] = dateStr.split('-');
  return `${d}/${m}/${y}`;
};

/* ── SLUGIFY (dùng khi đặt tên file tải xuống, vd: dashboard-media.js) ── */
window.slugify = function (s) {
  if (!s) return '';
  return s.toString().trim().toLowerCase()
    .normalize('NFD').replace(/[\u0300-\u036f]/g, '')
    .replace(/đ/g, 'd').replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '');
};

/* ── TOAST NOTIFICATION ──
   Dùng chung cho cả trang khách (nếu cần) và admin dashboard.
   Trước đây: dashboard.js định nghĩa showToast() rồi gán
   window.showToast = showToast; các module khác (dashboard-chat.js)
   phải tự viết bản fallback phòng khi module load trước.
   Từ nay chỉ cần load file này sớm nhất → không còn cần fallback. */
window.showToast = function (msg, bg = '#00b894') {
  const existing = document.getElementById('_toast');
  if (existing) existing.remove();

  const t = document.createElement('div');
  t.id = '_toast';
  t.textContent = msg;
  Object.assign(t.style, {
    position: 'fixed', bottom: '28px', right: '28px',
    background: bg, color: '#fff',
    padding: '12px 22px', borderRadius: '10px',
    fontWeight: '600', fontSize: '14px',
    boxShadow: '0 4px 16px rgba(0,0,0,.15)', zIndex: '9999',
    transition: 'opacity .3s',
  });
  document.body.appendChild(t);
  setTimeout(() => { t.style.opacity = '0'; setTimeout(() => t.remove(), 300); }, 2700);
};
