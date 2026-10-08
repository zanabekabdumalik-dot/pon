// Builds the self-contained embedded version (dist-artifact/) used for the shareable link:
// in-memory navigation, no print/download buttons, everything runs in the browser.
//
//   npm run build:artifact

import { readdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { build } from 'vite';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
process.env.VITE_TARGET = 'artifact';
await build({ root, logLevel: 'warn' });

// The host wraps the page in its own <html>/<head>/<body>, so keep only the content.
const file = path.join(root, 'dist-artifact', 'index.html');
const html = readFileSync(file, 'utf8');
const pick = (re) => [...html.matchAll(re)].map((m) => m[0]).join('\n');
const page = [
  pick(/<title>[\s\S]*?<\/title>/g),
  pick(/<meta name="description"[^>]*>/g),
  pick(/<link rel="stylesheet"[^>]*>/g),
  pick(/<script>[\s\S]*?<\/script>/g),
  '<div id="root"></div>',
  pick(/<script type="module"[^>]*><\/script>/g),
].join('\n');
writeFileSync(file, `${page}\n`);

// The host only accepts text files without raw control characters. Minified libraries
// (pdf.js) contain a few raw ESC bytes inside string literals; rewrite them as \xHH escapes,
// which JavaScript reads as exactly the same character.
const walk = (dir) => readdirSync(dir, { withFileTypes: true }).flatMap((e) => (e.isDirectory() ? walk(path.join(dir, e.name)) : [path.join(dir, e.name)]));
for (const js of walk(path.join(root, 'dist-artifact')).filter((f) => /\.(m?js|css)$/.test(f))) {
  const src = readFileSync(js, 'utf8');
  const fixed = src.replace(/[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]/g, (c) => `\\x${c.charCodeAt(0).toString(16).padStart(2, '0').toUpperCase()}`);
  if (fixed !== src) {
    writeFileSync(js, fixed);
    console.log('escaped control characters in', path.relative(root, js));
  }
}
// Binary .gz files are not served by the host: store the OCR language model as base64 text
// (decoded again inside the OCR worker, see src/lib/ocr.ts).
const lang = path.join(root, 'dist-artifact', 'vendor', 'tessdata', 'eng.traineddata.gz');
writeFileSync(`${lang}.b64.txt`, readFileSync(lang).toString('base64'));
rmSync(lang);
console.log('dist-artifact/ ready');
