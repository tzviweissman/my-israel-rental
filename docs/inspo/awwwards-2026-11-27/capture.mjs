// Capture an award site: opening frames, a slow scroll, phone screens, and what it is built with.
import { chromium } from 'playwright';
import fs from 'fs';
import path from 'path';
const [list, outDir] = process.argv.slice(2);
const sites = fs.readFileSync(list, 'utf8').trim().split('\n').map(l => l.split(' '));
fs.mkdirSync(outDir, { recursive: true });
const UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0 Safari/537.36 mir-check';
const b = await chromium.launch({ args: ['--use-gl=angle', '--enable-webgl', '--ignore-gpu-blocklist'] });
async function one([name, url]) {
  const dir = path.join(outDir, name); fs.mkdirSync(dir, { recursive: true });
  const info = { name, url };
  const ctx = await b.newContext({ viewport: { width: 1440, height: 900 }, userAgent: UA });
  const p = await ctx.newPage();
  const shots = [];
  try {
    await p.goto(url, { waitUntil: 'domcontentloaded', timeout: 60000 });
    for (const t of [800, 2500, 5000]) { await p.waitForTimeout(t === 800 ? 800 : t - (t === 2500 ? 800 : 2500)); const f = path.join(dir, `d-open-${t}.jpg`); await p.screenshot({ path: f, quality: 70, type: 'jpeg' }); shots.push(f); }
    // close obvious cookie bars so they do not cover every frame
    await p.evaluate(() => { for (const el of document.querySelectorAll('button, a')) { if (/^(accept|accept all|agree|ok|got it|allow all|i agree)$/i.test(el.textContent.trim())) { el.click(); break; } } }).catch(() => {});
    await p.mouse.move(720, 450);
    const total = await p.evaluate(() => Math.max(document.documentElement.scrollHeight, document.body ? document.body.scrollHeight : 0));
    info.pageHeight = total;
    // wheel-scroll (works with smooth-scroll libraries), a frame every ~0.8 screens, up to 22 frames
    const steps = 22;
    let last = -1, same = 0;
    for (let i = 0; i < steps; i++) {
      for (let k = 0; k < 6; k++) { await p.mouse.wheel(0, 120); await p.waitForTimeout(60); }
      await p.waitForTimeout(900);
      const f = path.join(dir, `d-scroll-${String(i).padStart(2, '0')}.jpg`);
      const buf = await p.screenshot({ path: f, quality: 70, type: 'jpeg' }); shots.push(f);
      const y = buf.toString('base64').slice(2000, 6000);
      if (y === last) { if (++same >= 3) break; } else same = 0;
      last = y;
    }
    info.signals = await p.evaluate(() => {
      const w = window, html = document.documentElement.outerHTML;
      const has = re => re.test(html);
      const fonts = [...new Set([...document.querySelectorAll('h1,h2,h3,p,a,button')].slice(0, 200).map(e => getComputedStyle(e).fontFamily.split(',')[0].replace(/["']/g, '').trim()))].slice(0, 6);
      const canvases = document.querySelectorAll('canvas').length;
      const videos = document.querySelectorAll('video').length;
      const sections = document.querySelectorAll('section').length;
      const navLinks = [...document.querySelectorAll('header a, nav a')].map(a => a.textContent.trim()).filter(Boolean).slice(0, 12);
      const h1 = [...document.querySelectorAll('h1')].map(h => h.textContent.trim().replace(/\s+/g, ' ')).slice(0, 2);
      const cursor = [...document.querySelectorAll('div')].some(d => { const s = getComputedStyle(d); return s.position === 'fixed' && s.pointerEvents === 'none' && parseInt(s.width) < 120 && parseInt(s.width) > 4 && s.borderRadius.includes('%'); }) || has(/class="[^"]*cursor/i);
      const marquee = has(/marquee|ticker/i);
      return {
        gsap: !!w.gsap || has(/gsap/i), scrollTrigger: !!w.ScrollTrigger || has(/ScrollTrigger/), lenis: !!w.lenis || has(/lenis/i), locomotive: has(/locomotive-scroll|data-scroll-container/),
        three: !!w.THREE || has(/three(\.module)?(\.min)?\.js|__THREE__/), webgl: canvases > 0, canvases, videos, barba: has(/barba|data-barba|swup|taxi/i), webflow: has(/webflow/i), framer: has(/framer/i), shopify: has(/shopify/i), nextjs: has(/__NEXT_DATA__|_next\//), nuxt: has(/__NUXT__/),
        splitText: has(/SplitText|split-text|splitting|data-split|class="[^"]*(line|word|char)s?-?inner/i), cursor, marquee, sections, navLinks, h1, fonts,
        bodyBg: getComputedStyle(document.body).backgroundColor, darkScore: null
      };
    });
  } catch (e) { info.error = e.message.slice(0, 120); }
  await ctx.close();
  // phone
  const pc = await b.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 1, isMobile: true, hasTouch: true, userAgent: 'Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.0 Mobile/15E148 Safari/604.1 mir-check' });
  const pp = await pc.newPage();
  const phone = [];
  try {
    await pp.goto(url, { waitUntil: 'domcontentloaded', timeout: 60000 }); await pp.waitForTimeout(4000);
    for (let i = 0; i < 5; i++) { const f = path.join(dir, `m-${i}.jpg`); await pp.screenshot({ path: f, quality: 70, type: 'jpeg' }); phone.push(f); await pp.evaluate(() => window.scrollBy(0, 700)); await pp.waitForTimeout(1200); }
  } catch (e) { info.phoneError = e.message.slice(0, 120); }
  await pc.close();
  info.frames = shots.length;
  fs.writeFileSync(path.join(dir, 'info.json'), JSON.stringify(info, null, 1));
  console.log(name, info.error || 'ok', shots.length, 'frames', info.signals ? JSON.stringify({ g: info.signals.gsap, l: info.signals.lenis, t: info.signals.three, c: info.signals.canvases }) : '');
}
const queue = [...sites];
await Promise.all([0, 1, 2].map(async () => { while (queue.length) await one(queue.shift()); }));
await b.close();
