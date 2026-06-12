/* ══════════════════════════════════════════════
   DASHBOARD ANALYTICS MODULE
   File: admin/dashboard-analytics.js
   Import sau dashboard.js trong dashboard.html
   ══════════════════════════════════════════════ */

import { initializeApp, getApps } from
  "https://www.gstatic.com/firebasejs/10.12.2/firebase-app.js";
import { getDatabase, ref, get }
  from "https://www.gstatic.com/firebasejs/10.12.2/firebase-database.js";

/* ── Tái dùng Firebase app ── */
const firebaseConfig = {
  apiKey:            "AIzaSyBIn1bj6ndt8Yy5AiPFdeKtI5MrZnaNugc",
  authDomain:        "doublevcute.firebaseapp.com",
  databaseURL:       "https://doublevcute-default-rtdb.asia-southeast1.firebasedatabase.app",
  projectId:         "doublevcute",
  storageBucket:     "doublevcute.firebasestorage.app",
  messagingSenderId: "31483876077",
  appId:             "1:31483876077:web:f2efbb34d8a2c6dcb532e4"
};

const fbApp = getApps().length ? getApps()[0] : initializeApp(firebaseConfig);
const db    = getDatabase(fbApp);

/* ══════════════════════════════════════════════
   HELPERS
   ══════════════════════════════════════════════ */
function todayStr() {
  return new Date().toISOString().slice(0, 10);
}

function formatDateVN(dateStr) {
  // "2026-06-11" → "11/06/2026"
  const [y, m, d] = dateStr.split('-');
  return `${d}/${m}/${y}`;
}

function getLast7Days() {
  const days = [];
  for (let i = 6; i >= 0; i--) {
    const d = new Date();
    d.setDate(d.getDate() - i);
    days.push(d.toISOString().slice(0, 10));
  }
  return days;
}

/* ══════════════════════════════════════════════
   INJECT MENU ITEM VÀO SIDEBAR
   ══════════════════════════════════════════════ */
(function injectAnalyticsMenu() {
  const tryInject = () => {
    /* Tìm group QUẢN TRỊ (group thứ 2) hoặc fallback group đầu */
    const menuGroups = document.querySelectorAll('.menu-group');
    if (!menuGroups.length) { setTimeout(tryInject, 100); return; }

    const target = menuGroups[1] || menuGroups[0];

    /* Chèn trước Settings */
    const settingsItem = [...target.querySelectorAll('.menu-item')]
      .find(el => el.textContent.includes('Settings'));

    const item = document.createElement('a');
    item.className = 'menu-item';
    item.id        = 'analyticsMenuItem';
    item.style.cssText = 'cursor:pointer;';
    item.innerHTML = `<span>📈</span> Thống kê`;
    item.addEventListener('click', () => showAnalyticsPage());

    if (settingsItem) {
      target.insertBefore(item, settingsItem);
    } else {
      target.appendChild(item);
    }
  };
  tryInject();
})();

/* ══════════════════════════════════════════════
   INJECT PAGE HTML
   ══════════════════════════════════════════════ */
(function injectAnalyticsPage() {
  const main = document.querySelector('.main-content');
  if (!main) return;

  const page = document.createElement('div');
  page.id = 'analyticsPage';
  page.style.display = 'none';

  page.innerHTML = `
    <!-- HEADER -->
    <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:24px;flex-wrap:wrap;gap:12px;">
      <div>
        <h1 style="font-size:26px;font-weight:700;color:var(--text)">📈 Thống kê</h1>
        <p style="font-size:14px;color:var(--text-muted);margin-top:4px">
          Lượt xem game & giờ cao điểm online
        </p>
      </div>
      <!-- Bộ lọc ngày -->
      <div style="display:flex;align-items:center;gap:10px;flex-wrap:wrap;">
        <div style="display:flex;gap:6px;">
          <button class="btn btn-secondary an-range-btn active" data-range="today"   onclick="setAnalyticsRange('today',this)">Hôm nay</button>
          <button class="btn btn-secondary an-range-btn"        data-range="7days"   onclick="setAnalyticsRange('7days',this)">7 ngày</button>
          <button class="btn btn-secondary an-range-btn"        data-range="custom"  onclick="setAnalyticsRange('custom',this)">Tuỳ chọn</button>
        </div>
        <div id="anCustomRange" style="display:none;align-items:center;gap:6px;">
          <input type="date" id="anDateFrom" style="height:38px;border:1px solid var(--border);border-radius:8px;padding:0 10px;font-size:13px;font-family:'Inter',sans-serif;color:var(--text);outline:none;">
          <span style="color:var(--text-muted);font-size:13px;">→</span>
          <input type="date" id="anDateTo"   style="height:38px;border:1px solid var(--border);border-radius:8px;padding:0 10px;font-size:13px;font-family:'Inter',sans-serif;color:var(--text);outline:none;">
          <button class="btn btn-primary" style="height:38px;padding:0 16px;font-size:13px;" onclick="loadAnalytics()">Xem</button>
        </div>
        <button class="btn btn-secondary" onclick="loadAnalytics()" style="height:38px;padding:0 14px;">
          🔄
        </button>
      </div>
    </div>

    <!-- SUMMARY CARDS -->
    <div id="anSummaryCards" style="display:grid;grid-template-columns:repeat(auto-fill,minmax(180px,1fr));gap:16px;margin-bottom:24px;">
      <div style="background:var(--card);border-radius:var(--radius);padding:20px 22px;box-shadow:var(--shadow);">
        <div style="font-size:12px;font-weight:600;color:var(--text-muted);text-transform:uppercase;letter-spacing:.8px;margin-bottom:8px;">Tổng lượt xem</div>
        <div id="anTotalViews" style="font-size:32px;font-weight:700;color:var(--primary);">—</div>
      </div>
      <div style="background:var(--card);border-radius:var(--radius);padding:20px 22px;box-shadow:var(--shadow);">
        <div style="font-size:12px;font-weight:600;color:var(--text-muted);text-transform:uppercase;letter-spacing:.8px;margin-bottom:8px;">Game xem nhiều nhất</div>
        <div id="anTopGame" style="font-size:15px;font-weight:700;color:var(--text);line-height:1.3;">—</div>
      </div>
      <div style="background:var(--card);border-radius:var(--radius);padding:20px 22px;box-shadow:var(--shadow);">
        <div style="font-size:12px;font-weight:600;color:var(--text-muted);text-transform:uppercase;letter-spacing:.8px;margin-bottom:8px;">Giờ cao điểm</div>
        <div id="anPeakHour" style="font-size:32px;font-weight:700;color:#e17055;">—</div>
      </div>
      <div style="background:var(--card);border-radius:var(--radius);padding:20px 22px;box-shadow:var(--shadow);">
        <div style="font-size:12px;font-weight:600;color:var(--text-muted);text-transform:uppercase;letter-spacing:.8px;margin-bottom:8px;">Online cao nhất</div>
        <div id="anPeakOnline" style="font-size:32px;font-weight:700;color:#00b894;">—</div>
      </div>
    </div>

    <!-- CHARTS ROW -->
    <div style="display:grid;grid-template-columns:1fr 1fr;gap:20px;margin-bottom:24px;">

      <!-- Biểu đồ lượt xem game -->
      <div style="background:var(--card);border-radius:var(--radius);box-shadow:var(--shadow);padding:22px 24px;">
        <div style="font-size:14px;font-weight:700;color:var(--text);margin-bottom:18px;display:flex;align-items:center;gap:8px;">
          🎲 Top game được xem nhiều nhất
          <span id="anGameChartDate" style="font-size:11px;font-weight:500;color:var(--text-muted);margin-left:auto;"></span>
        </div>
        <div id="anGameChartWrap" style="position:relative;height:260px;">
          <div id="anGameChartLoading" style="position:absolute;inset:0;display:flex;align-items:center;justify-content:center;color:var(--text-muted);font-size:13px;">⏳ Đang tải...</div>
          <canvas id="anGameChart" style="display:none;"></canvas>
        </div>
      </div>

      <!-- Biểu đồ online theo giờ -->
      <div style="background:var(--card);border-radius:var(--radius);box-shadow:var(--shadow);padding:22px 24px;">
        <div style="font-size:14px;font-weight:700;color:var(--text);margin-bottom:18px;display:flex;align-items:center;gap:8px;">
          👥 Người online theo giờ
          <span id="anHourlyChartDate" style="font-size:11px;font-weight:500;color:var(--text-muted);margin-left:auto;"></span>
        </div>
        <div id="anHourlyChartWrap" style="position:relative;height:260px;">
          <div id="anHourlyChartLoading" style="position:absolute;inset:0;display:flex;align-items:center;justify-content:center;color:var(--text-muted);font-size:13px;">⏳ Đang tải...</div>
          <canvas id="anHourlyChart" style="display:none;"></canvas>
        </div>
      </div>

    </div>

    <!-- BẢNG CHI TIẾT GAME -->
    <div style="background:var(--card);border-radius:var(--radius);box-shadow:var(--shadow);overflow:hidden;">
      <div style="padding:16px 22px;border-bottom:1px solid var(--border);display:flex;align-items:center;justify-content:space-between;">
        <span style="font-size:14px;font-weight:700;color:var(--text);">📋 Chi tiết lượt xem theo game</span>
        <span id="anTableRange" style="font-size:12px;color:var(--text-muted);"></span>
      </div>
      <div id="anDetailTable" style="padding:16px 22px;">
        <div style="text-align:center;color:var(--text-muted);padding:40px 0;">⏳ Đang tải...</div>
      </div>
    </div>
  `;

  main.appendChild(page);
})();

/* ══════════════════════════════════════════════
   STATE
   ══════════════════════════════════════════════ */
let anRange     = 'today';   // 'today' | '7days' | 'custom'
let anDateFrom  = todayStr();
let anDateTo    = todayStr();
let gameChartInstance   = null;
let hourlyChartInstance = null;

/* ══════════════════════════════════════════════
   SHOW / HIDE PAGE
   ══════════════════════════════════════════════ */
window.showAnalyticsPage = function() {
  if (typeof window.__showPage === 'function') {
    window.__showPage('analyticsPage');
  } else {
    ['dashboardPage','boardgamesPage','drinksPage','chatAdminPage']
      .forEach(id => { const el = document.getElementById(id); if (el) el.style.display = 'none'; });
    document.getElementById('analyticsPage').style.display = '';
  }

  /* Active sidebar */
  document.querySelectorAll('.menu-item, .menu-item-parent').forEach(el => el.classList.remove('active'));
  document.getElementById('analyticsMenuItem')?.classList.add('active');

  loadAnalytics();
};

/* ══════════════════════════════════════════════
   RANGE PICKER
   ══════════════════════════════════════════════ */
window.setAnalyticsRange = function(range, btn) {
  anRange = range;

  document.querySelectorAll('.an-range-btn').forEach(b => b.classList.remove('active'));
  btn.classList.add('active');

  const customEl = document.getElementById('anCustomRange');

  if (range === 'today') {
    anDateFrom = todayStr();
    anDateTo   = todayStr();
    customEl.style.display = 'none';
    loadAnalytics();
  } else if (range === '7days') {
    const days = getLast7Days();
    anDateFrom = days[0];
    anDateTo   = days[days.length - 1];
    customEl.style.display = 'none';
    loadAnalytics();
  } else {
    /* custom — hiện date picker, không load ngay */
    customEl.style.display = 'flex';
    document.getElementById('anDateFrom').value = anDateFrom;
    document.getElementById('anDateTo').value   = anDateTo;
  }
};

/* ══════════════════════════════════════════════
   LOAD DATA
   ══════════════════════════════════════════════ */
window.loadAnalytics = async function() {
  /* Đọc custom range nếu cần */
  if (anRange === 'custom') {
    anDateFrom = document.getElementById('anDateFrom').value || todayStr();
    anDateTo   = document.getElementById('anDateTo').value   || todayStr();
    if (anDateFrom > anDateTo) {
      [anDateFrom, anDateTo] = [anDateTo, anDateFrom];
    }
  }

  /* Tạo mảng các ngày cần query */
  const dates = getDatesInRange(anDateFrom, anDateTo);

  /* Show loading */
  setLoading(true);

  /* Fetch song song tất cả ngày */
  const [gameData, hourlyData] = await Promise.all([
    fetchGameViews(dates),
    fetchHourlyOnline(dates),
  ]);

  setLoading(false);

  /* Render */
  renderSummaryCards(gameData, hourlyData);
  renderGameChart(gameData, dates);
  renderHourlyChart(hourlyData, dates);
  renderDetailTable(gameData, dates);
};

/* ── Tạo mảng ngày từ from → to ── */
function getDatesInRange(from, to) {
  const dates = [];
  const cur   = new Date(from);
  const end   = new Date(to);
  while (cur <= end) {
    dates.push(cur.toISOString().slice(0, 10));
    cur.setDate(cur.getDate() + 1);
  }
  return dates;
}

/* ── Fetch game views: { gameId: { name, total, byDate } } ── */
async function fetchGameViews(dates) {
  const result = {};

  await Promise.all(dates.map(async date => {
    try {
      const snap = await get(ref(db, `analytics/gameViews/${date}`));
      if (!snap.exists()) return;
      snap.forEach(child => {
        const gid  = child.key;
        const data = child.val();
        if (!result[gid]) result[gid] = { name: data.name || gid, total: 0, byDate: {} };
        result[gid].byDate[date] = data.count || 0;
        result[gid].total += data.count || 0;
        if (data.name) result[gid].name = data.name; // luôn cập nhật tên mới nhất
      });
    } catch(e) { console.warn('fetchGameViews error:', date, e); }
  }));

  return result;
}

/* ── Fetch hourly online: { date: { "00": peak, "01": peak, ... } } ── */
async function fetchHourlyOnline(dates) {
  const result = {};

  await Promise.all(dates.map(async date => {
    try {
      const snap = await get(ref(db, `analytics/hourly/${date}`));
      if (!snap.exists()) return;
      result[date] = {};
      snap.forEach(child => {
        result[date][child.key] = child.val()?.peak || 0;
      });
    } catch(e) { console.warn('fetchHourlyOnline error:', date, e); }
  }));

  return result;
}

/* ══════════════════════════════════════════════
   RENDER: SUMMARY CARDS
   ══════════════════════════════════════════════ */
function renderSummaryCards(gameData, hourlyData) {
  /* Tổng lượt xem */
  const totalViews = Object.values(gameData).reduce((s, g) => s + g.total, 0);
  document.getElementById('anTotalViews').textContent = totalViews.toLocaleString('vi-VN');

  /* Game xem nhiều nhất */
  const topGame = Object.values(gameData).sort((a, b) => b.total - a.total)[0];
  document.getElementById('anTopGame').textContent = topGame
    ? `${topGame.name} (${topGame.total})`
    : '—';

  /* Tính peak hour và peak online trên toàn bộ range */
  let peakCount = 0;
  let peakHour  = null;
  const hourTotals = {}; // tổng theo giờ qua các ngày

  Object.values(hourlyData).forEach(dayData => {
    Object.entries(dayData).forEach(([h, peak]) => {
      if (!hourTotals[h]) hourTotals[h] = 0;
      hourTotals[h] = Math.max(hourTotals[h], peak);
      if (peak > peakCount) { peakCount = peak; peakHour = h; }
    });
  });

  document.getElementById('anPeakHour').textContent   = peakHour  ? `${peakHour}:00` : '—';
  document.getElementById('anPeakOnline').textContent = peakCount || '—';
}

/* ══════════════════════════════════════════════
   RENDER: GAME BAR CHART (Canvas — no library)
   ══════════════════════════════════════════════ */
function renderGameChart(gameData, dates) {
  const canvas  = document.getElementById('anGameChart');
  const loading = document.getElementById('anGameChartLoading');
  const dateLabel = document.getElementById('anGameChartDate');

  /* Top 10 game */
  const sorted = Object.values(gameData)
    .sort((a, b) => b.total - a.total)
    .slice(0, 10);

  dateLabel.textContent = dates.length === 1
    ? formatDateVN(dates[0])
    : `${formatDateVN(dates[0])} – ${formatDateVN(dates[dates.length-1])}`;

  if (!sorted.length) {
    loading.textContent = '📭 Chưa có dữ liệu trong khoảng thời gian này.';
    loading.style.display = 'flex';
    canvas.style.display  = 'none';
    return;
  }

  loading.style.display = 'none';
  canvas.style.display  = 'block';

  const wrap  = document.getElementById('anGameChartWrap');
  canvas.width  = wrap.clientWidth  || 400;
  canvas.height = wrap.clientHeight || 260;

  const ctx    = canvas.getContext('2d');
  const W      = canvas.width;
  const H      = canvas.height;
  const padL   = 16;
  const padR   = 16;
  const padT   = 14;
  const padB   = 52; // chỗ cho label tên game
  const maxVal = sorted[0].total || 1;

  ctx.clearRect(0, 0, W, H);

  const n        = sorted.length;
  const barArea  = W - padL - padR;
  const barW     = Math.floor(barArea / n * 0.6);
  const gap      = Math.floor(barArea / n * 0.4);
  const chartH   = H - padT - padB;

  /* Màu gradient bars */
  const COLORS = [
    '#6c5ce7','#a29bfe','#fd79a8','#e17055',
    '#00b894','#0984e3','#fdcb6e','#e84393',
    '#55efc4','#74b9ff'
  ];

  sorted.forEach((g, i) => {
    const x      = padL + i * (barW + gap) + gap / 2;
    const barH   = Math.round((g.total / maxVal) * chartH);
    const y      = padT + chartH - barH;
    const color  = COLORS[i % COLORS.length];

    /* Bar với bo góc trên */
    const radius = Math.min(6, barW / 3);
    ctx.beginPath();
    ctx.moveTo(x + radius, y);
    ctx.lineTo(x + barW - radius, y);
    ctx.quadraticCurveTo(x + barW, y, x + barW, y + radius);
    ctx.lineTo(x + barW, y + barH);
    ctx.lineTo(x, y + barH);
    ctx.lineTo(x, y + radius);
    ctx.quadraticCurveTo(x, y, x + radius, y);
    ctx.closePath();

    ctx.fillStyle = color;
    ctx.globalAlpha = 0.85;
    ctx.fill();
    ctx.globalAlpha = 1;

    /* Số lượt xem trên đầu bar */
    ctx.fillStyle = '#2d3748';
    ctx.font      = `bold ${Math.min(11, barW * 0.4)}px Inter, sans-serif`;
    ctx.textAlign = 'center';
    ctx.fillText(g.total, x + barW / 2, y - 4);

    /* Tên game bên dưới — xoay nếu nhiều game */
    ctx.save();
    ctx.translate(x + barW / 2, H - padB + 10);
    ctx.rotate(-Math.PI / 4);
    ctx.fillStyle   = '#718096';
    ctx.font        = `${Math.min(10, barW * 0.38)}px Inter, sans-serif`;
    ctx.textAlign   = 'right';

    /* Cắt tên nếu quá dài */
    const maxChars = 16;
    const label    = g.name.length > maxChars ? g.name.slice(0, maxChars) + '…' : g.name;
    ctx.fillText(label, 0, 0);
    ctx.restore();
  });
}

/* ══════════════════════════════════════════════
   RENDER: HOURLY LINE CHART (Canvas — no library)
   ══════════════════════════════════════════════ */
function renderHourlyChart(hourlyData, dates) {
  const canvas  = document.getElementById('anHourlyChart');
  const loading = document.getElementById('anHourlyChartLoading');
  const dateLabel = document.getElementById('anHourlyChartDate');

  /* Tổng hợp: lấy max peak của mỗi giờ qua tất cả ngày */
  const hours = Array.from({length: 24}, (_, i) => String(i).padStart(2, '0'));
  const peakByHour = {};
  hours.forEach(h => { peakByHour[h] = 0; });

  let hasData = false;
  Object.values(hourlyData).forEach(dayData => {
    Object.entries(dayData).forEach(([h, peak]) => {
      if (hours.includes(h)) {
        peakByHour[h] = Math.max(peakByHour[h], peak);
        if (peak > 0) hasData = true;
      }
    });
  });

  dateLabel.textContent = dates.length === 1
    ? formatDateVN(dates[0])
    : `${formatDateVN(dates[0])} – ${formatDateVN(dates[dates.length-1])}`;

  if (!hasData) {
    loading.textContent = '📭 Chưa có dữ liệu trong khoảng thời gian này.';
    loading.style.display = 'flex';
    canvas.style.display  = 'none';
    return;
  }

  loading.style.display = 'none';
  canvas.style.display  = 'block';

  const wrap  = document.getElementById('anHourlyChartWrap');
  canvas.width  = wrap.clientWidth  || 400;
  canvas.height = wrap.clientHeight || 260;

  const ctx   = canvas.getContext('2d');
  const W     = canvas.width;
  const H     = canvas.height;
  const padL  = 32; // chỗ cho nhãn Y
  const padR  = 12;
  const padT  = 14;
  const padB  = 24; // chỗ cho nhãn giờ
  const chartW = W - padL - padR;
  const chartH = H - padT - padB;

  const values = hours.map(h => peakByHour[h]);
  const maxVal = Math.max(...values, 1);

  ctx.clearRect(0, 0, W, H);

  /* Grid lines */
  const gridLines = 4;
  ctx.strokeStyle = '#e2e8f0';
  ctx.lineWidth   = 1;
  for (let i = 0; i <= gridLines; i++) {
    const y = padT + chartH - (i / gridLines) * chartH;
    ctx.beginPath();
    ctx.moveTo(padL, y);
    ctx.lineTo(padL + chartW, y);
    ctx.stroke();

    /* Label Y */
    ctx.fillStyle  = '#a0aec0';
    ctx.font       = '9px Inter, sans-serif';
    ctx.textAlign  = 'right';
    ctx.fillText(Math.round(maxVal * i / gridLines), padL - 4, y + 3);
  }

  /* Vẽ area fill */
  const stepX = chartW / (hours.length - 1);

  ctx.beginPath();
  ctx.moveTo(padL, padT + chartH);
  values.forEach((v, i) => {
    const x = padL + i * stepX;
    const y = padT + chartH - (v / maxVal) * chartH;
    if (i === 0) ctx.lineTo(x, y);
    else {
      // smooth curve
      const px = padL + (i - 1) * stepX;
      const py = padT + chartH - (values[i-1] / maxVal) * chartH;
      const cx1 = px + stepX * 0.5;
      const cx2 = x  - stepX * 0.5;
      ctx.bezierCurveTo(cx1, py, cx2, y, x, y);
    }
  });
  ctx.lineTo(padL + chartW, padT + chartH);
  ctx.closePath();

  const grad = ctx.createLinearGradient(0, padT, 0, padT + chartH);
  grad.addColorStop(0,   'rgba(0,184,148,0.25)');
  grad.addColorStop(1,   'rgba(0,184,148,0.02)');
  ctx.fillStyle = grad;
  ctx.fill();

  /* Vẽ line */
  ctx.beginPath();
  values.forEach((v, i) => {
    const x = padL + i * stepX;
    const y = padT + chartH - (v / maxVal) * chartH;
    if (i === 0) ctx.moveTo(x, y);
    else {
      const px = padL + (i - 1) * stepX;
      const py = padT + chartH - (values[i-1] / maxVal) * chartH;
      ctx.bezierCurveTo(px + stepX*0.5, py, x - stepX*0.5, y, x, y);
    }
  });
  ctx.strokeStyle = '#00b894';
  ctx.lineWidth   = 2.5;
  ctx.stroke();

  /* Dots tại giờ cao điểm */
  const peakVal = Math.max(...values);
  values.forEach((v, i) => {
    if (v < peakVal * 0.8 && v === 0) return;
    const x = padL + i * stepX;
    const y = padT + chartH - (v / maxVal) * chartH;
    ctx.beginPath();
    ctx.arc(x, y, v === peakVal ? 5 : 3, 0, Math.PI * 2);
    ctx.fillStyle   = v === peakVal ? '#e17055' : '#00b894';
    ctx.fill();

    if (v === peakVal) {
      ctx.fillStyle = '#2d3748';
      ctx.font      = 'bold 10px Inter, sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText(v, x, y - 9);
    }
  });

  /* Labels giờ (mỗi 3 giờ) */
  ctx.fillStyle = '#a0aec0';
  ctx.font      = '9px Inter, sans-serif';
  ctx.textAlign = 'center';
  hours.forEach((h, i) => {
    if (i % 3 !== 0) return;
    const x = padL + i * stepX;
    ctx.fillText(h + ':00', x, H - padB + 14);
  });
}

/* ══════════════════════════════════════════════
   RENDER: DETAIL TABLE
   ══════════════════════════════════════════════ */
function renderDetailTable(gameData, dates) {
  const el = document.getElementById('anDetailTable');
  const rangeEl = document.getElementById('anTableRange');

  rangeEl.textContent = dates.length === 1
    ? formatDateVN(dates[0])
    : `${formatDateVN(dates[0])} – ${formatDateVN(dates[dates.length-1])}`;

  const sorted = Object.values(gameData).sort((a, b) => b.total - a.total);

  if (!sorted.length) {
    el.innerHTML = '<div style="text-align:center;color:var(--text-muted);padding:40px 0;">📭 Chưa có dữ liệu</div>';
    return;
  }

  const maxTotal = sorted[0].total || 1;

  el.innerHTML = `
    <table style="width:100%;border-collapse:collapse;">
      <thead>
        <tr style="background:#f8fafc;border-bottom:1px solid var(--border);">
          <th style="padding:10px 14px;text-align:left;font-size:11px;font-weight:700;text-transform:uppercase;letter-spacing:.8px;color:var(--text-muted);">Hạng</th>
          <th style="padding:10px 14px;text-align:left;font-size:11px;font-weight:700;text-transform:uppercase;letter-spacing:.8px;color:var(--text-muted);">Tên game</th>
          <th style="padding:10px 14px;text-align:right;font-size:11px;font-weight:700;text-transform:uppercase;letter-spacing:.8px;color:var(--text-muted);">Lượt xem</th>
          <th style="padding:10px 14px;font-size:11px;font-weight:700;text-transform:uppercase;letter-spacing:.8px;color:var(--text-muted);min-width:140px;">Tỷ lệ</th>
        </tr>
      </thead>
      <tbody>
        ${sorted.map((g, i) => {
          const pct   = Math.round(g.total / maxTotal * 100);
          const medal = i === 0 ? '🥇' : i === 1 ? '🥈' : i === 2 ? '🥉' : `#${i+1}`;
          const barColor = i === 0 ? '#6c5ce7' : i === 1 ? '#a29bfe' : '#cbd5e0';
          return `
            <tr style="border-bottom:1px solid var(--border);">
              <td style="padding:12px 14px;font-size:14px;font-weight:700;color:var(--text-muted);">${medal}</td>
              <td style="padding:12px 14px;font-size:14px;font-weight:600;color:var(--text);">${g.name}</td>
              <td style="padding:12px 14px;text-align:right;font-size:15px;font-weight:700;color:var(--primary);">${g.total.toLocaleString('vi-VN')}</td>
              <td style="padding:12px 14px;">
                <div style="display:flex;align-items:center;gap:8px;">
                  <div style="flex:1;height:8px;background:#f1f5f9;border-radius:4px;overflow:hidden;">
                    <div style="height:100%;width:${pct}%;background:${barColor};border-radius:4px;transition:width .4s ease;"></div>
                  </div>
                  <span style="font-size:12px;font-weight:600;color:var(--text-muted);min-width:32px;text-align:right;">${pct}%</span>
                </div>
              </td>
            </tr>`;
        }).join('')}
      </tbody>
    </table>
  `;
}

/* ══════════════════════════════════════════════
   LOADING STATE
   ══════════════════════════════════════════════ */
function setLoading(on) {
  ['anGameChartLoading','anHourlyChartLoading'].forEach(id => {
    const el = document.getElementById(id);
    if (el) {
      el.textContent    = '⏳ Đang tải...';
      el.style.display  = on ? 'flex' : 'none';
    }
  });
  if (on) {
    ['anGameChart','anHourlyChart'].forEach(id => {
      const c = document.getElementById(id);
      if (c) c.style.display = 'none';
    });
    document.getElementById('anTotalViews').textContent = '—';
    document.getElementById('anTopGame').textContent    = '—';
    document.getElementById('anPeakHour').textContent   = '—';
    document.getElementById('anPeakOnline').textContent = '—';
    document.getElementById('anDetailTable').innerHTML  =
      '<div style="text-align:center;color:var(--text-muted);padding:40px 0;">⏳ Đang tải...</div>';
  }
}

/* ── Redraw charts on window resize ── */
let resizeTimer;
window.addEventListener('resize', () => {
  clearTimeout(resizeTimer);
  resizeTimer = setTimeout(() => {
    const page = document.getElementById('analyticsPage');
    if (page && page.style.display !== 'none') loadAnalytics();
  }, 300);
});
