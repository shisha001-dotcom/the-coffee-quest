/* ══════════════════════════════════════════════
   BOARDGAME LIST (Grid + Filter + Search) — js/app/app-boardgame-list.js
   ─────────────────────────────────────────────
   ⚠️ FIX (mobile treo mãi ở "Đang tải danh sách game..."):
   renderGrid() giờ LUÔN hiện nút "🔄 Thử lại ngay" khi GAMES vẫn
   rỗng (dù đang loading lần đầu hay đã lỗi hẳn), gọi
   window.retryLoadGamesNow() (js/data.js) để ép tải lại ngay lập
   tức — không còn kẹt màn hình vô thời hạn không có cách nào thoát
   ra như trước. Nếu có lỗi cụ thể, hiển thị luôn message lỗi để dễ
   debug (window.GAMES_LOAD_ERROR_MESSAGE).

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

function renderLoadingOrErrorState(){
  const grid = document.getElementById('grid');
  if (!grid) return;

  const isError = window.GAMES_LOAD_ERROR;
  const msg = window.GAMES_LOAD_ERROR_MESSAGE || '';

  grid.innerHTML = `
    <div style="grid-column:1/-1;text-align:center;padding:60px 20px;color:var(--muted)">
      <div style="font-size:2.4rem;margin-bottom:10px">${isError ? '📡' : '⏳'}</div>
      <div style="font-weight:800;font-size:1.05rem;color:var(--ink)">
        ${isError ? 'Không tải được danh sách game' : 'Đang tải danh sách game...'}
      </div>
      <p style="margin-top:6px;font-size:.85rem">
        ${isError
          ? ('Có thể do mạng chập chờn hoặc trình duyệt đang dùng chặn kết nối.' + (msg ? `<br><span style="opacity:.7">(${esc(msg)})</span>` : ''))
          : 'Nếu đợi quá lâu, có thể bấm nút bên dưới để thử tải lại ngay.'}
      </p>
      <button type="button" id="gamesRetryBtn"
        style="margin-top:16px;padding:10px 22px;border:none;border-radius:var(--r-md);
               background:var(--accent);color:#fff;font-weight:800;font-size:.85rem;cursor:pointer;">
        🔄 Thử lại ngay
      </button>
    </div>`;

  document.getElementById('gamesRetryBtn')?.addEventListener('click', () => {
    renderGrid(); // hiện lại trạng thái "đang tải" ngay khi bấm
    if (typeof window.retryLoadGamesNow === 'function') window.retryLoadGamesNow();
  });
}

function renderGrid(){
  const grid  = document.getElementById('grid');
  const empty = document.getElementById('empty');
  if(!grid) return;

  /* Phân biệt "chưa có dữ liệu vì đang tải/lỗi mạng" với "có dữ
     liệu nhưng lọc không ra kết quả nào". ⚠️ FIX: luôn có nút thử
     lại thay vì chỉ hiện chữ và tự chờ vô thời hạn. */
  if (!GAMES.length) {
    const countElEmpty = document.getElementById('countNum');
    if (countElEmpty) countElEmpty.textContent = 0;
    if (empty) empty.style.display = 'none';
    renderLoadingOrErrorState();
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
