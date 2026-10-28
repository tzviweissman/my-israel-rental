#!/usr/bin/env node
/**
 * Is the page smooth on a phone? (Tzvi, 26-27 Oct 2026: "the pages arent so smooth on mobile",
 * then "how can we get it right more often the first time": a measured limit, not a rule to remember.)
 *
 *   node scripts/check-speed.mjs <url> [more urls]
 *
 * Each page on a phone-sized Chrome (390x844, 3x pixels) slowed 4x, which is about what an iPhone gives
 * a web page: scroll the first three screens a frame at a time and time each frame, then leave it alone
 * for 2 s and measure how busy it stays. Fails (exit 1) with:
 *   HEAVY  the average scrolled frame takes over LIMIT_MS (a plain page takes ~17; the openings that
 *          stuttered on Tzvi's phone took 56 to 284; the fixed ones 17 to 35)
 *   BUSY   the page keeps working over IDLE_PCT% of the time while nobody touches it (a loop that never
 *          stops, clips playing out of sight: Whipped Cup was 94%, L.A. Cholent 98%)
 * Both are timing measures, so publish-page runs this once more before a failure counts.
 * Run from the repo (it uses its Playwright).
 */
import { createRequire } from 'node:module';
const { chromium } = createRequire(process.cwd() + '/')('playwright');

const LIMIT_MS = 45, IDLE_PCT = 30;
const urls = process.argv.slice(2);
if (!urls.length) { console.error('usage: node scripts/check-speed.mjs <url> [more urls]'); process.exit(2); }
const b = await chromium.launch();
let bad = 0;
for (const url of urls) {
  const ctx = await b.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 3, isMobile: true, hasTouch: true });
  const p = await ctx.newPage();
  const cdp = await ctx.newCDPSession(p);
  try {
    await p.goto(url, { waitUntil: 'load', timeout: 90000 });
    await p.waitForTimeout(3000);   // first pictures and fonts in; what loads later is the page's own business
    await cdp.send('Emulation.setCPUThrottlingRate', { rate: 4 });
    await cdp.send('Performance.enable');
    const m = async () => Object.fromEntries((await cdp.send('Performance.getMetrics')).metrics.map((x) => [x.name, x.value]));
    const a = await m(); await p.waitForTimeout(2000); const z = await m();
    const idle = Math.round((z.TaskDuration - a.TaskDuration) / (z.Timestamp - a.Timestamp) * 100);
    const ms = await p.evaluate(async () => {
      document.documentElement.style.scrollBehavior = 'auto';
      const target = Math.min(document.documentElement.scrollHeight - innerHeight, innerHeight * 3), steps = 90;
      if (target < innerHeight * 0.5) return null;   // nothing to scroll
      const t0 = performance.now();
      for (let i = 1; i <= steps; i++) { scrollTo(0, Math.round(target * i / steps)); await new Promise((r) => requestAnimationFrame(() => r())); }
      return (performance.now() - t0) / steps;
    });
    const name = url.replace(/^https?:\/\/[^/]+\//, '') || url;
    if (ms != null && ms > LIMIT_MS) { bad++; console.log(`HEAVY  ${name}: ${Math.round(ms)} ms a scrolled frame on a slowed phone (limit ${LIMIT_MS}). Look for: a picture decoded on every frame (draw only when the frame changes, keep a few decoded), styles rewritten every frame (write only what changed; never set a CSS custom property on a parent of many elements per frame), layout read after each write, a canvas larger than its pictures, many pieces moved by style each frame (tie them to the scroll with animations instead, as the home opening does), a big picture inside every piece (give each only its own part)`); }
    if (idle > IDLE_PCT) { bad++; console.log(`BUSY   ${name}: ${idle}% busy while nobody touches it (limit ${IDLE_PCT}%). Look for: a requestAnimationFrame loop that never stops (run it only while its scene is on screen and moving), clips playing out of sight, text rewritten every frame`); }
    console.log(`${name}: ${ms == null ? 'no scroll' : Math.round(ms) + ' ms/frame'}, idle ${idle}%`);
  } catch (e) {
    bad++; console.log(`BROKEN ${url}: ${e.message.split('\n')[0]}`);
  }
  await ctx.close();
}
await b.close();
console.log(bad ? `speed: ${bad} problem(s)` : 'speed: every page is smooth on a slowed phone');
process.exit(bad ? 1 : 0);
