import { randomBytes, createCipheriv, createDecipheriv, createHash } from 'node:crypto';
import { readFile, writeFile, mkdir, rename } from 'node:fs/promises';
import { join } from 'node:path';
import { httpError } from './drive-store.mjs';

export class Vault {
  constructor(directory, key) {
    this.directory = directory;
    this.key = Buffer.from(key || '', 'base64');
    if (this.key.length !== 32) throw new Error('CACHE_ENCRYPTION_KEY must be a base64-encoded 32-byte key.');
  }
  async read(name) {
    let bytes;
    try { bytes = await readFile(join(this.directory, name)); }
    catch (error) { if (error.code === 'ENOENT') return null; throw error; }
    const decipher = createDecipheriv('aes-256-gcm', this.key, bytes.subarray(0, 12));
    decipher.setAuthTag(bytes.subarray(12, 28));
    return Buffer.concat([decipher.update(bytes.subarray(28)), decipher.final()]).toString('utf8');
  }
  async write(name, value) {
    await mkdir(this.directory, { recursive: true, mode: 0o700 });
    const iv = randomBytes(12);
    const cipher = createCipheriv('aes-256-gcm', this.key, iv);
    const encrypted = Buffer.concat([cipher.update(value, 'utf8'), cipher.final()]);
    const destination = join(this.directory, name);
    const temporary = destination + '.' + randomBytes(8).toString('hex') + '.tmp';
    await writeFile(temporary, Buffer.concat([iv, cipher.getAuthTag(), encrypted]), { mode: 0o600 });
    await rename(temporary, destination);
  }
}

export async function createAuth(config) {
  const { ConfidentialClientApplication } = await import('@azure/msal-node');
  const vault = new Vault(config.dataDir, config.encryptionKey);
  // 기존 공유 폴더는 AppFolder 권한으로 접근할 수 없다.
  // Files.ReadWrite는 폴더 하나로 한정된 권한이 아니며 계정 소유자의 동의가 필요하다.
  const scopes = ['https://graph.microsoft.com/' + (config.storageMode === 'shared-folder' ? 'Files.ReadWrite' : 'Files.ReadWrite.AppFolder')];
  const cachePlugin = {
    async beforeCacheAccess(context) { const cache = await vault.read('msal-cache.enc'); if (cache) context.tokenCache.deserialize(cache); },
    async afterCacheAccess(context) { if (context.cacheHasChanged) await vault.write('msal-cache.enc', context.tokenCache.serialize()); }
  };
  const app = new ConfidentialClientApplication({ auth: { clientId: config.clientId, clientSecret: config.clientSecret, authority: 'https://login.microsoftonline.com/' + config.tenant }, cache: { cachePlugin }, system: { loggerOptions: { piiLoggingEnabled: false, loggerCallback() {} } } });
  let queue = Promise.resolve();
  const exclusive = action => { const task = queue.catch(() => {}).then(action); queue = task; return task; };
  return {
    async begin(state) {
      const verifier = randomBytes(48).toString('base64url');
      const challenge = createHash('sha256').update(verifier).digest('base64url');
      const url = await app.getAuthCodeUrl({ scopes, redirectUri: config.baseUrl + '/auth/callback', state, codeChallenge: challenge, codeChallengeMethod: 'S256', prompt: 'select_account' });
      return { url, verifier };
    },
    async finish(code, verifier) {
      return exclusive(async () => {
        const result = await app.acquireTokenByCode({ code, codeVerifier: verifier, scopes, redirectUri: config.baseUrl + '/auth/callback' });
        if (!result?.account) throw httpError(401, 'microsoft_login_failed');
        await vault.write('owner.enc', JSON.stringify({ homeAccountId: result.account.homeAccountId }));
      });
    },
    async token() {
      return exclusive(async () => {
        const owner = await vault.read('owner.enc');
        if (!owner) throw httpError(503, 'onedrive_not_connected');
        const account = await app.getTokenCache().getAccountByHomeId(JSON.parse(owner).homeAccountId);
        if (!account) throw httpError(503, 'onedrive_reconnect_required');
        try { const result = await app.acquireTokenSilent({ account, scopes }); return result.accessToken; }
        catch { throw httpError(503, 'onedrive_reconnect_required'); }
      });
    }
  };
}

export function createGraph(auth, request = fetch) {
  return async function graph(path, options = {}) {
    const url = new URL(path, 'https://graph.microsoft.com/v1.0/');
    // Graph가 반환한 페이징 주소만 허용한다. 인증 토큰을 임의 주소에 보내지 않는다.
    if (url.origin !== 'https://graph.microsoft.com') throw httpError(502, 'invalid_graph_url');
    if (path.startsWith('/')) url.pathname = '/v1.0' + url.pathname;
    let body = options.body;
    const contentType = options.json ? 'application/json' : options.contentType;
    if (options.json) body = JSON.stringify(options.json);
    for (let attempt = 0; attempt < 3; attempt++) {
      const token = await auth.token();
      const response = await request(url, { method: options.method || 'GET', headers: { Authorization: 'Bearer ' + token, ...(contentType ? { 'Content-Type': contentType } : {}) }, body, signal: AbortSignal.timeout(45000), redirect: 'follow' });
      if ((response.status === 429 || response.status === 503) && attempt < 2) {
        const seconds = Math.min(10, Math.max(1, Number(response.headers.get('retry-after')) || attempt + 1));
        await new Promise(resolve => setTimeout(resolve, seconds * 1000)); continue;
      }
      if (!response.ok) throw httpError(response.status, 'onedrive_request_failed');
      if (options.response === 'text') return response.text();
      if (response.status === 204) return null;
      return response.json();
    }
  };
}
