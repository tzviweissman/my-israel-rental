/**
 * Under each listing on the owner's dashboard: what the listing is still
 * missing, and a kit for sharing it (Tzvi, 29 Oct 2026, "do 3 and 4").
 *
 * Three checks, the same spirit as BusinessCompleteness: what a renter
 * looks at first (photos, price, a few lines about the place), each one
 * opening the edit form. No invented "listings with photos get 3x" claims;
 * the gaps are the argument. The bar goes away when all three are done.
 *
 * The share kit: the listing's link (WhatsApp, share sheet, copy) and a
 * ready-made picture to post in Facebook groups or a WhatsApp status: the
 * cover photo at its own shape (never cropped), with title, area and price
 * under it. On a phone it opens the share sheet; elsewhere it downloads.
 */
import React, { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Circle, ImageDown, Loader2, Share2 } from 'lucide-react';
import { toast } from 'sonner';
import ShareLinkButtons from '../common/ShareLinkButtons';
import { regularShown, holidayShown, priceSymbol, unitLabel } from '../../utils/listingPrice';
import { areaLabel } from '../../utils/areaNames';

const MIN_PHOTOS = 5;
const isPhoto = (u) => typeof u === 'string' && /^https?:/.test(u) && !/\.(mp4|mov|webm|m4v)(\?|$)/i.test(u);

const loadImage = (src) => new Promise((resolve, reject) => {
  const img = new Image();
  img.crossOrigin = 'anonymous';
  img.onload = () => resolve(img);
  img.onerror = reject;
  img.src = src;
});

// Shortens a line with "…" until it fits the width.
const fit = (ctx, text, width) => {
  let s = text;
  while (s.length > 1 && ctx.measureText(s).width > width) s = s.slice(0, -2) + '…';
  return s;
};

async function drawPicture(property, { area, price }) {
  const W = 1080, PAD = 64, BAND = 300;
  const cover = (property.images || []).find(isPhoto);
  const img = cover ? await loadImage(cover) : null;
  const photoH = img ? Math.min(Math.round(W * img.naturalHeight / img.naturalWidth), 1350) : 0;
  const photoW = img ? Math.round(photoH * img.naturalWidth / img.naturalHeight) : 0;

  const c = document.createElement('canvas');
  c.width = W;
  c.height = photoH + BAND;
  const ctx = c.getContext('2d');
  ctx.fillStyle = '#FFFFFF';
  ctx.fillRect(0, 0, W, c.height);
  // A very tall photo is shown whole and centred on white, not cut.
  if (img) ctx.drawImage(img, (W - photoW) / 2, 0, photoW, photoH);

  const rtl = document.documentElement.dir === 'rtl';
  ctx.direction = rtl ? 'rtl' : 'ltr';
  ctx.textAlign = rtl ? 'right' : 'left';
  const x = rtl ? W - PAD : PAD;
  const css = getComputedStyle(document.documentElement);
  const head = css.getPropertyValue('--font-head').trim() || 'serif';
  const body = css.getPropertyValue('--font-body').trim() || 'sans-serif';

  ctx.fillStyle = '#111827';
  ctx.font = `600 54px ${head}`;
  ctx.fillText(fit(ctx, property.title || '', W - PAD * 2), x, photoH + 96);
  ctx.fillStyle = '#167AB8';
  ctx.font = `600 40px ${body}`;
  ctx.fillText(fit(ctx, [area, price].filter(Boolean).join(' · '), W - PAD * 2), x, photoH + 170);
  ctx.fillStyle = '#666666';
  ctx.font = `400 32px ${body}`;
  ctx.fillText('myisraelrental.com', x, photoH + 240);

  return new Promise((resolve) => c.toBlob(resolve, 'image/jpeg', 0.9));
}

export default function ListingStrength({ property, onEdit }) {
  const { t } = useTranslation();
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const p = property;

  // The dashboard list carries only the cover; image_count is the full number.
  const photos = p.image_count ?? (p.images || []).filter(isPhoto).length;
  const checks = [
    { key: 'photos', done: photos >= MIN_PHOTOS, label: t('strength.photos', 'Add at least {{min}} photos ({{n}} now)', { min: MIN_PHOTOS, n: photos }) },
    { key: 'price', done: !!(regularShown(p) || holidayShown(p)), label: t('strength.price', 'Add a price') },
    { key: 'description', done: (p.description || '').trim().length >= 80, label: t('strength.description', 'Write a few lines about the place') },
  ];
  const done = checks.filter((c) => c.done).length;
  const url = `${window.location.origin}/property/${p.id}`;

  const makePicture = async () => {
    setBusy(true);
    try {
      const shown = regularShown(p) || holidayShown(p);
      const blob = await drawPicture(p, {
        area: areaLabel(p.area, t),
        price: shown ? `${priceSymbol(shown.currency)}${Number(shown.amount).toLocaleString()} / ${unitLabel(shown, t)}` : '',
      });
      const file = new File([blob], `listing-${p.id.slice(0, 8)}.jpg`, { type: 'image/jpeg' });
      if (navigator.canShare && navigator.canShare({ files: [file] })) {
        await navigator.share({ files: [file], text: url }).catch(() => {});
      } else {
        const a = document.createElement('a');
        a.href = URL.createObjectURL(file);
        a.download = file.name;
        a.click();
        setTimeout(() => URL.revokeObjectURL(a.href), 5000);
      }
    } catch {
      toast.error(t('strength.pictureFailed', 'Could not make the picture. Try again.'));
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="mt-3 space-y-2" data-testid={`listing-strength-${p.id}`}>
      {done < checks.length && (
        <div className="rounded-lg border border-[var(--brand-border)] p-3">
          <div className="flex items-center justify-between text-xs font-semibold mb-1.5" style={{ color: 'var(--ink)' }}>
            <span>{t('strength.title', 'Listing strength')}</span>
            <span>{done}/{checks.length}</span>
          </div>
          <div className="h-1.5 rounded-full bg-[#E3E3E3] overflow-hidden mb-2">
            <div className="h-full rounded-full" style={{ width: `${(done / checks.length) * 100}%`, background: 'var(--gold)' }} />
          </div>
          {checks.filter((c) => !c.done).map((c) => (
            <button key={c.key} type="button" onClick={() => onEdit(p)}
              className="w-full flex items-center gap-2 py-1 text-xs text-start hover:underline" style={{ color: 'var(--brand-primary)' }}
              data-testid={`strength-${c.key}-${p.id}`}>
              <Circle size={12} className="shrink-0" aria-hidden="true" />
              {c.label}
            </button>
          ))}
        </div>
      )}

      <button type="button" onClick={() => setOpen((o) => !o)} aria-expanded={open}
        className="w-full flex items-center justify-center gap-2 px-3 py-2 rounded-lg text-sm font-medium border border-[var(--brand-border)]"
        style={{ color: 'var(--brand-primary)' }} data-testid={`share-kit-btn-${p.id}`}>
        <Share2 size={15} aria-hidden="true" /> {t('strength.share', 'Share this listing')}
      </button>
      {open && (
        <div className="rounded-lg bg-[#F9FAFB] p-3 space-y-2" data-testid={`share-kit-${p.id}`}>
          <ShareLinkButtons url={url} testidPrefix={`listing-${p.id}`} />
          <button type="button" onClick={makePicture} disabled={busy}
            className="w-full inline-flex items-center justify-center gap-1.5 py-2 rounded-lg text-xs font-semibold text-white disabled:opacity-60"
            style={{ background: 'var(--action, #000)' }} data-testid={`share-picture-${p.id}`}>
            {busy ? <Loader2 size={13} className="animate-spin" aria-hidden="true" /> : <ImageDown size={13} aria-hidden="true" />}
            {t('strength.picture', 'Picture to post in groups')}
          </button>
          <p className="text-[11px] text-gray-600">
            {t('strength.pictureHint', 'Post the picture in Facebook groups or your WhatsApp status, with the link under it.')}
          </p>
        </div>
      )}
    </div>
  );
}
