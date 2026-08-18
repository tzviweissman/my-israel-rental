/**
 * A branded, downloadable QR for a short link (spec Q3 + Q4).
 *
 * Generated entirely in the browser by qrcode.react — never by a QR image
 * service. A service sees every URL we encode, and services change terms,
 * add watermarks, or disappear; a printed code that depends on one is a
 * printed code that can die. This component depends on nothing but the
 * bundle.
 *
 * The rules baked in here are scanning physics, not styling choices:
 *
 *  - Modules are ink (#23201B) on white. Never gold — gold on white is
 *    roughly 2:1 and scanners need contrast. The code is functional, not
 *    decorative.
 *  - The centre logo destroys modules, so WITH a logo error correction
 *    must be H; without one M is right, and produces a sparser code that
 *    scans more easily. Logo state drives both together — H-with-logo
 *    and M-without are the only two valid pairings.
 *
 *  - The centre is for the OWNER's logo, chosen from their own files: the
 *    mark on their flyer should be theirs, not ours. It never leaves the
 *    browser — the image only has to exist inside the downloaded file.
 *  - Quiet zone: 4 modules of white on every side (marginSize={4}). Crop
 *    it and scanners lose the code's edges.
 *  - The URL is always printed beneath the code. Many people will not
 *    scan, and it keeps the printed piece usable if the code is damaged.
 *
 * Downloads: PNG at 1024px for screens and messaging, SVG for print
 * (scales without loss). The PNG comes from a hidden canvas rendered at
 * full size — scaling the on-screen SVG up would soften the edges that
 * scanning depends on.
 */
import React, { useRef, useState } from 'react';
import { QRCodeCanvas, QRCodeSVG } from 'qrcode.react';
import { useTranslation } from 'react-i18next';
import { Download, Image as ImageIcon, Upload, X } from 'lucide-react';

const INK = '#23201B';
const PNG_SIZE = 1024;

// The owner's own logo, remembered between visits so they set it once.
// A data URI in localStorage, never uploaded anywhere: the logo only has
// to exist inside the downloaded file, so the server never needs it.
const LOGO_STORE_KEY = 'qr_custom_logo';

/** Downscale whatever they picked to a small square data URI. A phone
 *  photo dropped in raw would balloon the SVG to megabytes and slow the
 *  canvas; 256px is plenty for a centre mark that prints at ~2cm. */
function fileToLogoDataUri(file) {
  return new Promise((resolve, reject) => {
    const img = new Image();
    const url = URL.createObjectURL(file);
    img.onload = () => {
      const c = document.createElement('canvas');
      c.width = 256;
      c.height = 256;
      const ctx = c.getContext('2d');
      // White backing, not transparent: the logo sits on excavated (white)
      // modules, and a transparent PNG over them looks fine on screen but
      // any dark edge pixels eat into scan margin.
      ctx.fillStyle = '#FFFFFF';
      ctx.fillRect(0, 0, 256, 256);
      const scale = Math.min(256 / img.width, 256 / img.height);
      const w = img.width * scale;
      const h = img.height * scale;
      ctx.drawImage(img, (256 - w) / 2, (256 - h) / 2, w, h);
      URL.revokeObjectURL(url);
      resolve(c.toDataURL('image/png'));
    };
    img.onerror = () => { URL.revokeObjectURL(url); reject(new Error('bad image')); };
    img.src = url;
  });
}

export default function QrShareCard({ url, filename = 'myisraelrental-qr', testidPrefix = 'qr' }) {
  const { t } = useTranslation();
  // Plain by default. The centre is for the OWNER's logo — the mark on
  // their flyer should be theirs, not ours — added via the button below
  // and remembered for next time.
  const [logoUri, setLogoUri] = useState(() => {
    try { return localStorage.getItem(LOGO_STORE_KEY) || null; } catch { return null; }
  });
  const svgWrapRef = useRef(null);
  const pngRef = useRef(null);
  const fileRef = useRef(null);

  if (!url) return null;

  // Logo and error-correction move as one pair: a centre logo destroys
  // modules, so it requires level H; plain gets M and a sparser code that
  // scans more easily. These are the only two valid pairings.
  const level = logoUri ? 'H' : 'M';
  const displayUrl = url.replace(/^https?:\/\//, '');
  const imageSettings = logoUri
    ? {
        src: logoUri,
        height: 40,
        width: 40,
        // excavate clears the modules under the logo instead of letting
        // them show through it half-obscured — H can rebuild cleared
        // modules, but not smudged ones.
        excavate: true,
      }
    : undefined;

  const pickLogo = async (files) => {
    const file = files && files[0];
    if (!file) return;
    try {
      const uri = await fileToLogoDataUri(file);
      setLogoUri(uri);
      try { localStorage.setItem(LOGO_STORE_KEY, uri); } catch { /* private mode */ }
    } catch { /* unreadable image — leave the code plain */ }
  };

  const clearLogo = () => {
    setLogoUri(null);
    try { localStorage.removeItem(LOGO_STORE_KEY); } catch { /* private mode */ }
  };

  const downloadPng = () => {
    const canvas = pngRef.current?.querySelector('canvas');
    if (!canvas) return;
    const a = document.createElement('a');
    a.href = canvas.toDataURL('image/png');
    a.download = `${filename}.png`;
    a.click();
  };

  const downloadSvg = () => {
    const svg = svgWrapRef.current?.querySelector('svg');
    if (!svg) return;
    const src = new XMLSerializer().serializeToString(svg);
    const blob = new Blob([src], { type: 'image/svg+xml' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = `${filename}.svg`;
    a.click();
    URL.revokeObjectURL(a.href);
  };

  return (
    <div data-testid={`${testidPrefix}-card`}>
      {/* White surface behind the code even on tinted panels — the quiet
          zone has to be genuinely white, not limestone. */}
      <div
        ref={svgWrapRef}
        className="mx-auto w-fit rounded-xl border bg-white p-2"
        style={{ borderColor: 'var(--brand-border)' }}
      >
        <QRCodeSVG
          value={url}
          size={168}
          level={level}
          marginSize={4}
          fgColor={INK}
          bgColor="#FFFFFF"
          imageSettings={imageSettings}
        />
      </div>

      {/* The URL, human-readable, always. dir=ltr because a URL is LTR
          text even on the Hebrew dashboard. */}
      <p
        className="mt-2 text-center text-xs font-semibold select-all"
        style={{ color: 'var(--ink)' }}
        dir="ltr"
        data-testid={`${testidPrefix}-url`}
      >
        {displayUrl}
      </p>

      <div className="mt-2 flex items-center justify-center gap-2">
        <input
          ref={fileRef}
          type="file"
          accept="image/*"
          className="hidden"
          onChange={(e) => pickLogo(e.target.files)}
          data-testid={`${testidPrefix}-logo-input`}
        />
        <button
          type="button"
          onClick={() => fileRef.current?.click()}
          className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-semibold border"
          style={{ borderColor: 'var(--brand-border)', color: 'var(--brand-primary)', background: '#fff' }}
          data-testid={`${testidPrefix}-logo-add`}
        >
          <Upload size={12} aria-hidden="true" />
          {logoUri ? t('qr.logoReplace', 'Change logo') : t('qr.logoAdd', 'Add your logo')}
        </button>
        {logoUri && (
          <button
            type="button"
            onClick={clearLogo}
            className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-full text-xs font-semibold"
            style={{ color: 'var(--brand-muted)' }}
            data-testid={`${testidPrefix}-logo-remove`}
          >
            <X size={12} aria-hidden="true" />
            {t('qr.logoRemove', 'Remove')}
          </button>
        )}
      </div>

      <div className="mt-3 flex justify-center gap-2">
        <button
          type="button"
          onClick={downloadPng}
          className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-semibold text-white"
          style={{ background: 'var(--brand-primary)' }}
          data-testid={`${testidPrefix}-download-png`}
        >
          <ImageIcon size={13} aria-hidden="true" />
          {t('qr.downloadPng', 'PNG for screens')}
        </button>
        <button
          type="button"
          onClick={downloadSvg}
          className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-semibold border"
          style={{ borderColor: 'var(--brand-border)', color: 'var(--brand-primary)', background: '#fff' }}
          data-testid={`${testidPrefix}-download-svg`}
        >
          <Download size={13} aria-hidden="true" />
          {t('qr.downloadSvg', 'SVG for print')}
        </button>
      </div>

      <p className="mt-2 text-center text-[11px]" style={{ color: 'var(--brand-muted)' }}>
        {t('qr.printSize', 'Print at least 2 × 2 cm — larger for a building sign.')}
      </p>

      {/* Hidden full-resolution canvas that the PNG download reads from. */}
      <div ref={pngRef} className="hidden" aria-hidden="true">
        <QRCodeCanvas
          value={url}
          size={PNG_SIZE}
          level={level}
          marginSize={4}
          fgColor={INK}
          bgColor="#FFFFFF"
          imageSettings={
            logoUri
              ? {
                  ...imageSettings,
                  // Same logo-to-code ratio as the preview (40/168), so
                  // what was verified to scan on screen is what prints.
                  height: Math.round((PNG_SIZE * 40) / 168),
                  width: Math.round((PNG_SIZE * 40) / 168),
                }
              : undefined
          }
        />
      </div>
    </div>
  );
}
