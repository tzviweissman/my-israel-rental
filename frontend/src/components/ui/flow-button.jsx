/**
 * FlowButton — an outline pill whose arrow slides through it while a dark
 * circle floods the fill, on hover.
 *
 * Ported from a TypeScript source (this project is CRA + JavaScript;
 * `components.json` has `tsx: false`). Only dependency is `lucide-react`,
 * already installed.
 *
 * COLOURS: the source's `#111111` is this theme's ink and its solid action,
 * so the recolour is a swap to the tokens rather than a redesign — outline
 * and ink at rest, black fill and white text on hover. It suits a white page
 * because at rest it is almost nothing: a hairline and a word.
 *
 * TWO CHANGES:
 *
 * 1. IT TAKES `onClick` AND THE REST. The source renders a bare button with
 *    a `text` prop and no way to make it do anything, which is fine for a
 *    demo tile and useless in a page. Props are forwarded.
 *
 * 2. THE ARROWS FLIP UNDER RTL. They are pinned left and right and travel
 *    left-to-right; in Hebrew that runs backwards through the label. The
 *    pair mirrors, so the movement always follows the reading direction.
 */
"use client";

import React from "react";
import { ArrowRight } from "lucide-react";

import { cn } from "@/lib/utils";

/**
 * @param {Object} props
 * @param {string} [props.text]
 * @param {React.ElementType} [props.as='button'] Render as something else -
 *   the preview's nav pills are router Links, and a link that is really a
 *   button loses middle-click, hover URL and "open in new tab".
 */
export function FlowButton({ text = "Modern Button", className, as: Tag = "button", ...props }) {
  return (
    <Tag
      {...(Tag === "button" ? { type: "button" } : {})}
      className={cn(
        "group/flow relative flex items-center gap-1 overflow-hidden rounded-[100px]",
        "border-[1.5px] border-[var(--ink)]/35 bg-transparent px-8 py-3 text-sm font-semibold text-[var(--ink)]",
        "cursor-pointer transition-all duration-[600ms] ease-[cubic-bezier(0.23,1,0.32,1)]",
        "hover:border-transparent hover:text-white hover:rounded-[12px] active:scale-[0.95]",
        className,
      )}
      {...props}
    >
      {/* The arrow that waits outside and slides in. */}
      <ArrowRight
        aria-hidden="true"
        // Logical `start`/`end`, so in Hebrew the arrow that slides in
        // arrives on the right, where the mirrored label now is. Physical
        // left/right kept it on the LTR side. (2026-09-04 audit, finding 6.)
        className="absolute w-4 h-4 start-[-25%] stroke-[var(--ink)] fill-none z-[9] group-hover/flow:start-4 group-hover/flow:stroke-white transition-all duration-[800ms] ease-[cubic-bezier(0.34,1.56,0.64,1)] rtl:-scale-x-100"
      />

      <span className="relative z-[1] -translate-x-3 group-hover/flow:translate-x-3 rtl:translate-x-3 rtl:group-hover/flow:-translate-x-3 transition-all duration-[800ms] ease-out">
        {text}
      </span>

      {/* The circle that floods the pill. */}
      <span
        aria-hidden="true"
        className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-4 h-4 bg-[var(--action)] rounded-[50%] opacity-0 group-hover/flow:w-[220px] group-hover/flow:h-[220px] group-hover/flow:opacity-100 transition-all duration-[800ms] ease-[cubic-bezier(0.19,1,0.22,1)]"
      />

      {/* The arrow that leaves. */}
      <ArrowRight
        aria-hidden="true"
        className="absolute w-4 h-4 end-4 stroke-[var(--ink)] fill-none z-[9] group-hover/flow:end-[-25%] group-hover/flow:stroke-white transition-all duration-[800ms] ease-[cubic-bezier(0.34,1.56,0.64,1)] rtl:-scale-x-100"
      />
    </Tag>
  );
}

export default FlowButton;
