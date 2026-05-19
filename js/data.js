const GAMES = [];
const GAME_INDEX_MAP = new Map();

window.GAMES_READY = (async () => {

  /* =========================
     LOAD INDEX
  ========================= */

  const indexRes = await fetch("assets/boardgame/infogame.js");

  if (!indexRes.ok) {
    throw new Error(`Không load được infogame.js`);
  }

  const indexText = await indexRes.text();

  const match = indexText.match(/\[([^\]]+)\]/s);

  const files = match
    ? match[1]
        .match(/["']([^"']+)["']/g)
        ?.map(s => s.replace(/["']/g, ""))
    : [];

  if (!files?.length) {
    console.warn("⚠ Không tìm thấy file game");
    return;
  }

  /* =========================
     PREBUILD ORDER MAP
  ========================= */

  const orderMap = new Map();

  files.forEach((file, index) => {
    orderMap.set(norm(file), index);
  });

  /* =========================
     LOAD GAME FILES
  ========================= */

  const loadPromises = files.map(async (name) => {

    try {

      const res = await fetch(`assets/boardgame/${name}.js`);

      if (!res.ok) {
        throw new Error(`HTTP ${res.status}`);
      }

      const code = await res.text();

      new Function("GAMES", code)(GAMES);

    } catch (err) {

      console.warn(`❌ Lỗi load "${name}"`, err);

    }

  });

  await Promise.all(loadPromises);

  /* =========================
     CACHE SLUG
  ========================= */

  GAMES.forEach(game => {

    game._slug = norm(toSlug(game.name));

  });

  /* =========================
     SORT FAST
  ========================= */

  GAMES.sort((a, b) => {

    return (
      (orderMap.get(a._slug) ?? 999999)
      -
      (orderMap.get(b._slug) ?? 999999)
    );

  });

  /* =========================
     BUILD INDEX MAP
  ========================= */

  GAMES.forEach((g, i) => {
    GAME_INDEX_MAP.set(g, i);
  });

  console.log(`✅ Đã load ${GAMES.length} games`);

})();

/* =========================
   HELPERS
========================= */

function norm(s = "") {
  return s.replace(/_/g, "-");
}

function toSlug(str = "") {

  return str
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/đ/g, "d")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");

}
