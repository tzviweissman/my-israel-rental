// A real pass through the request form (rule 3g.12), never to his live inbox: the /book call and WhatsApp are
// caught in the browser and checked. From the repo root: node scrollcraft/builds/rbs-cleaning/gen/test-form.mjs [base]
import { createRequire } from 'node:module';
const { chromium } = createRequire(process.cwd() + '/')('playwright');
const base = process.argv[2] || 'http://localhost:8993/rbs-cleaning';
const b = await chromium.launch();
let fails = 0;
const ok = (c, m) => { console.log((c ? 'ok   ' : 'FAIL ') + m); if (!c) fails++; };
const chip = (p, name, val) => p.click(`label.opt:has(input[name=${name}][value="${val}"])`);
for (const [kind, button, inText] of [['basic', 'Send the request, ₪400', '₪400'], ['regular', 'Send for a free quote', 'free quote']]) {
  const ctx = await b.newContext({ viewport: { width: 1280, height: 800 } });
  const page = await ctx.newPage();
  let posted = null, wa = null;
  await ctx.route('**/marketplace/gigs/*/book', (r) => { posted = JSON.parse(r.request().postData()); r.fulfill({ json: { track_path: '/track/test' } }); });
  await ctx.route('https://wa.me/**', (r) => { wa = r.request().url(); r.fulfill({ body: 'wa' }); });
  await page.goto(`${base}/book.html`);
  await page.click('#send');
  ok((await page.textContent('#e-kind')).length > 0, `${kind}: empty step 1 shows what is missing`);
  ok(await page.isVisible('.ostep[data-s="1"]'), `${kind}: stays on step 1`);
  await chip(page, 'kind', kind);
  if (kind === 'regular') { await page.click('#send'); ok((await page.textContent('#e-often')).length > 0, 'regular needs how often'); await chip(page, 'often', 'biweekly'); }
  await chip(page, 'rooms', '4');
  await page.click('#send');
  ok(await page.isVisible('#day'), `${kind}: step 2 shown`);
  ok((await page.inputValue('#day')).length === 10, `${kind}: the day arrives filled in`);
  await page.click('#send');
  ok((await page.textContent('#e-where')).length > 0, `${kind}: step 2 needs where`);
  await chip(page, 'where', 'Beit Shemesh');
  await page.fill('#day', '2020-01-01'); await page.click('#send');
  ok(/earliest day/.test(await page.textContent('#e-day')), `${kind}: a past day names the first possible one`);
  await page.fill('#day', await page.getAttribute('#day', 'min'));
  await page.click('#send');
  ok(await page.isVisible('#me'), `${kind}: step 3 shown`);
  await page.click('#send');
  ok((await page.textContent('#e-me')).length > 0, `${kind}: step 3 needs a name`);
  await page.fill('#me', 'Test Person'); await page.fill('#ph', '050-000-0000');
  const para = await page.textContent('#para');
  ok((await page.textContent('#send-l')) === button, `${kind}: the button says "${button}"`);
  await page.click('#send'); await page.waitForTimeout(1500);
  ok(posted && posted.tier_name === (kind === 'basic' ? 'Basic home clean' : 'Free quote') && posted.preferred_date && posted.guest_name === 'Test Person', `${kind}: saved to /book`);
  ok(posted && posted.message === para, `${kind}: the saved message is the sentence shown: "${para}"`);
  ok(wa && decodeURIComponent(wa).includes(inText) && decodeURIComponent(wa).includes('/track/test'), `${kind}: WhatsApp opened with "${inText}" and the tracking link`);
  ok(wa && wa.includes('972535269002'), `${kind}: WhatsApp goes to his number`);
  ok(/Sent/.test(await page.textContent('#status')), `${kind}: the status says it was sent`);
  await page.goBack(); ok(await page.isVisible('.ostep[data-s="2"]'), `${kind}: browser back goes back one step`);
  await ctx.close();
}
await b.close();
console.log(fails ? `${fails} failed` : 'request form: all passed');
process.exit(fails ? 1 : 0);
