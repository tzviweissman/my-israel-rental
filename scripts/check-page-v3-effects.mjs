// Page builder v3: the effects gate. Local only.
//
// Renders one business once per set of effects, by answering the page's
// request for the business with a prepared payload (the API and database are
// never written). Payloads come from scripts/page-v3-effects-fixtures.py:
// real picks for every preset, plus sets that between them carry every
// effect the page draws today.
//
// For each, at 1440, 390 and 360 wide, English and Hebrew, motion on and
// reduced, it fails on:
//   - a page error;
//   - an effect in the brief that no element carries in any view, or a bold
//     moment missing from any view (a quiet touch on a list the owner wrote
//     in one language is simply absent from the other page);
//   - sideways scrolling after a full scroll pass;
//   - any text still hidden (faded, clipped or scaled away) after the pass,
//     and with reduced motion, any text hidden at all, before any scrolling;
//   - hero text fainter than on the same page without effects, measured
//     against the brightest pixels actually behind it (photo, scrim and
//     grade included) as a share of 4.5:1, or 3:1 when large. Where the page
//     without effects is itself under that, it is reported as a warning;
//   - a counted price that does not end on the real price;
//   - an engine effect that does nothing where it should (a mouse on a wide
//     screen), or moves where it should not (a narrow screen, reduced motion);
//   - a data-sc-* attribute on a page with no engine effect;
// and once, on a grep of page-v3-motion.css for the banned patterns.
//   Needs: local API on :8001, the dev server (WEB, default :3211)
//   Run:   python scripts/page-v3-effects-fixtures.py > fx.json
//          node scripts/check-page-v3-effects.mjs fx.json [label-filter]
import { chromium } from 'playwright';
import { mkdir, readFile } from 'node:fs/promises';

const WEB = process.env.WEB || 'http://localhost:3211';
const SLUG = 'rp-exp';
const OUT = 'screenshots/page-v3-effects';
const fixtures = JSON.parse(await readFile(process.argv[2], 'utf8'))
  .filter((f) => !process.argv[3] || f.label.includes(process.argv[3]));
await mkdir(OUT, { recursive: true });

const fails = [];
// Bold moments whose section is not built yet: the sideways gallery needs
// V3Rail, which comes with the scroll engine (plan step 6). Remove when it lands.
const NOT_YET = new Set(['rail-gallery']);
const warns = [];
const baseline = {};   // view -> worst contrast share on the page without effects

// --- the stylesheet, once
// Comments name the banned patterns to explain them, so they are dropped.
const css = (await readFile(new URL('../frontend/src/styles/page-v3-motion.css', import.meta.url), 'utf8'))
  .replace(/\/\*[\s\S]*?\*\//g, '');
const banned = [
  [/transition\s*:\s*all\b/, 'transition: all'],
  [/transition(-property)?\s*:[^;]*\b(width|height|top|left|right|bottom)\b/, 'animating layout'],
  [/scale\(\s*0\s*\)|scaleX\(\s*0\s*\)|scaleY\(\s*0\s*\)/, 'scale(0)'],
  [/background-clip\s*:\s*text/, 'gradient text'],
  [/cursor\s*:\s*url/, 'custom cursor'],
  // An inset ring is a border; a blurred shadow all round is a glow.
  [/(text|box)-shadow\s*:(?![^;]*inset)[^;]*\b0\s+0\s+[1-9]\d*px/, 'glow'],
  [/—/, 'em dash'],
];
for (const [re, why] of banned) if (re.test(css)) fails.push(`page-v3-motion.css: ${why}`);
for (const kf of css.match(/@keyframes[^{]+\{([^{}]*\{[^}]*\})*\s*\}/g) || []) {
  if (/\b(width|height|top|left)\s*:/.test(kf)) fails.push(`page-v3-motion.css: keyframes animate layout: ${kf.slice(0, 40)}`);
}

// --- each payload in a browser
const RUNS = [
  [1440, 900, 'en', 'no-preference'],
  [390, 844, 'he', 'no-preference'],
  [360, 800, 'en', 'no-preference'],
  [360, 800, 'he', 'reduce'],
  [1440, 900, 'en', 'reduce'],
];

// Text an owner wrote that a visitor cannot see: faded, clipped to nothing
// or scaled away by any ancestor up to the page.
const hiddenText = () => {
  const out = [];
  const walk = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT);
  while (walk.nextNode()) {
    const n = walk.currentNode;
    const el = n.parentElement;
    // The page's own blocks; the body carries data-page-v3 too, and the
    // site menu inside it is not ours.
    const block = el && el.closest('[data-page-v3]');
    if (!n.textContent.trim() || !block || block === document.body) continue;
    if (el.closest('[hidden], [aria-hidden="true"], .sr-only')) continue;
    let op = 1;
    let why = '';
    for (let a = el; a && a !== document.body; a = a.parentElement) {
      const cs = getComputedStyle(a);
      if (cs.display === 'none') { why = 'skip'; break; }
      op *= Number(cs.opacity);
      if (cs.visibility === 'hidden') why = 'visibility';
      if (/inset\(\s*(100%|[^)]*\b100%)/.test(cs.clipPath)) why = `clip ${cs.clipPath}`;
      const m = cs.transform.match(/^matrix\(([^,]+),[^,]+,[^,]+,([^,]+)/);
      if (m && (Math.abs(Number(m[1])) < 0.05 || Math.abs(Number(m[2])) < 0.05)) why = `transform ${cs.transform}`;
    }
    if (why === 'skip') continue;
    if (op < 0.98) why = why || `opacity ${op.toFixed(2)}`;
    if (why) out.push(`"${n.textContent.trim().slice(0, 30)}" (${why})`);
  }
  return out;
};

// The hero's text, measured against what is really behind it: the text is
// made transparent, the hero photographed, and each line compared with the
// brightest tenth of the pixels under it. Button labels sit on their own
// fill and are left to the page's own check.
const heroContrast = async (page) => {
  const items = await page.evaluate(() => {
    const out = [];
    const hero = document.querySelector('[data-testid="pv3-hero"]');
    const walk = document.createTreeWalker(hero, NodeFilter.SHOW_TEXT);
    while (walk.nextNode()) {
      const n = walk.currentNode; const el = n.parentElement;
      if (!n.textContent.trim() || el.closest('button, .pv3-btn, [aria-hidden="true"]')) continue;
      const cs = getComputedStyle(el);
      const range = document.createRange(); range.selectNodeContents(n);
      for (const r of range.getClientRects()) {
        if (r.width < 4 || r.bottom < 0 || r.top > innerHeight) continue;
        out.push({ text: n.textContent.trim().slice(0, 24), color: cs.color, size: parseFloat(cs.fontSize),
          bold: Number(cs.fontWeight) >= 700, x: r.left, y: r.top, w: r.width, h: r.height });
      }
    }
    return out;
  });
  const style = await page.addStyleTag({ content: '[data-testid="pv3-hero"] * { color: transparent !important; text-shadow: none !important; }' });
  await page.waitForTimeout(50);
  const png = (await page.screenshot()).toString('base64');
  await style.evaluate((el) => el.remove());
  return page.evaluate(async ({ png, items }) => {
    const img = new Image(); img.src = `data:image/png;base64,${png}`; await img.decode();
    const c = document.createElement('canvas'); c.width = img.width; c.height = img.height;
    const g = c.getContext('2d'); g.drawImage(img, 0, 0);
    const lin = (v) => { v /= 255; return v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4; };
    const lum = ([r, gg, b]) => 0.2126 * lin(r) + 0.7152 * lin(gg) + 0.0722 * lin(b);
    const bad = []; let worst = Infinity;
    for (const it of items) {
      const x = Math.max(0, Math.floor(it.x)); const y = Math.max(0, Math.floor(it.y));
      const w = Math.min(c.width - x, Math.ceil(it.w)); const h = Math.min(c.height - y, Math.ceil(it.h));
      if (w <= 0 || h <= 0) continue;
      const d = g.getImageData(x, y, w, h).data; const ls = [];
      for (let i = 0; i < d.length; i += 16) ls.push(lum([d[i], d[i + 1], d[i + 2]]));
      ls.sort((p, q) => p - q);
      const bg = ls[Math.floor(ls.length * 0.9)];
      const fg = lum((it.color.match(/[\d.]+/g) || []).slice(0, 3).map(Number));
      const ratio = (Math.max(fg, bg) + 0.05) / (Math.min(fg, bg) + 0.05);
      const need = it.size >= 24 || (it.bold && it.size >= 18.66) ? 3 : 4.5;
      worst = Math.min(worst, ratio / need);
      if (ratio < need) bad.push(`"${it.text}" ${ratio.toFixed(2)}:1`);
    }
    return { bad, worst };
  }, { png, items });
};

// Engine effects must do something, where they should and only there: the
// pointer touches answer a mouse, parallax moves on a wide screen and rests
// on a narrow one, and with reduced motion none of them move at all.
const ENGINE = new Set([...(await readFile(new URL('../frontend/src/components/pagebuilder/v3/effects.js', import.meta.url), 'utf8'))
  .matchAll(/'([a-z0-9-]+)': \['[a-z]+', true\]/g)].map((m) => m[1]));
const inlineTransform = (page, sel) => page.evaluate((s) => { const el = document.querySelector(s); return el ? el.style.transform : null; }, sel);
const hoverOver = async (page, sel) => {
  await page.evaluate((s) => document.querySelector(s).scrollIntoView({ block: 'center', behavior: 'instant' }), sel);
  await page.waitForTimeout(200);
  const r = await page.evaluate((s) => { const b = document.querySelector(s).getBoundingClientRect(); return [b.left + b.width / 2, b.top + b.height / 2]; }, sel);
  await page.mouse.move(r[0] - 30, r[1] - 10);
  await page.mouse.move(r[0] + 18, r[1] + 6, { steps: 6 });
  await page.waitForTimeout(700);
};
const engineCheck = async (page, want, w, motion) => {
  const out = [];
  const still = motion === 'reduce';
  const moved = (t) => Boolean(t) && !/^(none|translate3d\(0px, 0px, 0px\))$/.test(t);
  if (want.includes('progress-hairline')) {
    const t = await inlineTransform(page, '[data-sc-progress]');
    if (!/scaleX\(0\.9\d|scaleX\(1/.test(t || '')) out.push(`progress hairline at ${t || 'nothing'} at the bottom of the page`);
  }
  if (want.includes('parallax-hero') || want.includes('parallax-palate')) {
    for (const [id, sel] of [['parallax-hero', '[data-testid="pv3-hero"] .pv3-photo'], ['parallax-palate', '[data-testid="pv3-palate"] .pv3-photo']]) {
      if (!want.includes(id) || !(await page.$(sel))) continue;
      await page.evaluate((s) => document.querySelector(s).scrollIntoView({ block: 'end', behavior: 'instant' }), sel);
      await page.waitForTimeout(250);
      const t = await page.evaluate((s) => getComputedStyle(document.querySelector(s)).transform, sel);
      const should = !still && w > 860;
      if (should && !moved(t)) out.push(`${id} does not move on a wide screen`);
      if (!should && moved(t)) out.push(`${id} moves ${still ? 'with reduced motion' : 'on a narrow screen'} (${t})`);
    }
  }
  if (want.includes('drift-ground')) {
    await page.evaluate(() => window.scrollTo(0, document.documentElement.scrollHeight / 2));
    await page.waitForTimeout(250);
    if (!(await page.evaluate(() => document.documentElement.style.getPropertyValue('--sc-canvas')))) out.push('drift-ground never set the page colour');
  }
  for (const [id, sel] of [['btn-magnet', '[data-testid="pv3-primary"]'], ['card-tilt-offer', '.pv3-offer-card']]) {
    if (!want.includes(id) || !(await page.$(sel))) continue;
    await hoverOver(page, sel);
    const t = await inlineTransform(page, sel);
    if (!still && !moved(t)) out.push(`${id} does not answer the mouse`);
    if (still && moved(t)) out.push(`${id} moves with reduced motion (${t})`);
  }
  if (want.includes('spotlight-offer')) {
    await hoverOver(page, '[data-testid="pv3-offer"]');
    const op = await page.evaluate(() => getComputedStyle(document.querySelector('[data-testid="pv3-offer"]'), '::after').opacity);
    if (!still && op !== '1') out.push(`spotlight-offer at opacity ${op} under the mouse`);
  }
  return out;
};

const b = await chromium.launch();
for (const f of fixtures) {
  const body = JSON.stringify(f.biz);
  const want = f.biz.design_brief.effects;
  const show = f.biz.design_brief.showstopper;
  const everLost = new Set(want.filter((e) => !NOT_YET.has(e)));
  for (const [w, h, lang, motion] of RUNS) {
    const tag = `${f.label} ${lang}-${w}${motion === 'reduce' ? '-still' : ''}`;
    const ctx = await b.newContext({ viewport: { width: w, height: h }, reducedMotion: motion });
    const page = await ctx.newPage();
    const errs = [];
    page.on('pageerror', (e) => errs.push(e.message));
    await page.route(new RegExp(`/api/marketplace/business/${SLUG}(\\?|$)`), (r) => r.fulfill({ contentType: 'application/json', body }));
    await page.goto(`${WEB}/business/${SLUG}?lng=${lang}`, { waitUntil: 'networkidle' });
    await page.locator('[data-testid="pv3-hero"]').waitFor({ timeout: 20000 });
    await page.evaluate(() => document.fonts.ready);
    await page.waitForTimeout(motion === 'reduce' ? 300 : 1400);

    if (motion === 'reduce') {
      const hid = await page.evaluate(hiddenText);
      if (hid.length) fails.push(`${tag}: hidden with reduced motion, before scrolling: ${hid.slice(0, 4).join(', ')}`);
    }

    const carried = await page.evaluate(() => [...document.querySelectorAll('[data-fx]')]
      .flatMap((el) => el.getAttribute('data-fx').split(' ')));
    for (const e of carried) everLost.delete(e);
    if (want.includes(show) && !NOT_YET.has(show) && !carried.includes(show)) fails.push(`${tag}: the bold moment ${show} is missing`);

    // A full scroll pass, as a visitor would, then everything must be there.
    const height = await page.evaluate(() => document.documentElement.scrollHeight);
    for (let y = 0; y < height; y += Math.round(h * 0.6)) {
      await page.evaluate((y) => window.scrollTo(0, y), y);
      await page.waitForTimeout(90);
    }
    await page.evaluate(() => window.scrollTo(0, document.documentElement.scrollHeight));
    await page.waitForTimeout(1600);
    const r = await page.evaluate(() => ({
      overflow: document.documentElement.scrollWidth - innerWidth,
      sc: document.querySelectorAll('[data-page-v3] [data-sc], [data-page-v3] [data-sc-scene], [data-page-v3] [data-sc-device]').length
        + [...document.querySelectorAll('[data-page-v3] *')].filter((el) => [...el.attributes].some((a) => a.name.startsWith('data-sc-'))).length,
      dir: document.documentElement.dir,
    }));
    const hid = await page.evaluate(hiddenText);
    if (hid.length) fails.push(`${tag}: still hidden after scrolling: ${hid.slice(0, 4).join(', ')}`);
    if (r.overflow > 1) fails.push(`${tag}: sideways scroll ${r.overflow}px`);
    if (r.sc && !want.some((e) => ENGINE.has(e))) fails.push(`${tag}: ${r.sc} data-sc attributes on a page with no engine effect`);
    if (lang === 'he' && r.dir !== 'rtl') fails.push(`${tag}: Hebrew page is not right to left`);

    const price = f.biz.design_brief.primary_action.price_anchor;
    if (want.includes('count-price') && price) {
      const shown = await page.evaluate(() => (document.querySelector('[data-testid="pv3-offer"]') || document.body).innerText);
      if (!shown.replace(/[,\s]/g, '').includes(String(Math.round(price)))) fails.push(`${tag}: counted price does not end on ${price}`);
    }
    if (errs.length) fails.push(`${tag}: page error ${errs[0]}`);
    for (const e of await engineCheck(page, want, w, motion)) fails.push(`${tag}: ${e}`);

    await page.evaluate(() => window.scrollTo(0, 0));
    await page.waitForTimeout(300);
    const dim = await heroContrast(page);
    const view = `${f.label.split('-')[0]} ${lang}-${w}-${motion}`;
    if (!want.length) {
      baseline[view] = dim.worst;
      if (dim.bad.length) warns.push(`${tag}: already too faint without effects: ${dim.bad.slice(0, 4).join(', ')}`);
    } else if (dim.bad.length && dim.worst < (baseline[view] ?? 1) - 0.02) {
      fails.push(`${tag}: hero text fainter than without effects: ${dim.bad.slice(0, 4).join(', ')}`);
    }

    if (motion !== 'reduce' && w !== 360) {
      await page.screenshot({ path: `${OUT}/${f.label}-${lang}-${w}.png`, fullPage: true });
    }
    await ctx.close();
  }
  if (everLost.size) fails.push(`${f.label}: no element carries ${[...everLost].join(', ')} in any view`);
  console.log(`${f.label}: done`);
}
await b.close();

if (warns.length) console.log(`\nWARN, the page without effects (${warns.length})\n${warns.join('\n')}`);
console.log(fails.length ? `\nFAIL (${fails.length})\n${fails.join('\n')}` : `\nPASS: ${fixtures.length} effect sets x ${RUNS.length} views`);
process.exit(fails.length ? 1 : 0);
