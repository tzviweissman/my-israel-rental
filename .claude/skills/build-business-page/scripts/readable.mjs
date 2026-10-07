// Is every word on the page clear? At six screen sizes and many scroll
// points, every visible piece of text is measured on the rendered page:
//   size     the size it actually appears at (scaled and SVG text included)
//   contrast against what is really behind it, photos and video included:
//            the text is made transparent, the page photographed, and the
//            worst pixels under each line compared with the text colour.
// Fails: anything under 12px; a sentence under 14px on a phone; contrast
// under 4.5:1 (3:1 for text 24px and up, or 19px bold).
//   Run from the project folder (it uses that project's Playwright):
//   node ~/.claude/skills/build-business-page/scripts/readable.mjs http://localhost:3000/
import { createRequire } from 'node:module';
const { chromium } = createRequire(process.cwd() + '/')('playwright');
const url = process.argv[2] || 'http://localhost:3000/';
const sizes = [[1440, 900], [1536, 753], [1280, 650], [1920, 1080], [390, 844], [360, 640]];
const stops = 18;
const b = await chromium.launch();
const problems = new Map();
for (const [w, h] of sizes) {
  const phone = w < 861;
  const p = await (await b.newContext({ viewport: { width: w, height: h } })).newPage();
  await p.goto(url, { waitUntil: 'networkidle' });
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
        // Any bar fixed to the top or bottom edge counts (a header, an order
        // bar); text inside the bar itself is still judged.
        let topCover = 0, barTop = innerHeight, inBar = false;
        for (const f of document.querySelectorAll('header, nav, footer, [class*="bar"]')) {
          const fp = getComputedStyle(f).position;
          if (fp !== 'fixed' && fp !== 'sticky') continue;
          const fr = f.getBoundingClientRect();
          if (fr.height === 0 || fr.height > innerHeight * 0.3) continue;
          if (f.contains(el)) { inBar = true; continue; }
          if (fr.top <= 1) topCover = Math.max(topCover, fr.bottom);
          else if (fr.bottom >= innerHeight - 1 && fr.top < innerHeight) barTop = Math.min(barTop, fr.top);
        }
        if (!inBar && (rects[0].top < Math.max(4, topCover) - 2 || rects[rects.length - 1].bottom > Math.min(innerHeight - 4, barTop))) continue;
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
    const bg = (await p.screenshot()).toString('base64');
    await p.evaluate(() => document.querySelectorAll('style').forEach((s) => { if (s.textContent.includes('color: transparent !important')) s.remove(); }));
    // contrast of each line against the worst pixels behind it, worked out in the page
    const res = await p.evaluate(async ({ bg, items }) => {
      const img = new Image(); img.src = 'data:image/png;base64,' + bg; await img.decode();
      const c = new OffscreenCanvas(img.width, img.height), g = c.getContext('2d');
      g.drawImage(img, 0, 0);
      const k = img.width / innerWidth;
      const lin = (v) => { v /= 255; return v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4; };
      const lum = (r, gg, b) => 0.2126 * lin(r) + 0.7152 * lin(gg) + 0.0722 * lin(b);
      return items.map((it) => {
        const tl = lum(...it.color);
        let worst = 99;
        for (const [x0, y0, x1, y1] of it.rects) {
          const w = Math.round((x1 - x0) * k), h = Math.round((y1 - y0) * k);
          if (w < 1 || h < 1) continue;
          const d = g.getImageData(Math.round(x0 * k), Math.round(y0 * k), w, h).data;
          const L = [];
          for (let i = 0; i < d.length; i += 4) L.push(lum(d[i], d[i + 1], d[i + 2]));
          L.sort((a, b) => a - b);
          const bgL = tl > 0.4 ? L[Math.floor(L.length * 0.97)] : L[Math.floor(L.length * 0.03)];
          worst = Math.min(worst, (Math.max(tl, bgL) + 0.05) / (Math.min(tl, bgL) + 0.05));
        }
        return Math.round(worst * 100) / 100;
      });
    }, { bg, items });
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
      problems.set(key, prev);
    });
  }
  await p.close();
}
await b.close();
if (!problems.size) console.log('every word clear at every size checked');
for (const v of problems.values()) console.log(`"${v.text}"  ${v.worst.sort()[0]}  at ${[...v.where].join(' ')}`);
process.exitCode = problems.size ? 1 : 0;
