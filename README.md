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

---

## 1. Tổng quan hệ thống

| Thành phần | Công nghệ | Vai trò |
|---|---|---|
| **Frontend** | HTML + CSS + Vanilla JS | Trang khách truy cập — xem game, chat |
| **Admin** | HTML + CSS + Vanilla JS | Dashboard quản trị nội bộ |
| **Database** | Supabase (PostgreSQL) | Lưu boardgames, drinks, admin_users |
| **Realtime Chat** | Firebase Realtime Database | Chat cộng đồng + đếm online |
| **Font/Style** | Google Fonts (Bebas Neue, Nunito, Inter) | Typography |

Không có backend server riêng — toàn bộ là **static files** gọi thẳng tới Supabase và Firebase từ trình duyệt.

---

## 2. Sơ đồ kiến trúc

```
┌─────────────────────────────────────────────────────────────────┐
│                        TRÌNH DUYỆT                              │
│                                                                 │
│  ┌──────────────────────────┐   ┌──────────────────────────┐   │
│  │      FRONTEND (/)        │   │   ADMIN (/admin/)         │   │
│  │                          │   │                           │   │
│  │  index.html              │   │  login.html               │   │
│  │    ├── css/style.css     │   │  dashboard.html           │   │
│  │    ├── css/chat.css      │   │    ├── dashboard.css      │   │
│  │    ├── js/data.js        │   │    ├── dashboard.js       │   │
│  │    ├── js/app.js         │   │    └── dashboard-chat.js  │   │
│  │    └── js/chat.js        │   │                           │   │
│  │                          │   │                           │   │
│  │  pages/                  │   │                           │   │
│  │    ├── news.html         │   │                           │   │
│  │    ├── boardgame.html    │   │                           │   │
│  │    ├── contact.html      │   │                           │   │
│  │    └── settings.html     │   │                           │   │
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
     │  • admin_users   │           │                   │
     └──────────────────┘           └───────────────────┘
```

### Quan hệ giữa các module

```
dashboard.html
    │
    ├── [load]──► dashboard.js          (CRUD games, CRUD drinks, auth guard)
    │
    └── [module]─► dashboard-chat.js    (chat admin, online count, Firebase)
                        │
                        └── [share Firebase app]──► js/chat.js (frontend)


index.html
    │
    ├── [load]──► js/data.js            (fetch games từ Supabase → window.GAMES)
    │
    ├── [load]──► js/app.js             (router, render UI, dùng window.GAMES)
    │                   │
    │                   └── GAMES_READY.then(routeFromHash)
    │
    └── [module]─► js/chat.js           (Firebase chat + online users)
```

---

## 3. Cấu trúc thư mục

```
project-root/
│
├── index.html                  ← Trang chủ frontend (SPA shell)
│
├── css/
│   ├── style.css               ← Toàn bộ style frontend
│   └── chat.css                ← Style riêng cho widget chat nổi
│
├── js/
│   ├── data.js                 ← Fetch games từ Supabase, export window.GAMES
│   ├── app.js                  ← Router, render list/detail, daily pick, lightbox
│   ├── chat.js                 ← Chat Firebase, online users, emoji picker
│   └── router.js               ← (legacy, không dùng — logic đã chuyển vào app.js)
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
    ├── login.html              ← Trang đăng nhập admin (SHA-256 + Supabase)
    ├── dashboard.html          ← Shell dashboard: sidebar + các page section
    ├── dashboard.css           ← Style toàn bộ dashboard
    ├── dashboard.js            ← Auth guard, CRUD games, CRUD drinks, emoji picker
    └── dashboard-chat.js       ← Module chat admin (ES module, inject vào dashboard)
```

---

## 4. Luồng dữ liệu

### 4.1 Tải danh sách game (Frontend)

```
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
```

### 4.2 Chat realtime

```
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
```

### 4.3 Admin đăng nhập

```
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

dashboard.js (dòng đầu tiên)
    │  requireAuth() → đọc sessionStorage
    └── không có session → redirect login.html (chặn toàn bộ script)
```

### 4.4 Admin gửi tin chat

```
dashboard-chat.js
    │  push(communityChat, { user, text, time, isStaff: true, staffName })
    │
    ▼  (realtime onChildAdded trên frontend)
js/chat.js → buildMessageEl({ isStaff: true })
    → render bubble màu tối + badge "☕ THE COFFEEQUEST"
```

---

## 5. Hướng dẫn sử dụng — Frontend (khách)

### Điều hướng
- Menu hamburger `☰` ở góc trên trái → mở side menu
- Các mục: **Tin tức**, **Luật Boardgame**, **Thông tin liên hệ**, **Cài đặt**

### Trang Tin tức (News)
- Hiển thị các banner quảng bá
- Phần **"Hôm nay chơi gì?"** chọn ngẫu nhiên 1 game mỗi lần tải trang
- Nhấn **"Thử game khác"** để random lại
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

### Chat Cộng đồng
Mở từ sidebar → **💬 Cộng đồng**

- Xem toàn bộ lịch sử chat của khách
- Gửi tin với tư cách **THE COFFEEQUEST** (hiển thị bubble tối trên client)
- Sidebar phải: **Tag quán** — tự động bắt các tin nhắn có `@thecoffeequest`, `@quán`...
- **Trả lời nhanh**: click để đưa câu trả lời mẫu vào ô nhập, chỉnh sửa rồi gửi
- **Xóa chat hôm nay**: xóa toàn bộ lịch sử (không hoàn tác)
- Badge đỏ trên menu = có tin nhắn mới chưa đọc
- Thông báo trình duyệt (nếu đã cho phép): hiện khi có tin nhắn mới mà đang ở tab khác

---

## 7. Chú thích từng file

### `js/data.js`
**Nhiệm vụ duy nhất:** Fetch dữ liệu từ Supabase và nạp vào `window.GAMES`.

```
Exports:
  window.GAMES        — mảng object game (camelCase)
  window.GAMES_READY  — Promise, resolve khi fetch xong

Mapping Supabase → window.GAMES:
  g.youtube_url → youtubeUrl
  g.hero_bg     → heroBg
  g.categories  → categories (array)
  g.setup/turn/tips/images → giữ nguyên (array)

Lưu ý: Phải await GAMES_READY trước khi dùng window.GAMES
```

### `js/app.js`
**Nhiệm vụ:** Router hash-based + toàn bộ render UI frontend.

```
Hàm quan trọng:
  routeFromHash()     — đọc location.hash, gọi loadPage() + setActive()
  loadPage(name)      — fetch pages/{name}.html vào #app
  renderGrid()        — render danh sách game theo filter + search
  renderDetail(idx)   — render trang chi tiết game[idx]
  renderDailyPick()   — chọn ngẫu nhiên 1 game, render card gợi ý
  goDetail(idx)       — chuyển sang trang detail game[idx]
  goList()            — quay về list
  openLb(url, cap)    — mở lightbox ảnh
  saveUsernameSettings() — đọc input settings, lưu localStorage

State:
  activeFilter        — thể loại đang lọc
  searchQ             — từ khóa tìm kiếm
  currentIdx          — index game đang xem detail

Phụ thuộc:
  window.GAMES, window.GAMES_READY  (từ data.js)
```

### `js/chat.js`
**Nhiệm vụ:** Chat realtime + quản lý online users (Firebase).

```
Firebase paths:
  communityChat/    — tin nhắn chat
  onlineUsers/{id}  — presence (tự xóa khi disconnect)

Hàm quan trọng:
  saveUsername()       — lưu tên vào localStorage
  sendMessage()        — push lên Firebase
  buildMessageEl(msg)  — tạo DOM element cho 1 tin nhắn
  clearChatIfNewDay()  — kiểm tra ngày, reset nếu sang ngày mới
  showUnreadDot()      — chấm vàng trên nút chat
  formatTime(ts)       — timestamp → "HH:MM"

window.updateChatUsername(name) — được gọi từ app.js khi đổi tên trong Settings

Lưu ý: ES Module (type="module"), Firebase SDK import từ CDN ESM
```

### `admin/dashboard.js`
**Nhiệm vụ:** Auth guard + toàn bộ logic CRUD cho games và drinks.

```
Chạy ngay khi load:
  requireAuth()   — kiểm tra sessionStorage, redirect login nếu không hợp lệ

CRUD Games (Supabase bảng 'games'):
  loadGames()     — fetch + render bảng + update stats
  renderGames()   — vẽ tbody của bảng
  saveGame()      — INSERT hoặc UPDATE tùy có gameId không
  deleteGame()    — DELETE theo id
  clearForm()     — reset toàn bộ input trong modal

CRUD Drinks (Supabase bảng 'drinks') — trong dashboard.html:
  loadDrinks()    — fetch + render grid
  renderDrinkGrid()— filter theo activeDrinkFilter, vẽ card
  saveDrink()     — INSERT hoặc UPDATE
  deleteDrink()   — DELETE
  editDrink(id)   — điền form modal từ data

Helpers:
  parseLines(id)      — textarea → string[]
  parseImages(id)     — textarea "url | caption" → [{url,caption}]
  setLines(id, arr)   — ngược lại parseLines
  setImages(id, arr)  — ngược lại parseImages
  showToast(msg, bg)  — toast notification góc phải

Emoji Picker:
  openPicker() / closePicker()
  buildCategoryTabs()
  renderEmojiGrid(list)
  selectEmoji(emoji)
```

### `admin/dashboard-chat.js`
**Nhiệm vụ:** Module chat dành riêng cho admin, inject UI vào dashboard.

```
Tự động inject (IIFE chạy khi load):
  - Menu item "💬 Cộng đồng" vào sidebar đầu tiên
  - Trang #chatAdminPage vào .main-content

State:
  unreadCount     — số tin chưa đọc (reset khi mở trang chat)
  chatPageOpen    — boolean, đang ở trang chat hay không
  allMessages[]   — cache tin nhắn
  tagAlerts[]     — danh sách tin có tag quán (tối đa 20)

TAG_PATTERNS: /@thecoffeequest|@the\s*coffee\s*quest|@quán|@quan|@staff|@admin/i

Hàm quan trọng:
  openChatPage()      — ẩn dashboard content, hiện chat page
  closeChatPage()     — ngược lại
  sendStaffMessage()  — push với isStaff:true, staffName từ session
  buildMsgEl(msg)     — render bubble (phân biệt staff/khách/tag)
  addTagAlert(msg)    — thêm vào sidebar tag alerts
  pushNotification()  — browser Notification API

Firebase: dùng lại app đã init trong data.js nếu có, fallback init mới
```

### `admin/login.html`
**Tự chứa toàn bộ logic** (không file JS riêng).

```
Flow:
  1. Kiểm tra sessionStorage → nếu có session → redirect dashboard ngay
  2. User nhập username + password
  3. sha256(password) bằng Web Crypto API
  4. SELECT từ admin_users WHERE username = ?
  5. So sánh password_hash
  6. Đúng → lưu session, hiện progress bar, redirect sau 1.7s

Session object:
  { id, username, displayName, role, loginAt }
```

### `css/style.css`
Có **mục lục 17 section** bằng comment ở đầu file. Khi sửa style, tìm theo mục lục:

```
1.  CSS VARIABLES    ← Đổi màu/font toàn trang TẠI ĐÂY
2.  RESET & BASE
3.  HEADER
4.  SIDE MENU
5.  BANNER
6.  DAILY PICK
7.  LIST PAGE
8.  GAME CARD
9.  DETAIL PAGE
10. RELATED GAMES
11. CONTACT PAGE
12. SETTINGS PAGE
13. USERNAME MODAL
14. LIGHTBOX
15. FOOTER
16. ANIMATIONS
17. RESPONSIVE
```

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

### Firebase Realtime Database

```
root/
├── communityChat/
│   └── {pushId}/
│       ├── user:      string   — tên người gửi
│       ├── text:      string   — nội dung
│       ├── time:      number   — Date.now()
│       ├── isStaff:   boolean  — true nếu từ admin
│       └── staffName: string   — tên nhân viên (chỉ khi isStaff=true)
│
└── onlineUsers/
    └── {userId}/
        ├── name:   string
        └── online: true
```

---

## 9. Biến môi trường & cấu hình

Dự án **không dùng file `.env`** — credentials được viết thẳng trong code (phù hợp với anon key public của Supabase). Khi cần thay đổi, sửa tại các vị trí sau:

### Supabase URL & Key
Xuất hiện ở **4 nơi**, tất cả phải thay cùng lúc:

| File | Vị trí |
|---|---|
| `js/data.js` | Đầu file, `SUPABASE_URL` và `SUPABASE_KEY` |
| `admin/dashboard.js` | Đầu file, `SUPABASE_URL` và `SUPABASE_KEY` |
| `admin/login.html` | Trong `<script>`, `SUPABASE_URL` và `SUPABASE_KEY` |
| `admin/dashboard.html` | Không có (dùng biến `client` từ dashboard.js) |

### Firebase Config
Xuất hiện ở **2 nơi**:

| File | Vị trí |
|---|---|
| `js/chat.js` | Object `firebaseConfig` |
| `admin/dashboard-chat.js` | Object `firebaseConfig` |

---

## 10. Quy trình bảo trì thường gặp

### Thêm thể loại game mới
1. Thêm `<div class="chip" data-filter="...">` vào `pages/boardgame.html`
2. Không cần sửa code khác — filter tự hoạt động

### Thêm câu trả lời nhanh cho admin chat
Sửa mảng trong `admin/dashboard-chat.js`, tìm đoạn:
```js
${[
  "Xin chào! The CoffeeQuest...",
  ...
].map(t => ...)}
```

### Đổi màu chủ đạo toàn trang frontend
Sửa `--accent` trong `css/style.css` mục **1. CSS VARIABLES**

### Đổi màu chủ đạo dashboard admin
Sửa `--primary` trong `admin/dashboard.css` mục **RESET & BASE**

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
Thay file ảnh trong `assets/img/` và cập nhật đường dẫn trong `pages/news.html`

### Chat bị đầy / cần reset thủ công
Trong Admin Dashboard → **💬 Cộng đồng** → nút **🗑️ Xóa chat hôm nay**

Hoặc trực tiếp trong Firebase Console → xóa node `communityChat`

---

*Cập nhật lần cuối: 2026 — Dự án The Coffee Quest*
