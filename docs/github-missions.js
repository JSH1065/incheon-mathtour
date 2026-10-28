(function () {
  'use strict';
  const known = new Map();
  const key = (place, id) => place + ':' + id;
  const root = () => new URL('./submissions/', location.href);
  function manifestURL(value) {
    const url = new URL(value, location.href), base = root();
    if (url.origin !== base.origin || !url.pathname.startsWith(base.pathname) || !url.pathname.endsWith('.json') || url.search || url.hash) throw new Error('invalid_manifest_path');
    return url;
  }
  async function read(url, limit) {
    const response = await fetch(url.href, { cache: 'no-store', signal: AbortSignal.timeout(30000) });
    if (!response.ok) throw new Error('github_file_not_found');
    if (Number(response.headers?.get('content-length')) > limit) throw new Error('file_too_large');
    const bytes = new Uint8Array(await response.arrayBuffer());
    if (bytes.length > limit) throw new Error('file_too_large');
    return bytes;
  }
  const readText = async (url, limit) => new TextDecoder().decode(await read(url, limit));
  window.loadGitHubCatalog = async function (placeId) {
    const url = new URL(window.MATHTOUR_CONFIG.githubCatalog, location.href);
    if (url.origin !== location.origin || !url.pathname.startsWith(root().pathname)) throw new Error('invalid_catalog');
    const catalog = JSON.parse(await readText(url, 2 * 1024 * 1024));
    if (catalog.schemaVersion !== 1 || !Array.isArray(catalog.missions)) throw new Error('invalid_catalog');
    for (const stored of [...known.keys()]) if (stored.startsWith(placeId + ':')) known.delete(stored);
    return catalog.missions.filter(row => row.placeId === placeId).map(row => {
      if (typeof row.id !== 'string' || !/^[A-Za-z0-9_-]{1,40}$/.test(row.id)) throw new Error('invalid_mission_id');
      const target = manifestURL(row.manifest);
      const folder = new URL(placeId + '/' + row.id + '/', root());
      if (!target.pathname.startsWith(folder.pathname)) throw new Error('invalid_mission_folder');
      known.set(key(placeId, row.id), target.href);
      return { id: row.id, placeId, school: row.school, name: row.name, topic: row.topic, githubManifest: target.href, sourceApi: null };
    });
  };
  window.loadGitHubMission = async function (placeId, id, manifest) {
    if (known.get(key(placeId, id)) !== manifest) throw new Error('unknown_github_mission');
    const target = manifestURL(manifest);
    const data = JSON.parse(await readText(target, 1024 * 1024));
    if (data.format !== 'mathtour-submission' || data.schemaVersion !== 1 || data.playback !== 'source-files' || data.placeId !== placeId || data.studentId !== id || !Array.isArray(data.games) || data.games.length > 20 || !Array.isArray(data.pictures) || data.pictures.length > 3) throw new Error('invalid_project_manifest');
    const asset = name => {
      if (typeof name !== 'string' || !name || /[\\/\x00-\x1f]/.test(name) || name.startsWith('.')) throw new Error('invalid_asset_name');
      return new URL(encodeURIComponent(name), target);
    };
    const numbers = new Set();
    for (const game of data.games) {
      if (!Number.isInteger(game.number) || game.number < 1 || game.number > 999 || numbers.has(game.number)) throw new Error('invalid_game_number');
      numbers.add(game.number);
    }
    const [html, games, pictures] = await Promise.all([
      readText(asset(data.program), 2 * 1024 * 1024),
      Promise.all(data.games.map(async game => ({ ...game, html: await readText(asset(game.name), 2 * 1024 * 1024) }))),
      Promise.all(data.pictures.map(async picture => {
        const extension = /\.(jpg|jpeg|png|webp)$/i.exec(picture.name || '');
        if (!extension || ![1, 2, 3].includes(picture.number)) throw new Error('invalid_picture');
        const bytes = await read(asset(picture.name), 2 * 1024 * 1024);
        let binary = ''; for (let i = 0; i < bytes.length; i += 32768) binary += String.fromCharCode(...bytes.subarray(i, i + 32768));
        return { ...picture, data: 'data:image/' + (/jpe?g/i.test(extension[1]) ? 'jpeg' : extension[1].toLowerCase()) + ';base64,' + btoa(binary) };
      }))
    ]);
    return { ok: true, html: window.renderStoredProject({ program: { html }, games, pictures }, data) };
  };
})();
