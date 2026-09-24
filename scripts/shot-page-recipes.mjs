// Screenshots of the page-recipe previews seeded by
// scripts/preview-page-recipes.py: every page at 1280 and 375, in the
// language it was composed for (English UI for English pages, Hebrew UI
// for Hebrew ones). Full page plus the first screen, to
// screenshots/recipes/, and an index.html contact sheet beside them.
//   Needs: local API on :8001, dev server on :3210, the seed run first.
//   Run:   node scripts/shot-page-recipes.mjs [sample-key ...]
import { chromium } from 'playwright';
import { readFile, writeFile } from 'node:fs/promises';

const WEB = 'http://localhost:3210';
const DIR = 'screenshots/recipes';
const manifest = JSON.parse(await readFile(`${DIR}/manifest.json`, 'utf8'));
const only = process.argv.slice(2);
const pages = manifest.filter((m) => !only.length || only.includes(m.sample));

const problems = [];
const b = await chromium.launch();
for (const width of [1280, 375]) {
  const ctx = await b.newContext({ viewport: { width, height: width < 768 ? 812 : 800 }, reducedMotion: 'reduce' });
  const page = await ctx.newPage();
  page.on('pageerror', (e) => problems.push(`${page.url()} ${width}: ${e.message}`));
  for (const m of pages) {
    await page.goto(`${WEB}/business/${m.slug}?lng=${m.lang}`, { waitUntil: 'networkidle' });
    await page.locator('[data-testid="page-blocks"]').waitFor({ timeout: 20000 });
    await page.waitForTimeout(600);
    const tag = `${m.sample}--${m.recipe}--${m.lang}-${width}`;
    const facts = await page.evaluate(() => ({
      dir: document.documentElement.dir || document.body.dir,
      overflow: document.documentElement.scrollWidth > window.innerWidth + 1,
      blocks: [...document.querySelectorAll('[data-block-type]')].map((e) => `${e.dataset.blockType}:${Math.round(e.getBoundingClientRect().height)}`),
      heroFont: getComputedStyle(document.querySelector('.hero-band h2') || document.body).fontFamily,
    }));
    if (facts.overflow) problems.push(`${tag}: scrolls sideways`);
    if (m.lang === 'he' && facts.dir !== 'rtl') problems.push(`${tag}: not rtl`);
    m[`rendered_${width}`] = facts;
    await page.screenshot({ path: `${DIR}/${tag}-fold.png` });
    await page.screenshot({ path: `${DIR}/${tag}-full.png`, fullPage: true });
  }
  await ctx.close();
}
await b.close();

const rows = pages.map((m) => `<tr><td><b>${m.sample}</b><br>${m.recipe} / ${m.lang}<br><small>${m.blocks.join(' > ')}<br>${
  Object.values(m.theme).join(' · ')}<br>“${m.title} ${m.accent}”</small></td>${[1280, 375].map((w) =>
  `<td><a href="${m.sample}--${m.recipe}--${m.lang}-${w}-full.png"><img src="${m.sample}--${m.recipe}--${m.lang}-${w}-fold.png" width="${w === 1280 ? 480 : 180}"></a></td>`).join('')}</tr>`);
await writeFile(`${DIR}/index.html`, `<meta charset="utf-8"><title>Recipe previews</title><style>body{font:13px system-ui;margin:16px}td{vertical-align:top;padding:6px;border-bottom:1px solid #ddd}img{border:1px solid #ccc}</style><table>${rows.join('')}</table>`);
await writeFile(`${DIR}/manifest.json`, JSON.stringify(manifest, null, 1));
console.log(`${pages.length * 2 * 2} screenshots in ${DIR}`);
if (problems.length) { console.log('PROBLEMS:\n' + problems.join('\n')); process.exitCode = 1; }
