// node ../scripts/inspo-shoot.mjs <url> <tag> <outdir>   (run from frontend/, which has Playwright)
// Study a site's effects: the first 5 s (intro), then a slow scroll top to
// bottom, a frame every step, with the mouse moving (many effects follow it).
import { createRequire } from 'node:module';
const { chromium } = createRequire(process.cwd() + '/')('playwright');
const [url, tag, out] = process.argv.slice(2);
const b = await chromium.launch({ args: ['--use-gl=angle', '--enable-webgl', '--ignore-gpu-blocklist'] });
const p = await (await b.newContext({ viewport: { width: 1440, height: 900 } })).newPage();
await p.goto(url, { waitUntil: 'domcontentloaded', timeout: 60000 }).catch(e => console.log('goto', e.message));
for (let i = 0; i < 6; i++) { await p.waitForTimeout(900); await p.mouse.move(400 + i * 120, 300 + i * 40); await p.screenshot({ path: `${out}/${tag}-intro-${i}.jpg`, quality: 70, type: 'jpeg' }); }
// try to dismiss a cookie / enter gate
for (const t of ['Reject', 'Decline', 'Necessary', 'Got it', 'Enter', 'Start']) { const l = p.getByRole('button', { name: t, exact: false }).first(); if (await l.isVisible().catch(() => false)) { await l.click().catch(() => {}); break; } }
const H = await p.evaluate(() => Math.max(document.documentElement.scrollHeight, document.body.scrollHeight));
console.log(tag, 'height', H);
const N = 24;
for (let i = 1; i <= N; i++) {
  const y = Math.round((H - 900) * i / N);
  await p.mouse.wheel(0, 0); await p.evaluate(y => window.scrollTo(0, y), y);
  // wheel too, for sites that hijack the scroll
  await p.mouse.wheel(0, Math.round((H - 900) / N)); await p.mouse.move(300 + (i % 5) * 200, 250 + (i % 3) * 200);
  await p.waitForTimeout(1100);
  await p.screenshot({ path: `${out}/${tag}-s${String(i).padStart(2, '0')}.jpg`, quality: 70, type: 'jpeg' });
}
await b.close();
