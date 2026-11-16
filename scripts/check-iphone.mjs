#!/usr/bin/env node
/*
 * The page as an iPhone shows it (rule 3aa.30; Gremier, 14 Nov 2026: the beans poured in Chrome and stood still on
 * Tzvi's iPhone, "I can't see it on my phone"). Every other check runs in Chrome; an iPhone runs Safari's engine,
 * which loads no video data until a video is played, so a film led only by seeking sits on its first frame there.
 *
 *   node scripts/check-iphone.mjs <url> [more urls]
 *
 * Opens each page in WebKit as an iPhone 13 (390 x 844, touch), waits 4 s without scrolling. Fails (exit 1):
 *   ERROR   a script error on the page
 *   WIDE    the page is wider than the screen (it scrolls sideways)
 *   INTRO   a slides opening with no data-intro (sitekit.opening_slides(intro=...), rules 3aa.29)
 *   FROZEN  the opening says its first clip plays on arrival (data-intro over 0) and it has not moved after 4 s
 *   STUCK   an opening that plays by itself on a phone (one screen tall, rules 3ac.1) has not reached its closing words
 *           (.at-end) within 40 s (Gremier, 16 Nov 2026: the next-clip line sat inside a comment and phones stopped on clip one)
 */
import { webkit, devices } from 'playwright';

const urls = process.argv.slice(2);
if (!urls.length) { console.error('usage: node scripts/check-iphone.mjs <url> [more urls]'); process.exit(2); }
const browser = await webkit.launch();
const problems = [];
for (const url of urls) {
  // "mir-check" in the user agent: the live site does not count this run as a visitor (utils/view_tracking.py).
  const ctx = await browser.newContext({ ...devices['iPhone 13'], userAgent: `${devices['iPhone 13'].userAgent} mir-check` });
  const page = await ctx.newPage();
  const errs = [];
  // WebKit reports a blocked network call as a page error even when the page catches it (the gift-card call to a local
  // API that is not running, 15 Nov 2026): a request failing is not a script error, so those are not counted
  page.on('pageerror', (e) => { if (!/due to access control checks|Fetch API cannot load|Load failed/i.test(e.message)) errs.push(e.message); });
  await page.goto(url, { waitUntil: 'load' });
  await page.waitForTimeout(4000);
  const r = await page.evaluate(() => {
    const film = document.querySelector('.film.slides'), v = film && film.querySelector('video');
    return {
      wide: document.documentElement.scrollWidth - innerWidth,
      slides: !!film, intro: film ? film.getAttribute('data-intro') : null, t: v ? v.currentTime : null,
    };
  });
  if (r.slides && await page.evaluate(() => { const f = document.querySelector('.film.slides'); return f.style.height === '100svh' && f.querySelectorAll('.slide').length > 1; })) {
    let end = false;
    for (let i = 0; i < 36 && !end; i++) { await page.waitForTimeout(1000); end = await page.evaluate(() => document.querySelector('.film.slides').classList.contains('at-end')); }
    if (!end) problems.push(`STUCK   ${url}: the opening plays by itself on a phone and had not reached its closing words after 40 s (${await page.evaluate(() => document.querySelector('.film.slides .track').style.transform)})`);
  }
  for (const e of errs) problems.push(`ERROR   ${url}: ${e.slice(0, 160)}`);
  if (r.wide > 1) problems.push(`WIDE    ${url}: ${r.wide}px wider than an iPhone screen`);
  if (r.slides && r.intro === null) problems.push(`INTRO   ${url}: the opening has no data-intro: say how many seconds of the first clip play on arrival, or 0 (3aa.29)`);
  if (r.slides && +r.intro > 0 && !(r.t > 0.3)) problems.push(`FROZEN  ${url}: the first clip should play ${r.intro} s on arrival and stood at ${r.t === null ? 'no video' : r.t.toFixed(2) + ' s'} on an iPhone`);
  console.log(`${url}: checked`);
  await ctx.close();
}
await browser.close();
if (problems.length) { console.log(problems.join('\n')); process.exit(1); }
console.log('check-iphone: ok');
