import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, readFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { randomBytes } from 'node:crypto';
import { Vault, createGraph, createAuth } from './auth.mjs';
import vm from 'node:vm';
import { DriveStore, httpError } from './drive-store.mjs';
import { LocalTestStore } from './local-test-store.mjs';
import { createApplication, loadConfig, codeHash } from './index.mjs';

const mission={action:'mission_save',placeId:'K02',id:'TEST01',name:'테스트',topic:'넓이',html:'<!doctype html><p>4 × 3 = 12</p>',uploadCode:'test-code'};
test('Graph query parameters survive URL construction; foreign URLs never receive a token',async()=>{
  let calls=0;
  const graph=createGraph({token:async()=>{calls++;return 'unit-test-token';}},async(url,options)=>{
    assert.equal(url.pathname,'/v1.0/me/drive/items/folder/children');
    assert.equal(url.searchParams.get('$top'),'200');
    assert.equal(options.headers.Authorization,'Bearer unit-test-token');
    return new Response('{"value":[]}',{status:200,headers:{'content-type':'application/json'}});
  });
  assert.deepEqual(await graph('/me/drive/items/folder/children?$top=200'),{value:[]});
  await assert.rejects(graph('https://example.invalid/items'),{code:'invalid_graph_url'});assert.equal(calls,1);
});
test('MSAL cache is encrypted on disk and authenticated against the key',async t=>{
  const dir=await mkdtemp(join(tmpdir(),'mathtour-vault-'));t.after(()=>rm(dir,{recursive:true,force:true}));
  const key=randomBytes(32).toString('base64');const vault=new Vault(dir,key);
  assert.equal(await vault.read('cache.enc'),null);
  await vault.write('cache.enc','unit-test-token');
  assert.equal(await vault.read('cache.enc'),'unit-test-token');
  assert.equal((await readFile(join(dir,'cache.enc'))).includes(Buffer.from('unit-test-token')),false);
  await assert.rejects(new Vault(dir,randomBytes(32).toString('base64')).read('cache.enc'));
});
test('HTML is committed before metadata; failed replacement keeps the previous published mission',async()=>{
  const events=[], metadata=new Map(),html=new Map();let failMetadata=false;
  const store=new DriveStore(async()=>{throw Error('unexpected graph call');});
  store.root=async()=> 'root';store.missionFolder=async p=>'missions-'+p;store.folder=async()=> 'html';
  store.put=async(parent,name,body)=>{
    events.push(parent);
    if(parent==='html'){html.set(name,body);return{id:name};}
    if(failMetadata)throw httpError(503,'test_failure');
    metadata.set(name,JSON.parse(body));return{id:name};
  };
  await store.save(mission);const first=[...metadata.values()][0];
  assert.deepEqual(events,['html','missions-K02']);assert.equal(html.get(first.htmlFileId),mission.html);
  failMetadata=true;await assert.rejects(store.save({...mission,html:'new version'}));
  assert.equal([...metadata.values()][0].htmlFileId,first.htmlFileId);
  failMetadata=false;
  await Promise.all([store.save({...mission,id:'TEST02'}),store.save({...mission,id:'TEST03'})]);
  assert.equal(metadata.size,3);
});
test('same student updates serialize without blocking another student',async()=>{
  const store=new DriveStore(()=>{}),events=[];let release;
  const wait=new Promise(resolve=>{release=resolve;});
  const a=store.exclusive('K02:A',async()=>{events.push('a-start');await wait;events.push('a-end');});
  const b=store.exclusive('K02:A',async()=>{events.push('a-second');});
  await store.exclusive('K02:B',async()=>{events.push('b');});
  assert.deepEqual(events,['a-start','b']);release();await Promise.all([a,b]);assert.deepEqual(events,['a-start','b','a-end','a-second']);
});
test('API authorizes uploads, isolates identities, serves saved HTML and checks OAuth state',async t=>{
  const dir=await mkdtemp(join(tmpdir(),'mathtour-api-'));t.after(()=>rm(dir,{recursive:true,force:true}));
  const config=loadConfig({BASE_URL:'http://127.0.0.1:8787',PAGES_ORIGIN:'https://example.github.io'});
  config.encryptionKey=randomBytes(32).toString('base64');config.adminPassword='test-only-long-admin-password';
  let finished=0;
  const auth={begin:async state=>({url:'https://login.microsoftonline.com/test?state='+state,verifier:'test-verifier'}),finish:async(code,verifier)=>{assert.equal(code,'test-code');assert.equal(verifier,'test-verifier');finished++;}};
  const server=createApplication({config,store:new LocalTestStore(dir),auth,readRoster:async()=>({students:[{id:mission.id,name:mission.name,uploadCodeHash:codeHash('test-code',config.encryptionKey)}]})});
  await new Promise(r=>server.listen(0,'127.0.0.1',r));t.after(()=>new Promise(r=>server.close(r)));
  const base='http://127.0.0.1:'+server.address().port;
  const post=(data,origin='https://example.github.io')=>fetch(base+'/api',{method:'POST',headers:{'content-type':'application/json',origin},body:JSON.stringify(data)});
  assert.equal((await post(mission,'https://evil.invalid')).status,403);
  assert.equal((await post({...mission,uploadCode:'wrong'})).status,403);
  assert.equal((await post({...mission,id:'someone-else'})).status,403);
  assert.equal((await post({...mission,placeId:'../..'})).status,400);
  const saved=await post(mission);assert.equal(saved.status,200);assert.equal((await saved.json()).ok,true);
  const list=await(await fetch(base+'/api?action=mission_list&placeId=K02')).json();
  assert.equal(list.missions.length,1);assert.equal(list.missions[0].topic,'넓이');assert.equal(JSON.stringify(list).includes('uploadCode'),false);
  const loaded=await(await fetch(base+'/api?action=mission_load&placeId=K02&sid=TEST01')).json();assert.equal(loaded.html,mission.html);
  assert.equal((await fetch(base+'/.env')).status,404);
  assert.equal((await fetch(base+'/auth/callback?state=bad&code=x')).status,403);
  const login=await fetch(base+'/admin/connect',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({password:config.adminPassword}),redirect:'manual'});
  assert.equal(login.status,303);const state=new URL(login.headers.get('location')).searchParams.get('state');
  assert.equal((await fetch(base+'/auth/callback?state='+state+'&code=test-code')).status,403);
  const cookie=login.headers.get('set-cookie').split(';')[0];
  assert.equal((await fetch(base+'/auth/callback?state='+state+'&code=test-code',{headers:{cookie}})).status,200);
  assert.equal(finished,1);assert.equal((await fetch(base+'/auth/callback?state='+state+'&code=test-code',{headers:{cookie}})).status,403);
});
test('local mock cannot run as a public production server',()=>{
  assert.throws(()=>loadConfig({MOCK_ONEDRIVE:'1',NODE_ENV:'production'}));
  assert.throws(()=>loadConfig({MOCK_ONEDRIVE:'1',HOST:'0.0.0.0'}));
  assert.throws(()=>loadConfig({BASE_URL:'http://example.com'}));
});
test('installed MSAL generates a personal-account sign-in with PKCE and app-folder scope',async t=>{
  const dir=await mkdtemp(join(tmpdir(),'mathtour-msal-'));t.after(()=>rm(dir,{recursive:true,force:true}));
  const auth=await createAuth({dataDir:dir,encryptionKey:randomBytes(32).toString('base64'),clientId:'00000000-0000-0000-0000-000000000001',clientSecret:'test-only-unused-secret',tenant:'consumers',baseUrl:'http://localhost:8787'});
  const result=await auth.begin('test-state');const url=new URL(result.url);
  assert.equal(url.origin,'https://login.microsoftonline.com');assert.ok(url.pathname.startsWith('/consumers/'));
  assert.equal(url.searchParams.get('state'),'test-state');assert.equal(url.searchParams.get('code_challenge_method'),'S256');
  assert.match(url.searchParams.get('scope'),/Files.ReadWrite.AppFolder/);assert.match(url.searchParams.get('scope'),/offline_access/);
  assert.equal(url.searchParams.get('redirect_uri'),'http://localhost:8787/auth/callback');
  await assert.rejects(auth.token(),{code:'onedrive_not_connected'});
});
test('shared map keeps same-number students from different stores separate and tolerates one outage',async()=>{
  const window={MATHTOUR_CONFIG:{apiUrl:'https://own.invalid/api',sharedSources:[{apiUrl:'https://shared.invalid/exec'}]}};
  let sharedFails=false;const context={window,URL,AbortSignal,location:{href:'https://site.invalid/'},fetch:async url=>{
    assert.equal(url.searchParams.get('placeId'),'K02');
    if(sharedFails&&url.hostname==='shared.invalid')throw Error('offline');
    return {ok:true,json:async()=>({ok:true,missions:[{id:'10101',name:'예시',topic:'넓이'}]})};
  }};
  vm.runInNewContext(await readFile(new URL('../docs/mission-catalog.js',import.meta.url),'utf8'),context);
  const list=await window.loadMissionCatalog('K02');assert.equal(list.missions.length,2);assert.notEqual(list.missions[0].sourceApi,list.missions[1].sourceApi);assert.equal(list.partial,false);
  sharedFails=true;const partial=await window.loadMissionCatalog('K02');assert.equal(partial.missions.length,1);assert.equal(partial.partial,true);
});
test('public pages parse and contain no original upload endpoint or Microsoft credentials',async()=>{
  for(const filename of ['make.html','index.html','example_game.html']){
    const html=await readFile(new URL('../docs/'+filename,import.meta.url),'utf8');
    for(const match of html.matchAll(/<script(?:\s[^>]*)?>([\s\S]*?)<\/script>/gi))if(match[1].trim())new vm.Script(match[1],{filename});
    assert.equal(html.includes('script.google.com'),false);assert.equal(html.includes('MS_CLIENT_SECRET'),false);
    if(filename!=='example_game.html')assert.match(html,/sandbox="allow-scripts allow-forms"/);
  }
});
test('school-folder storage saves, lists and loads using the shared drive, including remote items',async()=>{
  const calls=[];const folders=new Map();const files=new Map();const byId=new Map();let serial=0;
  const sharingUrl='https://school-my.sharepoint.com/:f:/g/test-share';
  const graph=async(path,options={})=>{
    calls.push(path);
    if(path.startsWith('/shares/')){
      assert.equal(path,'/shares/u!'+Buffer.from(sharingUrl).toString('base64url')+'/driveItem');
      return {id:'shortcut',remoteItem:{id:'target-folder',name:'수업 폴더',folder:{},parentReference:{driveId:'school-drive'}}};
    }
    assert.ok(path.startsWith('/drives/school-drive/items/'),'must stay on configured school drive');
    const key=path.slice('/drives/school-drive/items/'.length);
    if(options.method==='POST'){
      const parent=key.replace('/children','');const folder={id:'folder-'+(++serial),name:options.json.name,folder:{}};
      folders.set(parent+':/'+folder.name,folder);return folder;
    }
    if(options.method==='PUT'){
      const match=key.match(/^([^:]+):\/(.+):\/content$/);assert.ok(match);
      const item={id:'file-'+(++serial),name:match[2],file:{},parent:match[1],body:options.body};
      files.set(match[1]+':/'+match[2],item);byId.set(item.id,item);return {id:item.id,name:item.name};
    }
    if(key.includes('/children?'))return {value:[...files.values()].filter(item=>item.parent===key.split('/children?')[0]).map(({id,name,file})=>({id,name,file}))};
    if(key.endsWith('/content')){
      const lookup=key.slice(0,-'/content'.length).replace(/:$/,'');const item=files.get(lookup)||byId.get(lookup);
      assert.ok(item,'saved item should exist');return options.response==='text'?item.body:JSON.parse(item.body);
    }
    if(folders.has(key))return folders.get(key);throw httpError(404,'not_found');
  };
  const store=new DriveStore(graph,{storageMode:'shared-folder',readTarget:async()=>({sharingUrl,expectedName:'수업 폴더'})});
  await store.save(mission);assert.equal((await store.list('K02')).missions[0].id,mission.id);
  assert.equal((await store.load('K02',mission.id)).html,mission.html);
  assert.equal(calls.filter(path=>path.startsWith('/shares/')).length,1);
  assert.equal(calls.some(path=>path.startsWith('/me/drive')),false);
  store.resetTarget();assert.equal(store.folders.size,0);await store.root();
  assert.equal(calls.filter(path=>path.startsWith('/shares/')).length,2);
});
test('missing, expired or wrong folder never falls back to another storage location',async()=>{
  let calls=0;const missing=new DriveStore(async()=>{calls++;},{storageMode:'shared-folder'});
  await assert.rejects(missing.root(),{code:'target_folder_not_configured'});assert.equal(calls,0);
  const invalid=new DriveStore(async()=>{calls++;},{storageMode:'shared-folder',readTarget:async()=>({sharingUrl:'https://example.invalid/folder'})});
  await assert.rejects(invalid.root(),{code:'invalid_target_folder'});assert.equal(calls,0);
  const changed=new DriveStore(async path=>{assert.ok(path.startsWith('/shares/'));return {id:'folder',name:'other',folder:{},parentReference:{driveId:'drive'}};},{storageMode:'shared-folder',readTarget:async()=>({sharingUrl:'https://school-my.sharepoint.com/folder',expectedName:'original'})});
  await assert.rejects(changed.save(mission),{code:'target_folder_changed'});assert.equal(changed.rootId,undefined);
  const expired=new DriveStore(async()=>{throw httpError(403,'onedrive_request_failed');},{storageMode:'shared-folder',readTarget:async()=>({sharingUrl:'https://school-my.sharepoint.com/folder'})});
  await assert.rejects(expired.save(mission),{status:403});assert.equal(expired.rootId,undefined);
});
test('school authentication uses organizational authority and existing-folder scope',async t=>{
  const dir=await mkdtemp(join(tmpdir(),'mathtour-school-'));t.after(()=>rm(dir,{recursive:true,force:true}));
  const config=loadConfig({STORAGE_MODE:'shared-folder',DATA_DIR:dir});assert.equal(config.tenant,'organizations');assert.equal(config.targetConfigFile,join(dir,'onedrive-target.json'));
  const auth=await createAuth({...config,encryptionKey:randomBytes(32).toString('base64'),clientId:'00000000-0000-0000-0000-000000000001',clientSecret:'test-only-unused-secret'});
  const url=new URL((await auth.begin('school-state')).url);assert.ok(url.pathname.startsWith('/organizations/'));
  const scopes=url.searchParams.get('scope').split(' ');assert.ok(scopes.includes('https://graph.microsoft.com/Files.ReadWrite'));assert.equal(scopes.some(scope=>scope.endsWith('AppFolder')),false);
  assert.throws(()=>loadConfig({STORAGE_MODE:'typo'}));
});
