// Рисует иконки приложения тем же кодом, что и Гаппо в игре, и кладёт их в android/res/.
// Нужен Playwright с Chromium:  node tools/render_icons.js
const path = require('path');
const fs = require('fs');
let playwright;
try { playwright = require('playwright'); } catch (e) { playwright = require(process.env.PLAYWRIGHT_PATH || '/opt/node22/lib/node_modules/playwright'); }

(async () => {
  const root = path.resolve(__dirname, '..');
  const page = await (await playwright.chromium.launch()).newPage();
  await page.goto('file://' + path.join(root, '..', 'index.html') + '#icon');
  await page.waitForFunction(() => typeof window.__gappoIcon === 'function');
  await page.evaluate(() => document.fonts && document.fonts.ready);
  const icons = { 'ic_launcher.png': [192, 'legacy'], 'ic_launcher_fg.png': [432, 'fg'], 'ic_launcher_bg.png': [432, 'bg'] };
  for (const [file, [size, layer]] of Object.entries(icons)) {
    const url = await page.evaluate(([s, l]) => window.__gappoIcon(s, l), [size, layer]);
    fs.writeFileSync(path.join(root, 'res', file), Buffer.from(url.split(',')[1], 'base64'));
    console.log('res/' + file, size + 'px');
  }
  await page.context().browser().close();
})();
