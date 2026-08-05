/* ══════════════════════════════════════════════
   RESPONSIVE TABLES (MOBILE) — admin/dashboard-mobile-tables.js
   ─────────────────────────────────────────────
   v2 — đã soát lại lần 2. Bổ sung so với v1: gắn thêm role/aria-
   label để bù accessibility bị mất khi CSS ẩn <thead> bằng
   display:none trên mobile — display:none ẩn khỏi CẢ trình đọc màn
   hình, không riêng gì thị giác, nên nếu chỉ ẩn <thead> mà không bù
   gì thì người dùng trình đọc màn hình trên mobile sẽ KHÔNG còn biết
   tên cột của từng ô nữa. File này bù lại bằng cách:
     - Gắn role="table"/"rowgroup"/"row"/"columnheader"/"cell" để
       giữ đúng ngữ nghĩa bảng dù CSS đổi display sang block/flex.
     - Với ô chứa field nhập liệu (input/select/textarea) — gắn
       aria-label ngay trên field đó (nếu field chưa có nhãn khác).
     - Với ô chỉ có text/badge thuần (không field, không nút) — gắn
       aria-label trên chính <td> dạng "Tên cột: giá trị".
     - Ô chứa nút (Sửa/Xoá...) hoặc ô colspan (panel mở rộng) —
       không đụng tới, vì nút đã tự có tên hợp lý từ text bên trong,
       thêm aria-label chồng lên dễ gây đọc lặp/rối.

   Tự động gắn thuộc tính data-label="<tên cột>" vào từng <td> của
   mọi bảng <table class="game-table"> (đọc tên cột từ <thead>), để
   admin/dashboard-mobile.css có thể hiển thị bảng dưới dạng "card"
   (mỗi dòng = 1 thẻ, mỗi ô = 1 khối "Tên cột" rồi tới giá trị ngay
   dưới) trên màn hình hẹp — mà KHÔNG cần sửa bất kỳ file nào trong
   admin/modules/* (nơi sinh ra các bảng này bằng cách gán
   tbody.innerHTML, không có framework nào theo dõi thay đổi DOM
   giúp mình cả).

   Cách hoạt động:
     1. Quét toàn bộ <table class="game-table"> (+ bảng riêng của
        trang Thống kê #anDetailTable, không dùng class game-table)
        đang có trong DOM.
     2. Với mỗi bảng: gắn role bảng/nhóm dòng/dòng/cột như trên; đọc
        text từng <th> trong <thead> làm danh sách tên cột.
     3. Với mỗi <td> trong <tbody> cùng vị trí 1 cột: gắn
        data-label="<tên cột>" + gắn aria-label phù hợp (field hoặc
        chính ô đó). Bỏ qua ô có colspan (panel chi tiết, không
        tương ứng đúng 1 cột — CSS đã tự cho nó full-width).
     4. Dùng MutationObserver quan sát <body> để tự chạy lại mỗi khi
        1 bảng bị render lại (đổi trang, bấm Refresh, tìm kiếm,
        thêm/sửa/xoá 1 dòng...) — luôn gộp nhiều thay đổi liên tiếp
        thành 1 lần quét bằng requestAnimationFrame, tránh quét lặp
        lại nhiều lần không cần thiết trong 1 lần render.

   ⚠️ File này CHỈ gắn thuộc tính (data-label/role/aria-label) —
      không tự vẽ giao diện "card". Giao diện card nằm hoàn toàn
      trong admin/dashboard-mobile.css (dùng content:attr(data-
      label) trong @media). Thiếu 1 trong 2 file thì tính năng
      không hoàn chỉnh:
        - Thiếu CSS: có data-label nhưng bảng vẫn hiển thị dạng bảng
          thường (cuộn ngang) — không lỗi, chỉ không có giao diện
          card.
        - Thiếu file JS này: bảng hiển thị dạng card nhưng KHÔNG có
          tên cột (vì thiếu data-label để CSS đọc) — vẫn dùng được,
          chỉ khó hiểu hơn, và không có phần bù accessibility.

   ⚠️ KHÔNG thêm <script> tĩnh vào admin/dashboard.html — theo đúng
      kiến trúc hiện tại (xem README Mục 3.1 & Mục 20), mọi module
      admin (trừ vài dòng hạ tầng) đều được admin/core/dashboard-
      auth.js tự nạp bằng JS SAU KHI xác thực xong, thông qua mảng
      SCRIPT_SEQUENCE. File này KHÔNG phụ thuộc `client`/
      `currentSession` hay bất kỳ module nào khác (chỉ thao tác DOM
      thuần) nên có thể đặt ở BẤT KỲ vị trí nào trong mảng đó —
      khuyến nghị thêm vào cuối cùng, ngay sau dòng
      "./core/dashboard-nav.js":

        const SCRIPT_SEQUENCE = [
          ...
          "./core/dashboard-nav.js",
          "./dashboard-mobile-tables.js",   // ⚠️ MỚI — thêm dòng này
        ];

      (Đặt file vật lý ngay trong thư mục admin/, cùng cấp với
      dashboard-mobile-menu.js — không cần thư mục con riêng vì đây
      cũng là 1 tiện ích nhỏ dùng chung toàn Dashboard, giống hệt vai
      trò của dashboard-mobile-menu.js.)
   ══════════════════════════════════════════════ */

(function () {
  const TABLE_SELECTOR = "table.game-table, #anDetailTable table";

  function labelizeTable(table) {
    table.setAttribute("role", "table");

    const thead = table.querySelector("thead");
    if (thead) thead.setAttribute("role", "rowgroup");
    const tbody = table.querySelector("tbody");
    if (tbody) tbody.setAttribute("role", "rowgroup");

    const headerCells = [...table.querySelectorAll("thead th")];
    headerCells.forEach(th => th.setAttribute("role", "columnheader"));
    table.querySelectorAll("thead > tr").forEach(tr => tr.setAttribute("role", "row"));

    const headers = headerCells.map(th => th.textContent.trim());
    if (!headers.length) return;

    table.querySelectorAll("tbody > tr").forEach(tr => {
      tr.setAttribute("role", "row");

      [...tr.children].forEach((td, i) => {
        if (td.tagName !== "TD") return;
        td.setAttribute("role", "cell");
        if (td.hasAttribute("colspan")) return; // panel chi tiết full-width — không tương ứng 1 cột

        const label = headers[i];
        if (!label) return;
        td.setAttribute("data-label", label);

        /* <thead> bị display:none trên mobile — cũng ẩn khỏi trình
           đọc màn hình, nên phải bù ngữ cảnh "đang ở cột nào" theo
           1 trong 2 cách dưới đây, tuỳ nội dung ô là gì. */
        const field = td.querySelector("input, select, textarea");
        if (field) {
          if (!field.hasAttribute("aria-label") && !field.hasAttribute("aria-labelledby")) {
            field.setAttribute("aria-label", label);
          }
        } else if (!td.querySelector("button, a")) {
          // Ô chỉ có văn bản/badge thuần — gắn aria-label ngay trên <td>
          const valueText = td.textContent.trim();
          if (valueText) td.setAttribute("aria-label", label + ": " + valueText);
        }
        // Ô chứa nút (Sửa/Xoá...) — không đụng, nút đã tự có tên rõ ràng.
      });
    });
  }

  function scanAll() {
    document.querySelectorAll(TABLE_SELECTOR).forEach(labelizeTable);
  }

  /* Quét ngay lần đầu — phòng khi bảng đã render trước khi script
     này kịp load (VD: trang Boardgames tự gọi loadGames() ngay khi
     dashboard-games.js chạy xong, có thể xảy ra trước file này nếu
     ai đó lỡ đặt sai vị trí trong SCRIPT_SEQUENCE). */
  scanAll();

  /* Gom nhiều thay đổi DOM liên tiếp thành 1 lần quét duy nhất mỗi
     khung hình (requestAnimationFrame) — tránh quét hàng chục lần
     khi 1 bảng render xong toàn bộ tbody cùng lúc, hoặc khi nhiều
     bảng trên cùng 1 trang cùng cập nhật gần như đồng thời.
     Chỉ theo dõi childList/subtree (thêm/bớt node) — KHÔNG theo dõi
     attributes, nên việc setAttribute(...) ở trên không tự kích
     hoạt lại observer này (không có nguy cơ lặp vô hạn). */
  let pending = false;
  const observer = new MutationObserver(() => {
    if (pending) return;
    pending = true;
    requestAnimationFrame(() => { pending = false; scanAll(); });
  });
  observer.observe(document.body, { childList: true, subtree: true });
})();
