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
     window.buildGameSlugMap(games)   ← MỚI: sinh slug cho link chia sẻ game
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

/* ── TOAST NOTIFICATION ── */
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
