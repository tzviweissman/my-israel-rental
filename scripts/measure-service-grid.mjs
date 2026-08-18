/**
 * Measure the services grid at the widths and result-counts the
 * service-card spec names: 1 / 2 / 3 / 7 results at 1280 / 768 / 375, in
 * both directions. Reports card width and whether the title or the
 * provider line is truncated.
 *
 * Scratch verification tooling, like screenshot.mjs. Safe to delete.
 */
import { chromium } from 'playwright';

const FRONT = 'http://localhost:3210';
// Search terms that isolate N of the seeded SPECFIX gigs.
const CASES = [
  ['1 result', 'Playful'],
  ['2 results', 'Cleaning'],
  ['3 results', 'Jerusalem'],
  ['7 results', ''],
];
const WIDTHS = [1280, 768, 375];

const browser = await chromium.launch();
for (const lang of ['en', 'he']) {
  for (const width of WIDTHS) {
    const page = await browser.newPage({ viewport: { width, height: 1000 } });
    await page.addInitScript((lng) => localStorage.setItem('i18nextLng', lng), lang);
    for (const [label, q] of CASES) {
      await page.goto(`${FRONT}/services${q ? `?q=${encodeURIComponent(q)}` : ''}`, {
        waitUntil: 'networkidle',
        timeout: 60000,
      });
      await page.waitForTimeout(900);
      const m = await page.evaluate(() => {
        const cards = [...document.querySelectorAll('[data-testid^="services-gig-"]')];
        if (!cards.length) return { results: 0 };
        const grid = cards[0].closest('.grid');
        const ps = cards[0].querySelectorAll('p');
        const trunc = (el) => (el ? el.scrollWidth > el.clientWidth + 1 : null);
        return {
          results: cards.length,
          cols: getComputedStyle(grid).gridTemplateColumns.split(' ').length,
          cardW: Math.round(cards[0].getBoundingClientRect().width),
          titleTrunc: trunc(ps[0]),
          subTrunc: trunc(ps[1]),
          placeholders: document.querySelectorAll('[data-testid="cover-placeholder"]').length,
        };
      });
      console.log(
        `${lang} ${String(width).padStart(4)} ${label.padEnd(10)} ` +
        `results=${m.results} cols=${m.cols ?? '-'} cardW=${m.cardW ?? '-'} ` +
        `titleTrunc=${m.titleTrunc} subTrunc=${m.subTrunc} placeholders=${m.placeholders ?? '-'}`,
      );
    }
    await page.close();
  }
}
await browser.close();
