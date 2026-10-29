import { createHash, randomUUID } from 'node:crypto';
import '../docs/project-core.js';

export const PLACE_IDS = new Set(['B01','B02','B03','K01','K02','K03','K04','K05','M01','M02','M03','M04','N01','N02','N03','N04','S01','S02','S03']);
export const MAX_HTML_BYTES = 5 * 1024 * 1024;
export const MAX_PROJECT_BYTES = 8 * 1024 * 1024;
export const MAX_REQUEST_BYTES = 24 * 1024 * 1024;
export function httpError(status, code) { return Object.assign(new Error(code), { status, code }); }
export function validatePlace(value) { if (!PLACE_IDS.has(value)) throw httpError(400, 'invalid_place'); return value; }
export function validateId(value) { if (typeof value !== 'string' || !/^[A-Za-z0-9_-]{1,40}$/.test(value)) throw httpError(400, 'invalid_id'); return value; }
export function validateMission(data) {
  validatePlace(data.placeId); validateId(data.id);
  if (typeof data.name !== 'string' || !data.name.trim() || data.name.length > 80) throw httpError(400, 'invalid_name');
  if (typeof data.topic !== 'string' || !data.topic.trim() || data.topic.length > 80) throw httpError(400, 'invalid_topic');
  if (typeof data.html !== 'string' || !data.html.trim()) throw httpError(400, 'invalid_html');
  if (Buffer.byteLength(data.html, 'utf8') > MAX_HTML_BYTES) throw httpError(413, 'too_large');
  if (data.project !== undefined) validateProject(data.project, data.placeId);
}
export function validateProject(project, placeId) {
  const bad = () => { throw httpError(400, 'invalid_project'); };
  if (!project || project.schemaVersion !== 1 || !Array.isArray(project.games) || project.games.length > 20 || !Array.isArray(project.storyboard) || !project.storyboard.length || project.storyboard.length > 50) bad();
  const fixed = project.layout === globalThis.MathTourProject.SINGLE_LAYOUT;
  if (project.layout !== undefined && !fixed) bad();
  if (fixed && (project.games.length !== 1 || project.games[0].number !== 1 || project.storyboard.length !== 6 || project.storyboard.some((scene, i) => !scene || scene.title !== globalThis.MathTourProject.FIXED_SCENES[i] || scene.gameNumber !== (i === 3 ? 1 : null)))) bad();
  const validHtml = file => file && typeof file.html === 'string' && file.html.trim() && Buffer.byteLength(file.html, 'utf8') <= 2 * 1024 * 1024;
  if (!validHtml(project.program) || typeof project.program.name !== 'string' || !/^[^<>:"/\\|?*\x00-\x1f]{1,100}\.html?$/i.test(project.program.name) || project.program.name.startsWith('.')) bad();
  const seen = new Set(), names = new Set([project.program.name.toLowerCase()]);
  for (const game of project.games) {
    if (!Number.isInteger(game.number) || game.number < 1 || game.number > 999 || seen.has(game.number) || game.name !== (fixed ? globalThis.MathTourProject.singleGameName(placeId) : placeId + '-G' + game.number + '.html') || names.has(game.name.toLowerCase()) || !validHtml(game)) bad();
    seen.add(game.number); names.add(game.name.toLowerCase());
  }
  for (const scene of project.storyboard) {
    if (!scene || typeof scene.title !== 'string' || scene.title.length > 500 || (scene.gameNumber !== null && scene.gameNumber !== undefined && !seen.has(scene.gameNumber))) bad();
  }
  if (project.pictures !== undefined && (!Array.isArray(project.pictures) || project.pictures.length > 3 || project.pictures.some(pic => ![1,2,3].includes(pic.number) || typeof pic.data !== 'string' || !/^data:image\/(png|jpeg|webp);base64,/.test(pic.data) || typeof pic.source !== 'string'))) bad();
  if (Buffer.byteLength(JSON.stringify(project), 'utf8') > MAX_PROJECT_BYTES) throw httpError(413, 'too_large');
}
const enc = encodeURIComponent;
const entryName = id => createHash('sha256').update(id).digest('hex') + '.json';

export class DriveStore {
  constructor(graph, { storageMode = 'app-folder', readTarget } = {}) {
    if (!['app-folder', 'shared-folder'].includes(storageMode)) throw new Error('Invalid storage mode');
    this.graph = graph; this.storageMode = storageMode; this.readTarget = readTarget;
    this.folders = new Map(); this.locks = new Map();
  }
  resetTarget() { this.rootId = null; this.drivePrefix = null; this.folders.clear(); }
  itemPath(id) { return (this.drivePrefix || '/me/drive') + '/items/' + enc(id); }
  async exclusive(key, action) {
    const previous = this.locks.get(key) || Promise.resolve();
    const task = previous.catch(() => {}).then(action);
    this.locks.set(key, task);
    try { return await task; } finally { if (this.locks.get(key) === task) this.locks.delete(key); }
  }
  async root() {
    if (this.rootId) return this.rootId;
    return this.exclusive('root', async () => {
      if (this.rootId) return this.rootId;
      if (this.storageMode === 'shared-folder') {
        const target = await this.readTarget?.();
        let url;
        try { url = new URL(target?.sharingUrl); } catch { throw httpError(503, 'target_folder_not_configured'); }
        if (url.protocol !== 'https:' || !url.hostname.endsWith('.sharepoint.com') || url.username || url.password) throw httpError(503, 'invalid_target_folder');
        // 공유 링크는 서버 전용 파일에서 읽는다. 공개 HTML과 로그에 넣지 않는다.
        const shareId = 'u!' + Buffer.from(target.sharingUrl, 'utf8').toString('base64url');
        const response = await this.graph('/shares/' + shareId + '/driveItem');
        const item = response.remoteItem || response;
        const driveId = item.parentReference?.driveId;
        if (!item.folder || !item.id || !driveId) throw httpError(502, 'target_is_not_folder');
        if (target.expectedName && item.name !== target.expectedName) throw httpError(409, 'target_folder_changed');
        this.drivePrefix = '/drives/' + enc(driveId);
        this.rootId = item.id;
      } else {
        const item = await this.graph('/me/drive/special/approot');
        if (!item?.id || !item.folder) throw httpError(502, 'invalid_storage_folder');
        this.drivePrefix = '/me/drive'; this.rootId = item.id;
      }
      return this.rootId;
    });
  }
  async folder(parentId, name) {
    const key = parentId + '/' + name;
    if (this.folders.has(key)) return this.folders.get(key);
    return this.exclusive('folder:' + key, async () => {
      if (this.folders.has(key)) return this.folders.get(key);
      let item;
      try { item = await this.graph(this.itemPath(parentId) + ':/' + enc(name)); }
      catch (error) {
        if (error.status !== 404) throw error;
        try { item = await this.graph(this.itemPath(parentId) + '/children', { method: 'POST', json: { name, folder: {}, '@microsoft.graph.conflictBehavior': 'fail' } }); }
        catch (conflict) {
          if (conflict.status !== 409) throw conflict;
          item = await this.graph(this.itemPath(parentId) + ':/' + enc(name));
        }
      }
      if (!item?.id || !item.folder) throw httpError(502, 'invalid_storage_folder');
      this.folders.set(key, item.id);
      return item.id;
    });
  }
  async missionFolder(placeId) { return this.folder(await this.folder(await this.root(), 'missions'), validatePlace(placeId)); }
  async put(parent, filename, body, contentType) {
    return this.graph(this.itemPath(parent) + ':/' + enc(filename) + ':/content', { method: 'PUT', body, contentType });
  }
  async save(data) {
    validateMission(data);
    return this.exclusive('mission:' + data.placeId + ':' + data.id, async () => {
      const folder = await this.missionFolder(data.placeId);
      const files = await this.folder(await this.root(), 'html');
      const revision = randomUUID();
      let projectFolderId;
      if (data.project) {
        // Stage all originals under a unique revision. The public record changes only after every file succeeds.
        const projects = await this.folder(await this.root(), 'projects');
        const student = await this.folder(projects, data.placeId + '-' + createHash('sha256').update(data.id).digest('hex'));
        projectFolderId = await this.folder(student, revision);
        for (const file of [data.project.program, ...data.project.games]) await this.put(projectFolderId, file.name, file.html, 'text/html; charset=utf-8');
        const manifest = { schemaVersion: 1, program: data.project.program.name, games: data.project.games.map(({number,name}) => ({number,name})), storyboard: data.project.storyboard, pictures: data.project.pictures || [] };
        await this.put(projectFolderId, 'storyboard.json', JSON.stringify(manifest), 'application/json');
      }
      // HTML을 먼저 완전히 저장한 뒤 작은 목록 파일을 갱신한다.
      // 다른 학생의 저장은 서로 다른 파일을 사용하므로 공용 index 덮어쓰기가 없다.
      const item = await this.put(files, revision + '.html', data.html, 'text/html; charset=utf-8');
      const metadata = { schemaVersion: 1, id: data.id, school: data.school, name: data.name.trim(), placeId: data.placeId, topic: data.topic.trim(), htmlFileId: item.id, projectFolderId, revision, updatedAt: new Date().toISOString() };
      await this.put(folder, entryName(data.id), JSON.stringify(metadata), 'application/json');
      return { ok: true, saved: data.placeId + ' / ' + data.id, revision };
    });
  }
  async readMetadata(placeId, id) {
    validatePlace(placeId); validateId(id);
    const folder = await this.missionFolder(placeId);
    const record = await this.graph(this.itemPath(folder) + ':/' + entryName(id) + ':/content', { response: 'json' });
    if (record.schemaVersion !== 1 || record.placeId !== placeId || record.id !== id || typeof record.htmlFileId !== 'string') throw httpError(502, 'invalid_mission');
    return record;
  }
  async load(placeId, id) {
    const record = await this.readMetadata(placeId, id);
    const html = await this.graph(this.itemPath(record.htmlFileId) + '/content', { response: 'text' });
    return { ok: true, html };
  }
  async list(placeId) {
    const folder = await this.missionFolder(placeId);
    let next = this.itemPath(folder) + '/children?$select=id,name,file&$top=200';
    const files = [];
    while (next) {
      const page = await this.graph(next);
      files.push(...(page.value || []).filter(item => item.file && /^[a-f0-9]{64}\.json$/.test(item.name)));
      next = page['@odata.nextLink'] || null;
      if (files.length > 2000) throw httpError(503, 'too_many_missions');
    }
    const missions = [];
    for (let i = 0; i < files.length; i += 6) {
      const batch = await Promise.all(files.slice(i, i + 6).map(item => this.graph(this.itemPath(item.id) + '/content', { response: 'json' })));
      for (const record of batch) {
        if (record.schemaVersion !== 1 || record.placeId !== placeId || typeof record.id !== 'string' || typeof record.topic !== 'string') continue;
        missions.push({ id: record.id, name: record.name, topic: record.topic, updatedAt: record.updatedAt });
      }
    }
    missions.sort((a, b) => a.id.localeCompare(b.id, 'ko', { numeric: true }));
    return { ok: true, missions };
  }
  async saveFeedback(data) {
    const feedback = String(data.feedback || '').trim();
    if (!feedback || feedback.length > 3000) throw httpError(400, 'invalid_feedback');
    const record = { savedAt: new Date().toISOString() };
    for (const key of ['school','sid','name','feedback','result','giveup','gems']) record[key] = String(data[key] || '').slice(0, key === 'feedback' ? 3000 : 100);
    const folder = await this.folder(await this.root(), 'feedback');
    await this.put(folder, randomUUID() + '.json', JSON.stringify(record), 'application/json');
    return { ok: true };
  }
}
