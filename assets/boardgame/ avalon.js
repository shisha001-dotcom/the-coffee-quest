GAMES.push({
    name: "Avalon",
    category: "Trò chơi suy luận xã hội, Ẩn vai",
    emoji: "🗡️",
    players: "5-10",
    time: "30 phút",
    difficulty: "Trung bình",
    color: "#4A90E2",
    heroBg: "https://wallpaperaccess.com/full/7636181.jpg",
    objective: "Phe Ánh Sáng (Loyal Servants of Arthur) phải hoàn thành 3 nhiệm vụ thành công để chiến thắng, trong khi Phe Bóng Tối (Minions of Mordred) phải làm hỏng 3 nhiệm vụ hoặc ám sát Merlin thành công nếu Phe Ánh Sáng thắng 3 nhiệm vụ.",
    setup: [
        "Chia bài vai trò ẩn cho người chơi. Tùy thuộc số người chơi, sẽ có số lượng cụ thể các vai trò như Merlin, Assassin, Loyal Servant, Minion, Percival, Morgana, Oberon, Mordred. Người chơi giữ bí mật vai trò của mình, chỉ một số vai trò được phép biết vai trò của người khác (ví dụ: Merlin biết Minions, Percival biết Merlin và Morgana). Sau đó, tất cả nhắm mắt lại, Quản trò (hoặc một người chơi) sẽ hướng dẫn các bước để các nhân vật biết nhau theo quy tắc, ví dụ: 'Minions of Mordred, mở mắt ra và nhìn nhau. Bây giờ nhắm mắt lại. Merlin, mở mắt ra. Các Minions of Mordred, giơ ngón cái lên. Merlin, bây giờ nhắm mắt lại. Các Minions, hạ ngón cái xuống. Percival, mở mắt ra. Merlin và Morgana, giơ ngón cái lên. Percival, bây giờ nhắm mắt lại. Merlin và Morgana, hạ ngón cái xuống. Tất cả mở mắt ra.'",
        "Đặt bảng chơi chính, đánh dấu các vị trí nhiệm vụ từ 1 đến 5 và số lượng người chơi cần cho mỗi nhiệm vụ. Đặt các quân bài phiếu bầu 'Đồng ý' và 'Từ chối' trước mặt mỗi người chơi, cùng với các quân bài phiếu nhiệm vụ 'Thành công' và 'Thất bại'. Đặt điểm đánh dấu vòng nhiệm vụ và điểm đánh dấu thất bại đề xuất nhiệm vụ ở vị trí ban đầu.",
        "Chọn người chơi đầu tiên làm Trưởng đoàn. Trưởng đoàn sẽ được luân phiên theo chiều kim đồng hồ qua mỗi vòng nhiệm vụ và mỗi lần đề xuất nhiệm vụ bị từ chối."
    ],
    turn: [
        "Trưởng đoàn hiện tại đề xuất một đội hình gồm số lượng người chơi nhất định (được quy định trên bảng chơi cho nhiệm vụ hiện tại) để tham gia nhiệm vụ. Trưởng đoàn có thể chọn bất kỳ người chơi nào, bao gồm cả bản thân họ. Việc lựa chọn này là một phần quan trọng của trò chơi, nơi cả hai phe cố gắng đưa người của mình vào đội hoặc ngăn chặn người đối địch.",
        "Sau khi Trưởng đoàn đề xuất đội, tất cả người chơi đồng thời bỏ phiếu kín cho việc chấp thuận hoặc từ chối đội hình này bằng cách sử dụng các lá phiếu 'Đồng ý' hoặc 'Từ chối' của họ. Quản trò hoặc Trưởng đoàn sẽ thu thập và tiết lộ đồng thời tất cả các lá phiếu. Nếu đa số phiếu là 'Đồng ý', đội hình được chấp thuận và nhiệm vụ diễn ra. Nếu đa số phiếu là 'Từ chối', hoặc nếu có hòa, đề xuất thất bại, và điểm đánh dấu thất bại đề xuất nhiệm vụ được di chuyển lên một ô. Trưởng đoàn sẽ chuyển sang người chơi kế tiếp theo chiều kim đồng hồ, và vòng đề xuất đội tiếp tục. Nếu có 5 đề xuất liên tiếp bị từ chối, phe Bóng Tối thắng ngay lập tức.",
        "Nếu đội hình được chấp thuận, những người chơi trong đội đó sẽ nhận các lá phiếu nhiệm vụ 'Thành công' và 'Thất bại'. Phe Ánh Sáng CHỈ CÓ THỂ bỏ phiếu 'Thành công'. Phe Bóng Tối CÓ THỂ bỏ phiếu 'Thành công' HOẶC 'Thất bại'. Tất cả thành viên đội bí mật bỏ một lá phiếu. Quản trò sẽ thu thập và xáo trộn các lá phiếu, sau đó tiết lộ chúng. Nếu TẤT CẢ các lá phiếu là 'Thành công', nhiệm vụ thành công. Nếu có ít nhất một lá phiếu 'Thất bại' (hoặc hai lá phiếu 'Thất bại' ở nhiệm vụ thứ tư nếu có 7 hoặc nhiều người chơi), nhiệm vụ thất bại. Kết quả này được đánh dấu trên bảng chơi. Trưởng đoàn chuyển sang người chơi kế tiếp và bắt đầu vòng nhiệm vụ mới."
    ],
    win: "Phe Ánh Sáng thắng: Nếu 3 nhiệm vụ thành công. Tuy nhiên, nếu phe Ánh Sáng thắng 3 nhiệm vụ, phe Bóng Tối có cơ hội cuối cùng để ám sát Merlin. Nếu Assassin đoán đúng ai là Merlin, phe Bóng Tối thắng. Nếu Assassin đoán sai, phe Ánh Sáng thắng hoàn toàn. Phe Bóng Tối thắng: Nếu 3 nhiệm vụ thất bại, hoặc 5 đề xuất đội bị từ chối liên tiếp, hoặc Assassin ám sát thành công Merlin sau khi phe Ánh Sáng đã thắng 3 nhiệm vụ.",
    tips: [
        "Cho Phe Ánh Sáng: Luôn chú ý đến những người chơi bỏ phiếu 'Thất bại' trong nhiệm vụ hoặc những người liên tục từ chối các đề xuất đội hợp lý. Merlin nên cố gắng hướng dẫn team mà không tiết lộ quá rõ ràng danh tính của mình để tránh bị Assassin phát hiện. Percival nên quan sát kỹ ai là Merlin và ai là Morgana để bảo vệ Merlin và giúp Merlin đưa ra quyết định đúng đắn.",
        "Cho Phe Bóng Tối: Cố gắng trà trộn vào các đội nhiệm vụ và bỏ phiếu 'Thất bại' mà không bị nghi ngờ. Phá hoại các đề xuất đội của phe Ánh Sáng bằng cách bỏ phiếu 'Từ chối' để lãng phí lượt hoặc để tạo cơ hội cho mình làm Trưởng đoàn. Morgana nên cố gắng giả vờ là Merlin để đánh lừa Percival. Cuối cùng, Assassin phải cực kỳ tỉnh táo để đoán ra ai là Merlin dựa trên cách Merlin hành động và cách người chơi phản ứng.",
        "Chiến lược chung: Giao tiếp và tranh luận là chìa khóa. Ngay cả khi bạn biết vai trò của mình, hãy lắng nghe lập luận của người khác và cố gắng tạo ra các lập luận thuyết phục để che giấu danh tính hoặc để hướng dẫn đội của mình. Đừng ngại thay đổi chiến thuật nếu bạn cảm thấy bị nghi ngờ quá nhiều. Ghi nhớ các phiếu bầu và các lần từ chối đề xuất đội là rất quan trọng để suy luận vai trò của người chơi."
    ],
    images: [
        {
            url: "https://cf.geekdo-images.com/itemrep/img/s_g-l9q08H-lq-i4w0J_67D0FzM=/fit-in/246x300/pic1394572.jpg",
            caption: "Hộp game The Resistance: Avalon"
        },
        {
            url: "https://boardgamegeek.com/image/1488100/resistance-avalon",
            caption: "Bảng chơi và thẻ nhân vật"
        }
    ],
    youtubeUrl: "https://www.youtube.com/watch?v=FjI5_G53fFk"
});