/**
 * Render the marketing pieces to PNG at print resolution.
 *
 *   node scripts/render-marketing.mjs
 *
 * Both HTML files are previews: they sit on a grey backdrop with a caption
 * above them, so the capture targets the ARTWORK ELEMENT (.page / .ad),
 * never the viewport — otherwise the backdrop and label end up in the file.
 *
 * deviceScaleFactor 2 because the A4 flyer is for print: 210mm at CSS 96dpi
 * is 794px, which would be ~96dpi on paper and visibly soft. At 2x it lands
 * about 192dpi, which holds up at arm's length.
 *
 * The waits are the point. A screenshot taken before the webfonts swap in
 * captures Georgia instead of Playfair, and one taken before the photo
 * decodes captures an empty box — both look plausible and are wrong. So
 * this waits for document.fonts.ready AND for every image to be complete
 * with a non-zero natural size, then fails loudly rather than writing a
 * file that looks finished.
 */
import { chromium } from 'playwright';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import { stat } from 'node:fs/promises';

const JOBS = [
  {
    html: 'marketing/flyer-expand-your-horizons-a4.html',
    out: 'marketing/flyer-expand-your-horizons-a4.png',
    selector: '.page',
    // 2x for PRINT: 210mm at CSS 96dpi is 794px, which is ~96dpi on paper
    // and visibly soft. 2x lands near 192dpi.
    scale: 2,
    // A4 portrait at 96dpi. The viewport only needs to be big enough that
    // the element is laid out unclipped; the capture is the element.
    viewport: { width: 900, height: 1300 },
  },
  {
    html: 'marketing/ad-expand-your-horizons.html',
    out: 'marketing/ad-expand-your-horizons.png',
    selector: '.ad',
    // 1x for SCREEN: 1080x1350 is Instagram/Facebook's native portrait
    // size. Handing them 2160x2700 only invites their recompression, and
    // the design is already authored at the delivery resolution.
    scale: 1,
    viewport: { width: 1200, height: 1500 },
  },
];

const browser = await chromium.launch();

for (const job of JOBS) {
  const page = await browser.newPage({
    viewport: job.viewport,
    deviceScaleFactor: job.scale,
  });

  const failed = [];
  page.on('requestfailed', (r) => failed.push(r.url().slice(-70)));

  await page.goto(pathToFileURL(path.resolve(job.html)).href, {
    waitUntil: 'networkidle',
    timeout: 120000,
  });

  // Webfonts: without this the headline renders in the fallback serif.
  await page.evaluate(() => document.fonts.ready);

  // Images: `complete` alone is true for a failed load too, so naturalWidth
  // is what actually proves pixels arrived.
  await page.waitForFunction(
    () => [...document.images].every((i) => i.complete && i.naturalWidth > 0),
    null,
    { timeout: 120000 },
  ).catch(() => { /* reported below with detail */ });

  const imgs = await page.evaluate(() =>
    [...document.images].map((i) => ({
      src: i.currentSrc.split('/').pop().slice(0, 40),
      ok: i.complete && i.naturalWidth > 0,
      w: i.naturalWidth,
      h: i.naturalHeight,
      broken: i.dataset.broken === '1',
    })));

  const bad = imgs.filter((i) => !i.ok);
  if (bad.length) {
    console.error(`  ✗ ${job.out}: ${bad.length} image(s) did not load —`, bad.map((b) => b.src));
    console.error('    refusing to write a PNG with a missing image.');
    await page.close();
    continue;
  }

  const fontsOk = await page.evaluate(() => ({
    playfair: document.fonts.check('16px "Playfair Display"'),
    manrope: document.fonts.check('16px Manrope'),
  }));

  const el = page.locator(job.selector).first();
  const box = await el.boundingBox();
  await el.screenshot({ path: job.out, scale: 'device' });

  const { size } = await stat(job.out);
  console.log(`  ✓ ${job.out}`);
  console.log(`     element ${Math.round(box.width)}x${Math.round(box.height)} css -> ` +
              `${Math.round(box.width * job.scale)}x${Math.round(box.height * job.scale)} px @${job.scale}x, ${(size / 1024 / 1024).toFixed(2)} MB`);
  console.log(`     fonts: Playfair=${fontsOk.playfair} Manrope=${fontsOk.manrope}` +
              ` | images: ${imgs.map((i) => `${i.w}x${i.h}`).join(', ')}` +
              (failed.length ? ` | failed requests: ${failed.length}` : ''));
  await page.close();
}

await browser.close();
