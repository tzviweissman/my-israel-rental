// Page builder v3: the phone order bar (docs/page-builder-design-rules.md,
// part 6). Hidden while the hero button is on screen, shown once it has
// scrolled away, hidden again over the offer block; the site's WhatsApp tab
// stays clear of it; the Copy button says "Copied".
//   Needs: local API on :8001, dev server on :3210
//   Run:   node scripts/check-page-v3-sticky.mjs [slug]
import { chromium } from 'playwright';

const SLUG = process.argv[2] || 'rp-exp';
const fails = [];
const b = await chromium.launch();
for (const lang of ['en', 'he']) {
  const ctx = await b.newContext({ viewport: { width: 390, height: 844 }, permissions: ['clipboard-read', 'clipboard-write'] });
  const p = await ctx.newPage();
  await p.goto(`http://localhost:3210/business/${SLUG}?lng=${lang}`, { waitUntil: 'networkidle' });
  await p.locator('[data-testid="pv3-hero"]').waitFor();
  const state = async () => p.evaluate(() => {
    const bar = document.querySelector('[data-testid="pv3-sticky"]');
    const r = bar.getBoundingClientRect();
    const wa = document.querySelector('[data-testid="whatsapp-button"]')?.getBoundingClientRect();
    return { on: bar.classList.contains('is-on'), visible: r.top < innerHeight - 2, overlap: !!wa && wa.bottom > r.top && wa.width > 0 };
  });
  const at = async (y) => { await p.evaluate((v) => window.scrollTo(0, v), y); await p.waitForTimeout(450); return state(); };
  const top = await at(0);
  const offerTop = await p.evaluate(() => document.querySelector('[data-testid="pv3-offer"]').getBoundingClientRect().top + scrollY);
  const mid = await at(Math.max(900, offerTop - 1400));
  const offer = await at(offerTop + 100);
  if (top.on) fails.push(`${lang}: bar shown while the hero button is on screen`);
  if (!mid.on || !mid.visible) fails.push(`${lang}: bar not shown after the hero button scrolled away`);
  if (mid.on && mid.overlap) fails.push(`${lang}: the WhatsApp tab overlaps the bar`);
  if (offer.on) fails.push(`${lang}: bar still shown over the offer block`);
  // Centre the Copy button and let the bar finish sliding away first: a click
  // during the slide lands on the bar, not the button.
  await p.evaluate(() => document.querySelector('[data-testid="pv3-copy"]').scrollIntoView({ block: 'center' }));
  await p.waitForTimeout(600);
  await p.locator('[data-testid="pv3-copy"]').click();
  // "Copied" comes after the clipboard promise; a playing hero film is
  // enough to make reading it straight after the click lose the race.
  await p.waitForFunction(() => /Copied|הועתק/.test(document.querySelector('[data-testid="pv3-copy"]').innerText), null, { timeout: 1000 }).catch(() => {});
  const copied = await p.locator('[data-testid="pv3-copy"]').innerText();
  if (!/Copied|הועתק/.test(copied)) fails.push(`${lang}: Copy did not change to Copied (${copied})`);
  await p.waitForTimeout(1700);
  if (/Copied|הועתק/.test(await p.locator('[data-testid="pv3-copy"]').innerText())) fails.push(`${lang}: Copied did not change back`);
  console.log(`${lang}: top ${top.on} | after hero ${mid.on} | over offer ${offer.on} | copy "${copied}"`);
  await ctx.close();
}
await b.close();
console.log(fails.length ? `\nFAILED:\n${fails.join('\n')}` : '\nsticky bar and copy: all passed');
process.exitCode = fails.length ? 1 : 0;
