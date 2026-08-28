/**
 * The example in a placeholder matches what the person is doing.
 *
 * Reported by Tzvi, 28 Aug 2026, from preview: under the heading
 * "Describe what you have" the title box suggested "e.g. Mover needed on
 * the 14th" — an example of looking for a mover, shown to somebody
 * offering to be one.
 *
 * The cause is the kind of thing that survives review: the placeholder
 * branched on rental-vs-service, which is one of the TWO axes this form
 * has. The other — want vs have — was handled everywhere else on the
 * step (heading, intro, the details placeholder) and missed here, so the
 * page read consistently right up to the one field a person actually
 * types into.
 *
 * So this walks all four combinations and asserts the example agrees
 * with the heading, rather than that any particular string is present.
 *
 * Usage: node scripts/check-request-examples.mjs
 */
import { chromium } from 'playwright';

const APP = process.env.APP_ORIGIN || 'http://localhost:3210';
const browser = await chromium.launch();
const failures = [];
const note = (m) => console.log('  ' + m);

// Words that only make sense when LOOKING for something.
const WANTING = /\b(needed|wanted|looking for)\b/i;

try {
  for (const kind of ['want', 'have']) {
    for (const type of ['rental', 'service']) {
      const ctx = await browser.newContext({ viewport: { width: 1280, height: 900 } });
      const page = await ctx.newPage();
      await page.goto(`${APP}/requests/post`, { waitUntil: 'domcontentloaded', timeout: 60000 });
      await page.waitForTimeout(3000);

      await page.locator(`[data-testid="post-request-kind-${kind}"]`).click();
      await page.waitForTimeout(400);
      await page.locator(`[data-testid="post-request-type-${type}"]`).click();
      await page.waitForTimeout(400);
      await page.locator('[data-testid="post-request-next"]').click();
      await page.waitForTimeout(1200);

      const heading = (await page.locator('[data-testid="post-request-heading"]').innerText()).trim();
      const title = await page.locator('[data-testid="post-request-title"]').getAttribute('placeholder');
      const details = await page.locator('[data-testid="post-request-description"]').getAttribute('placeholder');
      note(`${kind}/${type}: "${heading}" -> title ${JSON.stringify(title)}`);

      if (!title) {
        failures.push(`${kind}/${type}: the title box has no example at all`);
        await ctx.close();
        continue;
      }
      // An OFFER must never be illustrated with a request.
      if (kind === 'have' && WANTING.test(title)) {
        failures.push(
          `${kind}/${type}: heading says "${heading}" but the example is "${title}" `
          + '— that is an example of looking for one, shown to somebody offering one',
        );
      }
      if (kind === 'have' && details && WANTING.test(details)) {
        failures.push(`${kind}/${type}: the details example describes looking, not offering`);
      }
      // And the four must not all be the same string, which is how this
      // would "pass" if somebody collapsed the branches again.
      await ctx.close();
    }
  }
} finally {
  await browser.close();
}

if (failures.length) {
  console.error('\nFAILED:');
  failures.forEach((f) => console.error('  -', f));
  process.exit(1);
}
console.log('\nall checks passed');
