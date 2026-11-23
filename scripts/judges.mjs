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
 *   node scripts/judges.mjs <build-folder>      prints the rating and the feedback state; exit 1 on a problem.
 *                                              Run it before judging too: a NO PROOF line means ask the owner first.
 */
import fs from 'node:fs';
import path from 'node:path';

const ROOT = path.resolve(path.dirname(new URL(import.meta.url).pathname.replace(/^\/([A-Za-z]:)/, '$1')), '..');
const AREAS = ['layout', 'light', 'colour', 'type', 'detail', 'motion'];
const median = (v) => { const s = [...v].sort((a, b) => a - b), m = s.length >> 1; return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2; };

export function calibration() {
  try {
    const rows = JSON.parse(fs.readFileSync(path.join(ROOT, 'docs', 'judge-calibration.json'), 'utf8')).slice(-5);
    if (!rows.length) return 0;
    return Math.min(0, rows.reduce((s, r) => s + (r.tzvi - r.judged), 0) / rows.length);
  } catch { return 0; }
}

export function judgeReview(text) {
  const judges = [...text.matchAll(/^Judge\s*\d+\s*:(.*)$/gim)].map((m) => Object.fromEntries(AREAS.map((a) => [a, Number((new RegExp(`${a}\\s*(\\d(?:\\.\\d+)?)`, 'i').exec(m[1]) || [])[1])])));
  if (judges.length < 2) return { why: `review.md has ${judges.length} "Judge N: layout .., light .., colour .., type .., detail .., motion .." lines; two judges that did not build the site (3aj.4)` };
  const missing = judges.flatMap((j, i) => AREAS.filter((a) => !(j[a] >= 1 && j[a] <= 5)).map((a) => `judge ${i + 1} ${a}`));
  if (missing.length) return { why: `review.md judges miss a score from 1 to 5 for: ${missing.join(', ')} (3aj.4)` };
  const apart = AREAS.filter((a) => Math.max(...judges.map((j) => j[a])) - Math.min(...judges.map((j) => j[a])) > 1);
  if (apart.length && judges.length < 3) return { why: `the judges differ by more than 1 on ${apart.join(', ')}: ask a third judge (3aj.4)` };
  const med = Object.fromEntries(AREAS.map((a) => [a, median(judges.map((j) => j[a]))]));
  const off = calibration();
  const rating = Math.round((AREAS.reduce((s, a) => s + med[a], 0) / AREAS.length + off) * 100) / 100;
  const low = AREAS.filter((a) => med[a] + off < 3.5);
  const said = Number((/^Rating:\s*(\d(?:\.\d+)?)\s*\/\s*5/m.exec(text) || [])[1]);
  const why = rating < 4 ? `rated ${rating} of 5 after calibration ${off.toFixed(2)} (areas ${AREAS.map((a) => `${a} ${med[a]}`).join(', ')}): fix the lowest and judge again until 4 (3aj.4)`
    : low.length ? `${low.join(', ')} under 3.5 after calibration: one weak area cannot hide behind the rest (3aj.4)`
    : !(Math.abs(said - rating) < 0.06) ? `review.md's "Rating:" line must say ${rating}/5 (median per area, calibration ${off.toFixed(2)})` : '';
  return { why, rating, med, off };
}

// Does the home page show any proof (reviews, ratings) a visitor can see? Every top site we compare with does, and
// without it the judges have not reached 4: Clean Plus was judged twice on 23 Nov 2026 (3.25, then about 3.25 again
// after new pictures), both times marked down first for "no reviews, ratings or people". Said before judging, so the
// owner is asked first instead of judging again (Tzvi, 23 Nov 2026: "Do all 3").
export function proofGap(dir) {
  const f = path.join(dir, 'index.html');
  if (!fs.existsSync(f)) return '';
  const seen = fs.readFileSync(f, 'utf8')
    .replace(/<template[\s\S]*?<\/template>/gi, '')
    .replace(/<(section|div)\b[^>]*\shidden\b[^>]*>[\s\S]*?<\/\1>/gi, '')
    .replace(/<script[\s\S]*?<\/script>/gi, '').replace(/<style[\s\S]*?<\/style>/gi, '').replace(/<[^>]+>/g, ' ');
  if (/\breviews?\b|★|\brated\b|\bstars?\b|\btestimonial/i.test(seen)) return '';
  return 'NO PROOF: the home page shows no reviews or ratings; both top references show them and a 4 has not been reached without them. Ask the owner for reviews and their own photos (OWNER-QUESTIONS.md) before judging again';
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
  const dir = process.argv[2] && (fs.existsSync(process.argv[2]) ? process.argv[2] : path.join(ROOT, 'scrollcraft', 'builds', process.argv[2]));
  if (!dir) { console.error('usage: node scripts/judges.mjs <build-folder>'); process.exit(2); }
  const review = path.join(dir, 'review.md');
  const j = fs.existsSync(review) ? judgeReview(fs.readFileSync(review, 'utf8')) : { why: 'no review.md' };
  const fb = feedbackProblems(dir);
  console.log(j.rating !== undefined ? `rating ${j.rating}/5 (calibration ${j.off.toFixed(2)})` : 'no rating yet');
  for (const p of [j.why, ...fb].filter(Boolean)) console.log(`- ${p}`);
  const gap = proofGap(dir);
  if (gap) console.log(`- ${gap}`);
  process.exitCode = j.why || fb.length ? 1 : 0;
}
