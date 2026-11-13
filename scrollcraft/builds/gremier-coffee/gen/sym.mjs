import { chromium } from 'playwright';
const b = await chromium.launch({ channel: 'chrome' });
const p = await (await b.newContext({ viewport: { width: 390, height: 844 }, isMobile: true })).newPage();
await p.goto('http://127.0.0.1:8937/gremier-coffee/index.html', { waitUntil: 'load' }); await p.waitForTimeout(2500);
console.log(await p.evaluate(() => [...document.querySelectorAll('.w0 .btn-facts li')].map((li) => { const s = li.querySelector('.sym'); return li.innerText + ' | ' + (s ? getComputedStyle(s).fontFamily + ' ' + getComputedStyle(s).fontSize + ' ' + s.getBoundingClientRect().width.toFixed(1) : 'no sym'); }).join('\n')));
await p.screenshot({ path: 'scrollcraft/builds/gremier-coffee/gen/look-sym.png', clip: { x: 0, y: 60, width: 390, height: 160 } });
await b.close();
