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
 * Availability, contact, category, service area and the Hebrew text are
 * here too (Tzvi, 13 Oct 2026). This header used to say they were left out
 * on purpose, as things that change what the listing IS. In practice that
 * meant a business whose hours or WhatsApp number changed had to delete the
 * listing and rebuild it, so they are editable now, from the same controls
 * the wizard uses (AvailabilityStep, CategoryPicker) and checked by the
 * server with the same rules as creation (_validate_contact_fields). The
 * LISTING TYPE (store / deliverable / appointment) is still not editable:
 * it decides which other fields exist at all.
 *
 * The SUBCATEGORY narrows the category the listing has. It is also the only
 * way an already-published listing can ever get one - the field is a live
 * filter on the board and nothing in the app could set it (dead-ends audit
 * 2026-09-08, #5). Changing the category clears it, as in the wizard.
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
import { HighlightChip } from '../marketplace/Highlights';
import axios from 'axios';
import { toast } from 'sonner';
import { X, Trash2, ImagePlus, Loader2, Wand2, Plus } from 'lucide-react';
import PhotoMatch from './PhotoMatch';
import ProductSuppliers from './ProductSuppliers';
import WholesaleOffers from './WholesaleOffers';
import { useTranslation } from 'react-i18next';
import { uploadFilesFast, reportUploadFailure } from '../../utils/fastUpload';
import { productPhotos } from '../../utils/productPhotos';
import SizeFields, { withSize } from '../marketplace/SizeFields';
import ProductExtras, { cleanExtras } from './ProductExtras';
import TeamAndRebook, { cleanTeam } from './TeamAndRebook';
import SessionsEditor, { cleanSessions } from './SessionsEditor';
import { SUBCATEGORIES, subcategoryLabel } from '../../lib/categories';
import AvailabilityStep, { DAYS } from '../marketplace/AvailabilityStep';
import CategoryPicker from '../marketplace/CategoryPicker';
import PhoneInput from '../common/PhoneInput';
import { normalizeWhatsAppNumber, hasValidWhatsApp } from '../../utils/whatsappLink';

const MAX_PHOTOS = 6;

export default function EditListingModal({ gig, API, token, onClose, onSaved }) {
  const { t } = useTranslation();
  const isStore = gig.gig_type === 'store';
  const originals = (isStore ? gig.products : gig.tiers) || [];

  const [title, setTitle] = useState(gig.title || '');
  const [description, setDescription] = useState(gig.description || '');
  // Only the four merged categories have sub-buckets; for the rest this
  // is undefined and the whole block never renders.
  const [category, setCategory] = useState(gig.category || '');
  const subOptions = SUBCATEGORIES[category];
  const [subcategory, setSubcategory] = useState(gig.subcategory || '');
  const [categories, setCategories] = useState([]);
  const [locations, setLocations] = useState([]);
  const [catOpen, setCatOpen] = useState(false);
  const [area, setArea] = useState(gig.area || '');
  const [titleHe, setTitleHe] = useState(gig.title_he || '');
  const [descHe, setDescHe] = useState(gig.description_he || '');
  const [bookingMode, setBookingMode] = useState(gig.booking_mode || 'whatsapp');
  const [whatsapp, setWhatsapp] = useState(gig.whatsapp || '');
  const [contactEmail, setContactEmail] = useState(gig.contact_email || '');
  const isAppointment = gig.gig_type === 'appointment';
  const isDeliverable = gig.gig_type === 'deliverable';
  const [weekly, setWeekly] = useState(() => DAYS.reduce((acc, d) => ({
    ...acc,
    [d.k]: ((gig.weekly_availability || {})[d.k] || []).map((w) => ({ start: w.start, end: w.end })),
  }), {}));
  const [slotMinutes, setSlotMinutes] = useState(gig.slot_duration_minutes || 30);
  const [team, setTeam] = useState(gig.team || []);
  const [rebook, setRebook] = useState(gig.rebook_after_weeks || null);
  // Tours and workshops (sessions.py), and quote requests (quotes.py; on by
  // default for a service listing).
  const [sessions, setSessions] = useState(gig.sessions || []);
  const quotesDefault = gig.quotes_on === true || gig.quotes_on === false ? gig.quotes_on : (gig.gig_type || 'deliverable') === 'deliverable';
  const [quotesOn, setQuotesOn] = useState(quotesDefault);
  const [dateBooking, setDateBooking] = useState(Boolean(gig.enable_date_booking));
  useEffect(() => {
    let live = true;
    axios.get(`${API}/marketplace/categories`).then((r) => { if (live) setCategories(r.data || []); }).catch(() => {});
    axios.get(`${API}/marketplace/locations`).then((r) => { if (live) setLocations(r.data || []); }).catch(() => {});
    return () => { live = false; };
  }, [API]);
  const toggleDay = (d) => setWeekly((w) => ({ ...w, [d]: w[d].length ? [] : [{ start: '09:00', end: '17:00' }] }));
  const updateWindow = (d, patch) => setWeekly((w) => ({
    ...w,
    [d]: w[d].length ? [{ ...w[d][0], ...patch }] : [{ start: '09:00', end: '17:00', ...patch }],
  }));
  // Options are edited as a shallow copy so Cancel really cancels.
  const [options, setOptions] = useState(() => originals.map((o) => ({
    ...o,
    photos: isStore ? productPhotos(o) : (Array.isArray(o.images) ? o.images : []),
  })));
  // The offer. `on` is kept separate from the numbers because switching it
  // off and saving is what REMOVES it - the API reads a null as "take it
  // down", so an offer that was on and is now off has to send something.
  /* What you get: up to four from the fixed list for this item (the
     server decides which; food-only ones appear for food businesses). */
  const [hl, setHl] = useState({ options: [], max: 4, selected: [] });
  const [hlPicked, setHlPicked] = useState(null);
  useEffect(() => {
    let live = true;
    axios.get(`${API}/marketplace/gigs/${gig.id}/highlight-options`, { headers: { Authorization: `Bearer ${token}` } })
      .then(({ data }) => { if (live) { setHl(data); setHlPicked(data.selected || []); } })
      .catch(() => {});
    return () => { live = false; };
  }, [API, gig.id, token]);
  /* Make my photos match: hidden unless the server has it switched on. */
  const [pmState, setPmState] = useState({ enabled: false });
  const [pmAt, setPmAt] = useState(null); // { i, url }
  useEffect(() => {
    let live = true;
    axios.get(`${API}/marketplace/gigs/${gig.id}/photo-match`, { headers: { Authorization: `Bearer ${token}` } })
      .then(({ data }) => { if (live) setPmState(data); })
      .catch(() => {});
    return () => { live = false; };
  }, [API, gig.id, token]);
  const toggleHl = (id) => setHlPicked((cur) => (cur.includes(id) ? cur.filter((x) => x !== id) : cur.length >= hl.max ? cur : [...cur, id]));
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
    const onKey = (e) => {
      if (e.key !== 'Escape' || saving) return;
      if (pmAt) setPmAt(null); else onClose();
    };
    document.addEventListener('keydown', onKey);
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.removeEventListener('keydown', onKey);
      document.body.style.overflow = prev;
    };
  }, [onClose, saving, pmAt]);

  const setOption = (i, patch) => setOptions((prev) =>
    prev.map((o, k) => (k === i ? { ...o, ...patch } : o)));
  // A store adds and removes its own products here, and marks them in or
  // out of stock; a designed page with a catalogue follows (mir-catalog.js).
  const addProduct = () => setOptions((prev) => [...prev, {
    name: '', price: '', currency: prev[0]?.currency || 'ILS', in_stock: true,
    group: prev[prev.length - 1]?.group || '', photos: [],
  }]);
  const removeProduct = (i) => setOptions((prev) => prev.filter((_, k) => k !== i));

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
          ? t('sweep.uploadFailedWhy', { defaultValue: 'Photo upload failed - {{reason}}', reason: why })
          : t('sweep.uploadFailed', 'Photo upload failed. Please try a different photo.'));
        reportUploadFailure({ where: 'edit-listing', count: failed.length, reason: why, API, token });
      }
      if (urls.length) setOption(i, { photos: [...current, ...urls] });
    } finally {
      setUploadingAt(null);
    }
  };

  const swapPhoto = (i, from, to) => setOption(i, {
    photos: (options[i].photos || []).map((u) => (u === from ? to : u)),
  });

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
    if (!category) {
      toast.error(t('wizard.reasonCategory', 'Pick a category above.'));
      return;
    }
    if (!area.trim()) {
      toast.error(t('wizard.reasonArea', 'Pick a service area (city).'));
      return;
    }
    if (bookingMode === 'whatsapp' && !hasValidWhatsApp(whatsapp)) {
      toast.error(t('services.whatsappInvalid', 'Enter a valid WhatsApp number - e.g. 050-123-4567 or +972 50 123 4567.'));
      return;
    }
    if (isAppointment && !DAYS.some((d) => (weekly[d.k] || []).length > 0)) {
      toast.error(t('editListing.needHours', 'Open at least one day, or customers cannot book a time.'));
      return;
    }
    if (isStore && !options.length) {
      toast.error(t('editListing.needProduct', 'A shop needs at least one product.'));
      return;
    }
    const bad = options.find((o) => !String(o.name || '').trim());
    if (bad) {
      toast.error(t('editListing.needName', 'Every option needs a name.'));
      return;
    }
    const noPrice = options.find((o) => !(parseFloat(o.price) >= 0));
    if (noPrice) {
      toast.error(t('editListing.needPrice', {
        defaultValue: 'Add a price to "{{name}}".',
        name: String(noPrice.name || '').trim(),
      }));
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
      // null, not '', to clear it: the API reads a falsy value as "no tag"
      // and stores None, which is what the board's filter tests against.
      const categoryChanged = category !== (gig.category || '');
      if (categoryChanged) payload.category = category;
      // A new category invalidates the old sub-bucket, so it is always sent
      // then (cleared unless a valid one for the new category was picked).
      const subValid = (SUBCATEGORIES[category] || []).some((x) => x.slug === subcategory) ? subcategory : '';
      if (categoryChanged ? Boolean(gig.subcategory) || Boolean(subValid) : (subOptions && subValid !== (gig.subcategory || ''))) {
        payload.subcategory = subValid || null;
      }
      if (area.trim() !== (gig.area || '')) payload.area = area.trim();
      if (titleHe.trim() !== (gig.title_he || '')) payload.title_he = titleHe.trim();
      if (descHe.trim() !== (gig.description_he || '')) payload.description_he = descHe.trim();
      if (bookingMode !== (gig.booking_mode || 'whatsapp')) payload.booking_mode = bookingMode;
      if (whatsapp.trim() !== (gig.whatsapp || '')) {
        payload.whatsapp = whatsapp.trim();
        payload.whatsapp_confirmed = hasValidWhatsApp(whatsapp);
      }
      if (contactEmail.trim() !== (gig.contact_email || '')) payload.contact_email = contactEmail.trim();
      if (isAppointment) {
        const before = DAYS.reduce((acc, d) => ({
          ...acc,
          [d.k]: ((gig.weekly_availability || {})[d.k] || []).map((w) => ({ start: w.start, end: w.end })),
        }), {});
        if (JSON.stringify(weekly) !== JSON.stringify(before)) payload.weekly_availability = weekly;
        if (slotMinutes !== (gig.slot_duration_minutes || 30)) payload.slot_duration_minutes = slotMinutes;
        if (JSON.stringify(cleanTeam(team)) !== JSON.stringify(cleanTeam(gig.team || []))) payload.team = cleanTeam(team);
        if ((rebook || null) !== (gig.rebook_after_weeks || null)) payload.rebook_after_weeks = rebook || null;
      }
      if (isDeliverable && dateBooking !== Boolean(gig.enable_date_booking)) payload.enable_date_booking = dateBooking;
      if (!isStore) {
        if (JSON.stringify(cleanSessions(sessions)) !== JSON.stringify(cleanSessions(gig.sessions || []))) payload.sessions = cleanSessions(sessions);
        if (quotesOn !== quotesDefault) payload.quotes_on = quotesOn;
      }

      // Rebuilt from the ORIGINAL objects so nothing this sheet does not
      // show — features, delivery_days, duration_minutes, in_stock — is
      // dropped when the array is replaced.
      // Each option is a copy of its original (see `options`), so this keeps
      // them even when products were added or removed above it.
      const rebuilt = options.map((o) => {
        let base = { ...o };
        base.name = String(o.name || '').trim();
        base.price = parseFloat(o.price);
        if (isStore) {
          base.images = o.photos || [];
          base.image = null;
          base = withSize(base, o);
          base.in_stock = o.in_stock !== false;
          // Only what the product uses, so an untouched product still
          // compares equal to its original and is not re-sent.
          Object.entries(cleanExtras(o)).forEach(([k, v]) => {
            if ((v === null || (Array.isArray(v) && !v.length)) && !(k in o)) delete base[k];
            else base[k] = v;
          });
          if (base.stock === 0) base.in_stock = false;
          const group = String(o.group || '').trim();
          base.group = group || null;
          const to = parseFloat(o.price_to);
          base.price_to = Number.isFinite(to) && to > base.price ? to : null;
        } else {
          base.images = o.photos || [];
        }
        delete base.photos;
        return base;
      });
      const changed = rebuilt.length !== originals.length || JSON.stringify(rebuilt) !== JSON.stringify(
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

      if (hlPicked && JSON.stringify(hlPicked) !== JSON.stringify(hl.selected || [])) payload.highlights = hlPicked;

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

          {subOptions && (
            <div className="space-y-1.5">
              <p className="text-xs font-semibold text-gray-700">
                {t('services.specificType', 'Specific type')}
              </p>
              <p className="text-[11px] text-gray-500">
                {t('services.specificTypeProviderHint', 'Optional - customers filter by this, so it helps the right ones find you.')}
              </p>
              <div className="flex flex-wrap gap-2 pt-1" data-testid="edit-listing-subcategory-row">
                {subOptions.map((sub) => (
                  <button
                    key={sub.slug}
                    type="button"
                    onClick={() => setSubcategory(subcategory === sub.slug ? '' : sub.slug)}
                    className={`px-3 py-1.5 rounded-full text-xs font-semibold border transition-colors ${
                      subcategory === sub.slug
                        ? 'bg-[var(--brand-primary)] text-white border-[var(--brand-primary)]'
                        : 'bg-white text-gray-700 hover:border-[var(--brand-primary)]'
                    }`}
                    style={subcategory === sub.slug ? undefined : { borderColor: 'var(--brand-border)' }}
                    aria-pressed={subcategory === sub.slug}
                    data-testid={`edit-listing-sub-${sub.slug}`}
                  >
                    {subcategoryLabel(sub, t)}
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Offer. Off unless one is running; switching it on reveals the
              three fields. The note under them is not decoration - a
              customer told the price has changed who is then charged the
              old one blames the site, so the sheet says plainly what the
              badge does and what it does not. */}
          {hl.options.length > 0 && hlPicked && (
            <div className="rounded-xl border p-3 space-y-2" style={{ borderColor: 'var(--brand-border)' }} data-testid="edit-listing-highlights">
              <p className="text-sm font-semibold" style={{ color: 'var(--ink)' }}>{t('highlights.editTitle', 'What you get')}</p>
              <p className="text-xs" style={{ color: 'var(--brand-muted)' }}>
                {t('highlights.editHelp', { defaultValue: 'Pick up to {{max}}. They show as small badges on this item.', max: hl.max })}
              </p>
              <div className="flex flex-wrap gap-2">
                {hl.options.map((o) => (
                  <HighlightChip key={o.id} id={o.id} icon={o.icon} t={t} selected={hlPicked.includes(o.id)}
                    onClick={() => toggleHl(o.id)} testid={`edit-listing-highlight-${o.id}`} />
                ))}
              </div>
              {hlPicked.length >= hl.max && (
                <p className="text-xs" style={{ color: 'var(--brand-muted)' }}>{t('highlights.editFull', 'That is the most. Untick one to choose another.')}</p>
              )}
            </div>
          )}

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

          {/* Where and what. Same category grid and the same city list as
              the wizard; the server re-checks both. */}
          <div className="rounded-xl border p-3 space-y-3" style={{ borderColor: 'var(--brand-border)' }} data-testid="edit-listing-where">
            <p className="text-xs font-semibold text-gray-700">{t('editListing.whereAndWhat', 'Where and what')}</p>
            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-gray-700" htmlFor="edit-listing-area">
                {t('wizard.area', 'Service area')}
              </label>
              <input
                id="edit-listing-area"
                value={area}
                onChange={(e) => setArea(e.target.value)}
                list="edit-listing-city-suggestions"
                placeholder={t('wizard.areaPh', 'Tel Aviv, Jerusalem, Haifa…')}
                className="w-full px-3 py-2 min-h-[44px] rounded-lg border bg-white text-sm"
                style={{ borderColor: 'var(--brand-border)' }}
                data-testid="edit-listing-area"
              />
              <datalist id="edit-listing-city-suggestions">
                {locations.map((l) => (<option key={l.slug} value={l.label} />))}
              </datalist>
            </div>
            <div className="space-y-1.5">
              <p className="text-xs font-semibold text-gray-700">{t('wizard.category', 'Category')}</p>
              {!catOpen && (
                <button
                  type="button"
                  onClick={() => setCatOpen(true)}
                  className="px-3 min-h-[44px] rounded-lg border bg-white text-sm font-semibold text-start"
                  style={{ borderColor: 'var(--brand-border)' }}
                  data-testid="edit-listing-category-change"
                >
                  {(categories.find((c) => c.slug === category)?.label) || category || t('editListing.chooseCategory', 'Choose a category')}
                  {' '}<span className="text-xs font-normal" style={{ color: 'var(--brand-muted)' }}>{t('editListing.change', 'Change')}</span>
                </button>
              )}
              {catOpen && (
                <CategoryPicker
                  categories={categories}
                  value={category}
                  onChange={(slug) => { setCategory(slug); setSubcategory(''); setCatOpen(false); }}
                  testidPrefix="edit-listing-cat"
                  variant="primary"
                />
              )}
            </div>
          </div>

          {/* Availability. Weekly hours only mean something for an
              appointment listing, date booking only for a deliverable one,
              so each shows for its own type, as in the wizard. */}
          <div className="rounded-xl border p-3 space-y-3" style={{ borderColor: 'var(--brand-border)' }} data-testid="edit-listing-availability">
            <p className="text-xs font-semibold text-gray-700">{t('editListing.availability', 'Availability')}</p>
            {isAppointment && (
              <AvailabilityStep
                weekly={weekly}
                slotDuration={slotMinutes}
                onToggleDay={toggleDay}
                onUpdateWindow={updateWindow}
                onSlotDurationChange={setSlotMinutes}
                showIntro={false}
                testid="edit-listing-hours"
              />
            )}
            {isAppointment && <TeamAndRebook team={team} onTeam={setTeam} rebook={rebook} onRebook={setRebook} />}
            {!isStore && <SessionsEditor sessions={sessions} onSessions={setSessions} quotesOn={quotesOn} onQuotesOn={setQuotesOn} showQuotes />}
            {isDeliverable && (
              <label className="flex items-start gap-2 min-h-[44px] cursor-pointer text-sm">
                <input
                  type="checkbox"
                  className="mt-1"
                  checked={dateBooking}
                  onChange={() => setDateBooking((v) => !v)}
                  data-testid="edit-listing-date-booking"
                />
                <span>
                  <span className="block font-semibold text-gray-900">{t('editListing.dateBooking', 'Let customers pick a date')}</span>
                  <span className="block text-[11px] text-gray-500">{t('editListing.dateBookingHint', 'Customers choose the day they want the job done when they book.')}</span>
                </span>
              </label>
            )}
            <div className="space-y-1.5">
              <p className="text-xs font-semibold text-gray-700">
                {isStore ? t('wizard.reachStore', 'How should buyers reach you?') : t('wizard.reachService', 'How should clients book?')}
              </p>
              <div className="flex gap-2">
                {[
                  { v: 'whatsapp', label: isStore ? t('wizard.modeWaStore', 'Message on WhatsApp') : t('wizard.modeWa', 'Book on WhatsApp') },
                  { v: 'in_platform', label: isStore ? t('wizard.modeSiteStore', 'Message on MyIsraelRental') : t('wizard.modeSite', 'Book on MyIsraelRental') },
                ].map((o) => (
                  <button
                    key={o.v}
                    type="button"
                    onClick={() => setBookingMode(o.v)}
                    aria-pressed={bookingMode === o.v}
                    className={`flex-1 px-3 min-h-[44px] rounded-lg text-sm font-semibold border text-start ${
                      bookingMode === o.v ? 'bg-[var(--brand-primary)] text-white border-[var(--brand-primary)]' : 'bg-white text-gray-700 border-gray-200 hover:border-[var(--brand-primary)]'
                    }`}
                    data-testid={`edit-listing-booking-${o.v}`}
                  >
                    {o.label}
                  </button>
                ))}
              </div>
            </div>
          </div>

          {/* Contact. The account email is never shown; the address here is
              one the business chooses to publish. */}
          <div className="rounded-xl border p-3 space-y-3" style={{ borderColor: 'var(--brand-border)' }} data-testid="edit-listing-contact">
            <p className="text-xs font-semibold text-gray-700">{t('editListing.contact', 'Contact')}</p>
            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-gray-700">
                {t('services.whatsappNumberLabel', 'WhatsApp number')}
              </label>
              <PhoneInput
                value={whatsapp}
                onChange={setWhatsapp}
                error={whatsapp.trim() && !hasValidWhatsApp(whatsapp)
                  ? t('services.whatsappInvalid', 'Enter a valid WhatsApp number.')
                  : ''}
                hint={hasValidWhatsApp(whatsapp)
                  ? t('services.whatsappResolved', {
                    defaultValue: 'Customers will message you at +{{number}}',
                    number: normalizeWhatsAppNumber(whatsapp),
                  })
                  : ''}
                testid="edit-listing-whatsapp"
              />
            </div>
            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-gray-700" htmlFor="edit-listing-email">
                {t('services.contactEmailLabel', 'Contact email (optional)')}
              </label>
              <input
                id="edit-listing-email"
                type="email"
                value={contactEmail}
                onChange={(e) => setContactEmail(e.target.value)}
                placeholder={t('services.contactEmailPh', 'you@example.com')}
                className="w-full px-3 py-2 min-h-[44px] rounded-lg border bg-white text-sm"
                style={{ borderColor: 'var(--brand-border)' }}
                data-testid="edit-listing-email"
              />
              <p className="text-[11px] text-gray-500">
                {t('services.contactEmailHint', 'Shown on your listing so customers can email you. Your account email is never shown.')}
              </p>
            </div>
          </div>

          {/* Hebrew. Blank is fine: the site translates it for you. */}
          <div className="rounded-xl border p-3 space-y-3" style={{ borderColor: 'var(--brand-border)' }} data-testid="edit-listing-hebrew">
            <p className="text-xs font-semibold text-gray-700">{t('editListing.hebrew', 'Hebrew')}</p>
            <p className="text-[11px] text-gray-500">
              {t('editListing.hebrewHint', 'Write the Hebrew yourself, or leave it empty and we translate it for you.')}
            </p>
            <input
              dir="rtl"
              value={titleHe}
              onChange={(e) => setTitleHe(e.target.value)}
              aria-label={t('editListing.titleHe', 'Title in Hebrew')}
              placeholder={t('editListing.titleHe', 'Title in Hebrew')}
              className="w-full px-3 py-2 min-h-[44px] rounded-lg border bg-white text-sm"
              style={{ borderColor: 'var(--brand-border)' }}
              data-testid="edit-listing-title-he"
            />
            <textarea
              dir="rtl"
              rows={3}
              value={descHe}
              onChange={(e) => setDescHe(e.target.value)}
              aria-label={t('editListing.descriptionHe', 'Description in Hebrew')}
              placeholder={t('editListing.descriptionHe', 'Description in Hebrew')}
              className="w-full px-3 py-2 rounded-lg border bg-white text-sm"
              style={{ borderColor: 'var(--brand-border)' }}
              data-testid="edit-listing-description-he"
            />
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
                      {pmState.enabled && (
                        <button
                          type="button"
                          onClick={() => setPmAt({ i, url })}
                          className="absolute top-0.5 start-0.5 w-5 h-5 rounded-full bg-black/60 text-white flex items-center justify-center"
                          aria-label={t('photoMatch.open', 'Plain background')}
                          title={t('photoMatch.open', 'Plain background')}
                          data-testid={`edit-listing-photo-match-${i}-${k}`}
                        >
                          <Wand2 size={10} />
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
                {isStore && (
                  <SizeFields option={o} onChange={(patch) => setOption(i, patch)} testid={`edit-listing-size-${i}`} />
                )}
                {isStore && <ProductExtras option={o} i={i} onChange={(patch) => setOption(i, patch)} />}
                {isStore && (
                  <div className="flex flex-wrap items-center gap-2">
                    <label className="inline-flex items-center gap-2 min-h-[44px] pe-2 text-sm font-semibold text-gray-700 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={o.in_stock !== false}
                        onChange={(e) => setOption(i, { in_stock: e.target.checked })}
                        className="w-4 h-4"
                        data-testid={`edit-listing-in-stock-${i}`}
                      />
                      {t('editListing.inStock', 'In stock')}
                    </label>
                    <input
                      value={o.group || ''}
                      onChange={(e) => setOption(i, { group: e.target.value })}
                      placeholder={t('editListing.section', 'Section, e.g. For the table')}
                      maxLength={60}
                      className="flex-1 min-w-[10rem] px-3 py-2 rounded-lg border bg-white text-sm"
                      style={{ borderColor: 'var(--brand-border)' }}
                      aria-label={t('editListing.sectionLabel', 'Section on your page')}
                      data-testid={`edit-listing-group-${i}`}
                    />
                    <input
                      type="number"
                      min="0"
                      value={o.price_to ?? ''}
                      onChange={(e) => setOption(i, { price_to: e.target.value })}
                      placeholder={t('editListing.priceTo', 'Up to (optional)')}
                      className="w-36 px-3 py-2 rounded-lg border bg-white text-sm"
                      style={{ borderColor: 'var(--brand-border)' }}
                      aria-label={t('editListing.priceToLabel', 'Highest price, for a price range')}
                      data-testid={`edit-listing-price-to-${i}`}
                    />
                    <button
                      type="button"
                      onClick={() => removeProduct(i)}
                      className="inline-flex items-center gap-1 px-3 min-h-[44px] rounded-lg text-xs font-semibold text-red-700 hover:bg-red-50"
                      data-testid={`edit-listing-remove-product-${i}`}
                    >
                      <Trash2 size={12} /> {t('editListing.removeProduct', 'Remove')}
                    </button>
                  </div>
                )}
              </div>
            ))}
            {isStore && (
              <button
                type="button"
                onClick={addProduct}
                className="inline-flex items-center gap-1.5 px-4 min-h-[44px] rounded-lg border text-sm font-semibold text-gray-800 hover:border-[var(--brand-primary)]"
                style={{ borderColor: 'var(--brand-border)' }}
                data-testid="edit-listing-add-product"
              >
                <Plus size={14} /> {t('editListing.addProduct', 'Add a product')}
              </button>
            )}
          </div>

          {isStore && <ProductSuppliers gig={gig} API={API} token={token} />}
          {isStore && <WholesaleOffers gig={gig} API={API} token={token} />}
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
      {pmAt && (
        <PhotoMatch
          API={API}
          token={token}
          gigId={gig.id}
          url={pmAt.url}
          state={pmState}
          onDone={(r) => setPmState((st) => ({
            ...st,
            color: r.color,
            left_today: Math.max(0, (st.left_today ?? 1) - 1),
            originals: { ...(st.originals || {}), [r.url]: r.original },
          }))}
          onUse={(to) => {
            swapPhoto(pmAt.i, pmAt.url, to);
            setPmAt(null);
            toast.success(t('photoMatch.saveToKeep', 'Photo changed. Press Save changes to keep it.'));
          }}
          onClose={() => setPmAt(null)}
        />
      )}
    </div>
  );
}
