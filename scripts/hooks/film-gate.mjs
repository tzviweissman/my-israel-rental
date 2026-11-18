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
//   6. "## Clip plan" (rule 3w.10.5; Tzvi, 10 Nov 2026: stop remaking clips from mistakes): each clip's start and end
//      stills by file (they must exist), edges, same item, one change, credits, what is in code, what gets trimmed.
//   7. "Phones asked:" with Tzvi's own answer in quotes (rule 3aa.26; Tzvi, 13 Nov 2026, after Gremier's phones got the
//      wide film on cream "for now" without asking, then needed five more clips: "make a rule so phones are always asked
//      before generating"): tall 9:16 clips for phones, at what cost, or the whole width on the ground.
//   8. The build's BLUEPRINT.md has a plan for every film rule (`node scripts/blueprint.mjs --check <build> film`), so the
//      film is made to rules 3aa (Burnt Meatboards, 18 Nov 2026: 3aa.8, 3aa.9 and 3aa.11 were first read after the film).
// Watches: Higgsfield generate_video / generate_video_batch (a price check with get_cost passes),
// and Bash commands that run a gen/*.py script calling a video model (Higgsfield API, kie.ai).
// Prints the refusal reason for the model; never blocks anything else.
import fs from 'node:fs';
import path from 'node:path';
import { spawnSync } from 'node:child_process';

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
    // the starter's clip chain, run from a build folder (15 Nov 2026: `clipchain.py make` paid for clips and this gate never
    // saw it, because the command names no build path); a --dry run pays nothing
    if (/clipchain\.py['"]?\s+make\b/.test(cmd) && !/--dry\b/.test(cmd)) {
      const cd = cmd.match(/\bcd\s+["']?([^"'&;]+?)["']?\s*(?:&&|;)/);
      const dir = cd ? resolveFrom(ev.cwd, cd[1].trim().replace(/^\/([a-z])\//i, '$1:/')) : (ev.cwd || process.cwd());
      const b = dir.split(String.fromCharCode(92)).join("/").match(/^.*scrollcraft\/builds\/[^/]+/);
      builds = b ? [b[0]] : buildsUnder(dir);
    } else {
    const m = cmd.match(/[^\s"']*scrollcraft[\\/]builds[\\/]([^\\/\s"']+)[\\/]gen[\\/][^\s"']+\.py/);
    if (!m) process.exit(0);
    const script = resolveFrom(ev.cwd, m[0]);
    let src = '';
    try { src = fs.readFileSync(script, 'utf8'); } catch { process.exit(0); }
    if (!/(image|text)-to-video|video\/|kling|seedance|minimax|hailuo|veo/i.test(src)) process.exit(0);   // a still, not a film
    builds = [path.dirname(path.dirname(script))];
    }
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
      const plan = clipPlan(t, b, gen);
      const hasPhone = /^Phones asked:.*["“][^"”]{2,}["”]/im.test(t);
      // the cause is big enough for its effect (rules 3aa.31, Gremier 15 Nov: a thin trickle of grounds browned a whole sea)
      const hasEnough = /^\s*-?\s*Enough:\s*\S.{20,}/im.test(t);
      seen.push(`${path.basename(b)}/gen/${f}: object list ${hasList ? 'yes' : 'MISSING'}, how it really happens (with its source) ${hasReal ? 'yes' : 'MISSING'}, key moment ${hasKey ? 'yes' : 'MISSING'}, looks real (with the real photograph) ${hasLooks ? 'yes' : 'MISSING'}, clip plan ${plan || 'yes'}, phones asked (his words in quotes) ${hasPhone ? 'yes' : 'MISSING'}, enough line ${hasEnough ? 'yes' : 'MISSING'}, approval ${hasYes ? 'yes' : 'MISSING'}`);
      const rules = filmRules(b);
      seen[seen.length - 1] += `, film rules planned ${rules || 'yes'}`;
      if (hasList && hasReal && hasKey && hasLooks && !plan && hasPhone && hasEnough && hasYes && !rules) ok.push(p);
    }
  }
  if (ok.length) process.exit(0);
  const reason = 'Film gate: no paid video until its brief is approved. Write scrollcraft/builds/<site>/gen/<film>-brief.md '
    + 'with the numbered steps, a "## Every object" section (each object: where it comes from, where it ends; rule 3h.18), '
    + 'a "## How it really happens" section written from a real video of the action (its link or docs/inspo path in it), '
    + 'a "## Key moment" section giving that one step its own clip between its own before and after stills, '
    + 'a "## Looks real" section naming the real photograph (link or docs/inspo path) its stills were compared with at full size (rule 3w.15), '
    + 'and a "## Clip plan" section (rule 3w.10.5) naming the start and end stills by file (already made), and saying: edges clean, '
    + 'same item as the real photo (count, colour, size, words), one change between the stills, the get_cost credits, what is done in code, '
    + 'and what gets trimmed or dissolved if a clip is nearly right; '
    + 'a line "Phones asked: <date>, Tzvi: \"<his answer>\"" (rule 3aa.26: ask him before any clip whether phones get tall 9:16 clips, with their get_cost credits, or the whole width on the ground), '
    + 'a line "Enough: <each cause, its amount, and why that much does what the step shows>" (rule 3aa.31: a thin trickle cannot brown a sea), '
    + 'plan every film rule in BLUEPRINT.md (node scripts/blueprint.mjs --check <site> film) before the sketch sheet, '
    + 'show Tzvi the steps and the object list, and only after his yes add the line "Approved by Tzvi: <date and his words>". '
    + (seen.length ? `Briefs found this week: ${seen.join('; ')}.` : 'No brief changed in the last 7 days was found.');
  process.stdout.write(JSON.stringify({ hookSpecificOutput: { hookEventName: 'PreToolUse', permissionDecision: 'deny', permissionDecisionReason: reason } }));
  process.exit(0);
});

// rule 3w.10.5 (Tzvi, 10 Nov 2026: plan the clip so it is not remade): '' when the plan is complete, else what is missing
function clipPlan(t, build, gen) {
  const sec = (t.split(/^##+\s*Clip plan.*$/im)[1] || '').split(/^##\s/m)[0];
  if (!sec.trim()) return 'MISSING';
  const stills = [...sec.matchAll(/[\w./\\-]+\.(?:png|jpe?g|webp)\b/gi)].map((m) => m[0]);
  const found = stills.filter((s) => [build, gen].some((d) => fs.existsSync(path.resolve(d, s))));
  const need = [
    [found.length >= 2, 'start and end stills by file, made before the clip'],
    [/edge/i.test(sec), 'edges'],
    [/count|colou?r|size|words/i.test(sec), 'same item as the real photo'],
    [/one change|one step/i.test(sec), 'one change between stills'],
    [/credit/i.test(sec), 'get_cost credits'],
    [/in code/i.test(sec), 'what is done in code'],
    [/trim|dissolve/i.test(sec), 'what is trimmed if nearly right'],
  ].filter(([ok]) => !ok).map(([, what]) => what);
  return need.length ? `MISSING (${need.join(', ')})` : '';
}

// '' when every film rule in the build's BLUEPRINT.md has a plan, or the build has none, else what is missing
function filmRules(build) {
  const bp = path.join(build, 'BLUEPRINT.md');
  // a blueprint written before rules 3aa existed belongs to a site already made: new rules spare it (Tzvi, 29 Oct 2026)
  if (!fs.existsSync(bp) || !/\bR3aa\.8\b/.test(fs.readFileSync(bp, 'utf8'))) return '';
  const repo = path.resolve(build, '..', '..', '..');
  const r = spawnSync(process.execPath, [path.join(repo, 'scripts', 'blueprint.mjs'), '--check', build, 'film'], { encoding: 'utf8' });
  return r.status === 0 ? '' : `MISSING (${(r.stdout.match(/^\d+/) || ['some'])[0]} unplanned: node scripts/blueprint.mjs --check ${path.basename(build)} film)`;
}

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
