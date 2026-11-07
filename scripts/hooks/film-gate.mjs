#!/usr/bin/env node
// Film gate (Tzvi, 27 Oct 2026: get it right the first time instead of auditing afterwards).
// Runs before every tool call that can spend credits on a generated VIDEO and refuses it unless
// the film's brief exists and is approved:
//   scrollcraft/builds/<site>/gen/<film>-brief.md, changed in the last 7 days, containing
//   1. an object list: a heading "## Every object" (rule 3h.18: every object on screen, where it
//      comes from and where it ends; nothing appears from nowhere, changes or vanishes), and
//   2. "## How it really happens": what the real material does, written from watching a real video or saved reference
//      of it (a link or a docs/inspo path in that section), before any prompt (Tzvi, 1 Nov 2026, Krysp: the snap was
//      guessed, so the model made a clean glassy split; a real chew's chocolate cracks and its inside tears),
//   3. "## Key moment": the one step the film is about, given its own clip between its own before and after stills,
//      never shared with the step before it (Krysp's bend and snap shared a clip and the snap came out in one frame),
//   4. "Approved by Tzvi: <date>" on its own line, written only after he said yes to the steps.
//   5. "## Looks real": the real photograph (a link or docs/inspo path) the film's generated stills were compared with at full
//      size (rule 3w.15; Tzvi, 5 Nov 2026, RBS Cleaning: "the scene and the stone look kind of fake").
// Watches: Higgsfield generate_video / generate_video_batch (a price check with get_cost passes),
// and Bash commands that run a gen/*.py script calling a video model (Higgsfield API, kie.ai).
// Prints the refusal reason for the model; never blocks anything else.
import fs from 'node:fs';
import path from 'node:path';

const WEEK = 7 * 24 * 3600 * 1000;
let input = '';
process.stdin.on('data', (d) => { input += d; });
process.stdin.on('end', () => {
  let ev;
  try { ev = JSON.parse(input); } catch { process.exit(0); }
  const tool = ev.tool_name || '', ti = ev.tool_input || {};
  let builds = [];
  if (/generate_video/.test(tool)) {
    const params = typeof ti.params === 'string' ? safeJson(ti.params) : (ti.params || {});
    const items = Array.isArray(params?.items) ? params.items : [params];
    if (items.every((p) => p && p.get_cost)) process.exit(0);   // only asking the price
    builds = buildsUnder(ev.cwd || process.cwd());
  } else if (tool === 'Bash' || tool === 'PowerShell') {
    const cmd = String(ti.command || '');
    const m = cmd.match(/[^\s"']*scrollcraft[\\/]builds[\\/]([^\\/\s"']+)[\\/]gen[\\/][^\s"']+\.py/);
    if (!m) process.exit(0);
    const script = resolveFrom(ev.cwd, m[0]);
    let src = '';
    try { src = fs.readFileSync(script, 'utf8'); } catch { process.exit(0); }
    if (!/(image|text)-to-video|video\/|kling|seedance|minimax|hailuo|veo/i.test(src)) process.exit(0);   // a still, not a film
    builds = [path.dirname(path.dirname(script))];
  } else process.exit(0);

  const ok = [], seen = [];
  for (const b of builds) {
    const gen = path.join(b, 'gen');
    let files = [];
    try { files = fs.readdirSync(gen).filter((f) => /-brief\.md$/.test(f)); } catch { continue; }
    for (const f of files) {
      const p = path.join(gen, f), st = fs.statSync(p), t = fs.readFileSync(p, 'utf8');
      if (Date.now() - st.mtimeMs > WEEK) continue;
      const hasList = /^##+\s*Every object/im.test(t), hasYes = /^Approved by Tzvi:\s*\S/im.test(t);
      const real = (t.split(/^##+\s*How it really happens.*$/im)[1] || '').split(/^##\s/m)[0];
      const hasReal = /https?:\/\/|docs\/inspo\//.test(real), hasKey = /^##+\s*Key moment/im.test(t);
      const looks = (t.split(/^##+\s*Looks real.*$/im)[1] || '').split(/^##\s/m)[0];
      const hasLooks = /https?:\/\/|docs\/inspo\//.test(looks);
      seen.push(`${path.basename(b)}/gen/${f}: object list ${hasList ? 'yes' : 'MISSING'}, how it really happens (with its source) ${hasReal ? 'yes' : 'MISSING'}, key moment ${hasKey ? 'yes' : 'MISSING'}, looks real (with the real photograph) ${hasLooks ? 'yes' : 'MISSING'}, approval ${hasYes ? 'yes' : 'MISSING'}`);
      if (hasList && hasReal && hasKey && hasLooks && hasYes) ok.push(p);
    }
  }
  if (ok.length) process.exit(0);
  const reason = 'Film gate: no paid video until its brief is approved. Write scrollcraft/builds/<site>/gen/<film>-brief.md '
    + 'with the numbered steps, a "## Every object" section (each object: where it comes from, where it ends; rule 3h.18), '
    + 'a "## How it really happens" section written from a real video of the action (its link or docs/inspo path in it), '
    + 'a "## Key moment" section giving that one step its own clip between its own before and after stills, '
    + 'and a "## Looks real" section naming the real photograph (link or docs/inspo path) its stills were compared with at full size (rule 3w.15); '
    + 'show Tzvi the steps and the object list, and only after his yes add the line "Approved by Tzvi: <date and his words>". '
    + (seen.length ? `Briefs found this week: ${seen.join('; ')}.` : 'No brief changed in the last 7 days was found.');
  process.stdout.write(JSON.stringify({ hookSpecificOutput: { hookEventName: 'PreToolUse', permissionDecision: 'deny', permissionDecisionReason: reason } }));
  process.exit(0);
});

function safeJson(s) { try { return JSON.parse(s); } catch { return {}; } }
function resolveFrom(cwd, p) { const q = p.replace(/^["']|["']$/g, ''); return path.isAbsolute(q) ? q : path.resolve(cwd || process.cwd(), q); }
function buildsUnder(cwd) {
  // the session's own checkout, and the main checkout (MCP calls do not say which site)
  const roots = new Set([cwd, 'C:/Users/tzviw/Documents/my-israel-rental']);
  const out = [];
  for (const r of roots) {
    let d = r;
    for (let i = 0; i < 6 && d; i++) {
      const b = path.join(d, 'scrollcraft', 'builds');
      if (fs.existsSync(b)) { for (const s of fs.readdirSync(b)) out.push(path.join(b, s)); break; }
      const up = path.dirname(d); if (up === d) break; d = up;
    }
  }
  return out;
}
