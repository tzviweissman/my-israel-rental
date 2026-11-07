// Storyboard for Tzvi's pick (rule 3h.22): rough black lines on white, one row per concept.
// From the repo root: node scrollcraft/builds/finest-cut/gen/sketch.mjs
import { createRequire } from 'node:module';
const { chromium } = createRequire(process.cwd() + '/')('playwright');
const W = 300, H = 190;
const strip = (x, y, fill = 'none') => `<path transform="translate(${x} ${y})" fill="${fill}" d="M0 14 q40 -20 90 -6 q24 8 16 22 q-50 14 -96 2 q-16 -8 -10 -18z"/>`;
const tongs = (x, y) => `<path d="M${x} ${y} L${x + 70} ${y - 70} M${x + 14} ${y + 6} L${x + 86} ${y - 62}"/>`;
const oil = '<path d="M0 118 q25 -8 50 0 t50 0 t50 0 t50 0 t50 0 t50 0"/>';
const bubbles = [[70, 104], [96, 96], [150, 92], [196, 98], [226, 106], [120, 108], [176, 110]].map(([x, y]) => `<circle cx="${x}" cy="${y}" r="6"/>`).join('');
const steam = (x) => `<path d="M${x} 50 q-10 -12 0 -22 t0 -22"/><path d="M${x + 22} 54 q10 -12 0 -22 t0 -22"/>`;
const cup = (x, y, r = 18) => `<circle cx="${x}" cy="${y}" r="${r}"/><circle cx="${x}" cy="${y}" r="${r * 0.55}"/>`;
const board = (x = 70, y = 28, w = 160, h = 104) => `<rect x="${x}" y="${y}" width="${w}" height="${h}" rx="3"/><path d="M${x + w / 2} ${y} v${h} M${x} ${y + h / 2} h${w}"/>${cup(x + w / 2, y + h / 2, 11)}`;
const ridges = '<path d="M0 130 l40 -50 l30 28 l50 -74 l44 60 l36 -34 l50 56 l50 -30 v44 h-300z"/><path d="M0 150 l60 -24 l60 16 l70 -30 l110 34"/>';
const knife = '<path d="M60 70 L230 34 L238 50 L84 88z"/>';
const cutlet = '<path d="M50 118 q100 -50 200 0 q-100 44 -200 0z"/>';
const panel = (t, inner) => `<g><rect width="${W}" height="${H}" fill="#fff" stroke="#333"/><g fill="none" stroke="#111" stroke-width="2">${inner}</g><text x="8" y="${H - 10}" font-size="12.5" fill="#111">${t}</text></g>`;
const rows = [
  ['E. Your scroll fries it (the visitor cooks it, then it lands on the real board)', [
    panel('1 tongs hold a pale breaded strip over oil', tongs(150, 80) + strip(70, 72) + oil),
    panel('2 it goes in and foams, scrolling turns it gold', oil + strip(100, 92) + bubbles),
    panel('3 lifted out gold, oil runs off, thin steam', tongs(170, 66) + strip(80, 56, '#bbb') + steam(120) + oil + '<path d="M130 92 v18 M150 94 v12"/>'),
    panel('4 set on the board, pull back: price, button', board() + '<rect x="96" y="140" width="108" height="18" rx="9"/>')]],
  ['F. Golden mountains (a tiny camera flies over the board as if it were a landscape)', [
    panel('1 skimming ridges of crust, steam like cloud', ridges + steam(190)),
    panel('2 sauce cups pass under like lakes', ridges + cup(140, 120, 20) + cup(214, 136, 14)),
    panel('3 climbing, the mountains get smaller', board(40, 20, 220, 120)),
    panel('4 one board on black: price, button', board(92, 30, 116, 76) + '<rect x="96" y="124" width="108" height="18" rx="9"/>')]],
  ['G. The slice (a knife, a crack, steam, white inside)', [
    panel('1 one whole cutlet, a knife on the crust', knife + cutlet),
    panel('2 the crust cracks along the blade, steam', cutlet + '<path d="M150 96 l-8 10 l10 8 l-6 12"/>' + knife + steam(240)),
    panel('3 the slice falls open, white inside', '<path d="M40 122 q50 -40 96 -4 q-46 34 -96 4z"/><path d="M168 118 q50 -36 96 4 q-50 30 -96 -4z"/><path d="M136 118 l32 0"/>' + steam(140)),
    panel('4 pull back to the board: button', board() + '<rect x="96" y="140" width="108" height="18" rx="9"/>')]],
];
const rowH = H + 46, width = 4 * (W + 12) + 16, height = rows.length * rowH + 8;
const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" style="background:#fff;font-family:sans-serif">${rows.map(([t, ps], r) => `<g transform="translate(10 ${r * rowH + 8})"><text y="18" font-size="16" font-weight="700">${t}</text>${ps.map((p, i) => `<g transform="translate(${i * (W + 12)} 30)">${p}</g>`).join('')}</g>`).join('')}</svg>`;
const b = await chromium.launch();
const p = await b.newPage({ viewport: { width, height } });
await p.setContent(`<body style="margin:0">${svg}</body>`);
await p.screenshot({ path: 'scrollcraft/builds/finest-cut/gen/storyboard.png' });
await b.close();
