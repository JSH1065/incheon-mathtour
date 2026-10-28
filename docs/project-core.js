/* Shared with the Node checks; no network or storage access. */
(function (root) {
  const MAX_GAMES = 20;
  function gameNumber(value) {
    const n = Number(value);
    if (!/^\d{1,3}$/.test(String(value)) || !Number.isInteger(n) || n < 1 || n > 999) throw new Error('게임 번호는 1~999 사이의 정수로 입력해 주세요.');
    return n;
  }
  function gameName(place, number) { return place + '-G' + gameNumber(number) + '.html'; }
  function parseGameName(name) {
    const m = /^([BKMNS]\d{2})-G(\d{1,3})\.html?$/i.exec(name);
    return m ? { place: m[1].toUpperCase(), number: gameNumber(m[2]) } : null;
  }
  function json(value) { return JSON.stringify(value).replace(/</g, '\\u003c').replace(/\u2028/g, '\\u2028').replace(/\u2029/g, '\\u2029'); }
  function tourRuntime(steps) {
    const screens = Array.from(document.querySelectorAll('.scene'));
    const previous = document.getElementById('tourPrevious');
    const next = document.getElementById('tourNext');
    const finish = document.getElementById('tourFinish');
    const status = document.getElementById('tourStatus');
    const title = document.getElementById('tourTitle');
    const frames = [], solved = new Set();
    let current = 0, failed = false, done = false;
    const ready = i => !steps[i].game || solved.has(i);
    function paint() {
      screens.forEach((s, i) => { s.hidden = i !== current; });
      title.textContent = (current + 1) + ' / ' + steps.length + ' · ' + steps[current].title;
      previous.disabled = current === 0 || done || failed;
      next.hidden = current === steps.length - 1;
      next.disabled = !ready(current) || done || failed;
      finish.hidden = current !== steps.length - 1;
      finish.disabled = !steps.every((_, i) => ready(i)) || done || failed;
      if (!failed) status.textContent = done ? '전체 미션을 완료했어요!' : steps[current].game ? (ready(current) ? '게임 완료! 다음 장면으로 이동할 수 있어요.' : '게임의 마지막 미션 완료까지 진행해 주세요.') : '내용을 살펴본 뒤 다음 장면으로 이동하세요.';
      if (!frames[current]) {
        const frame = document.createElement('iframe');
        frame.title = steps[current].game ? '게임 ' + steps[current].game : steps[current].title;
        frame.setAttribute('sandbox', steps[current].game ? 'allow-scripts allow-forms' : '');
        screens[current].appendChild(frame);
        frames[current] = frame;
        frame.srcdoc = steps[current].html;
      }
    }
    previous.addEventListener('click', () => { if (current > 0 && !done && !failed) { current--; paint(); } });
    next.addEventListener('click', () => { if (current < steps.length - 1 && ready(current) && !done && !failed) { current++; paint(); } });
    finish.addEventListener('click', () => {
      if (done || failed || current !== steps.length - 1 || !steps.every((_, i) => ready(i))) return;
      done = true; paint();
      if (typeof window.missionClear === 'function') window.missionClear();
    });
    window.addEventListener('message', event => {
      const data = event.data;
      const index = frames.findIndex(frame => frame && event.source === frame.contentWindow);
      if (index < 0 || !steps[index].game || !data || data.type !== 'MT_GAME_ASSET' || data.channel !== steps[index].channel) return;
      if (data.event === 'error') {
        failed = true; paint();
        status.textContent = '게임 ' + steps[index].game + ' 실행 오류: ' + String(data.message || '파일을 확인해 주세요.');
        // Forward the failure through the enclosing game's normal error bridge.
        throw new Error(status.textContent);
      }
      if (data.event === 'complete' && index === current && !done && !failed) { solved.add(index); paint(); }
    });
    paint();
  }
  function tourDocument(steps) {
    return '<!doctype html><html lang="ko"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width"><title>매쓰투어 스토리보드</title><style>' +
      '*{box-sizing:border-box}html,body{margin:0;height:100%;font-family:Malgun Gothic,sans-serif;background:#eef6ff;color:#26364a}body{display:flex;flex-direction:column;padding-bottom:48px}[hidden]{display:none!important}header{padding:6px 10px;font-size:13px;font-weight:bold;background:#e3effc}main{position:relative;flex:1;min-height:0}.scene{position:absolute;inset:0}.scene iframe{width:100%;height:100%;border:0;display:block}footer{padding:5px 10px;background:white;flex-shrink:0}#tourStatus{font-size:12px;margin:0 0 4px;min-height:16px}nav{display:flex;gap:8px;justify-content:space-between}button{font:inherit;font-size:13px;border:0;border-radius:8px;padding:7px 14px;background:#1565c0;color:white;cursor:pointer}button:disabled{background:#b7c6d8;cursor:not-allowed}button:focus-visible{outline:3px solid #f9a825;outline-offset:2px}</style></head><body><header id="tourTitle"></header><main>' +
      steps.map(() => '<section class="scene" hidden></section>').join('') +
      '</main><footer><p id="tourStatus" role="status" aria-live="polite"></p><nav><button id="tourPrevious">◀ 이전 장면</button><button id="tourNext">다음 장면 ▶</button><button id="tourFinish" hidden>전체 미션 완료</button></nav></footer><script>(' + tourRuntime.toString() + ')(' + json(steps) + ');<\/script></body></html>';
  }
  root.MathTourProject = { MAX_GAMES, gameNumber, gameName, parseGameName, tourDocument, tourRuntime };
})(typeof window === 'undefined' ? globalThis : window);
