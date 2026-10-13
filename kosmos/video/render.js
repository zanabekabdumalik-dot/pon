// Покадровый рендер anim.html в headless Chromium.
//   node render.js 1                 → build/v1.mp4 (без звука) + build/v1.json (длительность, метки звуков)
//   node render.js 1 --stills 2,9.5  → build/v1_<t>.png для проверки отдельных моментов
//   node render.js 1 --lang en       → build/v1-en.mp4 и build/v1-en.json: английские титры
// Кадры всегда считаются по порядку от нуля: следы частиц зависят от предыдущих кадров.
const { chromium } = require('playwright-core');
const { spawn } = require('child_process');
const fs = require('fs');
const path = require('path');

const FPS = 30;
const BUILD = path.join(__dirname, 'build');
const argv = process.argv.slice(2);
const id = +argv[0];
const stillsArg = argv.includes('--stills') ? argv[argv.indexOf('--stills') + 1] : null;
const lang = argv.includes('--lang') ? argv[argv.indexOf('--lang') + 1] : 'ru';
const tag = `v${id}${lang === 'ru' ? '' : '-' + lang}`;

async function main() {
  if (![1, 2, 3].includes(id)) throw new Error('укажите номер ролика: 1, 2 или 3');
  fs.mkdirSync(BUILD, { recursive: true });
  const browser = await chromium.launch({ executablePath: process.env.CHROMIUM || '/opt/pw-browsers/chromium' });
  const page = await browser.newPage({ viewport: { width: 1080, height: 1920 } });
  let pageError = null;
  page.on('pageerror', e => { pageError = e; });
  page.on('console', m => { if (m.type() === 'error') console.error('[page]', m.text()); });
  await page.goto('file://' + path.join(__dirname, 'anim.html'));
  if (!await page.evaluate(() => window.ready())) throw new Error('шрифты не загрузились: запустите npm install');
  const info = await page.evaluate(([id, lang]) => window.setup(id, lang), [id, lang]);
  const n = Math.ceil(info.dur * FPS);
  const toBuf = d => Buffer.from(d.slice(d.indexOf(',') + 1), 'base64');

  if (stillsArg) {
    const want = stillsArg.split(',').map(Number).map(t => Math.round(t * FPS)).sort((a, b) => a - b);
    let i = 0;
    for (const target of want) {
      await page.evaluate(([from, to, fps]) => { for (let k = from; k < to; k++) window.renderFrame(k / fps); }, [i, target, FPS]);
      const d = await page.evaluate(([k, fps]) => { window.renderFrame(k / fps); return document.getElementById('c').toDataURL('image/png'); }, [target, FPS]);
      i = target + 1;
      fs.writeFileSync(path.join(BUILD, `${tag}_${(target / FPS).toFixed(2)}.png`), toBuf(d));
      if (pageError) throw pageError;
    }
    await browser.close();
    return;
  }

  const ff = spawn('ffmpeg', [
    '-y', '-loglevel', 'error', '-f', 'image2pipe', '-c:v', 'mjpeg', '-framerate', String(FPS), '-i', '-',
    '-c:v', 'libx264', '-preset', 'medium', '-crf', '18', '-pix_fmt', 'yuv420p', '-r', String(FPS),
    path.join(BUILD, `${tag}.mp4`),
  ], { stdio: ['pipe', 'inherit', 'inherit'] });
  const done = new Promise((res, rej) => ff.on('close', c => (c === 0 ? res() : rej(new Error(`ffmpeg вышел с кодом ${c}`)))));
  for (let i = 0; i < n; i++) {
    const d = await page.evaluate(([k, fps]) => { window.renderFrame(k / fps); return document.getElementById('c').toDataURL('image/jpeg', 0.95); }, [i, FPS]);
    if (pageError) throw pageError;
    const buf = toBuf(d);
    if (!ff.stdin.write(buf)) await new Promise(r => ff.stdin.once('drain', r));
    if (i % 150 === 0) console.log(`ролик ${id}: кадр ${i}/${n}`);
  }
  ff.stdin.end();
  await done;
  const cues = await page.evaluate(() => window.getCues());
  fs.writeFileSync(path.join(BUILD, `${tag}.json`), JSON.stringify({ ...info, cues }, null, 1));
  await browser.close();
  console.log(`ролик ${id}: ${n} кадров, ${(n / FPS).toFixed(2)} с`);
}

main().catch(e => { console.error(e); process.exit(1); });
