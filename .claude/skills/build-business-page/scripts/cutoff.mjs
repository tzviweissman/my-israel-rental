// Is anything cut off by a section that holds the screen (pinned / sticky)?
// Walks the page at nine screen sizes; at each scroll stop, any visible text
// or control sticking out past a held section's edges is reported.
//   Run from the project folder (it uses that project's Playwright):
//   node ~/.claude/skills/build-business-page/scripts/cutoff.mjs http://localhost:3000/
import { createRequire } from 'node:module';
const { chromium } = createRequire(process.cwd() + '/')('playwright');
const url = process.argv[2] || 'http://localhost:3000/';
const sizes = [[1280, 650], [1366, 657], [1536, 753], [1280, 720], [1440, 900], [1920, 1080], [375, 667], [390, 844], [360, 640]];
const b = await chromium.launch();
let bad = 0;
for (const [w, h] of sizes) {
  const p = await (await b.newContext({ viewport: { width: w, height: h } })).newPage();
  await p.goto(url, { waitUntil: 'networkidle' });
  await p.evaluate(() => document.fonts.ready);
  const max = await p.evaluate(() => document.documentElement.scrollHeight - innerHeight);
  const found = new Set();
  for (let y = 0; y <= max; y += Math.round(h / 3)) {
    const r = await p.evaluate(async (y) => {
      scrollTo(0, y);
      await new Promise((o) => setTimeout(o, 250));
      const held = [...document.querySelectorAll('body *')].filter((el) => {
        const cs = getComputedStyle(el);
        return el.matches('[data-sc-stage]') || ((cs.position === 'sticky' || cs.position === 'fixed') && el.getBoundingClientRect().height >= innerHeight * 0.9);
      });
      const out = [];
      for (const stage of held) {
        const s = stage.getBoundingClientRect();
        if (s.bottom <= 0 || s.top >= innerHeight) continue;
        for (const el of stage.querySelectorAll('h1,h2,h3,h4,p,li,a,button,dd,dt,label,input,select,[role=slider]')) {
          let op = 1, hidden = false;
          for (let n = el; n && n !== stage.parentElement; n = n.parentElement) {
            const cs = getComputedStyle(n);
            op *= Number(cs.opacity);
            if (cs.visibility === 'hidden' || cs.display === 'none') hidden = true;
          }
          const e = el.getBoundingClientRect();
          if (hidden || op < 0.5 || e.width === 0 || (!el.textContent.trim() && !el.matches('input,select'))) continue;
          if (e.top < s.top - 1 || e.bottom > s.bottom + 1 || e.bottom > innerHeight + 1)
            out.push(`"${el.textContent.trim().slice(0, 30)}" ${Math.round(Math.max(s.top - e.top, e.bottom - Math.min(s.bottom, innerHeight)))}px`);
        }
      }
      return out;
    }, y);
    r.forEach((x) => found.add(x));
  }
  if (found.size) bad++;
  console.log(`${w}x${h}`, found.size ? 'CUT OFF: ' + [...found].slice(0, 6).join(' | ') : 'ok');
  await p.close();
}
await b.close();
process.exitCode = bad ? 1 : 0;
