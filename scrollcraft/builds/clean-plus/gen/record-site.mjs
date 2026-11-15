// The whole site for Tzvi: home (board, options, price), Build your plan (all three steps, sent to a caught
// WhatsApp, never the owner), Contact. node gen/record-site.mjs [phone]
import { chromium } from 'playwright';
const phone = process.argv[2] === 'phone';
const [w, h] = phone ? [390, 844] : [1440, 900];
const b = await chromium.launch();
const c = await b.newContext({ viewport: { width: w, height: h }, isMobile: phone, hasTouch: phone, recordVideo: { dir: 'gen/video/site', size: { width: w, height: h } } });
await c.route('**/marketplace/gigs/*/book', (r) => r.fulfill({ json: { track_path: '/track/test' } }));
await c.route('https://wa.me/**', (r) => r.fulfill({ contentType: 'text/html', body: '<body style="font:20px system-ui;padding:40px">WhatsApp opens here with the plan written out.</body>' }));
const p = await c.newPage();
const scroll = async (n, step = 90) => { for (let i = 0; i < n; i++) { await p.mouse.wheel(0, step); await p.waitForTimeout(55); } };
const tap = async (sel) => { await p.locator(sel).first().scrollIntoViewIfNeeded(); await p.waitForTimeout(250); await p.click(sel); };
// home
await p.goto('http://localhost:4532/index.html'); await p.waitForTimeout(3200);
await tap('.wk:nth-child(3) .day[data-d=wed]'); await p.waitForTimeout(1200);
await scroll(phone ? 16 : 10); await p.waitForTimeout(500);
await tap('.toggle[data-opt=sup]'); await p.waitForTimeout(900);
await scroll(phone ? 22 : 10); await p.waitForTimeout(900);
await scroll(phone ? 20 : 14); await p.waitForTimeout(1100);
// Build your plan, from the options' button so the plan arrives chosen
await p.evaluate(() => scrollTo(0, 0)); await p.waitForTimeout(300);
await tap('#pick-go'); await p.waitForURL(/book\.html/); await p.waitForTimeout(1500);
await tap('label.opt:has(input[name=extra][value=same])'); await p.waitForTimeout(800);
await tap('#send'); await p.waitForTimeout(1200);
await p.locator('#where').scrollIntoViewIfNeeded(); await p.fill('#where', 'Baka'); await p.waitForTimeout(900);
await tap('#send'); await p.waitForTimeout(1200);
await p.fill('#me', 'Test Person'); await p.fill('#ph', '050-000-0000'); await p.waitForTimeout(1200);
if (phone) { await p.locator('#send').scrollIntoViewIfNeeded(); await p.waitForTimeout(800); }
await tap('#send'); await p.waitForTimeout(2200);
// contact
await p.goto('http://localhost:4532/contact.html'); await p.waitForTimeout(1500);
await scroll(phone ? 24 : 12); await p.waitForTimeout(1200);
const v = p.video(); await c.close(); console.log(await v.path()); await b.close();
