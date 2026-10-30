import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import vm from 'node:vm';
import { JSDOM } from 'jsdom';

const docs = new URL('../docs/', import.meta.url);
async function maker(t) {
  const dom = new JSDOM(await readFile(new URL('make.html', docs), 'utf8'), {
    url:'https://jsh1065.github.io/incheon-mathtour/make.html', runScripts:'outside-only'
  });
  t.after(() => dom.window.close());
  const w = dom.window;
  for (const el of w.document.querySelectorAll('script')) {
    const src = el.getAttribute('src');
    const code = src ? await readFile(new URL(src.split('?')[0], docs), 'utf8') : el.textContent;
    new vm.Script(code).runInContext(dom.getInternalVMContext());
  }
  w.document.getElementById('aiCode').value = Array.from({length:6}, (_, i) => '<section class="scene"><h2>장면 ' + (i + 1) + '</h2></section>').join('');
  w.loadScenes();
  return async markup => {
    const html = '<!doctype html><html><head>' + markup + '</head><body><button onclick="missionClear()">미션 완료</button></body></html>';
    const input = w.document.getElementById('gameFile');
    Object.defineProperty(input, 'files', {configurable:true, value:[{name:'K02_게임.html', size:html.length, text:async()=>html}]});
    input.dispatchEvent(new w.Event('change'));
    await new Promise(resolve => setImmediate(resolve));
    return Array.from(w.prepareProjectUpload().errors);
  };
}

test('a Tailwind script and Google font produce two precise errors, not a spurious image error', async t => {
  const validate = await maker(t);
  const errors = await validate('<script src="https://cdn.tailwindcss.com"></script><style>@import url("https://fonts.googleapis.com/css2?family=Noto+Sans+KR");</style>');
  assert.equal(errors.length, 2);
  assert.ok(errors.some(error => error.includes('JavaScript') && error.includes('cdn.tailwindcss.com')));
  assert.ok(errors.some(error => error.includes('외부 글꼴·스타일') && error.includes('fonts.googleapis.com')));
  assert.ok(errors.every(error => !error.includes('이미지') && !error.includes('배경')));
});

test('inline CSS/scripts and SVG fragments pass while actual external media remains rejected', async t => {
  const validate = await maker(t);
  assert.deepEqual(await validate('<style>/* @import url("https://example.test/comment.css"); */p{color:red;filter:url(#local)}</style><script>function answer(){return 2;}</script>'), []);
  const images = await validate('<img src="https://example.test/photo.png">');
  assert.equal(images.length, 1);
  assert.match(images[0], /이미지·영상·소리/);
  assert.equal((await validate('<img srcset="https://example.test/photo.png 1x">')).length, 1);
});

test('imported styles, background URLs and embedded documents remain individually diagnosed', async t => {
  const validate = await maker(t);
  const errors = await validate('<style>@import "https://example.test/one.css" screen;div{background:url(https://example.test/bg.png)}</style>');
  assert.equal(errors.length, 2);
  assert.ok(errors.some(error => error.includes('one.css')));
  assert.ok(errors.some(error => error.includes('배경·글꼴')));
  const frame = await validate('<iframe src="https://example.test/"></iframe>');
  assert.equal(frame.length, 1);
  assert.match(frame[0], /다른 문서/);
});
