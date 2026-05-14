// ────────────────────────────────────────────────────────────────
//  ENGINE — không cần chỉnh sửa phần dưới
// ────────────────────────────────────────────────────────────────

let activeFilter = 'all', searchQ = '', currentIdx = -1;

function esc(s){ return String(s||'').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;') }
function diffClass(d){ return d==='Dễ'?'diff-easy':d==='Khó'?'diff-hard':'diff-medium' }
function getYtId(url){
  if(!url||url.includes('/None')) return null;
  const pp=[/[?&]v=([a-zA-Z0-9_-]{11})/,/youtu\.be\/([a-zA-Z0-9_-]{11})/,/embed\/([a-zA-Z0-9_-]{11})/,/shorts\/([a-zA-Z0-9_-]{11})/];
  for(const p of pp){ const m=url.match(p); if(m) return m[1]; }
  return null;
}

// ── PAGES ──
function showPage(id){ document.querySelectorAll('.page').forEach(p=>p.classList.remove('active')); document.getElementById('page-'+id).classList.add('active'); window.scrollTo(0,0); }

function goList(){
  showPage('list');
  history.pushState(null,'','#');
  const v=document.getElementById('d-video'); if(v) v.innerHTML='';
}

function goDetail(idx){
  currentIdx=idx;
  renderDetail(idx);
  showPage('detail');
  history.pushState(null,'','#game-'+idx);
}

window.addEventListener('popstate', handleHash);
function handleHash(){
  const h=window.location.hash;
  if(h.startsWith('#game-')){ const i=parseInt(h.slice(6)); if(!isNaN(i)&&i>=0&&i<GAMES.length){ currentIdx=i; renderDetail(i); showPage('detail'); return; } }
  showPage('news');
}

// ── LIST ──
function filteredGames(){ 
  return GAMES.filter(g=>{ 
    const mc=activeFilter==='all'||g.category===activeFilter; 
    const q=searchQ.toLowerCase(); 
    const mq=!q||g.name.toLowerCase().includes(q)||(g.category||'').toLowerCase().includes(q);
    return mc&&mq;
  });
}

function renderGrid(){
  const games=filteredGames();
  document.getElementById('countNum').textContent=games.length;
  const grid=document.getElementById('grid'), empty=document.getElementById('empty');
  if(!games.length){ grid.innerHTML=''; empty.style.display='block'; return; }
  empty.style.display='none';
  grid.innerHTML=games.map((g,i)=>{
    const ri=GAMES.indexOf(g);
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

// ── DETAIL ──
function renderDetail(idx){
  const g=GAMES[idx];
  document.getElementById('d-crumb').textContent=g.name;

  // hero
  const bg=document.getElementById('d-hero-bg');
  bg.style.backgroundImage = g.heroBg ? `url('${g.heroBg}')` : `linear-gradient(135deg,${g.color}cc,${g.color}44)`;

  document.getElementById('d-emoji').textContent=g.emoji;
  document.getElementById('d-title').textContent=g.name;
  document.getElementById('d-tags').innerHTML=`
    <span class="hero-tag hl">${esc(g.category)}</span>
    <span class="hero-tag">👥 ${esc(g.players)} người</span>
    <span class="hero-tag">⏱ ${esc(g.time)}</span>
    <span class="hero-tag ${diffClass(g.difficulty)}">⚡ ${esc(g.difficulty)}</span>`;

  document.getElementById('d-objective').textContent=g.objective;

  // images
  const imgEl=document.getElementById('d-images');
  if(g.images&&g.images.length){
    imgEl.innerHTML=`<div class="images-grid">${g.images.map(im=>`
      <div class="img-wrap" onclick="openLb('${im.url.replace(/'/g,"\\'")}','${esc(im.caption)}')">
        <img src="${im.url}" alt="${esc(im.caption)}" loading="lazy" onerror="this.parentElement.style.display='none'"/>
        <div class="img-caption">${esc(im.caption)}</div>
      </div>`).join('')}</div>`;
  } else {
    imgEl.innerHTML=`<div class="no-images">
      <b>🖼️</b>Chưa có ảnh hướng dẫn cho game này.<br>
      Thêm ảnh bằng cách điền trường <code>images</code> trong dữ liệu game:<br>
      <code>images: [{ url: "https://...", caption: "Mô tả" }]</code>
    </div>`;
  }

  // setup
  document.getElementById('d-setup').innerHTML=(g.setup||[]).map((s,i)=>`
    <li class="step-item"><div class="step-num">${i+1}</div><div>${esc(s)}</div></li>`).join('');

  // turn
  document.getElementById('d-turn').innerHTML=(g.turn||[]).map(t=>`
    <div class="turn-item"><div class="turn-icon">▸</div><div>${esc(t)}</div></div>`).join('');

  // win
  document.getElementById('d-win').textContent=g.win;

  // tips
  const tw=document.getElementById('d-tips-wrap');
  if(g.tips&&g.tips.length){
    tw.style.display='block';
    document.getElementById('d-tips').innerHTML=g.tips.map(t=>`
      <div class="tip-item"><div class="turn-icon">💡</div><div>${esc(t)}</div></div>`).join('');
  } else { tw.style.display='none'; }

  // video
  const vw=document.getElementById('d-video-wrap'), ytId=getYtId(g.youtubeUrl);
  vw.style.display='block';
  if(ytId){
    document.getElementById('d-video').innerHTML=`
      <div class="video-frame">
        <iframe src="https://www.youtube.com/embed/${ytId}?rel=0&modestbranding=1"
          title="Hướng dẫn ${esc(g.name)}"
          allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
          allowfullscreen></iframe>
      </div>`;
  } else {
    document.getElementById('d-video').innerHTML=`
      <div class="no-video">
        <div class="nv-icon">📽️</div>
        <p>Chưa có video hướng dẫn.</p>
        <a href="https://www.youtube.com/results?search_query=${encodeURIComponent('how to play '+g.name)}" target="_blank" rel="noopener">Tìm trên YouTube →</a>
      </div>`;
  }

  // related — same category, exclude current, max 4
  const related=GAMES.filter((_,i)=>i!==idx&&GAMES[i].category===g.category).slice(0,4);
  const relEl=document.getElementById('d-related');
  if(related.length){
    relEl.innerHTML=related.map(r=>{
      const ri=GAMES.indexOf(r);
      return `<div class="rel-card" onclick="goDetail(${ri})">
        <div class="rel-stripe" style="background:${r.color}"></div>
        <div class="rel-body">
          <span class="rel-emoji">${r.emoji}</span>
          <div class="rel-name">${esc(r.name)}</div>
          <div class="rel-meta">
            <span class="rel-tag">👥 ${esc(r.players)}</span>
            <span class="rel-tag">⏱ ${esc(r.time)}</span>
            <span class="rel-tag ${diffClass(r.difficulty)}">⚡ ${esc(r.difficulty)}</span>
          </div>
        </div>
        <div class="rel-go">Xem luật chơi</div>
      </div>`;
    }).join('');
  } else {
    relEl.innerHTML=`<p style="color:var(--muted);font-size:.9rem;grid-column:1/-1">Chưa có game cùng thể loại "${esc(g.category)}".</p>`;
  }
}

// ── LIGHTBOX ──
function openLb(url,cap){
  document.getElementById('lb-img').src=url;
  document.getElementById('lb-caption').textContent=cap;
  document.getElementById('lightbox').classList.add('open');
  document.body.style.overflow='hidden';
}
function closeLb(){ document.getElementById('lightbox').classList.remove('open'); document.body.style.overflow=''; }
document.getElementById('lightbox').addEventListener('click',e=>{ if(e.target.id==='lightbox') closeLb(); });

// ── FILTERS ──
document.getElementById('searchInput').addEventListener('input',e=>{ searchQ=e.target.value; renderGrid(); });
document.querySelectorAll('.chip').forEach(c=>{ c.addEventListener('click',()=>{ document.querySelectorAll('.chip').forEach(x=>x.classList.remove('active')); c.classList.add('active'); activeFilter=c.getAttribute('data-filter'); renderGrid(); }); });
document.addEventListener('keydown',e=>{ if(e.key==='Escape') closeLb(); });

// ── INIT ──
renderGrid();
handleHash();

/* ═════════ MENU ═════════ */

const sideMenu = document.getElementById('side-menu');
const menuOverlay = document.getElementById('menu-overlay');

document.getElementById('menu-toggle')?.addEventListener('click', openMenu);

menuOverlay?.addEventListener('click', closeMenu);

function openMenu(){
  sideMenu.classList.add('open');
  menuOverlay.classList.add('show');
}

function closeMenu(){
  sideMenu.classList.remove('open');
  menuOverlay.classList.remove('show');
}

/* ═════════ PAGE ROUTER ═════════ */
  loadPage('boardgame');

  updateHeader('boardgame');

  closeMenu();

}

function goContact(){

  loadPage('contact');

  updateHeader('contact');

  closeMenu();

}

function goSettings(){

  loadPage('settings');

  updateHeader('settings');

  closeMenu();

  setTimeout(()=>{

    const input = document.getElementById('settings-username');

    if(input){

      input.value =
        localStorage.getItem('tcq_username') || '';

    }

  }, 100);

}

/* ═════════ HEADER ═════════ */

function updateHeader(type){

  const search =
    document.getElementById('header-search');

  const count =
    document.getElementById('header-count-wrap');

  const header =
    document.querySelector('.site-header');

  if(type === 'boardgame'){

    search.style.display = 'block';
    count.style.display = 'block';

    header.classList.remove('news-mode');

  }else{

    search.style.display = 'none';
    count.style.display = 'none';

    header.classList.add('news-mode');

  }
}
