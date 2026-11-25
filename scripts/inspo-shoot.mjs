// node ../scripts/inspo-shoot.mjs <url> <tag> <outdir> [--phone]   (run from frontend/, which has Playwright)
// Study a site's effects: the first 5 s (intro), then a slow scroll top to
// bottom, a frame every step, with the mouse moving (many effects follow it).
// Waits past cookie bars and loaders first (25 Nov 2026: several saved screens were only a black loader or a
// cookie wall, so their look could not be judged): the intro starts once a screen holds real content.
import { createRequire } from 'node:module';
const { chromium } = createRequire(process.cwd() + '/')('playwright');
const [url, tag, out] = process.argv.slice(2);
const phone = process.argv.includes('--phone');
const W = phone ? 390 : 1440, VH = phone ? 844 : 900;
const b = await chromium.launch({ args: ['--use-gl=angle', '--enable-webgl', '--ignore-gpu-blocklist'] });
const p = await (await b.newContext({ viewport: { width: W, height: VH }, ...(phone ? { isMobile: true, hasTouch: true, deviceScaleFactor: 2 } : {}) })).newPage();
await p.goto(url, { waitUntil: 'domcontentloaded', timeout: 60000 }).catch(e => console.log('goto', e.message));
// dismiss a cookie bar or enter gate, declining where we can
async function dismiss() {
  for (const t of ['Reject', 'Decline', 'Necessary', 'Got it', 'Enter', 'Start']) { const l = p.getByRole('button', { name: t, exact: false }).first(); if (await l.isVisible().catch(() => false)) { await l.click().catch(() => {}); return; } }
}
// a blank or one-colour loader screen compresses to a tiny jpeg; real content does not
// ponytail: size heuristic, 40 KB at 1440x900; a site whose real first screen is one flat colour waits the full 20 s, then goes on
for (let t = 0; t < 20; t++) {
  await dismiss();
  if ((await p.screenshot({ type: 'jpeg', quality: 70 })).length > (phone ? 25000 : 40000)) break;
  await p.waitForTimeout(1000);
}
for (let i = 0; i < 6; i++) { await p.waitForTimeout(900); await p.mouse.move(Math.min(W - 10, 400 + i * 120), 300 + i * 40); await p.screenshot({ path: `${out}/${tag}-intro-${i}.jpg`, quality: 70, type: 'jpeg' }); }
await dismiss();
const H = await p.evaluate(() => Math.max(document.documentElement.scrollHeight, document.body.scrollHeight));
console.log(tag, 'height', H);
const N = 24;
for (let i = 1; i <= N; i++) {
  const y = Math.round((H - VH) * i / N);
  await p.mouse.wheel(0, 0); await p.evaluate(y => window.scrollTo(0, y), y);
  // wheel too, for sites that hijack the scroll
  await p.mouse.wheel(0, Math.round((H - VH) / N)); await p.mouse.move(Math.min(W - 10, 300 + (i % 5) * 200), 250 + (i % 3) * 200);
  await p.waitForTimeout(1100);
  await p.screenshot({ path: `${out}/${tag}-s${String(i).padStart(2, '0')}.jpg`, quality: 70, type: 'jpeg' });
}
await b.close();
