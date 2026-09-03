import { chromium } from 'playwright';
const b = await chromium.launch();
const p = await b.newPage();
let live = false;
for (let i = 0; i < 50 && !live; i++) {
  try {
    await p.goto('https://myisraelrental.com/home-preview', { waitUntil: 'networkidle', timeout: 60000 });
    await p.waitForTimeout(1500);
    const v = await p.evaluate(() => getComputedStyle(document.documentElement).getPropertyValue('--liquid-b').trim());
    if (v.toUpperCase() === '#CC0066') { live = true; break; }
  } catch {}
  await new Promise((r) => setTimeout(r, 20000));
}
await b.close();
console.log(live ? 'neon build is live' : 'timed out waiting for the neon build');
process.exit(live ? 0 : 1);
