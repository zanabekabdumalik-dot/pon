// Generates the app icons and the Android splash screen from the GeneGuard logo
// (public/favicon.svg): Android launcher icons, splash images and the Windows icon.
//
//   npm run app-icons
//
// Needs a Chromium for Playwright, like `npm run samples`. The generated files are
// committed, so this is only needed if the logo changes.

import { mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { chromium } from 'playwright-core';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const res = path.join(root, 'android', 'app', 'src', 'main', 'res');
const desktopBuild = path.join(root, 'desktop', 'build');
const NAVY = '#0b1730';

const logo = readFileSync(path.join(root, 'public', 'favicon.svg'), 'utf8');
// The DNA mark without the rounded navy tile (for adaptive icons and the splash screen).
const mark = logo.replace(/<rect[^>]*\/>/, '');
const dataUrl = (svg) => `data:image/svg+xml;base64,${Buffer.from(svg).toString('base64')}`;

const browser = await chromium.launch(process.env.CHROMIUM ? { executablePath: process.env.CHROMIUM } : {});
const page = await browser.newPage();

async function render(file, width, height, body) {
  await page.setViewportSize({ width, height });
  await page.setContent(
    `<!doctype html><html><head><style>html,body{margin:0;width:${width}px;height:${height}px;overflow:hidden;background:transparent}
     .c{position:absolute;inset:0;display:flex;flex-direction:column;align-items:center;justify-content:center}</style></head>
     <body>${body}</body></html>`,
  );
  await page.evaluate(() => Promise.all([...document.images].map((i) => i.decode())));
  const png = await page.screenshot({ omitBackground: true, type: 'png' });
  mkdirSync(path.dirname(file), { recursive: true });
  writeFileSync(file, png);
  return png;
}

// Android launcher icons: legacy square, round, and the adaptive-icon foreground (108dp canvas,
// the mark kept inside the 66dp safe zone). The adaptive background is the navy colour resource.
const densities = { mdpi: 1, hdpi: 1.5, xhdpi: 2, xxhdpi: 3, xxxhdpi: 4 };
for (const [d, k] of Object.entries(densities)) {
  const s = Math.round(48 * k);
  await render(path.join(res, `mipmap-${d}`, 'ic_launcher.png'), s, s, `<img src="${dataUrl(logo)}" width="${s}" height="${s}">`);
  await render(
    path.join(res, `mipmap-${d}`, 'ic_launcher_round.png'),
    s,
    s,
    `<div class="c" style="border-radius:50%;background:${NAVY}"><img src="${dataUrl(mark)}" width="${Math.round(s * 0.92)}" height="${Math.round(s * 0.92)}"></div>`,
  );
  const f = Math.round(108 * k);
  await render(path.join(res, `mipmap-${d}`, 'ic_launcher_foreground.png'), f, f, `<div class="c"><img src="${dataUrl(mark)}" width="${Math.round(f * 0.8)}" height="${Math.round(f * 0.8)}"></div>`);
}

// Android splash images (shown while the app starts on Android 11 and older).
const splash = (w, h) => {
  const icon = Math.round(Math.min(w, h) * 0.3);
  return `<div class="c" style="background:${NAVY};gap:${Math.round(icon * 0.12)}px;font-family:Roboto,Arial,sans-serif">
    <img src="${dataUrl(logo)}" width="${icon}" height="${icon}">
    <div style="color:#fff;font-weight:700;font-size:${Math.round(icon * 0.22)}px">GeneGuard AI</div></div>`;
};
const sizes = { mdpi: [320, 480], hdpi: [480, 800], xhdpi: [720, 1280], xxhdpi: [960, 1600], xxxhdpi: [1280, 1920] };
for (const [d, [w, h]] of Object.entries(sizes)) {
  await render(path.join(res, `drawable-port-${d}`, 'splash.png'), w, h, splash(w, h));
  await render(path.join(res, `drawable-land-${d}`, 'splash.png'), h, w, splash(h, w));
}
await render(path.join(res, 'drawable', 'splash.png'), 480, 320, splash(480, 320));

// Windows icon: a multi-size .ico (PNG images inside) plus a 512px PNG for the window.
const icoSizes = [16, 24, 32, 48, 64, 128, 256];
const images = [];
for (const s of icoSizes) images.push(await render(path.join(desktopBuild, '.tmp.png'), s, s, `<img src="${dataUrl(logo)}" width="${s}" height="${s}">`));
await render(path.join(desktopBuild, 'icon.png'), 512, 512, `<img src="${dataUrl(logo)}" width="512" height="512">`);
await browser.close();

const header = Buffer.alloc(6 + 16 * images.length);
header.writeUInt16LE(0, 0);
header.writeUInt16LE(1, 2); // icon
header.writeUInt16LE(images.length, 4);
let offset = header.length;
images.forEach((img, i) => {
  const s = icoSizes[i];
  const e = 6 + 16 * i;
  header.writeUInt8(s >= 256 ? 0 : s, e);
  header.writeUInt8(s >= 256 ? 0 : s, e + 1);
  header.writeUInt16LE(1, e + 4); // colour planes
  header.writeUInt16LE(32, e + 6); // bits per pixel
  header.writeUInt32LE(img.length, e + 8);
  header.writeUInt32LE(offset, e + 12);
  offset += img.length;
});
writeFileSync(path.join(desktopBuild, 'icon.ico'), Buffer.concat([header, ...images]));
rmSync(path.join(desktopBuild, '.tmp.png'), { force: true });
console.log('App icons written to android/app/src/main/res and desktop/build');
