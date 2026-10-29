/* Lesson worksheet: content, character expressions and dialogue. */
(function (root) {
  'use strict';
  const titles = root.MathTourProject.FIXED_SCENES;
  const faces = { stand:'기본', how:'궁금', thinking:'생각중', finding:'찾기', aha:'깨달음', thumb:'칭찬', lookmap:'지도보기' };
  const escape = value => String(value ?? '').replace(/[&<>"']/g, ch => ({ '&':'&amp;', '<':'&lt;', '>':'&gt;', '"':'&quot;', "'":'&#39;' })[ch]);
  const face = key => faces[key] || String(key || '미정');
  function rows(board) {
    return (board.scenes || []).map((scene, index) => ({
      number:index + 1, title:scene.title || titles[index], game:index === 3,
      content:scene.screenText || scene.gamePlan || (index === 3 ? '[게임의 문제와 목표]' : '[화면에 보여줄 내용]'),
      pictures:(scene.pictures || []).map(n => 'IMG' + n).join(' · ') || '없음 / 미정',
      boyFace:face(scene.boyFace), boyText:scene.boyText || '(대사 없음)',
      girlFace:face(scene.girlFace), girlText:scene.girlText || '(대사 없음)',
      controls:scene.gameControls || '[조작 방법]', answer:scene.gameAnswer || '[정답과 성공 조건]', hint:scene.hint || '(힌트 없음)'
    }));
  }
  function template(meta) {
    const contents = [
      '[관광지의 위치와 대표적인 특징을 소개해 주세요.]',
      '[관광지의 이야기나 특징을 더 소개하고, 이번 탐구와 연결해 주세요.]',
      '[해결할 문제 상황과 주어진 조건, 사용할 수학 개념을 설명해 주세요.]',
      '[게임에서 해결할 문제와 목표를 적어 주세요.]',
      '[정답과 풀이 과정, 그 답이 나오는 이유를 설명해 주세요.]',
      '[오늘 배운 개념·공식·탐구 방법을 정리해 주세요.]'
    ];
    return { ...meta, template:true, scenes:titles.map((title,i) => ({
      title, screenText:contents[i], gameNumber:i === 3 ? 1 : null, isProblem:i === 3,
      boyFace:i === 0 ? 'lookmap' : i === 5 ? 'thumb' : 'thinking', boyText:'[남학생 대사]',
      girlFace:i === 5 ? 'aha' : 'how', girlText:'[여학생 대사]',
      pictures:[], gameControls:i === 3 ? '[입력·클릭·드래그 등 조작 방법]' : '',
      gameAnswer:i === 3 ? '[정답과 성공 조건]' : '', hint:i === 3 ? '[정답을 바로 알려주지 않는 힌트]' : ''
    })), pictures:[{ number:1, source:'[사용할 사진의 출처 또는 AI 생성 도구·설명]' }] };
  }
  const guidance = '장면은 아래 순서대로 6개예요. 게임은 4번 장면에 하나만 넣고, 자세한 정답 해설은 5번에서 설명해요.';
  function toText(board) {
    const lines = ['인천 매스투어 스토리보드' + (board.template ? ' · 작성 양식' : ''),
      '관광지: ' + board.placeId + ' ' + (board.placeName || ''), '학교: ' + (board.school || '[학교]'),
      '이름: ' + (board.name || '[이름]'), '탐구 주제: ' + (board.topic || '[탐구 주제]'), '', guidance, ''];
    rows(board).forEach(row => lines.push(
      '━━━━━━━━━━━━━━━━━━━━', '장면 ' + row.number + '. ' + row.title,
      '보여줄 내용: ' + row.content, '배경 사진: ' + row.pictures,
      '남학생 표정: ' + row.boyFace, '남학생 대사: ' + row.boyText,
      '여학생 표정: ' + row.girlFace, '여학생 대사: ' + row.girlText,
      ...(row.game ? ['조작 방법: ' + row.controls, '정답과 성공 조건: ' + row.answer, '힌트: ' + row.hint,
        '진행: 정답 확인 → 다음 → 게임 미션 완료 → 5번 장면'] : []), ''));
    lines.push('[사진 출처]', ...(board.pictures || []).map(pic => 'IMG' + pic.number + ': ' + (pic.source || '(출처 미입력)')));
    if (!(board.pictures || []).length) lines.push('등록한 사진 없음');
    return lines.join('\n');
  }
  const style = '.sb{font:14px/1.6 "Malgun Gothic",sans-serif;color:#26364a;overflow-wrap:anywhere}.sb h3{font-size:22px;margin:0 0 12px;color:#1565c0}.sb .sb-meta{padding:12px;background:#f1f6fc;border-radius:8px}.sb .sb-guide{font-size:13px;color:#546e7a}.sb .sb-table-wrap{overflow:auto}.sb table{width:100%;min-width:740px;border-collapse:collapse;table-layout:fixed;background:white}.sb th,.sb td{padding:12px;border:1px solid #cfdce8;vertical-align:top;text-align:left;white-space:pre-wrap}.sb thead th{background:#eaf1fa;text-align:center}.sb tbody th{background:#f6f9fd;font-size:13px}.sb th:first-child{width:17%}.sb th:nth-child(2){width:39%}.sb th:nth-child(3),.sb th:nth-child(4){width:22%}.sb .sb-game th,.sb .sb-game td{background:#f0f8f3}.sb .sb-label{display:block;font-weight:bold;color:#45647d;margin:10px 0 3px}.sb .sb-label:first-child{margin-top:0}.sb p{margin:6px 0}.sb small{display:block;color:#607d8b;margin-top:12px}.sb .sb-empty{padding:30px;text-align:center;color:#607d8b}@media print{body{padding:0!important}.sb table{min-width:0;font-size:11px}.sb tr{break-inside:avoid}}';
  function bodyHtml(board) {
    const label = (name,text) => '<span class="sb-label">' + escape(name) + '</span>' + escape(text);
    return '<div class="sb"><h3>' + escape(board.topic || '나의 매스투어 스토리보드') + '</h3><div class="sb-meta">' +
      escape('관광지: ' + board.placeId + ' ' + (board.placeName || '')) + '<br>' + escape('학교: ' + (board.school || '[학교]') + '　 이름: ' + (board.name || '[이름]')) +
      '</div><p class="sb-guide">' + escape(guidance) + '</p>' +
      (board.scenes?.length ? '<div class="sb-table-wrap"><table><thead><tr><th>장면</th><th>보여줄 내용 · 배경</th><th>남학생 표정 · 대사</th><th>여학생 표정 · 대사</th></tr></thead><tbody>' +
      rows(board).map(row => '<tr class="' + (row.game ? 'sb-game' : '') + '"><th scope="row">장면 ' + row.number + '<br>' + escape(row.title) + '</th><td>' +
        escape(row.content) + label('배경 사진',row.pictures) + (row.game ? label('조작 방법',row.controls) + label('정답과 성공 조건',row.answer) + label('힌트',row.hint) : '') +
        '</td><td>' + label('표정',row.boyFace) + label('대사',row.boyText) + '</td><td>' + label('표정',row.girlFace) + label('대사',row.girlText) + '</td></tr>').join('') +
      '</tbody></table></div>' : '<p class="sb-empty">본문을 가져오거나 작성 양식을 내려받아 주세요.</p>') +
      '<h4>사진 출처</h4><ul>' + ((board.pictures || []).map(pic => '<li>' + escape('IMG' + pic.number + ': ' + (pic.source || '출처 미입력')) + '</li>').join('') || '<li>등록한 사진 없음</li>') +
      '</ul><small>게임: 정답 확인 후 다음 버튼 활성화 → 마지막 미션 완료 → 5번 해설 장면. 제작기 미리보기에서는 4번 게임을 비워 두고 바로 넘겨요.</small></div>';
  }
  function toHtml(board) {
    return '<!doctype html><html lang="ko"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>' + escape(board.topic || '인천 매스투어 스토리보드') +
      '</title><style>body{margin:0 auto;padding:24px;max-width:1100px;background:white}' + style + '</style></head><body>' + bodyHtml(board) + '</body></html>';
  }
  root.MathTourStoryboard = { rows, template, toText, bodyHtml, toHtml, style };
})(typeof window === 'undefined' ? globalThis : window);
