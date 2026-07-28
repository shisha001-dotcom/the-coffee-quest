/* ══════════════════════════════════════════════
   BOARDGAME LIST (Grid + Filter + Search) — js/app/app-boardgame-list.js
   ─────────────────────────────────────────────
   ⚠️ TÁCH RA từ js/app.js. Render lưới danh sách game
   (pages/boardgame.html #grid), lọc theo thể loại (chip) +
   tìm kiếm (debounce), khởi tạo trang qua initBoardgame()
   (gọi từ app-router.js::loadPage() khi vào #boardgame).

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
  const grid  = document.getElementById('grid');
  const empty = document.getElementById('empty');
  if(!grid) return;

  /* Phân biệt "chưa có dữ liệu vì đang tải/lỗi mạng" với "có dữ
     liệu nhưng lọc không ra kết quả nào". Tránh hiện nhầm "Không
     tìm thấy game nào" khi thực chất đang chờ mạng — trang sẽ tự
     cập nhật khi data.js bắn sự kiện 'tcq:games-updated'. */
  if (!GAMES.length) {
    const countElEmpty = document.getElementById('countNum');
    if (countElEmpty) countElEmpty.textContent = 0;

    if (empty) empty.style.display = 'none';
    grid.innerHTML = window.GAMES_LOAD_ERROR
      ? `<div style="grid-column:1/-1;text-align:center;padding:60px 20px;color:var(--muted)">
           <div style="font-size:2.4rem;margin-bottom:10px">📡</div>
           <div style="font-weight:800;font-size:1.05rem;color:var(--ink)">Đang kết nối lại...</div>
           <p style="margin-top:6px;font-size:.85rem">Mạng chập chờn — hệ thống đang tự thử lại, trang sẽ tự hiện danh sách khi kết nối được.</p>
         </div>`
      : `<div style="grid-column:1/-1;text-align:center;padding:60px 20px;color:var(--muted)">
           <div style="font-size:2.4rem;margin-bottom:10px">⏳</div>
           <div style="font-weight:800;font-size:1.05rem;color:var(--ink)">Đang tải danh sách game...</div>
         </div>`;
    return;
  }

  const games   = filteredGames();
  const countEl = document.getElementById('countNum');
  if(countEl) countEl.textContent = games.length;

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
