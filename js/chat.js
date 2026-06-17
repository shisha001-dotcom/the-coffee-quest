import { initializeApp }
  from "https://www.gstatic.com/firebasejs/10.12.2/firebase-app.js";
import {
  getDatabase, ref, push, onChildAdded,
  set, onValue, onDisconnect, remove, get, runTransaction
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-database.js";

/* ═════════ FIREBASE ═════════ */
const app = initializeApp(window.APP_CONFIG.firebaseConfig);
const db  = getDatabase(app);

/* ═════════ USERNAME ═════════ */
let username = localStorage.getItem("tcq_username");

const usernameModal = document.getElementById("username-modal");
const usernameInput = document.getElementById("username-input");
const usernameSave  = document.getElementById("username-save");

if (!username) {
  usernameModal.classList.add("show");
  setTimeout(() => usernameInput.focus(), 100);
}

function saveUsername() {
  const val = usernameInput.value.trim();
  if (!val) { usernameInput.focus(); usernameInput.style.borderColor = "#e63946"; return; }
  username = val;
  localStorage.setItem("tcq_username", username);
  usernameModal.classList.remove("show");
}

usernameSave.addEventListener("click", saveUsername);
usernameInput.addEventListener("keydown", e => { if (e.key === "Enter") saveUsername(); });

window.updateChatUsername = function(newName) { username = newName; };

/* ═════════ CHAT OPEN/CLOSE ═════════ */
const toggleBtn  = document.getElementById("chat-toggle");
const chatWindow = document.getElementById("chat-window");
const closeBtn   = document.getElementById("chat-close");

toggleBtn.addEventListener("click", () => {
  const isOpening = !chatWindow.classList.contains("open");
  chatWindow.classList.toggle("open");
  emojiPicker.classList.add("hidden");
  if (isOpening) clearUnreadDot();
});
closeBtn.addEventListener("click", () => {
  chatWindow.classList.remove("open");
  emojiPicker.classList.add("hidden");
});

/* ═════════ UNREAD DOT ═════════ */
function showUnreadDot() {
  if (document.getElementById("chat-unread-dot")) return; /* tránh tạo duplicate */
  const dot = document.createElement("span");
  dot.id = "chat-unread-dot";
  Object.assign(dot.style, {
    position:"absolute", top:"6px", right:"6px",
    width:"12px", height:"12px",
    background:"#fdcb6e", border:"2px solid #e63946",
    borderRadius:"50%", display:"block", pointerEvents:"none",
  });
  toggleBtn.style.position = "relative";
  toggleBtn.appendChild(dot);
}
function clearUnreadDot() { document.getElementById("chat-unread-dot")?.remove(); }

/* ═════════ ONLINE USERS ═════════ */
const userId    = `${Date.now()}_${Math.random().toString(36).slice(2)}`;
const onlineRef = ref(db, "onlineUsers/" + userId);

set(onlineRef, { name: username, online: true });
onDisconnect(onlineRef).remove();

onValue(ref(db, "onlineUsers"), snapshot => {
  const count = snapshot.val() ? Object.keys(snapshot.val()).length : 0;
  document.getElementById("online-count").textContent = count;
  trackHourlyOnline(count);
});

/* ═════════ ANALYTICS ═════════ */
function todayStr() { return new Date().toISOString().slice(0, 10); }
function hourStr()  { return String(new Date().getHours()).padStart(2, "0"); }

/* Ghi lượt xem game — gọi từ app.js qua window.__fbTrack */
window.__fbTrack = async function(type, date, gameId, gameName) {
  if (type !== 'gameViews') return;
  try {
    await runTransaction(ref(db, `analytics/gameViews/${date}/${gameId}/count`), cur => (cur || 0) + 1);
    await set(ref(db, `analytics/gameViews/${date}/${gameId}/name`), gameName);
  } catch(e) {
    console.warn("track gameView failed:", e);
  }
};

/* Ghi peak online theo giờ */
let _lastOnlineCount = -1; /* BUG FIX: dùng -1 để lần đầu luôn ghi */
async function trackHourlyOnline(count) {
  if (count === _lastOnlineCount) return;
  _lastOnlineCount = count;
  try {
    await runTransaction(
      ref(db, `analytics/hourly/${todayStr()}/${hourStr()}/peak`),
      cur => Math.max(cur || 0, count)
    );
  } catch(e) {
    console.warn("track hourly failed:", e);
  }
}

/* ═════════ EMOJI PICKER ═════════ */
const EMOJIS     = window.CHAT_EMOJIS;
const emojiPicker = document.getElementById("emoji-picker");
const emojiGrid   = document.getElementById("emoji-grid");
const emojiToggle = document.getElementById("emoji-toggle");
const chatInput   = document.getElementById("chat-input");

/* BUG FIX: build emoji grid 1 lần, dùng event delegation thay vì gắn listener cho từng button */
emojiGrid.innerHTML = EMOJIS.map(em =>
  `<button type="button" title="${em}" data-emoji="${em}">${em}</button>`
).join('');

emojiGrid.addEventListener("click", e => {
  const btn = e.target.closest("button[data-emoji]");
  if (!btn) return;
  const em    = btn.dataset.emoji;
  const start = chatInput.selectionStart;
  const end   = chatInput.selectionEnd;
  chatInput.value = chatInput.value.slice(0, start) + em + chatInput.value.slice(end);
  const pos = start + em.length;
  chatInput.setSelectionRange(pos, pos);
  chatInput.focus();
});

emojiToggle.addEventListener("click", e => {
  e.stopPropagation();
  emojiPicker.classList.toggle("hidden");
});
document.addEventListener("click", e => {
  if (!emojiPicker.contains(e.target) && e.target !== emojiToggle)
    emojiPicker.classList.add("hidden");
});

/* ═════════ HELPERS ═════════ */
function formatTime(timestamp) {
  if (!timestamp) return "";
  const d = new Date(timestamp);
  return `${String(d.getHours()).padStart(2,"0")}:${String(d.getMinutes()).padStart(2,"0")}`;
}
function escapeHtml(str) {
  return String(str)
    .replace(/&/g,"&amp;").replace(/</g,"&lt;").replace(/>/g,"&gt;");
}

/* ═════════ BUILD MESSAGE ELEMENT ═════════ */
function buildMessageEl(msg) {
  const wrap = document.createElement("div");
  wrap.className = "chat-msg";
  if (msg.isStaff) {
    wrap.innerHTML = `
      <div class="chat-meta" style="align-items:center;gap:6px;">
        <span style="background:#1a1a1a;color:#fff;font-size:10px;font-weight:800;padding:2px 9px;border-radius:20px;letter-spacing:.5px;line-height:1.6;">☕ THE COFFEEQUEST</span>
        <span class="chat-time">${formatTime(msg.time)}</span>
      </div>
      <div class="chat-bubble" style="background:linear-gradient(135deg,#1a1a2e,#2d2d5e);color:#fff;border:none;border-radius:4px 14px 14px 14px;box-shadow:0 2px 10px rgba(26,26,46,.3);">
        ${escapeHtml(msg.text)}
      </div>`;
  } else {
    wrap.innerHTML = `
      <div class="chat-meta">
        <span class="chat-user">${escapeHtml(msg.user)}</span>
        <span class="chat-time">${formatTime(msg.time)}</span>
      </div>
      <div class="chat-bubble">${escapeHtml(msg.text)}</div>`;
  }
  return wrap;
}

/* ═════════ CHAT MESSAGES ═════════ */
const msgRef      = ref(db, "communityChat");
const msgContainer = document.getElementById("chat-messages");

/* BUG FIX: firstLoad reset được khi msgRef bị xóa */
let firstLoad = true;

/* Xóa chat nếu sang ngày mới TRƯỚC khi load history */
await clearChatIfNewDay();

/* Load lịch sử 1 lần */
get(msgRef).then(snapshot => {
  msgContainer.innerHTML = "";
  if (snapshot.exists()) {
    const frag = document.createDocumentFragment(); /* tránh reflow nhiều lần */
    snapshot.forEach(child => frag.appendChild(buildMessageEl(child.val())));
    msgContainer.appendChild(frag);
    msgContainer.scrollTop = msgContainer.scrollHeight;
  }
  firstLoad = false;
});

/* Lắng nghe tin mới */
onChildAdded(msgRef, snapshot => {
  if (firstLoad) return;
  const msg = snapshot.val();
  msgContainer.appendChild(buildMessageEl(msg));
  msgContainer.scrollTop = msgContainer.scrollHeight;
  if (!chatWindow.classList.contains("open") && msg.isStaff) showUnreadDot();
});

/* BUG FIX: khi msgRef bị xóa hoàn toàn (admin clear chat), reset firstLoad
   để onChildAdded không bỏ sót tin nhắn đầu tiên sau khi xóa */
onValue(msgRef, snapshot => {
  if (!snapshot.exists()) {
    msgContainer.innerHTML = "";
    firstLoad = false; /* BUG FIX: reset để nhận tin nhắn mới ngay sau khi xóa */
  }
});

/* Send message */
function sendMessage() {
  const text = chatInput.value.trim();
  if (!text) return;
  push(msgRef, { user: username, text, time: Date.now(), isStaff: false });
  chatInput.value = "";
  emojiPicker.classList.add("hidden");
}

document.getElementById("chat-send").addEventListener("click", sendMessage);
chatInput.addEventListener("keydown", e => { if (e.key === "Enter") sendMessage(); });

/* ═════════ RESET CHAT MỖI NGÀY ═════════ */
async function clearChatIfNewDay() {
  const today    = new Date().toISOString().split("T")[0];
  const savedDay = localStorage.getItem("tcq-last-reset-day");
  if (savedDay === today) return;

  /* BUG FIX: chỉ gọi remove() nếu thực sự có data — tránh write không cần thiết */
  try {
    const snap = await get(msgRef);
    if (snap.exists()) {
      await remove(msgRef);
      console.log("🧹 Reset chat ngày mới");
    }
  } catch(err) {
    console.error("Lỗi reset chat:", err);
  }

  localStorage.setItem("tcq-last-reset-day", today);
}
