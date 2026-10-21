// one comparison: the same screen of the current page and of the proposed copy, side by side.
// node pair.mjs <beforeUrl> <afterUrl> <out.jpg> <laptop|phone> [<css selector to bring to the top> | <scrollY>] [<js to run first on both>]
import { createRequire } from 'node:module';
const req = createRequire('C:/Users/tzviw/Documents/my-israel-rental/');
const { chromium } = req('playwright');
const [bu, au, out, kind = 'laptop', where = '0', js = ''] = process.argv.slice(2);
const [w, h] = kind === 'phone' ? [390, 844] : [1440, 900];
const b = await chromium.launch();
async function shoot(u) {
  const p = await b.newPage({ viewport: { width: w, height: h }, deviceScaleFactor: 1 });
  // live pages use /pages/<site>/... addresses that only the live server has; serve them from this local copy
  const origin = new URL(u).origin;
  await p.route(/\/pages\/[^/]+\/(.*)$/, (r) => { const m = /\/pages\/[^/]+\/(.*)$/.exec(new URL(r.request().url()).pathname); return m && new URL(r.request().url()).origin === origin ? r.continue({ url: origin + '/' + m[1] }) : r.continue(); });
  await p.goto(u, { waitUntil: 'load' }); await p.waitForTimeout(1800);
  if (js) { await p.evaluate(js).catch(() => {}); await p.waitForTimeout(700); }
  const H = await p.evaluate(() => document.documentElement.scrollHeight);
  for (let y = 0; y < H; y += h * 0.8) { await p.evaluate((y) => scrollTo(0, y), y); await p.waitForTimeout(120); } // let reveals fire
  if (/^\d+$/.test(where)) await p.evaluate((y) => scrollTo(0, y), +where);
  else await p.evaluate((s) => { const e = document.querySelector(s); if (e) { const hd = document.querySelector('header, .top, nav'); const off = hd ? Math.min(hd.getBoundingClientRect().height, 100) : 0; scrollTo(0, e.getBoundingClientRect().top + scrollY - off); } }, where);
  await p.waitForTimeout(1200);
  const buf = await p.screenshot({ type: 'png' }); await p.close(); return buf;
}
const [A, B] = [await shoot(bu), await shoot(au)];
const p = await b.newPage({ viewport: { width: w * 2 + 60, height: h + 70 } });
await p.setContent(`<body style="margin:0;background:#1d1d1f;font:600 22px system-ui;color:#fff;display:flex;gap:20px;padding:20px">
${[['Now', A], ['Proposed', B]].map(([t, x]) => `<div><div style="margin:0 0 10px">${t}</div><img style="display:block;width:${w}px;border-radius:6px" src="data:image/png;base64,${x.toString('base64')}"></div>`).join('')}</body>`);
await p.waitForTimeout(200);
await p.screenshot({ path: out, type: 'jpeg', quality: 72, fullPage: true });
await b.close(); console.log(out);
