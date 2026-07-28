/* ══════════════════════════════════════════════
   SETTINGS PAGE — js/app/app-settings.js
   ─────────────────────────────────────────────
   ⚠️ TÁCH RA từ js/app.js. Trang "Cài đặt cá nhân"
   (pages/settings.html): lưu tên hiển thị chat + bộ chọn theme
   mùa (window.TCQ_THEMES từ js/theme.js).

   Cần: js/theme.js (window.TCQ_THEMES, window.getCurrentTheme,
   window.applyTheme) — load TRƯỚC hoặc SAU đều được, vì
   initSettings() chỉ được gọi lúc router vào #settings (sau khi
   toàn bộ script đã load).
   ══════════════════════════════════════════════ */

function initSettings(){
  const input = document.getElementById('settings-username');
  if(input) input.value = localStorage.getItem('tcq_username') || '';
  renderThemePicker();
}

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

window.initSettings         = initSettings;
window.saveUsernameSettings = saveUsernameSettings;
