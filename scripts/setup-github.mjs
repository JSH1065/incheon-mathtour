import { mkdir, writeFile } from 'node:fs/promises';
import { randomBytes } from 'node:crypto';
import { codeHash } from '../server/index.mjs';
const dir = new URL('../.private/github-upload/', import.meta.url);
await mkdir(dir, { recursive: true });
const key = randomBytes(32).toString('base64');
const students = [], handout = ['번호\t개인 제출코드\t학교\t이름'];
for (let i = 1; i <= 20; i++) {
  const id = 'S' + String(i).padStart(2, '0'), code = randomBytes(12).toString('hex');
  students.push({ id, uploadCodeHash: codeHash(code, key) }); handout.push(id + '\t' + code + '\t\t');
}
await writeFile(new URL('server.env', dir), 'STORAGE_PROVIDER=github\nGITHUB_REPOSITORY=JSH1065/incheon-mathtour\nGITHUB_BRANCH=main\nPAGES_ORIGIN=https://jsh1065.github.io\nCACHE_ENCRYPTION_KEY=' + key + '\nROSTER_JSON=' + JSON.stringify({ students }) + '\n', { flag: 'wx', mode: 0o600 });
await writeFile(new URL('학생별-제출코드.tsv', dir), '\ufeff' + handout.join('\n'), { flag: 'wx', mode: 0o600 });
console.log('Created private server configuration and 20 student codes under .private/github-upload/. No secrets printed.');
