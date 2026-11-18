#!/usr/bin/env node
/**
 * One part of the home page leads into the next (Tzvi, 18 Nov 2026: "make things go from one page into the next",
 * from the 17 Nov videos; rules 3ae). Ours stop every section at a straight edge, so the page reads as a stack of boxes.
 *
 * On the home page (index.html or /) at a laptop (1366x800), the top-level sections of <main> (or <body>):
 *   CROSS   at least one picture, film or object (img, video, canvas, svg, picture, or anything marked data-cross)
 *           sits across the line between two neighbouring sections, at least 48 px into each (3ae.1)
 *   TRAVEL  one element marked data-travel stays in view while you scroll at least a screen and a half, and the
 *           section under the middle of the screen is a different one when it is last seen than when it is first
 *           seen: one object that goes down the page with you (3ae.2)
 * A page of fewer than three such sections is not judged.
 *
 * Passes on: none found yet (18 Nov 2026: Graza, Omsom, Blue Bottle, Diaspora, Flamingo Estate, Brightland,
 * Boomball and Monarque fail CROSS; Era Residence passed but its picture showed only a loading screen). Look at
 * the first site built to 3ae.
 *
 *   node scripts/check-seams.mjs <url> [more urls]      exit 1 on a home page that fails
 *   node scripts/check-seams.mjs --self-test           proves it passes a page that has both and fails one that has neither
 */
import { chromium } from 'playwright';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { pathToFileURL } from 'node:url';

const INTO = 48;

async function judge(browser, url) {
  const p = await browser.newPage({ viewport: { width: 1366, height: 800 } });
  try {
    await p.goto(url, { waitUntil: 'load', timeout: 45000 });
    await p.waitForTimeout(400);
    // scroll through once so lazy pictures and reveals are in their final place
    const H = await p.evaluate(() => document.documentElement.scrollHeight);
    for (let y = 0; y < H; y += 600) { await p.evaluate((v) => scrollTo(0, v), y); await p.waitForTimeout(60); }
    const tops = () => p.evaluate(() => {
      let root = document.querySelector('main') || document.body;
      // a shop that wraps the whole page in one div (Olipop, Omsom, Blue Bottle): go down to where the sections are
      const kids = (r) => [...r.children].filter((e) => e.offsetHeight > 60 && !/^(SCRIPT|STYLE|HEADER|NAV|FOOTER)$/.test(e.tagName));
      while (kids(root).length < 3 && kids(root).length && kids(root).sort((a, b) => b.offsetHeight - a.offsetHeight)[0].offsetHeight > 0.6 * root.offsetHeight)
        root = kids(root).sort((a, b) => b.offsetHeight - a.offsetHeight)[0];
      return [...root.children].filter((e) => !/^(SCRIPT|STYLE|HEADER|NAV|NOSCRIPT|TEMPLATE)$/.test(e.tagName)
        && getComputedStyle(e).position !== 'fixed' && e.offsetHeight > 60)
        .map((e) => { const r = e.getBoundingClientRect(); return { top: r.top + scrollY, bottom: r.bottom + scrollY, name: e.id ? '#' + e.id : e.tagName.toLowerCase() + (e.className && typeof e.className === 'string' ? '.' + e.className.split(' ')[0] : '') }; });
    });
    const secs = await tops();
    if (secs.length < 3) return { url, skip: true };
    const cross = await p.evaluate(({ secs, INTO }) => {
      const lines = secs.slice(1).map((s, i) => ({ y: s.top, between: `${secs[i].name} / ${s.name}` }));
      for (const m of document.querySelectorAll('img, video, canvas, svg, picture, [data-cross]')) {
        const cs = getComputedStyle(m); if (cs.visibility === 'hidden' || +cs.opacity < 0.1) continue;
        let fixed = false; for (let x = m; x; x = x.parentElement) if (getComputedStyle(x).position === 'fixed') { fixed = true; break; }
        if (fixed) continue;
        // only the part that shows: cut by every ancestor that hides its overflow (an opening film taller than its
        // section is clipped at the line, which first read as three false crossings, 18 Nov 2026)
        const b = m.getBoundingClientRect(); let top = b.top, bottom = b.bottom;
        for (let x = m.parentElement; x && x !== document.body; x = x.parentElement) {
          const o = getComputedStyle(x); if (!/hidden|clip|auto|scroll/.test(o.overflowY + o.overflow)) continue;
          const r = x.getBoundingClientRect(); top = Math.max(top, r.top); bottom = Math.min(bottom, r.bottom);
        }
        if (b.width < 60 || bottom - top < 60) continue;
        top += scrollY; bottom += scrollY;
        for (const l of lines) if (top <= l.y - INTO && bottom >= l.y + INTO) return `${l.between} at ${Math.round(l.y)} px`;
      }
      return null;
    }, { secs, INTO });
    // TRAVEL: sample every half screen
    const travel = { marked: await p.$('[data-travel]') !== null, span: 0, from: null, to: null };
    if (travel.marked) {
      let first = null, last = null;
      for (let y = 0; y < H; y += 400) {
        await p.evaluate((v) => scrollTo(0, v), y); await p.waitForTimeout(80);
        const s = await p.evaluate((secs) => {
          const m = document.querySelector('[data-travel]'); const r = m.getBoundingClientRect(); const cs = getComputedStyle(m);
          const seen = r.bottom > 0 && r.top < innerHeight && r.width > 0 && cs.visibility !== 'hidden' && +cs.opacity >= 0.1;
          const mid = scrollY + innerHeight / 2; const under = secs.find((x) => mid >= x.top && mid < x.bottom);
          return { seen, at: scrollY, under: under ? under.name : null };
        }, secs);
        if (s.seen) { first ??= s; last = s; }
      }
      if (first) Object.assign(travel, { span: last.at - first.at, from: first.under, to: last.under });
    }
    return { url, cross, travel, needSpan: 1.5 * 800 };
  } catch (e) { return { url, error: e.message.split('\n')[0] }; } finally { await p.close(); }
}

function report(r) {
  if (r.error) { console.log(`SEAMS  ${r.url}\n  LOAD: ${r.error}`); return false; }
  if (r.skip) { console.log(`${r.url}: fewer than three sections, not judged`); return true; }
  const why = [];
  if (!r.cross) why.push(`CROSS: nothing sits across a line between two sections (a picture or object at least ${INTO} px into each, 3ae.1)`);
  const t = r.travel;
  if (!t.marked) why.push('TRAVEL: no element marked data-travel (one object that goes down the page with you, 3ae.2)');
  else if (t.span < r.needSpan || !t.from || t.from === t.to) why.push(`TRAVEL: [data-travel] is in view for ${t.span} px of scroll (${t.from} to ${t.to}); it must stay ${r.needSpan} px and reach another section (3ae.2)`);
  if (r.cross) why.push(`(crosses ${r.cross})`);
  if (why.length > (r.cross ? 1 : 0)) { console.log(`SEAMS  ${r.url}\n  ${why.join('\n  ')}`); return false; }
  console.log(`${r.url}: checked (crosses ${r.cross}; travels ${t.from} to ${t.to})`);
  return true;
}

if (process.argv[2] === '--self-test') {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'seams-'));
  const sec = (id, bg, extra = '') => `<section id="${id}" style="height:900px;background:${bg};position:relative">${extra}</section>`;
  const good = `<!doctype html><body style="margin:0"><main>${sec('a', '#eee')}${sec('b', '#123', '<img src="data:image/gif;base64,R0lGODlhAQABAAAAACw=" style="position:absolute;bottom:-120px;left:40%;width:240px;height:240px">')}${sec('c', '#fff')}${sec('d', '#333')}</main>
    <div data-travel style="position:fixed;right:20px;top:300px;width:80px;height:80px;background:red"></div></body>`;
  const bad = `<!doctype html><body style="margin:0"><main>${sec('a', '#eee', '<div style="overflow:hidden;height:900px;position:relative"><img src="data:image/gif;base64,R0lGODlhAQABAAAAACw=" style="position:absolute;top:700px;width:240px;height:400px"></div>')}${sec('b', '#123')}${sec('c', '#fff')}</main><div data-travel style="width:80px;height:80px;background:red"></div></body>`;
  fs.writeFileSync(path.join(dir, 'good-index.html'), good); fs.mkdirSync(path.join(dir, 'bad')); fs.writeFileSync(path.join(dir, 'bad', 'index.html'), bad);
  const browser = await chromium.launch();
  const g = await judge(browser, pathToFileURL(path.join(dir, 'good-index.html')).href);
  const b = await judge(browser, pathToFileURL(path.join(dir, 'bad', 'index.html')).href);
  await browser.close(); fs.rmSync(dir, { recursive: true, force: true });
  const ok = g.cross && g.travel.span >= g.needSpan && g.travel.from !== g.travel.to && !b.cross && !(b.travel.span >= b.needSpan && b.travel.from !== b.travel.to);
  console.log(ok ? 'self-test: passes the page with both, fails the page with neither' : `self-test FAILED\n${JSON.stringify({ g, b }, null, 1)}`);
  process.exit(ok ? 0 : 1);
}

const urls = process.argv.slice(2).filter((u) => /(\/|index\.html)(\?.*)?$/.test(u));
if (!process.argv[2]) { console.error('usage: node scripts/check-seams.mjs <url> [more urls] | --self-test'); process.exit(2); }
const browser = await chromium.launch();
let bad = 0;
for (const u of urls) if (!report(await judge(browser, u))) bad++;
await browser.close();
process.exit(bad ? 1 : 0);
