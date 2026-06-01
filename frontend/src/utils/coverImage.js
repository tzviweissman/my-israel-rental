/**
 * Single source of truth for the fallback property image.
 *
 * Returns the cover image URL plus a flag indicating whether the URL is the
 * fallback (so the UI can render a "Default image" badge and the lister
 * knows to upload real photos).
 *
 * If the property has no images but has at least one Cloudinary video,
 * we synthesize a still-frame poster from the first video instead of
 * falling back to the generic placeholder. That keeps video-only
 * listings visually informative.
 *
 * When we *do* fall back to a placeholder we rotate between 5 different
 * apartment images so the homepage / search grid doesn't look like a
 * monoculture of one Pexels stock photo. The pick is deterministic per
 * property (hashed from the property id / address) so the same listing
 * always shows the same default — switching photos on every page-load
 * would look broken.
 */
import { sizedImage, videoPoster } from './cdnImage';

// Curated Pexels apartment / home interior stock photos. Public CDN
// URLs; the `auto=compress&cs=tinysrgb&w=940` query string trims them
// to a sensible size before Cloudinary-style transforms.
const FALLBACK_URLS = [
  'https://images.pexels.com/photos/1571460/pexels-photo-1571460.jpeg?auto=compress&cs=tinysrgb&w=940',
  'https://images.pexels.com/photos/1571468/pexels-photo-1571468.jpeg?auto=compress&cs=tinysrgb&w=940',
  'https://images.pexels.com/photos/1571463/pexels-photo-1571463.jpeg?auto=compress&cs=tinysrgb&w=940',
  'https://images.pexels.com/photos/2079246/pexels-photo-2079246.jpeg?auto=compress&cs=tinysrgb&w=940',
  'https://images.pexels.com/photos/2724748/pexels-photo-2724748.jpeg?auto=compress&cs=tinysrgb&w=940',
];

const FALLBACK_URL = FALLBACK_URLS[0]; // kept for legacy imports

// djb2-style string hash. Cheap, stable across reloads, fine for picking
// 1-of-N — we don't need crypto here.
const hashSeed = (seed) => {
  if (!seed) return 0;
  const s = String(seed);
  let h = 5381;
  for (let i = 0; i < s.length; i++) {
    h = ((h << 5) + h + s.charCodeAt(i)) >>> 0; // unsigned 32-bit
  }
  return h;
};

const pickFallback = (seed) => FALLBACK_URLS[hashSeed(seed) % FALLBACK_URLS.length];

const isVideoUrl = (u) =>
  typeof u === 'string' &&
  (u.includes('/video/upload/') || /\.(mp4|mov|webm|m4v|mkv)(\?|$)/i.test(u));

/**
 * @param {string[] | undefined} images   ordered media URLs (mixed image+video supported)
 * @param {number}               width    target render width in px (used for sizedImage CDN transforms)
 * @param {string}               apiBase  backend base (handles legacy /api/uploads URLs)
 * @param {string[] | undefined} videos   optional video URLs, used when no images exist
 * @param {string | undefined}   seed     property id / address — picks a stable default photo per listing
 * @returns {{ url: string, isDefault: boolean, fromVideo: boolean }}
 */
export function getCoverImage(images, width = 600, apiBase = '', videos = undefined, seed = undefined) {
  // 1. Real image present → use it
  const firstImage = (images || []).find((u) => u && !isVideoUrl(u));
  if (firstImage) {
    const absolute = firstImage.startsWith('/api') && apiBase
      ? `${apiBase.replace(/\/api$/, '')}${firstImage}`
      : firstImage;
    return {
      url: sizedImage(absolute, width) || absolute,
      isDefault: false,
      fromVideo: false,
    };
  }

  // 2. No image but a video exists → synthesize a poster frame
  const candidateVideos = [
    ...(images || []).filter(isVideoUrl),
    ...(videos || []).filter(isVideoUrl),
  ];
  for (const v of candidateVideos) {
    const poster = videoPoster(v, width);
    if (poster) {
      return { url: poster, isDefault: false, fromVideo: true };
    }
  }

  // 3. Nothing at all → deterministic 1-of-5 generic apartment placeholder
  return { url: pickFallback(seed), isDefault: true, fromVideo: false };
}

export { FALLBACK_URL, FALLBACK_URLS };
