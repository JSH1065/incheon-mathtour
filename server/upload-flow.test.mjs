import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import vm from 'node:vm';

const source=await readFile(new URL('../docs/make.html',import.meta.url),'utf8');
const upload=source.slice(source.indexOf('  async function doUpload(){'),source.indexOf('/* 스토리보드 실행 문서'));
async function submit({codeFreeMaker=true, uploadCode='', common=false, provider='github'}={}) {
  const controls={placeId:{value:'K02'},topic:{value:'삼각형'},school:{value:'예시중'},sname:{value:'학생'},uploadCode:{value:uploadCode,dataset:common?{common:'true'}:{}},upMsg:{},upBtn:{disabled:false,classList:{add(){},remove(){}}}};
  const posts=[];
  const key='a'.repeat(48);
  const context={document:{getElementById:id=>controls[id]},window:{MATHTOUR_CONFIG:{storageProvider:provider},MathTourSubmission:{commonSubmissionKey:()=>key},prepareProjectUpload:()=>({errors:[],project:{test:true},html:'<p>game</p>'})},SCRIPT_URL:'https://upload.example/api',location:{href:'file:///student-maker.html'},previewReviewed:true,lastFullHtml:'',URL,Blob,AbortSignal,
    fetch:async(url,options)=>{
      if(options.method==='POST'){posts.push(JSON.parse(options.body));return{ok:true,json:async()=>({ok:true,provider:'github'})};}
      return{ok:true,json:async()=>({ok:true,commonMaker:true,sixSceneMaker:true,codeFreeMaker})};
    }};
  vm.runInNewContext(upload,context);
  await context.doUpload();
  return{controls,posts,key};
}
test('downloaded maker sends an automatic author key without asking for an upload code',async()=>{
  const {posts,key,controls}=await submit();
  assert.equal(posts.length,1);
  assert.equal(posts[0].uploadCode,'');
  assert.equal(posts[0].submissionKey,key);
  assert.match(controls.upMsg.textContent,/저장 완료/);
});
test('an old server cannot receive a code-free upload; the user can retry after deployment',async()=>{
  const {posts,controls}=await submit({codeFreeMaker:false});
  assert.equal(posts.length,0);
  assert.equal(controls.upBtn.disabled,false);
  assert.match(controls.upMsg.textContent,/아직 제출되지/);
});
test('existing common makers remain compatible with a server that requires a class code',async()=>{
  const {posts,key}=await submit({codeFreeMaker:false,uploadCode:'existing-code',common:true});
  assert.equal(posts.length,1);assert.equal(posts[0].uploadCode,'existing-code');assert.equal(posts[0].submissionKey,key);
});
test('OneDrive continues to require its existing submission code',async()=>{
  const {posts,controls}=await submit({provider:'onedrive'});
  assert.equal(posts.length,0);assert.match(controls.upMsg.textContent,/제출코드/);
});
