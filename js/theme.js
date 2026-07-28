/* ══════════════════════════════════════════════
   THEME SWITCHER — js/theme.js
   ─────────────────────────────────────────────
   Áp dụng theme qua thuộc tính data-theme trên <html>,
   toàn bộ màu sắc override trong css/base/variables.css.
   Lưu lựa chọn vào localStorage, đọc lại ngay từ script
   inline trong <head> của index.html để không bị nháy.
   ══════════════════════════════════════════════ */

window.TCQ_THEMES = [
  { id: 'default',   label: 'Mặc định',          icon: '☕' },
  { id: 'christmas', label: 'Giáng Sinh',        icon: '🎄' },
  { id: 'halloween', label: 'Halloween',         icon: '🎃' },
  { id: 'valentine', label: 'Valentine',         icon: '💘' },
  { id: 'vietnam',   label: 'Tôi Yêu Việt Nam',  icon: '🇻🇳' },
];

window.getCurrentTheme = function () {
  return localStorage.getItem('tcq_theme') || 'default';
};

window.applyTheme = function (id) {
  const valid = window.TCQ_THEMES.some(t => t.id === id) ? id : 'default';
  document.documentElement.setAttribute('data-theme', valid);
  localStorage.setItem('tcq_theme', valid);
};

/* Đảm bảo theme đúng ngay cả khi script inline trong <head> lỗi vì lý do gì đó */
window.applyTheme(window.getCurrentTheme());
