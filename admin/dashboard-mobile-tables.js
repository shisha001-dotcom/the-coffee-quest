/* ══════════════════════════════════════════════
   RESPONSIVE TABLES (MOBILE) — admin/dashboard-mobile-tables.js
   ─────────────────────────────────────────────
   VAI TRÒ
   Gắn thuộc tính vào các bảng dữ liệu để chúng hiển thị được dạng
   "thẻ" (mỗi dòng = 1 thẻ) trên điện thoại. File này CHỈ gắn thuộc
   tính, KHÔNG vẽ giao diện — phần vẽ nằm trong
   admin/dashboard-mobile.css (mục 2.4, trong @media max-width:640px).

   Với mỗi bảng, file gắn:
     - data-label="<tên cột>" lên từng <td>. CSS đọc thuộc tính này qua
       content: attr(data-label) để hiện nhãn cột phía trên giá trị.
     - role="table / rowgroup / row / columnheader / cell": trên mobile CSS
       đổi bảng sang display:block và ẩn <thead> bằng display:none.
       display:none ẩn luôn khỏi trình đọc màn hình, nên phải gắn role để
       giữ ngữ nghĩa bảng.
     - aria-label bù tên cột cho người dùng trình đọc màn hình:
         · Ô có input/select/textarea → aria-label đặt trên chính field
           (nếu field chưa có nhãn).
         · Ô chỉ có chữ/badge (không nút, không link) → aria-label trên
           <td>, dạng "Tên cột: giá trị".
         · Ô có nút/link → để nguyên (nút đã tự có tên).
     - Ô có colspan (dòng chi tiết mở rộng) bị bỏ qua vì không ứng với đúng 1 cột.

   Nếu thiếu 1 trong 2 file (JS này / CSS mobile):
     - Thiếu CSS: bảng vẫn hiện như bảng thường (cuộn ngang).
     - Thiếu JS: bảng hiện dạng thẻ nhưng không có tên cột.

   CÁCH THEO DÕI BẢNG MỚI RENDER
   Các module tạo bảng bằng cách gán tbody.innerHTML, không có hook nào
   báo "bảng vừa vẽ lại". Vì vậy dùng MutationObserver trên <body>, gom
   nhiều thay đổi liên tiếp thành 1 lần quét mỗi khung hình
   (requestAnimationFrame). Observer chỉ theo dõi thêm/bớt node
   (childList) chứ KHÔNG theo dõi attributes, nên việc setAttribute ở
   dưới không kích hoạt lại observer (không lặp vô hạn).

   ⚠️ HARDCODE — TABLE_SELECTOR
   "table.game-table, #anDetailTable table" phải KHỚP với các selector
   trong mục 2.4 của dashboard-mobile.css. Thêm loại bảng mới cần hiển thị
   dạng thẻ → thêm selector ở CẢ HAI file.

   THỨ TỰ NẠP
   Nằm trong SCRIPT_SEQUENCE của core/dashboard-auth.js. Chỉ thao tác DOM,
   không phụ thuộc module nào nên đặt vị trí nào cũng được. Ở đầu file có
   1 lần quét ngay để bắt các bảng đã render trước khi file này nạp xong.
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

        /* Bù ngữ cảnh "đang ở cột nào" cho trình đọc màn hình (vì <thead>
           bị ẩn trên mobile) — chọn cách gắn tuỳ nội dung ô. */
        const field = td.querySelector("input, select, textarea");
        if (field) {
          if (!field.hasAttribute("aria-label") && !field.hasAttribute("aria-labelledby")) {
            field.setAttribute("aria-label", label);
          }
        } else if (!td.querySelector("button, a")) {
          // Ô chỉ có văn bản/badge thuần — gắn aria-label ngay trên <td>
          // (định dạng "Tên cột: giá trị" — đổi dấu ": " ở dòng dưới nếu muốn)
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

  /* Quét ngay lần đầu — phòng khi bảng đã render trước khi file này nạp xong
     (vd: trang Boardgames tự gọi loadGames() ngay khi dashboard-games.js chạy). */
  scanAll();

  /* Quét lại mỗi khi DOM thay đổi, gộp về tối đa 1 lần / khung hình. */
  let pending = false;
  const observer = new MutationObserver(() => {
    if (pending) return;
    pending = true;
    requestAnimationFrame(() => { pending = false; scanAll(); });
  });
  observer.observe(document.body, { childList: true, subtree: true });
})();
