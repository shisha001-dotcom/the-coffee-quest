/* ══════════════════════════════════════════════
   ROUTER — js/app/app-router.js
   ─────────────────────────────────────────────
   ⚠️ ĐÃ QUAY VỀ LOGIC ĐƠN GIẢN CỦA BẢN CŨ (ver1.2): loadPage()
   KHÔNG còn await window.GAMES_READY / gọi ensureGameIndexBuilt()
   bên trong nữa. GAMES đã được đảm bảo tải xong TRƯỚC KHI
   routeFromHash() được gọi lần đầu tiên (xem js/app/app-init.js:
   window.GAMES_READY.then(...)) nên các lần điều hướng sau (kể cả
   qua hashchange) không cần chờ lại — đúng luồng bản cũ.

   Cần: app-state.js, app-menu-header.js (load TRƯỚC file này).
   ══════════════════════════════════════════════ */

/* ═══ ROUTER ═══ */
async function loadPage(pageName){
  const app = document.getElementById('app');
  try {
    const res = await fetch('pages/' + pageName + '.html');
    if(!res.ok) throw new Error('HTTP ' + res.status + ' — pages/' + pageName + '.html');
    app.innerHTML = await res.text();
    window.scrollTo(0, 0);

    if(pageName === 'boardgame'){
      if (typeof window.initBoardgame === 'function') {
        window.initBoardgame();
      } else {
        console.error('[app-router] initBoardgame chưa sẵn sàng — kiểm tra app-boardgame-list.js đã load chưa.');
      }
    }
    if(pageName === 'settings'){
      if (typeof window.initSettings === 'function') window.initSettings();
    }
    if(pageName === 'membership' && typeof window.initMembership === 'function') window.initMembership();
    if(pageName === 'news'){
      if (typeof window.renderDailyPick === 'function') {
        window.renderDailyPick();
      } else {
        console.error('[app-router] renderDailyPick chưa sẵn sàng — kiểm tra app-daily-pick.js đã load chưa.');
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

/* ═══ NAVIGATION ═══ */
function goNews(){
  closeMenu();
  if(location.hash === '#news'){ routeFromHash(); return; }
  location.hash = 'news';
}
function goBoardgame(){
  closeMenu();
  if(location.hash === '#boardgame'){ routeFromHash(); return; }
  location.hash = 'boardgame';
}
function goContact(){
  closeMenu();
  if(location.hash === '#contact'){ routeFromHash(); return; }
  location.hash = 'contact';
}
function goSettings(){
  closeMenu();
  if(location.hash === '#settings'){ routeFromHash(); return; }
  location.hash = 'settings';
}
function goMembership(){
  closeMenu();
  if(location.hash === '#membership'){ routeFromHash(); return; }
  location.hash = 'membership';
}

/* ═══ BOARDGAME — List & Detail navigation ═══ */
function showInApp(id){
  document.querySelectorAll('#app .page').forEach(p => p.classList.remove('active'));
  const el = document.getElementById(id);
  if(el) el.classList.add('active');
}

function goList(){
  showInApp('page-list');
  const v = document.getElementById('d-video');
  if(v) v.innerHTML = '';
  window.scrollTo(0,0);
  history.pushState(null,'','#boardgame');
}

function goDetail(idx){
  if(idx < 0 || idx >= GAMES.length) return;
  currentIdx = idx;
  showInApp('page-detail');
  renderDetail(idx);
  window.scrollTo(0,0);
  const slug = gameSlugs.slugById[GAMES[idx].id] || idx;
  history.pushState(null,'','#game-'+slug);
  trackGameView(idx);
}

/* ═══ TRACKING ═══ */
function getDateStr(){ return new Date().toISOString().slice(0,10); }

function trackGameView(idx){
  if(typeof window.__fbTrack !== 'function') return;
  const game = GAMES[idx];
  if(!game) return;
  window.__fbTrack('gameViews', getDateStr(), String(game.id), game.name || String(game.id));
}

/* ═══ HASH ROUTER ═══ */
function routeFromHash(){
  const hash = location.hash.replace('#','');
  if(hash === 'boardgame' || hash.startsWith('game-')){
    loadPage('boardgame').then(()=>{
      updateHeader('boardgame'); setActive('goBoardgame');
      if(hash.startsWith('game-')){
        const key = hash.replace('game-','');
        let idx = -1;

        const idFromSlug = gameSlugs.idBySlug[key];
        if(idFromSlug !== undefined){
          idx = GAMES.findIndex(g => g.id === idFromSlug);
        }
        if(idx === -1){
          const numIdx = parseInt(key, 10);
          if(!isNaN(numIdx) && numIdx >= 0 && numIdx < GAMES.length) idx = numIdx;
        }
        if(idx !== -1) setTimeout(()=>goDetail(idx), 80);
      }
    });
  } else if(hash === 'contact'){
    loadPage('contact'); updateHeader('contact'); setActive('goContact');
  } else if(hash === 'membership'){
    loadPage('membership'); updateHeader('membership'); setActive('goMembership');
  } else if(hash === 'settings'){
    loadPage('settings'); updateHeader('settings'); setActive('goSettings');
  } else {
    if(location.hash !== '#news') history.replaceState(null,'','#news');
    loadPage('news'); updateHeader('news'); setActive('goNews');
  }
}

window.addEventListener('hashchange', routeFromHash);

/* ── Export tường minh ── */
window.loadPage      = loadPage;
window.routeFromHash = routeFromHash;
window.goNews        = goNews;
window.goBoardgame   = goBoardgame;
window.goContact     = goContact;
window.goSettings    = goSettings;
window.goMembership  = goMembership;
window.goList        = goList;
window.goDetail      = goDetail;
