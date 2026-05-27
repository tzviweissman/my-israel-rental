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
 */
import { sizedImage, videoPoster } from './cdnImage';

const FALLBACK_URL =
  'https://images.pexels.com/photos/1669799/pexels-photo-1669799.jpeg?auto=compress&cs=tinysrgb&dpr=2&h=650&w=940';

const isVideoUrl = (u) =>
  typeof u === 'string' &&
  (u.includes('/video/upload/') || /\.(mp4|mov|webm|m4v|mkv)(\?|$)/i.test(u));

/**
 * @param {string[] | undefined} images   ordered media URLs (mixed image+video supported)
 * @param {number}               width    target render width in px (used for sizedImage CDN transforms)
 * @param {string}               apiBase  backend base (handles legacy /api/uploads URLs)
 * @param {string[] | undefined} videos   optional video URLs, used when no images exist
 * @returns {{ url: string, isDefault: boolean, fromVideo: boolean }}
 */
export function getCoverImage(images, width = 600, apiBase = '', videos = undefined) {
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

  // 3. Nothing at all → generic fallback
  return { url: FALLBACK_URL, isDefault: true, fromVideo: false };
}

export { FALLBACK_URL };
