import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile, mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { randomBytes } from 'node:crypto';
import vm from 'node:vm';
import { createApplication, loadConfig, codeHash } from './index.mjs';
import { LocalTestStore } from './local-test-store.mjs';

test('individual files retain contents, school/name, game numbers and picture credits', async () => {
  const context = {};
  vm.runInNewContext(await readFile(new URL('../docs/submission-files.js', import.meta.url), 'utf8'), context);
  vm.runInNewContext(await readFile(new URL('../docs/project-core.js', import.meta.url), 'utf8'), context);
  const core = context.MathTourSubmission;
  assert.equal(core.prefix('K02', '구월중', '정승헌'), 'K02_구월중정승헌');
  assert.throws(() => core.prefix('K02', '../school', 'name'));
  assert.throws(() => core.prefix('K02', '', 'name'));
  const project = { program: { html: '<section>introduction</section>' }, games: [{ number: 2, html: '<script>missionClear()</script>' }], storyboard: [{ title: 'Game', gameNumber: 2 }], pictures: [{ number: 1, data: 'data:image/jpeg;base64,YQ==', source: 'AI illustration' }] };
  const files = core.buildFiles({ placeId: 'K02', school: '구월중', name: '정승헌', topic: '삼각형', project, html: '<p>playable tour</p>', submissionId: 'test-export' });
  assert.equal(files.length, 5);
  assert.equal(files[0].name, 'K02_구월중정승헌_본문.html');
  assert.equal(files[1].name, 'K02_구월중정승헌_G2.html');
  assert.equal(files[1].content, project.games[0].html);
  assert.equal(context.MathTourProject.parseGameName(files[1].name).number, 2);
  assert.equal(context.MathTourProject.parseGameName('K02-G1.html').number, 1);
  const manifest = JSON.parse(files.find(file => file.role === 'storyboard').content);
  assert.equal(manifest.school, '구월중'); assert.equal(manifest.name, '정승헌');
  assert.equal(manifest.games[0].name, files[1].name);
  assert.equal(manifest.pictures[0].source, 'AI illustration');
  assert.equal(manifest.mission, files.find(file => file.role === 'mission').name);
  assert.equal(files.find(file => file.role === 'mission').content, '<p>playable tour</p>');
});

test('school submissions resolve a roster ID only with the matching school, name and code', async t => {
  const dir = await mkdtemp(join(tmpdir(), 'mathtour-school-')); t.after(() => rm(dir, { recursive: true, force: true }));
  const config = loadConfig({ BASE_URL: 'http://127.0.0.1:8787' }); config.encryptionKey = randomBytes(32).toString('base64');
  const students = [
    { id: 'A', school: '학교가', name: '테스트', uploadCodeHash: codeHash('code-a', config.encryptionKey) },
    { id: 'B', school: '학교나', name: '테스트', uploadCodeHash: codeHash('code-b', config.encryptionKey) }
  ];
  const server = createApplication({ config, store: new LocalTestStore(dir), readRoster: async () => ({ students }) });
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve)); t.after(() => new Promise(resolve => server.close(resolve)));
  const base = 'http://127.0.0.1:' + server.address().port;
  const save = data => fetch(base + '/api', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ action: 'mission_save', school: '학교가', name: '테스트', placeId: 'K02', topic: '넓이', html: '<p>tour</p>', uploadCode: 'code-a', ...data }) });
  assert.equal((await save({ school: '학교나' })).status, 403);
  assert.equal((await save({ uploadCode: 'wrong' })).status, 403);
  assert.equal((await save({ id: 'B' })).status, 200);
  assert.equal((await save({ school: '학교나', uploadCode: 'code-b', html: '<p>other tour</p>' })).status, 200);
  const a = JSON.parse(await readFile(join(dir, 'K02', 'A.json'), 'utf8'));
  const b = JSON.parse(await readFile(join(dir, 'K02', 'B.json'), 'utf8'));
  assert.equal(a.school, '학교가'); assert.equal(b.school, '학교나'); assert.notEqual(a.html, b.html);
});
