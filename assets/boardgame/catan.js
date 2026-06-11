GAMES.push({
  name: "Catan",
  category: "♟️ Chiến lược",
  emoji: "🏝️",
  players: "3-4",
  time: "60-90 phút",
  difficulty: "Trung bình",
  color: "#E8A838",
  heroBg: "https://www.catan.com/sites/default/files/2021-06/catan_box_right_0.png",

  objective: "Catan là cuộc đua xây dựng nền văn minh trên hòn đảo Catan — nơi tài nguyên phân bổ ngẫu nhiên mỗi ván tạo ra một bản đồ hoàn toàn khác nhau. Người chơi thu thập 5 loại tài nguyên (gỗ, gạch, lúa mì, quặng, len) bằng cách đặt khu định cư tại các ô đất màu mỡ, sau đó dùng tài nguyên để xây dựng đường, khu định cư mới và thành phố. Mỗi khu định cư cho 1 điểm chiến thắng, mỗi thành phố cho 2 điểm, một số thẻ phát triển và thành tích đặc biệt cũng cho điểm thưởng. Người đầu tiên đạt đúng 10 điểm chiến thắng trong lượt của mình thắng ngay lập tức.",

  setup: [
    "Lắp ráp bảng Catan bằng cách xếp ngẫu nhiên 19 ô lục giác tài nguyên (4 ô rừng/gỗ, 4 ô đồng cỏ/len, 4 ô cánh đồng/lúa mì, 3 ô núi/quặng, 3 ô đồi/gạch, 1 ô sa mạc) thành hình lục giác lớn. Đặt viền biển xung quanh gồm các ô cảng (2:1 chuyên dụng và 3:1 đa năng) xen kẽ ô biển. Đặt token số (từ 2–12, trừ 7) lên từng ô tài nguyên theo thứ tự chữ cái A→R trên vòng xoắn ốc từ ngoài vào trong — ô sa mạc không nhận token số.",
    "Mỗi người chọn màu quân của mình và lấy: 5 khu định cư, 4 thành phố, 15 con đường. Xáo bộ bài phát triển (gồm 14 thẻ Kỵ binh, 5 thẻ Điểm Chiến Thắng, 2 thẻ Xây Dựng, 2 thẻ Ngoại Giao, 2 thẻ Phong Phú) và đặt úp ở giữa bàn cùng với các đống tài nguyên phân loại riêng biệt — đây là nguồn cung chung của ngân hàng.",
    "Thiết lập ban đầu diễn ra 2 vòng ngược chiều: Vòng 1, lần lượt từng người đặt 1 khu định cư tại giao điểm hợp lệ (không được cạnh khu định cư khác) và 1 con đường liền kề. Vòng 2, đi ngược lại thứ tự (người đi cuối vòng 1 đi đầu vòng 2) — mỗi người lại đặt thêm 1 khu định cư và 1 con đường. Sau khi đặt khu định cư thứ 2, mỗi người nhận ngay tài nguyên từ tất cả các ô lục giác tiếp giáp với khu định cư đó — đây là nguồn tài nguyên khởi đầu của bạn.",
    "Đặt quân Cướp Biển (Robber) lên ô sa mạc. Người chơi trẻ nhất (hoặc người vừa đến đảo lần đầu — tùy thỏa thuận) đi lượt đầu tiên. Thứ tự lượt theo chiều kim đồng hồ."
  ],

  turn: [
    "Bước 1 — Tung xúc xắc (bắt buộc, làm đầu tiên): Tung 2 xúc xắc và cộng kết quả. Tất cả người chơi (không chỉ người đang đi) nhận tài nguyên từ các ô lục giác có token số khớp với tổng xúc xắc, với điều kiện họ có khu định cư hoặc thành phố tiếp giáp ô đó — khu định cư nhận 1 tài nguyên, thành phố nhận 2. Nếu ngân hàng không đủ tài nguyên cho tất cả, không ai nhận loại tài nguyên đó lượt này. Nếu lăn được 7: không ai nhận tài nguyên — xem luật số 7 bên dưới.",
    "Luật số 7 — Cướp Biển: Khi tung được 7, đầu tiên mọi người chơi đang cầm hơn 7 lá tài nguyên phải bỏ đi một nửa (làm tròn xuống, tự chọn bỏ lá nào). Sau đó, người tung được 7 di chuyển quân Cướp Biển sang bất kỳ ô lục giác nào khác — ô đó bị chặn (không sản xuất tài nguyên) cho đến khi Cướp Biển bị di chuyển đi. Người đặt Cướp Biển được lấy ngẫu nhiên 1 lá tài nguyên từ tay bài của bất kỳ người nào có khu định cư/thành phố tiếp giáp ô đó (nếu có).",
    "Bước 2 — Thương mại (tùy chọn, sau khi tung xúc xắc): Bạn có thể đổi tài nguyên theo 2 cách. (A) Đổi với ngân hàng: tỉ lệ mặc định là 4:1 (4 lá cùng loại đổi 1 lá bất kỳ); nếu có khu định cư tại cảng 3:1 thì đổi 3:1; nếu tại cảng 2:1 chuyên dụng (ví dụ cảng gỗ) thì đổi 2 lá gỗ lấy 1 lá bất kỳ. (B) Đổi với người chơi khác: thương lượng tự do — tỉ lệ, điều kiện, số lượng hoàn toàn do hai bên quyết định. Chỉ người đang trong lượt mới được phép đổi với ngân hàng; đổi với người khác thì cả hai phải đồng ý.",
    "Bước 3 — Xây dựng (tùy chọn, sau khi tung xúc xắc): Bạn có thể xây bất kỳ số lượng công trình nào miễn đủ tài nguyên. Chi phí: Đường = 1 gỗ + 1 gạch (phải liền với đường/khu định cư của bạn); Khu định cư = 1 gỗ + 1 gạch + 1 lúa mì + 1 len (phải ở giao điểm hợp lệ tiếp giáp đường của bạn, cách khu định cư khác ít nhất 2 cạnh); Thành phố = 2 lúa mì + 3 quặng (nâng cấp từ khu định cư sẵn có, trả lại khu định cư cho nguồn dự trữ); Thẻ Phát Triển = 1 lúa mì + 1 quặng + 1 len (rút ngẫu nhiên từ chồng bài, không được dùng ngay lượt mua). Sau khi xây xong, lượt chuyển sang người tiếp theo."
  ],

  win: "Game kết thúc ngay trong lượt của người chơi khi họ đạt đúng hoặc vượt 10 điểm chiến thắng — không cần đợi hết vòng. Cách tính điểm: mỗi khu định cư = 1 điểm, mỗi thành phố = 2 điểm, thẻ Điểm Chiến Thắng (trong bài phát triển) = 1 điểm/thẻ, danh hiệu Đội Quân Hùng Mạnh (người đầu tiên có ít nhất 3 thẻ Kỵ Binh đã dùng, và nhiều hơn tất cả người còn lại) = 2 điểm, danh hiệu Con Đường Dài Nhất (người đầu tiên có chuỗi đường liên tục dài ít nhất 5 cạnh, và dài hơn tất cả) = 2 điểm. Lưu ý: thẻ Điểm Chiến Thắng giữ bí mật trong tay đến khi thắng — công bố cùng lúc khi tuyên bố chiến thắng. Nếu hai người cùng đủ 10 điểm trong cùng một lượt (không thể xảy ra theo luật), người đang đi lượt thắng.",

  tips: [
    "Ưu tiên đặt khu định cư đầu tiên tại giao điểm tiếp giáp 3 loại tài nguyên khác nhau — đặc biệt là gỗ và gạch để xây đường nhanh trong giai đoạn đầu, và lúa mì/quặng để mua thẻ phát triển và thành phố về sau. Tránh dồn vào 1–2 loại tài nguyên vì khi đó bạn hoàn toàn phụ thuộc vào thương mại — nếu người khác không muốn đổi, bạn bị tê liệt.",
    "Theo dõi điểm của đối thủ liên tục — khi ai đó đạt 7–8 điểm, hãy dùng Cướp Biển chặn ô tài nguyên quan trọng nhất của họ mỗi khi tung được 7, và ưu tiên chặn đường mở rộng của họ. Đừng để người dẫn đầu tự do phát triển trong khi bạn lo xây dựng cho mình — Catan là game bán hợp tác ở giai đoạn cuối.",
    "Khi đang kẹt tài nguyên (không tung được số mình cần nhiều lượt liên tiếp), đừng ngồi chờ — chủ động thương lượng đổi với người chơi khác ngay cả khi tỉ lệ không lợi lắm. Mua 1 thẻ phát triển khi có đủ nguyên liệu cũng là cách dùng tài nguyên hiệu quả: thẻ Kỵ Binh giúp bạn đặt Cướp Biển chủ động và tích lũy danh hiệu Đội Quân Hùng Mạnh trị giá 2 điểm."
  ],

  images: [
    {
      url: "https://cf.geekdo-images.com/W3Bsga_uLP9kO91gZ7H8yw__opengraph/img/M9o4PVbGHQOwRHgATuqGLaAFx-k=/fit-in/1200x630/filters:strip_icc()/pic2419375.jpg",
      caption: "Bản đồ Catan được lắp ráp ngẫu nhiên với các ô tài nguyên, token số và quân của người chơi đang dần mở rộng lãnh thổ."
    }
  ],

  youtubeUrl: "https://www.youtube.com/watch?v=aZUPbOKKB-Y"
});
