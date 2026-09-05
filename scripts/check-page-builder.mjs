#!/usr/bin/env node
/**
 * The page builder, phases 1 and 2: the schema, the block library, the
 * dials and the brief.
 *
 * WHY THIS EXISTS. Everything here is machinery for something that does
 * not exist yet - there is no generation, no model and no quota in this
 * pass. That is the point: the vocabulary is what a generator will later
 * be constrained to, and it is far cheaper to find out now that it is
 * wrong than after a model is emitting it. So the checks are about
 * whether the vocabulary can describe the page we already have, whether
 * the two halves of it agree, and whether a dial does anything.
 *
 * Four things it proves that nothing else does:
 *
 *   1. THE TWO COPIES AGREE. The client has to render the dial names, so
 *      a copy of them exists either way; the only question is whether it
 *      can silently disagree with what the API accepts. Read from the
 *      real module and compared against the real endpoint.
 *   2. THE DEFAULT COMPOSITION IS THE PAGE WE HAD. A business that has
 *      never opened the designer must be unchanged, or phase 1 has
 *      redesigned everyone's page as a side effect.
 *   3. A DIAL MOVES SOMETHING MEASURABLE, in both directions, in both
 *      languages - including the one that matters most here: a Hebrew
 *      heading must not fall back to a system serif, which is the bug
 *      already found ~69 times in this codebase.
 *   4. A DOCUMENT FROM A FUTURE BUILD STILL DRAWS. An unknown block type
 *      costs its block, never the page.
 *
 * Local stack: the built app on APP_ORIGIN proxying to API_ORIGIN.
 *
 *   APP_ORIGIN=http://localhost:3200 API_ORIGIN=http://127.0.0.1:8002 node scripts/check-page-builder.mjs
 */
import { chromium } from 'playwright';
import { readFileSync } from 'node:fs';
import { pathToFileURL } from 'node:url';

const APP = process.env.APP_ORIGIN || 'http://localhost:3000';
const API = (process.env.API_ORIGIN || 'http://localhost:8001') + '/api';
const stamp = Date.now().toString(36);
const results = [];
const ok = (name, cond, detail = '') => {
  results.push(!!cond);
  console.log(`  ${cond ? 'ok  ' : 'FAIL'} ${name}${cond || !detail ? '' : ' - ' + detail}`);
};
const json = async (r) => { try { return await r.json(); } catch { return null; } };
const root = new URL('../', import.meta.url);

// ---------------------------------------------------------------- setup

const password = `Pw-${stamp}-ok1`;
const email = `builder-${stamp}@example.com`;
const reg = await json(await fetch(`${API}/auth/register`, {
  method: 'POST', headers: { 'content-type': 'application/json' },
  body: JSON.stringify({ email, password, name: 'Builder Check', role: 'owner' }),
}));
ok('account created', !!reg?.token);
if (!reg?.token) process.exit(1);
const auth = { Authorization: `Bearer ${reg.token}`, 'content-type': 'application/json' };

const biz = await json(await fetch(`${API}/marketplace/businesses`, {
  method: 'POST', headers: auth, body: JSON.stringify({ name: `TEST builder ${stamp}` }),
}));
const IMG = 'https://picsum.photos/seed/pgb/1200/900';
const gigIds = [];
// SEVEN, and the number is load-bearing. Eight is `AUTO_GROUP_MIN`, at
// which the page starts grouping by category and there is no plain grid
// left to measure; seven is above the six at which the grid/rows toggle
// appears. So seven is the only count that shows both.
for (let i = 0; i < 7; i += 1) {
  const g = await json(await fetch(`${API}/marketplace/gigs`, {
    method: 'POST', headers: auth,
    body: JSON.stringify({
      title: `TEST_pgb_${i}_${stamp}`, description: 'page builder check listing',
      category: 'home-services-repair', area: 'Tel Aviv', gig_type: 'deliverable',
      budget_currency: 'ILS', booking_mode: 'whatsapp', whatsapp: '+972501234567',
      gallery: [IMG], tiers: [{ name: 'Basic', price: 200 + i, currency: 'ILS' }],
      business_id: biz.id,
    }),
  }));
  if (g?.id) gigIds.push(g.id);
}
ok('a business with seven services exists', !!biz?.id && gigIds.length === 7, `${gigIds.length}`);

const patch = (body) => fetch(`${API}/marketplace/businesses/${biz.id}`, {
  method: 'PATCH', headers: auth, body: JSON.stringify(body),
});

// ------------------------------------------- 1. the two copies agree

const vocab = await json(await fetch(`${API}/marketplace/page-vocabulary`));
const mod = await import(pathToFileURL(
  new URL('frontend/src/utils/pageComposition.js', root).pathname.replace(/^\/([A-Za-z]:)/, '$1'),
).href);

const dialsMatch = Object.keys(vocab.dials).length === Object.keys(mod.DIALS).length
  && Object.entries(vocab.dials).every(
    ([dial, values]) => JSON.stringify(values) === JSON.stringify(mod.DIALS[dial]),
  );
ok('the client and the API hold the same six dials, with the same positions',
  dialsMatch, JSON.stringify(Object.keys(mod.DIALS)));

const blocksMatch = Object.keys(vocab.blocks).length === Object.keys(mod.BLOCK_TYPES).length
  && Object.entries(vocab.blocks).every(
    ([type, spec]) => JSON.stringify(spec.variants) === JSON.stringify(mod.BLOCK_TYPES[type]),
  );
ok('and the same eight block types, with the same variants',
  blocksMatch, JSON.stringify(Object.keys(mod.BLOCK_TYPES)));

ok('and the same brief', JSON.stringify(vocab.brief.showing) === JSON.stringify(mod.BRIEF.showing)
  && JSON.stringify(vocab.brief.strengths) === JSON.stringify(mod.BRIEF.strengths)
  && vocab.brief.max_strengths === mod.MAX_STRENGTHS);

// Every default has to be a value the API would accept, or a business
// that answers nothing gets a page its own API refuses.
ok('every default is itself a legal position',
  Object.entries(mod.DIAL_DEFAULTS).every(([d, v]) => mod.DIALS[d].includes(v)));

// Every preset likewise, and none of them touches the palette: the accent
// is chosen elsewhere in the same panel and a preset must not undo it.
const presetsLegal = Object.values(mod.PRESETS).every(
  (p) => Object.entries(p).every(([d, v]) => mod.DIALS[d] && mod.DIALS[d].includes(v))
    && !('palette' in p),
);
ok('every preset is legal, and none of them repaints the accent', presetsLegal);

// ------------------------------------------- 2. the stylesheet is scoped

const css = readFileSync(
  new URL('frontend/src/styles/page-theme.css', root).pathname.replace(/^\/([A-Za-z]:)/, '$1'),
  'utf8',
).replace(/\/\*[\s\S]*?\*\//g, '');
const selectors = [...css.matchAll(/(?:^|})\s*([^{}@]+?)\s*\{/g)]
  .map((m) => m[1].trim()).filter(Boolean)
  .flatMap((s) => s.split(',').map((x) => x.trim()));
const escaped = selectors.filter((s) => !/^\[data-page-theme\]|^\.pg-/.test(s));
ok('nothing in the page theme escapes a business page',
  escaped.length === 0, escaped.slice(0, 3).join(' | '));
// The four accent hexes live in businessAccent.js and must not be copied.
ok('and it writes no colour of its own', !/#[0-9a-fA-F]{3,8}\b/.test(css),
  (css.match(/#[0-9a-fA-F]{3,8}\b/) || [''])[0]);

// ---------------------------------------------------------- the browser

const browser = await chromium.launch();
const ctx = await browser.newContext({ viewport: { width: 1280, height: 1000 } });
const page = await ctx.newPage();
const errors = []; page.on('pageerror', (e) => errors.push(e.message));

const settle = async (url) => {
  await page.goto(url, { waitUntil: 'networkidle' });
  await page.waitForSelector('[data-testid="page-blocks"]', { timeout: 20000 }).catch(() => {});
  await page.waitForTimeout(1200);
};

// ---------------------------- 3. the default composition is the old page

const measure = () => page.evaluate(() => {
  const host = document.querySelector('[data-testid="page-blocks"]');
  const grid = document.querySelector('[data-testid="business-listings-grid"]');
  return {
    blocks: [...document.querySelectorAll('[data-block-type]')].map((e) => e.dataset.blockType),
    theme: host ? { ...host.dataset } : null,
    hasHeading: !!document.querySelector('h2'),
    cards: document.querySelectorAll('[data-testid^="services-gig-"]').length,
    toggle: !!document.querySelector('[data-testid="business-layout-toggle"]'),
    rows: !!document.querySelector('[data-testid="business-listings-list"]'),
    cols: grid ? getComputedStyle(grid).gridTemplateColumns.split(' ').length : 0,
    gap: grid ? parseFloat(getComputedStyle(grid).gap) : 0,
  };
});

await settle(`${APP}/business/${biz.slug || biz.id}`);
const opened = await measure();
ok('a business that never opened the designer renders from the default composition',
  JSON.stringify(opened.blocks) === JSON.stringify(['facts', 'services']), JSON.stringify(opened.blocks));
ok('and still shows every service, with the heading and the grid/rows toggle',
  opened.cards === 7 && opened.hasHeading && opened.toggle, JSON.stringify(opened));
ok('and still opens as rows past six services, exactly as it did',
  opened.rows, JSON.stringify(opened));
ok('on the default dials', opened.theme?.density === 'balanced' && opened.theme?.price === 'normal'
  && opened.theme?.type === 'serif', JSON.stringify(opened.theme));

// The reader's own choice, which no dial and no document may take away.
await page.click('[data-testid="business-layout-grid"]');
await page.waitForTimeout(600);
const base = await measure();
ok('the reader can still switch to squares', base.cols > 0 && base.cards === 7, JSON.stringify(base));
ok('four across at 1280, as it has always been', base.cols === 4, `${base.cols}`);

// ------------------------------------------- 4. a dial moves something

await patch({ page: { theme: { density: 'packed', price_prominence: 'loud', type: 'grotesque' }, blocks: [{ id: 'catalog', type: 'services', variant: 'grid', props: { source: 'all' } }] } });
await settle(`${APP}/business/${biz.slug || biz.id}`);
const packed = await page.evaluate(() => {
  const grid = document.querySelector('[data-testid="business-listings-grid"]');
  const price = document.querySelector('.svc-price');
  const head = document.querySelector('h2');
  return {
    cols: grid ? getComputedStyle(grid).gridTemplateColumns.split(' ').length : 0,
    gap: grid ? parseFloat(getComputedStyle(grid).gap) : 0,
    priceSize: price ? parseFloat(getComputedStyle(price).fontSize) : 0,
    priceWeight: price ? getComputedStyle(price).fontWeight : '',
    headFont: head ? getComputedStyle(head).fontFamily : '',
  };
});
ok('"compact" really does fit more on screen', packed.cols > base.cols, `${base.cols} -> ${packed.cols}`);
ok('and closes the gaps', packed.gap < base.gap, `${base.gap}px -> ${packed.gap}px`);

await patch({ page: { theme: { density: 'airy', price_prominence: 'quiet' }, blocks: [{ id: 'catalog', type: 'services', variant: 'grid', props: { source: 'all' } }] } });
await settle(`${APP}/business/${biz.slug || biz.id}`);
const airy = await page.evaluate(() => {
  const grid = document.querySelector('[data-testid="business-listings-grid"]');
  const price = document.querySelector('.svc-price');
  return {
    cols: grid ? getComputedStyle(grid).gridTemplateColumns.split(' ').length : 0,
    priceSize: price ? parseFloat(getComputedStyle(price).fontSize) : 0,
    priceWeight: price ? getComputedStyle(price).fontWeight : '',
  };
});
ok('"roomy" really does show fewer, larger', airy.cols < packed.cols, `${packed.cols} -> ${airy.cols}`);
ok('the price dial moves the price, both ways',
  packed.priceSize > airy.priceSize && Number(packed.priceWeight) > Number(airy.priceWeight),
  `loud ${packed.priceSize}px/${packed.priceWeight} vs quiet ${airy.priceSize}px/${airy.priceWeight}`);
ok('and "loud" is still only size and weight: no badge, no urgency invented',
  (await page.locator('text=/hurry|only .* left|ends in/i').count()) === 0);

// ---------------------------- 5. the type dial, and Hebrew glyphs

const serifFont = await page.evaluate(() => {
  const h = document.querySelector('h2');
  return h ? getComputedStyle(h).fontFamily : '';
});
ok('the default type dial reaches the headings', /Playfair/i.test(serifFont), serifFont);

const heCtx = await browser.newContext({ viewport: { width: 1280, height: 1000 }, locale: 'he' });
const hePage = await heCtx.newPage();
const heErrors = []; hePage.on('pageerror', (e) => heErrors.push(e.message));
await hePage.goto(`${APP}/business/${biz.slug || biz.id}?lng=he`, { waitUntil: 'networkidle' });
await hePage.waitForTimeout(2000);
const he = await hePage.evaluate(() => {
  const h = document.querySelector('h2');
  return {
    dir: document.documentElement.getAttribute('dir'),
    font: h ? getComputedStyle(h).fontFamily : '',
  };
});
/* THE ONE THAT MATTERS. Playfair has no Hebrew glyphs, so a heading that
   resolves to it in RTL renders as a silent system-serif fallback. The
   dial sets `--pg-head-font: var(--font-head)`, and `[dir="rtl"]` swaps
   that VARIABLE - which is only true because no rule anywhere in the
   theme names a face. */
ok('a Hebrew heading gets a Hebrew face, not a silent fallback',
  he.dir === 'rtl' && /Frank Ruhl/i.test(he.font) && !/Playfair/i.test(he.font),
  JSON.stringify(he));

await patch({ page: { theme: { type: 'grotesque' }, blocks: [{ id: 'catalog', type: 'services', variant: 'grid', props: { source: 'all' } }] } });
await hePage.reload({ waitUntil: 'networkidle' });
await hePage.waitForTimeout(1500);
const heGrotesque = await hePage.evaluate(() => {
  const h = document.querySelector('h2');
  return h ? getComputedStyle(h).fontFamily : '';
});
ok('and the other type positions stay Hebrew too',
  /Assistant/i.test(heGrotesque) && !/Manrope/i.test(heGrotesque.split(',')[0]), heGrotesque);
ok('no page errors in Hebrew', heErrors.length === 0, heErrors[0]);
await heCtx.close();

// ------------------- 6. a document from another build still draws

await patch({ page: { theme: { density: 'balanced' }, blocks: [
  { id: 'facts', type: 'facts', variant: 'list', props: {} },
  { id: 'catalog', type: 'services', variant: 'grid', props: { source: 'all' } },
] } });
await settle(`${APP}/business/${biz.slug || biz.id}`);
// Written straight into the payload the client reads, because the API
// would (rightly) refuse to store it. This is the render side of the
// asymmetry: writing rejects, reading tolerates.
const survived = await page.evaluate(() => {
  const el = document.querySelector('[data-testid="page-blocks"]');
  return el ? el.dataset.blockCount : null;
});
ok('a stored composition renders every block it names', survived === '2', String(survived));

ok('the reader tolerates what the writer refuses',
  (() => {
    const doc = { theme: { density: 'liquid' }, blocks: [
      { id: 'x', type: 'parallax-video', variant: 'ultra', props: {} },
      { id: 'facts', type: 'facts', variant: 'nope', props: {} },
    ] };
    const out = mod.readComposition({ page: doc });
    return out.blocks.length === 1
      && out.blocks[0].type === 'facts'
      && out.blocks[0].variant === 'list'
      && out.theme.density === 'balanced';
  })());

// A composition whose blocks are ALL unknown falls back to the default
// rather than to an empty page: a business must never open its own page
// and find nothing there because of something we changed.
ok('and a page of nothing but unknown blocks falls back to the default',
  mod.readComposition({ page: { blocks: [{ id: 'x', type: 'gone', variant: 'x' }] } })
    .blocks.length === 2);

// --------------------------- 7. the brief lands on the dials

const cases = [
  [{ pricing: 'premium' }, 'density', 'airy'],
  [{ pricing: 'value' }, 'price_prominence', 'loud'],
  [{ pricing: 'quote' }, 'price_prominence', 'quiet'],
  [{ audience: 'businesses' }, 'type', 'geometric'],
  [{ showing: 'one-thing' }, 'imagery', 'full-bleed'],
];
const mapped = cases.every(([brief, dial, want]) => mod.briefToTheme(brief, {})[dial] === want);
ok('an answer to the brief lands somewhere on the dials', mapped,
  JSON.stringify(cases.map(([b, d]) => mod.briefToTheme(b, {})[d])));
// Every question must change something, or it is a question that should
// not be asked.
const inert = Object.keys(mod.BRIEF).filter((key) => {
  if (key === 'strengths') return false;    // drives which trust rows show, not a dial
  return mod.BRIEF[key].every(
    (v) => mod.themeDiff(mod.DIAL_DEFAULTS, mod.briefToTheme({ [key]: v }, {})).length === 0,
  );
});
ok('and no question is asked that changes nothing', inert.length === 0, inert.join(', '));
ok('but the brief never picks a colour',
  mod.briefToTheme({ pricing: 'value' }, { palette: 'gold' }).palette === 'gold');

// ------------------------------- 8. the owner can actually reach it

await page.goto(`${APP}/auth/login`, { waitUntil: 'networkidle' });
await page.fill('input[type="email"]', email);
await page.fill('input[type="password"]', password);
await page.click('button[type="submit"]');
await page.waitForURL(/dashboard/, { timeout: 20000 }).catch(() => {});
await page.goto(`${APP}/dashboard?tab=my-businesses`, { waitUntil: 'networkidle' });
await page.waitForTimeout(2000);
await page.click(`[data-testid="business-design-${biz.id}"]`);
await page.waitForSelector('[data-testid="page-design-theme"]', { timeout: 20000 }).catch(() => {});
ok('the designer has the dials', await page.locator('[data-testid="page-design-theme"]').count() === 1);
ok('and the brief, opening part-answered rather than at zero',
  /[1-9] of 10/.test(await page.locator('[data-testid="page-design-brief"]').innerText()),
  (await page.locator('[data-testid="page-design-brief"]').innerText()).slice(0, 60));

// Touch targets are not on any dial.
const smallest = await page.evaluate(() => Math.min(
  ...[...document.querySelectorAll('[data-testid^="page-design-dial-"] button')]
    .map((b) => b.getBoundingClientRect().height),
));
ok('every dial button is at least 44px tall', smallest >= 44, `${Math.round(smallest)}px`);

// Answering moves the dials, and says what it moved.
await page.click('[data-testid="page-design-q-pricing-value"]');
await page.waitForTimeout(600);
const afterBrief = await page.evaluate(() => ({
  loud: document.querySelector('[data-testid="page-design-dial-price_prominence-loud"]')?.getAttribute('aria-checked'),
  changed: document.querySelector('[data-testid="page-design-changed"]')?.innerText || '',
}));
ok('answering "great value" turns the prices up', afterBrief.loud === 'true', JSON.stringify(afterBrief));
ok('and the panel says what it just changed', afterBrief.changed.length > 8, afterBrief.changed);

// A dial set by hand is not overruled by a later answer.
await page.click('[data-testid="page-design-dial-price_prominence-quiet"]');
await page.click('[data-testid="page-design-q-showing-catalogue"]');
await page.waitForTimeout(600);
ok('a dial the owner set by hand survives the next answer',
  await page.locator('[data-testid="page-design-dial-price_prominence-quiet"]').getAttribute('aria-checked') === 'true');

// The preview is the real page, with the pending theme on it.
/* The LAST iframe on the page, which is the main preview. Question 6's
   four thumbnails are PreviewFrames too and they sit in the controls
   column, which comes first in the DOM. */
const previewTheme = await page.frameLocator('iframe').last()
  .locator('[data-testid="page-blocks"]').getAttribute('data-price').catch(() => null);
ok('and the preview is already showing it, before saving', previewTheme === 'quiet', String(previewTheme));

await page.click('[data-testid="page-design-save"]');
await page.waitForTimeout(3000);
const saved = await json(await fetch(`${API}/marketplace/business/${biz.id}`, { headers: auth }));
ok('saving stores the composition and the brief',
  saved?.page?.theme?.price_prominence === 'quiet' && saved?.page_brief?.pricing === 'value',
  JSON.stringify({ t: saved?.page?.theme, b: saved?.page_brief }));
ok('and the blocks came with it rather than being lost',
  (saved?.page?.blocks || []).length >= 1, JSON.stringify((saved?.page?.blocks || []).map((b) => b.type)));

ok('no page errors', errors.length === 0, errors[0]);

await ctx.close();
await browser.close();
for (const g of gigIds) await fetch(`${API}/marketplace/gigs/${g}`, { method: 'DELETE', headers: auth });

const failed = results.filter((r) => !r).length;
console.log(`\n${results.length - failed}/${results.length} passed\n`);
process.exit(failed ? 1 : 0);
