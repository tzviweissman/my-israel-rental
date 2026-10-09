// Is every word on the page clear? At several screen sizes and many scroll
// points, every visible piece of text is measured on the rendered page:
//   size     the size it actually appears at (SVG text included, scaled)
//   contrast against what is really behind it, photos and video included:
//            the text is made transparent, the page photographed, and the
//            worst pixels under each line compared with the text colour.
// Fails: anything under 12px; a sentence under 14px on a phone; contrast
// under 4.5:1 (3:1 for text 24px and up, or 19px bold).
//   Run: node scrollcraft/builds/la-cholent/lab/readable.mjs
import { chromium } from 'playwright';
import { execFileSync } from 'node:child_process';
import { writeFileSync } from 'node:fs';

const sizes = [[1440, 900], [1536, 753], [1280, 650], [1920, 1080], [390, 844], [360, 640]];
const stops = 18;
const LAB = 'scrollcraft/builds/la-cholent/lab';
const b = await chromium.launch();
const problems = new Map();
const shotsNeeded = new Set();
for (const [w, h] of sizes) {
  const phone = w < 861;
  const p = await (await b.newContext({ viewport: { width: w, height: h } })).newPage();
  await p.goto('http://localhost:4503/', { waitUntil: 'networkidle' });
  await p.evaluate(() => document.fonts.ready);
  const max = await p.evaluate(() => document.documentElement.scrollHeight - innerHeight);
  for (let i = 0; i <= stops; i++) {
    await p.evaluate((y) => scrollTo(0, y), Math.round((max * i) / stops));
    await p.waitForTimeout(700);
    const items = await p.evaluate(() => {
      const out = [];
      const seen = new Set();
      const walk = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT);
      while (walk.nextNode()) {
        const node = walk.currentNode, el = node.parentElement;
        const text = node.textContent.trim();
        if (!el || !text || seen.has(el)) continue;
        if (el.closest('script,style,title')) continue;
        seen.add(el);
        let op = 1, hidden = false;
        for (let n = el; n && n !== document.documentElement; n = n.parentElement) {
          const cs = getComputedStyle(n);
          op *= Number(cs.opacity);
          if (cs.visibility === 'hidden' || cs.display === 'none') hidden = true;
        }
        if (hidden || op < 0.6) continue;
        const range = document.createRange(); range.selectNodeContents(node);
        const rects = [...range.getClientRects()].filter((r) => r.width > 2 && r.height > 2 && r.bottom > 0 && r.top < innerHeight && r.right > 0 && r.left < innerWidth);
        if (!rects.length) continue;
        // half off the screen, or under the fixed order bar: scrolling past, not reading
        const bar = document.querySelector('.buybar.is-on');
        const barTop = bar ? bar.getBoundingClientRect().top : innerHeight;
        if (rects[0].top < 4 || rects[rects.length - 1].bottom > Math.min(innerHeight - 4, barTop) && !(bar && bar.contains(el))) continue;
        // is it actually on top (not under a clipped side or another layer)?
        const r0 = rects[0];
        const hit = document.elementFromPoint(Math.min(innerWidth - 1, Math.max(0, r0.left + r0.width / 2)), Math.min(innerHeight - 1, Math.max(0, r0.top + r0.height / 2)));
        if (hit && !el.contains(hit) && !hit.contains(el) && !(hit.closest && hit.closest('svg') && el.closest('svg') === hit.closest('svg'))) continue;
        const cs = getComputedStyle(el);
        const isSvg = el instanceof SVGElement;
        const scale = isSvg ? (r0.height / (parseFloat(cs.fontSize) * 1.15)) : (el.getBoundingClientRect().width / (el.offsetWidth || el.getBoundingClientRect().width || 1));
        const px = parseFloat(cs.fontSize) * (isSvg ? scale : (scale || 1));
        const col = (isSvg ? cs.fill : cs.color).match(/[\d.]+/g).map(Number);
        out.push({
          text: text.slice(0, 40), px: Math.round(px * 10) / 10, bold: Number(cs.fontWeight) >= 700,
          sentence: /^(P|LI|DD|SPAN|A|CITE)$/.test(el.tagName) && text.split(' ').length >= 4,
          color: col.slice(0, 3), rects: rects.slice(0, 3).map((r) => [Math.max(0, r.left), Math.max(0, r.top), Math.min(innerWidth, r.right), Math.min(innerHeight, r.bottom)].map(Math.round)),
        });
      }
      return out;
    });
    if (!items.length) continue;
    await p.addStyleTag({ content: '* { color: transparent !important; text-shadow: none !important; caret-color: transparent !important; } svg text { fill: transparent !important; }' });
    await p.waitForTimeout(150);
    await p.screenshot({ path: `${LAB}/readable-bg.png` });
    await p.evaluate(() => document.querySelectorAll('style').forEach((s) => { if (s.textContent.includes('color: transparent !important')) s.remove(); }));
    writeFileSync(`${LAB}/readable-items.json`, JSON.stringify(items));
    const res = JSON.parse(execFileSync('backend/.venv/Scripts/python.exe', ['-c', `
import cv2, json, numpy as np
img = cv2.imread('${LAB}/readable-bg.png')[:, :, ::-1].astype(float) / 255
def lum(c):
    c = np.where(c <= 0.03928, c / 12.92, ((c + 0.055) / 1.055) ** 2.4)
    return 0.2126 * c[..., 0] + 0.7152 * c[..., 1] + 0.0722 * c[..., 2]
L = lum(img)
out = []
for it in json.load(open('${LAB}/readable-items.json')):
    tl = float(lum(np.array(it['color'], float) / 255))
    worst = 99
    for x0, y0, x1, y1 in it['rects']:
        patch = L[y0:y1, x0:x1]
        if patch.size == 0: continue
        bg = np.percentile(patch, 97) if tl > 0.4 else np.percentile(patch, 3)
        hi, lo = max(tl, bg), min(tl, bg)
        worst = min(worst, (hi + 0.05) / (lo + 0.05))
    out.append(round(worst, 2))
print(json.dumps(out))
`]).toString());
    const before = shotsNeeded.size;
    items.forEach((it, k) => {
      const large = it.px >= 24 || (it.bold && it.px >= 18.66);
      const need = large ? 3 : 4.5;
      const issues = [];
      if (res[k] < need) issues.push(`contrast ${res[k]}:1 (needs ${need})`);
      if (it.px < 12) issues.push(`${it.px}px`);
      else if (phone && it.sentence && it.px < 14) issues.push(`${it.px}px sentence on a phone`);
      if (!issues.length) return;
      const key = `${it.text} | ${issues.map((s) => s.replace(/[\d.]+:1|[\d.]+px/, '#')).join(',')}`;
      const prev = problems.get(key) || { text: it.text, worst: [], where: new Set() };
      prev.worst.push(issues.join(', ')); prev.where.add(`${w}x${h}@${i}`);
      shotsNeeded.add(`${w}x${h}@${i}`);
      problems.set(key, prev);
    });
    if (shotsNeeded.size > before) await p.screenshot({ path: `${LAB}/readable-${w}x${h}-${i}.png` });
  }
  await p.close();
}
await b.close();
if (!problems.size) console.log('every word clear at every size checked');
for (const v of problems.values()) console.log(`"${v.text}"  ${v.worst.sort()[0]}  at ${[...v.where].join(' ')}`);
process.exitCode = problems.size ? 1 : 0;
