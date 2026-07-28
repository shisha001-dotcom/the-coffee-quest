/* ══════════════════════════════════════════════
   LIGHTBOX — js/app/app-lightbox.js
   ─────────────────────────────────────────────
   ⚠️ TÁCH RA từ js/app.js. Mở/đóng lightbox xem ảnh phóng to
   (dùng chung bởi trang chi tiết game và trang Liên hệ). Phần
   tử #lightbox nằm tĩnh trong index.html.
   ══════════════════════════════════════════════ */

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

window.openLb  = openLb;
window.closeLb = closeLb;
