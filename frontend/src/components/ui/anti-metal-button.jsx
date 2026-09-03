/**
 * AntiMetalButton — a pill whose accent panel sweeps the full width on hover,
 * carrying a row of pulsing dot-chevrons.
 *
 * Ported from a TypeScript source (this project is CRA + JavaScript;
 * `components.json` has `tsx: false`). No dependencies beyond `cn`.
 *
 * THREE DELIBERATE CHANGES from the source, each required here:
 *
 * 1. COLOURS. The original is lime-on-near-black. The defaults below are this
 *    site's: a solid brand-blue body with white text, and the gold accent with
 *    ink dots on it. Those are the two button treatments the design system
 *    already defines — primary is solid blue with white text, accent is solid
 *    gold with INK text, never white (ink on gold measures 6.71:1; the white-on-
 *    frosted-gold version it replaced measured 1.88:1 on a light page). The
 *    source's `dark:` variants are gone with them: they inverted the button to
 *    white, which is a third treatment this system does not have.
 *
 * 2. LOGICAL DIRECTION. The source pins the label with `right-4` and the sweep
 *    with `left-1`. Every page here has to work in Hebrew, where that puts the
 *    sweep on top of the label. These are `end-4` and `start-1`, so the panel
 *    always enters from the reading-start edge, and the chevrons mirror under
 *    `[dir="rtl"]` so they still point the way the panel travels.
 *
 * 3. THE LABEL SURVIVES THE SWEEP. In the source the accent panel sits above
 *    the label, so at full hover it wipes the text out entirely — the button
 *    is blank at the exact moment someone has decided to press it. Here the
 *    label sits above the panel and turns ink as the panel arrives under it,
 *    so it reads white-on-blue at rest and ink-on-gold hovered, both of which
 *    the palette is built for. The colour change is delayed by the length of
 *    the sweep so the two happen together rather than the text going dark
 *    while it is still over blue.
 *
 * The label is absolutely positioned, so the button needs a width that fits it:
 * the default `w-36` holds about twelve characters. Pass a wider `w-*` (or
 * `w-full`) in `className` for a longer label.
 */
"use client";

import React from "react";

import { cn } from "@/lib/utils";

const DoubleChevron = ({ index, dotColor }) => {
  const base = index * 0.12;
  const dots = [
    { cx: 2, cy: 2, d: 0 },
    { cx: 5, cy: 5, d: 0.05 },
    { cx: 8, cy: 8, d: 0.1 },
    { cx: 5, cy: 11, d: 0.15 },
    { cx: 2, cy: 14, d: 0.2 },
    { cx: 6, cy: 2, d: 0.05 },
    { cx: 9, cy: 5, d: 0.1 },
    { cx: 12, cy: 8, d: 0.15 },
    { cx: 9, cy: 11, d: 0.2 },
    { cx: 6, cy: 14, d: 0.25 },
  ];

  return (
    <svg
      width="14"
      height="16"
      viewBox="0 0 14 16"
      aria-hidden="true"
      focusable="false"
      className="shrink-0 overflow-visible rtl:-scale-x-100"
    >
      <g fill={dotColor}>
        {dots.map((p, i) => (
          <circle
            key={i}
            cx={p.cx}
            cy={p.cy}
            r="1"
            className="bd-dot"
            style={{ animationDelay: `${base + p.d}s` }}
          />
        ))}
      </g>
    </svg>
  );
};

export const AntiMetalButton = React.forwardRef(
  (
    {
      className,
      children,
      label,
      accentFrom = "#D4AC33",
      accentTo = "#C9A227",
      dotColor = "#23201B",
      ...props
    },
    ref,
  ) => {
    const content = label ?? children ?? "Book a demo";

    return (
      <button
        ref={ref}
        className={cn(
          "group/btn relative inline-flex h-11 w-36 overflow-hidden rounded-xl transition-transform active:scale-[0.98] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background",
          "bg-[linear-gradient(180deg,#1E5F8C_0%,#123B57_100%)] shadow-[inset_0_1px_0_rgba(255,255,255,0.14),0_4px_12px_rgba(18,59,87,0.22)]",
          className,
        )}
        {...props}
      >
        <style>{`
          @keyframes bd-dot-wave {
            0%, 70%, 100% { opacity: 0.25; transform: scale(0.85); }
            35% { opacity: 1; transform: scale(1); }
          }
          .bd-dot {
            transform-box: fill-box;
            transform-origin: center;
            animation: bd-dot-wave 1.4s ease-in-out infinite;
          }
          @media (prefers-reduced-motion: reduce) {
            .bd-dot { animation: none; opacity: 1; }
          }
        `}</style>

        <span className="absolute inset-y-0 end-4 z-20 flex items-center text-[14px] font-semibold tracking-tight text-white transition-colors duration-150 delay-150 group-hover/btn:text-[#23201B]">
          {content}
        </span>

        <span
          aria-hidden="true"
          className="absolute bottom-1 start-1 top-1 z-10 flex w-9 items-center justify-start gap-2.5 overflow-hidden rounded-md ps-3 pe-2.5 transition-[width,gap] duration-200 ease-[cubic-bezier(0.65,0,0.35,1)] group-hover/btn:w-[calc(100%-0.5rem)]"
          style={{
            background: `linear-gradient(180deg, ${accentFrom} 0%, ${accentTo} 100%)`,
            boxShadow:
              "inset 0 1px 0 rgba(255,255,255,0.4), inset 0 -2px 4px rgba(0,0,0,0.12), 0 2px 4px rgba(0,0,0,0.08)",
          }}
        >
          <DoubleChevron index={0} dotColor={dotColor} />
          <DoubleChevron index={1} dotColor={dotColor} />
          <DoubleChevron index={2} dotColor={dotColor} />
          <DoubleChevron index={3} dotColor={dotColor} />
          <DoubleChevron index={4} dotColor={dotColor} />
        </span>
      </button>
    );
  },
);

AntiMetalButton.displayName = "AntiMetalButton";

export default AntiMetalButton;
