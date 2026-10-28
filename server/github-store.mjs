import { randomUUID } from 'node:crypto';
import { httpError, validateMission } from './drive-store.mjs';
import '../docs/submission-files.js';
const catalogPath = 'docs/submissions/catalog.json';
const pause = ms => new Promise(resolve => setTimeout(resolve, ms));
export class GitHubStore {
  constructor({ token, repository, branch = 'main', fetchImpl = fetch, mutationDelay = 1000 }) {
    if (!token || !/^[\w.-]+\/[\w.-]+$/.test(repository || '') || !/^[\w./-]+$/.test(branch)) throw new Error('Missing GitHub server configuration');
    this.token = token; this.repository = repository; this.branch = branch; this.fetch = fetchImpl;
    this.queue = Promise.resolve(); this.nextMutation = 0; this.mutationDelay = mutationDelay;
  }
  async request(path, method = 'GET', body) {
    for (let attempt = 0; attempt < 3; attempt++) {
      if (method !== 'GET') { await pause(Math.max(0, this.nextMutation - Date.now())); this.nextMutation = Date.now() + this.mutationDelay; }
      const response = await this.fetch('https://api.github.com/repos/' + this.repository + path, {
        method, headers: { Authorization: 'Bearer ' + this.token, Accept: 'application/vnd.github+json', 'Content-Type': 'application/json', 'X-GitHub-Api-Version': '2026-03-10' },
        body: body === undefined ? undefined : JSON.stringify(body), signal: AbortSignal.timeout(30000)
      });
      if (response.ok) return response.json();
      const retry = Number(response.headers.get('retry-after'));
      if ((response.status === 429 || response.status === 403) && retry > 0 && retry <= 60 && attempt < 2) { await pause(retry * 1000); continue; }
      throw Object.assign(httpError(response.status === 404 ? 404 : 502, 'github_request_failed'), { githubStatus: response.status });
    }
  }
  async readCatalog(ref) {
    try {
      const file = await this.request('/contents/' + catalogPath + '?ref=' + encodeURIComponent(ref));
      const data = JSON.parse(Buffer.from(file.content, 'base64').toString('utf8'));
      if (data.schemaVersion !== 1 || !Array.isArray(data.missions)) throw new Error('Invalid catalog');
      return data;
    } catch (error) { if (error.githubStatus === 404) return { schemaVersion: 1, missions: [] }; throw error; }
  }
  async save(data) {
    const job = this.queue.catch(() => {}).then(() => this.saveOne(data));
    this.queue = job; return job;
  }
  async saveOne(data) {
    validateMission(data);
    if (!data.project) throw httpError(400, 'project_required');
    let author;
    try { author = globalThis.MathTourSubmission.identity(data.school, data.name); }
    catch { throw httpError(400, 'invalid_school_or_name'); }
    const folder = 'docs/submissions/' + data.placeId + '/' + data.id + '/';
    const exported = globalThis.MathTourSubmission.buildFiles({ placeId: data.placeId, ...author, topic: data.topic, project: data.project, html: data.html, submissionId: randomUUID() });
    const manifestFile = exported.find(file => file.role === 'storyboard');
    const manifest = JSON.parse(manifestFile.content);
    delete manifest.mission;
    manifest.playback = 'source-files'; manifest.studentId = data.id;
    manifestFile.content = JSON.stringify(manifest, null, 2);
    const entries = [];
    for (const file of exported.filter(file => file.role !== 'mission')) {
      if (file.dataUrl) {
        const blob = await this.request('/git/blobs', 'POST', { encoding: 'base64', content: file.content.split(',')[1] });
        entries.push({ path: folder + file.name, mode: '100644', type: 'blob', sha: blob.sha });
      } else entries.push({ path: folder + file.name, mode: '100644', type: 'blob', content: file.content });
    }
    const manifestUrl = './submissions/' + data.placeId + '/' + data.id + '/' + encodeURIComponent(manifestFile.name);
    // Retry from the latest head to preserve simultaneous teacher edits and other submissions.
    for (let attempt = 0; attempt < 5; attempt++) {
      const ref = await this.request('/git/ref/heads/' + encodeURIComponent(this.branch));
      const head = ref.object.sha;
      const [commit, catalog] = await Promise.all([this.request('/git/commits/' + head), this.readCatalog(head)]);
      const missions = catalog.missions.filter(row => !(row.placeId === data.placeId && row.id === data.id));
      missions.push({ id: data.id, placeId: data.placeId, ...author, topic: data.topic.trim(), manifest: manifestUrl, updatedAt: new Date().toISOString() });
      if (missions.length > 2000) throw httpError(400, 'catalog_full');
      const tree = await this.request('/git/trees', 'POST', { base_tree: commit.tree.sha, tree: [...entries, { path: catalogPath, mode: '100644', type: 'blob', content: JSON.stringify({ schemaVersion: 1, missions }, null, 2) }] });
      const created = await this.request('/git/commits', 'POST', { message: 'Submit MathTour ' + data.placeId + ' / ' + data.id, tree: tree.sha, parents: [head] });
      try {
        await this.request('/git/refs/heads/' + encodeURIComponent(this.branch), 'PATCH', { sha: created.sha, force: false });
        return { ok: true, saved: data.placeId + ' / ' + author.school + ' ' + author.name, provider: 'github', revision: created.sha, manifest: manifestUrl };
      } catch (error) { if (![409, 422].includes(error.githubStatus) || attempt === 4) throw error; }
    }
  }
  async list(placeId) { const catalog = await this.readCatalog(this.branch); return { ok: true, missions: catalog.missions.filter(row => row.placeId === placeId) }; }
  async load() { throw httpError(400, 'use_github_pages_catalog'); }
  async saveFeedback() { throw httpError(400, 'feedback_not_configured'); }
}
