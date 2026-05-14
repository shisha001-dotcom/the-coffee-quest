const uploadInput = document.getElementById('banner-upload');
const previewGrid = document.getElementById('preview-grid');
const saveBtn = document.getElementById('save-banner-btn');

let banners = JSON.parse(localStorage.getItem('tcq_banners')) || [];

renderPreview();

uploadInput.addEventListener('change', e => {

  const files = [...e.target.files];

  files.forEach(file => {

    const reader = new FileReader();

    reader.onload = function(evt){

      banners.push(evt.target.result);

      renderPreview();

    }

    reader.readAsDataURL(file);

  });

});

saveBtn.addEventListener('click', () => {

  localStorage.setItem(
    'tcq_banners',
    JSON.stringify(banners)
  );

  saveBtn.textContent = '✅ Đã lưu';

  setTimeout(() => {
    saveBtn.textContent = '💾 Lưu Banner';
  }, 2000);

});

function removeBanner(index){

  banners.splice(index, 1);

  renderPreview();
}

function renderPreview(){

  previewGrid.innerHTML = banners.map((img, i) => `

    <div class="preview-item">

      <img src="${img}">

      <button
        class="remove-btn"
        onclick="removeBanner(${i})"
      >
        ✕
      </button>

    </div>

  `).join('');
}
