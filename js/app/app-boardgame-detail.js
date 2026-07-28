/* ══════════════════════════════════════════════
   BOARDGAME DETAIL — js/app/app-boardgame-detail.js
   ─────────────────────────────────────────────
   ⚠️ TÁCH RA từ js/app.js. Render trang chi tiết 1 game
   (pages/boardgame.html #page-detail): hero, mục tiêu, ảnh
   hướng dẫn, các bước chuẩn bị/lượt chơi, PDF luật chơi
   (Google Drive preview), mẹo chơi, video YouTube, game liên
   quan cùng thể loại. Gọi bởi goDetail() ở app-router.js.

   Cần: app-state.js (esc, diffClass, getCategories, gameIndex)
   — load TRƯỚC file này.
   ══════════════════════════════════════════════ */

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
    const ytId = window.getYoutubeId(g.youtubeUrl);
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
          const ri = gameIndex(r);
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

window.renderDetail = renderDetail;
