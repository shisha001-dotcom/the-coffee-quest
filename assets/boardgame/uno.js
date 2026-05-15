GAMES.push({
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
});
