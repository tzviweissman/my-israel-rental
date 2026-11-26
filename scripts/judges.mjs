/**
 * Two judges, per area, corrected by Tzvi; and his feedback kept until it is proved fixed (Tzvi, 22 Nov 2026: "All 7",
 * from the Cook loop by the author of taste-skill; rules 3aj.4 and 3aj.6). check-build and publish-page ask here.
 *
 * review.md holds one line per judge, each a fresh Sonnet subagent that did not build the site and is given only the
 * screens beside the two top sites (compare.jpg) and the scale, never the builder's opinion:
 *   Judge 1: layout 4, light 4, colour 3.5, type 4, detail 4, motion 4
 *   Judge 2: layout 4.5, light 4, colour 4, type 4, detail 3.5, motion 4
 * The median of each area is taken; the rating is their average plus the calibration (docs/judge-calibration.json,
 * never above 0). It passes at 4 or more with no area under 3.5 (one weak area cannot hide behind the rest). When two
 * judges differ by more than 1 on an area, a third is asked. review.md's "Rating: N/5" line must say the result.
 *
 * docs/judge-calibration.json: [{"date", "site", "judged": 4.2, "tzvi": 3, "words": "very basic"}, ...]. Every
 * verdict Tzvi gives on a judged site is added, his words and the number they mean on the judge's scale
 * (5 one of the best of its kind anywhere, 4 clearly professional, 3 a decent small-business site). The offset is the
 * average of tzvi minus judged over the last five, so the judges are held to his eye.
 *
 * FEEDBACK.md in a build: every correction Tzvi gives about it, his exact words, one per line:
 *   - open: "the iron floats away, it needs to look natural" (22 Nov 2026)
 *   - done: "the iron floats away..." (22 Nov 2026) proof: gen/fire/film-sheet.jpg
 * A build with an open item, or a done item whose proof file is missing, is not shown or published.
 *
 *   node scripts/judges.mjs --brief             prints the brief every judge is given, word for word
 *   node scripts/judges.mjs <build-folder>      prints the rating and the feedback state; exit 1 on a problem.
 *   node scripts/judges.mjs <file.md>           rates one judging file, such as gen/board/judged.md (rules 3aj.10).
 */
import fs from 'node:fs';
import path from 'node:path';

const ROOT = path.resolve(path.dirname(new URL(import.meta.url).pathname.replace(/^\/([A-Za-z]:)/, '$1')), '..');
const AREAS = ['layout', 'light', 'colour', 'type', 'detail', 'motion', 'wow'];
// wow joined on 23 Nov 2026; a review judged before it has six areas and is read with six
const OLD = AREAS.slice(0, 6);

// The brief every judge is given, word for word (Tzvi, 23 Nov 2026: "I want the judgement to be mainly based off of how
// the actual site actually looks more than if there's reviews. I'll want my sites to look unique, memorable and
// beautiful with amazing eye catching effects like our inspo and websites sources and Pinterest"). Two judges were
// marking Clean Plus down first for having no reviews, which only the owner can give and no design change can fix.
export const JUDGE_BRIEF = `You are a design judge. You did not build this site and have no stake in it.
You are shown our site beside the best sites of its kind and the inspiration it was built from (our studied sites,
website sources and Pinterest picks). Judge only how our site LOOKS and MOVES: is it unique, memorable and beautiful,
with eye-catching effects a visitor would remember, as good as those references?
Do NOT mark it down for missing reviews, ratings, testimonials, press logos, team photos, FAQs or for how much content
it has: those come from the owner later. Judge the design of what is there.
The pictures are stills taken after each screen has finished arriving; a still cannot show motion, so judge motion
from the contact sheet of the recorded preview and the motion notes you are given, never from a still alone.
Score seven areas from 1 to 5 (half points allowed):
  layout (composition, rhythm, variety between sections), light (depth, photography, light and shadow),
  colour, type, detail (finish, craft, small touches), motion (effects and how things move and react),
  wow (unique, memorable, eye-catching: would someone remember this site tomorrow and show it to a friend?).
Scale: 5 one of the most striking sites of its kind anywhere; 4 clearly professional and memorable, level with the
references; 3 a decent but forgettable small-business site. Be strict; compare directly with the references.
Answer with one line first, exactly:
Judge: layout N, light N, colour N, type N, detail N, motion N, wow N
then up to 5 short bullets: what would most make the site more striking, naming the screen.`;
const median = (v) => { const s = [...v].sort((a, b) => a - b), m = s.length >> 1; return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2; };

export function calibration() {
  try {
    const rows = JSON.parse(fs.readFileSync(path.join(ROOT, 'docs', 'judge-calibration.json'), 'utf8')).slice(-5);
    if (!rows.length) return 0;
    return Math.min(0, rows.reduce((s, r) => s + (r.tzvi - r.judged), 0) / rows.length);
  } catch { return 0; }
}

export function judgeReview(text) {
  const lines = [...text.matchAll(/^Judge\s*\d+\s*:(.*)$/gim)];
  // the newest judging only: the lines after the last heading that holds a Judge line
  const last = text.lastIndexOf('\n## ', lines.length ? lines[lines.length - 1].index : 0);
  const now = lines.filter((m) => m.index > last);
  const areas = now.every((m) => /\bwow\s*\d/i.test(m[1])) ? AREAS : OLD;
  const judges = now.map((m) => Object.fromEntries(areas.map((a) => [a, Number((new RegExp(`${a}\\s*(\\d(?:\\.\\d+)?)`, 'i').exec(m[1]) || [])[1])])));
  if (judges.length < 2) return { why: `review.md has ${judges.length} "Judge N: layout .., light .., colour .., type .., detail .., motion .." lines; two judges that did not build the site (3aj.4)` };
  const missing = judges.flatMap((j, i) => areas.filter((a) => !(j[a] >= 1 && j[a] <= 5)).map((a) => `judge ${i + 1} ${a}`));
  if (missing.length) return { why: `review.md judges miss a score from 1 to 5 for: ${missing.join(', ')} (3aj.4)` };
  const apart = areas.filter((a) => Math.max(...judges.map((j) => j[a])) - Math.min(...judges.map((j) => j[a])) > 1);
  if (apart.length && judges.length < 3) return { why: `the judges differ by more than 1 on ${apart.join(', ')}: ask a third judge (3aj.4)` };
  const med = Object.fromEntries(areas.map((a) => [a, median(judges.map((j) => j[a]))]));
  const off = calibration();
  const rating = Math.round((areas.reduce((s, a) => s + med[a], 0) / areas.length + off) * 100) / 100;
  const low = areas.filter((a) => med[a] + off < 3.5);
  const said = Number((/^Rating:\s*(\d(?:\.\d+)?)\s*\/\s*5/m.exec(text) || [])[1]);
  const why = rating < 4 ? `rated ${rating} of 5 after calibration ${off.toFixed(2)} (areas ${areas.map((a) => `${a} ${med[a]}`).join(', ')}): fix the lowest and judge again until 4 (3aj.4)`
    : low.length ? `${low.join(', ')} under 3.5 after calibration: one weak area cannot hide behind the rest (3aj.4)`
    : !(Math.abs(said - rating) < 0.06) ? `review.md's "Rating:" line must say ${rating}/5 (median per area, calibration ${off.toFixed(2)})` : '';
  return { why, rating, med, off };
}

export function feedbackProblems(dir) {
  const f = path.join(dir, 'FEEDBACK.md');
  if (!fs.existsSync(f)) return ['no FEEDBACK.md: Tzvi\'s corrections about this build, his exact words, one "- open:" or "- done: ... proof: <file>" line each, or "- none yet" (3aj.6)'];
  const out = [];
  for (const l of fs.readFileSync(f, 'utf8').split(/\r?\n/)) {
    if (/^\s*-\s*open\s*:/i.test(l)) out.push(`open feedback: ${l.replace(/^\s*-\s*open\s*:\s*/i, '').slice(0, 140)}`);
    const proof = /^\s*-\s*done\s*:.*\bproof:\s*(\S+)/i.exec(l);
    if (/^\s*-\s*done\s*:/i.test(l) && (!proof || !fs.existsSync(path.join(dir, proof[1])))) out.push(`done feedback without a proof file in the build: ${l.trim().slice(0, 140)}`);
  }
  return out;
}

if (process.argv[1] && path.resolve(process.argv[1]) === path.resolve(new URL(import.meta.url).pathname.replace(/^\/([A-Za-z]:)/, '$1'))) {
  if (process.argv[2] === '--brief') { console.log(JUDGE_BRIEF); process.exit(0); }
  const dir = process.argv[2] && (fs.existsSync(process.argv[2]) ? process.argv[2] : path.join(ROOT, 'scrollcraft', 'builds', process.argv[2]));
  if (!dir) { console.error('usage: node scripts/judges.mjs <build-folder>'); process.exit(2); }
  // a judging file on its own, such as a build's gen/board/judged.md (rules 3aj.10): only the rating, no feedback check
  if (/\.md$/i.test(dir)) {
    const j = judgeReview(fs.readFileSync(dir, 'utf8'));
    console.log(j.rating !== undefined ? `rating ${j.rating}/5 (calibration ${j.off.toFixed(2)})` : 'no rating yet');
    if (j.why) console.log(`- ${j.why}`);
    process.exit(j.why ? 1 : 0);
  }
  const review = path.join(dir, 'review.md');
  const j = fs.existsSync(review) ? judgeReview(fs.readFileSync(review, 'utf8')) : { why: 'no review.md' };
  const fb = feedbackProblems(dir);
  console.log(j.rating !== undefined ? `rating ${j.rating}/5 (calibration ${j.off.toFixed(2)})` : 'no rating yet');
  for (const p of [j.why, ...fb].filter(Boolean)) console.log(`- ${p}`);
  process.exitCode = j.why || fb.length ? 1 : 0;
}
