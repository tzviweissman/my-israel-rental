/**
 * Where a coach-mark tooltip goes, and which way its arrow points.
 *
 * Pure geometry, deliberately: no DOM, no React. It is the part of the tour
 * most likely to be wrong and the part hardest to eyeball, so it is a
 * function that can be tested with numbers — see
 * `scripts/test-tour-placement.mjs`, which runs every case in both
 * directions in milliseconds.
 *
 * WHY THIS IS WRITTEN BY HAND RATHER THAN TAKEN FROM A LIBRARY
 * -----------------------------------------------------------
 * `react-joyride`, `driver.js`, `shepherd.js` and `intro.js` all position
 * with physical left/right offsets and have weak RTL support. Half the
 * people this tutorial is for read Hebrew, and a tour that mispositions
 * under `dir="rtl"` is a tutorial broken for half its audience. The spec
 * calls that out as THE failure mode, so placement is logical throughout:
 * preferences are expressed as `start`/`end`, and physical pixels are
 * computed from `dir` only at the last step.
 */

/** Preference order. Below the target first — it is where a reader's eye
 *  already is, and it does not cover what was just pointed at. */
const ORDER = ['bottom', 'top', 'end', 'start'];

const clamp = (v, lo, hi) => Math.min(Math.max(v, lo), hi);

/**
 * @param {{top:number,left:number,width:number,height:number}} target
 * @param {{width:number,height:number}} tooltip
 * @param {{width:number,height:number}} viewport
 * @param {'ltr'|'rtl'} dir
 * @param {number} gap    space between target and tooltip
 * @param {number} margin minimum distance from the viewport edge
 * @returns {{placement:string, top:number, left:number,
 *            arrow:{top:number,left:number,side:string}}}
 */
export function computePlacement({
  target, tooltip, viewport, dir = 'ltr', gap = 14, margin = 10,
}) {
  const t = {
    top: target.top,
    left: target.left,
    right: target.left + target.width,
    bottom: target.top + target.height,
    cx: target.left + target.width / 2,
    cy: target.top + target.height / 2,
  };
  const tw = tooltip.width;
  const th = tooltip.height;

  // A logical side resolved to a physical one. This single mapping is the
  // whole RTL story: everything above it is direction-agnostic.
  const physical = (side) => {
    if (side === 'start') return dir === 'rtl' ? 'right' : 'left';
    if (side === 'end') return dir === 'rtl' ? 'left' : 'right';
    return side;
  };

  const fits = (side) => {
    const p = physical(side);
    if (p === 'bottom') return t.bottom + gap + th <= viewport.height - margin;
    if (p === 'top') return t.top - gap - th >= margin;
    if (p === 'right') return t.right + gap + tw <= viewport.width - margin;
    return t.left - gap - tw >= margin;   // 'left'
  };

  // First that fits; otherwise the side with the most room, so a tooltip
  // bigger than every gap still lands somewhere sensible rather than
  // off-screen.
  let chosen = ORDER.find(fits);
  if (!chosen) {
    const room = {
      bottom: viewport.height - t.bottom,
      top: t.top,
      end: physical('end') === 'right' ? viewport.width - t.right : t.left,
      start: physical('start') === 'right' ? viewport.width - t.right : t.left,
    };
    chosen = ORDER.reduce((best, s) => (room[s] > room[best] ? s : best), ORDER[0]);
  }

  const side = physical(chosen);
  let top;
  let left;

  if (side === 'bottom' || side === 'top') {
    top = side === 'bottom' ? t.bottom + gap : t.top - gap - th;
    // Centred on the target, then clamped inside the viewport. The clamp is
    // why the arrow is positioned separately below: once the box has been
    // pushed away from the edge it is no longer centred on what it points at.
    left = clamp(t.cx - tw / 2, margin, Math.max(margin, viewport.width - tw - margin));
  } else {
    left = side === 'right' ? t.right + gap : t.left - gap - tw;
    top = clamp(t.cy - th / 2, margin, Math.max(margin, viewport.height - th - margin));
  }

  // Keep it on screen even in the no-good-side case above.
  top = clamp(top, margin, Math.max(margin, viewport.height - th - margin));
  left = clamp(left, margin, Math.max(margin, viewport.width - tw - margin));

  /* The arrow points from the tooltip back at the target, and is placed
     against the target's centre rather than the tooltip's — those differ
     whenever the box was clamped, and an arrow centred on the box would
     point at empty space beside the control. Inset from the corners so it
     never overhangs a rounded edge. */
  const INSET = 16;
  const arrow = { side, top: 0, left: 0 };
  if (side === 'bottom' || side === 'top') {
    arrow.left = clamp(t.cx - left, INSET, Math.max(INSET, tw - INSET));
    arrow.top = side === 'bottom' ? 0 : th;
  } else {
    arrow.top = clamp(t.cy - top, INSET, Math.max(INSET, th - INSET));
    arrow.left = side === 'right' ? 0 : tw;
  }

  return { placement: side, top: Math.round(top), left: Math.round(left), arrow };
}

export default computePlacement;
