import { readFile, writeFile, mkdir } from 'node:fs/promises';
const base = new URL('../docs/', import.meta.url);
const site = 'https://jsh1065.github.io/incheon-mathtour/';
let html = await readFile(new URL('make.html', base), 'utf8');
for (const match of [...html.matchAll(/<script src="\.\/([^"\n]+)"[^>]*><\/script>/g)]) {
  if (match[1] === 'config.js') html = html.replace(match[0], '<script src="' + site + 'config.js"></script>');
  else { const source = await readFile(new URL(match[1], base), 'utf8'); html = html.replace(match[0], () => '<script>\n' + source.replace(/<\/script/gi, '<\\/script') + '\n</script>'); }
}
html = html.replace(/href="\.\//g, 'href="' + site);
await writeFile(new URL('학생용_매스투어_제작기.html', base), html);
if (process.argv.includes('--personal')) {
  const privateRoot = new URL('../.private/github-upload/', import.meta.url);
  const rows = (await readFile(new URL('학생별-제출코드.tsv', privateRoot), 'utf8')).trim().split(/\r?\n/).slice(1);
  const destination = new URL('학생별-제작기/', privateRoot); await mkdir(destination, { recursive: true });
  for (const row of rows) {
    const [id, code] = row.split('\t');
    if (!/^S\d{2}$/.test(id) || !/^[a-f0-9]{24}$/.test(code)) throw new Error('Invalid private code list');
    const personal = html.replace('<div id="uploadCodeFields">', '<div id="uploadCodeFields" hidden>').replace('<input id="uploadCode"', '<input id="uploadCode" value="' + code + '"');
    await writeFile(new URL(id + '_매스투어_제작기.html', destination), personal, { mode: 0o600 });
  }
  console.log('Created 20 private student HTML files with separate submission codes. No GitHub token is included.');
}
console.log('Built one student HTML file; only public connection settings and shared images load online.');
