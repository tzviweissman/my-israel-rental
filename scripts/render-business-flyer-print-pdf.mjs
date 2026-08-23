/**
 * Print-ready A4 PDF of the BUSINESS flyer (EN or HE), with bleed.
 *
 *   node scripts/render-business-flyer-print-pdf.mjs marketing/flyer-business-a4-en.html
 *
 * Sibling of render-flyer-print-pdf.mjs. Same reasoning, different layout:
 * this flyer is one absolutely-positioned artboard (.art) inside a .page,
 * so bleed is applied by growing the page, pushing .art in by the bleed,
 * and letting the only edge-touching element (.hero) overhang outward.
 * Net effect: identical artwork, 3mm of overhang all round, nothing moves
 * relative to the cut.
 *
 * As in the sibling script the page size MUST come from CSS with
 * preferCSSPageSize — setting it through Playwright's width/height lets
 * Chromium apply a ~3mm print margin even with every margin at 0, which
 * produces a file that looks like it has bleed and has none.
 */
import { chromium } from 'playwright';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import { readFile, writeFile, unlink, stat } from 'node:fs/promises';

const SRC = process.argv[2];
if (!SRC) throw new Error('usage: node scripts/render-business-flyer-print-pdf.mjs <flyer.html>');
const OUT = SRC.replace(/\.html$/, '-print.pdf');
const TMP = SRC.replace(/\.html$/, '.bleed.tmp.html');   // beside the original so assets resolve

const BLEED = 3.2;   // 3mm + 0.2 slack; Chromium writes the sheet a fraction under

const OVERRIDES = `
<style id="bleed-overrides">
  @page{ size:${210 + BLEED * 2}mm ${297 + BLEED * 2}mm; margin:0; }
  .page{ width:${210 + BLEED * 2}mm !important; height:${297 + BLEED * 2}mm !important; box-shadow:none !important; }
  /* the artwork moves in by the bleed so it stays put relative to the trim */
  .art{ top:${BLEED}mm !important; left:${BLEED}mm !important; }
  /* the photo is the only thing that touches an edge: overhang it outward */
  .hero{ top:-${BLEED}mm !important; left:-${BLEED}mm !important; right:-${BLEED}mm !important;
         height:calc(570px + ${BLEED}mm) !important; }
  body{ background:#fff !important; padding:0 !important; gap:0 !important; margin:0 !important; }
  .label{ display:none !important; }
</style>
`;

const src = await readFile(SRC, 'utf8');
if (!src.includes('</head>')) throw new Error('no </head> to inject into');
await writeFile(TMP, src.replace('</head>', `${OVERRIDES}</head>`), 'utf8');

const browser = await chromium.launch();
try {
  const page = await browser.newPage();
  await page.goto(pathToFileURL(path.resolve(TMP)).href, { waitUntil: 'networkidle', timeout: 120000 });
  await page.evaluate(() => document.fonts.ready);
  await page.waitForFunction(
    () => [...document.images].every((i) => i.complete && i.naturalWidth > 0), null, { timeout: 120000 });

  const check = await page.evaluate(() => {
    const r = document.querySelector('.page').getBoundingClientRect();
    const mm = (px) => +(px / (96 / 25.4)).toFixed(2);
    const rtl = document.documentElement.getAttribute('dir') === 'rtl';
    const heads = rtl ? ['Frank Ruhl Libre', 'Assistant'] : ['Playfair Display', 'Manrope'];
    return {
      pageW: mm(r.width), pageH: mm(r.height), rtl,
      fonts: Object.fromEntries(heads.map((f) => [f, document.fonts.check(`16px "${f}"`)])),
      qrIsVector: !!document.querySelector('svg path[d^="M"]'),
      images: [...document.images].map((i) => ({ name: i.currentSrc.split('/').pop(), w: i.naturalWidth, h: i.naturalHeight })),
    };
  });

  for (const [f, ok] of Object.entries(check.fonts))
    if (!ok) throw new Error(`webfont did not load: ${f} — refusing to write a print PDF`);
  for (const im of check.images) if (!im.w) throw new Error(`image failed: ${im.name}`);

  await page.pdf({ path: OUT, preferCSSPageSize: true, printBackground: true,
                   margin: { top: '0mm', right: '0mm', bottom: '0mm', left: '0mm' }, pageRanges: '1' });

  const { size } = await stat(OUT);
  console.log(`  ok ${OUT}  (${(size / 1024 / 1024).toFixed(2)} MB)`);
  console.log(`     page ${check.pageW} x ${check.pageH} mm = 210x297 trim + ${BLEED}mm bleed  | rtl=${check.rtl}`);
  console.log(`     fonts ${JSON.stringify(check.fonts)} | QR vector: ${check.qrIsVector}`);
  for (const im of check.images)
    console.log(`     image ${im.name} ${im.w}x${im.h}` + (im.name.startsWith('horizon') ? `  ~${Math.round(im.w / (216.4 / 25.4))} dpi at full bleed width` : ''));
} finally {
  await browser.close();
  await unlink(TMP).catch(() => {});
}
