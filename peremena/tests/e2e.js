// End-to-end checks for «Перемена». Run: node tests/e2e.js [screenshotDir]
// Uses the globally installed Playwright + the preinstalled Chromium.
const path = require('path');
const { chromium } = require(process.env.PW_PATH || 'playwright');

const PAGE = 'file://' + path.resolve(__dirname, '..', 'index.html');
const SHOTS = process.argv[2] || path.resolve(__dirname, 'shots');
const results = [];
const check = (name, ok, info = '') => { results.push({ name, ok }); console.log((ok ? 'PASS ' : 'FAIL ') + name + (info ? '  — ' + info : '')); };
const sleep = ms => new Promise(r => setTimeout(r, ms));

async function newPage(browser, opts = {}) {
  const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, ...opts });
  const page = await ctx.newPage();
  page.errors = [];
  page.on('pageerror', e => page.errors.push(e.message));
  page.on('console', m => { if (m.type() === 'error' && !/fonts\.(googleapis|gstatic)/.test(m.text())) page.errors.push(m.text()); });
  return { ctx, page };
}
const state = page => page.evaluate(() => JSON.parse(localStorage.getItem('peremena.v1') || 'null'));
const text = (page, sel) => page.locator(sel).innerText();
const noHScroll = page => page.evaluate(() => document.documentElement.scrollWidth <= document.documentElement.clientWidth);

async function setDemo(page, focus, brk) {
  await page.click('#settingsBtn');
  await page.fill('#focusInput', String(focus));
  await page.fill('#breakInput', String(brk));
  if (!(await page.isChecked('#demoInput'))) await page.click('label[for="demoInput"]');
  await page.click('#settingsForm button[type="submit"]');
}

(async () => {
  const browser = await chromium.launch();
  require('fs').mkdirSync(SHOTS, { recursive: true });

  // 1. First open on a phone
  let { ctx, page } = await newPage(browser);
  await page.goto(PAGE);
  await page.waitForTimeout(400);
  check('loads without JS errors', page.errors.length === 0, page.errors.join(' | '));
  check('no horizontal scroll at 390px', await noHScroll(page));
  check('default timer shows 25:00', (await text(page, '#timeLabel')) === '25:00');
  check('start button says «Начать урок»', (await text(page, '#startBtn')) === 'Начать урок');
  await page.screenshot({ path: SHOTS + '/01-timer.png', fullPage: true });

  // 2. Settings validation: empty, zero, too big
  await page.click('#settingsBtn');
  await page.fill('#focusInput', '');
  await page.click('#settingsForm button[type="submit"]');
  check('empty lesson length shows an error', await page.isVisible('#focusErr'));
  check('dialog stays open on error', await page.isVisible('#settings'));
  await page.fill('#focusInput', '0');
  await page.click('#settingsForm button[type="submit"]');
  check('zero lesson length is rejected', await page.isVisible('#focusErr'));
  await page.fill('#focusInput', '500');
  await page.click('#settingsForm button[type="submit"]');
  check('500 minutes is rejected', await page.isVisible('#focusErr'));
  await page.screenshot({ path: SHOTS + '/02-settings-error.png' });
  await page.click('#closeSettings');

  // 3. Demo mode, start / pause / resume
  await setDemo(page, 2, 1);
  check('demo mode: timer shows 02:00', (await text(page, '#timeLabel')) === '02:00', await text(page, '#timeLabel'));
  check('custom preset note appears', await page.isVisible('#customNote'));
  await page.click('#startBtn');
  await sleep(700);
  check('button turns into «Пауза»', (await text(page, '#startBtn')) === 'Пауза');
  await page.click('#startBtn');
  const paused = await text(page, '#timeLabel');
  await sleep(1200);
  check('pause freezes the time', (await text(page, '#timeLabel')) === paused, paused);
  check('button says «Продолжить» after pause', (await text(page, '#startBtn')) === 'Продолжить');
  await page.click('#startBtn');

  // 4. Lesson ends -> break
  await page.waitForFunction(() => document.querySelector('#phaseLabel').textContent === 'Перемена!', null, { timeout: 5000 });
  let s = await state(page);
  check('lesson recorded in timetable', s.today.list.length === 1 && (await page.locator('#timetable li').count()) === 1);
  check('+10 points for the lesson', s.points === 10, 'points=' + s.points);
  check('break card offers a warm-up', await page.isVisible('#breakCard'));
  check('break timer runs on its own', s.timer.phase === 'break' && s.timer.running);
  await page.screenshot({ path: SHOTS + '/03-break.png', fullPage: true });

  // 5. Full warm-up (demo speed)
  await page.click('#breakWarmBtn');
  check('warm-up opens on its tab', await page.isVisible('#view-warmup') && await page.isVisible('#exTime'));
  await page.screenshot({ path: SHOTS + '/04-exercise.png', fullPage: true });
  await page.waitForSelector('.finish', { timeout: 40000 });
  s = await state(page);
  check('warm-up gives 4×5 + 10 bonus', s.points === 40, 'points=' + s.points);
  check('warm-up counted once', s.totals.warmups === 1);
  check('lesson row marked «разминка»', s.today.list[0].w === true);
  await page.screenshot({ path: SHOTS + '/05-warmup-done.png', fullPage: true });
  await page.click('#pToTimer');
  check('back on the timer tab', await page.isVisible('#view-timer'));
  check('badge «Первый звонок» earned', !!s.badges.first);

  // 6. Reload keeps everything
  await page.reload();
  await page.waitForTimeout(300);
  s = await state(page);
  check('state survives reload', s.points === 40 && s.today.list.length === 1);
  check('no JS errors after full flow', page.errors.length === 0, page.errors.join(' | '));

  // 7. Skip & reset
  await page.waitForFunction(() => document.querySelector('#phaseLabel').textContent === 'Урок', null, { timeout: 5000 });
  await page.click('#skipBtn');
  check('skip moves lesson -> break', (await text(page, '#phaseLabel')) === 'Перемена!');
  await page.click('#skipBtn');
  await page.click('#startBtn');
  await sleep(600);
  await page.click('#resetBtn');
  check('reset restores full time', (await text(page, '#timeLabel')) === '02:00');
  s = await state(page);
  check('skipping does not give points', s.points === 40);

  // 8. Progress tab
  await page.click('#tab-progress');
  check('progress shows level card', await page.isVisible('.grade'));
  await page.screenshot({ path: SHOTS + '/06-progress.png', fullPage: true });

  // 9. Sleep calculator
  await page.click('#tab-sleep');
  await page.fill('#wakeInput', '07:00');
  const beds = await page.locator('.beds .bt').allInnerTexts();
  check('wake 07:00 -> 21:45 / 22:45 / 20:45', beds.join(',') === '21:45,22:45,20:45', beds.join(','));
  await page.fill('#wakeInput', '00:30');
  const beds2 = await page.locator('.beds .bt').allInnerTexts();
  check('wake 00:30 wraps past midnight -> 15:15', beds2[0] === '15:15', beds2.join(','));
  await page.fill('#wakeInput', '');
  check('empty wake time shows a hint', await page.isVisible('#wakeErr'));
  await page.fill('#wakeInput', '07:00');
  await page.screenshot({ path: SHOTS + '/07-sleep.png', fullPage: true });

  // 10. English
  await page.click('#langBtn');
  for (const t of ['timer', 'warmup', 'sleep', 'progress']) {
    await page.click('#tab-' + t);
    const cyr = await page.evaluate(() => (document.body.innerText.match(/[А-Яа-яЁё]+/g) || []).join(' '));
    check('English ' + t + ' tab has no Russian text', !cyr, cyr.slice(0, 120));
  }
  await page.click('#tab-timer');
  await page.screenshot({ path: SHOTS + '/08-english.png', fullPage: true });
  await page.click('#langBtn');
  await ctx.close();

  // 11. Reload while a lesson is running and already over: counted exactly once
  ({ ctx, page } = await newPage(browser));
  await page.goto(PAGE);
  await setDemo(page, 1, 1);
  await page.click('#startBtn');
  await page.evaluate(() => { window.onbeforeunload = null; });
  await sleep(1500);
  await page.reload();
  await page.waitForTimeout(500);
  s = await state(page);
  check('lesson that ended during reload counted once', s.totals.sessions === 1 && s.today.list.length === 1, 'sessions=' + s.totals.sessions);
  await ctx.close();

  // 12. Empty progress + sample
  ({ ctx, page } = await newPage(browser));
  await page.goto(PAGE + '#progress');
  await page.waitForTimeout(300);
  check('deep link #progress opens progress', await page.isVisible('#view-progress'));
  check('empty progress has a call to action', await page.isVisible('#sampleBtn'));
  await page.click('#sampleBtn');
  check('example is clearly marked', await page.isVisible('.sample-banner'));
  await page.screenshot({ path: SHOTS + '/09-sample.png', fullPage: true });
  await ctx.close();

  // 13. Storage blocked (private mode / blocked site data)
  ({ ctx, page } = await newPage(browser));
  await page.addInitScript(() => {
    const boom = () => { throw new Error('blocked'); };
    Object.defineProperty(window, 'localStorage', { get: boom });
  });
  await page.goto(PAGE);
  await page.waitForTimeout(300);
  await page.click('#startBtn');
  await sleep(1600); // the label refreshes every 250 ms
  check('works with storage blocked', page.errors.length === 0 && (await text(page, '#timeLabel')) !== '25:00', page.errors.join(' | '));
  await ctx.close();

  // 14. Dark theme + desktop
  ({ ctx, page } = await newPage(browser, { colorScheme: 'dark' }));
  await page.goto(PAGE);
  await page.waitForTimeout(400);
  await page.screenshot({ path: SHOTS + '/10-dark.png', fullPage: true });
  await page.click('#quickBtn').catch(() => {});
  await page.click('#tab-warmup');
  await page.click('#quickBtn');
  await page.waitForTimeout(300);
  await page.screenshot({ path: SHOTS + '/11-dark-exercise.png', fullPage: true });
  await ctx.close();
  ({ ctx, page } = await newPage(browser, { viewport: { width: 1280, height: 860 } }));
  await page.goto(PAGE);
  await page.waitForTimeout(400);
  check('no horizontal scroll on desktop', await noHScroll(page));
  await page.screenshot({ path: SHOTS + '/12-desktop.png' });
  await ctx.close();

  // 15. Narrowest phones
  ({ ctx, page } = await newPage(browser, { viewport: { width: 320, height: 640 } }));
  await page.goto(PAGE);
  await page.waitForTimeout(300);
  const ok320 = [];
  for (const t of ['timer', 'warmup', 'sleep', 'progress']) { await page.click('#tab-' + t); ok320.push(await noHScroll(page)); }
  check('no horizontal scroll at 320px on any tab', ok320.every(Boolean), ok320.join(','));
  await ctx.close();

  await browser.close();
  const failed = results.filter(r => !r.ok).length;
  console.log(`\n${results.length - failed}/${results.length} checks passed`);
  process.exit(failed ? 1 : 0);
})().catch(e => { console.error(e); process.exit(2); });
