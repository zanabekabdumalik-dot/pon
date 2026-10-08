// Builds the self-contained embedded version (dist-artifact/) used for the shareable link.
//
//   npm run build:artifact
//
// The page is a single HTML file: all JavaScript (one classic script, no ES modules) and
// CSS are inlined, so it does not depend on how the host serves separate script files.
// Only the large OCR files (Tesseract WebAssembly core, language model) and the sample
// documents stay separate, as classic scripts loaded when OCR or a sample is used.

import { mkdirSync, readdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { build } from 'vite';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const out = path.join(root, 'dist-artifact');
process.env.VITE_TARGET = 'artifact';
await build({ root, logLevel: 'warn' });

const html = readFileSync(path.join(out, 'index.html'), 'utf8');
const scriptSrc = /<script[^>]*src="\.\/(assets\/[^"]+\.js)"[^>]*><\/script>/.exec(html)?.[1];
const cssHref = /<link rel="stylesheet"[^>]*href="\.\/(assets\/[^"]+\.css)"[^>]*>/.exec(html)?.[1];
if (!scriptSrc || !cssHref) throw new Error('Could not find the built script or stylesheet in index.html');

// The host accepts only text without raw control characters; minified libraries contain a few
// inside string literals. \xHH escapes are read by JavaScript as exactly the same characters.
const escapeControls = (s) => s.replace(/[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]/g, (c) => `\\x${c.charCodeAt(0).toString(16).padStart(2, '0').toUpperCase()}`);
const js = escapeControls(readFileSync(path.join(out, scriptSrc), 'utf8')).replace(/<\/(script)/gi, '<\\/$1').replace(/<!--/g, '<\\!--');
const css = escapeControls(readFileSync(path.join(out, cssHref), 'utf8')).replace(/<\/(style)/gi, '<\\/$1');

const pick = (re) => [...html.matchAll(re)].map((m) => m[0]).join('\n');
const page = `${pick(/<title>[\s\S]*?<\/title>/g)}
${pick(/<meta name="description"[^>]*>/g)}
<style>${css}</style>
${pick(/<script>[\s\S]*?<\/script>/g)}
<div id="root"><div id="gg-boot" style="font:15px system-ui,sans-serif;max-width:32rem;margin:15vh auto;padding:0 16px;text-align:center;color:#334155">
  <div style="font-size:22px;font-weight:700;color:#0d1b2e">GeneGuard AI</div>
  <p id="gg-boot-msg">Loading…</p>
</div></div>
<script>
// Start-up guard: if the app cannot start in this viewer, say why instead of showing a blank page.
(function () {
  var errors = [];
  window.addEventListener('error', function (e) { errors.push(e.message || 'resource failed to load'); }, true);
  window.addEventListener('unhandledrejection', function (e) { errors.push(String((e.reason && e.reason.message) || e.reason)); });
  setTimeout(function () {
    var msg = document.getElementById('gg-boot-msg');
    if (!msg) return; // the app has started
    msg.innerHTML = 'The app could not start in this viewer.' + (errors.length ? '<br><small style="color:#b42318">' + errors.slice(0, 3).join('<br>').replace(/</g, '&lt;') + '</small>' : '') +
      '<br><br>Try reloading the page or opening the link in Chrome, Safari or Edge.';
  }, 12000);
})();
</script>
<script>${js}</script>
`;
writeFileSync(path.join(out, 'index.html'), page);

// Everything under assets/ is now inside the page.
rmSync(path.join(out, 'assets'), { recursive: true, force: true });
rmSync(path.join(out, 'vendor', 'tesseract'), { recursive: true, force: true }); // worker is bundled

// Binary files and fetch() may not work on the host, but classic scripts always load.
// So the OCR language model and the sample documents ship as scripts with base64 data
// (decoded in src/lib/ocr.ts and src/lib/files.ts).
const lang = path.join(out, 'vendor', 'tessdata', 'eng.traineddata.gz');
writeFileSync(path.join(out, 'vendor', 'tessdata', 'eng-traineddata.js'), `self.GG_ENG_TRAINEDDATA=${JSON.stringify(readFileSync(lang).toString('base64'))};\n`);
rmSync(lang);
const samplesDir = path.join(out, 'samples');
const samples = Object.fromEntries(readdirSync(samplesDir).map((f) => [f, readFileSync(path.join(samplesDir, f)).toString('base64')]));
rmSync(samplesDir, { recursive: true });
mkdirSync(samplesDir);
writeFileSync(path.join(samplesDir, 'samples.js'), `window.GG_SAMPLES=${JSON.stringify(samples)};\n`);

const walk = (dir) => readdirSync(dir, { withFileTypes: true }).flatMap((e) => (e.isDirectory() ? walk(path.join(dir, e.name)) : [path.join(dir, e.name)]));
for (const f of walk(out)) console.log(`  ${path.relative(out, f).padEnd(52)} ${(readFileSync(f).length / 1024).toFixed(0)} KB`);
console.log('dist-artifact/ ready');
