// A pass through the shop and order (rule 3g.12), never to their live inbox: the order POST and WhatsApp are caught in the
// browser and checked. From the repo root: node scrollcraft/builds/mn-jewelry/gen/test-form.mjs [base]
import { createRequire } from 'node:module';
const { chromium } = createRequire(process.cwd() + '/')('playwright');
const base = process.argv[2] || 'http://127.0.0.1:8732/mn-jewelry';
const b = await chromium.launch();
let fails = 0;
const ok = (c, m) => { console.log((c ? 'ok   ' : 'FAIL ') + m); if (!c) fails++; };
const ctx = await b.newContext({ viewport: { width: 1280, height: 800 } });
const page = await ctx.newPage();
page.on('pageerror', (e) => ok(false, 'script error ' + e.message));
let posted = null, wa = null;
await ctx.route('**/marketplace/order-form/*/orders', (r) => {
  if (r.request().method() === 'OPTIONS') return r.fulfill({ status: 204, headers: { 'access-control-allow-origin': '*', 'access-control-allow-headers': '*' } });
  posted = { url: r.request().url(), body: JSON.parse(r.request().postData()) };
  return r.fulfill({ json: { track_url: 'https://myisraelrental.com/track/test' }, headers: { 'access-control-allow-origin': '*' } });
});
await ctx.route('https://wa.me/**', (r) => { wa = r.request().url(); r.fulfill({ body: 'wa' }); });
await page.goto(`${base}/shop.html`);
ok((await page.textContent('#st-name')) === 'Twist solitaire', 'the shop opens on the twist solitaire');
ok(await page.isChecked('input[name="size"][value="help"]'), 'ring size arrives on Help me with sizing');
await page.click('label.opt:has(input[value="know"])');
await page.click('#st-add'); ok((await page.textContent('#e-ring')).length > 0, 'I know my size with no size says what is missing');
await page.fill('#ring', '6'); await page.click('#st-add');
ok((await page.textContent('#sum-list')).includes('Twist solitaire (White gold, natural diamonds, ring size 6)'), 'the basket line names the ring, its gold, diamonds and size');
// the tennis bracelet: tap it in the list; no ring size; yellow gold shows its own picture
await page.click('.pick[data-p="tennis"]'); await page.waitForTimeout(1000);
ok(!(await page.isVisible('#c-size')), 'the bracelet shows no ring size');
await page.click('label.opt:has(input[value="yellow"])'); await page.waitForTimeout(1300);
ok((await page.getAttribute('#st-ph img.on', 'src')).includes('p17-st-yellow'), 'the bracelet shows in yellow gold on the stage');
await page.click('#st-add');
ok((await page.textContent('#total')) === 'From $4,000', 'the total is From $4,000');
// the steps
await page.click('#send'); ok(await page.isVisible('#when'), 'step 2 shown');
ok((await page.inputValue('#when')).length === 10, 'the day arrives filled in');
await page.fill('#note', 'Afternoon please');
await page.click('#send'); ok(await page.isVisible('#me'), 'step 3 shown');
await page.click('#send'); ok((await page.textContent('#e-me')).length > 0, 'step 3 needs a name');
await page.fill('#me', 'Test Person'); await page.fill('#ph', '050-000-0000');
ok((await page.textContent('#send')).includes('$4,000'), 'the send button carries $4,000');
await page.click('#send'); await page.waitForTimeout(1500);
const ids = posted && posted.body.lines.map((l) => l.product_id).sort().join(',');
ok(posted && posted.url.includes('437e8b9b-e536-418a-9e20-19bf6768fa92') && ids === '2a0f5884ad9e,80e61c425af4' && posted.body.customer_name === 'Test Person', 'saved to their order form with their two product ids and the name');
ok(posted && /ring size 6/.test(posted.body.notes) && /Tennis bracelet/.test(posted.body.notes), 'the saved notes carry the ring size and the bracelet');
const text = wa && decodeURIComponent(wa);
ok(wa && wa.includes('15167904616') && text.includes('From $4,000') && text.includes('/track/test') && text.includes('Afternoon please'), 'WhatsApp opened to their number with the total, the note and the tracking link');
ok(/Thank you, Test/.test(await page.textContent('#sent')), 'the page says it is open in WhatsApp');
console.log('history', await page.evaluate(() => history.length + ' ' + location.hash)); await page.evaluate(() => history.back()); await page.waitForTimeout(600); ok(await page.isVisible('#when'), 'browser back goes back one step (' + page.url().split('/').pop() + ')');
// the basket is kept between pages
const p2 = await ctx.newPage(); await p2.goto(`${base}/index.html`);
ok((await p2.textContent('#count')) === '2', 'the home page counts 2 in the basket');
// the gold choice: yellow gold changes the picture and the summary, and reaches the basket
{
  const c = await b.newContext({ viewport: { width: 1280, height: 800 } }); const p3 = await c.newPage();
  await p3.goto(`${base}/shop.html`); await p3.waitForTimeout(1500);
  await p3.click('label.opt:has(input[value="yellow"])'); await p3.waitForTimeout(1300);
  ok(/yellow gold/.test(await p3.textContent('#st-sum')), 'the summary says yellow gold');
  ok((await p3.getAttribute('#st-ph img.on', 'src')).includes('-st-yellow'), 'the stage shows the piece in yellow gold');
  await p3.click('#st-add');
  ok((await p3.textContent('#sum-list')).includes('Yellow gold'), 'the basket line carries the gold');
  ok((await p3.textContent('#total')) === 'From $2,000', 'its total reads From $2,000');
  await c.close();
}
await b.close();
console.log(fails ? `${fails} failed` : 'all passed');
process.exit(fails ? 1 : 0);
