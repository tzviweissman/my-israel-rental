#!/usr/bin/env node
/**
 * The glitches a still screenshot cannot show (Tzvi, 20 Oct 2026: "what else
 * can we add to the checker to prevent glitches and issues", then "yes add
 * them all and build the checker"). Page rules 3s. Run it on every page of a
 * site with the other checks (clipped, readable, check-fits, check-motion).
 *
 *   node scripts/check-site.mjs <url> [more urls]        exit 1 on any FAIL
 *
 *   BROKEN     a script error, a console error, a missing file (404), a link
 *              to another page of the site that does not open
 *   SHIFT      the layout moves after the page has loaded, or tapping a choice
 *              moves the sections after it
 *   GLYPH      a character (₪, Hebrew, →, ·) that the page's fonts do not have,
 *              so it shows in a fallback font (the tiny ₪ of 20 Oct)
 *   STATE      a button or link with no hover or no pressed state
 *   TAP        on a phone, something to tap smaller than 40 px, or two taps
 *              overlapping
 *   ALIGN      text in a section starting 2 to 12 px off the section's edge;
 *              buttons of the same kind with different heights or corners;
 *              a card name less than 1.25 times its line under it
 *   PHONE      the page scrolls sideways; at the end of the page the bottom
 *              bar covers something to tap
 *   MEDIA      a photo over 600 KB, an <img> without width and height, a
 *              video without a poster; with motion switched off, words still
 *              hidden after scrolling
 *   FLOW       the order or booking form sends with nothing filled in, or,
 *              filled in, sends no WhatsApp message, or a message without the
 *              total the page shows
 * Run from the repo (it uses its Playwright).
 */
import { createRequire } from 'node:module';
const { chromium } = createRequire(process.cwd() + '/')('playwright');

const urls = process.argv.slice(2);
if (!urls.length) { console.error('usage: node scripts/check-site.mjs <url> [more urls]'); process.exit(2); }
const fails = [];
const fail = (url, kind, msg) => { fails.push(1); console.log(`${kind.padEnd(6)} ${msg}  (${url.replace(/\?.*$/, '')})`); };
const browser = await chromium.launch();

for (const url of urls) {
  const origin = new URL(url).origin;
  // ── broken things, layout shift after load, media sizes, glyphs (laptop) ──
  {
    const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
    const big = [];
    page.on('pageerror', (e) => fail(url, 'BROKEN', `script error: ${e.message}`));
    page.on('console', (m) => { if (m.type() === 'error' && !/favicon/i.test(m.text())) fail(url, 'BROKEN', `console error: ${m.text().slice(0, 140)}`); });
    page.on('response', async (r) => {
      const u = r.url(); if (!u.startsWith(origin) || /favicon/.test(u)) return;
      if (r.status() >= 400) fail(url, 'BROKEN', `${r.status()} for ${u.replace(origin, '')}`);
      const len = +(r.headers()['content-length'] || 0); if (/\.(jpe?g|png|webp|avif)(\?|$)/i.test(u) && len > 600 * 1024) big.push(`${u.replace(origin, '')} (${Math.round(len / 1024)} KB)`);
    });
    await page.addInitScript(() => { window.__cls = 0; new PerformanceObserver((l) => { for (const e of l.getEntries()) if (!e.hadRecentInput && performance.now() > 1500) window.__cls += e.value; }).observe({ type: 'layout-shift', buffered: true }); });
    await page.goto(url, { waitUntil: 'load' }); await page.waitForTimeout(3500);
    const cls = await page.evaluate(() => window.__cls);
    if (cls > 0.05) fail(url, 'SHIFT', `the layout moves after loading (shift score ${cls.toFixed(3)}); keep space for late photos and fonts`);
    for (const b of big) fail(url, 'MEDIA', `photo over 600 KB: ${b}`);
    const media = await page.evaluate(() => ({
      noSize: [...document.querySelectorAll('img')].filter((i) => !i.getAttribute('width') || !i.getAttribute('height')).map((i) => i.getAttribute('src')).slice(0, 5),
      noPoster: [...document.querySelectorAll('video')].filter((v) => !v.getAttribute('poster') && !v.poster).length,
    }));
    for (const s of media.noSize) fail(url, 'MEDIA', `<img> without width and height (the page jumps when it loads): ${s}`);
    if (media.noPoster) fail(url, 'MEDIA', `${media.noPoster} video(s) without a poster still`);
    // links to the site's own pages open
    const links = await page.evaluate((o) => [...new Set([...document.querySelectorAll('a[href]')].map((a) => a.href).filter((h) => h.startsWith(o) && !/#/.test(h.replace(/#.*$/, '')) && /\.html|\/$/.test(h.split('?')[0])).map((h) => h.split('#')[0]))], origin);
    for (const l of links) { const r = await page.request.get(l).catch(() => null); if (!r || r.status() >= 400) fail(url, 'BROKEN', `link does not open: ${l.replace(origin, '')}`); }
    // glyphs: a character the font stack does not have renders in a fallback; measured with two
    // different generic families behind the stack: if the stack has it, both widths are the same
    const glyphs = await page.evaluate(async () => {
      await document.fonts.ready;
      const want = /[₪→·×–֐-׿]/g, seen = new Map(), out = [];
      const walk = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT);
      while (walk.nextNode()) {
        const n = walk.currentNode, el = n.parentElement; if (!el || el.closest('script,style')) continue;
        const cs = getComputedStyle(el); if (cs.display === 'none' || cs.visibility === 'hidden') continue;
        const chars = (n.textContent.match(want) || []); if (!chars.length) continue;
        const stack = cs.fontFamily.split(',').map((f) => f.trim()).filter((f) => !/^(serif|sans-serif|monospace|cursive|fantasy|system-ui|ui-[a-z-]+|-apple-system|emoji)$/i.test(f)).join(', ');
        for (const ch of new Set(chars)) {
          const key = stack + '|' + ch; if (seen.has(key)) continue;
          const c = document.createElement('canvas').getContext('2d');
          // a canvas only uses faces already loaded; a face loaded on demand (Google's &text= subsets) may not be yet
          await document.fonts.load(`${cs.fontWeight} 40px ${stack}`, ch).catch(() => {});
          c.font = `${cs.fontWeight} 40px ${stack}, serif`; const a = c.measureText(ch).width;
          c.font = `${cs.fontWeight} 40px ${stack}, monospace`; const b = c.measureText(ch).width;
          const missing = stack && Math.abs(a - b) > 0.5; seen.set(key, missing);
          if (missing) out.push(`"${ch}" in ${stack} (e.g. "${n.textContent.trim().slice(0, 40)}")`);
        }
      }
      return out;
    });
    for (const g of glyphs) fail(url, 'GLYPH', `the fonts have no ${g}: add a face that has it to the stack`);
    // hover and pressed states on buttons and button-like links
    const targets = await page.evaluate(() => {
      const els = [...document.querySelectorAll('a.btn, a.btn-line, button, .btn, [role="button"]')].filter((e) => { const r = e.getBoundingClientRect(), cs = getComputedStyle(e); return r.width > 20 && r.height > 20 && cs.visibility !== 'hidden' && cs.display !== 'none' && cs.pointerEvents !== 'none' && !e.disabled; });
      const kinds = new Map(); els.forEach((e, i) => { const k = e.className.trim().split(/\s+/).sort().join('.') + e.tagName; if (!kinds.has(k)) { kinds.set(k, i); e.setAttribute('data-site-i', i); } });
      return [...kinds.values()];
    });
    for (const i of targets.slice(0, 14)) {
      const sel = `[data-site-i="${i}"]`;
      const el = await page.$(sel); if (!el) continue;
      try {
        await el.scrollIntoViewIfNeeded(); await page.mouse.move(1, 1); await page.waitForTimeout(250);
        const look = () => page.evaluate((s) => { const e = document.querySelector(s); if (!e) return ''; const c = getComputedStyle(e); const ch = e.firstElementChild ? getComputedStyle(e.firstElementChild) : c;
          return [c.backgroundColor, c.color, c.borderColor, c.transform, c.boxShadow, c.textDecorationLine, c.filter, c.opacity, ch.transform, ch.color].join('|'); }, sel);
        const rest = await look(); const box = await el.boundingBox(); if (!box) continue;
        await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2); await page.waitForTimeout(450); const hover = await look();
        await page.mouse.down(); await page.waitForTimeout(160); const press = await look();
        await page.mouse.move(1, 1); await page.mouse.up(); await page.waitForTimeout(100);
        const name = await page.evaluate((s) => { const e = document.querySelector(s); return (e.getAttribute('aria-label') || e.textContent || '').trim().replace(/\s+/g, ' ').slice(0, 30); }, sel);
        if (hover === rest) fail(url, 'STATE', `"${name}" does not change when the pointer is on it`);
        if (press === hover && press === rest) fail(url, 'STATE', `"${name}" does not react when pressed`);
      } catch { /* moved or detached by its own handler */ }
    }
    // alignment, same-kind buttons, card hierarchy
    const align = await page.evaluate(() => {
      const out = [];
      for (const sec of document.querySelectorAll('section, header.page-head')) {
        const wrap = sec.querySelector('.wrap') || sec; const W = wrap.getBoundingClientRect(); if (!W.width) continue;
        const pad = parseFloat(getComputedStyle(wrap).paddingLeft) || 0, edge = W.left + pad;
        for (const e of wrap.querySelectorAll(':scope > h1, :scope > h2, :scope > p, :scope > .lede, :scope > .caps, :scope > div > h2, :scope > div > p.lede')) {
          const r = e.getBoundingClientRect(); if (!r.width || getComputedStyle(e).textAlign === 'center') continue;
          const off = Math.abs(r.left - edge); if (off >= 2 && off <= 12) out.push(`"${e.textContent.trim().slice(0, 30)}" starts ${Math.round(off)} px off its section's edge`);
        }
      }
      const groups = new Map();
      for (const b of document.querySelectorAll('.btn, .btn-line')) {
        const r = b.getBoundingClientRect(); if (!r.height || b.closest('.bar, .step')) continue;
        const k = b.className.split(/\s+/).filter((c) => /^btn/.test(c)).sort().join('.') + '@' + (b.closest('section, header, footer')?.className || ''); const cs = getComputedStyle(b);
        (groups.get(k) || groups.set(k, []).get(k)).push([Math.round(r.height), cs.borderRadius, b.textContent.trim().slice(0, 20)]);
      }
      for (const [k, list] of groups) { const h = new Set(list.map((x) => x[0])), rad = new Set(list.map((x) => x[1]));
        if (h.size > 1 && Math.max(...h) - Math.min(...h) > 4) out.push(`buttons of one kind (${k.split('@')[0]}) have different heights: ${list.map((x) => `"${x[2]}" ${x[0]}px`).join(', ')}`);
        if (rad.size > 1) out.push(`buttons of one kind (${k.split('@')[0]}) have different corners`); }
      for (const h of document.querySelectorAll('h3')) {
        const p = h.parentElement && [...h.parentElement.children].find((c) => c !== h && c.matches('p, small, .meta, .pr')); if (!p || !p.textContent.trim()) continue;
        const a = parseFloat(getComputedStyle(h).fontSize), b = parseFloat(getComputedStyle(p).fontSize);
        if (a / b < 1.25) out.push(`"${h.textContent.trim().slice(0, 30)}" is only ${(a / b).toFixed(2)}x the line under it (at least 1.25x)`);
      }
      return [...new Set(out)];
    });
    for (const a of align) fail(url, 'ALIGN', a);
    await page.close();
  }
  // ── choices must not move the sections after them ──
  {
    const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
    await page.goto(url, { waitUntil: 'load' }); await page.waitForTimeout(1500);
    const n = await page.evaluate(() => { const bs = [...document.querySelectorAll('button[aria-pressed], label.opt, label.plan')]; bs.forEach((b, i) => b.setAttribute('data-site-c', i)); return bs.length; });
    for (let i = 0; i < Math.min(n, 8); i++) {
      const moved = await page.evaluate(async (i) => {
        document.documentElement.style.scrollBehavior = 'auto';
        const b = document.querySelector(`[data-site-c="${i}"]`); const own = b.closest('section') || document.body;
        const after = [...document.querySelectorAll('section')].filter((s) => s !== own && (own.compareDocumentPosition(s) & Node.DOCUMENT_POSITION_FOLLOWING));
        const before = after.map((s) => s.getBoundingClientRect().top + scrollY);
        b.click(); await new Promise((r) => setTimeout(r, 1400));
        const now = after.map((s) => s.getBoundingClientRect().top + scrollY);
        const d = now.map((y, k) => Math.abs(y - before[k])); const m = Math.max(0, ...d);
        return m > 4 && !b.closest('.plans, #plans, .mix') ? [m, (b.getAttribute('aria-label') || b.textContent).trim().slice(0, 30)] : null;
      }, i);
      if (moved) fail(url, 'SHIFT', `choosing "${moved[1]}" moves the page below it by ${Math.round(moved[0])} px (keep the space fixed)`);
    }
    await page.close();
  }
  // ── phone: sideways scroll, tap sizes, overlaps, the bottom bar at the end ──
  for (const [w, h] of [[390, 844], [360, 640]]) {
    const page = await browser.newPage({ viewport: { width: w, height: h }, isMobile: true, hasTouch: true });
    await page.goto(url, { waitUntil: 'load' }); await page.waitForTimeout(1200);
    const r = await page.evaluate(async () => {
      const out = [];
      if (document.documentElement.scrollWidth > innerWidth + 1) out.push(['PHONE', `the page scrolls sideways (${document.documentElement.scrollWidth}px wide)`]);
      const taps = [...document.querySelectorAll('a, button, input[type=radio] + *, label.chip, label.opt, label.plan, [role="button"]')].filter((e) => { const r = e.getBoundingClientRect(), cs = getComputedStyle(e); return r.width && r.height && cs.visibility !== 'hidden' && cs.display !== 'none' && !e.closest('p, li > small, .foot, footer, .err') ; });
      const small = new Set();
      for (const e of taps) { const r = e.getBoundingClientRect(); if (Math.min(r.width, r.height) < 40 && !(e.tagName === 'A' && getComputedStyle(e).display === 'inline')) small.add((e.getAttribute('aria-label') || e.textContent || e.className).trim().replace(/\s+/g, ' ').slice(0, 28)); }
      for (const s of [...small].slice(0, 6)) out.push(['TAP', `"${s}" is smaller than 40 px to tap`]);
      document.documentElement.style.scrollBehavior = 'auto'; scrollTo(0, document.documentElement.scrollHeight); await new Promise((r) => setTimeout(r, 700));
      const bar = [...document.querySelectorAll('.bar, .dock, [class*="bar"]')].find((b) => { const cs = getComputedStyle(b), r = b.getBoundingClientRect(); return cs.position === 'fixed' && r.bottom >= innerHeight - 2 && r.height < innerHeight * .3 && cs.visibility !== 'hidden' && +cs.opacity > .1 && r.top < innerHeight; });
      if (bar) { const br = bar.getBoundingClientRect();
        for (const e of document.querySelectorAll('main a, main button')) { if (bar.contains(e)) continue; const r = e.getBoundingClientRect(); if (r.height && r.bottom > br.top + 4 && r.top < br.bottom) { out.push(['PHONE', `at the end of the page the bottom bar covers "${e.textContent.trim().slice(0, 28)}"`]); break; } } }
      return out;
    });
    for (const [k, m] of r) fail(url, k, `${m} at ${w}x${h}`);
    await page.close();
  }
  // ── motion switched off: nothing stays hidden ──
  {
    const ctx = await browser.newContext({ viewport: { width: 1280, height: 800 }, reducedMotion: 'reduce' });
    const page = await ctx.newPage(); await page.goto(url, { waitUntil: 'load' }); await page.waitForTimeout(800);
    const hidden = await page.evaluate(async () => {
      document.documentElement.style.scrollBehavior = 'auto';
      for (let y = 0; y < document.documentElement.scrollHeight; y += innerHeight * .8) { scrollTo(0, y); await new Promise((r) => setTimeout(r, 120)); }
      const out = []; for (const e of document.querySelectorAll('main h1, main h2, main h3, main p, main .btn')) { let o = 1; for (let n = e; n; n = n.parentElement) o *= +getComputedStyle(n).opacity; if (e.getBoundingClientRect().height && o < .3 && e.textContent.trim()) out.push(e.textContent.trim().slice(0, 30)); }
      return out.slice(0, 4);
    });
    for (const t of hidden) fail(url, 'MEDIA', `with motion switched off, "${t}" stays hidden`);
    await ctx.close();
  }
  // ── the order or booking flow, if the page has one ──
  {
    const page = await browser.newPage({ viewport: { width: 1280, height: 900 } });
    await page.addInitScript(() => { window.__sent = ''; window.open = (u) => { window.__sent = String(u); return {}; }; try { localStorage.clear(); } catch (e) { /* none */ } });
    await page.goto(url, { waitUntil: 'load' }); await page.waitForTimeout(900);
    const hasForm = await page.$('form button[type=submit], form#form');
    if (hasForm) {
      await page.evaluate(() => { const s = document.querySelector('form button[type=submit]') || document.querySelector('#send'); s && s.click(); });
      await page.waitForTimeout(300);
      const empty = await page.evaluate(() => ({ sent: window.__sent, errors: [...document.querySelectorAll('.err, [role=alert]')].filter((e) => e.textContent.trim()).length }));
      if (empty.sent) fail(url, 'FLOW', 'the form sends with nothing filled in');
      else if (!empty.errors) fail(url, 'FLOW', 'sending an empty form shows no message saying what is missing');
      // an order in steps (page rules 3k.1): fill what each step shows, press its button, up to 4 steps
      for (let stepN = 0; stepN < 4; stepN++) {
      await page.evaluate((first) => {
        const clickFirst = (sel) => { const e = document.querySelector(sel); if (e) e.click(); };
        if (first) { clickFirst('#st-add'); clickFirst('#svcs input'); }
        const groups = {}; for (const r of document.querySelectorAll('form input[type=radio]')) if (!groups[r.name] && r.offsetParent !== null && r.name !== 'pack') { groups[r.name] = 1; r.click(); }
        // choices made with checkboxes (Chicken Munch's kinds of chicken): tick the first visible one of each group none of which is ticked
        const boxes = {}; for (const c of document.querySelectorAll('form input[type=checkbox]')) { if (c.offsetParent === null) continue; const g = c.name || (c.closest('fieldset, [role=group]') || {}).id || 'x'; (boxes[g] = boxes[g] || []).push(c); }
        for (const g of Object.values(boxes)) if (!g.some((c) => c.checked)) g[0].click();
        const d = new Date(Date.now() + 5 * 864e5); while (d.getDay() === 6 || d.getDay() === 5) d.setDate(d.getDate() + 1);
        for (const i of document.querySelectorAll('form input, form textarea')) {
          if (i.type === 'radio' || i.type === 'checkbox' || i.offsetParent === null) continue;
          const v = i.type === 'tel' ? '0501234567' : i.type === 'date' ? d.toISOString().slice(0, 10) : i.type === 'email' ? 'test@example.com' : i.tagName === 'TEXTAREA' ? '' : 'Test 1';
          i.value = v; i.dispatchEvent(new Event('input', { bubbles: true })); i.dispatchEvent(new Event('change', { bubbles: true }));
        }
      }, stepN === 0);
      await page.waitForTimeout(400);
      await page.evaluate(() => { const t = [...document.querySelectorAll('#times input')].find((r) => r.offsetParent !== null); if (t && !document.querySelector('#times input:checked')) t.click(); });
      await page.waitForTimeout(200);
      await page.evaluate(() => { const s = document.querySelector('form button[type=submit]') || document.querySelector('#send'); s && s.click(); });
      await page.waitForTimeout(500);
      if (await page.evaluate(() => !!window.__sent)) break;
      }
      const res = await page.evaluate(() => ({ sent: decodeURIComponent((window.__sent.split('text=')[1] || '')), total: (document.querySelector('#total') || {}).textContent || '', errs: [...document.querySelectorAll('.err')].map((e) => e.textContent.trim()).filter(Boolean) }));
      if (!res.sent) fail(url, 'FLOW', `filled in, the form sends nothing${res.errs.length ? ` (it says: ${res.errs.join('; ')})` : ''}`);
      else if (res.total && !res.sent.includes(res.total.replace(/\s/g, '').replace(/^₪/, '₪'))) fail(url, 'FLOW', `the message does not carry the total the page shows (${res.total})`);
      else if (!/wa\.me|whatsapp/i.test(res.sent + '') && !res.sent) fail(url, 'FLOW', 'no WhatsApp message');
    }
    await page.close();
  }
  console.log(`${url.replace(/\?.*$/, '')}: checked`);
}
await browser.close();
if (fails.length) { console.error(`\n${fails.length} problem(s). Page rules 3s.`); process.exit(1); }
console.log('site: no glitches found');
