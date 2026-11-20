// Does a business's logo read on an ad, and if not, can its name be lifted out of it? (ad rule A4.6, Tzvi 18 Nov 2026:
// "make sure the logo never comes out unclear again"). L.A. Cholent's logo is a round badge: thin gold letters round a
// faded slow cooker. Its letters are 5% of its height, so no size an ad can give it reads on a phone. Its name, cut out
// with what is behind it made see-through, is 60% and reads at any size. scripts/logo_check.py measures the same way.

// Letter-like marks in an image: strokes that differ from its own ground by over 40, shaped like letters (not a thin
// ring or outline, which fills under a tenth of its box). With cutFrac: strokes whose colour is over that share of the
// strongest ink's distance from the ground's colour instead, which leaves out a faint picture or glow behind the name
// (L.A. Cholent's pale slow cooker and the glow round its gold letters joined them up at a low cut).
function marks(img, maxW, cutFrac = 0) {
  const colour = cutFrac > 0;
  const k = Math.min(1, maxW / img.naturalWidth);
  const w = Math.max(1, Math.round(img.naturalWidth * k));
  const h = Math.max(1, Math.round(img.naturalHeight * k));
  const c = document.createElement('canvas');
  c.width = w;
  c.height = h;
  const x = c.getContext('2d');
  x.fillStyle = '#FFFFFF';
  x.fillRect(0, 0, w, h);
  x.drawImage(img, 0, 0, w, h);
  const d = x.getImageData(0, 0, w, h).data;
  const g = new Float32Array(w * h);
  for (let i = 0; i < w * h; i += 1) g[i] = 0.299 * d[i * 4] + 0.587 * d[i * 4 + 1] + 0.114 * d[i * 4 + 2];
  const med = Float32Array.from(g).sort()[Math.floor((w * h) / 2)];
  const ink = new Uint8Array(w * h);
  let strong = 0;
  if (colour) {
    // how far each pixel's colour is from the ground, against the strongest ink in the picture
    const bg = [0, 1, 2].map((ch) => Uint8Array.from({ length: w * h }, (_, i) => d[i * 4 + ch]).sort()[Math.floor((w * h) / 2)]);
    const dist = new Float32Array(w * h);
    for (let i = 0; i < w * h; i += 1) dist[i] = Math.hypot(d[i * 4] - bg[0], d[i * 4 + 1] - bg[1], d[i * 4 + 2] - bg[2]);
    strong = Float32Array.from(dist).sort()[Math.floor(w * h * 0.99)];
    const cut = Math.max(70, strong * cutFrac);
    for (let i = 0; i < w * h; i += 1) ink[i] = dist[i] > cut ? 1 : 0;
  } else for (let i = 0; i < w * h; i += 1) ink[i] = Math.abs(g[i] - med) > 40 ? 1 : 0;
  // colour mode also takes out long flat lines (a run over a quarter of the width) before finding letters, keeping
  // them as bars: L.A. Cholent's name touches the gold bars above and below it and joined them into one wide shape
  const bars = [];
  if (colour) {
    for (let y = 0; y < h; y += 1) {
      for (let x0 = 0; x0 < w;) {
        if (!ink[y * w + x0]) { x0 += 1; continue; }
        let x1 = x0;
        while (x1 + 1 < w && ink[y * w + x1 + 1]) x1 += 1;
        if (x1 - x0 + 1 > w * 0.25) { bars.push({ y, x0, x1 }); for (let x = x0; x <= x1; x += 1) ink[y * w + x] = 0; }
        x0 = x1 + 1;
      }
    }
  }
  const found = [];
  const stack = [];
  for (let s = 0; s < w * h; s += 1) {
    if (!ink[s]) continue;
    ink[s] = 0;
    stack.push(s);
    let n = 0, x0 = w, x1 = 0, y0 = h, y1 = 0;
    while (stack.length) {
      const p = stack.pop();
      const px = p % w, py = (p - px) / w;
      n += 1;
      if (px < x0) x0 = px; if (px > x1) x1 = px; if (py < y0) y0 = py; if (py > y1) y1 = py;
      for (let dy = -1; dy <= 1; dy += 1) {
        for (let dx = -1; dx <= 1; dx += 1) {
          const qx = px + dx, qy = py + dy;
          if (qx >= 0 && qx < w && qy >= 0 && qy < h && ink[qy * w + qx]) { ink[qy * w + qx] = 0; stack.push(qy * w + qx); }
        }
      }
    }
    const bw = x1 - x0 + 1, bh = y1 - y0 + 1;
    found.push({ x0, y0, x1, y1, n, letter: n >= 6 && bh >= 3 && bw / bh >= 0.15 && bw / bh <= 1.6 && bh < h * 0.8 && n >= bw * bh * 0.1 });
  }
  return { found, bars, w, h, k, d, strong };
}

const SHARE = new WeakMap();
// How tall the letters are as a share of the logo's own height: a wordmark 0.4 to 0.6, a badge about 0.05.
// null when no lettering is found (a pure mark).
export function logoLetterShare(img) {
  if (SHARE.has(img)) return SHARE.get(img);
  let share = null;
  try {
    const { found, h } = marks(img, 1000);
    const hs = found.filter((m) => m.letter).map((m) => m.y1 - m.y0 + 1).sort((p, q) => p - q);
    if (hs.length >= 3) share = hs[Math.floor(hs.length / 2)] / h;
  } catch (e) { share = null; }
  SHARE.set(img, share);
  return share;
}

// Letters 30px tall in a 1080-wide ad, like any other text (A8.2); a corner logo is at most a fifth of the width tall
// and 42% of it wide.
export const LOGO_LETTER_PX = 30;
export const LOGO_MAX_H = 216;
export function logoReads(img) {
  const s = logoLetterShare(img);
  if (s == null) return true;
  const tallest = Math.min(LOGO_MAX_H - 24, (1080 * 0.42 - 24) / (img.naturalWidth / img.naturalHeight));
  return s * tallest >= LOGO_LETTER_PX * 1.1;
}

// The business's name lifted out of a badge, seal or flyer: the row of its biggest letters (with the bars or lines
// beside them), everything behind them made see-through. A PNG Blob, or null when nothing that reads comes out.
export async function liftWordmark(img) {
  // the name is a straight row of letters of one height: for each letter, the letters level with it and of about its
  // height; the row with the most letters times their height wins (the big name over the small curved slogan). Each
  // logo's ink differs, so several cuts are tried and the best row kept (L.A. Cholent's paler gold name came out
  // only at half its darker ring's strength).
  const tall = (m) => m.y1 - m.y0 + 1;
  let best = null;
  for (const frac of [0.35, 0.45, 0.55, 0.65, 0.75]) {
    const got = marks(img, 1000, frac);
    const letters = got.found.filter((m) => m.letter);
    for (const a of letters) {
      const r = letters.filter((b) => tall(b) >= tall(a) * 0.7 && tall(b) <= tall(a) * 1.4
        && b.y0 <= a.y0 + tall(a) * 0.3 && b.y1 >= a.y1 - tall(a) * 0.3);
      const score = r.length * tall(a);
      if (r.length >= 3 && (!best || score > best.score)) best = { score, row: r, got };
    }
  }
  if (!best) return null;
  const { row } = best;
  const { w, h, k } = best.got;
  const { bars } = marks(img, 1000, 0.35);   // the bars at the gentlest cut, where a pale bar still shows
  let x0 = Math.min(...row.map((m) => m.x0)), x1 = Math.max(...row.map((m) => m.x1));
  let y0 = Math.min(...row.map((m) => m.y0)), y1 = Math.max(...row.map((m) => m.y1));
  const rh = y1 - y0 + 1, rw = x1 - x0 + 1;
  // bars and rules just above and below that span the name (L.A. Cholent's two gold bars)
  for (const r of bars) {
    if (r.x1 - r.x0 >= rw * 0.6 && r.x0 >= x0 - rw * 0.12 && r.x1 <= x1 + rw * 0.12 && r.y >= y0 - rh * 0.7 && r.y <= y1 + rh * 0.7) {
      x0 = Math.min(x0, r.x0); x1 = Math.max(x1, r.x1); y0 = Math.min(y0, r.y); y1 = Math.max(y1, r.y);
    }
  }
  const pad = Math.round(rh * 0.08);
  const sx = Math.max(0, x0 - pad) / k, sy = Math.max(0, y0 - pad) / k;
  const sw = (Math.min(w - 1, x1 + pad) - Math.max(0, x0 - pad) + 1) / k;
  const sh = (Math.min(h - 1, y1 + pad) - Math.max(0, y0 - pad) + 1) / k;
  const out = document.createElement('canvas');
  out.width = Math.round(sw);
  out.height = Math.round(sh);
  const o = out.getContext('2d');
  o.fillStyle = '#FFFFFF';
  o.fillRect(0, 0, out.width, out.height);
  o.drawImage(img, sx, sy, sw, sh, 0, 0, out.width, out.height);
  const px = o.getImageData(0, 0, out.width, out.height);
  const d = px.data;
  // the ground is the commonest colour round the edge; what is near it (the ground, a faded picture, a glow) goes,
  // see-through below a third of the name's own strongest ink and fully kept from 60% of it
  const edge = [];
  for (let i = 0; i < out.width; i += 1) for (const j of [0, out.height - 1]) edge.push((j * out.width + i) * 4);
  const bg = [0, 1, 2].map((c) => edge.map((i) => d[i + c]).sort((p, q) => p - q)[Math.floor(edge.length / 2)]);
  const dist = new Float32Array(d.length / 4);
  for (let i = 0; i < d.length; i += 4) dist[i / 4] = Math.hypot(d[i] - bg[0], d[i + 1] - bg[1], d[i + 2] - bg[2]);
  const strong = Float32Array.from(dist).sort()[Math.floor(dist.length * 0.98)];
  const lo = Math.max(50, strong * 0.33), hi = Math.max(lo + 30, strong * 0.6);
  // a coloured name (L.A. Cholent's gold) also drops what is grey: the faded slow cooker behind it, and the other
  // brand's name printed on that cooker. A black or grey name keeps its greys.
  const sat = (i) => { const mx = Math.max(d[i], d[i + 1], d[i + 2]), mn = Math.min(d[i], d[i + 1], d[i + 2]); return mx ? (mx - mn) / mx : 0; };
  const inkSats = [];
  for (let i = 0; i < d.length; i += 4) if (dist[i / 4] >= hi) inkSats.push(sat(i));
  const coloured = inkSats.length && inkSats.sort((p, q) => p - q)[Math.floor(inkSats.length / 2)] > 0.3;
  for (let i = 0; i < d.length; i += 4) {
    let a = Math.max(0, Math.min(1, (dist[i / 4] - lo) / (hi - lo)));
    if (coloured) a *= Math.max(0, Math.min(1, (sat(i) - 0.15) / 0.15));
    d[i + 3] = Math.round(255 * a);
  }
  o.putImageData(px, 0, 0);
  const blob = await new Promise((r) => out.toBlob(r, 'image/png'));
  if (!blob) return null;
  // only offered when it really reads
  const check = await new Promise((r) => { const im = new Image(); im.onload = () => r(im); im.onerror = () => r(null); im.src = URL.createObjectURL(blob); });
  return check && logoReads(check) && (logoLetterShare(check) || 0) >= 0.3 ? blob : null;
}
