#!/usr/bin/env node
// Builds docs/inspo/by-look.md and docs/inspo/by-look.html from docs/inspo/by-look.tsv,
// our saved website references grouped by look family (idea D4, docs/inspo/videos-2026-11-25).
//
//   node scripts/build-inspo-by-look.mjs           write the two pages
//   node scripts/build-inspo-by-look.mjs --check   list site pictures under docs/inspo that the tsv does not cover
//
// by-look.tsv, one line per picture, tab separated:
//   path  site  family  look words  suits        (a website reference)
//   path  EXCLUDE  reason                        (looked at and left out: ours, a prompt, a slide)
// Whole folders of ads and film or photo stills are left out below, not line by line.
import fs from 'node:fs';
import path from 'node:path';
import { execSync } from 'node:child_process';

const root = path.resolve(path.dirname(new URL(import.meta.url).pathname.replace(/^\/(\w:)/, '$1')), '..');
const dir = path.join(root, 'docs/inspo');
const tsv = path.join(dir, 'by-look.tsv');

// Not website pictures: ads, and film or photo references for generated clips.
const SKIP_FOLDERS = {
  'ad-videos-2026-11-04': 'ads', 'ad-videos-2026-11-07': 'ads', 'pinterest-ads-2026-11-02': 'ads',
  'pinterest-business-ad-2026-11-24': 'ads', 'pro-references': 'ads',
  'pinterest-restaurants-ad-2026-11-25': 'ads', 'pinterest-pasta-posters-2026-11-25': 'ads',
  'bar-breaking-2026-11-02': 'film stills', 'pinterest-burnt-2026-11-18': 'film stills',
  'pinterest-burnt-reveal-2026-11-23': 'film stills', 'product-films-2026-10-21': 'film stills',
  'product-shots-2026-10-22': 'product photos', 'videos-2026-11-01': 'food filming frames',
  'sameness-2026-11-17': 'our own sites',
};

export const FAMILIES = [
  ['warm-editorial', 'Warm editorial', 'Cream or paper ground, serif or elegant type, magazine layout, photo-led and calm.'],
  ['dark-studio', 'Dark studio', 'Black or near-black ground, a lit product or subject, cinematic and premium.'],
  ['quiet-minimal', 'Quiet minimal', 'White or pale ground, lots of empty space, small calm type, few colours.'],
  ['bold-colour', 'Bold colour', 'Whole screens of saturated flat colour, loud and poster-like, colour per product or section.'],
  ['playful-hand-drawn', 'Playful hand-drawn', 'Illustration, doodles, stickers, hand lettering, paper-cut; friendly and fun.'],
  ['giant-type', 'Giant type', 'The type is the picture: huge or cropped wordmarks, letters filling the screen, raw type-first grids.'],
  ['full-bleed-film', 'Full-bleed film', 'A full-screen photo, video or 3D scene carries the page, type on top; immersive.'],
  ['tech-data', 'Tech and data', 'Readouts, wireframes, number grids, tiny mono labels, maps; engineering or futuristic.'],
  ['soft-gradient', 'Soft gradient', 'Pastel or glowing gradients, frosted glass, soft 3D shapes; the modern AI or SaaS look.'],
  ['app-interface', 'App interface', 'Product screens, card grids, directories, forms and dashboards from software.'],
];
const CATS = ['food-shop', 'place', 'fashion-shop', 'beauty', 'events', 'trainer', 'service', 'rental'];

function read() {
  const rows = [], skipped = [], bad = [];
  for (const [i, line] of fs.readFileSync(tsv, 'utf8').split(/\r?\n/).entries()) {
    if (!line.trim()) continue;
    const f = line.split('\t');
    if (f[1] === 'EXCLUDE') { skipped.push({ path: f[0], why: f[2] || '' }); continue; }
    const [p, site, family, words, suits] = f;
    const r = { path: p, site: site || '', family, words: (words || '').split(',').map(s => s.trim()).filter(Boolean),
      suits: (suits || '').split(',').map(s => s.trim()).filter(Boolean) };
    if (!FAMILIES.some(x => x[0] === family)) bad.push(`line ${i + 1}: unknown family "${family}"`);
    for (const c of r.suits) if (!CATS.includes(c)) bad.push(`line ${i + 1}: unknown category "${c}"`);
    if (r.words.length < 3 || r.words.length > 5) bad.push(`line ${i + 1}: ${r.words.length} look words, want 3 to 5`);
    if (!fs.existsSync(path.join(root, p))) bad.push(`line ${i + 1}: no such picture ${p}`);
    rows.push(r);
  }
  return { rows, skipped, bad };
}

function sitePictures() {
  const out = execSync('git ls-files docs/inspo', { cwd: root, encoding: 'utf8' }).split('\n');
  return out.filter(p => /\.(png|jpe?g|webp)$/i.test(p)).filter(p => {
    const top = p.split('/')[2];
    return !SKIP_FOLDERS[top] && p.split('/').length > 3; // loose files at the top are sheets of ours
  });
}

const rel = p => p.replace(/^docs\/inspo\//, '');
const esc = s => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

const { rows, skipped, bad } = read();
const covered = new Set([...rows.map(r => r.path), ...skipped.map(s => s.path)]);
const missing = sitePictures().filter(p => !covered.has(p));

if (process.argv.includes('--check')) {
  for (const b of bad) console.log('BAD ' + b);
  for (const m of missing) console.log('MISSING ' + m);
  console.log(`${rows.length} references, ${skipped.length} looked at and left out, ${missing.length} missing, ${bad.length} bad lines`);
  process.exit(missing.length || bad.length ? 1 : 0);
}
if (bad.length) { for (const b of bad) console.error('BAD ' + b); process.exit(1); }

// ---- by-look.md
const byFam = Object.fromEntries(FAMILIES.map(([k]) => [k, rows.filter(r => r.family === k)]));
let md = `# Our website references, by look\n\n`;
md += `Every website picture saved under \`docs/inspo/\`, grouped by the look it has, not the day it was saved. Use it at\n`;
md += `step 2 of a build: pick the family that fits the business and its category (rule 3t), open the pictures, and copy\n`;
md += `the look words into REFERENCES.md so builds share one vocabulary. Filter it in a browser: \`by-look.html\`.\n\n`;
md += `Each line: the picture, the site, 3 to 5 words that name the look, and the kinds of our businesses it suits\n`;
md += `(rule 3t: food-shop, place, fashion-shop, beauty, events, trainer, service, rental). Borrow how a look works,\n`;
md += `never a site's exact look (README). Idea D4 in \`videos-2026-11-25/README.md\`.\n\n`;
md += `Made by \`node scripts/build-inspo-by-look.mjs\` from \`by-look.tsv\`. After saving new site pictures, add their\n`;
md += `lines to the tsv and rerun; \`--check\` lists any picture not yet in it. Ads are in \`pinterest-ads-2026-11-02/\`,\n`;
md += `not here.\n\n`;
md += `| Family | Pictures | What it looks like | Suits most |\n|---|---|---|---|\n`;
for (const [k, name, what] of FAMILIES) {
  const n = byFam[k].length; if (!n) continue;
  const tally = {}; for (const r of byFam[k]) for (const c of r.suits) tally[c] = (tally[c] || 0) + 1;
  const top = Object.entries(tally).sort((a, b) => b[1] - a[1]).slice(0, 3).map(x => x[0]).join(', ');
  md += `| [${name}](#${k}) | ${n} | ${what} | ${top} |\n`;
}
for (const [k, name, what] of FAMILIES) {
  const list = byFam[k]; if (!list.length) continue;
  md += `\n<a id="${k}"></a>\n## ${name} (${list.length})\n\n${what}\n\n| Picture | Site | Look | Suits |\n|---|---|---|---|\n`;
  for (const r of [...list].sort((a, b) => a.path.localeCompare(b.path))) {
    md += `| [${rel(r.path)}](${rel(r.path)}) | ${r.site} | ${r.words.join(', ')} | ${r.suits.join(', ')} |\n`;
  }
}
md += `\n## Looked at and left out (${skipped.length})\n\nPictures in site folders that are not someone else's website. Whole folders of ads and film stills\n`;
md += `are left out too: ${Object.keys(SKIP_FOLDERS).map(f => '`' + f + '`').join(', ')}.\n\n`;
for (const s of [...skipped].sort((a, b) => a.path.localeCompare(b.path))) md += `- \`${rel(s.path)}\`: ${s.why}\n`;
fs.writeFileSync(path.join(dir, 'by-look.md'), md);

// ---- by-look.html
const data = rows.map(r => ({ p: rel(r.path), s: r.site, f: r.family, w: r.words, c: r.suits }));
const famBtns = FAMILIES.filter(([k]) => byFam[k].length)
  .map(([k, name]) => `<button data-f="${k}">${esc(name)} <span>${byFam[k].length}</span></button>`).join('');
const catBtns = CATS.map(c => `<button data-c="${c}">${c}</button>`).join('');
const famInfo = Object.fromEntries(FAMILIES.map(([k, n, w]) => [k, [n, w]]));
const html = `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Inspo by look</title>
<style>:root{--bg:#fff;--ink:#111827;--mut:#666;--line:#e3e3e3;--acc:#167AB8}@media (prefers-color-scheme:dark){:root{--bg:#111;--ink:#eee;--mut:#aaa;--line:#333;--acc:#4aa8e0}}
*{box-sizing:border-box}body{margin:0;font:14px/1.45 system-ui,sans-serif;background:var(--bg);color:var(--ink);padding:16px}h1{font-size:22px;margin:0 0 4px}.lead{color:var(--mut);margin:0 0 12px;max-width:760px}
.bar{display:flex;flex-wrap:wrap;gap:6px;margin-bottom:8px}.bar b{width:100%;font-size:12px;color:var(--mut);font-weight:600}button{border:1px solid var(--line);background:none;color:var(--ink);border-radius:99px;padding:5px 11px;cursor:pointer;font:inherit}button span{color:var(--mut)}button.on{background:#000;color:#fff;border-color:#000}button.on span{color:#ccc}
input{border:1px solid var(--line);background:none;color:var(--ink);border-radius:8px;padding:6px 10px;font:inherit;width:100%;max-width:360px;margin:4px 0 10px}
#about{color:var(--mut);margin:0 0 12px;min-height:1.4em}#n{color:var(--mut)}
.g{display:grid;grid-template-columns:repeat(auto-fill,minmax(240px,1fr));gap:14px}.c{margin:0;border:1px solid var(--line);border-radius:12px;overflow:hidden}.c a.im{display:block;background:#f2f2f2}.c img{width:100%;aspect-ratio:16/10;object-fit:cover;object-position:top;display:block}
figcaption{padding:8px 10px}.fam{display:inline-block;background:var(--acc);color:#fff;border-radius:6px;padding:0 6px;font-size:12px}.s{font-weight:600;margin-left:6px}.w{margin:4px 0;color:var(--ink)}.t{color:var(--mut);font-size:12px;word-break:break-all}</style></head><body>
<h1>Inspo by look (${rows.length} website pictures)</h1>
<p class="lead">Our saved website references grouped by look family, with the words that name each look and the kinds of business it suits (rule 3t). Pick a family and a category, open a picture full size, copy its words into REFERENCES.md. Same list in by-look.md.</p>
<div class="bar"><b>Look family</b><button class="on" data-f="all">All <span>${rows.length}</span></button>${famBtns}</div>
<div class="bar"><b>Suits</b><button class="on" data-c="all">Any</button>${catBtns}</div>
<input id="q" type="search" placeholder="Search look words or site, e.g. serif, cream, wordmark">
<p id="about"></p><p id="n"></p><div class="g" id="g"></div>
<script>const D=${JSON.stringify(data)};const F=${JSON.stringify(famInfo)};
let f='all',c='all',q='';const g=document.getElementById('g');
const e=s=>String(s).replace(/[&<>"]/g,m=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[m]));
function draw(){const L=D.filter(r=>(f==='all'||r.f===f)&&(c==='all'||r.c.includes(c))&&(!q||(r.w.join(' ')+' '+r.s+' '+r.p).toLowerCase().includes(q)));
document.getElementById('about').textContent=f==='all'?'':F[f][1];document.getElementById('n').textContent=L.length+' pictures';
g.innerHTML=L.map(r=>'<figure class="c"><a class="im" href="'+e(r.p)+'" target="_blank"><img loading="lazy" src="'+e(r.p)+'" alt="'+e(r.s+': '+r.w.join(', '))+'"></a><figcaption><span class="fam">'+e(F[r.f][0])+'</span><span class="s">'+e(r.s)+'</span><p class="w">'+e(r.w.join(', '))+'</p><p class="t">'+e(r.c.join(', '))+' &middot; '+e(r.p)+'</p></figcaption></figure>').join('');}
document.querySelectorAll('[data-f]').forEach(b=>b.onclick=()=>{f=b.dataset.f;document.querySelectorAll('[data-f]').forEach(x=>x.classList.toggle('on',x===b));draw();});
document.querySelectorAll('[data-c]').forEach(b=>b.onclick=()=>{c=b.dataset.c;document.querySelectorAll('[data-c]').forEach(x=>x.classList.toggle('on',x===b));draw();});
document.getElementById('q').oninput=ev=>{q=ev.target.value.trim().toLowerCase();draw();};draw();</script></body></html>
`;
fs.writeFileSync(path.join(dir, 'by-look.html'), html);
console.log(`wrote by-look.md and by-look.html: ${rows.length} references, ${skipped.length} left out, ${missing.length} not yet in the tsv`);
for (const m of missing) console.log('MISSING ' + m);
