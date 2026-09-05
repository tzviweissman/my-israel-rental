/**
 * SphereImageGrid - photos arranged on a slowly turning 3D sphere.
 *
 * Ported from a TypeScript source ("img-sphere"). This project is CRA +
 * JavaScript (`components.json` has `tsx: false`), so the types are JSDoc
 * and the file is `.jsx`. The Fibonacci distribution, the drag with
 * momentum, the auto-rotation and the depth fade are the author's. What
 * changed, and why:
 *
 * 1. NO RANDOM JITTER. The source nudged every position by Math.random()
 *    at layout time, so the sphere was laid out differently on every
 *    render of the hook, and a React strict-mode double render produced
 *    two layouts a frame apart. The Fibonacci spiral is already
 *    irregular enough; the jitter is gone and the layout is a pure
 *    function of the image count.
 *
 * 2. NO MODAL. The source opened a lightbox on click. Here every circle
 *    is a real listing or business with its own page, so a click goes
 *    THERE (via `onOpen`) - the image is the door, not the destination.
 *    A drag never counts as a click: the pointer has to come down and up
 *    within a few pixels.
 *
 * 3. ONE STATE PER FRAME. The source held rotation and velocity in React
 *    state and wrote both from a requestAnimationFrame loop, re-rendering
 *    60 times a second through two setState calls. The physics live in a
 *    ref and one setState per frame carries the rotation out.
 *
 * 4. REDUCED MOTION is honoured: no auto-rotation, and momentum stops
 *    with the drag. `prefers-reduced-motion` is read once at mount.
 *
 * 5. TOUCH is passive-friendly: the container sets `touch-action: none`
 *    so the page does not scroll under a drag, instead of the source's
 *    non-passive document listeners calling preventDefault on every move.
 *
 * 6. ONE TAB STOP, and it is the sphere. The first cut gave every node
 *    `tabIndex={0}`, which put 36 tab stops after the sign-up form AND
 *    destroyed a keyboard user's place: a node behind the equator
 *    unmounts, and at 0.18 degrees a frame they cross that line every
 *    few seconds, so focus fell back to <body> mid-form. The nodes are
 *    decorative here - every listing on the sphere has its own page,
 *    reachable from the boards - so the sphere takes the focus, arrow
 *    keys turn it, and the nodes stay clickable by pointer.
 *    (2026-09-05 audit, finding 1.)
 *
 * Only dependency: lucide-react is NOT needed any more (the X was the
 * modal's). Nothing else.
 */
import React from "react";

import { cn } from "@/lib/utils";

const DEG = Math.PI / 180;

/**
 * @typedef {Object} SphereImage
 * @property {string} id
 * @property {string} src
 * @property {string} alt
 * @property {string} [title]
 * @property {string} [href]
 */

/** Fibonacci sphere: `count` points spread evenly, no two the same. */
function spherePositions(count) {
  const out = [];
  const golden = Math.PI * (3 - Math.sqrt(5));
  for (let i = 0; i < count; i += 1) {
    const y = 1 - (i / Math.max(1, count - 1)) * 2; // 1 → -1
    const r = Math.sqrt(1 - y * y);
    const theta = golden * i;
    out.push({ x: Math.cos(theta) * r, y, z: Math.sin(theta) * r });
  }
  return out;
}

/**
 * @param {Object} props
 * @param {SphereImage[]} props.images
 * @param {number} [props.containerSize=400] Square, in px. Pass the width you have.
 * @param {number} [props.sphereRadius] Defaults to 0.42 of the container.
 * @param {number} [props.dragSensitivity=0.5] Degrees per pixel dragged.
 * @param {number} [props.momentumDecay=0.95]
 * @param {number} [props.maxRotationSpeed=5] Degrees per frame.
 * @param {number} [props.baseImageScale=0.14] Image diameter as a fraction of the container.
 * @param {boolean} [props.autoRotate=false]
 * @param {number} [props.autoRotateSpeed=0.3] Degrees per frame.
 * @param {(image: SphereImage) => void} [props.onOpen]
 * @param {string} [props.label] The sphere's accessible name.
 * @param {string} [props.className]
 */
export function SphereImageGrid({
  images = [],
  containerSize = 400,
  sphereRadius,
  dragSensitivity = 0.5,
  momentumDecay = 0.95,
  maxRotationSpeed = 5,
  baseImageScale = 0.14,
  autoRotate = false,
  autoRotateSpeed = 0.3,
  onOpen,
  label = "Photo sphere",
  className,
  ...rest
}) {
  const radius = sphereRadius || containerSize * 0.42;
  const baseSize = containerSize * baseImageScale;

  const [rotation, setRotation] = React.useState({ x: 15, y: 15 });
  const physics = React.useRef({ x: 15, y: 15, vx: 0, vy: 0, dragging: false, lastX: 0, lastY: 0, downX: 0, downY: 0, moved: false });
  const reduced = React.useRef(false);
  const frame = React.useRef(0);

  const positions = React.useMemo(() => spherePositions(images.length), [images.length]);

  const clamp = (v) => Math.max(-maxRotationSpeed, Math.min(maxRotationSpeed, v));

  // The loop: momentum, auto-rotation, one setState a frame.
  React.useEffect(() => {
    reduced.current = typeof window !== "undefined"
      && window.matchMedia?.("(prefers-reduced-motion: reduce)")?.matches === true;
    let alive = true;
    const tick = () => {
      if (!alive) return;
      const p = physics.current;
      if (!p.dragging) {
        p.vx *= momentumDecay;
        p.vy *= momentumDecay;
        if (Math.abs(p.vx) < 0.01) p.vx = 0;
        if (Math.abs(p.vy) < 0.01) p.vy = 0;
        const spin = autoRotate && !reduced.current ? autoRotateSpeed : 0;
        if (p.vx || p.vy || spin) {
          p.x = Math.max(-80, Math.min(80, p.x + clamp(p.vx)));
          p.y = (p.y + clamp(p.vy) + spin + 360) % 360;
          setRotation({ x: p.x, y: p.y });
        }
      }
      frame.current = requestAnimationFrame(tick);
    };
    frame.current = requestAnimationFrame(tick);
    return () => { alive = false; cancelAnimationFrame(frame.current); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [autoRotate, autoRotateSpeed, momentumDecay, maxRotationSpeed]);

  const onPointerDown = (e) => {
    const p = physics.current;
    p.dragging = true;
    p.moved = false;
    p.vx = 0; p.vy = 0;
    p.lastX = e.clientX; p.lastY = e.clientY;
    p.downX = e.clientX; p.downY = e.clientY;
    e.currentTarget.setPointerCapture?.(e.pointerId);
  };
  const onPointerMove = (e) => {
    const p = physics.current;
    if (!p.dragging) return;
    const dx = e.clientX - p.lastX;
    const dy = e.clientY - p.lastY;
    if (Math.abs(e.clientX - p.downX) + Math.abs(e.clientY - p.downY) > 6) p.moved = true;
    p.vx = clamp(-dy * dragSensitivity);
    p.vy = clamp(dx * dragSensitivity);
    p.x = Math.max(-80, Math.min(80, p.x + p.vx));
    p.y = (p.y + p.vy + 360) % 360;
    p.lastX = e.clientX; p.lastY = e.clientY;
    setRotation({ x: p.x, y: p.y });
  };
  const onPointerUp = () => {
    const p = physics.current;
    p.dragging = false;
    if (reduced.current) { p.vx = 0; p.vy = 0; }
  };

  // Arrow keys turn it, in the same units a drag does, so a keyboard
  // reaches every face the pointer can.
  const onKeyDown = (e) => {
    const step = e.shiftKey ? 24 : 8;
    const p = physics.current;
    const moves = {
      ArrowLeft: () => { p.y = (p.y - step + 360) % 360; },
      ArrowRight: () => { p.y = (p.y + step + 360) % 360; },
      ArrowUp: () => { p.x = Math.max(-80, p.x - step); },
      ArrowDown: () => { p.x = Math.min(80, p.x + step); },
    };
    if (!moves[e.key]) return;
    e.preventDefault();
    p.vx = 0; p.vy = 0;
    moves[e.key]();
    setRotation({ x: p.x, y: p.y });
  };

  // Project every image for this rotation.
  const rx = rotation.x * DEG;
  const ry = rotation.y * DEG;
  const nodes = positions.map((pos, index) => {
    let { x, y, z } = pos;
    // Y axis (horizontal drag), then X axis (vertical drag).
    const x1 = x * Math.cos(ry) + z * Math.sin(ry);
    const z1 = -x * Math.sin(ry) + z * Math.cos(ry);
    x = x1; z = z1;
    const y2 = y * Math.cos(rx) - z * Math.sin(rx);
    const z2 = y * Math.sin(rx) + z * Math.cos(rx);
    y = y2; z = z2;
    // z runs -1 (back) → 1 (front). Behind the equator fades out.
    const depth = (z + 1) / 2;
    const opacity = z < -0.15 ? 0 : z < 0.1 ? (z + 0.15) / 0.25 : 1;
    const scale = 0.55 + depth * 0.6;
    return {
      index,
      left: containerSize / 2 + x * radius,
      top: containerSize / 2 + y * radius,
      size: baseSize * scale,
      opacity,
      z: Math.round(1000 + z * 500),
      hidden: z < -0.15,
    };
  });

  return (
    <div
      {...rest}
      className={cn(
        "relative select-none cursor-grab active:cursor-grabbing rounded-full outline-none",
        // Its own ring: the global focus-visible rule covers form
        // elements only, so a focusable div would have shown nothing.
        "focus-visible:ring-2 focus-visible:ring-white/80 focus-visible:ring-offset-2 focus-visible:ring-offset-transparent",
        className,
      )}
      style={{ width: containerSize, height: containerSize, touchAction: "none", ...rest.style }}
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={onPointerUp}
      onPointerCancel={onPointerUp}
      onKeyDown={onKeyDown}
      role="group"
      tabIndex={0}
      aria-label={label}
      // The rotation, rounded, so a check can tell an arrow key from the
      // drift: counting node positions cannot, because nodes appear and
      // disappear as they cross behind the sphere.
      data-rot-y={Math.round(rotation.y)}
      data-rot-x={Math.round(rotation.x)}
      data-testid={rest["data-testid"] || "img-sphere"}
    >
      {images.map((image, index) => {
        const n = nodes[index];
        if (!n || n.hidden) return null;
        const open = () => { if (onOpen && !physics.current.moved) onOpen(image); };
        return (
          <div
            key={image.id}
            className="absolute"
            style={{
              width: n.size,
              height: n.size,
              left: n.left,
              top: n.top,
              opacity: n.opacity,
              transform: "translate(-50%, -50%)",
              zIndex: n.z,
              willChange: "transform, opacity",
            }}
            onClick={open}
            // Not a tab stop, and not announced: the sphere above carries
            // the name, and these turn in and out of existence.
            aria-hidden="true"
            data-testid={`img-sphere-node-${index}`}
          >
            <div className="relative h-full w-full overflow-hidden rounded-full border-2 border-white/25 shadow-lg" style={{ background: "#1f2937" }}>
              <img
                src={image.src}
                alt={image.alt}
                className="h-full w-full object-cover"
                draggable={false}
                loading={index < 6 ? "eager" : "lazy"}
                decoding="async"
              />
            </div>
          </div>
        );
      })}
    </div>
  );
}

export default SphereImageGrid;
