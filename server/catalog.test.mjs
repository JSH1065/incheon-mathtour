import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import {readFile} from 'node:fs/promises';
const source=await readFile(new URL('../docs/mission-catalog.js',import.meta.url),'utf8');
const example={placeId:'K02',id:'EXAMPLE-K02',name:'수업 예시',url:'./examples/manisan/mission.html'};
function setup(config,fetch){
  const window={MATHTOUR_CONFIG:config};
  vm.runInNewContext(source,{window,fetch,URL,AbortSignal,location:{href:'https://school.example/mathtour/index.html',origin:'https://school.example'}});
  return window;
}
test('published example works without a student backend and is restricted to its place',async()=>{
  const site=setup({exampleMissions:[example]},()=>{throw new Error('No backend request expected');});
  const result=await site.loadMissionCatalog('K02');
  assert.equal(result.missions.length,1);assert.equal(result.missions[0].exampleUrl,example.url);assert.equal(result.unconfigured,true);
  assert.equal((await site.loadMissionCatalog('K01')).missions.length,0);
});
test('student sources merge with the example and cannot substitute a bundled URL',async()=>{
  const site=setup({apiUrl:'/api',exampleMissions:[example]},async()=>({ok:true,json:async()=>({ok:true,missions:[{id:'student',exampleUrl:'./evil.html'}]})}));
  const result=await site.loadMissionCatalog('K02');
  assert.equal(result.missions.length,2);assert.equal(result.missions[1].sourceApi,'/api');assert.equal(result.missions[1].exampleUrl,undefined);assert.equal(result.partial,false);
});
test('example stays available if student backend fails without hiding that failure',async()=>{
  const site=setup({apiUrl:'/api',exampleMissions:[example]},async()=>{throw new Error('offline');});
  const result=await site.loadMissionCatalog('K02');
  assert.equal(result.missions.length,1);assert.equal(result.partial,true);
  await assert.rejects(site.loadMissionCatalog('K01'),/mission_list_failed/);
});
test('example loader only reads the configured same-origin file',async()=>{
  const requests=[];
  const site=setup({exampleMissions:[example]},async url=>{requests.push(url);return {ok:true,text:async()=>'<html>example</html>'};});
  assert.equal((await site.loadExampleMission('K02','EXAMPLE-K02',example.url)).html,'<html>example</html>');
  await assert.rejects(site.loadExampleMission('K01','EXAMPLE-K02',example.url),/invalid_example/);
  await assert.rejects(site.loadExampleMission('K02','EXAMPLE-K02','https://other.example/file.html'),/invalid_example/);
  assert.deepEqual(requests,['https://school.example/mathtour/examples/manisan/mission.html']);
});
