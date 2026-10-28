import { randomBytes, createHash } from 'node:crypto';
import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { resolve, join } from 'node:path';
import { codeHash } from '../server/index.mjs';
import { validateId } from '../server/drive-store.mjs';
const source = process.argv[2];
if (!source) throw new Error('Usage: npm run roster -- students.json');
const key=process.env.CACHE_ENCRYPTION_KEY;
if (Buffer.from(key||'','base64').length!==32) throw new Error('Create and keep the server .env first.');
const students=JSON.parse(await readFile(resolve(source),'utf8'));
if(!Array.isArray(students)||!students.length)throw new Error('Expected a nonempty array of {school,name} or legacy {id,name}.');
const seen=new Set();const list=[];const handout=[];
for (const student of students) {
  if (typeof student.name !== 'string' || !student.name.trim() || student.name.length > 80 || /[\r\n\t]/.test(student.name)) throw new Error('Invalid student name');
  const name = student.name.normalize('NFC').trim();
  const school = student.school === undefined ? undefined : String(student.school).normalize('NFC').trim();
  if (school !== undefined && (!school || school.length > 40 || /[\r\n\t]/.test(school))) throw new Error('Invalid school');
  const id = student.id || (school && 'S-' + createHash('sha256').update(JSON.stringify([school, name])).digest('hex').slice(0, 32));
  validateId(id);
  if (seen.has(id)) throw new Error('Duplicate student identity; distinguish same-school students with the same name.');
  seen.add(id);
  const code = randomBytes(12).toString('hex');
  list.push({ id, school, name, uploadCodeHash: codeHash(code, key) });
  handout.push((school || id) + '\t' + name + '\t' + code);
}
const dir=resolve(process.env.DATA_DIR||'.private');await mkdir(dir,{recursive:true,mode:0o700});
await writeFile(join(dir,'roster.json'),JSON.stringify({students:list},null,2),{flag:'wx',mode:0o600});
await writeFile(join(dir,'student-codes.txt'),handout.join('\n'),{flag:'wx',mode:0o600});
console.log('Created private roster and individual submission codes in DATA_DIR. No codes printed.');
