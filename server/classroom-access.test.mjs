import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import vm from 'node:vm';
import { webcrypto } from 'node:crypto';

const source = await readFile(new URL('../docs/classroom-access.js', import.meta.url), 'utf8');
const names = await readFile(new URL('../docs/submission-files.js', import.meta.url), 'utf8');
const code = '1234567890abcdef12345678';
const storage = () => {
  const data = new Map();
  return { getItem: key => data.get(key), setItem: (key, value) => data.set(key, value), removeItem: key => data.delete(key) };
};
function open({hash = '', saved = storage(), protocol = 'https:', api = 'https://upload.example/api', inputValue = ''} = {}) {
  const elements = { uploadCode: { value: inputValue, dataset: {} }, uploadCodeFields: { hidden: false }, classroomAccessNotice: { hidden: true } };
  const listeners = {};
  const window = { MATHTOUR_CONFIG: {storageProvider:'github', apiUrl:api}, localStorage:saved, crypto:webcrypto,
    location:{protocol, hash, pathname:'/incheon-mathtour/make.html', search:''},
    history: {state:{}, replaceState(state, title, url) { window.cleanedUrl=url; window.location.hash=new URL(url, 'https://site.example').hash; }},
    addEventListener(event, fn) { listeners[event]=fn; } };
  const context = {window, document:{getElementById:id=>elements[id]}, URLSearchParams, Uint8Array};
  vm.runInNewContext(source, context);
  vm.runInNewContext(names, context);
  return {window, elements, listeners};
}

test('one invitation automatically supplies the code, selects common submission mode, and preserves storyboard routing', () => {
  const {window, elements} = open({hash:'#class='+code+'&view=storyboard'});
  assert.equal(elements.uploadCode.value, code);
  assert.equal(elements.uploadCode.dataset.common, 'true');
  assert.equal(elements.uploadCodeFields.hidden, true);
  assert.equal(window.location.hash, '#storyboard');
  assert(!window.cleanedUrl.includes(code));
  assert(!elements.classroomAccessNotice.textContent.includes(code));
});

test('reload and returning from the map retain class access and the author update key', () => {
  const saved=storage(), first=open({hash:'#class='+code, saved});
  const key=first.window.MathTourSubmission.commonSubmissionKey('구월중','학생');
  const again=open({hash:'#storyboard', saved});
  assert.equal(again.elements.uploadCode.value,code);
  assert.equal(again.elements.uploadCode.dataset.common,'true');
  assert.equal(again.window.MathTourSubmission.commonSubmissionKey('구월중','학생'),key);
  assert.equal(open({saved,api:'https://another.example/api'}).elements.uploadCode.value,'');
});

test('20 students opening the same invitation get separate update keys, including namesakes', () => {
  const keys=Array.from({length:20},()=>{
    const browser=open({hash:'#class='+code});
    assert.equal(browser.elements.uploadCode.dataset.common,'true');
    return browser.window.MathTourSubmission.commonSubmissionKey('같은학교','같은이름');
  });
  assert.equal(new Set(keys).size,20);
});

test('a malformed or duplicate class parameter never falls back to an earlier class', () => {
  for(const hash of ['#class=','#class=broken','#class='+code+'&class='+code]){
    const saved=storage();open({hash:'#class='+code,saved});
    const current=open({hash,saved});
    assert.equal(current.elements.uploadCode.value,'');
    assert.equal(current.elements.uploadCode.dataset.common,undefined);
    assert.equal(current.elements.uploadCodeFields.hidden,false);
    assert.match(current.elements.classroomAccessNotice.textContent,/다시 열어/);
    assert.equal(open({saved}).elements.uploadCode.value,'');
  }
});

test('blocked storage allows the current invitation and gives a return instruction', () => {
  const blocked={getItem(){throw Error('blocked');},setItem(){throw Error('blocked');},removeItem(){throw Error('blocked');}};
  const {elements}=open({hash:'#class='+code,saved:blocked});
  assert.equal(elements.uploadCode.dataset.common,'true');
  assert.match(elements.classroomAccessNotice.textContent,/다시 접속/);
});

test('ordinary URLs and offline personal makers keep their existing submission mode', () => {
  const plain=open({hash:'#storyboard'});
  assert.equal(plain.elements.uploadCode.value,'');
  assert.equal(plain.elements.uploadCodeFields.hidden,false);
  const offline=open({hash:'#class='+code,protocol:'file:',inputValue:'personal-code'});
  assert.equal(offline.elements.uploadCode.value,'personal-code');
  assert.equal(offline.elements.uploadCode.dataset.common,undefined);
});

test('an invitation opened in an already loaded maker also applies without reloading', () => {
  const loaded=open();loaded.window.location.hash='#class='+code+'&view=storyboard';
  loaded.listeners.hashchange();
  assert.equal(loaded.elements.uploadCode.dataset.common,'true');
  assert.equal(loaded.window.location.hash,'#storyboard');
});
