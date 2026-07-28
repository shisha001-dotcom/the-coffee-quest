/* ══════════════════════════════════════════════
   BANNERS + DAILY PICK — js/app/app-daily-pick.js
   ─────────────────────────────────────────────
   ⚠️ FIX (đồng bộ với app-boardgame-list.js): thêm nút "Thử lại
   ngay" khi GAMES chưa tải được, thay vì chỉ hiện chữ chờ vô thời
   hạn không có cách nào thoát ra trên mobile.

   Cần: app-state.js (esc, diffClass, getCategories, gameIndex)
   — load TRƯỚC file này.
   ══════════════════════════════════════════════ */

/* ═══ BANNERS (trang News) ═══ */
function renderBanners(){
  const wrap = document.getElementById('news-banners-wrap');
  if(!wrap) return;
  const config = window.BANNER_CONFIG;
  if(!config || !config.length) return;
  const visible = config.filter(b => b.visible && b.url);
  if(!visible.length){ wrap.innerHTML = ''; return; }
  wrap.innerHTML = visible.map(b => `
    <div class="banner-slide">
      <img class="banner-img" src="${esc(b.url)}" alt="Banner" loading="lazy"
           onerror="this.parentElement.style.display='none'">
    </div>
  `).join('');
}

/* ═══ DAILY PICK — 3 game ngẫu nhiên ═══ */
function renderDailyPick(){
  renderBanners();

  const wrap = document.getElementById('daily-pick-card');
  if(!wrap) return;

  /* ⚠️ FIX: thêm nút thử lại thay vì chỉ hiện chữ chờ mãi */
  if (!GAMES || !GAMES.length) {
    const isError = window.GAMES_LOAD_ERROR;
    wrap.innerHTML = `
      <div style="text-align:center;padding:40px 20px;color:var(--muted)">
        <div style="font-size:2.2rem;margin-bottom:10px">${isError ? '📡' : '⏳'}</div>
        <div style="font-weight:800;color:var(--ink)">
          ${isError ? 'Không tải được gợi ý' : 'Đang tải gợi ý...'}
        </div>
        <p style="margin-top:6px;font-size:.85rem">
          ${isError ? 'Mạng có thể đang chập chờn — bấm để thử lại.' : 'Trang sẽ tự hiện gợi ý khi kết nối được.'}
        </p>
        <button type="button" id="dailyPickRetryBtn"
          style="margin-top:14px;padding:9px 20px;border:none;border-radius:var(--r-md);
                 background:var(--accent);color:#fff;font-weight:800;font-size:.82rem;cursor:pointer;">
          🔄 Thử lại ngay
        </button>
      </div>`;
    document.getElementById('dailyPickRetryBtn')?.addEventListener('click', () => {
      renderDailyPick();
      if (typeof window.retryLoadGamesNow === 'function') window.retryLoadGamesNow();
    });
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

window.renderDailyPick = renderDailyPick;
window.renderBanners   = renderBanners;
