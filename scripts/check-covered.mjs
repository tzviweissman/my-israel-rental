/**
 * Is any text on a page covered by something else? For any page (16 Nov 2026: the sign-up panel's live bar sat on
 * the photo sphere and no check noticed).
 *
 *   node scripts/check-covered.mjs <url> [--selector "main"] [--wait 3000] [--out screenshots/covered]
 *
 * Opens the page on laptop (1440x900, 1280x720) and phone (390x844), English and Hebrew, scrolls it a screen at a
 * time and, for every piece of text, asks the browser what is on top at the middle of it. Anything that is not the
 * text itself is reported. A menu bar or button that stays fixed on screen while you scroll is allowed to pass over
 * text (that is what it is for); text cut off on purpose by a box that hides its overflow is not counted.
 * Exit 1 when something is covered. Saves a picture of each screen it checks.
 *
 * `covered(root)` is exported for checks that need their own setup.
 */
import { pathToFileURL } from 'node:url';

export function covered(root) {
  const fixedish = (n) => {
    for (let a = n; a && a !== document.documentElement; a = a.parentElement) {
      const p = getComputedStyle(a).position;
      if (p === 'fixed' || p === 'sticky') return true;
    }
    return false;
  };
  const bad = [];
  for (const el of root.querySelectorAll('*')) {
    const own = [...el.childNodes].some((n) => n.nodeType === 3 && n.textContent.trim());
    if (!own) continue;
    const r = el.getBoundingClientRect();
    if (r.width < 2 || r.height < 2 || getComputedStyle(el).visibility === 'hidden') continue;
    const x = r.left + r.width / 2;
    const y = r.top + r.height / 2;
    if (x < 0 || y < 0 || x > innerWidth || y > innerHeight) continue;
    let clipped = false;
    for (let a = el.parentElement; a && !clipped; a = a.parentElement) {
      if (getComputedStyle(a).overflow === 'visible') continue;
      const c = a.getBoundingClientRect();
      clipped = x < c.left || x > c.right || y < c.top || y > c.bottom;
    }
    if (clipped) continue;
    const hit = document.elementFromPoint(x, y);
    if (!hit || el.contains(hit) || hit.contains(el)) continue;
    if (fixedish(hit) && !fixedish(el)) continue;
    bad.push(`"${el.textContent.trim().slice(0, 50)}" is under <${hit.tagName.toLowerCase()} class="${String(hit.className).slice(0, 60)}">`);
  }
  return bad;
}

export const VIEWS = [['laptop', 1440, 900, 'en'], ['laptop-he', 1440, 900, 'he'], ['small-laptop', 1280, 720, 'en'], ['phone', 390, 844, 'en'], ['phone-he', 390, 844, 'he']];

async function main() {
  const { chromium } = await import('playwright');
  const { mkdir } = await import('node:fs/promises');
  const url = process.argv[2];
  if (!url || url.startsWith('--')) {
    console.log('Usage: node scripts/check-covered.mjs <url> [--selector "main"] [--wait 3000] [--out dir]');
    process.exit(2);
  }
  const arg = (k, d) => { const i = process.argv.indexOf(k); return i > 0 ? process.argv[i + 1] : d; };
  const selector = arg('--selector', 'body');
  const wait = Number(arg('--wait', '3000'));
  const out = arg('--out', 'screenshots/covered');
  await mkdir(out, { recursive: true });
  const problems = [];
  const browser = await chromium.launch();
  try {
    for (const [name, w, h, lang] of VIEWS) {
      const page = await browser.newPage({ viewport: { width: w, height: h } });
      await page.addInitScript((l) => { try { localStorage.setItem('i18nextLng', l); } catch (e) { /* private mode */ } }, lang);
      await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 60000 });
      await page.waitForTimeout(wait);
      const total = await page.evaluate(() => document.documentElement.scrollHeight);
      for (let y = 0, n = 1; y < total && n <= 15; y += h - 120, n += 1) {
        await page.evaluate((top) => window.scrollTo(0, top), y);
        await page.waitForTimeout(500);
        const bad = await page.$eval(selector, covered).catch(() => []);
        for (const b of bad) problems.push(`${name}, screen ${n}: ${b}`);
        await page.screenshot({ path: `${out}/${name}-${n}.png` });
      }
      await page.close();
    }
  } finally {
    await browser.close();
  }
  console.log(`Pictures in ${out}`);
  const uniq = [...new Set(problems)];
  if (uniq.length) {
    console.log(`Covered text (${uniq.length}):\n  ${uniq.join('\n  ')}`);
    process.exit(1);
  }
  console.log('No text is covered.');
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) await main();
