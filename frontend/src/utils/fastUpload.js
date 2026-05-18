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

const MAX_IMAGE_DIMENSION = 2400; // px; covers Retina displays at full-screen
const IMAGE_QUALITY = 0.85;       // JPEG quality
const COMPRESS_MIME = 'image/jpeg';

/** Resize + recompress a large image File into a smaller Blob. */
async function compressImage(file) {
  if (!file.type.startsWith('image/') || file.type === 'image/gif') return file;
  // Skip tiny files — recompression would just add overhead.
  if (file.size < 600 * 1024) return file;

  const dataUrl = await new Promise((resolve, reject) => {
    const r = new FileReader();
    r.onload = () => resolve(r.result);
    r.onerror = reject;
    r.readAsDataURL(file);
  });
  const img = await new Promise((resolve, reject) => {
    const i = new Image();
    i.onload = () => resolve(i);
    i.onerror = reject;
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
}

/** Fetch a fresh signature from our backend (per upload session). */
async function getSignature(API, token, resourceType) {
  const res = await axios.get(`${API}/cloudinary/signature`, {
    params: { resource_type: resourceType, folder: 'myisraelrental' },
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

  // Compress images first (videos pass through unchanged)
  const prepared = await Promise.all(files.map(compressImage));

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
  try {
    const hasImage = prepared.some((f) => f.type.startsWith('image/'));
    const hasVideo = prepared.some((f) => f.type.startsWith('video/'));
    if (hasImage) imageSig = await getSignature(API, token, 'image');
    if (hasVideo) videoSig = await getSignature(API, token, 'video');
  } catch {
    // 503 — Cloudinary not configured. Fall through to legacy path.
    imageSig = null;
    videoSig = null;
  }

  return Promise.all(
    prepared.map(async (file, idx) => {
      const isVideo = file.type.startsWith('video/');
      const sig = isVideo ? videoSig : imageSig;
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
          error: err.response?.data?.detail || err.message || 'Upload failed',
        };
      }
    })
  );
}
