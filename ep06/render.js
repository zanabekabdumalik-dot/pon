// Рендер anim.html покадрово в headless Chromium.
//   node render.js                 → build/video.mp4 (без звука) + build/cues.json
//   node render.js --stills 1,5.5  → build/still_<t>.png для проверки отдельных моментов
const { chromium } = require('playwright-core');
const { spawn } = require('child_process');
const fs = require('fs');
const path = require('path');

const FPS = 60;
const BUILD = path.join(__dirname, 'build');
const argv = process.argv.slice(2);
const stillsArg = argv.includes('--stills') ? argv[argv.indexOf('--stills') + 1] : null;

async function main() {
  const tl = JSON.parse(fs.readFileSync(path.join(BUILD, 'timeline.json'), 'utf8'));
  const browser = await chromium.launch({ executablePath: process.env.CHROMIUM || '/opt/pw-browsers/chromium' });
  const page = await browser.newPage({ viewport: { width: 1080, height: 1920 } });
  let pageError = null;
  page.on('pageerror', e => { pageError = e; });
  page.on('console', m => { if (m.type() === 'error') console.error('[page]', m.text()); });
  await page.goto('file://' + path.join(__dirname, 'anim.html'));
  if (!await page.evaluate(() => window.ready())) throw new Error('шрифт не загрузился');
  const info = await page.evaluate(tl => window.setup(tl), tl);
  fs.writeFileSync(path.join(BUILD, 'cues.json'), JSON.stringify(info.cues, null, 1));

  const grab = (t, type, q) => page.evaluate(([t, type, q]) => {
    window.renderFrame(t);
    return document.getElementById('c').toDataURL(type, q);
  }, [t, type, q]);
  const toBuf = d => Buffer.from(d.slice(d.indexOf(',') + 1), 'base64');

  if (stillsArg) {
    for (const t of stillsArg.split(',').map(Number)) {
      fs.writeFileSync(path.join(BUILD, `still_${t.toFixed(2)}.png`), toBuf(await grab(t, 'image/png')));
      if (pageError) throw pageError;
    }
    await browser.close();
    return;
  }

  const n = Math.ceil(tl.total * FPS);
  const ff = spawn('ffmpeg', [
    '-y', '-loglevel', 'error', '-f', 'image2pipe', '-c:v', 'mjpeg', '-framerate', String(FPS), '-i', '-',
    '-c:v', 'libx264', '-preset', 'medium', '-crf', '17', '-pix_fmt', 'yuv420p', '-r', String(FPS),
    path.join(BUILD, 'video.mp4'),
  ], { stdio: ['pipe', 'inherit', 'inherit'] });
  const done = new Promise((res, rej) => ff.on('close', c => (c === 0 ? res() : rej(new Error(`ffmpeg вышел с кодом ${c}`)))));
  for (let i = 0; i < n; i++) {
    const buf = toBuf(await grab(i / FPS, 'image/jpeg', 0.96));
    if (pageError) throw pageError;
    if (!ff.stdin.write(buf)) await new Promise(r => ff.stdin.once('drain', r));
    if (i % 300 === 0) console.log(`кадр ${i}/${n}`);
  }
  ff.stdin.end();
  await done;
  await browser.close();
  console.log(`видео: ${n} кадров, ${(n / FPS).toFixed(2)} c`);
}

main().catch(e => { console.error(e); process.exit(1); });
