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
 *   - a choice changes nothing in the order but its typed notes (the dashboard gets words, not a pick or its price)
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
const SEND_RE = /\/(marketplace\/order-form\/[^/]+\/orders|gigs\/[^/]+\/book)(\?|$)/;
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
    if (!window.__practiceAdded) { const a = [...document.querySelectorAll('button')].find((b) => vis(b) && /^\s*add\b/i.test(b.textContent || '')); if (a) { a.click(); window.__practiceAdded = 1; } }
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
    const send = [...document.querySelectorAll('form button[type=submit], form input[type=submit], a#order, #place, #place2, #placeBar, #send, #send2, [data-order-send]')].filter(vis)[0];
    if (!send) return null;
    send.setAttribute('data-practice-send', '1');
    return true;
  });
}

let caught = [], refuse = false;
// Every choice on the form, as steps of one change each.
async function choices(p) {
  return p.evaluate(() => {
    const vis = (e) => { const r = e.getBoundingClientRect(); return r.width > 0 && r.height > 0; };
    const out = [];
    document.querySelectorAll('select').forEach((s, i) => { if (!vis(s)) return; s.setAttribute('data-practice-sel', i); [...s.options].forEach((o, j) => { if (j !== s.selectedIndex && !o.disabled && o.value !== '') out.push({ kind: 'select', i, value: o.value, label: `${s.id || s.name || 'choice'} = ${o.textContent.trim()}` }); }); });
    document.querySelectorAll('button[aria-pressed="false"], [role=radio][aria-checked="false"], input[type=radio]:not(:checked)').forEach((b, i) => { if (!vis(b) && b.type !== 'radio') return; b.setAttribute('data-practice-pick', i); out.push({ kind: 'pick', i, label: (b.textContent || b.value || b.getAttribute('aria-label') || '').trim().replace(/\s+/g, ' ').slice(0, 40) }); });
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
    const res = await practice(path, body);
    caught.push({ path, sent: JSON.parse(body), res });
    await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ id: 'practice', track_url: 'about:blank', track_token: 'practice' }) });
  });
  await p.addInitScript(() => { window.open = (u) => { if (/wa.me|whatsapp/.test(u || "")) window.__practiceWa = 1; return { location: { set href(v) { if (/wa.me|whatsapp/.test(v)) window.__practiceWa = 1; } }, close() {}, document: { write() {} } }; }; });
  let toWa = false;   // a refused order that goes on to WhatsApp is not lost (mir-order.js: a failed save opens WhatsApp)
  await p.route(/wa\.me|api\.whatsapp\.com|whatsapp:\/\//, (r) => { toWa = true; return r.abort(); });
  await p.goto(url, { waitUntil: 'networkidle' }).catch(() => {});
  await p.waitForTimeout(1200);
  const steps = [{ kind: 'as it opens', label: 'as it opens' }, ...(await choices(p))];
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
    const shown = await p.evaluate(() => { const e = document.querySelector('[data-order-total]'); return e ? (e.getAttribute('data-order-total') || e.textContent) : null; });
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
      else if (base && step.kind !== 'plus' && strip(c.sent) === strip(base) && (c.sent.notes !== base.notes || c.sent.extra_items !== base.extra_items || c.sent.message !== base.message))
        problems.push(`${say}: this choice reaches the dashboard only as typed notes (make it a product, an option or a service on the listing)`);
      if (!r.ok) { problems.push(`${say}: the dashboard would refuse it: ${r.body && r.body.detail ? JSON.stringify(r.body.detail) : r.status}`); continue; }
      if (r.body.tier_name !== undefined) {   // a booking
        if (!r.body.tier_found) problems.push(`${say}: books "${r.body.tier_name}", a service the listing does not have`);
        else if (r.body.tier_price != null && r.body.price != null && Math.abs(r.body.tier_price - r.body.price) > 0.01) problems.push(`${say}: saved at ${r.body.price}, the listing's price is ${r.body.tier_price}`);
        continue;
      }
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
if (problems.length) { console.log(`\nOrders that would not reach the dashboard as the customer saw them (${problems.length}):\n  ` + problems.join('\n  ')); process.exit(1); }
console.log('every practice order would be saved as the customer saw it');
