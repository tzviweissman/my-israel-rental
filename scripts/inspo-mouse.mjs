// Mouse effects: hold the page still and move the mouse to fixed spots,
// a frame at each, then sweep fast across one spot and film it.
import { createRequire } from 'node:module';
const { chromium } = createRequire(process.cwd() + '/')('playwright');
const [url, tag, out, sy] = process.argv.slice(2);
const b = await chromium.launch({ args: ['--use-gl=angle', '--enable-webgl', '--ignore-gpu-blocklist'] });
const ctx = await b.newContext({ viewport: { width: 1440, height: 900 }, recordVideo: { dir: out, size: { width: 960, height: 600 } } });
const p = await ctx.newPage();
await p.goto(url, { waitUntil: 'domcontentloaded', timeout: 60000 }).catch(() => {});
await p.waitForTimeout(7000);
if (Number(sy)) { for (let k = 0; k < Number(sy); k++) { await p.mouse.wheel(0, 120); await p.waitForTimeout(80); } await p.waitForTimeout(1500); }
const spots = [[200, 200], [1240, 200], [720, 450], [200, 760], [1240, 760]];
for (let i = 0; i < spots.length; i++) { await p.mouse.move(...spots[i], { steps: 25 }); await p.waitForTimeout(700); await p.screenshot({ path: `${out}/${tag}-m${i}.jpg`, type: 'jpeg', quality: 70 }); }
// fast sweeps through the middle-top (where butter's keys hang)
for (let r = 0; r < 3; r++) { await p.mouse.move(500, 120, { steps: 4 }); await p.mouse.move(940, 160, { steps: 4 }); }
for (let i = 0; i < 6; i++) { await p.waitForTimeout(150); await p.screenshot({ path: `${out}/${tag}-sw${i}.jpg`, type: 'jpeg', quality: 70 }); }
await ctx.close(); await b.close();
