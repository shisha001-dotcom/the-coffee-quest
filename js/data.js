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
  // Hỗ trợ cả dấu " và ' và tên có gạch dưới/gạch ngang
  const match = indexText.match(/\[([^\]]+)\]/s);
  const files = match
    ? match[1].match(/["']([^"']+)["']/g).map(s => s.replace(/["']/g, ""))
    : [];

  // Load song song tất cả file game
  // Thử tên file gốc trước, nếu 404 thì thử viết hoa chữ đầu
  await Promise.all(
    files.map(name => {
      const tryFetch = (filename) =>
        fetch(`assets/boardgame/${filename}.js`)
          .then(r => {
            if (!r.ok) throw new Error(`HTTP ${r.status}`);
            return r.text();
          });

      // Capitalize: "carcassonne" -> "Carcassonne"
      const capitalized = name.charAt(0).toUpperCase() + name.slice(1);

      return tryFetch(name)
        .catch(() => capitalized !== name ? tryFetch(capitalized) : Promise.reject())
        .then(code => {
          new Function("GAMES", code)(GAMES);
        })
        .catch(err => console.warn(`Lỗi load game "${name}":`, err));
    })
  );

  // Sắp xếp theo thứ tự trong _index.js
  // Normalize gạch dưới/gạch ngang để so sánh đúng
  const norm = s => s.replace(/_/g, '-');
  GAMES.sort((a, b) => {
    const ai = files.findIndex(f => norm(f) === norm(toSlug(a.name)));
    const bi = files.findIndex(f => norm(f) === norm(toSlug(b.name)));
    return ai - bi;
  });

  console.log(`✅ Đã load ${GAMES.length} games`);

})();

function toSlug(str){
  return str.toLowerCase()
    .normalize("NFD").replace(/[\u0300-\u036f]/g, "")
    .replace(/đ/g, "d")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
}
