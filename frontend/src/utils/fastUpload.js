/**
 * Fast media upload helper:
 *  1. Compress photos client-side (8 MB → ~400 KB) using <canvas>.
 *  2. Get a signed Cloudinary upload signature from our backend (one call).
 *  3. Upload all files in parallel directly to Cloudinary's CDN edge —
 *     our backend never holds the bytes, so big videos don't time out
 *     and 10-photo uploads take ~5 s instead of ~60 s.
 *  4. Graceful fallback to the legacy POST /api/upload endpoint when
 *     Cloudinary isn't configured (preview env) or signing fails.
 *
 * Returns the same `{url, file_type, filename, size, original_name}` shape
 * the existing caller expects, so MediaUploadSection.handleFileUpload can
 * keep its downstream logic unchanged.
 */
import axios from 'axios';
import { stripImageMetadata } from './stripImageMetadata';

const MAX_IMAGE_DIMENSION = 2400; // px; covers Retina displays at full-screen
const IMAGE_QUALITY = 0.85;       // JPEG quality
const COMPRESS_MIME = 'image/jpeg';

// Formats a browser canvas cannot be trusted to decode. HEIC/HEIF is
// what every iPhone shoots by default: Safari can read it, Chrome and
// Firefox cannot. Cloudinary converts it server-side without complaint,
// so the right move is to skip our own compression and upload the
// original rather than fail.
const CANVAS_CANNOT_DECODE = /^image\/(heic|heif|avif)/i;

// HEIC IS THE ONE THIS FILE CANNOT MAKE SAFE, and it is the iPhone
// default, so it is also the format most likely to arrive with GPS.
// It is ISOBMFF: Chrome and Firefox cannot decode it, so there is no
// canvas route, and rewriting its box structure by hand in the browser
// is not something to do on the upload path. `stripImageMetadata`
// deliberately refuses it rather than pretending.
//
// It is handled where the bytes land instead - the server applies an
// incoming transformation so Cloudinary stores a re-encoded copy with no
// metadata. See backend/routes/misc.py::get_cloudinary_signature.

/** Resize + recompress a large image File into a smaller Blob.
 *
 *  NEVER throws. Compression is an optimisation, and an optimisation
 *  that can fail the whole upload is worse than no optimisation at all.
 *  Any problem here returns the ORIGINAL file and lets Cloudinary deal
 *  with it — which it can, including the formats a canvas cannot read.
 *
 *  This mattered: an iPhone photo made `new Image()` fire onerror, which
 *  rejected, and because the caller compresses with Promise.all a single
 *  undecodable photo failed the entire upload before one byte was sent.
 *  The user saw "Upload failed" with no reason, and retrying could never
 *  work because nothing about it was transient.
 */
async function compressImage(file) {
  try {
    if (!file.type.startsWith('image/') || file.type === 'image/gif') return file;
    if (CANVAS_CANNOT_DECODE.test(file.type)) return file;
    // Skip tiny files — recompression would just add overhead.
    if (file.size < 600 * 1024) return file;

    const dataUrl = await new Promise((resolve, reject) => {
      const r = new FileReader();
      r.onload = () => resolve(r.result);
      r.onerror = () => reject(new Error('could not read the file'));
      r.readAsDataURL(file);
    });
    const img = await new Promise((resolve, reject) => {
      const i = new Image();
      i.onload = () => resolve(i);
      // An Event, not an Error, is what used to propagate — which is why
      // the message came out blank.
      i.onerror = () => reject(new Error(`browser cannot decode ${file.type || 'this image'}`));
      i.src = dataUrl;
    });

    let { width, height } = img;
    if (width > MAX_IMAGE_DIMENSION || height > MAX_IMAGE_DIMENSION) {
      const ratio = Math.min(MAX_IMAGE_DIMENSION / width, MAX_IMAGE_DIMENSION / height);
      width = Math.round(width * ratio);
      height = Math.round(height * ratio);
    }

    const canvas = document.createElement('canvas');
    canvas.width = width;
    canvas.height = height;
    const ctx = canvas.getContext('2d');
    ctx.drawImage(img, 0, 0, width, height);

    const blob = await new Promise((resolve) =>
      canvas.toBlob(resolve, COMPRESS_MIME, IMAGE_QUALITY)
    );

    // If the "compressed" version is somehow larger, keep the original
    if (!blob || blob.size >= file.size) return file;
    return new File([blob], file.name.replace(/\.[^.]+$/, '.jpg'), {
      type: COMPRESS_MIME,
      lastModified: Date.now(),
    });
  } catch (err) {
    // Upload the original. Slower, and it works.
    return file;
  }
}

/** Fetch a fresh signature from our backend (per upload session). */
async function getSignature(API, token, resourceType, stripMetadata = false) {
  const res = await axios.get(`${API}/cloudinary/signature`, {
    params: {
      resource_type: resourceType,
      folder: 'myisraelrental',
      // Only ever set for formats we could not strip in the browser.
      // It makes Cloudinary re-encode before storing, which drops the
      // source metadata - and forces JPEG, which is why it is not on
      // by default (it would flatten a PNG's transparency).
      ...(stripMetadata ? { strip_metadata: true } : {}),
    },
    headers: { Authorization: `Bearer ${token}` },
  });
  return res.data;
}

/** Direct POST to Cloudinary. Returns Cloudinary's secure_url + public_id. */
async function uploadDirectToCloudinary(file, sig, onProgress) {
  const form = new FormData();
  form.append('file', file);
  form.append('api_key', sig.api_key);
  form.append('timestamp', sig.timestamp);
  form.append('signature', sig.signature);
  form.append('folder', sig.folder);
  // Echoed back exactly as the server signed it. Building this string
  // here instead would mean a one-character drift produces "Invalid
  // Signature" on every HEIC upload and nowhere else.
  if (sig.transformation) form.append('transformation', sig.transformation);

  const endpoint = `https://api.cloudinary.com/v1_1/${sig.cloud_name}/${sig.resource_type}/upload`;
  const { data } = await axios.post(endpoint, form, {
    onUploadProgress: (e) => {
      if (onProgress && e.total) onProgress(e.loaded / e.total);
    },
  });
  return data;
}

/** Inject f_auto,q_auto into a Cloudinary URL (same logic as backend). */
function withAutoTransforms(secureUrl, isVideo) {
  if (!secureUrl || !secureUrl.includes('/upload/')) return secureUrl;
  const transform = isVideo ? 'q_auto' : 'f_auto,q_auto';
  const [head, tail] = secureUrl.split('/upload/', 2);
  const first = tail.split('/', 1)[0];
  if (first.includes('q_auto') || first.includes('f_auto')) return secureUrl;
  return `${head}/upload/${transform}/${tail}`;
}

/** Fallback: legacy POST /api/upload (preview env / no Cloudinary creds). */
async function fallbackUpload(file, API, token, onProgress) {
  const form = new FormData();
  form.append('file', file);
  const { data } = await axios.post(`${API}/upload`, form, {
    headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'multipart/form-data' },
    onUploadProgress: (e) => {
      if (onProgress && e.total) onProgress(e.loaded / e.total);
    },
  });
  return { ...data, original_name: file.name };
}

/**
 * Upload many files in parallel.
 *
 * @param files          File[] from <input>
 * @param API            backend base URL
 * @param token          JWT
 * @param onAggregateProgress  callback(fraction 0..1) – averaged across files
 * @returns Promise<Array<{url, file_type, filename, size, original_name, error?}>>
 */
export async function uploadFilesFast(files, API, token, onAggregateProgress) {
  if (!files || files.length === 0) return [];

  // STRIP METADATA BEFORE ANYTHING ELSE, and independently of whether
  // compression runs.
  //
  // The canvas redraw in compressImage drops EXIF, but only as a side
  // effect, and it has six paths that return the ORIGINAL file: non-image,
  // GIF, HEIC/HEIF/AVIF, files under 600 KB, any thrown error, and
  // "compressed came out bigger". Three of those are ordinary phone JPEGs,
  // which is exactly where GPS lives. Someone photographing a sofa in
  // their living room was publishing their address.
  //
  // Running the strip FIRST rather than inside compressImage means it does
  // not depend on compression succeeding - which is the property that was
  // missing, since every failure path fell back to the untouched file.
  const cleaned = await Promise.all(files.map(stripImageMetadata));

  // Compress images (videos pass through unchanged)
  const prepared = await Promise.all(cleaned.map(compressImage));

  // Per-file progress tracker for the aggregate callback
  const perFile = new Array(prepared.length).fill(0);
  const report = () => {
    if (!onAggregateProgress) return;
    const avg = perFile.reduce((a, b) => a + b, 0) / perFile.length;
    onAggregateProgress(avg);
  };

  // Attempt direct-to-Cloudinary path. We can sign once per resource type.
  let imageSig = null;
  let videoSig = null;
  // A SECOND image signature, for the files the browser could not strip.
  // One signature per batch does not work here: the stripping variant
  // carries a transformation in its signed params, and applying that to
  // every image would turn PNGs into JPEGs.
  let strippedImageSig = null;
  try {
    const hasImage = prepared.some((f) => f.type.startsWith('image/'));
    const hasVideo = prepared.some((f) => f.type.startsWith('video/'));
    const needsServerStrip = prepared.some(
      (f) => f.type.startsWith('image/') && CANVAS_CANNOT_DECODE.test(f.type),
    );
    if (hasImage) imageSig = await getSignature(API, token, 'image');
    if (hasVideo) videoSig = await getSignature(API, token, 'video');
    if (needsServerStrip) strippedImageSig = await getSignature(API, token, 'image', true);
  } catch {
    // 503 — Cloudinary not configured. Fall through to legacy path.
    imageSig = null;
    videoSig = null;
    strippedImageSig = null;
  }

  return Promise.all(
    prepared.map(async (file, idx) => {
      const isVideo = file.type.startsWith('video/');
      // HEIC and friends take the stripping signature when we have one.
      const needsServerStrip = !isVideo && CANVAS_CANNOT_DECODE.test(file.type);
      const sig = isVideo
        ? videoSig
        : ((needsServerStrip && strippedImageSig) || imageSig);
      const trackProgress = (fraction) => {
        perFile[idx] = fraction;
        report();
      };
      try {
        if (sig) {
          const res = await uploadDirectToCloudinary(file, sig, trackProgress);
          perFile[idx] = 1;
          report();
          return {
            url: withAutoTransforms(res.secure_url, isVideo),
            file_type: isVideo ? 'video' : 'image',
            filename: res.public_id, // public_id used for delete + dedup key
            size: res.bytes,
            original_name: files[idx].name,
          };
        }
        const res = await fallbackUpload(file, API, token, trackProgress);
        perFile[idx] = 1;
        report();
        return res;
      } catch (err) {
        perFile[idx] = 1;
        report();
        return {
          filename: files[idx].name,
          original_name: files[idx].name,
          // Cloudinary and our own API report errors in DIFFERENT shapes:
          // Cloudinary sends {error:{message}}, we send {detail}. Reading
          // only ours turned "Rate limit reached" into the useless
          // "Request failed with status code 420" — which is exactly the
          // text a stuck owner cannot act on and we cannot diagnose from.
          error: err.response?.data?.error?.message
            || err.response?.data?.detail
            || err.message
            || 'Upload failed',
        };
      }
    })
  );
}


/**
 * Upload ONE file and get its URL, or throw with the real reason.
 *
 * Exists because `uploadFilesFast` returns an array of result OBJECTS,
 * and each one is either `{url, ...}` or `{error, ...}` — never a bare
 * string, and never a rejected promise. Two different callers got that
 * wrong in two different ways:
 *
 *   const [url] = await uploadFilesFast([file], ...)   // the OBJECT,
 *                                                       // always truthy,
 *                                                       // even on failure
 *   const urls = results.map(r => r.url).filter(Boolean)  // real error
 *                                                          // discarded
 *
 * The first shipped and broke every single upload through the photo
 * nudge — it passed an object where a URL string was expected, so the
 * save failed and the user was told to "try again", which could never
 * work. The shape invited both mistakes, so the shape is no longer what
 * single-file callers touch.
 *
 * @returns {Promise<string>} the uploaded URL
 * @throws  {Error} carrying Cloudinary's own message where there is one
 */
export async function uploadOneFile(file, API, token, onProgress) {
  const [res] = await uploadFilesFast([file], API, token, onProgress);
  if (!res) throw new Error('Upload returned nothing');
  if (res.error || !res.url) throw new Error(res.error || 'Upload failed');
  return res.url;
}


/**
 * Tell OUR backend that a browser-side upload failed.
 *
 * These uploads go from the browser straight to Cloudinary's CDN — which
 * is the point, our server never holds the bytes — but it means a failure
 * is completely invisible to us. During an incident the server logs show
 * signature requests returning 200 and nothing else, while people are
 * being told "upload failed" and getting stuck.
 *
 * Fire-and-forget and deliberately silent: a report that fails must never
 * become a second error on top of the first one the person is already
 * looking at. It carries a short reason string and no file contents.
 */
export function reportUploadFailure({ where, count, reason, API, token }) {
  try {
    const body = JSON.stringify({
      where: String(where || '').slice(0, 60),
      count: Number(count) || 1,
      reason: String(reason || 'unknown').slice(0, 300),
    });
    // keepalive so it still goes out if the tab is closing.
    fetch(`${API}/client/upload-failure`, {
      method: 'POST',
      keepalive: true,
      headers: {
        'Content-Type': 'application/json',
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
      },
      body,
    }).catch(() => {});
  } catch { /* never let reporting break the page */ }
}
