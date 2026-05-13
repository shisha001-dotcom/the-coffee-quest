const GAMES = [

  // ── GAME 1: UNO ───────────────────────────────────────────────────────────
  {
    name: "Uno",
    category: "Party",
    emoji: "🃏",
    players: "2-10",
    time: "15 phút",
    difficulty: "Dễ",
    color: "#e63946",
    heroBg: "https://upload.wikimedia.org/wikipedia/commons/thumb/2/28/Baraja_de_UNO.JPG/1200px-Baraja_de_UNO.JPG",
    objective: "Đánh hết bài trên tay trước những người chơi còn lại.",
    setup: [
      "Trộn đều 108 lá bài",
      "Mỗi người nhận 7 lá bài (giữ bí mật)",
      "Úp phần còn lại thành chồng bài rút, lật 1 lá lên làm bài bắt đầu"
    ],
    turn: [
      "Đánh 1 lá cùng MÀU hoặc cùng SỐ với lá trên bàn",
      "Không đánh được → rút 1 lá từ chồng bài",
      "Còn đúng 1 lá → phải hô to 'UNO!' ngay khi đánh lá áp cuối"
    ],
    win: "Người đánh hết bài đầu tiên thắng ván. Tích điểm từ bài còn lại của đối thủ — đủ 500 điểm thắng cả trận.",
    tips: [
      "Giữ lại Wild Draw Four làm át chủ bài, chỉ dùng khi cần thiết.",
      "Khi đối thủ còn 1 lá (đã hô UNO), dùng Draw Two hoặc Wild Draw Four để phá họ.",
      "Quên hô UNO và bị bắt → phạt rút 2 lá!"
    ],
    images: [
      { url: "https://upload.wikimedia.org/wikipedia/commons/thumb/2/28/Baraja_de_UNO.JPG/640px-Baraja_de_UNO.JPG", caption: "Bộ bài Uno đầy đủ 108 lá" },
      { url: "https://upload.wikimedia.org/wikipedia/commons/9/9f/UNO_cards_deck.svg", caption: "Các loại lá bài đặc biệt trong Uno" }
    ],
    youtubeUrl: "https://www.youtube.com/watch?v=ZHXuav5okgc"
  },

  // ── GAME 2: TICKET TO RIDE ────────────────────────────────────────────────
  {
    name: "Ticket to Ride",
    category: "Family",
    emoji: "🚂",
    players: "2-5",
    time: "45-75 phút",
    difficulty: "Trung bình",
    color: "#457b9d",
    heroBg: null,
    objective: "Hoàn thành các tuyến đường sắt bí mật và xây mạng lưới đường sắt dài nhất.",
    setup: [
      "Trải bản đồ Bắc Mỹ ra giữa bàn",
      "Mỗi người nhận 45 toa tàu và 4 thẻ Tàu ngẫu nhiên",
      "Rút 3 Vé Nhiệm Vụ — giữ ít nhất 2, có thể giữ cả 3",
      "Lật 5 thẻ Tàu lên mặt bàn"
    ],
    turn: [
      "HÀNH ĐỘNG A: Rút 2 thẻ Tàu (từ 5 thẻ ngửa hoặc chồng úp)",
      "HÀNH ĐỘNG B: Xây tuyến đường (bỏ thẻ đúng màu và đủ số lượng)",
      "HÀNH ĐỘNG C: Rút thêm Vé Nhiệm Vụ (rút 3, giữ ít nhất 1)"
    ],
    win: "Cộng điểm tuyến + điểm vé hoàn thành - điểm vé chưa xong + 10đ cho đường dài nhất. Người nhiều điểm nhất thắng.",
    tips: [
      "Giữ bí Vé Nhiệm Vụ — đừng lộ bạn cần đường nào để đối thủ chặn.",
      "Tuyến 5-6 ô cho 10-15đ — ưu tiên xây sớm.",
      "Thu thập đủ thẻ màu TRƯỚC khi xây tuyến quan trọng."
    ],
    images: null,
    youtubeUrl: "https://www.youtube.com/watch?v=QbM85mJmRKs"
  },

  // ── GAME 3: CATAN ─────────────────────────────────────────────────────────
  {
    name: "Catan",
    category: "Strategy",
    emoji: "🏝️",
    players: "3-4",
    time: "60-120 phút",
    difficulty: "Trung bình",
    color: "#e9c46a",
    heroBg: null,
    objective: "Đạt 10 điểm chiến thắng đầu tiên bằng cách xây dựng khu định cư và thành phố.",
    setup: [
      "Xếp ngẫu nhiên 19 ô địa hình thành bản đồ lục giác",
      "Đặt số xúc xắc theo thứ tự chữ cái lên các ô (bỏ qua sa mạc)",
      "Mỗi người đặt 2 khu định cư và 2 đường ban đầu (miễn phí)"
    ],
    turn: [
      "Tung 2 xúc xắc — ô có số đó sản xuất tài nguyên cho mọi người kề ô",
      "Trao đổi tài nguyên với người chơi khác hoặc ngân hàng",
      "Dùng tài nguyên để xây đường, định cư, thành phố hoặc mua thẻ phát triển"
    ],
    win: "Người đầu tiên đạt đúng 10 điểm trong lượt của mình thắng ngay. Điểm từ: định cư(1đ), thành phố(2đ), Longest Road(2đ), Largest Army(2đ), thẻ VP(1đ/thẻ).",
    tips: [
      "Chọn vị trí kề nhiều số xuất hiện thường (6, 8, 5, 9) và đa dạng tài nguyên.",
      "Đừng tích hơn 7 tài nguyên — mất một nửa khi ai đó tung số 7.",
      "Xây đường hướng về cảng để tối ưu tỷ lệ trao đổi 2:1."
    ],
    images: null,
    youtubeUrl: "https://www.youtube.com/watch?v=UN8Pu7EhDpI"
  },

  // ── GAME 4: PANDEMIC ──────────────────────────────────────────────────────
  {
    name: "Pandemic",
    category: "Cooperative",
    emoji: "🦠",
    players: "2-4",
    time: "45-60 phút",
    difficulty: "Trung bình",
    color: "#2a9d8f",
    heroBg: null,
    objective: "Cả nhóm cùng tìm vaccine cho 4 loại dịch bệnh trước khi thế giới sụp đổ.",
    setup: [
      "Đặt Trạm Nghiên cứu đầu tiên tại Atlanta",
      "Rút 9 thẻ Nhiễm: 3 thành phố đầu 3 khối, 3 thành phố tiếp 2 khối, 3 thành phố cuối 1 khối",
      "Xáo 4 thẻ Epidemic vào chồng thẻ Player, chia đều thành 4 phần",
      "Mỗi người nhận vai trò đặc biệt ngẫu nhiên"
    ],
    turn: [
      "Thực hiện 4 hành động: di chuyển, xây Trạm, xử lý bệnh, chữa bệnh, cho/nhận thẻ",
      "Rút 2 thẻ Player (nếu rút Epidemic → xử lý ngay)",
      "Rút thẻ Nhiễm theo mức hiện tại — nguy cơ bùng phát dây chuyền"
    ],
    win: "TẤT CẢ CÙNG THẮNG khi tìm được vaccine cho cả 4 loại bệnh. CÙNG THUA nếu bùng phát 8 lần, hết thẻ rút, hoặc hết khối bệnh bất kỳ màu nào.",
    tips: [
      "Giao tiếp và lên kế hoạch cùng nhau — đây là game hợp tác!",
      "Ưu tiên dập bùng phát (Outbreak) hơn chữa bệnh lẻ tẻ.",
      "Nhớ rằng sau Epidemic, các thành phố đã nhiễm SẼ bị lại sớm!"
    ],
    images: null,
    youtubeUrl: "https://www.youtube.com/watch?v=ojt0lPlMxHs"
  },

  // ── GAME 5: CỜ VUA ────────────────────────────────────────────────────────
  {
    name: "Cờ Vua",
    category: "Classic",
    emoji: "♟️",
    players: "2",
    time: "15-180 phút",
    difficulty: "Khó",
    color: "#1a1a1a",
    heroBg: null,
    objective: "Chiếu bí (Checkmate) Vua đối phương.",
    setup: [
      "Đặt bàn cờ sao cho góc PHẢI của mỗi người là ô SÁNG",
      "Hàng 1: Xe-Mã-Tượng-Hậu-Vua-Tượng-Mã-Xe. Hàng 2: 8 Tốt",
      "Đen đối xứng ở hàng 7-8. Hậu đứng ô cùng màu với mình. Trắng đi trước"
    ],
    turn: [
      "Di chuyển 1 quân theo luật di chuyển của quân đó",
      "Không được để Vua mình bị chiếu sau nước đi",
      "Đặc biệt: Nhập thành, En Passant, Phong cấp Tốt"
    ],
    win: "Chiếu bí Vua đối phương. Hòa khi: Pat, lặp nước 3 lần, 50 nước không ăn quân/đi tốt.",
    tips: [
      "Kiểm soát 4 ô trung tâm (e4, d4, e5, d5) trong khai cuộc.",
      "Nhập thành sớm để bảo vệ Vua.",
      "Phát triển Mã và Tượng trước, không đi Hậu sớm."
    ],
    images: null,
    youtubeUrl: null
  },

  // ── GAME 6: MONOPOLY ──────────────────────────────────────────────────────
  {
    name: "Monopoly",
    category: "Classic",
    emoji: "🏦",
    players: "2-8",
    time: "60-180 phút",
    difficulty: "Trung bình",
    color: "#2d6a4f",
    heroBg: null,
    objective: "Khiến tất cả đối thủ phá sản bằng cách độc quyền bất động sản.",
    setup: [
      "Mỗi người nhận $1,500 từ ngân hàng",
      "Xếp thẻ Community Chest và Chance thành 2 chồng úp",
      "Người tung xúc xắc cao nhất đi đầu"
    ],
    turn: [
      "Tung 2 xúc xắc và di chuyển theo số điểm",
      "Dừng ở đất trống: mua hoặc từ chối (ngân hàng đấu giá)",
      "Dừng ở đất có chủ: trả tiền thuê (x2 nếu độc quyền, tăng mạnh nếu có nhà/khách sạn)"
    ],
    win: "Người duy nhất còn tiền khi tất cả đối thủ đã phá sản.",
    tips: [
      "Nhóm đất màu cam (St. James, Tennessee, New York) được dừng vào nhiều nhất!",
      "Xây đến 3 nhà/ô là 'điểm ngọt' — chi phí hợp lý, tiền thuê vọt mạnh.",
      "Đàm phán trao đổi đất để hoàn thành nhóm màu sớm."
    ],
    images: null,
    youtubeUrl: "https://www.youtube.com/watch?v=L5BeVWmNpSE"
  },

  // ── GAME 7: DIXIT ─────────────────────────────────────────────────────────
  {
    name: "Dixit",
    category: "Party",
    emoji: "🎨",
    players: "3-6",
    time: "30 phút",
    difficulty: "Dễ",
    color: "#9b5de5",
    heroBg: null,
    objective: "Đoán đúng bài của Người Kể Chuyện và đánh lừa người khác chọn bài của mình.",
    setup: [
      "Xáo bài, chia mỗi người 6 lá",
      "Đặt con thỏ tất cả vào ô xuất phát trên bảng điểm"
    ],
    turn: [
      "Người Kể: chọn 1 lá bí mật, đưa ra gợi ý (từ, câu, âm thanh, cử chỉ…)",
      "Người còn lại: chọn 1 lá trong tay mô tả nhất với gợi ý, đặt úp",
      "Xáo tất cả bài, lật ngửa. Mọi người bỏ phiếu bí mật chọn bài của Người Kể"
    ],
    win: "Đầu tiên đạt 30 điểm thắng. Người Kể +3đ nếu có người đoán đúng nhưng không phải tất cả. Quá rõ hoặc quá tối: Người Kể 0đ!",
    tips: [
      "Gợi ý vừa đủ mơ hồ — không quá rõ (tất cả đoán đúng = 0đ) cũng không quá tối.",
      "Bẫy người khác chọn bài của mình bằng cách chọn lá 'gần giống' gợi ý.",
      "Dixit hay nhất khi gợi ý mang tính cá nhân hoặc văn hóa chung của nhóm."
    ],
    images: null,
    youtubeUrl: "https://www.youtube.com/watch?v=aVGUMKrAqUA"
  },

  // ── GAME 8: CARCASSONNE ───────────────────────────────────────────────────
  {
    name: "Carcassonne",
    category: "Family",
    emoji: "🏰",
    players: "2-5",
    time: "30-45 phút",
    difficulty: "Dễ",
    color: "#e07b39",
    heroBg: null,
    objective: "Xây dựng bản đồ và ghi điểm từ thành phố, đường, tu viện và đồng cỏ.",
    setup: [
      "Đặt 1 ô gạch bắt đầu ở giữa bàn",
      "Mỗi người nhận 8 quân Meeple cùng màu",
      "Trộn phần còn lại thành chồng gạch úp"
    ],
    turn: [
      "Lật 1 gạch ngẫu nhiên, đặt vào bản đồ (các cạnh tiếp giáp phải khớp)",
      "Tùy chọn: đặt 1 Meeple lên ô vừa đặt (trong vùng CHƯA có Meeple)",
      "Thu điểm nếu có công trình hoàn chỉnh — Meeple trả về tay"
    ],
    win: "Khi hết gạch: tổng điểm thành phố+đường+tu viện + công trình chưa xong (1đ/gạch) + đồng cỏ (3đ/thành phố hoàn chỉnh kề). Người nhiều nhất thắng.",
    tips: [
      "Đặt Meeple vào thành phố lớn sớm — điểm cao nhất nhưng cần kiên nhẫn.",
      "Nối gạch vào thành phố đối thủ và đặt Meeple vào — cả hai chia điểm đầy đủ!",
      "Meeple Farmer (nằm xuống) ở lại đến cuối ván — rất mạnh nhưng khóa Meeple lâu."
    ],
    images: null,
    youtubeUrl: "https://www.youtube.com/watch?v=I3_BejHOXkA"
  },

// ── GAME 9: NO THANKS ───────────────────────────────────────────────────
  {
    name: "NO THANKS!",
    category: "abc",
    emoji: "🏰",
    players: "2-5",
    time: "10-15 phút",
    difficulty: "Dễ",
    color: "#e07b39",
    heroBg: "https://m.media-amazon.com/images/S/aplus-media/vc/1e9bb57d-eaf6-4564-8259-f77aa1daeaaf._CR0,0,970,300_PT0_SX970__.jpg",
    objective: "No Thanks là một tựa game thẻ bài chiến thuật đơn giản nhưng đầy hại não. Mục tiêu của bạn là có ít điểm phạt nhất khi trò chơi kết thúc. Điểm số được tính bằng tổng các lá bài bạn đã lấy, tuy nhiên các lá bài liên tiếp nhau chỉ tính điểm lá nhỏ nhất. ",
    setup: [
      "Bộ bài: Gồm các lá bài được đánh số từ 3 đến 35.",
      "Chip: Mỗi người chơi nhận số lượng chip bằng nhau (số lượng tùy thuộc vào số người chơi).",
      "Loại bỏ bài: Bỏ ngẫu nhiên 9 lá bài khỏi bộ bài (không ai được xem) và đặt phần còn lại vào giữa bàn. Lật lá đầu tiên lên để bắt đầu. "
    ],
    turn: [
      "Ở mỗi lượt, người chơi hiện tại sẽ đối mặt với lá bài đang được lật ngửa trên bàn và có 2 lựa chọn:",
      "Lấy lá bài: Bạn nhận lá bài đó (cùng toàn bộ chip đang đặt trên lá bài) và đặt vào khu vực của mình. Bạn sẽ là người lật lá bài tiếp theo.",
      "Từ chối (No Thanks!): Bạn đặt 111 chip của mình lên lá bài và nói 'No Thanks!'. Lượt chơi chuyển cho người tiếp theo bên trái. "
    ],
    win: "Khi hết gạch: tổng điểm thành phố+đường+tu viện + công trình chưa xong (1đ/gạch) + đồng cỏ (3đ/thành phố hoàn chỉnh kề). Người nhiều nhất thắng.",
    tips: [
      "Đặt Meeple vào thành phố lớn sớm — điểm cao nhất nhưng cần kiên nhẫn.",
      "Nối gạch vào thành phố đối thủ và đặt Meeple vào — cả hai chia điểm đầy đủ!",
      "Meeple Farmer (nằm xuống) ở lại đến cuối ván — rất mạnh nhưng khóa Meeple lâu."
    ],
    images: [
       { url: "https://i.ytimg.com/vi/wA3LdhgA8BE/hq720.jpg?sqp=-oaymwEhCK4FEIIDSFryq4qpAxMIARUAAAAAGAElAADIQj0AgKJD&rs=AOn4CLCjbNGUF-qNuMUaXwLR8Xxn5QzCYA", caption: "Mô tả ảnh" }
    ],
    youtubeUrl: "https://www.youtube.com/watch?v=I3_BejHOXkA"
  },

   // ── GAME: WEREWOLF ───────────────────────────────────────────────────
{
  name: "WEREWOLF",
  category: "Party Game",
  emoji: "🐺",
  players: "6-20",
  time: "20-45 phút",
  difficulty: "Trung bình",
  color: "#7a1f1f",
  heroBg: "https://cdn.shopify.com/s/files/1/0559/3053/5686/files/werewolf-party-game.jpg",
  
  objective: "Werewolf là trò chơi suy luận và nhập vai nổi tiếng, nơi người chơi được chia thành 2 phe chính: Dân làng và Ma sói. Mục tiêu của Dân làng là tìm ra và loại bỏ toàn bộ Ma sói trước khi bị tiêu diệt. Mục tiêu của Ma sói là bí mật giết hết dân làng để chiếm quyền kiểm soát ngôi làng.",
  
  setup: [
    "6-8 người chơi: Khuyên dùng 2 Ma sói, 1 Tiên tri, 1 Bảo vệ, còn lại là Dân làng.",
    "9-12 người chơi: Khuyên dùng 3 Ma sói, 1 Tiên tri, 1 Bảo vệ, 1 Phù thủy, còn lại là Dân làng.",
    "13-16 người chơi: Có thể thêm Thợ săn, Cupid hoặc Già làng để tăng độ hấp dẫn.",
    "17-20 người chơi: Có thể bổ sung thêm nhiều vai trò đặc biệt như Cô bé, Kẻ phản bội hoặc Sói trắng.",
    "Mỗi người chơi nhận ngẫu nhiên 1 lá vai trò và giữ bí mật tuyệt đối.",
    "Chọn 1 người làm Quản trò để điều khiển trò chơi. Quản trò không tham gia vào bất kỳ phe nào.",
    "Tất cả người chơi ngồi thành vòng tròn để dễ quan sát biểu cảm và thảo luận.",
    "Quản trò yêu cầu mọi người nhắm mắt để bắt đầu đêm đầu tiên."
  ],

  turn: [
    "Trò chơi diễn ra theo vòng lặp gồm Ban đêm và Ban ngày. Trong Ban đêm, tất cả người chơi nhắm mắt và Quản trò lần lượt gọi từng vai trò thức dậy để thực hiện kỹ năng bí mật. Ma sói sẽ chọn 1 người để giết. Sau đó các vai trò đặc biệt như Tiên tri, Bảo vệ hoặc Phù thủy sẽ lần lượt hành động rồi tiếp tục đi ngủ.",
    
    "Khi trời sáng, Quản trò thông báo ai đã chết trong đêm. Người bị loại không được tiếp tục tham gia thảo luận. Những người còn sống bắt đầu tranh luận, suy luận và buộc tội lẫn nhau để tìm ra Ma sói đang ẩn nấp.",
    
    "Sau thời gian thảo luận, tất cả người chơi tiến hành bỏ phiếu treo cổ 1 người bị nghi ngờ nhiều nhất. Người có nhiều phiếu nhất sẽ bị loại và công khai vai trò. Nếu người đó là Ma sói thì phe Dân làng có lợi thế lớn hơn.",
    
    "Ví dụ: Trong đêm, Ma sói chọn người A để giết nhưng Bảo vệ đã bảo vệ A nên không ai chết. Sáng hôm sau, cả làng nghi ngờ người B vì liên tục đổ tội vô lý cho người khác. Sau khi bỏ phiếu, B bị treo cổ và lật ra đúng là Ma sói.",
    
    "Tiên tri là vai trò có khả năng soi 1 người mỗi đêm để biết họ có phải Ma sói hay không. Đây là nguồn thông tin rất quan trọng nhưng dễ bị Ma sói nhắm tới nếu lộ thân phận.",
    
    "Bảo vệ có thể chọn 1 người để bảo vệ mỗi đêm khỏi đòn tấn công của Ma sói. Một số luật mở rộng không cho phép bảo vệ cùng 1 người liên tiếp nhiều đêm.",
    
    "Phù thủy sở hữu 2 bình thuốc gồm 1 thuốc cứu và 1 thuốc độc. Thuốc cứu có thể hồi sinh người bị Ma sói giết trong đêm, còn thuốc độc có thể tiêu diệt bất kỳ ai mà Phù thủy nghi ngờ.",
    
    "Thợ săn khi chết sẽ được quyền kéo theo 1 người khác chết cùng. Đây là vai trò rất nguy hiểm khiến Ma sói phải dè chừng.",
    
    "Cupid có thể ghép 2 người thành cặp đôi. Nếu một người chết thì người còn lại cũng sẽ chết theo vì đau buồn. Điều này tạo ra nhiều tình huống bất ngờ và hài hước."
  ],

  win: "Phe Dân làng thắng khi toàn bộ Ma sói bị loại bỏ. Phe Ma sói thắng khi số lượng Ma sói bằng hoặc nhiều hơn số dân còn sống.",

  tips: [
    "Quan sát biểu cảm và cách phản ứng của người chơi khi bị nghi ngờ.",
    "Nếu là Ma sói, hãy tham gia tranh luận tự nhiên để tránh bị phát hiện.",
    "Tiên tri nên tiết lộ thông tin đúng thời điểm thay vì lộ thân phận quá sớm.",
    "Đừng bỏ phiếu theo cảm tính, hãy chú ý logic và hành động của từng người.",
    "Ma sói thường cố thao túng cuộc trò chuyện để hướng nghi ngờ sang người vô tội."
  ],

  images: [
    {
      url: "https://cdn.shopify.com/s/files/1/0559/3053/5686/files/werewolf-night-phase.jpg",
      caption: "Ban đêm: Ma sói bí mật chọn nạn nhân"
    },
    {
      url: "https://i.ytimg.com/vi/9CkqA7W2M5A/maxresdefault.jpg",
      caption: "Các vai trò phổ biến trong Werewolf"
    }
  ],

  youtubeUrl: "https://www.youtube.com/watch?v=6qy0ROzEWco"
},

   // ── GAME: CLUE ───────────────────────────────────────────────────
{
  name: "CLUE",
  category: "Suy luận",
  emoji: "🕵️",
  players: "3-6",
  time: "30-60 phút",
  difficulty: "Trung bình",
  color: "#6b3fa0",
  heroBg: "https://images.ctfassets.net/r3qu44etwf9a/5k3r2O7k9lKzQ9A7nQv8mK/9fbc7f8a1b6a3c0f7d3a6a0f0d2f8f5e/clue-board-game-hero.jpg",

  objective: "Clue là trò chơi suy luận phá án nổi tiếng, nơi người chơi phải tìm ra 3 bí mật của vụ án mạng: Ai là hung thủ, hung khí gây án là gì và vụ án xảy ra ở căn phòng nào. Người chiến thắng là người đầu tiên đưa ra kết luận chính xác về cả 3 yếu tố.",

  setup: [
    "Chuẩn bị 3 nhóm thẻ gồm: Nhân vật, Hung khí và Căn phòng.",
    "Rút ngẫu nhiên 1 thẻ từ mỗi nhóm rồi đặt bí mật vào phong bì án mạng. Đây chính là lời giải cuối cùng.",
    "Xào toàn bộ các thẻ còn lại và chia đều cho người chơi.",
    "Mỗi người nhận 1 bảng ghi chú để đánh dấu các thông tin đã biết.",
    "Mỗi người chọn 1 nhân vật và đặt quân cờ vào vị trí bắt đầu tương ứng trên bản đồ.",
    "Các hung khí được đặt ngẫu nhiên trong các căn phòng trên bàn chơi.",
    "Nếu chơi 3-4 người: sử dụng toàn bộ vai trò cơ bản. Nếu chơi đủ 5-6 người, tất cả nhân vật sẽ xuất hiện giúp game hỗn loạn và khó đoán hơn."
  ],

  turn: [
    "Trong lượt chơi, người chơi gieo xúc xắc để di chuyển qua các hành lang và tiến vào những căn phòng trong biệt thự. Khi vào được một căn phòng, người chơi có thể đưa ra suy luận về vụ án bằng cách chỉ định 1 nghi phạm và 1 hung khí trong chính căn phòng hiện tại.",
    
    "Ví dụ: Người chơi bước vào Phòng Bếp và nói Tôi nghi ngờ Đại tá Mustard đã dùng Dao trong Phòng Bếp. Lúc này quân Đại tá Mustard và vũ khí Dao sẽ được di chuyển vào căn phòng đó.",
    
    "Sau khi một lời suy luận được đưa ra, người chơi bên trái phải bí mật cho xem 1 lá bài liên quan nếu họ sở hữu ít nhất 1 trong các lá được nhắc tới. Nếu không có, lượt kiểm tra tiếp tục sang người kế tiếp cho tới khi có người chứng minh được suy luận đó sai.",
    
    "Ví dụ: Nếu người chơi nghi ngờ Giáo sư Plum dùng Dây thừng tại Phòng Khách và người bên cạnh có lá Dây thừng, họ sẽ bí mật cho xem lá đó. Điều này giúp người suy luận biết rằng Dây thừng không nằm trong phong bì án mạng.",
    
    "Người chơi cần liên tục ghi chú các thông tin đã xem để loại trừ dần nghi phạm, hung khí và địa điểm. Đây là phần quan trọng nhất của game vì mọi dữ kiện đều phải được suy luận từ logic và trí nhớ.",
    
    "Bất kỳ lúc nào trong lượt của mình, nếu tin rằng đã tìm ra đáp án cuối cùng, người chơi có thể đưa ra cáo buộc chính thức. Người đó sẽ bí mật mở phong bì án mạng để kiểm tra.",
    
    "Nếu cáo buộc chính xác cả 3 yếu tố gồm Hung thủ, Hung khí và Căn phòng, người chơi chiến thắng ngay lập tức.",
    
    "Nếu cáo buộc sai, người chơi bị loại khỏi việc chiến thắng nhưng vẫn phải tiếp tục cho người khác xem bài khi bị hỏi. Điều này khiến việc đoán liều rất rủi ro."
  ],

  win: "Người đầu tiên đưa ra cáo buộc chính xác về Hung thủ, Hung khí và Căn phòng trong phong bì án mạng sẽ chiến thắng.",

  tips: [
    "Luôn ghi chú cẩn thận vì chỉ cần quên 1 thông tin nhỏ cũng có thể làm hỏng toàn bộ suy luận.",
    "Ưu tiên di chuyển vào các phòng mà bạn chưa kiểm tra.",
    "Quan sát phản ứng của người khác khi một nghi phạm hoặc hung khí được nhắc đến.",
    "Đôi khi nên đưa ra suy luận giả để đánh lạc hướng đối thủ.",
    "Đừng vội cáo buộc cuối cùng nếu chưa thật sự chắc chắn."
  ],

  images: [
    {
      url: "https://i.ytimg.com/vi/KEXdWfsKZ1k/maxresdefault.jpg",
      caption: "Bản đồ biệt thự trong Clue"
    },
    {
      url: "https://cf.geekdo-images.com/original/img/clue-cards-example.jpg",
      caption: "Ví dụ các thẻ nghi phạm, hung khí và căn phòng"
    },
    {
      url: "https://i.ytimg.com/vi/cvF0pWc5Taw/maxresdefault.jpg",
      caption: "Người chơi ghi chú để suy luận hung thủ"
    }
  ],

  youtubeUrl: "https://www.youtube.com/watch?v=OuM0P8SZQF4"
},

   // ── GAME: ĐUA RÙA ───────────────────────────────────────────────────
{
  name: "ĐUA RÙA",
  category: "Gia đình",
  emoji: "🐢",
  players: "2-5",
  time: "15-25 phút",
  difficulty: "Dễ",
  color: "#3ca55c",
  heroBg: "https://cf.geekdo-images.com/original/img/turtle-race-banner.jpg",

  objective: "Đua Rùa là trò chơi gia đình vui nhộn và đầy bất ngờ, nơi mỗi người chơi bí mật điều khiển một chú rùa với mục tiêu đưa rùa của mình về đích đầu tiên. Điều thú vị là người chơi không chỉ di chuyển rùa của bản thân mà còn có thể điều khiển tất cả các rùa khác trên đường đua.",

  setup: [
    "Đặt bàn đua ở giữa bàn chơi và xếp tất cả rùa tại ô xuất phát.",
    "Mỗi người chơi bí mật rút hoặc chọn 1 màu rùa đại diện cho mình. Không được tiết lộ màu rùa cho người khác.",
    "Mỗi người chơi nhận số lá bài di chuyển bằng nhau.",
    "Nếu chơi 2-3 người: dùng ít màu rùa hơn để tăng khả năng suy luận.",
    "Nếu chơi 4-5 người: sử dụng đủ các màu rùa để cuộc đua hỗn loạn và khó đoán hơn.",
    "Xào bộ bài di chuyển và chia bài cho người chơi.",
    "Người nhỏ tuổi nhất hoặc người thích rùa nhất sẽ đi trước."
  ],

  turn: [
    "Trong lượt chơi, người chơi chọn 1 lá bài trên tay và thực hiện hành động ghi trên lá bài đó. Các lá bài thường cho phép di chuyển 1 chú rùa tiến lên hoặc lùi lại một số ô nhất định.",
    
    "Điểm đặc biệt của Đua Rùa là các chú rùa có thể chồng lên nhau. Nếu một chú rùa ở dưới cùng di chuyển, toàn bộ chồng rùa nằm phía trên sẽ được kéo đi cùng.",
    
    "Ví dụ: Rùa đỏ đang nằm dưới rùa xanh và rùa vàng. Khi rùa đỏ tiến lên 2 ô, cả rùa xanh và rùa vàng cũng di chuyển theo vì đang đứng trên lưng rùa đỏ.",
    
    "Người chơi có thể sử dụng bài để hỗ trợ rùa của mình hoặc cố tình giúp rùa khác nhằm đánh lạc hướng đối thủ. Điều này khiến việc đoán màu rùa của nhau trở nên rất khó.",
    
    "Ví dụ: Người chơi liên tục đẩy rùa xanh lên đầu đoàn đua khiến mọi người nghĩ đó là rùa của họ, nhưng thực tế họ đang bí mật điều khiển rùa vàng đang bám ngay phía sau.",
    
    "Một số phiên bản có thêm lá bài đặc biệt như di chuyển bất kỳ rùa nào, đổi vị trí hoặc khiến rùa đi lùi để tạo thêm hỗn loạn.",
    
    "Sau khi thực hiện hành động, người chơi rút thêm bài để giữ đủ số lượng bài trên tay rồi chuyển lượt cho người tiếp theo.",
    
    "Trò chơi tiếp tục cho tới khi có ít nhất 1 chú rùa cán đích. Nếu nhiều rùa cùng về đích do đang chồng lên nhau, rùa nằm dưới cùng sẽ được tính là về trước."
  ],

  win: "Người chơi chiến thắng nếu chú rùa bí mật của mình về đích đầu tiên. Nếu nhiều rùa cùng tới đích, thứ tự được tính từ dưới lên trên của chồng rùa.",

  tips: [
    "Đừng quá lộ việc liên tục hỗ trợ rùa của mình.",
    "Tận dụng cơ chế chồng rùa để kéo nhiều rùa đi cùng.",
    "Đôi khi giúp rùa đối thủ dẫn đầu sẽ khiến mọi người nghi ngờ sai.",
    "Giữ lại các lá bài mạnh cho thời điểm gần đích.",
    "Quan sát xem người khác thường hỗ trợ màu nào để suy luận bí mật của họ."
  ],

  images: [
    {
      url: "https://i.ytimg.com/vi/turtle-race-boardgame-maxresdefault.jpg",
      caption: "Các chú rùa chồng lên nhau trong cuộc đua"
    },
    {
      url: "https://cf.geekdo-images.com/original/img/turtle-race-gameplay.jpg",
      caption: "Ví dụ bàn chơi Đua Rùa"
    },
    {
      url: "https://i.ytimg.com/vi/turtle-race-cards.jpg",
      caption: "Các lá bài di chuyển trong game"
    }
  ],

  youtubeUrl: "https://www.youtube.com/watch?v=V7Xq1k6g0mM"
}

  // ═══════════════════════════════════════════════════════════════
  //  THÊM GAME MỚI — COPY BLOCK NÀY, DÁN TRƯỚC DẤU ] CUỐI MẢNG
  //  và thêm dấu PHẨY sau } của game trước đó.
  //
  // ,{
  //   name: "Tên Game",
  //   category: "Party",
  //   emoji: "🎲",
  //   players: "2-4",
  //   time: "30 phút",
  //   difficulty: "Dễ",
  //   color: "#e63946",
  //   heroBg: null,            // URL ảnh nền hero, hoặc null
  //   objective: "Mục tiêu thắng.",
  //   setup: ["Bước 1", "Bước 2"],
  //   turn:  ["Hành động 1", "Hành động 2"],
  //   win:   "Điều kiện chiến thắng.",
  //   tips:  ["Mẹo 1", "Mẹo 2"],
  //   images: [
  //     { url: "https://...", caption: "Mô tả ảnh" }
  //   ],
  //   youtubeUrl: "https://www.youtube.com/watch?v=..."
  // }
  // ═══════════════════════════════════════════════════════════════
];
