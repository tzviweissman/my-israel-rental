/**
 * The grouped picker renders, in both languages, on every surface (N2).
 *
 * `test-category-groups.mjs` proves the grouping FUNCTION is lossless.
 * This proves the pickers actually consume it — a component can import a
 * helper and still render the old flat list, and the forms that pick a
 * category are ones a business uses once and never revisits, so a
 * regression there stays invisible for months.
 *
 * What it measures rather than photographs:
 *   * headings appear, in the module's order, on the board dropdown
 *   * every category the API returns is still reachable in the picker
 *   * the pill shows the CHOSEN category, never a group heading
 *   * Hebrew headings render in Hebrew, RTL, without overflow
 *   * the panel stays on screen at 375, which is where it would not
 *
 * Usage: node scripts/check-category-groups-ui.mjs
 */
import { chromium } from 'playwright';

const APP = process.env.APP_ORIGIN || 'http://localhost:3210';
// Both category GRIDS sit behind auth, so the check needs a token to
// reach them. Without one it refuses to run rather than quietly skipping
// two of the four surfaces and printing "all checks passed".
const TOKEN = process.argv[2];
const API = process.env.API_ORIGIN || 'http://localhost:8001/api';
const WANT_ORDER = [
  'home-property', 'shops', 'money-admin',
  'personal-family', 'events-creative', 'travel-transport', 'cars', 'tech',
];
const HEBREW = /[֐-׿]/;

if (!TOKEN) {
  console.error('usage: node scripts/check-category-groups-ui.mjs <jwt>');
  console.error('  (the listing wizard and Post a Job are both behind auth)');
  process.exit(1);
}

const browser = await chromium.launch();
const failures = [];
const note = (m) => console.log('  ' + m);

const ctxFor = async (lang, width = 1280) => {
  const c = await browser.newContext({ viewport: { width, height: 900 } });
  if (TOKEN) {
    await c.addInitScript((t) => {
      try { sessionStorage.setItem('token', t); } catch { /* private mode */ }
    }, TOKEN);
  }
  if (lang === 'he') {
    await c.addInitScript(() => {
      try { localStorage.setItem('i18nextLng', 'he'); } catch { /* private mode */ }
    });
  }
  return c;
};

const openBoardPicker = async (page) => {
  await page.locator('[data-testid="services-hero-service"]').waitFor({ timeout: 30000 });
  await page.locator('[data-testid="services-hero-service"]').click();
  await page.locator('[data-testid="services-hero-service-panel"]').waitFor({ timeout: 10000 });
  await page.waitForTimeout(450);
};

try {
  // ---- what does the API actually ship? --------------------------------
  let apiCats = null;
  try {
    const res = await fetch(`${API}/marketplace/categories`);
    apiCats = (await res.json()).map((c) => c.slug);
  } catch (e) {
    failures.push(`could not read ${API}/marketplace/categories (${e.message}) — coverage is unverifiable`);
  }
  note(`API ships ${apiCats ? apiCats.length : '?'} categories`);

  // ---- 1. the board dropdown, both languages ---------------------------
  for (const lang of ['en', 'he']) {
    const ctx = await ctxFor(lang);
    const page = await ctx.newPage();
    const errs = [];
    page.on('pageerror', (e) => errs.push(String(e)));
    page.on('console', (m) => { if (m.type() === 'error') errs.push(m.text()); });

    await page.goto(`${APP}/businesses`, { waitUntil: 'domcontentloaded', timeout: 60000 });
    await openBoardPicker(page);

    const headings = await page.locator('[data-testid^="services-hero-service-group-"]').evaluateAll(
      (els) => els.map((e) => ({
        id: e.getAttribute('data-testid').replace('services-hero-service-group-', ''),
        text: e.textContent.trim(),
      })),
    );
    const gotOrder = headings.map((h) => h.id);
    const wantHere = WANT_ORDER.filter((id) => gotOrder.includes(id));
    note(`${lang}: ${headings.length} headings — ${headings.map((h) => h.text).join(' | ')}`);

    if (!headings.length) {
      failures.push(`${lang}: the board dropdown has no group headings — it is still a flat list`);
    }
    if (gotOrder.join('>') !== wantHere.join('>')) {
      failures.push(`${lang}: heading order is ${gotOrder.join('>')}, want ${wantHere.join('>')}`);
    }
    if (lang === 'he' && headings.length && !HEBREW.test(headings[0].text)) {
      failures.push(`he: headings render as "${headings[0].text}" — the keys are missing from he.js`);
    }

    // The CATEGORY names too, not only the headings. Hebrew group titles
    // over English category names is the half-translated state that
    // reads worse than either one on its own.
    if (lang === 'he') {
      const labels = await page.locator('[data-testid^="services-hero-service-option-"]').evaluateAll(
        (els) => els.map((e) => e.textContent.trim()).filter(Boolean),
      );
      const english = labels.filter((l) => !HEBREW.test(l));
      note(`he: ${labels.length - english.length}/${labels.length} option labels in Hebrew`);
      if (english.length) {
        failures.push(`he: category names still in English: ${english.slice(0, 5).join(', ')}`);
      }
    }

    // Every category still reachable — grouping must not drop one.
    const opts = await page.locator('[data-testid^="services-hero-service-option-"]').evaluateAll(
      (els) => els.map((e) => e.getAttribute('data-testid').replace('services-hero-service-option-', '')),
    );
    if (apiCats) {
      const missing = apiCats.filter((s) => !opts.includes(s));
      note(`${lang}: ${opts.length} options (incl. "any"); unreachable: ${missing.length}`);
      if (missing.length) {
        failures.push(`${lang}: cannot be chosen in the dropdown: ${missing.join(', ')}`);
      }
    }

    // The pill must show the chosen CATEGORY, never a heading — headings
    // have no value, so a careless `find` matches one when nothing is set.
    await page.locator('[data-testid="services-hero-service-option-cleaning-services"]').click();
    await page.waitForTimeout(1300);
    const pill = (await page.locator('[data-testid="services-hero-service"]').innerText()).trim();
    const pillValue = pill.split('\n').pop().trim();
    note(`${lang}: pill after choosing Cleaning -> ${JSON.stringify(pillValue)}`);
    if (headings.some((h) => h.text && pillValue === h.text)) {
      failures.push(`${lang}: the pill shows the group heading "${pillValue}" instead of the chosen category`);
    }
    if (!new URL(page.url()).searchParams.get('category')) {
      failures.push(`${lang}: choosing a category from the grouped list did not filter the board`);
    }
    if (errs.length) failures.push(`${lang} board console: ${JSON.stringify(errs.slice(0, 3))}`);
    await ctx.close();
  }

  // ---- 2. the two category grids ---------------------------------------
  // Both are behind auth. The listing wizard needs its second step
  // reached before the picker exists, which is why it is clicked into
  // rather than deep-linked.
  for (const surface of [
    { path: '/businesses/post-job', prefix: 'post-job-cat', steps: 0 },
    { path: '/businesses/add',      prefix: 'wizard-cat',   steps: 1 },
  ]) {
    const ctx = await ctxFor('en');
    const page = await ctx.newPage();
    const errs = [];
    page.on('pageerror', (e) => errs.push(String(e)));
    await page.goto(`${APP}${surface.path}`, { waitUntil: 'domcontentloaded', timeout: 60000 });
    await page.waitForTimeout(3000);

    for (let i = 0; i < surface.steps; i += 1) {
      const next = page.locator('button:has-text("Next"), [data-testid="wizard-next"]').first();
      if (await next.count()) { await next.click(); await page.waitForTimeout(1200); }
    }

    const groups = await page.locator(`[data-testid^="${surface.prefix}-group-"]`).count();
    const chips = await page.locator(
      `[data-testid^="${surface.prefix}-"]:not([data-testid*="-group-"]):not([data-testid$="-groups"])`,
    ).count();
    note(`${surface.path}: ${groups} group(s), ${chips} category button(s)`);
    if (groups === 0) failures.push(`${surface.path}: the category grid is not grouped`);
    if (apiCats && chips !== apiCats.length) {
      failures.push(`${surface.path}: ${chips} buttons for ${apiCats.length} categories`);
    }
    if (errs.length) failures.push(`${surface.path}: ${JSON.stringify(errs.slice(0, 2))}`);
    await ctx.close();
  }

  // ---- 3. the Post a Request combobox ----------------------------------
  // A flat filtered list, so it gets grouped ORDER plus a group hint per
  // row. The assertion that matters is the cap: it defaulted to eight,
  // which hid every category past the eighth from anyone browsing rather
  // than typing a word they already knew — the exact failure grouping is
  // meant to prevent, live before this spec item existed.
  {
    const ctx = await ctxFor('en');
    const page = await ctx.newPage();
    const errs = [];
    page.on('pageerror', (e) => errs.push(String(e)));
    await page.goto(`${APP}/requests/post`, { waitUntil: 'domcontentloaded', timeout: 60000 });
    await page.waitForTimeout(3000);
    // A five-step wizard (what / about / where / when / budget). The
    // category lives on "where", and only for a SERVICE request — a
    // rental one has no category at all — so the check walks there:
    // pick service, then title and description, which gate Next.
    const svc = page.locator('[data-testid="post-request-type-service"]');
    if (await svc.count()) { await svc.click(); await page.waitForTimeout(600); }
    await page.locator('[data-testid="post-request-next"]').click();
    await page.waitForTimeout(900);
    await page.locator('[data-testid="post-request-title"]').fill('Category picker check');
    await page.locator('[data-testid="post-request-description"]')
      .fill('Walking the wizard to the category step so the grouped list can be measured.');
    await page.waitForTimeout(400);
    await page.locator('[data-testid="post-request-next"]').click();
    await page.waitForTimeout(1000);
    // "where" — area is required before the next step will accept.
    await page.locator('[data-testid="post-request-area"]').fill('Jerusalem');
    await page.waitForTimeout(700);
    await page.keyboard.press('Enter');
    await page.waitForTimeout(400);
    await page.locator('[data-testid="post-request-next"]').click();
    await page.waitForTimeout(1300);

    const box = page.locator('[data-testid="post-request-category"]');
    if (await box.count() === 0) {
      failures.push('/requests/post: never reached the category combobox');
    } else {
      await box.first().click();
      await page.waitForTimeout(900);
      const rows = await page.locator('[data-testid^="post-request-category-option-"]').count();
      const hints = await page.locator('[data-testid^="post-request-category-option-"] span').evaluateAll(
        (els) => els.map((e) => e.textContent.trim()).filter(Boolean),
      );
      note(`/requests/post: ${rows} option(s) without typing; sample row -> ${JSON.stringify(hints.slice(0, 2))}`);
      if (apiCats && rows < apiCats.length) {
        failures.push(
          `/requests/post: only ${rows} of ${apiCats.length} categories are offered before typing `
          + '— the suggestion cap is hiding the rest',
        );
      }
      if (!hints.some((h) => h === 'Home & Property')) {
        failures.push('/requests/post: rows carry no group hint, so a flat list says nothing about where an option sits');
      }
    }
    if (errs.length) failures.push(`/requests/post: ${JSON.stringify(errs.slice(0, 2))}`);
    await ctx.close();
  }

  // ---- 4. RTL narrow, where a popover slides off ------------------------
  for (const width of [768, 375]) {
    const ctx = await ctxFor('he', width);
    const page = await ctx.newPage();
    await page.goto(`${APP}/businesses`, { waitUntil: 'domcontentloaded', timeout: 60000 });
    await openBoardPicker(page);

    const box = await page.locator('[data-testid="services-hero-service-panel"]').boundingBox();
    const heads = await page.locator('[data-testid^="services-hero-service-group-"]').count();
    const overflow = await page.evaluate(
      () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
    );
    note(`he @${width}: panel x=${box ? Math.round(box.x) : 'none'} w=${box ? Math.round(box.width) : '-'}, `
      + `${heads} headings, page overflow=${overflow}px`);

    if (!box) {
      failures.push(`he @${width}: the picker panel did not render`);
    } else if (box.x < -1 || box.x + box.width > width + 1) {
      failures.push(
        `he @${width}: the panel sits off-screen (x=${Math.round(box.x)}, w=${Math.round(box.width)}) `
        + '— invisible in a cropped screenshot, unusable on a phone',
      );
    }
    if (heads === 0) failures.push(`he @${width}: no group headings`);
    if (overflow > 1) failures.push(`he @${width}: page scrolls sideways by ${overflow}px`);
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
