/* ══════════════════════════════════════════════
   MEMBERSHIP (FRONTEND) — js/membership.js
   ─────────────────────────────────────────────
   ĐÃ TÁCH khỏi js/app.js (vốn chỉ nên lo router + render game +
   lightbox + daily pick). Toàn bộ logic trang "Thẻ thành viên"
   (pages/membership.html) giờ nằm ở đây.

   Expose ra window để js/app.js gọi được từ loadPage(), y hệt
   cách initSettings()/initBoardgame() đang hoạt động:
     window.initMembership()

   ⚠️ Load file này SAU js/shared-config.js + js/shared-utils.js,
      TRƯỚC hoặc SAU js/app.js đều được (không phụ thuộc lẫn nhau),
      miễn là TRƯỚC khi router gọi loadPage('membership') lần đầu.
      Khuyến nghị: đặt ngay sau js/app.js trong index.html.
   ══════════════════════════════════════════════ */

const escM = window.escHtml;

/* Chuẩn hoá số điện thoại VN: "+84 912 345 678" / "84912345678" /
   "0912-345-678" → "0912345678". */
function normalizePhoneVN(raw) {
  let p = (raw || '').trim().replace(/[\s.\-()]/g, '');
  if (p.startsWith('+84')) p = '0' + p.slice(3);
  else if (p.startsWith('84') && p.length > 9) p = '0' + p.slice(2);
  return p;
}

function initMembership() {
  const input = document.getElementById('member-phone-input');
  document.getElementById('member-lookup-btn')?.addEventListener('click', lookupMembership);
  input?.addEventListener('keydown', e => {
    if (e.key === 'Enter') lookupMembership();
  });
  input?.addEventListener('input', () => {
    const result = document.getElementById('member-result');
    if (result && result.querySelector('.member-not-found')) result.innerHTML = '';
  });
}

async function lookupMembership() {
  const input  = document.getElementById('member-phone-input');
  const btn    = document.getElementById('member-lookup-btn');
  const result = document.getElementById('member-result');
  const phone  = normalizePhoneVN(input.value);

  if (!phone) { input.focus(); return; }

  if (!/^0\d{9,10}$/.test(phone)) {
    result.innerHTML = '<div class="member-not-found">⚠️ Số điện thoại chưa đúng định dạng.<br>Vui lòng nhập dạng: 0912345678</div>';
    input.focus();
    return;
  }

  if (btn) {
    btn.disabled = true;
    btn.dataset.origText = btn.dataset.origText || btn.textContent;
    btn.textContent = '⏳ Đang tra...';
  }
  result.innerHTML = '<p style="text-align:center;color:var(--muted);padding:20px;">⏳ Đang tra cứu...</p>';

  try {
    const { createClient } = await import('https://cdn.jsdelivr.net/npm/@supabase/supabase-js/+esm');
    const supabase = createClient(window.APP_CONFIG.supabaseUrl, window.APP_CONFIG.supabaseKey);
    const { data, error } = await supabase.rpc('get_membership_by_phone', { p_phone: phone });

    if (error) throw error;
    const m = data && data[0];
    if (!m) {
      result.innerHTML = '<div class="member-not-found">🔍 Không tìm thấy khách hàng với số điện thoại này.<br>Vui lòng liên hệ quầy để đăng ký thẻ thành viên.</div>';
      return;
    }

    const hasNext = m.xp_required_next != null && m.xp_required_next > m.xp_required_current;
    const pct = hasNext
      ? Math.max(0, Math.min(100, Math.round((m.xp - m.xp_required_current) / (m.xp_required_next - m.xp_required_current) * 100)))
      : 100;

    const perks = [
      m.discount_pct > 0 ? `<span class="member-perk-chip">💸 Giảm ${m.discount_pct}%</span>` : '',
      m.free_item        ? `<span class="member-perk-chip">🎁 ${escM(m.free_item)}</span>` : '',
      m.priority_booking  ? `<span class="member-perk-chip">⭐ Ưu tiên đặt bàn/slot game</span>` : '',
    ].filter(Boolean).join('') || '<span style="color:var(--muted);font-size:.85rem;">Chưa có ưu đãi ở cấp này</span>';

    result.innerHTML = `
      <div class="member-card">
        <div class="member-rank">${escM(m.rank_icon)} ${escM(m.name)} — ${escM(m.rank_name)}</div>
        <div class="member-xp-bar-outer"><div class="member-xp-bar-fill" style="width:${pct}%"></div></div>
        <div class="member-xp-label">${m.xp} XP ${hasNext ? `· cần ${m.xp_required_next} XP để lên cấp tiếp theo` : '· Cấp cao nhất 🎉'}</div>
        <div class="member-perks">${perks}</div>
        <div style="margin-top:16px;font-size:.82rem;color:var(--muted);">🔥 Streak: ${m.streak_days || 0} ngày · Check-in gần nhất: ${escM(m.last_checkin) || '—'}</div>
      </div>`;
  } catch (err) {
    console.error(err);
    result.innerHTML = '<p style="text-align:center;color:var(--muted);padding:20px;">⚠️ Có lỗi khi tra cứu, thử lại sau.</p>';
  } finally {
    if (btn) { btn.disabled = false; btn.textContent = btn.dataset.origText || '🔍 Tra cứu'; }
  }
}

/* Expose cho js/app.js gọi từ loadPage('membership') */
window.initMembership = initMembership;
