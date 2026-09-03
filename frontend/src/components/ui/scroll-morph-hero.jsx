/**
 * scroll-morph-hero — a ring of flip-cards that morphs into an arch as a
 * scroll progress value runs from 0 to 1.
 *
 * Ported from a TypeScript source. This project is CRA + JavaScript
 * (`components.json` has `tsx: false`), so the types became JSDoc. It also
 * needs no new dependency: the source imports `framer-motion`, and `motion`
 * — already installed for the CTA gallery — is the same API under its
 * current name. Two animation libraries doing one job is how a bundle
 * doubles for nothing.
 *
 * THREE CHANGES FROM THE SOURCE, all forced by putting it in a page rather
 * than on a page of its own:
 *
 * 1. IT NO LONGER HIJACKS THE WHEEL. The original attaches a `wheel`
 *    listener with `preventDefault()` and drives itself from a virtual
 *    scroll counter. Dropped into a section halfway down a page, that traps
 *    the reader: the page stops moving while the pointer is over it, and on
 *    a phone the same is true of a drag. It now takes a `progress`
 *    MotionValue from its parent, which is also what lets the words beside
 *    it move in step — one scroll, two things responding.
 *
 * 2. NO INTRO TIMERS. The source runs scatter → line → circle on
 *    setTimeout, so the whole show plays out while the section is still far
 *    below the fold and is over before anybody sees it. The ring is its
 *    resting state and the scroll does the rest.
 *
 * 3. ITS OWN COPY IS GONE. The headings the source draws over the cards
 *    belong to the page here, on the other side of the section.
 *
 * `prefers-reduced-motion` is honoured by the caller passing `reduced`,
 * which pins the layout to the finished arch and stops the springs.
 */
"use client";

import React from "react";
import { motion, useMotionValueEvent } from "motion/react";

const IMG_WIDTH = 60;
const IMG_HEIGHT = 85;

/** Linear interpolation. */
const lerp = (start, end, t) => start * (1 - t) + end * t;

/**
 * @typedef {Object} MorphCard
 * @property {string} src
 * @property {string} [alt]
 * @property {string} [title]
 * @property {string} [sub]
 * @property {string} [href]
 */

function FlipCard({ card, index, target, reduced, onOpen }) {
  const inner = (
    <motion.div
      className="relative h-full w-full"
      style={{ transformStyle: "preserve-3d" }}
      transition={{ duration: 0.6, type: "spring", stiffness: 260, damping: 20 }}
      whileHover={reduced ? undefined : { rotateY: 180 }}
    >
      {/* Front */}
      <div
        className="absolute inset-0 h-full w-full overflow-hidden rounded-xl shadow-lg"
        style={{ backfaceVisibility: "hidden", background: "var(--surface-muted, #f9fafb)" }}
      >
        <img
          src={card.src}
          alt={card.alt || ""}
          loading="lazy"
          decoding="async"
          draggable={false}
          className="h-full w-full object-cover"
        />
      </div>

      {/* Back — the card names what it is showing rather than saying
          "Details", which is the source's placeholder. */}
      <div
        className="absolute inset-0 h-full w-full overflow-hidden rounded-xl shadow-lg flex flex-col items-center justify-center p-2 text-center"
        style={{
          backfaceVisibility: "hidden",
          transform: "rotateY(180deg)",
          background: "var(--ink, #111827)",
          color: "#fff",
        }}
      >
        <p className="text-[7px] font-bold uppercase tracking-widest" style={{ color: "var(--brand-primary, #1C8DD4)" }}>
          {card.sub || ""}
        </p>
        <p className="mt-1 text-[9px] font-semibold leading-tight line-clamp-3">{card.title || ""}</p>
      </div>
    </motion.div>
  );

  return (
    <motion.div
      animate={{
        x: target.x,
        y: target.y,
        rotate: target.rotation,
        scale: target.scale,
        opacity: target.opacity,
      }}
      transition={reduced ? { duration: 0 } : { type: "spring", stiffness: 40, damping: 15 }}
      style={{
        position: "absolute",
        width: IMG_WIDTH,
        height: IMG_HEIGHT,
        transformStyle: "preserve-3d",
        perspective: "1000px",
      }}
      className={onOpen ? "cursor-pointer group" : "group"}
      onClick={onOpen ? () => onOpen(card) : undefined}
      data-testid={`morph-card-${index}`}
    >
      {inner}
    </motion.div>
  );
}

/**
 * @param {Object} props
 * @param {MorphCard[]} props.cards
 * @param {import('motion/react').MotionValue<number>} props.progress 0 → 1 across the section.
 * @param {boolean} [props.reduced]
 * @param {(card: MorphCard) => void} [props.onOpen]
 * @param {string} [props.className]
 */
export default function ScrollMorphCards({ cards, progress, reduced = false, onOpen, className }) {
  const containerRef = React.useRef(null);
  const [size, setSize] = React.useState({ width: 0, height: 0 });
  const [value, setValue] = React.useState(reduced ? 1 : 0);

  React.useEffect(() => {
    const el = containerRef.current;
    if (!el || typeof ResizeObserver === "undefined") return undefined;
    const set = () => setSize({ width: el.offsetWidth, height: el.offsetHeight });
    set();
    const ro = new ResizeObserver(set);
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  // The parent's scroll progress, read into state so the layout maths below
  // can run in render. Cheap: one number, and the cards are already
  // re-rendered by their own spring.
  useMotionValueEvent(progress, "change", (v) => {
    if (!reduced) setValue(v);
  });

  const total = cards.length;
  // The ring becomes the arch over the first 62% and the arch then drifts a
  // little to 95%. Both finish BEFORE the words do, which is the order asked
  // for: the passage should still be arriving when the picture has settled,
  // not the other way round.
  const morph = reduced ? 1 : Math.min(1, Math.max(0, value / 0.62));
  const sweep = reduced ? 0 : Math.min(1, Math.max(0, (value - 0.62) / 0.33));

  return (
    <div
      ref={containerRef}
      className={`relative h-full w-full overflow-hidden ${className || ""}`}
      data-testid="scroll-morph"
    >
      <div className="relative flex h-full w-full items-center justify-center">
        {cards.map((card, i) => {
          const isMobile = size.width < 768;
          const minDimension = Math.min(size.width, size.height) || 400;

          // The ring fills its frame. It was capped at 260px, which on a
          // 640px stage drew a modest circle floating in white space - the
          // reference fills the frame edge to edge, and "you're not showing
          // the entire scene" is what a shrunken one looks like.
          const circleRadius = minDimension * 0.42;
          const circleAngle = (i / total) * 360;
          const circleRad = (circleAngle * Math.PI) / 180;
          const circlePos = {
            x: Math.cos(circleRad) * circleRadius,
            y: Math.sin(circleRad) * circleRadius,
            rotation: circleAngle + 90,
          };

          const spreadAngle = isMobile ? 116 : 130;
          const halfSpreadRad = ((spreadAngle / 2) * Math.PI) / 180;
          const w = size.width || 400;
          const h = size.height || 400;

          // A WIDE, SHALLOW RAINBOW that spans the frame, with its ends
          // running off the sides. An earlier version solved for an arch that
          // fitted entirely inside the box with a margin for the outermost
          // card, which produced a small tidy arc adrift in white space. The
          // reference crops at both edges on purpose: that is what makes it
          // read as one big shape rather than a row of pictures.
          //
          // Half the arch's width is r·cos(25°) ≈ 0.906r, so a radius of
          // ~0.62w puts the ends a little past the frame.
          const arcRadius = Math.max(240, w * 0.8);
          // The cards are positioned from the CENTRE of the box, not its top,
          // so the source's `apex + radius` pushed the whole arch down by half
          // the container. Placing the crown just above centre leaves the ends
          // dropping toward the bottom corners, which is the reference shape.
          // The crown sits just below the middle of the frame, which drops the
          // ends into the bottom corners and crops them there - the shape in
          // the reference. Placing the crown high instead left the whole
          // lower half of the stage empty.
          const arcCenterY = arcRadius - h * (isMobile ? 0.02 : 0.08);
          const startAngle = -90 - spreadAngle / 2;
          const step = spreadAngle / Math.max(total - 1, 1);
          // 0.12, well under the source's 0.8. The original is a full-screen
          // hero where cards are meant to sweep off; at anything like that
          // rotation a column-sized arch stops being a rainbow and becomes a
          // tilted segment sliding out of frame. This is a nudge, enough to
          // show the arch is still listening to the scroll.
          const boundedRotation = -sweep * (spreadAngle * 0.12);

          const currentArcAngle = startAngle + i * step + boundedRotation;
          const arcRad = (currentArcAngle * Math.PI) / 180;
          const arcPos = {
            x: Math.cos(arcRad) * arcRadius,
            y: Math.sin(arcRad) * arcRadius + arcCenterY,
            rotation: currentArcAngle + 90,
            // Back to the source's scale. The cards on the finished arch are
            // meant to be the biggest thing in the frame - at 1.25 on a wide
            // arch they read as thumbnails on a wire.
            scale: isMobile ? 1.35 : 1.8,
          };

          const target = {
            x: lerp(circlePos.x, arcPos.x, morph),
            y: lerp(circlePos.y, arcPos.y, morph),
            rotation: lerp(circlePos.rotation, arcPos.rotation, morph),
            scale: lerp(1, arcPos.scale, morph),
            opacity: 1,
          };

          return (
            <FlipCard
              key={card.key || i}
              card={card}
              index={i}
              target={target}
              reduced={reduced}
              onOpen={onOpen}
            />
          );
        })}
      </div>
    </div>
  );
}
