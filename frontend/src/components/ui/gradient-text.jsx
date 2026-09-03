/**
 * GradientText — a word or phrase lit from behind by four slow-drifting
 * colour blobs.
 *
 * Ported from a TypeScript source (this project is CRA + JavaScript). Needs
 * `motion`, already installed, and four keyframe sets plus the five colour
 * variables, both added alongside this file.
 *
 * HOW IT WORKS, because it is not obvious: the blobs are enormous — 30% of
 * the viewport each — and the element clips them. `mix-blend-lighten` over a
 * white fill means only colour LIGHTER than the text shows, so the letters
 * stay legible while the field behind them moves. The blobs also morph their
 * own border radius, which is what stops it reading as four circles.
 *
 * ONE CHANGE: the source hardcodes `bg-white dark:bg-black`. This page is
 * white by theme, so the fill is the surface token — a gradient word on a
 * hardcoded white patch would show a seam on any section that is not pure
 * white.
 */
"use client";

import React from "react";
import { motion } from "motion/react";

import { cn } from "@/lib/utils";

function GradientText({ className, children, as: Component = "span", ...props }) {
  const MotionComponent = React.useMemo(() => motion.create(Component), [Component]);

  return (
    <MotionComponent
      className={cn(
        "relative inline-flex overflow-hidden bg-[var(--surface,#fff)]",
        className,
      )}
      {...props}
    >
      {children}
      {/* `gradient-breathe` fades the whole light layer in and out, so the
          phrase goes ink → colour → ink rather than staying lit. */}
      <span className="pointer-events-none absolute inset-0 mix-blend-lighten animate-[gradient-breathe_7s_ease-in-out_infinite] motion-reduce:animate-none motion-reduce:opacity-100">
        <span className="pointer-events-none absolute -top-1/2 h-[30vw] w-[30vw] animate-[gradient-border_6s_ease-in-out_infinite,gradient-1_12s_ease-in-out_infinite_alternate] bg-[hsl(var(--color-1))] mix-blend-overlay blur-[1rem]" />
        <span className="pointer-events-none absolute right-0 top-0 h-[30vw] w-[30vw] animate-[gradient-border_6s_ease-in-out_infinite,gradient-2_12s_ease-in-out_infinite_alternate] bg-[hsl(var(--color-2))] mix-blend-overlay blur-[1rem]" />
        <span className="pointer-events-none absolute bottom-0 left-0 h-[30vw] w-[30vw] animate-[gradient-border_6s_ease-in-out_infinite,gradient-3_12s_ease-in-out_infinite_alternate] bg-[hsl(var(--color-3))] mix-blend-overlay blur-[1rem]" />
        <span className="pointer-events-none absolute -bottom-1/2 right-0 h-[30vw] w-[30vw] animate-[gradient-border_6s_ease-in-out_infinite,gradient-4_12s_ease-in-out_infinite_alternate] bg-[hsl(var(--color-4))] mix-blend-overlay blur-[1rem]" />
      </span>
    </MotionComponent>
  );
}

export { GradientText };
export default GradientText;
