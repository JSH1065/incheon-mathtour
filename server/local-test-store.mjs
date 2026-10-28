import { mkdir, readFile, writeFile, readdir } from 'node:fs/promises';
import { join } from 'node:path';
import { randomUUID } from 'node:crypto';
import { validateMission, validatePlace, validateId, httpError } from './drive-store.mjs';
// 개발용 로컬 저장. production 및 외부 주소에서는 index.mjs가 이 모드를 금지한다.
export class LocalTestStore {
  constructor(directory) { this.directory = directory; }
  async save(data) { validateMission(data); const dir=join(this.directory,data.placeId);await mkdir(dir,{recursive:true});const record={...data,uploadCode:undefined,updatedAt:new Date().toISOString()};await writeFile(join(dir,data.id+'.json'),JSON.stringify(record));return {ok:true,saved:'로컬 검사 저장'}; }
  async list(placeId) { validatePlace(placeId);let files;try{files=await readdir(join(this.directory,placeId));}catch{files=[];}const rows=await Promise.all(files.filter(x=>x.endsWith('.json')).map(x=>readFile(join(this.directory,placeId,x),'utf8').then(JSON.parse)));return {ok:true,missions:rows.map(({id,name,topic,updatedAt})=>({id,name,topic,updatedAt}))}; }
  async load(placeId,id) { validatePlace(placeId);validateId(id);try{const row=JSON.parse(await readFile(join(this.directory,placeId,id+'.json'),'utf8'));return {ok:true,html:row.html};}catch{throw httpError(404,'not_found');} }
  async saveFeedback(data) { const dir=join(this.directory,'feedback');await mkdir(dir,{recursive:true});await writeFile(join(dir,randomUUID()+'.json'),JSON.stringify(data));return {ok:true}; }
}
