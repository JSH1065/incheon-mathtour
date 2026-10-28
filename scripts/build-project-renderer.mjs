import { readFile, writeFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
const base = fileURLToPath(new URL('../docs/', import.meta.url));
const maker = await readFile(base + 'make.html', 'utf8');
const take = (start, end) => maker.slice(maker.indexOf(start), maker.indexOf(end, maker.indexOf(start)));
const constants = take('  const FACES =', '  /* ====================== */');
const helpers = take('  function boyImg', '  /* ---------- 검사 ---------- */').replace("document.getElementById('placeId').value.trim()", 'meta.placeId').replace("document.getElementById('topic').value.trim()", 'meta.topic || ""');
const bridge = take('function gameAssetBridge(channel)', "window.addEventListener('message', function (event)");
const content = `/* Reuses the maker's character wrapper. Source HTML is parsed inertly and only runs in sandboxed frames. */
(function () {
  'use strict';
${constants}
  window.renderStoredProject = function (project, meta) {
    const core = window.MathTourProject;
    const CHAR_BASE = new URL('./student_images/', location.href).href;
    const doc = new DOMParser().parseFromString(project.program.html, 'text/html');
    const sections = Array.from(doc.querySelectorAll('section.scene'));
    if (!sections.length || sections.length > 50) throw new Error('invalid_story');
    const face = value => FACES.some(item => item.key === value) ? value : 'stand';
    const scenes = sections.map((section, i) => ({
      outer: section.outerHTML, title: section.getAttribute('data-title') || '장면 ' + (i + 1),
      gameNumber: section.hasAttribute('data-game') ? core.gameNumber(section.getAttribute('data-game')) : null,
      boyFace: face(section.getAttribute('data-boy-face')), girlFace: face(section.getAttribute('data-girl-face')),
      boyText: section.getAttribute('data-boy-text') || '', girlText: section.getAttribute('data-girl-text') || '',
      isProblem: /^(true|1|yes)$/i.test(section.getAttribute('data-problem') || ''), hint: section.getAttribute('data-hint') || ''
    }));
    const pics = {}, picSrc = {};
    (project.pictures || []).forEach(pic => { pics[pic.number] = pic.data; picSrc[pic.number] = pic.source; });
    const studentStyle = Array.from(doc.querySelectorAll('style')).map(style => style.textContent).join('\\n');
    const studentScript = '', activeAssetPreview = '';
    const esc = value => String(value == null ? '' : value).replaceAll('&', '&amp;').replaceAll('<', '&lt;').replaceAll('>', '&gt;').replaceAll('"', '&quot;');
${helpers}
${bridge}
    const steps = scenes.map((scene, i) => {
      const channel = 'stored-' + i + '-' + crypto.randomUUID();
      let html;
      if (scene.gameNumber) {
        const game = project.games.find(game => game.number === scene.gameNumber);
        if (!game) throw new Error('missing_game');
        scene.creditSource = game.html;
        const gameDoc = new DOMParser().parseFromString(replaceImgTags(game.html), 'text/html');
        const script = gameDoc.createElement('script'); script.textContent = '(' + gameAssetBridge.toString() + ')(' + JSON.stringify(channel) + ');'; gameDoc.head.prepend(script);
        html = '<!doctype html>' + gameDoc.documentElement.outerHTML;
      } else {
        scene.creditSource = scene.outer;
        const section = new DOMParser().parseFromString(scene.outer, 'text/html').querySelector('section.scene');
        section.removeAttribute('hidden'); section.style.cssText += ';display:block!important;visibility:visible!important;position:relative!important;height:auto!important;min-height:100%;';
        html = replaceImgTags('<!doctype html><html lang="ko"><head><meta charset="utf-8"><style>*{box-sizing:border-box}html,body{margin:0;min-height:100%;font-family:Malgun Gothic,sans-serif}body{padding:14px}img{max-width:100%}' + studentStyle + '</style></head><body>' + section.outerHTML + '</body></html>');
      }
      return { title: scene.title, game: scene.gameNumber, channel, html };
    });
    const gameAsset = { name: 'storyboard.html', html: core.tourDocument(steps), hasScenes: true };
    return buildFullHtml();
  };
})();
`;
await writeFile(base + 'project-renderer.js', content);
new Function(content);
console.log('Generated source-file player with the existing characters and mission completion bridge.');
