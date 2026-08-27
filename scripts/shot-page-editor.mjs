/**
 * K3 — captures of the page editor, and the checks that a screenshot
 * cannot make.
 *
 * The editor has no preview file to diff against, so these captures ARE
 * the review artifact. What they cannot show is whether the preview is the
 * real page or a convincing drawing of one, so this also asserts the two
 * things that would be indistinguishable in a picture:
 *
 *   1. The frame's own viewport drives the media queries. The business
 *      page's sticky Message bar is `sm:hidden` — present at every width,
 *      displayed only below the sm breakpoint. Reading its computed
 *      `display` at frame width 1280 and again at 390, WITHOUT touching
 *      the window, is a direct read of whether the preview is a real
 *      viewport or a narrow div. A div-based preview returns "none" both
 *      times.
 *
 *   2. The adaptive scrim (K2) runs on the pending cover, before it is
 *      saved. Two covers are generated at genuine extremes — a near-black
 *      and a near-white — because the last pair of "dark vs bright" test
 *      images both came out mid-tone and produced 0.37 and 0.38, which
 *      proved nothing. The assertion is on the gap, not on either number.
 *
 * The token is passed in and never written to disk here: a local dev
 * credential for a seeded account on 127.0.0.1, but baking any token into
 * a committed file is a habit worth not forming.
 *
 * Usage:
 *   node scripts/shot-page-editor.mjs <jwt>
 */
import { chromium } from 'playwright';
import { mkdir } from 'node:fs/promises';
import path from 'node:path';

const token = process.argv[2];
if (!token) {
  console.error('usage: node scripts/shot-page-editor.mjs <jwt>');
  process.exit(1);
}

const APP = process.env.APP_ORIGIN || 'http://localhost:3210';
const OUT = path.join('screenshots', 'page-editor');
const TMP = path.join('scripts', '.tmp-covers');
const WIDTHS = [1280, 768, 375];

/** A solid-ish cover at a chosen lightness, written to a PNG. */
async function makeCover(browser, file, from, to) {
  const page = await browser.newPage({ viewport: { width: 1200, height: 480 } });
  await page.setContent(
    `<body style="margin:0"><div style="width:1200px;height:480px;
       background:linear-gradient(160deg,${from},${to})"></div></body>`,
  );
  await page.screenshot({ path: file });
  await page.close();
}

const open = async (browser, width) => {
  const ctx = await browser.newContext({
    viewport: { width, height: 900 },
    deviceScaleFactor: 2,
  });
  // Before any app script runs: setting it after navigation means React has
  // already mounted logged-out, and the first paint — the thing being
  // photographed — is the wrong state.
  await ctx.addInitScript((t) => {
    try { sessionStorage.setItem('token', t); } catch { /* private mode */ }
  }, token);
  return ctx;
};

/** Dashboard → Businesses → Design your page. */
async function openEditor(page) {
  await page.goto(`${APP}/dashboard`, { waitUntil: 'domcontentloaded', timeout: 60000 });
  await page.locator('[data-testid="tab-my-businesses"]').click({ timeout: 30000 });
  await page.locator('[data-testid^="business-design-"]').first().click();
  await page.locator('[data-testid="business-page-editor"]').waitFor({ timeout: 30000 });
  // The preview is a separate document; wait for the page itself inside it.
  await page.frameLocator('[data-testid="business-page-editor"] iframe')
    .locator('[data-testid="business-page"]').waitFor({ timeout: 30000 });
  // Photos inside the frame are a second document's worth of network. Too
  // short a wait photographs a page with holes where its images will be,
  // and that reads as a layout fault rather than a slow capture.
  await page.waitForTimeout(2500);
  await page.addStyleTag({
    content: '*,*::before,*::after{animation-play-state:paused !important}',
  });
}

/** The scrim the preview has settled on, once it stops changing. */
async function readSettledScrim(page, { steps = 3, gapMs = 700, maxMs = 30000 } = {}) {
  const read = () => page.evaluate(() => {
    const f = document.querySelector('[data-testid="business-page-editor"] iframe');
    return f?.contentDocument
      ?.querySelector('[data-testid="business-cover-scrim"]')
      ?.getAttribute('data-scrim') ?? null;
  });
  const deadline = Date.now() + maxMs;
  let last = await read();
  let stable = 0;
  while (Date.now() < deadline) {
    await page.waitForTimeout(gapMs);
    const now = await read();
    stable = now === last ? stable + 1 : 0;
    last = now;
    if (stable >= steps) break;
  }
  return last;
}

await mkdir(OUT, { recursive: true });
await mkdir(TMP, { recursive: true });
const browser = await chromium.launch();
const failures = [];

try {
  const darkCover = path.join(TMP, 'cover-dark.png');
  const brightCover = path.join(TMP, 'cover-bright.png');
  await makeCover(browser, darkCover, '#0a0c10', '#161a22');
  await makeCover(browser, brightCover, '#fdfdfb', '#eef0f4');

  // ---- Captures, both directions, all three widths -------------------
  for (const rtl of [false, true]) {
    for (const width of WIDTHS) {
      const ctx = await open(browser, width);
      const page = await ctx.newPage();
      /* Attached BEFORE anything loads. Registered after the navigation it
         is meant to watch, this listener catches nothing and reports a
         clean run every time — a check that cannot fail is worse than no
         check, because it is believed. Frames are included: the preview is
         a separate document and its errors are the ones that matter most
         here. */
      const errors = [];
      page.on('console', (m) => { if (m.type() === 'error') errors.push(m.text()); });
      page.on('pageerror', (e) => errors.push(String(e)));
      if (rtl) {
        await ctx.addInitScript(() => {
          try { localStorage.setItem('i18nextLng', 'he'); } catch { /* private mode */ }
        });
      }
      await openEditor(page);

      const label = `${rtl ? 'rtl' : 'ltr'}-${width}`;
      await page.screenshot({ path: path.join(OUT, `${label}.png`) });
      console.log('  wrote', `${label}.png`);

      // A heading rendered with an inline literal face name silently loses
      // its Hebrew glyphs, and the fallback looks close enough to miss by
      // eye. Read the computed value instead.
      const head = await page.locator('[data-testid="business-page-editor"] h2').first()
        .evaluate((el) => getComputedStyle(el).fontFamily);
      const expect = rtl ? 'Frank Ruhl Libre' : 'Playfair Display';
      if (!head.includes(expect)) {
        failures.push(`${label}: editor heading font is "${head}", expected ${expect}`);
      }

      /* The preview must FIT. A flex item defaults to `min-width: auto` and
         will happily stay 1280px wide inside a 900px panel — the scale then
         stays 1 and the page is silently cut off down the right-hand edge.
         That shipped once and looked fine in every check that did not
         measure it, because the visible part is perfectly correct. */
      const fit = await page.evaluate(() => {
        const f = document.querySelector('[data-testid="business-page-editor"] iframe');
        const box = f.parentElement.parentElement;
        const a = f.getBoundingClientRect();
        const b = box.getBoundingClientRect();
        return {
          drawn: a.width, room: box.clientWidth, spillStart: b.left - a.left, spillEnd: a.right - b.right,
        };
      });
      if (fit.drawn > fit.room + 1) {
        failures.push(
          `${label}: preview is ${Math.round(fit.drawn)}px wide in ${fit.room}px of room `
          + '— the page is being cut off, not scaled',
        );
      }
      /* And it must be cut off at NEITHER edge. Width alone passes a frame
         that fits but is positioned outside the panel, which is what an
         RTL parent did: the over-wide box aligned right, overflowed left,
         and the scale transform pulled it further off. */
      if (fit.spillStart > 1 || fit.spillEnd > 1) {
        failures.push(
          `${label}: preview sits outside its panel `
          + `(${Math.round(fit.spillStart)}px past the start, ${Math.round(fit.spillEnd)}px past the end)`,
        );
      }

      if (errors.length) {
        failures.push(`${label}: console errors ${JSON.stringify(errors.slice(0, 5))}`);
      }

      await ctx.close();
    }
  }

  // ---- The two things a picture cannot show --------------------------
  const ctx = await open(browser, 1440);
  const page = await ctx.newPage();
  await openEditor(page);

  const frame = () => page.frameLocator('[data-testid="business-page-editor"] iframe');
  // `sm:hidden` is on the BAR, and the testid is on the button inside it.
  // Reading the button gives `inline-flex` at every width, which looks like
  // a passing check right up until it silently isn't one.
  const stickyDisplay = () => frame()
    .locator('[data-testid="business-message-sticky"]')
    .evaluate((el) => getComputedStyle(el.parentElement).display);

  const atDesktop = await stickyDisplay();
  await page.locator('[data-testid="page-design-device-phone"]').click();
  await page.waitForTimeout(700);
  const atPhone = await stickyDisplay();
  console.log(`  sticky bar: desktop=${atDesktop} phone=${atPhone}`);
  if (!(atDesktop === 'none' && atPhone !== 'none')) {
    failures.push(
      `media queries are not following the frame: desktop=${atDesktop} phone=${atPhone}`,
    );
  }
  await page.locator('[data-testid="page-design-device-desktop"]').click();
  await page.waitForTimeout(400);

  // The scrim, on an unsaved cover.
  const scrims = {};
  let previousThumb = null;
  for (const [name, file] of [['bright', brightCover], ['dark', darkCover]]) {
    await page.locator('[data-testid="page-design-cover-input"]').setInputFiles(file);
    /* Wait for the thumbnail's SRC to change, not for the thumbnail to
       exist. On the second upload it already exists — left over from the
       first — so `waitFor` returned immediately, the scrim was read before
       the new photo had been sampled, and the check reported the PREVIOUS
       cover's value for both. It passed the first time by luck of timing
       and then reported 0.60/0.60. A check that can read stale state is
       not a check. */
    await page.waitForFunction(
      (prev) => {
        const el = document.querySelector('[data-testid="page-design-cover-thumb"]');
        return !!el && el.src && el.src !== prev;
      },
      previousThumb,
      { timeout: 60000 },
    );
    previousThumb = await page.locator('[data-testid="page-design-cover-thumb"]')
      .evaluate((el) => el.src);
    /* Then wait for the SAMPLE to settle, which is a different event again.
       `data-scrim` is never absent — it carries DEFAULT_SCRIM until the
       canvas read finishes — so "wait until it has a value" returns
       instantly and reads 0.42 for every photo, which is precisely the
       "two mid-tone images proved nothing" trap in a new costume. Poll
       until the value stops moving instead: that is the only signal that
       distinguishes "still the default" from "sampled, and the answer
       happens to be the default". */
    scrims[name] = await readSettledScrim(page);
    await page.screenshot({ path: path.join(OUT, `cover-${name}.png`) });
    console.log(`  wrote cover-${name}.png  scrim=${scrims[name]}`);
  }
  const gap = Math.abs(Number(scrims.bright) - Number(scrims.dark));
  if (!(Number(scrims.bright) > Number(scrims.dark)) || gap < 0.15) {
    failures.push(
      `scrim did not adapt to the pending cover: bright=${scrims.bright} `
      + `dark=${scrims.dark} (gap ${gap.toFixed(2)}) — a bright photo must take more`,
    );
  }

  // Leave nothing behind: the cover was never saved, and closing discards.
  await page.evaluate(() => { window.confirm = () => true; });
  await page.locator('[data-testid="page-design-close"]').click();
  await ctx.close();
} finally {
  await browser.close();
}

if (failures.length) {
  console.error('\nFAILED:');
  failures.forEach((f) => console.error('  -', f));
  process.exit(1);
}
console.log('\nall checks passed');
