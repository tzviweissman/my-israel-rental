#!/usr/bin/env node
/**
 * Free-delivery codes on screen (Tzvi, 22 Nov 2026; backend routes/marketplace/discounts.py, orders.py): the owner
 * picks "Free delivery" in Discount codes (laptop, phone, Hebrew) and a customer's order page drops the delivery fee
 * with the code, and says to choose delivery on a pickup. Makes its own TEST_ business as the dev owner.
 *
 *   node scripts/check-free-delivery.mjs [--api http://localhost:8001/api] [--app http://localhost:3210]
 *   with a copy's own servers: node scripts/dev-worktree.mjs, then pass the ports it prints
 *
 * Needs DEV_AUTOLOGIN=1 on that API. Exit 1 when a check fails.
 */
import { chromium, devices } from 'playwright';
const arg = (n, d) => { const i = process.argv.indexOf(n); return i > 0 ? process.argv[i + 1] : d; };
const API = arg('--api', 'http://localhost:8001/api'), APP = arg('--app', 'http://localhost:3210'), OUT = process.env.OUT || null;
const fails = []; const ok = (c, m) => { console.log((c ? 'PASS ' : 'FAIL ') + m); if (!c) fails.push(m); };
const j = async (r) => { const t = await r.text(); try { return JSON.parse(t); } catch { return t; } };
  const { token } = await (await fetch(`${API}/auth/dev-login?role=owner`)).json();
  const H = { 'content-type': 'application/json', Authorization: `Bearer ${token}` };
  const stamp = Date.now().toString().slice(-6);
  await fetch(`${API}/marketplace/businesses`, { method: 'POST', headers: H, body: JSON.stringify({ name: `TEST_free ${stamp}` }) });
  const g = await j(await fetch(`${API}/marketplace/gigs`, { method: 'POST', headers: H, body: JSON.stringify({
    title: `TEST_free bagels ${stamp}`, description: 'free delivery check', category: 'shops-products', area: 'Jerusalem', gig_type: 'store',
    budget_currency: 'ILS', booking_mode: 'whatsapp', whatsapp: '+972501234567', gallery: [],
    products: [{ name: 'Bagel dozen', price: 60, currency: 'ILS', images: ['https://example.com/b.jpg'] }] }) }));
  const form = await j(await fetch(`${API}/marketplace/order-form/${g.id}`));
  const biz = form.business.id, prod = form.products[0].id;
  await fetch(`${API}/marketplace/businesses/${biz}`, { method: 'PATCH', headers: H, body: JSON.stringify({ serves_nationwide: true }) });
  await fetch(`${API}/marketplace/businesses/${biz}/orders/settings`, { method: 'PUT', headers: H, body: JSON.stringify({ delivery_on: true, delivery_fee: 25 }) });
  const c = await j(await fetch(`${API}/marketplace/businesses/${biz}/discount-codes`, { method: 'POST', headers: H, body: JSON.stringify({ code: `SHIP${stamp}`, kind: 'free_delivery', show_on_page: true, min_order: 50 }) }));
  ok(c.kind === 'free_delivery', 'code made through the API');

  const b = await chromium.launch();
  // the owner's form
  for (const [name, opts, lng] of [['laptop', { viewport: { width: 1280, height: 900 } }, 'en'], ['phone', devices['iPhone 13'], 'en'], ['phone-he', devices['iPhone 13'], 'he']]) {
    const ctx = await b.newContext(opts); await ctx.addInitScript((t) => sessionStorage.setItem('token', t), token);
    const p = await ctx.newPage();
    await p.goto(`${APP}/dashboard?tab=discounts&lng=${lng}`); await p.waitForTimeout(4000);
    if (!(await p.locator('[data-testid="code-new"]').count())) await p.locator('[data-testid="codes-open"]').first().click();
    await p.waitForTimeout(500);
    await p.locator('[data-testid="code-new"]').first().click(); await p.waitForTimeout(400);
    await p.selectOption('[data-testid="code-kind"]', 'free_delivery'); await p.waitForTimeout(300);
    const valueGone = (await p.locator('[data-testid="code-value"]').count()) === 0;
    ok(valueGone, `${name}: "Free delivery" hides the amount box`);
    const over = await p.evaluate(() => document.documentElement.scrollWidth <= innerWidth);
    ok(over, `${name}: no sideways scroll`);
    if (OUT) await p.locator('[data-testid="code-form"]').first().screenshot({ path: `${OUT}/fd-form-${name}.png` });
    const rowText = await p.locator('[data-testid="code-row"]').allInnerTexts();
    ok(rowText.some((x) => x.includes(`SHIP${stamp}`) && /Free delivery|משלוח חינם/.test(x)), `${name}: the list says Free delivery`);
    await ctx.close();
  }
  // the customer's order page
  for (const [name, opts] of [['phone', devices['iPhone 13']], ['laptop', { viewport: { width: 1280, height: 900 } }]]) {
    const p = await (await b.newContext(opts)).newPage();
    await p.goto(`${APP}/order/${g.id}`); await p.waitForTimeout(3500);
    const bar = await p.locator('[data-testid="free-delivery-bar"]').innerText().catch(() => '');
    ok(bar.includes(`SHIP${stamp}`) && /50/.test(bar), `${name}: order page bar "${bar.replace(/\s+/g, ' ').trim()}"`);
    ok(await p.evaluate(() => document.documentElement.scrollWidth <= innerWidth), `${name}: order page has no sideways scroll`);
    if (OUT) await p.locator('[data-testid="free-delivery-bar"]').screenshot({ path: `${OUT}/fd-bar-${name}.png` });
    await p.locator(`[data-testid^="order-add-"]`).first().click();
    await p.locator('[data-testid="order-fulfilment-delivery"]').click(); await p.waitForTimeout(300);
    const before = await p.locator('[data-testid="order-total"]').innerText();
    await p.locator('[data-testid="discount-open"]').click();
    await p.fill('[data-testid="discount-code"]', `ship${stamp}`); await p.locator('[data-testid="discount-apply"]').click(); await p.waitForTimeout(1500);
    const after = await p.locator('[data-testid="order-total"]').innerText();
    ok(/85/.test(before) && /60/.test(after), `${name}: total ${before.trim()} becomes ${after.trim()}`);
    ok(await p.locator('[data-testid="order-free-delivery-code"]').count() === 1, `${name}: "Delivery: Free with the code" line`);
    if (OUT) await p.locator('[data-testid="order-summary"]').screenshot({ path: `${OUT}/fd-order-${name}.png` });
    await p.locator('[data-testid="order-fulfilment-pickup"]').click(); await p.waitForTimeout(300);
    ok(await p.locator('[data-testid="order-free-delivery-pickup"]').count() === 1, `${name}: pickup says to choose delivery`);
    await p.context().close();
  }
  // the store's listing page shows the bar too; a code not set to show is not advertised
  for (const [name, opts] of [['phone', devices['iPhone 13']], ['laptop', { viewport: { width: 1280, height: 900 } }]]) {
    const p = await (await b.newContext(opts)).newPage();
    await p.goto(`${APP}/businesses/${g.id}`); await p.waitForTimeout(4000);
    ok(await p.locator('[data-testid="free-delivery-bar"]').count() === 1, `${name}: listing page shows the bar`);
    if (OUT) await p.screenshot({ path: `${OUT}/fd-listing-${name}.png` });
    await p.context().close();
  }
  await fetch(`${API}/marketplace/businesses/${biz}/discount-codes/${c.id}`, { method: 'PUT', headers: H, body: JSON.stringify({ code: `SHIP${stamp}`, kind: 'free_delivery', show_on_page: false }) });
  const hidden = await j(await fetch(`${API}/marketplace/gigs/${g.id}/promo`));
  ok(hidden.promo === null, 'a code not set to show is not advertised');
  await b.close();
  console.log(fails.length ? `${fails.length} FAILED` : 'ALL PASS'); process.exit(fails.length ? 1 : 0);
