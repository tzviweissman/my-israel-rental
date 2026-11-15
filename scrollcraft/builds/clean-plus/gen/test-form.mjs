// A real pass through Build your plan and the home page's board (rule 3g.12), never to the owner's live inbox: the
// /book call and WhatsApp are caught in the browser and checked. From the repo root:
//   node scrollcraft/builds/clean-plus/gen/test-form.mjs [base]
import { createRequire } from 'node:module';
const { chromium } = createRequire(process.cwd() + '/')('playwright');
const base = process.argv[2] || 'http://localhost:4532';
const b = await chromium.launch();
let fails = 0;
const ok = (c, m) => { console.log((c ? 'ok   ' : 'FAIL ') + m); if (!c) fails++; };
const chip = (p, name, val) => p.click(`label.opt:has(input[name=${name}][value="${val}"])`);

// the board: a day tap moves every visit; every two weeks lifts two; a toggle adds its line; the link carries the plan
{
  const ctx = await b.newContext({ viewport: { width: 1440, height: 900 } });
  const p = await ctx.newPage();
  await p.goto(`${base}/index.html`); await p.waitForTimeout(2600);
  const where = () => p.$$eval('.visit', (vs) => vs.map((v) => v.parentNode.dataset.d));
  ok((await where()).length >= 3 && (await where()).every((d) => d === 'tue'), 'board: weekly visits land on Tuesdays');
  await p.click('.wk:nth-child(3) .day[data-d=thu]'); await p.waitForTimeout(500);
  ok((await where()).every((d) => d === 'thu'), 'board: tapping a Thursday moves every visit to Thursday');
  ok(/Every Thursday, 4 hours, ₪325 a visit/.test(await p.textContent('#sentence')), 'board: the sentence follows the day');
  const n1 = (await where()).length;
  await p.click('.pill[data-often="2weeks"]'); await p.waitForTimeout(500);
  ok((await p.$$('.visit:not(.off)')).length === Math.ceil(n1 / 2), 'board: every two weeks keeps every other visit');
  ok(/price on WhatsApp/.test(await p.textContent('#sentence')), 'board: no price claimed for every two weeks');
  await p.click('.toggle[data-opt=sup]');
  ok(/bring equipment/.test(await p.textContent('#lines')), 'board: the supplies option adds its line');
  const href = await p.getAttribute('#board-go', 'href');
  ok(/often=2weeks/.test(href) && /day=thu/.test(href) && /sup=1/.test(href), `board: the link carries the plan (${href})`);
  await p.click('#board-go'); await p.waitForURL(/book\.html/);
  ok(await p.isChecked('input[name=kind][value=regular]') && await p.isChecked('input[name=often][value="2weeks"]') && await p.isChecked('input[name=extra][value=sup]'), 'plan page: arrives with the board\'s plan chosen');
  await ctx.close();
}

for (const [kind, button, inText] of [['regular', 'Send my plan, ₪325 a visit', '₪325 a visit'], ['deep', 'Send my plan', 'deep clean']]) {
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
  await chip(page, 'extra', 'same');
  await page.click('#send');
  ok(await page.isVisible('#day'), `${kind}: step 2 shown`);
  ok((await page.inputValue('#day')).length === 10, `${kind}: the day arrives filled in`);
  if (kind === 'regular') { await page.click('#send'); ok((await page.textContent('#e-wday')).length > 0, 'regular needs a day of the week'); await chip(page, 'wday', 'wed'); }
  await page.click('#send');
  ok((await page.textContent('#e-where')).length > 0, `${kind}: step 2 needs the neighbourhood`);
  await page.fill('#where', 'Baka');
  const keep = await page.inputValue('#day');
  await page.fill('#day', '2020-01-01'); await page.click('#send');
  ok(/earliest day/.test(await page.textContent('#e-day')), `${kind}: a past day names the first possible one`);
  await page.fill('#day', keep);
  await page.click('#send');
  ok(await page.isVisible('#me'), `${kind}: step 3 shown`);
  await page.click('#send');
  ok((await page.textContent('#e-me')).length > 0, `${kind}: step 3 needs a name`);
  await page.fill('#me', 'Test Person'); await page.fill('#ph', '050-000-0000');
  const para = await page.textContent('#para');
  ok((await page.textContent('#send-l')) === button, `${kind}: the button says "${button}"`);
  await page.click('#send'); await page.waitForTimeout(1500);
  ok(posted && posted.tier_name === 'Weekly cleaning 4 hours' && posted.amount === (kind === 'regular' ? 325 : 0) && posted.preferred_date && posted.guest_name === 'Test Person', `${kind}: saved to /book`);
  ok(posted && posted.message.startsWith(para), `${kind}: the saved message is the plan shown: "${para}"`);
  const t = wa && decodeURIComponent(wa);
  ok(t && t.includes(inText) && t.includes('/track/test') && t.includes('same cleaner'), `${kind}: WhatsApp opened with "${inText}", the added line and the tracking link`);
  ok(wa && wa.includes('972504232291'), `${kind}: WhatsApp goes to the listing's number`);
  ok(/Sent/.test(await page.textContent('#status')), `${kind}: the status says it was sent`);
  await page.goBack(); ok(await page.isVisible('.ostep[data-s="2"]'), `${kind}: browser back goes back one step`);
  await ctx.close();
}
await b.close();
console.log(fails ? `${fails} failed` : 'plan form and board: all passed');
process.exit(fails ? 1 : 0);
