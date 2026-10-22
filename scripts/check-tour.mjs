#!/usr/bin/env node
/**
 * Walk the business tour and measure every stop (19 Oct 2026, "make sure the
 * tour is smooth and not glitchy"). Laptop and phone: how long each bubble
 * takes to show, whether it moves once visible (sampled every 100ms for 2s),
 * whether the backdrop vanishes between stops (every frame), and whether the
 * bubble is off screen. Writes a screenshot per stop and report.json.
 *
 * Needs the local frontend and API with DEV_AUTOLOGIN (?as=owner signs in).
 * The tour resumes where the account last stopped; a full run ends it, so the
 * next run starts at stop 1.
 *
 *   node scripts/check-tour.mjs [base=http://localhost:3210] [outdir=tour-shots] [he]
 *   "he" switches the browser to Hebrew; an account whose saved language is
 *   English overrides that after sign-in.
 */
import fs from 'node:fs';
import path from 'node:path';
import { createRequire } from 'node:module';

const ROOT = path.resolve(path.dirname(new URL(import.meta.url).pathname.replace(/^\/([A-Za-z]:)/, '$1')), '..');
const require = createRequire(path.join(ROOT, 'frontend', 'package.json'));
const { chromium } = require('playwright');
const BASE = process.argv[2] || 'http://localhost:3210';
const OUT = process.argv[3] || 'tour-shots';
fs.mkdirSync(OUT, { recursive: true });

const SIZES = [{ name: 'laptop', width: 1366, height: 768 }, { name: 'phone', width: 390, height: 844, mobile: true }];
const browser = await chromium.launch();
const report = [];

for (const size of SIZES) {
  const ctx = await browser.newContext({ viewport: { width: size.width, height: size.height }, isMobile: !!size.mobile, hasTouch: !!size.mobile });
  if (process.argv[4] === 'he') await ctx.addInitScript(() => { try { localStorage.setItem('i18nextLng', 'he'); } catch {} });
  const page = await ctx.newPage();
  page.setDefaultNavigationTimeout(180000);
  page.setDefaultTimeout(60000);
  const errors = [];
  page.on('pageerror', (e) => errors.push(e.message));
  await page.goto(`${BASE}/dashboard?tab=overview&as=owner${process.argv[4] === 'he' ? '&lng=he' : ''}`, { waitUntil: 'networkidle' });
  await page.waitForTimeout(3000);
  await page.goto(`${BASE}/dashboard?tab=overview&tour=1`, { waitUntil: 'networkidle' });

  let prevTitle = '';
  for (let stop = 1; stop <= 30; stop += 1) {
    const t0 = Date.now();
    // Wait for THIS stop's bubble: a new title, not the previous one lingering.
    const ok = await page.waitForFunction((prev) => {
      const el = document.querySelector('[data-testid=tour-tooltip]');
      const title = el ? el.innerText.split(/\n/)[0] : '';
      return el && title && title !== prev;
    }, prevTitle, { timeout: 90000 }).then(() => true).catch(() => false);
    if (!ok) { report.push({ size: size.name, stop, problem: 'no new bubble within 20s' }); break; }
    const appearMs = Date.now() - t0;
    const gapFrames = await page.evaluate(() => window.__gap || 0).catch(() => -1);
    // Sample every 100ms for 2s: any movement after it shows is a jump.
    const samples = [];
    for (let i = 0; i < 20; i += 1) {
      samples.push(await page.evaluate(() => {
        const r = (el) => { if (!el) return null; const b = el.getBoundingClientRect(); return { x: Math.round(b.x), y: Math.round(b.y), w: Math.round(b.width), h: Math.round(b.height) }; };
        const tipEl = document.querySelector('[data-testid=tour-tooltip]');
        const ring = document.querySelector('[data-testid=tour-overlay] [data-testid=tour-ring], [data-testid=tour-overlay] > div:not([role])');
        return { dir: document.documentElement.dir, op: tipEl ? Number(getComputedStyle(tipEl).opacity) : 0, tip: r(tipEl), ring: r(ring), title: (tipEl?.innerText || '').split('\n')[0], progress: document.querySelector('[data-testid=tour-progress]')?.innerText || '', vw: innerWidth, vh: innerHeight, sx: scrollX };
      }));
      await page.waitForTimeout(100);
    }
    const good = samples.filter((x) => !x.navigated && x.op > 0.05);
    const first = good[0] || samples[0];
    const last = good[good.length - 1] || samples[samples.length - 1];
    const drift = Math.max(0, ...samples.filter((s) => s.tip && first.tip).map((s) => Math.max(Math.abs(s.tip.x - first.tip.x), Math.abs(s.tip.y - first.tip.y))));
    let lastMoveMs = 0;
    samples.forEach((s, i) => { if (i && s.tip && samples[i - 1].tip && (Math.abs(s.tip.x - samples[i - 1].tip.x) > 2 || Math.abs(s.tip.y - samples[i - 1].tip.y) > 2)) lastMoveMs = i * 100; });
    const moved = drift > 2;
    const navigated = samples.some((x) => x.navigated);
    const urls = [...new Set(samples.map((x) => x.url).filter(Boolean))];
    const t = last.tip;
    const off = t && (t.x < 0 || t.y < 0 || t.x + t.w > last.vw + 1 || t.y + t.h > last.vh + 1);
    await page.screenshot({ path: path.join(OUT, `${size.name}-${String(stop).padStart(2, '0')}.png`) });
    report.push({ size: size.name, stop, progress: last.progress.replace(/\s+/g, ' ').trim(), title: last.title || first.title, dir: last.dir, appearMs, gapFrames, moved, drift, lastMoveMs, navigated, urls, offscreen: !!off, hscroll: last.sx !== 0 });
    const next = await page.$('[data-testid=tour-next]');
    if (!next) break;
    const label = (await next.innerText()).trim();
    prevTitle = last.title || first.title;
    await page.evaluate(() => {
      window.__gap = 0;
      const t0 = performance.now();
      const tick = () => {
        const dim = document.querySelector('[data-testid=tour-overlay], [data-testid=tour-between], [data-testid=tour-paused]');
        if (!dim) window.__gap += 1;
        if (performance.now() - t0 < 6000) requestAnimationFrame(tick);
      };
      requestAnimationFrame(tick);
    }).catch(() => {});
    await next.click();
    if (/finish|done|סיום/i.test(label)) break;
    await page.waitForTimeout(300);
  }
  report.push({ size: size.name, pageErrors: [...new Set(errors)].slice(0, 5) });
  await ctx.close();
}
await browser.close();
fs.writeFileSync(path.join(OUT, 'report.json'), JSON.stringify(report, null, 1));
for (const r of report) console.log(JSON.stringify(r));
