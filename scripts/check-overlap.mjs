#!/usr/bin/env node
/**
 * No words sit on other words (page rules 3s, checklist R3s.26). Moved out of check-site.mjs on 29 Oct 2026 so a
 * site made before this rule is not held to it (Tzvi: "new rules shouldnt affect already made sites"; publish-page
 * runs it by its rule id, scripts/rule-dates.mjs).
 *
 *   node scripts/check-overlap.mjs <url> [more urls]        exit 1 on any OVERLAP
 */
import { createRequire } from 'node:module';
const { chromium } = createRequire(process.cwd() + '/')('playwright');

const urls = process.argv.slice(2);
if (!urls.length) { console.error('usage: node scripts/check-overlap.mjs <url> [more urls]'); process.exit(2); }
const fails = [];
const fail = (url, kind, msg) => { fails.push(1); console.log(`${kind.padEnd(6)} ${msg}  (${url.replace(/\?.*$/, '')})`); };
const browser = await chromium.launch();

for (const url of urls) {
  // ── words on words (Tzvi, 26 Oct 2026: Michal Simkin's quotes sat on her heading's paragraph at 1280x720 and
  // 1366x768, the most common laptop screens, while every check looked at 1440x900): scroll the whole page,
  // pinned scenes included, at short laptop heights and on a phone; two visible lines of different text may not
  // cover each other, unless something opaque sits between them ──
  for (const [w, h] of [[1366, 768], [1280, 720], [1440, 900], [390, 844]]) {
    const page = await browser.newPage({ viewport: { width: w, height: h } });
    await page.goto(url, { waitUntil: 'load' }); await page.waitForTimeout(1200);
    const hits = await page.evaluate(async () => {
      document.documentElement.style.scrollBehavior = 'auto';
      const seen = new Set(), out = [];
      const shown = (el) => { let o = 1; for (let n = el; n; n = n.parentElement) { const cs = getComputedStyle(n); if (cs.visibility === 'hidden' || cs.display === 'none') return 0; o *= +cs.opacity; } return o; };
      const opaque = (el) => { const cs = getComputedStyle(el), m = cs.backgroundColor.match(/[\d.]+/g); return cs.backgroundImage !== 'none' || (m && (m.length < 4 || +m[3] > 0.9) && cs.backgroundColor !== 'rgba(0, 0, 0, 0)'); };
      for (let y = 0; y <= document.documentElement.scrollHeight - innerHeight + 1; y += Math.round(innerHeight * 0.45)) {
        scrollTo(0, y); await new Promise((r) => setTimeout(r, 220));
        const lines = [];
        const tw = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT);
        for (let t = tw.nextNode(); t; t = tw.nextNode()) {
          const el = t.parentElement; if (!t.textContent.trim() || !el || el.closest('script, style, noscript, svg, [aria-hidden="true"] [aria-hidden="true"]')) continue;
          const range = document.createRange(); range.selectNodeContents(t);
          // words in a fixed bar pass over the page as it scrolls (that is the bar's job, not a layout fault)
          let fixed = false, clip = { l: 0, t: 0, r: innerWidth, b: innerHeight };
          if (el.checkVisibility && !el.checkVisibility({ contentVisibilityAuto: true })) continue;  // a closed <details> answer
          for (let n = el; n && n !== document.body; n = n.parentElement) { const cs = getComputedStyle(n);
            if (cs.position === 'fixed' || (cs.position === 'sticky' && n.getBoundingClientRect().height < innerHeight * 0.25)) fixed = true;  // a top or bottom bar, fixed or sticky
            if (/hidden|clip|auto|scroll/.test(cs.overflow + cs.overflowX + cs.overflowY)) { const q = n.getBoundingClientRect(); clip = { l: Math.max(clip.l, q.left), t: Math.max(clip.t, q.top), r: Math.min(clip.r, q.right), b: Math.min(clip.b, q.bottom) }; } }
          if (fixed) continue;
          // a closed answer or a scrolled-away card is clipped by its box: only the part that shows counts
          for (const q of range.getClientRects()) { const r = DOMRect.fromRect({ x: Math.max(q.left, clip.l), y: Math.max(q.top, clip.t), width: Math.min(q.right, clip.r) - Math.max(q.left, clip.l), height: Math.min(q.bottom, clip.b) - Math.max(q.top, clip.t) });
            if (r.width > 4 && r.height > 6 && r.height > q.height * 0.6) lines.push({ r, el, t }); }
        }
        const live = lines.filter((l) => shown(l.el) > 0.6);
        for (let i = 0; i < live.length; i++) for (let j = i + 1; j < live.length; j++) {
          const a = live[i], b = live[j]; if (a.t === b.t) continue;
          // a line's box is the font's full height; the letters sit in its middle half, so lines that only touch
          // (a struck old price on top of the new one, a small label above a headline) are not counted
          const core = (r) => ({ t: r.top + r.height * 0.25, b: r.bottom - r.height * 0.25 });
          const ca = core(a.r), cb = core(b.r);
          const x = Math.min(a.r.right, b.r.right) - Math.max(a.r.left, b.r.left), yy = Math.min(ca.b, cb.b) - Math.max(ca.t, cb.t);
          if (x < 4 || yy < 2) continue;
          // something opaque between the two (a card over text) means only one is seen
          const cx = Math.max(a.r.left, b.r.left) + x / 2, cy = Math.max(ca.t, cb.t) + yy / 2;
          const stack = document.elementsFromPoint(cx, cy), ia = stack.findIndex((e) => e === a.el || e.contains(a.el)), ib = stack.findIndex((e) => e === b.el || e.contains(b.el));
          if (ia < 0 || ib < 0) continue;
          const [top, low] = ia < ib ? [ia, ib] : [ib, ia], lowEl = stack[low];
          if (stack.slice(top, low).some((e) => !e.contains(lowEl) && opaque(e))) continue;
          const key = [a.t.textContent.trim().slice(0, 30), b.t.textContent.trim().slice(0, 30)].sort().join('|');
          if (seen.has(key)) continue; seen.add(key);
          out.push(`"${a.t.textContent.trim().slice(0, 30)}" and "${b.t.textContent.trim().slice(0, 30)}" overlap ${Math.round(y)} px down`);
          if (out.length >= 4) return out;
        }
      }
      return out;
    });
    for (const m of hits) fail(url, 'OVERLAP', `${m} at ${w}x${h}`);
    await page.close();
  }
  console.log(`${url.replace(/\?.*$/, '')}: checked`);
}
await browser.close();
if (fails.length) { console.error(`\n${fails.length} problem(s). Page rules 3s (R3s.26).`); process.exit(1); }
console.log('overlap: no words on words');
