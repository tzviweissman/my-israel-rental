/**
 * Remove EXIF (and therefore GPS) from an image before it is uploaded.
 *
 * WHY THIS IS NOT OPTIONAL. Someone photographs a sofa in their living
 * room and posts it to a public board. If the file carries EXIF GPS, the
 * listing publishes their home address to anyone who downloads the photo
 * and opens its properties. On a board whose whole purpose is arranging
 * for a stranger to come to that address, that is the single worst thing
 * a photo upload can leak.
 *
 * WHAT WAS ACTUALLY HAPPENING. `fastUpload.js` compresses through a
 * <canvas>, and a canvas redraw drops metadata as a side effect. That is
 * where the protection came from - incidentally, never deliberately - and
 * `compressImage` has SIX paths that return the ORIGINAL file untouched:
 *
 *   1. not an image            (video; out of scope here)
 *   2. image/gif               (GIF has no EXIF - genuinely safe)
 *   3. HEIC / HEIF / AVIF      (canvas cannot decode it - see below)
 *   4. file.size < 600 KB      (a 600 KB phone JPEG carries GPS happily)
 *   5. any thrown error        (the catch returns the original)
 *   6. compressed came out bigger
 *
 * Paths 4, 5 and 6 are ordinary JPEG and PNG, and this module handles
 * them by rewriting the container and dropping the metadata segments.
 * Nothing is re-encoded, so there is no quality loss and no CPU cost
 * worth measuring - it is a byte-level filter over the segment list.
 *
 * PATH 3 IS NOT SOLVABLE HERE, and pretending otherwise would be worse
 * than leaving it. HEIC is the iPhone default and the format most likely
 * to carry GPS, and it is ISOBMFF - Chrome and Firefox cannot decode it
 * at all, so there is no canvas route and no safe client-side rewrite.
 * It is handled where the bytes land instead; see the note in
 * `fastUpload.js` and the server-side strip.
 *
 * Returns the original File when there is nothing to remove or anything
 * looks unexpected. Never throws: an upload that fails closed over a
 * metadata question is a worse outcome than the metadata.
 */

/** JPEG markers that carry metadata rather than image data. */
const JPEG_METADATA_MARKERS = new Set([
  0xe1, // APP1  - EXIF (this is the one with GPS in it) and XMP
  0xe2, // APP2  - ICC / FlashPix
  0xe3, 0xe4, 0xe5, 0xe6, 0xe7, 0xe8, 0xe9, 0xea, 0xeb, 0xec,
  0xed, // APP13 - IPTC, which also has location fields
  0xee, 0xef,
  0xfe, // COM   - free-text comment
]);

/** PNG chunks that carry metadata. `eXIf` is the one with GPS. */
const PNG_METADATA_CHUNKS = new Set(['eXIf', 'tEXt', 'iTXt', 'zTXt']);

function stripJpeg(bytes) {
  // SOI
  if (bytes[0] !== 0xff || bytes[1] !== 0xd8) return null;
  const out = [bytes.subarray(0, 2)];
  let i = 2;
  let removed = false;

  while (i < bytes.length - 1) {
    if (bytes[i] !== 0xff) return null; // not a marker where one must be
    const marker = bytes[i + 1];

    // Start of scan: the entropy-coded image data runs to the end, and
    // there are no more metadata segments after it.
    if (marker === 0xda) {
      out.push(bytes.subarray(i));
      break;
    }
    // Standalone markers carry no length field.
    if (marker === 0xd8 || (marker >= 0xd0 && marker <= 0xd9) || marker === 0x01) {
      out.push(bytes.subarray(i, i + 2));
      i += 2;
      continue;
    }
    if (i + 4 > bytes.length) return null;
    const length = (bytes[i + 2] << 8) | bytes[i + 3];
    if (length < 2 || i + 2 + length > bytes.length) return null;

    if (JPEG_METADATA_MARKERS.has(marker)) {
      removed = true;              // drop the whole segment
    } else {
      out.push(bytes.subarray(i, i + 2 + length));
    }
    i += 2 + length;
  }

  if (!removed) return null;       // nothing to do; keep the original File
  const total = out.reduce((n, part) => n + part.length, 0);
  const merged = new Uint8Array(total);
  let at = 0;
  for (const part of out) { merged.set(part, at); at += part.length; }
  return merged;
}

function stripPng(bytes) {
  const SIG = [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a];
  for (let k = 0; k < SIG.length; k += 1) if (bytes[k] !== SIG[k]) return null;

  const out = [bytes.subarray(0, 8)];
  let i = 8;
  let removed = false;
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);

  while (i + 8 <= bytes.length) {
    const length = view.getUint32(i);
    const type = String.fromCharCode(bytes[i + 4], bytes[i + 5], bytes[i + 6], bytes[i + 7]);
    const end = i + 12 + length;             // len + type + data + crc
    if (end > bytes.length) return null;

    if (PNG_METADATA_CHUNKS.has(type)) {
      removed = true;
    } else {
      out.push(bytes.subarray(i, end));
    }
    i = end;
    if (type === 'IEND') break;
  }

  if (!removed) return null;
  const total = out.reduce((n, part) => n + part.length, 0);
  const merged = new Uint8Array(total);
  let at = 0;
  for (const part of out) { merged.set(part, at); at += part.length; }
  return merged;
}

/** True for formats this module can rewrite safely. */
export const canStripLocally = (type) => /^image\/(jpeg|jpg|png)$/i.test(type || '');

/**
 * @param {File} file
 * @returns {Promise<File>} the same file, or a copy with metadata removed
 */
export async function stripImageMetadata(file) {
  try {
    if (!file || !canStripLocally(file.type)) return file;
    const bytes = new Uint8Array(await file.arrayBuffer());
    const stripped = /png$/i.test(file.type) ? stripPng(bytes) : stripJpeg(bytes);
    if (!stripped) return file;
    return new File([stripped], file.name, {
      type: file.type,
      lastModified: file.lastModified,
    });
  } catch {
    // Fail open on the upload, never on the person's ability to post.
    return file;
  }
}

export default stripImageMetadata;
