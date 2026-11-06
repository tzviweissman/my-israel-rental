// A pass through the booking form (rule 3g.12), never to her live inbox: the /book call and WhatsApp are caught in the
// browser and checked. From the repo root: node scrollcraft/builds/hadassah-prys/gen/test-form.mjs [base]
import { createRequire } from 'node:module';
const { chromium } = createRequire(process.cwd() + '/')('playwright');
const base = process.argv[2] || 'http://127.0.0.1:8997/hadassah-prys';
const b = await chromium.launch();
let fails = 0;
const ok = (c, m) => { console.log((c ? 'ok   ' : 'FAIL ') + m); if (!c) fails++; };
const ctx = await b.newContext({ viewport: { width: 1280, height: 800 } });
const page = await ctx.newPage();
page.on('pageerror', (e) => ok(false, 'script error ' + e.message));
let posted = null, wa = null, taken = {};
await ctx.route('**/marketplace/gigs/*/taken-slots', (r) => r.fulfill({ json: taken, headers: { 'access-control-allow-origin': '*' } }));
await ctx.route('**/marketplace/gigs/*/book', (r) => {
  if (r.request().method() === 'OPTIONS') return r.fulfill({ status: 204, headers: { 'access-control-allow-origin': '*', 'access-control-allow-headers': '*' } });
  posted = { url: r.request().url(), body: JSON.parse(r.request().postData()) };
  return r.fulfill({ json: { track_path: '/track/test' }, headers: { 'access-control-allow-origin': '*' } });
});
await ctx.route('https://wa.me/**', (r) => { wa = r.request().url(); r.fulfill({ body: 'wa' }); });
await page.goto(`${base}/book.html`);
const first = await page.inputValue('#day');
ok(new Date(first + 'T12:00').getDay() !== 6, `step 1: the day is already filled with a working day (${first})`);
await page.click('#send'); ok((await page.textContent('#e-time')).length > 0, 'step 1 with no time says Choose a time');
// a Saturday gets one plain line and a button naming the next day
let d = new Date(); do { d.setDate(d.getDate() + 1); } while (d.getDay() !== 6);
const sat = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
await page.fill('#day', sat); await page.dispatchEvent('#day', 'change');
ok(/closed on Shabbat/.test(await page.textContent('#t-hint')), 'a Saturday says she is closed');
await page.click('#nx');
ok(new Date((await page.inputValue('#day')) + 'T12:00').getDay() === 0, 'the button chooses Sunday');
ok((await page.$$('#times input')).length === 10, 'Sunday has ten one-hour times, 9:00 to 18:00');
await page.click('#times label.chip:nth-child(3)');
await page.click('#send');
ok(await page.isVisible('#occ'), 'step 2 shown');
await page.fill('#occ', 'a wedding'); await page.fill('#place', 'Ramot');
await page.click('#send');
ok(await page.isVisible('#me'), 'step 3 shown');
await page.click('#send'); ok((await page.textContent('#e-me')).length > 0, 'step 3 needs a name');
await page.fill('#me', 'Test Person'); await page.fill('#ph', '050-000-0000');
const sum = await page.textContent('#sum-p');
ok((await page.textContent('#send-l')).includes('260'), 'the send button carries ₪260');
await page.click('#send');
await page.waitForTimeout(1500);
ok(posted && posted.url.includes('0b499771-4fd2-4977-bb9b-cb98837d65cc') && posted.body.tier_name === 'Makeup' && posted.body.time_slot === '11:00' && posted.body.preferred_date && posted.body.guest_name === 'Test Person', 'saved to her listing with tier Makeup, the day, the time and the name');
ok(posted && posted.body.message === sum, `the saved message is the summary shown: "${sum}"`);
ok(wa && wa.includes('447712331169') && decodeURIComponent(wa).includes('260') && decodeURIComponent(wa).includes('/track/test'), 'WhatsApp opened to her number with the price and the tracking link');
ok(/Sent/.test(await page.textContent('#status')), 'the status says it was sent');
await page.goBack(); ok(await page.isVisible('#occ'), 'browser back goes back one step');
// a time already booked is crossed out
const p2 = await ctx.newPage();
taken = { [first]: ['09:00'] };
await p2.goto(`${base}/book.html`); await p2.waitForTimeout(500);
ok((await p2.$$eval('#times input:disabled', (x) => x.map((i) => i.value).join(' '))) === '09:00', 'a taken time is crossed out');
await b.close();
console.log(fails ? `${fails} failed` : 'all passed');
process.exit(fails ? 1 : 0);
