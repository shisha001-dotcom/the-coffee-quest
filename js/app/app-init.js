/* ══════════════════════════════════════════════
   BOOTSTRAP — js/app/app-init.js
   ─────────────────────────────────────────────
   ⚠️ TÁCH RA từ js/app.js — PHẢI load CUỐI CÙNG trong nhóm
   js/app/*.js. Chờ window.GAMES_READY (js/data.js) resolve rồi
   build slug map + game index + chạy route lần đầu.
   ══════════════════════════════════════════════ */

window.GAMES_READY.then(() => {
  gameSlugs = window.buildGameSlugMap(GAMES);
  rebuildGameIndex();
  routeFromHash();
});
