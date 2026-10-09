// Is anything cut off by a full-screen (pinned) section? For each pinned
// stage, at several scroll points, find visible text or controls that stick
// out past the stage's edges. Run across common laptop and phone sizes.
import { chromium } from 'playwright';
const sizes = [[1280, 650], [1366, 657], [1536, 753], [1280, 720], [1440, 900], [1920, 1080], [375, 667], [390, 844], [360, 640]];
const b = await chromium.launch();
let bad = 0;
for (const [w, h] of sizes) {
  const p = await (await b.newContext({ viewport: { width: w, height: h } })).newPage();
  await p.goto('http://localhost:4503/', { waitUntil: 'networkidle' });
  await p.evaluate(() => document.fonts.ready);
  const found = new Set();
  const acts = await p.evaluate(() => [...document.querySelectorAll('[data-sc-act="pin"]')].map((a) => [a.offsetTop, a.offsetHeight]));
  for (const [top, hgt] of acts) {
    for (const f of [0, 0.15, 0.3, 0.45, 0.6, 0.75, 0.9, 1]) {
      const r = await p.evaluate(async ({ top, hgt, f }) => {
        scrollTo(0, top + (hgt - innerHeight) * f);
        await new Promise((o) => setTimeout(o, 250));
        const out = [];
        for (const stage of document.querySelectorAll('[data-sc-stage]')) {
          const s = stage.getBoundingClientRect();
          if (s.bottom <= 0 || s.top >= innerHeight) continue;
          for (const el of stage.querySelectorAll('h1,h2,h3,p,li,a,button,dd,dt,[role=slider]')) {
            const cs = getComputedStyle(el); let op = 1;
            for (let n = el; n && n !== stage; n = n.parentElement) op *= Number(getComputedStyle(n).opacity);
            const e = el.getBoundingClientRect();
            if (op < 0.5 || cs.visibility === 'hidden' || e.width === 0 || !el.textContent.trim() && el.tagName !== 'svg') continue;
            // only judge what is inside the clipped side it belongs to
            const clipHost = el.closest('.side');
            if (clipHost && Number(getComputedStyle(clipHost).opacity) < 0.5) continue;
            if (e.top < s.top - 1 || e.bottom > s.bottom + 1) out.push(`"${el.textContent.trim().slice(0, 30)}" ${Math.round(Math.max(s.top - e.top, e.bottom - s.bottom))}px`);
          }
        }
        return out;
      }, { top, hgt, f });
      r.forEach((x) => found.add(x));
    }
  }
  if (found.size) bad++;
  console.log(`${w}x${h}`, found.size ? 'CUT OFF: ' + [...found].slice(0, 6).join(' | ') : 'ok');
  await p.close();
}
await b.close();
process.exitCode = bad ? 1 : 0;
