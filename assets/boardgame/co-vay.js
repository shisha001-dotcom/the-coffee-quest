GAMES.push({
name: "Cờ Vây",
category: "♟️ Chiến lược",
emoji: "☯️",
players: "2",
time: "30-180 phút (tùy cấp độ)",
difficulty: "Cao",
color: "#343A40",
heroBg: "https://upload.wikimedia.org/wikipedia/commons/thumb/c/c5/Go-game-on-wood-board.jpg/1920px-Go-game-on-wood-board.jpg",
objective: "Mục tiêu là kiểm soát nhiều lãnh thổ (các giao điểm trống được bao vây) và bắt quân của đối thủ hơn. Người chơi nào có tổng số lãnh thổ và quân bị bắt lớn hơn sẽ thắng.",
setup: [
"Đặt bàn cờ vây (goban) lên giữa người chơi; bàn cờ tiêu chuẩn là lưới 19x19 đường kẻ, tạo ra 361 giao điểm, mặc dù có thể chơi trên các bàn cờ nhỏ hơn như 9x9 hoặc 13x13 cho người mới bắt đầu hoặc các trận đấu nhanh để làm quen với luật chơi cơ bản.",
"Mỗi người chơi chọn một màu quân cờ: một người chơi lấy quân đen (kurogo) và người còn lại lấy quân trắng (shirogo), mỗi bên có số lượng quân cờ đủ để phủ kín bàn cờ (thường là 181 quân đen và 180 quân trắng cho bàn 19x19). Quân cờ được đặt trong các bát đựng quân gọi là go-bowl.",
"Người chơi quân đen luôn đi trước; để quyết định ai là người chơi quân đen, có thể oẳn tù tì hoặc dùng phương pháp truyền thống gọi là nigiri (một người chơi nắm một số quân cờ, người kia đoán chẵn lẻ, nếu đúng thì được chọn màu), sau đó quân đen đặt quân đầu tiên vào bất kỳ giao điểm trống nào trên bàn cờ."
],
turn: [
"Đến lượt mình, người chơi đặt một quân cờ của mình vào bất kỳ giao điểm trống nào trên bàn cờ. Quân cờ đã đặt không được di chuyển, trừ khi bị bắt hoặc được coi là đã 'chết' theo luật chơi sau này.",
"Khi một nhóm quân cờ bị đối thủ bao vây hoàn toàn (tất cả các 'khí' hay 'liberties' - các giao điểm trống liền kề theo chiều ngang hoặc dọc - bị đối thủ chiếm đóng), nhóm quân đó sẽ bị bắt và loại bỏ khỏi bàn cờ, sau đó được đặt vào kho chứa quân bị bắt của người bắt.",
"Người chơi có thể chọn 'pass' (bỏ lượt) thay vì đặt quân; trò chơi kết thúc khi cả hai người chơi liên tục pass hai lần, báo hiệu rằng không còn nước đi có ý nghĩa nào nữa để thay đổi kết quả của ván cờ."
],
win: "Người chơi nào kiểm soát nhiều lãnh thổ (các giao điểm trống được bao vây) và có nhiều quân đối thủ bị bắt hơn sẽ thắng. Điểm số được tính bằng tổng số lãnh thổ và số quân bị bắt của mỗi người chơi, sau đó so sánh với đối thủ; thường có thêm komi (điểm bù) cho người đi sau (quân trắng) để cân bằng lợi thế đi trước của quân đen.",
tips: [
"Học cách tính 'khí' (liberties) của một nhóm quân là rất quan trọng để tránh bị bắt và biết cách bắt quân đối thủ; một nhóm quân cần ít nhất một khí để tồn tại trên bàn cờ, và nếu không có khí nào thì sẽ bị bắt ngay lập tức.",
"Tập trung vào việc tạo ra các 'dạng sống' (eyes) cho nhóm quân của mình; một nhóm quân có hai mắt độc lập sẽ không bao giờ bị bắt, vì đối thủ không thể chiếm cả hai mắt cùng một lúc trong một lượt chơi duy nhất theo luật cấm tự sát.",
"Nên bắt đầu với bàn cờ nhỏ hơn (ví dụ 9x9) để làm quen với các khái niệm cơ bản về lãnh thổ, bắt quân và sống/chết trước khi chuyển sang bàn cờ lớn hơn, vì chiến lược trên bàn cờ 19x19 phức tạp hơn rất nhiều và đòi hỏi tư duy chiến thuật sâu sắc hơn."
],
images: [
{
url: "https://upload.wikimedia.org/wikipedia/commons/thumb/c/c5/Go-game-on-wood-board.jpg/1280px-Go-game-on-wood-board.jpg",
caption: "Bàn cờ vây truyền thống với các quân cờ đen trắng đang được đặt."
},
{
url: "https://upload.wikimedia.org/wikipedia/commons/thumb/6/6c/Go_Capture.svg/640px-Go_Capture.svg.png",
caption: "Minh họa về cách một nhóm quân bị bao vây và bắt."
}
],
youtubeUrl: "https://www.youtube.com/watch?v=gT8o622tOys"
});
