import { randomBytes } from 'node:crypto';
import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { resolve, join } from 'node:path';
import { codeHash } from '../server/index.mjs';
import { validateId } from '../server/drive-store.mjs';
const source = process.argv[2];
if (!source) throw new Error('Usage: npm run roster -- students.json');
const key=process.env.CACHE_ENCRYPTION_KEY;
if (Buffer.from(key||'','base64').length!==32) throw new Error('Create and keep the server .env first.');
const students=JSON.parse(await readFile(resolve(source),'utf8'));
if(!Array.isArray(students)||!students.length)throw new Error('Expected a nonempty array of {id,name}.');
const seen=new Set();const list=[];const handout=[];
for(const student of students){validateId(student.id);if(seen.has(student.id))throw new Error('Duplicate student ID');seen.add(student.id);if(typeof student.name!=='string'||!student.name.trim()||student.name.length>80||/[\r\n\t]/.test(student.name))throw new Error('Invalid student name');const code=randomBytes(12).toString('hex');list.push({id:student.id,name:student.name.trim(),uploadCodeHash:codeHash(code,key)});handout.push(student.id+'\t'+student.name.trim()+'\t'+code);}
const dir=resolve(process.env.DATA_DIR||'.private');await mkdir(dir,{recursive:true,mode:0o700});
await writeFile(join(dir,'roster.json'),JSON.stringify({students:list},null,2),{flag:'wx',mode:0o600});
await writeFile(join(dir,'student-codes.txt'),handout.join('\n'),{flag:'wx',mode:0o600});
console.log('Created private roster and individual submission codes in DATA_DIR. No codes printed.');
