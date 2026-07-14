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
import axios from 'axios';
import { toast } from 'sonner';
import { MessageCircle, Send, Loader2, ArrowLeft, Award, Zap, Calendar, Clock, Camera, ChevronLeft, ChevronRight, X } from 'lucide-react';
import { Calendar as CalendarUI } from '../components/ui/calendar';
import { API, AuthContext } from '../App';
import PageMeta from '../components/PageMeta';
import StarRating from '../components/marketplace/StarRating';
import { localizedTitle, localizedDescription } from '../utils/gigLocale';
import { isAvailableNow, getGigCover } from '../utils/gigAvailability';

const buildWhatsAppUrl = (raw, message) => {
  const digits = (raw || '').replace(/[^\d]/g, '');
  return `https://wa.me/${digits}?text=${encodeURIComponent(message)}`;
};

const ReviewSection = ({ gig, token, user, onRatingChange }) => {
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
    if (!token) return toast.error('Please sign in to review');
    if (myRating < 1) return toast.error('Pick a star rating');
    setSaving(true);
    try {
      await axios.post(
        `${API}/marketplace/gigs/${gig.id}/reviews`,
        { rating: myRating, comment: myComment },
        { headers: { Authorization: `Bearer ${token}` } },
      );
      toast.success('Review posted');
      load();
    } catch (err) {
      toast.error(err.response?.data?.detail || 'Failed to post review');
    } finally {
      setSaving(false);
    }
  };

  const deleteMine = async () => {
    if (!window.confirm('Withdraw your review?')) return;
    try {
      await axios.delete(`${API}/marketplace/gigs/${gig.id}/reviews/mine`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      setMyRating(0);
      setMyComment('');
      toast.success('Review withdrawn');
      load();
    } catch (err) {
      toast.error(err.response?.data?.detail || 'Failed to delete');
    }
  };

  const isProvider = user?.id && gig.provider?.user_id === user.id;
  const myReview = reviews.find((r) => r.client_user_id === user?.id);

  return (
    <div data-testid="gig-reviews-section">
      <div className="flex items-baseline justify-between mb-3">
        <h2 className="text-lg font-bold">Reviews</h2>
        <StarRating value={avg || 0} count={count} size={16} testidPrefix="gig-avg-stars" />
      </div>

      {token && !isProvider && (
        <form onSubmit={submit} className="border border-gray-200 rounded-2xl p-4 mb-4 space-y-3" data-testid="gig-review-form">
          <div className="flex items-center gap-3">
            <span className="text-sm font-semibold text-gray-700">{myReview ? 'Your rating' : 'Rate this service'}</span>
            <StarRating value={myRating} onChange={setMyRating} size={22} showCount={false} testidPrefix="gig-review-star" />
          </div>
          <textarea
            value={myComment}
            onChange={(e) => setMyComment(e.target.value)}
            rows={3}
            placeholder="Share how it went (optional)"
            className="w-full px-3 py-2 rounded-lg border border-gray-200 text-sm"
            data-testid="gig-review-comment"
            maxLength={500}
          />
          <div className="flex justify-end gap-2">
            {myReview && (
              <button type="button" onClick={deleteMine} className="px-3 py-1.5 rounded-lg text-xs font-semibold text-red-500 hover:bg-red-50" data-testid="gig-review-delete">
                Withdraw
              </button>
            )}
            <button type="submit" disabled={saving || myRating < 1} className="px-4 py-2 rounded-lg text-sm font-semibold text-white bg-[#1E6A6A] disabled:opacity-50 flex items-center gap-1" data-testid="gig-review-submit">
              {saving ? <Loader2 className="animate-spin" size={12} /> : (myReview ? 'Update review' : 'Post review')}
            </button>
          </div>
        </form>
      )}
      {!token && (
        <p className="text-sm text-gray-500 mb-3">Sign in to leave a review.</p>
      )}
      {isProvider && (
        <p className="text-xs text-gray-500 mb-3">You cannot review your own gig.</p>
      )}

      {loading ? (
        <div className="flex items-center py-4"><Loader2 className="animate-spin text-[#1E6A6A]" size={18} /></div>
      ) : reviews.length === 0 ? (
        <p className="text-sm text-gray-500" data-testid="gig-reviews-empty">No reviews yet. Be the first!</p>
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
    if (!email.trim()) return toast.error('Email required');
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
      toast.success('Booking request sent!');
      onClose();
    } catch (err) {
      toast.error(err.response?.data?.detail || 'Failed to send request');
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
        <h3 className="text-lg font-bold">Request &quot;{tier.name}&quot; — ₪{tier.price.toLocaleString()}</h3>
        <input required type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder={t("sweep.yourEmail", "Your email")} className="w-full px-3 py-2 rounded-lg border border-gray-200 text-sm" data-testid="gig-booking-email" />
        <input type="tel" value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="Phone (optional)" className="w-full px-3 py-2 rounded-lg border border-gray-200 text-sm" />
        <input type="date" value={date} onChange={(e) => setDate(e.target.value)} className="w-full px-3 py-2 rounded-lg border border-gray-200 text-sm" />
        <textarea value={message} onChange={(e) => setMessage(e.target.value)} placeholder="Tell the provider what you need…" rows={3} className="w-full px-3 py-2 rounded-lg border border-gray-200 text-sm" />
        <div className="flex justify-end gap-2">
          <button type="button" onClick={onClose} className="px-4 py-2 rounded-lg text-sm font-semibold text-gray-600">Cancel</button>
          <button type="submit" disabled={saving} className="px-5 py-2 rounded-lg text-sm font-semibold text-white bg-[#1E6A6A]" data-testid="gig-booking-submit">
            {saving ? <Loader2 className="animate-spin" size={14} /> : 'Send request'}
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
  const [gig, setGig] = useState(null);
  const [loading, setLoading] = useState(true);
  const [tier, setTier] = useState(null);
  const [showBook, setShowBook] = useState(false);
  // Lightbox — full-screen carousel. `lightboxIndex` is null when closed;
  // an integer when open (index into `activeGallery`).
  const [lightboxIndex, setLightboxIndex] = useState(null);
  // Appointment-only: buyer-selected day (YYYY-MM-DD) + slot ("HH:MM").
  const [appointmentDate, setAppointmentDate] = useState(null);
  const [appointmentSlot, setAppointmentSlot] = useState(null);
  // Deliverable-only: optional buyer-selected date (when the gig has
  // `enable_date_booking` on).
  const [deliverableDate, setDeliverableDate] = useState('');

  useEffect(() => {
    axios.get(`${API}/marketplace/gigs/${id}`)
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
      .catch(() => toast.error('Gig not found'))
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
      url: `https://myisraelrental.com/services/gig/${gig.id}`,
      provider: {
        '@type': 'LocalBusiness',
        name: gig.provider?.name,
        image: gig.provider?.avatar,
        '@id': `https://myisraelrental.com/services/provider/${gig.provider?.user_id}`,
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
        <Loader2 className="animate-spin text-[#1E6A6A]" size={28} />
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
  const tierGallery = (tier && !_isStoreEarly && Array.isArray(tier.images) && tier.images.length > 0)
    ? tier.images
    : null;
  // For the header carousel: prefer tier-specific images (already the
  // "curated" view), otherwise fall back to a synthesised gallery of
  // *every* image the gig actually owns — legacy gig.gallery, product
  // images (stores), or tier images (deliverable/appointment).
  const legacyGallery = Array.isArray(gig.gallery) ? gig.gallery : [];
  const productImages = Array.isArray(gig.products)
    ? gig.products.filter((p) => p?.image).map((p) => p.image)
    : [];
  const allTierImages = Array.isArray(gig.tiers)
    ? gig.tiers.flatMap((t) => (Array.isArray(t?.images) ? t.images : []))
    : [];
  const derivedGallery = [...legacyGallery, ...productImages, ...allTierImages]
    .filter(Boolean)
    // Dedupe — a legacy gig might have the same URL in gallery and tier.
    .filter((u, i, a) => a.indexOf(u) === i);
  const activeGallery = tierGallery || derivedGallery;
  const cover = activeGallery[0] || getGigCover(gig);
  const sym = tier?.currency === 'USD' ? '$' : '₪';
  // Bilingual fallbacks — Hebrew renders when i18n.language starts with `he`
  // AND the provider actually supplied the Hebrew copy, otherwise primary.
  const displayTitle = localizedTitle(gig, i18n);
  const displayDescription = localizedDescription(gig, i18n);
  const bucket = gig.provider?.response_bucket;

  const gigType = gig.gig_type || 'deliverable';
  const isStore = gigType === 'store';
  const isAppointment = gigType === 'appointment';
  const isDeliverable = gigType === 'deliverable';

  const handleBookClick = () => {
    if (!tier) {
      return toast.error(isStore ? 'Pick a product first' : 'Pick a service option first');
    }
    // Store gigs never do calendar booking — always go straight to
    // WhatsApp message (or in-platform message) with the product in
    // context so the buyer + seller can negotiate.
    if (isStore) {
      if (gig.booking_mode === 'whatsapp') {
        if (!gig.whatsapp) return toast.error('Seller has no WhatsApp set');
        const msg = `Hi! I'm interested in "${tier.name}" (${sym}${tier.price}) from your ${displayTitle} store on MyIsraelRental.`;
        window.open(buildWhatsAppUrl(gig.whatsapp, msg), '_blank');
        return;
      }
      if (!token) { toast.error('Please sign in to message the seller'); navigate('/auth'); return; }
      setShowBook(true);
      return;
    }
    if (isAppointment) {
      if (!appointmentDate || !appointmentSlot) {
        return toast.error('Pick a day and time slot first');
      }
      if (gig.booking_mode === 'whatsapp') {
        if (!gig.whatsapp) return toast.error('Provider has no WhatsApp set');
        const msg = `Hi! I'd like to book your "${displayTitle}" — ${tier.name} on ${appointmentDate} at ${appointmentSlot} (${sym}${tier.price}) from MyIsraelRental.`;
        window.open(buildWhatsAppUrl(gig.whatsapp, msg), '_blank');
        return;
      }
      if (!token) { toast.error('Please sign in to book'); navigate('/auth'); return; }
      setShowBook(true);
      return;
    }
    // Deliverable
    if (gig.booking_mode === 'whatsapp') {
      if (!gig.whatsapp) return toast.error('Provider has no WhatsApp set');
      const datePart = gig.enable_date_booking && deliverableDate ? ` on ${deliverableDate}` : '';
      const msg = `Hi! I'd like to book your "${displayTitle}" — ${tier.name} (${sym}${tier.price})${datePart} from MyIsraelRental.`;
      window.open(buildWhatsAppUrl(gig.whatsapp, msg), '_blank');
      return;
    }
    if (!token) { toast.error('Please sign in to book'); navigate('/auth'); return; }
    setShowBook(true);
  };

  return (
    <div className="min-h-screen bg-[#FAFAF7]" style={{ paddingTop: 'var(--nav-h, 68px)' }} data-testid="gig-detail-page">
      <PageMeta title={`${displayTitle} — MyIsraelRental Services`} description={displayDescription?.slice(0, 155) || `Book ${displayTitle} on MyIsraelRental.`} path={`/services/gig/${id}`} jsonLd={gigJsonLd} />
      <div className="max-w-5xl mx-auto px-4 py-8">
        <button onClick={() => navigate('/services')} className="text-sm text-gray-600 flex items-center gap-1 mb-4 hover:text-[#1E6A6A]" data-testid="gig-back">
          <ArrowLeft size={14} /> Back to services
        </button>

        <div className="grid md:grid-cols-3 gap-8">
          <div className="md:col-span-2 space-y-6">
            {/* Cover + gallery — swaps to the selected tier's own photos
                when that tier has any, so a tour guide's "Jerusalem" vs
                "Tel Aviv" tours show visually distinct hero images.
                Clicking any thumbnail (or the cover) opens the lightbox. */}
            <button
              type="button"
              onClick={() => cover && setLightboxIndex(0)}
              className="relative aspect-video w-full bg-gray-100 rounded-2xl overflow-hidden group"
              style={cover ? { backgroundImage: `url(${cover})`, backgroundSize: 'cover', backgroundPosition: 'center' } : {}}
              data-testid="gig-cover"
              aria-label={cover ? 'Open photo gallery' : undefined}
            >
              {!cover && <div className="w-full h-full flex items-center justify-center text-gray-300">No image</div>}
              {tierGallery && tier?.name && (
                <span className="absolute top-3 left-3 px-2.5 py-1 rounded-full text-[11px] font-semibold bg-black/70 text-white backdrop-blur-sm" data-testid="gig-tier-gallery-tag">
                  Photos of · {tier.name}
                </span>
              )}
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
                    onClick={() => setLightboxIndex(i)}
                    className="w-24 h-24 shrink-0 rounded-lg bg-gray-100 hover:ring-2 hover:ring-[#1E6A6A] transition"
                    style={{ backgroundImage: `url(${src})`, backgroundSize: 'cover', backgroundPosition: 'center' }}
                    data-testid={`gig-thumb-${i}`}
                    aria-label={`Open photo ${i + 1}`}
                  />
                ))}
              </div>
            )}

            <div>
              <div className="flex flex-wrap items-center gap-2 mb-1">
                {gig.is_top_rated && (
                  <span
                    className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-bold uppercase tracking-wide"
                    style={{ background: '#D4AF37', color: '#1E6A6A' }}
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
                    Available now
                  </span>
                )}
              </div>
              <h1 className="text-2xl md:text-3xl font-bold text-gray-900" style={{ fontFamily: 'Playfair Display' }}>{displayTitle}</h1>
              <p className="text-gray-600 mt-1">{gig.provider?.name}{gig.area ? ` · ${gig.area}` : ''}</p>
              {(gig.rating_count > 0) && (
                <div className="mt-2">
                  <StarRating value={gig.rating_avg || 0} count={gig.rating_count} size={14} testidPrefix="gig-header-stars" />
                </div>
              )}
            </div>

            <div>
              <h2 className="text-lg font-bold mb-2">{isStore ? 'About this store' : 'About this service'}</h2>
              <p className="text-gray-700 whitespace-pre-line">{displayDescription || 'No description provided.'}</p>
            </div>

            {isStore && (gig.products || []).length > 0 && (
              <div data-testid="gig-store-grid">
                <h2 className="text-lg font-bold mb-3">Products</h2>
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
                      if (gig.booking_mode === 'whatsapp') {
                        if (!gig.whatsapp) return toast.error('Seller has no WhatsApp set');
                        const link = `${window.location.origin}/services/gig/${gig.id}`;
                        const msg = `Hi! I'm interested in "${p.name}" (${psym}${Number(p.price).toLocaleString()}) from your ${displayTitle} store on MyIsraelRental.\n${link}`;
                        window.open(buildWhatsAppUrl(gig.whatsapp, msg), '_blank');
                        return;
                      }
                      // Fall back to selecting the product + opening the in-platform booking modal.
                      setTier(p);
                      if (!token) { toast.error('Please sign in to message the seller'); navigate('/auth'); return; }
                      setShowBook(true);
                    };
                    return (
                      <div
                        key={i}
                        role="button"
                        tabIndex={0}
                        onClick={() => setTier(p)}
                        onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') setTier(p); }}
                        className={`text-left rounded-xl overflow-hidden border-2 transition-all bg-white cursor-pointer ${
                          active ? 'border-[#1E6A6A] shadow-md' : 'border-gray-200 hover:border-[#D4AF37]'
                        }`}
                        data-testid={`gig-product-${i}`}
                      >
                        <div className="aspect-square bg-gray-100" style={p.image ? { backgroundImage: `url(${p.image})`, backgroundSize: 'cover', backgroundPosition: 'center' } : {}} />
                        <div className="p-2.5 space-y-1.5">
                          <p className="text-sm font-semibold text-gray-900 line-clamp-1">{p.name}</p>
                          <div className="flex items-baseline justify-between gap-2">
                            <p className="text-sm text-[#1E6A6A] font-bold">{psym}{Number(p.price).toLocaleString()}</p>
                            {!p.in_stock && <p className="text-[10px] text-red-500 font-semibold">{t("sweep.outOfStock", "Out of stock")}</p>}
                          </div>
                          <button
                            type="button"
                            onClick={askAbout}
                            className="w-full mt-1 inline-flex items-center justify-center gap-1 py-1.5 rounded-md text-[11px] font-semibold text-[#1E6A6A] bg-[#1E6A6A]/8 hover:bg-[#1E6A6A]/15 transition-colors"
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
              <div className="w-14 h-14 rounded-full bg-gray-200 shrink-0" style={gig.provider?.avatar ? { backgroundImage: `url(${gig.provider.avatar})`, backgroundSize: 'cover' } : {}} />
              <div className="flex-1 min-w-0">
                <p className="font-semibold text-sm">{gig.provider?.name}</p>
                <p className="text-xs text-gray-500">{gig.provider?.tagline || gig.provider?.bio || '\u00A0'}</p>
              </div>
              <button onClick={() => navigate(`/services/provider/${gig.provider?.user_id}`)} className="text-xs font-semibold text-[#1E6A6A] hover:underline" data-testid="gig-view-provider">
                View profile
              </button>
            </div>
          </div>

          {/* Pricing sidebar — the shape shown depends on gig_type:
              - Store: product list, CTA is "Message the seller".
              - Appointment: service list + date + time-slot picker built from weekly_availability.
              - Deliverable: tier list + optional date picker when enable_date_booking. */}
          <div className="md:sticky md:top-24 h-fit space-y-4">
            <div className="border border-gray-200 rounded-2xl bg-white p-4 space-y-3">
              <h3 className="text-sm font-bold text-gray-500 uppercase tracking-wide">
                {isStore ? 'Choose a product' : isAppointment ? 'Book an appointment' : 'Choose a package'}
              </h3>

              {isStore ? (
                <StoreProductList products={gig.products || []} selected={tier} onSelect={setTier} />
              ) : (
                <TierList
                  gig={gig}
                  tiers={gig.tiers || []}
                  selected={tier}
                  onSelect={(tt) => { setTier(tt); if (isAppointment) { setAppointmentSlot(null); } }}
                  isAppointment={isAppointment}
                />
              )}

              {isAppointment && tier && (
                <AppointmentPicker
                  gig={gig}
                  tier={tier}
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
                  <input type="date" value={deliverableDate} onChange={(e) => setDeliverableDate(e.target.value)}
                    min={new Date().toISOString().slice(0, 10)}
                    className="w-full px-2 py-1.5 rounded-lg border border-gray-200 text-sm"
                    data-testid="gig-preferred-date" />
                </div>
              )}

              <button onClick={handleBookClick}
                disabled={isAppointment && (!appointmentDate || !appointmentSlot)}
                className="w-full flex items-center justify-center gap-2 py-3 rounded-lg text-sm font-bold text-white bg-[#1E6A6A] hover:bg-[#0F3A3A] disabled:opacity-40 disabled:hover:bg-[#1E6A6A] transition-colors"
                data-testid="gig-book-btn">
                {isStore ? (
                  gig.booking_mode === 'whatsapp' ? <><MessageCircle size={14} /> Message the seller</> : <><Send size={14} /> Send an inquiry</>
                ) : gig.booking_mode === 'whatsapp' ? (
                  <><MessageCircle size={14} /> Book on WhatsApp</>
                ) : (
                  <><Send size={14} /> Send booking request</>
                )}
              </button>
              <p className="text-[11px] text-gray-400 text-center">
                MyIsraelRental never takes a cut — you deal with the {isStore ? 'seller' : 'provider'} directly.
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
          onClose={() => setLightboxIndex(null)}
          label={tier?.name}
        />
      )}
    </div>
  );
};

// ---------- Sidebar sub-components ----------

const TierList = ({ tiers, selected, onSelect, isAppointment }) => {
  if (!tiers.length) return <p className="text-sm text-gray-500">No packages listed yet.</p>;
  return tiers.map((tt) => {
    const active = selected?.name === tt.name;
    const sym = tt.currency === 'USD' ? '$' : '₪';
    const photoCount = Array.isArray(tt.images) ? tt.images.length : 0;
    return (
      <button
        key={tt.name}
        onClick={() => onSelect(tt)}
        className={`w-full text-left rounded-lg border p-3 transition-colors ${
          active ? 'border-[#1E6A6A] bg-[#1E6A6A]/5' : 'border-gray-200 hover:border-[#D4AF37]'
        }`}
        data-testid={`gig-tier-${tt.name}`}
      >
        <div className="flex justify-between items-baseline gap-2">
          <span className="font-semibold text-sm flex-1 flex items-center gap-1.5">
            {tt.name}
            {/* Camera pip when this tier has its own gallery — signals to
                buyers that clicking it swaps the header photos. */}
            {photoCount > 0 && (
              <span
                className={`inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded-full text-[9px] font-bold uppercase tracking-wide ${
                  active ? 'bg-[#1E6A6A] text-white' : 'bg-[#1E6A6A]/10 text-[#1E6A6A]'
                }`}
                title={`${photoCount} photo${photoCount === 1 ? '' : 's'} of this option`}
                data-testid={`gig-tier-photo-badge-${tt.name}`}
              >
                <Camera size={9} strokeWidth={2.5} /> {photoCount}
              </span>
            )}
          </span>
          <span className="font-bold text-gray-900">{sym}{Number(tt.price).toLocaleString()}</span>
        </div>
        {isAppointment && tt.duration_minutes && (
          <p className="text-xs text-gray-500 mt-1 flex items-center gap-1"><Clock size={11} /> {tt.duration_minutes} min</p>
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
      </button>
    );
  });
};

const StoreProductList = ({ products, selected, onSelect }) => {
  const { t } = useTranslation();
  if (!products.length) return <p className="text-sm text-gray-500">No products listed yet.</p>;
  return products.map((p, i) => {
    const active = selected?.name === p.name;
    const sym = p.currency === 'USD' ? '$' : '₪';
    return (
      <button key={i} onClick={() => onSelect(p)}
        className={`w-full text-left rounded-lg border p-2.5 flex gap-2.5 items-center transition-colors ${
          active ? 'border-[#1E6A6A] bg-[#1E6A6A]/5' : 'border-gray-200 hover:border-[#D4AF37]'
        }`}
        data-testid={`gig-product-side-${i}`}>
        <div className="w-11 h-11 rounded bg-gray-100 flex-shrink-0" style={p.image ? { backgroundImage: `url(${p.image})`, backgroundSize: 'cover', backgroundPosition: 'center' } : {}} />
        <div className="flex-1 min-w-0">
          <p className="text-sm font-semibold text-gray-900 truncate">{p.name}</p>
          <p className="text-sm text-[#1E6A6A] font-bold">{sym}{Number(p.price).toLocaleString()}</p>
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
const buildAppointmentSlots = (gig, tier) => {
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
    const label = day.toLocaleDateString(undefined, { weekday: 'short', month: 'short', day: 'numeric' });
    byDate[iso] = { label, slots };
  }
  return byDate;
};

const AppointmentPicker = ({ gig, tier, selectedDate, selectedSlot, onSelectDate, onSelectSlot }) => {
  const slotsByDate = useMemo(() => buildAppointmentSlots(gig, tier), [gig, tier]);
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
    return <p className="text-xs text-gray-500 pt-2 border-t border-gray-100">Provider hasn&apos;t set open hours yet — book via message.</p>;
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
        <Calendar size={12} /> Pick a day
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
          Available slots for <span className="font-semibold text-gray-800">{activeLabel}</span>
        </div>
      )}
      <label className="text-xs font-semibold text-gray-700 flex items-center gap-1 pt-1">
        <Clock size={12} /> Pick a time
      </label>
      <div className="grid grid-cols-3 gap-1.5" data-testid="gig-appt-slots">
        {activeSlots.map((s) => (
          <button key={s} onClick={() => onSelectSlot(s)}
            className={`px-2 py-1.5 rounded-lg text-[11px] font-semibold border ${
              selectedSlot === s && selectedDate === effectiveIso
                ? 'bg-[#1E6A6A] text-white border-[#1E6A6A]'
                : 'bg-white text-gray-700 border-gray-200 hover:border-[#D4AF37]'
            }`}
            data-testid={`gig-appt-slot-${s}`}>
            {s}
          </button>
        ))}
      </div>
    </div>
  );
};

export default GigDetail;

// ---------- Lightbox — full-screen photo carousel ----------
// Keyboard support: Esc closes, ←/→ navigate. Body scroll is locked
// while open so background content doesn't drift under the modal.
const Lightbox = ({ images, index, onChange, onClose, label }) => {
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
          aria-label="Previous photo"
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
          aria-label="Next photo"
        >
          <ChevronRight size={22} />
        </button>
      )}
    </div>
  );
};
