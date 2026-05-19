/**
 * Single source of truth for the fallback property image.
 *
 * Returns the cover image URL plus a flag indicating whether the URL is the
 * fallback (so the UI can render a "Default image" badge and the lister
 * knows to upload real photos).
 */
import { sizedImage } from './cdnImage';

const FALLBACK_URL =
  'https://images.pexels.com/photos/1669799/pexels-photo-1669799.jpeg?auto=compress&cs=tinysrgb&dpr=2&h=650&w=940';

/**
 * @param {string[] | undefined} images
 * @param {number}               width   target render width in px (used for sizedImage CDN transforms)
 * @param {string}               apiBase backend base (handles legacy /api/uploads URLs)
 * @returns {{ url: string, isDefault: boolean }}
 */
export function getCoverImage(images, width = 600, apiBase = '') {
  const first = images?.[0];
  if (!first) {
    return { url: FALLBACK_URL, isDefault: true };
  }
  const absolute = first.startsWith('/api') && apiBase
    ? `${apiBase.replace(/\/api$/, '')}${first}`
    : first;
  return { url: sizedImage(absolute, width) || absolute, isDefault: false };
}

export { FALLBACK_URL };
