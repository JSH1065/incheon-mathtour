import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { randomBytes, webcrypto } from 'node:crypto';
import vm from 'node:vm';
import { GitHubStore } from './github-store.mjs';
import { createApplication, loadConfig, codeHash } from './index.mjs';

function fakeGitHub() {
  const trees = new Map([['t0', {}]]), commits = new Map([['h0', { tree: { sha: 't0' } }]]), blobs = new Map();
  let head = 'h0', sequence = 0, conflict = false, failTree = false;
  const json = (value, status = 200) => new Response(JSON.stringify(value), { status });
  const fetch = async (url, options) => {
    const u = new URL(url), path = decodeURIComponent(u.pathname).replace('/repos/test/math', ''), body = options.body && JSON.parse(options.body);
    assert.equal(options.headers.Authorization, 'Bearer test-token');
    if (path.startsWith('/git/ref/')) return json({ object: { sha: head } });
    if (path.startsWith('/git/commits/')) return json(commits.get(path.split('/').pop()));
    if (path.startsWith('/contents/')) {
      const tree = trees.get(commits.get(u.searchParams.get('ref') || head).tree.sha), value = tree[path.slice('/contents/'.length)];
      return value === undefined ? json({}, 404) : json({ content: Buffer.from(value).toString('base64') });
    }
    const sha = 'x' + (++sequence);
    if (path === '/git/blobs') { blobs.set(sha, Buffer.from(body.content, 'base64')); return json({ sha }); }
    if (path === '/git/trees') {
      if (failTree) return json({}, 500);
      const tree = { ...trees.get(body.base_tree) }; body.tree.forEach(entry => { tree[entry.path] = entry.content ?? blobs.get(entry.sha); }); trees.set(sha, tree); return json({ sha });
    }
    if (path === '/git/commits') { commits.set(sha, { tree: { sha: body.tree }, parents: body.parents }); return json({ sha }); }
    if (path.startsWith('/git/refs/')) {
      assert.equal(body.force, false);
      if (conflict) {
        conflict = false; const tree = { ...trees.get(commits.get(head).tree.sha), 'teacher-note.txt': 'keep teacher edit' };
        trees.set('teacher-tree', tree); commits.set('teacher-head', { tree: { sha: 'teacher-tree' }, parents: [head] }); head = 'teacher-head'; return json({}, 422);
      }
      if (commits.get(body.sha).parents[0] !== head) return json({}, 422);
      head = body.sha; return json({ object: { sha: head } });
    }
    throw new Error('Unexpected API route: ' + path);
  };
  return { fetch, files: () => trees.get(commits.get(head).tree.sha), conflict: () => { conflict = true; }, fail: () => { failTree = true; } };
}
const mission = id => ({ id, school: '예시중', name: '학생' + id, placeId: 'K02', topic: '삼각형', html: '<p>snapshot</p>', project: { schemaVersion: 1, program: { name: 'K02.html', html: '<section class="scene" data-game="1"></section>' }, games: [{ number: 1, name: 'K02-G1.html', html: '<script>missionClear()</script>' }], storyboard: [{ title: 'game', gameNumber: 1 }], pictures: [{ number: 1, data: 'data:image/jpeg;base64,YQ==', source: 'test' }] } });

test('20 simultaneous GitHub submissions keep every author and their original files', async () => {
  const api = fakeGitHub(), store = new GitHubStore({ token: 'test-token', repository: 'test/math', fetchImpl: api.fetch, mutationDelay: 0 });
  await Promise.all(Array.from({ length: 20 }, (_, i) => store.save(mission('S' + i))));
  const files = api.files(), catalog = JSON.parse(files['docs/submissions/catalog.json']);
  assert.equal(catalog.missions.length, 20); assert.equal(new Set(catalog.missions.map(row => row.id)).size, 20);
  for (const row of catalog.missions) {
    const path = 'docs/' + decodeURIComponent(row.manifest.slice(2));
    const manifest = JSON.parse(files[path]); assert.equal(manifest.studentId, row.id); assert.equal(manifest.mission, undefined);
    const folder = path.slice(0, path.lastIndexOf('/') + 1);
    assert.equal(files[folder + manifest.games[0].name], mission(row.id).project.games[0].html);
    assert.equal(manifest.playback, 'source-files'); assert.equal(JSON.stringify(manifest).includes('test-token'), false);
  }
});
test('GitHub commit conflict retains teacher edits and partial failure publishes nothing', async () => {
  const api = fakeGitHub(), store = new GitHubStore({ token: 'test-token', repository: 'test/math', fetchImpl: api.fetch, mutationDelay: 0 });
  api.conflict(); await store.save(mission('S01')); assert.equal(api.files()['teacher-note.txt'], 'keep teacher edit');
  const before = api.files(); api.fail(); await assert.rejects(store.save(mission('S02'))); assert.equal(api.files(), before);
});
test('GitHub API uses a private submission code instead of a client-selected student folder', async t => {
  const config = loadConfig({ BASE_URL: 'http://localhost', STORAGE_PROVIDER: 'github' }); config.encryptionKey = randomBytes(32).toString('base64');
  const saved = [], store = { save: async data => { saved.push(data); return { ok: true }; } };
  const server = createApplication({ config, store, readRoster: async () => ({ students: [{ id: 'S01', uploadCodeHash: codeHash('private-code', config.encryptionKey) }] }) });
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve)); t.after(() => new Promise(resolve => server.close(resolve)));
  const post = code => fetch('http://127.0.0.1:' + server.address().port + '/api', { method: 'POST', headers: { 'content-type': 'application/json', origin: 'null' }, body: JSON.stringify({ ...mission('ATTACK'), action: 'mission_save', uploadCode: code }) });
  assert.equal((await post('wrong')).status, 403); assert.equal(saved.length, 0);
  assert.equal((await post('private-code')).status, 200); assert.equal(saved[0].id, 'S01');
});

test('one common maker separates 20 submissions, safely updates one, and keeps private keys out of GitHub', async t => {
  const config = loadConfig({ BASE_URL: 'http://localhost', STORAGE_PROVIDER: 'github' });
  config.encryptionKey = randomBytes(32).toString('base64');
  const api = fakeGitHub(), store = new GitHubStore({ token: 'test-token', repository: 'test/math', fetchImpl: api.fetch, mutationDelay: 0 });
  const classCode = 'private-classroom-code';
  const server = createApplication({ config, store, readRoster: async () => ({ students: [{ id: 'S01', uploadCodeHash: codeHash(classCode, config.encryptionKey) }] }) });
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve)); t.after(() => new Promise(resolve => server.close(resolve)));
  const url = 'http://127.0.0.1:' + server.address().port + '/api';
  const post = (submissionKey, extra = {}) => fetch(url, { method: 'POST', headers: { 'content-type': 'application/json', origin: 'null' }, body: JSON.stringify({ ...mission('CHOSEN-FOLDER'), school: '같은학교', name: '동명이인', action: 'mission_save', uploadCode: classCode, submissionKey, ...extra }) });
  assert.equal((await (await fetch(url + '?action=status')).json()).commonMaker, true);
  assert.equal((await post('')).status, 400);
  assert.equal((await post('a'.repeat(48), { uploadCode: 'wrong-code' })).status, 403);
  const keys = Array.from({length: 20}, () => randomBytes(24).toString('hex'));
  const replies = await Promise.all(keys.map(key => post(key)));
  for (const reply of replies) assert.equal(reply.status, 200);
  const catalog = () => JSON.parse(api.files()['docs/submissions/catalog.json']);
  assert.equal(catalog().missions.length, 20);
  assert.equal(new Set(catalog().missions.map(row => row.id)).size, 20);
  assert(catalog().missions.every(row => /^M[a-f0-9]{32}$/.test(row.id)));
  assert.equal((await post(keys[0], { topic: '수정한 작품', id: catalog().missions[1].id })).status, 200);
  assert.equal(catalog().missions.length, 20);
  assert.equal(catalog().missions.filter(row => row.topic === '수정한 작품').length, 1);
  const published = JSON.stringify(api.files());
  for (const secret of [...keys, classCode, config.encryptionKey]) assert(!published.includes(secret));
});

test('common maker retains a private key per author and separates browsers, including blocked storage', async () => {
  const source = await readFile(new URL('../docs/submission-files.js', import.meta.url), 'utf8');
  const storage = () => { const values = new Map(); return { getItem: key => values.get(key), setItem: (key, value) => values.set(key, value) }; };
  const maker = localStorage => { const window = { localStorage, crypto: webcrypto }; vm.runInNewContext(source, { window, Uint8Array }); return window.MathTourSubmission; };
  const saved = storage(), first = maker(saved), second = maker(storage());
  const key = first.commonSubmissionKey('구월중', '학생');
  assert.match(key, /^[a-f0-9]{48}$/);
  assert.equal(first.commonSubmissionKey(' 구월중 ', '학생'), key);
  assert.equal(maker(saved).commonSubmissionKey('구월중', '학생'), key);
  assert.notEqual(first.commonSubmissionKey('구월중', '다른학생'), key);
  assert.notEqual(second.commonSubmissionKey('구월중', '학생'), key);
  const blocked = maker({ getItem() { throw new Error('blocked'); }, setItem() { throw new Error('blocked'); } });
  assert.equal(blocked.commonSubmissionKey('구월중', '학생'), blocked.commonSubmissionKey('구월중', '학생'));
});
test('Korean filenames resolve through the catalog and teacher game edits are fetched afresh', async () => {
  const folder = 'https://school.example/tour/submissions/K02/S01/';
  const name = 'K02_구월중정승헌_스토리보드.json', game = 'K02_구월중정승헌_G1.html';
  let gameHtml = '<p>old question</p>';
  const manifest = { format: 'mathtour-submission', schemaVersion: 1, playback: 'source-files', placeId: 'K02', studentId: 'S01', program: 'K02_구월중정승헌_본문.html', games: [{ number: 1, name: game }], pictures: [] };
  const window = { MATHTOUR_CONFIG: { githubCatalog: './submissions/catalog.json' }, renderStoredProject: project => project.games[0].html };
  const fetch = async (url, options) => {
    assert.equal(options.cache, 'no-store'); const decoded = decodeURIComponent(String(url));
    if (decoded.endsWith('/catalog.json')) return new Response(JSON.stringify({ schemaVersion: 1, missions: [{ id: 'S01', placeId: 'K02', manifest: './submissions/K02/S01/' + encodeURIComponent(name) }] }));
    if (decoded === folder + name) return new Response(JSON.stringify(manifest));
    if (decoded === folder + game) return new Response(gameHtml);
    if (decoded.endsWith('_본문.html')) return new Response('<section class="scene" data-game="1"></section>');
    throw new Error('Unexpected asset path');
  };
  vm.runInNewContext(await readFile(new URL('../docs/github-missions.js', import.meta.url), 'utf8'), { window, fetch, URL, AbortSignal, TextDecoder, Uint8Array, location: { href: 'https://school.example/tour/index.html', origin: 'https://school.example' } });
  const rows = await window.loadGitHubCatalog('K02'); const url = rows[0].githubManifest;
  assert.equal((await window.loadGitHubMission('K02', 'S01', url)).html, gameHtml);
  gameHtml = '<p>corrected question</p>'; assert.equal((await window.loadGitHubMission('K02', 'S01', url)).html, gameHtml);
  await assert.rejects(window.loadGitHubMission('K02', 'S01', 'https://evil.example/file.json'));
  manifest.games[0].name = '../other.html'; await assert.rejects(window.loadGitHubMission('K02', 'S01', url));
});
