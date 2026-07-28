/* ══════════════════════════════════════════════
   DASHBOARD CHAT MODULE — admin/modules/dashboard-chat.js
   ─────────────────────────────────────────────
   THAY ĐỔI so với bản gốc:
   - Xóa escHtml()/formatTime() cục bộ → dùng window.escHtml /
     window.formatTime (js/shared-utils.js).
   - Xóa showDashboardToast() (bản fallback phòng khi dashboard.js
     chưa load) → dùng thẳng window.showToast (luôn có sẵn vì
     shared-utils.js load trước tất cả module admin).
   - Xóa IIFE injectChatMenu() (polling setTimeout tìm .menu-group)
     → thay bằng 1 lệnh gọi AdminDashboard.registerPage({...}).
     Vẫn giữ đúng hành vi cũ: nâng cấp #chatMenuItemPlaceholder có
     sẵn trong HTML (đứng cố định trước "Settings" trong group
     "Quản trị"), không tạo phần tử mới.

   ⚠️ SỬA (UI/UX audit — ưu tiên cao):
   - Nút "🗑️ Xóa chat hôm nay": window.confirm() → window.showConfirm()
     (modal tùy chỉnh, không chặn UI thread) + lỗi báo qua
     window.showToast() thay vì alert().
   ══════════════════════════════════════════════ */

import { initializeApp, getApps } from
  "https://www.gstatic.com/firebasejs/10.12.2/firebase-app.js";
import {
  getDatabase, ref, push, onChildAdded,
  onValue, onDisconnect, set, get, remove
} from
  "https://www.gstatic.com/firebasejs/10.12.2/firebase-database.js";

const fbApp = getApps().length ? getApps()[0] : initializeApp(window.APP_CONFIG.firebaseConfig);
const db     = getDatabase(fbApp);
const msgRef = ref(db, "communityChat");

const SESSION_KEY = "bg_admin_session";
let staffSession  = null;
try { staffSession = JSON.parse(sessionStorage.getItem(SESSION_KEY)); } catch {}

const STAFF_DISPLAY = "THE COFFEEQUEST";
const TAG_PATTERN   = /@thecoffeequest|@the\s*coffee\s*quest|@quán|@quan|@staff|@admin/i;

/* ══════════════════════════════════════════════
   STATE
   ══════════════════════════════════════════════ */
let unreadCount  = 0;
let chatPageOpen = false;
let allMessages  = [];
let tagAlerts    = [];
let notifGranted = false;

/* ══════════════════════════════════════════════
   NOTIFICATION
   ══════════════════════════════════════════════ */
if ("Notification" in window) {
  if (Notification.permission === "granted") notifGranted = true;
  else if (Notification.permission === "default")
    Notification.requestPermission().then(p => { notifGranted = p === "granted"; });
}

function pushNotification(user, text) {
  if (!notifGranted) return;
  try {
    new Notification("💬 Tin nhắn mới — " + user, {
      body: text.length > 80 ? text.slice(0, 80) + "…" : text,
      icon: "data:image/svg+xml,<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 32 32'><text y='28' font-size='28'>💬</text></svg>",
    });
  } catch {}
}

/* ══════════════════════════════════════════════
   BADGE
   ══════════════════════════════════════════════ */
function updateBadge(n) {
  const badge = document.getElementById("chatMenuBadge");
  if (!badge) return;
  badge.textContent    = n > 99 ? "99+" : n;
  badge.style.display  = n > 0 ? "inline-flex" : "none";
}

/* ══════════════════════════════════════════════
   ĐĂNG KÝ MENU ITEM + PAGE
   (thay cho IIFE injectChatMenu() polling ở bản gốc)
   ══════════════════════════════════════════════ */
window.AdminDashboard.registerPage({
  pageId: "chatAdminPage",
  menuId: "chatMenuItem",
  placeholderId: "chatMenuItemPlaceholder", // đã có sẵn trong dashboard.html
  icon: "💬",
  label: "Cộng đồng",
  badgeHtml: `<span id="chatMenuBadge" style="display:none;position:absolute;right:10px;top:50%;transform:translateY(-50%);background:#e17055;color:#fff;font-size:10px;font-weight:700;min-width:18px;height:18px;border-radius:9px;padding:0 5px;align-items:center;justify-content:center;line-height:1;"></span>`,
  onShow: () => openChatPage(),
});

/* ══════════════════════════════════════════════
   INJECT CHAT PAGE HTML
   ══════════════════════════════════════════════ */
(function injectChatPageHTML() {
  const main = document.querySelector(".main-content");
  if (!main) return;

  const page = document.createElement("div");
  page.id = "chatAdminPage";
  page.style.display = "none";
  page.innerHTML = `
    <div class="chat-page-header" style="display:flex;align-items:center;justify-content:space-between;margin-bottom:24px;gap:10px;">
      <button id="chatBackBtn" class="chat-back-btn" title="Quay lại Dashboard" aria-label="Quay lại Dashboard">←</button>
      <div class="chat-page-title" style="min-width:0;flex:1;">
        <h1 style="font-size:26px;font-weight:700;color:var(--text)">💬 Cộng đồng</h1>
        <p class="chat-page-subtitle" style="font-size:14px;color:var(--text-muted);margin-top:4px">
          Chat real-time với khách — gửi với tư cách
          <span style="background:#1a1a2e;color:#fff;padding:2px 9px;border-radius:20px;font-size:12px;font-weight:700;">THE COFFEEQUEST</span>
        </p>
      </div>
      <div class="chat-page-actions" style="display:flex;gap:10px;align-items:center;">
        <div class="chat-online-pill" style="background:var(--card);border:1px solid var(--border);border-radius:10px;padding:8px 16px;font-size:13px;color:var(--text-muted);">
          👥 Online: <b id="adminOnlineCount" style="color:var(--primary)">0</b>
        </div>
        <button id="chatSidebarToggle" class="btn btn-secondary" title="Tag quán & Trả lời nhanh" aria-label="Mở bảng tag quán và trả lời nhanh">
          ⚡<span id="chatToggleBadge" class="chat-toggle-badge" style="display:none"></span>
        </button>
        <button id="adminClearChatBtn" class="btn btn-secondary" style="font-size:13px;">
          🗑️ <span class="chat-clear-label">Xóa chat hôm nay</span>
        </button>
      </div>
    </div>

    <div class="chat-body-row" style="display:flex;gap:20px;flex:1;min-height:0;height:calc(100vh - 200px);">
      <div class="chat-main-col" style="flex:1;display:flex;flex-direction:column;gap:0;min-width:0;">

        <div class="chat-history-bar" style="background:var(--card);border-radius:var(--radius) var(--radius) 0 0;border:1px solid var(--border);border-bottom:none;padding:12px 20px;display:flex;align-items:center;justify-content:space-between;">
          <span style="font-size:13px;font-weight:600;color:var(--text-muted);">LỊCH SỬ CHAT</span>
          <span id="adminMsgCount" style="font-size:12px;color:var(--text-muted);">0 tin nhắn</span>
        </div>

        <div id="adminChatMessages" class="chat-messages-area" role="log" aria-live="polite" aria-label="Lịch sử chat" style="flex:1;overflow-y:auto;background:var(--card);border:1px solid var(--border);border-top:none;border-bottom:none;padding:16px 20px;display:flex;flex-direction:column;gap:10px;scroll-behavior:smooth;">
          <div style="text-align:center;color:var(--text-muted);font-size:13px;padding:40px 0;">⏳ Đang tải...</div>
        </div>

        <div class="chat-input-bar" style="background:var(--card);border:1px solid var(--border);border-radius:0 0 var(--radius) var(--radius);padding:14px 16px;display:flex;gap:10px;align-items:flex-end;">
          <div style="flex:1;position:relative;">
            <label for="adminChatInput" class="visually-hidden">Nhập tin nhắn</label>
            <textarea id="adminChatInput"
              placeholder="Nhập tin nhắn... (Enter gửi, Shift+Enter xuống dòng)"
              style="width:100%;min-height:44px;max-height:120px;border:1.5px solid var(--border);border-radius:10px;padding:10px 14px;font-size:14px;font-family:'Inter',sans-serif;color:var(--text);outline:none;resize:none;line-height:1.5;transition:border-color .2s;"
              rows="1"></textarea>
          </div>
          <button id="adminSendBtn" class="btn btn-primary" style="height:44px;padding:0 20px;flex-shrink:0;">✈️ Gửi</button>
        </div>

        <div class="chat-sent-by" style="padding:8px 4px;font-size:12px;color:var(--text-muted);display:flex;align-items:center;gap:6px;">
          <span>Gửi bởi:</span>
          <span style="background:#1a1a2e;color:#fff;padding:2px 9px;border-radius:20px;font-size:11px;font-weight:700">THE COFFEEQUEST</span>
          <span style="color:#a0aec0;">· ${window.escHtml(staffSession?.displayName || staffSession?.username || "Nhân viên")}</span>
        </div>
      </div>

      <div class="chat-sidebar" style="width:260px;flex-shrink:0;display:flex;flex-direction:column;gap:14px;">
        <div style="background:var(--card);border:1px solid var(--border);border-radius:var(--radius);overflow:hidden;">
          <div style="background:#fff8f3;border-bottom:1px solid #fde8d8;padding:12px 16px;display:flex;align-items:center;gap:8px;">
            <span style="font-size:16px;" aria-hidden="true">🔔</span>
            <span style="font-size:13px;font-weight:700;color:#c05621;">Tag quán</span>
            <span id="tagBadge" style="display:none;background:#e17055;color:#fff;font-size:10px;font-weight:700;min-width:18px;height:18px;border-radius:9px;padding:0 5px;display:inline-flex;align-items:center;justify-content:center;margin-left:auto;"></span>
          </div>
          <div id="tagAlertList" style="padding:12px;font-size:13px;color:var(--text-muted);max-height:220px;overflow-y:auto;">
            <div style="text-align:center;padding:16px 0;">Chưa có tag nào</div>
          </div>
        </div>

        <div style="background:var(--card);border:1px solid var(--border);border-radius:var(--radius);overflow:hidden;">
          <div style="border-bottom:1px solid var(--border);padding:12px 16px;">
            <span style="font-size:13px;font-weight:700;color:var(--text);">⚡ Trả lời nhanh</span>
          </div>
          <div style="padding:10px;display:flex;flex-direction:column;gap:6px;" id="quickReplies">
            ${[
              "Xin chào! The CoffeeQuest luôn sẵn sàng hỗ trợ bạn 😊",
              "Quán mở cửa từ 8:00 - 22:00 mỗi ngày nhé!",
              "Cảm ơn bạn đã ghé The CoffeeQuest! ☕",
              "Bạn có thể đặt bàn trước qua hotline của quán nhé!",
              "Hôm nay quán có nhiều game mới, mời bạn ghé thử! 🎲",
            ].map(t => `
              <button class="quick-reply-btn" data-text="${window.escHtml(t)}"
                style="text-align:left;background:var(--bg);border:1px solid var(--border);border-radius:8px;padding:8px 12px;font-size:12px;color:var(--text);cursor:pointer;line-height:1.4;">
                ${window.escHtml(t)}
              </button>
            `).join("")}
          </div>
        </div>
      </div>
    </div>
    <div id="chatSidebarOverlay"></div>
  `;

  main.appendChild(page);
  initChatLogic();
})();

/* ══════════════════════════════════════════════
   OPEN / CLOSE
   ══════════════════════════════════════════════ */
function openChatPage() {
  chatPageOpen = true;
  unreadCount  = 0;
  updateBadge(0);
  setTimeout(scrollToBottom, 100);
  document.getElementById("adminChatInput")?.focus();
}
function closeChatPage() {
  const el = document.getElementById('chatAdminPage');
  if (el) el.style.display = 'none';
  chatPageOpen = false;
}

document.addEventListener("click", e => {
  const item = e.target.closest(".menu-item, .menu-item-parent, .menu-sub-item");
  if (!item || item.id === "chatMenuItem") return;
  if (chatPageOpen) closeChatPage();
});

/* ══════════════════════════════════════════════
   MESSAGE RENDER
   ══════════════════════════════════════════════ */
function isTagMsg(msg) {
  return !msg.isStaff && TAG_PATTERN.test(msg.text);
}
function highlightTags(text) {
  return window.escHtml(text).replace(TAG_PATTERN,
    '<span style="background:#fff0cc;color:#b7791f;font-weight:700;padding:1px 5px;border-radius:4px;">$&</span>'
  );
}

function buildMsgEl(msg) {
  const wrap = document.createElement("div");
  const tag  = isTagMsg(msg);

  if (msg.isStaff) {
    wrap.style.cssText = "display:flex;flex-direction:column;align-items:flex-end;gap:3px;";
    wrap.innerHTML = `
      <div style="display:flex;align-items:baseline;gap:6px;">
        <span style="font-size:10px;color:var(--text-muted);">${window.formatTime(msg.time)}</span>
        <span style="background:#1a1a2e;color:#fff;font-size:10px;font-weight:700;padding:2px 9px;border-radius:20px;">THE COFFEEQUEST</span>
        <span style="font-size:10px;color:#a0aec0;">${window.escHtml(msg.staffName||"")}</span>
      </div>
      <div style="background:linear-gradient(135deg,#6c5ce7,#5a4bd1);color:#fff;border-radius:14px 4px 14px 14px;padding:10px 14px;font-size:14px;line-height:1.55;max-width:80%;word-break:break-word;box-shadow:0 2px 8px rgba(108,92,231,.25);">${window.escHtml(msg.text)}</div>`;
  } else {
    wrap.style.cssText = "display:flex;flex-direction:column;align-items:flex-start;gap:3px;";
    wrap.innerHTML = `
      <div style="display:flex;align-items:baseline;gap:6px;padding-left:4px;">
        <span style="font-size:11px;font-weight:700;color:#888;">${window.escHtml(msg.user)}</span>
        <span style="font-size:10px;color:#bbb;">${window.formatTime(msg.time)}</span>
        ${tag ? '<span style="font-size:10px;background:#fed7aa;color:#c05621;font-weight:700;padding:1px 7px;border-radius:10px;">📣 Tag quán</span>' : ""}
      </div>
      <div style="${tag ? 'background:#fffbf0;border:1.5px solid #f6ad55;' : 'background:var(--bg);border:1px solid var(--border);'}border-radius:4px 14px 14px 14px;padding:10px 14px;font-size:14px;line-height:1.55;max-width:80%;word-break:break-word;color:var(--text);">${highlightTags(msg.text)}</div>`;
  }
  return wrap;
}

/* ══════════════════════════════════════════════
   TAG ALERTS
   ══════════════════════════════════════════════ */
function addTagAlert(msg) {
  tagAlerts.unshift(msg);
  if (tagAlerts.length > 20) tagAlerts.pop();
  renderTagAlerts();
}
function renderTagAlerts() {
  const list         = document.getElementById("tagAlertList");
  const badge        = document.getElementById("tagBadge");
  const toggleBadge  = document.getElementById("chatToggleBadge");
  if (!tagAlerts.length) {
    if (list) list.innerHTML = '<div style="text-align:center;padding:16px 0;color:var(--text-muted);">Chưa có tag nào</div>';
    if (badge)       badge.style.display       = "none";
    if (toggleBadge) toggleBadge.style.display = "none";
    return;
  }
  if (list) list.innerHTML = tagAlerts.map(msg => `
    <div style="padding:8px 10px;border-radius:8px;background:#fffbf0;border:1px solid #fde8b4;margin-bottom:6px;cursor:pointer;"
      onclick="document.getElementById('adminChatInput').focus();">
      <div style="font-size:11px;font-weight:700;color:#b7791f;margin-bottom:3px;">${window.escHtml(msg.user)} · ${window.formatTime(msg.time)}</div>
      <div style="font-size:12px;color:var(--text);line-height:1.4;">${highlightTags(msg.text.length > 60 ? msg.text.slice(0,60)+"…" : msg.text)}</div>
    </div>
  `).join("");
  const count = tagAlerts.length;
  if (badge)       { badge.textContent = count;  badge.style.display = "inline-flex"; }
  if (toggleBadge) { toggleBadge.textContent = count; toggleBadge.style.display = "flex"; }
}

function scrollToBottom() {
  const c = document.getElementById("adminChatMessages");
  if (c) c.scrollTop = c.scrollHeight;
}

/* ══════════════════════════════════════════════
   INIT CHAT LOGIC
   ══════════════════════════════════════════════ */
function initChatLogic() {
  onValue(ref(db, "onlineUsers"), snapshot => {
    const n  = snapshot.val() ? Object.keys(snapshot.val()).length : 0;
    const el = document.getElementById("adminOnlineCount");
    if (el) el.textContent = n;
  });

  let initialLoad = true;
  get(msgRef).then(snapshot => {
    const container = document.getElementById("adminChatMessages");
    if (!container) return;
    container.innerHTML = "";

    if (!snapshot.exists()) {
      container.innerHTML = '<div style="text-align:center;color:var(--text-muted);font-size:13px;padding:40px 0;" data-placeholder>Chưa có tin nhắn nào hôm nay.</div>';
    } else {
      const frag = document.createDocumentFragment();
      snapshot.forEach(child => {
        const msg = { key: child.key, ...child.val() };
        allMessages.push(msg);
        frag.appendChild(buildMsgEl(msg));
        if (isTagMsg(msg)) addTagAlert(msg);
      });
      container.appendChild(frag);
      updateMsgCount();
    }
    scrollToBottom();
    initialLoad = false;
  });

  onChildAdded(msgRef, snapshot => {
    if (initialLoad) return;
    const msg = { key: snapshot.key, ...snapshot.val() };
    allMessages.push(msg);

    const container = document.getElementById("adminChatMessages");
    if (container) {
      container.querySelector("[data-placeholder]")?.remove();
      container.appendChild(buildMsgEl(msg));
      updateMsgCount();
    }

    if (isTagMsg(msg)) {
      addTagAlert(msg);
      pushNotification(msg.user, msg.text);
    }
    if (!chatPageOpen && !msg.isStaff) {
      unreadCount++;
      updateBadge(unreadCount);
    }
    if (chatPageOpen) scrollToBottom();
  });

  onValue(msgRef, snapshot => {
    if (!snapshot.exists()) {
      const container = document.getElementById("adminChatMessages");
      if (container) container.innerHTML = '<div style="text-align:center;color:var(--text-muted);font-size:13px;padding:40px 0;" data-placeholder>Chưa có tin nhắn nào.</div>';
      allMessages = [];
      tagAlerts   = [];
      renderTagAlerts();
      updateMsgCount();
    }
  });

  function sendStaffMessage() {
    const input = document.getElementById("adminChatInput");
    const text  = input?.value.trim();
    if (!text) return;
    push(msgRef, {
      user:      STAFF_DISPLAY,
      text,
      time:      Date.now(),
      isStaff:   true,
      staffName: staffSession?.displayName || staffSession?.username || "",
    });
    input.value = "";
    input.style.height = "auto";
    input.focus();
  }

  document.getElementById("adminSendBtn")?.addEventListener("click", sendStaffMessage);
  document.getElementById("adminChatInput")?.addEventListener("keydown", e => {
    if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); sendStaffMessage(); }
  });
  document.getElementById("adminChatInput")?.addEventListener("input", function() {
    this.style.height = "auto";
    this.style.height = Math.min(this.scrollHeight, 120) + "px";
  });

  const input = document.getElementById("adminChatInput");
  input?.addEventListener("focus", () => { if(input) input.style.borderColor = "var(--primary)"; });
  input?.addEventListener("blur",  () => { if(input) input.style.borderColor = "var(--border)"; });

  document.getElementById("quickReplies")?.addEventListener("click", e => {
    const btn = e.target.closest(".quick-reply-btn");
    if (!btn) return;
    const chatInput = document.getElementById("adminChatInput");
    if (chatInput) {
      chatInput.value = btn.dataset.text;
      chatInput.focus();
      chatInput.style.height = "auto";
      chatInput.style.height = Math.min(chatInput.scrollHeight, 120) + "px";
    }
    toggleChatSidebar(false);
  });

  /* ⚠️ SỬA (UI/UX audit — ưu tiên cao): window.confirm() → window.showConfirm() */
  document.getElementById("adminClearChatBtn")?.addEventListener("click", async () => {
    const ok = await window.showConfirm({
      title: "Xóa toàn bộ lịch sử chat hôm nay?",
      message: "Hành động này không thể hoàn tác!",
      confirmText: "🗑️ Xóa",
      cancelText: "Hủy",
      danger: true,
    });
    if (!ok) return;
    try {
      await remove(msgRef);
      window.showToast("🗑️ Đã xóa toàn bộ chat", "#e17055");
    } catch(err) {
      window.showToast("❌ Lỗi: " + err.message, "#e17055");
    }
  });

  document.getElementById("chatBackBtn")?.addEventListener("click", () => {
    closeChatPage();
    if (typeof window.showDashboard === "function") window.showDashboard();
  });

  const sidebarEl      = document.querySelector("#chatAdminPage .chat-sidebar");
  const sidebarOverlay = document.getElementById("chatSidebarOverlay");

  function toggleChatSidebar(force) {
    const open = force ?? !sidebarEl?.classList.contains("open");
    sidebarEl?.classList.toggle("open", open);
    sidebarOverlay?.classList.toggle("show", open);
  }
  document.getElementById("chatSidebarToggle")?.addEventListener("click", () => toggleChatSidebar());
  sidebarOverlay?.addEventListener("click", () => toggleChatSidebar(false));
}

/* ══════════════════════════════════════════════
   HELPERS
   ══════════════════════════════════════════════ */
function updateMsgCount() {
  const el = document.getElementById("adminMsgCount");
  if (el) el.textContent = `${allMessages.length} tin nhắn`;
}
