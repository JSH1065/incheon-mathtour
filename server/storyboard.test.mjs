import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import vm from 'node:vm';
const context=vm.createContext({});
for(const file of ['project-core.js','storyboard-core.js'])vm.runInContext(await readFile(new URL('../docs/'+file,import.meta.url),'utf8'),context);
const core=context.MathTourStoryboard, project=context.MathTourProject;
test('six-scene importer fixes titles and connects only the fourth scene',()=>{
  const scenes=project.sixScenes(Array.from({length:6},(_,i)=>({title:'arbitrary',boyText:'대사 '+i})));
  assert.equal(scenes.length,6);assert.equal(scenes[0].title,'관광지 소개 1');assert.equal(scenes[1].title,'관광지 소개 2');
  assert.equal(scenes[3].title,'문제(게임)');assert.equal(scenes[5].title,'배운 내용 정리');
  assert.equal(scenes.filter(s=>s.gameNumber).length,1);assert.equal(scenes[3].gameNumber,1);
  assert.equal(scenes[4].boyText,'대사 4');assert.equal(scenes[3].isProblem,true);
  for(const length of [0,4,5,7])assert.throws(()=>project.sixScenes(Array.from({length},()=>({}))));
  assert.throws(()=>project.sixScenes(scenes.map((s,i)=>({...s,gameNumber:i===2?1:null}))));
  assert.equal(project.parseGameName('K02_구월중예시_게임.html').number,1);
  assert.equal(project.singleGameName('K02'),'K02_게임.html');
  assert.equal(project.parseGameName('K02-G2.html').number,2);
});
test('worksheet focuses on six scene contents, expressions and dialogue without game numbering',()=>{
  const board=core.template({placeId:'K02',school:'구월중',name:'예시'});
  board.scenes[3].boyFace='aha';board.scenes[3].boyText='수정한 대사';
  board.scenes[3].gameControls='답 입력';board.scenes[3].gameAnswer='10';
  const text=core.toText(board), html=core.toHtml(board);
  assert.equal(board.scenes.length,6);assert.equal(core.rows(board).filter(s=>s.game).length,1);
  assert.match(text,/남학생 표정: 깨달음\n남학생 대사: 수정한 대사/);
  assert.match(text,/조작 방법: 답 입력/);assert.match(text,/정답과 성공 조건: 10/);
  assert.match(text,/정답 확인 및 해설/);assert.match(text,/배운 내용 정리/);
  assert.doesNotMatch(text,/\bG[12]\b|게임 번호|연결 게임 파일/);
  assert.match(html,/<table>/);assert.match(html,/남학생 표정 · 대사/);
});
test('readable HTML exports escape student text without running games',()=>{
  const hostile='<script>alert(1)</script><img src=x onerror=alert(2)>';
  const board=core.template({placeId:'K02',topic:hostile,name:'A & B'});
  board.scenes[3].gameAnswer=hostile;
  const html=core.toHtml(board);
  assert.doesNotMatch(html,/<script|<img|<iframe/i);assert.match(html,/&lt;script&gt;/);assert.match(html,/A &amp; B/);
});
