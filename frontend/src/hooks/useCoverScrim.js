/**
 * How dark the scrim over a cover photo needs to be (spec K2).
 *
 * The problem a fixed overlay has: over a dark photo it makes mud, and over
 * a bright one it is not enough. A business's name sits on that lower edge,
 * and it has to be readable over both a night shot of a bakery and a
 * white-tiled kitchen.
 *
 * WHAT THIS DOES NOT DO, deliberately: it never flips to dark text. The
 * spec allows a light-on-dark / dark-on-light choice, and choosing wrongly
 * in the dark-text direction leaves unreadable text on somebody's
 * storefront — the exact failure this is meant to prevent. White text is
 * readable over almost anything once a scrim is present, so the only thing
 * adapted is HOW MUCH scrim. The direction is fixed and safe; the strength
 * is the part worth computing.
 *
 * Sampling is best-effort and failure is silent. A cross-origin image
 * without CORS headers throws on `getImageData`, and a business page must
 * not depend on that succeeding — a failed read returns the default, which
 * is the strength a fixed overlay would have used anyway.
 */
import { useEffect, useState } from 'react';

// The strength used before this existed, and the value every failure path
// returns to. Chosen to be readable over a mid-tone photo.
export const DEFAULT_SCRIM = 0.42;

const MIN_SCRIM = 0.22;   // a genuinely dark photo needs help, not mud
const MAX_SCRIM = 0.62;   // past this the photo stops being visible at all

/**
 * @param {string|null} src cover image URL
 * @returns {number} scrim alpha for the bottom of the gradient
 */
export default function useCoverScrim(src) {
  const [scrim, setScrim] = useState(DEFAULT_SCRIM);

  useEffect(() => {
    if (!src) { setScrim(DEFAULT_SCRIM); return undefined; }
    let cancelled = false;
    setScrim(DEFAULT_SCRIM);

    const img = new Image();
    // Required for the canvas read. Cloudinary serves permissive CORS; a
    // host that does not simply lands in the catch below.
    img.crossOrigin = 'anonymous';
    img.decoding = 'async';

    img.onload = () => {
      if (cancelled) return;
      try {
        // Only the lower band matters — that is the strip the name and the
        // logo sit on. Averaging the whole picture would let a bright sky
        // argue for a heavy scrim over a dark foreground.
        const W = 32, H = 8;
        const canvas = document.createElement('canvas');
        canvas.width = W; canvas.height = H;
        const ctx = canvas.getContext('2d', { willReadFrequently: true });
        if (!ctx) return;
        const srcY = Math.floor(img.naturalHeight * 0.55);
        const srcH = Math.max(1, img.naturalHeight - srcY);
        ctx.drawImage(img, 0, srcY, img.naturalWidth, srcH, 0, 0, W, H);
        const { data } = ctx.getImageData(0, 0, W, H);

        let sum = 0;
        for (let i = 0; i < data.length; i += 4) {
          // Rec. 709 perceived luminance. A raw RGB mean would call a
          // saturated blue and a mid grey equally bright, and they are not.
          sum += 0.2126 * data[i] + 0.7152 * data[i + 1] + 0.0722 * data[i + 2];
        }
        const lum = sum / (data.length / 4) / 255;   // 0 dark … 1 bright

        // Linear between the bounds: a black photo takes the minimum, a
        // white one the maximum, everything else in proportion.
        const next = MIN_SCRIM + (MAX_SCRIM - MIN_SCRIM) * lum;
        if (!cancelled) setScrim(Math.min(MAX_SCRIM, Math.max(MIN_SCRIM, next)));
      } catch {
        // Tainted canvas, no 2d context, decode failure. The default is
        // already set; leave it.
      }
    };
    // No onerror handler is needed: SafeImage handles a dead cover, and the
    // scrim over a placeholder is harmless.
    img.src = src;

    return () => { cancelled = true; };
  }, [src]);

  return scrim;
}
