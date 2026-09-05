/**
 * Quick edit for a published listing.
 *
 * The question this answers: "I've spotted a typo / that's the wrong
 * photo — can I fix it?" Until now the honest answer was no. The backend
 * has accepted PATCH on a gig all along, but nothing in the app ever
 * called it with anything except a photo URL — there was no edit screen,
 * as the comment on the photo nudge in MyGigsTab said outright. An owner
 * who misspelled their own business name could only delete the listing
 * and build it again from the wizard.
 *
 * Deliberately NOT the wizard. Re-running six steps to fix one word is
 * why people leave the mistake there instead. This is one sheet holding
 * the things that actually get typed wrong: the title, the description,
 * and each option's name, price and photos.
 *
 * What it does not touch: category, listing type, availability, booking
 * mode, service area. Those change what the listing IS and belong in a
 * considered flow, not a quick correction. They are one step away in the
 * wizard.
 *
 * The OFFER belongs here rather than in the wizard for the same reason the
 * typo does: a business decides to run one on a Tuesday and wants it up in
 * a minute, and takes it down the same way. It is percent-only, and it
 * never rewrites the prices above it - the site shows the offer beside the
 * price the business wrote, and the business honours it in the conversation.
 *
 * Only changed fields are sent. PATCH replaces `tiers`/`products`
 * wholesale, so the arrays are rebuilt from the originals with the edited
 * values merged in — dropping a field here would silently erase a tier's
 * features, its duration or its delivery time.
 */
import React, { useEffect, useRef, useState } from 'react';
import FaqEditor, { cleanFaqs } from '../marketplace/FaqEditor';
import axios from 'axios';
import { toast } from 'sonner';
import { X, Trash2, ImagePlus, Loader2 } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { uploadFilesFast, reportUploadFailure } from '../../utils/fastUpload';
import { productPhotos } from '../../utils/productPhotos';

const MAX_PHOTOS = 6;

export default function EditListingModal({ gig, API, token, onClose, onSaved }) {
  const { t } = useTranslation();
  const isStore = gig.gig_type === 'store';
  const originals = (isStore ? gig.products : gig.tiers) || [];

  const [title, setTitle] = useState(gig.title || '');
  const [description, setDescription] = useState(gig.description || '');
  // Options are edited as a shallow copy so Cancel really cancels.
  const [options, setOptions] = useState(() => originals.map((o) => ({
    ...o,
    photos: isStore ? productPhotos(o) : (Array.isArray(o.images) ? o.images : []),
  })));
  // The offer. `on` is kept separate from the numbers because switching it
  // off and saving is what REMOVES it - the API reads a null as "take it
  // down", so an offer that was on and is now off has to send something.
  const [offerOn, setOfferOn] = useState(Boolean(gig.discount));
  const [offerPercent, setOfferPercent] = useState(gig.discount?.percent ?? 10);
  const [offerLabel, setOfferLabel] = useState(gig.discount?.label || '');
  const [offerEnds, setOfferEnds] = useState(gig.discount?.ends_at || '');
  // The FAQs, edited as a copy so Cancel really cancels.
  const [faqs, setFaqs] = useState(() => (Array.isArray(gig.faqs) ? gig.faqs.map((f) => ({ q: f?.q || '', a: f?.a || '' })) : []));
  const [saving, setSaving] = useState(false);
  const [uploadingAt, setUploadingAt] = useState(null);
  const fileRefs = useRef({});

  // Escape closes, and the page behind must not scroll while this is open.
  useEffect(() => {
    const onKey = (e) => { if (e.key === 'Escape' && !saving) onClose(); };
    document.addEventListener('keydown', onKey);
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.removeEventListener('keydown', onKey);
      document.body.style.overflow = prev;
    };
  }, [onClose, saving]);

  const setOption = (i, patch) => setOptions((prev) =>
    prev.map((o, k) => (k === i ? { ...o, ...patch } : o)));

  const addPhotos = async (i, files) => {
    const chosen = Array.from(files || []).filter((f) => f.type.startsWith('image/'));
    if (!chosen.length) return;
    const current = options[i].photos || [];
    const room = MAX_PHOTOS - current.length;
    if (room <= 0) {
      toast.error(t('editListing.photoLimit', { defaultValue: 'Up to {{n}} photos', n: MAX_PHOTOS }));
      return;
    }
    setUploadingAt(i);
    try {
      const results = await uploadFilesFast(chosen.slice(0, room), API, token, () => {});
      const urls = results.map((r) => r?.url).filter(Boolean);
      const failed = results.filter((r) => !r?.url || r?.error);
      if (failed.length) {
        // The real reason, not "upload failed" — these go straight from
        // the browser to Cloudinary and never touch our server, so if we
        // do not show it nobody ever sees it.
        const why = failed.find((r) => r?.error)?.error;
        toast.error(why
          ? t('sweep.uploadFailedWhy', { defaultValue: 'Photo upload failed — {{reason}}', reason: why })
          : t('sweep.uploadFailed', 'Photo upload failed. Please try a different photo.'));
        reportUploadFailure({ where: 'edit-listing', count: failed.length, reason: why, API, token });
      }
      if (urls.length) setOption(i, { photos: [...current, ...urls] });
    } finally {
      setUploadingAt(null);
    }
  };

  const removePhoto = (i, url) => setOption(i, {
    photos: (options[i].photos || []).filter((u) => u !== url),
  });

  // Promote to first — the first photo is the one used as the cover
  // everywhere else, so "wrong photo showing" is usually an ordering
  // problem rather than a wrong upload.
  const makeCover = (i, url) => setOption(i, {
    photos: [url, ...(options[i].photos || []).filter((u) => u !== url)],
  });

  const save = async () => {
    if (!title.trim()) {
      toast.error(t('editListing.needTitle', 'Give the listing a title.'));
      return;
    }
    const bad = options.find((o) => !String(o.name || '').trim());
    if (bad) {
      toast.error(t('editListing.needName', 'Every option needs a name.'));
      return;
    }
    const noPhoto = options.find((o) => !(o.photos || []).length);
    if (noPhoto) {
      toast.error(t('editListing.needPhoto', {
        defaultValue: 'Add at least one photo to "{{name}}".',
        name: String(noPhoto.name || '').trim(),
      }));
      return;
    }

    if (offerOn) {
      const pct = parseInt(offerPercent, 10);
      if (!(pct >= 5 && pct <= 90)) {
        toast.error(t('editListing.offerRange', 'An offer has to be between 5% and 90%.'));
        return;
      }
      if (offerEnds && offerEnds < new Date().toISOString().slice(0, 10)) {
        toast.error(t('editListing.offerPast', 'That end date has already passed, so nobody would see the offer.'));
        return;
      }
    }

    setSaving(true);
    try {
      const payload = {};
      if (title.trim() !== (gig.title || '')) payload.title = title.trim();
      if (description !== (gig.description || '')) payload.description = description;

      // Rebuilt from the ORIGINAL objects so nothing this sheet does not
      // show — features, delivery_days, duration_minutes, in_stock — is
      // dropped when the array is replaced.
      const rebuilt = options.map((o, i) => {
        const base = { ...(originals[i] || {}) };
        base.name = String(o.name || '').trim();
        base.price = parseFloat(o.price);
        if (isStore) {
          base.images = o.photos || [];
          base.image = null;
        } else {
          base.images = o.photos || [];
        }
        delete base.photos;
        return base;
      });
      const changed = JSON.stringify(rebuilt) !== JSON.stringify(
        originals.map((o) => ({ ...o })),
      );
      if (changed) payload[isStore ? 'products' : 'tiers'] = rebuilt;

      const nextOffer = offerOn
        ? {
          percent: Math.max(5, Math.min(90, parseInt(offerPercent, 10) || 0)),
          label: offerLabel.trim().slice(0, 60),
          ends_at: offerEnds || null,
        }
        : null;
      const prevOffer = gig.discount
        ? {
          percent: gig.discount.percent,
          label: gig.discount.label || '',
          ends_at: gig.discount.ends_at || null,
        }
        : null;
      if (JSON.stringify(nextOffer) !== JSON.stringify(prevOffer)) payload.discount = nextOffer;

      const nextFaqs = cleanFaqs(faqs);
      if (JSON.stringify(nextFaqs) !== JSON.stringify(cleanFaqs(gig.faqs))) payload.faqs = nextFaqs;

      if (!Object.keys(payload).length) {
        toast.success(t('editListing.noChanges', 'Nothing to save.'));
        onClose();
        return;
      }
      await axios.patch(`${API}/marketplace/gigs/${gig.id}`, payload, {
        headers: { Authorization: `Bearer ${token}` },
      });
      toast.success(t('editListing.saved', 'Listing updated'));
      await onSaved?.();
      onClose();
    } catch (err) {
      toast.error(err.response?.data?.detail || t('editListing.failed', 'Could not save the changes'));
    } finally {
      setSaving(false);
    }
  };

  return (
    <div
      className="fixed inset-0 z-[80] flex items-end sm:items-center justify-center bg-black/40 p-0 sm:p-4"
      onClick={() => { if (!saving) onClose(); }}
      data-testid="edit-listing-overlay"
    >
      <div
        className="bg-white w-full sm:max-w-2xl sm:rounded-2xl rounded-t-2xl max-h-[92vh] flex flex-col"
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-modal="true"
        data-testid="edit-listing-modal"
      >
        <div className="flex items-center justify-between px-5 py-4 border-b" style={{ borderColor: 'var(--brand-border)' }}>
          <h3 className="text-lg font-bold" style={{ fontFamily: 'var(--font-head)', color: 'var(--ink)' }}>
            {t('editListing.title', 'Edit listing')}
          </h3>
          <button type="button" onClick={onClose} disabled={saving} className="p-2 text-gray-500 hover:text-gray-900" data-testid="edit-listing-close" aria-label={t('common.close', 'Close')}>
            <X size={18} />
          </button>
        </div>

        <div className="overflow-y-auto px-5 py-4 space-y-5">
          <div className="space-y-1.5">
            <label className="text-xs font-semibold text-gray-700" htmlFor="edit-listing-title">
              {t('editListing.listingTitle', 'Listing title')}
            </label>
            <input
              id="edit-listing-title"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              className="w-full px-3 py-2 rounded-lg border bg-white text-sm"
              style={{ borderColor: 'var(--brand-border)' }}
              data-testid="edit-listing-title"
            />
          </div>

          <div className="space-y-1.5">
            <label className="text-xs font-semibold text-gray-700" htmlFor="edit-listing-desc">
              {t('editListing.description', 'Description')}
            </label>
            <textarea
              id="edit-listing-desc"
              rows={3}
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              className="w-full px-3 py-2 rounded-lg border bg-white text-sm"
              style={{ borderColor: 'var(--brand-border)' }}
              data-testid="edit-listing-description"
            />
            <p className="text-[11px] text-gray-500">
              {t('editListing.translationNote', 'The Hebrew version is regenerated from this when you save.')}
            </p>
          </div>

          {/* Offer. Off unless one is running; switching it on reveals the
              three fields. The note under them is not decoration - a
              customer told the price has changed who is then charged the
              old one blames the site, so the sheet says plainly what the
              badge does and what it does not. */}
          <div
            className="rounded-xl border p-3 space-y-3"
            style={{ borderColor: 'var(--brand-border)' }}
            data-testid="edit-listing-offer"
          >
            <label className="flex items-center gap-2 cursor-pointer">
              <input
                type="checkbox"
                checked={offerOn}
                onChange={(e) => setOfferOn(e.target.checked)}
                className="w-4 h-4 accent-[var(--brand-primary)]"
                data-testid="edit-listing-offer-toggle"
              />
              <span className="text-xs font-semibold text-gray-700">
                {t('editListing.offerOn', 'Run an offer on this listing')}
              </span>
            </label>

            {offerOn && (
              <div className="space-y-3">
                <div className="flex flex-wrap gap-2 items-end">
                  <div className="space-y-1">
                    <label className="text-[11px] font-semibold text-gray-600" htmlFor="edit-listing-offer-percent">
                      {t('editListing.offerPercent', '% off')}
                    </label>
                    <input
                      id="edit-listing-offer-percent"
                      type="number"
                      min="5"
                      max="90"
                      value={offerPercent}
                      onChange={(e) => setOfferPercent(e.target.value)}
                      className="w-24 px-3 py-2 rounded-lg border bg-white text-sm"
                      style={{ borderColor: 'var(--brand-border)' }}
                      data-testid="edit-listing-offer-percent"
                    />
                  </div>
                  <div className="space-y-1 flex-1 min-w-[10rem]">
                    <label className="text-[11px] font-semibold text-gray-600" htmlFor="edit-listing-offer-label">
                      {t('editListing.offerLabel', 'What it is for (optional)')}
                    </label>
                    <input
                      id="edit-listing-offer-label"
                      value={offerLabel}
                      maxLength={60}
                      onChange={(e) => setOfferLabel(e.target.value)}
                      placeholder={t('editListing.offerLabelHint', 'e.g. New customers')}
                      className="w-full px-3 py-2 rounded-lg border bg-white text-sm"
                      style={{ borderColor: 'var(--brand-border)' }}
                      data-testid="edit-listing-offer-label"
                    />
                  </div>
                  <div className="space-y-1">
                    <label className="text-[11px] font-semibold text-gray-600" htmlFor="edit-listing-offer-ends">
                      {t('editListing.offerEnds', 'Runs until (optional)')}
                    </label>
                    <input
                      id="edit-listing-offer-ends"
                      type="date"
                      value={offerEnds}
                      onChange={(e) => setOfferEnds(e.target.value)}
                      className="px-3 py-2 rounded-lg border bg-white text-sm"
                      style={{ borderColor: 'var(--brand-border)' }}
                      data-testid="edit-listing-offer-ends"
                    />
                  </div>
                </div>
                <p className="text-[11px] text-gray-500" data-testid="edit-listing-offer-note">
                  {t(
                    'editListing.offerNote',
                    'Your prices stay exactly as you wrote them. Customers see the offer on your listing and on the home page, and you apply it when you agree the job.',
                  )}
                </p>
              </div>
            )}
          </div>

          <div className="rounded-xl border p-3" style={{ borderColor: 'var(--brand-border)' }} data-testid="edit-listing-faqs">
            <FaqEditor faqs={faqs} onChange={setFaqs} testidPrefix="edit-listing-faq" />
          </div>

          <div className="space-y-3">
            <p className="text-xs font-semibold text-gray-700">
              {isStore
                ? t('editListing.products', 'Products')
                : t('editListing.options', 'Services and prices')}
            </p>

            {options.map((o, i) => (
              <div key={i} className="rounded-xl border p-3 space-y-3" style={{ borderColor: 'var(--brand-border)' }} data-testid={`edit-listing-option-${i}`}>
                <div className="flex flex-wrap gap-2">
                  <input
                    value={o.name || ''}
                    onChange={(e) => setOption(i, { name: e.target.value })}
                    className="flex-1 min-w-[8rem] px-3 py-2 rounded-lg border bg-white text-sm font-semibold"
                    style={{ borderColor: 'var(--brand-border)' }}
                    aria-label={t('editListing.optionName', 'Option name')}
                    data-testid={`edit-listing-name-${i}`}
                  />
                  <input
                    type="number"
                    min="0"
                    value={o.price ?? ''}
                    onChange={(e) => setOption(i, { price: e.target.value })}
                    className="w-28 px-3 py-2 rounded-lg border bg-white text-sm"
                    style={{ borderColor: 'var(--brand-border)' }}
                    aria-label={t('editListing.optionPrice', 'Price')}
                    data-testid={`edit-listing-price-${i}`}
                  />
                </div>

                <div className="flex flex-wrap gap-2">
                  {(o.photos || []).map((url, k) => (
                    <div key={url} className="relative w-20 h-20 rounded-lg overflow-hidden group" data-testid={`edit-listing-photo-${i}-${k}`}>
                      <div className="absolute inset-0 bg-gray-100 bg-cover bg-center" style={{ backgroundImage: `url(${url})` }} />
                      {k === 0 && (
                        <span
                          className="absolute bottom-0 inset-x-0 text-[9px] font-bold text-center py-0.5 text-white"
                          style={{ backgroundColor: 'rgb(var(--brand-primary-rgb) / 0.85)' }}
                        >
                          {t('editListing.cover', 'COVER')}
                        </span>
                      )}
                      {k !== 0 && (
                        <button
                          type="button"
                          onClick={() => makeCover(i, url)}
                          className="absolute bottom-0 inset-x-0 text-[9px] font-semibold text-center py-0.5 bg-black/60 text-white opacity-0 group-hover:opacity-100 focus:opacity-100 transition-opacity"
                          data-testid={`edit-listing-make-cover-${i}-${k}`}
                        >
                          {t('editListing.makeCover', 'Make cover')}
                        </button>
                      )}
                      <button
                        type="button"
                        onClick={() => removePhoto(i, url)}
                        className="absolute top-0.5 end-0.5 w-5 h-5 rounded-full bg-black/60 text-white flex items-center justify-center"
                        aria-label={t('editListing.removePhoto', 'Remove photo')}
                        data-testid={`edit-listing-remove-photo-${i}-${k}`}
                      >
                        <Trash2 size={10} />
                      </button>
                    </div>
                  ))}

                  {(o.photos || []).length < MAX_PHOTOS && (
                    <>
                      <input
                        ref={(el) => { fileRefs.current[i] = el; }}
                        type="file"
                        accept="image/*"
                        multiple
                        className="hidden"
                        onChange={(e) => { addPhotos(i, e.target.files); e.target.value = ''; }}
                        data-testid={`edit-listing-file-${i}`}
                      />
                      <button
                        type="button"
                        onClick={() => fileRefs.current[i]?.click()}
                        disabled={uploadingAt === i}
                        className={`w-20 h-20 rounded-lg border-2 border-dashed flex items-center justify-center transition-colors ${
                          (o.photos || []).length === 0
                            ? 'border-red-300 bg-red-50/40'
                            : 'border-gray-300 hover:border-[var(--brand-primary)]'
                        }`}
                        data-testid={`edit-listing-add-photo-${i}`}
                        aria-label={t('editListing.addPhoto', 'Add a photo')}
                      >
                        {uploadingAt === i
                          ? <Loader2 size={18} className="animate-spin text-gray-400" />
                          : <ImagePlus size={18} className={(o.photos || []).length === 0 ? 'text-red-500' : 'text-gray-400'} />}
                      </button>
                    </>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>

        <div className="flex items-center justify-end gap-2 px-5 py-4 border-t" style={{ borderColor: 'var(--brand-border)' }}>
          <button
            type="button"
            onClick={onClose}
            disabled={saving}
            className="px-4 py-2.5 rounded-lg text-sm font-semibold text-gray-700 border"
            style={{ borderColor: 'var(--brand-border)' }}
            data-testid="edit-listing-cancel"
          >
            {t('common.cancel', 'Cancel')}
          </button>
          <button
            type="button"
            onClick={save}
            disabled={saving}
            className="px-5 py-2.5 rounded-lg text-sm font-semibold text-white inline-flex items-center gap-2 disabled:opacity-60"
            style={{ backgroundColor: 'var(--brand-primary)' }}
            data-testid="edit-listing-save"
          >
            {saving && <Loader2 size={14} className="animate-spin" />}
            {t('editListing.save', 'Save changes')}
          </button>
        </div>
      </div>
    </div>
  );
}
