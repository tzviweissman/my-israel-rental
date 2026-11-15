// A short video of the home page for Tzvi: the visits land, a day is tapped, every two weeks, an option; then the page.
import { chromium } from 'playwright';
const [w, h, phone] = process.argv[2] === 'phone' ? [390, 844, true] : [1440, 900, false];
const b = await chromium.launch();
const c = await b.newContext({ viewport: { width: w, height: h }, isMobile: phone, hasTouch: phone, recordVideo: { dir: 'gen/video', size: { width: w, height: h } } });
const p = await c.newPage();
await p.goto('http://localhost:4532/index.html'); await p.waitForTimeout(3200);
if (phone) { await p.evaluate(() => document.querySelector('.board').scrollIntoView({ block: 'center', behavior: 'smooth' })); await p.waitForTimeout(1200); }
await p.click('.wk:nth-child(3) .day[data-d=thu]'); await p.waitForTimeout(1300);
await p.click('.pill[data-often="2weeks"]'); await p.waitForTimeout(1300);
await p.click('.pill[data-often="week"]'); await p.waitForTimeout(1100);
for (let i = 0; i < 14; i++) { await p.mouse.wheel(0, 90); await p.waitForTimeout(60); }
await p.waitForTimeout(600);
await p.click('.toggle[data-opt=sup]'); await p.waitForTimeout(900);
await p.click('.toggle[data-opt=same]'); await p.waitForTimeout(1200);
for (let i = 0; i < 20; i++) { await p.mouse.wheel(0, 90); await p.waitForTimeout(60); }
await p.waitForTimeout(1200);
const v = p.video(); await c.close(); console.log(await v.path()); await b.close();
