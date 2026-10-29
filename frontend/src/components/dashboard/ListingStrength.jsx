/**
 * Under each listing on the owner's dashboard: what the listing is still
 * missing, and a kit for sharing it (Tzvi, 29 Oct 2026, "do 3 and 4").
 *
 * Three checks, the same spirit as BusinessCompleteness: what a renter
 * looks at first (photos, price, a few lines about the place), each one
 * opening the edit form. No invented "listings with photos get 3x" claims;
 * the gaps are the argument. The bar goes away when all three are done.
 *
 * The share kit: the listing's link (WhatsApp, share sheet, copy) and the
 * ad maker (AdMaker.jsx), which replaced the single plain picture here.
 */
import React, { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Circle, Megaphone, Share2 } from 'lucide-react';
import ShareLinkButtons from '../common/ShareLinkButtons';
import AdMaker from './AdMaker';
import { regularShown, holidayShown } from '../../utils/listingPrice';

const MIN_PHOTOS = 5;
const isPhoto = (u) => typeof u === 'string' && /^https?:/.test(u) && !/\.(mp4|mov|webm|m4v)(\?|$)/i.test(u);

export default function ListingStrength({ property, onEdit, API, token }) {
  const { t } = useTranslation();
  const [open, setOpen] = useState(false);
  const [adOpen, setAdOpen] = useState(false);
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
          <button type="button" onClick={() => setAdOpen(true)}
            className="w-full inline-flex items-center justify-center gap-1.5 py-2 rounded-lg text-xs font-semibold text-white"
            style={{ background: 'var(--action, #000)' }} data-testid={`make-ad-${p.id}`}>
            <Megaphone size={13} aria-hidden="true" />
            {t('strength.picture', 'Make an ad to post')}
          </button>
          <p className="text-[11px] text-gray-600">
            {t('strength.pictureHint', 'A ready-made picture and post text for Facebook groups, Instagram or your WhatsApp status, with your link on it.')}
          </p>
        </div>
      )}
      {adOpen && <AdMaker API={API} token={token} targetType="property" target={p} onClose={() => setAdOpen(false)} />}
    </div>
  );
}
