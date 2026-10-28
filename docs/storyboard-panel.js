(function () {
  'use strict';
  const core = window.MathTourStoryboard;
  const byId = id => document.getElementById(id);
  const dialog = byId('storyboardDialog');
  let mode = 'current';
  const style = document.createElement('style'); style.textContent = core.style; document.head.appendChild(style);
  function metadata() {
    const placeId = byId('placeId').value, school = byId('school').value.trim(), name = byId('sname').value.trim();
    let submissionPrefix = '';
    try { submissionPrefix = window.MathTourSubmission.prefix(placeId, school, name); } catch { /* Drafts may not yet have author details. */ }
    return { placeId, placeName:PLACE_NAME[placeId], school, name, topic:byId('topic').value.trim(), submissionPrefix };
  }
  function plainContent(html) {
    const doc = new DOMParser().parseFromString(html || '', 'text/html');
    doc.querySelectorAll('script,style,template').forEach(el => el.remove());
    doc.querySelectorAll('br').forEach(el => el.replaceWith('\n'));
    doc.querySelectorAll('p,div,h1,h2,h3,li,article').forEach(el => el.append('\n'));
    return doc.body.textContent.replace(/[ \t]+/g, ' ').replace(/\n\s*\n/g, '\n').trim();
  }
  function snapshot() {
    const meta = metadata();
    if (mode === 'template') return core.template(meta);
    const project = window.buildProjectSubmission();
    const games = new Map(project.games.map(game => [game.number, game]));
    return { ...meta, scenes:scenes.map(scene => {
      const source = scene.gameNumber ? games.get(scene.gameNumber)?.html || '' : scene.outer;
      return { ...scene, screenText:scene.gameNumber ? '별도 파일 ' + meta.placeId + '-G' + scene.gameNumber + '.html로 게임을 실행해요.\n' + (source ? '게임 파일을 가져온 상태예요.' : '게임 파일을 아직 가져오지 않았어요. 제출 전 4단계에서 선택해 주세요.') : plainContent(source), pictures:[1,2,3].filter(n => source.includes('IMG' + n)) };
    }), pictures:project.pictures.map(pic => ({ number:pic.number, source:pic.source })) };
  }
  function render() {
    const board = snapshot();
    byId('showCurrentStoryboard').setAttribute('aria-pressed', String(mode === 'current'));
    byId('showStoryboardTemplate').setAttribute('aria-pressed', String(mode === 'template'));
    byId('storyboardContent').innerHTML = core.bodyHtml(board);
    byId('downloadStoryboardText').disabled = byId('downloadStoryboardHtml').disabled = !board.scenes.length;
    byId('storyboardNotice').textContent = mode === 'template' ? '관광지 소개·게임 1·게임 2·배운 수학 정리가 들어간 작성 양식이에요. TXT를 내려받아 내용을 채우고 AI에 전달하세요.' :
      '현재 불러온 장면과 3단계에서 수정한 표정·대사·게임 번호를 표시해요. 본문 코드를 수정했다면 먼저 장면 불러오기를 눌러 주세요. 다운로드는 제출과 별개예요.';
    byId('storyboardDownloadStatus').textContent = '선택한 스토리보드를 저장해요. 게임 파일 없이도 내려받을 수 있어요.';
  }
  byId('openStoryboard').addEventListener('click', () => { mode = scenes.length ? 'current' : 'template'; render(); dialog.showModal(); byId('closeStoryboard').focus(); });
  byId('closeStoryboard').addEventListener('click', () => dialog.close());
  byId('showCurrentStoryboard').addEventListener('click', () => { mode = 'current'; render(); });
  byId('showStoryboardTemplate').addEventListener('click', () => { mode = 'template'; render(); });
  function download(format) {
    const board = snapshot();
    if (!board.scenes.length) return;
    const filename = (board.submissionPrefix || board.placeId) + '_스토리보드' + (board.template ? '_작성양식' : '') + '.' + format;
    const blob = new Blob(['\ufeff', format === 'txt' ? core.toText(board) : core.toHtml(board)], { type:(format === 'txt' ? 'text/plain' : 'text/html') + ';charset=utf-8' });
    const url = URL.createObjectURL(blob), link = document.createElement('a');
    link.href = url; link.download = filename; document.body.appendChild(link); link.click(); link.remove();
    setTimeout(() => URL.revokeObjectURL(url), 60000);
    byId('storyboardDownloadStatus').textContent = filename + ' 다운로드를 요청했어요.';
  }
  byId('downloadStoryboardText').addEventListener('click', () => download('txt'));
  byId('downloadStoryboardHtml').addEventListener('click', () => download('html'));
})();
