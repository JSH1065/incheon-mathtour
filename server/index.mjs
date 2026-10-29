import http from 'node:http';
import { readFile, mkdir, writeFile } from 'node:fs/promises';
import { resolve, join, extname, sep } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createHash, createHmac, randomBytes, timingSafeEqual } from 'node:crypto';
import { DriveStore, MAX_REQUEST_BYTES, httpError, validateMission } from './drive-store.mjs';
import { createAuth, createGraph } from './auth.mjs';

export const projectRoot = resolve(fileURLToPath(new URL('..', import.meta.url)));
const same = (a, b) => { const x = createHash('sha256').update(String(a)).digest(); const y = createHash('sha256').update(String(b)).digest(); return timingSafeEqual(x, y); };
export const codeHash = (code, key) => createHmac('sha256', Buffer.from(key, 'base64')).update(code).digest('hex');
const json = (res, status, body) => { res.writeHead(status, { 'Content-Type': 'application/json; charset=utf-8' }); res.end(JSON.stringify(body)); };
const html = (res, body) => { res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8', 'Content-Security-Policy': "default-src 'none'; style-src 'unsafe-inline'; form-action 'self'; frame-ancestors 'none'" }); res.end(body); };
const adminPage = config => '<!doctype html><html lang="ko"><meta charset="utf-8"><meta name="viewport" content="width=device-width"><title>OneDrive 연결</title><style>body{font:16px/1.7 sans-serif;max-width:650px;margin:60px auto;padding:20px}input,button{font:inherit;padding:10px;margin:5px 0;display:block}</style><h1>매쓰투어 OneDrive 연결</h1>' + (config.storageMode === 'shared-folder' ? '<p>서버 관리 비밀번호를 입력한 뒤 저장 대상 폴더를 소유한 학교 Microsoft 365 계정으로 로그인하세요.</p><p>기존 폴더에 저장하기 위해 Files.ReadWrite 권한을 요청합니다. 이 권한 자체는 폴더 한 개로 한정되지 않습니다. 프로그램은 설정한 폴더 아래에 작품을 저장합니다. 학교 정책에 따라 관리자 승인이 필요할 수 있습니다.</p>' : '<p>서버 관리 비밀번호를 입력한 뒤 Microsoft 계정으로 로그인해 앱 전용 폴더 연결을 승인하세요.</p>') + '<form method="post" action="/admin/connect"><label for="password">서버 관리 비밀번호</label><input id="password" name="password" type="password" required autocomplete="current-password"><button>Microsoft 계정 연결</button></form><p>학생에게는 GitHub Pages의 체험·제작 주소와 개인별 제출코드만 전달합니다.</p></html>';
async function bodyOf(req) {
  const chunks = []; let length = 0;
  for await (const chunk of req) { length += chunk.length; if (length > MAX_REQUEST_BYTES) throw httpError(413, 'too_large'); chunks.push(chunk); }
  const raw = Buffer.concat(chunks).toString('utf8');
  if ((req.headers['content-type'] || '').includes('application/x-www-form-urlencoded')) return Object.fromEntries(new URLSearchParams(raw));
  try { return JSON.parse(raw); } catch { throw httpError(400, 'invalid_json'); }
}
class RateLimits {
  constructor() { this.entries = new Map(); }
  check(key, limit, windowMs = 60000) {
    const now = Date.now();
    if (this.entries.size > 5000) for (const [k, value] of this.entries) if (value.until < now) this.entries.delete(k);
    const current = this.entries.get(key);
    if (!current || current.until < now) { this.entries.set(key, { until: now + windowMs, count: 1 }); return; }
    if (++current.count > limit) throw httpError(429, 'try_again_later');
  }
}

export function loadConfig(env = process.env) {
  const baseUrl = (env.BASE_URL || env.RENDER_EXTERNAL_URL || 'http://localhost:8787').replace(/\/$/, '');
  const parsed = new URL(baseUrl);
  const local = ['localhost','127.0.0.1','[::1]'].includes(parsed.hostname);
  if (parsed.protocol !== 'https:' && !local) throw new Error('Public BASE_URL must use HTTPS.');
  if (parsed.pathname !== '/') throw new Error('BASE_URL must be the server origin without a path.');
  if (env.MOCK_ONEDRIVE === '1' && (env.NODE_ENV === 'production' || !local || !['127.0.0.1','localhost'].includes(env.HOST || '127.0.0.1'))) throw new Error('Mock mode is local only.');
  const storageMode = env.STORAGE_MODE || 'app-folder';
  if (!['app-folder','shared-folder'].includes(storageMode)) throw new Error('Invalid STORAGE_MODE.');
  const dataDir = resolve(projectRoot, env.DATA_DIR || '.private');
  return { provider: env.STORAGE_PROVIDER || 'onedrive', githubToken: env.GITHUB_TOKEN, githubRepository: env.GITHUB_REPOSITORY, githubBranch: env.GITHUB_BRANCH || 'main', rosterJson: env.ROSTER_JSON, baseUrl, local, host: env.HOST || '127.0.0.1', port: Number(env.PORT || 8787), origins: new Set((env.PAGES_ORIGIN || baseUrl).split(',').map(x => new URL(x.trim()).origin)), clientId: env.MS_CLIENT_ID, clientSecret: env.MS_CLIENT_SECRET, tenant: env.MS_TENANT || (storageMode === 'shared-folder' ? 'organizations' : 'consumers'), storageMode, targetConfigFile: env.TARGET_CONFIG_FILE ? resolve(projectRoot,env.TARGET_CONFIG_FILE) : join(dataDir,'onedrive-target.json'), encryptionKey: env.CACHE_ENCRYPTION_KEY, adminPassword: env.ADMIN_PASSWORD, dataDir, mock: env.MOCK_ONEDRIVE === '1' };
}

export function createApplication({ config, store, auth, readRoster }) {
  const rates = new RateLimits();
  const pending = new Map();
  return http.createServer(async (req, res) => {
    res.setHeader('X-Content-Type-Options', 'nosniff');
    res.setHeader('Referrer-Policy', 'no-referrer');
    res.setHeader('Cache-Control', 'no-store');
    const url = new URL(req.url, config.baseUrl);
    const origin = req.headers.origin;
    const ip = req.socket.remoteAddress || 'unknown';
    try {
      if (url.pathname === '/api') {
        if (origin && !config.origins.has(origin) && !(origin === 'null' && config.provider === 'github')) throw httpError(403, 'origin_not_allowed');
        if (origin) { res.setHeader('Access-Control-Allow-Origin', origin); res.setHeader('Vary', 'Origin'); }
        if (req.method === 'OPTIONS') { res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS'); res.setHeader('Access-Control-Allow-Headers', 'Content-Type'); res.writeHead(204); res.end(); return; }
        rates.check('api:' + ip, 600);
        if (req.method === 'GET') {
          const action = url.searchParams.get('action');
          if (action === 'status') { json(res, 200, { ok: true, mode: config.mock ? 'local-test' : config.provider, storage: config.provider === 'github' ? 'GitHub' : 'OneDrive', commonMaker: config.provider === 'github', codeFreeMaker: config.provider === 'github', sixSceneMaker:true }); return; }
          if (action === 'mission_list') { json(res, 200, await store.list(url.searchParams.get('placeId'))); return; }
          if (action === 'mission_load') { json(res, 200, await store.load(url.searchParams.get('placeId'), url.searchParams.get('sid'))); return; }
          throw httpError(400, 'unknown_action');
        }
        if (req.method !== 'POST') throw httpError(405, 'method_not_allowed');
        const data = await bodyOf(req);
        if (data.action === 'mission_save') {
          if (config.provider === 'github') {
            rates.check('github-save:' + ip, 100);
            // New public makers use a private browser key. Existing coded makers retain their IDs.
            // An incorrect supplied code must never fall back to the code-free route.
            let student;
            if (data.uploadCode) {
              const roster = await readRoster();
              const suppliedHash = codeHash(String(data.uploadCode), config.encryptionKey);
              student = roster.students?.find(item => item.uploadCodeHash && same(item.uploadCodeHash, suppliedHash));
              if (!student || (student.school && student.school !== data.school) || (student.name && student.name !== data.name)) throw httpError(403, 'unauthorized');
            }
            // Never accept a chosen folder ID or publish a browser key.
            data.id = student?.id;
            if (!student || data.submissionKey !== undefined) {
              if (typeof data.submissionKey !== 'string' || !/^[a-f0-9]{48}$/.test(data.submissionKey)) throw httpError(400, 'invalid_submission_key');
              if (typeof data.school !== 'string' || !data.school.trim() || data.school.length > 40 || typeof data.name !== 'string' || !data.name.trim() || data.name.length > 40) throw httpError(400, 'invalid_school_or_name');
              data.school = data.school.normalize('NFC').trim();
              data.name = data.name.normalize('NFC').trim();
              const identity = student
                ? ['common-maker-v1', student.id, data.school, data.name, data.submissionKey]
                : ['public-maker-v1', data.school, data.name, data.submissionKey];
              data.id = 'M' + createHmac('sha256', Buffer.from(config.encryptionKey, 'base64'))
                .update(JSON.stringify(identity)).digest('hex').slice(0, 32);
            }
            validateMission(data);
            rates.check('github-student:' + data.id, 10);
            json(res, 200, await store.save(data)); return;
          }
          // School/name are labels; only a matching personal code may select a roster ID.
          if (data.school !== undefined) {
            rates.check('school-save:' + ip, 100);
            if (typeof data.school !== 'string' || !data.school.trim() || data.school.length > 40 || typeof data.name !== 'string') throw httpError(400, 'invalid_school');
            data.school = data.school.normalize('NFC').trim();
            data.name = data.name.normalize('NFC').trim();
            const suppliedHash = codeHash(String(data.uploadCode || ''), config.encryptionKey);
            const roster = await readRoster();
            const student = roster.students?.find(item => item.school === data.school && item.name === data.name && item.uploadCodeHash && same(item.uploadCodeHash, suppliedHash));
            if (!student) throw httpError(403, 'unauthorized');
            data.id = student.id;
          }
          validateMission(data);
          rates.check('save:' + ip + ':' + data.id, 20);
          const roster = await readRoster();
          const student = roster.students?.find(item => item.id === data.id && item.name === data.name.trim());
          const suppliedHash = codeHash(String(data.uploadCode || ''), config.encryptionKey);
          if (!student?.uploadCodeHash || !same(student.uploadCodeHash, suppliedHash)) throw httpError(403, 'unauthorized');
          json(res, 200, await store.save(data)); return;
        }
        if (data.action === 'feedback_save' || data.feedback !== undefined) { rates.check('feedback:' + ip, 100); json(res, 200, await store.saveFeedback(data)); return; }
        throw httpError(400, 'unknown_action');
      }
      if (url.pathname === '/admin' && req.method === 'GET') { html(res, adminPage(config)); return; }
      if (url.pathname === '/admin/connect' && req.method === 'POST') {
        if (origin && origin !== new URL(config.baseUrl).origin) throw httpError(403, 'origin_not_allowed');
        rates.check('admin:' + ip, 5);
        const data = await bodyOf(req);
        if (!config.adminPassword || config.adminPassword.length < 24 || !same(data.password, config.adminPassword)) throw httpError(403, 'unauthorized');
        if (!auth) throw httpError(503, 'microsoft_app_not_configured');
        for (const [key, value] of pending) if (value.expires < Date.now()) pending.delete(key);
        const state = randomBytes(32).toString('base64url');
        const session = randomBytes(32).toString('base64url');
        const attempt = await auth.begin(state);
        pending.set(state, { verifier: attempt.verifier, session, expires: Date.now() + 10 * 60000 });
        res.setHeader('Set-Cookie', 'mt_connect=' + session + '; HttpOnly; SameSite=Lax; Path=/auth/callback; Max-Age=600' + (config.local ? '' : '; Secure'));
        res.writeHead(303, { Location: attempt.url }); res.end(); return;
      }
      if (url.pathname === '/auth/callback' && req.method === 'GET') {
        const state = url.searchParams.get('state');
        const attempt = pending.get(state);
        const cookie = (req.headers.cookie || '').split(';').map(x => x.trim()).find(x => x.startsWith('mt_connect='))?.slice(11);
        if (!attempt || attempt.expires < Date.now() || !cookie || !same(cookie, attempt.session)) throw httpError(403, 'invalid_login_state');
        pending.delete(state);
        if (!url.searchParams.get('code') || url.searchParams.has('error')) throw httpError(400, 'microsoft_login_cancelled');
        await auth.finish(url.searchParams.get('code'), attempt.verifier);
        // 다른 계정으로 다시 연결할 때 이전 계정 폴더 ID를 재사용하지 않는다.
        if (store.resetTarget) store.resetTarget();
        else { store.rootId = null; store.folders?.clear(); }
        // 로그인만 성공했다고 저장소 연결 완료를 표시하지 않고 대상 폴더도 확인한다.
        if (store.root) await store.root();
        res.setHeader('Set-Cookie', 'mt_connect=; HttpOnly; SameSite=Lax; Path=/auth/callback; Max-Age=0' + (config.local ? '' : '; Secure'));
        html(res, '<!doctype html><html lang="ko"><meta charset="utf-8"><title>연결 완료</title><h1>OneDrive 로그인·저장 폴더 확인 완료</h1><p>이제 GitHub Pages 제작기에서 학생 제출코드로 시험 작품을 올려 실제 저장까지 확인하세요.</p></html>'); return;
      }
      // 서버 자체 미리보기에서도 공개할 docs/ 파일만 제공한다.
      if (req.method !== 'GET') throw httpError(405, 'method_not_allowed');
      const publicRoot = join(projectRoot, 'docs');
      const file = resolve(publicRoot, '.' + decodeURIComponent(url.pathname === '/' ? '/index.html' : url.pathname));
      if (!file.startsWith(publicRoot + sep)) throw httpError(404, 'not_found');
      if (config.mock && url.pathname.endsWith('/config.js')) {
        res.writeHead(200, { 'Content-Type': 'text/javascript; charset=utf-8' }); res.end('window.MATHTOUR_CONFIG={apiUrl:"/api",title:"인천 매쓰투어 · 로컬 검사",localTest:true};'); return;
      }
      let bytes; try { bytes = await readFile(file); } catch { throw httpError(404, 'not_found'); }
      const mime = { '.html':'text/html; charset=utf-8','.js':'text/javascript; charset=utf-8','.css':'text/css','.webp':'image/webp','.png':'image/png','.mp4':'video/mp4','.svg':'image/svg+xml' }[extname(file)] || 'application/octet-stream';
      res.writeHead(200, { 'Content-Type': mime }); res.end(bytes);
    } catch (error) {
      // 토큰·Microsoft 응답 본문·학생 자료는 로그와 오류 응답에 넣지 않는다.
      if (!res.headersSent) json(res, error.status || 500, { ok: false, error: error.code || 'server_error' });
      else res.end();
    }
  });
}

async function start() {
  const config = loadConfig();
  let auth = null;
  if (config.clientId && config.clientSecret && config.encryptionKey && !config.mock) auth = await createAuth(config);
  let store;
  if (config.mock) {
    const { LocalTestStore } = await import('./local-test-store.mjs');
    store = new LocalTestStore(join(config.dataDir, 'local-test'));
    config.encryptionKey = randomBytes(32).toString('base64');
  } else if (config.provider === 'github') {
    if (Buffer.from(config.encryptionKey || '', 'base64').length !== 32) throw new Error('GitHub submission key is not configured');
    const { GitHubStore } = await import('./github-store.mjs');
    store = new GitHubStore({ token: config.githubToken, repository: config.githubRepository, branch: config.githubBranch });
  } else {
    const readTarget = async () => { try { return JSON.parse(await readFile(config.targetConfigFile, 'utf8')); } catch { throw httpError(503, 'target_folder_not_configured'); } };
    store = new DriveStore(createGraph(auth || { token: async () => { throw httpError(503, 'microsoft_app_not_configured'); } }), { storageMode: config.storageMode, readTarget });
  }
  const readRoster = config.mock
    ? async () => ({ students: [{ id:'TEST01', name:'테스트', uploadCodeHash:codeHash('LOCAL-DEMO-ONLY',config.encryptionKey) }] })
    : async () => { try { return config.provider === 'github' && !config.rosterJson ? { students: [] } : JSON.parse(config.rosterJson || await readFile(join(config.dataDir,'roster.json'),'utf8')); } catch { throw httpError(503,'roster_not_configured'); } };
  const server = createApplication({ config, store, auth, readRoster });
  server.listen(config.port, config.host, () => console.log('MathTour server ready at ' + config.baseUrl + (config.mock ? ' (LOCAL TEST: no OneDrive writes)' : '')));
}
if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) start().catch(() => { console.error('Server startup failed. Check server-only configuration.'); process.exitCode = 1; });
