// What the check found, in the owner's words. The check reports in its own
// terms ("he-390: hero text too faint ... 2.4:1"); an owner needs to know what
// is wrong, not which ratio. Unknown findings fall back to a general line.
const REASONS = [
  [/too close|too much like/, 'reasonTooClose', 'A page that went live since this was made looks too much like it. Make new versions.'],
  [/faint/, 'reasonFaint', 'Some text is hard to read over the picture'],
  [/sideways scroll/, 'reasonSideways', 'Part of the page spills off the side of a phone screen'],
  [/hidden/, 'reasonHidden', 'Some text did not appear'],
  [/cut off|off screen/, 'reasonCut', 'Something is cut off on a smaller screen'],
  [/did not open/, 'reasonExpired', 'The check could not open this version. Check it again.'],
  [/could not finish|did not render|page error/, 'reasonBroken', 'The page did not load properly during the check. Check it again.'],
];
export function plainReasons(failures, t) {
  const out = [];
  (failures || []).forEach((f) => {
    const hit = REASONS.find(([re]) => re.test(f));
    const line = hit ? t(`pageVersions.${hit[1]}`, hit[2]) : t('pageVersions.reasonOther', 'Something did not look right on one screen size');
    if (!out.includes(line)) out.push(line);
  });
  return out;
}
