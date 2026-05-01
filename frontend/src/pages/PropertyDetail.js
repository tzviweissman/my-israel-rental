import React, { useState, useEffect, useContext } from 'react';
import { useParams, useNavigate, useSearchParams } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import axios from 'axios';
import { API, AuthContext } from '../App';
import { Bed, Bath, Home as HomeIcon, MapPin, Building2, MessageCircle, Calendar as CalendarIcon, ChevronLeft, ChevronRight, Film, Snowflake, WashingMachine, UtensilsCrossed, DoorOpen, ArrowUpFromLine, ShowerHead, Warehouse, Flame, Dumbbell, Waves, Sparkles, Car, Wifi, Mail, Users, X, Heart, Share2, Copy, Check, Play } from 'lucide-react';
import { Calendar } from '../components/ui/calendar';
import { format } from 'date-fns';
import { toast } from 'sonner';

import { ArrowLeft } from 'lucide-react';

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
  const videoRefs = React.useRef({});
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
  const [propertyContract, setPropertyContract] = useState(null);
  const [showSignatureModal, setShowSignatureModal] = useState(false);
  const [signatureData, setSignatureData] = useState(null);
  const [isDrawing, setIsDrawing] = useState(false);
  const signatureCanvasRef = React.useRef(null);
  
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
    if (isFromDashboard) return 'Back to Dashboard';
    return 'Back to Listings';
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
      
      // Fetch contract if property is long-term or short-term
      if (response.data.rental_type === 'long-term' || response.data.rental_type === 'short-term') {
        try {
          const contractRes = await axios.get(`${API}/properties/${id}/contract`);
          setPropertyContract(contractRes.data);
        } catch (err) {
          setPropertyContract(null);
        }
      }
      
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
      await axios.post(`${API}/bookings`, {
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
      toast.success('Booking request sent successfully!');
      setShowBooking(false);
      setSignatureData(null);
      setShowSignatureModal(false);
    } catch (error) {
      toast.error(error.response?.data?.detail || 'Failed to create booking');
    }
  };

  // Signature canvas handlers
  const startDrawing = (e) => {
    const canvas = signatureCanvasRef.current;
    const rect = canvas.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;
    const ctx = canvas.getContext('2d');
    ctx.beginPath();
    ctx.moveTo(x, y);
    setIsDrawing(true);
  };

  const draw = (e) => {
    if (!isDrawing) return;
    const canvas = signatureCanvasRef.current;
    const rect = canvas.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;
    const ctx = canvas.getContext('2d');
    ctx.lineTo(x, y);
    ctx.stroke();
  };

  const stopDrawing = () => {
    setIsDrawing(false);
  };

  const clearSignature = () => {
    const canvas = signatureCanvasRef.current;
    const ctx = canvas.getContext('2d');
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    setSignatureData(null);
  };

  const saveSignature = () => {
    const canvas = signatureCanvasRef.current;
    const dataUrl = canvas.toDataURL('image/png');
    setSignatureData(dataUrl);
    setShowSignatureModal(false);
    handleBooking(); // Proceed with booking after signature
  };

  const handleSignatureImageUpload = (e) => {
    const file = e.target.files[0];
    if (!file) return;
    
    const reader = new FileReader();
    reader.onloadend = () => {
      setSignatureData(reader.result);
      setShowSignatureModal(false);
      handleBooking(); // Proceed with booking after signature
    };
    reader.readAsDataURL(file);
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
        <p className="text-xl">Loading...</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen" data-testid="property-detail-page">
      {/* White spacing area between nav bar and content - ALL DEVICES */}
      <div className="h-[90px] bg-white"></div>
      
      <div className="max-w-7xl mx-auto px-6 pb-12 bg-white">
        <div className="flex items-center justify-between mb-6">
          <button onClick={() => navigate(getBackDestination())} className="flex items-center gap-2 text-sm font-medium hover:text-[#D4AF37] transition-colors" data-testid="back-button">
            <ArrowLeft size={18} />
            {getBackButtonText()}
          </button>
          <button 
            onClick={handleShare}
            className="flex items-center gap-2 px-4 py-2 rounded-lg border border-[#1E6A6A] text-[#1E6A6A] hover:bg-[#1E6A6A]/10 transition-colors text-sm font-medium"
            data-testid="share-button"
          >
            {shareCopied ? <Check size={16} /> : <Share2 size={16} />}
            {shareCopied ? 'Copied!' : 'Share Property'}
          </button>
        </div>
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          <div className="lg:col-span-2">
            <div className="mb-6">
              {(() => {
                const media = [
                  ...(property.images || []).map(url => ({ type: 'image', url })),
                  ...(property.videos || []).map(url => ({ type: 'video', url })),
                ];
                const toSrc = (url) => (url.startsWith('/api') ? `${API.replace('/api', '')}${url}` : url);
                const goTo = (newIdx) => {
                  // Pause any video that was playing before navigating
                  Object.values(videoRefs.current).forEach(v => { try { v && v.pause(); } catch (_) {} });
                  setCurrentImageIndex(newIdx);
                };
                if (media.length === 0) {
                  return (
                    <div
                      className="w-full h-96 rounded-2xl"
                      style={{
                        backgroundImage: 'url(https://images.pexels.com/photos/1669799/pexels-photo-1669799.jpeg?auto=compress&cs=tinysrgb&dpr=2&h=650&w=940)',
                        backgroundSize: 'cover',
                        backgroundPosition: 'center'
                      }}
                    ></div>
                  );
                }
                return (
                  <div className="relative" data-testid="image-gallery">
                    <div className="overflow-hidden rounded-2xl bg-black">
                      <div
                        className="flex transition-transform duration-500 ease-in-out"
                        style={{ transform: `translateX(-${currentImageIndex * 100}%)` }}
                      >
                        {media.map((m, idx) => (
                          m.type === 'image' ? (
                            <img
                              key={m.url}
                              src={toSrc(m.url)}
                              alt={`${property.title} - ${idx + 1}`}
                              className="w-full h-96 object-cover flex-shrink-0"
                              data-testid={idx === currentImageIndex ? 'gallery-main-image' : undefined}
                            />
                          ) : (
                            <video
                              key={m.url}
                              ref={el => { videoRefs.current[idx] = el; }}
                              src={toSrc(m.url)}
                              controls
                              playsInline
                              preload="metadata"
                              className="w-full h-96 object-contain flex-shrink-0 bg-black"
                              data-testid={`gallery-video-${idx}`}
                            />
                          )
                        ))}
                      </div>
                    </div>
                    {media.length > 1 && (
                      <>
                        <button
                          onClick={() => goTo(currentImageIndex === 0 ? media.length - 1 : currentImageIndex - 1)}
                          className="absolute left-3 top-1/2 -translate-y-1/2 bg-black/60 text-white p-2 rounded-full hover:bg-black/80 transition-colors z-10"
                          data-testid="gallery-prev"
                        >
                          <ChevronLeft size={20} />
                        </button>
                        <button
                          onClick={() => goTo(currentImageIndex === media.length - 1 ? 0 : currentImageIndex + 1)}
                          className="absolute right-3 top-1/2 -translate-y-1/2 bg-black/60 text-white p-2 rounded-full hover:bg-black/80 transition-colors z-10"
                          data-testid="gallery-next"
                        >
                          <ChevronRight size={20} />
                        </button>
                        <div className="absolute bottom-3 left-1/2 -translate-x-1/2 bg-black/60 text-white text-xs px-3 py-1 rounded-full pointer-events-none">
                          {currentImageIndex + 1} / {media.length}
                          {media[currentImageIndex]?.type === 'video' && (
                            <span className="ml-2 inline-flex items-center gap-1"><Film size={11} /> video</span>
                          )}
                        </div>
                      </>
                    )}
                    {media.length > 1 && (
                      <div className="flex gap-2 mt-3 overflow-x-auto pb-2" data-testid="gallery-thumbnails">
                        {media.map((m, idx) => (
                          <div
                            key={`thumb-${m.url}`}
                            onClick={() => goTo(idx)}
                            className={`relative w-20 h-14 rounded-lg cursor-pointer flex-shrink-0 transition-all overflow-hidden ${idx === currentImageIndex ? 'ring-2 ring-black opacity-100' : 'opacity-60 hover:opacity-100'}`}
                            data-testid={`gallery-thumb-${idx}`}
                          >
                            {m.type === 'image' ? (
                              <img
                                src={toSrc(m.url)}
                                alt={`Thumb ${idx + 1}`}
                                className="w-full h-full object-cover"
                              />
                            ) : (
                              <>
                                <video
                                  src={toSrc(m.url)}
                                  preload="metadata"
                                  muted
                                  className="w-full h-full object-cover bg-black"
                                />
                                <div className="absolute inset-0 flex items-center justify-center bg-black/30 pointer-events-none">
                                  <Play size={18} className="text-white drop-shadow" fill="white" />
                                </div>
                              </>
                            )}
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                );
              })()}
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
                  {isLiked ? 'Saved' : 'Save'}
                </span>
              </button>
            </div>

            <div className="flex items-center justify-between gap-4 mb-6">
              <div className="flex items-center gap-2 text-gray-600">
                <MapPin size={20} />
                <span className="text-lg">{property.address}, {property.area}</span>
              </div>
              {/* Agent fee is a long-term-rental concept; suppress on
                  sublease views since it doesn't apply to sublessees. */}
              {!sublease && property.has_agent_fee && property.agent_fee_price && (
                <div className="flex flex-col gap-1 px-3 py-1.5 bg-[#D4AF37]/10 rounded-lg border border-[#D4AF37]/30">
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-medium text-gray-700">Agent Fee:</span>
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

            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
              {property.bedrooms && (
                <div className="bg-white p-4 rounded-xl border border-[#E5E5E5]">
                  <div className="flex items-center gap-2 mb-1">
                    <Bed size={20} style={{ color: "#D4AF37" }} />
                    <span className="text-sm text-gray-600">{t('property.bedrooms')}</span>
                  </div>
                  <p className="text-2xl font-bold">{property.bedrooms}</p>
                </div>
              )}
              {property.bathrooms && (
                <div className="bg-white p-4 rounded-xl border border-[#E5E5E5]">
                  <div className="flex items-center gap-2 mb-1">
                    <Bath size={20} style={{ color: "#D4AF37" }} />
                    <span className="text-sm text-gray-600">{t('property.bathrooms')}</span>
                  </div>
                  <p className="text-2xl font-bold">{property.bathrooms}</p>
                </div>
              )}
              {property.square_meters && (
                <div className="bg-white p-4 rounded-xl border border-[#E5E5E5]">
                  <div className="flex items-center gap-2 mb-1">
                    <HomeIcon size={20} style={{ color: "#D4AF37" }} />
                    <span className="text-sm text-gray-600">{t('property.sqm')}</span>
                  </div>
                  <p className="text-2xl font-bold">{property.square_meters}</p>
                </div>
              )}
              {property.floor !== null && (
                <div className="bg-white p-4 rounded-xl border border-[#E5E5E5]">
                  <div className="flex items-center gap-2 mb-1">
                    <Building2 size={20} style={{ color: "#D4AF37" }} />
                    <span className="text-sm text-gray-600">{t('property.floor')}</span>
                  </div>
                  <p className="text-2xl font-bold">{property.floor}</p>
                  {property.has_elevator && <p className="text-xs mt-1 font-semibold text-gray-600">{t('property.elevator')}{property.is_shabbat_elevator ? ` (${t('property.shabbatElevator')})` : ''}</p>}
                </div>
              )}
              {property.porches > 0 && (
                <div className="bg-white p-4 rounded-xl border border-[#E5E5E5]">
                  <div className="flex items-center gap-2 mb-1">
                    <HomeIcon size={20} style={{ color: "#D4AF37" }} />
                    <span className="text-sm text-gray-600">{property.porches === 1 ? t('property.porch') : t('property.porches')}</span>
                  </div>
                  <p className="text-2xl font-bold">{property.porches}{property.porch_square_meters ? <span className="text-sm font-normal text-gray-500 ml-1">({property.porch_square_meters} sqm)</span> : ''}</p>
                  {property.sukkah_compatible && <p className="text-xs mt-1" style={{ color: '#345C45', fontWeight: 600 }}>{t('property.sukkah')}</p>}
                </div>
              )}
            </div>

            {/* Available From (non-long-term only) — long-term listings used to
                show a "Starting Date (Fixed)" card here, but renters don't need
                to see internal scheduling so it's hidden now. */}
            {property.rental_type !== 'long-term' && property.available_from && (
              <div className="bg-[#D4AF37]/10 border border-[#D4AF37]/30 p-4 rounded-xl mb-6">
                <div className="flex items-center gap-2">
                  <CalendarIcon size={20} style={{ color: '#D4AF37' }} />
                  <span className="font-medium text-gray-700">Available from:</span>
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
                  <span className="text-sm font-medium text-gray-700">Minimum Stay:</span>
                  <span className="text-sm font-bold text-gray-900">
                    {property.rental_type === 'vacation' 
                      ? `${property.minimum_booking_days} ${property.minimum_booking_days === 1 ? 'day' : 'days'}`
                      : `${property.minimum_booking_days} ${property.minimum_booking_days === 1 ? 'month' : 'months'}`
                    }
                  </span>
                </div>
              </div>
            )}

            <div className="bg-white p-6 rounded-2xl border border-[#E5E5E5] mb-8">
              <h2 className="text-2xl font-bold mb-4" style={{ fontFamily: 'Playfair Display' }}>{t('property.description')}</h2>
              <p className="text-gray-700 leading-relaxed">{property.description}</p>
            </div>

            {property.amenities && property.amenities.length > 0 && (
              <div className="bg-white p-6 rounded-2xl border border-[#E5E5E5] mb-8">
                <h2 className="text-2xl font-bold mb-4" style={{ fontFamily: 'Playfair Display' }}>{t('property.amenities')}</h2>
                <div className="grid grid-cols-2 gap-3">
                  {property.amenities.map((amenity) => {
                    const iconMap = {
                      'Central AC / Heating': Snowflake,
                      'In-unit washer and dryer': WashingMachine,
                      'Dishwasher': UtensilsCrossed,
                      'Walk in Closets': DoorOpen,
                      'High Ceilings': ArrowUpFromLine,
                      'Ensuite Bathroom': ShowerHead,
                      'Storage Space': Warehouse,
                      'Heated Floors': Flame,
                      'Gym / Fitness center': Dumbbell,
                      'Swimming pool (indoor or outdoor)': Waves,
                      'Hot tub / Spa': Sparkles,
                      'On-site parking (garage or lot)': Car,
                      'Wi-Fi included': Wifi,
                    };
                    const Icon = iconMap[amenity] || HomeIcon;
                    return (
                      <div key={amenity} className="flex items-center gap-2">
                        <Icon size={16} style={{ color: "#D4AF37" }} />
                        <span>{amenity}</span>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

            <div className="flex flex-wrap gap-3">
              {property.furniture_package && (
                <span className="px-4 py-2 rounded-full text-sm font-medium" style={{ backgroundColor: '#E5E5E5', color: '#1E6A6A' }}>
                  {t('property.furniture')}
                </span>
              )}
            </div>
          </div>

          <div className="lg:col-span-1">
            <div className="bg-white p-4 rounded-2xl border border-[#E5E5E5] sticky top-20 max-h-[calc(100vh-100px)] overflow-y-auto">
              <div className="mb-3">
                {sublease ? (
                  <>
                    <span className="text-3xl font-bold" style={{ color: '#D4AF37' }} data-testid="property-detail-price">
                      {sublease.currency === 'USD' ? '$' : '₪'}
                      {(sublease.price || 0).toLocaleString()}
                    </span>
                    <span className="text-base text-gray-600">
                      {sublease.price_type === 'per_night' ? t('property.perNight') : ' total'}
                    </span>
                    {(() => {
                      const converted = convertPrice(sublease.price, sublease.currency);
                      if (!converted) return null;
                      return (
                        <div className="text-xs text-gray-400 mt-1" data-testid="property-detail-converted-price">
                          ≈ {converted.symbol}
                          {converted.amount.toLocaleString()}
                          {sublease.price_type === 'per_night' ? t('property.perNight') : ' total'}
                        </div>
                      );
                    })()}
                  </>
                ) : preSubleaseId ? (
                  // URL has ?sublease_id= but the sublease fetch is still in
                  // flight. Render a tiny skeleton instead of flashing the
                  // underlying property's price for a frame.
                  <div
                    className="h-10 w-40 rounded-md bg-gray-100 animate-pulse"
                    data-testid="property-detail-price-loading"
                  />
                ) : (
                  <>
                    <span className="text-3xl font-bold" style={{ color: "#D4AF37" }} data-testid="property-detail-price">
                      {property.currency === 'USD' ? '$' : '₪'}{(property.monthly_price || property.nightly_price || 0).toLocaleString()}
                    </span>
                    <span className="text-base text-gray-600">
                      {property.rental_type === 'vacation' ? t('property.perNight') : t('property.perMonth')}
                    </span>
                    {(() => {
                      const converted = convertPrice(property.monthly_price || property.nightly_price, property.currency);
                      if (!converted) return null;
                      return (
                        <div className="text-xs text-gray-400 mt-1" data-testid="property-detail-converted-price">
                          ≈ {converted.symbol}{converted.amount.toLocaleString()}{property.rental_type === 'vacation' ? t('property.perNight') : t('property.perMonth')}
                        </div>
                      );
                    })()}
                  </>
                )}
              </div>

              {/* Booking Form - Always Visible */}
              <div className="space-y-2.5" data-testid="booking-form">
                  {/* When viewing a sublease, ignore long-term locked-date UX
                      since the sublease is a short-window booking even when
                      the underlying property is long-term. */}
                  {(() => null)()}
                  <div>
                    <label className="block text-sm font-medium mb-1.5">{t('property.checkIn')} & {t('property.checkOut')}</label>
                    <div className="grid grid-cols-2 gap-2">
                      <button
                        type="button"
                        onClick={() => {
                          if (sublease || property.rental_type !== 'long-term') {
                            // If a complete range is set, clear both on
                            // calendar-open so the next two clicks pick a
                            // brand-new range cleanly. (react-day-picker's
                            // mode="range" otherwise no-ops or shrinks the
                            // existing range when clicking inside it.)
                            if (dateRange?.from && dateRange?.to) {
                              setDateRange({ from: undefined, to: undefined });
                              setBookingData((prev) => ({
                                ...prev,
                                start_date: '',
                                end_date: '',
                              }));
                            }
                            setShowCalendar(showCalendar === 'range' ? null : 'range');
                          }
                        }}
                        className={`flex items-center gap-2 px-3 py-2.5 rounded-lg border text-sm text-left transition-colors ${
                          !sublease && property.rental_type === 'long-term' 
                            ? 'border-gray-200 bg-gray-50 cursor-not-allowed' 
                            : 'border-[#E5E5E5] hover:border-black/30'
                        }`}
                        data-testid="booking-start-date"
                        disabled={!sublease && property.rental_type === 'long-term'}
                      >
                        <CalendarIcon size={14} className="text-gray-400 flex-shrink-0" />
                        <span className={dateRange.from ? 'text-black' : 'text-gray-400'}>
                          {dateRange.from ? format(dateRange.from, 'MMM d, yyyy') : t('property.checkIn')}
                        </span>
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          // Same reset-on-open as check-in pill so clicking
                          // here also restarts the range cleanly when needed.
                          if (dateRange?.from && dateRange?.to) {
                            setDateRange({ from: undefined, to: undefined });
                            setBookingData((prev) => ({
                              ...prev,
                              start_date: '',
                              end_date: '',
                            }));
                          }
                          setShowCalendar(showCalendar === 'range' ? null : 'range');
                        }}
                        className="flex items-center gap-2 px-3 py-2.5 rounded-lg border border-[#E5E5E5] text-sm text-left hover:border-black/30 transition-colors"
                        data-testid="booking-end-date"
                      >
                        <CalendarIcon size={14} className="text-gray-400 flex-shrink-0" />
                        <span className={dateRange.to ? 'text-black' : 'text-gray-400'}>
                          {dateRange.to ? format(dateRange.to, 'MMM d, yyyy') : t('property.checkOut')}
                        </span>
                      </button>
                    </div>
                    
                    {/* Quick Select Buttons for Longer Stays — hidden for subleases (short-window). */}
                    {!sublease && (
                    <div className="mt-3">
                      <p className="text-xs text-gray-500 mb-2">Quick select:</p>
                      <div className="flex gap-2 flex-wrap">
                        <button
                          type="button"
                          onClick={() => {
                            // For long-term rentals with a fixed starting date, anchor the
                            // +1 year range to that date. Otherwise, start tomorrow.
                            const from = (property.rental_type === 'long-term' && property.starting_date)
                              ? parseLocalDate(property.starting_date)
                              : (() => { const d = new Date(); d.setDate(d.getDate() + 1); return d; })();
                            const to = new Date(from);
                            to.setFullYear(to.getFullYear() + 1); // +1 year
                            setDateRange({ from, to });
                            setBookingData(prev => ({
                              ...prev,
                              start_date: format(from, 'yyyy-MM-dd'),
                              end_date: format(to, 'yyyy-MM-dd')
                            }));
                          }}
                          className="px-3 py-1.5 rounded-lg border border-[#1E6A6A] text-[#1E6A6A] hover:bg-[#1E6A6A] hover:text-white text-xs font-medium transition-colors"
                        >
                          + 1 Year
                        </button>
                        <button
                          type="button"
                          onClick={() => {
                            // For long-term rentals with fixed starting date, only clear checkout
                            if (property.rental_type === 'long-term' && property.starting_date) {
                              setDateRange({ 
                                from: dateRange.from, // Keep the fixed starting date
                                to: undefined 
                              });
                              setBookingData(prev => ({
                                ...prev,
                                end_date: '' // Only clear end date
                              }));
                            } else {
                              // For other rentals, clear both dates
                              setDateRange({ from: undefined, to: undefined });
                              setBookingData(prev => ({
                                ...prev,
                                start_date: '',
                                end_date: ''
                              }));
                            }
                          }}
                          className="px-3 py-1.5 rounded-lg border border-gray-300 text-gray-600 hover:bg-gray-50 text-xs font-medium transition-colors"
                        >
                          Clear
                        </button>
                      </div>
                    </div>
                    )}
                    
                    {showCalendar === 'range' && (
                      <div className="mt-2 bg-white rounded-xl border-2 border-[#1E6A6A] shadow-2xl p-4 relative z-[100] w-[320px]" data-testid="booking-calendar" style={{ pointerEvents: 'auto' }}>
                        <button
                          onClick={() => setShowCalendar(null)}
                          className="absolute top-2 right-2 p-1 rounded-full hover:bg-gray-100 z-[110]"
                        >
                          <X size={14} />
                        </button>
                        <Calendar
                          mode="range"
                          selected={dateRange}
                          month={calendarMonth}
                          onMonthChange={setCalendarMonth}
                          onSelect={(range) => {
                            // If the user already had a complete range and is
                            // now clicking ANY single date, treat it as a
                            // fresh restart. react-day-picker's default for
                            // mode="range" shrinks the range when the click
                            // falls inside it (e.g. clicking May 3 inside
                            // May 1 → Jun 1 yields {May 1, May 3}, which is
                            // confusing UX). The clicked date becomes the
                            // new check-in; check-out clears so the user
                            // picks it next.
                            const hadCompleteRange =
                              dateRange?.from && dateRange?.to;
                            if (hadCompleteRange) {
                              // Identify the clicked date — react-day-picker
                              // gives us {from, to}: if `from` shifted, that's
                              // the new click; otherwise `to` was the click.
                              const clicked =
                                range?.from && range.from.getTime() !== dateRange.from.getTime()
                                  ? range.from
                                  : range?.to ?? null;
                              if (clicked) {
                                setDateRange({ from: clicked, to: undefined });
                                setBookingData((prev) => ({
                                  ...prev,
                                  start_date: format(clicked, 'yyyy-MM-dd'),
                                  end_date: '',
                                }));
                              } else {
                                // user clicked the existing `from` — reset
                                setDateRange({ from: undefined, to: undefined });
                                setBookingData((prev) => ({
                                  ...prev,
                                  start_date: '',
                                  end_date: '',
                                }));
                              }
                              return;
                            }

                            // Handle minimum booking days/months
                            if (range?.from && !range?.to && property.minimum_booking_days) {
                              const minValue = parseInt(property.minimum_booking_days);
                              const minCheckout = new Date(range.from);
                              
                              // For vacation: add days, for others: add months
                              if (property.rental_type === 'vacation') {
                                minCheckout.setDate(minCheckout.getDate() + minValue);
                              } else {
                                minCheckout.setMonth(minCheckout.getMonth() + minValue);
                              }
                              
                              // Auto-set minimum checkout
                              const updatedRange = { from: range.from, to: minCheckout };
                              setDateRange(updatedRange);
                              setBookingData(prev => ({
                                ...prev,
                                start_date: format(range.from, 'yyyy-MM-dd'),
                                end_date: format(minCheckout, 'yyyy-MM-dd')
                              }));
                              setShowCalendar(null);
                            } else {
                              setDateRange(range || { from: undefined, to: undefined });
                              if (range?.from) setBookingData(prev => ({ ...prev, start_date: format(range.from, 'yyyy-MM-dd') }));
                              if (range?.to) {
                                setBookingData(prev => ({ ...prev, end_date: format(range.to, 'yyyy-MM-dd') }));
                                setShowCalendar(null);
                              }
                            }
                          }}
                          defaultMonth={(() => {
                            // Smart calendar navigation: jump to minimum checkout month
                            if (property.rental_type === 'long-term' && property.starting_date && property.minimum_booking_days) {
                              const startDate = parseLocalDate(property.starting_date);
                              const minCheckout = new Date(startDate);
                              minCheckout.setMonth(minCheckout.getMonth() + parseInt(property.minimum_booking_days));
                              return minCheckout;
                            } else if (dateRange?.from) {
                              return dateRange.from;
                            }
                            return new Date();
                          })()}
                          numberOfMonths={1}
                          disabled={(() => {
                            // Sublease view: restrict the picker entirely to
                            // the sublease window and ignore the underlying
                            // property's blocked-dates (one of which IS the
                            // sublessor's own booking that this sublease was
                            // carved out of — visitors should be free to
                            // pick within the sublease's advertised window).
                            if (sublease && sublease.available_from && sublease.available_to) {
                              const winFrom = parseLocalDate(sublease.available_from);
                              const winTo = parseLocalDate(sublease.available_to);
                              return [{ before: winFrom }, { after: winTo }];
                            }
                            return [
                              { before: new Date() },
                              ...(() => {
                                if (property.rental_type === 'long-term' && property.starting_date) {
                                  const startDate = parseLocalDate(property.starting_date);
                                  if (property.minimum_booking_days) {
                                    const minCheckout = new Date(startDate);
                                    minCheckout.setMonth(minCheckout.getMonth() + parseInt(property.minimum_booking_days));
                                    return [{ before: minCheckout }];
                                  }
                                  return [{ before: startDate }];
                                }
                                if (property.available_from) {
                                  return [{ before: parseLocalDate(property.available_from) }];
                                }
                                return [];
                              })(),
                              ...blockedDates.map(d => new Date(d))
                            ];
                          })()}
                          className="rounded-xl"
                          style={{ pointerEvents: 'auto' }}
                          classNames={{
                            months: "flex flex-col w-[280px]",
                            month: "space-y-3 w-[280px]",
                            caption: "flex justify-center pt-1 relative items-center h-8 w-[280px]",
                            caption_label: "text-sm font-bold w-[150px] text-center",
                            nav: "space-x-1 flex items-center",
                            nav_button: "h-7 w-7 bg-transparent p-0 opacity-50 hover:opacity-100 inline-flex items-center justify-center rounded-md border border-[#E5E5E5]",
                            nav_button_previous: "absolute left-1",
                            nav_button_next: "absolute right-1",
                            table: "w-[280px] border-collapse",
                            head_row: "flex w-[280px]",
                            head_cell: "text-gray-500 rounded-md w-10 font-medium text-[0.75rem] uppercase flex-shrink-0",
                            row: "flex w-[280px] mt-1",
                            cell: "relative p-0 text-center text-sm w-10 flex-shrink-0",
                            day: "h-10 w-10 p-0 font-bold rounded-full hover:bg-[#1E6A6A] hover:text-white inline-flex items-center justify-center text-gray-900 transition-all text-base",
                            day_range_start: "day-range-start !bg-black !text-white rounded-full hover:!bg-black",
                            day_range_end: "day-range-end !bg-black !text-white rounded-full hover:!bg-black",
                            day_selected: "!bg-black !text-white hover:!bg-black focus:!bg-black",
                            day_today: "font-bold text-[#D4AF37] border-2 border-[#D4AF37]",
                            day_outside: "text-gray-300 opacity-50",
                            day_disabled: "text-gray-200 opacity-30 line-through",
                            day_range_middle: "aria-selected:bg-black/10 aria-selected:text-black",
                            day_hidden: "invisible",
                          }}
                        />
                        {dateRange.from && dateRange.to && (
                          <div className="px-3 pb-2 pt-1 text-center">
                            <span className="text-xs text-gray-500">
                              {Math.ceil((dateRange.to - dateRange.from) / (1000 * 60 * 60 * 24))} {t('property.nights')}
                            </span>
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                  
                  {/* Contact Actions - Above Reserve Booking */}
                  <div className="space-y-2">
                    {property.owner_email && (
                      <a
                        href={`mailto:${property.owner_email}?subject=${encodeURIComponent(t('property.emailSubject') + ': ' + property.title)}`}
                        className="w-full flex items-center justify-center gap-2 px-6 py-2.5 rounded-full text-sm font-medium border-2 transition-colors"
                        style={{ borderColor: '#D4AF37', color: '#D4AF37' }}
                        data-testid="email-owner-button"
                      >
                        <Mail size={18} />
                        {t('property.emailOwner')}
                      </a>
                    )}
                    <button onClick={handleChat} className="w-full secondary-btn flex items-center justify-center gap-2 py-2.5" data-testid="message-owner-button">
                      <MessageCircle size={18} />
                      {t('property.messageOwner')}
                    </button>
                  </div>
                  
                  <button onClick={handleBooking} className="w-full primary-btn py-2.5" data-testid="confirm-booking-button">
                    Reserve Booking
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>

      {/* Signature Modal */}
      {showSignatureModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-6">
          <div className="bg-white rounded-2xl p-8 max-w-2xl w-full">
            <h2 className="text-2xl font-bold mb-4">Sign Contract</h2>
            <p className="text-sm text-gray-600 mb-4">
              This property requires a signed contract. Please sign below or upload your signature.
            </p>
            
            {propertyContract?.contract_url && (
              <a
                href={`${API.replace('/api', '')}${propertyContract.contract_url}`}
                target="_blank"
                rel="noopener noreferrer"
                className="text-sm text-[#1E6A6A] hover:text-[#D4AF37] underline mb-4 block"
              >
                View Contract (PDF)
              </a>
            )}

            <div className="border-2 border-dashed border-gray-300 rounded-lg p-4 mb-4">
              <canvas
                ref={signatureCanvasRef}
                width={600}
                height={200}
                className="w-full cursor-crosshair bg-gray-50 rounded"
                onMouseDown={startDrawing}
                onMouseMove={draw}
                onMouseUp={stopDrawing}
                onMouseLeave={stopDrawing}
              />
              <p className="text-xs text-gray-500 mt-2 text-center">Draw your signature above</p>
            </div>

            <div className="flex items-center gap-3 mb-4">
              <div className="flex-1 border-t border-gray-300"></div>
              <span className="text-xs text-gray-500">OR</span>
              <div className="flex-1 border-t border-gray-300"></div>
            </div>

            <label className="block w-full px-4 py-3 rounded-lg border-2 border-dashed border-gray-300 text-center text-sm font-medium cursor-pointer hover:border-[#1E6A6A] transition-colors mb-4">
              Upload Signature Image
              <input
                type="file"
                accept="image/*"
                className="hidden"
                onChange={handleSignatureImageUpload}
              />
            </label>

            <div className="flex gap-3">
              <button
                onClick={clearSignature}
                className="px-4 py-2 rounded-lg border border-gray-300 text-sm font-medium hover:bg-gray-50"
              >
                Clear
              </button>
              <button
                onClick={saveSignature}
                className="flex-1 px-4 py-2 rounded-lg text-sm font-medium text-white"
                style={{ backgroundColor: '#1E6A6A' }}
              >
                Sign & Continue
              </button>
              <button
                onClick={() => setShowSignatureModal(false)}
                className="px-4 py-2 rounded-lg border border-gray-300 text-sm font-medium hover:bg-gray-50"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default PropertyDetail;