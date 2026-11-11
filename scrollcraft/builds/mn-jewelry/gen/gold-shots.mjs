// The gold choice on the shop stage: node scrollcraft/builds/mn-jewelry/gen/gold-shots.mjs -> gen/shots/gold-*.png
// (the stage in each gold, the whole first screen on a laptop and a phone, the closer look, and the basket line)
import { chromium } from 'playwright';
const out = 'scrollcraft/builds/mn-jewelry/gen/shots';
const b = await chromium.launch(); const p = await b.newPage({ viewport: { width: 1440, height: 900 } });
const errs = []; p.on('pageerror', (e) => errs.push(e.message));
await p.goto('http://127.0.0.1:8732/mn-jewelry/shop.html'); await p.waitForTimeout(1500);
const shot = async (n) => { await p.waitForTimeout(1300); await p.locator('#st-ph').screenshot({ path: `${out}/gold-${n}.png` }); };
for (const [piece, golds] of [['twist', ['yellow', 'rose']], ['tennis', ['white', 'yellow', 'rose']], ['princess', ['yellow']]]) {
  await p.click(`.thumb[data-p="${piece}"]`); await p.waitForTimeout(500);
  for (const g of golds) { await p.click(`label.opt:has(input[value="${g}"])`); await shot(`${piece}-${g}`); }
}
console.log('summary:', await p.textContent('#st-sum'));
await p.screenshot({ path: `${out}/gold-screen-laptop.png` });
const box = await p.locator('#st-ph').boundingBox();
await p.mouse.move(box.x + box.width * 0.5, box.y + box.height * 0.45); await p.waitForTimeout(700);
await p.screenshot({ path: `${out}/gold-closer.png` });
await p.click('#st-add'); await p.waitForTimeout(400);
console.log('basket:', await p.textContent('#sum-list'), 'errors', errs);
await p.setViewportSize({ width: 390, height: 844 }); await p.reload(); await p.waitForTimeout(1500);
await p.screenshot({ path: `${out}/gold-screen-phone.png` });
await b.close();
