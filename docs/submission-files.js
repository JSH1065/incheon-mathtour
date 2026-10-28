/* Individual submission files keep school/name together without a ZIP archive. */
(function (root) {
  'use strict';
  function identity(school, name) {
    const values = [school, name].map(value => String(value || '').normalize('NFC').trim());
    if (values.some(value => !value || value.length > 40)) throw new Error('학교와 이름을 각각 1~40자로 입력해 주세요.');
    if (values.some(value => /[<>:"/\\|?*\x00-\x1f\u200b-\u200f\u202a-\u202e\u2066-\u2069]/.test(value))) throw new Error('학교와 이름에는 파일명에 사용할 수 없는 기호가 들어갈 수 없어요.');
    return { school: values[0], name: values[1] };
  }
  function prefix(placeId, school, name) {
    if (!/^[BKMNS]\d{2}$/.test(placeId)) throw new Error('관광지를 먼저 선택해 주세요.');
    const author = identity(school, name);
    return placeId + '_' + (author.school + author.name).replace(/\s/g, '');
  }
  function buildFiles({ placeId, school, name, topic, project, html, submissionId }) {
    const author = identity(school, name), base = prefix(placeId, school, name);
    if (!String(topic || '').trim()) throw new Error('탐구 주제를 입력해 주세요.');
    const files = [];
    const add = (role, suffix, type, content, extra = {}) => {
      const file = { role, name: base + '_' + suffix, type, content, ...extra };
      files.push(file); return file.name;
    };
    const program = add('program', '본문.html', 'text/html;charset=utf-8', project.program.html);
    const games = project.games.map(game => ({ number: game.number, name: add('game', 'G' + game.number + '.html', 'text/html;charset=utf-8', game.html, { number: game.number }) }));
    const pictures = (project.pictures || []).map(pic => {
      const match = /^data:image\/(jpeg|png|webp);base64,/.exec(pic.data);
      if (!match) throw new Error('지원하지 않는 사진 형식이에요. 사진을 다시 선택해 주세요.');
      return { number: pic.number, source: pic.source, name: add('picture', 'IMG' + pic.number + '.' + (match[1] === 'jpeg' ? 'jpg' : match[1]), 'image/' + match[1], pic.data, { dataUrl: true, number: pic.number }) };
    });
    const mission = add('mission', '매스투어.html', 'text/html;charset=utf-8', html);
    // Keep author fields separate: the readable concatenated filename is not an identity key.
    const manifest = { format: 'mathtour-submission', schemaVersion: 1, submissionId, placeId, ...author, topic: topic.trim(), program, games, pictures, mission, storyboard: project.storyboard };
    add('storyboard', '스토리보드.json', 'application/json;charset=utf-8', JSON.stringify(manifest, null, 2));
    return files;
  }
  root.MathTourSubmission = { identity, prefix, buildFiles };
})(typeof window === 'undefined' ? globalThis : window);
