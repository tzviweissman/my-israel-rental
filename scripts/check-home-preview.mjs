#!/usr/bin/env node
/**
 * The home overhaul preview (/home-preview) renders with the site's own
 * supply on it, in both languages, with no page errors.
 *
 * WHY. The hero corridor is fed from two public lists. If either fetch
 * fails it falls back to generated stills and still looks finished, so a
 * screenshot alone cannot tell a hero full of real listings from one that
 * silently fell back. This reads the card sources and asserts they are
 * listing/business photos (Cloudinary uploads), not the fallback set.
 *
 * Built bundle on :3000 (node frontend/server.js against the API).
 *
 *   node scripts/check-home-preview.mjs
 */
import { chromium } from 'playwright';

const APP = process.env.APP_ORIGIN || 'http://localhost:3000';
const results = [];
const ok = (name, cond, detail = '') => {
  results.push(!!cond);
  console.log(`  ${cond ? 'ok  ' : 'FAIL'} ${name}${cond || !detail ? '' : ' — ' + detail}`);
};

// Contrast, not a hex. These used to name the brand gold and the ink on it,
// so the flow theme turned four correct buttons into four red lines. What the
// design actually requires is that the label can be read against whatever is
// behind it; assert that instead and the next palette change costs nothing.
const channel = (c) => {
  const v = c / 255;
  return v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4;
};
const luminance = ([r, g, b]) => 0.2126 * channel(r) + 0.7152 * channel(g) + 0.0722 * channel(b);
const rgb = (s) => (String(s).match(/\d+(\.\d+)?/g) || []).slice(0, 3).map(Number);
const contrast = (a, b) => {
  const [l1, l2] = [luminance(rgb(a)), luminance(rgb(b))].sort((x, y) => y - x);
  return (l1 + 0.05) / (l2 + 0.05);
};

const browser = await chromium.launch();
for (const lng of ['en', 'he']) {
  const page = await (await browser.newContext({ viewport: { width: 1280, height: 900 } })).newPage();
  const errors = []; page.on('pageerror', (e) => errors.push(e.message));
  await page.goto(`${APP}/home-preview?lng=${lng}`, { waitUntil: 'networkidle' });
  await page.waitForTimeout(2500);

  const hero = page.locator('[data-testid="home-preview-hero"]');
  ok(`${lng}: hero is on the page`, await hero.count() === 1);

  // THE ENTRANCE. The corridor must open as a small strip at the vanishing
  // point and grow outward - the reference does, and ours arrived already
  // full on the first frame. Reload and read the 3D layer's scale at once,
  // then again after the entrance has had time to finish.
  await page.reload({ waitUntil: 'domcontentloaded' });
  // Wait for React to mount the layer, then read it at once. The entrance
  // runs 1.9s, so the first reading after mount is still near the start.
  // Reading before the mount returned null and called a working entrance
  // broken.
  await page.waitForSelector('[data-testid="ish-layer"]', { state: 'attached', timeout: 8000 });
  // Read the scale together with the entrance animation's own clock. On a
  // busy machine the first read can land a second in, when the layer is
  // already at 0.6 - that is a slow reader, not a broken entrance - so the
  // assertion is "small for how far into the animation we are".
  // `--ish-open` is the corridor's opening: 0 is collapsed to a strip at the
  // waist, 1 is the full corridor. Judged against the animation's own
  // clock, so a busy machine that reads late is not called a broken opening.
  const enterEarly = await page.evaluate(() => {
    const el = document.querySelector('[data-testid="ish-stage"]');
    if (!el) return null;
    const open = Number(getComputedStyle(el).getPropertyValue('--ish-open')) || 0;
    const anim = el.getAnimations?.()[0];
    const t = anim ? Number(anim.currentTime || 0) : 0;
    // Before 45% of the 1.6s entrance the corridor has to be under 0.85 open.
    return { open, t, small: t > 720 ? open <= 1.01 : open < 0.85 };
  });
  await page.waitForTimeout(2400);
  const enterLate = await page.evaluate(() => {
    const el = document.querySelector('[data-testid="ish-layer"]');
    return el ? Number(getComputedStyle(el).getPropertyValue('--ish-open')) : null;
  });
  // Depth: the near cards must project larger than the far ones. A layer
  // that is being animated flattens, and every card is then its natural
  // size - which is how two entrances shipped a corridor with no depth.
  const depth = await page.evaluate(() => {
    const hs = [...document.querySelectorAll('[data-testid="ish-layer"] > *')].map((c) => c.getBoundingClientRect().height).filter((h) => h > 0);
    return { min: Math.round(Math.min(...hs)), max: Math.round(Math.max(...hs)) };
  });
  ok(`${lng}: the corridor opens from a strip at its waist`, enterEarly !== null && enterEarly.small, `open ${enterEarly?.open} at ${enterEarly?.t}ms`);
  ok(`${lng}: and is fully open after the entrance`, enterLate !== null && enterLate > 0.99, `open ${enterLate}`);
  ok(`${lng}: and has depth - near cards project at least 3x the far ones`, depth.max >= depth.min * 3, JSON.stringify(depth));
  // The scope every experimental theme is written under. If this class is
  // missing, a scoped theme is invisible here too - and the whole point of
  // scoping is that it shows HERE and nowhere else.
  ok(`${lng}: the page carries the theme-preview scope`,
    await page.evaluate(() => document.body.classList.contains('theme-preview')));
  const srcs = await hero.locator('img').evaluateAll((imgs) => imgs.map((i) => i.getAttribute('src')));
  ok(`${lng}: corridor holds 24 cards`, srcs.length === 24, `${srcs.length}`);
  // The fallback stills are exactly the generated site assets, which all live
  // under `myisraelrental/site/`. Excluding those is the assertion; an earlier
  // version demanded the file sit directly under `myisraelrental/` and failed
  // every IMPORTED listing, whose photos are one folder deeper. It reported a
  // broken hero that was in fact showing ten real listings.
  const stills = srcs.filter((s) => /\/myisraelrental\/site\//.test(s || ''));
  ok(`${lng}: cards are listing/business photos, not the fallback stills`, stills.length === 0, `${stills.length} stills`);
  const distinct = new Set(srcs.filter(Boolean)).size;
  ok(`${lng}: twelve distinct photos ride the corridor`, distinct === 12, `${distinct} distinct`);
  ok(`${lng}: cards are requested at card size`, srcs.every((s) => /w_520/.test(s || '')));
  const loaded = await hero.locator('img').evaluateAll((imgs) => imgs.filter((i) => i.complete && i.naturalWidth > 0).length);
  ok(`${lng}: card images actually load`, loaded >= 20, `${loaded}/${srcs.length} loaded`);

  const rentals = await page.locator('[data-testid="home-preview-rentals"] .stays-card').count();
  ok(`${lng}: featured rentals rail has real cards`, rentals >= 3, `${rentals}`);
  const biz = await page.locator('[data-testid="home-preview-businesses"] [data-testid^="services-gig-"]').count();
  ok(`${lng}: businesses rail has real cards`, biz >= 3, `${biz}`);

  // Counting cards says nothing about where they landed. A bare `1fr` track
  // let one oversized business photo widen its column until the row ran past
  // the wrapper and the last card was sliced off by the window — every card
  // still present, every count still green. So measure: no card may sit
  // outside its own section, and cards in a row must share a width.
  for (const [name, sel] of [['rentals', 'home-preview-rentals'], ['businesses', 'home-preview-businesses']]) {
    const box = await page.locator(`[data-testid="${sel}"]`).evaluate((el) => {
      const g = el.getBoundingClientRect();
      const kids = [...el.children].map((c) => c.getBoundingClientRect());
      return {
        overflow: kids.some((k) => k.right > g.right + 1 || k.left < g.left - 1),
        widths: [...new Set(kids.map((k) => Math.round(k.width)))],
      };
    });
    ok(`${lng}: ${name} cards stay inside their section`, !box.overflow);
    ok(`${lng}: ${name} cards are all one width`, box.widths.length <= 1, box.widths.join(','));
  }

  // The hero is white and the nav is fixed chrome that defaults to white text.
  // Both halves of that have to hold, and neither is visible to a card count:
  // a regression here is white type on white paper, which still screenshots as
  // "a clean hero" to anything not measuring the pixels.
  const heroBg = await hero.evaluate((el) => getComputedStyle(el).backgroundColor);
  ok(`${lng}: hero is white`, heroBg === 'rgb(255, 255, 255)', heroBg);
  const heroInk = await page.locator('[data-testid="home-preview-hero"] h1').evaluate((el) => getComputedStyle(el).color);
  ok(`${lng}: hero headline is ink, not white`, heroInk !== 'rgb(255, 255, 255)', heroInk);
  const navPill = await page.locator('.glass-pill').first().evaluate((el) => {
    const cs = getComputedStyle(el);
    const [r, g, b] = cs.color.match(/\d+/g).map(Number);
    return { color: cs.color, luminance: (0.299 * r + 0.587 * g + 0.114 * b) / 255 };
  });
  ok(`${lng}: nav text is dark over the white hero`, navPill.luminance < 0.5, navPill.color);

  // The gallery animates in on scroll with opacity and a blur filter. A
  // reveal that never fires leaves four invisible boxes and a screenshot that
  // looks like an empty column, so assert the cells actually ended up opaque
  // and that they hold real photos rather than the site's fallback stills.
  const gallery = page.locator('[data-testid="home-preview-gallery"]');
  await gallery.scrollIntoViewIfNeeded();
  await page.waitForTimeout(1800);
  const cells = await gallery.evaluate((el) => [...el.children].map((c) => ({
    opacity: getComputedStyle(c).opacity,
    src: c.querySelector('img')?.getAttribute('src') || '',
    w: Math.round(c.getBoundingClientRect().width),
  })));
  ok(`${lng}: gallery has four cells`, cells.length === 4, `${cells.length}`);
  ok(`${lng}: gallery cells finished fading in`, cells.every((c) => Number(c.opacity) > 0.9), cells.map((c) => c.opacity).join(','));
  ok(`${lng}: gallery photos are real listings/businesses`, cells.every((c) => c.src && !/\/myisraelrental\/site\//.test(c.src)));
  ok(`${lng}: gallery photos are distinct`, new Set(cells.map((c) => c.src)).size === cells.length);
  // Padded to the cell, never cropped: many businesses upload a flyer as their
  // cover, and cropping one into a portrait cell takes the first and last
  // letter off every line.
  ok(`${lng}: gallery photos are padded, not cropped`, cells.every((c) => /c_pad,b_auto/.test(c.src)));
  // Each cell is a card: it names what it is showing and opens it. An
  // unlabelled photo is decoration; the name is what makes it evidence.
  const cards = await gallery.locator('[data-testid^="home-preview-gallery-card-"]').evaluateAll((els) => els.map((e) => ({
    name: (e.querySelector('b')?.textContent || '').trim(),
    href: e.getAttribute('data-href') || '',
  })));
  ok(`${lng}: every gallery cell is a named card`, cards.length === 4 && cards.every((c) => c.name.length > 1), JSON.stringify(cards.map((c) => c.name)));
  ok(`${lng}: every gallery card links to its listing or business`, cards.every((c) => /^\/(businesses|property)\/[\w-]+$/.test(c.href)), cards.map((c) => c.href).join(' '));
  ok(`${lng}: gallery cards are four different things`, new Set(cards.map((c) => c.href)).size === 4);

  // Nothing on this page is shown twice: the corridor, the two rails and the
  // gallery all draw from the same two lists.
  const railHrefs = await page.evaluate(() => [
    ...document.querySelectorAll('[data-testid^="stays-card-"]'),
  ].map((e) => e.getAttribute('data-testid')));
  const railIds = new Set(railHrefs.map((d) => (d || '').replace('stays-card-', '')));
  ok(`${lng}: gallery repeats nothing from the rentals rail`,
    cards.every((c) => !railIds.has(c.href.split('/').pop())), [...railIds].slice(0, 2).join(','));

  // Today's picks. The carousel is draggable and loops, so the thing worth
  // asserting is that it centres a real listing, names it, and that the page's
  // own control opens THAT one — the component itself cannot open anything.
  const picks = page.locator('#picks');
  await picks.scrollIntoViewIfNeeded();
  await page.waitForTimeout(1200);
  ok(`${lng}: today's picks section is on the page`, await picks.count() === 1);
  const slideCount = await picks.locator('[aria-roledescription="slide"]').count();
  ok(`${lng}: the carousel holds a dozen cards`, slideCount === 12, `${slideCount}`);
  const capBefore = (await picks.locator('.hv2-coverflow p').first().innerText()).trim();
  const openBefore = await page.locator('[data-testid="home-preview-pick-open"]').getAttribute('data-href');
  ok(`${lng}: the centred card is named`, capBefore.length > 1, capBefore);
  // Most rentals are titled with only their neighbourhood, so the headline and
  // the "Where" row printed the same words twice.
  const capRows = await picks.locator('.hv2-coverflow dl dd').allInnerTexts();
  ok(`${lng}: the caption does not repeat the title in its rows`,
    !capRows.some((v) => v.trim().toLowerCase() === capBefore.toLowerCase()), capRows.join('|'));
  ok(`${lng}: and the button opens that card`, /^\/(businesses|property)\/[\w-]+$/.test(openBefore || ''), String(openBefore));

  // Step the carousel and confirm the caption and the button follow it. A
  // carousel whose caption belongs to a different card than its button is the
  // failure that looks fine in a screenshot.
  await picks.locator('button[aria-label="Next slide"]').click();
  await page.waitForTimeout(1200);
  const capAfter = (await picks.locator('.hv2-coverflow p').first().innerText()).trim();
  const openAfter = await page.locator('[data-testid="home-preview-pick-open"]').getAttribute('data-href');
  ok(`${lng}: stepping the carousel changes the named card`, capAfter !== capBefore, `${capBefore} -> ${capAfter}`);
  ok(`${lng}: and the button follows it`, openAfter !== openBefore && /^\/(businesses|property)\//.test(openAfter || ''), String(openAfter));
  const band = await picks.evaluate((el) => ({
    bg: getComputedStyle(el).backgroundColor,
    heading: getComputedStyle(el.querySelector('h2')).color,
  }));
  ok(`${lng}: its heading reads against the section behind it`,
    contrast(band.heading, band.bg) >= 4.5, `${contrast(band.heading, band.bg).toFixed(2)}:1 ${JSON.stringify(band)}`);

  // ── What we are building ───────────────────────────────────────────
  // The words and the ring share ONE scroll progress. Everything here is a
  // way of asking whether that number is actually moving: the section sat
  // at progress 0 for a whole build - words dim, ring frozen, no error
  // anywhere - because its listener attached before the cards existed. A
  // screenshot of that state looks like a design decision.
  const community = page.locator('[data-testid="home-preview-community"]');
  ok(`${lng}: the community section is on the page`, await community.count() === 1);
  const morphCards = page.locator('[data-testid^="morph-card-"]');
  ok(`${lng}: the ring is built from real listings`, await morphCards.count() >= 8, `${await morphCards.count()} cards`);

  // Document coordinates, not viewport ones. `boundingBox()` is relative to
  // the viewport, and by this point the check has already scrolled a long
  // way down the page - so scrolling to `box.y + …` landed above the
  // section every time and reported that nothing ever lit.
  const commBox = await community.evaluate((el) => {
    const r = el.getBoundingClientRect();
    return { top: r.top + window.scrollY, height: r.height };
  });
  const sample = async (fraction) => {
    await page.evaluate((y) => window.scrollTo(0, y), commBox.top + commBox.height * fraction);
    // The fill chases its target by 18% a frame. Wait until it stops moving
    // rather than a fixed delay: under load a fixed delay catches it at
    // 0.88 on its way to 1 and calls a working section unfinished.
    await page.waitForFunction(() => {
      const el = document.querySelector('[data-testid="pixel-text-fill"]');
      const now = Number(el?.dataset.fill || 0);
      const same = el && el.dataset.lastSeen === String(now);
      if (el) el.dataset.lastSeen = String(now);
      return same;
    }, null, { timeout: 8000, polling: 250 }).catch(() => {});
    await page.waitForTimeout(300);
    return page.evaluate(() => {
      const col = document.querySelector('.hv2-community-cards').getBoundingClientRect();
      const cards = [...document.querySelectorAll('[data-testid^="morph-card-"]')];
      const first = cards[0].getBoundingClientRect();
      const outside = cards.filter((el) => {
        const r = el.getBoundingClientRect();
        return r.top < col.top - 8 || r.bottom > col.bottom + 8 || r.left < col.left - 8 || r.right > col.right + 8;
      }).length;
      const fill = Number(document.querySelector('[data-testid="pixel-text-fill"]').dataset.fill || 0);
      const lefts = cards.map((el) => el.getBoundingClientRect().left);
      const rights = cards.map((el) => el.getBoundingClientRect().right);
      const spanW = Math.round(((Math.max(...rights) - Math.min(...lefts)) / col.width) * 100);
      return {
        fill, cardX: Math.round(first.x), cardY: Math.round(first.y), outside,
        cards: cards.length, spanW, cardW: Math.round(first.width),
      };
    });
  };

  // Fractions of the SECTION. The frame is pinned for the first 87% of it
  // and the scene uses 85% of that, so the scene is complete at about 0.74;
  // 0.72 is "all but finished" and 0.80 is inside the hold.
  const early = await sample(0.02);
  const mid = await sample(0.3);
  const late = await sample(0.72);

  // The passage fills in behind a dithered wavefront. The sample is taken a
  // little way into the section, so a few characters have legitimately
  // arrived by then - "almost none", not "none".
  ok(`${lng}: the passage starts almost entirely unfilled`, early.fill <= 0.1, `${early.fill}`);
  ok(`${lng}: it fills as the section is read`, mid.fill > early.fill && late.fill > mid.fill,
    `${early.fill} -> ${mid.fill} -> ${late.fill}`);
  ok(`${lng}: and is complete by the end`, late.fill >= 0.9, `${late.fill}`);
  // The two halves move off the same value, so the ring has to have moved
  // over exactly the span in which the words lit.
  ok(`${lng}: the ring moves over the same scroll`,
    Math.abs(mid.cardX - early.cardX) > 20 || Math.abs(mid.cardY - early.cardY) > 20,
    `${early.cardX},${early.cardY} -> ${mid.cardX},${mid.cardY}`);
  // The arch is MEANT to crop at the sides now - that is what makes it read
  // as one big shape instead of a row of pictures, and it is the shape in the
  // reference. So the assertion is the opposite of what it was: the finished
  // scene has to FILL its frame. An earlier version demanded every card sit
  // inside the column, which is exactly the constraint that produced a small
  // tidy arc adrift in white space.
  ok(`${lng}: the finished scene fills its frame`, late.spanW >= 90, `${late.spanW}% of the width`);
  // 110 CSS px at the page's 0.8 layout (see `zoom` in home-v2.css): the
  // rect is read in viewport px, so the same card measures 0.8x what it did.
  ok(`${lng}: and its cards are the size of the stage, not thumbnails`,
    late.cardW >= 110 * 0.8, `${late.cardW}px wide`);

  // The complaint this encodes: "you don't see the whole scene until you
  // have already scrolled past it." The scene finishes at 72% of the pinned
  // travel, so at three-quarters of the way down the section everything is
  // complete AND the frame is still pinned - a beat with the finished
  // picture standing still. Driving the animation to the very end of the
  // pin is what produced the original behaviour.
  await page.evaluate((top) => window.scrollTo(0, top), commBox.top + commBox.height * 0.80);
  await page.waitForFunction(() => Number(document.querySelector('[data-testid="pixel-text-fill"]')?.dataset.fill || 0) >= 0.99, null, { timeout: 8000, polling: 250 }).catch(() => {});
  const hold = await page.evaluate(() => {
    const frame = document.querySelector('.hv2-community-sticky').getBoundingClientRect();
    return {
      fill: Number(document.querySelector('[data-testid="pixel-text-fill"]').dataset.fill || 0),
      frameTop: Math.round(frame.top),
    };
  });
  ok(`${lng}: the finished scene holds while still pinned`,
    hold.fill >= 0.99 && Math.abs(hold.frameTop) <= 2,
    `fill ${hold.fill}, frame at ${hold.frameTop}`);

  // Mid-passage there has to be a WAVEFRONT: some accent-coloured pixels
  // dissolving in between the filled text and the text still to come. All
  // ink and no accent means the fill is jumping rather than dissolving.
  const crest = await page.evaluate((top) => {
    window.scrollTo(0, top);
    return new Promise((done) => setTimeout(() => {
      const c = document.querySelector('[data-testid="pixel-text-fill"] canvas');
      const ctx = c.getContext('2d');
      const d = ctx.getImageData(0, 0, c.width, c.height).data;
      let ink = 0; let accent = 0;
      for (let i = 0; i < d.length; i += 40) {
        if (d[i + 3] < 40) continue;
        if (d[i + 2] > d[i] + 30 && d[i + 2] > 90) accent += 1;
        else if (d[i] < 90 && d[i + 1] < 90) ink += 1;
      }
      done({ ink, accent });
    }, 1100));
  }, commBox.top + commBox.height * 0.3);
  ok(`${lng}: the fill has a dissolving crest, not a hard edge`,
    crest.accent > 50 && crest.ink > 50, `${crest.ink} ink, ${crest.accent} accent`);

  // The passage is pinned inside one screen. Sized from viewport WIDTH alone
  // it grew taller than the frame on a laptop, so the opening lines sat above
  // the top edge and the closing ones below the bottom - words lighting where
  // nobody could see them.
  const fits = await page.evaluate(() => {
    const frame = document.querySelector('.hv2-community-sticky').getBoundingClientRect();
    const words = document.querySelector('.hv2-community-words').getBoundingClientRect();
    return { above: Math.round(words.top - frame.top), below: Math.round(frame.bottom - words.bottom) };
  });
  ok(`${lng}: the whole passage fits inside the pinned frame`,
    fits.above >= 0 && fits.below >= 0, `${fits.above}px above, ${fits.below}px below`);

  // The source component swallowed the wheel. In a section halfway down a
  // page that means the page stops moving while the pointer is over it.
  await page.evaluate((y) => window.scrollTo(0, y), commBox.top + 200);
  await page.waitForTimeout(400);
  const beforeWheel = await page.evaluate(() => window.scrollY);
  await page.mouse.move(1000, 450);
  await page.mouse.wheel(0, 600);
  await page.waitForTimeout(600);
  const afterWheel = await page.evaluate(() => window.scrollY);
  ok(`${lng}: the page still scrolls with the pointer over the ring`, afterWheel > beforeWheel,
    `${beforeWheel} -> ${afterWheel}`);

  // ── the two button treatments ──────────────────────────────────────
  // The liquid button appears exactly once, on the hero's main action. Its
  // whole justification is being the loudest control on the page, which only
  // holds while there is one of it.
  const liquid = page.locator('[data-testid="home-preview-hero-primary"]');
  ok(`${lng}: the hero's main action is the liquid button`, await liquid.count() === 1);
  await page.evaluate(() => window.scrollTo(0, 0));
  await page.waitForTimeout(500);
  const liquidRest = await liquid.evaluate((el) => getComputedStyle(el.querySelector('span[aria-hidden]')).transform);
  await liquid.hover();
  await page.waitForTimeout(900);
  const liquidHover = await liquid.evaluate((el) => getComputedStyle(el.querySelector('span[aria-hidden]')).transform);
  ok(`${lng}: its liquid rises on hover`, liquidRest !== liquidHover, `${liquidRest} -> ${liquidHover}`);

  // The second hero action is the ghost variant: an outline in ink at rest,
  // the same liquid on hover, and a white label once it is flooded.
  const ghost = page.locator('[data-testid="home-preview-hero-secondary"]');
  ok(`${lng}: "Find a business" is the ghost liquid button`, (await ghost.getAttribute('data-variant')) === 'ghost');
  await page.mouse.move(5, 5);
  await page.waitForTimeout(500);
  const ghostRest = await ghost.evaluate((el) => ({ bg: getComputedStyle(el).backgroundColor, color: getComputedStyle(el).color, tf: getComputedStyle(el.querySelector('span[aria-hidden]')).transform }));
  await ghost.hover();
  await page.waitForTimeout(900);
  const ghostHover = await ghost.evaluate((el) => ({ color: getComputedStyle(el).color, tf: getComputedStyle(el.querySelector('span[aria-hidden]')).transform }));
  ok(`${lng}: it rests transparent with an ink label`, ghostRest.bg === 'rgba(0, 0, 0, 0)' && ghostRest.color !== 'rgb(255, 255, 255)', JSON.stringify(ghostRest));
  ok(`${lng}: and floods on hover with a white label`, ghostRest.tf !== ghostHover.tf && ghostHover.color === 'rgb(255, 255, 255)', JSON.stringify(ghostHover));

  // The nav's three pills are flow buttons here, and links still.
  await page.evaluate(() => window.scrollTo(0, 0));
  await page.waitForTimeout(400);
  const pills = page.locator('[data-testid="nav-rental-categories"] [data-flow="1"]');
  ok(`${lng}: the nav pills are flow buttons on the preview`, await pills.count() === 3, `${await pills.count()}`);
  ok(`${lng}: and still real links`, (await page.locator('[data-testid="nav-link-stays"]').evaluate((el) => el.tagName + ' ' + el.getAttribute('href'))) === 'A /stays');
  const pillBefore = await pills.first().evaluate((el) => getComputedStyle(el.querySelectorAll('span')[1]).width);
  await pills.first().hover();
  await page.waitForTimeout(900);
  const pillAfter = await pills.first().evaluate((el) => ({ w: getComputedStyle(el.querySelectorAll('span')[1]).width, color: getComputedStyle(el).color }));
  ok(`${lng}: a nav pill floods on hover with a white label`, parseFloat(pillAfter.w) > parseFloat(pillBefore) + 100 && pillAfter.color === 'rgb(255, 255, 255)', JSON.stringify(pillAfter));
  await page.mouse.move(5, 5);

  // The page is laid out at 0.8: the size Tzvi saw at 80% browser zoom.
  const zoom = await page.evaluate(() => getComputedStyle(document.getElementById('root')).zoom);
  ok(`${lng}: the preview lays out at 0.8`, String(zoom) === '0.8', String(zoom));

  for (const [name, id] of [['stays', 'home-preview-more-stays'], ['businesses', 'home-preview-more-businesses']]) {
    const flow = page.locator(`[data-testid="${id}"]`);
    await flow.scrollIntoViewIfNeeded();
    // Park the pointer in the corner first. The page scrolls under a
    // stationary mouse, so the second of these buttons can arrive already
    // under it - and its "before hover" reading was the hovered one.
    await page.mouse.move(5, 5);
    await page.waitForTimeout(700);
    const beforeW = await flow.evaluate((el) => getComputedStyle(el.querySelectorAll('span')[1]).width);
    await flow.hover();
    await page.waitForTimeout(900);
    const afterHover = await flow.evaluate((el) => ({
      w: getComputedStyle(el.querySelectorAll('span')[1]).width,
      color: getComputedStyle(el).color,
    }));
    ok(`${lng}: the ${name} "see all" floods on hover`,
      parseFloat(afterHover.w) > parseFloat(beforeW) + 100, `${beforeW} -> ${afterHover.w}`);
    ok(`${lng}: and its label turns white on the fill`, afterHover.color === 'rgb(255, 255, 255)', afterHover.color);
  }

  // ── the picks carousel drifts, rather than stepping ────────────────
  // A step on a timer is a lurch, a pause, a lurch. What reads as motion is
  // the ring never arriving, so this samples the centre card three times and
  // asks two things: that it moved every time, and that the amounts are
  // similar - a stepper is either still or jumping.
  // Bring it back on screen first: the drift stops when the section is out
  // of view, so measuring it from wherever the previous block left the page
  // reads zero movement and calls a working carousel broken.
  await page.locator('#picks').scrollIntoViewIfNeeded();
  await page.mouse.move(5, 5);
  await page.waitForTimeout(1200);
  const slideX = () => page.evaluate(() => {
    const el = document.querySelector('[aria-roledescription="slide"]');
    return new DOMMatrixReadOnly(getComputedStyle(el).transform).e;
  });
  const xs = [await slideX()];
  for (let i = 0; i < 3; i++) {
    await page.waitForTimeout(700);
    xs.push(await slideX());
  }
  const deltas = xs.slice(1).map((v, i) => Math.abs(v - xs[i]));
  ok(`${lng}: today's picks is always moving`, deltas.every((d) => d > 0.5), deltas.map((d) => d.toFixed(1)).join(', '));
  ok(`${lng}: and moves evenly, not in lurches`,
    Math.max(...deltas) / Math.max(Math.min(...deltas), 0.01) < 3,
    deltas.map((d) => d.toFixed(1)).join(', '));

  const auto = page.locator('[data-autoplay]');
  await auto.hover();
  await page.waitForTimeout(800);
  const heldFrom = await slideX();
  await page.waitForTimeout(1400);
  ok(`${lng}: it holds still under the pointer`, Math.abs((await slideX()) - heldFrom) < 0.5);
  await page.mouse.move(5, 5);
  await page.waitForTimeout(900);
  const resumeFrom = await slideX();
  await page.waitForTimeout(1200);
  ok(`${lng}: and picks up again when the pointer leaves`, Math.abs((await slideX()) - resumeFrom) > 0.5);

  const primary = page.locator('[data-testid="home-preview-cta-primary"]');
  ok(`${lng}: the CTA's primary button is there`, await primary.count() === 1);
  // One door, not two. A visitor should not have to classify themselves as a
  // business or a landlord before they have an account; /join asks that once.
  const ctaButtons = await page.locator('.hv2-cta-row button').count();
  ok(`${lng}: the CTA offers a single way in`, ctaButtons === 1, `${ctaButtons} buttons`);
  ok(`${lng}: and its label is the join wording`,
    /join|הצטרפות/i.test((await primary.innerText()).trim()), (await primary.innerText()).trim());
  const sweep = await primary.evaluate((el) => {
    const panel = el.querySelector('span[aria-hidden]');
    const cs = getComputedStyle(panel);
    // The fill is set once on the <g>, so read the circle's COMPUTED fill,
    // which is what a viewer actually sees. Reading the circle's own attribute
    // returns null and fails a button that is the right colour.
    return { bg: cs.backgroundImage, dot: getComputedStyle(el.querySelector('circle')).fill };
  });
  // Theme colours, not the source component's lime and near-black. The
  // palette is read from the page rather than hardcoded here, so the check
  // follows a theme swap instead of failing every working button on one.
  const sweepColour = (sweep.bg.match(/rgba?\([^)]+\)/g) || []).pop() || '';
  const accentVar = await page.evaluate(() => getComputedStyle(document.documentElement).getPropertyValue('--sweep-b').trim() || getComputedStyle(document.documentElement).getPropertyValue('--brand-primary').trim());
  const accentRgb = await page.evaluate((hex) => { const s = document.createElement('span'); s.style.color = hex; document.body.appendChild(s); const c = getComputedStyle(s).color; s.remove(); return c; }, accentVar);
  ok(`${lng}: the button's sweep is the theme's accent, not the source's lime`,
    !/214, 245, 74/.test(sweep.bg) && sweepColour.replace(/\s/g, '') === accentRgb.replace(/\s/g, ''),
    `${sweepColour} vs ${accentRgb}`);
  ok(`${lng}: its dots read against the sweep`,
    contrast(sweep.dot, sweepColour) >= 3, `${contrast(sweep.dot, sweepColour).toFixed(2)}:1 ${sweep.dot}`);
  // Hovered, the gold panel covers the whole button. The label has to still be
  // there and still be readable — in the source it is wiped out by the sweep,
  // leaving a blank button at the moment of the click.
  await primary.hover();
  await page.waitForTimeout(700);
  const hovered = await primary.evaluate((el) => {
    const label = el.querySelector('span');
    return { text: label.textContent.trim(), color: getComputedStyle(label).color };
  });
  ok(`${lng}: the label survives the hover sweep`, hovered.text.length > 1, hovered.text);
  ok(`${lng}: and still reads against the sweep under it`,
    contrast(hovered.color, sweepColour) >= 3,
    `${contrast(hovered.color, sweepColour).toFixed(2)}:1 ${hovered.color}`);

  const h1 = page.locator('[data-testid="home-preview-hero"] h1');
  const font = await h1.evaluate((el) => getComputedStyle(el).fontFamily);
  ok(`${lng}: heading font is ${lng === 'he' ? 'Frank Ruhl Libre' : 'Playfair Display'}`,
    lng === 'he' ? /Frank Ruhl/.test(font) : /Playfair/.test(font), font);
  const dir = await page.evaluate(() => document.documentElement.getAttribute('dir'));
  ok(`${lng}: document direction is ${lng === 'he' ? 'rtl' : 'ltr'}`, lng === 'he' ? dir === 'rtl' : dir !== 'rtl', String(dir));

  const bodyText = await page.innerText('body');
  ok(`${lng}: no raw i18n keys on the page`, !/home\.v2\./.test(bodyText));
  ok(`${lng}: no page errors`, errors.length === 0, errors[0]);
  await page.context().close();
}
// ── scope: none of it leaks onto the real home page ─────────────────
// Tzvi, 2026-09-03: "why is the preview affecting the real site". The flow
// pills and the 0.8 layout are preview tries; / keeps its glass pills at 1.
{
  const ctx = await browser.newContext({ viewport: { width: 1280, height: 800 } });
  const page = await ctx.newPage();
  await page.goto(`${APP}/`, { waitUntil: 'domcontentloaded' });
  await page.waitForSelector('[data-testid="nav-link-stays"]', { timeout: 20000 }).catch(() => {});
  const real = await page.evaluate(() => ({
    flow: document.querySelectorAll('[data-testid="nav-rental-categories"] [data-flow="1"]').length,
    glass: document.querySelectorAll('[data-testid="nav-rental-categories"] .glass-pill').length,
    zoom: String(getComputedStyle(document.getElementById('root')).zoom),
    themed: document.body.classList.contains('theme-preview'),
  }));
  ok('the real home page keeps its glass pills', real.flow === 0 && real.glass === 3, JSON.stringify(real));
  ok('and lays out at 1', real.zoom === '1' || real.zoom === 'normal', real.zoom);
  ok('and carries no preview theme', real.themed === false);
  await ctx.close();
}

await browser.close();

const failed = results.filter((r) => !r).length;
console.log(`\n${results.length - failed}/${results.length} passed\n`);
process.exit(failed ? 1 : 0);
