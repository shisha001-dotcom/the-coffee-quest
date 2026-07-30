# ☕ The Coffee Quest — Tài liệu dự án (v4 — viết lại toàn bộ từ source thực tế)

> **File này được viết lại từ đầu** sau khi đọc trực tiếp toàn bộ mã nguồn hiện có (không dựa trên README v3 cũ, vì v3 đã lệch pha đáng kể so với code thật). So với v3, các thay đổi **quan trọng nhất**:
>
> 1. **Kiến trúc nạp script của Admin đã bị viết lại hoàn toàn.** `admin/dashboard.html` giờ chỉ còn 9 dòng `<script>` hạ tầng; **toàn bộ phần còn lại** (page-registry, games, drinks, inventory, membership, orders, nav, chat, analytics, banners, media, accounts, mobile-menu) được `admin/core/dashboard-auth.js` **tự nạp bằng JavaScript sau khi xác thực xong**, không còn khai báo tĩnh trong HTML nữa. Đây là thứ **bắt buộc phải hiểu trước khi sửa bất kỳ file admin nào**, xem Mục 3.
> 2. **Domain hoàn toàn mới: `admin/modules/orders/`** (🧾 Đơn hàng) — tách hẳn khỏi Membership, có popup tạo đơn 3 bước (Thành viên/Khách vãng lai), khách vãng lai dùng chung 1 hàng `customers` cố định, xuất Excel (SheetJS), huỷ đơn/huỷ dòng. Xem Mục 17.
> 3. **`admin/modules/accounts/dashboard-accounts.js` đã được vá đúng nội dung** (CRUD tài khoản `admin_users`, không còn là bản sao của Kho nguyên liệu như README v3 từng cảnh báo) — **nhưng phát sinh lỗ hổng vận hành mới nghiêm trọng hơn**: đăng nhập giờ dùng Supabase Auth thật, nhưng UI "Thêm tài khoản" chưa được cập nhật theo, nên **tài khoản tạo qua UI hiện tại không đăng nhập được**. Xem Mục 18.1 — đọc mục này TRƯỚC KHI tạo tài khoản admin mới.
> 4. **Frontend `js/app.js` đã được tách thành 9 file nhỏ** trong `js/app/` (app-state, app-router, app-boardgame-list...). File `js/app.js` gốc (monolith) **vẫn còn nằm trong repo nhưng KHÔNG còn được `index.html` nạp** — xem cảnh báo ở Mục 18.5.
> 5. **`admin/modules/membership/dashboard-customers.js` đã được chia nhỏ** — phần "tạo đơn hàng" chuyển sang Orders, phần "chi tiết khách hàng" chuyển sang trang riêng `dashboard-customer-detail.js`.
> 6. Bổ sung mục **"Đề xuất nâng cấp / cải tiến"** (Mục 24) ở cuối tài liệu — liệt kê cụ thể những gì nên làm tiếp theo, ưu tiên theo mức độ quan trọng.

---

## 🚦 Đọc nhanh trước khi sửa code (dành cho cả người lẫn AI)

Nếu chỉ có 2 phút, hãy nhớ 6 điều sau — chúng gây ra 90% lỗi "không hiểu vì sao code không chạy" trong dự án này:

1. **Không có bundler.** Toàn bộ JS là `<script>` thường (một số ít là `type="module"`). Thứ tự nạp **quyết định biến/hàm có tồn tại hay không** tại thời điểm chạy. Sai thứ tự → lỗi `X is not defined` hoặc `Cannot read properties of undefined`, không có compiler nào báo trước.
2. **Admin KHÔNG nạp script qua thẻ `<script>` tĩnh** (trừ 9 dòng hạ tầng đầu tiên). Muốn thêm 1 file `.js` mới cho Admin → thêm đường dẫn vào mảng `SCRIPT_SEQUENCE` hoặc `MODULE_SEQUENCE` trong `admin/core/dashboard-auth.js`, **không** thêm `<script>` vào `admin/dashboard.html`. Xem Mục 3 và Mục 20.
3. **Xoá dữ liệu bị bảng khác tham chiếu bằng khoá ngoại `ON DELETE RESTRICT`** (customers, quests, drinks, ingredients) → luôn **soft delete** (`deleted_at` + lý do bắt buộc qua `window.showReasonPrompt()`), không xoá cứng.
4. **Không dùng `alert()` / `confirm()` / `prompt()` native** ở bất kỳ đâu — dùng `window.showToast()` / `window.showConfirm()` / `window.showReasonPrompt()` (định nghĩa trong `js/shared-utils.js`, tự inject CSS riêng, hoạt động cho cả 2 giao diện khách/admin).
5. **Mọi phép tính tiền** (`subtotal`, `customer_paid`, `ingredient_cost_total`, `profit`) phải làm tròn bằng `round2()` (2 chữ số) **trước khi insert** — khớp với 1 CHECK constraint phía DB. Làm tròn khác đi ở client sẽ bị Supabase từ chối insert.
6. **"Thêm tài khoản admin mới" qua UI hiện KHÔNG hoạt động trọn vẹn** (xem Mục 18.1) — tài khoản tạo ra sẽ không đăng nhập được nếu chỉ dùng UI có sẵn. Cần thao tác tay thêm ở Supabase Dashboard.

---

## Mục lục

1. [Tổng quan hệ thống](#1-tổng-quan-hệ-thống)
2. [Nguyên tắc kiến trúc](#2-nguyên-tắc-kiến-trúc)
3. [Sơ đồ nạp script — Admin & Frontend](#3-sơ-đồ-nạp-script--admin--frontend)
4. [Sơ đồ kiến trúc tổng thể](#4-sơ-đồ-kiến-trúc-tổng-thể)
5. [Cấu trúc thư mục](#5-cấu-trúc-thư-mục)
6. [Luồng dữ liệu chính](#6-luồng-dữ-liệu-chính)
7. [Hướng dẫn sử dụng — Frontend](#7-hướng-dẫn-sử-dụng--frontend)
8. [Hướng dẫn sử dụng — Admin Dashboard](#8-hướng-dẫn-sử-dụng--admin-dashboard)
9. [Hệ thống phân quyền (Permissions) chi tiết](#9-hệ-thống-phân-quyền-permissions-chi-tiết)
10. [Xác thực Admin — Login → Session → Nạp script](#10-xác-thực-admin--login--session--nạp-script)
11. [Chú thích từng file](#11-chú-thích-từng-file)
12. [Database Schema](#12-database-schema)
13. [Cấu hình / biến môi trường](#13-cấu-hình--biến-môi-trường)
14. [Hệ thống Page Registry (Admin)](#14-hệ-thống-page-registry-admin)
15. [Domain Membership](#15-domain-membership--đơn-hàng-cũ-check-in-tự-động-exp)
16. [Domain Inventory](#16-domain-inventory--kho-nguyên-liệu)
17. [Domain Orders (MỚI)](#17-domain-orders--đơn-hàng-mới-hoàn-toàn)
18. [Cảnh báo kỹ thuật / nợ kỹ thuật cần xử lý](#18-cảnh-báo-kỹ-thuật--nợ-kỹ-thuật-cần-xử-lý)
19. [Quy trình bảo trì thường gặp](#19-quy-trình-bảo-trì-thường-gặp)
20. [Checklist: thêm 1 module admin mới](#20-checklist-thêm-1-module-admin-mới)
21. [Global API Reference](#21-global-api-reference--window-dùng-chung)
22. [localStorage / sessionStorage keys](#22-localstorage--sessionstorage-keys)
23. [Quy ước UI/UX & khả năng tiếp cận](#23-quy-ước-uiux--khả-năng-tiếp-cận-accessibility)
24. [Đề xuất nâng cấp / cải tiến hệ thống](#24-đề-xuất-nâng-cấp--cải-tiến-hệ-thống)

---

## 1. Tổng quan hệ thống

| Thành phần | Công nghệ | Vai trò |
|---|---|---|
| **Frontend** | HTML + CSS thuần + Vanilla JS (module cho chat) | Trang khách: xem game, chat cộng đồng, tra thẻ thành viên |
| **Admin** | HTML + CSS thuần + Vanilla JS (module hoá theo domain, nạp động bằng JS) | Dashboard quản trị nội bộ: game, đồ uống, kho, khách hàng, đơn hàng, chat, thống kê |
| **Database** | Supabase (PostgreSQL) + Supabase Auth | `games`, `drinks`, `drink_categories`, `drink_ingredients`, `ingredients`, `ingredient_stock_logs`, `admin_users`, `media_library`, `site_settings`, `customers`, `customer_orders`, `customer_order_items`, `customer_quests`, `quests`, `membership_levels`, view `v_drink_cost` |
| **Realtime Chat** | Firebase Realtime Database (SDK v10.12.2) | Chat cộng đồng + đếm online + analytics (`gameViews`, `hourly online`) |
| **Thư viện ngoài (CDN)** | Supabase JS v2, QRCode.js 1.5.3, SheetJS/xlsx 0.18.5 | Đăng nhập/CRUD dữ liệu, mã QR luật chơi, xuất Excel đơn hàng |

Không có backend server riêng — static files gọi thẳng Supabase/Firebase từ trình duyệt bằng **anon key** (public, an toàn để lộ ra client — bảo mật thật sự nằm ở Row Level Security phía Supabase, xem Mục 18.7). Không dùng bundler → thứ tự `<script>` (frontend) hoặc thứ tự trong mảng `SCRIPT_SEQUENCE`/`MODULE_SEQUENCE` (admin) là **thủ công và bắt buộc chính xác**.

Site được cấu hình để deploy tĩnh (ví dụ GitHub Pages) — xem hằng số `SITE_BASE_URL` trong `admin/modules/games/dashboard-game-detail.js` (dùng để sinh mã QR dẫn tới trang luật chơi).

---

## 2. Nguyên tắc kiến trúc

1. **1 domain = 1 thư mục** trong `admin/modules/{domain}/` (games, drinks, inventory, membership, orders, chat, analytics, banners, media, accounts).
2. **HTML/modal luôn JS-inject** — mỗi module tự `appendChild()` HTML của mình lúc file chạy. `admin/dashboard.html` chỉ là shell tối giản (sidebar + 3 page tĩnh: Dashboard/Boardgames/Drinks + 2 placeholder menu-item + danh sách `<script>` hạ tầng).
3. **CSS dùng chung** nằm ở `admin/dashboard.css` + `admin/dashboard-shared.css`, không có `<style>` inline trong `dashboard.html`. Một số module (banners cũ, media) tự `injectXStyles()` bằng JS khi cần CSS riêng.
4. **`addEventListener` thay cho `onclick=""` inline**, trừ các nút điều hướng cấp cao gọi thẳng hàm toàn cục ổn định trong `core/dashboard-nav.js` (`showDashboard()`, `showBoardgames()`, `showDrinks()`) và tương tự bên frontend (`goNews()`, `goBoardgame()`...).
5. **Xoá dữ liệu đã từng gắn với ràng buộc khoá ngoại (`ON DELETE RESTRICT`) → LUÔN SOFT DELETE** (`deleted_at` + lý do bắt buộc qua `window.showReasonPrompt()`), không xoá cứng. Áp dụng cho: `customers`, `quests`, `drinks`, `ingredients`. `games`, `media_library` vẫn xoá cứng (không có ràng buộc tương tự). `admin_users` dùng **vô hiệu hoá** (`is_active=false`) thay vì xoá.
6. **Admin không nạp script tĩnh** (trừ hạ tầng) — toàn bộ được `admin/core/dashboard-auth.js` tự tải bằng JS **sau khi xác thực Supabase Auth thành công**, theo đúng thứ tự khai báo trong 2 mảng `SCRIPT_SEQUENCE`/`MODULE_SEQUENCE`. Đây là thay đổi kiến trúc lớn nhất so với các bản trước — xem Mục 3 và Mục 10.
7. **Các file `js/app/app-*.js` (frontend) và phần lớn file admin trong `SCRIPT_SEQUENCE`) là *classic script*, không phải ES module** — chúng **chia sẻ chung 1 global scope**, nên file sau có thể tham chiếu trực tiếp biến/hàm khai báo bằng `let`/`function` ở top-level của file trước mà không cần `import`/`window.` prefix. Đây là lý do thứ tự nạp quan trọng tuyệt đối (xem hộp giải thích trong Mục 3).
8. **Tiền bạc luôn làm tròn 2 chữ số bằng `round2()` phía client trước khi insert**, khớp 1 CHECK constraint phía DB — không tự ý đổi cách làm tròn.

---

## 3. Sơ đồ nạp script — Admin & Frontend

### 3.1 Admin (`admin/dashboard.html`) — ĐÃ VIẾT LẠI HOÀN TOÀN

`admin/dashboard.html` giờ **chỉ còn 9 dòng `<script>`** ở cuối `<body>`:

```html
<script src="../js/shared-config.js"></script>
<script src="../js/shared-emoji.js"></script>
<script src="../js/shared-categories.js"></script>
<script src="../js/shared-utils.js"></script>
<script src="./core/dashboard-permissions.js"></script>
<script src="https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2"></script>
<script src="https://unpkg.com/qrcode@1.5.3/build/qrcode.min.js"></script>
<script src="https://cdn.jsdelivr.net/npm/xlsx@0.18.5/dist/xlsx.full.min.js"></script>
<script src="./core/dashboard-auth.js"></script>
```

**Tại sao?** Trước đây (bản cũ hơn), toàn bộ ~15 file module được khai báo tĩnh bằng `<script>` ngay trong `dashboard.html`, xen giữa 1 file `type="module"` làm "cổng xác thực". Nhưng `<script type="module">` được trình duyệt hoãn thực thi tới khi HTML parse xong (deferred), trong khi `<script src="...">` thường thực thi NGAY khi gặp — nên các file module admin (vd `dashboard-games.js`) chạy `client.from(...)` **trước khi** biến `client`/`currentSession` được gán xong, gây treo trang ở "⏳ Đang tải dữ liệu..." và lỗi `SyntaxError` do khai báo `const`/`let` trùng lặp khi vô tình nạp 2 lần.

**Cách sửa (hiện tại):** gộp toàn bộ việc (1) tạo Supabase client, (2) kiểm tra session, (3) lấy hồ sơ `admin_users`, và (4) **tự tải các `<script>` còn lại bằng JavaScript** (`createElement('script')` + `appendChild`, tuần tự) vào **1 file duy nhất, chạy như script thường** — `admin/core/dashboard-auth.js`. Nhờ vậy không còn phụ thuộc cách trình duyệt tự sắp thứ tự thực thi module-vs-script nữa.

#### Luồng chạy của `dashboard-auth.js` (IIFE async, chạy ngay khi file được nạp):

```
a. client = supabase.createClient(url, key)
b. { data: { session } } = await client.auth.getSession()
   → không có session → location.replace("login.html")  [DỪNG]
c. SELECT id, username, display_name, role, is_active
   FROM admin_users WHERE auth_user_id = session.user.id
   → không có hồ sơ HOẶC is_active === false
     → client.auth.signOut() + redirect login.html         [DỪNG]
d. currentSession = { id, username, displayName, role, authUserId, email }
   (biến `let` khai báo Ở TOP-LEVEL của file — KHÔNG bọc trong function,
    nên các <script> thường load SAU vẫn đọc được `client`/`currentSession`
    như 1 biến toàn cục, không cần `window.` prefix)
e. client.auth.onAuthStateChange(...) — tự logout nếu bị SIGNED_OUT giữa phiên
f. injectUserBar()  — chèn avatar/tên/role/nút đăng xuất vào cuối .sidebar
g. loadRemainingDashboardScripts()  ← nạp SCRIPT_SEQUENCE rồi MODULE_SEQUENCE rồi FINAL_SCRIPT
h. (không chặn luồng) kiểm tra lại is_active 1 lần nữa, tự logout nếu vừa bị vô hiệu hoá
```

#### `SCRIPT_SEQUENCE` — nạp **tuần tự**, file sau chỉ bắt đầu tải khi file trước đã `onload` xong:

```js
const SCRIPT_SEQUENCE = [
  "./core/dashboard-page-registry.js",        // 1. window.AdminDashboard
  "./modules/inventory/inventory-shared.js",  // 2. window.Inventory (state dùng chung)
  "./modules/games/dashboard-games.js",       // 3. tự inject #gameModal, gọi loadGames() ngay
  "./modules/drinks/dashboard-drinks.js",     // 4. tự inject #drinkModal — CẦN window.Inventory
  "./modules/games/dashboard-game-detail.js", // 5. CẦN biến/hàm từ dashboard-games.js
  "./modules/membership/membership-shared.js",// 6. window.Membership (state dùng chung)
  "./modules/membership/dashboard-customers.js",        // 7. registerPage("customersPage")
  "./modules/membership/dashboard-customer-detail.js",  // 8. window.openCustomerDetailPage
  "./modules/membership/dashboard-quests.js",  // 9. window.renderQuestsTab
  "./modules/membership/dashboard-levels.js",  // 10. window.renderLevelsTab
  "./modules/orders/dashboard-orders.js",      // 11. ⚠️ MỚI — registerPage("ordersPage")
  "./modules/inventory/dashboard-ingredients.js", // 12. registerPage("ingredientsPage")
  "./core/dashboard-nav.js",                   // 13. showDashboard/showBoardgames/showDrinks
];
```

#### `MODULE_SEQUENCE` — nạp **song song** (`type="module"`, không phụ thuộc lẫn nhau), nhưng LUÔN sau khi toàn bộ `SCRIPT_SEQUENCE` đã chạy xong:

```js
const MODULE_SEQUENCE = [
  "./modules/chat/dashboard-chat.js",
  "./modules/analytics/dashboard-analytics.js",
  "./modules/banners/dashboard-banners.js",
  "./modules/media/dashboard-media.js",
  "./modules/accounts/dashboard-accounts.js",
];
```

#### `FINAL_SCRIPT` — nạp sau cùng, cần `.sidebar` đã tồn tại trong DOM (luôn đúng vào lúc này):

```js
const FINAL_SCRIPT = "./dashboard-mobile-menu.js";
```

> ⚠️ **Lưu ý khi đọc code**: `SCRIPT_SEQUENCE` đảm bảo phần thực thi **đồng bộ ở top-level** của file trước đã chạy xong (nên hàm/biến nó khai báo đã tồn tại) — nhưng **KHÔNG chờ các Promise/fetch bất đồng bộ bên trong nó hoàn tất**. Ví dụ `dashboard-games.js` gọi `loadGames();` (không `await`) ở dòng cuối — script tiếp theo (`dashboard-drinks.js`) bắt đầu tải ngay cả khi `loadGames()` chưa fetch xong dữ liệu từ Supabase.
>
> ⚠️ **Muốn thêm 1 module admin mới** → thêm đường dẫn file vào đúng vị trí trong `SCRIPT_SEQUENCE` (nếu cần biến toàn cục dạng classic script) hoặc `MODULE_SEQUENCE` (nếu dùng `import`/muốn cô lập scope) **ngay trong `admin/core/dashboard-auth.js`** — KHÔNG thêm `<script>` vào `dashboard.html` (xem Mục 20).
>
> ⚠️ Nếu 1 file trong `SCRIPT_SEQUENCE` lỗi mạng (404, CORS...), `s.onerror` chỉ `console.error` rồi **vẫn tiếp tục nạp file kế tiếp** — nghĩa là 1 module bị thiếu sẽ không chặn toàn bộ dashboard, nhưng trang/tính năng của module đó sẽ không tồn tại (im lặng, không có thông báo rõ ràng cho người dùng cuối).

### 3.2 Frontend (`index.html`)

Khác với Admin, **frontend vẫn nạp script tĩnh** trực tiếp trong HTML — nhưng thứ tự vẫn bắt buộc chính xác vì đa số các file `js/app/*.js` là **classic script chia sẻ chung global scope** (không phải module), file sau tham chiếu trực tiếp biến/hàm top-level (`let activeFilter`, `function gameIndex()`...) của file trước.

```html
<script src="js/shared-config.js"></script>       <!-- 1. window.APP_CONFIG -->
<script src="js/shared-emoji.js"></script>         <!-- 2. window.EMOJI_CATEGORIES, CHAT_EMOJIS -->
<script src="js/shared-categories.js"></script>    <!-- 3. window.GAME_CATEGORIES... -->
<script src="js/shared-utils.js"></script>         <!-- 4. escHtml, showToast, showConfirm... -->
<script src="js/data.js"></script>                 <!-- 5. window.GAMES, window.GAMES_READY (Promise) -->

<!-- ⚠️ js/app.js (bản monolith GỐC) KHÔNG còn xuất hiện ở đây — xem Mục 18.5 -->
<script src="js/app/app-state.js"></script>          <!-- 6. esc, diffClass, getCategories, gameIndex... -->
<script src="js/app/app-menu-header.js"></script>    <!-- 7. openMenu/closeMenu, updateHeader, setActive -->
<script src="js/app/app-router.js"></script>         <!-- 8. loadPage, goX(), goList/goDetail, routeFromHash -->
<script src="js/app/app-boardgame-list.js"></script> <!-- 9. renderGrid, initBoardgame — CẦN app-state -->
<script src="js/app/app-boardgame-detail.js"></script><!-- 10. renderDetail — CẦN app-state -->
<script src="js/app/app-daily-pick.js"></script>     <!-- 11. renderBanners, renderDailyPick -->
<script src="js/app/app-settings.js"></script>       <!-- 12. initSettings, saveUsernameSettings -->
<script src="js/app/app-lightbox.js"></script>       <!-- 13. openLb/closeLb -->
<script src="js/app/app-init.js"></script>            <!-- 14. chờ GAMES_READY rồi gọi routeFromHash() LẦN ĐẦU -->

<script src="js/membership.js"></script>            <!-- 15. window.initMembership -->
<script src="js/theme.js"></script>                 <!-- 16. áp theme ngay khi file load -->
<script type="module" src="js/chat.js"></script>     <!-- 17. Firebase chat — module vì dùng import + top-level await -->
```

> ⚠️ **`js/app.js`** (tài liệu gốc, single-file ~400 dòng chứa toàn bộ router+render) **vẫn còn trong repository nhưng KHÔNG được `index.html` tham chiếu nữa** — nó đã được tách thành 9 file trong `js/app/`. Coi `js/app.js` là **archive/dead code**, đừng sửa nó và mong đợi thấy hiệu ứng trên site thật (xem Mục 18.5 để biết cách xử lý triệt để).
>
> ⚠️ Nhiều file trong `js/app/` có ghi chú "**ĐÃ QUAY VỀ LOGIC ĐƠN GIẢN CỦA BẢN CŨ (ver1.2)**" — nghĩa là từng có 1 phiên bản phức tạp hơn (timeout, multi-CDN fallback, tự retry nền, lắng nghe sự kiện `tcq:games-updated`...) nhưng đã bị revert lại bản đơn giản: `js/data.js` tải dữ liệu **đúng 1 lần duy nhất**, lỗi thì chỉ `console.error` và `GAMES` giữ nguyên rỗng, không tự thử lại.
>
> ℹ️ `js/chat.js` bắt buộc phải là `type="module"` vì 2 lý do: (1) dùng `import { ... } from "https://www.gstatic.com/firebasejs/..."`, và (2) dùng **top-level `await clearChatIfNewDay();`** ở ngoài mọi hàm — cú pháp này chỉ hợp lệ trong ES module.

---

## 4. Sơ đồ kiến trúc tổng thể

```
┌────────────────────────────────────────────────────────────────────────────┐
│                              TRÌNH DUYỆT                                     │
│  ┌───────────────────────────┐    ┌────────────────────────────────────┐    │
│  │      FRONTEND (/)          │    │           ADMIN (/admin/)           │    │
│  │  index.html                │    │  login.html (Supabase Auth thật)    │    │
│  │   ├─ css/base/*.css (nạp   │    │  dashboard.html (shell tối giản)    │    │
│  │   │   riêng lẻ, KHÔNG qua  │    │   ├─ dashboard.css                  │    │
│  │   │   css/style.css)       │    │   ├─ dashboard-shared.css           │    │
│  │   ├─ css/chat.css          │    │   ├─ core/dashboard-permissions.js  │    │
│  │   ├─ js/shared-*.js        │    │   └─ core/dashboard-auth.js  ◄──────┼─┐  │
│  │   ├─ js/data.js            │    │        (tự nạp TOÀN BỘ phần còn lại  │  │
│  │   ├─ js/app/*.js (9 file)  │    │         bằng JS — xem Mục 3.1)       │  │
│  │   ├─ js/membership.js      │    │             │                        │  │
│  │   ├─ js/theme.js           │    │             ▼                        │  │
│  │   └─ js/chat.js (module)   │    │  core/page-registry, core/nav        │  │
│  │  pages/                    │    │  modules/games, drinks, inventory,   │  │
│  │   ├─ news.html             │    │  membership (+customer-detail),      │  │
│  │   ├─ boardgame.html        │    │  orders ⚠️MỚI, chat, analytics,       │  │
│  │   ├─ contact.html          │    │  banners, media, accounts            │  │
│  │   ├─ settings.html         │    │  dashboard-mobile-menu.js (cuối)     │  │
│  │   └─ membership.html       │    │                                       │  │
│  └────────────┬────────────────┘    └────────────┬──────────────────────┘  │
└───────────────┼─────────────────────────────────────┼─────────────────────────┘
                 │                                      │
       ┌─────────▼─────────┐                  ┌─────────▼─────────┐
       │     SUPABASE        │                  │      FIREBASE       │
       │   (PostgreSQL +      │                  │  Realtime Database   │
       │    Supabase Auth)     │                  │  communityChat,       │
       │  games, drinks,        │                  │  onlineUsers,          │
       │  drink_categories,      │                  │  analytics/gameViews,  │
       │  drink_ingredients,      │                  │  analytics/hourly      │
       │  ingredients,             │                  └────────────────────────┘
       │  ingredient_stock_logs,
       │  admin_users (+auth_user_id → auth.users),
       │  media_library, site_settings,
       │  customers, customer_orders, customer_order_items,
       │  membership_levels, quests, customer_quests,
       │  view v_drink_cost, RPC get_membership_by_phone
       └──────────────────────────────────────────────┘
```

---

## 5. Cấu trúc thư mục

```
project-root/
├── index.html
├── README.md
│
├── css/
│   ├── style.css              ⚠️ chỉ chứa @import — có vẻ KHÔNG còn được
│   │                              index.html nạp (xem Mục 18.5)
│   ├── chat.css
│   └── base/
│       ├── variables.css        (Mục 1: CSS variables, theme override)
│       ├── reset.css            (Mục 2: reset + focus-visible + skip-link)
│       ├── header-menu.css      (Mục 3-4: Header + Side menu)
│       ├── news-banner.css      (Mục 5-6: Banner + Daily pick)
│       ├── boardgame-list.css   (Mục 7-8: Filter bar, grid, game card)
│       ├── boardgame-detail.css (Mục 9-10: Trang chi tiết + related)
│       ├── pages.css            (Mục 11-13: Contact/Settings/Membership)
│       ├── modals.css           (Mục 13-14: Username modal + Lightbox)
│       └── responsive.css       (Mục 15-17: Footer, animation, responsive)
│
├── js/
│   ├── shared-config.js       (window.APP_CONFIG — Supabase + Firebase)
│   ├── shared-emoji.js        (window.EMOJI_CATEGORIES, CHAT_EMOJIS)
│   ├── shared-categories.js   (window.GAME_CATEGORIES, category/difficulty picker)
│   ├── shared-utils.js        (escHtml, showToast, showConfirm, showReasonPrompt,
│   │                            slugify, debounce, getYoutubeId, extractGDriveFileId,
│   │                            gdrivePreviewUrl, buildGameSlugMap)
│   ├── data.js                (fetch games + banner config — bản đơn giản, 1 lần)
│   ├── app.js                 ⚠️ MONOLITH GỐC — KHÔNG còn được index.html nạp
│   ├── app/                   ⚠️ MỚI so với README cũ — bản tách nhỏ của app.js
│   │   ├── app-state.js         (biến trạng thái + helper: esc, gameIndex...)
│   │   ├── app-menu-header.js   (side-menu mở/đóng, header 2 chế độ, setActive)
│   │   ├── app-router.js        (loadPage, goX(), goList/goDetail, routeFromHash)
│   │   ├── app-boardgame-list.js   (renderGrid, initBoardgame — filter/search)
│   │   ├── app-boardgame-detail.js (renderDetail — trang chi tiết 1 game)
│   │   ├── app-daily-pick.js    (renderBanners, renderDailyPick)
│   │   ├── app-settings.js      (initSettings, renderThemePicker, saveUsername)
│   │   ├── app-lightbox.js      (openLb/closeLb)
│   │   └── app-init.js          (bootstrap — chờ GAMES_READY rồi route lần đầu)
│   ├── membership.js           (logic trang Thẻ thành viên — window.initMembership)
│   ├── theme.js                (5 theme mùa, localStorage, data-theme trên <html>)
│   └── chat.js                 (type="module" — Firebase chat + online + analytics)
│
├── pages/                      (fragment HTML thuần, fetch() rồi nhồi vào #app)
│   ├── news.html                (banner wrap + daily pick)
│   ├── boardgame.html           (2 page con: #page-list + #page-detail)
│   ├── contact.html              (thông tin quán + gallery ảnh có lightbox)
│   ├── settings.html             (đổi tên hiển thị + theme picker)
│   └── membership.html            (tra cứu thẻ thành viên theo SĐT)
│
├── assets/                      (suy luận từ code — KHÔNG có trong tài liệu gốc)
│   ├── img/banner_001.png, banner2.jpg   (banner mặc định, fallback khi
│   │                                       chưa cấu hình site_settings)
│   └── store/store1.jpg, store2.jpg, store3.jpg  (ảnh gallery trang Liên hệ)
│
└── admin/
    ├── login.html                (CSS inline riêng — Supabase Auth thật)
    ├── dashboard.html             (SHELL — chỉ 9 dòng <script> hạ tầng)
    ├── dashboard.css               (layout tổng: sidebar, table, modal, emoji picker...)
    ├── dashboard-shared.css         (skip-link, category-picker, online-widget...)
    ├── dashboard-mobile-menu.js      (off-canvas sidebar mobile — nạp CUỐI CÙNG)
    ├── core/
    │   ├── dashboard-permissions.js   (ROLES, RESTRICTED_PAGES, canCreateOrders,
    │   │                                canViewCost, applyReadOnlyForm...)
    │   ├── dashboard-auth.js           ⚠️ MỚI — tự nạp toàn bộ Admin bằng JS
    │   ├── dashboard-page-registry.js  (window.AdminDashboard.registerPage/showPage)
    │   └── dashboard-nav.js             (3 page tĩnh: Dashboard/Boardgames/Drinks)
    └── modules/
        ├── games/
        │   ├── dashboard-games.js        (CRUD games, emoji/category picker, search)
        │   └── dashboard-game-detail.js  (trang chi tiết riêng + mã QR)
        ├── drinks/
        │   └── dashboard-drinks.js        (CRUD drinks + recipe builder)
        ├── inventory/
        │   ├── inventory-shared.js         (window.Inventory — state dùng chung)
        │   └── dashboard-ingredients.js     (CRUD ingredients + nhập/điều chỉnh kho)
        ├── membership/
        │   ├── membership-shared.js          (window.Membership — state dùng chung)
        │   ├── dashboard-customers.js         (danh sách khách — ĐÃ được tinh giản)
        │   ├── dashboard-customer-detail.js   ⚠️ MỚI — trang chi tiết 1 khách hàng
        │   ├── dashboard-quests.js             (CRUD nhiệm vụ)
        │   └── dashboard-levels.js              (cấu hình cấp độ)
        ├── orders/                              ⚠️ DOMAIN HOÀN TOÀN MỚI
        │   └── dashboard-orders.js               (tạo đơn, huỷ đơn/dòng, xuất Excel)
        ├── chat/
        │   └── dashboard-chat.js                  (type="module" — chat + tag alert)
        ├── analytics/
        │   └── dashboard-analytics.js              (type="module" — 2 biểu đồ Canvas)
        ├── banners/
        │   └── dashboard-banners.js                 (type="module" — 2 banner News)
        ├── media/
        │   └── dashboard-media.js                    (type="module" — thư viện ảnh)
        └── accounts/
            └── dashboard-accounts.js                  (type="module" — ✅ ĐÃ VÁ ĐÚNG
                                                          nội dung CRUD admin_users)
```

---

## 6. Luồng dữ liệu chính

### 6.1 Frontend — tải danh sách game
```
index.html load → js/data.js (IIFE async, chạy 1 lần)
  → import supabase-js (ESM CDN, dynamic import)
  → tạo 1 Supabase client RIÊNG (không dùng chung với membership.js)
  → Promise.all([ games.select('*').order(sort_order),
                   site_settings.select(key,value).in(['banner_1','banner_2']) ])
  → map games → window.GAMES (gán length=0 rồi push(...), GIỮ NGUYÊN reference
     mảng để các file khác đang cầm tham chiếu cũ vẫn thấy dữ liệu mới)
  → map banner rows → window.BANNER_CONFIG (đè lên 2 URL mặc định trong assets/img/)
  → LỖI thì chỉ console.error — KHÔNG timeout, KHÔNG retry, KHÔNG multi-CDN fallback
window.GAMES_READY (Promise) resolve xong
  → js/app/app-init.js: gameSlugs = buildGameSlugMap(GAMES); rebuildGameIndex();
     routeFromHash()  ← ĐÂY LÀ LẦN ĐẦU TIÊN trang thật sự được render
```

### 6.2 Frontend — router hash-based (`js/app/app-router.js`)
```
location.hash thay đổi → routeFromHash()
  '#boardgame' | '#game-{slug}'  → loadPage('boardgame') → window.initBoardgame()
                                     nếu có slug → goDetail(idx) sau 80ms (đợi DOM)
  '#contact'                     → loadPage('contact')
  '#membership'                  → loadPage('membership') → window.initMembership()
  '#settings'                    → loadPage('settings') → window.initSettings()
  (mặc định / rỗng)              → loadPage('news') → window.renderDailyPick()
```
`loadPage()` dùng `fetch('pages/*.html')` rồi `innerHTML` vào `#app` — mỗi trang là 1 HTML fragment tĩnh, không phải SPA framework thật. `app-router.js` dùng `typeof window.X === 'function'` để gọi các hàm init từ những file khác — an toàn dù chưa chắc chắn 100% thứ tự nạp.

### 6.3 Frontend — trang Thẻ thành viên
```
pages/membership.html → app-router.js::loadPage('membership') gọi window.initMembership()
js/membership.js::lookupMembership()
  → normalizePhoneVN(input) → validate regex 0\d{9,10}
  → import supabase-js → supabase.rpc('get_membership_by_phone', {p_phone})
    ⚠️ tạo 1 client MỚI mỗi lần bấm "Tra cứu" (không cache/singleton — xem Mục 18.9)
  → render #member-result: rank/icon, thanh XP (% tới cấp kế), chip ưu đãi, streak
```

### 6.4 Chat realtime + analytics
```
js/chat.js (type=module)
  → localStorage['tcq_username'] (mở modal nếu chưa có tên)
  → Firebase: set(onlineUsers/{userId}) + onDisconnect().remove()
  → onValue(onlineUsers) → cập nhật #online-count + trackHourlyOnline()
  → push(communityChat) khi gửi tin; onChildAdded lắng nghe tin mới
  → top-level await clearChatIfNewDay(): so localStorage['tcq-last-reset-day']
     với hôm nay → remove(communityChat) nếu khác ngày (CHỈ khi thực sự có data)
  → window.__fbTrack('gameViews', date, gameId, name) — gọi từ app-router.js::
     trackGameView() mỗi khi goDetail()
```
Admin đọc lại 2 nhánh `analytics/gameViews` và `analytics/hourly` trong `dashboard-analytics.js` để vẽ 2 biểu đồ **Canvas tay** (không dùng thư viện chart) + bảng chi tiết.

### 6.5 Admin — đăng nhập & khởi động (ĐÃ VIẾT LẠI, dùng Supabase Auth thật)
```
login.html
  → client.auth.signInWithPassword({ email, password })  ← Supabase Auth THẬT,
     KHÔNG còn tự hash SHA-256 rồi so sánh admin_users.password_hash như trước
  → SELECT admin_users WHERE auth_user_id = authData.user.id
    → không có hồ sơ → "Tài khoản chưa được cấp quyền quản trị" + signOut()
    → is_active === false → "Tài khoản đã bị vô hiệu hoá" + signOut()
  → UPDATE admin_users SET last_login = now() (fire-and-forget)
  → session được supabase-js TỰ LƯU (localStorage riêng của supabase-js,
    KHÔNG còn sessionStorage['bg_admin_session'] như bản cũ)
  → redirect dashboard.html

dashboard.html → core/dashboard-auth.js (xem chi tiết đầy đủ ở Mục 3.1 và Mục 10)
```

### 6.6 Admin — CRUD Boardgame
```
modules/games/dashboard-games.js load (là bước 3 trong SCRIPT_SEQUENCE)
  → injectGameModal() (IIFE, 1 lần) → appendChild #gameModal vào <body>
  → loadGames() → Supabase games.select('*').order(sort_order) → renderGames() + updateStats()
Thêm/Sửa → modal mở, emoji picker riêng (8 danh mục từ shared-emoji.js), category picker
           (chip nhiều lựa chọn từ shared-categories.js), color picker 2 chiều đồng bộ
Lưu → saveGame(): validate tên tại field (không alert) → insert/update .select()
      → PATCH mảng `games` tại chỗ bằng data trả về (KHÔNG loadGames() lại toàn bảng)
Xoá → deleteGame(): window.showConfirm() → xoá cứng (games không có FK RESTRICT nào)
      → filter mảng `games` tại chỗ
```

### 6.7 Admin — Đồ uống + Kho nguyên liệu (2 domain phối hợp qua window.Inventory)
```
modules/inventory/inventory-shared.js load TRƯỚC TIÊN trong nhóm này (bước 2)
  → window.Inventory.state = { ingredients: [], categories: [] }
  → loadIngredients(): fetch ingredients + TOÀN BỘ ingredient_stock_logs (order desc created_at)
    → giữ dòng log đầu tiên gặp mỗi ingredient_id = tồn kho hiện tại (current_stock)
  → loadCategories(): fetch drink_categories (KHÔNG có UI CRUD — quản lý trực tiếp ở Supabase)
▼
modules/drinks/dashboard-drinks.js (bước 4)
  → injectDrinkModal() (1 lần) → loadDrinks(): Promise.all([loadCategories, loadIngredients])
    → renderDrinkTabs() (tab lọc render động theo drink_categories)
    → fetch drinks (deleted_at IS NULL) → renderDrinkGrid()
  → Modal sửa/thêm: "Recipe builder" — mỗi dòng chọn 1 ingredient + số lượng/ly + hệ số quy đổi
    → updateDrinkCostPreview() dùng INVD.computeRecipeCost() để preview giá thành + lợi nhuận %
  → saveDrink(): upsert `drinks`, rồi ĐỒNG BỘ drink_ingredients (xoá hết dòng cũ theo
     drink_id → insert lại dòng mới — không UPDATE từng dòng)
  → deleteDrink(): soft delete (deleted_at + is_active=false), bắt buộc lý do
▼
modules/inventory/dashboard-ingredients.js (bước 12)
  → registerPage("ingredientsPage") — trang riêng "📦 Kho nguyên liệu", KHÔNG guard
     (mọi role đều xem được, barstaff chỉ đọc — xem Mục 9)
  → CRUD ingredients (soft delete vì drink_ingredients.ingredient_id là ON DELETE RESTRICT)
  → Modal Nhập/Điều chỉnh kho: 3 loại (import/manual_adjust/expired)
    → insert 1 dòng ingredient_stock_logs; nếu import và giá nhập khác giá cũ → hỏi có
       cập nhật unit_cost tham chiếu không
```

### 6.8 Admin — Tạo đơn hàng (domain Orders — MỚI HOÀN TOÀN, xem Mục 17 để biết chi tiết)
```
modules/orders/dashboard-orders.js (bước 11, load SAU membership-shared + Inventory)
  → registerPage("ordersPage") — nâng cấp #ordersMenuItemPlaceholder có sẵn trong HTML
  → Bấm "➕ Tạo đơn hàng mới" → mở popup 3 bước:
     Bước 1: chọn "🎫 Thành viên" hay "🚶 Khách vãng lai"
     Bước 2 (chỉ Thành viên): nhập SĐT → tra customers → không thấy thì báo, gợi ý
              sang tab Khách hàng tạo mới, hoặc chọn Khách vãng lai
     (Khách vãng lai): dùng/auto-tạo 1 hàng customers CỐ ĐỊNH
              (phone="0000136631", name="Khách vãng lai") — KHÔNG tích XP/streak/check-in
     Bước 3: chọn sản phẩm (nhiều dòng đồ uống + số lượng) + % giảm giá → preview
              tổng tiền (+lợi nhuận gộp nếu role được xem giá vốn)
  → submitOrder(): insert customer_orders → insert customer_order_items (snapshot giá,
     làm tròn round2()) → consumeStockForOrderItems() (trừ kho theo drink_ingredients,
     ghi ingredient_stock_logs log_type='order_consume', thiếu kho thì trừ về 0 + cảnh báo,
     KHÔNG chặn đơn hàng) → nếu KHÔNG phải khách vãng lai: maybeAutoCheckin() (chỉ chạy
     nếu đây là đơn ĐẦU TIÊN trong ngày của khách đó)
```

### 6.9 Admin — Huỷ đơn / huỷ dòng + Xuất Excel (domain Orders)
```
Khối "📅 Lịch sử đơn hàng" (ordersPage) → chọn khoảng ngày + tìm theo SĐT/tên
  → loadOrdersByDate(from, to): fetch customer_orders (kèm customers + order_items)
  → accordion: bấm 1 dòng đơn → xổ ra danh sách sản phẩm, có nút "Huỷ dòng"/"Huỷ cả đơn"
  → confirmVoidOrder(): bắt buộc nhập lý do
     - Huỷ 1 dòng: UPDATE customer_order_items SET is_void=true (trigger DB tự cộng
       dồn lại customers.total_spent/total_profit vì trigger gắn trên bảng này)
     - Huỷ CẢ đơn: UPDATE customer_orders SET status='voided' (trigger DB KHÔNG tự chạy
       vì không gắn trên bảng này) → code PHẢI tự SELECT lại tổng các dòng còn hợp lệ
       của khách rồi UPDATE customers.total_spent/total_profit bằng tay
  → "⬇️ Xuất Excel": dùng window.XLSX (SheetJS) xuất ĐÚNG danh sách đơn ĐANG hiển thị
     (đã lọc theo ngày + từ khoá) → 2 sheet "Dòng sản phẩm" + "Đơn hàng"; cột giá vốn/
     lợi nhuận CHỈ xuất hiện nếu canViewOrderCost === true (ẩn với barstaff)
```

---

## 7. Hướng dẫn sử dụng — Frontend

Menu `☰` (góc trái header) mở side-menu với 5 mục: **📰 Tin tức** (trang mặc định `#news` — banner + "Hôm nay chơi gì?" gợi ý ngẫu nhiên 3 game), **🎲 Luật Boardgame** (`#boardgame` — danh sách có filter theo 11 thể loại + tìm kiếm, click vào 1 game → trang chi tiết `#game-{slug}`), **📍 Thông tin liên hệ** (`#contact` — địa chỉ/hotline + gallery ảnh quán, click ảnh mở lightbox), **🎮 Thẻ thành viên** (`#membership` — nhập SĐT tra cấp độ/XP/ưu đãi), **⚙️ Cài đặt cá nhân** (`#settings` — đổi tên hiển thị chat + chọn 1 trong 5 theme mùa).

Trang chi tiết game hỗ trợ: ảnh hướng dẫn (grid, click mở lightbox), các bước chuẩn bị/lượt chơi, mẹo chơi, **PDF luật chơi** nhúng qua Google Drive preview (`games.rules_pdf_url` → `window.gdrivePreviewUrl()`), video YouTube (parse ID qua `window.getYoutubeId()`, hỗ trợ 4 dạng URL), và danh sách game liên quan cùng thể loại.

Chat cộng đồng (nút tròn góc dưới phải) — cần đặt tên hiển thị lần đầu, có emoji picker riêng (80 emoji phẳng từ `window.CHAT_EMOJIS`), tự xoá lịch sử mỗi ngày mới, tự cập nhật badge "chưa đọc" khi có tin từ staff mà đang đóng cửa sổ chat.

## 8. Hướng dẫn sử dụng — Admin Dashboard

Đăng nhập tại `admin/login.html` bằng **email + mật khẩu** (Supabase Auth thật — xem Mục 10). Sau đăng nhập, sidebar hiển thị các mục theo đúng quyền hạn của role (xem bảng đầy đủ ở Mục 9).

- **📊 Dashboard**: thống kê nhanh (tổng game/đồ uống/game có YouTube/có ảnh) + widget số người đang online (đồng bộ 1 chiều từ trang Cộng đồng qua `MutationObserver`, không tự fetch riêng).
- **🎲 Boardgames / ☕ Đồ uống**: CRUD qua modal tự inject. Đồ uống có **recipe builder** thật — chọn nguyên liệu từ kho, preview giá thành/lợi nhuận gộp % ngay trong modal trước khi lưu.
- **🧾 Đơn hàng** (MỚI): tạo đơn hàng thật cho Thành viên hoặc Khách vãng lai, tra cứu lịch sử theo khoảng ngày/SĐT/tên, huỷ đơn/huỷ dòng (bắt buộc lý do), xuất Excel 2 sheet. Xem Mục 17.
- **💬 Cộng đồng**: chat 2 chiều với khách, phát hiện & highlight tin nhắn "tag quán", sidebar "Tag quán" + "Trả lời nhanh" (bottom-sheet trên mobile), Notification API khi có tag mới.
- **📈 Thống kê**: chọn khoảng ngày (hôm nay/7 ngày/tuỳ chọn), 2 biểu đồ Canvas tay (top game xem nhiều, online theo giờ) + bảng chi tiết tỷ lệ %.
- **📦 Kho nguyên liệu**: CRUD nguyên liệu + nhập kho/điều chỉnh/hao hụt qua log chỉ-insert, cảnh báo dưới ngưỡng tối thiểu, tổng giá trị tồn kho ước tính.
- **🎮 Khách hàng** *(chỉ Super Admin)*: 3 tab — Danh sách (bấm "🔍 Chi tiết" mở trang riêng xem lịch sử đơn + EXP, KHÔNG còn tạo đơn ở đây nữa), Nhiệm vụ, Cấp độ.
- **🖼️ Banners / 🗂️ Thư viện Media** *(ẩn với Bar Staff)*: quản lý 2 banner trang News; thư viện link ảnh (tự nhận & chuyển link Google Drive), chỉ Super Admin xoá được.
- **👤 Quản lý tài khoản** *(chỉ Super Admin)*: xem/sửa role, vô hiệu hoá/kích hoạt lại tài khoản. **⚠️ Đọc Mục 18.1 trước khi bấm "+ Thêm tài khoản"** — tài khoản tạo qua đây hiện chưa đăng nhập được ngay.

---

## 9. Hệ thống phân quyền (Permissions) chi tiết

3 role, định nghĩa DUY NHẤT tại `admin/core/dashboard-permissions.js`:

| Role | Màu | Mô tả |
|---|---|---|
| `superadmin` | `#6c5ce7` | Toàn quyền, thấy mọi trang, sửa được mọi thứ |
| `editor` | `#00b894` | Sửa được nội dung (game/đồ uống/kho), nhưng KHÔNG thấy Khách hàng & Quản lý tài khoản |
| `barstaff` | `#0984e3` | Chỉ xem hầu hết mọi nơi (trừ ngoại lệ Đơn hàng), không thấy Banners/Media/Khách hàng/Tài khoản |

### 9.1 Bảng hiển thị trang theo role (đã kiểm chứng từng dòng `registerPage()` trong code)

| Trang | superadmin | editor | barstaff | Cơ chế chặn thực tế |
|---|:---:|:---:|:---:|---|
| Dashboard | ✅ | ✅ | ✅ | Trang tĩnh, không guard |
| Boardgames | ✅ sửa | ✅ sửa | 👁️ chỉ xem | `isReadOnly()` chỉ gate hành động, KHÔNG ẩn trang |
| Đồ uống | ✅ sửa | ✅ sửa | 👁️ chỉ xem | như trên |
| Kho nguyên liệu | ✅ sửa | ✅ sửa | 👁️ chỉ xem | `registerPage()` KHÔNG có `guard` — ai cũng thấy trang |
| Đơn hàng | ✅ đầy đủ | ✅ đầy đủ | ✅ tạo được / ❌ huỷ / ❌ thấy giá vốn | 3 cờ ĐỘC LẬP: `isReadOnly`, `canCreateOrders`, `canViewCost` |
| Cộng đồng (Chat) | ✅ | ✅ | ✅ | Không guard |
| Thống kê | ✅ | ✅ | ✅ | Không guard |
| Banners | ✅ | ✅ | ❌ | `can(role,"bannersPage")` qua `RESTRICTED_PAGES` |
| Thư viện Media | ✅ | ✅ | ❌ (xoá ảnh: chỉ superadmin) | như trên |
| Khách hàng (Membership) | ✅ | ❌ | ❌ | `guard: () => isSuperAdmin` — **KHÔNG qua `RESTRICTED_PAGES`** |
| Quản lý tài khoản | ✅ | ❌ | ❌ | `guard: () => isSuperAdmin` — **KHÔNG qua `RESTRICTED_PAGES`** |

> ⚠️ Lưu ý quan trọng khi đọc code: `RESTRICTED_PAGES.editor = []` (mảng RỖNG) — nghĩa là cơ chế `can(role, pageId)` **mặc định CHO PHÉP editor xem mọi trang dùng cơ chế này**, trừ khi trang đó tự thêm 1 guard RIÊNG nghiêm ngặt hơn (như Khách hàng/Tài khoản đang làm với `guard: () => isSuperAdmin`). Khi thêm trang admin mới nhạy cảm, đừng chỉ dựa vào `can()` + `RESTRICTED_PAGES` — hãy tự hỏi "editor có nên thấy cái này không", nếu không thì viết guard trực tiếp như 2 trang trên.

### 9.2 3 cờ quyền hạn độc lập cho riêng domain Đơn hàng (`dashboard-permissions.js`)

```js
const READONLY_ROLES            = ["barstaff"];  // chỉ xem, không sửa/xoá — áp dụng CHUNG mọi nơi
const ORDER_CREATE_EXTRA_ROLES  = ["barstaff"];  // NGOẠI LỆ: role read-only này vẫn được TẠO đơn
const COST_HIDDEN_ROLES         = ["barstaff"];  // role này KHÔNG được thấy giá vốn/lợi nhuận

isReadOnly(role)       // true nếu role chỉ được xem (áp dụng huỷ đơn/huỷ dòng — KHÔNG có ngoại lệ)
canCreateOrders(role)  // true nếu KHÔNG thuộc READONLY_ROLES, HOẶC thuộc nhưng có trong ORDER_CREATE_EXTRA_ROLES
canViewCost(role)      // true nếu KHÔNG thuộc COST_HIDDEN_ROLES
```
Kết quả thực tế với cấu hình hiện tại: **barstaff tạo được đơn hàng, nhưng không huỷ được và không thấy giá vốn/lợi nhuận** ở bất kỳ đâu trong domain Đơn hàng. Vì `READONLY_ROLES` và `ORDER_CREATE_EXTRA_ROLES` hiện trùng nhau 100% (`["barstaff"]`), `canCreateOrders()` **luôn trả về `true` cho cả 3 role hiện có** — cơ chế 2 danh sách tách biệt này chỉ thật sự có ý nghĩa khi trong tương lai xuất hiện 1 role read-only KHÁC mà bạn muốn chặn hẳn việc tạo đơn (chỉ cần KHÔNG thêm role đó vào `ORDER_CREATE_EXTRA_ROLES`).

### 9.3 `applyReadOnlyForm(container, opts)` — hàm khoá/mở form DUY NHẤT

Dùng chung cho mọi modal/trang chi tiết (Game, Đồ uống, Chi tiết Game): disable toàn bộ `input/textarea/select` trong `container`, ẩn nút Lưu, ẩn/hiện nút Xoá theo `deleteBtn.dataset.wasVisible` (phân biệt "đang thêm mới" và "đang sửa"). Không viết lại logic khoá form ở module mới — luôn gọi hàm này.

---

## 10. Xác thực Admin — Login → Session → Nạp script

Đây là phần **thay đổi kiến trúc lớn nhất** so với các phiên bản trước, nên tách thành mục riêng dù đã nhắc ở Mục 3 và 6.5.

### 10.1 Trước đây (không còn đúng — chỉ để hiểu lịch sử)
`login.html` tự hash SHA-256 mật khẩu (Web Crypto API) → so khớp thủ công với cột `admin_users.password_hash` → lưu session vào `sessionStorage['bg_admin_session']`.

### 10.2 Hiện tại
`login.html` gọi thẳng **`client.auth.signInWithPassword({ email, password })`** — xác thực do **Supabase Auth** xử lý hoàn toàn (bảng nội bộ `auth.users`, không phải `admin_users`). Sau khi xác thực Auth thành công, code mới **query tiếp** bảng `admin_users` bằng cột **`auth_user_id`** (kiểu `uuid`, FK trỏ `auth.users.id`) để lấy `role`/`display_name`/`is_active` — đây là bước "map" từ 1 tài khoản đăng nhập Supabase Auth sang 1 hồ sơ nhân viên trong hệ thống riêng của app.

Session giờ do **supabase-js tự quản lý** (lưu trong `localStorage` dưới key riêng của thư viện, refresh token tự động) — **không còn** `sessionStorage['bg_admin_session']`.

`admin/core/dashboard-auth.js` (chạy trên mọi trang trong `admin/dashboard.html`) lặp lại đúng bước "lấy session → tra `admin_users` theo `auth_user_id`" này ở mỗi lần tải trang, và **subscribe** `client.auth.onAuthStateChange` để tự đăng xuất ngay khi phiên bị huỷ ở nơi khác (vd token hết hạn, hoặc bị thu hồi).

### 10.3 Hệ quả quan trọng — xem đầy đủ ở Mục 18.1
Cột `admin_users.password_hash` (SHA-256) giờ **hoàn toàn không còn được dùng để đăng nhập** — nó chỉ còn được `dashboard-accounts.js::saveAccount()` ghi vào khi tạo/sửa tài khoản qua UI, nhưng **giá trị đó không có tác dụng gì với việc đăng nhập thật** (Supabase Auth lưu mật khẩu ở nơi khác, có cơ chế riêng, không đọc cột này). Đây là nguồn gốc của lỗ hổng vận hành nghiêm trọng nhất hiện tại của dự án.

---

## 11. Chú thích từng file

### 11.1 Frontend — gốc & CSS

| File | Mô tả |
|---|---|
| `index.html` | Shell trang khách — header, side-menu, `#app` (nơi router nhồi HTML fragment), lightbox, username modal, chat widget. Nạp CSS **riêng lẻ** từ `css/base/*.css` (không qua `css/style.css`) + `css/chat.css`, rồi 17 dòng `<script>` theo đúng thứ tự Mục 3.2. |
| `css/style.css` | Chỉ chứa 9 dòng `@import url("base/*.css")`. ⚠️ **Có vẻ không còn được `index.html` tham chiếu** — xem Mục 18.5. |
| `css/chat.css` | Toàn bộ style widget chat nổi (nút tròn, cửa sổ, bong bóng tin nhắn, emoji picker riêng của chat — khác `.emoji-picker` bên admin). Responsive `@media(max-width:600px)`. |
| `css/base/variables.css` | Toàn bộ CSS custom properties: màu, `--z-*` (thang z-index chuẩn hoá), bo góc, shadow, font, override theo `html[data-theme="..."]` cho 4 theme mùa (Giáng Sinh/Halloween/Valentine/Tôi Yêu Việt Nam). |
| `css/base/reset.css` | Reset cơ bản + `:focus-visible` toàn cục (WCAG 2.4.7) + `.skip-link` + `.sr-only` + `prefers-reduced-motion`. |
| `css/base/header-menu.css` | Header sticky (search box chỉ hiện ở trang boardgame) + Side menu off-canvas (`#side-menu`, `#menu-overlay`). |
| `css/base/news-banner.css` | Banner full-width trang News + card "Hôm nay chơi gì?" (Daily pick). |
| `css/base/boardgame-list.css` | Filter bar sticky (chip lọc) + grid game card. |
| `css/base/boardgame-detail.css` | Hero banner, các section (mục tiêu/chuẩn bị/lượt chơi/thắng/PDF/mẹo/video), related games. |
| `css/base/pages.css` | Trang Contact, Settings (+ theme picker), Membership (thẻ hạng/thanh XP/ưu đãi). |
| `css/base/modals.css` | Username modal + Lightbox. Dialog xác nhận (`showConfirm`/`showReasonPrompt`) tự inject CSS riêng trong `shared-utils.js`, KHÔNG đặt ở đây. |
| `css/base/responsive.css` | Footer, animation dùng chung (`fadeUp`/`fadeIn`/`bounceIn`), toàn bộ `@media` breakpoint (768px/660px). |

### 11.2 Frontend — `js/` (shared + data)

| File | Mô tả |
|---|---|
| `js/shared-config.js` | Nơi DUY NHẤT chứa `window.APP_CONFIG` (`Object.freeze`) — Supabase URL/anon key + Firebase config object. Phải load đầu tiên, **plain script** (không `type="module"`) để cả script thường lẫn module đều đọc được. |
| `js/shared-emoji.js` | `window.EMOJI_CATEGORIES` (8 danh mục, admin emoji picker) + `window.CHAT_EMOJIS` (80 emoji phẳng, chat khách) + `window.ALL_EMOJIS`/`window.UNIQUE_EMOJIS` (flatten để search). |
| `js/shared-categories.js` | `window.GAME_CATEGORIES` (11 thể loại) + `window.DIFFICULTY_LEVELS`; `renderCategoryPicker()`/`getSelectedCategories()` (chip chọn nhiều) + `populateDifficultySelect()` — dùng chung frontend (chip lọc) và admin (modal game). |
| `js/shared-utils.js` | `escHtml`, `formatTime`, `formatDateVN`, `slugify`, `debounce`, `showToast`, `showConfirm` (Promise\<boolean\>), `showReasonPrompt` (Promise\<string\|null\> — có ô nhập lý do bắt buộc), `getYoutubeId` (4 dạng URL), `extractGDriveFileId` + `gdrivePreviewUrl`, `buildGameSlugMap`. Không có test/tool nào khác được phép dùng `alert()/confirm()/prompt()` thay vì các hàm này. |
| `js/data.js` | **Bản đơn giản hoá** — 1 lần fetch `games` + `site_settings` (banner) song song, KHÔNG timeout/retry/fallback CDN. `window.GAMES`/`window.GAMES_READY`/`window.BANNER_CONFIG`. Gán lại `GAMES.length=0` rồi `push(...)` để giữ nguyên reference mảng. |
| `js/app.js` | ⚠️ **File monolith gốc trước khi tách nhỏ** (~400 dòng, chứa mọi thứ trong `js/app/`). KHÔNG còn được `index.html` nạp — xem Mục 18.5. |
| `js/membership.js` | Toàn bộ logic trang "Thẻ thành viên" phía khách — `normalizePhoneVN`, gọi RPC `get_membership_by_phone`, render thẻ hạng/XP/ưu đãi/streak. Tạo **client Supabase mới mỗi lần bấm tra cứu** (xem Mục 18.9). Export `window.initMembership()`. |
| `js/theme.js` | `window.TCQ_THEMES` (5 theme), `getCurrentTheme()`/`applyTheme()` đọc/ghi `localStorage['tcq_theme']`, set `data-theme` trên `<html>`. Tự áp theme ngay khi file load (trước cả DOM sẵn sàng) để tránh nháy màu (FOUC). |
| `js/chat.js` | (`type="module"`) Kết nối Firebase (SDK 10.12.2), username modal, mở/đóng cửa sổ chat + emoji picker riêng, gửi/nhận `communityChat`, đếm `onlineUsers`, top-level `await clearChatIfNewDay()`, expose `window.__fbTrack()` cho router ghi lượt xem game + `trackHourlyOnline()`. |

### 11.3 Frontend — `js/app/` (⚠️ MỚI so với các bản trước — bản tách nhỏ của `js/app.js`)

| File | Export ra `window` | Mô tả |
|---|---|---|
| `app-state.js` | *(không export — biến top-level dùng chung)* | `activeFilter`, `searchQ`, `currentIdx`, `gameSlugs`, `gameIndexById`; helper `esc`, `diffClass`, `getCategories`, `rebuildGameIndex`, `gameIndex` (tra index O(1) qua `Map` thay vì `GAMES.indexOf()` O(n)), `ensureGameIndexBuilt()`. |
| `app-menu-header.js` | *(không export tường minh)* | `menuToggle`/`sideMenu`/`menuOverlay`, `openMenu`/`closeMenu`, `updateHeader(type)` (chuyển header giữa chế độ News/Boardgame), `setActive(fn)` (đánh dấu menu item active theo tên hàm điều hướng). |
| `app-router.js` | `loadPage`, `routeFromHash`, `goNews/goBoardgame/goContact/goSettings/goMembership`, `goList`, `goDetail` | Router hash-based đầy đủ + `trackGameView()`. Có kiểm tra `typeof window.X === 'function'` trước khi gọi hàm init từ file khác (phòng thứ tự nạp lệch). |
| `app-boardgame-list.js` | `initBoardgame`, `renderGrid` | Lọc theo chip + tìm kiếm (debounce 150ms), render grid `#grid`. |
| `app-boardgame-detail.js` | `renderDetail` | Render toàn bộ trang chi tiết 1 game (hero, mục tiêu, ảnh, setup/turn, PDF, tips, video, related games cùng thể loại). |
| `app-daily-pick.js` | `renderDailyPick`, `renderBanners` | Banner trang News + 3 game ngẫu nhiên "Hôm nay chơi gì?" (có nút "🎲 Thử 3 game khác" re-roll không cần tải lại). |
| `app-settings.js` | `initSettings`, `saveUsernameSettings` | Trang Cài đặt — lưu tên hiển thị chat + render/bind theme picker (dùng `window.TCQ_THEMES`). |
| `app-lightbox.js` | `openLb`, `closeLb` | Mở/đóng lightbox xem ảnh phóng to (dùng chung trang chi tiết game + trang Liên hệ). Lắng nghe `Escape` để đóng. |
| `app-init.js` | *(không export)* | Bootstrap — `window.GAMES_READY.then(() => { build slug map + index; routeFromHash(); })` — điểm khởi động DUY NHẤT của toàn bộ app. |

### 11.4 Frontend — `pages/` (fragment HTML)

| File | Mô tả |
|---|---|
| `pages/news.html` | `#news-banners-wrap` (render động bởi `renderBanners()`) + section "🎲 Hôm nay chơi gì?" (`#daily-pick-card`). |
| `pages/boardgame.html` | 2 page con trong 1 file: `#page-list` (filter-bar 11 chip + `#grid` + empty state) và `#page-detail` (breadcrumb, hero, các `d-*` section, related games) — chuyển đổi bằng class `.page`/`.page.active`. |
| `pages/contact.html` | Thông tin quán + `.contact-gallery` 3 ảnh, mỗi ảnh có `alt` mô tả, `tabindex="0"`, `onclick`/`onkeydown` gọi `openLb()` (tái dùng lightbox của trang chi tiết game). |
| `pages/settings.html` | Ô đổi tên hiển thị chat (`#settings-username`) + `#theme-picker` (render bởi `renderThemePicker()`). |
| `pages/membership.html` | Ô nhập SĐT (`inputmode="tel"`, `maxlength="14"`) + nút "🔍 Tra cứu" + `#member-result`. |

### 11.5 Admin — gốc & core

| File | Mô tả |
|---|---|
| `admin/login.html` | Trang login độc lập, CSS inline riêng (không dùng `dashboard.css`). Gọi `client.auth.signInWithPassword()` (Supabase Auth thật — xem Mục 10), map sang hồ sơ `admin_users` qua `auth_user_id`, chặn nếu `is_active=false` hoặc chưa có hồ sơ. Session do supabase-js tự lưu. Nếu đã có session hợp lệ → tự redirect thẳng `dashboard.html` khi vừa mở trang. |
| `admin/dashboard.html` | SHELL tối giản — sidebar (2 menu-group: "Hệ thống" 5 mục tĩnh/placeholder, "Quản trị" chỉ có 1 mục "⚙️ Settings" tĩnh chưa gắn chức năng gì, dùng làm điểm neo mặc định cho `registerPage()`) + 3 page tĩnh (Dashboard/Boardgames/Drinks) + đúng 9 dòng `<script>` hạ tầng (xem Mục 3.1). KHÔNG còn modal HTML tĩnh nào — tất cả do module JS tự inject. |
| `admin/dashboard.css` | Layout tổng: sidebar, main-content, stat-card, table, modal, emoji picker admin (8 danh mục có search), responsive mobile menu (`≤900px`), trang chat admin kiểu Messenger (`≤860px`). |
| `admin/dashboard-shared.css` | Phần CSS dùng chung: skip-link, `:focus-visible`, section-divider, `.cat-chip` (category picker), color-row, menu-group-label, menu-sub-item/menu-item-parent (giữ lại dù hiện không dùng submenu), online-widget, style riêng `#drinkModal select`. |
| `admin/dashboard-mobile-menu.js` | IIFE — đóng/mở sidebar off-canvas trên mobile (`≤900px`), đóng khi chọn menu-item lá (không đóng khi bấm mục có submenu), đóng khi resize sang desktop. **Nạp CUỐI CÙNG** (`FINAL_SCRIPT`), cần `.sidebar` đã tồn tại — luôn đúng vào thời điểm này. |
| `admin/core/dashboard-permissions.js` | `ROLES`, `RESTRICTED_PAGES`, `READONLY_ROLES`, `ORDER_CREATE_EXTRA_ROLES` ⚠️MỚI, `COST_HIDDEN_ROLES` ⚠️MỚI. `can(role,pageId)` default-deny nếu role lạ. `isReadOnly`, `canCreateOrders` ⚠️MỚI, `canViewCost` ⚠️MỚI, `applyReadOnlyForm()` — xem Mục 9. |
| `admin/core/dashboard-auth.js` | ⚠️ **VIẾT LẠI HOÀN TOÀN** — xem Mục 3.1 và Mục 10 để hiểu đầy đủ. Chứa `SCRIPT_SEQUENCE`/`MODULE_SEQUENCE`/`FINAL_SCRIPT`, hàm `loadScriptsSequentially()`, `injectUserBar()`, `logout()`. |
| `admin/core/dashboard-page-registry.js` | `window.AdminDashboard.registerPage({...})` — tạo/nâng cấp menu item + gắn `onclick` gọi `showPage()`; `showPage()` ẩn hết `div[id$="Page"]` rồi hiện đúng 1 page + đánh dấu active + gọi `onShow`. `window.__showPage(pageId)` — bản rút gọn tương thích ngược (KHÔNG đổi active menu), dùng bởi `dashboard-nav.js` cho 3 page tĩnh. |
| `admin/core/dashboard-nav.js` | CHỈ xử lý 3 page TĨNH có sẵn trong HTML: `showDashboard()`, `showBoardgames()`, `showDrinks(cat)`, `filterDrinks(cat, btnEl)`. Đồng bộ `#adminOnlineCount` (do chat module cập nhật) → `#dashOnlineCount` bằng `MutationObserver` (không polling). |

### 11.6 Admin — `modules/games/`

| File | Mô tả |
|---|---|
| `dashboard-games.js` | Tự inject `#gameModal` (emoji picker 8 danh mục + search, category picker chip, color picker 2 chiều `addEventListener`). `loadGames()`/`renderGames()`/`updateStats()`. Search debounce 200ms (`window.debounce`). `saveGame()`/`deleteGame()` PATCH mảng `games` tại chỗ bằng data `.select()` trả về — không refetch toàn bảng. Gọi `loadGames()` ngay khi file chạy (dòng cuối file). Expose `window.getGameById`, `window.loadGames`. |
| `dashboard-game-detail.js` | Trang chi tiết riêng (không phải modal), kèm mã QR (thư viện `QRCode` CDN) dẫn `SITE_BASE_URL#game-{slug}` (hằng số hardcode `https://shisha001-dotcom.github.io/the-coffee-quest/` — xem Mục 24 gợi ý đưa vào config), tự vẽ lại QR nếu tên game đổi (đổi slug). Có UI báo lỗi rõ ràng nếu thư viện QRCode chưa tải được (`showQrLoadError`). Dùng `window.getYoutubeId` dùng chung với frontend. Cần biến/hàm từ `dashboard-games.js` load trước (`games`, `isGamesReadOnly`, `parseLines`, `parseImages`...). |

### 11.7 Admin — `modules/drinks/` & `modules/inventory/`

| File | Mô tả |
|---|---|
| `dashboard-drinks.js` | Xem Mục 6.7. Recipe builder động (thêm/xoá dòng nguyên liệu), category dropdown render động từ `drink_categories`, soft delete bắt buộc lý do. |
| `inventory-shared.js` | `window.Inventory.state = {ingredients, categories}`. `loadIngredients()` suy tồn kho từ log mới nhất (KHÔNG có cột `current_stock` trực tiếp trên bảng `ingredients`). `computeRecipeCost(rows)` — preview giá thành client-side, KHÔNG dùng để lưu (giá thành thật snapshot lúc tạo đơn, xem Mục 17). |
| `dashboard-ingredients.js` | Trang "📦 Kho nguyên liệu" — CRUD `ingredients` (soft delete) + modal Nhập/Điều chỉnh kho (3 loại: `import`/`manual_adjust`/`expired`), cảnh báo dưới `min_stock_qty`, tổng giá trị tồn kho ước tính. Không có `guard` → hiển thị cho MỌI role. |

### 11.8 Admin — `modules/membership/`

| File | Mô tả |
|---|---|
| `membership-shared.js` | `window.Membership` — state `{customers, levels, quests}`, helper thuần: `getLevelForXp`, `getLevelInfo`, `getNextLevelInfo`, `getCheckinQuest()` (trả về quest hệ thống `is_checkin=true` duy nhất), `formatVND`, `getISOWeek`/`periodKeyFor`, `normalizePhone`, `clearFieldError`/`showFieldError`, 3 hàm fetch cập nhật state (`loadCustomers/loadLevels/loadQuests` — tất cả filter `deleted_at IS NULL`, chỉ chạy nếu `isSuperAdmin`). Phải load đầu tiên trong domain (bước 6). |
| `dashboard-customers.js` | ⚠️ **ĐÃ ĐƯỢC TINH GIẢN ĐÁNG KỂ** — phần "Tạo đơn hàng" đã chuyển hẳn sang `modules/orders/`; phần "Huỷ đơn/huỷ dòng" cũng vậy; modal "Chi tiết khách hàng" đã bỏ hẳn, thay bằng trang riêng (`dashboard-customer-detail.js`); khối "tick tiến độ nhiệm vụ" đã **bỏ hẳn không thay thế** (xem Mục 18.4 — hiện không còn UI nào để cộng tiến độ 1 nhiệm vụ thường cho khách). File này giờ chỉ còn: 3-tab layout (Danh sách/Nhiệm vụ/Cấp độ), bảng danh sách khách hàng, modal thêm khách mới, xoá khách hàng (soft delete). `guard: () => isSuperAdmin`. |
| `dashboard-customer-detail.js` | ⚠️ **FILE MỚI HOÀN TOÀN** — trang riêng kiểu `gameDetailPage` (giữ sidebar, có nút "← Quay lại"), gồm: summary box (thanh XP, streak, tổng chi tiêu/lợi nhuận), bảng "🧾 Lịch sử đơn hàng" (accordion CHỈ XEM — không có nút huỷ ở đây, muốn huỷ phải sang tab Đơn hàng), bảng "⭐ Lịch sử EXP" (từ `customer_quests` đã hoàn thành). Export `window.openCustomerDetailPage(customerId)`. |
| `dashboard-quests.js` | Tab "🗺️ Nhiệm vụ" — CRUD `quests`. Quest `is_checkin=true` hiển thị khoá 🔒, không cho sửa/tắt/xoá (chặn ở cả UI lẫn hàm xử lý). Xoá = soft delete bắt buộc lý do (vì `customer_quests.quest_id` là `ON DELETE RESTRICT`). Export `window.renderQuestsTab()`. |
| `dashboard-levels.js` | Tab "🏆 Cấp độ" — bảng sửa trực tiếp `membership_levels`, validate XP tăng dần nghiêm ngặt theo cấp + % giảm giá 0–100 trước khi `upsert` hàng loạt, sau khi lưu gọi lại `loadLevels()` + `window.loadCustomers()` để đồng bộ tab Danh sách. Export `window.renderLevelsTab()`. |

### 11.9 Admin — `modules/orders/` ⚠️ DOMAIN HOÀN TOÀN MỚI

| File | Mô tả |
|---|---|
| `dashboard-orders.js` | Xem Mục 17 (mô tả domain đầy đủ) và Mục 6.8/6.9 (luồng dữ liệu). File dài nhất trong `modules/`, chứa: popup tạo đơn 3 bước, khách vãng lai singleton, cache đồ uống + giá vốn (`orderDrinksCache` từ view `v_drink_cost`), draft rows động, tính preview client-side (`round2`), submit đơn + trừ kho + auto check-in, bảng lịch sử theo ngày có accordion + tìm kiếm, modal huỷ đơn/huỷ dòng, xuất Excel (SheetJS). Đây là file **KHÔNG có `import`, chạy như classic script** (nằm trong `SCRIPT_SEQUENCE`, không phải `MODULE_SEQUENCE`) nên mọi `function` top-level tự động thành `window.X` — không cần dòng `window.X = X` tường minh ở cuối file (khác với `dashboard-drinks.js` vốn có exports tường minh dù cùng là classic script — chỉ là khác biệt phong cách viết, không phải khác biệt kỹ thuật). |

### 11.10 Admin — `modules/chat/`, `modules/analytics/`, `modules/banners/`, `modules/media/`, `modules/accounts/` (đều `type="module"`)

| File | Mô tả |
|---|---|
| `dashboard-chat.js` | Trang "💬 Cộng đồng" — lịch sử chat 2 chiều, phát hiện & highlight tag quán (`TAG_PATTERN` regex), sidebar "Tag quán" + "Trả lời nhanh" (bottom-sheet mobile `≤860px`), badge unread trên menu item, Notification API khi có tag mới, xoá chat qua `showConfirm()`. `placeholderId: "chatMenuItemPlaceholder"` — nâng cấp phần tử tĩnh có sẵn trong HTML. |
| `dashboard-analytics.js` | Trang "📈 Thống kê" — chọn khoảng ngày, fetch song song `analytics/gameViews` + `analytics/hourly` (Firebase) theo từng ngày, vẽ 2 biểu đồ **Canvas tay** (bar chart top game, line chart online theo giờ — KHÔNG dùng thư viện chart ngoài) + bảng chi tiết %. |
| `dashboard-banners.js` | Trang "🖼️ Banners" — 2 banner (`banner_1`/`banner_2`) lưu `site_settings` dạng JSON `{url,visible}`, preview ảnh trực tiếp, toggle switch ẩn/hiện, `guard` chặn Bar Staff. |
| `dashboard-media.js` | Trang "🗂️ Thư viện Media" — lưu link ảnh (tự nhận & chuyển link Google Drive sang `lh3.googleusercontent.com` qua `window.extractGDriveFileId()` dùng chung), gắn tag lọc, ước tính dung lượng qua HEAD request (cache theo URL, best-effort vì phụ thuộc CORS), copy/tải ảnh, chỉ Super Admin xoá được, `guard` chặn Bar Staff. Có kèm SQL DDL tạo bảng `media_library` ngay trong comment cuối file. |
| `dashboard-accounts.js` | ✅ **ĐÃ ĐƯỢC VÁ ĐÚNG NỘI DUNG** — CRUD `admin_users` thật: thêm/sửa tài khoản, đổi role, **vô hiệu hoá** (`is_active=false`, bắt buộc lý do qua `showReasonPrompt`, không tự vô hiệu hoá được chính mình) thay vì xoá cứng (migration V3), kích hoạt lại. `guard: () => isSuperAdmin`. **⚠️ Xem Mục 18.1 — tài khoản tạo qua UI này chưa đăng nhập được ngay do chưa tạo kèm Supabase Auth user + `auth_user_id`.** |

---

## 12. Database Schema

> Ghi chú: schema dưới đây được **suy ra từ cách code đọc/ghi** (payload insert/update, `.select()`, filter, RPC) — không phải file SQL DDL gốc (trừ bảng `media_library` có DDL thật trong comment code). Kiểu dữ liệu là gợi ý Postgres phổ biến tương ứng giá trị JS.

### 12.1 `games`
| Cột | Kiểu gợi ý | Ghi chú |
|---|---|---|
| `id` | `bigint` PK, identity | |
| `name` | `text` NOT NULL | bắt buộc khi lưu |
| `emoji` | `text` | mặc định `"🎲"` |
| `color` | `text` | mã hex, mặc định `"#6c5ce7"` |
| `categories` | `text[]` | giá trị lấy từ `window.GAME_CATEGORIES` (không ràng buộc enum DB) |
| `players`, `time` | `text` | dạng tự do (`"2-4 người"`, `"30-60 phút"`) |
| `difficulty` | `text` | `"Dễ"/"Trung bình"/"Khó"` (UI tự thêm option lạ nếu data cũ không khớp) |
| `objective`, `win` | `text` | mục tiêu / điều kiện thắng |
| `setup`, `turn`, `tips` | `text[]` | mỗi phần tử = 1 dòng textarea |
| `images` | `jsonb` `{url,caption}[]` | |
| `youtube_url` | `text` | FE tự parse ID qua `getYoutubeId()` |
| `hero_bg` | `text` | URL ảnh nền hero |
| `rules_pdf_url` | `text` | link Drive → tự chuyển `/preview` để nhúng iframe |
| `sort_order` | `integer` | `null` nếu để trống |

Không có cột soft-delete — xoá game là xoá cứng (không bảng nào FK tới `games.id`).

### 12.2 `drink_categories`
| Cột | Ghi chú |
|---|---|
| `id` (PK), `name`, `icon`, `color`, `sort_order` | Tham chiếu bởi `drinks.category_id`. **Không có UI CRUD trong app** — thêm/sửa/xoá loại đồ uống hiện phải làm trực tiếp trên Supabase. |

### 12.3 `drinks`
| Cột | Ghi chú |
|---|---|
| `id`, `name` NOT NULL, `category_id` FK NOT NULL | |
| `emoji` (mặc định `"☕"`), `price` NOT NULL `>0`, `is_active` | |
| `description`, `steps text[]`, `tips text[]`, `image_url`, `sort_order` | |
| `created_by`/`updated_by` | tên hiển thị nhân viên |
| `deleted_at`/`deleted_reason`/`deleted_by` | soft delete — mọi SELECT lọc `is('deleted_at', null)` |
| ~~`ingredients` (text tự do)~~ | đã bỏ, thay bằng `drink_ingredients` |

### 12.4 `drink_ingredients` (N-N — công thức pha chế thật)
| Cột | Ghi chú |
|---|---|
| `id`, `drink_id` FK | mỗi lần lưu: **xoá hết dòng cũ theo `drink_id` rồi insert lại toàn bộ** (không UPDATE từng dòng) |
| `ingredient_id` FK | |
| `qty_per_serving` | số lượng nguyên liệu / 1 ly, theo đơn vị công thức |
| `unit` | có thể khác đơn vị kho của `ingredients.unit` |
| `conversion_rate` (mặc định `1`) | hệ số quy đổi sang đơn vị kho (vd công thức ml → kho lít = `0.001`) |

Giá thành 1 ly = `Σ(qty_per_serving × conversion_rate × ingredients.unit_cost)` — tính client-side ở `computeRecipeCost()` (chỉ preview) và snapshot thành `ingredient_unit_cost`/`ingredient_cost_total` trên `customer_order_items` lúc tạo đơn thật.

**View `v_drink_cost`** *(chỉ đọc, không có code insert/update)*: `{drink_id, ingredient_cost}` — tổng giá thành nguyên liệu/ly hiện tại, dùng để cache nhanh (`orderDrinksCache` trong `dashboard-orders.js`) khi mở form tạo đơn, tránh tính lại từ `drink_ingredients` mỗi lần.

### 12.5 `ingredients`
| Cột | Ghi chú |
|---|---|
| `id`, `name` NOT NULL, `unit` NOT NULL, `unit_cost` NOT NULL `>=0` | giá tham chiếu, có thể được cập nhật lại sau khi nhập kho nếu giá nhập khác |
| `min_stock_qty` (mặc định 0), `is_active` | |
| `created_by`/`updated_by`, `deleted_at`/`deleted_reason`/`deleted_by` | soft delete vì `drink_ingredients.ingredient_id` là `ON DELETE RESTRICT` |
| *(unique suy ra)* `(name, unit)` | code bắt lỗi Postgres `23505` khi trùng |

**Không có cột `current_stock`** — tồn kho luôn suy ra từ dòng `ingredient_stock_logs.qty_after` mới nhất (`created_at DESC`) mỗi `ingredient_id`, tính ở client trong `inventory-shared.js::loadIngredients()`.

### 12.6 `ingredient_stock_logs` (chỉ-INSERT — không UPDATE/DELETE)
| Cột | Ghi chú |
|---|---|
| `id`, `ingredient_id` FK | |
| `order_item_id` FK → `customer_order_items.id`, nullable | chỉ có giá trị khi `log_type='order_consume'` |
| `log_type` | 4 giá trị: `import`, `manual_adjust`, `expired`, `order_consume` |
| `qty_change` | dương = cộng kho, âm = trừ kho |
| `qty_after` | tồn kho SAU thao tác — cột dùng để suy tồn kho hiện tại |
| `batch_ref` | bắt buộc khi `import` |
| `unit_cost_at_import` | chỉ có khi `import` |
| `expiry_date`, `note`, `staff_name`, `created_at` | |

Ràng buộc nghiệp vụ (check ở client, có thể có CHECK constraint tương ứng ở DB): `qty_after >= 0` — khi trừ kho tự động lúc bán hàng mà không đủ, hệ thống **tự trừ về 0** thay vì chặn đơn hàng, cảnh báo riêng qua toast.

### 12.7 `customers`
| Cột | Ghi chú |
|---|---|
| `id`, `name` NOT NULL | |
| `phone` UNIQUE NOT NULL | chuẩn hoá `0xxxxxxxxx` (`normalizePhone`), validate `^0\d{9,10}$`. **Có 1 hàng đặc biệt cố định `phone="0000136631"`, `name="Khách vãng lai"`** dùng cho mọi đơn hàng khách không đăng ký (xem Mục 17) — hàng này VẪN xuất hiện trong bảng danh sách khách hàng như 1 khách bình thường, tích luỹ `total_spent`/`total_profit` gộp của mọi lượt khách vãng lai. |
| `date_of_birth` (date), `gender` (`"nam"/"nu"/"khac"`/null) | |
| `xp` (mặc định 0), `level` (mặc định 1, denormalize từ `xp`) | |
| `total_spent`, `total_profit` | **TỰ ĐỘNG** bởi trigger DB gắn trên `customer_order_items` (chỉ tính dòng `is_void=false` thuộc đơn `status='completed'`) — TRIGGER KHÔNG chạy khi huỷ CẢ đơn (chỉ đổi `customer_orders.status`), code phải tự tính lại tay (xem Mục 17) |
| `streak_days`, `last_checkin_date` | chuỗi ngày check-in liên tiếp |
| `created_by`, `deleted_at`/`deleted_reason`/`deleted_by` | soft delete vì `customer_orders.customer_id` là `ON DELETE RESTRICT` |

### 12.8 `customer_orders`
| Cột | Ghi chú |
|---|---|
| `id`, `customer_id` FK `ON DELETE RESTRICT` | |
| `order_number` | **tự sinh bởi trigger DB** — client KHÔNG gửi giá trị này lúc insert |
| `staff_name` | |
| `status` (mặc định `"completed"`) | 2 giá trị dùng trong code: `"completed"`, `"voided"` |
| `voided_by`/`voided_at`/`void_reason` | chỉ có khi huỷ cả đơn |
| `created_at` | dùng lọc "đơn đầu tiên trong ngày" cho check-in tự động (khoảng `00:00:00`–`23:59:59.999` giờ local) |

### 12.9 `customer_order_items`
| Cột | Ghi chú |
|---|---|
| `id` | tham chiếu bởi `ingredient_stock_logs.order_item_id` |
| `order_id` FK, `drink_id` FK | |
| `product_name` | **snapshot** tên đồ uống lúc bán (không JOIN lại `drinks.name` sau này) |
| `quantity` `>0`, `unit_price` (snapshot `drinks.price`) | |
| `discount_pct` (0–100) | mặc định gợi ý theo cấp độ khách, admin có thể sửa tay |
| `subtotal = unit_price × quantity` | làm tròn `round2()` |
| `customer_paid = subtotal × (1 − discount_pct/100)` | làm tròn `round2()` |
| `ingredient_unit_cost`, `ingredient_cost_total = ingredient_unit_cost × quantity` | snapshot từ `v_drink_cost` lúc bán |
| `profit = customer_paid − ingredient_cost_total` | |
| `is_void` (mặc định false), `void_reason`/`voided_by`/`voided_at` | huỷ RIÊNG dòng này (khác `status='voided'` của cả đơn) |

⚠️ Mọi phép tính tiền đều **làm tròn 2 chữ số ở client bằng `round2()` TRƯỚC KHI insert** — khớp 1 CHECK constraint phía DB. Trigger `sync_customer_totals_on_order` (gắn trên bảng này) tự cộng dồn `customers.total_spent`/`total_profit` mỗi khi INSERT/UPDATE — kể cả khi chỉ đổi `is_void`. Khi huỷ CẢ đơn (chỉ UPDATE `customer_orders.status`), trigger KHÔNG tự chạy lại → `dashboard-orders.js::confirmVoidOrder()` phải tự SELECT lại tổng các dòng còn hợp lệ rồi UPDATE `customers` bằng tay.

### 12.10 `membership_levels`
| Cột | Ghi chú |
|---|---|
| `level` PK, `xp_required` NOT NULL (tăng dần nghiêm ngặt theo cấp, validate client) | |
| `rank_name` NOT NULL, `rank_icon` (mặc định `"⭐"`) | |
| `discount_pct` (0–100), `free_item` nullable, `priority_booking` boolean | |

### 12.11 `quests`
| Cột | Ghi chú |
|---|---|
| `id` PK, tham chiếu bởi `customer_quests.quest_id` `ON DELETE RESTRICT` | |
| `code` nullable UNIQUE, `title` NOT NULL, `description` nullable | |
| `type` (`"daily"/"weekly"/"onetime"`) | |
| `xp_reward` `>0`, `target_count` `>0`, `active` | |
| `is_checkin` (mặc định false) | **đúng 1 dòng `true` toàn hệ thống** — quest hệ thống, KHÔNG sửa/tắt/xoá qua UI, tự hoàn thành khi khách có đơn hàng đầu ngày. ⚠️ Đây hiện là **CÁCH DUY NHẤT** khách nhận XP — quest thường (`is_checkin=false`) không còn UI nào để tick tiến độ (xem Mục 18.4) |
| `deleted_at`/`deleted_reason`/`deleted_by` | soft delete |

### 12.12 `customer_quests`
| Cột | Ghi chú |
|---|---|
| `customer_id` FK, `quest_id` FK `ON DELETE RESTRICT` | |
| `period_key` | `daily`→`YYYY-MM-DD`, `weekly`→`YYYY-Wxx` (`getISOWeek()`), `onetime`→`"once"` |
| `progress` (mặc định 0), `is_completed` | |
| `xp_awarded` | XP thực nhận SNAPSHOT tại thời điểm hoàn thành |
| `related_order_id` FK → `customer_orders`, nullable | chỉ có giá trị ở dòng quest check-in |
| `completed_by`, `completed_at` | |
| *(unique suy ra)* `(customer_id, quest_id, period_key)` | code luôn `maybeSingle()` theo 3 cột này |

### 12.13 `admin_users` ⚠️ ĐÃ THAY ĐỔI SO VỚI TRƯỚC (thêm `auth_user_id`)
| Cột | Ghi chú |
|---|---|
| `id` PK, `username` UNIQUE NOT NULL | vẫn dùng để hiển thị/tìm kiếm, KHÔNG còn là "tên đăng nhập" thật |
| `display_name` nullable (fallback `username`) | |
| `role` (`"superadmin"/"editor"/"barstaff"`) | |
| `password_hash` | ⚠️ **VESTIGIAL** — SHA-256, được `dashboard-accounts.js` ghi khi tạo/sửa tài khoản qua UI, nhưng **KHÔNG còn được đọc bởi bất kỳ luồng đăng nhập nào** (Supabase Auth quản lý mật khẩu riêng ở `auth.users`). Xem Mục 18.1. |
| `auth_user_id` (uuid) ⚠️ **MỚI, QUAN TRỌNG** | FK → `auth.users.id`. Đây là cột **THẬT SỰ** dùng để map phiên đăng nhập Supabase Auth sang hồ sơ nhân viên (`login.html` + `dashboard-auth.js` đều query `.eq("auth_user_id", session.user.id)`). Tài khoản KHÔNG có cột này set đúng sẽ KHÔNG đăng nhập được dù có `password_hash`. |
| `is_active` (mặc định true) | `false` → chặn đăng nhập + tự đăng xuất phiên đang mở |
| `last_login` | cập nhật fire-and-forget sau login thành công |
| `deactivated_reason`/`deactivated_by`/`deactivated_at` | thêm từ migration V3 — vô hiệu hoá thay vì xoá cứng |

### 12.14 `media_library` (DDL THẬT, trích trực tiếp từ comment cuối `dashboard-media.js`)
```sql
create table if not exists media_library (
  id         bigint generated always as identity primary key,
  url        text not null,
  label      text,
  tags       text[] not null default '{}',
  added_by   text,
  created_at timestamptz not null default now()
);
alter table media_library add column if not exists tags text[] not null default '{}';
```

### 12.15 `site_settings`
| Cột | Ghi chú |
|---|---|
| `key` PK | 2 giá trị đang dùng: `"banner_1"`, `"banner_2"` |
| `value` (text chứa JSON) | `JSON.stringify({url, visible})` — có fallback đọc chuỗi thô nếu `JSON.parse` lỗi (dữ liệu cũ) |
| `updated_at` | |

### 12.16 RPC `get_membership_by_phone(p_phone text)`
Hàm phía DB — trả 1 dòng gộp từ `customers` JOIN `membership_levels` (cấp hiện tại + cấp kế), dùng cho trang tra cứu công khai (`js/membership.js`) để **không** cho anon key đọc thẳng toàn bộ bảng `customers`. Cột trả về: `name, xp, rank_icon, rank_name, discount_pct, free_item, priority_booking, streak_days, last_checkin, xp_required_current, xp_required_next`.

### 12.17 Bảng đã bị loại bỏ hoàn toàn
`customer_checkins` và `customer_transactions` — không còn dòng code nào tham chiếu. Thay thế bằng: check-in tự động qua `customer_quests` (quest `is_checkin`) + giao dịch thật qua `customer_orders`/`customer_order_items`.

### 12.18 Bảng Supabase Auth nội bộ (ngoài tầm quản lý trực tiếp của app)
`auth.users` — được Supabase Auth tự quản lý hoàn toàn (email, mật khẩu đã hash đúng chuẩn, session, refresh token). App KHÔNG có quyền tự tạo user vào bảng này từ phía client (cần Service Role key, không có trong client-side code) — xem lỗ hổng Mục 18.1.

---

## 13. Cấu hình / biến môi trường

Duy nhất `js/shared-config.js` → `window.APP_CONFIG` (`Object.freeze`):

```js
window.APP_CONFIG = Object.freeze({
  supabaseUrl: "https://dklfwlgpomnrmxmbjpat.supabase.co",
  supabaseKey: "eyJhbGci...",           // anon/public key — AN TOÀN để lộ ra client
  firebaseConfig: Object.freeze({
    apiKey, authDomain, databaseURL, projectId,
    storageBucket, messagingSenderId, appId, measurementId,
  }),
});
```

M��i nơi khác đọc qua `window.APP_CONFIG` — **không hardcode lại URL/key ở file khác** (trừ 1 ngoại lệ hiện tại: `SITE_BASE_URL` trong `dashboard-game-detail.js` bị hardcode riêng — xem Mục 24.4 đề xuất gộp vào đây).

> ℹ️ `supabaseKey` là **anon key** (khoá công khai theo thiết kế của Supabase) — bản thân việc nó xuất hiện trong source client-side KHÔNG phải lỗ hổng bảo mật, miễn là **Row Level Security (RLS)** được bật đúng trên mọi bảng ở phía Supabase. README này không có quyền truy cập cấu hình RLS thật nên không thể xác nhận — xem khuyến nghị kiểm tra lại ở Mục 24.1.

---

## 14. Hệ thống Page Registry (Admin)

API không đổi qua các phiên bản: `window.AdminDashboard.registerPage({ pageId, menuId, icon, label, badgeHtml, group, placeholderId, insertBeforeMenuId, onShow, guard })` / `showPage()` / `window.__showPage()`.

```js
function registerPage({
  pageId, menuId, icon = '📄', label = '', badgeHtml = '',
  group = 1, placeholderId = null, insertBeforeMenuId = null,
  onShow = null, guard = null,
}) {
  if (typeof guard === 'function' && !guard()) return;   // guard=null → luôn đăng ký
  ready(() => {
    const groups = document.querySelectorAll('.menu-group');
    const target = groups[group] || groups[0];            // group=0 → "Hệ thống", group=1 (mặc định) → "Quản trị"
    let item = placeholderId ? document.getElementById(placeholderId) : null;
    if (!item) {
      item = document.createElement('a');
      const beforeEl = insertBeforeMenuId
        ? document.getElementById(insertBeforeMenuId)
        : findSettingsItem(target);    // mặc định chèn TRƯỚC mục "⚙️ Settings" tĩnh
      // ... insertBefore hoặc appendChild
    }
    item.onclick = () => showPage(pageId, menuId, onShow);
  });
}
```

**Lưu ý quan trọng:**
- `group` mặc định là `1` = `.menu-group` **thứ 2** trong DOM = nhóm "Quản trị". `group: 0` = nhóm "Hệ thống" (chỉ `dashboard-media.js` dùng tường minh).
- Nếu `placeholderId` trỏ tới 1 phần tử **đã có sẵn** trong HTML tĩnh (như `#chatMenuItemPlaceholder`, `#ordersMenuItemPlaceholder`), hàm sẽ **nâng cấp tại chỗ** phần tử đó thay vì tạo mới — giữ đúng vị trí cố định đã thiết kế sẵn trong `dashboard.html`. Khi đó `insertBeforeMenuId` bị bỏ qua (không có tác dụng).
- `showPage()` tự ẩn hết `.main-content > div[id$="Page"]`, hiện đúng 1 page, xoá `.active` khỏi mọi `.menu-item/.menu-item-parent/.menu-sub-item` rồi thêm lại cho đúng mục, rồi gọi `onShow()`.
- `window.__showPage(pageId)` — bản rút gọn, CHỈ ẩn/hiện page, KHÔNG đổi menu active — dùng bởi `dashboard-nav.js` cho 3 page tĩnh (nơi tự quản lý `.active` riêng bằng `clearActive()`) và bởi vài nơi tương thích ngược khác (`dashboard-customer-detail.js`, `dashboard-game-detail.js`).
- **`registerPage()` KHÔNG kiểm tra trùng `pageId`/`menuId`** — nếu 2 module vô tình dùng cùng `pageId`, module nạp SAU sẽ ghi đè `onclick` của module nạp TRƯỚC mà không có cảnh báo console nào. Luôn đặt `pageId`/`menuId` DUY NHẤT toàn hệ thống (khuyến nghị tiền tố theo domain). Đây từng là nguyên nhân của lỗi `accountsPage`/`ingredientsPage` trùng nhau ở bản trước — nay đã sửa, nhưng cơ chế phòng ngừa runtime vẫn chưa có (xem Mục 24.4).

Domain Membership: chỉ `dashboard-customers.js` gọi `registerPage()` (`customersPage`); `dashboard-customer-detail.js` dùng `window.__showPage()` trực tiếp (không đăng ký menu riêng — trang này chỉ vào được từ nút "🔍 Chi tiết"); `dashboard-quests.js`/`dashboard-levels.js` chỉ export `renderXTab()`.

Domain Inventory: `dashboard-ingredients.js` tự đăng ký page riêng `ingredientsPage`, độc lập với Membership dù cả hai đều dùng chung `window.Inventory`.

Domain Orders: `dashboard-orders.js` đăng ký `ordersPage` qua `placeholderId: "ordersMenuItemPlaceholder"` (đã có sẵn trong `dashboard.html`, nhóm "Hệ thống").

---

## 15. Domain Membership — đơn hàng (cũ), check-in tự động, EXP

> ⚠️ Domain này đã được **tinh giản** — phần tạo/huỷ đơn hàng đã chuyển hẳn sang Domain Orders (Mục 17). Membership giờ tập trung vào: hồ sơ khách hàng, cấu hình cấp độ, định nghĩa nhiệm vụ, và xem (read-only) lịch sử.

- **Trang "🎮 Khách hàng"** *(chỉ Super Admin)*: 3 tab Danh sách/Nhiệm vụ/Cấp độ. Tab Danh sách chỉ còn: tìm kiếm, thêm khách mới, xoá khách (soft delete), và nút "🔍 Chi tiết" mở `customerDetailPage`.
- **Trang chi tiết khách hàng** (`dashboard-customer-detail.js`): xem lịch sử đơn hàng (accordion, READ-ONLY — không huỷ được ở đây) + lịch sử EXP. Muốn huỷ đơn/dòng sản phẩm → phải sang trang "🧾 Đơn hàng".
- **Check-in tự động**: khi 1 đơn hàng MỚI được tạo (Mục 17) và đó là đơn ĐẦU TIÊN trong ngày của khách (không áp dụng cho Khách vãng lai) → tự hoàn thành quest `is_checkin=true`, cộng XP + streak (+20 XP thưởng mỗi mốc 7 ngày liên tiếp — hằng số hardcode trong `maybeAutoCheckin()` tại `dashboard-orders.js`).
- **Nhiệm vụ thường** (`is_checkin=false`): CRUD định nghĩa được (tiêu đề, loại, XP thưởng, số lần cần đạt) qua tab Nhiệm vụ, nhưng **hiện KHÔNG có UI nào để đánh dấu tiến độ/hoàn thành cho 1 khách cụ thể** — xem lỗ hổng chức năng ở Mục 18.4.
- **Cấp độ**: cấu hình XP tối thiểu/tên rank/icon/% giảm giá/quà tặng/ưu tiên đặt bàn cho từng cấp, validate XP tăng dần nghiêm ngặt.
- **Xoá khách hàng**: soft delete (vì `customer_orders.customer_id` là `ON DELETE RESTRICT`), bắt buộc lý do.

---

## 16. Domain Inventory — Kho nguyên liệu

- `inventory-shared.js` cung cấp `window.Inventory.state.{ingredients, categories}` dùng chung bởi 3 nơi: trang Kho nguyên liệu, modal sửa đồ uống (recipe builder), lúc tạo đơn hàng (snapshot giá vốn qua view `v_drink_cost`, không gọi lại `computeRecipeCost()`).
- Tồn kho **không lưu trực tiếp** trên `ingredients` — luôn suy ra từ dòng `ingredient_stock_logs` mới nhất mỗi nguyên liệu.
- 3 loại thao tác kho: `import` (nhập hàng, cần mã lô + giá nhập, hỏi cập nhật giá tham chiếu nếu khác giá cũ), `manual_adjust` (kiểm kê), `expired` (hao hụt/hết hạn).
- Cảnh báo nguyên liệu dưới `min_stock_qty` ngay trên trang danh sách + banner tổng hợp.
- Xoá nguyên liệu = soft delete (vì `drink_ingredients.ingredient_id` là `ON DELETE RESTRICT`).
- **Trang này hiển thị cho MỌI role** (không có `guard`) — Bar Staff xem được toàn bộ tồn kho/giá nhưng không sửa được gì (khác với domain Đơn hàng, nơi Bar Staff bị ẩn hẳn cột giá vốn).

---

## 17. Domain Orders — Đơn hàng (MỚI HOÀN TOÀN)

Đây là domain **không hề tồn tại** trong các phiên bản trước — toàn bộ chức năng bán hàng thật (khác với "ghi nhận giao dịch" chung chung của các bản rất cũ) nay tập trung ở đây, tách biệt hẳn khỏi Membership.

### 17.1 Khái niệm "Khách vãng lai" (Walk-in)
```js
const WALKIN_PHONE = "0000136631";
const WALKIN_NAME  = "Khách vãng lai";
```
Là **1 hàng `customers` CỐ ĐỊNH DUY NHẤT**, tự động tạo lần đầu cần dùng (`useWalkInCustomer()` tìm theo `phone=WALKIN_PHONE`, không thấy thì insert mới). Mọi đơn hàng cho khách không đăng ký thẻ thành viên đều gắn vào hàng này. Khách vãng lai:
- ❌ KHÔNG tích XP/streak/check-in (bỏ qua `maybeAutoCheckin()` hoàn toàn trong `submitOrder()`).
- ✅ VẪN được tính vào `total_spent`/`total_profit` qua trigger DB như khách thường (vì cơ chế trigger không phân biệt).
- ⚠️ VẪN xuất hiện trong bảng "Khách hàng" như 1 dòng bình thường — không có filter ẩn nó đi, có thể gây nhầm lẫn cho admin không biết quy ước này (xem Mục 18.8).

### 17.2 Luồng tạo đơn hàng (popup 3 bước)
1. **Chọn loại khách**: "🎫 Thành viên" hay "🚶 Khách vãng lai".
2. **(Chỉ Thành viên) Tra SĐT**: `normalizePhone()` → validate `^0\d{9,10}$` → SELECT `customers` → không thấy thì báo lỗi + gợi ý tạo mới ở tab Khách hàng hoặc chọn Khách vãng lai. Giảm giá mặc định được điền sẵn theo `membership_levels.discount_pct` của cấp hiện tại (sửa tay được).
3. **Chọn sản phẩm**: nhiều dòng `{drink, quantity}` động (`addOrderDraftRow()`), preview realtime (`updateOrderPreview()`) gồm tổng tiền khách trả + lợi nhuận gộp (**ẩn nếu role không có `canViewCost`**).

### 17.3 `submitOrder()` — trình tự ghi dữ liệu
```
1. INSERT customer_orders {customer_id, staff_name}  → order_number tự sinh bởi trigger DB
2. Với mỗi dòng sản phẩm: tính subtotal/customer_paid/ingredient_cost_total/profit
   bằng round2() → INSERT customer_order_items (hàng loạt)
3. consumeStockForOrderItems(insertedItems):
   với mỗi item → SELECT drink_ingredients theo drink_id → với mỗi nguyên liệu:
     qty cần = qty_per_serving × quantity × conversion_rate
     currentStock = window.Inventory.getIngredientById(...).current_stock
     nếu KHÔNG đủ kho → trừ về 0, gom tên nguyên liệu vào danh sách cảnh báo
     → INSERT ingredient_stock_logs {log_type:'order_consume', order_item_id, ...}
     → cập nhật NGAY current_stock trong cache window.Inventory (để dòng tiếp theo
        trong CÙNG 1 đơn hàng tính đúng nếu dùng chung nguyên liệu)
   → nếu có cảnh báo → 1 toast tổng hợp duy nhất, KHÔNG chặn việc tạo đơn
4. Nếu KHÔNG phải Khách vãng lai → maybeAutoCheckin(customerId, orderId, staff):
   → đếm số đơn 'completed' của khách trong NGÀY HÔM NAY — nếu ≠ 1 thì bỏ qua
     (nghĩa là: chỉ đơn ĐẦU TIÊN trong ngày mới kích hoạt check-in)
   → tính streak: nếu last_checkin_date = hôm qua → +1, ngược lại reset về 1
   → bonus = streak % 7 === 0 ? 20 : 0  (thưởng mỗi mốc 7 ngày)
   → INSERT customer_quests (quest check-in, is_completed=true, xp_awarded=...)
   → UPDATE customers {xp, level (suy từ getLevelForXp), streak_days, last_checkin_date}
```

### 17.4 Huỷ đơn / huỷ dòng — xem chi tiết cơ chế trigger ở Mục 12.9
- **Huỷ 1 dòng sản phẩm**: `UPDATE customer_order_items SET is_void=true` → trigger DB tự tính lại `customers.total_spent/total_profit`.
- **Huỷ CẢ đơn**: `UPDATE customer_orders SET status='voided'` (trigger KHÔNG tự chạy vì gắn trên bảng khác) → code tự `SELECT` lại tổng `customer_paid`/`profit` của các dòng còn `is_void=false` thuộc mọi đơn `status='completed'` của khách đó, rồi `UPDATE customers` bằng tay.
- Cả 2 đều bắt buộc nhập lý do qua ô input trong `voidOrderModal` (không dùng `showReasonPrompt()` chuẩn ở đây — modal riêng tự viết, có phần khác biệt nhỏ so với pattern chung, xem Mục 24.5).
- Kho được ghi chú là "hoàn lại tự động" trong thông báo, nhưng **thực tế code KHÔNG có bước hoàn kho khi huỷ** (không thấy `ingredient_stock_logs` insert nào trong `confirmVoidOrder()`) — đây là **sai lệch giữa thông báo UI và hành vi thật**, xem Mục 18.6.

### 17.5 Xuất Excel (SheetJS/`window.XLSX`)
Xuất **đúng danh sách đơn đang hiển thị** (`getFilteredOrdersOfDay()` — đã áp bộ lọc ngày + tìm kiếm), 2 sheet:
- **"Dòng sản phẩm"**: 1 dòng = 1 sản phẩm trong 1 đơn (mã đơn, khách, SĐT, thời gian, sản phẩm, số lượng, đơn giá, giảm giá, thành tiền, [giá vốn/lợi nhuận nếu `canViewOrderCost`], trạng thái dòng/đơn, nhân viên).
- **"Đơn hàng"**: tổng hợp theo đơn (số món còn hiệu lực, tổng khách trả, [tổng lợi nhuận nếu được xem], trạng thái).

Tên file: `don-hang_{from}_den_{to}[_loc-{từ-khoá}].xlsx`.

### 17.6 Quyền hạn riêng của domain này
Xem đầy đủ ở Mục 9.2 — 3 cờ độc lập `isReadOnly`/`canCreateOrders`/`canViewCost`. Không có `guard` trên `registerPage()` → mọi role đều THẤY trang, khác biệt nằm ở việc ẩn nút/khoá hành động bên trong.

---

## 18. Cảnh báo kỹ thuật / nợ kỹ thuật cần xử lý

> Mục này thay thế hoàn toàn Mục 14 của README các bản trước. Vấn đề "`dashboard-accounts.js` chứa nhầm code Kho nguyên liệu" đã **được vá xong** (file này nay đúng là CRUD tài khoản) — nhưng quá trình vá sinh ra 1 lỗ hổng khác nghiêm trọng hơn, liệt kê ngay bên dưới.

### 18.1 ⚠️⚠️⚠️ NGHIÊM TRỌNG — Tạo tài khoản admin mới qua UI KHÔNG hoạt động trọn vẹn

Kể từ khi đăng nhập chuyển sang dùng **Supabase Auth thật** (Mục 10), việc đăng nhập được của 1 tài khoản phụ thuộc **2 điều kiện đồng thời**:
1. Có 1 user tương ứng trong bảng nội bộ **`auth.users`** của Supabase Auth (email + mật khẩu do Supabase quản lý).
2. Có 1 hàng `admin_users` với cột **`auth_user_id`** trỏ đúng tới `auth.users.id` của user đó.

Nhưng `dashboard-accounts.js::saveAccount()` (nút "+ Thêm tài khoản") **chỉ làm 1 việc**:
```js
const payload = {
  username, display_name: displayName || username,
  password_hash: await sha256(password),   // ← KHÔNG có tác dụng gì tới đăng nhập thật
  role,
};
await client.from('admin_users').insert(payload);   // ← KHÔNG set auth_user_id
```
Nó **không** tạo user Supabase Auth mới, và **không** set `auth_user_id`. Lý do kỹ thuật: tạo Supabase Auth user từ phía client cần **Service Role key** (quyền admin) — key này **không được và không nên** đưa vào code chạy trên trình duyệt (sẽ lộ toàn quyền ghi/xoá mọi bảng cho bất kỳ ai mở DevTools).

**Hệ quả:** tài khoản tạo qua "+ Thêm tài khoản" sẽ có 1 hàng `admin_users` tồn tại, NHƯNG:
- Không có `auth.users` tương ứng → không có gì để `signInWithPassword()` xác thực.
- `auth_user_id = null` → dù ai đó VÔ TÌNH có sẵn 1 `auth.users` khác trùng email, `login.html` cũng sẽ không tìm ra hồ sơ (`.eq("auth_user_id", session.user.id)` không khớp).

**Cách tạo tài khoản admin mới ĐÚNG hiện tại (thao tác tay, ngoài UI):**
1. Vào **Supabase Dashboard → Authentication → Users → Add user** (hoặc gửi lời mời/invite email), tạo user với email + mật khẩu.
2. Copy `auth.users.id` (uuid) của user vừa tạo.
3. Ở bảng `admin_users` (qua UI "Quản lý tài khoản" hoặc trực tiếp SQL Editor), **thêm/sửa** hàng tương ứng, set cột `auth_user_id` = uuid vừa copy, và điền `role`.
4. Tương tự, đổi "mật khẩu" cho tài khoản có sẵn phải làm ở **Supabase Dashboard → Authentication**, KHÔNG phải ở form "Mật khẩu mới" trong "Quản lý tài khoản" (ô đó chỉ ghi `password_hash`, không ai đọc lại giá trị này để xác thực).

Xem đề xuất khắc phục triệt để (Edge Function) ở Mục 24.1.

### 18.2 Cột `password_hash` (SHA-256) giờ là dữ liệu "ma" — nợ kỹ thuật + mùi bảo mật nhẹ
Không còn được đọc bởi bất kỳ luồng đăng nhập nào (Mục 18.1), nhưng vẫn được ghi mỗi lần tạo/sửa tài khoản, khiến người đọc code dễ lầm tưởng nó vẫn có tác dụng. Thêm nữa, SHA-256 trần (không salt, không stretch) vốn không phải cách lưu mật khẩu an toàn — việc cột này còn tồn tại (dù không dùng) là 1 rủi ro nếu sau này có ai vô tình khôi phục lại logic so khớp nó.

### 18.3 `js/app.js` và `css/style.css` — nghi vấn orphaned/dead code
- `index.html` hiện chỉ nạp `js/app/*.js` (9 file), **không có dòng nào** `<script src="js/app.js">`. File `js/app.js` gốc (monolith, chứa gần như nguyên vẹn logic đã tách) **vẫn tồn tại trong thư mục `js/`**.
- Tương tự, `index.html` nạp trực tiếp 9 file trong `css/base/*.css` + `css/chat.css`, **không có** `<link rel="stylesheet" href="css/style.css">` nào. File `css/style.css` (chỉ chứa `@import`) có vẻ không còn đường dẫn nào dẫn tới nó nữa.
- **Rủi ro thực tế**: 1 người không biết chi tiết này có thể sửa nhầm `js/app.js` hoặc `css/style.css`, build/deploy, rồi ngạc nhiên vì "sửa rồi mà không thấy gì đổi trên site". Xem đề xuất dọn dẹp ở Mục 24.4.

### 18.4 Nhiệm vụ thường (quest không phải check-in) không còn cách nào để hoàn thành qua UI
Tab "🗺️ Nhiệm vụ" trong Khách hàng vẫn cho tạo/sửa/xoá **định nghĩa** nhiệm vụ (`quests`), nhưng sau khi tách `dashboard-customers.js`, phần "tick tiến độ nhiệm vụ cho 1 khách cụ thể" (comment gốc gọi là `markQuestProgress`) đã **bị bỏ hẳn không có gì thay thế** — không còn ở `dashboard-customers.js`, không có ở `dashboard-customer-detail.js`, không có ở `dashboard-orders.js`. Trên thực tế hiện tại, **chỉ có quest check-in (`is_checkin=true`) là tự động nhận XP** — mọi quest thường tạo ra chỉ mang tính hiển thị, không có luồng nào cộng XP cho khách. Cân nhắc ẩn tạm phần tạo quest thường (dễ gây hiểu nhầm) hoặc bổ sung lại UI tick tiến độ (xem Mục 24.6).

### 18.5 `registerPage()` không chặn trùng `pageId`/`menuId` ở runtime
Đã từng gây lỗi thật (accountsPage/ingredientsPage trùng nhau — nay đã sửa nội dung file, nhưng cơ chế phòng ngừa vẫn chưa tồn tại). Thêm module mới **PHẢI** tự kiểm tra thủ công không trùng với mọi `pageId`/`menuId` hiện có trong `admin/` trước khi đặt tên.

### 18.6 Thông báo "kho đã được hoàn lại tự động" khi huỷ đơn KHÔNG khớp hành vi thật
`confirmVoidOrder()` trong `dashboard-orders.js` hiển thị toast "🗑️ Đã huỷ dòng sản phẩm — kho đã được hoàn lại tự động." / "...huỷ đơn hàng — kho đã được hoàn lại tự động." nhưng đoạn code xử lý huỷ **không hề gọi `ingredient_stock_logs` insert** nào để cộng trả nguyên liệu về kho. Nếu hành vi mong muốn thật sự là hoàn kho, cần bổ sung logic; nếu không, cần sửa lại thông báo cho khớp thực tế (tránh nhân viên tin nhầm là kho đã tự đúng lại).

### 18.7 Row Level Security (RLS) không thể xác minh từ source
`supabaseKey` trong `shared-config.js` là anon key công khai — an toàn về bản chất, NHƯNG chỉ khi RLS được cấu hình đúng trên **mọi** bảng ở phía Supabase (đặc biệt `customers`, `customer_orders`, `customer_order_items`, `admin_users` — nơi có dữ liệu nhạy cảm/tài chính). Source code không cho thấy cấu hình RLS, nên không thể xác nhận. Khuyến nghị kiểm tra thủ công trên Supabase Dashboard.

### 18.8 Khách vãng lai lẫn trong danh sách "Khách hàng" thật
Xem Mục 17.1 — hàng `customers` cố định cho khách vãng lai không bị lọc khỏi bảng danh sách/thống kê khách hàng, có thể gây nhầm lẫn khi admin đọc báo cáo hoặc thấy 1 "khách" có doanh số bất thường cao (vì đó là tổng gộp của MỌI lượt khách vãng lai).

### 18.9 Frontend tạo Supabase client mới thay vì dùng chung
`js/data.js` và `js/membership.js` **mỗi file tự `import()` + `createClient()` riêng** (2 instance độc lập, không chia sẻ) — khác với Admin nơi có đúng 1 biến `client` toàn cục dùng chung. Tệ hơn, `js/membership.js::lookupMembership()` tạo **1 client MỚI mỗi lần người dùng bấm "Tra cứu"** (nằm trong thân hàm, không cache) — không gây lỗi chức năng (vì ES module được trình duyệt cache theo URL) nhưng lãng phí và không nhất quán với phần còn lại của codebase.

### 18.10 Khoá cứng URL triển khai (`SITE_BASE_URL`)
`admin/modules/games/dashboard-game-detail.js` hardcode `const SITE_BASE_URL = "https://shisha001-dotcom.github.io/the-coffee-quest/";` để sinh link QR — nếu đổi domain/tên miền phải nhớ sửa đúng đúng dòng này (không nằm trong `shared-config.js`), dễ bị bỏ sót.

### 18.11 `drink_categories` không có UI quản trị
Không có module nào cho phép thêm/sửa/xoá loại đồ uống qua giao diện Admin — phải thao tác trực tiếp trên Supabase (SQL Editor hoặc Table Editor). Với 1 quán vận hành thực tế, việc thêm 1 loại đồ uống mới ("Đá xay", "Mocktail"...) hiện đòi hỏi người không rành SQL phải nhờ hỗ trợ kỹ thuật.

---

## 19. Quy trình bảo trì thường gặp

| Muốn làm gì | Làm ở đâu |
|---|---|
| Thêm thể loại game mới | `window.GAME_CATEGORIES` trong `js/shared-categories.js` |
| Thêm loại đồ uống mới | Thêm dòng trong bảng `drink_categories` trên Supabase trực tiếp (Mục 18.11) — tab lọc tự render động, không cần sửa code |
| Thêm câu trả lời nhanh chat admin | Mảng trong `admin/modules/chat/dashboard-chat.js` |
| Thêm 1 tab mới trong Membership | Thêm file `dashboard-{tab}.js`, export `renderXTab()`, gọi trong `switchCustTab()` của `dashboard-customers.js`, thêm đường dẫn vào `SCRIPT_SEQUENCE` trong `dashboard-auth.js` |
| Đổi màu frontend | `--accent` trong `css/base/variables.css`; theo mùa → block `html[data-theme="..."]` cùng file |
| Đổi màu admin | `--primary` trong `admin/dashboard.css` |
| Đổi cấu hình cấp độ/ưu đãi thành viên | Admin → Khách hàng → tab Cấp độ |
| Nhập/điều chỉnh tồn kho nguyên liệu | Admin → Kho nguyên liệu |
| Reset chat | Admin → Cộng đồng → "🗑️ Xoá chat hôm nay" |
| Thêm role admin mới | Sửa `ROLES`/`RESTRICTED_PAGES`/`READONLY_ROLES`/`ORDER_CREATE_EXTRA_ROLES`/`COST_HIDDEN_ROLES` trong `admin/core/dashboard-permissions.js` — KHÔNG so sánh chuỗi role thủ công ở module khác |
| Thêm admin user mới (ĐÚNG, không bị lỗi Mục 18.1) | Xem quy trình 4 bước ở Mục 18.1 (tạo Auth user trước, set `auth_user_id` sau) |
| Đổi ngưỡng cảnh báo tồn kho | Sửa `min_stock_qty` trực tiếp trên từng nguyên liệu (Admin → Kho nguyên liệu → Sửa) — không có cấu hình toàn cục |
| Đổi XP thưởng streak check-in (hiện +20 XP mỗi mốc 7 ngày) | Sửa hằng số trong `maybeAutoCheckin()` tại `admin/modules/orders/dashboard-orders.js` (⚠️ ĐÃ CHUYỂN từ `dashboard-customers.js` sang đây) |
| Đổi khách vãng lai (SĐT/tên mặc định) | Hằng số `WALKIN_PHONE`/`WALKIN_NAME` đầu file `admin/modules/orders/dashboard-orders.js` |
| Đổi domain deploy (ảnh hưởng mã QR) | `SITE_BASE_URL` trong `admin/modules/games/dashboard-game-detail.js` (Mục 18.10) |
| Xem/đổi cấu hình xuất Excel đơn hàng | `exportOrdersToExcel()` trong `dashboard-orders.js` |

---

## 20. Checklist: thêm 1 module admin mới

Áp dụng khi tạo 1 domain hoàn toàn mới (không phải thêm tab vào Membership/Inventory/Orders — các domain đó đã có state dùng chung riêng).

1. Tạo thư mục `admin/modules/{ten-domain}/`.
2. Nếu module cần state/helper dùng chung giữa nhiều file con → tạo file `{domain}-shared.js` (pattern `membership-shared.js`/`inventory-shared.js`), export qua `window.{TenDomain}`.
3. File JS chính gọi `window.AdminDashboard.registerPage({...})` — **`pageId`/`menuId` PHẢI DUY NHẤT toàn hệ thống** (kiểm tra chéo `admin/dashboard.html` + mọi file trong `admin/modules/` — xem Mục 18.5).
4. HTML page + modal (nếu có) tự inject bằng IIFE ngay khi file chạy (`document.querySelector('.main-content').appendChild(...)` hoặc `document.body.appendChild(...)`), **KHÔNG** thêm gì tĩnh vào `dashboard.html`.
5. CSS riêng (nếu cần) → tự inject `<style>` bằng JS (pattern `injectXStyles()`), không thêm `<style>` vào `dashboard.html`.
6. Dùng `addEventListener`, tránh `onclick=""`/`oninput=""` inline (ngoại lệ: nút điều hướng cấp cao gọi hàm ổn định từ `core/dashboard-nav.js`).
7. **⚠️ BƯỚC KHÁC BIỆT LỚN NHẤT SO VỚI CÁC BẢN CŨ**: thêm đường dẫn file vào **`SCRIPT_SEQUENCE`** (nếu cần biến toàn cục kiểu classic script, hoặc cần dùng biến toàn cục `client`/`currentSession` từ những script trước nó) hoặc **`MODULE_SEQUENCE`** (nếu dùng `import`, hoặc chỉ cần các biến toàn cục qua `window.X`/biến top-level đã tồn tại) trong `admin/core/dashboard-auth.js` — đặt đúng vị trí theo thứ tự phụ thuộc (xem Mục 3.1). **KHÔNG** thêm `<script>` vào `admin/dashboard.html`.
8. Nếu module cần quyền hạn → dùng `window.AdminPermissions.isSuperAdmin()`/`.isReadOnly()`/`.can(role, pageId)`/`.canCreateOrders()`/`.canViewCost()`, không so sánh chuỗi role thủ công; nếu cần ẩn hẳn trang với 1 số role → viết `guard` riêng (đừng chỉ dựa vào `RESTRICTED_PAGES` — xem lưu ý ở Mục 9.1 về `RESTRICTED_PAGES.editor` rỗng).
9. Nếu module cần validate form → pattern `clearFieldError`/`showFieldError` (border đỏ + text dưới field), không dùng `alert()`.
10. Nếu cần xác nhận xoá đơn giản → `window.showConfirm()`; nếu là soft-delete cần lưu lý do → `window.showReasonPrompt()`. Không dùng `confirm()`/`prompt()` native.
11. Nếu module thao tác dữ liệu có ràng buộc `ON DELETE RESTRICT` từ bảng khác → thiết kế xoá là soft-delete ngay từ đầu, lọc `is('deleted_at', null)` ở mọi SELECT liên quan.
12. Mọi phép tính tiền → dùng `round2()` (làm tròn 2 chữ số) TRƯỚC khi insert, khớp CHECK constraint DB.
13. Sau khi thêm xong → chạy thử toàn bộ luồng đăng nhập 3 role (`superadmin`/`editor`/`barstaff`) để đảm bảo `guard()` hoạt động đúng và menu không xuất hiện sai chỗ.

---

## 21. Global API Reference — `window.*` dùng chung

### Từ `js/shared-utils.js` (dùng chung cả frontend + admin)
| Global | Mô tả |
|---|---|
| `window.escHtml(s)` | escape HTML — bắt buộc dùng khi render text người dùng nhập vào `innerHTML` |
| `window.formatTime(ts)` | `HH:mm` từ timestamp |
| `window.formatDateVN(dateStr)` | `YYYY-MM-DD` → `DD/MM/YYYY` |
| `window.slugify(s)` | chuẩn hoá chuỗi có dấu tiếng Việt thành slug URL |
| `window.debounce(fn, delay=200)` | debounce dùng chung mọi ô search |
| `window.showToast(msg, bg='#00b894')` | thông báo nổi góc dưới phải, tự ẩn ~2.7s |
| `window.showConfirm(opts)` | `Promise<boolean>` — modal xác nhận thay `confirm()` native |
| `window.showReasonPrompt(opts)` | `Promise<string|null>` — modal xác nhận CÓ ô nhập lý do bắt buộc, dùng cho mọi soft-delete |
| `window.getYoutubeId(url)` | parse ID từ 4 dạng URL YouTube — dùng chung frontend + `dashboard-game-detail.js` |
| `window.extractGDriveFileId(url)` | trích fileId từ mọi dạng link Google Drive — dùng chung `gdrivePreviewUrl()` (PDF) + `dashboard-media.js` (ảnh) |
| `window.gdrivePreviewUrl(url)` | chuyển link chia sẻ Drive → link `/preview` để nhúng iframe |
| `window.buildGameSlugMap(games)` | sinh `{slugById, idBySlug}` không trùng lặp cho URL `#game-{slug}` |

### Từ `js/shared-emoji.js` / `js/shared-categories.js`
`window.EMOJI_CATEGORIES` / `CHAT_EMOJIS` / `ALL_EMOJIS` / `UNIQUE_EMOJIS`; `window.GAME_CATEGORIES` / `DIFFICULTY_LEVELS`; `window.renderCategoryPicker(container, selected, readonly)` / `getSelectedCategories(container)`; `window.populateDifficultySelect(selectEl, currentValue)`.

### Từ `js/theme.js` (frontend)
`window.TCQ_THEMES`, `window.getCurrentTheme()`, `window.applyTheme(id)`.

### Từ `js/app/*.js` (frontend router — ⚠️ cập nhật, KHÔNG còn từ `js/app.js`)
`window.loadPage`, `window.routeFromHash`, `window.goNews/goBoardgame/goContact/goSettings/goMembership`, `window.goList/goDetail`, `window.openLb/closeLb`, `window.initBoardgame/renderGrid`, `window.renderDetail`, `window.renderDailyPick/renderBanners`, `window.initSettings/saveUsernameSettings`.

### Từ `js/membership.js` / `js/chat.js` (frontend)
`window.initMembership()`; `window.updateChatUsername(newName)`, `window.__fbTrack(type, date, gameId, gameName)`.

### Từ `admin/core/*`
| Global | Mô tả |
|---|---|
| `window.AdminPermissions` | `{ROLES, roleInfo, isSuperAdmin, can, isReadOnly, canCreateOrders, canViewCost, applyReadOnlyForm}` |
| `window.AdminDashboard` | `{registerPage, showPage, ready}` |
| `window.__showPage(pageId)` | tương thích ngược, chỉ ẩn/hiện page KHÔNG đổi active menu |
| `client` | biến toàn cục (không có `window.` prefix) — Supabase client instance DUY NHẤT dùng chung toàn Admin, khai báo ở top-level `dashboard-auth.js` |
| `currentSession` | biến toàn cục — `{id, username, displayName, role, authUserId, email}` |

### Từ các module domain
`window.Membership`, `window.Inventory`, `window.getGameById`, `window.loadGames`, `window.openGameDetail`, `window.loadDrinks/renderDrinkGrid/openAddDrink/editDrink/saveDrink/deleteDrink`, `window.loadCustomers`, `window.openCustomerDetailPage` ⚠️MỚI, `window.renderQuestsTab/renderLevelsTab`, `window.setAnalyticsRange/loadAnalytics`, `window.openMediaModal/closeMediaModal/addMedia`, `window.saveBanners`.

> ℹ️ Domain **Orders** (`dashboard-orders.js`) hiện KHÔNG có hàm nào export tường minh ra `window.X` cho module khác gọi — toàn bộ tương tác đi qua UI của chính nó (nút "Tạo đơn hàng mới", `onShow` callback của `registerPage`). Nếu cần gọi từ nơi khác trong tương lai (vd mở popup tạo đơn từ trang Chi tiết khách hàng), sẽ cần bổ sung export tương tự các domain khác.

---

## 22. localStorage / sessionStorage keys

| Key | Nơi dùng | Mục đích |
|---|---|---|
| `localStorage['tcq_username']` | `js/chat.js`, `pages/settings.html` → `saveUsernameSettings()` | tên hiển thị trong chat cộng đồng |
| `localStorage['tcq-last-reset-day']` | `js/chat.js::clearChatIfNewDay()` | ngày cuối đã reset chat |
| `localStorage['tcq_theme']` | `js/theme.js` | theme mùa đang chọn |
| *(supabase-js tự quản lý, key riêng của thư viện)* | `admin/login.html`, `admin/core/dashboard-auth.js` | session admin — ⚠️ **ĐÃ ĐỔI** từ `sessionStorage['bg_admin_session']` (bản cũ) sang cơ chế của Supabase Auth (localStorage, có refresh token) |

> Không có key nào lưu dữ liệu nhạy cảm dạng plaintext. Mật khẩu Admin thật giờ do Supabase Auth quản lý hoàn toàn (không còn liên quan tới `localStorage`/`sessionStorage` của app).

---

## 23. Quy ước UI/UX & khả năng tiếp cận (Accessibility)

- **Skip link**: cả `index.html` và `admin/dashboard.html` có `<a class="skip-link">` là phần tử đầu `<body>`, trỏ tới `#app`/`#mainContent` (có `tabindex="-1"`).
- **`:focus-visible`** định nghĩa toàn cục trong `css/base/reset.css` — chỉ hiện outline khi điều hướng bàn phím.
- **Dialog thay API native**: không dùng `alert()`/`confirm()`/`prompt()` — luôn `window.showToast()`/`showConfirm()`/`showReasonPrompt()` (có `role="alertdialog"`/`role="alert"`, bẫy `Escape`/`Enter`, tự focus nút chính). *(Ngoại lệ còn sót: `admin/core/dashboard-auth.js::logout()` vẫn dùng `confirm()` native khi bấm nút đăng xuất — chưa đồng bộ hết, xem Mục 24.7)*.
- **z-index theo thang chuẩn** (`css/base/variables.css`): `--z-sticky/--z-header/--z-overlay/--z-drawer/--z-widget/--z-modal/--z-lightbox/--z-toast` — không dùng số tuỳ tiện.
- **Responsive breakpoints chính**: `900px` (sidebar admin → drawer), `860px` (chat admin → Messenger-style), `768px`/`660px` (banner + header 2 dòng frontend), `600px` (form 1 cột, emoji picker thu nhỏ).
- **`aria-label`/`role` bắt buộc** cho nút chỉ có icon và vùng động real-time (`role="log" aria-live="polite"` cho khung chat).
- **Ảnh lỗi**: mọi `<img>` do admin nhập URL tự do đều có `onerror=` fallback UI.

---

## 24. Đề xuất nâng cấp / cải tiến hệ thống

Sắp xếp theo nhóm, đầu mỗi nhóm là mức độ ưu tiên gợi ý. Đây là các đề xuất dựa trên phân tích code thực tế (không phải khuyến nghị chung chung) — mỗi mục đều trỏ thẳng tới vị trí code liên quan.

### 24.1 🔴 Bảo mật & Xác thực — ưu tiên cao nhất
- **Vá lỗ hổng tạo tài khoản admin (Mục 18.1)**: Cách sạch nhất là viết 1 **Supabase Edge Function** (chạy server-side, giữ Service Role key an toàn) nhận `{email, password, display_name, role}` từ UI "Quản lý tài khoản" → gọi `supabase.auth.admin.createUser()` → insert/update `admin_users` với `auth_user_id` đúng trong CÙNG 1 giao dịch. `dashboard-accounts.js::saveAccount()` chỉ cần gọi Edge Function này thay vì insert thẳng `admin_users`.
- **Dọn cột `password_hash`**: sau khi vá xong luồng tạo tài khoản, cân nhắc bỏ hẳn cột này + hàm `sha256()` trong `dashboard-accounts.js` — chỉ giữ lại nếu có lý do nghiệp vụ cụ thể (vd audit log), nếu không nó chỉ là dữ liệu thừa gây hiểu nhầm.
- **Rà soát Row Level Security** trên toàn bộ bảng Supabase (đặc biệt `customers`, `customer_orders`, `customer_order_items`, `admin_users`) — xác nhận anon key KHÔNG đọc/ghi được ngoài phạm vi RPC/luồng đã định (Mục 18.7).
- **Rà soát Firebase Realtime Database Security Rules** — hiện không thấy trong code, cần xác nhận `communityChat`/`onlineUsers`/`analytics/*` không bị ghi tuỳ ý bởi client ẩn danh (chat hiện hoàn toàn không cần đăng nhập).
- Cân nhắc thêm **rate limiting / chống spam** cho chat công khai và RPC `get_membership_by_phone` (hiện ai cũng gọi được không giới hạn với anon key).

### 24.2 🟠 Toàn vẹn dữ liệu & nghiệp vụ
- **Chuyển phép tính tiền (`round2`, `subtotal`, `profit`...) vào 1 hàm/trigger phía Postgres** thay vì chỉ dựa vào client tính đúng rồi khớp CHECK constraint — hiện nếu 1 nơi khác (vd import dữ liệu, API khác) insert sai công thức làm tròn sẽ bị DB từ chối một cách khó hiểu; đưa logic vào DB giúp "1 nguồn sự thật" duy nhất.
- **Bổ sung cơ chế hoàn kho khi huỷ đơn/dòng** (Mục 18.6) — hoặc nếu chủ ý không hoàn kho, sửa lại text thông báo cho đúng, tránh nhân viên hiểu sai.
- **Quyết định số phận của "nhiệm vụ thường"** (Mục 18.4): hoặc ẩn tạm nút "+ Thêm nhiệm vụ" (chỉ giữ quest check-in), hoặc bổ sung lại UI tick tiến độ thủ công (vd nút "+1 tiến độ" ở trang chi tiết khách hàng) để tính năng không bị "treo lửng".
- **Tách khách vãng lai khỏi báo cáo khách hàng thật** (Mục 18.8) — thêm 1 cột `is_walkin`/`is_system` trên `customers`, hoặc đơn giản là lọc bỏ `phone = WALKIN_PHONE` khỏi bảng "Khách hàng" + các thống kê liên quan.
- **Thêm UI quản lý `drink_categories`** (Mục 18.11) — 1 form CRUD đơn giản (tên/icon/màu/thứ tự) để không phải mở SQL Editor cho thao tác thường xuyên này.

### 24.3 🟡 Hiệu năng & khả năng mở rộng
- **Thêm phân trang** cho các bảng có thể phình to theo thời gian: Boardgames, Đồ uống, Khách hàng, và đặc biệt **Đơn hàng** (hiện load toàn bộ đơn trong khoảng ngày chọn, không giới hạn số dòng).
- **`inventory-shared.js::loadIngredients()`** tải TOÀN BỘ lịch sử `ingredient_stock_logs` mỗi lần chỉ để lấy dòng mới nhất mỗi nguyên liệu — nên thêm 1 cột `current_stock` denormalize trực tiếp trên `ingredients` (cập nhật bằng trigger DB mỗi khi có log mới) để tránh quét toàn bảng log ngày càng lớn.
- **Gộp Supabase client phía frontend** (Mục 18.9) — tạo 1 instance dùng chung (vd export từ `js/data.js` hoặc 1 file `js/supabase-client.js` mới) thay vì mỗi lần gọi `lookupMembership()` lại `createClient()` mới.

### 24.4 🟢 Kiến trúc & trải nghiệm lập trình viên (DX)
- **Dọn dẹp file orphan**: xoá hẳn hoặc chuyển `js/app.js` và `css/style.css` vào 1 thư mục `_archive/` rõ ràng kèm ghi chú, tránh người sau sửa nhầm file chết (Mục 18.3/18.5).
- **Gộp `SITE_BASE_URL` vào `window.APP_CONFIG`** (Mục 18.10) thay vì hardcode riêng trong `dashboard-game-detail.js`.
- **Thêm cơ chế cảnh báo trùng `pageId`/`menuId`** ngay trong `registerPage()` (Mục 18.5/24 — chỉ cần 1 `console.warn` nếu `document.getElementById(menuId)` đã tồn tại trước khi tạo mới) — chi phí thấp, ngăn tái diễn đúng loại lỗi từng xảy ra.
- **Cân nhắc bundler nhẹ (esbuild/Vite) khi codebase ổn định hơn**: hiện toàn bộ kiến trúc "nạp script đúng thứ tự" (cả `SCRIPT_SEQUENCE` bên admin lẫn `<script>` tĩnh bên frontend) là điểm dễ vỡ nhất khi có người mới tham gia. Một bundler sẽ tự giải quyết thứ tự phụ thuộc qua `import`/`export` tường minh, đồng thời có thể loại bỏ hẳn cơ chế "tự tạo `<script>` bằng JS" khá phức tạp trong `dashboard-auth.js`.
- **Thêm JSDoc typedef hoặc TypeScript từng phần** cho các domain có tính toán tài chính (Orders, Inventory) — giảm rủi ro sai lệch công thức khi sửa code sau này.
- **Thống nhất `admin_users.username`**: giờ đăng nhập bằng email qua Supabase Auth, nhưng UI vẫn hiển thị/tìm theo `username` — nên làm rõ quan hệ giữa `username` hiển thị và `email` đăng nhập (hiện có thể lệch nhau, gây khó hiểu khi tra cứu).

### 24.5 🔵 Độ tin cậy & vận hành
- **Modal huỷ đơn (`voidOrderModal`) nên dùng lại `window.showReasonPrompt()`** chuẩn thay vì tự viết input riêng — giảm trùng lặp code và giữ hành vi bàn phím/accessibility nhất quán (Mục 17.4).
- **Thay nốt `confirm()` native còn sót** trong `admin/core/dashboard-auth.js::logout()` bằng `window.showConfirm()` (Mục 23) để đồng bộ hoàn toàn quy ước "không dùng dialog native" của dự án.
- **Thêm giám sát lỗi phía client** (vd Sentry hoặc tương đương) cho Admin Dashboard — nơi thao tác liên quan tiền/kho, hiện lỗi chỉ hiện toast tạm thời + `console.error`, không có nơi nào lưu lại để truy vết sau này.
- **Cân nhắc lưu ảnh thật qua Supabase Storage** thay vì chỉ dán link ngoài (Imgur/Google Drive) cho Banner/Thư viện Media/ảnh game — link ngoài có thể bị xoá/đổi quyền chia sẻ ngoài tầm kiểm soát của app, và việc đo dung lượng qua HEAD request hiện phụ thuộc CORS nên không đáng tin cậy 100%.

### 24.6 🟣 Tính năng mới / mở rộng nghiệp vụ
- **UI tick tiến độ nhiệm vụ thủ công** cho nhân viên quầy (đi kèm đề xuất 24.2) — vd nút "+1" ngay trang chi tiết khách hàng cho các quest đang mở, để tính năng "Nhiệm vụ" thật sự có tác dụng ngoài check-in.
- **Xuất hoá đơn PDF** cho từng đơn hàng (bổ sung cạnh xuất Excel hàng loạt hiện có) — hữu ích khi cần đưa hoá đơn cho khách.
- **Báo cáo hiệu suất nhân viên**: `staff_name` hiện chỉ là text snapshot tại thời điểm tạo đơn (không phải FK) — đủ cho việc hiển thị nhưng khó tổng hợp chính xác nếu nhân viên đổi tên hiển thị sau này; cân nhắc thêm cột `staff_id` (FK tới `admin_users.id`) song song để giữ khả năng truy vấn theo nhân viên chính xác về lâu dài, đồng thời vẫn giữ `staff_name` làm snapshot hiển thị.
- **Thông báo đẩy cho khách hàng** (vd khi lên hạng thành viên, khi có ưu đãi mới) — hiện hệ thống chỉ có Notification API 1 chiều cho phía Admin khi có tag chat.

---

*Tài liệu này được viết lại từ việc đọc trực tiếp toàn bộ source code hiện có tại thời điểm biên soạn — không dựa trên bất kỳ README phiên bản trước nào. Khi codebase tiếp tục thay đổi, hãy cập nhật lại các mục 3 (thứ tự nạp script), 12 (schema), và 18 (nợ kỹ thuật) trước tiên, vì đây là 3 mục có khả năng lệch pha với thực tế nhanh nhất.*
