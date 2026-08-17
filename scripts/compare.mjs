/**
 * Paired app-vs-preview screenshots, plus interactive states.
 *
 * `screenshot.mjs` captures one URL. This captures the pairs the acceptance
 * checklist actually asks for: each app page beside the preview file it is
 * meant to match, at all three widths, so the comparison is like-for-like
 * rather than one image against a memory of the other.
 *
 * Two things this does that CSS-value extraction cannot:
 *
 *   1. Renders. Matching every declared value still misses wrapping,
 *      stacking, overflow and collapse — a pill row with correct colours
 *      that wraps to two lines at 768 is "correct" to a grep and wrong to a
 *      person.
 *   2. Opens things. A closed nav tells you nothing about a drawer, so
 *      `--drawer` clicks the menu trigger and waits for the panel before
 *      shooting. It does this over a CONTENT-HEAVY page on purpose: the
 *      drawer's .92 alpha exists so a dozen menu rows stay readable over
 *      whatever is beneath them, and a blank page cannot show that.
 *
 * Usage:
 *   node scripts/compare.mjs                 # all pairs
 *   node scripts/compare.mjs --drawer        # drawer-open states only
 *   node scripts/compare.mjs --only stays
 *
 * Output: screenshots/pairs/<name>-<app|preview>-<width>.png
 */
import { chromium } from 'playwright';
import { mkdir } from 'node:fs/promises';
import path from 'node:path';
import { pathToFileURL } from 'node:url';

const WIDTHS = [1280, 768, 375];
const OUT = path.join('screenshots', 'pairs');
const APP = process.env.APP_ORIGIN || 'http://localhost:3000';

const fileUrl = (f) => pathToFileURL(path.resolve(f)).href;

/** Each pair: the app route and the preview file that defines it. */
const PAIRS = [
  { name: 'home', app: '/', preview: 'cinematic-preview.html' },
  { name: 'stays', app: '/stays', preview: 'stays-preview.html' },
  { name: 'services', app: '/services', preview: 'services-preview.html' },
  { name: 'requests', app: '/requests', preview: 'wanted-board-preview.html' },
];

const args = process.argv.slice(2);
const drawerOnly = args.includes('--drawer');
const onlyIdx = args.indexOf('--only');
const only = onlyIdx !== -1 ? args[onlyIdx + 1] : null;

const settle = async (page) => {
  // networkidle already fired; this is for font swap + hero crossfade, which
  // are timers rather than requests and so are invisible to networkidle.
  await page.waitForTimeout(1400);
  // Freeze CSS animations so two runs of the same page are byte-comparable
  // rather than differing by whatever frame the crossfade was on.
  await page.addStyleTag({
    content: '*,*::before,*::after{animation-play-state:paused !important}',
  });
};

const shoot = async (browser, url, out, { drawer = false, width } = {}) => {
  const page = await browser.newPage({
    viewport: { width, height: 900 },
    deviceScaleFactor: 2,
  });
  try {
    await page.goto(url, { waitUntil: 'networkidle', timeout: 60000 });
    await settle(page);

    if (drawer) {
      const trigger = page.locator('[data-testid="nav-menu-button"]');
      if (!(await trigger.count())) {
        console.log(`  (no menu trigger on ${url} — skipping drawer)`);
        return false;
      }
      await trigger.click();
      // Wait for the panel itself, not a fixed delay: a timeout that is too
      // short silently captures a closed nav and looks like a passing shot.
      await page
        .locator('[data-testid="nav-menu-dropdown"]')
        .waitFor({ state: 'visible', timeout: 5000 });
      await page.waitForTimeout(350); // open transition
    }

    // Drawer shots are viewport-only: fullPage stitches by scrolling, and a
    // position:absolute panel anchored to a fixed nav does not survive that.
    await page.screenshot({ path: out, fullPage: !drawer });
    console.log('  wrote', out);
    return true;
  } finally {
    await page.close();
  }
};

await mkdir(OUT, { recursive: true });
const browser = await chromium.launch();
try {
  if (drawerOnly) {
    // Over a content-heavy page — that is the whole point of the shot.
    for (const width of [375, 768]) {
      await shoot(browser, `${APP}/stays`, path.join(OUT, `drawer-open-${width}.png`), {
        drawer: true,
        width,
      });
    }
  } else {
    for (const pair of PAIRS) {
      if (only && pair.name !== only) continue;
      console.log(`\n${pair.name}:`);
      for (const width of WIDTHS) {
        await shoot(browser, `${APP}${pair.app}`, path.join(OUT, `${pair.name}-app-${width}.png`), { width });
        await shoot(browser, fileUrl(pair.preview), path.join(OUT, `${pair.name}-preview-${width}.png`), { width });
      }
    }
  }
} finally {
  await browser.close();
}
