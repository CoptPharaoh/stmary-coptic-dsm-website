// Keep static public HTML and its shared assets in sync without a build framework.
import { createHash } from 'node:crypto';
import { readFile, readdir, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
const root = resolve(import.meta.dirname, '..');
const assets = ['css/style.css', 'js/main.js', 'js/public-content.js'];
const versions = new Map();
for (const asset of assets) {
  versions.set(asset, createHash('sha256').update(await readFile(resolve(root, asset))).digest('hex').slice(0, 12));
}
const changed = [];
for (const name of (await readdir(root)).filter(name => name.endsWith('.html')).sort()) {
  const file = resolve(root, name);
  const original = await readFile(file, 'utf8');
  // Only these exact local asset attributes; no content or legacy directories.
  const updated = original.replace(/\b(href|src)="(css\/style\.css|js\/main\.js|js\/public-content\.js)(?:\?v=[^"\s]*)?"/g,
    (_, attribute, asset) => `${attribute}="${asset}?v=${versions.get(asset)}"`);
  if (updated === original) continue;
  changed.push(name);
  if (process.argv.includes('--write')) await writeFile(file, updated);
}
console.log(JSON.stringify({mode:process.argv.includes('--write')?'updated':'check', versions:Object.fromEntries(versions), files:changed},null,2));
if (changed.length && !process.argv.includes('--write')) process.exitCode = 1;
