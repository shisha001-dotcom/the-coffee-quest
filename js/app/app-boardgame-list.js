/* ══════════════════════════════════════════════
   BOARDGAME LIST (Grid + Filter + Search) — js/app/app-boardgame-list.js
   ─────────────────────────────────────────────
   ⚠️ ĐÃ QUAY VỀ LOGIC ĐƠN GIẢN CỦA BẢN CŨ (ver1.2): bỏ trạng thái
   "đang tải / lỗi mạng + nút thử lại", vì GAMES giờ chỉ được tải
   1 LẦN DUY NHẤT trước khi trang được render lần đầu (xem
   js/app/app-init.js) — không còn cơ chế tải lại nền để cần hiển
   thị trạng thái đó nữa.

   Cần: app-state.js (esc, diffClass, getCategories, gameIndex,
   activeFilter, searchQ) — load TRƯỚC file này.
   ══════════════════════════════════════════════ */

function filteredGames(){
  const q = searchQ.toLowerCase();
  return GAMES.filter(g=>{
    const cats = getCategories(g);
    const matchCat = activeFilter === '🧩 Tất cả' || cats.includes(activeFilter);
    const matchQ   = !q || g.name.toLowerCase().includes(q) || cats.some(c => c.toLowerCase().includes(q));
    return matchCat && matchQ;
  });
}

function renderGrid(){
  const games   = filteredGames();
  const countEl = document.getElementById('countNum');
  if(countEl) countEl.textContent = games.length;

  const grid  = document.getElementById('grid');
  const empty = document.getElementById('empty');
  if(!grid) return;

  if(!games.length){
    grid.innerHTML = '';
    if(empty) empty.style.display = 'block';
    return;
  }
  if(empty) empty.style.display = 'none';

  grid.innerHTML = games.map((g, i) => {
    const ri   = gameIndex(g);
    const cats = getCategories(g);
    return `<div class="game-card" onclick="goDetail(${ri})" style="animation-delay:${i*0.04}s">
      <div class="card-stripe" style="background:${g.color}"></div>
      <div class="card-body">
        <div class="card-top">
          <div class="card-emoji">${g.emoji}</div>
          <div>
            <div class="card-title">${esc(g.name)}</div>
            <div class="card-meta">
              ${cats.map(c => `<span class="tag">${esc(c)}</span>`).join('')}
              <span class="tag">👥 ${esc(g.players)}</span>
              <span class="tag">⏱ ${esc(g.time)}</span>
              <span class="tag ${diffClass(g.difficulty)}">⚡ ${esc(g.difficulty)}</span>
            </div>
          </div>
        </div>
        <div class="card-objective"><strong>Mục tiêu:</strong> ${esc(g.objective)}</div>
      </div>
      <div class="card-footer"><div class="view-btn">Xem luật chơi</div></div>
    </div>`;
  }).join('');
}

/* ═══ INIT BOARDGAME PAGE ═══ */
function initBoardgame(){
  renderGrid();
  const si = document.getElementById('searchInput');
  if(si){
    si.value = searchQ;
    si.addEventListener('input', window.debounce(e=>{ searchQ = e.target.value; renderGrid(); }, 150));
  }
  document.querySelectorAll('.chip').forEach(c=>{
    if(c.getAttribute('data-filter') === activeFilter) c.classList.add('active');
    c.addEventListener('click', ()=>{
      document.querySelectorAll('.chip').forEach(x=>x.classList.remove('active'));
      c.classList.add('active');
      activeFilter = c.getAttribute('data-filter');
      renderGrid();
    });
  });
}

window.initBoardgame = initBoardgame;
window.renderGrid    = renderGrid;
