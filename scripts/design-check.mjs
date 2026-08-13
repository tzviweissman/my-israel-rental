/**
 * design-check - the free half of the design loop.
 *
 * Runs the checks that do not need a language model. Every rule below is
 * either mechanically countable or measurable in a real browser, so it
 * costs zero tokens and returns the same answer every time.
 *
 * WHY THIS EXISTS
 * ---------------
 * The design-loop technique spins up independent critics because a model
 * that made something also passes it. The costly part is not the critics,
 * it is that each one re-reads the whole rulebook every round: the
 * taste-skill alone is ~22k tokens, so three critics over ten rounds spend
 * ~660k tokens re-reading rules before looking at the page.
 *
 * Most of those rules are countable. This script IS the system critic, at
 * no cost, which leaves the model critic only the judgement a script
 * cannot make ("is this composition any good"). See the Design Loop note.
 *
 * USAGE
 *   node scripts/design-check.mjs /why-host
 *   node scripts/design-check.mjs /why-host --json
 *   node scripts/design-check.mjs /why-host --base http://localhost:3210
 *   node scripts/design-check.mjs /why-host --src frontend/src/pages/WhyHost.jsx
 *
 * Exit code 1 if any `error` finding, so it can gate a commit.
 *
 * FALSE POSITIVES ARE THE ENEMY. A checker people learn to ignore is
 * worse than no checker, so every rule here is deliberately narrow and
 * anything ambiguous is reported as `info` rather than `error`.
 */
import { createRequire } from 'node:module';
import fs from 'node:fs';
import path from 'node:path';

const require = createRequire(import.meta.url);
const { chromium } = require('playwright');

const args = process.argv.slice(2);
const flag = (name, def = null) => {
  const i = args.indexOf(`--${name}`);
  return i >= 0 ? args[i + 1] : def;
};
// Git Bash rewrites any `/`-prefixed argument into a Windows path before
// this script sees it (see CLAUDE.md), which silently checked the wrong
// page the first time this ran and then produced an invalid URL when the
// bug was only half fixed. Undo the rewrite rather than asking every
// caller to remember MSYS_NO_PATHCONV=1.
const unmangle = (v) => {
  if (!v) return v;
  const m = v.match(/^[A-Za-z]:[\\/].*?(?:Git|MinGW\d*|usr)[\\/](.*)$/i);
  return m ? '/' + m[1].replace(/\\/g, '/') : v;
};
const pagePath = unmangle(flag('path') || args.find((a) => a.startsWith('/'))) || '/';
if (!pagePath.startsWith('/')) {
  console.error(`\nCould not read a page path from "${pagePath}".\nPass it as --path /why-host.\n`);
  process.exit(2);
}
const BASE = flag('base', 'http://localhost:3210');
const SRC = flag('src', null);
const AS_JSON = args.includes('--json');

const findings = [];
const add = (severity, rule, detail, extra = {}) =>
  findings.push({ severity, rule, detail, ...extra });

/* ---------------------------------------------------------------- */
/* Source checks - no browser needed                                 */
/* ---------------------------------------------------------------- */
function checkSource(file) {
  if (!fs.existsSync(file)) {
    add('info', 'source', `Source file not found, skipped source checks: ${file}`);
    return;
  }
  const text = fs.readFileSync(file, 'utf8');
  const lines = text.split('\n');

  lines.forEach((line, i) => {
    const n = i + 1;

    // Tailwind arbitrary values cannot contain spaces. The class is
    // silently dropped, so a shadow or ring just never renders. Only
    // look inside className strings to avoid matching prose.
    const cls = line.match(/className\s*=\s*[{"'`]([^"'`}]+)/);
    if (cls) {
      const bad = cls[1].match(/[\w-]+\[[^\]]*\s[^\]]*\]/g);
      if (bad) {
        add('error', 'tailwind-space', `Arbitrary value contains a space, so the class is dropped: ${bad.join(', ')}`, { line: n });
      }
    }

    // Playfair has no Hebrew glyphs and an inline style beats the RTL
    // stylesheet, so a literal face name silently breaks Hebrew.
    if (/fontFamily\s*:\s*['"][^'"]*Playfair/.test(line)) {
      add('error', 'rtl-font-literal', "Inline fontFamily names Playfair directly. Use var(--font-head) or Hebrew falls back to a system serif.", { line: n });
    }

    // Em-dash, per the taste-skill. Style opinion, so `info`.
    if (line.includes('—')) {
      add('info', 'em-dash', 'Em-dash in source. The taste-skill bans it outright; a hyphen or a full stop reads the same.', { line: n });
    }
  });
}

/* ---------------------------------------------------------------- */
/* Browser checks                                                    */
/* ---------------------------------------------------------------- */

// Runs inside the page. Kept as one function so it is a single
// evaluate() round trip per viewport.
function inPage() {
  const out = [];
  const push = (severity, rule, detail) => out.push({ severity, rule, detail });

  const visible = (el) => {
    const s = getComputedStyle(el);
    if (s.display === 'none' || s.visibility === 'hidden' || +s.opacity === 0) return false;
    const r = el.getBoundingClientRect();
    return r.width > 0 && r.height > 0;
  };

  /* --- horizontal overflow ------------------------------------- */
  const de = document.documentElement;
  if (de.scrollWidth > de.clientWidth + 1) {
    const culprits = [...document.querySelectorAll('body *')]
      .filter((e) => {
        const s = getComputedStyle(e);
        if (s.position === 'fixed') return false; // floating chrome is fine
        return e.getBoundingClientRect().right > de.clientWidth + 2;
      })
      .slice(0, 4)
      .map((e) => e.tagName.toLowerCase() + (e.className ? '.' + String(e.className).split(' ')[0] : ''));
    push('error', 'overflow', `Page scrolls sideways (${de.scrollWidth}px in ${de.clientWidth}px). First offenders: ${culprits.join(', ') || 'unknown'}`);
  }

  /* --- em-dashes in rendered copy ------------------------------ */
  const dashes = (document.body.innerText.match(/—/g) || []).length;
  if (dashes) push('info', 'em-dash', `${dashes} em-dash${dashes > 1 ? 'es' : ''} visible on the page.`);

  /* --- eyebrow restraint --------------------------------------- */
  // An eyebrow is a small uppercase wide-tracked label above a heading.
  const eyebrows = [...document.querySelectorAll('body *')].filter((e) => {
    if (e.children.length || !e.textContent.trim() || !visible(e)) return false;
    // Site chrome is not a section eyebrow. Without this the wordmark and
    // footer headings count toward the cap and the number is meaningless.
    if (e.closest('nav, header, footer, [role="navigation"]')) return false;
    const s = getComputedStyle(e);
    return s.textTransform === 'uppercase'
      && parseFloat(s.letterSpacing) > 0.8
      && parseFloat(s.fontSize) <= 14;
  });
  const sections = document.querySelectorAll('section').length || 1;
  const cap = Math.ceil(sections / 3);
  if (eyebrows.length > cap) {
    push('warn', 'eyebrow-count',
      `${eyebrows.length} eyebrows across ${sections} sections (cap is ${cap}, one per three). Extras: ${eyebrows.slice(cap).map((e) => JSON.stringify(e.textContent.trim().slice(0, 24))).join(', ')}`);
  }

  /* --- three equal cards in a row ------------------------------ */
  [...document.querySelectorAll('body *')].forEach((el) => {
    const s = getComputedStyle(el);
    if (!s.display.includes('grid')) return;
    const cols = s.gridTemplateColumns.split(' ').filter(Boolean);
    if (cols.length < 3) return;
    const widths = cols.map((c) => Math.round(parseFloat(c)));
    if (widths.some((w) => Number.isNaN(w))) return;
    const allEqual = widths.every((w) => Math.abs(w - widths[0]) < 2);
    if (!allEqual) return;
    const kids = [...el.children].filter(visible);
    if (kids.length < 3) return;
    // Only flag when the children look like cards: their own background
    // or border, and text inside.
    const cardish = kids.filter((k) => {
      const ks = getComputedStyle(k);
      const hasSurface = ks.backgroundColor !== 'rgba(0, 0, 0, 0)' || parseFloat(ks.borderTopWidth) > 0;
      return hasSurface && k.innerText.trim().length > 20;
    });
    if (cardish.length >= 3) {
      // The banned pattern is the identical FEATURE card row, not any row
      // of three. A stats strip or a three-step row is legitimate and
      // reads completely differently, and the giveaway is how much prose
      // each cell carries. Report the short ones as info so the checker
      // stays worth listening to.
      const avg = cardish.reduce((a, k) => a + k.innerText.trim().length, 0) / cardish.length;
      const first = JSON.stringify(cardish[0].innerText.trim().split('\n')[0].slice(0, 28));
      if (avg >= 110) {
        push('warn', 'equal-cards',
          `${cardish.length} equal-width cards averaging ${Math.round(avg)} chars of copy, starting ${first}. This is the identical-feature-card row the taste-skill bans; try an asymmetric grid, a 2-column zigzag, or a numbered list.`);
      } else {
        push('info', 'equal-cards',
          `${cardish.length} equal-width cells starting ${first} (avg ${Math.round(avg)} chars). Short cells usually mean a stats or steps row, which is fine. Worth a look only if it is really a feature row.`);
      }
    }
  });

  /* --- contrast ------------------------------------------------ */
  const lum = (r, g, b) => {
    const f = (v) => { v /= 255; return v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4; };
    return 0.2126 * f(r) + 0.7152 * f(g) + 0.0722 * f(b);
  };
  const parse = (c) => (c.match(/[\d.]+/g) || []).map(Number);
  const effBg = (el) => {
    let n = el;
    while (n && n !== document.documentElement) {
      const c = parse(getComputedStyle(n).backgroundColor);
      if (c.length >= 3 && (c[3] === undefined || c[3] > 0.5)) return c;
      n = n.parentElement;
    }
    return [255, 255, 255];
  };
  const seen = new Set();
  [...document.querySelectorAll('p,span,h1,h2,h3,h4,li,a,button,small,b,div')].forEach((el) => {
    if (el.children.length || !visible(el)) return;
    const t = el.textContent.trim();
    if (t.length < 4) return;
    const s = getComputedStyle(el);
    // Text sitting on media cannot be judged from colour alone, so skip
    // rather than guess. Two ways it happens, and missing the second one
    // made this checker report every white hero caption on the home page
    // as white-on-limestone:
    //   1. a CSS background-image or gradient on an ancestor;
    //   2. a <video> or <img> painted behind the text, where every
    //      ancestor background is transparent.
    let n = el, overMedia = false;
    while (n && n !== document.documentElement) {
      const bs = getComputedStyle(n);
      if (bs.backgroundImage && bs.backgroundImage !== 'none') { overMedia = true; break; }
      n = n.parentElement;
    }
    if (!overMedia) {
      const r = el.getBoundingClientRect();
      overMedia = [...document.querySelectorAll('video, img')].some((m) => {
        const mr = m.getBoundingClientRect();
        return mr.width > 0 && mr.height > 0
          && mr.left <= r.left + 1 && mr.right >= r.right - 1
          && mr.top <= r.top + 1 && mr.bottom >= r.bottom - 1;
      });
    }
    if (overMedia) return;
    const fg = parse(s.color);
    const bg = effBg(el);
    if (fg.length < 3) return;
    const L1 = lum(fg[0], fg[1], fg[2]), L2 = lum(bg[0], bg[1], bg[2]);
    const ratio = (Math.max(L1, L2) + 0.05) / (Math.min(L1, L2) + 0.05);
    const px = parseFloat(s.fontSize);
    const bold = parseInt(s.fontWeight, 10) >= 700;
    const large = px >= 24 || (px >= 18.66 && bold);
    const need = large ? 3 : 4.5;
    if (ratio < need) {
      const key = `${s.color}|${ratio.toFixed(2)}`;
      if (seen.has(key)) return;
      seen.add(key);
      push('error', 'contrast',
        `Contrast ${ratio.toFixed(2)}:1 needs ${need}:1 - ${JSON.stringify(t.slice(0, 40))} (${s.color} on rgb(${bg.slice(0, 3).join(',')}))`);
    }
  });

  /* --- images without alt -------------------------------------- */
  [...document.querySelectorAll('img')].filter(visible).forEach((img) => {
    if (!img.hasAttribute('alt')) {
      push('error', 'img-alt', `Image has no alt attribute: ${img.currentSrc.split('/').pop()}`);
    }
  });

  /* --- more than one tab panel showing -------------------------- */
  const panels = [...document.querySelectorAll('[role="tabpanel"]')].filter(visible);
  if (panels.length > 1) {
    push('error', 'tabpanels',
      `${panels.length} tab panels visible at once. The \`hidden\` attribute is a user-agent display rule and loses to any author display value; drive visibility from state instead.`);
  }

  /* --- untranslated i18n keys leaking to screen ------------------ */
  const keyLike = document.body.innerText.match(/\b(whyHost|whyList|stays|services|requests|nav|auth|common|home|dashboard)\.[A-Za-z_][A-Za-z0-9_]*/g);
  if (keyLike) {
    push('error', 'i18n-key-visible',
      `Raw translation keys are rendering as text: ${[...new Set(keyLike)].slice(0, 5).join(', ')}`);
  }

  /* --- wrapped CTA labels --------------------------------------- */
  [...document.querySelectorAll('button, a[class*="btn"]')].filter(visible).forEach((b) => {
    const s = getComputedStyle(b);
    const lh = parseFloat(s.lineHeight) || parseFloat(s.fontSize) * 1.2;
    const inner = b.clientHeight - parseFloat(s.paddingTop) - parseFloat(s.paddingBottom);
    if (inner > lh * 1.6 && b.innerText.trim().length > 6) {
      push('warn', 'cta-wrap', `Button label wraps to more than one line: ${JSON.stringify(b.innerText.trim().slice(0, 34))}`);
    }
  });

  return out;
}

/* ---------------------------------------------------------------- */
/* RTL check - separate pass                                         */
/* ---------------------------------------------------------------- */
function inPageRtl() {
  const out = [];
  const h = document.querySelector('h1, h2');
  if (!h) return out;
  const face = getComputedStyle(h).fontFamily.split(',')[0].replace(/["']/g, '').trim();
  if (/Playfair/i.test(face)) {
    out.push({
      severity: 'error', rule: 'rtl-font',
      detail: `Headings still resolve to ${face} in RTL. Playfair has no Hebrew glyphs, so this silently falls back to a system serif.`,
    });
  }
  if (document.documentElement.dir !== 'rtl') {
    out.push({ severity: 'info', rule: 'rtl-dir', detail: 'Could not switch the page to RTL, so the Hebrew pass was not run.' });
  }
  return out;
}

/* ---------------------------------------------------------------- */

const WIDTHS = [
  ['desktop', 1280],
  ['tablet', 768],
  ['mobile', 375],
];

const browser = await chromium.launch();
try {
  if (SRC) checkSource(path.resolve(SRC));

  for (const [label, width] of WIDTHS) {
    const page = await browser.newPage({ viewport: { width, height: 900 } });
    const consoleErrors = [];
    page.on('console', (m) => { if (m.type() === 'error') consoleErrors.push(m.text().slice(0, 140)); });
    page.on('pageerror', (e) => consoleErrors.push(String(e).slice(0, 140)));

    await page.goto(BASE + pagePath, { waitUntil: 'domcontentloaded' });
    await page.waitForTimeout(6000);

    for (const f of await page.evaluate(inPage)) {
      // Contrast and alt text do not change with width; report once.
      const widthAgnostic = ['contrast', 'img-alt', 'em-dash', 'i18n-key-visible', 'tabpanels'];
      if (widthAgnostic.includes(f.rule) && label !== 'desktop') continue;
      add(f.severity, f.rule, f.detail, { viewport: label });
    }
    consoleErrors.forEach((e) => add('error', 'console', e, { viewport: label }));

    if (label === 'desktop') {
      // RTL pass, on the same page, by clicking the language toggle.
      await page.evaluate(() => {
        const b = [...document.querySelectorAll('button')].find((x) => /עברית/.test(x.innerText));
        if (b) b.click();
      });
      await page.waitForTimeout(4000);
      for (const f of await page.evaluate(inPageRtl)) add(f.severity, f.rule, f.detail, { viewport: 'rtl' });
    }
    await page.close();
  }
} finally {
  await browser.close();
}

const order = { error: 0, warn: 1, info: 2 };
findings.sort((a, b) => order[a.severity] - order[b.severity]);

if (AS_JSON) {
  console.log(JSON.stringify({ page: pagePath, findings }, null, 2));
} else {
  const counts = findings.reduce((a, f) => ({ ...a, [f.severity]: (a[f.severity] || 0) + 1 }), {});
  console.log(`\ndesign-check ${pagePath}`);
  console.log(`  ${counts.error || 0} error, ${counts.warn || 0} warn, ${counts.info || 0} info\n`);
  for (const f of findings) {
    const where = [f.viewport, f.line && `line ${f.line}`].filter(Boolean).join(' ');
    console.log(`  [${f.severity.toUpperCase().padEnd(5)}] ${f.rule.padEnd(18)} ${where ? `(${where}) ` : ''}${f.detail}`);
  }
  console.log('');
}

process.exit(findings.some((f) => f.severity === 'error') ? 1 : 0);
