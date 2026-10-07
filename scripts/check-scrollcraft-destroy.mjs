// The vendored scroll engine (frontend/src/vendor/scrollcraft.js) must leave
// nothing behind when a page unmounts: a single-page app keeps the window, so
// a leaked listener or animation loop runs on every page visited afterwards.
// Also checks the two fixes made with it (7 Oct 2026): captions are simply
// visible under reduced motion, and a right-to-left rail travels rightwards.
//   Run: node scripts/check-scrollcraft-destroy.mjs [engine.js]
import { chromium } from 'playwright';
import { readFile } from 'node:fs/promises';

const enginePath = process.argv[2] || new URL('../frontend/src/vendor/scrollcraft.js', import.meta.url);
const engine = await readFile(enginePath, 'utf8');

// Counts live window listeners and animation frames, so a leak is a number.
const probe = `
  window.__live = new Map(); window.__raf = 0;
  const add = window.addEventListener, rem = window.removeEventListener, raf = window.requestAnimationFrame;
  window.addEventListener = function (t, f, o) { window.__live.set(f, t); return add.call(this, t, f, o); };
  window.removeEventListener = function (t, f, o) { window.__live.delete(f); return rem.call(this, t, f, o); };
  window.requestAnimationFrame = function (f) { window.__raf++; return raf.call(this, f); };
`;
const page = (dir) => `<!doctype html><html dir="${dir}"><body style="margin:0">
  <section data-sc-act="pin" data-sc-span="2" id="pin"><div data-sc-stage style="position:sticky;top:0;height:100vh">
    <h2 data-sc-cue="0.1 0.6" id="cue">Caption</h2><div data-sc-parallax="-0.2" id="par">layer</div>
  </div></section>
  <section data-sc-act="pan" data-sc-span="2" id="pan"><div data-sc-stage style="position:sticky;top:0;height:100vh;overflow:hidden">
    <div data-sc-pan="0" id="rail" style="display:flex;width:max-content">${'<div style="width:600px;height:200px">x</div>'.repeat(6)}</div>
  </div></section>
  <button data-sc-magnet="0.3" id="mag">Order</button>
  <div style="height:200vh"></div></body></html>`;

const fails = [];
const b = await chromium.launch();
for (const [dir, motion] of [['ltr', 'no-preference'], ['rtl', 'no-preference'], ['ltr', 'reduce']]) {
  const tag = `${dir}${motion === 'reduce' ? ' reduced' : ''}`;
  const ctx = await b.newContext({ viewport: { width: 1280, height: 800 }, reducedMotion: motion });
  const p = await ctx.newPage();
  await p.setContent(page(dir));
  await p.addScriptTag({ content: probe });
  const base = await p.evaluate(() => window.__live.size);
  await p.addScriptTag({ content: engine });
  const r = await p.evaluate(async () => {
    const ids = ['pin', 'pan', 'cue', 'par', 'rail', 'mag'];
    const css = () => ids.map((id) => document.getElementById(id).style.cssText);
    const before = css();
    const api = window.ScrollCraft.mount(document);
    const mounted = window.__live.size;
    const pan = document.getElementById('pan');
    window.scrollTo(0, pan.offsetTop + (pan.offsetHeight - innerHeight) / 2);
    await new Promise((res) => setTimeout(res, 300));
    const out = {
      mounted,
      rail: document.getElementById('rail').style.transform,
      cueOpacity: document.getElementById('cue').style.opacity,
    };
    window.scrollTo(0, 0);
    await new Promise((res) => setTimeout(res, 100));
    out.hasDestroy = typeof api.destroy === 'function';
    if (out.hasDestroy) { api.destroy(); api.destroy(); }   // twice must be harmless
    const after = window.__raf;
    await new Promise((res) => setTimeout(res, 400));
    out.rafAfter = window.__raf - after;
    out.left = window.__live.size;
    out.instances = window.ScrollCraft.instances.length;
    out.ready = document.documentElement.classList.contains('sc-ready');
    const now = css();
    out.styles = ids.filter((id, i) => now[i] !== before[i]);
    return out;
  });
  if (!r.hasDestroy) fails.push(`${tag}: the engine has no destroy()`);
  if (r.mounted <= base) fails.push(`${tag}: mount added no listeners, the probe is not seeing them`);
  if (r.left !== base) fails.push(`${tag}: ${r.left - base} window listeners left after destroy`);
  if (r.rafAfter > 1) fails.push(`${tag}: ${r.rafAfter} animation frames after destroy`);
  if (r.instances) fails.push(`${tag}: instance still registered`);
  if (r.ready) fails.push(`${tag}: sc-ready left on the page`);
  if (r.styles.length) fails.push(`${tag}: inline styles left on ${r.styles.join(', ')}`);
  const x = parseFloat((r.rail.match(/translate3d\(([-\d.]+)px/) || [])[1]);
  if (motion !== 'reduce' && !(dir === 'rtl' ? x > 0 : x < 0)) fails.push(`${tag}: rail moved ${r.rail || 'nowhere'}, wrong way for ${dir}`);
  if (motion === 'reduce' && r.cueOpacity !== '1') fails.push(`${tag}: caption at opacity ${r.cueOpacity} with reduced motion`);
  await ctx.close();
}
await b.close();
console.log(fails.length ? `FAIL\n${fails.join('\n')}` : 'PASS: destroy leaves nothing; RTL rail and reduced-motion captions right');
process.exit(fails.length ? 1 : 0);
