/* ══════════════════════════════════════════════
   BOOTSTRAP — js/app/app-init.js
   ─────────────────────────────────────────────
   ⚠️ ĐÃ QUAY VỀ LOGIC ĐƠN GIẢN CỦA BẢN CŨ (ver1.2): chỉ chờ
   window.GAMES_READY MỘT LẦN DUY NHẤT rồi build slug map + index,
   sau đó chạy route lần đầu — không còn cơ chế tự retry / tự mở lại
   trang khi dữ liệu tới muộn.
   ══════════════════════════════════════════════ */

window.GAMES_READY.then(() => {
  gameSlugs = window.buildGameSlugMap(GAMES);
  rebuildGameIndex();
  routeFromHash();
});
