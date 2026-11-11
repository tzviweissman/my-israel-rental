// Photographs gen/scenes.html frame by frame (24 a second, 8 s) at laptop and phone shapes: gen/scenes/{wide,tall}/0001.png ...
// node scrollcraft/builds/mn-jewelry/gen/scenes.mjs [wide|tall]   (from the repo root, the build served on :8732)
import { chromium } from 'playwright';
import fs from 'node:fs';
const only = process.argv[2];
const b = await chromium.launch();
for (const [name, w, h] of [['wide', 1920, 1080], ['tall', 1080, 1920]]) {
  if (only && only !== name) continue;
  const out = `scrollcraft/builds/mn-jewelry/gen/scenes/${name}`; fs.rmSync(out, { recursive: true, force: true }); fs.mkdirSync(out, { recursive: true });
  const p = await b.newPage({ viewport: { width: w, height: h } });
  await p.goto(`http://127.0.0.1:8732/mn-jewelry/gen/scenes.html?w=${w}&h=${h}`, { waitUntil: 'networkidle' });
  await p.evaluate(() => document.fonts.ready); await p.waitForTimeout(500);
  const N = 8 * 24;
  for (let i = 0; i < N; i++) { await p.evaluate((t) => window.at(t), i / 24); await p.screenshot({ path: `${out}/${String(i + 1).padStart(4, '0')}.png` }); }
  console.log(name, N);
  await p.close();
}
await b.close();
