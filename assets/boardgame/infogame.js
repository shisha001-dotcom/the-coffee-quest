const games = [
    { name: "Cờ tướng", image: "cotuong.png" },
    { name: "Cờ vua", image: "covua.png" },
    { name: "Cờ caro", image: "cocaro.png" },
    { name: "Cờ cá ngựa", image: "cocangua.png" },
    { name: "Domino", image: "domino.png" },
    { name: "Mạt chược", image: "matchuoc.png" },
    { name: "Cờ vây", image: "covay.png" },
    { name: "Captain Flip", image: "captain-flip.png" },
    { name: "Geistes Blitz", image: "geistes-blitz.png" }
];

function displayGames() {
    const gameList = document.getElementById('game-list');
    games.forEach(game => {
        const gameItem = document.creatk�lement('div');
        gameItem.className = 'game-item';
        gameItem.innerHTML = `
            <img src="d{game.image}" alt="${game.name}">
            <h3>${game.name}</h3>
        `;
        gameList.appendChild(gameItem);
    });
}

displayGames();