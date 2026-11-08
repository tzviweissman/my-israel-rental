#!/usr/bin/env node
/**
 * The main button is in the product's own colour (Tzvi, 8 Nov 2026: "buttons in the products own colors should be
 * a rule", after Bramble, whose bottle label, buttons and ticker are one lime; rules 3g.19).
 *
 * Applies to sites that sell products (site-category food-shop or fashion-shop); others print n/a.
 * The home page declares the colour and the photo it was taken from:
 *   <meta name="product-colour" content="#7a1f4b" data-from="assets/bowls/acai.webp">
 * It fails when:
 *   - the meta is missing, or its photo does not load
 *   - fewer than 1% of the photo's pixels are within 14 (CIE76) of the colour, so it is not the product's colour
 *   - a filled button whose words say order, book or shop on the first screens is more than 16 away from it (a lighter and a deeper shade of one colour pass)
 *   - a button's text on that colour reads under 4.5:1
 * Phone and laptop.
 *
 *   node scripts/check-button-colour.mjs <urls of the site's pages>      exit 1 when it fails
 *   node scripts/check-button-colour.mjs --suggest <photo url>           prints the photo's strongest colours
 */
import { chromium } from 'playwright';

// colour maths runs in the page; kept as one string so both modes share it
const LIB = `
  const hex = (h) => { h = h.replace('#', ''); if (h.length === 3) h = [...h].map((c) => c + c).join(''); return [0, 2, 4].map((i) => parseInt(h.slice(i, i + 2), 16)); };
  const rgbOf = (s) => (s.match(/[\\d.]+/g) || []).slice(0, 4).map(Number);
  const lin = (c) => { c /= 255; return c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4; };
  const lab = ([r, g, b]) => { const [R, G, B] = [r, g, b].map(lin); const f = (t) => t > 0.008856 ? Math.cbrt(t) : 7.787 * t + 16 / 116;
    const x = f((R * 0.4124 + G * 0.3576 + B * 0.1805) / 0.95047), y = f(R * 0.2126 + G * 0.7152 + B * 0.0722), z = f((R * 0.0193 + G * 0.1192 + B * 0.9505) / 1.08883);
    return [116 * y - 16, 500 * (x - y), 200 * (y - z)]; };
  Object.assign(self, { hex, rgbOf, lin, lab });
  const dE = (a, b) => { const p = lab(a), q = lab(b); return Math.hypot(p[0] - q[0], p[1] - q[1], p[2] - q[2]); };
  const lum = ([r, g, b]) => 0.2126 * lin(r) + 0.7152 * lin(g) + 0.0722 * lin(b);
  const contrast = (a, b) => { const [x, y] = [lum(a), lum(b)].sort((m, n) => n - m); return (x + 0.05) / (y + 0.05); };
  const pixels = async (src) => { const img = new Image(); img.crossOrigin = 'anonymous'; img.src = src; await img.decode();
    const w = 200, h = Math.max(1, Math.round(200 * img.naturalHeight / img.naturalWidth)), c = document.createElement('canvas'); c.width = w; c.height = h;
    const g = c.getContext('2d'); g.drawImage(img, 0, 0, w, h); return g.getImageData(0, 0, w, h).data; };
  Object.assign(self, { dE, lum, contrast, pixels });
`;
// eval keeps the consts inside itself, so LIB hands its functions to the page's globals (Object.assign above)

const args = process.argv.slice(2);
const browser = await chromium.launch();

if (args[0] === '--suggest') {
  const p = await browser.newPage();
  await p.goto(args[1].replace(/[^/]*$/, ''), { waitUntil: 'domcontentloaded' }).catch(() => {});
  const top = await p.evaluate(async ([lib, src]) => {
    eval(lib); const d = await pixels(src), bins = new Map();
    const W = 200, H = d.length / 4 / W, px = (i) => [d[i], d[i + 1], d[i + 2]];
    // the backdrop: the colours along the photo's edge; anything close to one of them is not the product
    const edge = []; for (let x = 0; x < W; x += 10) for (const y of [0, H - 1]) edge.push(px((y * W + x) * 4));
    for (let y = 0; y < H; y += 10) for (const x of [0, W - 1]) edge.push(px((y * W + x) * 4));
    // only a plain backdrop is left out; a close-up whose product runs off the edges keeps every colour
    const mid = edge[Math.floor(edge.length / 2)];
    if (edge.filter((e) => dE(e, mid) < 15).length < edge.length * 0.6) edge.length = 0;
    for (let i = 0; i < d.length; i += 4) { if (d[i + 3] < 200) continue;
      const c = px(i), [, A, B] = lab(c); if (Math.hypot(A, B) < 15) continue; // a real colour, not grey or white
      if (edge.some((e) => dE(e, c) < 18)) continue;
      const [r, g, b] = c, k = [r, g, b].map((v) => v >> 5).join(','); const e = bins.get(k) || [0, 0, 0, 0]; e[0] += r; e[1] += g; e[2] += b; e[3]++; bins.set(k, e); }
    const n = d.length / 4;
    const chroma = (e) => { const [, A, B] = lab([e[0] / e[3], e[1] / e[3], e[2] / e[3]]); return Math.hypot(A, B); };
    return [...bins.values()].sort((a, b) => b[3] * chroma(b) - a[3] * chroma(a)).slice(0, 8).map(([r, g, b, c]) => { const v = [r / c, g / c, b / c].map(Math.round);
      return `#${v.map((x) => x.toString(16).padStart(2, '0')).join('')}  ${(100 * c / n).toFixed(1)}% of the photo  text: ${contrast(v, [255, 255, 255]) >= 4.5 ? 'white' : contrast(v, [17, 17, 17]) >= 4.5 ? 'ink' : 'neither reads 4.5:1'}`; });
  }, [LIB, args[1]]);
  console.log(top.join('\n'));
  await browser.close();
  process.exit(0);
}

const url = args.find((u) => /\/index\.html$|\/$/.test(new URL(u).pathname)) || args[0];
if (!url) { console.error('usage: node scripts/check-button-colour.mjs <home url>  |  --suggest <photo url>'); process.exit(2); }
let bad = 0;
for (const [w, h, mobile] of [[390, 844, true], [1366, 800, false]]) {
  const p = await (await browser.newContext({ viewport: { width: w, height: h }, isMobile: mobile, hasTouch: mobile, reducedMotion: 'reduce' })).newPage();
  await p.goto(url, { waitUntil: 'load' }); await p.waitForTimeout(800);
  const r = await p.evaluate(async ([lib, vh]) => {
    eval(lib);
    const cat = document.querySelector('meta[name="site-category"]')?.content || '';
    if (!/food-shop|fashion-shop/.test(cat)) return { na: cat || 'no site-category' };
    const m = document.querySelector('meta[name="product-colour"]');
    if (!m) return { why: ['no <meta name="product-colour" content="#..." data-from="<product photo>"> on the home page'] };
    const want = hex(m.content), why = [];
    try {
      const d = await pixels(new URL(m.getAttribute('data-from') || '', location.href).href);
      let near = 0; for (let i = 0; i < d.length; i += 4) if (d[i + 3] > 200 && dE([d[i], d[i + 1], d[i + 2]], want) <= 14) near++;
      const share = near / (d.length / 4);
      if (share < 0.01) why.push(`${m.content} is in ${(share * 100).toFixed(2)}% of ${m.getAttribute('data-from')}, at least 1%: take the colour from the product (--suggest)`);
    } catch { why.push(`the product photo "${m.getAttribute('data-from')}" does not load`); }
    const btns = [...document.querySelectorAll('a[href], button')].filter((b) => {
      if (!b.offsetParent || b.closest('footer')) return false;
      const t = b.innerText, q = b.getBoundingClientRect(); // the words on it, so a product card linking to the order page keeps its own colour
      return /order|book|shop|reserve|הזמ/i.test(t) && q.top + scrollY < vh * 2 && rgbOf(getComputedStyle(b).backgroundColor)[3] !== 0;
    });
    if (!btns.length) why.push('no filled order, book or shop button on the first two screens');
    for (const b of btns) {
      const cs = getComputedStyle(b), bg = rgbOf(cs.backgroundColor), fg = rgbOf(cs.color), name = b.innerText.trim().replace(/\s+/g, ' ').slice(0, 30);
      if (bg.length === 4 && bg[3] < 1) { why.push(`"${name}" is see-through (${cs.backgroundColor}), fill it with ${m.content}`); continue; }
      const e = dE(bg.slice(0, 3), want);
      if (e > 16) why.push(`"${name}" is ${cs.backgroundColor}, ${e.toFixed(0)} away from the product colour ${m.content} (16 at most)`);
      else if (contrast(bg.slice(0, 3), fg.slice(0, 3)) < 4.5) why.push(`"${name}" text ${cs.color} reads ${contrast(bg.slice(0, 3), fg.slice(0, 3)).toFixed(1)}:1 on it, 4.5:1 at least`);
      const q = b.getBoundingClientRect();
      if (q.top >= 0 && q.bottom <= innerHeight) b.setAttribute('data-btn-ring', JSON.stringify({ name, bg: bg.slice(0, 3) }));
    }
    return { why };
  }, [LIB, h]);
  if (r.na) { console.log(`${url}: n/a (${r.na}), only shops`); break; }
  // the button must stand out from what is right around it (3:1, the web's rule for controls): an acai button on a
  // dark acai photo is the product's colour and still lost (The Brown Box trial, 8 Nov 2026)
  if (r.why) for (const el of await p.$$('[data-btn-ring]')) {
    const { name, bg } = JSON.parse(await el.getAttribute('data-btn-ring')), q = await el.boundingBox(), pad = 8;
    await el.evaluate((n) => { n.dataset.vis = n.style.visibility; n.style.visibility = 'hidden'; }); // see what is behind it
    const clip = { x: Math.max(0, q.x - pad), y: Math.max(0, q.y - pad), width: q.width + pad * 2, height: q.height + pad * 2 };
    const png = (await p.screenshot({ clip })).toString('base64');
    await el.evaluate((n) => { n.style.visibility = n.dataset.vis; });
    const ratio = await p.evaluate(async ([lib, png, bg]) => {
      eval(lib); const img = new Image(); img.src = 'data:image/png;base64,' + png; await img.decode();
      const c = document.createElement('canvas'); c.width = img.width; c.height = img.height; const g = c.getContext('2d'); g.drawImage(img, 0, 0);
      const d = g.getImageData(0, 0, c.width, c.height).data, rs = [];
      for (let i = 0; i < d.length; i += 16) rs.push(contrast([d[i], d[i + 1], d[i + 2]], bg));
      rs.sort((a, b) => a - b); return rs[Math.floor(rs.length / 2)]; // the middle of what sits behind it
    }, [LIB, png, bg]);
    if (ratio < 3) r.why.push(`"${name}" stands out ${ratio.toFixed(1)}:1 from what is behind it, 3:1 at least: use a lighter or deeper shade of the product's colour that is in the photo`);
  }
  if (r.why.length) { bad++; console.log(`BUTTON  ${url} ${w}x${h}\n  ${r.why.join('\n  ')}`); }
}
console.log(`${url}: checked`);
await browser.close();
process.exit(bad ? 1 : 0);
