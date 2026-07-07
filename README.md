# ☕ The Coffee Quest — Tài liệu dự án (v2 — sau tái cấu trúc)

> **Mục đích file này:** Hướng dẫn sử dụng hệ thống, sơ đồ kiến trúc code, và chú thích từng file — phản ánh đúng cấu trúc **sau khi tái cấu trúc** (xem `MIGRATION_NOTES.md` để biết lịch sử thay đổi so với bản trước).

---

## Mục lục

1. [Tổng quan hệ thống](#1-tổng-quan-hệ-thống)
2. [Nguyên tắc kiến trúc](#2-nguyên-tắc-kiến-trúc)
3. [Sơ đồ kiến trúc](#3-sơ-đồ-kiến-trúc)
4. [Cấu trúc thư mục](#4-cấu-trúc-thư-mục)
5. [Luồng dữ liệu](#5-luồng-dữ-liệu)
6. [Hướng dẫn sử dụng — Frontend](#6-hướng-dẫn-sử-dụng--frontend)
7. [Hướng dẫn sử dụng — Admin Dashboard](#7-hướng-dẫn-sử-dụng--admin-dashboard)
8. [Chú thích từng file](#8-chú-thích-từng-file)
9. [Database Schema](#9-database-schema)
10. [Biến môi trường & cấu hình](#10-biến-môi-trường--cấu-hình)
11. [Hệ thống Page Registry (Admin)](#11-hệ-thống-page-registry-admin)
12. [Domain Membership — kiến trúc chi tiết](#12-domain-membership--kiến-trúc-chi-tiết)
13. [Checklist: thêm 1 module admin mới](#13-checklist-thêm-1-module-admin-mới)
14. [Quy trình bảo trì thường gặp](#14-quy-trình-bảo-trì-thường-gặp)

---

## 1. Tổng quan hệ thống

| Thành phần | Công nghệ | Vai trò |
|---|---|---|
| **Frontend** | HTML + CSS + Vanilla JS | Trang khách — xem game, chat, tra cứu thẻ thành viên |
| **Admin** | HTML + CSS + Vanilla JS (module hóa theo domain) | Dashboard quản trị nội bộ |
| **Database** | Supabase (PostgreSQL) | games, drinks, admin_users, media_library, site_settings, customers, quests, membership_levels... |
| **Realtime Chat** | Firebase Realtime Database | Chat cộng đồng + đếm online + analytics |

Không có backend server riêng — toàn bộ là static files gọi thẳng Supabase/Firebase từ trình duyệt. Không dùng bundler — thứ tự nạp `<script>` là thủ công và **bắt buộc chính xác** (xem mục 4 và 13).

---

## 2. Nguyên tắc kiến trúc

Toàn bộ `admin/` tuân thủ 4 nguyên tắc sau — **mọi module mới đều phải tuân theo**, không có ngoại lệ:

1. **1 domain = 1 thư mục.** `admin/modules/{domain}/` chứa mọi file JS của domain đó (games, drinks, membership, chat, analytics, banners, media, accounts). Domain nhiều hơn 1 tính năng con (như Membership) thì tách nhiều file trong cùng thư mục, không gộp chung 1 file khổng lồ.
2. **HTML/modal luôn JS-inject, không bao giờ tĩnh trong `dashboard.html`.** Mỗi module tự `document.body.appendChild(...)` hoặc `.main-content.appendChild(...)` HTML của mình trong 1 IIFE chạy lúc file load. `dashboard.html` chỉ là **shell**: sidebar + 3 page tĩnh (Dashboard/Boardgames/Drinks) + danh sách `<script>`.
3. **CSS dùng chung nằm trong file `.css`, không nằm trong `<style>` inline của HTML.** CSS riêng của 1 module (nếu cần) cũng tự inject bằng `injectXStyles()` giống `dashboard-media.js`.
4. **Không dùng `onclick=""`/`oninput=""` inline khi có thể dùng `addEventListener`.** Ngoại lệ duy nhất được chấp nhận: các nút điều hướng cấp cao gọi thẳng hàm toàn cục ổn định từ `core/dashboard-nav.js` (`showDashboard()`, `showBoardgames()`, `showDrinks()`, `filterDrinks()`) — vì các hàm này không đổi tên/tham số thường xuyên và việc giữ `onclick=""` ở đây giúp `dashboard.html` dễ đọc luồng điều hướng ngay trong markup.

---

## 3. Sơ đồ kiến trúc

```
┌─────────────────────────────────────────────────────────────────┐
│                        TRÌNH DUYỆT                              │
│                                                                 │
│  ┌──────────────────────────┐   ┌──────────────────────────┐   │
│  │      FRONTEND (/)        │   │   ADMIN (/admin/)         │   │
│  │                          │   │                           │   │
│  │  index.html              │   │  login.html               │   │
│  │    ├── css/style.css     │   │  dashboard.html (shell)   │   │
│  │    ├── css/chat.css      │   │    ├── dashboard.css      │   │
│  │    ├── js/shared-*.js    │   │    ├── dashboard-shared.css
│  │    ├── js/data.js        │   │    ├── core/              │   │
│  │    ├── js/app.js         │   │    │   ├── dashboard-permissions.js
│  │    ├── js/membership.js  │   │    │   ├── dashboard-auth.js
│  │    └── js/chat.js        │   │    │   ├── dashboard-page-registry.js
│  │                          │   │    │   └── dashboard-nav.js
│  │  pages/                  │   │    └── modules/            │   │
│  │    ├── news.html         │   │        ├── games/          │   │
│  │    ├── boardgame.html    │   │        ├── drinks/         │   │
│  │    ├── contact.html      │   │        ├── membership/     │   │
│  │    ├── settings.html     │   │        ├── chat/           │   │
│  │    └── membership.html   │   │        ├── analytics/      │   │
│  │                          │   │        ├── banners/        │   │
│  │                          │   │        ├── media/          │   │
│  │                          │   │        └── accounts/       │   │
│  └──────────┬───────────────┘   └──────────┬────────────────┘   │
│             │                              │                     │
└─────────────┼──────────────────────────────┼─────────────────────┘
              │                              │
    ┌─────────▼────────┐           ┌─────────▼────────┐
    │    SUPABASE       │           │    FIREBASE       │
    │  (PostgreSQL)      │           │ Realtime Database │
    │                    │           │                   │
    │  • games           │           │  • communityChat  │
    │  • drinks          │           │  • onlineUsers    │
    │  • admin_users     │           │  • analytics/      │
    │  • media_library    │           │      gameViews     │
    │  • site_settings    │           │      hourly        │
    │  • customers        │           └───────────────────┘
    │  • quests           │
    │  • membership_levels│
    │  • customer_*        │
    └──────────────────────┘
```

### Quan hệ giữa các module — Admin (thứ tự nạp thật, khớp `<script>` trong `dashboard.html`)

```
dashboard.html (shell — KHÔNG còn modal HTML, KHÔNG còn <style> inline)
│
├── [load]──► js/shared-config.js
├── [load]──► js/shared-emoji.js
├── [load]──► js/shared-categories.js
├── [load]──► js/shared-utils.js
├── [load]──► core/dashboard-permissions.js      (window.AdminPermissions)
├── [load]──► Supabase SDK (CDN) + QRCode SDK (CDN)
│
├── [load]──► core/dashboard-auth.js             (client + currentSession)
├── [load]──► core/dashboard-page-registry.js    (window.AdminDashboard)
│
├── [load]──► modules/games/dashboard-games.js
│                 └── tự inject #gameModal vào <body>
├── [load]──► modules/drinks/dashboard-drinks.js
│                 └── tự inject #drinkModal vào <body>
├── [load]──► modules/games/dashboard-game-detail.js
│                 └── cần games/parseLines/... từ dashboard-games.js (load trước)
│
├── [load]──► modules/membership/membership-shared.js   (window.Membership — PHẢI load trước 3 file dưới)
├── [load]──► modules/membership/dashboard-customers.js (registerPage() — DUY NHẤT cho domain này)
├── [load]──► modules/membership/dashboard-quests.js     (render vào tab có sẵn)
├── [load]──► modules/membership/dashboard-levels.js     (render vào tab có sẵn)
│
├── [load]──► core/dashboard-nav.js              (showDashboard/showBoardgames/showDrinks)
│
├── [module]─► modules/chat/dashboard-chat.js
├── [module]─► modules/analytics/dashboard-analytics.js
├── [module]─► modules/banners/dashboard-banners.js
├── [module]─► modules/media/dashboard-media.js
├── [module]─► modules/accounts/dashboard-accounts.js
│
└── [load]──► dashboard-mobile-menu.js           (cuối cùng — cần .sidebar đã có trong DOM)
```

### Frontend
```
index.html
│
├── [load]──► js/shared-config.js
├── [load]──► js/shared-emoji.js
├── [load]──► js/shared-categories.js
├── [load]──► js/shared-utils.js
├── [load]──► js/data.js            (fetch games từ Supabase → window.GAMES)
├── [load]──► js/app.js             (router + render game/lightbox/daily-pick — KHÔNG còn logic Membership)
├── [load]──► js/membership.js      (logic trang Thẻ thành viên — expose window.initMembership)
│
└── [module]─► js/chat.js           (Firebase chat + online users)
```

---

## 4. Cấu trúc thư mục

```
project-root/
├── index.html
├── README.md
├── MIGRATION_NOTES.md               ← lịch sử tái cấu trúc, so sánh trước/sau
│
├── css/
│   ├── style.css
│   ├── chat.css
│   └── base/
│       ├── variables.css
│       ├── reset.css
│       ├── header-menu.css
│       ├── news-banner.css
│       ├── boardgame-list.css
│       ├── boardgame-detail.css
│       ├── pages.css                (Contact + Settings + Membership)
│       ├── modals.css
│       └── responsive.css
│
├── js/
│   ├── shared-config.js
│   ├── shared-emoji.js
│   ├── shared-categories.js
│   ├── shared-utils.js
│   ├── data.js
│   ├── app.js                       ← CHỈ router + render game/lightbox/daily-pick
│   ├── membership.js                ← MỚI: logic trang Thẻ thành viên (tách khỏi app.js)
│   └── chat.js
│
├── pages/
│   ├── news.html
│   ├── boardgame.html
│   ├── contact.html
│   ├── settings.html
│   └── membership.html
│
└── admin/
    ├── login.html
    ├── dashboard.html                ← SHELL THUẦN: sidebar + 3 page tĩnh + script tags
    ├── dashboard.css
    ├── dashboard-shared.css          ← MỚI: toàn bộ CSS từng inline trong dashboard.html
    ├── dashboard-mobile-menu.js
    │
    ├── core/
    │   ├── dashboard-permissions.js
    │   ├── dashboard-auth.js
    │   ├── dashboard-page-registry.js
    │   └── dashboard-nav.js
    │
    └── modules/                      ← nhóm theo DOMAIN, mỗi thư mục con = 1 tính năng độc lập
        ├── games/
        │   ├── dashboard-games.js        (CRUD + emoji picker + tự inject modal)
        │   └── dashboard-game-detail.js  (trang chi tiết + QR)
        ├── drinks/
        │   └── dashboard-drinks.js       (CRUD + tự inject modal)
        ├── membership/
        │   ├── membership-shared.js      (state + helper dùng chung — load ĐẦU TIÊN trong domain)
        │   ├── dashboard-customers.js    (bảng khách hàng, check-in, giao dịch — registerPage() DUY NHẤT)
        │   ├── dashboard-quests.js       (tab Nhiệm vụ)
        │   └── dashboard-levels.js       (tab Cấp độ)
        ├── chat/
        │   └── dashboard-chat.js
        ├── analytics/
        │   └── dashboard-analytics.js
        ├── banners/
        │   └── dashboard-banners.js
        ├── media/
        │   └── dashboard-media.js
        └── accounts/
            └── dashboard-accounts.js
```

> **Quy ước:** `core/` chứa hạ tầng mọi module admin phụ thuộc vào (auth, permissions, page registry, nav 3 trang tĩnh). `modules/{domain}/` chứa từng tính năng nghiệp vụ độc lập theo domain — muốn thêm/bớt tính năng chỉ cần thêm/xóa 1 thư mục con + dòng `<script>` tương ứng, không đụng module khác.

---

## 5. Luồng dữ liệu

### 5.1 Frontend — tải danh sách game
```
index.html load → js/data.js → window.GAMES / window.GAMES_READY
                → js/app.js → GAMES_READY.then(routeFromHash)
```

### 5.2 Frontend — trang Thẻ thành viên (MỚI: tách riêng khỏi app.js)
```
pages/membership.html
│
▼
js/app.js::loadPage('membership')
│  gọi window.initMembership()  ← hàm thật nằm ở js/membership.js
▼
js/membership.js
│  initMembership() gắn sự kiện nút Tra cứu + Enter
│  lookupMembership() → chuẩn hoá SĐT → Supabase RPC get_membership_by_phone
▼
render thẻ hạng/XP/ưu đãi vào #member-result
```

### 5.3 Chat realtime (không đổi)
```
js/chat.js → localStorage['tcq_username'] → Firebase communityChat / onlineUsers
           → analytics/gameViews, analytics/hourly
```

### 5.4 Admin đăng nhập & khởi động (không đổi luồng, chỉ đổi đường dẫn file)
```
login.html → sha256(password) → Supabase admin_users → sessionStorage
           → redirect dashboard.html
dashboard.html → core/dashboard-auth.js → requireAuth() → client + currentSession
              → core/dashboard-page-registry.js → window.AdminDashboard
              → modules/{domain}/*.js tự đăng ký page qua registerPage()
```

### 5.5 Admin — CRUD Boardgame (modal giờ JS-inject)
```
modules/games/dashboard-games.js load
│  injectGameModal() → appendChild #gameModal vào <body> (KHÔNG còn trong dashboard.html)
│  loadGames() → Supabase games → renderGames()
│
User bấm "+ Thêm Game" / "✏️ Sửa"
│  clearForm()/fill data → modal.classList.remove('hidden')
│
User bấm "💾 Lưu" → saveGame() → Supabase insert/update → loadGames()
```

### 5.6 Admin — Membership (3 file phối hợp qua `window.Membership`)
```
modules/membership/membership-shared.js
│  window.Membership.state = { customers: [], levels: [], quests: [] }
│  window.Membership.loadCustomers()/loadLevels()/loadQuests() → cập nhật state
▼
modules/membership/dashboard-customers.js
│  registerPage({ pageId: "customersPage", onShow: load cả 3 nguồn })
│  render tab "Danh sách" đọc M.state.customers
│  mở modal chi tiết → đọc M.state.levels + M.state.quests (đã load sẵn)
▼
modules/membership/dashboard-quests.js    → renderQuestsTab() đọc M.state.quests
modules/membership/dashboard-levels.js    → renderLevelsTab() đọc M.state.levels
                                             sau khi lưu → M.loadLevels() + window.loadCustomers()
                                             để đồng bộ lại tab Danh sách
```

---

## 6. Hướng dẫn sử dụng — Frontend

*(Không đổi so với trước — chức năng người dùng cuối không bị ảnh hưởng bởi tái cấu trúc)*

### Điều hướng
Menu `☰` → **Tin tức**, **Luật Boardgame**, **Thông tin liên hệ**, **Thẻ thành viên**, **Cài đặt**.

### Trang Tin tức
Banner (quản lý ở Admin → Banners) + "Hôm nay chơi gì?" (3 game ngẫu nhiên).

### Trang Boardgame
Filter theo thể loại, search theo tên, trang chi tiết đầy đủ, ảnh lightbox.

### Trang Thẻ thành viên
Nhập số điện thoại đã đăng ký tại quầy → xem cấp độ, XP, thanh tiến độ, ưu đãi, streak check-in.

### Chat cộng đồng
Nút 💬 góc dưới phải, đổi tên trong Cài đặt, emoji picker, tự reset mỗi ngày mới.

---

## 7. Hướng dẫn sử dụng — Admin Dashboard

### Đăng nhập & vai trò
`/admin/login.html` — session lưu `sessionStorage`.

| Role | Quyền |
|---|---|
| `superadmin` | Toàn quyền, bao gồm Quản lý tài khoản + Khách hàng (Membership) |
| `editor` | Mọi trang trừ Quản lý tài khoản + Khách hàng |
| `barstaff` | Chỉ xem (read-only), không thấy Banners/Media/Accounts/Customers |

### Boardgames / Đồ uống
CRUD trực tiếp qua modal (giờ tự bật lên bằng JS, không còn HTML tĩnh phía sau). Emoji picker 8 danh mục, category-picker chip chọn nhiều thể loại, color picker 2 chiều (gõ tay hex ⇄ chọn màu) đồng bộ bằng sự kiện thay vì `oninput=""` inline.

### Chi tiết game + QR
Trang riêng cho từng game, có mã QR dẫn tới link luật chơi, tải PNG.

### Khách hàng (Membership) — chỉ Super Admin
3 tab: **Danh sách** (check-in, giao dịch, chi tiết khách) / **Nhiệm vụ** (CRUD quest) / **Cấp độ** (XP tối thiểu, % giảm giá, quà, ưu tiên đặt bàn). 3 tab nằm trong **cùng 1 trang** (`customersPage`) nhưng được render bởi 3 file JS độc lập, phối hợp qua `window.Membership`.

### Thư viện Media / Banners / Thống kê / Chat / Quản lý tài khoản
Không đổi so với trước — xem mục 8.

---

## 8. Chú thích từng file

### `admin/dashboard.html`
**Nhiệm vụ:** CHỈ còn shell — sidebar, 3 page tĩnh (Dashboard/Boardgames/Drinks), danh sách `<script>`. KHÔNG còn modal HTML, KHÔNG còn `<style>` inline.
Load theo đúng thứ tự — xem sơ đồ mục 3.

### `admin/dashboard-shared.css`
**Nhiệm vụ:** Toàn bộ CSS dùng chung của dashboard từng nằm inline trong `dashboard.html` (category-picker, section-divider, color-row, online-widget, skip-link, focus-visible, drink-modal select...). Load sau `dashboard.css`.

### `admin/modules/games/dashboard-games.js`
**Nhiệm vụ:** CRUD Boardgames + emoji picker + category picker + color picker.
**Khác bản trước:** tự `injectGameModal()` (IIFE chạy 1 lần lúc file load) thay vì đọc `#gameModal` có sẵn trong HTML; đồng bộ 2 ô màu bằng `bindColorPickerSync()` (addEventListener) thay vì `oninput=""` inline.
`window.getGameById(id)` — expose cho `dashboard-game-detail.js`. `window.loadGames` — expose cho `core/dashboard-nav.js`.

### `admin/modules/games/dashboard-game-detail.js`
Không đổi so với bản trước — trang chi tiết + mã QR (thư viện `qrcode` CDN). Cần `games`/`parseLines`/`parseImages`/`setLines`/`setImages`/`isGamesReadOnly` từ `dashboard-games.js` (cùng thư mục `games/`, load trước).

### `admin/modules/drinks/dashboard-drinks.js`
**Nhiệm vụ:** CRUD Đồ uống.
**Khác bản trước:** tự `injectDrinkModal()`; nút "+ Thêm công thức" trong `dashboard.html` chỉ còn `id="addDrinkBtn"`, gắn `addEventListener` ở đây thay vì `onclick="openAddDrink()"` inline.

### `admin/modules/membership/membership-shared.js` — MỚI
**Nhiệm vụ:** Hàm thuần + state dùng chung cho domain Membership. Export `window.Membership`:
- `state.customers / state.levels / state.quests` — nguồn dữ liệu chung, 3 file con đọc/ghi qua đây.
- `getLevelForXp(xp)`, `getLevelInfo(level)`, `getNextLevelInfo(level)`, `formatVND(n)`, `getISOWeek(d)`, `periodKeyFor(type)`, `normalizePhone(raw)`.
- `clearFieldError(id)` / `showFieldError(id, msg)` — validate UI dùng chung.
- `loadCustomers()` / `loadLevels()` / `loadQuests()` — fetch Supabase, tự cập nhật `state`, ném lỗi để caller tự xử lý hiển thị.
Load **đầu tiên** trong domain Membership, trước 3 file dưới.

### `admin/modules/membership/dashboard-customers.js`
**Nhiệm vụ:** Tab "👥 Danh sách" — bảng khách hàng, check-in, ghi nhận giao dịch, modal thêm khách + modal chi tiết khách (bao gồm cả nút tiến độ nhiệm vụ, gọi `markQuestProgress`).
File **DUY NHẤT** của domain Membership gọi `registerPage({ pageId: "customersPage", guard: () => isSuperAdminCust })` — 2 file `dashboard-quests.js`/`dashboard-levels.js` chỉ render nội dung vào `#custTabQuests`/`#custTabLevels` đã có sẵn trong page này.
`window.loadCustomers` — expose để `dashboard-levels.js` gọi lại sau khi lưu cấu hình cấp độ (đồng bộ dữ liệu giữa các tab).

### `admin/modules/membership/dashboard-quests.js` — MỚI (tách từ file cũ)
**Nhiệm vụ:** Tab "🗺️ Nhiệm vụ" — CRUD bảng `quests` (daily/weekly/onetime), modal thêm/sửa tự inject.
Export `window.renderQuestsTab()` — gọi bởi `dashboard-customers.js` khi tab này được mở.

### `admin/modules/membership/dashboard-levels.js` — MỚI (tách từ file cũ)
**Nhiệm vụ:** Tab "🏆 Cấp độ" — bảng sửa trực tiếp (inline edit) cấu hình `membership_levels`, validate (XP tăng dần, % giảm giá 0-100) trước khi `upsert` hàng loạt.
Export `window.renderLevelsTab()`. Sau khi lưu thành công, gọi lại `M.loadLevels()` + `window.loadCustomers()` để tab Danh sách phản ánh đúng cấp độ mới ngay.

### `admin/modules/{chat,analytics,banners,media,accounts}/dashboard-*.js`
Không đổi nội dung so với bản trước — chỉ đổi đường dẫn thư mục theo domain. Xem mô tả chi tiết trong lịch sử README trước hoặc đọc trực tiếp file (đều có comment đầu file mô tả đầy đủ).

### `js/app.js`
**Nhiệm vụ:** CHỈ còn router hash-based + render list/detail boardgame + lightbox + daily pick + settings.
**Khác bản trước:** đã bỏ `initMembership()`/`lookupMembership()`/`normalizePhoneVN()` — `loadPage()` giờ gọi `window.initMembership()` (định nghĩa ở `js/membership.js`) khi vào trang `membership`.

### `js/membership.js` — MỚI (tách từ app.js)
**Nhiệm vụ:** Toàn bộ logic trang "Thẻ thành viên" phía khách — chuẩn hoá SĐT, gọi Supabase RPC `get_membership_by_phone`, render thẻ hạng/XP/ưu đãi.
Export `window.initMembership()`. Load sau `js/app.js` trong `index.html` (thứ tự không bắt buộc nghiêm ngặt vì không phụ thuộc lẫn nhau, nhưng nên giữ ngay sau `app.js` cho dễ đọc).

*(Các file không đổi: `shared-config.js`, `shared-emoji.js`, `shared-categories.js`, `shared-utils.js`, `data.js`, `chat.js`, `login.html`, `core/dashboard-auth.js`, `core/dashboard-page-registry.js`, `core/dashboard-nav.js`, `core/dashboard-permissions.js`, `dashboard-mobile-menu.js` — xem mô tả đầy đủ trong lịch sử tài liệu.)*

---

## 9. Database Schema

Không đổi so với trước — tái cấu trúc lần này thuần về tổ chức code, không đổi schema.

### Bảng chính: `games`, `drinks`, `admin_users`, `media_library`, `site_settings`
Xem README lịch sử hoặc comment SQL trong `dashboard-media.js`.

### Domain Membership: `customers`, `membership_levels`, `quests`, `customer_quests`, `customer_checkins`, `customer_transactions`
| Bảng | Cột chính |
|---|---|
| `customers` | id, name, phone (unique), age, gender, xp, level, total_spent, streak_days, last_checkin |
| `membership_levels` | level (PK), xp_required, rank_name, rank_icon, discount_pct, free_item, priority_booking |
| `quests` | id, title, description, type (daily/weekly/onetime), xp_reward, target_count, active |
| `customer_quests` | customer_id, quest_id, period_key, progress, completed, completed_at |
| `customer_checkins` | customer_id, xp_earned, created_at |
| `customer_transactions` | customer_id, amount, note, staff_name, created_at |

### RPC `get_membership_by_phone(p_phone text)`
Trả về hạng + XP + ưu đãi + `xp_required_next` cho trang tra cứu công khai (tránh lộ toàn bảng `customers` qua anon key).

---

## 10. Biến môi trường & cấu hình

Không đổi — vẫn 1 nơi DUY NHẤT: `js/shared-config.js` chứa `window.APP_CONFIG` (Supabase URL/Key + Firebase config). Mọi file khác đọc qua đây, **không hardcode lại**.

---

## 11. Hệ thống Page Registry (Admin)

Không đổi API — vẫn `window.AdminDashboard.registerPage({...})` / `showPage()` / `window.__showPage()`. Khác biệt duy nhất: với domain Membership, **chỉ 1 trong 3 file** (`dashboard-customers.js`) được gọi `registerPage()`; 2 file còn lại (`dashboard-quests.js`, `dashboard-levels.js`) không đăng ký page riêng — chúng chỉ cung cấp hàm `renderXTab()` để file đăng ký gọi lại khi cần (xem mục 12).

```js
window.AdminDashboard.registerPage({
  pageId, menuId, icon, label, badgeHtml, group,
  placeholderId, insertBeforeMenuId, onShow, guard,
});
```

### Khi cần debug
- Menu item không xuất hiện → kiểm tra `guard()` và `group`.
- Click không chuyển trang → kiểm tra `pageId` khớp `id` div đã inject.
- Trang mở nhưng không load dữ liệu → kiểm tra `onShow` là reference/arrow function.
- **Riêng domain Membership:** nếu tab Nhiệm vụ/Cấp độ trống khi mở → kiểm tra `membership-shared.js` đã load trước và `M.loadQuests()`/`M.loadLevels()` đã resolve trước khi `renderQuestsTab()`/`renderLevelsTab()` chạy (xem `onShow` trong `dashboard-customers.js`).
- Lỗi `window.Membership is undefined` → thứ tự `<script>` sai, `membership-shared.js` phải nằm trước 3 file domain kia trong `dashboard.html`.

---

## 12. Domain Membership — kiến trúc chi tiết

Đây là domain phức tạp nhất (1 page, 3 tab, 3 file JS phối hợp) nên cần giải thích riêng.

### Vì sao 1 page nhưng 3 file?
Tab "Danh sách"/"Nhiệm vụ"/"Cấp độ" dùng chung 1 trang admin (`#customersPage`) vì về mặt UX chúng thuộc cùng 1 màn hình điều hướng — nhưng về mặt code, mỗi tab là 1 domain con gần như độc lập (khác bảng Supabase, khác modal, khác validate). Tách file giúp:
- Mỗi file ngắn (80–330 dòng) thay vì 1 file ~700 dòng.
- Sửa tab Nhiệm vụ không có nguy cơ đụng code tab Cấp độ.
- Dễ viết test riêng cho từng phần (nếu sau này thêm testing).

### Hợp đồng (contract) giữa 3 file
```
membership-shared.js
  → export window.Membership { state, loadCustomers, loadLevels, loadQuests, helpers... }

dashboard-customers.js  (chủ trang)
  → registerPage({ onShow: () => { M.loadLevels()...; M.loadQuests()...; loadCustomers(); } })
  → expose window.loadCustomers  (để dashboard-levels.js gọi lại khi cần đồng bộ)

dashboard-quests.js  (tab con)
  → expose window.renderQuestsTab()
  → TỰ chịu trách nhiệm inject modal quest của riêng mình

dashboard-levels.js  (tab con)
  → expose window.renderLevelsTab()
  → sau khi lưu, gọi M.loadLevels() + window.loadCustomers() để đồng bộ
```

Quy tắc: **file chủ trang** (`dashboard-customers.js`) là nơi duy nhất biết về cấu trúc DOM tổng (`#custTabList`/`#custTabQuests`/`#custTabLevels`) và nơi duy nhất gọi `registerPage()`. **File tab con** chỉ cần biết "tôi render vào div nào" và expose 1 hàm `renderXTab()` — không cần biết gì về việc chuyển tab hoạt động ra sao.

### Khi thêm tab thứ 4 (ví dụ "Lịch sử ưu đãi đã dùng")
1. Thêm nút tab + `<div id="custTabHistory">` trong `dashboard-customers.js`.
2. Tạo `dashboard-history.js` mới, export `window.renderHistoryTab()`.
3. Thêm nhánh gọi trong `switchCustTab()` (file `dashboard-customers.js`) và trong `onShow` của `registerPage()` nếu cần load dữ liệu ngay khi mở trang.
4. Thêm `<script>` vào `dashboard.html`, đặt sau `dashboard-customers.js`.

---

## 13. Checklist: thêm 1 module admin mới

Áp dụng cho domain hoàn toàn mới (không phải thêm tab vào Membership — xem mục 12 cho trường hợp đó):

1. Tạo thư mục `admin/modules/{ten-domain}/`.
2. File JS chính gọi `registerPage()` ngay đầu (sau khi định nghĩa các hàm cần thiết, hoặc dùng function hoisting).
3. HTML page + modal (nếu có) **tự inject bằng IIFE**, KHÔNG thêm gì vào `dashboard.html`.
4. CSS riêng (nếu cần) → `injectXStyles()` bằng JS, KHÔNG thêm `<style>` vào `dashboard.html`.
5. Dùng `addEventListener`, tránh `onclick=""`/`oninput=""` inline trong HTML tự inject.
6. Thêm đúng 1 dòng `<script>` vào cuối `dashboard.html`, đúng vị trí theo nhu cầu phụ thuộc (xem sơ đồ mục 3).
7. Nếu module cần quyền hạn → dùng `window.AdminPermissions.isSuperAdmin()` / `.isReadOnly()` / `.can()`, không so sánh chuỗi role thủ công.
8. Nếu module cần validate form → dùng pattern `clearFieldError`/`showFieldError` (border đỏ + text dưới field), không dùng `alert()`.
9. Nếu module cần xác nhận xoá → dùng `window.showConfirm()`, không dùng `confirm()` native.

---

## 14. Quy trình bảo trì thường gặp

- Thêm thể loại game mới → sửa `window.GAME_CATEGORIES` trong `js/shared-categories.js`.
- Thêm câu trả lời nhanh chat admin → mảng trong `admin/modules/chat/dashboard-chat.js`.
- Thêm 1 domain admin mới → theo checklist mục 13.
- Thêm 1 tab mới trong Membership → theo hướng dẫn mục 12.
- Đổi màu frontend → `--accent` trong `css/base/variables.css`.
- Đổi màu admin → `--primary` trong `admin/dashboard.css`.
- Đổi style chung của dashboard (category-picker, section-divider...) → `admin/dashboard-shared.css`, **không** thêm lại `<style>` vào `dashboard.html`.
- Thêm admin user mới → SQL insert `admin_users` với `password_hash` SHA-256.
- Đổi banner News → Admin → Banners.
- Reset chat → Admin → Cộng đồng → Xóa chat hôm nay.
- Đổi cấu hình cấp độ/ưu đãi thành viên → Admin → Khách hàng → tab Cấp độ.
- Đổi logic trang Thẻ thành viên (khách) → sửa `js/membership.js`, **không** sửa `js/app.js`.

---

*Cập nhật lần cuối: 2026 — The Coffee Quest v2 (sau tái cấu trúc). Xem `MIGRATION_NOTES.md` để biết chi tiết những gì đã thay đổi so với cấu trúc trước.*
