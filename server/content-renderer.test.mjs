import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import vm from 'node:vm';
import { JSDOM } from 'jsdom';

const docs = new URL('../docs/', import.meta.url);
const pictures = {
  1: 'data:image/png;base64,cGhvdG8x',
  2: 'data:image/png;base64,cGhvdG8y',
  3: 'data:image/png;base64,cGhvdG8z'
};
async function run(dom, name) {
  new vm.Script(await readFile(new URL(name, docs), 'utf8'), { filename: name }).runInContext(dom.getInternalVMContext());
}
async function content(t) {
  const dom = new JSDOM('', { runScripts: 'outside-only' });
  t.after(() => dom.window.close());
  await run(dom, 'content-renderer.js');
  return { api: dom.window.MathTourContent, parse: html => new dom.window.DOMParser().parseFromString(html, 'text/html') };
}

test('AI photo labels render as images and preserve captions without exposing image data', async t => {
  const { api, parse } = await content(t);
  const source = '<div class="img-tag">[사진 자료: IMG1] 참성단 전경</div>' +
    '<div class="img-placeholder">[사진: IMG2]<br>석축 디테일</div>' +
    '<p>[이미지: IMG3] 등산로</p><p>[IMG1]</p><div> IMG2 </div>';
  const result = api.replaceImages(source, pictures), doc = parse(result);
  assert.deepEqual([...doc.images].map(img => img.getAttribute('src')), [pictures[1], pictures[2], pictures[3], pictures[1], pictures[2]]);
  assert.match(doc.body.textContent, /참성단 전경/);
  assert.match(doc.body.textContent, /석축 디테일/);
  assert.match(doc.body.textContent, /등산로/);
  assert.doesNotMatch(doc.body.textContent, /IMG[123]|data:image|base64|cGhvdG8/);
  assert.equal(api.replaceImages(result, pictures), result, 'rebinding an assembled project is idempotent');
});

test('image attributes, CSS and dynamic game image URLs bind without changing ordinary text or identifiers', async t => {
  const { api, parse } = await content(t);
  const source = '<!doctype html><html><head><style>.a{background:url(IMG2)}</style></head><body>' +
    '<img id="IMG1" class="IMG1" src="IMG1" alt="IMG1 설명">' +
    '<div style="background-image:url(\'IMG3\')">IMG1 사진을 참고해요. IMG10</div>' +
    '<pre>[사진 자료: IMG1]</pre><code>IMG2</code><textarea>IMG3</textarea>' +
    '<script>const IMG1 = "IMG1"; window.photoSource = \'IMG3\'; window.ran = true;</script></body></html>';
  const doc = parse(api.replaceImages(source, pictures));
  assert.equal(doc.images[0].src, pictures[1]);
  assert.equal(doc.images[0].id, 'IMG1');
  assert.equal(doc.images[0].className, 'IMG1');
  assert.equal(doc.images[0].alt, 'IMG1 설명');
  assert.match(doc.querySelector('style').textContent, /url\("data:image\/png;base64,cGhvdG8y"\)/);
  assert.match(doc.querySelector('[style]').getAttribute('style'), /cGhvdG8z/);
  assert.equal(doc.querySelector('div').textContent, 'IMG1 사진을 참고해요. IMG10');
  assert.equal(doc.querySelector('pre').textContent, '[사진 자료: IMG1]');
  assert.equal(doc.querySelector('code').textContent, 'IMG2');
  assert.equal(doc.querySelector('textarea').textContent, 'IMG3');
  assert.match(doc.querySelector('script').textContent, /const IMG1 = "data:image/);
  assert.match(doc.querySelector('script').textContent, /photoSource = 'data:image\/png;base64,cGhvdG8z'/);
  assert.equal(doc.defaultView, null, 'source is parsed inertly');
});

test('unavailable photo slots remain readable and IMG10 is never treated as IMG1', async t => {
  const { api, parse } = await content(t);
  const doc = parse(api.replaceImages('<p>[사진 자료: IMG1] [IMG2] [IMG10]</p><img src="IMG3">', { 1: pictures[1] }));
  assert.equal(doc.images.length, 2);
  assert.equal(doc.images[0].src, pictures[1]);
  assert.equal(doc.images[1].getAttribute('src'), 'IMG3');
  assert.equal(doc.querySelector('p').textContent, ' [IMG2] [IMG10]');
});

test('imported story is visible from its beginning and can scroll despite standalone viewport styles', async t => {
  const { api, parse } = await content(t);
  const doc = parse(api.storyDocument('<section class="scene" hidden style="display:none;height:100vh"><h2>참성단</h2><div>[사진 자료: IMG1] 설명</div></section>',
    'body{display:flex;height:100vh;overflow:hidden;align-items:center}.scene{height:100%}', pictures));
  const section = doc.querySelector('section');
  assert.equal(section.hasAttribute('hidden'), false);
  assert.equal(section.style.display, 'block');
  assert.equal(section.style.height, 'auto');
  assert.equal(section.style.getPropertyPriority('height'), 'important');
  assert.match(doc.querySelector('style:last-of-type').textContent, /body\{display:block!important/);
  assert.match(doc.querySelector('style:last-of-type').textContent, /overflow-y:auto!important/);
  assert.equal(doc.querySelector('h2').textContent, '참성단');
  assert.equal(doc.images[0].src, pictures[1]);
});

// Preserve the failure-producing input shape: six scenes, with labels instead of img tags.
const story = '<!doctype html><html><head><style>body{height:100vh;display:flex;align-items:center;overflow:hidden}</style></head><body>' +
  [1, 2, 3, null, 2, 3].map((number, i) => '<section class="scene" data-title="장면 ' + (i + 1) + '">' +
    (number ? '<h2>원본 장면 ' + (i + 1) + '</h2><div class="img-tag">[사진 자료: IMG' + number + '] 사진 설명 ' + number + '</div>' : '') + '</section>').join('') + '</body></html>';
function checkSteps(steps, parse) {
  assert.equal(steps.length, 6);
  assert.equal(steps[3].game, 1);
  [1, 2, 3, null, 2, 3].forEach((number, i) => {
    if (!number) return;
    const doc = parse(steps[i].html);
    assert.equal(doc.images.length, 1);
    assert.equal(doc.images[0].src, pictures[number]);
    assert.match(doc.body.textContent, new RegExp('원본 장면 ' + (i + 1)));
    assert.match(doc.body.textContent, new RegExp('사진 설명 ' + number));
    assert.doesNotMatch(doc.body.textContent, /data:image|base64|IMG[123]/);
  });
}

test('the actual maker preview, exported mission and stored-project player bind the same original photo labels', async t => {
  const dom = new JSDOM(await readFile(new URL('make.html', docs), 'utf8'), {
    url: 'https://jsh1065.github.io/incheon-mathtour/make.html', runScripts: 'outside-only'
  });
  t.after(() => dom.window.close());
  const w = dom.window, context = dom.getInternalVMContext();
  for (const el of w.document.querySelectorAll('script')) {
    const src = el.getAttribute('src');
    if (src) await run(dom, src.split('?')[0]);
    else new vm.Script(el.textContent).runInContext(context);
  }
  w.document.getElementById('placeId').value = 'K02';
  w.document.getElementById('topic').value = '참성단과 도형';
  w.document.getElementById('aiCode').value = story;
  w.loadScenes();
  new vm.Script('pics=' + JSON.stringify(pictures) + ';picSrc={1:"제미나이",2:"직접 촬영",3:"제미나이"};').runInContext(context);
  const game = '<!doctype html><button onclick="missionClear()">미션 완료</button>';
  const input = w.document.getElementById('gameFile');
  Object.defineProperty(input, 'files', { value: [{ name: 'K02_게임.html', size: game.length, text: async () => game }] });
  input.dispatchEvent(new w.Event('change'));
  await new Promise(resolve => setImmediate(resolve));
  let steps;
  const original = w.MathTourProject.tourDocument;
  w.MathTourProject.tourDocument = (value, options) => { steps = value; return original(value, options); };
  const parse = html => new w.DOMParser().parseFromString(html, 'text/html');
  w.runCheck();
  assert.equal(w.document.getElementById('msg').className, 'msg ok');
  checkSteps(steps, parse);
  const exported = w.prepareProjectUpload();
  assert.equal(exported.errors.length, 0);
  checkSteps(steps, parse);
  assert.match(exported.project.program.html, /\[사진 자료: IMG1\]/, 'keep original source editable');
  assert.match(exported.html, /사진 출처: 제미나이/);
  assert.match(exported.html, /사진 출처: 직접 촬영/);
  for (const script of parse(exported.html).scripts) new vm.Script(script.textContent);
  await run(dom, 'project-renderer.js');
  const played = w.renderStoredProject(exported.project, { placeId: 'K02', topic: '참성단과 도형' });
  checkSteps(steps, parse);
  assert.match(played, /사진 출처: 직접 촬영/);
  for (const script of parse(played).scripts) new vm.Script(script.textContent);
});
