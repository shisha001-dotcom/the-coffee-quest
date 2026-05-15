// ═══════════════════════════════════════════════════════════════
//  data.js — Auto loader  |  The Coffee Quest
// ═══════════════════════════════════════════════════════════════

const GAMES = [];

// Dùng Promise toàn cục để app.js biết khi nào load xong
window.GAMES_READY = (async () => {

  // Load danh sách file
  const indexRes  = await fetch("assets/boardgame/_index.js");
  const indexText = await indexRes.text();

  // Parse mảng từ file _index.js
  const match = indexText.match(/\[([^\]]+)\]/s);
  const files = match
    ? match[1].match(/"([^"]+)"/g).map(s => s.replace(/"/g, ""))
    : [];

  // Load song song tất cả file game
  await Promise.all(
    files.map(name =>
      fetch(`assets/boardgame/${name}.js`)
        .then(r => r.text())
        .then(code => {
          // Chạy code, GAMES.push(...) sẽ tự điền vào mảng
          new Function("GAMES", code)(GAMES);
        })
        .catch(err => console.warn(`Lỗi load game "${name}":`, err))
    )
  );

  // Sắp xếp theo thứ tự trong _index.js
  GAMES.sort((a, b) =>
    files.indexOf(toSlug(a.name)) - files.indexOf(toSlug(b.name))
  );

  console.log(`✅ Đã load ${GAMES.length} games`);

})();

function toSlug(str){
  return str.toLowerCase()
    .normalize("NFD").replace(/[\u0300-\u036f]/g, "")
    .replace(/đ/g, "d")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
}
