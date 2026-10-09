// Where the knob sits against the pot's real dial (measured in the clip) at
// several scroll positions, for one viewport. Prints the miss in pixels.
import { chromium } from 'playwright';
const [w, h] = [Number(process.argv[2]), Number(process.argv[3])];
const b = await chromium.launch();
const p = await (await b.newContext({ viewport: { width: w, height: h } })).newPage();
await p.goto('http://localhost:4503/', { waitUntil: 'networkidle' });
await p.waitForTimeout(1500);
for (const f of [0.68, 0.8, 0.92, 1.0, 1.06]) {
  const r = await p.evaluate(async (f) => {
    const act = document.getElementById('split');
    scrollTo(0, act.offsetTop + (act.offsetHeight - innerHeight) * f);
    await new Promise((ok) => setTimeout(ok, 1400));
    const v = document.getElementById('pot'); const ct = v.currentTime / v.duration;
    // measured: frame 0 .. last, x y diameter, as fractions of the frame
    const pts = [[0, .6784, .6983, .07], [.25, .6766, .705, .0732], [.5, .6734, .7172, .0758], [.75, .6647, .7328, .076], [1, .6553, .7483, .0789]];
    let i = 0; while (i < pts.length - 2 && ct > pts[i + 1][0]) i++;
    const [a, z] = [pts[i], pts[i + 1]], t = (ct - a[0]) / (z[0] - a[0]);
    const D = [1, 2, 3].map((k) => a[k] + (z[k] - a[k]) * t);
    const fr = document.querySelector('.pot-frame').getBoundingClientRect();
    const kp = document.getElementById('knob-pot'); const k = (getComputedStyle(kp).opacity === '1' ? kp : document.getElementById('knob')).getBoundingClientRect();
    const ring = k.width * 124 / 260;
    return { ct: ct.toFixed(2), dx: Math.round(k.left + k.width / 2 - (fr.left + fr.width * D[0])), dy: Math.round(k.top + k.height / 2 - (fr.top + fr.height * D[1])), ring: Math.round(ring), dial: Math.round(fr.width * D[2]) };
  }, f);
  console.log(w + 'x' + h, f, JSON.stringify(r));
}
await b.close();
