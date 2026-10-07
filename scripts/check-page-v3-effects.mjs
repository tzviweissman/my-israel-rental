// Page builder v3: the effects gate. Local only.
//
// Renders one business once per set of effects, by answering the page's
// request for the business with a prepared payload (the API and database are
// never written). Payloads come from scripts/page-v3-effects-fixtures.py:
// real picks for every preset, plus sets that between them carry every
// effect the page draws today.
//
// Each is checked in every view by page-check/check-core.mjs, the same checks
// the page-check service runs before an owner's version goes live. Here hero
// contrast is held to the page without effects (an effect must never make it
// fainter); where that page is itself too faint, it is a warning. Plus, once,
// a grep of page-v3-motion.css for the banned patterns.
//   Needs: local API on :8001, the dev server (WEB, default :3211)
//   Run:   python scripts/page-v3-effects-fixtures.py > fx.json
//          node scripts/check-page-v3-effects.mjs fx.json [label-filter]
import { chromium } from 'playwright';
import { mkdir, readFile } from 'node:fs/promises';

import { checkPage } from '../page-check/check-core.mjs';

const WEB = process.env.WEB || 'http://localhost:3211';
const SLUG = 'rp-exp';
const OUT = 'screenshots/page-v3-effects';
const fixtures = JSON.parse(await readFile(process.argv[2], 'utf8'))
  .filter((f) => !process.argv[3] || f.label.includes(process.argv[3]));
await mkdir(OUT, { recursive: true });

const fails = [];
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

// The effects that need the scroll engine (effects.js): a data-sc attribute
// on a page with none of them is a stray.
const ENGINE = new Set([...(await readFile(new URL('../frontend/src/components/pagebuilder/v3/effects.js', import.meta.url), 'utf8'))
  .matchAll(/'([a-z0-9-]+)': \['[a-z]+', true\]/g)].map((m) => m[1]));

const b = await chromium.launch();
for (const f of fixtures) {
  const body = JSON.stringify(f.biz);
  const brief = f.biz.design_brief;
  const group = f.label.split('-')[0];
  const { fails: found } = await checkPage(b, {
    label: f.label,
    brief,
    engineIds: ENGINE,
    screenshotDir: OUT,
    urlFor: (lang) => `${WEB}/business/${SLUG}?lng=${lang}`,
    setup: async (page) => {
      await page.route(new RegExp(`/api/marketplace/business/${SLUG}(\\?|$)`), (r) => r.fulfill({ contentType: 'application/json', body }));
      // The scroll engine fetches a film as data, which needs CORS. Production
      // films are on Cloudinary, which allows it; the local API does not allow
      // this dev port, so local uploads get the header here.
      await page.route(/\/api\/uploads\//, async (r) => {
        const res = await r.fetch();
        r.fulfill({ response: res, headers: { ...res.headers(), 'access-control-allow-origin': '*' } });
      });
    },
    contrastRule: (view, dim) => {
      const key = `${group} ${view}`;
      if (!brief.effects.length) {
        baseline[key] = dim.worst;
        if (dim.bad.length) warns.push(`${f.label} ${view}: already too faint without effects: ${dim.bad.slice(0, 4).join(', ')}`);
        return null;
      }
      return dim.bad.length && dim.worst < (baseline[key] ?? 1) - 0.02
        ? `hero text fainter than without effects: ${dim.bad.slice(0, 4).join(', ')}` : null;
    },
  });
  fails.push(...found);
  console.log(`${f.label}: done`);
}
await b.close();


if (warns.length) console.log(`\nWARN, the page without effects (${warns.length})\n${warns.join('\n')}`);
console.log(fails.length ? `\nFAIL (${fails.length})\n${fails.join('\n')}` : `\nPASS: ${fixtures.length} effect sets x 7 views`);
process.exit(fails.length ? 1 : 0);
