/* The editor owns the story order; each numbered game runs in its own sandbox. */
(function () {
  'use strict';
  const core = window.MathTourProject;
  const numbers = new Set([1]);
  const files = new Map();
  let programName = '', lastImportedSource = '', readVersion = 0, reading = false;
  const place = () => document.getElementById('placeId').value;
  const sorted = () => Array.from(numbers).sort((a, b) => a - b);
  const nameOf = n => core.gameName(place(), n);
  const size = value => new Blob([value]).size;
  const originalRender = renderScenes;
  const downloadUrls = [];
  function refreshSubmissionName() {
    const target = document.getElementById('submissionNamePreview');
    try {
      const base = window.MathTourSubmission.prefix(place(), document.getElementById('school').value, document.getElementById('sname').value);
      target.textContent = '제출 파일명: ' + base + '_본문.html · ' + base + '_G1.html';
    } catch (error) {
      target.textContent = '제출 파일명: ' + place() + '_학교이름_본문.html · ' + place() + '_학교이름_G1.html';
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
      '첨부한 스토리보드를 매쓰투어 이야기 본문 HTML로 만들어 줘. 게임 구현은 별도 파일로 만들 거야.',
      '장소: ' + place() + ' ' + PLACE_NAME[place()] + '. 본문 파일명: ' + place() + '.html',
      '등록한 게임: ' + sorted().map(n => '게임 ' + n + ' = ' + nameOf(n)).join(', '),
      '',
      '1. HTML과 CSS만 있는 본문 파일 하나를 만들어. JavaScript, 게임 로직, iframe, 이전·다음·미션 완료 버튼은 넣지 마. 제작기가 순서와 버튼을 제공해.',
      '2. 장면마다 <section class="scene" data-title="장면 제목">으로 감싸고 스토리보드 순서대로 배치해.',
      '3. 게임 장면은 <section class="scene" data-title="게임 1" data-game="1"></section>처럼 번호만 적어. 게임 2는 data-game="2"야. 실제 게임 코드는 절대로 본문에 섞지 마.',
      '4. 이야기·설명·사진 장면은 section 안에 내용을 넣고 data-game은 생략해. 사진이 필요할 때만 IMG1, IMG2, IMG3를 사용해. 외부 파일·라이브러리는 불러오지 마.',
      '5. 각 장면에 data-boy-face, data-boy-text, data-girl-face, data-girl-text, data-problem, data-hint를 넣어. 표정은 stand, how, thinking, finding, aha, thumb, lookmap 중 선택해. 캐릭터·말풍선은 직접 그리지 마.',
      '6. 게임 장면에는 data-problem="true"와 힌트를 적어. 이야기 마지막에는 배운 내용을 돌아보는 장면을 넣어.',
      '7. 가운데 화면은 16:9에 맞춰 반응형으로 만들어. 작은 화면에서도 내용이 잘리지 않게 하고 긴 내용은 스크롤할 수 있게 해.',
      '완성된 본문 HTML 전체를 제공해 줘. 게임 파일은 별도 요청에서 만들 거야.'
    ].join('\n');
  };

  function refreshPrompts() {
    document.getElementById('promptText').value = window.getProgramPrompt();
    const selector = document.getElementById('gamePromptNumber');
    const selected = Number(selector.value);
    selector.replaceChildren();
    sorted().forEach(n => selector.add(new Option('게임 ' + n + ' · ' + nameOf(n), String(n))));
    if (numbers.has(selected)) selector.value = String(selected);
    const n = Number(selector.value) || 1;
    document.getElementById('gameAssetPrompt').value = '이번에 만들 게임: 게임 ' + n + '\n파일명: ' + nameOf(n) + '\n' + GAME_ASSET_PROMPT +
      '\n이 게임의 미션 완료는 게임 하나의 완료야. 전체 이야기의 진행·다음 장면 버튼은 제작기가 처리해.';
  }
  document.getElementById('gamePromptNumber').onchange = refreshPrompts;
  function fileList() {
    const lines = [programName ? '✓ 본문: ' + programName + ' · ' + scenes.length + '개 장면' : '본문 HTML 파일을 가져오거나 본문 코드를 입력해 주세요.'];
    sorted().forEach(n => lines.push((files.has(nameOf(n)) ? '✓ ' : '파일 필요: ') + '게임 ' + n + ' · ' + nameOf(n)));
    const other = Array.from(files.keys()).filter(name => !sorted().some(n => nameOf(n) === name));
    if (other.length) lines.push('현재 장소에서 사용하지 않는 파일: ' + other.join(', ') + ' (제출에서 제외)');
    const target = document.getElementById('projectFileList');
    target.textContent = lines.join('\n'); target.style.whiteSpace = 'pre-line';
  }
  function renderNumbers() {
    const host = document.getElementById('gameNumberList'); host.replaceChildren();
    sorted().forEach(n => {
      const row = document.createElement('div'); row.style.cssText = 'display:flex;gap:8px;align-items:center;padding:7px 0;border-bottom:1px solid #edf1f5';
      const text = document.createElement('span'); text.textContent = '게임 ' + n + ' → ' + nameOf(n); text.style.flex = '1';
      const remove = document.createElement('button'); remove.type = 'button'; remove.className = 'btn btn-prompt'; remove.textContent = '삭제'; remove.setAttribute('aria-label', '게임 ' + n + ' 번호 삭제');
      remove.onclick = () => {
        if (scenes.some(sc => sc.gameNumber === n)) { showAssetStatus('스토리보드에서 게임 ' + n + ' 연결을 바꾼 뒤 삭제해 주세요.', true); return; }
        numbers.delete(n); files.delete(nameOf(n)); invalidateCheckedMission(); renderNumbers(); renderScenes();
      };
      row.append(text, remove); host.appendChild(row);
    });
    refreshPrompts(); fileList();
  }

  renderScenes = function () {
    originalRender();
    document.querySelectorAll('#sceneList .scene-item').forEach((row, i) => {
      const label = document.createElement('label'); label.textContent = '이 장면에 보여줄 내용';
      const select = document.createElement('select'); select.setAttribute('aria-label', '장면 ' + (i + 1) + ' 내용 선택');
      select.add(new Option('이야기·사진 (본문 내용)', ''));
      sorted().forEach(n => select.add(new Option('게임 ' + n + ' · ' + nameOf(n), String(n))));
      select.value = scenes[i].gameNumber ? String(scenes[i].gameNumber) : '';
      select.onchange = () => {
        scenes[i].gameNumber = select.value ? core.gameNumber(select.value) : null;
        invalidateCheckedMission(); fileList();
      };
      label.appendChild(select); row.querySelector('.scene-head').after(label);
    });
  };

  function parseProgram(html) {
    const doc = new DOMParser().parseFromString(html, 'text/html');
    if (doc.querySelector('script,iframe,object,embed,base,link[rel~="stylesheet"]') || Array.from(doc.querySelectorAll('*')).some(el => Array.from(el.attributes).some(a => /^on/i.test(a.name)))) {
      throw new Error('본문에는 이야기와 게임 번호만 넣어 주세요. 게임 동작 코드·iframe은 별도 게임 파일에 넣고, 본문은 1단계 프롬프트로 다시 만들어 주세요.');
    }
    const sections = Array.from(doc.querySelectorAll('section.scene'));
    if (!sections.length || sections.length > 50) throw new Error('본문에 section.scene 장면이 1~50개 필요해요. 1단계 프롬프트를 사용해 주세요.');
    const safeFace = v => FACES.some(f => f.key === v) ? v : 'stand';
    const parsed = sections.map((section, i) => ({
      title: section.getAttribute('data-title') || '장면 ' + (i + 1), outer: section.outerHTML,
      gameNumber: section.hasAttribute('data-game') ? core.gameNumber(section.getAttribute('data-game')) : null,
      boyFace: safeFace(section.getAttribute('data-boy-face')), boyText: section.getAttribute('data-boy-text') || '',
      girlFace: safeFace(section.getAttribute('data-girl-face')), girlText: section.getAttribute('data-girl-text') || '',
      isProblem: /^(true|1|yes)$/i.test(section.getAttribute('data-problem') || ''), hint: section.getAttribute('data-hint') || ''
    }));
    return { scenes: parsed, css: Array.from(doc.querySelectorAll('style')).map(s => s.textContent).join('\n') };
  }
  function setProgram(html, name, parsed) {
    lastImportedSource = html;
    scenes = parsed.scenes; studentStyle = parsed.css; studentScript = ''; gameAsset = null;
    programName = name;
    parsed.scenes.forEach(sc => { if (sc.gameNumber) numbers.add(sc.gameNumber); });
    document.getElementById('aiCode').value = html;
  }
  loadScenes = function () {
    try {
      const html = document.getElementById('aiCode').value;
      const parsed = parseProgram(html);
      if (new Set([...numbers, ...parsed.scenes.map(sc => sc.gameNumber).filter(Boolean)]).size > core.MAX_GAMES) throw new Error('게임은 최대 20개까지 등록할 수 있어요.');
      setProgram(html, place() + '.html', parsed);
      readVersion++; reading = false; invalidateCheckedMission(); renderNumbers(); renderScenes();
      showAssetStatus('본문 장면을 불러왔어요. 각 장면의 게임 번호와 표정·대사를 확인하세요.', false);
    } catch (error) { showAssetStatus(error.message, true); invalidateCheckedMission(); }
  };

  document.getElementById('addGameBtn').onclick = () => {
    try {
      const n = core.gameNumber(document.getElementById('newGameNumber').value);
      if (numbers.has(n)) throw new Error('게임 ' + n + '은 이미 등록되어 있어요.');
      if (numbers.size >= core.MAX_GAMES) throw new Error('게임은 최대 20개까지 등록할 수 있어요.');
      numbers.add(n); invalidateCheckedMission(); renderNumbers(); renderScenes();
      showAssetStatus('게임 ' + n + '을 추가했어요. 파일명은 ' + nameOf(n) + '이에요.', false);
      document.getElementById('newGameNumber').value = Math.min(999, n + 1);
    } catch (error) { showAssetStatus(error.message, true); }
  };
  document.getElementById('placeId').addEventListener('change', () => {
    readVersion++; reading = false; invalidateCheckedMission(); renderNumbers(); renderScenes();
    showAssetStatus('선택한 장소에 맞춰 파일명이 바뀌었어요. 해당 장소의 게임 파일을 가져와 주세요.', false);
  });

  document.getElementById('projectFiles').addEventListener('change', async function () {
    const selected = Array.from(this.files || []); if (!selected.length) return;
    const version = ++readVersion; const selectedPlace = place();
    reading = true; invalidateCheckedMission();
    try {
      if (selected.length > core.MAX_GAMES + 1) throw new Error('본문 1개와 게임 최대 20개를 선택해 주세요.');
      if (selected.some(f => !/\.html?$/i.test(f.name) || f.size > 2 * 1024 * 1024)) throw new Error('파일마다 2MB 이하의 HTML 파일을 선택해 주세요.');
      const loaded = await Promise.all(selected.map(async file => ({ name: file.name, html: await file.text(), game: core.parseGameName(file.name) })));
      if (version !== readVersion) return;
      if (loaded.some(f => !f.html.trim())) throw new Error('내용이 비어 있는 파일이 있어요.');
      const programs = loaded.filter(f => !f.game);
      if (programs.length > 1) throw new Error('본문은 하나만 선택해 주세요. 게임 파일명은 ' + selectedPlace + '-G1.html처럼 지정해 주세요.');
      if (loaded.some(f => f.game && f.game.place !== selectedPlace)) throw new Error('다른 장소의 게임 파일이 있어요. 현재 장소는 ' + selectedPlace + '이에요.');
      const gameKeys = loaded.filter(f => f.game).map(f => core.gameName(selectedPlace, f.game.number));
      if (new Set(gameKeys).size !== gameKeys.length) throw new Error('같은 게임 번호의 파일을 두 번 선택했어요. 한 파일만 선택해 주세요.');
      const parsed = programs.length ? parseProgram(programs[0].html) : null;
      const nextNumbers = new Set([...numbers, ...loaded.filter(f => f.game).map(f => f.game.number), ...(parsed?.scenes || []).map(sc => sc.gameNumber).filter(Boolean)]);
      if (nextNumbers.size > core.MAX_GAMES) throw new Error('게임은 최대 20개까지 등록할 수 있어요.');
      if (programs.length) setProgram(programs[0].html, programs[0].name, parsed);
      loaded.filter(f => f.game).forEach(f => { files.set(core.gameName(selectedPlace, f.game.number), f.html); numbers.add(f.game.number); });
      renderNumbers(); renderScenes();
      showAssetStatus(selected.length + '개 파일을 가져왔어요. 아직 제출하지 않았어요. 스토리보드 미리보기를 눌러 주세요.', false);
    } catch (error) { if (version === readVersion) showAssetStatus(error.message || '파일을 읽지 못했어요.', true); }
    finally { if (version === readVersion) { reading = false; this.value = ''; } }
  });

  function programDocument() {
    const sections = scenes.map(sc => {
      const section = new DOMParser().parseFromString(sc.outer, 'text/html').querySelector('section.scene');
      if (sc.gameNumber) section.setAttribute('data-game', sc.gameNumber); else section.removeAttribute('data-game');
      for (const [attr, value] of Object.entries({ 'title': sc.title, 'boy-face': sc.boyFace, 'boy-text': sc.boyText, 'girl-face': sc.girlFace, 'girl-text': sc.girlText, 'problem': String(sc.isProblem), 'hint': sc.hint })) section.setAttribute('data-' + attr, value);
      return section.outerHTML;
    });
    return '<!doctype html><html lang="ko"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width"><title>매쓰투어 본문</title><style>' + studentStyle + '</style></head><body>' + sections.join('\n') + '</body></html>';
  }
  window.buildProjectSubmission = function () {
    return {
      schemaVersion: 1,
      program: { name: programName || place() + '.html', html: programDocument() },
      games: sorted().map(number => ({ number, name: nameOf(number), html: files.get(nameOf(number)) })),
      storyboard: scenes.map(sc => ({ title: sc.title, gameNumber: sc.gameNumber, boyFace: sc.boyFace, girlFace: sc.girlFace, boyText: sc.boyText, girlText: sc.girlText, isProblem: sc.isProblem, hint: sc.hint })),
      pictures: [1, 2, 3].filter(n => pics[n]).map(number => ({ number, data: pics[number], source: picSrc[number] }))
    };
  };

  function embeddedErrors(html) {
    const doc = new DOMParser().parseFromString(html, 'text/html');
    const errors = [];
    const allowed = value => !value || /^(data:|IMG[123]$|#)/i.test(value.trim());
    if (doc.querySelector('script[src],link[href],iframe,object,embed,base,meta[http-equiv],script[type="module"]')) errors.push('외부 파일·iframe·모듈 대신 HTML 안에 모든 내용을 넣어 주세요.');
    if (Array.from(doc.querySelectorAll('[src],[poster]')).some(el => !allowed(el.getAttribute('src')) || !allowed(el.getAttribute('poster'))) || doc.querySelector('[srcset]')) errors.push('이미지는 IMG1·IMG2·IMG3 또는 HTML 안에 포함한 이미지만 사용할 수 있어요.');
    const css = Array.from(doc.querySelectorAll('style')).map(s => s.textContent).join('\n') + Array.from(doc.querySelectorAll('[style]')).map(s => s.getAttribute('style')).join('\n');
    if (/@import\b/i.test(css) || Array.from(css.matchAll(/url\(\s*(['"]?)(.*?)\1\s*\)/gi)).some(m => !allowed(m[2]))) errors.push('배경과 스타일의 외부 파일 주소를 IMG 번호 또는 내장 데이터로 바꿔 주세요.');
    return errors;
  }
  function bridgeDocument(html, channel) {
    const doc = new DOMParser().parseFromString(replaceImgTags(html), 'text/html');
    const script = doc.createElement('script'); script.textContent = '(' + gameAssetBridge.toString() + ')(' + JSON.stringify(channel) + ');'; doc.head.prepend(script);
    return '<!doctype html>' + doc.documentElement.outerHTML;
  }
  function storyDocument(sc) {
    const doc = new DOMParser().parseFromString(sc.outer, 'text/html');
    const section = doc.querySelector('section.scene'); section.removeAttribute('hidden');
    section.style.cssText += ';display:block!important;visibility:visible!important;position:relative!important;height:auto!important;min-height:100%;';
    return replaceImgTags('<!doctype html><html lang="ko"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width"><style>*{box-sizing:border-box}html,body{margin:0;min-height:100%;font-family:Malgun Gothic,sans-serif}body{padding:14px}img{max-width:100%}' + studentStyle + '</style></head><body>' + section.outerHTML + '</body></html>');
  }
  function storyboardErrors() {
    const errors = [];
    if (reading) errors.push('파일을 읽는 중이에요. 잠시 후 다시 검사해 주세요.');
    if (!scenes.length) errors.push('본문 HTML이나 예시 스토리보드를 먼저 불러와 주세요.');
    if (programName && document.getElementById('aiCode').value.trim() !== lastImportedSource.trim()) errors.push('본문 코드를 고쳤어요. 장면 불러오기를 눌러 변경 내용을 반영해 주세요.');
    if (scenes.length) errors.push(...embeddedErrors(programDocument()).map(e => '본문: ' + e));
    return errors;
  }
  function uploadErrors() {
    const errors = storyboardErrors();
    sorted().forEach(n => {
      const html = files.get(nameOf(n));
      if (!html) { errors.push(nameOf(n) + ' 파일이 없어요. 4단계에서 함께 가져와 주세요.'); return; }
      errors.push(...embeddedErrors(html).map(e => nameOf(n) + ': ' + e));
      if (!/\bmissionClear\s*\(/.test(html)) errors.push(nameOf(n) + ': 마지막 완료 버튼에서 missionClear()를 호출해야 해요.');
      const doc = new DOMParser().parseFromString(html, 'text/html');
      doc.querySelectorAll('script').forEach(s => { if (s.type && !['text/javascript', 'application/javascript'].includes(s.type)) return; try { new Function(s.textContent); } catch (e) { errors.push(nameOf(n) + ': ' + e.message); } });
    });
    scenes.forEach((sc, i) => { if (sc.gameNumber && !numbers.has(sc.gameNumber)) errors.push('장면 ' + (i + 1) + '의 게임 번호가 등록되지 않았어요.'); });
    const allSource = (scenes.length ? programDocument() : '') + sorted().map(n => files.get(nameOf(n)) || '').join('\n');
    for (let n = 1; n <= 3; n++) {
      if (allSource.includes('IMG' + n) && !pics[n]) errors.push('IMG' + n + '에 사용할 사진을 넣어 주세요.');
      if (pics[n] && !picSrc[n].trim()) errors.push('사진 ' + n + '의 출처를 입력해 주세요.');
    }
    return Array.from(new Set(errors));
  }
  function compileProject({ preview }) {
    const steps = scenes.map((sc, i) => {
      sc.creditSource = sc.gameNumber ? (preview ? ' ' : files.get(nameOf(sc.gameNumber))) : sc.outer;
      const channel = 'game-' + i + '-' + Date.now().toString(36) + '-' + Math.random().toString(36).slice(2);
      return { title: sc.title, game: sc.gameNumber, channel, html: sc.gameNumber ? (preview ? '' : bridgeDocument(files.get(nameOf(sc.gameNumber)), channel)) : storyDocument(sc) };
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
    if (scenes.length) { showAssetStatus('현재 본문이 있어요. 예시를 사용하려면 예시 본문 HTML을 4단계에서 가져와 주세요.', true); return; }
    const version = ++readVersion;
    try {
      const response = await fetch(new URL('./examples/K02.html', window.MATHTOUR_CONFIG?.siteBase || location.href)); if (!response.ok) throw new Error('예시 본문을 불러오지 못했어요.');
      const html = await response.text(); if (version !== readVersion) return;
      setProgram(html, place() + '.html', parseProgram(html));
      invalidateCheckedMission(); renderNumbers(); renderScenes();
      showAssetStatus('게임 1·게임 2가 있는 예시 스토리보드예요. 게임 파일 없이도 미리볼 수 있어요. 실제 업로드 전에는 두 게임 파일을 가져와 주세요.', false);
    } catch (error) { showAssetStatus(error.message, true); }
  };
  renderNumbers();
})();
