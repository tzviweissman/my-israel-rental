/**
 * The jobs board and the post-a-job form read as Hebrew pages.
 *
 * Both were entirely hardcoded English — no `useTranslation`, no `t`, not
 * one key — so a Hebrew visitor got an English page. Tzvi's standing
 * ruling (27 Aug 2026) is that the site has to be as Hebrew-friendly as
 * it is English-friendly: "if an israeli would read this they would be
 * turned off".
 *
 * A screenshot cannot answer this, and neither can reading the diff. What
 * is measured:
 *
 *   * NO Latin-script sentence survives on either page in Hebrew. Counted
 *     over the rendered text, ignoring the brand name and the things that
 *     legitimately stay Latin (URLs, currency codes, a poster's own
 *     English job title). This is the assertion that catches the string
 *     somebody forgets, which is always the toast or the empty state.
 *   * The heading resolves to a font that HAS Hebrew glyphs. Both pages
 *     set `fontFamily: 'Playfair Display'` inline, which beats the RTL
 *     stylesheet and silently falls back to a system serif — visible only
 *     if you know the letterforms.
 *   * The page is RTL and does not scroll sideways at 375.
 *
 * Usage: node scripts/check-jobs-hebrew.mjs <jwt>
 *   (the post-a-job form is behind auth)
 */
import { chromium } from 'playwright';

const TOKEN = process.argv[2];
if (!TOKEN) {
  console.error('usage: node scripts/check-jobs-hebrew.mjs <jwt>   (post-a-job needs a signed-in user)');
  process.exit(1);
}

const APP = process.env.APP_ORIGIN || 'http://localhost:3210';
const HEBREW = /[֐-׿]/;
const browser = await chromium.launch();
const failures = [];
const note = (m) => console.log('  ' + m);

// Latin text that is CORRECT on a Hebrew page.
const ALLOWED = [
  /^MyIsraelRental$/i,
  /^(ILS|USD|EUR|GBP)$/,
  /^[$₪€£]?[\d.,]+$/,
  /^https?:/i,
  /^[\W\d\s]*$/,          // punctuation, digits, arrows
  /^(WhatsApp|Bit|Google)$/i,
];

const open = async (path, width = 1280) => {
  const ctx = await browser.newContext({ viewport: { width, height: 900 } });
  await ctx.addInitScript((tk) => {
    try {
      localStorage.setItem('i18nextLng', 'he');
      sessionStorage.setItem('token', tk);
    } catch { /* private mode */ }
  }, TOKEN);
  const page = await ctx.newPage();
  await page.goto(`${APP}${path}`, { waitUntil: 'domcontentloaded', timeout: 60000 });
  await page.waitForTimeout(3500);
  return { ctx, page };
};

/**
 * Leaf text nodes of the page's own CHROME.
 *
 * The nav is excluded because it is shared and not this page's problem.
 * So are the job rows: a job posted in English displays in English on
 * the Hebrew site, correctly — that is the poster's text, not ours, and
 * counting it would make this check permanently red for a reason nobody
 * can fix. Category chips come from the API and are checked by
 * test-category-groups.mjs instead.
 */
const leafText = (page) => page.evaluate(() => {
  const root = document.querySelector('[data-testid$="-page"]') || document.body;
  // `jobs-cat-all` is OUR copy and stays in scope; the slug chips carry
  // API labels and are covered by test-category-groups.mjs.
  const SKIP = '[data-testid="global-nav"], [data-testid^="jobs-row-"],'
    + ' [data-testid^="jobs-cat-"]:not([data-testid="jobs-cat-all"])';
  const out = [];
  const walk = (el) => {
    for (const n of el.childNodes) {
      if (n.nodeType === 3) {
        const s = n.textContent.trim();
        if (s) out.push(s);
      } else if (n.nodeType === 1 && !n.closest(SKIP)) {
        walk(n);
      }
    }
  };
  walk(root);
  return out;
});

try {
  // Three states, not one. The board with results exercises almost no
  // copy of its own — nearly everything on screen is a job row. The
  // strings that actually get forgotten live in the EMPTY state and the
  // saved-search strip, and neither is on screen in the default view.
  for (const [label, path] of [
    ['jobs board', '/businesses/jobs'],
    ['jobs board (empty)', '/businesses/jobs?category=religious-services'],
    ['jobs board (digest strip)', '/businesses/jobs?category=cleaning-services'],
    ['post a job', '/businesses/post-job'],
  ]) {
    const { ctx, page } = await open(path);

    const dir = await page.evaluate(() => document.documentElement.dir);
    if (dir !== 'rtl') failures.push(`${label}: document dir is "${dir}", not rtl`);

    // --- the heading's actual font ---------------------------------------
    const head = await page.evaluate(() => {
      const h = document.querySelector('h1');
      if (!h) return null;
      return {
        text: h.textContent.trim(),
        font: getComputedStyle(h).fontFamily,
        inline: h.style.fontFamily || '',
      };
    });
    if (!head) {
      failures.push(`${label}: no <h1> found`);
    } else {
      note(`${label}: h1 "${head.text}" — font ${head.font}`);
      if (/playfair/i.test(head.font)) {
        failures.push(
          `${label}: the heading resolves to Playfair, which has no Hebrew glyphs — `
          + `it renders in a fallback serif (inline style: "${head.inline}")`,
        );
      }
      if (!HEBREW.test(head.text)) {
        failures.push(`${label}: the heading is still English ("${head.text}")`);
      }
    }

    // --- any English sentence left -----------------------------------------
    const strings = await leafText(page);
    const english = strings.filter(
      (s) => /[A-Za-z]{3}/.test(s) && !HEBREW.test(s) && !ALLOWED.some((re) => re.test(s)),
    );
    note(`${label}: ${strings.length} chrome text nodes, ${english.length} still English`);
    if (strings.length < 3) {
      failures.push(`${label}: only ${strings.length} text nodes in scope — the check is looking at nothing`);
    }
    if (english.length) {
      failures.push(`${label}: untranslated — ${JSON.stringify([...new Set(english)].slice(0, 6))}`);
    }
    await ctx.close();
  }

  // --- narrow ------------------------------------------------------------
  for (const path of ['/businesses/jobs', '/businesses/post-job']) {
    const { ctx, page } = await open(path, 375);
    const overflow = await page.evaluate(
      () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
    );
    note(`he @375 ${path}: overflow=${overflow}px`);
    if (overflow > 1) failures.push(`he @375 ${path}: page scrolls sideways by ${overflow}px`);
    await ctx.close();
  }
} finally {
  await browser.close();
}

if (failures.length) {
  console.error('\nFAILED:');
  failures.forEach((f) => console.error('  -', f));
  process.exit(1);
}
console.log('\nall checks passed');
