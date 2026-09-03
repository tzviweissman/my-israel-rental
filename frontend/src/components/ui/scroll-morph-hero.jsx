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
 * 2. THE INTRO IS DRIVEN BY SCROLL, NOT TIMERS. The source runs
 *    scatter → line → circle on setTimeout, which in a page means the whole
 *    opening plays out while the section is still far below the fold and is
 *    finished before anyone sees it. Cutting it altogether was worse: it is
 *    most of the scene. Every stage is a slice of the scroll instead, so the
 *    cards scatter in, gather into a line, close into the ring, open into
 *    the rainbow and then sweep — in that order, at the reader's pace.
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
 * The stage map, as fractions of the scroll.
 *
 * Each shape gets a HOLD after it forms. Without them the line and the ring
 * were only ever passed through on the way to the next thing - the cards
 * were technically in a row, for about a fifth of a second, and the eye read
 * one continuous churn instead of four shapes. A held shape is what makes it
 * a sequence you can follow.
 */
const SCATTER_END = 0.10;   // scattered → line
const LINE_HOLD = 0.20;     // the line, held
const LINE_END = 0.36;      // line      → ring
const RING_HOLD = 0.48;     // the ring, held
const RING_END = 0.80;      // ring      → rainbow
                            // rainbow   → sweeps to the end

/**
 * The scattered starting position for card `i`.
 *
 * Deterministic, not `Math.random()`. The source randomises on mount, which
 * means the cards land somewhere different on every render — and because
 * this component re-renders on every scroll frame, a random scatter would
 * jitter the whole field instead of holding still. A hash of the index gives
 * the same disorder every time.
 */
function scatterAt(index, w, h) {
  const rand = (salt) => {
    const x = Math.sin((index + 1) * 12.9898 + salt * 78.233) * 43758.5453;
    return x - Math.floor(x);
  };
  return {
    x: (rand(1) - 0.5) * w * 1.9,
    y: (rand(2) - 0.5) * h * 1.7,
    rotation: (rand(3) - 0.5) * 180,
    scale: 0.55,
    opacity: 0,
  };
}

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
        style={{
          backfaceVisibility: "hidden",
          WebkitBackfaceVisibility: "hidden",
          background: "var(--surface-muted, #f9fafb)",
        }}
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
          WebkitBackfaceVisibility: "hidden",
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
  // Stage progress. `reduced` pins the whole thing to its finished state:
  // the rainbow, formed, with nothing moving.
  const v = reduced ? 1 : Math.min(1, Math.max(0, value));

  return (
    <div
      ref={containerRef}
      className={`relative h-full w-full overflow-hidden ${className || ""}`}
      data-testid="scroll-morph"
    >
      <div className="relative flex h-full w-full items-center justify-center">
        {cards.map((card, i) => {
          const isMobile = size.width < 768;
          const w = size.width || 400;
          const h = size.height || 400;
          const minDimension = Math.min(w, h);

          // ── the four resting shapes ────────────────────────────────
          const scatter = scatterAt(i, w, h);

          // A line across the middle. The spacing packs the whole set into
          // the frame's width whatever the count, so it reads as one row
          // rather than running off both sides.
          const lineSpacing = Math.min(IMG_WIDTH + 10, (w * 0.92) / total);
          const line = {
            x: (i - (total - 1) / 2) * lineSpacing,
            y: 0,
            rotation: 0,
            scale: 1,
            opacity: 1,
          };

          // The ring fills its frame. It was capped at 260px, which on a
          // 660px stage drew a modest circle floating in white space - the
          // reference fills the frame edge to edge, and "you're not showing
          // the entire scene" is what a shrunken one looks like.
          const circleRadius = minDimension * 0.42;
          const circleAngle = (i / total) * 360;
          const circleRad = (circleAngle * Math.PI) / 180;
          const circle = {
            x: Math.cos(circleRad) * circleRadius,
            y: Math.sin(circleRad) * circleRadius,
            rotation: circleAngle + 90,
            scale: 1,
            opacity: 1,
          };

          const spreadAngle = isMobile ? 116 : 130;

          // A WIDE, SHALLOW RAINBOW that spans the frame, with its ends
          // running off the sides. An earlier version solved for an arch that
          // fitted entirely inside the box with a margin for the outermost
          // card, which produced a small tidy arc adrift in white space. The
          // reference crops at both edges on purpose: that is what makes it
          // read as one big shape rather than a row of pictures.
          const arcRadius = Math.max(240, w * 0.8);
          // The cards are positioned from the CENTRE of the box, not its top,
          // so the source's `apex + radius` pushed the whole arch down by half
          // the container. The crown sits a little above centre, which drops
          // the ends toward the bottom corners where the frame clips them.
          const arcCenterY = arcRadius - h * (isMobile ? 0.02 : 0.08);
          const startAngle = -90 - spreadAngle / 2;
          const step = spreadAngle / Math.max(total - 1, 1);

          // The sweep is the last stage: the formed rainbow travels along its
          // own curve. A nudge, not the source's full rotation, which on a
          // frame this size carries every card out of view.
          const sweep = v <= RING_END ? 0 : (v - RING_END) / (1 - RING_END);
          const arcAngle = startAngle + i * step - sweep * (spreadAngle * 0.35);
          const arcRad = (arcAngle * Math.PI) / 180;
          const arc = {
            x: Math.cos(arcRad) * arcRadius,
            y: Math.sin(arcRad) * arcRadius + arcCenterY,
            rotation: arcAngle + 90,
            // Back to the source's scale. The cards on the finished arch are
            // meant to be the biggest thing in the frame - at 1.25 on a wide
            // arch they read as thumbnails on a wire.
            scale: isMobile ? 1.35 : 1.8,
            opacity: 1,
          };

          // ── which two shapes are we between, and how far ───────────
          const blend = (a, bb, t) => ({
            x: lerp(a.x, bb.x, t),
            y: lerp(a.y, bb.y, t),
            rotation: lerp(a.rotation, bb.rotation, t),
            scale: lerp(a.scale, bb.scale, t),
            opacity: lerp(a.opacity, bb.opacity, t),
          });
          const ease = (t) => t * t * (3 - 2 * t);

          let target;
          if (v < SCATTER_END) {
            target = blend(scatter, line, ease(v / SCATTER_END));
          } else if (v < LINE_HOLD) {
            target = line;
          } else if (v < LINE_END) {
            target = blend(line, circle, ease((v - LINE_HOLD) / (LINE_END - LINE_HOLD)));
          } else if (v < RING_HOLD) {
            target = circle;
          } else if (v < RING_END) {
            target = blend(circle, arc, ease((v - RING_HOLD) / (RING_END - RING_HOLD)));
          } else {
            target = arc;
          }

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
