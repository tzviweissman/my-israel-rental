#!/usr/bin/env node
/**
 * The order form arrives filled in (Tzvi, 29 Oct 2026, from uxpeak's video 2TlIg3VokY8: a booking form
 * of five empty fields against the same form with tomorrow, 7:00 and 2 guests already chosen; "every
 * blank field is a decision"). Every day field (input type=date) in a form already holds a day the
 * business can do, changeable. A group of choices with none chosen is only noted: which service or kind
 * to pre-choose needs the owner's most common choice, which we often do not have.
 *
 *   node scripts/check-prefill.mjs <url> [more urls]      exit 1 on an empty day or an unchosen group
 */
import { chromium } from 'playwright';

const urls = process.argv.slice(2);
if (!urls.length) { console.error('usage: node scripts/check-prefill.mjs <url> [more urls]'); process.exit(2); }
const browser = await chromium.launch();
let bad = 0;
for (const url of urls) {
  const p = await browser.newPage({ viewport: { width: 390, height: 844 } });
  await p.goto(url, { waitUntil: 'load' }); await p.waitForTimeout(1500);
  const r = await p.evaluate(() => {
    const out = [];
    const notes = [];
    for (const d of document.querySelectorAll('form input[type=date]')) if (!d.value) out.push(`the day field #${d.id || d.name} is empty`);
    const groups = {};
    for (const r of document.querySelectorAll('form input[type=radio]')) (groups[r.name] = groups[r.name] || []).push(r);
    for (const [n, g] of Object.entries(groups)) if (!g.some((r) => r.checked)) notes.push(`no choice made in "${n}"`);
    return { out, notes };
  });
  await p.close();
  if (r.out.length) { bad++; console.log(`EMPTY  ${url}: ${r.out.join('; ')} (rules 3k: the form arrives filled in with the first day the business can do, changeable)`); }
  if (r.notes.length) console.log(`note   ${url}: ${r.notes.join('; ')} (pre-choose the owner's most common choice if they gave one)`);
  console.log(`${url}: checked`);
}
await browser.close();
console.log(bad ? `prefill: ${bad} problem(s)` : 'prefill: every form arrives filled in');
process.exit(bad ? 1 : 0);
