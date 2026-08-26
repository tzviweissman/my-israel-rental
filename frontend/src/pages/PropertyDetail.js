import React, { useState, useEffect, useContext } from 'react';
import { useParams, useNavigate, useSearchParams } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import axios from 'axios';
import { API, AuthContext } from '../App';
import { FX_USD_TO_ILS } from '../utils/listingPrice';
import { MapPin, Calendar as CalendarIcon, Heart, Share2, Check, QrCode } from 'lucide-react';
import { format } from 'date-fns';
import { toast } from 'sonner';

import { ArrowLeft } from 'lucide-react';

import ImageGallery from '../components/property/ImageGallery';
import PropertyStats from '../components/property/PropertyStats';
import AmenitiesList from '../components/property/AmenitiesList';
import BookingSidebar from '../components/property/BookingSidebar';
import MovingServicesCrossSell from '../components/services/MovingServicesCrossSell';
import Breadcrumb from '../components/common/Breadcrumb';
import QrShareCard from '../components/common/QrShareCard';
import ScanChart from '../components/common/ScanChart';
import ShareLinkButtons from '../components/common/ShareLinkButtons';
import { areaLabel } from '../utils/areaNames';
import { visitorHeaders } from '../utils/visitorId';

// Parse 'YYYY-MM-DD' as a LOCAL date (avoids the UTC-shift bug where
// selecting June 2 displays as June 1 in timezones east of UTC).
const parseLocalDate = (dateStr) => {
  if (!dateStr) return undefined;
  const [y, m, d] = String(dateStr).split('T')[0].split('-').map(Number);
  if (!y || !m || !d) return undefined;
  return new Date(y, m - 1, d);
};

// Opening a listing is the one request a visitor definitely meant to make, so
// a transient failure is worth retrying before telling them it doesn't exist.
// A 404 is the server's actual answer and is returned immediately — retrying
// it would only delay the honest message.
const PROPERTY_RETRY_DELAYS_MS = [1_000, 3_000];

const fetchPropertyWithRetry = async (id) => {
  let lastError;
  for (let attempt = 0; attempt <= PROPERTY_RETRY_DELAYS_MS.length; attempt += 1) {
    try {
      // See utils/visitorId — this is what stops a refresh counting as
      // a second visitor on the owner's dashboard.
      return await axios.get(`${API}/properties/${id}`, { headers: visitorHeaders() });
    } catch (error) {
      lastError = error;
      const status = error?.response?.status;
      // 4xx is a verdict, not a hiccup — don't retry it.
      if (status !== undefined && status < 500) throw error;
      const delay = PROPERTY_RETRY_DELAYS_MS[attempt];
      if (delay === undefined) break;
      await new Promise((resolve) => setTimeout(resolve, delay));
    }
  }
  throw lastError;
};

const PropertyDetail = () => {
  const { id } = useParams();
  const [searchParams] = useSearchParams();
  // Sublease deep-link params (optional): visitor arrived from a Sukkot/
  // Pesach sublease card and wants the booking form pre-filled with the
  // sublease's date window.
  const preFromParam = searchParams.get('from');
  const preToParam = searchParams.get('to');
  const preSubleaseId = searchParams.get('sublease_id');
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { user, token } = useContext(AuthContext);
  // Owner-only QR share (spec Q5). The public payload deliberately does
  // not say who owns the listing, so ownership is discovered by ASKING:
  // the short-link mint returns 200 only to the owner (or an admin) and
  // 403 to everyone else. One request, on click, and the server stays the
  // only authority on who owns what.
  const [shareOpen, setShareOpen] = useState(false);
  const [shortLink, setShortLink] = useState(null);
  const [property, setProperty] = useState(null);
  const [currentImageIndex, setCurrentImageIndex] = useState(0);
  const [showCalendar, setShowCalendar] = useState(null);
  const [dateRange, setDateRange] = useState({ from: undefined, to: undefined });
  const [bookingData, setBookingData] = useState({
    start_date: '',
    end_date: '',
    message: ''
  });
  // Sublease being viewed (populated when ?sublease_id= is in URL). When
  // present, its price/currency/price_type take precedence over the
  // underlying property's price in the booking sidebar.
  const [sublease, setSublease] = useState(null);
  const [calendarMonth, setCalendarMonth] = useState(new Date());

  // Keep the calendar's opening month anchored to the most relevant date
  // (sublease window start > property availability > today) so the user
  // never has to scroll months to find the dates they need.
  useEffect(() => {
    if (sublease?.available_from) {
      setCalendarMonth(parseLocalDate(sublease.available_from));
    } else if (property?.available_from) {
      setCalendarMonth(parseLocalDate(property.available_from));
    } else if (property?.starting_date) {
      setCalendarMonth(parseLocalDate(property.starting_date));
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sublease, property?.available_from, property?.starting_date]);
  const [showBooking, setShowBooking] = useState(false);
  // Set once a booking request goes through, so the services cross-sell can
  // switch to its post-booking copy.
  const [justBooked, setJustBooked] = useState(false);
  const [exchangeRate, setExchangeRate] = useState(null);
  const [blockedDates, setBlockedDates] = useState([]);
  const [isLiked, setIsLiked] = useState(false);
  const [shareCopied, setShareCopied] = useState(false);
  
  // Determine where user came from
  const previousPath = sessionStorage.getItem('previousPath') || '/';
  const isFromDashboard = previousPath.includes('/dashboard');
  const isFromManager = previousPath.includes('/manager/');
  // Match the broader Stays surface too — /stays and its SEO landing
  // variants (e.g. /kosher-stays-in-israel) — plus the legacy
  // /properties/<type> pages. Any of these should return the renter to
  // their exact filtered view. Missing /stays here was the "filters
  // wiped on back" bug.
  const isFromListings =
    previousPath.includes('/properties/') ||
    previousPath.startsWith('/stays') ||
    previousPath.startsWith('/kosher-stays-in-israel');
  
  // Determine back button destination and text
  const getBackDestination = () => {
    if (isFromDashboard) return '/dashboard';
    if (isFromManager) return previousPath;
    if (isFromListings) return previousPath; // Return to the specific listings page
    return '/stays'; // Default to the new unified search UI
  };
  
  const getBackButtonText = () => {
    if (isFromDashboard) return t('property.backToDashboard');
    return t('property.backToListings');
  };

  useEffect(() => {
    axios.get(`${API}/exchange-rate`)
      .then(res => setExchangeRate(res.data))
      .catch(() => setExchangeRate({ usd_to_ils: FX_USD_TO_ILS, ils_to_usd: 1 / FX_USD_TO_ILS }));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const convertPrice = (price, fromCurrency) => {
    if (!exchangeRate || !price) return null;
    if (fromCurrency === 'USD') return { amount: Math.round(price * exchangeRate.usd_to_ils), symbol: '₪' };
    return { amount: Math.round(price * exchangeRate.ils_to_usd), symbol: '$' };
  };

  useEffect(() => {
    // Kick off the sublease fetch in parallel with the property fetch so the
    // sidebar never has to fall back to the underlying property's monthly
    // price for a frame.
    if (preSubleaseId) {
      axios
        .get(`${API}/subleases/${preSubleaseId}`)
        .then((r) => setSublease(r.data))
        .catch(() => setSublease(null));
    }
    fetchProperty();
    if (token) {
      axios.get(`${API}/liked-property-ids`, { headers: { Authorization: `Bearer ${token}` } })
        .then(res => setIsLiked(res.data.includes(id)))
        .catch((err) => {
          console.error('Failed to fetch liked properties:', err);
        });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id, token]);

  const toggleLike = async () => {
    if (!token) {
      toast.error('Please log in to save properties.');
      return;
    }
    try {
      const res = await axios.post(`${API}/properties/${id}/like`, {}, {
        headers: { Authorization: `Bearer ${token}` }
      });
      setIsLiked(res.data.liked);
      toast.success(res.data.liked ? 'Saved to favorites!' : 'Removed from favorites');
    } catch (err) {
      toast.error('Failed to update favorites');
    }
  };

  const fetchProperty = async () => {
    let response;
    try {
      response = await fetchPropertyWithRetry(id);
      setProperty(response.data);
    } catch (error) {
      console.error('Failed to fetch property', error);
      // Only a real 404 means the listing is gone. A network drop, a 5xx, or
      // the backend restarting for a deploy used to report the same thing,
      // which reads as "your listing was deleted" at the worst moment.
      if (error?.response?.status === 404) {
        toast.error(t('property.notFound', 'Property not found'));
      } else {
        toast.error(
          t('property.loadFailed', "Couldn't load this listing — please try again in a moment."),
        );
      }
      return;
    }

    try {
      // Blocked dates are supplementary: the listing renders fine without
      // them. Deliberately its own try/catch — sharing the property fetch's
      // meant a calendar hiccup claimed the property itself didn't exist.
      const blockedRes = await axios.get(`${API}/properties/${id}/blocked-dates`);
      const allBlocked = [...(blockedRes.data.internal || []), ...(blockedRes.data.external || [])];
      const dates = [];
      allBlocked.forEach(b => {
        const start = new Date(b.start_date);
        const end = new Date(b.end_date);
        for (let d = new Date(start); d < end; d.setDate(d.getDate() + 1)) {
          dates.push(new Date(d));
        }
      });
      setBlockedDates(dates);
    } catch (error) {
      console.error('Failed to fetch blocked dates', error);
    }

    // Pure date pre-fill from here down — no network, so nothing left to
    // mistake for a missing property.
    try {
      // Sublease deep-link: pre-fill booking window from URL params.
      if (preFromParam && preToParam) {
        const from = parseLocalDate(preFromParam);
        const to = parseLocalDate(preToParam);
        if (from && to) {
          setBookingData((prev) => ({
            ...prev,
            start_date: format(from, 'yyyy-MM-dd'),
            end_date: format(to, 'yyyy-MM-dd'),
          }));
          setDateRange({ from, to });
          setShowBooking(true);
        }
        // Sublease itself is fetched in parallel on mount (see top-level
        // useEffect) — no need to refetch here.
      } else if (response.data.rental_type === 'long-term' && response.data.starting_date) {
        // For long-term rentals, set the starting date as check-in (read-only)
        const startDate = parseLocalDate(response.data.starting_date);
        setBookingData(prev => ({
          ...prev,
          start_date: format(startDate, 'yyyy-MM-dd')
        }));
        setDateRange({ from: startDate, to: undefined });
      }
    } catch (error) {
      console.error('Failed to pre-fill booking dates', error);
    }
  };

  const handleBooking = async () => {
    if (!user) {
      navigate(`/auth/login?redirect=${encodeURIComponent(`/property/${id}`)}`);
      return;
    }

    // No contract signature required at booking time
    // Contract will be sent after owner accepts the booking

    try {
      const res = await axios.post(`${API}/bookings`, {
        property_id: id,
        ...bookingData,
        contract_signed: false, // Will be signed after owner accepts
        signature_data: null,
        // Tag sublease bookings so the backend routes the notification to
        // the sublessor and uses the sublease's price.
        sublease_id: sublease?.id || null,
      }, {
        headers: { Authorization: `Bearer ${token}` }
      });
      // Vacation rentals (non-sublease) auto-confirm server-side. Use the
      // backend's status to pick the right toast so the renter knows
      // whether they're confirmed or waiting on owner approval.
      const confirmed = res.data?.status === 'confirmed';
      toast.success(
        confirmed
          ? 'Booked! Your reservation is confirmed.'
          : 'Booking request sent successfully!',
      );
      setShowBooking(false);
      // Highest-intent moment on the whole rentals side: they've committed to
      // a place and now need movers/cleaners. Swaps the cross-sell strip to
      // its post-booking copy rather than interrupting with a modal.
      setJustBooked(true);
    } catch (error) {
      toast.error(error.response?.data?.detail || 'Failed to create booking');
    }
  };

  const handleChat = () => {
    if (!user) {
      navigate(`/auth/login?redirect=${encodeURIComponent(`/property/${id}`)}`);
      return;
    }
    // Preserve the sublease_id so the chat talks to the sublessor (if this
    // visit came from a sublease card).
    const qs = sublease?.id ? `?sublease_id=${sublease.id}` : '';
    navigate(`/chat/${id}${qs}`);
  };

  const copyLongLink = () => {
    const url = `${window.location.origin}/property/${id}`;
    navigator.clipboard.writeText(url);
    setShareCopied(true);
    toast.success(t('property.linkCopied', 'Property link copied to clipboard!'));
    setTimeout(() => setShareCopied(false), 3000);
  };

  const handleShare = async () => {
    if (shareOpen) { setShareOpen(false); return; }
    if (token) {
      try {
        const { data } = await axios.post(
          `${API}/short-links`,
          { target_type: 'property', target_id: id },
          { headers: { Authorization: `Bearer ${token}` } },
        );
        setShortLink(data);
        setShareOpen(true);
        return;
      } catch {
        // 403: not their listing — fall through to the copy behaviour
        // every visitor gets.
      }
    }
    copyLongLink();
  };

  if (!property) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <p className="text-xl">{t('property.loading')}</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen" data-testid="property-detail-page">
      {/* Spacer below the fixed nav. Sizes match Navigation.js logo heights
          (mobile h-[110px], sm h-[140px], md h-[200px]) plus some padding so
          the back button row never gets covered by the nav. */}
      <div className="h-[130px] sm:h-[160px] md:h-[220px] bg-white"></div>
      
      <div className="max-w-7xl mx-auto px-4 md:px-6 pb-12 bg-white">
        <div className="flex items-center justify-between gap-2 mb-6">
          <div className="min-w-0 flex-1">
            <Breadcrumb current={property?.title || ''} testId="property-breadcrumb" />
            <button
              onClick={() => navigate(getBackDestination())}
              className="flex items-center gap-1.5 md:gap-2 text-xs md:text-sm font-medium hover:text-[var(--gold)] transition-colors min-w-0"
              data-testid="back-button"
            >
              <ArrowLeft size={16} className="md:w-[18px] md:h-[18px] shrink-0" />
              <span className="truncate">{getBackButtonText()}</span>
            </button>
          </div>
          <div className="relative shrink-0">
            <button
              onClick={handleShare}
              className="flex items-center gap-1.5 md:gap-2 px-2.5 md:px-4 py-1.5 md:py-2 rounded-lg border border-[var(--brand-primary)] text-[var(--brand-primary)] hover:bg-[rgb(var(--brand-primary-rgb)/<alpha-value>)]/10 transition-colors text-xs md:text-sm font-medium shrink-0"
              data-testid="share-button"
              aria-expanded={shareOpen}
            >
              {/* Owners get a QR here, so the button says so; everyone
                  else still just copies the link, and for them the plain
                  Share label is still the honest one. */}
              {shareCopied
                ? <Check size={14} className="md:w-4 md:h-4" />
                : (token ? <QrCode size={14} className="md:w-4 md:h-4" /> : <Share2 size={14} className="md:w-4 md:h-4" />)}
              <span>{shareCopied ? t('property.copied') : t('property.shareProperty')}</span>
            </button>
            {shareOpen && shortLink && (
              <div
                role="dialog"
                aria-label={t('qr.shareListing', 'Share this listing')}
                className="absolute z-30 mt-2 end-0 w-[min(320px,calc(100vw-2rem))] rounded-2xl border bg-white p-4 shadow-xl"
                style={{ borderColor: 'var(--brand-border)' }}
                data-testid="property-qr-panel"
              >
                <p className="text-sm font-bold mb-3" style={{ color: 'var(--ink)' }}>
                  {t('qr.shareListing', 'Share this listing')}
                </p>
                <QrShareCard
                  url={`${window.location.origin}${shortLink.path}`}
                  filename="myisraelrental-listing-qr"
                  testidPrefix="property-qr"
                />
                <p
                  className="mt-2 text-center text-xs font-semibold"
                  style={{ color: 'var(--brand-primary)' }}
                  data-testid="property-qr-scan-count"
                >
                  {shortLink.scan_count === 0
                    ? t('qr.scanned0', 'Not scanned yet')
                    : shortLink.scan_count === 1
                      ? t('qr.scanned1', 'Scanned once')
                      : t('qr.scannedN', 'Scanned {{n}} times', { n: shortLink.scan_count })}
                </p>
                <div className="mt-3">
                  <ScanChart daily={shortLink.daily} testidPrefix="property-qr" />
                </div>
                <div className="mt-3">
                  <ShareLinkButtons
                    url={`${window.location.origin}${shortLink.path}`}
                    testidPrefix="property-qr"
                  />
                </div>
              </div>
            )}
          </div>
        </div>
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          <div className="lg:col-span-2">
            <div className="mb-6">
              <ImageGallery
                media={[
                  ...(property.images || []).map((url) => ({ type: 'image', url })),
                  ...(property.videos || []).map((url) => ({ type: 'video', url })),
                ]}
                currentIndex={currentImageIndex}
                onIndexChange={setCurrentImageIndex}
                alt={property.title}
                apiBase={API}
                seed={property.id}
              />
            </div>

            <div className="flex items-center justify-between mb-4">
              <h1 className="text-4xl font-bold" style={{ fontFamily: 'var(--font-head)' }} data-testid="property-title">
                {property.title}
              </h1>
              <button
                onClick={toggleLike}
                className="flex items-center gap-2 px-4 py-2.5 rounded-xl border border-gray-200 hover:border-red-300 transition-all hover:shadow-md active:scale-95 shrink-0"
                data-testid="detail-like-btn"
              >
                <Heart
                  size={20}
                  className={`transition-colors ${isLiked ? 'fill-red-500 text-red-500' : 'text-gray-400'}`}
                />
                <span className={`text-sm font-medium ${isLiked ? 'text-red-500' : 'text-gray-500'}`}>
                  {isLiked ? t('property.saved') : t('property.save')}
                </span>
              </button>
            </div>

            <div className="flex items-center justify-between gap-4 mb-6">
              <div className="flex items-center gap-2 text-gray-600">
                <MapPin size={20} />
                <span className="text-lg">
                  {/* `area` is a DB value, localised through
                      utils/areaNames; the street address stays verbatim. */}
                  {[property.address, areaLabel(property.area, t)].filter(Boolean).join(', ')}
                </span>
              </div>
              {/* Vacation rentals show a Cleaning fee badge in the same
                  place where long/short-term rentals show the Agent fee.
                  Both are mutually exclusive — the form gates the toggles
                  by rental_type. */}
              {!sublease && property.rental_type === 'vacation' && property.has_cleaning_fee && property.cleaning_fee_price > 0 && (
                <div className="flex flex-col gap-1 px-3 py-1.5 bg-[rgb(var(--gold-rgb)/<alpha-value>)]/10 rounded-lg border border-[rgb(var(--gold-rgb)/<alpha-value>)]/30">
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-medium text-gray-700">{t('property.cleaningFeeLabel', 'Cleaning fee:')}</span>
                    <span className="text-sm font-bold" style={{ color: 'var(--gold-text-on-light)' }}>
                      {property.cleaning_fee_currency === 'USD' ? '$' : '₪'}{property.cleaning_fee_price.toLocaleString()}
                    </span>
                  </div>
                  {(() => {
                    const converted = convertPrice(property.cleaning_fee_price, property.cleaning_fee_currency);
                    if (!converted) return null;
                    return (
                      <div className="text-xs text-gray-500">
                        ≈ {converted.symbol}{converted.amount.toLocaleString()}
                      </div>
                    );
                  })()}
                </div>
              )}
              {!sublease && property.rental_type !== 'vacation' && property.has_agent_fee && property.agent_fee_price > 0 && (
                <div className="flex flex-col gap-1 px-3 py-1.5 bg-[rgb(var(--gold-rgb)/<alpha-value>)]/10 rounded-lg border border-[rgb(var(--gold-rgb)/<alpha-value>)]/30">
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-medium text-gray-700">{t('property.agentFeeLabel')}</span>
                    <span className="text-sm font-bold" style={{ color: 'var(--gold-text-on-light)' }}>
                      {property.agent_fee_currency === 'USD' ? '$' : '₪'}{property.agent_fee_price.toLocaleString()}
                    </span>
                  </div>
                  {(() => {
                    const converted = convertPrice(property.agent_fee_price, property.agent_fee_currency);
                    if (!converted) return null;
                    return (
                      <div className="text-xs text-gray-500">
                        ≈ {converted.symbol}{converted.amount.toLocaleString()}
                      </div>
                    );
                  })()}
                </div>
              )}
            </div>

            <PropertyStats property={property} />

            {/* Available From (non-long-term only) — long-term listings used to
                show a "Starting Date (Fixed)" card here, but renters don't need
                to see internal scheduling so it's hidden now. */}
            {property.rental_type !== 'long-term' && property.available_from && (
              <div className="bg-[rgb(var(--gold-rgb)/<alpha-value>)]/10 border border-[rgb(var(--gold-rgb)/<alpha-value>)]/30 p-4 rounded-xl mb-6">
                <div className="flex items-center gap-2 flex-wrap">
                  <CalendarIcon size={20} style={{ color: 'var(--gold)' }} />
                  <span className="font-medium text-gray-700">{t('property.availableFromLabel')}</span>
                  <span className="font-bold" style={{ color: 'var(--brand-primary)' }}>
                    {format(parseLocalDate(property.available_from), 'MMMM d, yyyy')}
                  </span>
                  {property.available_to && (
                    <>
                      <span className="text-gray-500">→</span>
                      <span className="font-medium text-gray-700">
                        {t('property.availableUntilLabel', 'Until')}
                      </span>
                      <span className="font-bold" style={{ color: 'var(--brand-primary)' }}>
                        {format(parseLocalDate(property.available_to), 'MMMM d, yyyy')}
                      </span>
                    </>
                  )}
                </div>
              </div>
            )}

            {/* Minimum Booking Length — hidden when viewing a sublease since
                the underlying property's minimum-stay rule doesn't apply to
                the sublessee's short-window booking. */}
            {!sublease && property.minimum_booking_days && (
              <div className="bg-gray-50 border border-gray-200 p-3 rounded-xl mb-6">
                <div className="flex items-center gap-2">
                  <CalendarIcon size={18} className="text-gray-600" />
                  <span className="text-sm font-medium text-gray-700">
                    {property.rental_type === 'vacation'
                      ? t('property.minimumStayVacation', 'Minimum Booking Length:')
                      : t('property.minimumStay')}
                  </span>
                  <span className="text-sm font-bold text-gray-900">
                    {property.rental_type === 'vacation' 
                      ? `${property.minimum_booking_days} ${property.minimum_booking_days === 1 ? t('property.day') : t('property.days')}`
                      : `${property.minimum_booking_days} ${property.minimum_booking_days === 1 ? t('property.month') : t('property.months')}`
                    }
                  </span>
                </div>
              </div>
            )}

            <div className="bg-white p-6 rounded-2xl border border-[#E5E5E5] mb-8">
              <h2 className="text-2xl font-bold mb-4" style={{ fontFamily: 'var(--font-head)' }}>{t('property.description')}</h2>
              <p className="text-gray-700 leading-relaxed">
                {property.description || t('property.noDescription', 'No description provided yet.')}
              </p>
            </div>

            <AmenitiesList amenities={property.amenities} />

            <div className="flex flex-wrap gap-3">
              {property.furniture_package && (
                <span className="px-4 py-2 rounded-full text-sm font-medium" style={{ backgroundColor: '#E5E5E5', color: 'var(--brand-primary)' }}>
                  {t('property.furniture')}
                </span>
              )}
            </div>
          </div>

          <div className="lg:col-span-1">
            <BookingSidebar
              property={property}
              sublease={sublease}
              preSubleaseId={preSubleaseId}
              bookingData={bookingData}
              setBookingData={setBookingData}
              dateRange={dateRange}
              setDateRange={setDateRange}
              showCalendar={showCalendar}
              setShowCalendar={setShowCalendar}
              calendarMonth={calendarMonth}
              setCalendarMonth={setCalendarMonth}
              blockedDates={blockedDates}
              convertPrice={convertPrice}
              onBook={handleBooking}
              onChat={handleChat}
            />
            {/* Cross-sell into the paid services side. Below the sidebar so
                it can never push the booking CTA off-screen. After a booking
                request it swaps to the higher-intent variant — that's the
                moment someone actually needs movers. */}
            <div className="mt-4">
              <MovingServicesCrossSell
                property={property}
                variant={justBooked ? 'booked' : 'detail'}
              />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default PropertyDetail;