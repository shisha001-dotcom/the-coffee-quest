import { initializeApp }
from "https://www.gstatic.com/firebasejs/10.12.2/firebase-app.js";

import {
  getDatabase,
  ref,
  push,
  onChildAdded,
  set,
  onValue,
  onDisconnect,
  remove,
  get
}
from "https://www.gstatic.com/firebasejs/10.12.2/firebase-database.js";

/* ═════════ FIREBASE CONFIG ═════════ */
const firebaseConfig = {
  apiKey: "AIzaSyBIn1bj6ndt8Yy5AiPFdeKtI5MrZnaNugc",
  authDomain: "doublevcute.firebaseapp.com",
  databaseURL: "https://doublevcute-default-rtdb.asia-southeast1.firebasedatabase.app",
  projectId: "doublevcute",
  storageBucket: "doublevcute.firebasestorage.app",
  messagingSenderId: "31483876077",
  appId: "1:31483876077:web:f2efbb34d8a2c6dcb532e4",
  measurementId: "G-EKGL5TN6NY"
};

const app = initializeApp(firebaseConfig);
const db  = getDatabase(app);

/* ═════════ USERNAME SYSTEM ═════════ */
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
  if (!val) {
    usernameInput.focus();
    usernameInput.style.borderColor = "#e63946";
    return;
  }
  username = val;
  localStorage.setItem("tcq_username", username);
  usernameModal.classList.remove("show");
}

usernameSave.addEventListener("click", saveUsername);
usernameInput.addEventListener("keydown", e => {
  if (e.key === "Enter") saveUsername();
});

/* Update username từ settings page */
window.updateChatUsername = function(newName) {
  username = newName;
};

/* ═════════ CHAT OPEN/CLOSE ═════════ */
const toggleBtn  = document.getElementById("chat-toggle");
const chatWindow = document.getElementById("chat-window");
const closeBtn   = document.getElementById("chat-close");

toggleBtn.addEventListener("click", () => {
  chatWindow.classList.toggle("open");
  emojiPicker.classList.add("hidden");

  /* Reset unread khi mở */
  if (chatWindow.classList.contains("open")) {
    clearUnreadDot();
  }
});

closeBtn.addEventListener("click", () => {
  chatWindow.classList.remove("open");
  emojiPicker.classList.add("hidden");
});

/* ═════════ UNREAD DOT TRÊN NÚT CHAT ═════════ */
function showUnreadDot() {
  let dot = document.getElementById("chat-unread-dot");
  if (!dot) {
    dot = document.createElement("span");
    dot.id = "chat-unread-dot";
    Object.assign(dot.style, {
      position: "absolute",
      top: "6px", right: "6px",
      width: "12px", height: "12px",
      background: "#fdcb6e",
      border: "2px solid #e63946",
      borderRadius: "50%",
      display: "block",
      pointerEvents: "none",
    });
    toggleBtn.style.position = "relative";
    toggleBtn.appendChild(dot);
  }
}

function clearUnreadDot() {
  document.getElementById("chat-unread-dot")?.remove();
}

/* ═════════ ONLINE USERS ═════════ */
const userId   = Date.now() + "_" + Math.random().toString(36).slice(2);
const onlineRef = ref(db, "onlineUsers/" + userId);

set(onlineRef, { name: username, online: true });
onDisconnect(onlineRef).remove();

onValue(ref(db, "onlineUsers"), snapshot => {
  const data  = snapshot.val();
  const count = data ? Object.keys(data).length : 0;
  document.getElementById("online-count").textContent = count;
});

/* ═════════ EMOJI PICKER ═════════ */
const EMOJIS = [
  "😀","😂","🥰","😍","🤩","😎","🥳","😊",
  "😅","🤣","😭","😢","😤","😠","🤔","🫠",
  "👍","👎","👏","🙌","🤝","💪","🙏","✌️",
  "❤️","🧡","💛","💚","💙","💜","🖤","🤍",
  "🔥","✨","🎉","🎊","💯","⭐","🌟","💫",
  "☕","🍵","🧋","🍫","🍰","🎂","🧁","🍩",
  "😋","🤤","😴","🥱","😪","🤧","😷","🥴",
  "🐶","🐱","🐻","🦊","🐼","🐸","🦁","🐨",
  "🍕","🍔","🍟","🌮","🍜","🍣","🍦","🍭",
  "⚽","🏀","🎮","🎵","🎬","📚","💻","📱"
];

const emojiPicker = document.getElementById("emoji-picker");
const emojiGrid   = document.getElementById("emoji-grid");
const emojiToggle = document.getElementById("emoji-toggle");
const chatInput   = document.getElementById("chat-input");

EMOJIS.forEach(em => {
  const btn = document.createElement("button");
  btn.textContent = em;
  btn.title = em;
  btn.addEventListener("click", () => {
    const start = chatInput.selectionStart;
    const end   = chatInput.selectionEnd;
    chatInput.value = chatInput.value.slice(0, start) + em + chatInput.value.slice(end);
    const pos = start + em.length;
    chatInput.setSelectionRange(pos, pos);
    chatInput.focus();
  });
  emojiGrid.appendChild(btn);
});

emojiToggle.addEventListener("click", e => {
  e.stopPropagation();
  emojiPicker.classList.toggle("hidden");
});

document.addEventListener("click", e => {
  if (!emojiPicker.contains(e.target) && e.target !== emojiToggle) {
    emojiPicker.classList.add("hidden");
  }
});

/* ═════════ ĐỊNH DẠNG THỜI GIAN ═════════ */
function formatTime(timestamp) {
  if (!timestamp) return "";
  const d  = new Date(timestamp);
  const hh = String(d.getHours()).padStart(2, "0");
  const mm = String(d.getMinutes()).padStart(2, "0");
  return `${hh}:${mm}`;
}

/* ═════════ ESCAPE HTML ═════════ */
function escapeHtml(str) {
  return String(str)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}

/* ═════════ BUILD MESSAGE ELEMENT ═════════ */
function buildMessageEl(msg) {
  const wrap = document.createElement("div");
  wrap.className = "chat-msg";

  if (msg.isStaff) {
    /* ── TIN NHẮN TỪ QUÁN ── */
    wrap.innerHTML = `
      <div class="chat-meta" style="align-items:center;gap:6px;">
        <span style="
          background:#1a1a1a; color:#fff;
          font-size:10px; font-weight:800;
          padding:2px 9px; border-radius:20px;
          letter-spacing:.5px; line-height:1.6;
        ">☕ THE COFFEEQUEST</span>
        <span class="chat-time">${formatTime(msg.time)}</span>
      </div>
      <div class="chat-bubble" style="
        background:linear-gradient(135deg,#1a1a2e,#2d2d5e);
        color:#fff;
        border:none;
        border-radius:4px 14px 14px 14px;
        box-shadow:0 2px 10px rgba(26,26,46,.3);
      ">${escapeHtml(msg.text)}</div>
    `;
  } else {
    /* ── TIN NHẮN KHÁCH ── */
    wrap.innerHTML = `
      <div class="chat-meta">
        <span class="chat-user">${escapeHtml(msg.user)}</span>
        <span class="chat-time">${formatTime(msg.time)}</span>
      </div>
      <div class="chat-bubble">${escapeHtml(msg.text)}</div>
    `;
  }

  return wrap;
}

/* ═════════ CHAT MESSAGES ═════════ */
const msgRef = ref(db, "communityChat");
clearChatIfNewDay();

/* ─── SEND ─── */
function sendMessage() {
  const text = chatInput.value.trim();
  if (!text) return;

  push(msgRef, {
    user: username,
    text: text,
    time: Date.now(),
    isStaff: false,
  });

  chatInput.value = "";
  emojiPicker.classList.add("hidden");
}

document.getElementById("chat-send").addEventListener("click", sendMessage);
chatInput.addEventListener("keydown", e => {
  if (e.key === "Enter") sendMessage();
});

/* ─── RECEIVE (real-time) ─── */
let firstLoad = true;

/* Load lịch sử ngay khi mở */
get(msgRef).then(snapshot => {
  const container = document.getElementById("chat-messages");
  container.innerHTML = "";

  if (snapshot.exists()) {
    snapshot.forEach(child => {
      container.appendChild(buildMessageEl(child.val()));
    });
    container.scrollTop = container.scrollHeight;
  }

  firstLoad = false;
});

onChildAdded(msgRef, snapshot => {
  if (firstLoad) return;   // đã xử lý bởi get()

  const msg = snapshot.val();
  const container = document.getElementById("chat-messages");
  container.appendChild(buildMessageEl(msg));
  container.scrollTop = container.scrollHeight;

  /* Unread dot khi cửa sổ đóng & tin nhắn từ quán */
  if (!chatWindow.classList.contains("open") && msg.isStaff) {
    showUnreadDot();
  }
});

/* ─── CLEAR UI khi DB reset ─── */
onValue(msgRef, snapshot => {
  if (!snapshot.exists()) {
    document.getElementById("chat-messages").innerHTML = "";
  }
});

/* ═════════ RESET CHAT MỖI NGÀY ═════════ */
async function clearChatIfNewDay() {
  const today    = new Date().toISOString().split("T")[0];
  const savedDay = localStorage.getItem("tcq-last-reset-day");

  if (savedDay === today) return;

  localStorage.setItem("tcq-last-reset-day", today);

  try {
    await remove(msgRef);
    console.log("🧹 Đã reset chat ngày mới");
  } catch(err) {
    console.error("Lỗi reset chat:", err);
  }
}
