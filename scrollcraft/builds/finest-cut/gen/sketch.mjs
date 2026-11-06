// Rough film sketch sheet for Tzvi's yes (rule 3h.22): two concepts, three panels each, plain line drawings.
// From the repo root: node scrollcraft/builds/finest-cut/gen/sketch.mjs
import { createRequire } from 'node:module';
const { chromium } = createRequire(process.cwd() + '/')('playwright');
const strip = 'M10 30 q40 -22 90 -6 q30 10 20 26 q-50 16 -100 2 q-16 -8 -10 -22z';
const crumbs = [[30, -14], [62, -22], [96, -12], [120, -4]].map(([x, y]) => `<circle cx="${x}" cy="${y}" r="3"/>`).join('');
const fork = '<path d="M60 -110 v70 M50 -110 v30 M70 -110 v30 M50 -80 q10 12 20 0"/>';
const panel = (t, inner) => `<g><rect width="300" height="180" rx="6" fill="#fff" stroke="#333"/><g transform="translate(90 110)" fill="none" stroke="#222" stroke-width="2">${inner}</g><text x="10" y="172" font-size="13" fill="#222">${t}</text></g>`;
const board = '<rect x="-60" y="-70" width="240" height="120" rx="4"/><path d="M60 -70 v120 M-60 -10 h240"/><circle cx="60" cy="-10" r="20"/>';
const cup = '<ellipse cx="60" cy="-10" rx="44" ry="14"/><path d="M16 -10 v44 q44 18 88 0 v-44"/>';
const rows = [
  ['C. The crunch: a fork presses one strip, the crust cracks, then the camera pulls back', [
    panel('1 one strip, close, lit from behind', `<path d="${strip}"/>`),
    panel('2 a fork presses, the crust cracks, crumbs settle', `${fork}<path d="${strip}"/><path d="M40 12 l14 -18 l10 16 l14 -14"/><g fill="#222">${crumbs}</g>`),
    panel('3 pull back to the whole board and the button', board)]],
  ['D. The dip: one strip goes into their sauce cup and comes out coated', [
    panel('1 their cup with its logo lid, a hand lifts the lid', `${cup}<path d="M20 -40 h80"/>`),
    panel('2 a strip is lowered in', `${cup}<g transform="rotate(70 60 -40) translate(0 -70)"><path d="${strip}"/></g>`),
    panel('3 it lifts out coated, a slow thick drip', `${cup}<g transform="rotate(70 60 -60) translate(0 -100)"><path d="${strip}"/></g><path d="M60 -44 v24"/>`)]],
];
const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="980" height="${rows.length * 230 + 10}" style="background:#eee;font-family:sans-serif">${rows.map(([t, ps], r) => `<g transform="translate(10 ${r * 230 + 10})"><text y="18" font-size="16" font-weight="700">${t}</text>${ps.map((p, i) => `<g transform="translate(${i * 320} 30)">${p}</g>`).join('')}</g>`).join('')}</svg>`;
const b = await chromium.launch();
const p = await b.newPage({ viewport: { width: 980, height: rows.length * 230 + 10 } });
await p.setContent(`<body style="margin:0">${svg}</body>`);
await p.screenshot({ path: 'scrollcraft/builds/finest-cut/gen/film-sketch.png' });
await b.close();
