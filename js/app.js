// ═══════════════════════════════════════════════════════════════
//  app.js — The Coffee Quest
// ═══════════════════════════════════════════════════════════════

let activeFilter = 'all', searchQ = '', currentIdx = -1;

function esc(s){ return String(s||'').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;') }
function diffClass(d){ return d==='Dễ'?'diff-easy':d==='Khó'?'diff-hard':'diff-medium' }
function getYtId(url){
  if(!url||url.includes('/None')) return null;
  const pp=[/[?&]v=([a-zA-Z0-9_-]{11})/,/youtu\.be\/([a-zA-Z0-9_-]{11})/,/embed\/([a-zA-Z0-9_-]{11})/,/shorts\/([a-zA-Z0-9_-]{11})/];
  for(const p of pp){ const m=url.match(p); if(m) return m[1]; }
  return null;
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

/* ═══ ROUTER — load page vào #app ═══ */
async function loadPage(pageName){
  const app = document.getElementById('app');
  try {
    const res = await fetch('pages/' + pageName + '.html');
    if(!res.ok) throw new Error('HTTP ' + res.status + ' — pages/' + pageName + '.html');
    const html = await res.text();
    app.innerHTML = html;
    window.scrollTo(0, 0);
    if(pageName === 'boardgame') initBoardgame();
    if(pageName === 'settings')  initSettings();
    if(pageName === 'news')       renderDailyPick();
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

function goNews(){      loadPage('news'); updateHeader('news'); closeMenu(); setActive('goNews'); }
function goBoardgame(){ loadPage('boardgame'); updateHeader('boardgame'); closeMenu(); setActive('goBoardgame'); }
function goContact(){   loadPage('contact');   updateHeader('contact');   closeMenu(); setActive('goContact'); }
function goSettings(){  loadPage('settings');  updateHeader('settings');  closeMenu(); setActive('goSettings'); }

/* ═══ BOARDGAME — List & Detail dùng classList.active (khớp CSS) ═══ */
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
  history.pushState(null,'','#');
}

function goDetail(idx){
  currentIdx = idx;
  showInApp('page-detail');
  renderDetail(idx);
  window.scrollTo(0,0);
  history.pushState(null,'','#game-'+idx);
}

/* ═══ BOARDGAME LIST ═══ */
function filteredGames(){
  return GAMES.filter(g=>{
    const mc = activeFilter==='all' || g.category===activeFilter;
    const q  = searchQ.toLowerCase();
    return mc && (!q || g.name.toLowerCase().includes(q) || (g.category||'').toLowerCase().includes(q));
  });
}

function renderGrid(){
  const games   = filteredGames();
  const countEl = document.getElementById('countNum');
  if(countEl) countEl.textContent = games.length;
  const grid  = document.getElementById('grid');
  const empty = document.getElementById('empty');
  if(!grid) return;
  if(!games.length){ grid.innerHTML=''; if(empty) empty.style.display='block'; return; }
  if(empty) empty.style.display='none';
  grid.innerHTML = games.map((g,i)=>{
    const ri = GAMES.indexOf(g);
    return `<div class="game-card" onclick="goDetail(${ri})" style="animation-delay:${i*0.04}s">
      <div class="card-stripe" style="background:${g.color}"></div>
      <div class="card-body">
        <div class="card-top">
          <div class="card-emoji">${g.emoji}</div>
          <div>
            <div class="card-title">${esc(g.name)}</div>
            <div class="card-meta">
              <span class="tag">${esc(g.category)}</span>
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
  const g = GAMES[idx];
  const set  = (id,val) => { const el=document.getElementById(id); if(el) el.textContent=val; };
  const setH = (id,val) => { const el=document.getElementById(id); if(el) el.innerHTML=val; };

  set('d-crumb', g.name);
  set('d-emoji', g.emoji);
  set('d-title', g.name);
  set('d-objective', g.objective);
  set('d-win', g.win);

  const bg = document.getElementById('d-hero-bg');
  if(bg) bg.style.backgroundImage = g.heroBg ? `url('${g.heroBg}')` : `linear-gradient(135deg,${g.color}cc,${g.color}44)`;

  setH('d-tags',
    `<span class="hero-tag hl">${esc(g.category)}</span>`
    +`<span class="hero-tag">👥 ${esc(g.players)} người</span>`
    +`<span class="hero-tag">⏱ ${esc(g.time)}</span>`
    +`<span class="hero-tag ${diffClass(g.difficulty)}">⚡ ${esc(g.difficulty)}</span>`);

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

  const tw = document.getElementById('d-tips-wrap');
  if(tw){
    if(g.tips && g.tips.length){
      tw.style.display = 'block';
      setH('d-tips', g.tips.map(t=>`<div class="tip-item"><div class="turn-icon">💡</div><div>${esc(t)}</div></div>`).join(''));
    } else tw.style.display = 'none';
  }

  const vw  = document.getElementById('d-video-wrap');
  const vid = document.getElementById('d-video');
  if(vw && vid){
    vw.style.display = 'block';
    const ytId = getYtId(g.youtubeUrl);
    if(ytId){
      vid.innerHTML = `<div class="video-frame"><iframe src="https://www.youtube.com/embed/${ytId}?rel=0&modestbranding=1" title="Hướng dẫn ${esc(g.name)}" allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture" allowfullscreen></iframe></div>`;
    } else {
      vid.innerHTML = `<div class="no-video"><div class="nv-icon">📽️</div><p>Chưa có video hướng dẫn.</p><a href="https://www.youtube.com/results?search_query=${encodeURIComponent('how to play '+g.name)}" target="_blank" rel="noopener">Tìm trên YouTube →</a></div>`;
    }
  }

  const related = GAMES.filter((_,i)=> i!==idx && GAMES[i].category===g.category).slice(0,4);
  const relEl = document.getElementById('d-related');
  if(relEl){
    relEl.innerHTML = related.length
      ? related.map(r=>{
          const ri = GAMES.indexOf(r);
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
      : `<p style="color:var(--muted);font-size:.9rem;grid-column:1/-1">Chưa có game cùng thể loại "${esc(g.category)}".</p>`;
  }
}

/* ═══ INIT BOARDGAME PAGE ═══ */
function initBoardgame(){
  renderGrid();
  const si = document.getElementById('searchInput');
  if(si) si.addEventListener('input', e=>{ searchQ=e.target.value; renderGrid(); });
  document.querySelectorAll('.chip').forEach(c=>{
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

/* ═══ BOOT ═══ */
window.GAMES_READY.then(() => {
  goNews();
});

/* ═══ DAILY PICK — Hôm nay chơi gì ═══ */
function renderDailyPick(){
  const wrap = document.getElementById('daily-pick-card');
  if(!wrap || !GAMES || !GAMES.length) return;

  const pick = GAMES[Math.floor(Math.random() * GAMES.length)];
  const idx  = GAMES.indexOf(pick);
  const dc   = (d) => d==='Dễ'?'diff-easy':d==='Khó'?'diff-hard':'diff-medium';

  wrap.innerHTML = `
    <div class="daily-pick-card" onclick="goBoardgame(); setTimeout(()=>goDetail(${idx}), 80)">
      <div class="daily-pick-color-bar" style="background:${pick.color}"></div>
      <div class="daily-pick-body">
        <div class="daily-pick-top">
          <div class="daily-pick-emoji">${pick.emoji}</div>
          <div class="daily-pick-info">
            <div class="daily-pick-name">${esc(pick.name)}</div>
            <div class="daily-pick-tags">
              <span class="tag">${esc(pick.category)}</span>
              <span class="tag">👥 ${esc(pick.players)}</span>
              <span class="tag">⏱ ${esc(pick.time)}</span>
              <span class="tag ${dc(pick.difficulty)}">⚡ ${esc(pick.difficulty)}</span>
            </div>
          </div>
        </div>
        <div class="daily-pick-objective">
          <strong>Mục tiêu:</strong> ${esc(pick.objective)}
        </div>
        <div class="daily-pick-footer">
          <div class="daily-pick-cta">Xem luật chơi ngay</div>
          <button class="daily-reroll-btn" onclick="event.stopPropagation(); renderDailyPick()">
            🎲 Thử game khác
          </button>
        </div>
      </div>
    </div>`;
}
