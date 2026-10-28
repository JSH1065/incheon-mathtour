import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import vm from 'node:vm';
const context = vm.createContext({});
vm.runInContext(await readFile(new URL('../docs/storyboard-core.js', import.meta.url), 'utf8'), context);
const core = context.MathTourStoryboard;

test('storyboard keeps actual game numbers, edited dialogue and submission filenames together', () => {
  const board = { placeId:'K02', school:'구월중', name:'예시', submissionPrefix:'K02_구월중예시', scenes:[
    { title:'관광지 소개', gameNumber:null, screenText:'사진과 관광지 소개', boyFace:'lookmap' },
    { title:'두 문제를 푸는 게임', gameNumber:7, boyText:'수정한 대사', boyFace:'aha', hint:'제곱근을 구해요.' },
    { title:'배운 수학 정리', gameNumber:null }
  ] };
  const rows = core.rows(board), text = core.toText(board);
  assert.equal(rows[1].game, '게임 7');
  assert.equal(rows[1].file, 'K02-G7.html');
  assert.equal(rows[1].submissionFile, 'K02_구월중예시_G7.html');
  assert.equal(rows[0].game, '해당 없음');
  assert.match(text, /깨달음 \(aha\)\n수정한 대사/);
  assert.match(text, /게임 번호: 게임 7/);
  assert.doesNotMatch(text, /게임 번호: 게임 2/);
  board.scenes[1].gameNumber = null;
  assert.equal(core.rows(board)[1].file, '—');
});

test('planning template includes introduction, two numbered games and math reflection without assets', () => {
  const board = core.template({ placeId:'N03', placeName:'센트럴파크' });
  assert.equal(board.scenes[0].title, '관광지 소개');
  assert.equal(board.scenes.at(-1).title, '배운 수학 정리');
  assert.equal(core.rows(board)[2].file, 'N03-G1.html');
  assert.equal(core.rows(board)[3].file, 'N03-G2.html');
  assert.match(core.toText(board), /학교: \[학교\]/);
  assert.match(core.toText(board), /IMG1/);
  assert.match(core.toText(board), /missionClear\(\)/);
});

test('readable HTML exports escape student text and contain no executable code or embedded game files', () => {
  const hostile = '<script>alert(1)</script><img src=x onerror=alert(2)>';
  const html = core.toHtml({ placeId:'K02', topic:hostile, name:'A & B', scenes:[{ title:hostile, boyText:hostile, screenText:hostile }] });
  assert.doesNotMatch(html, /<script|<img|<iframe/i);
  assert.match(html, /&lt;script&gt;/);
  assert.match(html, /A &amp; B/);
});
