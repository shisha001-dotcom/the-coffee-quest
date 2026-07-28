/* ══════════════════════════════════════════════
   BANNERS + DAILY PICK — js/app/app-daily-pick.js
   ─────────────────────────────────────────────
   ⚠️ ĐÃ QUAY VỀ LOGIC ĐƠN GIẢN CỦA BẢN CŨ (ver1.2): bỏ trạng thái
   "đang tải / lỗi mạng + nút thử lại". Nếu GAMES chưa có dữ liệu
   thì không hiển thị gì, giống hệt hành vi bản cũ.

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
  if(!wrap || !GAMES || !GAMES.length) return;

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
