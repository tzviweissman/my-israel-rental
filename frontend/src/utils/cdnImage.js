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
 * Fit a whole image into an exact box, padding the remainder.
 *
 * `sizedImage` uses `c_limit`, which only ever scales — the browser then
 * centre-crops whatever does not fit the element. That is fine for a photo of
 * a room and wrong for the flyers many of our businesses upload as their
 * cover: cropping a wide flyer into a portrait cell takes the first and last
 * letters off every line, and the home page's gallery read "sach & / ar round
 * / tchen / shering".
 *
 * A content-aware crop (`c_fill,g_auto`) was the first fix and is better, but
 * only moves the problem: on that same flyer it locked onto the person and
 * still cut the words. So this pads instead of cropping. `b_auto` fills the
 * remainder with a colour sampled from the image itself, so a padded flyer
 * reads as a framed flyer rather than a photo on a grey card, and a photo that
 * already matches the box is untouched. Nothing is ever cut.
 *
 * Non-Cloudinary URLs come back unchanged, same as `sizedImage`.
 */
export function framedImage(url, width, height) {
  if (!isCloudinary(url) || !url.includes('/upload/')) return url;
  const [head, tail] = url.split('/upload/', 2);
  const segs = tail.split('/');
  while (segs.length && segs[0].includes('_') && !segs[0].includes('.')) {
    if (/^v\d+$/.test(segs[0])) break;
    segs.shift();
  }
  return `${head}/upload/w_${width},h_${height},c_pad,b_auto,f_auto,q_auto/${segs.join('/')}`;
}

/**
 * Build a Cloudinary video-frame poster URL.
 *
 *   videoPoster('https://res.cloudinary.com/.../video/upload/v123/foo.mp4', 1200)
 *     -> 'https://res.cloudinary.com/.../video/upload/so_0,w_1200,c_limit,f_jpg,q_auto/v123/foo.jpg'
 *
 * `so_0` locks the poster to the very first frame of the video. We used to
 * rely on `so_auto`, which Cloudinary resolves to the "most interesting"
 * frame — that produced unpredictable mid-video stills (e.g. a blurry pan
 * halfway through a tour) and made the grid look broken. The first frame is
 * always under the lister's control (they pick how the video opens), so
 * locking to `so_0` gives them a deterministic, intentional cover image.
 * Non-Cloudinary URLs return undefined so the <video> element falls back
 * to its native first-frame behavior.
 */
export function videoPoster(url, width = 1200) {
  if (!url || !url.includes('res.cloudinary.com') || !url.includes('/video/upload/')) {
    return undefined;
  }
  const [head, tail] = url.split('/upload/', 2);
  // Strip any leading transform segment we already injected (e.g. q_auto)
  const segs = tail.split('/');
  while (segs.length && segs[0].includes('_') && !segs[0].includes('.')) {
    if (/^v\d+$/.test(segs[0])) break;
    segs.shift();
  }
  // Swap the file extension to .jpg so Cloudinary returns a still frame
  const last = segs[segs.length - 1];
  if (last.includes('.')) {
    segs[segs.length - 1] = last.replace(/\.[^.]+$/, '.jpg');
  }
  return `${head}/upload/so_0,w_${width},c_limit,f_jpg,q_auto/${segs.join('/')}`;
}

/**
 * Build a `srcset` string with 1x / 2x descriptors for a given base width.
 * Use with `<img srcset={...} sizes={...} />`.
 */
export function srcSet(url, width) {
  if (!isCloudinary(url)) return undefined;
  return `${sizedImage(url, width)} 1x, ${sizedImage(url, width * 2)} 2x`;
}
