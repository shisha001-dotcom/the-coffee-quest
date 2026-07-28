/* ═══ ROUTER ═══ */
let _gamesUpdateListenerAttached = false;

/* ⚠️ MỚI: lắng nghe sự kiện 'tcq:games-updated' (bắn ra từ data.js
   khi retry nền thành công) — tự render lại trang hiện tại, KHÔNG
   cần người dùng bấm gì hay reload trang. Chỉ gắn 1 lần. */
function attachAutoReloadOnGamesUpdate() {
  if (_gamesUpdateListenerAttached) return;
  _gamesUpdateListenerAttached = true;

  window.addEventListener('tcq:games-updated', () => {
    ensureGameIndexBuiltForce();
    const hash = location.hash.replace('#', '');
    if (hash === 'boardgame' || hash.startsWith('game-') || hash === '' ) {
      // Chỉ re-render nếu đang đứng ở trang phụ thuộc GAMES
      if (document.getElementById('grid')) {
        renderGrid();
      }
      if (document.getElementById('daily-pick-card')) {
        renderDailyPick();
      }
    }
  });
}

function ensureGameIndexBuiltForce(){
  gameSlugs = window.buildGameSlugMap(GAMES);
  rebuildGameIndex();
}

async function loadPage(pageName){
  const app = document.getElementById('app');
  try {
    const res = await fetch('pages/' + pageName + '.html');
    if(!res.ok) throw new Error('HTTP ' + res.status + ' — pages/' + pageName + '.html');
    app.innerHTML = await res.text();
    window.scrollTo(0, 0);

    attachAutoReloadOnGamesUpdate();

    if(pageName === 'boardgame'){
      await window.GAMES_READY;
      ensureGameIndexBuilt();
      if (typeof window.initBoardgame === 'function') {
        window.initBoardgame();
      } else {
        console.error('[app.js] initBoardgame chưa sẵn sàng — kiểm tra lại js/app.js có bị thiếu đoạn khi dán không.');
      }
    }
    if(pageName === 'settings'){
      if (typeof window.initSettings === 'function') window.initSettings();
    }
    if(pageName === 'membership' && typeof window.initMembership === 'function') window.initMembership();
    if(pageName === 'news'){
      await window.GAMES_READY;
      ensureGameIndexBuilt();
      if (typeof window.renderDailyPick === 'function') {
        window.renderDailyPick();
      } else {
        console.error('[app.js] renderDailyPick chưa sẵn sàng — kiểm tra lại js/app.js có bị thiếu đoạn khi dán không.');
      }
    }
  } catch(e){
    app.innerHTML = '<div style="padding:60px 24px;text-align:center">'
      + '<div style="font-size:3rem;margin-bottom:12px">⚠️</div>'
      + '<h2 style="font-family:Bebas Neue,sans-serif">Lỗi tải trang</h2>'
      + '<p style="color:#888;margin-top:8px">' + e.message + '</p>'
      + '</div>';
    console.error('loadPage error:', e);
  }
}

/* ═══ BOARDGAME LIST ═══ */
function renderGrid(){
  const grid  = document.getElementById('grid');
  const empty = document.getElementById('empty');
  if(!grid) return;

  /* ⚠️ MỚI: phân biệt "chưa có dữ liệu vì đang tải/lỗi mạng"
     với "có dữ liệu nhưng lọc không ra kết quả nào". Không hiện
     "Không tìm thấy game nào" (gây hiểu lầm) khi thực chất là
     đang chờ mạng — hiện trạng thái tải rõ ràng, tự cập nhật khi
     data.js bắn sự kiện 'tcq:games-updated'. */
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

/* ═══ DAILY PICK — 3 game ngẫu nhiên ═══ */
function renderDailyPick(){
  renderBanners();

  const wrap = document.getElementById('daily-pick-card');
  if(!wrap) return;

  /* ⚠️ MỚI: cùng logic phân biệt trạng thái tải như renderGrid() */
  if (!GAMES || !GAMES.length) {
    wrap.innerHTML = window.GAMES_LOAD_ERROR
      ? `<div style="text-align:center;padding:40px 20px;color:var(--muted)">
           <div style="font-size:2.2rem;margin-bottom:10px">📡</div>
           <div style="font-weight:800;color:var(--ink)">Đang kết nối lại...</div>
           <p style="margin-top:6px;font-size:.85rem">Trang sẽ tự hiện gợi ý khi kết nối được.</p>
         </div>`
      : `<div style="text-align:center;padding:40px 20px;color:var(--muted)">
           <div style="font-size:2.2rem;margin-bottom:10px">⏳</div>
           <div style="font-weight:800;color:var(--ink)">Đang tải gợi ý...</div>
         </div>`;
    return;
  }

  function pickRandom(arr, n){
    const pool   = [...arr];
    const result = [];
    while(result.length < Math.min(n, pool.length)){
      const i = Math.floor(Math.random() * pool.length);
      result.push(pool.splice(i, 1)[0]);
    }
    return result;
  }

  function renderCards(){
    const picks = pickRandom(GAMES, 3);

    const cards = picks.map(pick => {
      const idx  = gameIndex(pick);
      const cats = getCategories(pick);
      return `
        <div class="daily-pick-card" onclick="goBoardgame(); setTimeout(()=>goDetail(${idx}), 80)">
          <div class="daily-pick-color-bar" style="background:${pick.color}"></div>
          <div class="daily-pick-body">
            <div class="daily-pick-top">
              <div class="daily-pick-emoji">${pick.emoji}</div>
              <div class="daily-pick-info">
                <div class="daily-pick-name">${esc(pick.name)}</div>
                <div class="daily-pick-tags">
                  ${cats.map(c => `<span class="tag">${esc(c)}</span>`).join('')}
                  <span class="tag">👥 ${esc(pick.players)}</span>
                  <span class="tag">⏱ ${esc(pick.time)}</span>
                  <span class="tag ${diffClass(pick.difficulty)}">⚡ ${esc(pick.difficulty)}</span>
                </div>
              </div>
            </div>
            <div class="daily-pick-objective">
              <strong>Mục tiêu:</strong> ${esc(pick.objective)}
            </div>
            <div class="daily-pick-footer">
              <div class="daily-pick-cta">Xem luật chơi ngay</div>
            </div>
          </div>
        </div>`;
    }).join('');

    wrap.innerHTML = `
      <div style="display:grid;grid-template-columns:repeat(auto-fill,minmax(260px,1fr));gap:16px;margin-bottom:16px;">
        ${cards}
      </div>
      <div style="text-align:center;">
        <button class="daily-reroll-btn" id="reroll-btn">🎲 Thử 3 game khác</button>
      </div>`;

    document.getElementById('reroll-btn')?.addEventListener('click', e => {
      e.stopPropagation();
      renderCards();
    });
  }

  renderCards();
}
