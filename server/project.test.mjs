import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile, mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import vm from 'node:vm';
import { randomBytes } from 'node:crypto';
import { DriveStore, validateMission, httpError } from './drive-store.mjs';
import { LocalTestStore } from './local-test-store.mjs';
import { createApplication, loadConfig, codeHash } from './index.mjs';
const project = () => ({ schemaVersion:1, program:{name:'K02.html',html:'<section class="scene" data-game="1"></section>'}, games:[{number:1,name:'K02-G1.html',html:'<button>게임 1</button>'},{number:2,name:'K02-G2.html',html:'<button>게임 2</button>'}], storyboard:[{title:'첫 게임',gameNumber:1},{title:'둘째 게임',gameNumber:2}], pictures:[] });
const mission = () => ({placeId:'K02',id:'TEST01',name:'테스트',topic:'넓이',html:'<!doctype html><p>실행용 완성본</p>',project:project()});

test('bundle validation rejects missing references, duplicate numbers, unsafe paths and other places', () => {
  assert.doesNotThrow(() => validateMission(mission()));
  for (const mutate of [
    p => p.games.pop(), p => p.games.push({...p.games[0]}),
    p => {p.program.name='../K02.html';}, p => {p.program.name='K02-G1.html';},
    p => {p.games[0].name='N01-G1.html';}, p => {p.games[0].number=0;},
    p => {p.games[0].html='';}, p => {p.storyboard[0].gameNumber=99;}
  ]) { const data=mission(); mutate(data.project); assert.throws(() => validateMission(data),{code:'invalid_project'}); }
});

test('all original files precede publication; partial bundle failure keeps previous record and students isolated', async () => {
  const store=new DriveStore(()=>{}), writes=[], records=new Map();let failGame=false;
  store.root=async()=> 'root'; store.missionFolder=async p=>'missions/'+p;
  store.folder=async(parent,name)=>parent+'/'+name;
  store.put=async(parent,name,body)=>{
    writes.push({parent,name,body});
    if(failGame&&name==='K02-G2.html') throw httpError(503,'test_failure');
    if(parent.startsWith('missions/')) records.set(name,JSON.parse(body));
    return {id:parent+'/'+name};
  };
  await store.save(mission());
  const old=JSON.stringify([...records.values()]);
  const record=[...records.values()][0];
  assert.deepEqual(writes.slice(0,4).map(x=>x.name),['K02.html','K02-G1.html','K02-G2.html','storyboard.json']);
  assert.equal(writes.at(-1).parent,'missions/K02');
  assert.ok(record.projectFolderId);
  failGame=true; await assert.rejects(store.save(mission()),{code:'test_failure'});
  assert.equal(JSON.stringify([...records.values()]),old);
  failGame=false;await store.save({...mission(),id:'TEST02'});
  const rows=[...records.values()]; assert.equal(rows.length,2);assert.notEqual(rows[0].projectFolderId,rows[1].projectFolderId);
});

test('API accepts a complete multi-file submission, stores originals and serves the compiled mission unchanged', async t => {
  const dir=await mkdtemp(join(tmpdir(),'mathtour-project-'));t.after(()=>rm(dir,{recursive:true,force:true}));
  const config=loadConfig({BASE_URL:'http://127.0.0.1:8787'});config.encryptionKey=randomBytes(32).toString('base64');
  const server=createApplication({config,store:new LocalTestStore(dir),readRoster:async()=>({students:[{id:'TEST01',name:'테스트',uploadCodeHash:codeHash('bundle-code',config.encryptionKey)}]})});
  await new Promise(r=>server.listen(0,'127.0.0.1',r));t.after(()=>new Promise(r=>server.close(r)));
  const base='http://127.0.0.1:'+server.address().port;
  const response=await fetch(base+'/api',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({...mission(),action:'mission_save',uploadCode:'bundle-code'})});
  assert.equal(response.status,200);
  const saved=JSON.parse(await readFile(join(dir,'K02','TEST01.json'),'utf8'));
  assert.deepEqual(saved.project,project());assert.equal(saved.uploadCode,undefined);
  const loaded=await(await fetch(base+'/api?action=mission_load&placeId=K02&sid=TEST01')).json();assert.equal(loaded.html,mission().html);
});

test('numbered filenames are canonical and generated runtime is valid JavaScript', async () => {
  const context={};vm.runInNewContext(await readFile(new URL('../docs/project-core.js',import.meta.url),'utf8'),context);
  const core=context.MathTourProject;
  assert.equal(core.gameName('K02','01'),'K02-G1.html');
  assert.equal(core.parseGameName('K02-G02.html').number,2);
  assert.equal(core.parseGameName('K02.html'),null);
  assert.throws(()=>core.gameNumber('1.5'));assert.throws(()=>core.gameNumber('0'));
  const html=core.tourDocument([{title:'끝 </script>',game:1,html:'<script>window.missionClear()</script>',channel:'test'}]);
  const scripts=[...html.matchAll(/<script>([\s\S]*?)<\/script>/gi)];
  assert.equal(scripts.length,1);new vm.Script(scripts[0][1]);
  new vm.Script(await readFile(new URL('../docs/project-maker.js',import.meta.url),'utf8'));
});

test('story runtime requires every game, rejects foreign completion and preserves progress when going back', async () => {
  class Element {
    constructor(){this.hidden=false;this.disabled=false;this.events={};this.contentWindow={};this.children=[];}
    addEventListener(name,fn){this.events[name]=fn;}
    appendChild(child){this.children.push(child);}
    setAttribute(){}
    click(){this.events.click?.();}
  }
  const screens=[new Element(),new Element(),new Element()];
  const ids=Object.fromEntries(['tourPrevious','tourNext','tourFinish','tourStatus','tourTitle'].map(id=>[id,new Element()]));
  let listener,completed=0;
  const context={document:{querySelectorAll:()=>screens,getElementById:id=>ids[id],createElement:()=>new Element()},window:{addEventListener:(_,fn)=>{listener=fn;},missionClear:()=>completed++}};
  vm.runInNewContext(await readFile(new URL('../docs/project-core.js',import.meta.url),'utf8'),context);
  context.window.MathTourProject.tourRuntime([{title:'one',game:1,channel:'one',html:''},{title:'two',game:2,channel:'two',html:''},{title:'end',game:null,html:''}]);
  const message=(index,channel,source=screens[index].children[0].contentWindow)=>listener({source,data:{type:'MT_GAME_ASSET',channel,event:'complete'}});
  assert.equal(ids.tourNext.disabled,true);ids.tourNext.click();assert.equal(screens[1].children.length,0);
  message(0,'one',{});assert.equal(ids.tourNext.disabled,true);
  message(0,'wrong');assert.equal(ids.tourNext.disabled,true);
  message(0,'one');ids.tourNext.click();assert.equal(ids.tourNext.disabled,true);assert.equal(completed,0);
  ids.tourPrevious.click();assert.equal(ids.tourNext.disabled,false);ids.tourNext.click();
  message(0,'one');assert.equal(ids.tourNext.disabled,true);
  message(1,'two');ids.tourNext.click();assert.equal(ids.tourFinish.disabled,false);assert.equal(completed,0);
  ids.tourFinish.click();ids.tourFinish.click();assert.equal(completed,1);
});
