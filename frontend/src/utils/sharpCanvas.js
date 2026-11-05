// A picture that leaves the site is drawn at twice its size, so it stays crisp
// on a large screen and in print (Tzvi, 5 Nov 2026: "when i download the ad its
// fuzzy"). The ad designs keep working in their 1080-wide numbers: this gives
// them a canvas that says 1080 and draws 2160.
export function sharpCanvas(real, scale = 1) {
  const ctx = real.getContext('2d');
  const setup = () => {
    ctx.setTransform(scale, 0, 0, scale, 0, 0);
    // The browser's default shrinks a big photo roughly, which softens it.
    ctx.imageSmoothingQuality = 'high';
  };
  const shim = {
    get width() { return real.width / scale; },
    set width(v) { real.width = v * scale; setup(); },
    get height() { return real.height / scale; },
    set height(v) { real.height = v * scale; setup(); },
    getContext: () => ctx,
    scale,
  };
  if (scale === 1) return shim;

  // What the transform does not scale by itself, and what reads pixels back in 1080-wide numbers.
  const proto = CanvasRenderingContext2D.prototype;
  Object.defineProperty(ctx, 'canvas', { value: shim, configurable: true });
  ['shadowBlur', 'shadowOffsetX', 'shadowOffsetY'].forEach((k) => {
    const d = Object.getOwnPropertyDescriptor(proto, k);
    Object.defineProperty(ctx, k, { configurable: true, get: () => d.get.call(ctx) / scale, set: (v) => d.set.call(ctx, v * scale) });
  });
  ctx.getTransform = () => new DOMMatrix().scale(1 / scale).multiply(proto.getTransform.call(ctx));
  ctx.getImageData = (x, y, w, h) => {
    const c = document.createElement('canvas');
    c.width = w;
    c.height = h;
    const small = c.getContext('2d');
    small.drawImage(real, x * scale, y * scale, w * scale, h * scale, 0, 0, w, h);
    return small.getImageData(0, 0, w, h);
  };
  return shim;
}

// Our photos are stored large but served compressed for fast pages; an ad is kept, so it asks for the best copy.
export const bestPhoto = (src) => (typeof src === 'string' ? src.replace('/f_auto,q_auto/', '/f_auto,q_auto:best/') : src);
