async function loadPage(pageName) {

  const app = document.getElementById("app");

  try {

    const response = await fetch(`pages/${pageName}.html`);

    const html = await response.text();

    app.innerHTML = html;

    window.scrollTo(0, 0);

    // INIT BOARDGAME PAGE
    if(pageName === "boardgame"){
      initBoardgame();
    }

  } catch (error) {

    app.innerHTML = `
      <div style="padding:40px">
        <h2>Lỗi tải trang</h2>
      </div>
    `;

    console.error(error);
  }
}

// LOAD DEFAULT PAGE
loadPage("news");
updateHeader("news");
