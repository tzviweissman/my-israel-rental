// Anything cut off by the box it sits in (Tzvi, 12 Oct 2026: the "10 cm"
// under Blazin' Boards' growing board was sliced in half by its section).
//
// Mark anything that flies in from off-screen with data-clip-ok; it is
// then held to the rule only once it has landed.
//
// Scrolls the page top to bottom at several screen sizes and, at every stop,
// looks at every visible piece of text and every picture: if part of it lies
// outside an ancestor that hides overflow (overflow hidden or clip), or below
// the bottom of a pinned or full-screen section, it is reported with the
// size, the scroll position and the words. Fails (exit 1) on any finding.
//
//   Run from the project folder (it uses that project's Playwright):
//   node ~/.claude/skills/build-business-page/scripts/clipped.mjs <url> [stops]
import { createRequire } from 'node:module';
const { chromium } = createRequire(process.cwd() + '/')('playwright');
const url = process.argv[2];
const STOPS = Number(process.argv[3] || 40);
const SIZES = [[1440, 900], [1536, 753], [1280, 650], [1000, 700], [768, 1024], [390, 844], [360, 640]];
const b = await chromium.launch();
const found = new Map();
for (const [w, h] of SIZES) {
  const phone = w < 600;
  const ctx = await b.newContext({ viewport: { width: w, height: h }, isMobile: phone, hasTouch: phone });
  const p = await ctx.newPage();
  await p.goto(url, { waitUntil: 'networkidle' });
  await p.waitForTimeout(600);
  const max = await p.evaluate(() => document.documentElement.scrollHeight - innerHeight);
  for (let i = 0; i <= STOPS; i++) {
    const y = Math.round((max * i) / STOPS);
    await p.evaluate((y) => scrollTo(0, y), y);
    await p.waitForTimeout(260);
    const bad = await p.evaluate(() => {
      const out = [];
      const shown = (el) => {
        for (let e = el; e && e !== document.documentElement; e = e.parentElement) {
          const s = getComputedStyle(e);
          if (s.display === 'none' || s.visibility === 'hidden' || parseFloat(s.opacity) < 0.05) return false;
        }
        return true;
      };
      const targets = [];
      const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT);
      while (walker.nextNode()) {
        const t = walker.currentNode;
        if (!t.nodeValue.trim() || !t.parentElement) continue;
        const r = document.createRange(); r.selectNodeContents(t);
        const rect = r.getBoundingClientRect();
        if (rect.width < 1 || rect.height < 1) continue;
        targets.push({ el: t.parentElement, rect, what: t.nodeValue.trim().slice(0, 60) });
      }
      document.querySelectorAll('img, video').forEach((m) => {
        const rect = m.getBoundingClientRect();
        if (rect.width > 4 && rect.height > 4) targets.push({ el: m, rect, what: '[' + m.tagName.toLowerCase() + '] ' + (m.getAttribute('alt') || m.currentSrc || '').slice(0, 50), media: true });
      });
      for (const t of targets) {
        const { rect } = t;
        // only what is on screen now
        if (rect.bottom < 0 || rect.top > innerHeight || rect.right < 0 || rect.left > innerWidth) continue;
        if (!shown(t.el)) continue;
        // Something that flies in from outside (data-clip-ok) may be cut while
        // it travels, never once it has landed: it is checked only when its
        // scroll section is past 90% (its --sc-p), i.e. at rest.
        const fly = t.el.closest('[data-clip-ok]');
        if (fly) {
          const act = fly.closest('[data-sc-act]');
          const prog = act ? parseFloat(act.style.getPropertyValue('--sc-p')) : 1;
          if (!(prog > 0.9)) continue;
        }
        for (let a = t.el.parentElement; a && a !== document.body; a = a.parentElement) {
          const s = getComputedStyle(a);
          const hides = /hidden|clip/.test(s.overflowX + s.overflowY);
          if (!hides) continue;
          const ar = a.getBoundingClientRect();
          // pictures are often cropped on purpose by a frame (object-fit, a
          // card): a picture counts only when it is cut by more than its frame.
          if (t.media && (a === t.el.parentElement || ar.width < rect.width + 2)) break;
          const over = Math.max(ar.top - rect.top, rect.bottom - ar.bottom, ar.left - rect.left, rect.right - ar.right);
          if (over > 2 && rect.bottom > ar.top && rect.top < ar.bottom) {
            out.push(t.what + ' (cut by ' + Math.round(over) + 'px by ' + a.tagName.toLowerCase() + (a.id ? '#' + a.id : a.className && typeof a.className === 'string' ? '.' + a.className.split(' ')[0] : '') + ')');
          }
          break;
        }
      }
      return out;
    });
    for (const x of bad) {
      const k = w + 'x' + h + ' ' + x;
      if (!found.has(k)) found.set(k, y);
    }
  }
  await ctx.close();
}
await b.close();
if (!found.size) { console.log('clipped: nothing cut off at', SIZES.map((s) => s.join('x')).join(', ')); process.exit(0); }
for (const [k, y] of found) console.log('CUT', k, 'at scroll', y);
process.exit(1);
