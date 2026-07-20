# ☕ The Coffee Quest — Tài liệu dự án (v3 — cập nhật theo code thực tế)

> File này được viết lại sau khi đọc trực tiếp toàn bộ source hiện có. So với README v2 cũ, các thay đổi chính:
> - Bổ sung domain **Kho nguyên liệu (Inventory)** — hoàn toàn chưa có trong tài liệu cũ.
> - Cập nhật domain **Membership** theo schema SQL v1: khách hàng đặt **đơn hàng thật** (không còn "ghi nhận giao dịch" tự do), check-in **tự động**, có huỷ đơn/huỷ từng dòng sản phẩm, lịch sử EXP.
> - Cập nhật Database Schema đúng với các cột/bảng đang được code sử dụng (`date_of_birth`, `last_checkin_date`, `total_profit`, `deleted_at`, `customer_orders`, `customer_order_items`, `drink_categories`, `ingredients`, `ingredient_stock_logs`, `drink_ingredients`...).
> - Ghi chú 1 lệch pha giữa tên file và nội dung: `admin/modules/accounts/dashboard-accounts.js` hiện đang chứa **code của module Kho nguyên liệu** (trùng nội dung với `admin/modules/inventory/dashboard-ingredients.js`), không phải module "Quản lý tài khoản" như tên thư mục gợi ý — xem mục 8 và mục 14 (cảnh báo kỹ thuật).

---

## Mục lục

1. [Tổng quan hệ thống](#1-tổng-quan-hệ-thống)
2. [Nguyên tắc kiến trúc](#2-nguyên-tắc-kiến-trúc)
3. [Sơ đồ nạp script — Admin & Frontend](#3-sơ-đồ-nạp-script--admin--frontend)
4. [Cấu trúc thư mục](#4-cấu-trúc-thư-mục)
5. [Luồng dữ liệu chính](#5-luồng-dữ-liệu-chính)
6. [Hướng dẫn sử dụng — Frontend](#6-hướng-dẫn-sử-dụng--frontend)
7. [Hướng dẫn sử dụng — Admin Dashboard](#7-hướng-dẫn-sử-dụng--admin-dashboard)
8. [Chú thích từng file](#8-chú-thích-từng-file)
9. [Database Schema (theo đúng những gì code đang dùng)](#9-database-schema-theo-đúng-những-gì-code-đang-dùng)
10. [Cấu hình / biến môi trường](#10-cấu-hình--biến-môi-trường)
11. [Hệ thống Page Registry (Admin)](#11-hệ-thống-page-registry-admin)
12. [Domain Membership — đơn hàng, check-in tự động, EXP](#12-domain-membership--đơn-hàng-check-in-tự-động-exp)
13. [Domain Inventory — Kho nguyên liệu (MỚI, chưa có trong tài liệu cũ)](#13-domain-inventory--kho-nguyên-liệu-mới)
14. [Cảnh báo kỹ thuật / nợ kỹ thuật cần xử lý](#14-cảnh-báo-kỹ-thuật--nợ-kỹ-thuật-cần-xử-lý)
15. [Quy trình bảo trì thường gặp](#15-quy-trình-bảo-trì-thường-gặp)
16. [Checklist: thêm 1 module admin mới](#16-checklist-thêm-1-module-admin-mới)
17. [Global API Reference — window.* dùng chung](#17-global-api-reference--window-dùng-chung)
18. [localStorage / sessionStorage keys](#18-localstorage--sessionstorage-keys)
19. [Quy ước UI/UX & khả năng tiếp cận (Accessibility)](#19-quy-ước-uiux--khả-năng-tiếp-cận-accessibility)

---

## 1. Tổng quan hệ thống

| Thành phần | Công nghệ | Vai trò |
|---|---|---|
| **Frontend** | HTML + CSS + Vanilla JS (module cho chat) | Trang khách: xem game, chat, tra thẻ thành viên |
| **Admin** | HTML + CSS + Vanilla JS (module hoá theo domain) | Dashboard quản trị nội bộ |
| **Database** | Supabase (PostgreSQL) | games, drinks, drink_categories, drink_ingredients, ingredients, ingredient_stock_logs, admin_users, media_library, site_settings, customers, customer_orders, customer_order_items, customer_quests, quests, membership_levels |
| **Realtime Chat** | Firebase Realtime Database | Chat cộng đồng + đếm online + analytics (gameViews, hourly online) |

Không có backend server riêng — static files gọi thẳng Supabase/Firebase từ trình duyệt. Không dùng bundler → thứ tự `<script>` trong `index.html`/`dashboard.html` là thủ công và **bắt buộc chính xác**.

---

## 2. Nguyên tắc kiến trúc

1. **1 domain = 1 thư mục** trong `admin/modules/{domain}/` (games, drinks, membership, inventory, chat, analytics, banners, media, accounts).
2. **HTML/modal luôn JS-inject** — mỗi module tự `appendChild()` HTML của mình lúc file load. `dashboard.html` chỉ là shell (sidebar + 3 page tĩnh: Dashboard/Boardgames/Drinks + danh sách `<script>`).
3. **CSS dùng chung** nằm ở `admin/dashboard.css` + `admin/dashboard-shared.css`, không có `<style>` inline trong `dashboard.html`.
4. **`addEventListener` thay cho `onclick=""` inline**, trừ các nút điều hướng cấp cao gọi thẳng hàm toàn cục ổn định trong `core/dashboard-nav.js`.
5. **Xoá dữ liệu đã từng gắn với ràng buộc khoá ngoại (`ON DELETE RESTRICT`) → luôn SOFT DELETE** (`deleted_at` + lý do bắt buộc qua `window.showReasonPrompt()`), không xoá cứng. Áp dụng cho: `customers`, `quests`, `drinks`, `ingredients`. `games`, `media_library`, `admin_users` vẫn xoá cứng (không có ràng buộc tương tự trong luồng hiện tại).

---

## 2b. Sơ đồ kiến trúc tổng thể

```
┌──────────────────────────────────────────────────────────────────────┐
│                            TRÌNH DUYỆT                                │
│  ┌───────────────────────────┐    ┌───────────────────────────────┐  │
│  │      FRONTEND (/)          │    │      ADMIN (/admin/)           │  │
│  │  index.html                │    │  login.html                    │  │
│  │   ├─ css/style.css         │    │  dashboard.html (shell)        │  │
│  │   ├─ css/chat.css          │    │   ├─ dashboard.css             │  │
│  │   ├─ js/shared-*.js        │    │   ├─ dashboard-shared.css      │  │
│  │   ├─ js/data.js            │    │   ├─ core/                     │  │
│  │   ├─ js/app.js             │    │   │   ├─ dashboard-permissions │  │
│  │   ├─ js/membership.js      │    │   │   ├─ dashboard-auth        │  │
│  │   ├─ js/theme.js           │    │   │   ├─ dashboard-page-registry│  │
│  │   └─ js/chat.js (module)   │    │   │   └─ dashboard-nav         │  │
│  │  pages/                    │    │   └─ modules/                  │  │
│  │   ├─ news.html             │    │       ├─ games/                │  │
│  │   ├─ boardgame.html        │    │       ├─ drinks/               │  │
│  │   ├─ contact.html          │    │       ├─ inventory/  ⚠️ MỚI     │  │
│  │   ├─ settings.html         │    │       ├─ membership/           │  │
│  │   └─ membership.html       │    │       ├─ chat/                 │  │
│  │                            │    │       ├─ analytics/            │  │
│  │                            │    │       ├─ banners/              │  │
│  │                            │    │       ├─ media/                │  │
│  │                            │    │       └─ accounts/  ⚠️ xem §14 │  │
│  └────────────┬───────────────┘    └────────────┬────────────────────┘  │
└───────────────┼──────────────────────────────────┼──────────────────────┘
                 │                                  │
       ┌─────────▼─────────┐              ┌─────────▼─────────┐
       │     SUPABASE       │              │      FIREBASE      │
       │   (PostgreSQL)      │              │  Realtime Database  │
       │  games, drinks,      │              │  communityChat,      │
       │  drink_categories,    │              │  onlineUsers,         │
       │  drink_ingredients,    │              │  analytics/gameViews, │
       │  ingredients,           │              │  analytics/hourly     │
       │  ingredient_stock_logs,  │              └───────────────────────┘
       │  admin_users, media_library,
       │  site_settings, customers,
       │  customer_orders, customer_order_items,
       │  membership_levels, quests,
       │  customer_quests
       └────────────────────────────┘
```

---

## 3. Sơ đồ nạp script — Admin & Frontend

### Admin (`admin/dashboard.html`, thứ tự thật trong code)

```
shared-config.js → shared-emoji.js → shared-categories.js → shared-utils.js
→ core/dashboard-permissions.js
→ Supabase SDK (CDN) + QRCode SDK (CDN)
→ core/dashboard-auth.js            (client + currentSession)
→ core/dashboard-page-registry.js   (window.AdminDashboard)
→ modules/inventory/inventory-shared.js      ⚠️ MỚI — phải load TRƯỚC drinks & ingredients
→ modules/games/dashboard-games.js           (tự inject #gameModal)
→ modules/drinks/dashboard-drinks.js         (tự inject #drinkModal, cần Inventory)
→ modules/games/dashboard-game-detail.js     (cần dashboard-games.js load trước)
→ modules/membership/membership-shared.js    (window.Membership — load TRƯỚC 3 file dưới)
→ modules/membership/dashboard-customers.js  (registerPage "customersPage" — cần Inventory)
→ modules/membership/dashboard-quests.js
→ modules/membership/dashboard-levels.js
→ modules/inventory/dashboard-ingredients.js (registerPage "ingredientsPage")
→ core/dashboard-nav.js             (showDashboard/showBoardgames/showDrinks)
→ [type=module] modules/chat/dashboard-chat.js
→ [type=module] modules/analytics/dashboard-analytics.js
→ [type=module] modules/banners/dashboard-banners.js
→ [type=module] modules/media/dashboard-media.js
→ [type=module] modules/accounts/dashboard-accounts.js   ⚠️ xem mục 14 — nội dung thực tế là Inventory, KHÔNG phải Accounts
→ dashboard-mobile-menu.js          (cuối cùng, cần .sidebar đã render)
```

### Frontend (`index.html`)

```
shared-config.js → shared-emoji.js → shared-categories.js → shared-utils.js
→ data.js (fetch games + banner config từ Supabase)
→ app.js (router hash-based + render list/detail/lightbox/daily-pick/settings)
→ membership.js (logic riêng trang Thẻ thành viên — window.initMembership)
→ theme.js (áp data-theme lên <html>, đọc/ghi localStorage)
→ [type=module] chat.js (Firebase chat + online users + analytics tracking)
```

---

## 4. Cấu trúc thư mục

```
project-root/
├── index.html
├── README.md
│
├── css/
│   ├── style.css            (chỉ @import các file base/*)
│   ├── chat.css
│   └── base/
│       ├── variables.css, reset.css, header-menu.css, news-banner.css,
│       │   boardgame-list.css, boardgame-detail.css, pages.css,
│       │   modals.css, responsive.css
│
├── js/
│   ├── shared-config.js       (window.APP_CONFIG — Supabase + Firebase)
│   ├── shared-emoji.js        (window.EMOJI_CATEGORIES, window.CHAT_EMOJIS)
│   ├── shared-categories.js   (window.GAME_CATEGORIES, category/difficulty picker)
│   ├── shared-utils.js        (escHtml, showToast, showConfirm, showReasonPrompt, slugify, debounce, gdrivePreviewUrl, buildGameSlugMap)
│   ├── data.js, app.js, membership.js, theme.js, chat.js
│
├── pages/
│   ├── news.html, boardgame.html, contact.html, settings.html, membership.html
│
└── admin/
    ├── login.html, dashboard.html (shell), dashboard.css, dashboard-shared.css,
    │   dashboard-mobile-menu.js
    ├── core/
    │   ├── dashboard-permissions.js, dashboard-auth.js,
    │   │   dashboard-page-registry.js, dashboard-nav.js
    └── modules/
        ├── games/     dashboard-games.js, dashboard-game-detail.js
        ├── drinks/    dashboard-drinks.js
        ├── inventory/ inventory-shared.js, dashboard-ingredients.js   ⚠️ MỚI, chưa có trong README cũ
        ├── membership/ membership-shared.js, dashboard-customers.js, dashboard-quests.js, dashboard-levels.js
        ├── chat/      dashboard-chat.js
        ├── analytics/ dashboard-analytics.js
        ├── banners/   dashboard-banners.js
        ├── media/     dashboard-media.js
        └── accounts/  dashboard-accounts.js   ⚠️ xem mục 14
```

---

## 5. Luồng dữ liệu chính

**Frontend load game:** `data.js` fetch `games` + `site_settings` (banner) song song từ Supabase → `window.GAMES`/`window.GAMES_READY` → `app.js` render sau khi `GAMES_READY` resolve.

**Chat:** `js/chat.js` dùng Firebase Realtime DB cho `communityChat`, `onlineUsers`, và ghi `analytics/gameViews` + `analytics/hourly` (đọc lại bởi `admin/modules/analytics/dashboard-analytics.js`).

**Admin login:** `login.html` hash SHA-256 mật khẩu phía client → so khớp `admin_users.password_hash` → chặn nếu `is_active=false` → lưu session vào `sessionStorage` → redirect `dashboard.html`. `core/dashboard-auth.js` re-verify `is_active` mỗi lần dashboard tải và tự đăng xuất nếu tài khoản vừa bị vô hiệu hoá.

**Admin CRUD Boardgame/Đồ uống:** modal tự inject bởi từng module, `saveGame()`/`deleteGame()` patch mảng cache tại chỗ bằng dữ liệu `.select()` trả về thay vì refetch toàn bảng.

**Admin bán hàng (Membership):** xem mục 12.

**Admin kho nguyên liệu:** xem mục 13.

### 5.1 Frontend — tải danh sách game (chi tiết)
```
index.html load → js/data.js
  → import supabase-js (ESM CDN)
  → Promise.all([ games.select('*').order(sort_order),
                   site_settings.select(key,value).in(['banner_1','banner_2']) ])
  → map games → window.GAMES (gán length=0 + push, giữ nguyên reference)
  → map banner rows → window.BANNER_CONFIG
window.GAMES_READY (Promise) resolve xong
  → js/app.js: gameSlugs = buildGameSlugMap(GAMES); rebuildGameIndex(); routeFromHash()
```

### 5.2 Frontend — router hash-based (`js/app.js`)
```
location.hash thay đổi → routeFromHash()
  '#boardgame' | '#game-{slug}'  → loadPage('boardgame') → initBoardgame()
                                     nếu có slug → goDetail(idx) sau 80ms (đợi DOM)
  '#contact'                     → loadPage('contact')
  '#membership'                  → loadPage('membership') → window.initMembership()
  '#settings'                    → loadPage('settings') → initSettings() (username + theme picker)
  (mặc định / rỗng)              → loadPage('news') → renderDailyPick() + renderBanners()
```
`loadPage()` dùng `fetch('pages/*.html')` rồi `innerHTML` vào `#app` — mỗi trang là 1 HTML fragment tĩnh, không phải SPA framework.

### 5.3 Frontend — trang Thẻ thành viên
```
pages/membership.html → js/app.js::loadPage('membership') gọi window.initMembership()
js/membership.js::lookupMembership()
  → normalizePhoneVN(input) → validate regex 0\d{9,10}
  → import supabase-js → supabase.rpc('get_membership_by_phone', {p_phone})
  → render #member-result: rank/icon, thanh XP (% tới cấp kế), chip ưu đãi, streak
```

### 5.4 Chat realtime + analytics
```
js/chat.js (type=module)
  → localStorage['tcq_username'] (mở modal nếu chưa có tên)
  → Firebase: set(onlineUsers/{userId}) + onDisconnect().remove()
  → onValue(onlineUsers) → cập nhật #online-count + trackHourlyOnline()
  → push(communityChat) khi gửi tin; onChildAdded lắng nghe tin mới
  → clearChatIfNewDay(): so localStorage['tcq-last-reset-day'] với hôm nay → remove(communityChat) nếu khác ngày
  → window.__fbTrack('gameViews', date, gameId, name) — gọi từ app.js::trackGameView() mỗi khi goDetail()
```
Admin đọc lại 2 nhánh `analytics/gameViews` và `analytics/hourly` trong `admin/modules/analytics/dashboard-analytics.js` để vẽ 2 biểu đồ Canvas tay (không dùng thư viện chart) + bảng chi tiết.

### 5.5 Admin đăng nhập & khởi động
```
login.html → sha256(password) (Web Crypto API) → so khớp admin_users.password_hash
           → chặn nếu is_active=false → sessionStorage['bg_admin_session'] → redirect dashboard.html
dashboard.html → core/dashboard-auth.js
    → requireAuth() (throw + redirect nếu không có session)
    → tạo `client` (Supabase) + `currentSession` (global, non-module scope)
    → verifyStillActive() (async, không chặn render): re-check is_active, tự logout nếu bị vô hiệu hoá giữa phiên
    → injectUserBar(): avatar chữ cái đầu, tên, role badge, nút đăng xuất
→ core/dashboard-page-registry.js → window.AdminDashboard.registerPage/showPage
→ mỗi modules/{domain}/*.js tự đăng ký page (nếu có) + tự inject modal/HTML của mình
```

### 5.6 Admin — CRUD Boardgame
```
modules/games/dashboard-games.js load
  → injectGameModal() (IIFE, 1 lần) → appendChild #gameModal vào <body>
  → loadGames() → Supabase games.select('*').order(sort_order) → renderGames() + updateStats()
Thêm/Sửa → modal mở, emoji picker riêng (8 danh mục từ shared-emoji.js), category picker
           (chip nhiều lựa chọn từ shared-categories.js), color picker 2 chiều đồng bộ
Lưu → saveGame(): validate tên tại field (không alert) → insert/update .select()
      → PATCH mảng `games` tại chỗ bằng data trả về (KHÔNG loadGames() lại toàn bảng)
Xoá → deleteGame(): window.showConfirm() → delete cứng (games không có FK RESTRICT nào ràng buộc)
      → filter mảng `games` tại chỗ
```

### 5.7 Admin — Đồ uống + Kho nguyên liệu (2 domain phối hợp qua window.Inventory)
```
modules/inventory/inventory-shared.js load TRƯỚC TIÊN trong nhóm này
  → window.Inventory.state = { ingredients: [], categories: [] }
  → loadIngredients(): fetch ingredients + TOÀN BỘ ingredient_stock_logs (order desc created_at)
    → giữ dòng log đầu tiên gặp mỗi ingredient_id = tồn kho hiện tại (current_stock)
  → loadCategories(): fetch drink_categories
▼
modules/drinks/dashboard-drinks.js
  → injectDrinkModal() (1 lần)
  → loadDrinks(): Promise.all([INVD.loadCategories(), INVD.loadIngredients()])
    → renderDrinkTabs() (tab lọc render động theo drink_categories)
    → populateDrinkCategorySelect() (dropdown trong modal)
    → fetch drinks (deleted_at IS NULL) → renderDrinkGrid()
  → Modal sửa/thêm: "Recipe builder" — mỗi dòng chọn 1 ingredient + số lượng/ly + hệ số quy đổi
    → updateDrinkCostPreview() dùng INVD.computeRecipeCost() để preview giá thành + lợi nhuận gộp %
  → saveDrink(): upsert `drinks`, rồi ĐỒNG BỘ drink_ingredients (xoá hết dòng cũ theo drink_id → insert lại dòng mới)
  → deleteDrink(): soft delete (deleted_at + is_active=false), yêu cầu lý do qua showReasonPrompt()
▼
modules/inventory/dashboard-ingredients.js
  → registerPage("ingredientsPage") — trang riêng "📦 Kho nguyên liệu"
  → CRUD ingredients (soft delete vì drink_ingredients.ingredient_id là ON DELETE RESTRICT)
  → Modal Nhập/Điều chỉnh kho: 3 loại (import/manual_adjust/expired)
    → insert 1 dòng ingredient_stock_logs; nếu import và giá nhập khác giá cũ → hỏi có cập nhật unit_cost tham chiếu không
```

---

## 6. Hướng dẫn sử dụng — Frontend

Không đổi so với trước: menu `☰` → Tin tức, Luật Boardgame, Thông tin liên hệ, Thẻ thành viên, Cài đặt. Trang Cài đặt có thêm bộ chọn **theme** (`js/theme.js`, 5 theme: Mặc định/Giáng Sinh/Halloween/Valentine/Tôi Yêu Việt Nam) lưu vào `localStorage('tcq_theme')` và áp qua `data-theme` trên `<html>`.

Trang chi tiết game hỗ trợ **PDF luật chơi** nhúng qua Google Drive preview (`games.rules_pdf_url`, chuyển đổi bởi `window.gdrivePreviewUrl()`), ngoài ảnh hướng dẫn/video YouTube như trước.

---

## 7. Hướng dẫn sử dụng — Admin Dashboard

### Vai trò

| Role | Quyền |
|---|---|
| `superadmin` | Toàn quyền |
| `editor` | Mọi trang trừ Accounts/Banners/Media (theo `RESTRICTED_PAGES`) |
| `barstaff` | Read-only (`READONLY_ROLES`), không thấy Accounts/Banners/Media |

`window.AdminPermissions.can(role, pageId)` mặc định **chặn** nếu role không có trong danh sách khai báo (default-deny).

### Boardgames / Đồ uống
CRUD qua modal tự inject. Đồ uống có **recipe builder** thật: chọn nguyên liệu từ kho (`drink_ingredients`), preview giá thành/lợi nhuận gộp ngay trong modal trước khi lưu.

### Khách hàng (Membership) — chỉ Super Admin
3 tab trong 1 trang: **Danh sách** (tạo đơn hàng thật, huỷ đơn/huỷ dòng, check-in tự động, lịch sử EXP) / **Nhiệm vụ** / **Cấp độ**.

### Kho nguyên liệu — MỚI
CRUD nguyên liệu + nhập kho/điều chỉnh tồn kho/hao hụt qua log chỉ-insert (`ingredient_stock_logs`), cảnh báo nguyên liệu dưới ngưỡng tối thiểu.

---

## 8. Chú thích từng file

### Frontend

- **`index.html`**: shell trang khách — header, side-menu, `#app` (nơi router nhồi HTML fragment), lightbox, username modal, chat widget. Nạp script theo đúng thứ tự ở mục 3.
- **`js/shared-config.js`**: nơi DUY NHẤT chứa `window.APP_CONFIG` (Supabase URL/anon key + Firebase config object). Phải load đầu tiên, plain script (không `type="module"`) để cả script thường lẫn module đều đọc được.
- **`js/shared-emoji.js`**: `window.EMOJI_CATEGORIES` (8 danh mục, dùng cho emoji picker admin khi thêm game) + `window.CHAT_EMOJIS` (80 emoji phẳng, dùng cho emoji picker khung chat khách) + `window.ALL_EMOJIS`/`window.UNIQUE_EMOJIS` (flatten để search).
- **`js/shared-categories.js`**: `window.GAME_CATEGORIES` (11 thể loại) + `window.DIFFICULTY_LEVELS`; expose `renderCategoryPicker()`/`getSelectedCategories()` (chip chọn nhiều) và `populateDifficultySelect()` — dùng chung giữa frontend (chip lọc trang boardgame) và admin (modal thêm/sửa game).
- **`js/shared-utils.js`**: `escHtml`, `formatTime`, `formatDateVN`, `slugify`, `debounce`, `showToast`, `buildGameSlugMap` (sinh slug duy nhất cho URL `#game-{slug}`), `gdrivePreviewUrl` (chuyển link chia sẻ Drive → link preview), và 2 dialog tự viết thay `confirm()` native: `showConfirm()` (Đồng ý/Huỷ) và `showReasonPrompt()` (bắt buộc nhập lý do — dùng cho mọi thao tác soft-delete).
- **`js/data.js`**: fetch `games` + `site_settings` (banner) song song lúc load trang → `window.GAMES`/`window.GAMES_READY`/`window.BANNER_CONFIG`. Gán lại `window.GAMES.length=0` rồi `push(...)` thay vì tạo mảng mới, để giữ nguyên reference mà `app.js` đang cầm (`let GAMES = window.GAMES` ngầm định qua global).
- **`js/app.js`**: router hash-based (`routeFromHash`), render list/detail/lightbox/daily-pick/settings. Có `gameIndexById` (Map) build 1 lần sau `GAMES_READY` để tra cứu index O(1) thay vì `GAMES.indexOf()` O(n) lặp lại trong mỗi lần render list/related/daily-pick. KHÔNG còn chứa logic Membership (đã tách sang `membership.js`).
- **`js/membership.js`**: toàn bộ logic trang "Thẻ thành viên" phía khách — chuẩn hoá SĐT VN, gọi RPC `get_membership_by_phone`, render thẻ hạng/thanh XP/ưu đãi/streak. Export `window.initMembership()`.
- **`js/theme.js`**: `window.TCQ_THEMES` (5 theme), `getCurrentTheme()`/`applyTheme()` đọc/ghi `localStorage['tcq_theme']` và set `data-theme` trên `<html>`. Tự áp theme ngay khi file load (không cần đợi DOM) để tránh nháy màu.
- **`js/chat.js`** (`type="module"`): kết nối Firebase, quản lý username modal, mở/đóng cửa sổ chat + emoji picker riêng (dùng `window.CHAT_EMOJIS`), gửi/nhận tin nhắn `communityChat`, đếm `onlineUsers`, tự xoá chat khi sang ngày mới (`clearChatIfNewDay`), và expose `window.__fbTrack()` để `app.js` ghi lượt xem game + `trackHourlyOnline()` ghi peak online theo giờ.
- **`pages/*.html`**: fragment HTML thuần (news/boardgame/contact/settings/membership), được `fetch()` và nhồi vào `#app` — không phải template engine, không có biến động trong file (dữ liệu được JS render sau khi nhồi DOM).
- **`css/style.css`**: chỉ chứa `@import` 9 file trong `css/base/`, thứ tự bắt buộc (variables → reset → ... → responsive cuối cùng để override đúng).
- **`css/base/variables.css`**: toàn bộ CSS custom properties (màu, z-index scale, bo góc, shadow, font) + override theo `html[data-theme="..."]` cho 4 theme mùa.
- **`css/base/*.css`** còn lại: chia theo khu vực màn hình (header-menu, news-banner, boardgame-list, boardgame-detail, pages, modals, responsive) — sửa đúng file tương ứng khu vực cần đổi, không gộp chung.
- **`css/chat.css`**: toàn bộ style widget chat nổi (nút tròn, cửa sổ, bong bóng tin nhắn, emoji picker riêng của chat — khác `.emoji-picker` bên admin).

### Admin — core

- **`admin/login.html`**: trang login độc lập, CSS inline riêng (không dùng `dashboard.css`). Hash SHA-256 phía client bằng Web Crypto API, chặn đăng nhập nếu `is_active=false`, lưu session `sessionStorage['bg_admin_session']`.
- **`admin/dashboard.html`**: SHELL THUẦN — sidebar (menu tĩnh: Dashboard/Boardgames/Đồ uống + placeholder Cộng đồng) + 3 page tĩnh (Dashboard/Boardgames/Đồ uống) + toàn bộ `<script>` theo đúng thứ tự mục 3. Không còn modal HTML tĩnh, không còn `<style>` inline.
- **`admin/dashboard.css`**: layout tổng (sidebar, main-content, stat-card, table, modal, emoji picker admin, responsive mobile menu ≤900px, chat admin responsive ≤860px).
- **`admin/dashboard-shared.css`**: phần CSS dùng chung từng nằm inline trong `dashboard.html` cũ — skip-link, focus-visible, section-divider, category-picker (`.cat-chip`), color-row, menu-group-label, menu-sub-item/menu-item-parent (giữ lại dù hiện không dùng submenu), online-widget, style riêng `#drinkModal select`.
- **`admin/dashboard-mobile-menu.js`**: đóng/mở sidebar dạng off-canvas trên mobile (≤900px) — toggle `.open`/overlay, đóng khi chọn menu-item lá, đóng khi resize sang desktop. Phải load CUỐI CÙNG (cần `.sidebar` đã tồn tại trong DOM).
- **`admin/core/dashboard-permissions.js`**: định nghĩa `ROLES` (superadmin/editor/barstaff), `RESTRICTED_PAGES` (trang bị ẩn theo role), `READONLY_ROLES`. `can(role, pageId)` default-deny nếu role lạ. `applyReadOnlyForm(container, opts)` — hàm DUY NHẤT khoá/mở 1 form (disable input/textarea/select, ẩn nút Lưu, ẩn/hiện nút Xoá theo `dataset.wasVisible`) dùng chung cho mọi modal/trang chi tiết.
- **`admin/core/dashboard-auth.js`**: `requireAuth()` (redirect nếu chưa login), tạo `client` (Supabase) + `currentSession` (const global, không cần import/export vì không phải module), `verifyStillActive()` (async, tự logout nếu tài khoản bị vô hiệu hoá giữa phiên), `injectUserBar()` (avatar/tên/role/nút đăng xuất chèn cuối sidebar).
- **`admin/core/dashboard-page-registry.js`**: `window.AdminDashboard.registerPage({...})` — tạo/nâng cấp menu item + gắn `onclick` gọi `showPage()`; `showPage()` ẩn hết `div[id$="Page"]` rồi hiện đúng 1 page + đánh dấu active + gọi `onShow`. `window.__showPage(pageId)` — bản rút gọn tương thích ngược, không tự đổi active menu.
- **`admin/core/dashboard-nav.js`**: chỉ xử lý 3 page TĨNH có sẵn trong HTML (`showDashboard`, `showBoardgames`, `showDrinks(cat)`, `filterDrinks(cat, btnEl)`); đồng bộ số online từ `#adminOnlineCount` (do chat module cập nhật) sang `#dashOnlineCount` bằng `MutationObserver` thay vì polling.

### Admin — modules/games

- **`admin/modules/games/dashboard-games.js`**: tự inject `#gameModal` (emoji picker riêng 8 danh mục + search, category picker chip, color picker 2 chiều đồng bộ qua `addEventListener`). `loadGames()`/`renderGames()`/`updateStats()`. Search debounce 200ms. `saveGame()`/`deleteGame()` patch mảng `games` tại chỗ bằng dữ liệu `.select()` trả về (không refetch toàn bảng). Expose `window.getGameById`, `window.loadGames`.
- **`admin/modules/games/dashboard-game-detail.js`**: trang chi tiết riêng (không phải modal) cho 1 game, kèm mã QR (thư viện `qrcode` CDN) dẫn tới `SITE_BASE_URL#game-{slug}`, tự vẽ lại QR nếu tên game đổi (đổi slug). Validate lỗi tại field, xoá dùng `showConfirm()`. Phụ thuộc `games`/`parseLines`/`parseImages`/`setLines`/`setImages`/`isGamesReadOnly` từ `dashboard-games.js` (cùng thư mục, phải load trước).

### Admin — modules/drinks & inventory

- **`admin/modules/drinks/dashboard-drinks.js`**: xem mục 5.7 và mục 8 (đầu file) — recipe builder, category dropdown động, soft delete.
- **`admin/modules/inventory/inventory-shared.js`**: state dùng chung `{ingredients, categories}`, `loadIngredients()` (suy tồn kho từ log mới nhất), `loadCategories()`, `getIngredientById/getCategoryById`, `computeRecipeCost(rows)`.
- **`admin/modules/inventory/dashboard-ingredients.js`**: trang "📦 Kho nguyên liệu" — CRUD `ingredients` + modal Nhập/Điều chỉnh kho (3 loại thao tác), cảnh báo dưới ngưỡng tối thiểu, tổng giá trị tồn kho ước tính.

### Admin — modules/membership

- **`admin/modules/membership/membership-shared.js`**: `window.Membership` — state `{customers, levels, quests}`, helper thuần (`getLevelForXp`, `getLevelInfo`, `getNextLevelInfo`, `getCheckinQuest`, `formatVND`, `getISOWeek`/`periodKeyFor`, `normalizePhone`), validate field (`clearFieldError`/`showFieldError`), 3 hàm fetch cập nhật state. Phải load đầu tiên trong domain.
- **`admin/modules/membership/dashboard-customers.js`**: xem mục 5 & 12 — trang "🎮 Khách hàng" duy nhất gọi `registerPage()`, chứa 3 tab (Danh sách/Nhiệm vụ/Cấp độ), modal thêm khách, modal huỷ đơn/dòng, modal chi tiết khách (tạo đơn hàng, xem đơn gần đây, lịch sử EXP, tick tiến độ nhiệm vụ không phải check-in).
- **`admin/modules/membership/dashboard-quests.js`**: tab "🗺️ Nhiệm vụ" — CRUD `quests`, quest `is_checkin=true` hiển thị khoá 🔒 không cho sửa/tắt/xoá, xoá = soft delete kèm lý do bắt buộc. Export `window.renderQuestsTab()`.
- **`admin/modules/membership/dashboard-levels.js`**: tab "🏆 Cấp độ" — bảng sửa trực tiếp `membership_levels`, validate XP tăng dần theo cấp + % giảm giá 0–100 trước khi `upsert` hàng loạt, sau khi lưu gọi lại `loadLevels()` + `window.loadCustomers()` để đồng bộ tab Danh sách. Export `window.renderLevelsTab()`.

### Admin — modules còn lại

- **`admin/modules/chat/dashboard-chat.js`** (module): trang "💬 Cộng đồng" — lịch sử chat 2 chiều (khách/staff), phát hiện & highlight tag quán (`TAG_PATTERN`), sidebar "Tag quán" + "Trả lời nhanh" (bottom-sheet trên mobile ≤860px), badge unread trên menu item, Notification API khi có tag mới, xoá chat qua `showConfirm()`.
- **`admin/modules/analytics/dashboard-analytics.js`** (module): trang "📈 Thống kê" — chọn khoảng ngày (hôm nay/7 ngày/tuỳ chọn), fetch song song `analytics/gameViews` + `analytics/hourly` từ Firebase theo từng ngày trong khoảng, vẽ 2 biểu đồ **Canvas tay** (bar chart top game, line chart online theo giờ — không dùng thư viện chart ngoài) + bảng chi tiết tỷ lệ %.
- **`admin/modules/banners/dashboard-banners.js`** (module): trang "🖼️ Banners" — 2 banner (`banner_1`/`banner_2`) lưu vào `site_settings` dạng JSON `{url, visible}`, preview ảnh trực tiếp, toggle ẩn/hiện dạng switch, guard chặn role Bar Staff.
- **`admin/modules/media/dashboard-media.js`** (module): trang "🗂️ Thư viện Media" — lưu link ảnh (hỗ trợ tự nhận diện & chuyển link Google Drive sang link ảnh trực tiếp `lh3.googleusercontent.com`), gắn tag lọc, ước tính dung lượng qua HEAD request (cache theo URL), copy/tải ảnh, chỉ Super Admin được xoá, guard chặn role Bar Staff.
- **`admin/modules/accounts/dashboard-accounts.js`** (module): ⚠️ xem mục 14 — nội dung hiện tại KHÔNG phải "Quản lý tài khoản", mà là bản sao gần như y hệt `dashboard-ingredients.js`.

*(File `admin/modules/inventory/dashboard-ingredients.js` và `admin/modules/accounts/dashboard-accounts.js` gần như trùng khít nhau về code — cùng `pageId: "ingredientsPage"`, cùng `menuId: "ingredientsMenuItem"` — xem mục 14 để biết hệ quả.)*

---

## 9. Database Schema (theo đúng những gì code đang dùng)

> Ghi chú: đây là schema được **suy ra từ cách code đọc/ghi** (payload insert/update, `.select()`, filter, RPC) — không phải file SQL DDL gốc. Kiểu dữ liệu ghi dưới dạng gợi ý Postgres phổ biến cho từng loại giá trị JS tương ứng.

### 9.1 `games`
Bảng danh sách boardgame, đọc bởi cả frontend (`js/data.js`) và admin (`dashboard-games.js`, `dashboard-game-detail.js`).

| Cột | Kiểu gợi ý | Ghi chú |
|---|---|---|
| `id` | `bigint` PK, identity | |
| `name` | `text` NOT NULL | bắt buộc khi lưu (validate ở form) |
| `emoji` | `text` | mặc định `"🎲"` nếu bỏ trống |
| `color` | `text` | mã hex, mặc định `"#6c5ce7"`, dùng làm dải màu card + chấm màu trong bảng admin |
| `categories` | `text[]` | nhiều thể loại, giá trị lấy từ `window.GAME_CATEGORIES` (không ràng buộc enum ở DB, chỉ ràng buộc ở UI) |
| `players` | `text` | dạng tự do, VD `"2-4 người"` |
| `time` | `text` | dạng tự do, VD `"30-60 phút"` |
| `difficulty` | `text` | `"Dễ" / "Trung bình" / "Khó"` (hoặc giá trị cũ không chuẩn — UI tự thêm option lạ vào dropdown nếu gặp) |
| `objective` | `text` | mục tiêu game |
| `win` | `text` | điều kiện thắng |
| `setup` | `text[]` | mỗi phần tử = 1 bước chuẩn bị (form nhập dạng textarea, mỗi dòng = 1 phần tử) |
| `turn` | `text[]` | mỗi phần tử = 1 bước trong lượt chơi |
| `tips` | `text[]` | mẹo chơi, có thể rỗng |
| `images` | `jsonb` (`{url, caption}[]`) | ảnh hướng dẫn, form nhập `URL | Chú thích` mỗi dòng |
| `youtube_url` | `text` | link video hướng dẫn, FE tự parse ID từ 4 dạng URL YouTube |
| `hero_bg` | `text` | URL ảnh nền hero trang chi tiết |
| `rules_pdf_url` | `text` | link chia sẻ Google Drive → FE/admin tự chuyển sang link `/preview` để nhúng iframe |
| `sort_order` | `integer` | thứ tự hiển thị, `null` nếu để trống |

Không có cột soft-delete — xoá game là **xoá cứng** (`delete().eq('id', id)`), không có bảng nào tham chiếu `games.id` bằng FK trong code hiện tại.

### 9.2 `drink_categories`
| Cột | Kiểu gợi ý | Ghi chú |
|---|---|---|
| `id` | `bigint` PK | tham chiếu bởi `drinks.category_id` |
| `name` | `text` | tên loại (VD "Cà phê", "Trà"), hiển thị trên tab lọc |
| `icon` | `text` | emoji icon tab |
| `color` | `text` | mã hex, dùng làm dải màu trên card đồ uống |
| `sort_order` | `integer` | thứ tự tab lọc |

### 9.3 `drinks`
| Cột | Kiểu gợi ý | Ghi chú |
|---|---|---|
| `id` | `bigint` PK | |
| `name` | `text` NOT NULL | |
| `category_id` | `bigint` FK → `drink_categories.id` | bắt buộc (validate ở form) |
| `emoji` | `text` | mặc định `"☕"` |
| `price` | `numeric` NOT NULL, `> 0` | giá bán, dùng làm `unit_price` snapshot khi tạo đơn |
| `is_active` | `boolean` | đang bán hay đã ngừng — vẫn hiện trong danh sách quản trị khi `false`, chỉ ẩn khỏi lọc bán hàng |
| `description` | `text` | mô tả ngắn |
| `steps` | `text[]` | các bước pha chế, mỗi dòng = 1 phần tử |
| `tips` | `text[]` | mẹo pha chế |
| `image_url` | `text` | ảnh minh hoạ |
| `sort_order` | `integer` | |
| `created_by` / `updated_by` | `text` | tên hiển thị nhân viên thao tác |
| `deleted_at` | `timestamptz`, nullable | soft delete — mọi query đọc đều lọc `is('deleted_at', null)` |
| `deleted_reason` | `text` | bắt buộc nhập qua `showReasonPrompt()` khi "ngừng bán" |
| `deleted_by` | `text` | |
| ~~`ingredients` (text tự do)~~ | — | **đã bỏ**, thay bằng bảng `drink_ingredients` bên dưới |

### 9.4 `drink_ingredients` (bảng N-N — công thức pha chế thật)
| Cột | Kiểu gợi ý | Ghi chú |
|---|---|---|
| `id` | `bigint` PK | (ngầm định, không thấy code đọc riêng cột này ngoài lúc xoá/insert lại nguyên khối) |
| `drink_id` | `bigint` FK → `drinks.id` | mỗi lần lưu công thức: **xoá hết dòng cũ theo `drink_id`** rồi insert lại toàn bộ dòng mới (không có UPDATE từng dòng) |
| `ingredient_id` | `bigint` FK → `ingredients.id` | |
| `qty_per_serving` | `numeric` | số lượng nguyên liệu cần cho 1 ly, theo đơn vị công thức (`unit`) |
| `unit` | `text` | đơn vị dùng trong công thức — có thể khác đơn vị lưu kho của `ingredients.unit` |
| `conversion_rate` | `numeric`, mặc định `1` | hệ số quy đổi từ `unit` công thức sang đơn vị lưu kho (VD công thức dùng ml, kho lưu lít → `0.001`) |

Giá thành 1 ly = `Σ (qty_per_serving × conversion_rate × ingredients.unit_cost)` — tính ở `INV.computeRecipeCost()` (client-side, chỉ để preview) và snapshot lại thành `ingredient_unit_cost`/`ingredient_cost_total` trên `customer_order_items` lúc tạo đơn thật (không phụ thuộc giá nguyên liệu thay đổi về sau).

View `v_drink_cost` (đọc, không có insert/update trong code): `{ drink_id, ingredient_cost }` — tổng giá thành nguyên liệu/ly hiện tại của mỗi đồ uống, dùng để cache nhanh (`orderDrinksCache`) khi mở form tạo đơn hàng, tránh phải tính lại từ `drink_ingredients` mỗi lần.

### 9.5 `ingredients`
| Cột | Kiểu gợi ý | Ghi chú |
|---|---|---|
| `id` | `bigint` PK | |
| `name` | `text` NOT NULL | |
| `unit` | `text` NOT NULL | đơn vị lưu kho, VD `ml`, `g`, `gói`, `lít` |
| `unit_cost` | `numeric` NOT NULL, `>= 0` | giá tham chiếu / đơn vị — có thể được cập nhật lại sau mỗi lần nhập kho nếu giá nhập khác |
| `min_stock_qty` | `numeric`, mặc định `0` | ngưỡng cảnh báo sắp hết hàng |
| `is_active` | `boolean` | đang dùng hay ngừng dùng |
| `created_by` / `updated_by` | `text` | |
| `deleted_at` / `deleted_reason` / `deleted_by` | | soft delete — vì `drink_ingredients.ingredient_id` là `ON DELETE RESTRICT` |
| *(unique constraint suy ra)* | `(name, unit)` | code bắt lỗi Postgres `23505` khi trùng "tên + đơn vị" lúc insert |

**Không có cột `current_stock` trực tiếp** — tồn kho luôn được **suy ra** từ `ingredient_stock_logs` (dòng `qty_after` mới nhất theo `created_at DESC` của mỗi `ingredient_id`), tính ở client trong `inventory-shared.js::loadIngredients()`.

### 9.6 `ingredient_stock_logs` (bảng chỉ-INSERT — không UPDATE/DELETE)
| Cột | Kiểu gợi ý | Ghi chú |
|---|---|---|
| `id` | `bigint` PK | |
| `ingredient_id` | `bigint` FK → `ingredients.id` | |
| `order_item_id` | `bigint` FK → `customer_order_items.id`, nullable | chỉ có giá trị khi `log_type='order_consume'` (trừ kho tự động lúc bán hàng) |
| `log_type` | `text` (enum ở tầng ứng dụng) | 4 giá trị: `import`, `manual_adjust`, `expired`, `order_consume` |
| `qty_change` | `numeric` | dương = cộng vào kho, âm = trừ khỏi kho |
| `qty_after` | `numeric` | tồn kho SAU thao tác — đây là cột được dùng để suy ra tồn kho hiện tại |
| `batch_ref` | `text`, chỉ bắt buộc khi `log_type='import'` | mã lô hàng |
| `unit_cost_at_import` | `numeric`, chỉ có khi `import` | giá nhập thực tế lần này (có thể khác `ingredients.unit_cost` tham chiếu) |
| `expiry_date` | `date`, tuỳ chọn khi `import` | |
| `note` | `text`, tuỳ chọn | |
| `staff_name` | `text` | |
| `created_at` | `timestamptz` | dùng để xác định "log mới nhất" |

Ràng buộc nghiệp vụ (kiểm tra ở client trước khi insert, có thể có CHECK constraint tương ứng ở DB): `qty_after >= 0` — không cho phép tồn kho âm; khi trừ kho tự động lúc bán hàng mà không đủ, hệ thống **tự trừ về 0** thay vì chặn đơn hàng, và cảnh báo riêng qua toast.

### 9.7 `customers`
| Cột | Kiểu gợi ý | Ghi chú |
|---|---|---|
| `id` | `bigint` PK | |
| `name` | `text` NOT NULL | |
| `phone` | `text` UNIQUE NOT NULL | chuẩn hoá về dạng `0xxxxxxxxx` trước khi lưu/tra cứu (`normalizePhone`), regex validate `^0\d{9,10}$` |
| `date_of_birth` | `date`, nullable | (đổi tên từ `age` cũ) |
| `gender` | `text`, nullable | giá trị FE gửi lên: `"nam" | "nu" | "khac"` hoặc `null` |
| `xp` | `integer`, mặc định `0` | |
| `level` | `integer`, mặc định `1` | suy ra từ `xp` qua `getLevelForXp()`, lưu lại (denormalize) để query nhanh |
| `total_spent` | `numeric`, mặc định `0` | **tự động** bởi trigger DB `sync_customer_totals_on_order` mỗi khi `customer_order_items` insert/update (chỉ tính dòng `is_void=false` thuộc đơn `status='completed'`) |
| `total_profit` | `numeric`, mặc định `0` | tương tự `total_spent`, nhưng là tổng `profit` |
| `streak_days` | `integer`, mặc định `0` | chuỗi ngày check-in liên tiếp, tăng nếu `last_checkin_date` = hôm qua, reset về 1 nếu đứt quãng |
| `last_checkin_date` | `date`, nullable | (đổi tên từ `last_checkin` cũ) |
| `created_by` | `text` | |
| `deleted_at` / `deleted_reason` / `deleted_by` | | soft delete — vì `customer_orders.customer_id` là `ON DELETE RESTRICT`; mọi `SELECT` đều lọc `is('deleted_at', null)` |

### 9.8 `customer_orders`
| Cột | Kiểu gợi ý | Ghi chú |
|---|---|---|
| `id` | `bigint` PK | |
| `customer_id` | `bigint` FK → `customers.id`, `ON DELETE RESTRICT` | |
| `order_number` | `text` | **tự sinh bởi trigger DB** (client không gửi giá trị này lúc insert) |
| `staff_name` | `text` | nhân viên tạo đơn |
| `status` | `text`, mặc định `"completed"` | 2 giá trị dùng trong code: `"completed"`, `"voided"` |
| `voided_by` / `voided_at` / `void_reason` | | chỉ có giá trị khi huỷ cả đơn |
| `created_at` | `timestamptz` | dùng để lọc "đơn đầu tiên trong ngày" cho check-in tự động (`gte`/`lt` theo khoảng `00:00:00`–`23:59:59.999` giờ local) |

### 9.9 `customer_order_items`
| Cột | Kiểu gợi ý | Ghi chú |
|---|---|---|
| `id` | `bigint` PK | tham chiếu bởi `ingredient_stock_logs.order_item_id` |
| `order_id` | `bigint` FK → `customer_orders.id` | |
| `drink_id` | `bigint` FK → `drinks.id` | |
| `product_name` | `text` | **snapshot** tên đồ uống tại thời điểm bán (không JOIN lại `drinks.name` sau này) |
| `quantity` | `integer`, `> 0` | |
| `unit_price` | `numeric` | snapshot `drinks.price` |
| `discount_pct` | `numeric`, `0–100` | % giảm giá áp dụng (mặc định theo cấp độ khách, admin có thể sửa tay) |
| `subtotal` | `numeric` | `= unit_price × quantity`, làm tròn 2 chữ số (`round2`) |
| `customer_paid` | `numeric` | `= subtotal × (1 − discount_pct/100)`, làm tròn 2 chữ số |
| `ingredient_unit_cost` | `numeric` | snapshot giá vốn nguyên liệu/ly tại thời điểm bán (từ `v_drink_cost`) |
| `ingredient_cost_total` | `numeric` | `= ingredient_unit_cost × quantity` |
| `profit` | `numeric` | `= customer_paid − ingredient_cost_total` |
| `is_void` | `boolean`, mặc định `false` | huỷ riêng DÒNG này (khác `customer_orders.status='voided'` là huỷ cả đơn) |
| `void_reason` / `voided_by` / `voided_at` | | chỉ có giá trị khi `is_void=true` |

⚠️ Mọi phép tính tiền (`subtotal/customer_paid/ingredient_cost_total/profit`) đều được làm tròn 2 chữ số ở client bằng `round2()` **trước khi** insert — khớp với 1 CHECK constraint phía DB đòi hỏi các số này nhất quán (nếu làm tròn khác đi ở phía client sẽ bị DB từ chối insert).

Trigger DB gắn trên bảng này (`sync_customer_totals_on_order`) tự cộng dồn lại `customers.total_spent`/`total_profit` mỗi khi có INSERT/UPDATE — **kể cả khi chỉ đổi `is_void`** của 1 dòng (huỷ từng dòng sản phẩm) → trigger tự chạy lại đúng. Nhưng khi huỷ **cả đơn** (chỉ UPDATE `customer_orders.status`, không đụng bảng này), trigger KHÔNG tự chạy lại → `dashboard-customers.js::confirmVoidOrder()` phải tự `SELECT` lại tổng `customer_paid`/`profit` của các dòng còn hợp lệ và `UPDATE customers` bằng tay.

### 9.10 `membership_levels`
| Cột | Kiểu gợi ý | Ghi chú |
|---|---|---|
| `level` | `integer` PK | |
| `xp_required` | `integer` NOT NULL | phải tăng dần nghiêm ngặt theo `level` (validate ở client trước khi `upsert`) |
| `rank_name` | `text` NOT NULL | |
| `rank_icon` | `text`, mặc định `"⭐"` | |
| `discount_pct` | `numeric`, `0–100` | % giảm giá mặc định gợi ý khi tạo đơn cho khách ở cấp này |
| `free_item` | `text`, nullable | quà tặng kèm |
| `priority_booking` | `boolean` | ưu tiên đặt bàn/slot |

### 9.11 `quests`
| Cột | Kiểu gợi ý | Ghi chú |
|---|---|---|
| `id` | `bigint` PK | tham chiếu bởi `customer_quests.quest_id`, `ON DELETE RESTRICT` |
| `code` | `text`, nullable, UNIQUE | mã tuỳ chọn (code bắt lỗi Postgres `23505` khi trùng) |
| `title` | `text` NOT NULL | |
| `description` | `text`, nullable | |
| `type` | `text` | `"daily" | "weekly" | "onetime"` |
| `xp_reward` | `integer`, `> 0` | |
| `target_count` | `integer`, `> 0` | số lần cần đạt trong 1 kỳ để hoàn thành |
| `active` | `boolean` | |
| `is_checkin` | `boolean`, mặc định `false` | **đúng 1 dòng** có giá trị `true` toàn hệ thống (ngụ ý unique index/constraint ở DB) — quest hệ thống, không cho sửa/tắt/xoá qua UI, tự hoàn thành khi khách có đơn hàng đầu ngày |
| `deleted_at` / `deleted_reason` / `deleted_by` | | soft delete |

### 9.12 `customer_quests`
| Cột | Kiểu gợi ý | Ghi chú |
|---|---|---|
| `customer_id` | `bigint` FK → `customers.id` | |
| `quest_id` | `bigint` FK → `quests.id`, `ON DELETE RESTRICT` | |
| `period_key` | `text` | với `daily` = ngày ISO (`YYYY-MM-DD`), `weekly` = tuần ISO (`YYYY-Wxx`, tính bởi `getISOWeek()`), `onetime` = hằng số `"once"` |
| `progress` | `integer`, mặc định `0` | |
| `is_completed` | `boolean` | (đổi tên từ `completed` cũ) |
| `xp_awarded` | `integer` | XP thực nhận tại thời điểm hoàn thành (snapshot — không đổi dù `quests.xp_reward` đổi sau này) |
| `related_order_id` | `bigint` FK → `customer_orders.id`, nullable | chỉ có giá trị ở dòng của quest check-in (`is_checkin`) |
| `completed_by` | `text`, nullable | |
| `completed_at` | `timestamptz`, nullable | |
| *(unique constraint suy ra)* | `(customer_id, quest_id, period_key)` | code luôn `maybeSingle()` theo 3 cột này trước khi quyết định insert mới hay update dòng cũ |

### 9.13 `admin_users`
| Cột | Kiểu gợi ý | Ghi chú |
|---|---|---|
| `id` | `bigint` PK | |
| `username` | `text` UNIQUE NOT NULL | |
| `display_name` | `text`, nullable | fallback về `username` nếu trống |
| `role` | `text` | `"superadmin" | "editor" | "barstaff"` (khớp `window.AdminPermissions.ROLES`) |
| `password_hash` | `text` | SHA-256 hex, hash phía client trước khi gửi (không bao giờ gửi plaintext) |
| `is_active` | `boolean`, mặc định `true` | `false` → chặn đăng nhập + tự đăng xuất phiên đang mở |
| `last_login` | `timestamptz` | cập nhật fire-and-forget sau mỗi lần login thành công |

### 9.14 `media_library`
| Cột | Kiểu gợi ý | Ghi chú |
|---|---|---|
| `id` | `bigint` PK, identity | |
| `url` | `text` NOT NULL | tự động chuyển link Google Drive chia sẻ → `https://lh3.googleusercontent.com/d/{fileId}` trước khi lưu nếu phát hiện |
| `label` | `text`, nullable | ghi chú |
| `tags` | `text[]`, mặc định `'{}'` | lowercase, dedupe ở client trước khi lưu |
| `added_by` | `text`, nullable | |
| `created_at` | `timestamptz`, mặc định `now()` | |

### 9.15 `site_settings`
| Cột | Kiểu gợi ý | Ghi chú |
|---|---|---|
| `key` | `text` PK | 2 giá trị đang dùng: `"banner_1"`, `"banner_2"` |
| `value` | `text` (chứa JSON string) | `JSON.stringify({url, visible})` — code có fallback đọc chuỗi thô nếu `JSON.parse` lỗi (dữ liệu cũ) |
| `updated_at` | `timestamptz` | |

### 9.16 RPC `get_membership_by_phone(p_phone text)`
Hàm phía DB (không phải bảng) — trả về 1 dòng gộp sẵn từ `customers` JOIN `membership_levels` (cấp hiện tại + cấp kế tiếp), dùng cho trang tra cứu công khai (`js/membership.js`) để **không** cho anon key đọc thẳng toàn bộ bảng `customers`. Các cột trả về được code đọc tới: `name, xp, rank_icon, rank_name, discount_pct, free_item, priority_booking, streak_days, last_checkin, xp_required_current, xp_required_next`.

### 9.17 Bảng đã bị loại bỏ hoàn toàn
`customer_checkins` và `customer_transactions` — không còn dòng code nào tham chiếu. Chức năng của chúng được thay thế bằng: check-in tự động qua `customer_quests` (quest `is_checkin`) + giao dịch thật qua `customer_orders`/`customer_order_items`.

---

## 10. Cấu hình / biến môi trường

Duy nhất `js/shared-config.js` → `window.APP_CONFIG` (Supabase URL/Key + Firebase config). Mọi nơi khác đọc qua đây, không hardcode lại.

---

## 11. Hệ thống Page Registry (Admin)

Không đổi API: `window.AdminDashboard.registerPage({ pageId, menuId, icon, label, badgeHtml, group, placeholderId, insertBeforeMenuId, onShow, guard })` / `showPage()` / `window.__showPage()`.

Domain Membership: chỉ `dashboard-customers.js` gọi `registerPage()`; `dashboard-quests.js`/`dashboard-levels.js` chỉ export `renderXTab()`.

Domain Inventory: `dashboard-ingredients.js` tự đăng ký page riêng `ingredientsPage`, độc lập với Membership dù cả hai đều dùng chung `window.Inventory`.

---

## 12. Domain Membership — đơn hàng, check-in tự động, EXP

- **Tạo đơn hàng:** chọn 1+ dòng đồ uống + số lượng trong modal chi tiết khách → tính `subtotal/customer_paid/profit` theo công thức làm tròn `round2()` khớp CHECK constraint DB → insert `customer_orders` + `customer_order_items` → trừ kho theo `drink_ingredients` (ghi `ingredient_stock_logs`, log_type `order_consume`; nếu thiếu kho thì trừ về 0 và cảnh báo, **không chặn đơn hàng**).
- **Check-in tự động:** nếu đơn hàng vừa tạo là đơn *đầu tiên trong ngày* của khách → tự hoàn thành quest `is_checkin=true`, cộng XP + streak (+20 XP thưởng mỗi mốc 7 ngày liên tiếp).
- **Huỷ đơn / huỷ dòng:** không xoá cứng — `status='voided'` (cả đơn) hoặc `is_void=true` (từng dòng), luôn yêu cầu lý do. Huỷ cả đơn phải tự tính lại `total_spent/total_profit` bằng tay vì trigger DB chỉ gắn trên `customer_order_items`, không gắn trên `customer_orders`.
- **Lịch sử EXP:** liệt kê từ `customer_quests` đã hoàn thành, nêu rõ lý do (tên nhiệm vụ hoặc "check-in — từ đơn hàng #...").
- **Xoá khách hàng:** soft delete (`deleted_at`) vì `customer_orders.customer_id` là `ON DELETE RESTRICT`.

---

## 13. Domain Inventory — Kho nguyên liệu (MỚI)

Chưa từng xuất hiện trong tài liệu trước, nhưng đã là một phần cốt lõi của hệ thống bán hàng hiện tại:

- `inventory-shared.js` cung cấp `window.Inventory.state.{ingredients, categories}` dùng chung bởi 3 nơi: trang Kho nguyên liệu, modal sửa đồ uống (recipe builder), và lúc tạo đơn hàng (snapshot giá vốn).
- Tồn kho **không lưu trực tiếp** trên `ingredients` — được suy ra từ dòng `ingredient_stock_logs` mới nhất mỗi nguyên liệu (`qty_after`).
- 3 loại thao tác kho: `import` (nhập hàng, cần mã lô + giá nhập, có hỏi cập nhật giá tham chiếu nếu khác giá cũ), `manual_adjust` (kiểm kê), `expired` (hao hụt/hết hạn).
- Cảnh báo nguyên liệu dưới `min_stock_qty` ngay trên trang danh sách.
- Xoá nguyên liệu = soft delete vì `drink_ingredients.ingredient_id` là `ON DELETE RESTRICT`.

---

## 14. Cảnh báo kỹ thuật / nợ kỹ thuật cần xử lý

- **`admin/modules/accounts/dashboard-accounts.js` hiện không khớp với vai trò của nó.** Theo `dashboard-permissions.js` (`RESTRICTED_PAGES.barstaff` chặn `"accountsPage"`) và theo tên thư mục `modules/accounts/`, file này lẽ ra phải là trang "Quản lý tài khoản nhân viên" (CRUD `admin_users`). Nhưng nội dung thực tế của file lại là **CRUD Kho nguyên liệu** — trùng gần như 100% với `admin/modules/inventory/dashboard-ingredients.js` (cùng đăng ký `pageId: "ingredientsPage"`, `menuId: "ingredientsMenuItem"`). Vì `dashboard.html` load cả hai file, hệ quả nhiều khả năng là: menu item/page bị đăng ký/inject 2 lần (lệnh sau ghi đè lệnh trước do cùng `id`), và **trang "Quản lý tài khoản" (accountsPage) hiện KHÔNG tồn tại** trong hệ thống dù được khai báo quyền hạn ở `dashboard-permissions.js`.
  → Cần khôi phục đúng nội dung "Quản lý tài khoản" (CRUD `admin_users`: thêm nhân viên, đổi role, vô hiệu hoá tài khoản qua `is_active`) vào file `dashboard-accounts.js`, tách khỏi nội dung Inventory.
- README cũ (v2) không hề nhắc tới domain Inventory dù nó đã được tích hợp sâu vào luồng bán hàng (Membership) — đã bổ sung ở mục 13.
- `games.rules_pdf_url` và toàn bộ tính năng xem PDF luật chơi qua Google Drive chưa từng được ghi nhận trong tài liệu trước.
- `js/theme.js` (theme mùa) chưa từng được liệt kê trong sơ đồ nạp script hay cấu trúc thư mục ở tài liệu trước.
- **Rủi ro lặp lại của lỗi §accounts:** `window.AdminDashboard.registerPage()` không kiểm tra trùng `pageId`/`menuId` — nếu 2 module khác nhau vô tình dùng cùng `pageId` (như trường hợp `ingredientsPage` ở trên), module load SAU sẽ ghi đè `onclick` của menu item module load TRƯỚC mà không có cảnh báo nào ở console. Khi tạo module mới, luôn đặt `pageId`/`menuId` là duy nhất trong toàn bộ `dashboard.html` (khuyến nghị tiền tố theo domain, VD `ingredientsPage`, `accountsPage`, không dùng tên chung chung).
- `admin/modules/accounts/dashboard-accounts.js` được nạp bằng `type="module"` (xem mục 3), nhưng lại dùng các biến toàn cục non-module như `client`, `currentSession`, `window.AdminDashboard` — vẫn hoạt động được vì các biến này gắn vào `window`/global scope từ các script thường load trước, nhưng cần lưu ý nếu sau này refactor sang ES module imports thật sự.

---

## 15. Quy trình bảo trì thường gặp

- Thêm thể loại game mới → `window.GAME_CATEGORIES` trong `js/shared-categories.js`.
- Thêm loại đồ uống mới → thêm dòng trong bảng `drink_categories` (không sửa code, tab lọc tự render động).
- Thêm câu trả lời nhanh chat admin → mảng trong `admin/modules/chat/dashboard-chat.js`.
- Thêm 1 tab mới trong Membership → theo mục 12, thêm file `dashboard-{tab}.js`, export `renderXTab()`, gọi trong `switchCustTab()` của `dashboard-customers.js`.
- Đổi màu frontend → `--accent` trong `css/base/variables.css`; đổi theo mùa → sửa block `html[data-theme="..."]` trong cùng file.
- Đổi màu admin → `--primary` trong `admin/dashboard.css`.
- Đổi cấu hình cấp độ/ưu đãi thành viên → Admin → Khách hàng → tab Cấp độ.
- Nhập/điều chỉnh tồn kho nguyên liệu → Admin → Kho nguyên liệu (**lưu ý mục 14** — kiểm tra kỹ trang này có đang bị trùng với "Quản lý tài khoản" hay không trước khi thao tác quyền).
- Reset chat → Admin → Cộng đồng → Xóa chat hôm nay.
- Thêm role admin mới → sửa `ROLES`/`RESTRICTED_PAGES`/`READONLY_ROLES` trong `admin/core/dashboard-permissions.js` (KHÔNG so sánh chuỗi role thủ công ở module khác).
- Thêm admin user mới → insert `admin_users` với `password_hash` = SHA-256(plaintext) tính trước (VD dùng DevTools console gọi `crypto.subtle.digest`), không lưu plaintext.
- Đổi ngưỡng cảnh báo tồn kho → sửa `min_stock_qty` trực tiếp trên từng nguyên liệu (Admin → Kho nguyên liệu → Sửa), không có cấu hình toàn cục.
- Đổi cách tính XP thưởng streak check-in (hiện +20 XP mỗi mốc 7 ngày) → sửa hằng số trong `maybeAutoCheckin()` tại `admin/modules/membership/dashboard-customers.js`.

---

## 16. Checklist: thêm 1 module admin mới

Áp dụng khi tạo 1 domain hoàn toàn mới (không phải thêm tab vào Membership hay Inventory — 2 domain đó đã có state dùng chung riêng, xem mục 12/13):

1. Tạo thư mục `admin/modules/{ten-domain}/`.
2. Nếu module cần state/helper dùng chung giữa nhiều file con → tạo file `{domain}-shared.js` load ĐẦU TIÊN trong domain (theo đúng pattern `membership-shared.js` / `inventory-shared.js`), export qua `window.{TenDomain}`.
3. File JS chính gọi `window.AdminDashboard.registerPage({...})` — **đặt `pageId`/`menuId` DUY NHẤT toàn hệ thống**, kiểm tra chéo với `admin/dashboard.html` và các file khác trong `admin/modules/` trước khi đặt tên để tránh lặp lại lỗi ở mục 14.
4. HTML page + modal (nếu có) tự inject bằng IIFE ngay khi file load (`document.querySelector('.main-content').appendChild(...)` hoặc `document.body.appendChild(...)`), **KHÔNG** thêm gì tĩnh vào `dashboard.html`.
5. CSS riêng (nếu cần) → tự inject `<style>` bằng JS (pattern `injectXStyles()` như `dashboard-media.js`), không thêm `<style>` vào `dashboard.html`.
6. Dùng `addEventListener`, tránh `onclick=""`/`oninput=""` inline trong HTML tự inject (ngoại lệ: nút điều hướng cấp cao gọi hàm ổn định từ `core/dashboard-nav.js`).
7. Thêm đúng 1 dòng `<script>` vào `dashboard.html`, đúng vị trí theo nhu cầu phụ thuộc — xem sơ đồ mục 3 để biết thứ tự bắt buộc (permissions → auth → page-registry → shared state của domain khác nếu cần dùng lại → module chính → nav.js → module ES `type="module"` nếu không có phụ thuộc ngược → mobile-menu.js cuối cùng).
8. Nếu module cần quyền hạn → dùng `window.AdminPermissions.isSuperAdmin()` / `.isReadOnly()` / `.can(role, pageId)`, không so sánh chuỗi role thủ công; nhớ khai báo `pageId` mới vào `RESTRICTED_PAGES` trong `dashboard-permissions.js` nếu cần ẩn với 1 số role.
9. Nếu module cần validate form → dùng pattern `clearFieldError`/`showFieldError` (border đỏ + text dưới field), không dùng `alert()`.
10. Nếu module cần xác nhận xoá đơn giản → `window.showConfirm()`; nếu là soft-delete cần lưu lý do → `window.showReasonPrompt()`. Không dùng `confirm()`/`prompt()` native.
11. Nếu module thao tác dữ liệu có ràng buộc `ON DELETE RESTRICT` từ bảng khác → thiết kế xoá là soft-delete (`deleted_at`/`deleted_reason`/`deleted_by`) ngay từ đầu, lọc `is('deleted_at', null)` ở mọi câu SELECT liên quan.
12. Sau khi thêm xong → chạy thử toàn bộ luồng đăng nhập 3 role (`superadmin`/`editor`/`barstaff`) để đảm bảo `guard()` hoạt động đúng và menu không xuất hiện sai chỗ.

---

## 17. Global API Reference — window.* dùng chung

Bảng dưới liệt kê các hàm/biến toàn cục quan trọng nhất mà bất kỳ module mới nào (frontend lẫn admin) có thể/nên tái sử dụng thay vì viết lại.

### Từ `js/shared-utils.js` (dùng chung cả frontend + admin)
| Global | Mô tả |
|---|---|
| `window.escHtml(s)` | escape HTML — bắt buộc dùng khi render text người dùng nhập vào `innerHTML` |
| `window.formatTime(ts)` | `HH:mm` từ timestamp |
| `window.formatDateVN(dateStr)` | `YYYY-MM-DD` → `DD/MM/YYYY` |
| `window.slugify(s)` | chuẩn hoá chuỗi có dấu tiếng Việt thành slug URL |
| `window.debounce(fn, delay=200)` | debounce dùng chung cho mọi ô search |
| `window.showToast(msg, bg='#00b894')` | thông báo nổi góc dưới phải, tự ẩn sau ~2.7s |
| `window.showConfirm(opts)` | Promise<boolean> — modal xác nhận thay `confirm()` native |
| `window.showReasonPrompt(opts)` | Promise<string|null> — modal xác nhận CÓ ô nhập lý do bắt buộc, dùng cho mọi soft-delete |
| `window.gdrivePreviewUrl(url)` | chuyển link chia sẻ Google Drive → link `/preview` để nhúng iframe |
| `window.buildGameSlugMap(games)` | sinh `{slugById, idBySlug}` không trùng lặp cho URL `#game-{slug}` |

### Từ `js/shared-emoji.js` / `js/shared-categories.js`
| Global | Mô tả |
|---|---|
| `window.EMOJI_CATEGORIES` / `window.CHAT_EMOJIS` / `window.ALL_EMOJIS` / `window.UNIQUE_EMOJIS` | dữ liệu emoji picker (admin 8 danh mục / chat 80 emoji phẳng) |
| `window.GAME_CATEGORIES` / `window.DIFFICULTY_LEVELS` | danh sách thể loại + độ khó chuẩn |
| `window.renderCategoryPicker(container, selected, readonly)` / `window.getSelectedCategories(container)` | chip picker chọn nhiều thể loại (dùng ở modal thêm/sửa game) |
| `window.populateDifficultySelect(selectEl, currentValue)` | điền `<select>` độ khó, tự thêm option lạ nếu data cũ không khớp chuẩn |

### Từ `js/theme.js` (frontend)
`window.TCQ_THEMES`, `window.getCurrentTheme()`, `window.applyTheme(id)`.

### Từ `js/app.js` (frontend, dùng bởi `onclick=""` trong pages/*.html và index.html)
`goNews()/goBoardgame()/goContact()/goSettings()/goMembership()`, `goList()/goDetail(idx)`, `openLb(url, cap)/closeLb()`, `saveUsernameSettings()`.

### Từ `js/membership.js` (frontend)
`window.initMembership()` — gọi bởi router `app.js` khi vào `#membership`.

### Từ `js/chat.js` (frontend, module)
`window.updateChatUsername(newName)`, `window.__fbTrack(type, date, gameId, gameName)` — cầu nối để `app.js` ghi lượt xem game vào Firebase mà không cần `app.js` biết chi tiết Firebase.

### Từ `admin/core/*`
| Global | Mô tả |
|---|---|
| `window.AdminPermissions` | `{ROLES, roleInfo, isSuperAdmin, can, isReadOnly, applyReadOnlyForm}` |
| `window.AdminDashboard` | `{registerPage, showPage, ready}` |
| `window.__showPage(pageId)` | tương thích ngược, chỉ ẩn/hiện page KHÔNG đổi active menu |
| `client` | Supabase client instance (biến `const` toàn cục, không có `window.` prefix — đọc trực tiếp qua global scope) |
| `currentSession` | `{id, username, displayName, role, loginAt}` — session hiện tại (biến `const` toàn cục) |

### Từ các module domain (đã liệt kê chi tiết ở mục 8)
`window.Membership`, `window.Inventory`, `window.loadGames`, `window.getGameById`, `window.openGameDetail`, `window.loadDrinks`/`renderDrinkGrid`/`openAddDrink`/`editDrink`/`saveDrink`/`deleteDrink`, `window.loadCustomers`, `window.renderQuestsTab`/`window.renderLevelsTab`, `window.setAnalyticsRange`/`window.loadAnalytics`, `window.openMediaModal`/`closeMediaModal`/`addMedia`, `window.saveBanners`.

---

## 18. localStorage / sessionStorage keys

| Key | Nơi dùng | Mục đích |
|---|---|---|
| `localStorage['tcq_username']` | `js/chat.js`, `pages/settings.html` → `saveUsernameSettings()` | tên hiển thị trong chat cộng đồng |
| `localStorage['tcq-last-reset-day']` | `js/chat.js::clearChatIfNewDay()` | ngày cuối cùng đã reset chat, so với hôm nay để biết có cần xoá `communityChat` không |
| `localStorage['tcq_theme']` | `js/theme.js` | theme mùa đang chọn (`default`/`christmas`/`halloween`/`valentine`/`vietnam`) |
| `sessionStorage['bg_admin_session']` | `admin/login.html`, `admin/core/dashboard-auth.js`, `admin/modules/chat/dashboard-chat.js` | session admin đang đăng nhập — mất khi đóng tab, không phải khi đóng trình duyệt hoàn toàn nếu trình duyệt khôi phục tab |

> Không có key nào lưu dữ liệu nhạy cảm dạng plaintext (mật khẩu luôn hash SHA-256 phía client trước khi gửi lên DB, session chỉ lưu thông tin hiển thị + role).

---

## 19. Quy ước UI/UX & khả năng tiếp cận (Accessibility)

Áp dụng nhất quán ở cả frontend lẫn admin, nên giữ nguyên khi thêm UI mới:

- **Skip link**: cả `index.html` và `admin/dashboard.html` đều có `<a class="skip-link" href="#...">` là phần tử đầu tiên trong `<body>`, trỏ tới vùng nội dung chính có `tabindex="-1"` (`#app` / `#mainContent`).
- **`:focus-visible`** được định nghĩa toàn cục trong `css/base/reset.css` (frontend) — chỉ hiện outline khi điều hướng bàn phím, không hiện khi click chuột.
- **Dialog thay thế API native**: không dùng `alert()`/`confirm()`/`prompt()` ở bất kỳ đâu trong code hiện tại — luôn dùng `window.showToast()`/`window.showConfirm()`/`window.showReasonPrompt()` (đều có `role="alertdialog"`/`role="alert"`, bẫy phím Escape/Enter, tự focus vào nút chính khi mở).
- **z-index theo thang chuẩn** khai báo ở `css/base/variables.css` (`--z-sticky`, `--z-header`, `--z-overlay`, `--z-drawer`, `--z-widget`, `--z-modal`, `--z-lightbox`, `--z-toast`) — không dùng số tuỳ tiện (100, 9999, 999999...) khi thêm component mới.
- **Responsive breakpoints chính**: `900px` (sidebar admin → off-canvas drawer), `860px` (trang chat admin → giao diện kiểu Messenger full màn hình), `768px`/`660px` (banner + header 2 dòng ở frontend), `600px` (form 1 cột, emoji picker thu nhỏ).
- **`aria-label`/`role` bắt buộc** cho mọi nút chỉ có icon (không có text kèm theo) và mọi vùng động cập nhật nội dung real-time (`role="log" aria-live="polite"` cho khung chat).
- **Ảnh lỗi**: mọi `<img>` do admin nhập URL tự do (game hero, media library, banner) đều có `onerror=` để hiện fallback UI thay vì icon ảnh vỡ mặc định của trình duyệt.

---

*Cập nhật lần cuối: 2026-07 — The Coffee Quest v3 (viết lại từ việc đọc trực tiếp source code hiện tại, không dựa trên README v2 cũ).*
