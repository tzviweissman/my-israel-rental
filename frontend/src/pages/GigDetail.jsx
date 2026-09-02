/**
 * GigDetail — Fiverr-style service detail page.
 *
 * Left column: gallery + description + FAQs + provider mini-profile.
 * Right column (desktop) / sticky bottom (mobile): pricing tier picker
 * with either a "Book on WhatsApp" deep-link OR an in-platform booking
 * modal — driven by `gig.booking_mode`.
 */
import React, { useContext, useEffect, useMemo, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import DateField from '../components/common/DateField';
import FitImage from '../components/common/FitImage';
import axios from 'axios';
import { toast } from 'sonner';
import { MessageCircle, Send, Loader2, ArrowLeft, Award, Zap, Calendar, Clock, Camera, ChevronLeft, ChevronRight, X } from 'lucide-react';
// The shared calendar handles its own language, direction and
// screen-reader labels — see components/ui/calendar.jsx.
import { visitorHeaders } from '../utils/visitorId';
import { Calendar as CalendarUI } from '../components/ui/calendar';
import { API, AuthContext } from '../App';
import PageMeta from '../components/PageMeta';
import { needsDirectoryDisclaimer } from '../lib/categories';
import StarRating from '../components/marketplace/StarRating';
import { localizedTitle, localizedDescription } from '../utils/gigLocale';
import { buildWhatsAppLinkWithMessage, hasValidWhatsApp } from '../utils/whatsappLink';
import { isAvailableNow, getGigCover } from '../utils/gigAvailability';
import { productPhotos, productCover } from '../utils/productPhotos';
import { useReturnDestination, saveReturnPath } from '../hooks/useBackNavigation';
import Breadcrumb from '../components/common/Breadcrumb';
import ContactChannels from '../components/marketplace/ContactChannels';
import { prettyArea } from '../utils/areaNames';

const GIG_RETURN_PREFIXES = ['/services'];

// Resolve which number a gig's WhatsApp CTA should dial. The per-gig
// number (typed in the create wizard) wins; the provider's account-level
// number is the safety net for gigs published before that field existed
// or left blank. Returns '' when neither is set.
const gigWhatsAppNumber = (gig) => (gig?.whatsapp || gig?.provider?.whatsapp || '');

const ReviewSection = ({ gig, token, user, onRatingChange }) => {
  const { t } = useTranslation();
  const [reviews, setReviews] = useState([]);
  const [avg, setAvg] = useState(null);
  const [count, setCount] = useState(0);
  const [loading, setLoading] = useState(true);
  const [myRating, setMyRating] = useState(0);
  const [myComment, setMyComment] = useState('');
  const [saving, setSaving] = useState(false);

  const load = async () => {
    setLoading(true);
    try {
      const res = await axios.get(`${API}/marketplace/gigs/${gig.id}/reviews`);
      setReviews(res.data.reviews || []);
      setAvg(res.data.rating_avg);
      setCount(res.data.rating_count || 0);
      onRatingChange?.(res.data.rating_avg, res.data.rating_count || 0);
      // Pre-populate the caller's own review if they have one.
      const mine = (res.data.reviews || []).find((r) => r.client_user_id === user?.id);
      if (mine) {
        setMyRating(mine.rating);
        setMyComment(mine.comment || '');
      }
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, [gig.id]);

  const submit = async (e) => {
    e.preventDefault();
    if (!token) return toast.error(t('gigDetail.signInToReview', 'Please sign in to review'));
    if (myRating < 1) return toast.error(t('gigDetail.pickRating', 'Pick a star rating'));
    setSaving(true);
    try {
      await axios.post(
        `${API}/marketplace/gigs/${gig.id}/reviews`,
        { rating: myRating, comment: myComment },
        { headers: { Authorization: `Bearer ${token}` } },
      );
      toast.success(t('gigDetail.reviewPosted', 'Review posted'));
      load();
    } catch (err) {
      toast.error(err.response?.data?.detail || t('gigDetail.reviewFailed', 'Failed to post review'));
    } finally {
      setSaving(false);
    }
  };

  const deleteMine = async () => {
    if (!window.confirm(t('gigDetail.confirmWithdraw', 'Withdraw your review?'))) return;
    try {
      await axios.delete(`${API}/marketplace/gigs/${gig.id}/reviews/mine`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      setMyRating(0);
      setMyComment('');
      toast.success(t('gigDetail.reviewWithdrawn', 'Review withdrawn'));
      load();
    } catch (err) {
      toast.error(err.response?.data?.detail || t('gigDetail.deleteFailed', 'Failed to delete'));
    }
  };

  const isProvider = user?.id && gig.provider?.user_id === user.id;
  const myReview = reviews.find((r) => r.client_user_id === user?.id);

  return (
    <div data-testid="gig-reviews-section">
      <div className="flex items-baseline justify-between mb-3">
        <h2 className="text-lg font-bold">{t('gigDetail.reviews', 'Reviews')}</h2>
        <StarRating value={avg || 0} count={count} size={16} testidPrefix="gig-avg-stars" />
      </div>

      {token && !isProvider && (
        <form onSubmit={submit} className="border border-gray-200 rounded-2xl p-4 mb-4 space-y-3" data-testid="gig-review-form">
          <div className="flex items-center gap-3">
            <span className="text-sm font-semibold text-gray-700">
              {myReview ? t('gigDetail.yourRating', 'Your rating') : t('gigDetail.rateThis', 'Rate this service')}
            </span>
            <StarRating value={myRating} onChange={setMyRating} size={22} showCount={false} testidPrefix="gig-review-star" />
          </div>
          <textarea
            value={myComment}
            onChange={(e) => setMyComment(e.target.value)}
            rows={3}
            placeholder={t('gigDetail.reviewPh', 'Share how it went (optional)')}
            className="w-full px-3 py-2 rounded-lg border border-gray-200 text-sm"
            data-testid="gig-review-comment"
            maxLength={500}
          />
          <div className="flex justify-end gap-2">
            {myReview && (
              <button type="button" onClick={deleteMine} className="px-3 py-1.5 rounded-lg text-xs font-semibold text-red-500 hover:bg-red-50" data-testid="gig-review-delete">
                {t('gigDetail.withdraw', 'Withdraw')}
              </button>
            )}
            <button type="submit" disabled={saving || myRating < 1} className="px-4 py-2 rounded-lg text-sm font-semibold text-white bg-[var(--brand-primary)] disabled:opacity-50 flex items-center gap-1" data-testid="gig-review-submit">
              {saving
                ? <Loader2 className="animate-spin" size={12} />
                : (myReview ? t('gigDetail.updateReview', 'Update review') : t('gigDetail.postReview', 'Post review'))}
            </button>
          </div>
        </form>
      )}
      {!token && (
        <p className="text-sm text-gray-500 mb-3">{t('gigDetail.signInPrompt', 'Sign in to leave a review.')}</p>
      )}
      {isProvider && (
        <p className="text-xs text-gray-500 mb-3">You cannot review your own gig.</p>
      )}

      {loading ? (
        <div className="flex items-center py-4"><Loader2 className="animate-spin text-[var(--brand-primary)]" size={18} /></div>
      ) : reviews.length === 0 ? (
        <p className="text-sm text-gray-500" data-testid="gig-reviews-empty">
          {t('gigDetail.noReviewsYet', 'No reviews yet. Be the first!')}
        </p>
      ) : (
        <div className="space-y-3">
          {reviews.map((r) => (
            <div key={r.id} className="border border-gray-100 rounded-xl p-3" data-testid={`gig-review-${r.id}`}>
              <div className="flex items-center gap-2 mb-1">
                <StarRating value={r.rating} showCount={false} size={12} testidPrefix={`gig-review-stars-${r.id}`} />
                <span className="text-xs font-semibold text-gray-700">{r.client_name}</span>
                <span className="text-[11px] text-gray-400">
                  {r.created_at ? new Date(r.created_at).toLocaleDateString() : ''}
                </span>
              </div>
              {r.comment && <p className="text-sm text-gray-700 whitespace-pre-line">{r.comment}</p>}
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

const BookingForm = ({ gig, tier, onClose, token }) => {
  const { t } = useTranslation();
  const [message, setMessage] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [date, setDate] = useState('');
  const [saving, setSaving] = useState(false);
  const submit = async (e) => {
    e.preventDefault();
    if (!email.trim()) return toast.error(t('gigDetail.emailRequired', 'Email required'));
    setSaving(true);
    try {
      await axios.post(
        `${API}/marketplace/gigs/${gig.id}/book`,
        {
          tier_name: tier.name,
          message,
          contact_email: email,
          contact_phone: phone,
          preferred_date: date || null,
        },
        { headers: { Authorization: `Bearer ${token}` } },
      );
      toast.success(t('gigDetail.requestSent', 'Booking request sent!'));
      onClose();
    } catch (err) {
      toast.error(err.response?.data?.detail || t('gigDetail.requestFailed', 'Failed to send request'));
    } finally {
      setSaving(false);
    }
  };
  return (
    <div className="fixed inset-0 z-50 bg-black/60 flex items-center justify-center p-4" onClick={onClose}>
      <form
        onSubmit={submit}
        onClick={(e) => e.stopPropagation()}
        className="bg-white rounded-2xl w-full max-w-md p-6 space-y-4"
        data-testid="gig-booking-form"
      >
        <h3 className="text-lg font-bold" dir="auto">
          {t('gigDetail.requestTier', {
            defaultValue: 'Request "{{tier}}" — ₪{{price}}',
            tier: tier.name,
            price: tier.price.toLocaleString(),
          })}
        </h3>
        <input required type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder={t("sweep.yourEmail", "Your email")} className="w-full px-3 py-2 rounded-lg border border-gray-200 text-sm" data-testid="gig-booking-email" />
        <input type="tel" value={phone} onChange={(e) => setPhone(e.target.value)} placeholder={t('gigDetail.phoneOptional', 'Phone (optional)')} className="w-full px-3 py-2 rounded-lg border border-gray-200 text-sm" />
        <DateField value={date} onChange={setDate} className="w-full px-3 py-2 rounded-lg border border-gray-200 text-sm bg-white" testid="gig-booking-date" />
        <textarea value={message} onChange={(e) => setMessage(e.target.value)} placeholder={t('gigDetail.messagePh', 'Tell the provider what you need…')} rows={3} className="w-full px-3 py-2 rounded-lg border border-gray-200 text-sm" />
        <div className="flex justify-end gap-2">
          <button type="button" onClick={onClose} className="px-4 py-2 rounded-lg text-sm font-semibold text-gray-600">
            {t('common.cancel', 'Cancel')}
          </button>
          <button type="submit" disabled={saving} className="px-5 py-2 rounded-lg text-sm font-semibold text-white bg-[var(--brand-primary)]" data-testid="gig-booking-submit">
            {saving ? <Loader2 className="animate-spin" size={14} /> : t('gigDetail.sendRequest', 'Send request')}
          </button>
        </div>
      </form>
    </div>
  );
};

const GigDetail = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const { t, i18n } = useTranslation();
  const { token, user } = useContext(AuthContext);
  // Compute where "Back to services" should return the visitor. If they
  // came from a filtered /services grid (or from an adjacent
  // /businesses/provider/... or /businesses/jobs page), send them back to
  // that exact URL. Otherwise fall through to the plain /services hub.
  const backTo = useReturnDestination(GIG_RETURN_PREFIXES, '/services');
  const [gig, setGig] = useState(null);
  const [loading, setLoading] = useState(true);
  const [tier, setTier] = useState(null);
  const [showBook, setShowBook] = useState(false);
  // Lightbox — full-screen carousel. `lightboxIndex` is null when closed;
  // an integer when open (index into `activeGallery`).
  const [lightboxIndex, setLightboxIndex] = useState(null);
  // Which gallery photo the big image on the PAGE is showing. The cover
  // used to be hard-wired to activeGallery[0], so clicking a thumbnail
  // opened the lightbox but left the large image on photo 1 - and after
  // closing the lightbox on photo 3 the strip highlighted 3 while the
  // hero still showed 1, which reads as the page ignoring the click.
  const [heroIndex, setHeroIndex] = useState(0);
  // The cover's own width/height, read when it loads. The hero box takes
  // the image's shape - clamped between landscape 16:9 and portrait 4:5 -
  // instead of a fixed 16:9. Businesses upload FLYERS, and a portrait
  // flyer in a 16:9 box was a small picture between two broad blurred
  // bars; kashermybnb sent a photo of exactly that. A portrait box shows
  // the same flyer at roughly twice the size with the same "nothing
  // cropped" guarantee FitImage already gives.
  const [coverRatio, setCoverRatio] = useState(null);
  // Appointment-only: buyer-selected day (YYYY-MM-DD) + slot ("HH:MM").
  const [appointmentDate, setAppointmentDate] = useState(null);
  const [appointmentSlot, setAppointmentSlot] = useState(null);
  // Deliverable-only: optional buyer-selected date (when the gig has
  // `enable_date_booking` on).
  const [deliverableDate, setDeliverableDate] = useState('');

  useEffect(() => {
    // The visitor header is what stops a refresh counting as a new
    // visitor (see utils/visitorId). Sent only on this fetch — the one
    // that represents a person actually looking at the listing.
    axios.get(`${API}/marketplace/gigs/${id}`, { headers: visitorHeaders() })
      .then((r) => {
        setGig(r.data);
        // Pick the first tier/product as the default selection so the
        // sidebar CTA has something to book on the initial render.
        const gigType = r.data.gig_type || 'deliverable';
        if (gigType === 'store') {
          setTier(r.data.products?.[0] || null);
        } else {
          setTier(r.data.tiers?.[0] || null);
        }
      })
      .catch(() => toast.error(t('gigDetail.notFound', 'Listing not found')))
      .finally(() => setLoading(false));
  }, [id]);

  // JSON-LD Service schema — declared BEFORE the early returns so React
  // hooks ordering stays stable across renders. Falls back to null when
  // the gig is still loading; PageMeta drops the tag when jsonLd is null.
  const gigJsonLd = React.useMemo(() => {
    if (!gig) return null;
    // Service schema: describes what's on offer + who provides it. We
    // include an AggregateRating so Google can show ★4.7 (12) in the
    // search snippet, plus an Offer with a price range from the tiers.
    const prices = (gig.tiers || []).map((t) => t.price).filter((p) => typeof p === 'number');
    const currency = gig.tiers?.[0]?.currency || 'ILS';
    const block = {
      '@context': 'https://schema.org',
      '@type': 'Service',
      name: gig.title,
      description: (gig.description || '').slice(0, 500),
      serviceType: gig.category,
      areaServed: gig.area || 'Israel',
      image: gig.gallery?.[0],
      url: `https://myisraelrental.com/businesses/${gig.id}`,
      provider: {
        '@type': 'LocalBusiness',
        name: gig.provider?.name,
        image: gig.provider?.avatar,
        '@id': `https://myisraelrental.com/businesses/provider/${gig.provider?.user_id}`,
      },
    };
    if (prices.length > 0) {
      block.offers = {
        '@type': 'AggregateOffer',
        lowPrice: Math.min(...prices),
        highPrice: Math.max(...prices),
        priceCurrency: currency,
        offerCount: prices.length,
      };
    }
    if (gig.rating_count > 0 && gig.rating_avg) {
      block.aggregateRating = {
        '@type': 'AggregateRating',
        ratingValue: gig.rating_avg,
        reviewCount: gig.rating_count,
        bestRating: 5,
        worstRating: 1,
      };
    }
    return block;
  }, [gig]);

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center" style={{ paddingTop: 'var(--nav-h, 68px)' }}>
        <Loader2 className="animate-spin text-[var(--brand-primary)]" size={28} />
      </div>
    );
  }
  if (!gig) return null;

  // When the buyer picks an appointment/deliverable tier that has its
  // own photos, swap the header cover + thumbnail strip to show those
  // instead of the gig-wide gallery. Falls back to the gig gallery when
  // the tier has no images (or on Store gigs, which show a product grid
  // and use `tier` for the product row).
  const _isStoreEarly = (gig.gig_type || 'deliverable') === 'store';
  /* Which photos the hero shows.
     
     A product may now carry several, and when it does, selecting it
     shows its own set. But a product with ONE photo must not take the
     hero over: doing that replaced a strip of every product's photo
     with a single image, so a store of three products showed one
     picture and no way to see the others. Reported as "three of the
     same photo" - the hero and two similar product thumbnails, with
     the varied strip that used to sit under them gone.
     
     So: take over only when the selection genuinely has a set of its
     own. Otherwise fall through to the whole catalogue, which is what a
     store page is for. Tiers on non-store gigs keep their original
     behaviour, where a single curated image was always the point. */
  const selectedPhotos = tier ? productPhotos(tier) : [];
  const tierGallery = _isStoreEarly
    ? (selectedPhotos.length > 1 ? selectedPhotos : null)
    : (Array.isArray(tier?.images) && tier.images.length > 0 ? tier.images : null);
  // For the header carousel: prefer tier-specific images (already the
  // "curated" view), otherwise fall back to a synthesised gallery of
  // *every* image the gig actually owns — legacy gig.gallery, product
  // images (stores), or tier images (deliverable/appointment).
  const legacyGallery = Array.isArray(gig.gallery) ? gig.gallery : [];
  const productImages = Array.isArray(gig.products)
    ? gig.products.flatMap((p) => productPhotos(p))
    : [];
  const allTierImages = Array.isArray(gig.tiers)
    ? gig.tiers.flatMap((t) => (Array.isArray(t?.images) ? t.images : []))
    : [];
  const derivedGallery = [...legacyGallery, ...productImages, ...allTierImages]
    .filter(Boolean)
    // Dedupe — a legacy gig might have the same URL in gallery and tier.
    .filter((u, i, a) => a.indexOf(u) === i);
  const activeGallery = tierGallery || derivedGallery;
  // Clamped, not trusted: switching tier can shorten the gallery under a
  // heroIndex that was valid for the previous one.
  const cover = activeGallery[heroIndex] || activeGallery[0] || getGigCover(gig);
  const sym = tier?.currency === 'USD' ? '$' : '₪';
  // Bilingual fallbacks — Hebrew renders when i18n.language starts with `he`
  // AND the provider actually supplied the Hebrew copy, otherwise primary.
  const displayTitle = localizedTitle(gig, i18n);
  const displayDescription = localizedDescription(gig, i18n);
  const bucket = gig.provider?.response_bucket;

  // Picking from the product list puts that product in the LARGE image,
  // the way a shop gallery works — thumbnails beside a big picture, click
  // one and it swaps in place.
  //
  // An earlier attempt scrolled the page DOWN to the matching card in the
  // grid. That was the wrong instinct: it takes the shopper away from the
  // picture they asked to see, and the picture they asked to see is the
  // big one at the top. The gallery is sticky on desktop for the same
  // reason, so with a long product list the image stays put while the
  // list scrolls past it.
  //
  // The scroll below is only a fallback for when the gallery genuinely is
  // not on screen — a phone, where the columns stack and the list sits
  // below the image. Bringing the image back is the whole point of the
  // tap there.
  const selectProduct = (p) => {
    setTier(p);
    // Point the big image AT the picked product.
    //
    // A store's gallery only narrows to the selection when that product
    // has MORE than one photo (see tierGallery above — a single photo
    // must not collapse the varied strip into one thumbnail). The
    // consequence was that picking any ordinary one-photo product left
    // the big image on the catalogue's first picture: the click appeared
    // to do nothing, which is exactly what was reported.
    //
    // So for the single-photo case, keep the full strip and move the
    // hero INDEX to that product's photo within it. The big image shows
    // what was picked, the strip stays browsable, and the active
    // thumbnail lands on the right one.
    // productPhotos reads `images` first, which is where a tier's photos
    // live too — so one handler serves both the store picker and the
    // service option list, and they cannot drift apart.
    const photos = productPhotos(p);
    if (photos.length > 1) {
      setHeroIndex(0);
    } else {
      const idx = photos[0] ? derivedGallery.indexOf(photos[0]) : -1;
      setHeroIndex(idx >= 0 ? idx : 0);
    }
    requestAnimationFrame(() => {
      const gallery = document.querySelector('[data-testid="gig-gallery"]');
      if (!gallery) return;
      const r = gallery.getBoundingClientRect();
      const mostlyVisible = r.top < window.innerHeight * 0.6 && r.bottom > 120;
      if (mostlyVisible) return;
      const reduced = window.matchMedia?.('(prefers-reduced-motion: reduce)')?.matches;
      gallery.scrollIntoView({ behavior: reduced ? 'auto' : 'smooth', block: 'start' });
    });
  };

  const gigType = gig.gig_type || 'deliverable';
  const isStore = gigType === 'store';
  const isAppointment = gigType === 'appointment';
  const isDeliverable = gigType === 'deliverable';

  // Built once and rendered twice — the sidebar on desktop, directly under
  // the image on a phone. One definition so the two can never diverge in
  // what they offer or how selecting works.
  const optionsHeading = isStore
    ? t('services.chooseProduct', 'Choose a product')
    : isAppointment
      ? t('services.bookAppointment', 'Book an appointment')
      : t('services.choosePackage', 'Choose a package');
  const optionsList = (prefix) => (isStore ? (
    <StoreProductList
      products={gig.products || []}
      selected={tier}
      onSelect={selectProduct}
      testidPrefix={prefix ? `${prefix}-product-side` : undefined}
    />
  ) : (
    <TierList
      gig={gig}
      tiers={gig.tiers || []}
      selected={tier}
      onSelect={(tt) => { selectProduct(tt); if (isAppointment) { setAppointmentSlot(null); } }}
      isAppointment={isAppointment}
      testidPrefix={prefix ? `${prefix}-tier` : undefined}
    />
  ));

  // The provider's contact preference is `gig.booking_mode`
  // ('whatsapp' | 'in_platform') — set in the create/edit wizard.
  // We only *honour* the WhatsApp preference when the number actually
  // normalizes to a dialable one; otherwise we silently fall back to the
  // in-platform inquiry flow rather than rendering a button that opens an
  // empty WhatsApp compose screen. Every branch below keys off `useWhatsApp`
  // rather than `booking_mode` directly so the fallback can't be bypassed.
  const waNumber = gigWhatsAppNumber(gig);
  const useWhatsApp = gig.booking_mode === 'whatsapp' && hasValidWhatsApp(waNumber);
  const openWhatsApp = (message) => {
    // Guard on the number we already have so the button behaves exactly as
    // before when there's nothing to dial — the backend would only bounce
    // the visitor back to this page.
    if (!buildWhatsAppLinkWithMessage(waNumber, message)) return false;
    // Go through the tracked redirect rather than straight to wa.me, so the
    // lead is counted. Opened synchronously in the click handler: a popup
    // blocker kills a window opened after an await, and the endpoint bounces
    // to wa.me even if its own logging fails.
    const url = `${API}/marketplace/gigs/${encodeURIComponent(gig.id)}/contact`
      + `?text=${encodeURIComponent(message || '')}`;
    window.open(url, '_blank', 'noopener,noreferrer');
    return true;
  };

  const handleBookClick = () => {
    if (!tier) {
      return toast.error(isStore
        ? t('gigDetail.pickProduct', 'Pick a product first')
        : t('gigDetail.pickOption', 'Pick a service option first'));
    }
    // Store gigs never do calendar booking — always go straight to
    // WhatsApp message (or in-platform message) with the product in
    // context so the buyer + seller can negotiate.
    if (isStore) {
      if (useWhatsApp) {
        const msg = `Hi! I'm interested in "${tier.name}" (${sym}${tier.price}) from your ${displayTitle} store on MyIsraelRental.`;
        if (openWhatsApp(msg)) return;
      }
      if (!token) { toast.error(t('gigDetail.signInToMessage', 'Please sign in to message the seller')); navigate(`/auth/login?redirect=${encodeURIComponent(`/businesses/${id}`)}`); return; }
      setShowBook(true);
      return;
    }
    if (isAppointment) {
      if (!appointmentDate || !appointmentSlot) {
        return toast.error(t('services.pickDayAndTimeFirst', 'Pick a day and time slot first'));
      }
      if (useWhatsApp) {
        const msg = `Hi! I'd like to book your "${displayTitle}" — ${tier.name} on ${appointmentDate} at ${appointmentSlot} (${sym}${tier.price}) from MyIsraelRental.`;
        if (openWhatsApp(msg)) return;
      }
      if (!token) { toast.error(t('gigDetail.signInToBook', 'Please sign in to book')); navigate(`/auth/login?redirect=${encodeURIComponent(`/businesses/${id}`)}`); return; }
      setShowBook(true);
      return;
    }
    // Deliverable
    if (useWhatsApp) {
      const datePart = gig.enable_date_booking && deliverableDate ? ` on ${deliverableDate}` : '';
      const msg = `Hi! I'd like to book your "${displayTitle}" — ${tier.name} (${sym}${tier.price})${datePart} from MyIsraelRental.`;
      if (openWhatsApp(msg)) return;
    }
    if (!token) { toast.error(t('gigDetail.signInToBook', 'Please sign in to book')); navigate(`/auth/login?redirect=${encodeURIComponent(`/businesses/${id}`)}`); return; }
    setShowBook(true);
  };

  /* The on-site route, always reachable regardless of what the provider
     set as their preferred channel. Before this, a WhatsApp-preferring gig
     offered NO way to message through the site — so a buyer without
     WhatsApp, or facing a number that turned out not to be on WhatsApp,
     had no route at all.

     L1 — A MESSAGE IS NOT A BOOKING, and this used to open the booking
     form for every gig. `book_gig` rejects anything whose `booking_mode`
     is not `in_platform` (gigs.py:842) and rejects store gigs before that
     (:840). `booking_mode` defaults to `whatsapp` (shared.py:422), and
     `in_platform` is offered as a channel unconditionally (shared.py:698)
     — so the one channel ContactChannels.jsx documents as the one that
     "cannot silently fail" answered with a 400 toast on most of the
     marketplace.

     It now opens site chat: the same route BusinessPage uses to reach a
     business (BusinessPage.jsx:196), keyed by the gig so the thread
     arrives labelled with what it is about. Chat has no booking_mode
     concept, so this works for every gig — which is the entire point of
     having a fallback channel.

     Note it no longer requires a tier. Picking an option is a booking
     concern; someone asking a question should not have to choose a price
     tier before they are allowed to ask. */
  const messageOnSite = () => {
    if (!token) {
      toast.error(t('services.signInToMessage', 'Please sign in to send a message'));
      // Straight back here afterwards, so the intent is not lost on the way.
      navigate(`/auth/login?redirect=${encodeURIComponent(`/businesses/${id}`)}`);
      return;
    }
    if (!gig?.provider_user_id) {
      // Nothing to address the thread to. Better an honest message than a
      // navigation that lands on a broken chat.
      toast.error(t('services.cannotMessage', 'This listing cannot be messaged right now'));
      return;
    }
    navigate(`/chat/${gig.id}?with=${encodeURIComponent(gig.provider_user_id)}`);
  };

  const channels = gig.contact_channels || [];

  return (
    <div className="min-h-screen bg-[#FAFAF7]" style={{ paddingTop: 'var(--nav-h, 68px)' }} data-testid="gig-detail-page">
      <PageMeta title={`${displayTitle} — MyIsraelRental Services`} description={displayDescription?.slice(0, 155) || `Book ${displayTitle} on MyIsraelRental.`} path={`/businesses/${id}`} jsonLd={gigJsonLd} />
      <div className="max-w-5xl mx-auto px-4 py-8">
        <Breadcrumb current={displayTitle} testId="gig-breadcrumb" />
        <button onClick={() => navigate(backTo)} className="text-sm text-gray-600 flex items-center gap-1 mb-4 hover:text-[var(--brand-primary)]" data-testid="gig-back">
          <ArrowLeft size={14} className="rtl:rotate-180" /> {t('gigDetail.backToServices', 'Back to businesses')}
        </button>

        <div className="grid md:grid-cols-3 gap-8">
          {/* min-w-0 is load-bearing. A grid item defaults to
              `min-width: auto`, so it refuses to shrink below its
              content's intrinsic width — and the thumbnail strip below is
              a row of 96px tiles, thirteen of them on a store with a
              dozen products. The column was therefore ~1344px wide inside
              a 375px phone, and `overflow-x: clip` on <html> hid the
              damage by silently cropping it: the hero ran off the right
              edge and the page reported no horizontal scroll while being
              four times too wide. */}
          <div className="md:col-span-2 min-w-0 space-y-6">
            {/* Cover + gallery — swaps to the selected tier's own photos
                when that tier has any, so a tour guide's "Jerusalem" vs
                "Tel Aviv" tours show visually distinct hero images.
                Clicking any thumbnail (or the cover) opens the lightbox.

                NOT sticky. It was, briefly, so the big image stayed on
                screen while the product list scrolled — and on a laptop
                the hero plus the thumbnail strip is around 460px of
                opaque block, which covered the description, the product
                grid and the reviews for the whole scroll. A gallery that
                hides the page it belongs to is a worse problem than the
                one it solved. Selecting a product brings the gallery back
                into view instead (see selectProduct), which costs one
                scroll and hides nothing. */}
            <div
              className="space-y-3"
              data-testid="gig-gallery"
            >
            <button
              type="button"
              onClick={() => cover && setLightboxIndex(heroIndex)}
              /* The whole image, not the middle of it. This was a
                 background-image at `cover` in a 16:9 box, which on the
                 portrait flyers businesses actually upload cropped the
                 trade name off the top and the phone number off the
                 bottom. See components/common/FitImage. */
              className="relative w-full max-h-[78vh] bg-gray-100 rounded-2xl overflow-hidden group"
              style={{ aspectRatio: coverRatio ? Math.min(16 / 9, Math.max(4 / 5, coverRatio)) : 16 / 9 }}
              data-testid="gig-cover"
              aria-label={cover ? t('gigDetail.openGallery', 'Open photo gallery') : undefined}
            >
              {cover
                ? (
                  <FitImage
                    src={cover}
                    alt=""
                    className="absolute inset-0"
                    onLoad={(e) => {
                      const { naturalWidth: w, naturalHeight: h } = e.target;
                      if (w && h) setCoverRatio(w / h);
                    }}
                  />
                )
                : <div className="w-full h-full flex items-center justify-center text-gray-300">No image</div>}
              {/* The "Photos of · {tier}" tag is gone. It labelled the hero
                  with the selected option's name, which told a visitor
                  nothing they could not see from the option they had just
                  picked — and on a listing whose tier photo is a logo
                  rather than a photograph of the work, a black badge
                  announcing it made the odd image look deliberate. The
                  photos still swap with the selection; they are just no
                  longer captioned. */}
              {activeGallery.length > 1 && (
                <span className="absolute bottom-3 right-3 px-2.5 py-1 rounded-full text-[11px] font-semibold bg-black/70 text-white backdrop-blur-sm inline-flex items-center gap-1">
                  <Camera size={11} /> {activeGallery.length}
                </span>
              )}
            </button>
            {activeGallery.length > 1 && (
              <div className="flex gap-2 overflow-x-auto">
                {activeGallery.map((src, i) => (
                  <button
                    key={src}
                    type="button"
                    /* Swaps the big image rather than opening the lightbox.
                       Clicking a thumbnail asks "show me that one", and a
                       modal is a bigger interruption than the question
                       deserves. The lightbox is still one click away on
                       the image itself. */
                    onClick={() => setHeroIndex(i)}
                    className={`w-24 h-24 shrink-0 rounded-lg bg-gray-100 transition ${
                      i === heroIndex
                        ? 'ring-2 ring-[var(--brand-primary)]'
                        : 'hover:ring-2 hover:ring-[var(--brand-primary)] opacity-80 hover:opacity-100'
                    }`}
                    /* `contain`, matching the hero. A thumbnail cropped
                       differently from the image it selects is a different
                       picture as far as the person choosing is concerned. */
                    style={{
                      backgroundImage: `url(${src})`,
                      backgroundSize: 'contain',
                      backgroundPosition: 'center',
                      backgroundRepeat: 'no-repeat',
                    }}
                    data-testid={`gig-thumb-${i}`}
                    aria-label={`Show photo ${i + 1}`}
                    aria-current={i === heroIndex ? 'true' : undefined}
                  />
                ))}
              </div>
            )}
            </div>{/* /gig-gallery */}

            {/* Mobile only. The options live in the right-hand column,
                which on a phone stacks BELOW the description, the product
                grid and the reviews — so choosing between options meant
                scrolling down to the list, picking, then scrolling back up
                to see the photo change. Putting them directly under the
                image makes picking a single glance.

                A second copy rather than reordering the columns: the
                gallery is sticky on desktop, and moving it into its own
                grid cell to reorder it would leave sticky nothing to
                travel within. Its own testid prefix so the two copies
                cannot be confused for one another. */}
            <div className="md:hidden space-y-3" data-testid="gig-options-mobile">
              <h3 className="text-sm font-bold text-gray-500 uppercase tracking-wide">
                {optionsHeading}
              </h3>
              {optionsList('gig-m')}
            </div>

            <div>
              <div className="flex flex-wrap items-center gap-2 mb-1">
                {gig.is_top_rated && (
                  <span
                    className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-bold uppercase tracking-wide"
                    style={{ background: 'var(--gold)', color: 'var(--brand-primary)' }}
                    data-testid="gig-top-rated"
                  >
                    <Award size={12} /> {t('services.topRated', 'Top rated')}
                  </span>
                )}
                {bucket && (
                  <span
                    className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-semibold text-emerald-700 bg-emerald-50 border border-emerald-100"
                    data-testid="gig-response-badge"
                  >
                    <Zap size={12} />
                    {bucket === '1h'
                      ? t('services.replies1h', 'Replies in 1h')
                      : t('services.replies24h', 'Replies in 24h')}
                  </span>
                )}
                {isAvailableNow(gig) && (
                  <span
                    className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-bold uppercase tracking-wide shadow-sm bg-emerald-500 text-white"
                    data-testid="gig-available-now"
                  >
                    <span className="w-1.5 h-1.5 rounded-full bg-white animate-pulse" />
                    {t('gigDetail.availableNow', 'Available now')}
                  </span>
                )}
              </div>
              {/* var(--font-head), never the literal face — Playfair has
                  no Hebrew glyphs and an inline fontFamily beats the RTL
                  rule, so a Hebrew title fell back to a system serif.
                  dir="auto" because the title is the POSTER's text and
                  may be in either language regardless of the page. */}
              <h1
                className="text-2xl md:text-3xl font-bold text-gray-900"
                style={{ fontFamily: 'var(--font-head)' }}
                dir="auto"
                data-testid="gig-title"
              >
                {displayTitle}
              </h1>
              <p className="text-gray-600 mt-1" dir="auto" data-testid="gig-byline">
                {gig.provider?.name}{gig.area ? ` · ${prettyArea(gig.area, t)}` : ''}
              </p>
              {(gig.rating_count > 0) && (
                <div className="mt-2">
                  <StarRating value={gig.rating_avg || 0} count={gig.rating_count} size={14} testidPrefix="gig-header-stars" />
                </div>
              )}
            </div>

            <div>
              <h2 className="text-lg font-bold mb-2">
                {isStore ? t('gigDetail.aboutStore', 'About this store') : t('gigDetail.aboutService', 'About this service')}
              </h2>
              <p className="text-gray-700 whitespace-pre-line" dir="auto" data-testid="gig-about-body">
                {displayDescription || t('gigDetail.noDescription', 'No description provided.')}
              </p>
            </div>

            {isStore && (gig.products || []).length > 0 && (
              <div data-testid="gig-store-grid">
                <h2 className="text-lg font-bold mb-3">{t('gigDetail.products', 'Products')}</h2>
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                  {gig.products.map((p, i) => {
                    const psym = p.currency === 'USD' ? '$' : '₪';
                    const active = tier?.name === p.name;
                    const askAbout = (e) => {
                      e.stopPropagation();
                      // Per-product WhatsApp shortcut. Carries the exact
                      // item + price + a link to the store page so the
                      // seller has full context regardless of which
                      // product the shopper picked in the sidebar.
                      if (useWhatsApp) {
                        const link = `${window.location.origin}/businesses/${gig.id}`;
                        const msg = `Hi! I'm interested in "${p.name}" (${psym}${Number(p.price).toLocaleString()}) from your ${displayTitle} store on MyIsraelRental.\n${link}`;
                        if (openWhatsApp(msg)) return;
                      }
                      // Fall back to selecting the product + opening the in-platform booking modal.
                      setTier(p);
                      setHeroIndex(0);
                      if (!token) { toast.error(t('gigDetail.signInToMessage', 'Please sign in to message the seller')); navigate(`/auth/login?redirect=${encodeURIComponent(`/businesses/${id}`)}`); return; }
                      setShowBook(true);
                    };
                    return (
                      <div
                        key={i}
                        role="button"
                        tabIndex={0}
                        onClick={() => { setTier(p); setHeroIndex(0); }}
                        onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { setTier(p); setHeroIndex(0); } }}
                        className={`text-left rounded-xl overflow-hidden border-2 transition-all bg-white cursor-pointer ${
                          active ? 'border-[var(--brand-primary)] shadow-md' : 'border-gray-200 hover:border-[var(--gold)]'
                        }`}
                        data-testid={`gig-product-${i}`}
                      >
                        {(() => {
                          const pc = productCover(p);
                          const extra = productPhotos(p).length - 1;
                          return (
                            <div className="relative aspect-square bg-gray-100">
                            {pc && <FitImage src={pc} alt="" className="absolute inset-0" />}
                              {/* Says there is more to see, so a second
                                  photo is not invisible behind the first. */}
                              {extra > 0 && (
                                <span className="absolute bottom-1 end-1 px-1.5 py-0.5 rounded-full text-[10px] font-semibold bg-black/70 text-white inline-flex items-center gap-0.5">
                                  <Camera size={9} /> {extra + 1}
                                </span>
                              )}
                            </div>
                          );
                        })()}
                        <div className="p-2.5 space-y-1.5">
                          <p className="text-sm font-semibold text-gray-900 line-clamp-1">{p.name}</p>
                          <div className="flex items-baseline justify-between gap-2">
                            <p className="text-sm text-[var(--brand-primary)] font-bold">{psym}{Number(p.price).toLocaleString()}</p>
                            {!p.in_stock && <p className="text-[10px] text-red-500 font-semibold">{t("sweep.outOfStock", "Out of stock")}</p>}
                          </div>
                          <button
                            type="button"
                            onClick={askAbout}
                            className="w-full mt-1 inline-flex items-center justify-center gap-1 py-1.5 rounded-md text-[11px] font-semibold text-[var(--brand-primary)] bg-[rgb(var(--brand-primary-rgb)/<alpha-value>)]/8 hover:bg-[rgb(var(--brand-primary-rgb)/<alpha-value>)]/15 transition-colors"
                            data-testid={`gig-product-ask-${i}`}
                          >
                            <MessageCircle size={11} /> Ask about this →
                          </button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

            {gig.faqs?.length > 0 && (
              <div>
                <h2 className="text-lg font-bold mb-2">FAQs</h2>
                <div className="space-y-3">
                  {gig.faqs.map((f, i) => (
                    <div key={i} className="border border-gray-200 rounded-lg p-3">
                      <p className="font-semibold text-sm">{f.q}</p>
                      <p className="text-sm text-gray-600 mt-1">{f.a}</p>
                    </div>
                  ))}
                </div>
              </div>
            )}

            <ReviewSection
              gig={gig}
              token={token}
              user={user}
              onRatingChange={(avg, count) => setGig((prev) => prev ? { ...prev, rating_avg: avg, rating_count: count } : prev)}
            />

            {/* Provider mini-profile */}
            <div className="border border-gray-200 rounded-2xl p-4 flex items-center gap-4">
              {/* Avatar, else the BUSINESS LOGO. An owner who uploaded a logo
                  and then saw a grey circle here had done the right thing;
                  this card was reading a second image on a second profile
                  that almost nobody sets. */}
              {(() => {
                const pic = gig.provider?.avatar || gig.provider?.logo_url;
                return (
                  <div
                    className="w-14 h-14 rounded-full bg-gray-200 shrink-0"
                    style={pic ? { backgroundImage: `url(${pic})`, backgroundSize: 'cover', backgroundPosition: 'center' } : {}}
                    data-testid="gig-provider-picture"
                  />
                );
              })()}
              <div className="flex-1 min-w-0">
                <p className="font-semibold text-sm" dir="auto" data-testid="gig-provider-name">{gig.provider?.name}</p>
                <p className="text-xs text-gray-500">{gig.provider?.tagline || gig.provider?.bio || '\u00A0'}</p>
              </div>
              {user?.id && user.id === gig.provider?.user_id ? (
                /* The owner, looking at their own listing - which is where
                   people go to check their page, and where one owner went
                   looking for his hours and found nothing to click. Hours,
                   areas, logo and the rest live on the BUSINESS, not the
                   listing; this opens that form directly. */
                <button
                  onClick={() => navigate(`/dashboard?tab=my-businesses&details=${gig.business_id || 1}`)}
                  className="text-xs font-semibold text-[var(--brand-primary)] hover:underline"
                  data-testid="gig-edit-business-details"
                >
                  {t('gigDetail.editBusinessDetails', 'Edit hours, areas & logo')}
                </button>
              ) : (
                <button onClick={() => { saveReturnPath(); navigate(`/businesses/provider/${gig.provider?.user_id}`); }} className="text-xs font-semibold text-[var(--brand-primary)] hover:underline" data-testid="gig-view-provider">
                  {t('gigDetail.viewProfile', 'View profile')}
                </button>
              )}
            </div>
          </div>

          {/* Pricing sidebar — the shape shown depends on gig_type:
              - Store: product list, CTA is "Message the seller".
              - Appointment: service list + date + time-slot picker built from weekly_availability.
              - Deliverable: tier list + optional date picker when enable_date_booking. */}
          <div className="md:sticky md:top-24 h-fit space-y-4">
            <div className="border border-gray-200 rounded-2xl bg-white p-4 space-y-3">
              <h3 className="text-sm font-bold text-gray-500 uppercase tracking-wide">
                {optionsHeading}
              </h3>

              {optionsList()}

              {isAppointment && tier && (
                <AppointmentPicker
                  gig={gig}
                  tier={tier}
                  isWhatsApp={useWhatsApp}
                  selectedDate={appointmentDate}
                  selectedSlot={appointmentSlot}
                  onSelectDate={(d) => { setAppointmentDate(d); setAppointmentSlot(null); }}
                  onSelectSlot={setAppointmentSlot}
                />
              )}

              {isDeliverable && gig.enable_date_booking && tier && (
                <div className="pt-2 border-t border-gray-100">
                  <label className="text-xs font-semibold text-gray-700 flex items-center gap-1 mb-1">
                    <Calendar size={12} /> Preferred service date (optional)
                  </label>
                  <DateField value={deliverableDate} onChange={setDeliverableDate}
                    min={new Date().toISOString().slice(0, 10)}
                    className="w-full px-2 py-1.5 rounded-lg border border-gray-200 text-sm bg-white"
                    testid="gig-preferred-date" />
                </div>
              )}

              {/* WhatsApp CTAs get WhatsApp green so the destination is
                  obvious before the tap; the in-platform flow keeps the
                  brand teal. */}
              <button onClick={handleBookClick}
                disabled={isAppointment && (!appointmentDate || !appointmentSlot)}
                className={`w-full flex items-center justify-center gap-2 py-3 rounded-lg text-sm font-bold text-white disabled:opacity-40 transition-colors ${
                  useWhatsApp
                    ? 'bg-[#25D366] hover:bg-[#1DA851] disabled:hover:bg-[#25D366]'
                    : 'bg-[var(--brand-primary)] hover:bg-[#0F3A3A] disabled:hover:bg-[var(--brand-primary)]'
                }`}
                data-testid="gig-book-btn">
                {isStore ? (
                  useWhatsApp
                    ? <><MessageCircle size={14} /> {t('services.messageSellerWhatsApp', 'Message the seller on WhatsApp')}</>
                    : <><Send size={14} /> {t('services.sendInquiry', 'Send an inquiry')}</>
                ) : useWhatsApp ? (
                  <><MessageCircle size={14} /> {t('services.bookOnWhatsApp', 'Book on WhatsApp')}</>
                ) : (
                  <><Send size={14} /> {t('services.sendBookingRequest', 'Send booking request')}</>
                )}
              </button>
              {/* Present tense on purpose: "never" was a forever-promise
                  the business has not made (Tzvi, 2026-08-18 — a commission
                  may exist one day). Say what is true today, and say it in
                  the reader's language — this line was also hardcoded
                  English on the Hebrew page. */}
              {/* The other ways to reach them. The button above is the
                  provider's PREFERRED route; these are the rest, so a
                  buyer is never stuck because one channel does not work
                  for them. On-site messaging is always among them. */}
              <div className="mt-3">
                <ContactChannels
                  channels={channels.filter((c) => !(useWhatsApp && c === 'whatsapp'))}
                  email={gig.contact_email}
                  onWhatsApp={() => {
                    const msg = t('services.waGeneric', {
                      defaultValue: 'Hi! I saw your "{{title}}" listing on MyIsraelRental.',
                      title: displayTitle,
                    });
                    if (!openWhatsApp(msg)) {
                      toast.error(t('services.waUnavailable', 'WhatsApp is not available for this listing'));
                    }
                  }}
                  onMessage={messageOnSite}
                  testidPrefix="gig-contact"
                />
              </div>

              {/* Regulated categories say what we are NOT before they say
                  what we do not charge. Money exchange is licensed and
                  supervised in Israel: listing a licensed business is not
                  facilitating exchange, and that difference has to be
                  legible on the page rather than merely true. Above the
                  fee line, because "we don't take a cut" read alone
                  sounds like a claim about a transaction we are part
                  of. */}
              {needsDirectoryDisclaimer(gig.category) && (
                <div
                  className="mt-3 rounded-xl p-3 text-start"
                  style={{ background: 'var(--bg)', border: '1px solid var(--brand-border)' }}
                  data-testid="gig-directory-disclaimer"
                >
                  <p className="text-xs font-bold" style={{ color: 'var(--ink)' }}>
                    {t('directory.moneyTitle', 'We are a directory, not a money service')}
                  </p>
                  <p className="text-[11px] mt-1" style={{ color: 'var(--brand-muted)' }}>
                    {t('directory.moneyBody', "MyIsraelRental doesn't handle, hold, convert or transfer money. You deal with the business directly, on their terms.")}
                  </p>
                </div>
              )}

              <p className="text-[11px] text-gray-400 text-center mt-3">
                {isStore
                  ? t('services.noCutSeller', "You deal with the seller directly — MyIsraelRental doesn't take a cut.")
                  : t('services.noCutProvider', "You deal with the provider directly — MyIsraelRental doesn't take a cut.")}
              </p>
            </div>
          </div>
        </div>
      </div>

      {showBook && tier && (
        <BookingForm gig={gig} tier={tier} onClose={() => setShowBook(false)} token={token} />
      )}

      {lightboxIndex !== null && activeGallery.length > 0 && (
        <Lightbox
          images={activeGallery}
          index={lightboxIndex}
          onChange={setLightboxIndex}
          onClose={() => {
            if (lightboxIndex != null) setHeroIndex(lightboxIndex);
            setLightboxIndex(null);
          }}
          label={tier?.name}
        />
      )}
    </div>
  );
};

// ---------- Sidebar sub-components ----------

const TierList = ({ tiers, selected, onSelect, isAppointment, testidPrefix = 'gig-tier' }) => {
  const { t } = useTranslation();
  if (!tiers.length) return <p className="text-sm text-gray-500">{t('gigDetail.noPackages', 'No packages listed yet.')}</p>;
  return tiers.map((tt) => {
    const active = selected?.name === tt.name;
    const sym = tt.currency === 'USD' ? '$' : '₪';
    const photoCount = Array.isArray(tt.images) ? tt.images.length : 0;
    const thumb = photoCount > 0 ? tt.images[0] : null;
    return (
      <button
        key={tt.name}
        onClick={() => onSelect(tt)}
        className={`w-full text-left rounded-lg border p-3 transition-colors ${
          active ? 'border-[var(--brand-primary)] bg-[rgb(var(--brand-primary-rgb)/<alpha-value>)]/5' : 'border-gray-200 hover:border-[var(--gold)]'
        }`}
        data-testid={`${testidPrefix}-${tt.name}`}
      >
        <div className="flex gap-3">
          {/* A thumbnail, the same as the store's product picker, because
              a service option now always has a photo and a row of names
              gives the reader nothing to choose between. The camera pip
              stays for the extras beyond the first. */}
          {thumb && (
            <div
              className="w-14 h-14 rounded-lg bg-gray-100 bg-cover bg-center shrink-0"
              style={{ backgroundImage: `url(${thumb})` }}
              data-testid={`${testidPrefix}-thumb-${tt.name}`}
            />
          )}
          <div className="flex-1 min-w-0">
        <div className="flex justify-between items-baseline gap-2">
          <span className="font-semibold text-sm flex-1 flex items-center gap-1.5">
            {tt.name}
            {photoCount > 1 && (
              <span
                className={`inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded-full text-[9px] font-bold uppercase tracking-wide ${
                  active ? 'bg-[var(--brand-primary)] text-white' : 'bg-[rgb(var(--brand-primary-rgb)/<alpha-value>)]/10 text-[var(--brand-primary)]'
                }`}
                title={`${photoCount} photos of this option`}
                data-testid={`${testidPrefix}-photo-badge-${tt.name}`}
              >
                <Camera size={9} strokeWidth={2.5} /> {photoCount}
              </span>
            )}
          </span>
          <span className="font-bold text-gray-900">{sym}{Number(tt.price).toLocaleString()}</span>
        </div>
        {isAppointment && tt.duration_minutes && (
          <p className="text-xs text-gray-500 mt-1 flex items-center gap-1"><Clock size={11} /> {t('services.durationMinutes', { defaultValue: '{{n}} min', n: tt.duration_minutes })}</p>
        )}
        {!isAppointment && tt.delivery_days && (
          <p className="text-xs text-gray-500 mt-1">Delivered in {tt.delivery_days} days</p>
        )}
        {tt.description && <p className="text-xs text-gray-600 mt-1">{tt.description}</p>}
        {tt.features?.length > 0 && (
          <ul className="text-xs text-gray-600 mt-2 space-y-0.5">
            {tt.features.map((ft, i) => <li key={i}>• {ft}</li>)}
          </ul>
        )}
          </div>
        </div>
      </button>
    );
  });
};

const StoreProductList = ({ products, selected, onSelect, testidPrefix = 'gig-product-side' }) => {
  const { t } = useTranslation();
  if (!products.length) return <p className="text-sm text-gray-500">No products listed yet.</p>;
  return products.map((p, i) => {
    const active = selected?.name === p.name;
    const sym = p.currency === 'USD' ? '$' : '₪';
    const thumb = productPhotos(p)[0];
    return (
      <button key={i} onClick={() => onSelect(p, i)}
        className={`w-full text-left rounded-lg border p-2.5 flex gap-2.5 items-center transition-colors ${
          active ? 'border-[var(--brand-primary)] bg-[rgb(var(--brand-primary-rgb)/<alpha-value>)]/5' : 'border-gray-200 hover:border-[var(--gold)]'
        }`}
        data-testid={`${testidPrefix}-${i}`}>
        {/* productPhotos, not `p.image`: the uploader writes the gallery
            to `images` and clears the legacy singular field, so this read
            an empty value and every row in the picker showed a blank grey
            square. A product list with no pictures in it is the reason
            somebody has to scroll the page to work out which board is
            which. */}
        <div
          className="w-12 h-12 rounded bg-gray-100 flex-shrink-0 bg-cover bg-center"
          style={thumb ? { backgroundImage: `url(${thumb})` } : undefined}
        />
        <div className="flex-1 min-w-0">
          <p className="text-sm font-semibold text-gray-900 truncate">{p.name}</p>
          <p className="text-sm text-[var(--brand-primary)] font-bold">{sym}{Number(p.price).toLocaleString()}</p>
        </div>
      </button>
    );
  });
};

// Build the availability map for the next 90 days: keyed by ISO date
// (YYYY-MM-DD) → { label, slots }. Days without any matching weekly
// window are omitted, so callsites can use `Object.keys(slotsByDate)`
// as the enabled-date set for the calendar picker.
//
// Range bumped from 14 → 90 days so buyers can book a full quarter
// ahead. The previous 14-day cap plus a horizontal-scroll pill row hid
// most future dates and looked like a "can't book more than a week"
// bug from the buyer's perspective.
const buildAppointmentSlots = (gig, tier, locale) => {
  const weekly = gig.weekly_availability || {};
  const slotMin = gig.slot_duration_minutes || 30;
  const duration = tier.duration_minutes || slotMin;
  const dayKeys = ['sun', 'mon', 'tue', 'wed', 'thu', 'fri', 'sat'];
  const byDate = {};
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  for (let offset = 0; offset < 90; offset += 1) {
    const day = new Date(today);
    day.setDate(today.getDate() + offset);
    const key = dayKeys[day.getDay()];
    const windows = weekly[key] || [];
    if (!windows.length) continue;
    const slots = [];
    for (const win of windows) {
      const [sh, sm] = (win.start || '09:00').split(':').map(Number);
      const [eh, em] = (win.end || '17:00').split(':').map(Number);
      const startMin = sh * 60 + sm;
      const endMin = eh * 60 + em;
      for (let t = startMin; t + duration <= endMin; t += slotMin) {
        const hh = String(Math.floor(t / 60)).padStart(2, '0');
        const mm = String(t % 60).padStart(2, '0');
        slots.push(`${hh}:${mm}`);
      }
    }
    if (!slots.length) continue;
    // Use local YYYY-MM-DD (not toISOString — which shifts to UTC and
    // can off-by-one a day for timezones east of GMT).
    const yy = day.getFullYear();
    const mo = String(day.getMonth() + 1).padStart(2, '0');
    const dd = String(day.getDate()).padStart(2, '0');
    const iso = `${yy}-${mo}-${dd}`;
    // `undefined` here would use the browser's locale, not the site's —
    // which is how a Hebrew page ended up labelling days "Sun, Aug 23".
    const label = day.toLocaleDateString(locale, { weekday: 'short', month: 'short', day: 'numeric' });
    byDate[iso] = { label, slots };
  }
  return byDate;
};

const AppointmentPicker = ({ gig, tier, isWhatsApp, selectedDate, selectedSlot, onSelectDate, onSelectSlot }) => {
  /* S0 — times already spoken for. The grid is generated in the browser
     from weekly_availability, so without asking the server it offers
     every slot to everybody and two customers can take the same one.
     The server refuses the second either way; this stops the page
     inviting the collision in the first place.
     
     Failure is silent on purpose: if this request fails the picker shows
     the full grid, which is exactly the old behaviour, and the create
     call still enforces the rule. Better a slot that turns out to be
     gone than a booking form that will not open. */
  const { t, i18n } = useTranslation();
  const isHebrew = (i18n.language || '').startsWith('he');
  const [taken, setTaken] = useState({});
  useEffect(() => {
    if (!gig?.id) return undefined;
    let cancelled = false;
    (async () => {
      try {
        const { data } = await axios.get(`${API}/marketplace/gigs/${gig.id}/taken-slots`);
        if (!cancelled) setTaken(data || {});
      } catch {
        if (!cancelled) setTaken({});
      }
    })();
    return () => { cancelled = true; };
  }, [gig?.id]);

  const slotsByDate = useMemo(() => {
    const built = buildAppointmentSlots(gig, tier, isHebrew ? 'he-IL' : 'en-US');
    // Subtract the held times, and drop a day entirely once nothing is
    // left on it — a date that opens onto an empty grid reads as broken.
    const out = {};
    for (const [iso, day] of Object.entries(built)) {
      const gone = new Set(taken[iso] || []);
      const slots = day.slots.filter((sl) => !gone.has(sl));
      if (slots.length) out[iso] = { ...day, slots };
    }
    return out;
  }, [gig, tier, taken, isHebrew]);
  const availableIsoSet = useMemo(() => new Set(Object.keys(slotsByDate)), [slotsByDate]);
  const firstAvailableIso = useMemo(() => Object.keys(slotsByDate)[0] || null, [slotsByDate]);

  // Seed the parent's `selectedDate` with the first available day so the
  // slot grid + submit button are wired up on first mount. Without this
  // the buyer would have to click a day before the "book" button
  // recognizes a valid selection — but they'd naturally expect the
  // default-highlighted day to already be "picked".
  useEffect(() => {
    if (firstAvailableIso && (!selectedDate || !availableIsoSet.has(selectedDate))) {
      onSelectDate(firstAvailableIso);
    }
  }, [firstAvailableIso]);

  if (!availableIsoSet.size) {
    return (
      <p className="text-xs text-gray-500 pt-2 border-t border-gray-100" data-testid="gig-appt-no-hours">
        {t('services.noOpenHoursYet', "This business hasn't set open hours yet — send them a message instead.")}
      </p>
    );
  }

  // Convert current selection into a Date the shadcn calendar accepts,
  // defaulting to the first available day so the picker never renders
  // with an empty slot column on first mount.
  const effectiveIso = selectedDate && availableIsoSet.has(selectedDate) ? selectedDate : firstAvailableIso;
  const [y, m, d] = (effectiveIso || '').split('-').map(Number);
  const selectedDateObj = effectiveIso ? new Date(y, m - 1, d) : undefined;

  const activeSlots = effectiveIso ? (slotsByDate[effectiveIso]?.slots || []) : [];
  const activeLabel = effectiveIso ? slotsByDate[effectiveIso]?.label : '';

  // Compute the calendar bounds so the caret can only reach months
  // that contain at least one available date — no dead browsing.
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const isoList = Object.keys(slotsByDate).sort();
  const lastIso = isoList[isoList.length - 1];
  const [ly, lm, ld] = lastIso.split('-').map(Number);
  const lastDate = new Date(ly, lm - 1, ld);

  return (
    <div className="pt-3 border-t border-gray-100 space-y-2" data-testid="gig-appointment-picker">
      <label className="text-xs font-semibold text-gray-700 flex items-center gap-1">
        <Calendar size={12} /> {t('services.pickADay', 'Pick a day')}
      </label>
      <div className="rounded-lg border border-gray-200 bg-white overflow-hidden">
        <CalendarUI
          mode="single"
          selected={selectedDateObj}
          onSelect={(dateObj) => {
            if (!dateObj) return;
            const yy = dateObj.getFullYear();
            const mm = String(dateObj.getMonth() + 1).padStart(2, '0');
            const dd = String(dateObj.getDate()).padStart(2, '0');
            const iso = `${yy}-${mm}-${dd}`;
            if (availableIsoSet.has(iso)) onSelectDate(iso);
          }}
          disabled={(dateObj) => {
            const yy = dateObj.getFullYear();
            const mm = String(dateObj.getMonth() + 1).padStart(2, '0');
            const dd = String(dateObj.getDate()).padStart(2, '0');
            return !availableIsoSet.has(`${yy}-${mm}-${dd}`);
          }}
          fromDate={today}
          toDate={lastDate}
          initialFocus
          data-testid="gig-appt-calendar"
        />
      </div>
      {activeLabel && (
        <div className="text-[11px] text-gray-500 pt-1" data-testid="gig-appt-day-summary">
          {t('services.availableSlotsFor', 'Available slots for')}{' '}
          <span className="font-semibold text-gray-800">{activeLabel}</span>
        </div>
      )}
      <label className="text-xs font-semibold text-gray-700 flex items-center gap-1 pt-1">
        <Clock size={12} /> {t('services.pickATime', 'Pick a time')}
      </label>
      <div className="grid grid-cols-3 gap-1.5" data-testid="gig-appt-slots">
        {activeSlots.map((s) => (
          <button key={s} onClick={() => onSelectSlot(s)}
            className={`px-2 py-1.5 rounded-lg text-[11px] font-semibold border ${
              selectedSlot === s && selectedDate === effectiveIso
                ? 'bg-[var(--brand-primary)] text-white border-[var(--brand-primary)]'
                : 'bg-white text-gray-700 border-gray-200 hover:border-[var(--gold)]'
            }`}
            data-testid={`gig-appt-slot-${s}`}>
            {s}
          </button>
        ))}
      </div>
      {/* S3(c) — WhatsApp-mode listings only. Bookings agreed over
          WhatsApp never reach this site, so this grid is the business's
          opening hours, not a live calendar: a time can look free here
          and already be taken. (Owner-set blocked time IS subtracted
          above, which is why the grid is still worth showing.) Say what
          it is instead of implying a guarantee we cannot keep. Quiet on
          purpose — it informs, it should not scare anyone off. */}
      {isWhatsApp && (
        <p className="text-[11px] text-gray-500 leading-snug pt-1" data-testid="gig-appt-wa-notice">
          {t('services.waHoursNotice', "Times shown are this business's opening hours — confirm with them directly.")}
        </p>
      )}
    </div>
  );
};

export default GigDetail;

// ---------- Lightbox — full-screen photo carousel ----------
// Keyboard support: Esc closes, ←/→ navigate. Body scroll is locked
// while open so background content doesn't drift under the modal.
const Lightbox = ({ images, index, onChange, onClose, label }) => {
  const { t } = useTranslation();
  const safeIndex = ((index % images.length) + images.length) % images.length;
  const goPrev = React.useCallback(() => onChange((safeIndex - 1 + images.length) % images.length), [onChange, safeIndex, images.length]);
  const goNext = React.useCallback(() => onChange((safeIndex + 1) % images.length), [onChange, safeIndex, images.length]);
  React.useEffect(() => {
    const onKey = (e) => {
      if (e.key === 'Escape') onClose();
      else if (e.key === 'ArrowLeft') goPrev();
      else if (e.key === 'ArrowRight') goNext();
    };
    document.addEventListener('keydown', onKey);
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.removeEventListener('keydown', onKey);
      document.body.style.overflow = prevOverflow;
    };
  }, [onClose, goPrev, goNext]);
  // Swipe handling — track the primary touch X delta and translate the
  // fired gesture into a prev/next call. Threshold of 50px keeps
  // accidental taps from being classified as swipes. Only fires when
  // the gallery has more than one image (otherwise there's nowhere to
  // swipe to).
  const touchStartX = React.useRef(null);
  const onTouchStart = (e) => { touchStartX.current = e.touches?.[0]?.clientX ?? null; };
  const onTouchEnd = (e) => {
    if (touchStartX.current == null || images.length < 2) return;
    const endX = e.changedTouches?.[0]?.clientX ?? touchStartX.current;
    const dx = endX - touchStartX.current;
    touchStartX.current = null;
    if (Math.abs(dx) < 50) return;
    if (dx < 0) goNext(); else goPrev();
  };
  return (
    <div
      className="fixed inset-0 z-[70] bg-black/95 flex items-center justify-center touch-pan-y"
      onClick={onClose}
      onTouchStart={onTouchStart}
      onTouchEnd={onTouchEnd}
      data-testid="gig-lightbox"
      role="dialog"
      aria-modal="true"
    >
      <button
        type="button"
        onClick={(e) => { e.stopPropagation(); onClose(); }}
        className="absolute top-4 right-4 w-11 h-11 rounded-full bg-white/10 hover:bg-white/20 text-white flex items-center justify-center transition-colors"
        data-testid="gig-lightbox-close"
        aria-label="Close"
      >
        <X size={20} />
      </button>
      {label && (
        <span className="absolute top-4 left-4 px-3 py-1.5 rounded-full text-xs font-semibold bg-white/10 text-white backdrop-blur-sm">
          {label}
        </span>
      )}
      <span className="absolute bottom-6 left-1/2 -translate-x-1/2 px-3 py-1 rounded-full text-[11px] font-semibold bg-white/10 text-white/90">
        {safeIndex + 1} / {images.length}
      </span>
      {images.length > 1 && (
        <button
          type="button"
          onClick={(e) => { e.stopPropagation(); goPrev(); }}
          className="absolute left-4 top-1/2 -translate-y-1/2 w-12 h-12 rounded-full bg-white/10 hover:bg-white/20 text-white flex items-center justify-center transition-colors"
          data-testid="gig-lightbox-prev"
          aria-label={t('gigDetail.prevPhoto', 'Previous photo')}
        >
          <ChevronLeft size={22} />
        </button>
      )}
      <img
        src={images[safeIndex]}
        alt=""
        onClick={(e) => e.stopPropagation()}
        className="max-w-[92vw] max-h-[86vh] object-contain rounded-lg shadow-2xl"
        data-testid="gig-lightbox-image"
      />
      {images.length > 1 && (
        <button
          type="button"
          onClick={(e) => { e.stopPropagation(); goNext(); }}
          className="absolute right-4 top-1/2 -translate-y-1/2 w-12 h-12 rounded-full bg-white/10 hover:bg-white/20 text-white flex items-center justify-center transition-colors"
          data-testid="gig-lightbox-next"
          aria-label={t('gigDetail.nextPhoto', 'Next photo')}
        >
          <ChevronRight size={22} />
        </button>
      )}
    </div>
  );
};
