// Ground truth: at each size and scroll point, hide the knob, screenshot the
// page, and let the circle finder (python) locate the real dial; compare with
// where the knob sits. Prints the miss in px.
import { chromium } from 'playwright';
import { execFileSync } from 'node:child_process';
const sizes = [[1654, 862], [1440, 900], [1280, 720], [1920, 1080], [768, 1024], [390, 844]];
const b = await chromium.launch();
for (const [w, h] of sizes) {
  const p = await (await b.newContext({ viewport: { width: w, height: h } })).newPage();
  await p.goto('http://localhost:4503/', { waitUntil: 'networkidle' });
  await p.waitForTimeout(1200);
  const out = [];
  for (const f of [0.75, 0.9, 1.0]) {
    const k = await p.evaluate(async (f) => {
      const a = document.getElementById('split');
      scrollTo(0, a.offsetTop + (a.offsetHeight - innerHeight) * f);
      await new Promise((o) => setTimeout(o, 1500));
      const kp = document.getElementById('knob-pot'); const r = kp.getBoundingClientRect();
      kp.style.visibility = 'hidden';
      return { x: r.left + r.width / 2, y: r.top + r.height / 2, ring: r.width * 124 / 260 };
    }, f);
    await p.screenshot({ path: 'scrollcraft/builds/la-cholent/lab/truth.png' });
    await p.evaluate(() => { document.getElementById('knob-pot').style.visibility = ''; });
    const found = JSON.parse(execFileSync('backend/.venv/Scripts/python.exe', ['-c', `
import cv2, json
g = cv2.medianBlur(cv2.cvtColor(cv2.imread('scrollcraft/builds/la-cholent/lab/truth.png'), cv2.COLOR_BGR2GRAY), 5)
x, y, r = ${Math.round(k.x)}, ${Math.round(k.y)}, ${Math.round(k.ring)}
x0, y0 = max(0, x - 2*r), max(0, y - 2*r)
roi = g[y0:y + 2*r, x0:x + 2*r]
c = cv2.HoughCircles(roi, cv2.HOUGH_GRADIENT, dp=1.2, minDist=r, param1=80, param2=20, minRadius=int(r*0.3), maxRadius=int(r*0.8))
b = min(c[0], key=lambda k: roi[int(k[1]), int(k[0])]) if c is not None else None
print(json.dumps(None if b is None else [float(b[0] + x0), float(b[1] + y0), float(2 * b[2])]))
`]).toString());
    out.push(found ? `${Math.round(k.x - found[0])},${Math.round(k.y - found[1])} (ring ${Math.round(k.ring)} / dial ${Math.round(found[2])})` : 'dial not found');
  }
  console.log(`${w}x${h}  miss dx,dy at 75/90/100%:`, out.join('   '));
  await p.close();
}
await b.close();
