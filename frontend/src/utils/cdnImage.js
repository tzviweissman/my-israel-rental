/**
 * Cloudinary URL helpers — inject responsive transformations at render time
 * so the browser pulls the smallest variant it needs. Works on already-stored
 * URLs without any DB migration.
 *
 *   sizedImage(url, 600)  -> .../upload/w_600,c_limit,f_auto,q_auto/...
 *
 * Non-Cloudinary URLs (legacy `/api/uploads/...`, Pexels fallback, etc.) are
 * returned unchanged.
 */

const isCloudinary = (url) => typeof url === 'string' && url.includes('res.cloudinary.com');

/**
 * Inject `w_<width>,c_limit` into a Cloudinary URL. `c_limit` never upscales —
 * a 400px-wide source stays 400px when asked for 800. Also ensures f_auto,q_auto.
 */
export function sizedImage(url, width) {
  if (!isCloudinary(url) || !url.includes('/upload/')) return url;
  const [head, tail] = url.split('/upload/', 2);
  // Strip any existing leading transform segment (we own this surface now)
  const segs = tail.split('/');
  while (segs.length && segs[0].includes('_') && !segs[0].includes('.')) {
    // keep version segments (v1234567890)
    if (/^v\d+$/.test(segs[0])) break;
    segs.shift();
  }
  const transform = `w_${width},c_limit,f_auto,q_auto`;
  return `${head}/upload/${transform}/${segs.join('/')}`;
}

/**
 * Build a `srcset` string with 1x / 2x descriptors for a given base width.
 * Use with `<img srcset={...} sizes={...} />`.
 */
export function srcSet(url, width) {
  if (!isCloudinary(url)) return undefined;
  return `${sizedImage(url, width)} 1x, ${sizedImage(url, width * 2)} 2x`;
}
