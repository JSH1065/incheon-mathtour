(function () {
  'use strict';
  const byId = id => document.getElementById(id);
  const dialog = byId('storyboardDialog');
  const base = window.MATHTOUR_CONFIG?.siteBase || location.href;
  const pdf = new URL('./worksheets/storyboard-six-scenes.pdf?v=20261029', base).href;
  const download = byId('downloadStoryboardPdf');
  byId('openStoryboardPdf').href = download.href = pdf;
  let rendered = false;
  function renderPages() {
    if (rendered) return;
    rendered = true;
    for (let page = 1; page <= 3; page++) {
      const figure = document.createElement('figure');
      figure.className = 'storyboard-pdf-page';
      const image = document.createElement('img');
      image.src = new URL('./worksheets/storyboard-page-' + page + '.jpg?v=20261029', base).href;
      image.alt = '스토리보드 PDF ' + page + '쪽: ' + ['미션 기본 설계', '6개 장면 설계와 캐릭터 표정', '올리기 전 점검'][page - 1];
      image.width = 1202; image.height = 1700;
      image.loading = page === 1 ? 'eager' : 'lazy';
      const caption = document.createElement('figcaption');
      caption.textContent = page + ' / 3';
      image.addEventListener('error', () => {
        image.hidden = true;
        caption.textContent = page + '쪽 미리보기를 불러오지 못했어요. 위의 PDF 크게 보기를 눌러 주세요.';
      });
      figure.append(image, caption); byId('storyboardPdfPages').appendChild(figure);
    }
  }
  function openStoryboard() {
    if (dialog.open) return;
    renderPages(); dialog.showModal(); byId('closeStoryboard').focus();
  }
  byId('openStoryboard').addEventListener('click', openStoryboard);
  function openLinkedStoryboard() { if (location.hash === '#storyboard') openStoryboard(); }
  document.addEventListener('DOMContentLoaded', openLinkedStoryboard);
  window.addEventListener('hashchange', openLinkedStoryboard);
  byId('closeStoryboard').addEventListener('click', () => dialog.close());
  download.addEventListener('click', async event => {
    // Website downloads are same-origin. Offline makers use a blob URL instead.
    if (location.protocol !== 'file:') return;
    event.preventDefault();
    const status = byId('storyboardDownloadStatus');
    status.textContent = 'PDF를 내려받고 있어요.';
    try {
      const response = await fetch(pdf);
      if (!response.ok) throw new Error('PDF unavailable');
      const url = URL.createObjectURL(await response.blob());
      const link = document.createElement('a');
      link.href = url; link.download = download.download;
      document.body.appendChild(link); link.click(); link.remove();
      setTimeout(() => URL.revokeObjectURL(url), 60000);
      status.textContent = '내려받은 PDF를 AI에 첨부하고, 빈칸의 내용을 작성하세요.';
    } catch {
      status.textContent = '다운로드가 안 되면 PDF 크게 보기를 눌러 저장해 주세요.';
    }
  });
})();
