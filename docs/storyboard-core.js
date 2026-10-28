/* Human-readable storyboards: only text and metadata, never executable student code. */
(function (root) {
  'use strict';
  const faces = { stand:'기본', how:'궁금', thinking:'생각중', finding:'찾기', aha:'깨달음', thumb:'칭찬', lookmap:'지도보기' };
  const escape = value => String(value ?? '').replace(/[&<>"']/g, ch => ({ '&':'&amp;', '<':'&lt;', '>':'&gt;', '"':'&quot;', "'":'&#39;' })[ch]);
  const face = key => faces[key] ? faces[key] + ' (' + key + ')' : String(key || '미정');
  const gameNumber = value => Number.isInteger(Number(value)) && Number(value) >= 1 && Number(value) <= 999 ? Number(value) : null;
  const guidance = [
    '관광지 소개 → 탐구 준비 → 게임 → 배운 수학 정리 순서로 이야기를 만들어요. 장면 수는 자유롭게 바꿀 수 있어요.',
    '게임 장면에는 게임 1·게임 2처럼 게임 번호를 적어요. 게임 하나에 문제가 여러 개 있어도 같은 게임 번호를 써요.',
    '본문에는 게임 번호만 연결하고, 게임은 각각 별도 HTML 파일로 만들어요. 사진은 IMG1·IMG2·IMG3와 출처로 연결해요.',
    '게임에서는 정답 확인 후 다음 버튼을 활성화하고, 마지막 미션 완료 버튼에서 missionClear()를 호출해요.',
    '스토리보드 미리보기에서는 게임 가운데가 비어 있고 바로 다음으로 넘어가요. 실제 체험에서는 게임 완료 후 다음 장면으로 이동해요.'
  ];
  function rows(board) {
    return (board.scenes || []).map((scene, index) => {
      const n = gameNumber(scene.gameNumber);
      return {
        number:index + 1, title:scene.title || '제목 미정', type:n ? '게임' : '이야기·사진',
        gameNumber:n, game:n ? '게임 ' + n : '해당 없음',
        file:n ? board.placeId + '-G' + n + '.html' : '—',
        submissionFile:n && board.submissionPrefix ? board.submissionPrefix + '_G' + n + '.html' : '',
        content:scene.screenText || (n ? '별도 게임 HTML을 실행해요.' : '(화면 내용을 작성해 주세요.)'),
        pictures:(scene.pictures || []).map(v => 'IMG' + v).join(' · ') || '없음 / 미정',
        boy:face(scene.boyFace) + '\n' + (scene.boyText || '(대사 없음)'),
        girl:face(scene.girlFace) + '\n' + (scene.girlText || '(대사 없음)'),
        hint:scene.isProblem || n ? scene.hint || '(힌트 없음)' : '사용 안 함',
        progress:n ? '정답 확인 → 다음 → 게임 미션 완료 → 다음 장면' : index === board.scenes.length - 1 ? '내용 정리 → 전체 미션 완료' : '내용 확인 → 다음 장면'
      };
    });
  }
  function template(meta) {
    const story = (title, screenText, extra = {}) => ({ title, screenText, boyFace:'stand', boyText:'[남학생 대사]', girlFace:'how', girlText:'[여학생 대사]', isProblem:false, ...extra });
    return { ...meta, template:true, scenes:[
      story('관광지 소개', '[관광지의 위치·특징·이야기와 이번 수학 탐구를 소개해 주세요. 사진이 필요하면 IMG1을 사용해요.]', { pictures:[1], boyFace:'lookmap' }),
      story('탐구 준비', '[배울 수학 개념, 탐구 질문, 게임에 필요한 조건을 설명해 주세요.]', { boyFace:'thinking' }),
      story('게임 1 · [게임 제목]', '[게임 1의 목표·문제·조작 방법·정답·성공 조건을 작성해 주세요.]', { gameNumber:1, isProblem:true, hint:'[게임 1의 힌트]' }),
      story('게임 2 · [게임 제목]', '[게임 2의 목표·문제·조작 방법·정답·성공 조건을 작성해 주세요. 게임이 하나면 이 장면은 삭제해도 돼요.]', { gameNumber:2, isProblem:true, hint:'[게임 2의 힌트]' }),
      story('배운 수학 정리', '[오늘 배운 개념·공식·풀이 과정과 관광지의 연결을 정리하고, 돌아보기 질문을 적어 주세요.]', { boyFace:'thumb', girlFace:'aha' })
    ], pictures:[{ number:1, source:'[이미지 출처 또는 AI 생성 도구·설명]' }], games:[] };
  }
  function toText(board) {
    const lines = ['인천 매스투어 스토리보드' + (board.template ? ' · 작성 양식' : ''),
      '장소: ' + board.placeId + ' ' + (board.placeName || ''),
      '학교: ' + (board.school || '[학교]'), '이름: ' + (board.name || '[이름]'),
      '탐구 주제: ' + (board.topic || '[탐구 주제]'),
      '본문 제작 파일: ' + board.placeId + '.html',
      ...(board.submissionPrefix ? ['제출 본문 파일: ' + board.submissionPrefix + '_본문.html'] : []),
      '', '[작성·진행 규칙]', ...guidance.map((line,i) => (i + 1) + '. ' + line), ''];
    rows(board).forEach(row => lines.push(
      '━━━━━━━━━━━━━━━━━━━━', '장면 ' + row.number + '. ' + row.title,
      '장면 유형: ' + row.type, '게임 번호: ' + row.game, '연결 게임 파일: ' + row.file,
      ...(row.submissionFile ? ['제출 게임 파일: ' + row.submissionFile] : []),
      '가운데 화면 / 게임 기획: ' + row.content, '사진 번호: ' + row.pictures,
      '남학생 표정·대사: ' + row.boy, '여학생 표정·대사: ' + row.girl,
      '힌트: ' + row.hint, '진행: ' + row.progress, ''));
    lines.push('[사진 출처]', ...(board.pictures || []).map(pic => 'IMG' + pic.number + ': ' + (pic.source || '(출처 미입력)')));
    if (!(board.pictures || []).length) lines.push('등록한 사진 없음');
    return lines.join('\n');
  }
  const style = '.sb{font:14px/1.7 "Malgun Gothic",sans-serif;color:#26364a;overflow-wrap:anywhere}.sb h3{font-size:22px;margin:0 0 8px;color:#1565c0}.sb .sb-meta{background:#f1f6fc;padding:12px 16px;border-radius:10px}.sb .sb-rules{padding-left:22px;font-size:13px;color:#546e7a}.sb article{border:1px solid #d7e3ee;border-radius:12px;margin:16px 0;overflow:hidden;break-inside:avoid}.sb article h4{margin:0;padding:12px 14px;background:#eef4fb;font-size:16px}.sb .sb-game h4{background:#e9f5ef}.sb .sb-badge{display:inline-block;background:#1565c0;color:#fff;border-radius:6px;padding:1px 8px;margin-right:8px;font-size:13px}.sb .sb-game .sb-badge{background:#25704a}.sb dl{margin:0;display:grid;grid-template-columns:140px minmax(0,1fr)}.sb dt,.sb dd{margin:0;padding:10px 14px;border-top:1px solid #e5ecf3;white-space:pre-wrap}.sb dt{background:#fafcff;font-weight:bold}.sb dd{min-width:0}.sb small{display:block;color:#607d8b}.sb .sb-empty{padding:30px;text-align:center;color:#607d8b}@media(max-width:560px){.sb dl{grid-template-columns:1fr}.sb dt{padding-bottom:2px}.sb dd{border-top:0;padding-top:2px}.sb h3{font-size:19px}}@media print{body{padding:0!important}.sb article{break-inside:avoid}}';
  function bodyHtml(board) {
    const field = (label,value) => '<dt>' + escape(label) + '</dt><dd>' + escape(value) + '</dd>';
    return '<div class="sb"><h3>' + escape(board.topic || (board.template ? '나의 매스투어 작성 양식' : '현재 작품 스토리보드')) + '</h3>' +
      '<div class="sb-meta">' + escape(board.placeId + ' ' + (board.placeName || '')) + ' · ' + escape(board.school || '학교 미입력') + ' · ' + escape(board.name || '이름 미입력') +
      '<small>본문: ' + escape(board.placeId + '.html') + (board.submissionPrefix ? ' → 제출: ' + escape(board.submissionPrefix + '_본문.html') : '') + '</small></div>' +
      '<ol class="sb-rules">' + guidance.map(line => '<li>' + escape(line) + '</li>').join('') + '</ol>' +
      (rows(board).map(row => '<article class="' + (row.gameNumber ? 'sb-game' : '') + '"><h4><span class="sb-badge">장면 ' + row.number + '</span>' + escape(row.title) + '</h4><dl>' +
        field('장면 유형',row.type) + field('게임 번호',row.game) + field('연결 게임 파일',row.file + (row.submissionFile ? '\n제출: ' + row.submissionFile : '')) +
        field('가운데 화면 / 기획',row.content) + field('사진 번호',row.pictures) + field('남학생 표정·대사',row.boy) + field('여학생 표정·대사',row.girl) + field('힌트',row.hint) + field('진행',row.progress) + '</dl></article>').join('') ||
        '<p class="sb-empty">아직 불러온 장면이 없어요. 작성 양식을 내려받아 기획하거나, 본문 HTML을 가져온 뒤 다시 열어 주세요.</p>') +
      '<h4>사진 출처</h4><ul>' + ((board.pictures || []).map(pic => '<li>' + escape('IMG' + pic.number + ': ' + (pic.source || '출처 미입력')) + '</li>').join('') || '<li>등록한 사진 없음</li>') + '</ul></div>';
  }
  function toHtml(board) {
    return '<!doctype html><html lang="ko"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>' + escape(board.topic || '인천 매스투어 스토리보드') + '</title><style>body{margin:0 auto;padding:24px;max-width:1000px;background:white}' + style + '</style></head><body>' + bodyHtml(board) + '</body></html>';
  }
  root.MathTourStoryboard = { rows, template, toText, bodyHtml, toHtml, style };
})(typeof window === 'undefined' ? globalThis : window);
