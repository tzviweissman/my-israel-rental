/**
 * Print-ready A4 PDF of the flyer, with bleed.
 *
 *   node scripts/render-flyer-print-pdf.mjs
 *
 * A press cuts the paper slightly off from where it intends to, every
 * time. If the artwork stopped exactly at the trim line, that slop would
 * show as a sliver of white paper along an edge. Bleed is the fix: the
 * photo and the footer are extended 3mm PAST the cut on every side, so
 * the blade always lands inside artwork and the ink reaches the edge.
 *
 *   trim  210 x 297mm  <- what the customer holds
 *   bleed 216 x 303mm  <- what the PDF is, 3mm extra all round
 *
 * The overrides are injected into the ORIGINAL flyer at render time
 * rather than kept as a second HTML file. A duplicate would drift from
 * the real flyer the first time someone edited one and not the other,
 * and the drift would only ever be discovered in print.
 *
 * The trick to getting bleed right is that the design must not MOVE
 * relative to the cut. Growing the page alone would shift every
 * edge-referenced measurement 3mm inward. So each one is grown to match:
 * the photo band absorbs the top bleed, the footer absorbs the bottom,
 * and the horizontal paddings each gain 3mm. Net effect: identical
 * artwork, 3mm of overhang around it.
 *
 * PDF rather than PNG because the headline, the body copy and the QR are
 * all vector here — the QR especially, which prints at the press's own
 * resolution instead of being resampled from pixels.
 */
import { chromium } from 'playwright';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import { readFile, writeFile, unlink, stat } from 'node:fs/promises';

const SRC = 'marketing/flyer-expand-your-horizons-a4.html';
const OUT = 'marketing/flyer-expand-your-horizons-a4-print.pdf';
// Written beside the original so horizon.png and ../brand/logo-mark.png
// still resolve; a temp dir elsewhere would silently lose both.
const TMP = 'marketing/.flyer-bleed.tmp.html';

// 3mm is the standard every shop accepts. Asking for 3.2 because Chromium
// writes the sheet a fraction under what is requested, and a preflight that
// measures 2.95mm can reject a file specified as 3mm. The extra 0.2mm is
// cut off and thrown away either way.
const BLEED = 3.2;

const OVERRIDES = `
<style id="bleed-overrides">
  /* The page size MUST come from CSS with preferCSSPageSize below. Setting
     it through Playwright's width/height instead lets Chromium quietly
     apply a ~3mm print margin even when every margin is explicitly 0 —
     which inset the artwork by exactly the bleed and filled the bleed area
     with white, i.e. it produced a file that looked like it had bleed and
     had none. Verified by measuring where ink starts in the output. */
  @page{ size:${210 + BLEED * 2}mm ${297 + BLEED * 2}mm; margin:0; }
  /* Page grows by 2x bleed in each axis. */
  .page{ width:${210 + BLEED * 2}mm !important; height:${297 + BLEED * 2}mm !important; }

  /* Top bleed lives in the photo band, bottom bleed in the footer, so the
     flexible middle keeps exactly the height it had and nothing between
     them moves relative to the trim. */
  .photo{ height:${104 + BLEED}mm !important; }
  .headline{ top:${13 + BLEED}mm !important; }
  .foot{ padding:8mm ${16 + BLEED}mm ${8 + BLEED}mm !important; }

  /* Horizontal insets are measured from the page edge, which just moved
     out by 3mm, so each gains 3mm to stay put relative to the cut. */
  .mid{ padding:9mm ${18 + BLEED}mm 0 !important; }

  /* The grain deliberately stops short of the QR so the code stays clean;
     the footer is 3mm taller now, so its stop line follows. */
  .grain{ bottom:${52 + BLEED}mm !important; }

  /* Nothing but the artwork in the file. */
  body{ background:#fff !important; padding:0 !important; gap:0 !important; margin:0 !important; }
  .label{ display:none !important; }
  .page{ box-shadow:none !important; }
</style>
`;

const src = await readFile(SRC, 'utf8');
if (!src.includes('</head>')) throw new Error('no </head> in the flyer to inject into');
await writeFile(TMP, src.replace('</head>', `${OVERRIDES}</head>`), 'utf8');

const browser = await chromium.launch();
try {
  const page = await browser.newPage();
  await page.goto(pathToFileURL(path.resolve(TMP)).href, { waitUntil: 'networkidle', timeout: 120000 });

  // Same two waits as the PNG render, for the same reasons: an early
  // capture gets Georgia instead of Playfair, or an empty photo band.
  await page.evaluate(() => document.fonts.ready);
  await page.waitForFunction(
    () => [...document.images].every((i) => i.complete && i.naturalWidth > 0),
    null, { timeout: 120000 },
  );

  const check = await page.evaluate(() => {
    const r = document.querySelector('.page').getBoundingClientRect();
    const mm = (px) => +(px / (96 / 25.4)).toFixed(2);
    return {
      pageW: mm(r.width), pageH: mm(r.height),
      playfair: document.fonts.check('16px "Playfair Display"'),
      manrope: document.fonts.check('16px Manrope'),
      qrIsVector: !!document.querySelector('.qr svg'),
      images: [...document.images].map((i) => ({
        name: i.currentSrc.split('/').pop().slice(0, 28),
        w: i.naturalWidth, h: i.naturalHeight,
      })),
    };
  });

  if (!check.playfair || !check.manrope) throw new Error('webfonts did not load — refusing to write a print PDF');
  for (const im of check.images) if (!im.w) throw new Error(`image failed: ${im.name}`);

  await page.pdf({
    path: OUT,
    // Size comes from the @page rule above, not from here — see the note
    // beside it. preferCSSPageSize is what makes that rule authoritative.
    preferCSSPageSize: true,
    printBackground: true,
    margin: { top: '0mm', right: '0mm', bottom: '0mm', left: '0mm' },
    pageRanges: '1',
  });

  const { size } = await stat(OUT);
  console.log(`  ✓ ${OUT}  (${(size / 1024 / 1024).toFixed(2)} MB)`);
  console.log(`     page ${check.pageW} x ${check.pageH} mm  = 210x297 trim + ${BLEED}mm bleed all round`);
  console.log(`     fonts embedded: Playfair=${check.playfair} Manrope=${check.manrope} | QR vector: ${check.qrIsVector}`);
  for (const im of check.images) {
    // Effective print resolution of each raster image, which is the one
    // number a print shop will push back on.
    const across = im.name.startsWith('horizon') ? 216 : 0;
    const dpi = across ? Math.round(im.w / (across / 25.4)) : null;
    console.log(`     image ${im.name} ${im.w}x${im.h}${dpi ? `  ~${dpi} dpi at full width` : ''}`);
  }
} finally {
  await browser.close();
  await unlink(TMP).catch(() => {});
}
