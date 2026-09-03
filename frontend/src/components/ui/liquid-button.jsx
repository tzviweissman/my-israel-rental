/**
 * LiquidButton — a dark slab that fills with a rising, rolling liquid on
 * hover or focus.
 *
 * Ported from a TypeScript source (this project is CRA + JavaScript). No
 * dependencies at all.
 *
 * COLOURS: the source is cyan-on-slate. The slab is the theme's solid
 * action and the liquid is the accent, light at its crest and deep at its
 * base — both read from CSS variables (`--action`, `--liquid-a/b/c`) with
 * the flow theme's blues as fallbacks, so a palette swap reaches this
 * button without anyone editing a Tailwind class. Nothing else changed: the two counter-rotating
 * wave discs, the rising bubbles and the hairline along the top are the
 * author's.
 *
 * WHY THIS ONE IS USED ONCE. It is the loudest control in the system, so it
 * marks the single action the page most wants: everything else keeps the
 * quieter treatments. Two of these on one screen and neither is the answer
 * to "what do I do here".
 *
 * Reduced motion is already handled by the source through `motion-reduce`,
 * which stops the waves and hides the bubbles while leaving the fill — the
 * button still answers a hover, it just does not churn.
 */
import React from "react";

import { cn } from "@/lib/utils";

/**
 * @param {Object} props
 * @param {'solid'|'ghost'} [props.variant='solid'] `solid` rests on the
 *   theme's black action and is the loudest control on a page. `ghost`
 *   rests as an outline in ink - the quiet neighbour of a solid one - and
 *   only on hover does the same liquid flood it. Tzvi: "add liquid fill to
 *   find a business", the button beside the hero's solid "Search rentals";
 *   two solid blacks side by side would have said the two actions weigh the
 *   same, and they do not.
 */
function LiquidButton({ children, className = "", type = "button", variant = "solid", ...props }) {
  const ghost = variant === "ghost";
  return (
    <>
      <button
        className={cn(
          "group/liquid relative isolate inline-flex h-12 shrink-0 items-center justify-center overflow-hidden",
          "rounded-xl border px-6 text-sm font-semibold whitespace-nowrap",
          ghost
            ? "border-[rgba(17,24,39,0.3)] bg-transparent text-[var(--ink,#111827)] hover:text-white focus-visible:text-white"
            : "border-[rgba(28,141,212,0.35)] bg-[var(--action,#000)] text-white shadow-[0_12px_32px_-14px_rgba(28,141,212,0.75)]",
          "transition-[transform,box-shadow,border-color,color] duration-300 outline-none select-none",
          "hover:border-[rgba(28,141,212,0.75)] hover:shadow-[0_16px_40px_-12px_rgba(28,141,212,0.9)]",
          "focus-visible:border-[#3FB6EE] focus-visible:ring-[3px] focus-visible:ring-[rgba(28,141,212,0.35)]",
          "active:translate-y-px active:scale-[0.98]",
          "disabled:pointer-events-none disabled:opacity-45 disabled:shadow-none",
          className,
        )}
        type={type}
        data-variant={variant}
        {...props}
      >
        <span
          aria-hidden="true"
          className="absolute -inset-x-1/4 top-[96%] z-0 h-[190%] bg-gradient-to-b from-[var(--liquid-a,#3FB6EE)] via-[var(--liquid-b,#1C8DD4)] to-[var(--liquid-c,#0F5E8F)] transition-transform duration-700 ease-[cubic-bezier(0.22,1,0.36,1)] group-hover/liquid:-translate-y-[58%] group-focus-visible/liquid:-translate-y-[58%] group-disabled/liquid:translate-y-0 motion-reduce:transition-none"
        >
          {/* Two discs turning against each other are what make the surface
              roll rather than simply rise. */}
          <span className="absolute top-0 left-1/2 size-[145%] -translate-x-1/2 -translate-y-1/2 [animation:liquid-button-wave_7s_linear_infinite] rounded-[43%] bg-[var(--action,#000)]/95 motion-reduce:animate-none" />
          <span className="absolute top-0 left-1/2 size-[135%] -translate-x-1/2 -translate-y-1/2 [animation:liquid-button-wave_5s_linear_infinite_reverse] rounded-[47%] bg-[var(--action,#000)]/45 motion-reduce:animate-none" />

          <span
            className="absolute bottom-4 left-[22%] size-1.5 [animation:liquid-button-bubble_1.8s_ease-in_infinite] rounded-full bg-white/70 opacity-0 group-hover/liquid:opacity-100 group-disabled/liquid:hidden motion-reduce:hidden"
            style={{ animationDelay: "120ms" }}
          />
          <span
            className="absolute bottom-2 left-[48%] size-2 [animation:liquid-button-bubble_2.2s_ease-in_infinite] rounded-full bg-white/60 opacity-0 group-hover/liquid:opacity-100 group-disabled/liquid:hidden motion-reduce:hidden"
            style={{ animationDelay: "520ms" }}
          />
          <span
            className="absolute bottom-5 left-[72%] size-1 [animation:liquid-button-bubble_1.6s_ease-in_infinite] rounded-full bg-white/80 opacity-0 group-hover/liquid:opacity-100 group-disabled/liquid:hidden motion-reduce:hidden"
            style={{ animationDelay: "860ms" }}
          />
        </span>

        <span className="relative z-10 inline-flex items-center gap-2">
          {children}
        </span>
        <span
          aria-hidden="true"
          className="absolute inset-x-5 top-0 z-20 h-px bg-gradient-to-r from-transparent via-white/60 to-transparent"
        />
      </button>

      <style>{`
        @keyframes liquid-button-wave {
          from { transform: translate(-50%, -50%) rotate(0deg); }
          to { transform: translate(-50%, -50%) rotate(360deg); }
        }

        @keyframes liquid-button-bubble {
          0% { opacity: 0; transform: translateY(0) scale(0.7); }
          18% { opacity: 0.75; }
          100% { opacity: 0; transform: translateY(-4.5rem) scale(1.15); }
        }
      `}</style>
    </>
  );
}

export { LiquidButton };
export default LiquidButton;
