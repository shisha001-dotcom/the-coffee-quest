<script type="module">

import { initializeApp }
from "https://www.gstatic.com/firebasejs/10.12.2/firebase-app.js";

import {
  getDatabase,
  ref,
  push,
  onChildAdded,
  set,
  onValue,
  onDisconnect
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

});

closeBtn.addEventListener("click", ()=>{

  chatWindow.classList.remove("open");

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

/* ═════════ CHAT MESSAGES ═════════ */

const msgRef = ref(db, "communityChat");

/* SEND */

function sendMessage(){

  const input =
    document.getElementById("chat-input");

  const text = input.value.trim();

  if(!text) return;

  push(msgRef,{
    user: username,
    text: text,
    time: Date.now()
  });

  input.value = "";
}

/* BUTTON SEND */

document.getElementById("chat-send")
.addEventListener("click", sendMessage);

/* ENTER SEND */

document.getElementById("chat-input")
.addEventListener("keydown", e=>{

  if(e.key === "Enter"){
    sendMessage();
  }

});

/* RECEIVE */

onChildAdded(msgRef, snapshot=>{

  const msg = snapshot.val();

  const wrap = document.createElement("div");

  wrap.className = "chat-msg";

  wrap.innerHTML = `
    <div class="chat-user">
      ${escapeHtml(msg.user)}
    </div>

    <div class="chat-bubble">
      ${escapeHtml(msg.text)}
    </div>
  `;

  const container =
    document.getElementById("chat-messages");

  container.appendChild(wrap);

  container.scrollTop =
    container.scrollHeight;

});

/* ═════════ ESCAPE HTML ═════════ */

function escapeHtml(str){

  return String(str)
    .replace(/&/g,"&amp;")
    .replace(/</g,"&lt;")
    .replace(/>/g,"&gt;");
}

</script>
