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

/* ═════════ INIT FIREBASE ═════════ */

const app = initializeApp(firebaseConfig);

const db = getDatabase(app);

/* ═════════ USERNAME SYSTEM ═════════ */

let username =
  localStorage.getItem("tcq_username");

const usernameModal =
  document.getElementById("username-modal");

const usernameInput =
  document.getElementById("username-input");

const usernameSave =
  document.getElementById("username-save");

/* CHƯA CÓ TÊN */

if(!username){

  usernameModal.classList.add("show");

  setTimeout(()=>{
    usernameInput.focus();
  },100);

}

/* SAVE USERNAME */

function saveUsername(){

  const val =
    usernameInput.value.trim();

  if(!val){

    usernameInput.focus();

    usernameInput.style.borderColor = "#e63946";

    return;
  }

  username = val;

  localStorage.setItem(
    "tcq_username",
    username
  );

  usernameModal.classList.remove("show");
}

/* BUTTON */

usernameSave.addEventListener(
  "click",
  saveUsername
);

/* ENTER */

usernameInput.addEventListener(
  "keydown",
  e=>{

    if(e.key==="Enter"){
      saveUsername();
    }

  }
);

/* ═════════ CHAT OPEN/CLOSE ═════════ */

const toggleBtn = document.getElementById("chat-toggle");

const chatWindow = document.getElementById("chat-window");

const closeBtn = document.getElementById("chat-close");

toggleBtn.addEventListener("click", ()=>{

  chatWindow.classList.toggle("open");

  /* Đóng emoji picker khi đóng/mở chat */
  emojiPicker.classList.add("hidden");

});

closeBtn.addEventListener("click", ()=>{

  chatWindow.classList.remove("open");

  emojiPicker.classList.add("hidden");

});

/* ═════════ ONLINE USERS ═════════ */

const userId =
  Date.now() + "_" + Math.random().toString(36).slice(2);

const onlineRef =
  ref(db, "onlineUsers/" + userId);

set(onlineRef,{
  name: username,
  online: true
});

/* QUAN TRỌNG */
onDisconnect(onlineRef).remove();

onValue(ref(db,"onlineUsers"), snapshot=>{

  const data = snapshot.val();

  const count =
    data ? Object.keys(data).length : 0;

  document.getElementById("online-count")
    .textContent = count;

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

const emojiPicker  = document.getElementById("emoji-picker");
const emojiGrid    = document.getElementById("emoji-grid");
const emojiToggle  = document.getElementById("emoji-toggle");
const chatInput    = document.getElementById("chat-input");

/* Render emoji buttons */
EMOJIS.forEach(em => {

  const btn = document.createElement("button");

  btn.textContent = em;

  btn.title = em;

  btn.addEventListener("click", ()=>{

    /* Chèn emoji vào vị trí con trỏ */
    const start = chatInput.selectionStart;
    const end   = chatInput.selectionEnd;
    const val   = chatInput.value;

    chatInput.value =
      val.slice(0, start) + em + val.slice(end);

    /* Đặt lại con trỏ sau emoji */
    const pos = start + em.length;
    chatInput.setSelectionRange(pos, pos);

    chatInput.focus();

  });

  emojiGrid.appendChild(btn);

});

/* Bật / tắt picker */
emojiToggle.addEventListener("click", e=>{

  e.stopPropagation();

  emojiPicker.classList.toggle("hidden");

});

/* Click ngoài → đóng picker */
document.addEventListener("click", e=>{

  if(
    !emojiPicker.contains(e.target) &&
    e.target !== emojiToggle
  ){
    emojiPicker.classList.add("hidden");
  }

});

/* ═════════ CHAT MESSAGES ═════════ */

const msgRef = ref(db, "communityChat");
clearChatIfNewDay();

/* SEND */

function sendMessage(){

  const text = chatInput.value.trim();

  if(!text) return;

  push(msgRef,{
    user: username,
    text: text,
    time: Date.now()
  });

  chatInput.value = "";

  /* Đóng emoji picker sau khi gửi */
  emojiPicker.classList.add("hidden");
}

/* BUTTON SEND */

document.getElementById("chat-send")
.addEventListener("click", sendMessage);

/* ENTER SEND */

chatInput.addEventListener("keydown", e=>{

  if(e.key === "Enter"){
    sendMessage();
  }

});

/* CLEAR UI KHI DB RESET */

onValue(msgRef, snapshot=>{

  if(!snapshot.exists()){

    document.getElementById(
      "chat-messages"
    ).innerHTML = "";

  }

});

/* ═════════ ĐỊNH DẠNG THỜI GIAN ═════════ */

function formatTime(timestamp){

  if(!timestamp) return "";

  const d = new Date(timestamp);

  const hh = String(d.getHours()).padStart(2,"0");
  const mm = String(d.getMinutes()).padStart(2,"0");

  return `${hh}:${mm}`;
}

/* RECEIVE */

onChildAdded(msgRef, snapshot=>{

  const msg = snapshot.val();

  const wrap = document.createElement("div");

  wrap.className = "chat-msg";

  wrap.innerHTML = `
    <div class="chat-meta">
      <span class="chat-user">${escapeHtml(msg.user)}</span>
      <span class="chat-time">${formatTime(msg.time)}</span>
    </div>
    <div class="chat-bubble">${escapeHtml(msg.text)}</div>
  `;

  const container =
    document.getElementById("chat-messages");

  container.appendChild(wrap);

  container.scrollTop =
    container.scrollHeight;

});

/* ═════════ RESET CHAT MỖI NGÀY ═════════ */

async function clearChatIfNewDay(){

  const today =
    new Date().toISOString().split('T')[0];

  const savedDay =
    localStorage.getItem('tcq-last-reset-day');

  /* CÙNG NGÀY → KHÔNG RESET */

  if(savedDay === today) return;

  /* LƯU NGÀY MỚI */

  localStorage.setItem(
    'tcq-last-reset-day',
    today
  );

  try{

    /* XÓA TOÀN BỘ CHAT */

    await remove(msgRef);

    console.log(
      '🧹 Đã reset chat ngày mới'
    );

  }catch(err){

    console.error(
      'Lỗi reset chat:',
      err
    );

  }

}

/* ═════════ ESCAPE HTML ═════════ */

function escapeHtml(str){

  return String(str)
    .replace(/&/g,"&amp;")
    .replace(/</g,"&lt;")
    .replace(/>/g,"&gt;");
}
