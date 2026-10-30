/* Six fixed scenes; one separately imported game belongs to scene four. */
(function () {
  'use strict';
  const core = window.MathTourProject;
  let programName = '', lastImportedSource = '', gameHtml = '', gameFileName = '';
  const versions = { program:0, game:0 }, pending = new Set();
  const place = () => document.getElementById('placeId').value;
  const nameOf = () => core.singleGameName(place());
  const size = value => new Blob([value]).size;
  const originalRender = renderScenes;
  const downloadUrls = [];
  function refreshSubmissionName() {
    const target = document.getElementById('submissionNamePreview');
    try {
      const base = window.MathTourSubmission.prefix(place(), document.getElementById('school').value, document.getElementById('sname').value);
      target.textContent = '제출 파일명: ' + base + '_본문.html · ' + base + '_게임.html';
    } catch (error) {
      target.textContent = '제출 파일명: ' + place() + '_학교이름_본문.html · ' + place() + '_학교이름_게임.html';
    }
  }
  ['school', 'sname'].forEach(id => document.getElementById(id).addEventListener('input', refreshSubmissionName));
  document.getElementById('placeId').addEventListener('change', refreshSubmissionName);
  window.clearSubmissionDownloads = function () {
    downloadUrls.splice(0).forEach(url => URL.revokeObjectURL(url));
    document.getElementById('submissionFileLinks').replaceChildren();
    document.getElementById('submissionDownloads').hidden = true;
  };
  window.prepareSubmissionDownloads = function () {
    const status = document.getElementById('upMsg');
    window.clearSubmissionDownloads();
    try {
      if (!previewReviewed) throw new Error('먼저 스토리보드 미리보기에서 확인 완료를 눌러 주세요.');
      const author = window.MathTourSubmission.identity(document.getElementById('school').value, document.getElementById('sname').value);
      const topic = document.getElementById('topic').value.trim();
      if (!topic) throw new Error('탐구 주제를 입력해 주세요.');
      const prepared = window.prepareProjectUpload();
      if (prepared.errors.length) throw new Error(prepared.errors.join('\n'));
      const exported = window.MathTourSubmission.buildFiles({ placeId: place(), ...author, topic, project: prepared.project, html: prepared.html, submissionId: crypto.randomUUID() });
      const host = document.getElementById('submissionFileLinks');
      exported.forEach(file => {
        const content = file.dataUrl ? Uint8Array.from(atob(file.content.split(',')[1]), char => char.charCodeAt(0)) : file.content;
        const url = URL.createObjectURL(new Blob([content], { type: file.type })); downloadUrls.push(url);
        const row = document.createElement('li'), link = document.createElement('a');
        link.href = url; link.download = file.name; link.textContent = file.name;
        row.appendChild(link); host.appendChild(row);
      });
      document.getElementById('submissionDownloads').hidden = false;
      status.className = 'msg ok';
      status.textContent = '보관용 파일 ' + exported.length + '개를 준비했어요. 아래 파일명을 눌러 저장해 주세요. 파일 다운로드만으로는 GitHub에 제출되지 않아요.';
    } catch (error) {
      status.className = 'msg bad'; status.textContent = error.message || '제출 파일을 만들지 못했어요.';
    }
  };
  if (window.MATHTOUR_CONFIG?.storageProvider === 'github') {
    document.getElementById('upBtn').textContent = '⬆ GitHub에 업로드';
    document.querySelector('#submissionDownloads .hint').textContent = '본문·게임·사진·스토리보드와 실행본을 내 컴퓨터에 보관할 수 있어요. 실제 제출은 GitHub에 업로드 버튼을 사용해요.';
  } else if (!SCRIPT_URL) {
    document.getElementById('uploadCodeFields').hidden = true;
    document.getElementById('upBtn').textContent = '⬇ 제출 파일 준비 (개별 파일)';
  }
  refreshSubmissionName();

  window.getProgramPrompt = function () {
    return [
      '첨부한 스토리보드를 매쓰투어 이야기 본문 HTML로 만들어 줘. 게임은 별도 HTML 파일 하나로 만들 거야.',
      '장소: ' + place() + ' ' + PLACE_NAME[place()] + '. 본문 파일명: ' + place() + '_본문.html',
      '장면은 정확히 6개이며 아래 순서와 제목을 지켜 줘.',
      ...core.FIXED_SCENES.map((title, i) => '장면 ' + (i + 1) + ': ' + title),
      '',
      '1. HTML과 CSS만 있는 본문 파일 하나를 만들어. JavaScript, 게임 로직, iframe, 이전·다음·완료 버튼은 넣지 마. 제작기가 순서와 버튼을 제공해.',
      '2. 각 장면을 <section class="scene" data-title="장면 제목">으로 감싸고 위 순서대로 정확히 6개 배치해.',
      '3. 4번 section은 게임 자리이므로 내용은 비워 둬. 게임 번호나 파일 연결은 직접 작성할 필요 없어. 제작기가 별도로 가져온 게임을 4번 장면에 자동 연결해.',
      '4. 1·2·3·5·6번 section 안에는 해당 이야기·설명·사진을 넣어. 사진은 반드시 <img src="IMG1" alt="사진 설명">처럼 실제 img 요소로 넣어. 사진 번호에 따라 src에 IMG1, IMG2, IMG3를 사용하고, [사진 자료: IMG1] 같은 글자로 사진 자리를 대신하지 마. 사진은 제작기에서 연결할 거야. 외부 파일·라이브러리는 불러오지 마.',
      '5. 각 section에 data-boy-face, data-boy-text, data-girl-face, data-girl-text를 넣어. 표정: 기본=stand, 궁금=how, 생각중=thinking, 찾기=finding, 깨달음=aha, 칭찬=thumb, 지도보기=lookmap. 캐릭터와 말풍선은 직접 그리지 마.',
      '6. 4번에는 data-hint, data-game-plan(문제와 목표), data-game-controls(조작 방법), data-game-answer(정답과 성공 조건)를 글로 적어. 상세한 풀이와 정답 해설은 5번, 배운 수학의 정리는 6번에 넣어.',
      '7. 가운데 화면은 16:9에 맞춰 반응형으로 만들어. 작은 화면에서도 잘리지 않게 하고 긴 내용은 스크롤할 수 있게 해.',
      '완성된 본문 HTML 전체를 제공해 줘. 게임 파일은 별도 요청에서 만들 거야.'
    ].join('\n');
  };
  function refreshPrompts() {
    document.getElementById('promptText').value = window.getProgramPrompt();
    const game = scenes[3];
    document.getElementById('gameAssetPrompt').value = '4번 장면에 넣을 게임 하나를 만들어 줘.\n파일명: ' + nameOf() + '\n' + GAME_ASSET_PROMPT +
      '\n문제와 목표: ' + (game?.gamePlan || '[작성]') + '\n조작 방법: ' + (game?.gameControls || '[작성]') +
      '\n정답과 성공 조건: ' + (game?.gameAnswer || '[작성]') +
      '\n상세한 해설은 매쓰투어 5번 장면에서 보여 줄 거야. 게임 안에서는 정답 여부·힌트와 간단한 완료 안내를 제공해. 미션 완료를 누르면 매쓰투어 5번 장면으로 넘어갈 수 있어야 해.';
  }
  function fileList() {
    document.getElementById('projectFileList').textContent = [
      programName ? '✓ 본문: ' + programName + ' · 6개 장면' : '본문 HTML을 가져오거나 본문 코드를 붙여넣어 주세요.',
      gameHtml ? '✓ 게임: ' + gameFileName + ' → 4번 장면에 자동 연결' : '게임 HTML 파일 하나를 선택해 주세요. 미리보기는 게임 없이도 가능해요.'
    ].join('\n');
  }
  renderScenes = function () {
    if (!scenes.length) {
      const host = document.getElementById('sceneList'); host.replaceChildren();
      core.FIXED_SCENES.forEach((title, i) => {
        const row = document.createElement('div'); row.className = 'scene-item';
        row.textContent = '장면 ' + (i + 1) + ' · ' + title; host.appendChild(row);
      });
      return;
    }
    originalRender();
    document.querySelectorAll('#sceneList .scene-item').forEach((row, i) => {
      row.querySelector('.q-row').remove();
      if (i !== 3) row.querySelector('.hint-row').remove();
      else {
        const info = document.createElement('p'); info.className = 'hint'; info.textContent = '선택한 게임 하나가 이 장면에 자동으로 들어가요.';
        row.querySelector('.scene-head').after(info);
        for (const [key, label] of [['gamePlan','문제와 목표'],['gameControls','조작 방법'],['gameAnswer','정답과 성공 조건']]) {
          const field = document.createElement('label'); field.textContent = label;
          const input = document.createElement('textarea'); input.rows = 2; input.value = scenes[i][key] || ''; input.setAttribute('aria-label', label);
          input.addEventListener('input', () => { setV(i,key,input.value); invalidateCheckedMission(); refreshPrompts(); });
          field.appendChild(input); row.appendChild(field);
        }
      }
    });
  };
  function parseProgram(html) {
    const doc = new DOMParser().parseFromString(html, 'text/html');
    if (doc.querySelector('script,iframe,object,embed,base,link[rel~="stylesheet"]') || Array.from(doc.querySelectorAll('*')).some(el => Array.from(el.attributes).some(a => /^on/i.test(a.name)))) {
      throw new Error('본문에는 이야기·설명만 넣어 주세요. 게임 동작 코드는 별도 게임 파일에 넣고, 본문은 1단계 프롬프트로 다시 만들어 주세요.');
    }
    const safeFace = v => FACES.some(f => f.key === v) ? v : 'stand';
    const parsed = core.sixScenes(Array.from(doc.querySelectorAll('section.scene')).map(section => ({
      outer:section.outerHTML,
      gameNumber:section.hasAttribute('data-game') ? core.gameNumber(section.getAttribute('data-game')) : null,
      boyFace:safeFace(section.getAttribute('data-boy-face')), boyText:section.getAttribute('data-boy-text') || '',
      girlFace:safeFace(section.getAttribute('data-girl-face')), girlText:section.getAttribute('data-girl-text') || '',
      hint:section.getAttribute('data-hint') || '',
      gamePlan:section.getAttribute('data-game-plan') || '', gameControls:section.getAttribute('data-game-controls') || '', gameAnswer:section.getAttribute('data-game-answer') || ''
    })));
    return { scenes:parsed, css:Array.from(doc.querySelectorAll('style')).map(s => s.textContent).join('\n') };
  }
  function setProgram(html, name, parsed) {
    lastImportedSource = html; scenes = parsed.scenes; studentStyle = parsed.css; studentScript = ''; gameAsset = null;
    programName = name; document.getElementById('aiCode').value = html;
    renderScenes(); fileList(); refreshPrompts();
  }
  loadScenes = function () {
    try {
      const html = document.getElementById('aiCode').value, parsed = parseProgram(html);
      versions.program++; pending.delete('program');
      setProgram(html, place() + '_본문.html', parsed); invalidateCheckedMission();
      showAssetStatus('6개 장면을 불러왔어요. 4번에는 게임이 자동 연결돼요. 표정과 대사를 확인해 주세요.', false);
    } catch (error) { showAssetStatus(error.message, true); invalidateCheckedMission(); }
  };
  function bindFile(id, kind) {
    document.getElementById(id).addEventListener('change', async function () {
      const selected = Array.from(this.files || []); if (!selected.length) return;
      const version = ++versions[kind]; pending.add(kind); invalidateCheckedMission();
      try {
        if (selected.length !== 1) throw new Error('본문과 게임은 각각 파일 하나만 선택해 주세요.');
        const file = selected[0];
        if (!/\.html?$/i.test(file.name) || file.size > 2 * 1024 * 1024) throw new Error('2MB 이하의 HTML 파일을 선택해 주세요.');
        const html = await file.text(); if (version !== versions[kind]) return;
        if (!html.trim()) throw new Error('내용이 비어 있는 파일이에요.');
        if (kind === 'program') setProgram(html, file.name, parseProgram(html));
        else {
          if (new DOMParser().parseFromString(html, 'text/html').querySelectorAll('section.scene').length === 6 && !/\bmissionClear\s*\(/.test(html)) throw new Error('본문 파일을 선택한 것 같아요. 게임 HTML 파일을 선택해 주세요.');
          gameHtml = html; gameFileName = file.name; fileList(); refreshPrompts();
        }
        const assetErrors = kind === 'game' ? embeddedErrors(html) : [];
        showAssetStatus(assetErrors.length
          ? '게임 파일은 가져왔지만 제출 전에 수정이 필요해요.\n' + assetErrors.join('\n')
          : kind === 'program' ? '본문 6개 장면을 가져왔어요.' : '게임 하나를 가져왔어요. 4번 장면에 자동으로 연결돼요.', assetErrors.length > 0);
      } catch (error) { if (version === versions[kind]) showAssetStatus(error.message || '파일을 읽지 못했어요.', true); }
      finally { if (version === versions[kind]) { pending.delete(kind); this.value = ''; } }
    });
  }
  bindFile('programFile','program'); bindFile('gameFile','game');
  document.getElementById('placeId').addEventListener('change', () => {
    invalidateCheckedMission(); fileList(); refreshPrompts();
    showAssetStatus('관광지와 제출 파일명이 바뀌었어요. 본문과 게임 내용도 선택한 장소에 맞는지 확인해 주세요.', false);
  });
  function programDocument() {
    const sections = scenes.map((sc, i) => {
      const section = new DOMParser().parseFromString(sc.outer, 'text/html').querySelector('section.scene');
      if (i === 3) { section.setAttribute('data-game','1'); section.replaceChildren(); } else section.removeAttribute('data-game');
      for (const [attr,value] of Object.entries({ title:core.FIXED_SCENES[i], 'boy-face':sc.boyFace, 'boy-text':sc.boyText, 'girl-face':sc.girlFace, 'girl-text':sc.girlText, problem:String(i === 3), hint:sc.hint, 'game-plan':sc.gamePlan || '', 'game-controls':sc.gameControls || '', 'game-answer':sc.gameAnswer || '' })) section.setAttribute('data-' + attr,value);
      return section.outerHTML;
    });
    return '<!doctype html><html lang="ko"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width"><title>매쓰투어 본문</title><style>' + studentStyle + '</style></head><body>' + sections.join('\n') + '</body></html>';
  }
  window.buildProjectSubmission = function () {
    return {
      schemaVersion:1, layout:core.SINGLE_LAYOUT,
      program:{ name:place() + '_본문.html', html:programDocument() },
      games:[{ number:1, name:nameOf(), html:gameHtml }],
      storyboard:scenes.map(sc => ({ title:sc.title, gameNumber:sc.gameNumber, boyFace:sc.boyFace, girlFace:sc.girlFace, boyText:sc.boyText, girlText:sc.girlText, isProblem:sc.isProblem, hint:sc.hint, gamePlan:sc.gamePlan, gameControls:sc.gameControls, gameAnswer:sc.gameAnswer })),
      pictures:[1,2,3].filter(n => pics[n]).map(number => ({ number, data:pics[number], source:picSrc[number] }))
    };
  };

  function embeddedErrors(html) {
    const doc = new DOMParser().parseFromString(html, 'text/html');
    const errors = [];
    const allowed = value => !value || /^(data:|IMG[123]$|#)/i.test(value.trim());
    const address = value => String(value || '(주소 없음)').slice(0, 180);
    for (const script of doc.querySelectorAll('script[src]')) errors.push('외부 JavaScript 파일을 불러와요: ' + address(script.getAttribute('src')) + ' — 필요한 코드를 HTML 안에 포함해 주세요.');
    for (const link of doc.querySelectorAll('link[href]')) errors.push('외부 스타일·글꼴 등의 파일을 연결했어요: ' + address(link.getAttribute('href')) + ' — 스타일은 HTML 안에 넣고 글꼴은 기본 글꼴을 사용해 주세요.');
    if (doc.querySelector('iframe,object,embed')) errors.push('다른 문서를 불러오는 iframe·object·embed가 있어요. 게임을 하나의 HTML 안에서 실행하도록 바꿔 주세요.');
    if (doc.querySelector('base,meta[http-equiv],script[type="module"]')) errors.push('별도 실행 방식이나 페이지 이동 설정이 있어요. base·meta http-equiv·모듈 대신 일반 HTML과 script를 사용해 주세요.');
    // A script src is JavaScript, not a missing student photo. Do not report it twice.
    if (Array.from(doc.querySelectorAll('[src],[poster]')).some(el => !el.matches('script,iframe,embed') && (!allowed(el.getAttribute('src')) || !allowed(el.getAttribute('poster')))) || doc.querySelector('[srcset]')) errors.push('이미지·영상·소리에 외부 파일 주소가 있어요. 사진은 IMG1·IMG2·IMG3로 연결하거나 파일 안에 데이터를 포함해 주세요.');
    const css = (Array.from(doc.querySelectorAll('style')).map(s => s.textContent).join('\n') + Array.from(doc.querySelectorAll('[style]')).map(s => s.getAttribute('style')).join('\n')).replace(/\/\*[\s\S]*?\*\//g, '');
    // Report imported fonts/styles once, separately from background-image URLs.
    const cssWithoutImports = css.replace(/@import\s+(?:url\(\s*(['"]?)(.*?)\1\s*\)|(['"])(.*?)\3)[^;]*;?/gi, (whole, q, url, q2, quotedUrl) => {
      errors.push('외부 글꼴·스타일을 불러와요: ' + address(url || quotedUrl) + ' — @import를 없애고 기본 글꼴과 HTML 안의 스타일을 사용해 주세요.');
      return '';
    });
    if (/@import\b/i.test(cssWithoutImports)) errors.push('외부 스타일을 불러오는 @import가 있어요. 스타일을 HTML 안에 포함해 주세요.');
    if (Array.from(cssWithoutImports.matchAll(/url\(\s*(['"]?)(.*?)\1\s*\)/gi)).some(m => !allowed(m[2]))) errors.push('배경·글꼴 등의 외부 파일 주소가 있어요. 사진은 IMG 번호로 연결하고 다른 자료는 HTML 안에 포함해 주세요.');
    return errors;
  }
  function bridgeDocument(html, channel) {
    const doc = new DOMParser().parseFromString(replaceImgTags(html), 'text/html');
    const script = doc.createElement('script'); script.textContent = '(' + gameAssetBridge.toString() + ')(' + JSON.stringify(channel) + ');'; doc.head.prepend(script);
    return '<!doctype html>' + doc.documentElement.outerHTML;
  }
  function storyDocument(sc) {
    return window.MathTourContent.storyDocument(sc.outer, studentStyle, pics);
  }
  function storyboardErrors() {
    const errors = [];
    if (pending.size) errors.push('파일을 읽는 중이에요. 잠시 후 다시 검사해 주세요.');
    if (scenes.length !== 6) errors.push('6개 장면의 본문 HTML이나 새 예시를 먼저 불러와 주세요.');
    if (programName && document.getElementById('aiCode').value.trim() !== lastImportedSource.trim()) errors.push('본문 코드를 고쳤어요. 장면 불러오기를 눌러 변경 내용을 반영해 주세요.');
    if (scenes.length) errors.push(...embeddedErrors(programDocument()).map(e => '본문: ' + e));
    return errors;
  }
  function uploadErrors() {
    const errors = storyboardErrors();
    if (!gameHtml) errors.push('게임 HTML 파일 하나를 2단계에서 선택해 주세요.');
    else {
      errors.push(...embeddedErrors(gameHtml).map(e => '게임: ' + e));
      if (!/\bmissionClear\s*\(/.test(gameHtml)) errors.push('게임의 마지막 미션 완료 버튼에서 missionClear()를 호출해야 해요.');
      const doc = new DOMParser().parseFromString(gameHtml,'text/html');
      doc.querySelectorAll('script').forEach(s => { if (s.type && !['text/javascript','application/javascript'].includes(s.type)) return; try { new Function(s.textContent); } catch(e) { errors.push('게임: ' + e.message); } });
    }
    const allSource = (scenes.length ? programDocument() : '') + gameHtml;
    for (let n = 1; n <= 3; n++) {
      if (allSource.includes('IMG' + n) && !pics[n]) errors.push('IMG' + n + '에 사용할 사진을 넣어 주세요.');
      if (pics[n] && !picSrc[n].trim()) errors.push('사진 ' + n + '의 출처를 입력해 주세요.');
    }
    return Array.from(new Set(errors));
  }
  function compileProject({ preview }) {
    const steps = scenes.map((sc, i) => {
      sc.creditSource = sc.gameNumber ? (preview ? ' ' : gameHtml) : sc.outer;
      const channel = 'game-' + i + '-' + Date.now().toString(36) + '-' + Math.random().toString(36).slice(2);
      return { title: sc.title, game: sc.gameNumber, channel, html: sc.gameNumber ? (preview ? '' : bridgeDocument(gameHtml, channel)) : storyDocument(sc) };
    });
    const previousAsset = gameAsset, previousRun = activeAssetPreview;
    try {
      gameAsset = { name: 'storyboard.html', html: core.tourDocument(steps, { preview }), hasScenes: true };
      if (!preview) activeAssetPreview = '';
      return buildFullHtml({ preview });
    } finally { gameAsset = previousAsset; activeAssetPreview = previousRun; }
  }
  // Always compile a fresh playable document for submission. Preview HTML is never saved.
  window.prepareProjectUpload = function () {
    const errors = uploadErrors();
    if (errors.length) return { errors };
    const project = window.buildProjectSubmission();
    if (size(JSON.stringify(project)) > 8 * 1024 * 1024) return { errors: ['본문·게임·사진의 합이 8MB를 넘어요. 파일 크기를 줄여 주세요.'] };
    const html = compileProject({ preview: false });
    if (size(html) > 5 * 1024 * 1024) return { errors: ['실행 파일이 5MB를 넘어요. 게임·사진 크기를 줄여 주세요.'] };
    return { errors: [], project, html };
  };
  runCheck = function () {
    invalidateCheckedMission();
    try {
      const errors = storyboardErrors();
      if (errors.length) { showErrors(errors); document.getElementById('preview').srcdoc = buildErrorHtml('스토리보드 본문을 먼저 확인해 주세요'); return; }
      activeAssetPreview = 'preview-' + Date.now().toString(36) + '-' + Math.random().toString(36).slice(2);
      previewDocument = compileProject({ preview: true });
    } catch (error) {
      invalidateCheckedMission();
      showErrors(['미리보기 본문을 만들지 못했어요. 본문 HTML을 다시 불러와 주세요.']);
      document.getElementById('preview').srcdoc = buildErrorHtml('스토리보드 본문을 확인해 주세요');
      return;
    }
    const msg = document.getElementById('msg'); msg.className = 'msg ok';
    msg.textContent = '✅ 스토리보드 미리보기예요. 게임 장면은 빈 화면·완료 상태로 표시해요. 표정·대사·순서를 확인하고 마지막 미리보기 확인 완료를 눌러 주세요. 실제 게임 파일은 제출 준비 때 검사해요.';
    document.getElementById('preview').srcdoc = previewDocument;
  };
  document.getElementById('loadExampleProject').onclick = async () => {
    if (scenes.length) { showAssetStatus('현재 본문이 있어요. 새 예시를 사용하려면 예시 본문을 내려받아 본문 HTML 칸에서 선택해 주세요.',true); return; }
    const version = ++versions.program; pending.add('program');
    try {
      const response = await fetch(new URL('./examples/K02.html?v=six-scenes',window.MATHTOUR_CONFIG?.siteBase || location.href));
      if (!response.ok) throw new Error('예시 본문을 불러오지 못했어요.');
      const html = await response.text(); if (version !== versions.program) return;
      setProgram(html,place() + '_본문.html',parseProgram(html)); invalidateCheckedMission();
      showAssetStatus('6개 장면의 예시예요. 4번 게임은 미리보기에서 비워 두고 넘겨요. 실제 제출 전에는 게임 파일을 가져와 주세요.',false);
    } catch(error) { if(version === versions.program) showAssetStatus(error.message,true); }
    finally { if(version === versions.program) pending.delete('program'); }
  };
  renderScenes(); refreshPrompts(); fileList();
})();
