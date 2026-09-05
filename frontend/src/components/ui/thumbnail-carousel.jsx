/**
 * ThumbnailStrip - a filmstrip where the current frame opens and the rest
 * stay as slivers, and ThumbnailCarousel, the whole thing with a viewer.
 *
 * Ported from a TypeScript source ("thumbnail-carousel"). This project is
 * CRA + JavaScript (`components.json` has `tsx: false`), so the types are
 * JSDoc and the file is `.jsx`. The widths, the centring scroll and the
 * drag-to-swipe are the author's. What changed, and why:
 *
 * 1. IT TAKES ITS PICTURES FROM THE CALLER. The source ships twelve
 *    hardcoded stock photos. Every image on this site belongs to somebody
 *    who listed something.
 *
 * 2. `motion`, NOT `framer-motion`. Same API, and it is the one animation
 *    library this project has; adding the other would ship two.
 *
 * 3. NOTHING IS CROPPED, AND NOTHING IS LETTERBOXED IN BLACK. The source
 *    uses `object-cover` throughout, which fills the frame by cutting off
 *    whatever does not fit - on a listing photo that quietly removes what
 *    the owner was showing. Every picture here is drawn whole
 *    (`object-contain`) over a blurred, enlarged copy of ITSELF, so the
 *    surround is the photo's own colours instead of black bars. The blur
 *    layer is a 64px-wide variant: it costs almost nothing and, blurred,
 *    is indistinguishable from the full-size one.
 *
 * 4. RTL. The strip scrolls, and a scroll offset means the opposite edge
 *    in Hebrew; the centring maths mirrors rather than sending the strip
 *    the wrong way.
 *
 * 5. REDUCED MOTION: the frames still open and close, instantly.
 *
 * 6. It is KEYBOARD-REACHABLE as one control per frame, with arrow keys
 *    moving along the strip - the source's buttons had no key handling
 *    beyond the browser default.
 */
import React from "react";
import { motion, useReducedMotion } from "motion/react";

import { cn } from "@/lib/utils";
import { sizedImage } from "../../utils/cdnImage";

const FULL_WIDTH_PX = 120;
const COLLAPSED_WIDTH_PX = 36;
const GAP_PX = 2;
const MARGIN_PX = 2;

/**
 * A picture drawn whole, over a blurred copy of itself.
 *
 * `object-contain` guarantees nothing is cut off. The blur behind it is
 * what stops that guarantee from looking like a mistake: a portrait photo
 * in a landscape frame used to sit between two black bars.
 *
 * @param {Object} props
 * @param {string} props.src
 * @param {string} [props.blurSrc] Defaults to a 64px variant of `src`.
 * @param {string} props.alt
 */
export function FramedImage({ src, blurSrc, alt, className, imgClassName, ...rest }) {
  return (
    <div className={cn("relative overflow-hidden", className)} {...rest}>
      <img
        src={blurSrc || sizedImage(src, 64)}
        alt=""
        aria-hidden="true"
        className="pointer-events-none absolute inset-0 h-full w-full scale-125 object-cover blur-xl"
        draggable={false}
      />
      {/* A touch of ink over the blur, so a bright photo's surround does
          not out-glow the photo itself. */}
      <div aria-hidden="true" className="pointer-events-none absolute inset-0 bg-black/15" />
      <img
        src={src}
        alt={alt}
        className={cn("relative h-full w-full object-contain", imgClassName)}
        draggable={false}
      />
    </div>
  );
}

/**
 * @typedef {Object} StripItem
 * @property {string} key
 * @property {string} src        What to draw.
 * @property {string} [alt]
 * @property {React.ReactNode} [badge] Drawn over the frame (a play icon, say).
 */

/**
 * @param {Object} props
 * @param {StripItem[]} props.items
 * @param {number} props.index
 * @param {(next: number) => void} props.onIndexChange
 * @param {boolean} [props.rtl]
 * @param {string} [props.label] The strip's accessible name.
 */
export function ThumbnailStrip({ items = [], index = 0, onIndexChange, rtl = false, label, className, testidPrefix = "thumb" }) {
  const scrollerRef = React.useRef(null);
  const reduced = useReducedMotion();

  // Keep the open frame in the middle of the strip. Measured from the
  // frames themselves rather than recomputed from the constants: a frame
  // mid-animation is neither width, and arithmetic would fight the
  // animation instead of following it.
  React.useEffect(() => {
    const el = scrollerRef.current;
    const active = el?.querySelector(`[data-strip-index="${index}"]`);
    if (!el || !active) return;
    const target = active.offsetLeft - (el.clientWidth / 2 - active.offsetWidth / 2);
    el.scrollTo({ left: target, behavior: reduced ? "auto" : "smooth" });
  }, [index, reduced]);

  const onKeyDown = (e) => {
    const back = rtl ? "ArrowRight" : "ArrowLeft";
    const fwd = rtl ? "ArrowLeft" : "ArrowRight";
    if (e.key === back) { e.preventDefault(); onIndexChange(Math.max(0, index - 1)); }
    if (e.key === fwd) { e.preventDefault(); onIndexChange(Math.min(items.length - 1, index + 1)); }
  };

  if (items.length < 2) return null;

  return (
    <div
      ref={scrollerRef}
      className={cn("overflow-x-auto [scrollbar-width:none] [-ms-overflow-style:none] [&::-webkit-scrollbar]:hidden", className)}
      role="tablist"
      aria-label={label}
      onKeyDown={onKeyDown}
      data-testid={`${testidPrefix}-strip`}
    >
      <div className="flex h-20 gap-0.5 pb-2" style={{ width: "fit-content" }}>
        {items.map((item, i) => (
          <motion.button
            key={item.key}
            type="button"
            role="tab"
            aria-selected={i === index}
            aria-label={item.alt}
            tabIndex={i === index ? 0 : -1}
            onClick={() => onIndexChange(i)}
            initial={false}
            animate={i === index ? "active" : "inactive"}
            variants={{
              active: { width: FULL_WIDTH_PX, marginLeft: MARGIN_PX, marginRight: MARGIN_PX },
              inactive: { width: COLLAPSED_WIDTH_PX, marginLeft: 0, marginRight: 0 },
            }}
            transition={reduced ? { duration: 0 } : { duration: 0.3, ease: "easeOut" }}
            className={cn(
              "relative h-full shrink-0 overflow-hidden rounded outline-none",
              "focus-visible:ring-2 focus-visible:ring-[var(--brand-primary,#1C8DD4)] focus-visible:ring-offset-1",
              i === index ? "opacity-100" : "opacity-70 hover:opacity-100",
            )}
            style={{ gap: GAP_PX }}
            data-strip-index={i}
            data-testid={`${testidPrefix}-${i}`}
          >
            <FramedImage src={item.src} alt={item.alt || ""} className="h-full w-full" />
            {item.badge}
          </motion.button>
        ))}
      </div>
    </div>
  );
}

/**
 * The whole thing: a picture with the strip under it. Used where there is
 * no viewer already - the property gallery has its own, with video and
 * deep-linking, and takes only the strip.
 *
 * @param {Object} props
 * @param {{key: string, src: string, alt?: string}[]} props.items
 * @param {number} [props.index] Controlled, when given.
 * @param {(next: number) => void} [props.onIndexChange]
 */
export default function ThumbnailCarousel({ items = [], index, onIndexChange, rtl = false, label, className, testidPrefix = "carousel" }) {
  const [own, setOwn] = React.useState(0);
  const current = index ?? own;
  const setCurrent = onIndexChange ?? setOwn;
  const reduced = useReducedMotion();

  if (!items.length) return null;

  return (
    <div className={cn("flex flex-col gap-3", className)} data-testid={testidPrefix}>
      <div className="relative overflow-hidden rounded-lg">
        <motion.div
          className="flex"
          animate={{ x: `-${current * 100}%` }}
          transition={reduced ? { duration: 0 } : { type: "spring", stiffness: 300, damping: 30 }}
          drag="x"
          dragElastic={0.2}
          dragMomentum={false}
          onDragEnd={(e, info) => {
            const w = e.currentTarget?.offsetWidth || 1;
            let next = current;
            if (Math.abs(info.velocity.x) > 500) next = info.velocity.x > 0 ? current - 1 : current + 1;
            else if (Math.abs(info.offset.x) > w * 0.3) next = info.offset.x > 0 ? current - 1 : current + 1;
            setCurrent(Math.max(0, Math.min(items.length - 1, next)));
          }}
        >
          {items.map((item) => (
            <FramedImage
              key={item.key}
              src={item.src}
              alt={item.alt || ""}
              className="h-[400px] w-full shrink-0"
            />
          ))}
        </motion.div>
        <div className="pointer-events-none absolute bottom-4 left-1/2 -translate-x-1/2 rounded-full bg-black/50 px-3 py-1 text-sm text-white">
          {current + 1} / {items.length}
        </div>
      </div>

      <ThumbnailStrip
        items={items}
        index={current}
        onIndexChange={setCurrent}
        rtl={rtl}
        label={label}
        testidPrefix={`${testidPrefix}-thumb`}
      />
    </div>
  );
}
