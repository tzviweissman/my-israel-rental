import React, { useState, useEffect, useContext } from 'react';
import { useParams, useNavigate, useSearchParams } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import axios from 'axios';
import { API, AuthContext } from '../App';
import { MapPin, Calendar as CalendarIcon, Heart, Share2, Check } from 'lucide-react';
import { format } from 'date-fns';
import { toast } from 'sonner';

import { ArrowLeft } from 'lucide-react';

import ImageGallery from '../components/property/ImageGallery';
import PropertyStats from '../components/property/PropertyStats';
import AmenitiesList from '../components/property/AmenitiesList';
import BookingSidebar from '../components/property/BookingSidebar';

// Parse 'YYYY-MM-DD' as a LOCAL date (avoids the UTC-shift bug where
// selecting June 2 displays as June 1 in timezones east of UTC).
const parseLocalDate = (dateStr) => {
  if (!dateStr) return undefined;
  const [y, m, d] = String(dateStr).split('T')[0].split('-').map(Number);
  if (!y || !m || !d) return undefined;
  return new Date(y, m - 1, d);
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
  const [exchangeRate, setExchangeRate] = useState(null);
  const [blockedDates, setBlockedDates] = useState([]);
  const [isLiked, setIsLiked] = useState(false);
  const [shareCopied, setShareCopied] = useState(false);
  
  // Determine where user came from
  const previousPath = sessionStorage.getItem('previousPath') || '/';
  const isFromDashboard = previousPath.includes('/dashboard');
  const isFromManager = previousPath.includes('/manager/');
  const isFromListings = previousPath.includes('/properties/');
  
  // Determine back button destination and text
  const getBackDestination = () => {
    if (isFromDashboard) return '/dashboard';
    if (isFromManager) return previousPath;
    if (isFromListings) return previousPath; // Return to the specific listings page
    return '/properties/all'; // Default to all properties listings instead of home
  };
  
  const getBackButtonText = () => {
    if (isFromDashboard) return t('property.backToDashboard');
    return t('property.backToListings');
  };

  useEffect(() => {
    axios.get(`${API}/exchange-rate`)
      .then(res => setExchangeRate(res.data))
      .catch(() => setExchangeRate({ usd_to_ils: 3.65, ils_to_usd: 0.274 }));
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
    try {
      const response = await axios.get(`${API}/properties/${id}`);
      setProperty(response.data);

      // Fetch blocked dates
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
      console.error('Failed to fetch property', error);
      toast.error('Property not found');
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

  const handleShare = () => {
    const url = `${window.location.origin}/property/${id}`;
    navigator.clipboard.writeText(url);
    setShareCopied(true);
    toast.success('Property link copied to clipboard!');
    setTimeout(() => setShareCopied(false), 3000);
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
          <button
            onClick={() => navigate(getBackDestination())}
            className="flex items-center gap-1.5 md:gap-2 text-xs md:text-sm font-medium hover:text-[#D4AF37] transition-colors min-w-0"
            data-testid="back-button"
          >
            <ArrowLeft size={16} className="md:w-[18px] md:h-[18px] shrink-0" />
            <span className="truncate">{getBackButtonText()}</span>
          </button>
          <button
            onClick={handleShare}
            className="flex items-center gap-1.5 md:gap-2 px-2.5 md:px-4 py-1.5 md:py-2 rounded-lg border border-[#1E6A6A] text-[#1E6A6A] hover:bg-[#1E6A6A]/10 transition-colors text-xs md:text-sm font-medium shrink-0"
            data-testid="share-button"
          >
            {shareCopied ? <Check size={14} className="md:w-4 md:h-4" /> : <Share2 size={14} className="md:w-4 md:h-4" />}
            <span>{shareCopied ? t('property.copied') : t('property.shareProperty')}</span>
          </button>
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
              />
            </div>

            <div className="flex items-center justify-between mb-4">
              <h1 className="text-4xl font-bold" style={{ fontFamily: 'Playfair Display' }} data-testid="property-title">
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
                <span className="text-lg">{property.address}, {property.area}</span>
              </div>
              {/* Vacation rentals show a Cleaning fee badge in the same
                  place where long/short-term rentals show the Agent fee.
                  Both are mutually exclusive — the form gates the toggles
                  by rental_type. */}
              {!sublease && property.rental_type === 'vacation' && property.has_cleaning_fee && property.cleaning_fee_price && (
                <div className="flex flex-col gap-1 px-3 py-1.5 bg-[#D4AF37]/10 rounded-lg border border-[#D4AF37]/30">
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-medium text-gray-700">{t('property.cleaningFeeLabel', 'Cleaning fee:')}</span>
                    <span className="text-sm font-bold" style={{ color: '#D4AF37' }}>
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
              {!sublease && property.rental_type !== 'vacation' && property.has_agent_fee && property.agent_fee_price && (
                <div className="flex flex-col gap-1 px-3 py-1.5 bg-[#D4AF37]/10 rounded-lg border border-[#D4AF37]/30">
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-medium text-gray-700">{t('property.agentFeeLabel')}</span>
                    <span className="text-sm font-bold" style={{ color: '#D4AF37' }}>
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
              <div className="bg-[#D4AF37]/10 border border-[#D4AF37]/30 p-4 rounded-xl mb-6">
                <div className="flex items-center gap-2">
                  <CalendarIcon size={20} style={{ color: '#D4AF37' }} />
                  <span className="font-medium text-gray-700">{t('property.availableFromLabel')}</span>
                  <span className="font-bold" style={{ color: '#1E6A6A' }}>
                    {format(parseLocalDate(property.available_from), 'MMMM d, yyyy')}
                  </span>
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
              <h2 className="text-2xl font-bold mb-4" style={{ fontFamily: 'Playfair Display' }}>{t('property.description')}</h2>
              <p className="text-gray-700 leading-relaxed">{property.description}</p>
            </div>

            <AmenitiesList amenities={property.amenities} />

            <div className="flex flex-wrap gap-3">
              {property.furniture_package && (
                <span className="px-4 py-2 rounded-full text-sm font-medium" style={{ backgroundColor: '#E5E5E5', color: '#1E6A6A' }}>
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
          </div>
        </div>
      </div>
    </div>
  );
};

export default PropertyDetail;