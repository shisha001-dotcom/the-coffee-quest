// ═══════════════════════════════════════════════════════
//  dashboard.js — Admin Panel  |  The Coffee Quest
// ═══════════════════════════════════════════════════════

import { initializeApp }
  from "https://www.gstatic.com/firebasejs/10.12.2/firebase-app.js";

import {
  getDatabase,
  ref,
  set,
  get,
  onValue
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-database.js";

/* ═════════ CONFIG ═════════ */

const ADMIN_PASSWORD = "tcqadmin2025";

const DEFAULT_BANNERS = {
  1: "../assets/banner3.png",
  2: "../assets/banner2.png"
};

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

/* ═════════ CONVERT GOOGLE DRIVE LINK ═════════ */

function convertDriveLink(url){

  if(!url) return url;

  // Dạng: /file/d/FILE_ID/view
  const match1 = url.match(/\/file\/d\/([a-zA-Z0-9_-]+)/);
  if(match1){
    return `https://drive.google.com/uc?export=view&id=${match1[1]}`;
  }

  // Dạng: id=FILE_ID (đã là direct link)
  const match2 = url.match(/[?&]id=([a-zA-Z0-9_-]+)/);
  if(match2){
    return `https://drive.google.com/uc?export=view&id=${match2[1]}`;
  }

  // Không phải drive link → trả nguyên
  return url;
}

/* ═════════ FIREBASE ═════════ */

const firebaseApp = initializeApp(firebaseConfig);
const db          = getDatabase(firebaseApp);
const bannersRef  = ref(db, "siteConfig/banners");

/* ═════════ AUTH ═════════ */

const loginScreen = document.getElementById("login-screen");
const dashboard   = document.getElementById("dashboard");
const adminPass   = document.getElementById("admin-pass");
const loginBtn    = document.getElementById("login-btn");
const loginError  = document.getElementById("login-error");

if(sessionStorage.getItem("tcq_admin_auth") === "1"){
  showDashboard();
}

loginBtn.addEventListener("click", handleLogin);

adminPass.addEventListener("keydown", e=>{
  if(e.key === "Enter") handleLogin();
});

function handleLogin(){

  const val = adminPass.value;

  if(val === ADMIN_PASSWORD){

    sessionStorage.setItem("tcq_admin_auth", "1");

    loginError.classList.add("hidden");

    showDashboard();

  } else {

    loginError.classList.remove("hidden");

    adminPass.value = "";

    adminPass.focus();

    adminPass.style.borderColor = "#e63946";

    setTimeout(()=>{
      adminPass.style.borderColor = "";
    }, 1200);

  }
}

document.getElementById("logout-btn")
  .addEventListener("click", ()=>{

    sessionStorage.removeItem("tcq_admin_auth");

    dashboard.classList.add("hidden");

    loginScreen.classList.remove("hidden");

    adminPass.value = "";

  });

function showDashboard(){

  loginScreen.classList.add("hidden");

  dashboard.classList.remove("hidden");

  loadCurrentBanners();
}

/* ═════════ LOAD BANNERS HIỆN TẠI ═════════ */

function loadCurrentBanners(){

  onValue(bannersRef, snapshot=>{

    const data = snapshot.val() || {};

    [1, 2].forEach(n => {

      const url = data[n] || DEFAULT_BANNERS[n];

      const img    = document.getElementById(`current-img-${n}`);
      const urlDiv = document.getElementById(`current-url-${n}`);

      if(img){
        img.src = url;
        img.classList.remove("hidden");
        img.onerror = () => img.classList.add("hidden");
      }

      if(urlDiv) urlDiv.textContent = url;

      const urlInput = document.getElementById(`url-${n}`);
      if(urlInput && data[n]) urlInput.value = data[n];

      showPreview(n, url);

    });

  });
}

/* ═════════ PREVIEW ═════════ */

window.previewBanner = function(n){

  const urlInput = document.getElementById(`url-${n}`);
  const raw      = urlInput.value.trim();

  if(!raw){
    showStatus("⚠️ Nhập URL Google Drive trước", "error");
    return;
  }

  // Convert trước khi preview để thấy đúng ảnh
  const url = convertDriveLink(raw);

  showPreview(n, url);
};

function showPreview(n, url){

  const img         = document.getElementById(`preview-img-${n}`);
  const placeholder = document.getElementById(`placeholder-${n}`);

  if(!img || !url) return;

  img.src = url;

  img.onload = () => {
    img.classList.remove("hidden");
    placeholder.classList.add("hidden");
  };

  img.onerror = () => {
    img.classList.add("hidden");
    placeholder.classList.remove("hidden");
    showStatus("❌ Không tải được ảnh. Kiểm tra link và quyền chia sẻ", "error");
  };
}

/* ═════════ SAVE BANNER ═════════ */

window.saveBanner = async function(n){

  const urlInput = document.getElementById(`url-${n}`);
  const url      = convertDriveLink(urlInput.value.trim());

  if(!url){
    showStatus("⚠️ Chưa có URL để lưu", "error");
    return;
  }

  try{

    const snap    = await get(bannersRef);
    const current = snap.val() || {};

    await set(bannersRef, {
      ...current,
      [n]: url
    });

    // Cập nhật lại input với link đã convert
    urlInput.value = url;

    showStatus(`✅ Đã lưu Banner ${n} thành công!`, "success");

  } catch(err){

    console.error("Lỗi lưu banner:", err);

    showStatus("❌ Lỗi khi lưu. Kiểm tra Firebase", "error");

  }
};

/* ═════════ RESET VỀ MẶC ĐỊNH ═════════ */

window.resetBanner = async function(n){

  const confirmed = confirm(
    `Reset Banner ${n} về ảnh mặc định?\n(${DEFAULT_BANNERS[n]})`
  );

  if(!confirmed) return;

  try{

    const snap    = await get(bannersRef);
    const current = snap.val() || {};

    delete current[n];

    await set(bannersRef, current);

    const urlInput = document.getElementById(`url-${n}`);
    if(urlInput) urlInput.value = "";

    showStatus(`✅ Đã reset Banner ${n} về mặc định`, "success");

  } catch(err){

    console.error("Lỗi reset banner:", err);

    showStatus("❌ Lỗi khi reset", "error");

  }
};

/* ═════════ STATUS TOAST ═════════ */

let statusTimer = null;

function showStatus(msg, type = "success"){

  const badge = document.getElementById("save-status");

  badge.textContent = msg;

  badge.className = `status-badge ${type}`;

  clearTimeout(statusTimer);

  statusTimer = setTimeout(()=>{
    badge.textContent = "";
    badge.className   = "status-badge";
  }, 3500);
}
