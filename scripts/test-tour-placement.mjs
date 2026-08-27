/**
 * The tour's placement maths, in both directions.
 *
 * The spec names RTL tooltip placement as THE failure mode of a tour, and
 * says to verify it before writing a line of step copy. This runs first
 * and takes milliseconds, because the geometry is a pure function with no
 * DOM in it.
 *
 * The cases that matter are the mirrored ones. A target hard against the
 * left edge must be pointed at from its `end` side — which is the RIGHT in
 * English and the LEFT in Hebrew. Get that backwards and the tooltip sits
 * off-screen for half the audience while looking perfect for the other
 * half, which is exactly how this ships broken.
 *
 * Usage:
 *   node scripts/test-tour-placement.mjs
 */
import { computePlacement } from '../frontend/src/components/tour/placement.js';

const VP = { width: 1280, height: 800 };
const TIP = { width: 320, height: 180 };
const failures = [];

const check = (name, cond, detail) => {
  if (!cond) failures.push(`${name}: ${detail}`);
};

/** Nothing may ever leave the viewport, in any case, in either direction. */
function assertOnScreen(name, r, vp = VP, tip = TIP) {
  check(name, r.left >= 0, `left ${r.left} is off-screen`);
  check(name, r.top >= 0, `top ${r.top} is off-screen`);
  check(name, r.left + tip.width <= vp.width, `right edge ${r.left + tip.width} > ${vp.width}`);
  check(name, r.top + tip.height <= vp.height, `bottom edge ${r.top + tip.height} > ${vp.height}`);
}

// ---- 1. Plenty of room below: prefer bottom, both directions ----------
for (const dir of ['ltr', 'rtl']) {
  const r = computePlacement({
    target: { top: 100, left: 500, width: 200, height: 40 },
    tooltip: TIP, viewport: VP, dir,
  });
  check(`roomy/${dir}`, r.placement === 'bottom', `expected bottom, got ${r.placement}`);
  assertOnScreen(`roomy/${dir}`, r);
}

// ---- 2. Target near the bottom: flip to top ---------------------------
for (const dir of ['ltr', 'rtl']) {
  const r = computePlacement({
    target: { top: 700, left: 500, width: 200, height: 40 },
    tooltip: TIP, viewport: VP, dir,
  });
  check(`low/${dir}`, r.placement === 'top', `expected top, got ${r.placement}`);
  assertOnScreen(`low/${dir}`, r);
}

// ---- 3. THE RTL CASE. A tall target hugging the LEFT edge -------------
// No room above or below, so the tooltip must go to a side. Logical `end`
// is preferred: physically RIGHT in English, LEFT in Hebrew. There is no
// room on the left here, so Hebrew must fall through to `start` (right)
// rather than placing off-screen.
{
  const target = { top: 10, left: 0, width: 60, height: 780 };
  const ltr = computePlacement({ target, tooltip: TIP, viewport: VP, dir: 'ltr' });
  check('leftEdge/ltr', ltr.placement === 'right', `expected right, got ${ltr.placement}`);
  assertOnScreen('leftEdge/ltr', ltr);

  const rtl = computePlacement({ target, tooltip: TIP, viewport: VP, dir: 'rtl' });
  check('leftEdge/rtl', rtl.placement === 'right',
    `a target on the left edge has no room to its left; expected right, got ${rtl.placement}`);
  assertOnScreen('leftEdge/rtl', rtl);
}

// ---- 4. The mirror: a tall target hugging the RIGHT edge --------------
{
  const target = { top: 10, left: VP.width - 60, width: 60, height: 780 };
  for (const dir of ['ltr', 'rtl']) {
    const r = computePlacement({ target, tooltip: TIP, viewport: VP, dir });
    check(`rightEdge/${dir}`, r.placement === 'left',
      `no room to the right; expected left, got ${r.placement}`);
    assertOnScreen(`rightEdge/${dir}`, r);
  }
}

// ---- 5. Side choice actually mirrors when BOTH sides have room --------
// This is the assertion that would fail if `start`/`end` were hard-coded
// to physical left/right.
{
  const target = { top: 10, left: 590, width: 100, height: 780 };
  const ltr = computePlacement({ target, tooltip: TIP, viewport: VP, dir: 'ltr' });
  const rtl = computePlacement({ target, tooltip: TIP, viewport: VP, dir: 'rtl' });
  check('mirror', ltr.placement === 'right' && rtl.placement === 'left',
    `expected right in ltr and left in rtl, got ${ltr.placement} / ${rtl.placement}`);
  assertOnScreen('mirror/ltr', ltr);
  assertOnScreen('mirror/rtl', rtl);
}

// ---- 6. Clamped box: the arrow still points AT the control ------------
// A target in the far corner pushes the tooltip inward, so the box is no
// longer centred on it. The arrow must follow the target, not the box.
{
  const target = { top: 200, left: 4, width: 40, height: 40 };
  const r = computePlacement({ target, tooltip: TIP, viewport: VP, dir: 'ltr' });
  assertOnScreen('clamped', r);
  const arrowX = r.left + r.arrow.left;
  const targetCx = target.left + target.width / 2;
  check('clamped', Math.abs(arrowX - targetCx) <= 18,
    `arrow at x=${arrowX} does not point at the control at x=${targetCx}`);
}

// ---- 7. A phone. Sides never fit; must go above or below -------------
{
  const vp = { width: 375, height: 667 };
  const tip = { width: 300, height: 160 };
  for (const dir of ['ltr', 'rtl']) {
    const r = computePlacement({
      target: { top: 300, left: 20, width: 335, height: 44 },
      tooltip: tip, viewport: vp, dir,
    });
    check(`phone/${dir}`, ['top', 'bottom'].includes(r.placement),
      `expected top or bottom on a phone, got ${r.placement}`);
    assertOnScreen(`phone/${dir}`, r, vp, tip);
  }
}

// ---- 8. Nothing fits anywhere: still on screen ------------------------
{
  const vp = { width: 360, height: 400 };
  const tip = { width: 320, height: 380 };
  for (const dir of ['ltr', 'rtl']) {
    const r = computePlacement({
      target: { top: 180, left: 150, width: 60, height: 40 },
      tooltip: tip, viewport: vp, dir,
    });
    assertOnScreen(`impossible/${dir}`, r, vp, tip);
  }
}

if (failures.length) {
  console.error('FAILED:');
  failures.forEach((f) => console.error('  -', f));
  process.exit(1);
}
console.log('tour placement: all cases pass in both directions');
