#!/usr/bin/env node
/**
 * The concept gate (Tzvi, 19 Oct 2026: "we need originality like this in our
 * pages, you need to use our inspo sources better, why are you making bland
 * websites and not following our rules"). Rules alone did not stop bland
 * pages: the builder read them and graded its own work as passing. This makes
 * the steps that produce originality a file the publish step checks.
 *
 * A build folder must hold CONCEPT.md with:
 *
 *   ## Ideas
 *   - three or more opening ideas, each citing an effect from our inspo
 *     library by its picture, e.g. (docs/inspo/awwwards-food-2026-10-18/crav-burgers-2-burger-inside-title.webp);
 *     every cited picture must exist
 *   - one idea from the business's OWN words or world, marked "Own:"
 *     (The Whipped Cup: "your cup, your cloud" became a walk on the clouds)
 *   ## Chosen
 *   which idea and why, in a few lines
 *   ## Wow gate
 *   the five answers of page rules 3n, numbered 1 to 5
 *   ## Effects
 *   - button: B7, from 21st search "button hover" for bakeries
 *   one line per kind (button, link, tile, reveal, steps, price, heading),
 *   the id from fingerprints.json _effects and where it came from; "none" allowed;
 *   plus "- touch:", one small detail only this business would have (never none)
 *   ## Not alike
 *   the line printed by scripts/check-fingerprints.mjs for this build
 * Since 22 Nov 2026 a build with IDEAS.md needs no "## Ideas" part here, the Mobbin and 21st sources may be named in
 * REFERENCES.md, and a new build has "- board:" and "- page plan:" lines (rules 3aj.8).
 *
 *   node scripts/check-concept.mjs <build-folder>     exit 1 with what is missing
 *
 * scripts/publish-page.mjs runs this for a page that is not live yet.
 */
import fs from 'node:fs';
import path from 'node:path';
import { checkReferences } from './check-references.mjs';
import { checkIdeas } from './check-ideas.mjs';
import { newerRules } from './rule-dates.mjs';
import { judgeReview } from './judges.mjs';

const ROOT = path.resolve(path.dirname(new URL(import.meta.url).pathname.replace(/^\/([A-Za-z]:)/, '$1')), '..');

export function checkConcept(dir) {
  const file = path.join(dir, 'CONCEPT.md');
  if (!fs.existsSync(file)) return ['no CONCEPT.md in the build folder (see scripts/check-concept.mjs for what it holds)'];
  const s = fs.readFileSync(file, 'utf8');
  const part = (h) => { const m = new RegExp(`^##\\s*${h}\\s*$([\\s\\S]*?)(?=^##\\s|$(?![\\s\\S]))`, 'im').exec(s); return m ? m[1].trim() : ''; };
  // every saved source, Inspo, Mobbin and 21st read before the ideas (Tzvi, 28 Oct 2026). Sites already
  // published before this rule have no REFERENCES.md and are not asked for one; every new build is.
  const published = (() => { try { return Object.values(JSON.parse(fs.readFileSync(path.join(ROOT, 'scrollcraft', 'published.json'), 'utf8'))).map((v) => v.folder); } catch { return []; } })();
  const older = published.includes(path.basename(path.resolve(dir))) && !fs.existsSync(path.join(dir, 'REFERENCES.md'));
  const problems = older ? [] : checkReferences(dir).map((p) => `References: ${p}`);
  // the ideas themselves, from that reading and unlike other sites' (Tzvi, 29 Oct 2026); every new build,
  // and any published one that already keeps an IDEAS.md
  if (!published.includes(path.basename(path.resolve(dir))) || fs.existsSync(path.join(dir, 'IDEAS.md'))) {
    problems.push(...checkIdeas(dir).filter((p) => !p.startsWith('References: ')).map((p) => `Ideas: ${p}`));
  }
  // IDEAS.md is the one home of the ideas (0b.4); a build that has it needs no "## Ideas" copy here (22 Nov 2026)
  const ideasFile = fs.existsSync(path.join(dir, 'IDEAS.md'));
  const ideas = part('Ideas');
  const refs = [...ideas.matchAll(/docs\/inspo\/[^\s)]+\.(?:webp|png|jpe?g)/gi)].map((m) => m[0]);
  const missing = refs.filter((r) => !fs.existsSync(path.join(ROOT, r)));
  const uniqueRefs = new Set(refs.filter((r) => !missing.includes(r)));
  if (!ideasFile && uniqueRefs.size < 3) problems.push(`Ideas: ${uniqueRefs.size} inspo pictures cited that exist (needs 3 or more, each idea from a real saved effect)`);
  if (!ideasFile && missing.length) problems.push(`Ideas: these cited pictures do not exist: ${missing.join(', ')}`);
  if (!ideasFile && !/^\s*[-*]\s*Own:/im.test(ideas)) problems.push('Ideas: no idea from the business\'s own words or world (a line starting "- Own:")');
  if (part('Chosen').length < 40) problems.push('Chosen: say which idea and why');
  const gate = part('Wow gate');
  const answers = [1, 2, 3, 4, 5].filter((n) => new RegExp(`^\\s*${n}[.)]\\s*\\S{3,}`, 'm').test(gate));
  if (answers.length < 5) problems.push(`Wow gate: ${answers.length} of the 5 answers (page rules 3n)`);
  // each effect says where it came from, so a habit carried over from the last
  // build shows (Tzvi, 20 Oct 2026: "why do you keep making everything so similar")
  const fx = part('Effects').split('\n').filter((l) => /^\s*[-*]\s*\w+:/.test(l));
  const kinds = ['button', 'link', 'tile', 'reveal', 'steps', 'price', 'heading'];
  const lacking = kinds.filter((k) => !fx.some((l) => new RegExp(`^\\s*[-*]\\s*${k}:`, 'i').test(l)));
  if (lacking.length) problems.push(`Effects: no line for ${lacking.join(', ')} (one "- kind: id, from <the search or inspo picture>" each, "none" allowed)`);
  const unsourced = fx.filter((l) => !/:\s*none\b/i.test(l) && !/\bfrom\b/i.test(l));
  if (unsourced.length) problems.push(`Effects: say where each came from ("from" a named 21st, Mobbin or Inspo search, or a docs/inspo picture): ${unsourced.map((l) => l.trim()).join(' | ')}`);
  // and one small touch only this business would have (Tzvi, 20 Oct 2026, on the cloud pointer and
  // the polish-shade sweep: "we need to do more unique things like that")
  // all three sources on every build (Tzvi, 22 Oct 2026: "have you been using mobbin and 21st for your builds"; 12 of 17 sites had no Mobbin search)
  const src = s + (fs.existsSync(path.join(dir, 'REFERENCES.md')) ? fs.readFileSync(path.join(dir, 'REFERENCES.md'), 'utf8') : '');   // REFERENCES.md is the one home of the sources
  if (!/mobbin\.com\//i.test(src)) problems.push('Sources: no Mobbin search named with a mobbin.com link (search Mobbin for this category on every build, rule 3c.1)');
  if (!/21st[^\n]{0,40}("[^"]+"|search)/i.test(src)) problems.push('Sources: no 21st search named (the one study a build includes 21st; name the component, rule 3g.17)');
  // the wow comes from research (Tzvi, 23 Oct 2026: "for the wow use mobbin and our inspo and 21st for inspiration")
  const wow = part('Wow gate');
  if (!/mobbin\.com\//i.test(wow) || !/(docs\/inspo\/|inspo:|inspo\s)/i.test(wow)) problems.push('Wow gate: name where the wow came from, a Mobbin link and an Inspo or docs/inspo reference (and the 21st search when it answers)');
  if (!fx.some((l) => /^\s*[-*]\s*touch:\s*(?!none)\S/i.test(l))) problems.push('Effects: no "- touch:" line, a small detail only this business would have (The Whipped Cup: a cloud for a mouse pointer; Elisheva: the sweep in the chosen shade)');
  if (!/different from all \d+ other pages/.test(part('Not alike'))) problems.push('Not alike: paste the passing line from scripts/check-fingerprints.mjs');
  // Tzvi, 22 Nov 2026 ("All 7", from two design videos): rules 3aj.2 and 3aj.3, not asked of a site made before them
  let newer = new Set();
  try { newer = newerRules(ROOT, dir); } catch { /* no git: hold the build to them */ }
  if (!newer.has('R3aj.2')) {
    // three first screens, one per reference, the same colours and fonts, Tzvi's pick quoted
    const fs3 = (/^\s*[-*]\s*first screens\s*:(.*)$/im.exec(s) || [])[1] || '';
    const files = [...fs3.matchAll(/[\w./-]+\.(?:html|png|jpe?g|webp)/gi)].map((m) => m[0]);
    const lost = files.filter((f) => !fs.existsSync(path.join(dir, f)));
    if (files.length < 3) problems.push('First screens: no "- first screens: <a> <b> <c>; Tzvi: \\"<his pick>\\"" line naming three first-screen versions in the build, one per reference, only the layout different (3aj.2)');
    else if (lost.length) problems.push(`First screens: these versions are not in the build: ${lost.join(', ')} (3aj.2)`);
    else if (!/["“][^"”]+["”]/.test(fs3)) problems.push('First screens: quote Tzvi\'s pick on the line ("- first screens: ...; Tzvi: \\"B, with the big word\\"") (3aj.2)');
  }
  if (!newer.has('R3aj.3')) {
    // the mistakes every AI-made site of this kind makes, read before the ideas
    const av = (/^\s*[-*]\s*avoids\s*:\s*([^:\n]+):?(.*)$/im.exec(s) || []);
    const kinds = (fs.existsSync(path.join(ROOT, 'docs', 'category-mistakes.md')) ? fs.readFileSync(path.join(ROOT, 'docs', 'category-mistakes.md'), 'utf8') : '')
      .split(/\r?\n/).filter((l) => /^## /.test(l)).map((l) => l.slice(3).trim().toLowerCase());
    if (!av[1]) problems.push('Avoids: no "- avoids: <kind>: how this site avoids each" line naming a part of docs/category-mistakes.md (3aj.3)');
    else if (!kinds.includes(av[1].trim().toLowerCase())) problems.push(`Avoids: "${av[1].trim()}" is not a part of docs/category-mistakes.md (${kinds.join(', ')}); add the kind there first (3aj.3)`);
    else if ((av[2] || '').trim().split(/\s+/).length < 8) problems.push('Avoids: say how this site avoids that kind\'s mistakes, in a few words each (3aj.3)');
  }
  if (!newer.has('R3aj.8')) {
    // one design board a build, and Tzvi's yes to the grey-box page before the real site (rules 3aj.8, 22 Nov 2026)
    const board = (/^\s*[-*]\s*board\s*:\s*(\S+)/im.exec(s) || [])[1] || '';
    const plan = (/^\s*[-*]\s*page plan\s*:(.*)$/im.exec(s) || [])[1] || '';
    if (!fs.existsSync(path.join(dir, 'gen', 'board', 'index.html')) || !/^https?:\/\//.test(board)) problems.push('Board: no gen/board/index.html, or no "- board: <its artifact link>" line in CONCEPT.md (3aj.8: one design board a build, the same link throughout)');
    if (!/["“][^"”]+["”]/.test(plan)) problems.push('Page plan: quote Tzvi\'s yes to the grey-box page ("- page plan: Tzvi: \\"yes, swap the third and fourth\\"") (3aj.8)');
  }
  if (!newer.has('R3aj.10')) {
    // the mock-ups are judged before Tzvi sees them (rules 3aj.10, 23 Nov 2026): the newest judging in
    // gen/board/judged.md rates 4 or more
    const jf = path.join(dir, 'gen', 'board', 'judged.md');
    const why = fs.existsSync(jf) ? judgeReview(fs.readFileSync(jf, 'utf8')).why : 'no gen/board/judged.md';
    if (why) problems.push(`Judged: ${why}. Two fresh judges (judges.mjs --brief) score each first screen and the grey-box page before Tzvi sees them, one "## <what, date>" heading each in gen/board/judged.md with its Judge lines and "Rating: N/5" (3aj.10)`);
  }
  if (!newer.has('R3aj.11')) {
    // a picture with words on it is planned around where the words sit (rules 3aj.11)
    const w = (/^\s*[-*]\s*words on pictures\s*:(.*)$/im.exec(s) || [])[1] || '';
    if (w.trim().split(/\s+/).length < 6) problems.push('Words on pictures: no "- words on pictures: <picture>: <where the words sit, and on what>" line, or "none" with why; a shade over a picture is the last resort (3aj.11)');
  }
  if (!newer.has('R3aj.14')) {
    // the first screen's photo measured beside the references' before the pick (rules 3aj.14, 26 Nov 2026)
    const l = (/^\s*[-*]\s*light\s*:(.*)$/im.exec(s) || [])[1] || '';
    if ((l.match(/\d+(?:\.\d+)?/g) || []).length < 3) problems.push('Light: no "- light: A 41, B 38, C 52; references 55 and 60 (check-light-pool.py product means)" line: each first screen\'s photo beside the two top sites\' (3aj.14)');
  }
  if (!newer.has('R3aj.17')) {
    // the light on a plain-ground photo has a direction, or flat light was kept on purpose (rules 3aj.17, 27 Nov 2026)
    const l = (/^\s*[-*]\s*light\s*:(.*)$/im.exec(s) || [])[1] || '';
    if (!/spread/i.test(l)) problems.push('Light: the "- light:" line gives no ground spread (check-light-pool.py prints it for a photo on a plain ground; write "spread: none, scene" for a scene) (3aj.17)');
    else if (/\beven\b/i.test(l) && !/re-?lit|kept even\s*:/i.test(l)) problems.push('Light: an EVEN first screen (no direction of light) says neither "re-lit" nor "kept even: <why>" on the "- light:" line (3aj.17)');
  }
  if (!newer.has('R3aj.15')) {
    // the signature returns through the page (rules 3aj.15, 26 Nov 2026)
    const t = (/^\s*[-*]\s*thread\s*:(.*)$/im.exec(s) || [])[1] || '';
    if (t.split(/[,;]/).filter((x) => x.trim()).length < 3) problems.push('Thread: no "- thread: <the idea>; returns as <place 1>, <place 2>" line: the signature comes back at least twice in a small form (3aj.15)');
  }
  return problems;
}

if (process.argv[1] && path.resolve(process.argv[1]) === path.resolve(new URL(import.meta.url).pathname.replace(/^\/([A-Za-z]:)/, '$1'))) {
  const arg = process.argv[2];
  if (!arg) { console.error('usage: node scripts/check-concept.mjs <build-folder>'); process.exit(2); }
  const dir = fs.existsSync(arg) ? arg : path.join(ROOT, 'scrollcraft', 'builds', arg);
  const p = checkConcept(dir);
  if (p.length) { console.error(`CONCEPT not ready for ${path.basename(dir)}:\n- ${p.join('\n- ')}`); process.exit(1); }
  console.log(`concept ready for ${path.basename(dir)}`);
}
