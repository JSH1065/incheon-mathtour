import { readFile, writeFile } from 'node:fs/promises';
const base = new URL('../docs/', import.meta.url);
const site = 'https://jsh1065.github.io/incheon-mathtour/';
let html = await readFile(new URL('make.html', base), 'utf8');
for (const match of [...html.matchAll(/<script src="\.\/([^"\n]+)"[^>]*><\/script>/g)]) {
  if (match[1] === 'config.js') html = html.replace(match[0], '<script src="' + site + 'config.js"></script>');
  else { const source = await readFile(new URL(match[1], base), 'utf8'); html = html.replace(match[0], () => '<script>\n' + source.replace(/<\/script/gi, '<\\/script') + '\n</script>'); }
}
html = html.replace(/href="\.\//g, 'href="' + site);
await writeFile(new URL('학생용_매스투어_제작기.html', base), html);
console.log('Built one student HTML file; only public connection settings and shared images load online.');
