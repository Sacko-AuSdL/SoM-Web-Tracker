import assert from 'node:assert/strict';
import { existsSync, readFileSync, readdirSync } from 'node:fs';
import { resolve, relative } from 'node:path';

const root = resolve('dist');
const base = '/SoM-Web-Tracker/';
let checked = 0;
function verifyUrl(url, source) {
  if (/^(data:|https?:|ws:|wss:|#)/.test(url)) return;
  assert(!url.startsWith('/') || url.startsWith(base), `${source}: unprefixed URL ${url}`);
  const target = url.startsWith(base) ? resolve(root, url.slice(base.length)) : resolve(root, source, '..', url);
  assert(!relative(root, target).startsWith('..'), `${source}: URL escapes dist: ${url}`);
  assert(existsSync(target), `${source}: missing asset ${url}`);
  checked++;
}
function walk(dir) {
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const path = resolve(dir, entry.name);
    if (entry.isDirectory()) { walk(path); continue; }
    if (!/\.(html|css|js)$/.test(entry.name)) continue;
    const source = relative(root, path);
    const text = readFileSync(path, 'utf8');
    assert(!/[A-Za-z]:[\\/](?!\/)|\/@vite\/|\/src\/main\.tsx|SecretOfManaRandomizer|\.\.\/\.\.\/source\//.test(text), `${source}: development-only path`);
    const patterns = entry.name.endsWith('.html') ? [/\b(?:src|href)="([^"]+)"/g] :
      entry.name.endsWith('.css') ? [/url\(["']?([^\s"')]+)["']?\)/g] : [/["'`](\/(?:SoM-Web-Tracker\/|assets\/|fonts\/)[^"'`\s]*)["'`]/g];
    for (const pattern of patterns) for (const match of text.matchAll(pattern)) verifyUrl(match[1], source);
  }
}
assert(readFileSync(resolve(root, 'index.html'), 'utf8').includes(base + 'assets/'), 'HTML must use the production base');
for (const file of ['fonts/manaspc.ttf', 'fonts/license.txt', 'POPTRACKER_LICENSE.txt']) assert(existsSync(resolve(root, file)), `Missing ${file}`);
walk(root);
assert(checked > 25, 'Expected HTML, CSS and bundled JS asset references to be checked');
const bundle = readdirSync(resolve(root, 'assets')).filter((file) => file.endsWith('.js')).map((file) => readFileSync(resolve(root, 'assets', file), 'utf8')).join('\n');
for (const marker of ['sandship-captain', 'sandship-morie-hint', 'ws://localhost:23074']) assert(bundle.includes(marker), `Missing bundled definition: ${marker}`);
console.log(`Production base-path check passed: ${checked} asset references, ${base}`);
