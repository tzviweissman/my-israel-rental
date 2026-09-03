/**
 * PixelTextFill — text that fills in behind a dithered wavefront: dim
 * letters, a crest of accent-coloured pixels dissolving in, then the solid
 * ink behind it.
 *
 * Built using Hyperiux Vault: https://vault.hyperiux.com
 *
 * Ported from a TypeScript source. This project is CRA + JavaScript
 * (`components.json` has `tsx: false`), so the types became JSDoc. The
 * canvas work — the ordered/noise dither, the per-character segments, the
 * three painted layers and the masked stamping — is the author's and is
 * unchanged.
 *
 * THREE CHANGES, all so it can live inside a section rather than be one:
 *
 * 1. NO GSAP. The source drives itself with ScrollTrigger, which is the only
 *    thing it needs GSAP for. It takes a progress value instead, so it runs
 *    off the same number as the cards beside it — the two are meant to move
 *    together, and two independent scroll measurements of the same section
 *    drift apart the moment their elements differ in height. It also means
 *    no new dependency for one effect.
 *
 * 2. NO SECTION OF ITS OWN. The source renders a full-height sticky section
 *    at `sectionHeight` vh. Ours is already inside one; nesting a second
 *    sticky frame inside the first pins nothing. It renders as a block that
 *    fills the space it is given.
 *
 * 3. THE COLOURS ARE THE THEME'S, and the dim colour is the one that
 *    matters: the source is white text on near-black, so its unlit state is
 *    a dark grey. On a white page the unlit letters have to be a LIGHT grey
 *    or the "not yet arrived" text reads as the finished text.
 *
 * The smoothing is the source's: the drawn progress chases the target by
 * 18% a frame, which is what keeps a fast scroll from tearing the wavefront.
 */
"use client";

import React from "react";

const BAYER = [
  0, 32, 8, 40, 2, 34, 10, 42, 48, 16, 56, 24, 50, 18, 58, 26, 12, 44, 4, 36,
  14, 46, 6, 38, 60, 28, 52, 20, 62, 30, 54, 22, 3, 35, 11, 43, 1, 33, 9, 41,
  51, 19, 59, 27, 49, 17, 57, 25, 15, 47, 7, 39, 13, 45, 5, 37, 63, 31, 55, 23,
  61, 29, 53, 21,
];

function hashNoise(x, y) {
  let h = Math.imul(x, 374761393) + Math.imul(y, 668265263);
  h = Math.imul(h ^ (h >>> 13), 1274126177);
  return ((h ^ (h >>> 16)) >>> 0) / 4294967295;
}

function cellThreshold(x, y) {
  const ordered = (BAYER[(y & 7) * 8 + (x & 7)] + 0.5) / 64;
  return ordered * 0.75 + hashNoise(x, y) * 0.25;
}

const clamp01 = (value) => (value < 0 ? 0 : value > 1 ? 1 : value);

function smoothstep01(value) {
  const x = clamp01(value);
  return x * x * (3 - 2 * x);
}

function wrapLines(ctx, text, maxWidth) {
  const lines = [];
  const paragraphs = String(text).split("\n");

  for (const paragraph of paragraphs) {
    const words = paragraph.split(/\s+/).filter(Boolean);
    let line = "";

    if (!words.length) {
      lines.push("");
      continue;
    }

    for (const word of words) {
      const candidate = line ? `${line} ${word}` : word;
      if (line && ctx.measureText(candidate).width > maxWidth) {
        lines.push(line);
        line = word;
      } else {
        line = candidate;
      }
    }

    if (line) lines.push(line);
  }

  return lines;
}

/**
 * @param {Object} props
 * @param {string} props.text
 * @param {import('motion/react').MotionValue<number>} props.progress 0 → 1.
 * @param {string} [props.textColor] The colour of arrived text.
 * @param {string} [props.primaryColor] The dissolving crest.
 * @param {string} [props.dimColor] Text that has not arrived yet.
 * @param {number} [props.pixelSize]
 * @param {number} [props.stagger] Characters the wavefront is spread over.
 * @param {"up"|"right"} [props.direction]
 * @param {string} [props.className]
 */
export default function PixelTextFill({
  text = "",
  progress,
  textColor = "#111827",
  primaryColor = "#1C8DD4",
  dimColor = "#D5DAE1",
  pixelSize = 2,
  stagger = 26,
  bandFraction = 1.15,
  effectWidth = 1.4,
  settleBlend = 0.45,
  direction = "up",
  className = "",
}) {
  const wrapperRef = React.useRef(null);
  const textRef = React.useRef(null);
  const canvasRef = React.useRef(null);
  const [reduced, setReduced] = React.useState(false);
  const targetRef = React.useRef(0);
  const shownRef = React.useRef(0);

  React.useEffect(() => {
    const mq = window.matchMedia?.("(prefers-reduced-motion: reduce)");
    if (!mq) return undefined;
    setReduced(mq.matches);
    const onChange = (e) => setReduced(e.matches);
    mq.addEventListener?.("change", onChange);
    return () => mq.removeEventListener?.("change", onChange);
  }, []);

  React.useEffect(() => {
    let frame = null;
    let disposed = false;
    let layout = null;

    const canvas = canvasRef.current;
    const wrapper = wrapperRef.current;
    const textElement = textRef.current;
    if (!canvas || !wrapper || !textElement) return undefined;

    const makeLayer = (width, height) => {
      const layer = document.createElement("canvas");
      layer.width = Math.max(1, Math.ceil(width));
      layer.height = Math.max(1, Math.ceil(height));
      return layer;
    };

    const build = () => {
      const rect = wrapper.getBoundingClientRect();
      const width = rect.width;
      const height = rect.height;
      if (width < 1 || height < 1) {
        layout = null;
        return;
      }

      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      const styles = window.getComputedStyle(textElement);
      const parsedFontSize = Number.parseFloat(styles.fontSize) || 16;
      const parsedLineHeight = Number.parseFloat(styles.lineHeight);
      const computedLineHeight = Number.isFinite(parsedLineHeight)
        ? parsedLineHeight
        : parsedFontSize * 1.34;
      const font = `${styles.fontStyle} ${styles.fontWeight} ${parsedFontSize}px ${styles.fontFamily}`;
      const letterSpacing = styles.letterSpacing;
      const align = styles.textAlign;
      const hasLetterSpacing = letterSpacing && letterSpacing !== "normal";

      canvas.width = Math.ceil(width * dpr);
      canvas.height = Math.ceil(height * dpr);
      canvas.style.width = `${width}px`;
      canvas.style.height = `${height}px`;

      const ctx = canvas.getContext("2d");
      if (!ctx) return;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      ctx.font = font;
      if (hasLetterSpacing && "letterSpacing" in ctx) ctx.letterSpacing = letterSpacing;

      const lines = wrapLines(ctx, text, width);
      const metrics = ctx.measureText("Hg");
      const ascent = metrics.fontBoundingBoxAscent || parsedFontSize * 0.8;
      const descent = metrics.fontBoundingBoxDescent || parsedFontSize * 0.2;
      const firstBaseline = (computedLineHeight - (ascent + descent)) / 2 + ascent;

      const lineGeometry = lines.map((line, index) => {
        const lineWidth = ctx.measureText(line).width;
        const x =
          align === "right"
            ? width - lineWidth
            : align === "left" || align === "start"
              ? 0
              : (width - lineWidth) / 2;
        return { line, x, baseline: firstBaseline + index * computedLineHeight };
      });

      const chars = [];
      for (const { line, x, baseline } of lineGeometry) {
        let previous = 0;
        for (let index = 0; index < line.length; index += 1) {
          const next = ctx.measureText(line.slice(0, index + 1)).width;
          const character = line[index];
          if (character.trim()) {
            const glyph = ctx.measureText(character);
            const top = baseline - (glyph.actualBoundingBoxAscent || ascent * 0.72) - 1;
            const bottom = baseline + (glyph.actualBoundingBoxDescent || 0) + 1;
            chars.push({ x: x + previous, width: next - previous, top, bottom, height: bottom - top });
          }
          previous = next;
        }
      }

      const paint = (target, color) => {
        const tctx = target.getContext("2d");
        if (!tctx) return;
        tctx.setTransform(dpr, 0, 0, dpr, 0, 0);
        tctx.clearRect(0, 0, width, height);
        tctx.font = font;
        tctx.textBaseline = "alphabetic";
        tctx.fillStyle = color;
        if (hasLetterSpacing && "letterSpacing" in tctx) tctx.letterSpacing = letterSpacing;
        for (const { line, x, baseline } of lineGeometry) tctx.fillText(line, x, baseline);
      };

      const crispDim = makeLayer(width * dpr, height * dpr);
      const crispFill = makeLayer(width * dpr, height * dpr);
      const crispAccent = makeLayer(width * dpr, height * dpr);
      const scratch = makeLayer(width * dpr, height * dpr);
      const mask = makeLayer(width * dpr, height * dpr);

      paint(crispDim, dimColor);
      paint(crispFill, textColor);
      paint(crispAccent, primaryColor);

      layout = { width, height, dpr, chars, crispDim, crispFill, crispAccent, scratch, mask };
    };

    const draw = () => {
      if (!layout) return;
      const { width, height, dpr, chars } = layout;
      const ctx = canvas.getContext("2d");
      if (!ctx) return;

      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      ctx.clearRect(0, 0, width, height);
      ctx.drawImage(layout.crispDim, 0, 0, width, height);

      const total = chars.length;
      if (!total) return;

      const head = shownRef.current * (total + stagger);
      const soft = Math.max(0.35, bandFraction) * Math.max(0.25, effectWidth);
      const settle = clamp01(settleBlend);
      const horizontal = direction === "right";
      const dissolve = new Path2D();
      let hasDissolve = false;
      let hasFillMask = false;
      const mctx = layout.mask.getContext("2d");
      if (!mctx) return;

      mctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      mctx.clearRect(0, 0, width, height);
      mctx.globalCompositeOperation = "source-over";

      for (let index = 0; index < total; index += 1) {
        const local = (head - index) / stagger;
        if (local <= 0) continue;

        const char = chars[index];
        const axisSize = horizontal ? char.width : char.height;
        const invAxis = axisSize > 0 ? 1 / axisSize : 0;
        const right = char.x + char.width;
        const front = Math.min(local, 1 + soft * 0.5);
        const fillDelay = clamp01(0.22 + (1 - settle) * 0.28);
        const fillT = smoothstep01((local - fillDelay) / Math.max(0.28, 1 - fillDelay));
        const fadePx = Math.max(axisSize * 0.42, soft * axisSize * 0.75);

        if (fillT >= 0.999) {
          mctx.fillStyle = "#fff";
          mctx.fillRect(char.x, char.top, char.width, char.height);
          hasFillMask = true;
        } else if (fillT > 0.001) {
          if (horizontal) {
            const crestX = char.x + fillT * (char.width + fadePx * 0.95);
            const grad = mctx.createLinearGradient(crestX - fadePx, 0, crestX + fadePx * 0.2, 0);
            grad.addColorStop(0, "rgba(255,255,255,1)");
            grad.addColorStop(0.65, "rgba(255,255,255,0.4)");
            grad.addColorStop(1, "rgba(255,255,255,0)");
            mctx.fillStyle = grad;
            mctx.fillRect(char.x, char.top, char.width, char.height);
          } else {
            const crestY = char.bottom - fillT * (char.height + fadePx * 0.95);
            const gradTop = crestY - fadePx * 0.2;
            const grad = mctx.createLinearGradient(0, gradTop, 0, crestY + fadePx);
            grad.addColorStop(0, "rgba(255,255,255,0)");
            grad.addColorStop(0.35, "rgba(255,255,255,0.4)");
            grad.addColorStop(1, "rgba(255,255,255,1)");
            mctx.fillStyle = grad;
            mctx.fillRect(char.x, Math.max(char.top, gradTop), char.width, char.bottom - Math.max(char.top, gradTop));
          }
          hasFillMask = true;
        }

        const firstRow = Math.floor(char.top / pixelSize);
        const lastRow = Math.ceil(char.bottom / pixelSize);
        const firstCol = Math.floor(char.x / pixelSize);
        const lastCol = Math.ceil(right / pixelSize);

        for (let row = firstRow; row < lastRow; row += 1) {
          const y = row * pixelSize;
          const cy = y + pixelSize * 0.5;
          const top = Math.max(y, char.top);
          const cellHeight = Math.min(y + pixelSize, char.bottom) - top;
          if (cellHeight <= 0) continue;

          for (let col = firstCol; col < lastCol; col += 1) {
            const x = Math.max(col * pixelSize, char.x);
            const cellWidth = Math.min((col + 1) * pixelSize, right) - x;
            if (cellWidth <= 0) continue;

            const cx = x + cellWidth * 0.5;
            const fromStart = horizontal ? (cx - char.x) * invAxis : (char.bottom - cy) * invAxis;
            const coverage = clamp01((front + soft * 0.5 - fromStart) / soft);
            if (coverage <= 0.001) continue;
            if (coverage <= cellThreshold(col, row)) continue;

            dissolve.rect(x, top, cellWidth, cellHeight);
            hasDissolve = true;
          }
        }
      }

      const stampMasked = (source, maskSource) => {
        const sctx = layout.scratch.getContext("2d");
        if (!sctx) return;
        sctx.setTransform(dpr, 0, 0, dpr, 0, 0);
        sctx.globalCompositeOperation = "source-over";
        sctx.clearRect(0, 0, width, height);
        sctx.drawImage(source, 0, 0, width, height);
        sctx.globalCompositeOperation = "destination-in";
        sctx.drawImage(maskSource, 0, 0, width, height);
        sctx.globalCompositeOperation = "source-over";
        ctx.drawImage(layout.scratch, 0, 0, width, height);
      };

      const stampPath = (source, path) => {
        const sctx = layout.scratch.getContext("2d");
        if (!sctx) return;
        sctx.setTransform(dpr, 0, 0, dpr, 0, 0);
        sctx.globalCompositeOperation = "source-over";
        sctx.clearRect(0, 0, width, height);
        sctx.drawImage(source, 0, 0, width, height);
        sctx.globalCompositeOperation = "destination-in";
        sctx.fill(path);
        sctx.globalCompositeOperation = "source-over";
        ctx.drawImage(layout.scratch, 0, 0, width, height);
      };

      if (hasDissolve) stampPath(layout.crispAccent, dissolve);
      if (hasFillMask) stampMasked(layout.crispFill, layout.mask);

      if (wrapper) wrapper.dataset.fill = shownRef.current.toFixed(2);
    };

    const tick = () => {
      if (disposed) return;
      shownRef.current += (targetRef.current - shownRef.current) * 0.18;
      if (Math.abs(targetRef.current - shownRef.current) < 0.001) {
        shownRef.current = targetRef.current;
      }
      draw();
      frame = shownRef.current !== targetRef.current ? requestAnimationFrame(tick) : null;
    };

    const schedule = () => {
      if (disposed) return;
      if (frame !== null) cancelAnimationFrame(frame);
      frame = requestAnimationFrame(tick);
    };

    const start = () => {
      build();
      if (reduced) {
        shownRef.current = 1;
        targetRef.current = 1;
        draw();
        return;
      }
      draw();
      schedule();
    };

    if (document.fonts?.ready) document.fonts.ready.then(start);
    else start();

    const observer = new ResizeObserver(() => {
      build();
      draw();
    });
    observer.observe(wrapper);

    const unsubscribe = progress?.on?.("change", (value) => {
      targetRef.current = clamp01(value);
      if (!reduced) schedule();
    });

    return () => {
      disposed = true;
      observer.disconnect();
      unsubscribe?.();
      if (frame !== null) cancelAnimationFrame(frame);
    };
  }, [
    bandFraction, dimColor, direction, effectWidth, pixelSize,
    primaryColor, progress, reduced, settleBlend, stagger, text, textColor,
  ]);

  return (
    <div ref={wrapperRef} className={`relative ${className}`} data-testid="pixel-text-fill">
      {/* The paragraph is transparent and stays in the flow: it sizes the
          box, wraps identically to the canvas, and is what a screen reader
          and a crawler read. The canvas over it is decorative. */}
      <p ref={textRef} className="m-0 text-transparent pixel-text-fill__text">
        {text}
      </p>
      <canvas ref={canvasRef} aria-hidden="true" className="pointer-events-none absolute inset-0 h-full w-full" />
    </div>
  );
}
