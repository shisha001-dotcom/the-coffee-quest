// ═══════════════════════════════════════════════════════════════
//  app.js — The Coffee Quest
//  ─────────────────────────────────────────────────────────────
//  ĐÃ TÁCH: toàn bộ logic trang "Thẻ thành viên" (initMembership,
//  lookupMembership, normalizePhoneVN) chuyển sang js/membership.js.
//  File này giờ CHỈ còn lo: router hash-based, render list/detail
//  boardgame, lightbox, daily pick, settings — đúng với vai trò
//  "Router + render UI" mà tài liệu vốn mô tả.
//
//  ⚠️ TỐI ƯU: thêm gameIndexById (Map id → index) để tránh gọi
//  GAMES.indexOf(g) bên trong .map() ở renderGrid/renderDetail/
//  renderDailyPick — trước đây là O(n²) vì mỗi lần indexOf() là
//  O(n), chạy lặp lại O(n) lần trong vòng lặp render. Với danh
//  sách game càng lớn, chi phí render càng tăng bậc hai không cần
//  thiết. Giờ tra cứu O(1) qua Map, build lại 1 lần mỗi khi GAMES
//  thay đổi (ngay sau GAMES_READY).
// ═══════════════════════════════════════════════════════════════

let activeFilter = '🧩 Tất cả', searchQ = '', currentIdx = -1;
let gameSlugs = { slugById: {}, idBySlug: {} };
let gameIndexById = new Map(); // ⚠️ MỚI

const esc = window.escHtml;
function diffClass(d){ return d==='Dễ'?'diff-easy':d==='Khó'?'diff-hard':'diff-medium' }
function getYtId(url){
  if(!url||url.includes('/None')) return null;
  const pp=[/[?&]v=([a-zA-Z0-9_-]{11})/,/youtu\.be\/([a-zA-Z0-9_-]{11})/,/embed\/([a-zA-Z0-9_-]{11})/,/shorts\/([a-zA-Z0-9_-]{11})/];
  for(const p of pp){ const m=url.match(p); if(m) return m[1]; }
  return null;
}

/* ── Helper: lấy categories chuẩn (luôn trả về array) ── */
function getCategories(g){
  return Array.isArray(g.categories) && g.categories.length
    ? g.categories
    : (g.category ? [g.category] : []);
}

/* ── Helper: chỉ số của game trong GAMES — O(1) thay vì GAMES.indexOf() O(n) ── */
function rebuildGameIndex(){
  gameIndexById = new Map(GAMES.map((g, i) => [g.id, i]));
}
function gameIndex(g){
  const idx = gameIndexById.get(g.id);
  return idx === undefined ? GAMES.indexOf(g) : idx; // fallback an toàn nếu index chưa build kịp
}

/* ═══ MENU ═══ */
const menuToggle  = document.getElementById('menu-toggle');
const sideMenu    = document.getElementById('side-menu');
const menuOverlay = document.getElementById('menu-overlay');

function openMenu(){ sideMenu.classList.add('open'); menuOverlay.classList.add('show'); }
function closeMenu(){ sideMenu.classList.remove('open'); menuOverlay.classList.remove('show'); }

menuToggle?.addEventListener('click', openMenu);
menuOverlay?.addEventListener('click', closeMenu);

/* ═══ HEADER ═══ */
function updateHeader(type){
  const search = document.getElementById('header-search');
  const count  = document.getElementById('header-count-wrap');
  const header = document.querySelector('.site-header');
  if(type === 'boardgame'){
    search.style.display = 'flex';
    count.style.display  = 'block';
    header.classList.remove('news-mode');
  } else {
    search.style.display = 'none';
    count.style.display  = 'none';
    header.classList.add('news-mode');
  }
}

/* ═══ ROUTER ═══ */
async function loadPage(pageName){
  const app = document.getElementById('app');
  try {
    const res = await fetch('pages/' + pageName + '.html');
    if(!res.ok) throw new Error('HTTP ' + res.status + ' — pages/' + pageName + '.html');
    app.innerHTML = await res.text();
    window.scrollTo(0, 0);
    if(pageName === 'boardgame') initBoardgame();
    if(pageName === 'settings')  initSettings();
    /* ĐÃ TÁCH: gọi qua window vì logic thật nằm ở js/membership.js */
    if(pageName === 'membership' && typeof window.initMembership === 'function') window.initMembership();
    if(pageName === 'news')      renderDailyPick();
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
function setActive(fn){
  document.querySelectorAll('.menu-item').forEach(el=>{
    el.classList.toggle('active', (el.getAttribute('onclick')||'').includes(fn));
  });
}

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

/* ═══ BOARDGAME — List & Detail ═══ */
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

/* ═══ BOARDGAME LIST ═══ */
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
    const ri   = gameIndex(g); // ⚠️ TỐI ƯU: O(1) thay vì GAMES.indexOf(g) O(n)
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

/* ═══ BOARDGAME DETAIL ═══ */
function renderDetail(idx){
  const g    = GAMES[idx];
  const cats = getCategories(g);

  const set  = (id,val) => { const el=document.getElementById(id); if(el) el.textContent=val; };
  const setH = (id,val) => { const el=document.getElementById(id); if(el) el.innerHTML=val; };

  set('d-crumb', g.name);
  set('d-emoji', g.emoji);
  set('d-title', g.name);
  set('d-objective', g.objective);
  set('d-win', g.win);

  const bg = document.getElementById('d-hero-bg');
  if(bg) bg.style.backgroundImage = g.heroBg
    ? `url('${g.heroBg}')`
    : `linear-gradient(135deg,${g.color}cc,${g.color}44)`;

  setH('d-tags',
    cats.map(c => `<span class="hero-tag hl">${esc(c)}</span>`).join('')
    + `<span class="hero-tag">👥 ${esc(g.players)} người</span>`
    + `<span class="hero-tag">⏱ ${esc(g.time)}</span>`
    + `<span class="hero-tag ${diffClass(g.difficulty)}">⚡ ${esc(g.difficulty)}</span>`
  );

  const imgEl = document.getElementById('d-images');
  if(imgEl){
    if(g.images && g.images.length){
      imgEl.innerHTML = `<div class="images-grid">${g.images.map(im=>
        `<div class="img-wrap" onclick="openLb('${im.url.replace(/'/g,"\\'")}','${esc(im.caption)}')">`
        +`<img src="${im.url}" alt="${esc(im.caption)}" loading="lazy" onerror="this.parentElement.style.display='none'"/>`
        +`<div class="img-caption">${esc(im.caption)}</div></div>`).join('')}</div>`;
    } else {
      imgEl.innerHTML = `<div class="no-images"><b>🖼️</b> Chưa có ảnh hướng dẫn.<br><code>images: [{url,caption}]</code></div>`;
    }
  }

  setH('d-setup', (g.setup||[]).map((s,i)=>`<li class="step-item"><div class="step-num">${i+1}</div><div>${esc(s)}</div></li>`).join(''));
  setH('d-turn',  (g.turn||[]).map(t=>`<div class="turn-item"><div class="turn-icon">▸</div><div>${esc(t)}</div></div>`).join(''));

  const pw = document.getElementById('d-pdf-wrap');
const pd = document.getElementById('d-pdf');
if(pw && pd){
  const previewUrl = g.rulesPdfUrl ? window.gdrivePreviewUrl(g.rulesPdfUrl) : null;
  if(previewUrl){
    pw.style.display = 'block';
    pd.innerHTML = `
      <div class="pdf-frame">
        <iframe src="${previewUrl}" title="Luật chơi ${esc(g.name)} (PDF)" allow="autoplay" loading="lazy"></iframe>
      </div>
      <a class="pdf-open-link" href="${g.rulesPdfUrl}" target="_blank" rel="noopener">↗️ Mở file gốc trên Google Drive</a>`;
  } else {
    pw.style.display = 'none';
    pd.innerHTML = '';
  }
}

  const tw = document.getElementById('d-tips-wrap');
  if(tw){
    if(g.tips && g.tips.length){
      tw.style.display = 'block';
      setH('d-tips', g.tips.map(t=>`<div class="tip-item"><div class="turn-icon">💡</div><div>${esc(t)}</div></div>`).join(''));
    } else {
      tw.style.display = 'none';
    }
  }

  const vw  = document.getElementById('d-video-wrap');
  const vid = document.getElementById('d-video');
  if(vw && vid){
    vw.style.display = 'block';
    const ytId = getYtId(g.youtubeUrl);
    vid.innerHTML = ytId
      ? `<div class="video-frame"><iframe src="https://www.youtube.com/embed/${ytId}?rel=0&modestbranding=1" title="Hướng dẫn ${esc(g.name)}" allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture" allowfullscreen></iframe></div>`
      : `<div class="no-video"><div class="nv-icon">📽️</div><p>Chưa có video hướng dẫn.</p><a href="https://www.youtube.com/results?search_query=${encodeURIComponent('how to play '+g.name)}" target="_blank" rel="noopener">Tìm trên YouTube →</a></div>`;
  }

  const related = GAMES
    .filter((r, i) => i !== idx && getCategories(r).some(c => cats.includes(c)))
    .slice(0, 4);

  const relEl = document.getElementById('d-related');
  if(relEl){
    relEl.innerHTML = related.length
      ? related.map(r => {
          const ri = gameIndex(r); // ⚠️ TỐI ƯU: O(1) thay vì GAMES.indexOf(r) O(n)
          return `<div class="rel-card" onclick="goDetail(${ri})">
            <div class="rel-stripe" style="background:${r.color}"></div>
            <div class="rel-body"><span class="rel-emoji">${r.emoji}</span>
            <div class="rel-name">${esc(r.name)}</div>
            <div class="rel-meta">
              <span class="rel-tag">👥 ${esc(r.players)}</span>
              <span class="rel-tag">⏱ ${esc(r.time)}</span>
              <span class="rel-tag ${diffClass(r.difficulty)}">⚡ ${esc(r.difficulty)}</span>
            </div></div>
            <div class="rel-go">Xem luật chơi</div></div>`;
        }).join('')
      : `<p style="color:var(--muted);font-size:.9rem;grid-column:1/-1">Chưa có game cùng thể loại.</p>`;
  }
}

/* ═══ INIT BOARDGAME PAGE ═══ */
function initBoardgame(){
  renderGrid();
  const si = document.getElementById('searchInput');
  if(si){
    si.value = searchQ;
    /* ⚠️ TỐI ƯU: dùng window.debounce dùng chung thay vì gọi renderGrid()
       trên MỖI keystroke — giảm số lần re-render khi gõ nhanh */
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

/* ═══ SETTINGS ═══ */
function initSettings(){
  const input = document.getElementById('settings-username');
  if(input) input.value = localStorage.getItem('tcq_username') || '';
  renderThemePicker();
}

/* ⚠️ MỚI: render + bind bộ chọn theme trong trang Cài đặt */
function renderThemePicker(){
  const wrap = document.getElementById('theme-picker');
  if(!wrap || !window.TCQ_THEMES) return;

  const current = window.getCurrentTheme();

  wrap.innerHTML = window.TCQ_THEMES.map(t => `
    <button type="button" class="theme-chip${t.id === current ? ' active' : ''}" data-theme-id="${t.id}">
      <span class="theme-chip-icon">${t.icon}</span>
      <span>${esc(t.label)}</span>
    </button>
  `).join('');

  wrap.querySelectorAll('.theme-chip').forEach(btn => {
    btn.addEventListener('click', () => {
      window.applyTheme(btn.dataset.themeId);
      wrap.querySelectorAll('.theme-chip').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
    });
  });
}

function saveUsernameSettings(){
  const input = document.getElementById('settings-username');
  if(!input) return;
  const val = input.value.trim();
  if(!val){ input.focus(); return; }
  localStorage.setItem('tcq_username', val);
  if(typeof updateChatUsername === 'function') updateChatUsername(val);
  const btn = document.querySelector('.settings-page button');
  if(btn){ const orig=btn.textContent; btn.textContent='✅ Đã lưu!'; setTimeout(()=>btn.textContent=orig, 1800); }
}

/* ═══ LIGHTBOX ═══ */
function openLb(url, cap){
  const lb    = document.getElementById('lightbox');
  const img   = document.getElementById('lb-img');
  const capEl = document.getElementById('lb-caption');
  if(!lb) return;
  if(img)   img.src = url;
  if(capEl) capEl.textContent = cap;
  lb.classList.add('open');
  document.body.style.overflow = 'hidden';
}
function closeLb(){
  const lb = document.getElementById('lightbox');
  if(lb) lb.classList.remove('open');
  document.body.style.overflow = '';
}

document.addEventListener('keydown', e=>{ if(e.key==='Escape') closeLb(); });
const staticLb = document.getElementById('lightbox');
if(staticLb) staticLb.addEventListener('click', e=>{ if(e.target.id==='lightbox') closeLb(); });

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

window.GAMES_READY.then(() => {
  gameSlugs = window.buildGameSlugMap(GAMES);
  rebuildGameIndex(); // ⚠️ MỚI: build 1 lần ngay khi GAMES sẵn sàng
  routeFromHash();
});

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
      const idx  = gameIndex(pick); // ⚠️ TỐI ƯU: O(1) thay vì GAMES.indexOf(pick) O(n)
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
