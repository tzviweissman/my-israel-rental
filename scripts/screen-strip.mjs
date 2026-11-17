#!/usr/bin/env node
/**
 * One picture of a whole page, screen by screen at a laptop size (1280x800), left to right in rows of four, so a
 * review starts from what the visitor sees rather than from the code (17 Nov 2026: comparing eight sites side by
 * side showed in one look that every site had the same menu bar, steps and closing band; until then there was no
 * such picture and a script had to be written for it). publish-page writes it for every check, as
 * <build>/screens.jpg; it never blocks a publish.
 *
 *   node scripts/screen-strip.mjs <url> <out.jpg> [max screens, default 16]
 */
import fs from 'node:fs';
import { chromium } from 'playwright';

const [url, out, maxArg] = process.argv.slice(2);
if (!url || !out) { console.error('usage: node scripts/screen-strip.mjs <url> <out.jpg> [max screens]'); process.exit(2); }
const MAX = Number(maxArg) || 16, W = 1280, H = 800;
const browser = await chromium.launch();
const p = await browser.newPage({ viewport: { width: W, height: H } });
await p.goto(url, { waitUntil: 'load', timeout: 60000 });
await p.waitForTimeout(1200);
const total = await p.evaluate(() => document.documentElement.scrollHeight);
const n = Math.min(MAX, Math.max(1, Math.ceil(total / H)));
const shots = [];
for (let i = 0; i < n; i++) {
  // even steps from top to bottom, so a long page is still covered in MAX screens
  await p.evaluate((y) => window.scrollTo(0, y), Math.round((i * (total - H)) / Math.max(1, n - 1)));
  await p.waitForTimeout(600);
  shots.push((await p.screenshot({ type: 'jpeg', quality: 70 })).toString('base64'));
}
// lay them out on a plain page and photograph that: no image library needed
const cols = 4, tw = 480, th = 300;
const sheet = await browser.newPage({ viewport: { width: cols * (tw + 8) + 8, height: Math.ceil(n / cols) * (th + 8) + 8 } });
await sheet.setContent(`<body style="margin:0;padding:4px;background:#111;display:flex;flex-wrap:wrap">${shots.map((b, i) =>
  `<div style="position:relative;margin:4px"><img src="data:image/jpeg;base64,${b}" style="width:${tw}px;height:${th}px;display:block"><b style="position:absolute;left:6px;top:4px;font:12px sans-serif;color:#fff;background:#000a;padding:1px 5px">${i + 1}</b></div>`).join('')}</body>`);
await sheet.screenshot({ path: out, type: 'jpeg', quality: 80, fullPage: true });
await browser.close();
console.log(`${out}: ${n} screens of ${url}`);
