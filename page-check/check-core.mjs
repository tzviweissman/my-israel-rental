// Page builder v3: the visual checks for one rendered page, shared by
// scripts/check-page-v3-effects.mjs (the local effects gate, on prepared
// payloads) and page-check/server.mjs (the service that decides whether an
// owner's chosen version may go live). One copy, so the two can never
// disagree about what passes. Takes a Playwright browser; imports nothing.
//
// checkPage renders the page in every view and returns what failed:
//   - a page error;
//   - an effect in the brief no element carries in any view, or the bold
//     moment missing from any view;
//   - sideways scrolling after a full scroll pass;
//   - text hidden (faded, clipped, scaled away) after the pass, and with
//     reduced motion, hidden at all before any scrolling;
//   - hero text against the brightest pixels actually behind it (the rule
//     is the caller's: the gate compares with the page without effects);
//   - a counted price that does not end on the real price;
//   - an engine effect that does nothing where it should, or moves where it
//     should not (a narrow screen, reduced motion, a short screen);
//   - a data-sc-* attribute on a page with no engine effect (when the caller
//     knows which effects need the engine).

export const RUNS = [
  [1440, 900, 'en', 'no-preference'],
  [390, 844, 'he', 'no-preference'],
  [360, 800, 'en', 'no-preference'],
  [360, 800, 'he', 'reduce'],
  [1440, 900, 'en', 'reduce'],
  [1280, 720, 'en', 'no-preference'],   // a short laptop: pinned blocks must fit
  [1280, 650, 'he', 'no-preference'],   // shorter still: nothing is held
];

// Text an owner wrote that a visitor cannot see: faded, clipped to nothing
// or scaled away by any ancestor up to the page.
export const hiddenText = () => {
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
  // The site's own floating buttons (chat, accessibility) are hidden too:
  // what is measured is the hero, not a widget that happens to sit on it.
  const style = await page.addStyleTag({ content: '[data-testid="pv3-hero"] * { color: transparent !important; text-shadow: none !important; }' });
  const hiddenFixed = await page.evaluate(() => {
    const els = [...document.querySelectorAll('body *')].filter((el) => getComputedStyle(el).position === 'fixed' && !el.closest('[data-page-v3]:not(body)'));
    els.forEach((el) => { el.dataset.gateHid = el.style.visibility; el.style.visibility = 'hidden'; });
    return els.length;
  });
  await page.waitForTimeout(50);
  const png = (await page.screenshot()).toString('base64');
  await style.evaluate((el) => el.remove());
  if (hiddenFixed) await page.evaluate(() => document.querySelectorAll('[data-gate-hid]').forEach((el) => { el.style.visibility = el.dataset.gateHid; delete el.dataset.gateHid; }));
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

const inlineTransform = (page, sel) => page.evaluate((s) => { const el = document.querySelector(s); return el ? el.style.transform : null; }, sel);
const hoverOver = async (page, sel) => {
  await page.evaluate((s) => document.querySelector(s).scrollIntoView({ block: 'center', behavior: 'instant' }), sel);
  await page.waitForTimeout(200);
  const r = await page.evaluate((s) => { const b = document.querySelector(s).getBoundingClientRect(); return [b.left + b.width / 2, b.top + b.height / 2]; }, sel);
  await page.mouse.move(r[0] - 30, r[1] - 10);
  await page.mouse.move(r[0] + 18, r[1] + 6, { steps: 6 });
  await page.waitForTimeout(700);
};
const engineCheck = async (page, want, w, motion, rtl) => {
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
  // Rails: the row travels the reader's way, ends with its last item on
  // screen, and with reduced motion is an ordinary sideways scroll instead.
  for (const [id, sel] of [['rail-occasions', '[data-testid="pv3-biglist"]'], ['rail-steps', '[data-testid="pv3-steps"]'], ['rail-gallery', '[data-testid="pv3-rail"]']]) {
    if (!want.includes(id) || !(await page.$(sel))) continue;
    const at = async (p) => {
      await page.evaluate(([s, p]) => {
        const a = document.querySelector(s);
        const top = a.getBoundingClientRect().top + scrollY;
        window.scrollTo(0, top + Math.max(a.offsetHeight - innerHeight, 0) * p);
      }, [sel, p]);
      await page.waitForTimeout(350);
      return page.evaluate((s) => {
        const a = document.querySelector(s);
        const track = a.querySelector('[data-sc-pan]');
        const stage = a.querySelector('[data-sc-stage]');
        const last = track.lastElementChild.getBoundingClientRect();
        const sr = stage.getBoundingClientRect();
        const cut = [...stage.querySelectorAll('li, p, h2, img')].filter((el) => {
          const r = el.getBoundingClientRect();
          return r.height && (r.top < sr.top - 1 || r.bottom > sr.bottom + 1);
        }).length;
        return { x: new DOMMatrix(getComputedStyle(track).transform).m41, held: a.offsetHeight / innerHeight,
          last: [last.left, last.right], vw: innerWidth, scrolls: stage.scrollWidth > stage.clientWidth + 1, cut };
      }, sel);
    };
    const mid = await at(0.5);
    if (still) {
      if (mid.x !== 0) out.push(`${id} moves with reduced motion`);
      if (!mid.scrolls) out.push(`${id} cannot be scrolled sideways with reduced motion`);
      if (mid.held > 1.3) out.push(`${id} is held ${mid.held.toFixed(1)} screens tall with reduced motion`);
      continue;
    }
    if (rtl ? mid.x <= 0 : mid.x >= 0) out.push(`${id} travels the wrong way (${mid.x.toFixed(0)}px) for ${rtl ? 'Hebrew' : 'English'}`);
    if (mid.cut) out.push(`${id}: ${mid.cut} items cut off by the held stage`);
    const end = await at(1);
    if (end.last[0] < -2 || end.last[1] > end.vw + 2) out.push(`${id} ends with its last item off screen (${end.last.map(Math.round).join('..')})`);
  }
  // Pins: held where they fit and motion is on, simply there otherwise, and
  // never cutting their own text off while held.
  const pinId = ['pin-hero-hold', 'pin-hero-pushin', 'scrub-film'].find((e) => want.includes(e));
  if (pinId && await page.$('.pv3-hero-pin')) {
    const short = await page.evaluate(() => innerHeight < 700);
    await page.evaluate(() => { const a = document.querySelector('.pv3-hero-pin'); window.scrollTo(0, a.getBoundingClientRect().top + scrollY + Math.max(a.offsetHeight - innerHeight, 0) * 0.5); });
    await page.waitForTimeout(400);
    const r = await page.evaluate(() => {
      const a = document.querySelector('.pv3-hero-pin');
      const stage = a.querySelector('.pv3-hero');
      const sr = stage.getBoundingClientRect();
      const photo = stage.querySelector('.pv3-photo');
      const cut = [...stage.querySelectorAll('h1, p, li, .pv3-btn')].filter((el) => {
        const b = el.getBoundingClientRect();
        return b.height && (b.top < Math.max(sr.top, 0) - 1 || b.bottom > Math.min(sr.bottom, innerHeight) + 1);
      }).map((el) => el.textContent.trim().slice(0, 20));
      return { held: a.offsetHeight / innerHeight, top: sr.top, cut,
        scale: photo ? getComputedStyle(photo).scale : null, filter: photo ? getComputedStyle(photo).filter : null };
    });
    const should = !still && !short && !(pinId === 'scrub-film' && w <= 860);
    if (should && (r.held < 1.3 || Math.abs(r.top) > 2)) out.push(`${pinId} is not held (act ${r.held.toFixed(2)} screens, hero at ${Math.round(r.top)}px)`);
    if (!should && r.held > 1.3) out.push(`${pinId} is held ${r.held.toFixed(1)} screens ${still ? 'with reduced motion' : 'on a short screen'}`);
    if (r.cut.length) out.push(`${pinId}: hero text cut off while held: ${r.cut.slice(0, 3).join(', ')}`);
    if (pinId === 'pin-hero-pushin' && should && !(parseFloat(r.scale) > 1.02)) out.push(`pin-hero-pushin: photo not pushed in (${r.scale})`);
    if (pinId === 'pin-hero-pushin' && !should && parseFloat(r.scale) > 1.001) out.push(`pin-hero-pushin moves ${still ? 'with reduced motion' : 'on a short screen'}`);
    if (pinId === 'pin-hero-hold' && should && r.filter && !/brightness\(0\.[0-9]/.test(r.filter)) out.push(`pin-hero-hold: photo does not dim (${r.filter})`);
    if (pinId === 'scrub-film' && !still && !short) {
      await page.waitForTimeout(2600);
      const v = await page.evaluate(() => { const el = document.querySelector('video[data-sc-scrub]'); return { t: el.currentTime, shown: el.classList.contains('sc-has-clip') }; });
      if (!v.shown || !(v.t > 0)) out.push(`scrub-film: film not driven by scroll (time ${v.t}, painted ${v.shown})`);
    }
  }
  if (want.includes('stack-steps') && await page.$('[data-testid="pv3-steps"]')) {
    await page.evaluate(() => { const s = document.querySelector('[data-testid="pv3-steps"]'); window.scrollTo(0, s.getBoundingClientRect().bottom + scrollY - innerHeight); });
    await page.waitForTimeout(300);
    const tops = await page.evaluate(() => [...document.querySelectorAll('[data-testid="pv3-steps"] li')].map((li) => [getComputedStyle(li).position, Math.round(li.getBoundingClientRect().top)]));
    if (tops.some(([pos]) => pos !== 'sticky')) out.push('stack-steps: steps are not sticky');
    if (tops.some(([, t], i) => i && t <= tops[i - 1][1])) out.push(`stack-steps: steps out of order (${tops.map(([, t]) => t).join(', ')})`);
  }
  if (want.includes('spotlight-offer')) {
    await hoverOver(page, '[data-testid="pv3-offer"]');
    const op = await page.evaluate(() => getComputedStyle(document.querySelector('[data-testid="pv3-offer"]'), '::after').opacity);
    if (!still && op !== '1') out.push(`spotlight-offer at opacity ${op} under the mouse`);
  }
  return out;
};

/** One page in every view. `urlFor(lang)` is where it is; `brief` is its
 *  design brief; `setup(page)` may route requests (the gate answers with a
 *  prepared payload); `contrastRule(view, dim)` returns a failure or null,
 *  where dim is { bad: [...], worst } (worst is the lowest share of the
 *  needed ratio). Returns { fails, dims }. */
export async function checkPage(browser, { urlFor, brief, label = 'page', setup, contrastRule, engineIds, screenshotDir, runs = RUNS }) {
  const fails = [];
  const dims = {};
  const want = brief.effects || [];
  const show = brief.showstopper;
  const everLost = new Set(want);
  for (const [w, h, lang, motion] of runs) {
    const tag = `${label} ${lang}-${w}${motion === 'reduce' ? '-still' : ''}`;
    const ctx = await browser.newContext({ viewport: { width: w, height: h }, reducedMotion: motion });
    const page = await ctx.newPage();
    const errs = [];
    page.on('pageerror', (e) => errs.push(e.message));
    try {
      if (setup) await setup(page);
      await page.goto(urlFor(lang), { waitUntil: 'networkidle' });
      await page.locator('[data-testid="pv3-hero"]').waitFor({ timeout: 20000 });
    } catch (e) {
      fails.push(`${tag}: the page did not render (${e.message.split('\n')[0]})`);
      await ctx.close();
      continue;
    }
    await page.evaluate(() => document.fonts.ready);
    await page.waitForTimeout(motion === 'reduce' ? 300 : 1400);

    if (motion === 'reduce') {
      const hid = await page.evaluate(hiddenText);
      if (hid.length) fails.push(`${tag}: hidden with reduced motion, before scrolling: ${hid.slice(0, 4).join(', ')}`);
    }

    const carried = await page.evaluate(() => [...document.querySelectorAll('[data-fx]')]
      .flatMap((el) => el.getAttribute('data-fx').split(' ')));
    for (const e of carried) everLost.delete(e);
    if (want.includes(show) && !carried.includes(show)) fails.push(`${tag}: the bold moment ${show} is missing`);

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
      sc: [...document.querySelectorAll('[data-page-v3] *')].filter((el) => [...el.attributes].some((a) => a.name.startsWith('data-sc-'))).length,
      dir: document.documentElement.dir,
    }));
    const hid = await page.evaluate(hiddenText);
    if (hid.length) fails.push(`${tag}: still hidden after scrolling: ${hid.slice(0, 4).join(', ')}`);
    if (r.overflow > 1) fails.push(`${tag}: sideways scroll ${r.overflow}px`);
    if (engineIds && r.sc && !want.some((e) => engineIds.has(e))) fails.push(`${tag}: ${r.sc} data-sc attributes on a page with no engine effect`);
    if (lang === 'he' && r.dir !== 'rtl') fails.push(`${tag}: Hebrew page is not right to left`);

    const price = (brief.primary_action || {}).price_anchor;
    if (want.includes('count-price') && price) {
      const shown = await page.evaluate(() => (document.querySelector('[data-testid="pv3-offer"]') || document.body).innerText);
      if (!shown.replace(/[,\s]/g, '').includes(String(Math.round(price)))) fails.push(`${tag}: counted price does not end on ${price}`);
    }
    if (errs.length) fails.push(`${tag}: page error ${errs[0]}`);
    for (const e of await engineCheck(page, want, w, motion, lang === 'he')) fails.push(`${tag}: ${e}`);

    await page.evaluate(() => window.scrollTo(0, 0));
    await page.waitForTimeout(300);
    const dim = await heroContrast(page);
    const viewKey = `${lang}-${w}-${motion}`;
    dims[viewKey] = dim;
    const why = contrastRule && contrastRule(viewKey, dim);
    if (why) fails.push(`${tag}: ${why}`);

    if (screenshotDir && motion !== 'reduce' && w !== 360) {
      await page.screenshot({ path: `${screenshotDir}/${label}-${lang}-${w}.png`, fullPage: true });
    }
    await ctx.close();
  }
  if (everLost.size) fails.push(`${label}: no element carries ${[...everLost].join(', ')} in any view`);
  return { fails, dims };
}

/** The service's rule: hero text meets 4.5:1 (3:1 when large) outright. */
export const absoluteContrast = (_view, dim) => (dim.bad.length ? `hero text too faint on what is behind it: ${dim.bad.slice(0, 4).join(', ')}` : null);
