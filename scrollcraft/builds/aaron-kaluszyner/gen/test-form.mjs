// A real pass through the booking form (rule 3g.12), never to his live inbox: the /book call and WhatsApp are
// caught in the browser and checked. node scrollcraft/builds/aaron-kaluszyner/gen/test-form.mjs [base]
import { chromium } from 'playwright';
const base = process.argv[2] || 'http://127.0.0.1:8994/aaron-kaluszyner';
const b = await chromium.launch();
let fails = 0;
const ok = (c, m) => { console.log((c ? 'ok   ' : 'FAIL ') + m); if (!c) fails++; };
for (const [svc, tier, price] of [['kumzits', 'Kumzits', '1,200'], ['lesson', 'Music Lessons', '100']]) {
  const ctx = await b.newContext({ viewport: { width: 1280, height: 800 } });
  const page = await ctx.newPage();
  let posted = null, wa = null;
  await ctx.route('**/marketplace/gigs/*/taken-slots', (r) => r.fulfill({ json: {} }));
  await ctx.route('**/marketplace/gigs/*/book', (r) => { posted = { url: r.request().url(), body: JSON.parse(r.request().postData()) }; r.fulfill({ json: { track_path: '/track/test' } }); });
  ctx.on('page', async (p) => { p.on('framenavigated', (f) => { if (/wa\.me/.test(f.url())) wa = f.url(); }); });
  await ctx.route('https://wa.me/**', (r) => { wa = r.request().url(); r.fulfill({ body: 'wa' }); });
  await page.goto(`${base}/book.html`);
  await page.click('#send'); ok(await page.textContent('#e-svc') !== '', `${svc}: empty step 1 shows what is missing`);
  await page.click(`label.svc:has(input[value=${svc}])`);
  if (svc === 'kumzits') { await page.click('#send'); ok((await page.textContent('#e-occ')).length > 0, 'kumzits needs an occasion'); await page.click('label.chip:has(input[value="Chuppah"])'); }
  await page.click('#send');
  ok(await page.isVisible('#day'), `${svc}: step 2 shown`);
  await page.click('#send'); ok((await page.textContent('#e-time')).length > 0, `${svc}: step 2 needs a time`);
  await page.click('#times label.chip:nth-child(3)');
  if (svc === 'kumzits') await page.fill('#place', 'Ramot');
  await page.click('#send');
  await page.click('#send'); ok((await page.textContent('#e-me')).length > 0, `${svc}: step 3 needs a name`);
  await page.fill('#me', 'Test Person'); await page.fill('#ph', '050-000-0000');
  const sum = await page.textContent('#sum-p');
  ok((await page.textContent('#send-l')).includes(price), `${svc}: the send button carries ₪${price}`);
  await page.click('#send');
  await page.waitForTimeout(1500);
  ok(posted && posted.body.tier_name === tier && posted.body.time_slot && posted.body.preferred_date && posted.body.guest_name === 'Test Person', `${svc}: saved to /book with tier "${tier}" (${posted && posted.url.split('/gigs/')[1]})`);
  ok(posted && posted.body.message === sum, `${svc}: the saved message is the summary shown: "${sum}"`);
  ok(wa && decodeURIComponent(wa).includes(price) && decodeURIComponent(wa).includes('/track/test'), `${svc}: WhatsApp opened with the price and the tracking link`);
  ok(/Sent/.test(await page.textContent('#status')), `${svc}: the status says it was sent`);
  await ctx.close();
}
await b.close();
console.log(fails ? `${fails} failed` : 'booking form: all passed');
process.exit(fails ? 1 : 0);
