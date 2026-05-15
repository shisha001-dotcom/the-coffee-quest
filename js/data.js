const GAMES = [];

window.GAMES_READY = (async () => {
  const indexRes  = await fetch("assets/boardgame/infogame.js");
  const indexText = await indexRes.text();

  const match = indexText.match(/\[([^\]]+)\]/s);
  const files = match
    ? match[1].match(/["']([^"']+)["']/g).map(s => s.replace(/["']/g, ""))
    : [];

  await Promise.all(
    files.map(name =>
      fetch(`assets/boardgame/${name}.js`)
        .then(r => { if (!r.ok) throw new Error(`HTTP ${r.status}`); return r.text(); })
        .then(code => new Function("GAMES", code)(GAMES))
        .catch(err => console.warn(`❌ Lỗi load "${name}":`, err))
    )
  );

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
