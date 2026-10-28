import { randomBytes } from 'node:crypto';
import { readFile, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
const destination = resolve('.env');
try { await readFile(destination); throw new Error('.env already exists. Keep the existing encryption key; do not regenerate it.'); }
catch (error) { if (error.code !== 'ENOENT') throw error; }
let text = await readFile(new URL('../.env.example', import.meta.url), 'utf8');
text = text.replace(/^ADMIN_PASSWORD=$/m, 'ADMIN_PASSWORD=' + randomBytes(32).toString('base64url'));
text = text.replace(/^CACHE_ENCRYPTION_KEY=$/m, 'CACHE_ENCRYPTION_KEY=' + randomBytes(32).toString('base64'));
await writeFile(destination, text, { flag: 'wx', mode: 0o600 });
console.log('Created server-only .env. Values are not printed. Never upload this file to GitHub.');
