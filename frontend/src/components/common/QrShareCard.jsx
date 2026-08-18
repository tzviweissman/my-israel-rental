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
 *  - The centre logo destroys modules, so WITH the logo error correction
 *    must be H; without it M is right, and produces a sparser code that
 *    scans more easily. The toggle switches both together — H-with-logo
 *    and M-without are the only two valid pairings.
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
import { Download, Image as ImageIcon } from 'lucide-react';
import logoMark from '../../assets/brand/logo-mark.png';

const INK = '#23201B';
const PNG_SIZE = 1024;

export default function QrShareCard({ url, filename = 'myisraelrental-qr', testidPrefix = 'qr' }) {
  const { t } = useTranslation();
  const [withLogo, setWithLogo] = useState(true);
  const svgWrapRef = useRef(null);
  const pngRef = useRef(null);

  if (!url) return null;

  const level = withLogo ? 'H' : 'M';
  const displayUrl = url.replace(/^https?:\/\//, '');
  const imageSettings = withLogo
    ? {
        src: logoMark,
        height: 40,
        width: 40,
        // excavate clears the modules under the logo instead of letting
        // them show through it half-obscured — H can rebuild cleared
        // modules, but not smudged ones.
        excavate: true,
      }
    : undefined;

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

      <label className="mt-2 flex items-center justify-center gap-2 text-xs" style={{ color: 'var(--brand-muted)' }}>
        <input
          type="checkbox"
          checked={withLogo}
          onChange={(e) => setWithLogo(e.target.checked)}
          data-testid={`${testidPrefix}-logo-toggle`}
        />
        {t('qr.logoToggle', 'Logo in the centre')}
      </label>

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
            withLogo
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
