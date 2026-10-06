// Does an overlay sit on the real thing in the picture under it? At six
// screen sizes and a few scroll positions: hide the overlay, screenshot, find
// the real circular object near it (OpenCV HoughCircles), print the miss in px.
// Over 4px fails. Written for a round target (a dial, a button, a plate); for
// another shape swap the detector (edge or colour match), keep the method.
//   Run from the project folder (needs Playwright there, and python with cv2):
//   node ~/.claude/skills/build-business-page/scripts/overlay-truth.mjs <url> <overlay selector> <section selector> [fractions ...]
//   e.g. ... overlay-truth.mjs http://localhost:4503/ "#knob-pot" "#split" 0.75 0.9 1
// Fractions are how far through the (pinned) section to scroll; pick the
// moments the overlay is meant to be on its target.
// PYTHON env var picks the interpreter (default: python).
import { createRequire } from 'node:module';
import { execFileSync } from 'node:child_process';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
const { chromium } = createRequire(process.cwd() + '/')('playwright');
const [url, sel, section, ...fs] = process.argv.slice(2);
const stops = fs.length ? fs.map(Number) : [0.75, 0.9, 1];
const shot = join(tmpdir(), 'overlay-truth.png');
const sizes = [[1654, 862], [1440, 900], [1280, 720], [1920, 1080], [768, 1024], [390, 844]];
const b = await chromium.launch();
let worst = 0;
for (const [w, h] of sizes) {
  const p = await (await b.newContext({ viewport: { width: w, height: h } })).newPage();
  await p.goto(url, { waitUntil: 'networkidle' });
  await p.waitForTimeout(1200);
  const out = [];
  for (const f of stops) {
    const k = await p.evaluate(async ({ sel, section, f }) => {
      const a = document.querySelector(section);
      scrollTo(0, a.offsetTop + (a.offsetHeight - innerHeight) * f);
      await new Promise((o) => setTimeout(o, 1500));
      const el = document.querySelector(sel); const r = el.getBoundingClientRect();
      el.style.visibility = 'hidden';
      return { x: r.left + r.width / 2, y: r.top + r.height / 2, r: r.width / 2 };
    }, { sel, section, f });
    await p.screenshot({ path: shot });
    await p.evaluate((sel) => { document.querySelector(sel).style.visibility = ''; }, sel);
    const found = JSON.parse(execFileSync(process.env.PYTHON || 'python', ['-c', `
import cv2, json
g = cv2.medianBlur(cv2.cvtColor(cv2.imread(r'${shot}'), cv2.COLOR_BGR2GRAY), 5)
x, y, r = ${Math.round(k.x)}, ${Math.round(k.y)}, ${Math.max(4, Math.round(k.r))}
x0, y0 = max(0, x - 2*r), max(0, y - 2*r)
roi = g[y0:y + 2*r, x0:x + 2*r]
c = cv2.HoughCircles(roi, cv2.HOUGH_GRADIENT, dp=1.2, minDist=r, param1=80, param2=20, minRadius=int(r*0.3), maxRadius=int(r*0.8))
b = min(c[0], key=lambda q: roi[int(q[1]), int(q[0])]) if c is not None else None  # darkest centre: the dial, not a rim or label
print(json.dumps(None if b is None else [float(b[0] + x0), float(b[1] + y0)]))
`]).toString());
    if (!found) { out.push('not found'); continue; }
    const miss = Math.max(Math.abs(k.x - found[0]), Math.abs(k.y - found[1]));  // worst axis, as the rule is written
    worst = Math.max(worst, miss);
    out.push(`${Math.round(miss)}px`);
  }
  console.log(`${w}x${h}  miss:`, out.join('  '));
  await p.close();
}
await b.close();
console.log(worst > 4 ? `FAIL: worst miss ${Math.round(worst)}px (max 4)` : 'ok: every overlay within 4px');
process.exitCode = worst > 4 ? 1 : 0;
