// Does a scroll-tied effect finish while its subject is still in front of the visitor?
//
//   node scroll-finish.mjs <url> <selector> "<done expression>"
//
// The done expression is evaluated with `el` bound to the subject and returns true once
// the effect has finished, e.g. for Rendrly's steps:
//   'getComputedStyle(el.querySelectorAll("li")[1]).getPropertyValue("--f").trim() === "1.000"'
//
// At six sizes it scrolls down 40px at a time from just above the subject and records
// where the subject is when the effect completes. It passes when, at that moment, the
// subject's top is still on screen and its centre is no higher than 40% of the screen
// (for a subject taller than the screen: its bottom is on screen and below 60%). It fails
// if the effect never completes, or completes once the subject is on its way out.
// Rule: docs/page-generation-rules.md §3f.8 (Rendrly, 13 Oct 2026: "the coloring only
// finishes when im past it"). No dependencies: real headless Chrome over CDP, Node 22+.
import { spawn } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";

const [url, selector, done] = process.argv.slice(2);
if (!url || !selector || !done) { console.error('usage: node scroll-finish.mjs <url> <selector> "<done expression>"'); process.exit(2); }
const CHROME = process.env.CHROME_BIN || "C:/Program Files/Google/Chrome/Application/chrome.exe";
const SIZES = [[1920, 1080], [1440, 900], [1536, 753], [1280, 650], [390, 844, true], [360, 640, true]];
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function check([w, h, mobile]) {
  const port = 9000 + Math.floor(Math.random() * 900);
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "cdp-"));
  const chrome = spawn(CHROME, ["--headless=new", "--remote-debugging-port=" + port, "--user-data-dir=" + dir, "--hide-scrollbars", "about:blank"], { stdio: "ignore" });
  let ws, id = 1; const pending = new Map();
  const send = (method, params = {}) => { const i = id++; ws.send(JSON.stringify({ id: i, method, params })); return new Promise((r) => pending.set(i, r)); };
  const ev = async (e) => (await send("Runtime.evaluate", { expression: e, returnByValue: true })).result?.value;
  try {
    for (let i = 0; i < 100; i++) { try { if ((await fetch(`http://127.0.0.1:${port}/json/version`)).ok) break; } catch {} await sleep(100); }
    const t = await (await fetch(`http://127.0.0.1:${port}/json/new?about:blank`, { method: "PUT" })).json();
    ws = new WebSocket(t.webSocketDebuggerUrl); await new Promise((r) => (ws.onopen = r));
    ws.onmessage = (m) => { const d = JSON.parse(m.data); if (pending.has(d.id)) { pending.get(d.id)(d.result); pending.delete(d.id); } };
    await send("Emulation.setDeviceMetricsOverride", { width: w, height: h, deviceScaleFactor: 1, mobile: !!mobile });
    if (mobile) await send("Emulation.setTouchEmulationEnabled", { enabled: true, maxTouchPoints: 5 });
    await send("Page.navigate", { url }); await sleep(2500);
    const sel = JSON.stringify(selector);
    if (!(await ev(`!!document.querySelector(${sel})`))) return { size: `${w}x${h}`, pass: false, why: "selector not found" };
    await ev(`(() => { const r = document.querySelector(${sel}).getBoundingClientRect(); scrollBy(0, r.top - innerHeight); })()`);
    for (let i = 0; i < 200; i++) {
      await ev("scrollBy(0, 40)"); await sleep(60);
      const at = await ev(`(() => { const el = document.querySelector(${sel}); if (!(${done})) return null;
        const r = el.getBoundingClientRect(); return { top: r.top, bottom: r.bottom, height: r.height, vh: innerHeight }; })()`);
      if (!at) continue;
      const tall = at.height > at.vh * 0.9, centre = (at.top + at.bottom) / 2;
      const pass = tall ? at.bottom <= at.vh && at.bottom >= at.vh * 0.6 : at.top >= 0 && centre >= at.vh * 0.4;
      return { size: `${w}x${h}`, pass, top: Math.round(at.top), bottom: Math.round(at.bottom),
        centre: Math.round((centre / at.vh) * 100) + "% down", why: pass ? "" : tall ? "finished with the end of the subject leaving" : "finished after the subject passed the middle" };
    }
    return { size: `${w}x${h}`, pass: false, why: "never finished while scrolling past" };
  } finally {
    try { ws && ws.close(); } catch {} chrome.kill(); try { fs.rmSync(dir, { recursive: true, force: true }); } catch {}
  }
}

let failed = 0;
for (const s of SIZES) {
  const r = await check(s);
  if (!r.pass) failed++;
  console.log(`${r.pass ? "ok  " : "FAIL"} ${r.size.padEnd(10)} ${r.top !== undefined ? `subject ${r.top} to ${r.bottom}px, centre ${r.centre}` : ""} ${r.why}`);
}
process.exit(failed ? 1 : 0);
