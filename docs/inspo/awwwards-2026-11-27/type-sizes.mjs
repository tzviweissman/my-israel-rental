import { chromium } from 'playwright';
import fs from 'fs';
const sites = fs.readFileSync(process.argv[2], 'utf8').trim().split('\n').map(l => l.split(' '));
const b = await chromium.launch();
const out = [];
const q = [...sites];
await Promise.all([0,1,2,3].map(async () => { while (q.length) { const [n, u] = q.shift();
  const ctx = await b.newContext({ viewport: { width: 1440, height: 900 }, userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) Chrome/130.0 Safari/537.36 mir-check' });
  const p = await ctx.newPage();
  try {
    await p.goto(u, { waitUntil: 'domcontentloaded', timeout: 45000 }); await p.waitForTimeout(6000);
    const r = await p.evaluate(() => {
      const sizes = [], small = [];
      for (const el of document.querySelectorAll('body *')) {
        if (el.closest('footer')) continue;
        const own = [...el.childNodes].some(c => c.nodeType === 3 && c.textContent.trim().length > 1);
        if (!own) continue;
        const s = getComputedStyle(el); if (s.display === 'none' || s.visibility === 'hidden') continue;
        const fs = parseFloat(s.fontSize); const t = el.textContent.trim();
        if (fs >= 24 && t.length < 120) sizes.push(fs);
        if (fs <= 14 && /^[\s\S]{2,30}$/.test(t) && (s.textTransform === 'uppercase' || parseFloat(s.letterSpacing) > 0.5 || /mono/i.test(s.fontFamily))) small.push(fs);
      }
      sizes.sort((a,b)=>a-b);
      const med = sizes.length ? sizes[Math.floor(sizes.length/2)] : 0;
      return { max: sizes.length ? sizes[sizes.length-1] : 0, med, count: sizes.length, labels: small.length };
    });
    out.push({ n, ...r }); console.log(n, JSON.stringify(r));
  } catch (e) { console.log(n, 'ERR'); }
  await ctx.close();
}}));
fs.writeFileSync(process.argv[3], JSON.stringify(out));
await b.close();
