#!/usr/bin/env node
/**
 * Build from the rules, not check against them afterwards (Tzvi, 1 Nov 2026: "can we make it build with
 * using the rules as a blueprint rather than building and checking afterwards what was kept and what was
 * skipped which makes it take much longer and isnt perfect").
 *
 * Until now a site was built and then RULES.md answered all ~200 checklist lines, so a skipped rule was found
 * at the end and the page rebuilt, and any later edit made RULES.md "stale" and the whole list was answered
 * again. Now every checklist line is a step in BLUEPRINT.md, written BEFORE the part it belongs to is built:
 *
 *   node scripts/blueprint.mjs <build>                 write BLUEPRINT.md: every rule, in build order, with
 *                                                      what the record already decides filled in
 *   node scripts/blueprint.mjs --check <build> <stage> fails unless every line of stages 1 to <stage> has a
 *                                                      plan; run it before building that stage
 *   node scripts/blueprint.mjs --done <build>          fails unless every line is ticked [x] or planned n/a
 *   node scripts/blueprint.mjs --rules <build>         writes RULES.md from the blueprint (ticked = pass with
 *                                                      its plan, n/a = n/a), so check-rules needs no second pass
 *   node scripts/blueprint.mjs --update <build>        adds rules added to the checklist since, keeping plans
 *   node scripts/blueprint.mjs --order                 every checklist section has a stage (run by the commit check)
 *   node scripts/blueprint.mjs --has film=no <build>   answers "This site has": the rules tagged when:film leave the
 *                                                      stages and are listed once as "n/a: not on this site (film: no)",
 *                                                      so they are not read (Tzvi, 10 Nov 2026); film=yes brings them
 *                                                      back. --done, --rules and check-rules fail if the site's files
 *                                                      show the thing anyway (scripts/site-has.mjs)
 *
 * A line looks like:
 *   - [ ] R3v.14 Three true facts ... (check: check-facts)
 *     plan: From ₪16 a doughnut · Delivery in Jerusalem · Cash, bit or bank transfer
 * "plan:" is what will be built for this rule on this site, or "n/a: <why the site has no such thing>".
 * Tick [x] when it is built. Scripts named in a line still run at publish; they confirm, they do not discover.
 */
import fs from 'node:fs';
import path from 'node:path';
import { WHEN, contradicted } from './site-has.mjs';

const ROOT = path.resolve(path.dirname(new URL(import.meta.url).pathname.replace(/^\/([A-Za-z]:)/, '$1')), '..');
const CHECKLIST = path.join(ROOT, 'docs', 'rules-checklist.md');
const ID = /^(R[0-9][0-9a-z]*\.[0-9]+)\s*\|\s*(.*)$/;
// build order: what is decided first comes first. The checklist's own sections, re-ordered.
const ORDER = ['1', '4', '2', '3', '8c', '5', '6', '7', '8', '8b', '9'];
const STAGE_NAMES = { '1': 'Facts and words', '4': 'Photos and media', '2': 'Opening', '3': 'Sections', '8c': 'Site structure (menu, footer, facts, layouts)', '5': 'Prices and savings', '6': 'Order and booking flow', '7': 'Motion', '8': 'Phone', '8b': 'Order details and report', '9': 'Finish' };

const args = process.argv.slice(2);
const mode = (['--check', '--done', '--rules', '--update', '--has'].find((m) => args.includes(m)) || '--write').slice(2);
const rest = args.filter((a) => !a.startsWith('--') && !/^[a-z]+=/.test(a));
// --order: only check that every checklist section has a place in the build order (the commit check runs it
// whenever the checklist changes; 4 Nov 2026 a new section "8d" left every build without a blueprint)
const target = args.includes('--order') ? ROOT : rest[0];
if (!target) { console.error('usage: node scripts/blueprint.mjs [--check <stage> | --done | --rules | --update] <build>'); process.exit(2); }
const dir = fs.existsSync(target) && fs.statSync(target).isDirectory() ? path.resolve(target) : path.join(ROOT, 'scrollcraft', 'builds', target);
if (!fs.existsSync(dir)) { console.error(`no build folder: ${target}`); process.exit(2); }
const file = path.join(dir, 'BLUEPRINT.md');

// the checklist, grouped into stages
const items = [];
let sec = '';
for (const line of fs.readFileSync(CHECKLIST, 'utf8').split(/\r?\n/)) {
  const h = /^##\s+([0-9]+[a-z]?)\./.exec(line); if (h) { sec = h[1]; continue; }
  if (/^##\s/.test(line)) { sec = ''; continue; }
  const m = ID.exec(line); if (!m || !sec) continue;
  const parts = m[2].split('|').map((s) => s.trim());
  const how = parts.slice(2).join(' | ');
  items.push({ id: m[1], rule: parts[0], how, sec, when: (/\bwhen:([a-z]+)/.exec(how) || [])[1] });
}
const stages = ORDER.filter((s) => items.some((i) => i.sec === s)).map((s, k) => ({ n: k + 1, sec: s, name: STAGE_NAMES[s] || s, items: items.filter((i) => i.sec === s) }));
const missingSec = [...new Set(items.map((i) => i.sec))].filter((s) => !ORDER.includes(s));
if (missingSec.length) { console.error(`checklist sections not placed in the build order: ${missingSec.join(', ')} (add them to ORDER in scripts/blueprint.mjs)`); process.exit(2); }
// a when: tag must be a thing site-has.mjs can prove, or a rule would be dropped with nothing checking it
const badWhen = items.filter((i) => i.when && !(i.when in WHEN)).map((i) => `${i.id} when:${i.when}`);
if (badWhen.length) { console.error(`when: tags site-has.mjs cannot check: ${badWhen.join(', ')} (known: ${Object.keys(WHEN).join(', ')})`); process.exit(2); }
if (args.includes('--order')) { console.log(`blueprint: all ${items.length} checklist rules have a build stage`); process.exit(0); }

// what the business record already decides (src/record.json from fetch_business.py)
function prefill() {
  const out = new Map();
  let rec = null;
  try { rec = JSON.parse(fs.readFileSync(path.join(dir, 'src', 'record.json'), 'utf8')); } catch { return out; }
  const b = rec.business || {}, listings = rec.listings || [];
  const prices = [];
  for (const l of listings) for (const x of [...(l.tiers || []), ...(l.products || [])]) { const p = Number(x.price ?? x.price_ils ?? x.amount); if (p > 0) prices.push(p); }
  const cur = (listings[0] && (listings[0].currency || listings[0].tiers?.[0]?.currency)) === 'USD' ? '$' : '₪';
  const from = prices.length ? `From ${cur}${Math.min(...prices)}` : '';
  const areas = (b.areas || []).map((a) => a.replace(/(^|[-\s])\w/g, (c) => c.toUpperCase()).replace(/-/g, ' '));
  const kosher = b.kosher_certification && (b.kosher_certification.body || '').trim();
  const facts = [from, b.delivery_note && `Delivery: ${b.delivery_note}`, b.lead_time && `Order ${b.lead_time} ahead`, b.payment_note, kosher && `Kosher, ${kosher}`, areas.length && !b.delivery_note && `Serving ${areas.join(', ')}`].filter(Boolean);
  const say = (re, plan) => { for (const it of items) if (re.test(it.rule) && !out.has(it.id)) out.set(it.id, plan); };
  out.set('R3v.14', facts.length >= 3 ? `choose three, in the owner's words: ${facts.join(' · ')}` : `from the record: ${facts.join(' · ') || 'nothing yet'}; ask the owner for the rest (message-to-owner.md)`);
  out.set('R3v.1', `who: ${b.name}${b.description ? `, "${String(b.description).split(/[.!\n]/)[0].trim()}"` : ''} · Pages · ${b.hours ? 'Visit or Ordering with hours' : 'Ordering'}: ${[b.lead_time && `${b.lead_time} ahead`, b.delivery_note, b.payment_note].filter(Boolean).join(', ') || 'from the owner'} · Reach us · base line${b.founded_year ? `, since ${b.founded_year}` : ', no founding year so no "since"'}`);
  if (!kosher) say(/kosher|hechsher|certificat/i, 'n/a: no certificate in the record, so nothing on the page says kosher');
  if (!b.founded_year) say(/founding year|"since"|\bsince\b/i, 'n/a: no founding year in the record, so no "since" line');
  // rules 3x (4 Nov 2026): what the record already decides
  const products = listings.flatMap((l) => l.products || []), sized = listings.flatMap((l) => l.tiers || []);
  out.set('R3x.7', 'write BRAND.md (colours with uses, two fonts, the type and spacing scale of 3x.13, logo on light and dark, textures, Design bans) before any picture is generated');
  out.set('R3x.8', 'sitekit writes the skip link, live basket count, footer h2s and JSON-LD (set ld_type for this business); the build adds a 1200x630 share picture, fetchpriority="high" on the opening picture, loading="lazy" far down, labelled fields with type and autocomplete, and a role="status" line on the form');
  out.set('R3g.18', 'each different kind of offer in <meta name="offers">; with two or more, the headline names each and the one button opens a page where they choose');
  out.set('R3x.13', 'every text size from the starter scale --t-1..--t5 and every gap from --s1..--s10, written into BRAND.md; nothing sized in between');
  out.set('R3x.14', 'SITE.gift_section() and gift.js on the order page; hidden until the owner switches gift cards on');
  if (products.length + sized.length < 2) { out.set('R3x.3', 'n/a: one item in one size in the record, so no tabs'); out.set('R3x.4', 'n/a: one item in one size in the record, nothing to compare'); }
  if (products.length) out.set('R3x.9', 'n/a: a shop with products and a basket, not a request form');
  if (!prices.length) out.set('R3x.10', 'n/a: no prices in the record');
  if (b.lead_time) say(/order form arrives filled|first day the business can/i, `the day field starts at the first day after the ${b.lead_time} lead time`);
  return out;
}

// rules the starter already builds (docs/rules-as-blueprint/rules.json, status "built"): when this build uses every part
// named in built_by, the rule is ticked with that part as its plan, so it is built once and never checked-and-retried.
function builtByStarter() {
  const out = new Map();
  let reg = [];
  try { reg = JSON.parse(fs.readFileSync(path.join(ROOT, 'docs', 'rules-as-blueprint', 'rules.json'), 'utf8')).rules || []; } catch { return out; }
  const read = (f) => { try { return fs.readFileSync(path.join(dir, f), 'utf8'); } catch { return ''; } };
  let src = '';
  try { for (const f of fs.readdirSync(path.join(dir, 'gen'))) if (f.endsWith('.py')) src += read(path.join('gen', f)); } catch { /* no gen folder */ }
  const usesKit = /\bsitekit\b/.test(src);
  const has = (part) => {
    part = part.trim();
    if (/^sitekit\.guard|^starter\b/.test(part)) return usesKit;
    const k = /^kit\.(\w+)/.exec(part);
    if (k) return usesKit && [k[1], ...({ card: ["shop_page"], price_row: ["shop_page", "card"], facts: ["opening_slides"] }[k[1]] || [])].some((f) => src.includes(f + "("));   // parts that call each other
    if (part === 'clipchain.py') return fs.existsSync(path.join(dir, 'gen', 'chain.json'));
    if (/^\w+\.js$/.test(part)) return fs.existsSync(path.join(dir, part));
    return false;
  };
  for (const r of reg) {
    if (r.status !== 'built' || !r.built_by) continue;
    const parts = r.built_by.split(':')[0].split('+').map((x) => x.replace(/\s*\(.*$/, '').replace(/\s+\w+=$/, ''));
    if (parts.every(has)) out.set(r.id, `built by the starter: ${r.built_by}; confirm: ${r.confirmed_by || 'look once'}`);
  }
  return out;
}

// "This site has": one answer per WHEN key ('' until answered); a "no" drops that thing's rules from the stages
const NOT_HERE = (k) => `n/a: not on this site (${k}: no)`;
const readHas = () => {
  const has = Object.fromEntries(Object.keys(WHEN).map((k) => [k, '']));
  if (!fs.existsSync(file)) return has;
  for (const line of fs.readFileSync(file, 'utf8').split(/\r?\n/)) {
    const m = /^- ([a-z]+): (yes|no)\b/.exec(line);
    if (m && m[1] in has) has[m[1]] = m[2];
  }
  return has;
};
const dropped = (it, has) => !!(it.when && has[it.when] === 'no');
const read = () => {
  const plans = new Map(); let cur = null;
  for (const line of fs.readFileSync(file, 'utf8').split(/\r?\n/)) {
    const d = /^- \[-\] (R[0-9][0-9a-z]*\.[0-9]+) \(([a-z]+): no\)/.exec(line);
    if (d) { plans.set(d[1], { done: false, plan: NOT_HERE(d[2]) }); cur = null; continue; }
    const m =/^- \[( |x|X)\] (R[0-9][0-9a-z]*\.[0-9]+)\b/.exec(line);
    if (m) { cur = m[2]; plans.set(cur, { done: m[1] !== ' ', plan: '' }); continue; }
    const p = /^\s+plan:\s*(.*)$/.exec(line);
    if (p && cur) plans.get(cur).plan = p[1].trim();
  }
  return plans;
};
const write = (plans, has = readHas()) => {
  const name = path.basename(dir);
  const out = [`# Blueprint: ${name}`, '',
    'Every rule of docs/rules-checklist.md, in the order the site is built. Before building a stage, write the plan for',
    'each of its lines (what this site will do for that rule, or `n/a: <why the site has no such thing>`), then',
    `\`node scripts/blueprint.mjs --check ${name} <stage>\`. Tick [x] as each is built. RULES.md is written from this`,
    `file (\`--rules\`); the scripts named in a line confirm it at publish.`, '',
    '## This site has', '',
    `Answer each before stage 1: \`node scripts/blueprint.mjs --has <thing>=yes|no ${name}\`. A "no" moves that thing's rules`,
    'out of the stages (listed once at the end, not read); the files are checked for it at --done, --rules and check-rules.', ''];
  for (const [k, w] of Object.entries(WHEN)) out.push(`- ${k}: ${has[k] || '(not answered)'}  ${w.ask}`);
  out.push('');
  for (const s of stages) {
    out.push(`## Stage ${s.n}. ${s.name}`, '');
    for (const it of s.items) {
      if (dropped(it, has)) continue;
      const p = plans.get(it.id) || { done: false, plan: '' };
      const check = /script:\s*([a-z-]+)/i.exec(it.how);
      out.push(`- [${p.done ? 'x' : ' '}] ${it.id} ${it.rule}${check ? ` (check: ${check[1]})` : ''}`, `  plan: ${p.plan}`);
    }
    out.push('');
  }
  const gone = items.filter((it) => dropped(it, has));
  if (gone.length) {
    out.push('## Not on this site', '', `${gone.length} rules for things this site does not have, n/a without being read:`, '');
    for (const it of gone) out.push(`- [-] ${it.id} (${it.when}: no)`);
    out.push('');
  }
  fs.writeFileSync(file, out.join('\n'));
};
// a plan says what THIS site does for the rule; filler is not a plan (the trap check-rules catches in RULES.md)
const FILLER = /^(\?|todo|tbd|done|ok|yes|pass|planned|as (the )?rule|follows? (the )?rule|will (do|follow)|see rule|standard|default|same as)\b/i;
const planned = (p) => !!(p && p.plan && p.plan.length >= 12 && !FILLER.test(p.plan));
const na = (p) => /^n\/a\b/i.test(p.plan || '');

if (mode === 'write' || mode === 'update') {
  if (mode === 'write' && fs.existsSync(file) && !args.includes('--force')) { console.error(`${file} exists; use --update to add new rules, or --force to start again`); process.exit(2); }
  const plans = mode === 'update' && fs.existsSync(file) ? read() : new Map();
  const pre = prefill(), built = builtByStarter();
  for (const it of items) if (!plans.has(it.id)) plans.set(it.id, { done: built.has(it.id), plan: built.get(it.id) || pre.get(it.id) || '' });
  for (const [id, plan] of built) { const p = plans.get(id); if (p && !p.done && !planned(p)) plans.set(id, { done: true, plan }); }
  const has = readHas();
  for (const it of items) if (dropped(it, has)) plans.set(it.id, { done: false, plan: NOT_HERE(it.when) });
  write(plans, has);
  const filled = items.filter((i) => planned(plans.get(i.id))).length;
  console.log(`wrote ${path.relative(ROOT, file)}: ${items.length} rules in ${stages.length} stages, ${filled} already planned from the record, ${built.size} built by the starter and ticked`);
  process.exit(0);
}

if (!fs.existsSync(file)) { console.error(`no BLUEPRINT.md in ${dir}: run node scripts/blueprint.mjs ${target}`); process.exit(1); }
const plans = read();
const missing = items.filter((i) => !plans.has(i.id)).map((i) => i.id);
if (missing.length) { console.error(`BLUEPRINT.md lacks ${missing.length} newer rule(s): ${missing.slice(0, 10).join(' ')}; run --update`); process.exit(1); }

if (mode === 'has') {
  const has = readHas();
  for (const a of args.filter((x) => /^[a-z]+=/.test(x))) {
    const [k, v] = a.split('=');
    if (!(k in WHEN) || !/^(yes|no)$/.test(v)) { console.error(`--has takes ${Object.keys(WHEN).map((x) => `${x}=yes|no`).join(', ')}`); process.exit(2); }
    const hit = v === 'no' && WHEN[k].find(dir);
    if (hit) { console.error(`${k}=no, but ${hit} has one: the answer is yes`); process.exit(1); }
    has[k] = v;
    for (const it of items.filter((i) => i.when === k)) {
      if (v === 'no') plans.set(it.id, { done: false, plan: NOT_HERE(k) });
      else if (plans.get(it.id)?.plan === NOT_HERE(k)) plans.set(it.id, { done: false, plan: '' });
    }
  }
  write(plans, has);
  const gone = items.filter((it) => dropped(it, has)).length;
  console.log(`This site has: ${Object.entries(has).map(([k, v]) => `${k} ${v || '(not answered)'}`).join(', ')}; ${gone} rule(s) not on this site`);
  process.exit(0);
}
{
  // every answer given before a stage is planned, and none the files contradict before it is finished or written to RULES.md
  const has = readHas(), open = Object.keys(has).filter((k) => !has[k]);
  if (open.length && ['check', 'done', 'rules'].includes(mode)) { console.log(`answer "This site has" first: node scripts/blueprint.mjs --has ${open.map((k) => `${k}=yes|no`).join(' ')} ${path.basename(dir)}`); process.exit(1); }
  const wrong = contradicted(dir, fs.readFileSync(file, 'utf8'));
  if (wrong.length && ['done', 'rules'].includes(mode)) { for (const w of wrong) console.log(w); process.exit(1); }
}
if (mode === 'check') {
  const upto = Number(rest[1] || stages.length);
  const open = stages.filter((s) => s.n <= upto).flatMap((s) => s.items.filter((i) => !planned(plans.get(i.id))).map((i) => `stage ${s.n} ${i.id}: ${i.rule.slice(0, 80)}`));
  if (open.length) { console.log(`${open.length} line(s) have no plan yet; decide them before building stage ${upto}:`); for (const o of open.slice(0, 40)) console.log('  ' + o); process.exit(1); }
  console.log(`stages 1 to ${upto} are planned`); process.exit(0);
}
if (mode === 'done') {
  const open = items.filter((i) => { const p = plans.get(i.id); return !(p.done && planned(p)) && !na(p); });
  if (open.length) { console.log(`${open.length} line(s) not built yet:`); for (const i of open.slice(0, 40)) console.log(`  ${i.id}: ${(plans.get(i.id).plan || i.rule).slice(0, 90)}`); process.exit(1); }
  console.log('every line of the blueprint is built or n/a'); process.exit(0);
}
if (mode === 'rules') {
  const lines = [`# Rules for ${path.basename(dir)}, written from BLUEPRINT.md (scripts/blueprint.mjs --rules)`, ''];
  let open = 0;
  for (const it of items) {
    const p = plans.get(it.id);
    if (na(p)) lines.push(`${it.id} ${p.plan.replace(/^n\/a\s*:?\s*/i, 'n/a: ')}`);
    else if (p.done && planned(p)) lines.push(`${it.id} pass: built to the blueprint: ${p.plan}`);
    else { lines.push(`${it.id} todo`); open++; }
  }
  fs.writeFileSync(path.join(dir, 'RULES.md'), lines.join('\n') + '\n');
  console.log(`wrote RULES.md from the blueprint${open ? `, ${open} line(s) still todo (not built yet)` : ''}`);
  process.exit(open ? 1 : 0);
}
