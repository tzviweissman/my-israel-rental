#!/usr/bin/env node
/**
 * The order a site sends is the order the dashboard saves (Tzvi, 12 Nov 2026: "these issues shouldnt happen in the
 * first place how do we prevent this?", after an audit found sites whose orders were refused or saved with another
 * total: delivery offered while switched off, no delivery area, mixed currencies, a fee the page left out, prices only
 * in the page, picks only typed in the notes).
 *
 * In a phone browser it fills the site's order or booking form and presses its send button: once as it opens, then
 * once for each other choice of every <select>, every pick button (aria-pressed) and every +/- stepper, one change at a
 * time. Each order the page sends is caught before it leaves, sent to the live server as a practice order
 * (?dry_run=true: every check runs, nothing is saved, nobody is told) and answered to the page as saved.
 * It fails when:
 *   - the server would refuse the order (it says why)
 *   - the page shows a total (the element marked data-order-total) other than the total the server would save
 *   - the page has no data-order-total, so what the customer was shown cannot be compared
 *   - a booking's price differs from the listing's price for that service, or names a service the listing lacks
 *   - an order refused by the server leaves no message on the page (one more press, answered with a refusal)
 *   - a choice changes nothing in an order but its typed notes (the dashboard gets words, not a pick or its price);
 *     a booking has no field for a free pick, so there its message is right
 *   - the form could not be sent at all (no send button found, or nothing was sent)
 *
 *   node scripts/check-order-data.mjs <order or booking page urls>        exit 1 when it fails
 *   ORDER_API=http://localhost:8001/api node scripts/check-order-data.mjs ...   practice orders to another server
 *
 * ponytail: one change at a time, not every combination; a pick that only breaks together with another is not seen.
 */
import { chromium } from 'playwright';

const API = (process.env.ORDER_API || 'https://www.myisraelrental.com/api').replace(/\/$/, '');
let urls = process.argv.slice(2);
const ALL = urls[0] === '--all';
// --all: every live designed site's pages that send an order or a booking (the nightly run)
if (ALL) {
  const fs = await import('node:fs'), path = await import('node:path');
  const PAGES = path.resolve(import.meta.dirname, '..', 'frontend', 'public', 'pages');
  const SITE = (process.env.SITE || 'https://www.myisraelrental.com').replace(/\/$/, '');
  urls = [];
  for (const slug of fs.readdirSync(PAGES)) {
    const dir = path.join(PAGES, slug);
    if (!fs.statSync(dir).isDirectory()) continue;
    for (const f of fs.readdirSync(dir).filter((n) => n.endsWith('.html'))) {
      const html = fs.readFileSync(path.join(dir, f), 'utf8') + (fs.existsSync(path.join(dir, 'shop.js')) && f !== 'index.html' ? fs.readFileSync(path.join(dir, 'shop.js'), 'utf8') : '');
      if (/order-form\/'?\s*\+|order-form\/[^'"]+\/orders|\/book['"`]/.test(html)) urls.push(`${SITE}/business/${slug}${f === 'index.html' ? '' : '/' + f.replace(/\.html$/, '')}`);
    }
  }
}
if (!urls.length) { console.error('usage: check-order-data.mjs <page urls> | --all'); process.exit(2); }
const SEND_RE = /\/(marketplace\/order-form\/[^/]+\/orders|gigs\/[^/]+\/book|gigs\/[^/]+\/quote-requests)(\?|$)/;
const problems = [];
const browser = await chromium.launch();
const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true });

async function practice(path, body) {
  const r = await fetch(`${API}/${path}?dry_run=true`, { method: 'POST', headers: { 'content-type': 'application/json' }, body });
  let j = null; try { j = await r.json(); } catch {}
  return { ok: r.ok, status: r.status, body: j };
}
const money = (s) => { const m = String(s || '').replace(/,/g, '').match(/(\d+(?:\.\d+)?)(?!.*\d)/); return m ? Number(m[1]) : null; };

// The page: filled in, ready to send. Returns how to press send, or null.
async function fill(p) {
  return p.evaluate(() => {
    const vis = (e) => { const r = e.getBoundingClientRect(); const s = getComputedStyle(e); return r.width > 0 && r.height > 0 && s.visibility !== 'hidden'; };
    const set = (e, v) => { const d = Object.getOwnPropertyDescriptor(Object.getPrototypeOf(e), 'value'); d.set.call(e, v); e.dispatchEvent(new Event('input', { bubbles: true })); e.dispatchEvent(new Event('change', { bubbles: true })); };
    const tomorrow = new Date(Date.now() + 2 * 864e5).toISOString().slice(0, 10);
    // a basket that opens empty: press its "Add ..." button once, as a customer would (LS Fruit Platter's "Add a Small")
    // or, with no such button, its first "One more ..." (Chicken Munch's boxes)
    if (!window.__practiceAdded) { const bs = [...document.querySelectorAll('button')].filter(vis); const a = bs.find((b) => /^\s*add\b/i.test(b.textContent || '')) || bs.find((b) => /^one more\b/i.test(b.getAttribute('aria-label') || '')); if (a) { a.click(); window.__practiceAdded = 1; } }
    for (const e of document.querySelectorAll('input, textarea')) {
      if (!vis(e) || e.value || e.readOnly || e.disabled) continue;
      const k = `${e.type} ${e.id} ${e.name} ${e.autocomplete} ${e.placeholder}`.toLowerCase();
      if (/checkbox|radio|hidden|submit|button|search/.test(e.type)) continue;
      if (/code|coupon|promo/.test(k)) continue;
      if (e.type === 'tel' || /phone|tel/.test(k)) set(e, '0501234567');
      else if (e.type === 'email' || /email/.test(k)) set(e, 'practice-order@example.com');
      else if (e.type === 'date') set(e, e.min && e.min > tomorrow ? e.min : tomorrow);
      else if (e.type === 'number') set(e, e.min || '1');
      else if (/addr|street/.test(k)) set(e, '1 Practice Street');
      else if (/name/.test(k)) set(e, 'Practice Order');
      else if (/time/.test(k)) set(e, '12:00');
      else if (e.required || e.tagName !== 'TEXTAREA') set(e, 'Practice');
    }
    for (const e of document.querySelectorAll('input[type=checkbox][required]')) if (!e.checked) e.click();
    // a package that says "Choose 6 more jars" (Whipped Cup's Cloud Bundle): press the first "One more" beside it that many times
    for (const m of document.querySelectorAll('p, span, div, output')) {
      const n = vis(m) && m.children.length === 0 && /^\s*choose (\d+) more\b/i.exec(m.textContent || '');
      if (!n) continue;
      let box = m.parentElement; while (box && !box.querySelector('button[aria-label^="One more"]')) box = box.parentElement;
      for (let i = 0; box && i < +n[1]; i++) { const b = [...box.querySelectorAll('button[aria-label^="One more"]')].find((b) => !b.disabled && vis(b)); if (b) b.click(); }
    }
    // a choice nobody has made yet (what would you like, a time, how many rooms): take the first, as a customer would
    for (const s of document.querySelectorAll('select')) if (vis(s) && !s.value) { const o = [...s.options].find((o) => o.value && !o.disabled); if (o) set(s, o.value); }
    const groups = {};
    for (const r of document.querySelectorAll('input[type=radio]')) if (r.name) (groups[r.name] = groups[r.name] || []).push(r);
    // a set of tick boxes where none is ticked (Chicken Munch's kinds of chicken): tick the first; a lone box is left alone
    const sets = new Map();
    for (const c of document.querySelectorAll('input[type=checkbox]')) { const k = c.name || c.parentElement.parentElement; sets.set(k, [...(sets.get(k) || []), c]); }
    for (const cs of sets.values()) if (cs.length > 1 && !cs.some((c) => c.checked)) { const c = cs.find((c) => !c.disabled && vis(c.closest('label') || c)); if (c) (c.closest('label') || c).click(); }
    // a row of choice buttons where none is pressed (The Brown Box's bowl flavour, shown once the bowl is added): press
    // the first; a row that re-draws itself on a press is looked up again each time
    for (let k = 0; k < 8; k++) {
      const row = [...new Set([...document.querySelectorAll('button[aria-pressed="false"]')].map((b) => b.parentElement))].find((r) => vis(r) && !r.querySelector('button[aria-pressed="true"]'));
      const b = row && [...row.querySelectorAll('button[aria-pressed="false"]')].find((b) => !b.disabled && vis(b));
      if (!b) break; b.click();
    }
    for (const rs of Object.values(groups)) {
      if (rs.some((r) => r.checked)) continue;
      const r = rs.find((r) => !r.disabled && vis(r.closest('label') || r));
      if (r) (r.closest('label') || r).click();
    }
    const send = [...document.querySelectorAll('form button[type=submit], form input[type=submit], a#order, #place, #place2, #placeBar, #send, #send2, [data-order-send], button#next, a#go, a#go2')].filter((e) => vis(e) && !/^(text|tel|email|date|time|number|textarea|select-one)$/.test(e.type))[0];   // Hadassah's #place is the venue box
    if (!send) return null;
    // a send that waits for a pick (KasherMyBnB's Continue, until a service is chosen): press the first pick button in a
    // row where none is pressed, as a customer would
    // and when the page asks "Choose a start time", every such row still empty
    const asks = [...document.querySelectorAll('.err, .error, [role=alert], .msg, .bad')].some((e) => vis(e) && /^\s*choose\b/i.test(e.textContent || ''));
    if (send.getAttribute('aria-disabled') === 'true' || send.disabled || asks) {
      const rows = new Set([...document.querySelectorAll('button[aria-pressed="false"]')].filter(vis).map((b) => b.parentElement));
      for (const row of rows) if (!row.querySelector('[aria-pressed="true"]')) { const b = [...row.querySelectorAll('button[aria-pressed="false"]')].find(vis); if (b) b.click(); if (!asks) break; }
    }
    // a booking over several pages (KasherMyBnB: book, book-details, book-review) goes on by its "Continue" link; served
    // from this computer, its /business/<slug>/<page> link is the <page>.html beside it
    if (/^go2?$/.test(send.id) && !location.pathname.startsWith('/business/')) send.setAttribute('href', send.getAttribute('href').replace(/^\/business\/[^/]+\/([^/?#]+)$/, '$1.html'));
    send.setAttribute('data-practice-send', '1');
    return true;
  });
}

let caught = [], refuse = false, closedNow = '';
// Every choice on the form, as steps of one change each.
async function choices(p) {
  return p.evaluate(() => {
    const vis = (e) => { const r = e.getBoundingClientRect(); return r.width > 0 && r.height > 0; };
    const out = [];
    document.querySelectorAll('select').forEach((s, i) => { if (!vis(s)) return; s.setAttribute('data-practice-sel', i); [...s.options].forEach((o, j) => { if (j !== s.selectedIndex && !o.disabled && o.value !== '') out.push({ kind: 'select', i, value: o.value, label: `${s.id || s.name || 'choice'} = ${o.textContent.trim()}` }); }); });
    // at most three picks from one set of radio buttons: a row of twenty start times is the same choice twenty times
    const per = {};
    document.querySelectorAll('button[aria-pressed="false"], [role=radio][aria-checked="false"], input[type=radio]:not(:checked)').forEach((b, i) => { if (!vis(b) && b.type !== 'radio') return; if (b.name && (per[b.name] = (per[b.name] || 0) + 1) > 3) return; b.setAttribute('data-practice-pick', i); out.push({ kind: 'pick', i, label: (b.textContent || b.value || b.getAttribute('aria-label') || '').trim().replace(/\s+/g, ' ').slice(0, 40) }); });
    document.querySelectorAll('button').forEach((b, i) => { const t = (b.textContent || '').trim(), a = b.getAttribute('aria-label') || ''; if (vis(b) && (t === '+' || /more|add one|increase/i.test(a))) { b.setAttribute('data-practice-plus', i); out.push({ kind: 'plus', i, label: `+ ${(b.closest('[role=group],.qty,.of,label') || b.parentElement).getAttribute('aria-label') || a || 'more'}` }); } });
    return out;
  });
}

// Press send; a form in steps ("Continue to when and where", LS Fruit Platter) is filled and pressed again, up to
// three steps, until an order is sent.
async function press(p) {
  for (let k = 0; k < 4; k++) {
    await p.click('[data-practice-send]', { timeout: 3000 }).catch(() => {});
    await p.waitForTimeout(1500);
    if (caught.length) return;
    await p.evaluate(() => document.querySelectorAll('[data-practice-send]').forEach((e) => e.removeAttribute('data-practice-send')));
    if (!(await fill(p))) return;
  }
}

for (const url of urls) {
  const where = url.replace(/^https?:\/\/[^/]+/, '') || '/';
  const p = await ctx.newPage();
  refuse = false;
  // A page served from this computer (a publish) reads its listing from localhost:8001; it is read from the live server
  // instead, so the products are there to order. Anything other than a read is dropped, never sent on.
  await p.route(/^http:\/\/(localhost|127\.0\.0\.1):8001\/api\//, async (route) => {
    if (route.request().method() !== 'GET') return route.abort();
    const r = await fetch(API + route.request().url().replace(/^.*?:8001\/api/, '')).catch(() => null);
    if (!r) return route.abort();
    return route.fulfill({ status: r.status, contentType: r.headers.get('content-type') || 'application/json', body: Buffer.from(await r.arrayBuffer()) });
  });
  await p.route(SEND_RE, async (route) => {
    const path = route.request().url().replace(/^.*?\/api\//, '').replace(/\?.*$/, '');
    const body = route.request().postData() || '{}';
    if (refuse) { caught.push({ refused: true }); return route.fulfill({ status: 400, contentType: 'application/json', body: JSON.stringify({ detail: 'Practice refusal' }) }); }
    // a quote request (Michal Balloons) has no price and the server has no practice mode for it: it is stopped here,
    // never sent, and only its being sent is checked
    const res = /quote-requests$/.test(path) ? { ok: true, status: 200, body: { quote: true, id: 'practice' } } : await practice(path, body);
    caught.push({ path, sent: JSON.parse(body), res });
    await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ id: 'practice', track_url: 'about:blank', track_token: 'practice' }) });
  });
  await p.addInitScript(() => { window.open = (u) => { if (/wa.me|whatsapp/.test(u || "")) window.__practiceWa = 1; return { location: { set href(v) { if (/wa.me|whatsapp/.test(v)) window.__practiceWa = 1; } }, close() {}, document: { write() {} } }; }; });
  let toWa = false;   // a refused order that goes on to WhatsApp is not lost (mir-order.js: a failed save opens WhatsApp)
  await p.route(/wa\.me|api\.whatsapp\.com|whatsapp:\/\//, (r) => { toWa = true; return r.abort(); });
  await p.goto(url, { waitUntil: 'networkidle' }).catch(() => {});
  await p.waitForTimeout(1200);
  // a page that forwards on load (a listing id to its hand-built page) destroys the first read: wait and read again
  const steps = [{ kind: 'as it opens', label: 'as it opens' }, ...(await choices(p).catch(async () => { await p.waitForLoadState('networkidle').catch(() => {}); await p.waitForTimeout(1500); return choices(p); }))];
  let base = null;   // what the page sends as it opens, to see what each choice changes
  // an order that cannot go as it opens (a bowl needs its flavour picked first, The Brown Box) is fine when a choice sends it
  let anySent = false, stopped = "";
  // a choice whose only change to the order is in the typed notes: the dashboard has it as words, not a pick or a price
  const strip = (b) => { const { notes, extra_items, message, guest_name, contact_email, contact_phone, customer_name, customer_phone, customer_email, date, ...rest } = b || {}; return JSON.stringify(rest); };

  // the page fresh, with one choice made
  const open = async (step) => {
    await p.goto(url, { waitUntil: 'networkidle' }).catch(() => {});
    await p.waitForTimeout(800);
    if (step.kind !== 'as it opens') {
      await choices(p);
      const sel = step.kind === 'select' ? `[data-practice-sel="${step.i}"]` : step.kind === 'pick' ? `[data-practice-pick="${step.i}"]` : `[data-practice-plus="${step.i}"]`;
      if (step.kind === 'select') await p.selectOption(sel, step.value).catch(() => {});
      else await p.click(sel, { timeout: 3000 }).catch(() => {});
      await p.waitForTimeout(300);
    }
  };
  let okStep = null;   // the first way an order went through, used again for the refusal
  for (const step of steps) {
    if (step.kind !== 'as it opens') await open(step);
    if (!(await fill(p))) { if (step.kind !== 'as it opens') problems.push(`${where}: no send button found, so no order could be tried (mark it data-order-send)`); else console.log(`${where}: no order form on this page`); break; }
    // a basket in two currencies is two orders with a total each (Chicken Munch): each order is matched to its own currency's
    const totalsShown = await p.evaluate(() => [...document.querySelectorAll('[data-order-total]')].map((e) => ({ cur: e.getAttribute('data-currency'), v: e.getAttribute('data-order-total') || e.textContent })));
    const shownFor = (cur) => ((totalsShown.find((t) => t.cur && t.cur === cur) || totalsShown[0]) || {}).v ?? null;
    caught = [];
    await press(p);
    if (!caught.length) {
      // what the page says stopped it: the visible messages next to fields, so the cause is in the report
      const said = await p.evaluate(() => [...document.querySelectorAll('.msg, .err, .error, [role=alert], .bad, .mir-err')].filter((e) => e.offsetParent && e.textContent.trim()).map((e) => e.textContent.trim().replace(/\s+/g, ' ').slice(0, 60)).slice(0, 3).join(' | '));
      if (step.kind === 'as it opens') stopped = (`${where}: pressing send sent no order to the dashboard (a check on the page stopped it, or the page only opens WhatsApp)${said ? `; the page says: ${said}` : ''}`);
      continue;
    }
    anySent = true; okStep = okStep || step;
    for (const c of caught) {
      const r = c.res, say = `${where} [${step.label}]`;
      if (step.kind === 'as it opens') base = c.sent;
      // a booking has no field for a free pick (Elisheva's nail colour): its message is where it belongs
      else if (base && step.kind !== 'plus' && !/\/book$/.test(c.path || '') && strip(c.sent) === strip(base) && (c.sent.notes !== base.notes || c.sent.extra_items !== base.extra_items || c.sent.message !== base.message))
        problems.push(`${say}: this choice reaches the dashboard only as typed notes (make it a product, an option or a service on the listing)`);
      // Shabbat and holidays the server takes no orders at all: that is the hour, not the page (14 Nov 2026, a Saturday)
      if (!r.ok && /Closed for .*Orders open again/i.test(JSON.stringify(r.body && r.body.detail || ''))) { closedNow = closedNow || `${where}: not tested, the server takes no orders now (${r.body.detail}); run this again after`; continue; }
      if (!r.ok) { problems.push(`${say}: the dashboard would refuse it: ${r.body && r.body.detail ? JSON.stringify(r.body.detail) : r.status}`); continue; }
      if (r.body.quote) continue;
      if (r.body.tier_name !== undefined) {   // a booking
        if (!r.body.tier_found) problems.push(`${say}: books "${r.body.tier_name}", a service the listing does not have`);
        // a whole number of the listing's price is hours of an hourly service (Noa Levi, 160 an hour, two hours at least)
        // ponytail: any whole multiple passes, so three hours priced as four would too
        else if (r.body.tier_price != null && r.body.price != null && !(r.body.tier_price > 0 && r.body.price > 0 && Math.abs(r.body.price / r.body.tier_price - Math.round(r.body.price / r.body.tier_price)) < 1e-6)) problems.push(`${say}: saved at ${r.body.price}, the listing's price is ${r.body.tier_price}`);
        continue;
      }
      const shown = shownFor(r.body.currency);
      if (shown == null) problems.push(`${say}: the page has no total marked data-order-total, so what the customer saw cannot be compared (server total ${r.body.total} ${r.body.currency})`);
      else if (money(shown) != null && r.body.total != null && Math.abs(money(shown) - r.body.total) > 0.01) problems.push(`${say}: the page shows ${String(shown).trim()}, the dashboard would save ${r.body.total} ${r.body.currency}`);
    }
  }

  if (!anySent && stopped) problems.push(stopped);

  // a refused order must be told to the customer
  if (okStep) await open(okStep);
  if (okStep && await fill(p)) {
    refuse = true; caught = []; toWa = false;
    const before = await p.evaluate(() => document.body.innerText);
    await press(p);
    const after = await p.evaluate(() => document.body.innerText);
    if (await p.evaluate(() => window.__practiceWa).catch(() => false)) toWa = true;
    const told = toWa || after !== before && /practice refusal|not (go through|saved|sent)|did not|didn.t|try again|went wrong|לא נשמר|נסו שוב/i.test(after);
    if (caught.length && !told) problems.push(`${where}: when the dashboard refuses the order, the page says nothing (the customer thinks it went through)`);
    refuse = false;
  }
  await p.close();
  console.log(`checked ${where}`);
}
await browser.close();
if (closedNow) console.log("note: " + closedNow);
if (problems.length) { console.log(`\nOrders that would not reach the dashboard as the customer saw them (${problems.length}):\n  ` + problems.join('\n  ')); process.exit(1); }
console.log('every practice order would be saved as the customer saw it');
