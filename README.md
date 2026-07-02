# ☕ The Coffee Quest — Tài liệu dự án

> **Mục đích file này:** Hướng dẫn sử dụng hệ thống, sơ đồ kiến trúc code, và chú thích từng file để bảo trì dễ dàng — kể cả khi nhờ AI (Claude) hỗ trợ sửa code.

---

## Mục lục

1. [Tổng quan hệ thống](#1-tổng-quan-hệ-thống)
2. [Sơ đồ kiến trúc](#2-sơ-đồ-kiến-trúc)
3. [Cấu trúc thư mục](#3-cấu-trúc-thư-mục)
4. [Luồng dữ liệu](#4-luồng-dữ-liệu)
5. [Hướng dẫn sử dụng — Frontend (khách)](#5-hướng-dẫn-sử-dụng--frontend-khách)
6. [Hướng dẫn sử dụng — Admin Dashboard](#6-hướng-dẫn-sử-dụng--admin-dashboard)
7. [Chú thích từng file](#7-chú-thích-từng-file)
8. [Database Schema](#8-database-schema)
9. [Biến môi trường & cấu hình](#9-biến-môi-trường--cấu-hình)
10. [Quy trình bảo trì thường gặp](#10-quy-trình-bảo-trì-thường-gặp)
11. [Hệ thống Page Registry (Admin)](#11-hệ-thống-page-registry-admin)

---

## 1. Tổng quan hệ thống

| Thành phần | Công nghệ | Vai trò |
|---|---|---|
| **Frontend** | HTML + CSS + Vanilla JS | Trang khách truy cập — xem game, chat |
| **Admin** | HTML + CSS + Vanilla JS (module hóa) | Dashboard quản trị nội bộ |
| **Database** | Supabase (PostgreSQL) | Lưu boardgames, drinks, admin_users, media_library, site_settings |
| **Realtime Chat** | Firebase Realtime Database | Chat cộng đồng + đếm online + analytics |
| **Font/Style** | Google Fonts (Bebas Neue, Nunito, Inter) | Typography |

Không có backend server riêng — toàn bộ là **static files** gọi thẳng tới Supabase và Firebase từ trình duyệt.

---

## 2. Sơ đồ kiến trúc
┌─────────────────────────────────────────────────────────────────┐
│                        TRÌNH DUYỆT                              │
│                                                                 │
│  ┌──────────────────────────┐   ┌──────────────────────────┐   │
│  │      FRONTEND (/)        │   │   ADMIN (/admin/)         │   │
│  │                          │   │                           │   │
│  │  index.html              │   │  login.html               │   │
│  │    ├── css/style.css     │   │  dashboard.html (shell)   │   │
│  │    ├── css/chat.css      │   │    ├── dashboard.css      │   │
│  │    ├── js/shared-*.js    │   │    ├── core/               │   │
│  │    ├── js/data.js        │   │    │   ├── dashboard-auth.js
│  │    ├── js/app.js         │   │    │   ├── dashboard-page-registry.js
│  │    └── js/chat.js        │   │    │   └── dashboard-nav.js
│  │                          │   │    ├── modules/            │   │
│  │  pages/                  │   │    │   ├── dashboard-games.js
│  │    ├── news.html         │   │    │   ├── dashboard-drinks.js
│  │    ├── boardgame.html    │   │    │   ├── dashboard-chat.js
│  │    ├── contact.html      │   │    │   ├── dashboard-analytics.js
│  │    └── settings.html     │   │    │   ├── dashboard-banners.js
│  │                          │   │    │   ├── dashboard-media.js
│  │                          │   │    │   └── dashboard-accounts.js
│  │                          │   │    └── dashboard-mobile-menu.js
│  └──────────┬───────────────┘   └──────────┬────────────────┘   │
│             │                              │                     │
└─────────────┼──────────────────────────────┼─────────────────────┘
│                              │
┌────────▼────────┐           ┌─────────▼────────┐
│    SUPABASE      │           │    FIREBASE       │
│  (PostgreSQL)    │           │ Realtime Database │
│                  │           │                   │
│  • games         │           │  • communityChat  │
│  • drinks        │           │  • onlineUsers    │
│  • admin_users   │           │  • analytics/      │
│  • media_library │           │      gameViews     │
│  • site_settings │           │      hourly        │
└──────────────────┘           └───────────────────┘

### Quan hệ giữa các module — Admin
dashboard.html (chỉ còn HTML shell — KHÔNG còn <script> logic inline)
│
├── [load]──► js/shared-config.js         (Supabase URL/Key, Firebase config)
├── [load]──► js/shared-emoji.js          (danh sách emoji dùng chung)
├── [load]──► js/shared-utils.js          (escHtml, showToast, formatTime, slugify...)
├── [load]──► Supabase SDK (CDN)
│
├── [load]──► core/dashboard-auth.js
│                 │  requireAuth() + tạo client + currentSession (global)
│                 └── inject User bar vào sidebar
│
├── [load]──► core/dashboard-page-registry.js
│                 └── tạo window.AdminDashboard.registerPage() / showPage()
│                     (nơi DUY NHẤT các module đăng ký page + menu item)
│
├── [load]──► modules/dashboard-games.js   (script thường — CRUD game + emoji picker)
├── [load]──► modules/dashboard-drinks.js  (script thường — CRUD đồ uống)
│
├── [load]──► core/dashboard-nav.js
│                 └── showDashboard(), showBoardgames(), showDrinks()...
│                     (dùng loadGames()/loadDrinks() đã có ở trên)
│
├── [module]─► modules/dashboard-chat.js       (Firebase chat admin)
├── [module]─► modules/dashboard-analytics.js  (Firebase — biểu đồ lượt xem/online)
├── [module]─► modules/dashboard-banners.js    (Supabase site_settings)
├── [module]─► modules/dashboard-media.js      (Supabase media_library)
├── [module]─► modules/dashboard-accounts.js   (Supabase admin_users, chỉ superadmin)
│
└── [load]──► dashboard-mobile-menu.js     (off-canvas sidebar mobile, load CUỐI CÙNG)
index.html
│
├── [load]──► js/shared-config.js
├── [load]──► js/shared-emoji.js
├── [load]──► js/data.js            (fetch games từ Supabase → window.GAMES)
├── [load]──► js/app.js             (router, render UI, dùng window.GAMES)
│                   │
│                   └── GAMES_READY.then(routeFromHash)
│
└── [module]─► js/chat.js           (Firebase chat + online users)

---

## 3. Cấu trúc thư mục
project-root/
│
├── index.html                  ← Trang chủ frontend (SPA shell)
│
├── css/
│   ├── style.css               ← Entry point, chỉ chứa @import
│   ├── chat.css                ← Style riêng cho widget chat nổi
│   └── base/
│       ├── variables.css       ← CSS variables (đổi màu/font tại đây)
│       ├── reset.css           ← Reset & base + animation page
│       ├── header-menu.css     ← Header + Side menu
│       ├── news-banner.css     ← Banner trang News + Daily pick
│       ├── boardgame-list.css  ← Filter bar, grid, game card
│       ├── boardgame-detail.css← Trang chi tiết game + related
│       ├── pages.css           ← Trang Contact + Settings
│       ├── modals.css          ← Username modal + Lightbox
│       └── responsive.css      ← Footer, animations, responsive
│
├── js/
│   ├── shared-config.js        ← Supabase URL/Key + Firebase config (DUY NHẤT)
│   ├── shared-emoji.js         ← Danh sách emoji dùng chung (EMOJI_CATEGORIES, CHAT_EMOJIS)
│   ├── shared-utils.js         ← Hàm tiện ích dùng chung (escHtml, showToast, formatTime, slugify)
│   ├── data.js                 ← Fetch games từ Supabase, export window.GAMES
│   ├── app.js                  ← Router, render list/detail, daily pick, lightbox
│   └── chat.js                 ← Chat Firebase, online users, emoji picker (frontend)
│
├── pages/                      ← Các trang con, load động bởi app.js
│   ├── news.html               ← Trang chủ: banner + daily pick
│   ├── boardgame.html          ← List game + detail game (2 div.page trong 1 file)
│   ├── contact.html            ← Thông tin liên hệ + gallery
│   └── settings.html           ← Đổi tên hiển thị chat
│
├── assets/
│   ├── img/                    ← Banner, ảnh trang trí
│   └── store/                  ← Ảnh thực tế quán (contact page)
│
└── admin/
├── login.html               ← Trang đăng nhập admin (SHA-256 + Supabase, tự chứa)
├── dashboard.html           ← Shell dashboard: CHỈ còn HTML (sidebar + page sections + modal)
├── dashboard.css            ← Style toàn bộ dashboard
├── dashboard-mobile-menu.js ← Off-canvas sidebar trên mobile/tablet
│
├── core/                    ← Hạ tầng dùng chung cho mọi module admin
│   ├── dashboard-auth.js          ← Auth guard, tạo client (Supabase) + currentSession, user bar
│   ├── dashboard-page-registry.js ← window.AdminDashboard.registerPage()/showPage() — nơi DUY NHẤT
│   │                                quản lý hiện/ẩn page + tạo menu item sidebar
│   └── dashboard-nav.js           ← Điều hướng cho 3 page tĩnh có sẵn trong HTML:
│                                     Dashboard, Boardgames, Drinks (showDashboard, showBoardgames,
│                                     toggleBgMenu, showDrinks, toggleDrinkMenu, filterDrinks...)
│
└── modules/                 ← Từng module nghiệp vụ, độc lập, tự đăng ký qua AdminDashboard
├── dashboard-games.js       ← CRUD Boardgames + emoji picker (script thường)
├── dashboard-drinks.js      ← CRUD Đồ uống (script thường, MỚI tách từ HTML inline)
├── dashboard-chat.js        ← Chat real-time admin (ES module — Firebase)
├── dashboard-analytics.js   ← Thống kê lượt xem/online (ES module — Firebase + Canvas chart)
├── dashboard-banners.js     ← Quản lý banner trang News (ES module — Supabase site_settings)
├── dashboard-media.js       ← Thư viện media/ảnh (ES module — Supabase media_library)
└── dashboard-accounts.js    ← Quản lý tài khoản admin (ES module — chỉ hiện với superadmin)

> **Quy ước:** `core/` chứa hạ tầng mà mọi module admin phụ thuộc vào (auth, page registry, nav 3 trang tĩnh). `modules/` chứa từng tính năng nghiệp vụ độc lập — muốn thêm/bớt tính năng chỉ cần thêm/xóa 1 file trong `modules/` + 1 dòng `<script>` trong `dashboard.html`, không đụng vào các module khác.

---

## 4. Luồng dữ liệu

### 4.1 Tải danh sách game (Frontend)

index.html load
│
▼
js/data.js
│  import Supabase SDK (CDN ESM)
│  fetch games table → order by sort_order
│  map sang object chuẩn (camelCase)
▼
window.GAMES = [...]          ← mảng global dùng xuyên suốt app
window.GAMES_READY = Promise  ← các module khác await cái này

│
▼ (khi GAMES_READY resolve)
js/app.js → routeFromHash()
│
├── hash = #boardgame  → loadPage('boardgame') → initBoardgame() → renderGrid()
├── hash = #news       → loadPage('news')      → renderDailyPick()
├── hash = #game-N     → loadPage('boardgame') → goDetail(N)
└── hash = #settings   → loadPage('settings')  → initSettings()
### 4.2 Chat realtime (Frontend)
User mở trang
│
▼
js/chat.js
│  kiểm tra localStorage['tcq_username']
├── chưa có → hiện modal nhập tên
└── có rồi  → tiếp tục
│
│  set onlineUsers/{userId} = {name, online:true}
│  onDisconnect → remove (tự xóa khi tắt tab)
│
│  get(communityChat)     ← load lịch sử 1 lần
│  onChildAdded(...)      ← lắng nghe tin mới realtime
▼
render buildMessageEl(msg)
├── msg.isStaff = true  → style bubble tối + badge THE COFFEEQUEST
└── msg.isStaff = false → style bubble trắng thường

### 4.3 Admin đăng nhập
login.html
│  nhập username + password
│  sha256(password) ← Web Crypto API, hash phía client
│
▼
Supabase: SELECT * FROM admin_users WHERE username = ?
│  so sánh password_hash
├── sai → hiện error
└── đúng → lưu session vào sessionStorage['bg_admin_session']
redirect → dashboard.html
admin/core/dashboard-auth.js (chạy ngay khi dashboard.html load)
│  requireAuth() → đọc sessionStorage
└── không có session → redirect login.html (chặn toàn bộ script phía sau)

### 4.4 Admin dashboard khởi động & điều hướng
dashboard.html
│
├── core/dashboard-auth.js chạy trước tiên
│       → tạo client (Supabase) + currentSession (global, KHÔNG cần import)
│
├── core/dashboard-page-registry.js chạy tiếp
│       → định nghĩa window.AdminDashboard.registerPage({...})
│         và window.AdminDashboard.showPage(pageId, menuId, onShow)
│       → cũng expose window.__showPage(pageId) để tương thích ngược
│
├── modules/dashboard-games.js + modules/dashboard-drinks.js
│       → chạy loadGames() / expose loadDrinks() ra window
│
├── core/dashboard-nav.js
│       → định nghĩa showDashboard(), showBoardgames(), showDrinks()...
│         (3 page TĨNH đã có sẵn HTML trong dashboard.html)
│
└── các module ES (chat/analytics/banners/media/accounts)
→ mỗi module tự gọi:
window.AdminDashboard.registerPage({
pageId, menuId, icon, label, onShow, guard, ...
})
→ registry tự tạo menu item trong sidebar + gắn onclick
→ khi click: ẩn hết page khác, hiện đúng page này, gọi onShow()

### 4.5 Admin gửi tin chat
admin/modules/dashboard-chat.js
│  push(communityChat, { user, text, time, isStaff: true, staffName })
│
▼  (realtime onChildAdded trên frontend)
js/chat.js → buildMessageEl({ isStaff: true })
→ render bubble màu tối + badge "☕ THE COFFEEQUEST"

---

## 5. Hướng dẫn sử dụng — Frontend (khách)

### Điều hướng
- Menu hamburger `☰` ở góc trên trái → mở side menu
- Các mục: **Tin tức**, **Luật Boardgame**, **Thông tin liên hệ**, **Cài đặt**

### Trang Tin tức (News)
- Hiển thị các banner quảng bá
- Phần **"Hôm nay chơi gì?"** chọn ngẫu nhiên 3 game mỗi lần tải trang / bấm "Thử game khác"
- Nhấn vào card → chuyển sang trang chi tiết game đó

### Trang Boardgame
- Thanh filter theo thể loại (Party, Chiến lược, Gia đình...)
- Search theo tên game (live filter)
- Nhấn card → trang chi tiết với: mục tiêu, chuẩn bị, lượt chơi, điều kiện thắng, mẹo, ảnh, video
- Ảnh hướng dẫn → click để phóng to (lightbox)

### Chat cộng đồng
- Nhấn nút 💬 góc dưới phải → mở cửa sổ chat
- Lần đầu tiên → nhập tên hiển thị
- Có thể đổi tên trong **Cài đặt cá nhân**
- Emoji picker: nhấn 😊 bên cạnh ô nhập
- Dấu chấm vàng trên nút 💬 = có tin mới từ quán khi cửa sổ đang đóng
- Chat tự reset mỗi ngày mới (0:00)

---

## 6. Hướng dẫn sử dụng — Admin Dashboard

### Đăng nhập
- Truy cập `/admin/login.html`
- Tài khoản được tạo sẵn trong bảng `admin_users` trên Supabase
- Session lưu trong `sessionStorage` → tắt tab là mất, phải đăng nhập lại

### Dashboard (trang chủ)
- Xem **số người đang online** trên website realtime (kéo từ Firebase)
- Stat card: tổng game, tổng công thức đồ uống, game có YouTube, game có ảnh

### Boardgames
Mở từ sidebar → **🎲 Boardgames**

| Sub-menu | Chức năng |
|---|---|
| Tất cả game | Hiển thị bảng toàn bộ game, có search |
| + Thêm game mới | Mở modal thêm mới ngay |
| Tìm kiếm | Focus vào ô search |

**Thêm / Sửa game:**
- Điền form → nhấn **💾 Lưu**
- Emoji: click vào ô → picker với 8 danh mục + search
- Màu: dùng color picker hoặc gõ hex
- Ảnh hướng dẫn: mỗi dòng `URL | Chú thích`
- Bước chuẩn bị / lượt chơi / mẹo: mỗi dòng = 1 mục
- Thứ tự hiển thị: số nhỏ lên trước

**Xóa game:** Mở modal sửa → nút **🗑️ Xóa game** (có confirm)

### Đồ uống
Mở từ sidebar → **☕ Đồ uống**

- Filter theo loại: Cà phê / Trà hoa quả / Trà sữa / Sữa chua
- **+ Thêm công thức** → modal nhập tên, loại, emoji, nguyên liệu, các bước, mẹo, ảnh
- Nhấn **✏️ Sửa** trên card để chỉnh sửa hoặc xóa

### Thư viện Media
Mở từ sidebar → **🗂️ Thư viện Media**

- Lưu link ảnh dùng làm banner/poster, hỗ trợ tự chuyển link Google Drive sang link ảnh trực tiếp
- Gắn tag, tìm kiếm, copy link, tải ảnh xuống máy
- Mọi tài khoản đã đăng nhập đều thêm được ảnh mới; **chỉ Super Admin mới xóa được**

### Banners
Mở từ sidebar → **🖼️ Banners**

- Quản lý 2 banner hiển thị trên trang News (URL ảnh + bật/tắt hiển thị)
- Nhấn **💾 Lưu thay đổi** để áp dụng

### Thống kê
Mở từ sidebar → **📈 Thống kê**

- Xem lượt xem theo game và giờ cao điểm online, lọc theo Hôm nay / 7 ngày / tùy chọn khoảng ngày
- Biểu đồ vẽ bằng Canvas thuần (không dùng thư viện ngoài)

### Chat Cộng đồng
Mở từ sidebar → **💬 Cộng đồng**

- Xem toàn bộ lịch sử chat của khách
- Gửi tin với tư cách **THE COFFEEQUEST** (hiển thị bubble tối trên client)
- Sidebar phải: **Tag quán** — tự động bắt các tin nhắn có `@thecoffeequest`, `@quán`...
- **Trả lời nhanh**: click để đưa câu trả lời mẫu vào ô nhập, chỉnh sửa rồi gửi
- **Xóa chat hôm nay**: xóa toàn bộ lịch sử (không hoàn tác)
- Badge đỏ trên menu = có tin nhắn mới chưa đọc
- Thông báo trình duyệt (nếu đã cho phép): hiện khi có tin nhắn mới mà đang ở tab khác

### Quản lý tài khoản (chỉ Super Admin)
Mở từ sidebar → **👤 Quản lý tài khoản**

- Chỉ hiển thị với tài khoản có `role = 'superadmin'`
- Thêm/sửa tài khoản, đổi vai trò (`editor` / `superadmin`)
- Mật khẩu luôn được hash SHA-256 phía client trước khi lưu

---

## 7. Chú thích từng file

### `js/shared-config.js`
**Nhiệm vụ:** Nơi DUY NHẤT chứa Supabase URL/Key và Firebase config.
Exports: window.APP_CONFIG = { supabaseUrl, supabaseKey, firebaseConfig }
Phải load ĐẦU TIÊN trong mọi trang (frontend lẫn admin).

### `js/shared-emoji.js`
**Nhiệm vụ:** Danh sách emoji dùng chung toàn dự án.
Exports:
window.EMOJI_CATEGORIES — 8 danh mục, dùng cho emoji picker game (admin/modules/dashboard-games.js)
window.CHAT_EMOJIS      — 80 emoji phẳng, dùng cho emoji picker chat (js/chat.js)
window.ALL_EMOJIS / window.UNIQUE_EMOJIS — flatten để search

### `js/shared-utils.js`
**Nhiệm vụ:** Hàm tiện ích dùng chung cho TOÀN BỘ dự án (frontend + admin) — nơi DUY NHẤT tránh lặp code escHtml/showToast từng bị viết lại 5 lần.
Exports:
window.escHtml(s)            — escape HTML an toàn khi chèn text động vào innerHTML
window.formatTime(ts)        — timestamp → "HH:MM"
window.formatDateVN(dateStr) — "2026-06-11" → "11/06/2026"
window.showToast(msg, bg)    — toast notification góc phải dưới
window.slugify(s)            — chuỗi → slug an toàn cho tên file/URL
Load SAU shared-config.js, TRƯỚC mọi script cần dùng các hàm trên.

### `js/data.js`
**Nhiệm vụ duy nhất:** Fetch dữ liệu từ Supabase và nạp vào `window.GAMES`.
Exports:
window.GAMES        — mảng object game (camelCase)
window.GAMES_READY  — Promise, resolve khi fetch xong
Mapping Supabase → window.GAMES:
g.youtube_url → youtubeUrl
g.hero_bg     → heroBg
g.categories  → categories (array)
g.setup/turn/tips/images → giữ nguyên (array)
Lưu ý: Phải await GAMES_READY trước khi dùng window.GAMES

### `js/app.js`
**Nhiệm vụ:** Router hash-based + toàn bộ render UI frontend.
Hàm quan trọng:
routeFromHash()     — đọc location.hash, gọi loadPage() + setActive()
loadPage(name)      — fetch pages/{name}.html vào #app
renderGrid()        — render danh sách game theo filter + search
renderDetail(idx)   — render trang chi tiết game[idx]
renderDailyPick()   — chọn ngẫu nhiên 3 game, render card gợi ý
goDetail(idx)       — chuyển sang trang detail game[idx]
goList()            — quay về list
openLb(url, cap)    — mở lightbox ảnh
saveUsernameSettings() — đọc input settings, lưu localStorage
State: activeFilter, searchQ, currentIdx
Phụ thuộc: window.GAMES, window.GAMES_READY (từ data.js)

### `js/chat.js`
**Nhiệm vụ:** Chat realtime + quản lý online users + analytics (Firebase, phía khách).
Firebase paths:
communityChat/           — tin nhắn chat
onlineUsers/{id}         — presence (tự xóa khi disconnect)
analytics/gameViews/...  — lượt xem từng game theo ngày
analytics/hourly/...     — peak online theo giờ/ngày
Hàm quan trọng:
saveUsername() / sendMessage() / buildMessageEl(msg)
clearChatIfNewDay()   — reset chat khi sang ngày mới
window.__fbTrack(...) — ghi lượt xem game (gọi từ app.js)
window.updateChatUsername(name) — được gọi từ app.js khi đổi tên trong Settings
Lưu ý: ES Module (type="module")

### `admin/login.html`
**Tự chứa toàn bộ logic** (không file JS riêng, không đổi so với trước).
Flow:

Kiểm tra sessionStorage → nếu có session → redirect dashboard ngay
Nhập username + password → sha256(password) bằng Web Crypto API
SELECT từ admin_users WHERE username = ? → so sánh password_hash
Đúng → lưu session, hiện progress bar, redirect sau 1.7s

Session object: { id, username, displayName, role, loginAt }

### `admin/dashboard.html`
**Nhiệm vụ:** CHỈ còn HTML shell — sidebar, 3 page tĩnh (Dashboard/Boardgames/Drinks),
game modal, drink modal. KHÔNG còn `<script>` chứa logic nghiệp vụ.
Load theo đúng thứ tự (rất quan trọng):

shared-config.js / shared-emoji.js / shared-utils.js / Supabase SDK
core/dashboard-auth.js            → tạo client + currentSession
core/dashboard-page-registry.js   → tạo window.AdminDashboard
modules/dashboard-games.js        → CRUD game (cần client + AdminDashboard KHÔNG bắt buộc)
modules/dashboard-drinks.js       → CRUD đồ uống
core/dashboard-nav.js             → điều hướng 3 page tĩnh, dùng loadGames()/loadDrinks()
modules/*.js (type="module")      → chat, analytics, banners, media, accounts
— mỗi module tự registerPage()
dashboard-mobile-menu.js          → cuối cùng, cần .sidebar đã tồn tại


### `admin/core/dashboard-auth.js`
**Nhiệm vụ:** Auth guard + Supabase client dùng chung + user bar. Chạy đầu tiên trong chuỗi script admin.
requireAuth()  — đọc sessionStorage, redirect login.html nếu không hợp lệ (throw để chặn script sau)
logout()       — xóa session, redirect login.html
Global (KHÔNG cần import, mọi script admin đọc được qua top-level scope):
const client         — Supabase client
const currentSession — { id, username, displayName, role, loginAt }
Tự động inject User bar (avatar, tên, vai trò, nút đăng xuất) vào cuối .sidebar

### `admin/core/dashboard-page-registry.js`
**Nhiệm vụ:** Nơi DUY NHẤT quản lý hiện/ẩn page trong `.main-content` + tạo menu item sidebar.
Thay thế cho 5 IIFE polling gần giống hệt nhau ở bản cũ (mỗi module tự dò `.menu-group`).
window.AdminDashboard.registerPage({
pageId,             // id của <div> page trong .main-content
menuId,             // id của menu item sẽ tạo
icon, label,        // hiển thị trên menu item
badgeHtml,          // HTML phụ (vd: badge unread số tin chưa đọc)
group,              // index .menu-group (mặc định 1 = "Quản trị")
placeholderId,      // nếu HTML đã có sẵn placeholder (vd: #chatMenuItemPlaceholder)
insertBeforeMenuId, // chèn trước 1 menu item cụ thể (mặc định: trước "Settings")
onShow,             // callback chạy mỗi khi mở trang (vd loadAnalytics())
guard,              // hàm trả về true/false — false thì KHÔNG đăng ký (vd chỉ superadmin)
})
window.AdminDashboard.showPage(pageId, menuId, onShow)
window.__showPage(pageId)  — bản rút gọn, tương thích ngược cho code cũ

### `admin/core/dashboard-nav.js`
**Nhiệm vụ:** Điều hướng cho 3 page TĨNH có sẵn trong `dashboard.html` (Dashboard, Boardgames, Drinks).
Các page ĐỘNG (chat/analytics/banners/media/accounts) tự đăng ký qua `registerPage()` ở module riêng, KHÔNG nằm trong file này.
showDashboard()                — hiện Dashboard page
toggleBgMenu() / showBoardgames(mode) — mở/đóng submenu + hiện trang Boardgames, mode: 'all' | 'search'
openAddGame()                  — mở modal thêm game trực tiếp từ sidebar
toggleDrinkMenu() / showDrinks(cat)   — mở/đóng submenu + hiện trang Drinks theo loại
filterDrinks(cat, btnEl)       — lọc drink grid theo tab (không đổi trang)
syncOnlineCountToDashboard()   — dùng MutationObserver mirror #adminOnlineCount → #dashOnlineCount

### `admin/modules/dashboard-games.js`
**Nhiệm vụ:** CRUD Boardgames (bảng `games`) + emoji picker. Đổi tên từ `admin/dashboard.js` cũ,
đã bỏ phần auth + user bar (chuyển sang `core/dashboard-auth.js`).
loadGames() / renderGames() / saveGame() / deleteGame() / clearForm()
Emoji Picker: openPicker()/closePicker()/buildCategoryTabs()/renderEmojiGrid()/selectEmoji()
Helpers: parseLines(id), parseImages(id), setLines(id,arr), setImages(id,arr)
Expose ra window: window.loadGames (dùng bởi core/dashboard-nav.js)
Cần: client (từ core/dashboard-auth.js), window.escHtml (từ shared-utils.js)

### `admin/modules/dashboard-drinks.js`
**Nhiệm vụ:** CRUD Đồ uống (bảng `drinks`). MỚI tách ra từ khối `<script>` inline
trong `admin/dashboard.html` bản cũ — nay cùng chuẩn file riêng như các module khác.
loadDrinks() / renderDrinkGrid() / openAddDrink() / editDrink(id) / saveDrink() / deleteDrink()
Helper: parseDrinkLines(id)
State: window.activeDrinkFilter (đọc/ghi bởi core/dashboard-nav.js qua filterDrinks())
Expose ra window: loadDrinks, renderDrinkGrid, openAddDrink, editDrink, saveDrink, deleteDrink
Cần: client, window.escHtml, window.showToast

### `admin/modules/dashboard-chat.js`
**Nhiệm vụ:** Module chat dành riêng cho admin (ES module — Firebase).
Tự đăng ký qua: window.AdminDashboard.registerPage({
pageId: "chatAdminPage", menuId: "chatMenuItem",
placeholderId: "chatMenuItemPlaceholder", onShow: openChatPage, ...
})
State: unreadCount, chatPageOpen, allMessages[], tagAlerts[] (tối đa 20)
TAG_PATTERN: /@thecoffeequest|@the\scoffee\squest|@quán|@quan|@staff|@admin/i
Hàm quan trọng:
openChatPage() / closeChatPage()
sendStaffMessage()  — push với isStaff:true, staffName từ session
buildMsgEl(msg)     — render bubble (phân biệt staff/khách/tag)
addTagAlert(msg) / pushNotification() — browser Notification API
Dùng window.escHtml / window.formatTime / window.showToast (KHÔNG tự định nghĩa lại)
Firebase: dùng lại app đã init nếu có, fallback init mới

### `admin/modules/dashboard-analytics.js`
**Nhiệm vụ:** Thống kê lượt xem game & giờ cao điểm online (ES module — Firebase + Canvas thuần).
Tự đăng ký qua registerPage({ pageId: "analyticsPage", menuId: "analyticsMenuItem", onShow: loadAnalytics })
setAnalyticsRange('today'|'7days'|'custom', btn) — đổi khoảng ngày
loadAnalytics()          — fetch song song gameViews + hourly, render tất cả
renderSummaryCards() / renderGameChart() / renderHourlyChart() / renderDetailTable()
Biểu đồ vẽ bằng Canvas API thuần, không dùng thư viện ngoài
Tự redraw khi resize window (debounce 300ms)

### `admin/modules/dashboard-banners.js`
**Nhiệm vụ:** Quản lý 2 banner hiển thị ở trang News (ES module — Supabase bảng `site_settings`).
Tự đăng ký qua registerPage({ pageId: "bannersPage", menuId: "bannersMenuItem" })
loadBanners() / renderBannerList() / attachBannerEvents() / window.saveBanners()
Toggle switch hiện/ẩn từng banner, live preview khi nhập URL
Lưu dạng JSON { url, visible } vào cột value của site_settings

### `admin/modules/dashboard-media.js`
**Nhiệm vụ:** Thư viện media/ảnh dùng làm banner/poster (ES module — Supabase bảng `media_library`).
Tự đăng ký qua registerPage({
pageId: "mediaPage", menuId: "mediaMenuItem", insertBeforeMenuId: "chatMenuItem"
})
loadMedia() / renderMediaGrid() / renderTagFilters()
window.addMedia() / deleteMedia(id) / copyMediaLink(url) / downloadMedia(url, label)
convertGDriveUrl(url) — tự nhận diện & chuyển link Google Drive sang link ảnh trực tiếp
fetchMediaSize(url)   — best-effort đo dung lượng ảnh qua HEAD request
Quyền: mọi tài khoản thêm được, chỉ superadmin (currentSession.role) mới xóa được

### `admin/modules/dashboard-accounts.js`
**Nhiệm vụ:** Quản lý tài khoản quản trị (ES module — Supabase bảng `admin_users`, chỉ superadmin).
Tự đăng ký qua registerPage({
pageId: "accountsPage", menuId: "accountsMenuItem",
guard: () => isSuperAdmin,   // KHÔNG đăng ký page/menu nếu không phải superadmin
onShow: loadAccounts,
})
loadAccounts() / renderAccountsTable() / openAddAccount() / openEditAccount(id)
saveAccount() / deleteAccount()
sha256(text) — hash mật khẩu phía client trước khi gửi lên Supabase (giống login.html)

### `admin/dashboard-mobile-menu.js`
**Nhiệm vụ:** Đóng/mở sidebar dạng off-canvas trên mobile/tablet (≤900px). KHÔNG đổi so với bản cũ.
Phải load SAU khi `.sidebar` đã tồn tại trong DOM (đặt cuối danh sách script).

### `css/style.css`
Entry point, chỉ chứa `@import` theo đúng thứ tự (variables.css load đầu, responsive.css load cuối):
base/variables.css → base/reset.css → base/header-menu.css → base/news-banner.css
→ base/boardgame-list.css → base/boardgame-detail.css → base/pages.css
→ base/modals.css → base/responsive.css

---

## 8. Database Schema

### Bảng `games` (Supabase)

| Cột | Kiểu | Ghi chú |
|---|---|---|
| `id` | bigint PK | Auto increment |
| `name` | text | Tên game |
| `emoji` | text | Ký tự emoji |
| `color` | text | Hex color, vd `#6c5ce7` |
| `categories` | jsonb | `["🎉 Party", "👨‍👩‍👧 Gia đình"]` |
| `players` | text | Vd `"2-4 người"` |
| `time` | text | Vd `"30-60 phút"` |
| `difficulty` | text | `"Dễ"` / `"Trung bình"` / `"Khó"` |
| `objective` | text | Mục tiêu game |
| `win` | text | Điều kiện thắng |
| `setup` | jsonb | `["Bước 1", "Bước 2"]` |
| `turn` | jsonb | Các bước trong lượt chơi |
| `tips` | jsonb | Mẹo chơi |
| `images` | jsonb | `[{"url":"...","caption":"..."}]` |
| `hero_bg` | text | URL ảnh nền trang detail |
| `youtube_url` | text | URL video hướng dẫn |
| `sort_order` | integer | Thứ tự hiển thị (nhỏ lên trước) |

### Bảng `drinks` (Supabase)

| Cột | Kiểu | Ghi chú |
|---|---|---|
| `id` | bigint PK | Auto increment |
| `name` | text | Tên đồ uống |
| `category` | text | `"Cà phê"` / `"Trà hoa quả"` / `"Trà sữa"` / `"Sữa chua"` |
| `emoji` | text | Ký tự emoji |
| `description` | text | Mô tả ngắn |
| `ingredients` | jsonb | `["20ml espresso", "150ml sữa"]` |
| `steps` | jsonb | Các bước pha chế |
| `tips` | jsonb | Mẹo pha chế |
| `image_url` | text | URL ảnh minh hoạ |
| `sort_order` | integer | Thứ tự hiển thị |
| `created_at` | timestamptz | Tự động điền |

### Bảng `admin_users` (Supabase)

| Cột | Kiểu | Ghi chú |
|---|---|---|
| `id` | bigint PK | |
| `username` | text | Tên đăng nhập (unique) |
| `display_name` | text | Tên hiển thị trong dashboard |
| `password_hash` | text | SHA-256 của mật khẩu |
| `role` | text | `"superadmin"` hoặc `"editor"` |
| `last_login` | timestamptz | Cập nhật mỗi lần đăng nhập |

### Bảng `media_library` (Supabase)

| Cột | Kiểu | Ghi chú |
|---|---|---|
| `id` | bigint PK | Auto increment (identity) |
| `url` | text | URL ảnh (đã tự động convert nếu là Google Drive) |
| `label` | text | Ghi chú (tuỳ chọn) |
| `tags` | text[] | VD `{"banner","noel","sukien"}` |
| `added_by` | text | Tên người thêm |
| `created_at` | timestamptz | Tự động điền |

```sql
create table if not exists media_library (
  id         bigint generated always as identity primary key,
  url        text not null,
  label      text,
  tags       text[] not null default '{}',
  added_by   text,
  created_at timestamptz not null default now()
);
```

### Bảng `site_settings` (Supabase)

| Cột | Kiểu | Ghi chú |
|---|---|---|
| `key` | text PK | `"banner_1"` / `"banner_2"` |
| `value` | text | JSON string `{"url":"...","visible":true}` |
| `updated_at` | timestamptz | |

### Firebase Realtime Database
root/
├── communityChat/
│   └── {pushId}/
│       ├── user:      string   — tên người gửi
│       ├── text:      string   — nội dung
│       ├── time:      number   — Date.now()
│       ├── isStaff:   boolean  — true nếu từ admin
│       └── staffName: string   — tên nhân viên (chỉ khi isStaff=true)
│
├── onlineUsers/
│   └── {userId}/
│       ├── name:   string
│       └── online: true
│
└── analytics/
├── gameViews/{date}/{gameId}/
│       ├── count: number
│       └── name:  string
└── hourly/{date}/{hour}/
└── peak:  number

---

## 9. Biến môi trường & cấu hình

Dự án **không dùng file `.env`** — credentials được viết thẳng trong code (phù hợp với anon key public của Supabase).

### Supabase URL & Key + Firebase Config
Nay chỉ còn **1 nơi DUY NHẤT**: `js/shared-config.js`

```js
window.APP_CONFIG = Object.freeze({
  supabaseUrl: "...",
  supabaseKey: "...",
  firebaseConfig: Object.freeze({ ... }),
});
```

Mọi file khác (`data.js`, `app.js`, `chat.js`, toàn bộ `admin/core/*.js` và `admin/modules/*.js`) đều đọc qua `window.APP_CONFIG` — **không hardcode lại**. Khi cần đổi Supabase project hoặc Firebase project, chỉ sửa đúng 1 file này.

> ⚠️ `js/shared-config.js` phải là **file đầu tiên** được load trong mọi trang (cả `index.html` và `admin/dashboard.html` / `admin/login.html`).

---

## 10. Quy trình bảo trì thường gặp

### Thêm thể loại game mới
1. Thêm `<div class="chip" data-filter="...">` vào `pages/boardgame.html`
2. Không cần sửa code khác — filter tự hoạt động

### Thêm câu trả lời nhanh cho admin chat
Sửa mảng trong `admin/modules/dashboard-chat.js`, tìm đoạn:
```js
${[
  "Xin chào! The CoffeeQuest...",
  ...
].map(t => ...)}
```

### Thêm 1 trang admin mới (module mới)
1. Tạo file `admin/modules/dashboard-xxx.js`
2. Gọi `window.AdminDashboard.registerPage({ pageId, menuId, icon, label, onShow, guard })` ở đầu file
3. Inject HTML page bằng 1 IIFE `appendChild` vào `.main-content` (theo mẫu các module khác)
4. Thêm `<script type="module" src="./modules/dashboard-xxx.js"></script>` vào cuối `admin/dashboard.html`, **sau** `core/dashboard-page-registry.js`

Không cần đụng vào `core/dashboard-nav.js` hay các module khác.

### Đổi màu chủ đạo toàn trang frontend
Sửa `--accent` trong `css/base/variables.css`

### Đổi màu chủ đạo dashboard admin
Sửa `--primary` trong `admin/dashboard.css` mục `RESET & BASE`

### Thêm admin user mới
Chạy SQL trong Supabase SQL Editor:
```sql
INSERT INTO admin_users (username, display_name, password_hash, role)
VALUES (
  'ten_dang_nhap',
  'Tên Hiển Thị',
  -- Lấy hash bằng: https://emn178.github.io/online-tools/sha256.html
  'sha256_cua_mat_khau',
  'editor'   -- hoặc 'superadmin'
);
```

### Đổi banner trang News
Vào Admin → **🖼️ Banners** → dán URL ảnh mới → **💾 Lưu thay đổi** (khuyến khích thay vì sửa file tĩnh).

### Chat bị đầy / cần reset thủ công
Trong Admin Dashboard → **💬 Cộng đồng** → nút **🗑️ Xóa chat hôm nay**

Hoặc trực tiếp trong Firebase Console → xóa node `communityChat`

---

## 11. Hệ thống Page Registry (Admin)

Đây là phần kiến trúc quan trọng nhất của bản refactor — đáng để hiểu kỹ trước khi sửa bất kỳ module admin nào.

### Vấn đề trước đây
Mỗi module (`chat`, `analytics`, `banners`, `media`, `accounts`) tự viết 1 IIFE riêng để:
- `setTimeout` polling chờ `.menu-group` xuất hiện trong DOM
- Tự tìm menu item có text `"Settings"` để chèn trước nó
- Tự định nghĩa lại `window.__showPage` (ẩn/hiện các page)

→ 5 bản gần giống hệt nhau, dễ lệch nhau khi sửa 1 chỗ quên sửa chỗ khác.

### Giải pháp: `admin/core/dashboard-page-registry.js`

```js
window.AdminDashboard.registerPage({
  pageId,             // id của <div> page trong .main-content
  menuId,             // id sẽ gán cho menu item
  icon, label,        // hiển thị trên menu item
  badgeHtml,          // (tuỳ chọn) HTML thêm vào cuối menu item, vd badge số
  group,              // (tuỳ chọn) index .menu-group, mặc định 1 = "Quản trị"
  placeholderId,      // (tuỳ chọn) nâng cấp <a id="..."> có sẵn thay vì tạo mới
  insertBeforeMenuId, // (tuỳ chọn) chèn trước menu item cụ thể; mặc định trước "Settings"
  onShow,             // (tuỳ chọn) callback chạy mỗi lần trang được mở
  guard,              // (tuỳ chọn) hàm trả về boolean — false thì KHÔNG đăng ký
});
```

Mỗi module chỉ cần gọi hàm này **1 lần** ở đầu file — không cần polling, không cần tự tìm `.menu-group`, không cần tự viết lại logic ẩn/hiện page.

### Ví dụ thực tế — 3 kiểu dùng khác nhau

**1. Trang đơn giản** (`dashboard-banners.js`):
```js
window.AdminDashboard.registerPage({
  pageId: "bannersPage",
  menuId: "bannersMenuItem",
  icon: "🖼️",
  label: "Banners",
});
```

**2. Trang có placeholder sẵn trong HTML + badge động** (`dashboard-chat.js`):
```js
window.AdminDashboard.registerPage({
  pageId: "chatAdminPage",
  menuId: "chatMenuItem",
  placeholderId: "chatMenuItemPlaceholder", // đã có sẵn <a> trong dashboard.html
  icon: "💬",
  label: "Cộng đồng",
  badgeHtml: `<span id="chatMenuBadge" ...></span>`,
  onShow: () => openChatPage(),
});
```

**3. Trang có điều kiện quyền hạn** (`dashboard-accounts.js`):
```js
window.AdminDashboard.registerPage({
  pageId: "accountsPage",
  menuId: "accountsMenuItem",
  icon: "👤",
  label: "Quản lý tài khoản",
  guard: () => isSuperAdmin,   // editor sẽ KHÔNG thấy mục này
  onShow: () => loadAccounts(),
});
```

### Quan hệ với `core/dashboard-nav.js`

`dashboard-nav.js` **không** dùng `registerPage()` vì 3 trang Dashboard/Boardgames/Drinks đã có sẵn menu item + submenu tĩnh trong HTML (có collapsible submenu riêng, khác cấu trúc menu item đơn giản). File này gọi thẳng `window.__showPage(pageId)` (hàm rút gọn được `page-registry.js` expose ra) để giữ hành vi ẩn/hiện page nhất quán với các trang động khác.

### Khi cần debug
- Menu item không xuất hiện → kiểm tra `guard` có trả về `true` không, và `group` có trỏ đúng `.menu-group` không (0 = "Hệ thống", 1 = "Quản trị")
- Click menu không chuyển trang → kiểm tra `pageId` có khớp với `id` của `<div>` page đã inject vào `.main-content` chưa
- Trang mở nhưng dữ liệu không load → kiểm tra `onShow` có được truyền đúng hàm chưa (phải là reference hoặc arrow function, không gọi hàm luôn lúc khai báo)

---

*Cập nhật lần cuối: 2026 — Dự án The Coffee Quest (đã refactor cấu trúc admin thành core/ + modules/)*
