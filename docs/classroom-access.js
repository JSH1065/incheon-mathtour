/* A teacher-shared fragment supplies the classroom code; no code is published here. */
(function (root) {
  'use strict';
  if (root.location.protocol === 'file:' || root.MATHTOUR_CONFIG?.storageProvider !== 'github') return;
  const input = document.getElementById('uploadCode');
  const fields = document.getElementById('uploadCodeFields');
  const notice = document.getElementById('classroomAccessNotice');
  if (!input || !fields || !notice) return;
  const storageKey = 'mathtour:classroom-access:v1:' + root.MATHTOUR_CONFIG.apiUrl;
  const valid = code => typeof code === 'string' && /^[a-f0-9]{24}$/.test(code);
  const report = (text, bad = false) => {
    notice.hidden = false;
    notice.className = bad ? 'hint classroom-access-error' : 'hint';
    notice.textContent = text;
  };
  function apply(code, remember) {
    input.value = code;
    // This flag is essential: doUpload adds each author's private browser key.
    input.dataset.common = 'true';
    fields.hidden = true;
    let stored = true;
    if (remember) {
      try { root.localStorage.setItem(storageKey, code); } catch { stored = false; }
    }
    report(stored ? '수업용 제출 설정이 적용됐어요. 코드 입력 없이 학교와 이름으로 제출해요.' :
      '코드 입력 없이 제출할 수 있어요. 다시 접속할 때는 선생님이 준 수업용 링크를 사용해 주세요.');
  }
  function consumeLink() {
    const params = new URLSearchParams(root.location.hash.slice(1));
    if (!params.has('class')) return false;
    const codes = params.getAll('class');
    const code = codes.length === 1 ? codes[0] : '';
    const view = params.get('view') === 'storyboard' ? '#storyboard' : '';
    // Keep the invitation out of copied navigation URLs and later browser history entries.
    try { root.history.replaceState(root.history.state, '', root.location.pathname + root.location.search + view); }
    catch { /* A restricted browser can still use the invitation for this visit. */ }
    if (!valid(code)) {
      input.value = '';
      delete input.dataset.common;
      fields.hidden = false;
      try { root.localStorage.removeItem(storageKey); } catch { /* Storage may be blocked. */ }
      report('수업용 링크가 완전하지 않아요. 선생님이 준 링크 전체를 다시 열어 주세요.', true);
      return true;
    }
    apply(code, true);
    return true;
  }
  if (!consumeLink() && !input.value) {
    let saved;
    try { saved = root.localStorage.getItem(storageKey); } catch { /* Use a fresh invitation if storage is blocked. */ }
    if (valid(saved)) apply(saved, false);
  }
  // Also support opening an invitation while this maker tab is already loaded.
  root.addEventListener('hashchange', consumeLink);
})(window);
