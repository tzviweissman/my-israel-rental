import React, { useState, useEffect, useContext } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import axios from 'axios';
import { API, AuthContext } from '../App';
import { Bed, Bath, Home as HomeIcon, MapPin, Building2, MessageCircle, Calendar as CalendarIcon, ChevronLeft, ChevronRight, Film, Snowflake, WashingMachine, UtensilsCrossed, DoorOpen, ArrowUpFromLine, ShowerHead, Warehouse, Flame, Dumbbell, Waves, Sparkles, Car, Wifi, Mail, Users, X, Heart, Share2, Copy, Check } from 'lucide-react';
import { Calendar } from '../components/ui/calendar';
import { format } from 'date-fns';
import { toast } from 'sonner';

import { ArrowLeft } from 'lucide-react';

const PropertyDetail = () => {
  const { id } = useParams();
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
      
      // For long-term rentals, set the starting date as check-in (read-only)
      if (response.data.rental_type === 'long-term' && response.data.starting_date) {
        const startDate = new Date(response.data.starting_date);
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
        signature_data: null
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
    navigate(`/chat/${id}`);
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
              {property.images && property.images.length > 0 ? (
                <div className="relative" data-testid="image-gallery">
                  <div className="overflow-hidden rounded-2xl">
                    <div
                      className="flex transition-transform duration-500 ease-in-out"
                      style={{ transform: `translateX(-${currentImageIndex * 100}%)` }}
                    >
                      {property.images.map((img, idx) => (
                        <img
                          key={img}
                          src={img.startsWith('/api') ? `${API.replace('/api', '')}${img}` : img}
                          alt={`${property.title} - ${idx + 1}`}
                          className="w-full h-96 object-cover flex-shrink-0"
                          data-testid={idx === currentImageIndex ? 'gallery-main-image' : undefined}
                        />
                      ))}
                    </div>
                  </div>
                  {property.images.length > 1 && (
                    <>
                      <button
                        onClick={() => setCurrentImageIndex(prev => prev === 0 ? property.images.length - 1 : prev - 1)}
                        className="absolute left-3 top-1/2 -translate-y-1/2 bg-black/60 text-white p-2 rounded-full hover:bg-black/80 transition-colors"
                        data-testid="gallery-prev"
                      >
                        <ChevronLeft size={20} />
                      </button>
                      <button
                        onClick={() => setCurrentImageIndex(prev => prev === property.images.length - 1 ? 0 : prev + 1)}
                        className="absolute right-3 top-1/2 -translate-y-1/2 bg-black/60 text-white p-2 rounded-full hover:bg-black/80 transition-colors"
                        data-testid="gallery-next"
                      >
                        <ChevronRight size={20} />
                      </button>
                      <div className="absolute bottom-3 left-1/2 -translate-x-1/2 bg-black/60 text-white text-xs px-3 py-1 rounded-full">
                        {currentImageIndex + 1} / {property.images.length}
                      </div>
                    </>
                  )}
                  {property.images.length > 1 && (
                    <div className="flex gap-2 mt-3 overflow-x-auto pb-2" data-testid="gallery-thumbnails">
                      {property.images.map((img, idx) => (
                        <img
                          key={`thumb-${img}`}
                          src={img.startsWith('/api') ? `${API.replace('/api', '')}${img}` : img}
                          alt={`Thumb ${idx + 1}`}
                          onClick={() => setCurrentImageIndex(idx)}
                          className={`w-20 h-14 object-cover rounded-lg cursor-pointer flex-shrink-0 transition-all ${idx === currentImageIndex ? 'ring-2 ring-black opacity-100' : 'opacity-60 hover:opacity-100'}`}
                          data-testid={`gallery-thumb-${idx}`}
                        />
                      ))}
                    </div>
                  )}
                </div>
              ) : (
                <div
                  className="w-full h-96 rounded-2xl"
                  style={{
                    backgroundImage: 'url(https://images.pexels.com/photos/1669799/pexels-photo-1669799.jpeg?auto=compress&cs=tinysrgb&dpr=2&h=650&w=940)',
                    backgroundSize: 'cover',
                    backgroundPosition: 'center'
                  }}
                ></div>
              )}

              {property.videos && property.videos.length > 0 && (
                <div className="mt-4" data-testid="property-videos">
                  <h3 className="text-sm font-medium mb-2 flex items-center gap-2"><Film size={16} /> {t('property.videos')}</h3>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                    {property.videos.map((video, idx) => (
                      <video
                        key={video}
                        src={video.startsWith('/api') ? `${API.replace('/api', '')}${video}` : video}
                        controls
                        className="w-full rounded-xl border border-[#E5E5E5]"
                        data-testid={`property-video-${idx}`}
                      />
                    ))}
                  </div>
                </div>
              )}
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
              {property.has_agent_fee && property.agent_fee_price && (
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

            {/* Starting Date (Long-term) or Available From (Others) */}
            {property.rental_type === 'long-term' && property.starting_date && (
              <div className="bg-[#1E6A6A]/10 border border-[#1E6A6A]/30 p-4 rounded-xl mb-6">
                <div className="flex items-center gap-2">
                  <CalendarIcon size={20} style={{ color: '#1E6A6A' }} />
                  <span className="font-medium text-gray-700">Starting Date (Fixed):</span>
                  <span className="font-bold" style={{ color: '#1E6A6A' }}>
                    {new Date(property.starting_date).toLocaleDateString('en-US', { 
                      year: 'numeric', 
                      month: 'long', 
                      day: 'numeric' 
                    })}
                  </span>
                </div>
              </div>
            )}
            
            {property.rental_type !== 'long-term' && property.available_from && (
              <div className="bg-[#D4AF37]/10 border border-[#D4AF37]/30 p-4 rounded-xl mb-6">
                <div className="flex items-center gap-2">
                  <CalendarIcon size={20} style={{ color: '#D4AF37' }} />
                  <span className="font-medium text-gray-700">Available from:</span>
                  <span className="font-bold" style={{ color: '#1E6A6A' }}>
                    {new Date(property.available_from).toLocaleDateString('en-US', { 
                      year: 'numeric', 
                      month: 'long', 
                      day: 'numeric' 
                    })}
                  </span>
                </div>
              </div>
            )}

            {/* Minimum Booking Length */}
            {property.minimum_booking_days && (
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
              </div>

              {/* Booking Form - Always Visible */}
              <div className="space-y-2.5" data-testid="booking-form">
                  <div>
                    <label className="block text-sm font-medium mb-1.5">{t('property.checkIn')} & {t('property.checkOut')}</label>
                    {property.rental_type === 'long-term' && property.starting_date && (
                      <p className="text-xs text-[#D4AF37] mb-1.5">Starting date is fixed for this long-term rental</p>
                    )}
                    <div className="grid grid-cols-2 gap-2">
                      <button
                        type="button"
                        onClick={() => property.rental_type !== 'long-term' && setShowCalendar(showCalendar === 'range' ? null : 'range')}
                        className={`flex items-center gap-2 px-3 py-2.5 rounded-lg border text-sm text-left transition-colors ${
                          property.rental_type === 'long-term' 
                            ? 'border-gray-200 bg-gray-50 cursor-not-allowed' 
                            : 'border-[#E5E5E5] hover:border-black/30'
                        }`}
                        data-testid="booking-start-date"
                        disabled={property.rental_type === 'long-term'}
                      >
                        <CalendarIcon size={14} className="text-gray-400 flex-shrink-0" />
                        <span className={dateRange.from ? 'text-black' : 'text-gray-400'}>
                          {dateRange.from ? format(dateRange.from, 'MMM d, yyyy') : t('property.checkIn')}
                        </span>
                      </button>
                      <button
                        type="button"
                        onClick={() => setShowCalendar(showCalendar === 'range' ? null : 'range')}
                        className="flex items-center gap-2 px-3 py-2.5 rounded-lg border border-[#E5E5E5] text-sm text-left hover:border-black/30 transition-colors"
                        data-testid="booking-end-date"
                      >
                        <CalendarIcon size={14} className="text-gray-400 flex-shrink-0" />
                        <span className={dateRange.to ? 'text-black' : 'text-gray-400'}>
                          {dateRange.to ? format(dateRange.to, 'MMM d, yyyy') : t('property.checkOut')}
                        </span>
                      </button>
                    </div>
                    
                    {/* Quick Select Buttons for Longer Stays */}
                    <div className="mt-3">
                      <p className="text-xs text-gray-500 mb-2">Quick select:</p>
                      <div className="flex gap-2 flex-wrap">
                        <button
                          type="button"
                          onClick={() => {
                            const from = new Date();
                            from.setDate(from.getDate() + 1); // Start tomorrow
                            const to = new Date(from);
                            to.setMonth(to.getMonth() + 3); // +3 months
                            setDateRange({ from, to });
                            setBookingData(prev => ({
                              ...prev,
                              start_date: format(from, 'yyyy-MM-dd'),
                              end_date: format(to, 'yyyy-MM-dd')
                            }));
                          }}
                          className="px-3 py-1.5 rounded-lg border border-[#1E6A6A] text-[#1E6A6A] hover:bg-[#1E6A6A] hover:text-white text-xs font-medium transition-colors"
                        >
                          + 3 Months
                        </button>
                        <button
                          type="button"
                          onClick={() => {
                            const from = new Date();
                            from.setDate(from.getDate() + 1);
                            const to = new Date(from);
                            to.setMonth(to.getMonth() + 6); // +6 months
                            setDateRange({ from, to });
                            setBookingData(prev => ({
                              ...prev,
                              start_date: format(from, 'yyyy-MM-dd'),
                              end_date: format(to, 'yyyy-MM-dd')
                            }));
                          }}
                          className="px-3 py-1.5 rounded-lg border border-[#1E6A6A] text-[#1E6A6A] hover:bg-[#1E6A6A] hover:text-white text-xs font-medium transition-colors"
                        >
                          + 6 Months
                        </button>
                        <button
                          type="button"
                          onClick={() => {
                            const from = new Date();
                            from.setDate(from.getDate() + 1);
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
                          onSelect={(range) => {
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
                              const startDate = new Date(property.starting_date);
                              const minCheckout = new Date(startDate);
                              minCheckout.setMonth(minCheckout.getMonth() + parseInt(property.minimum_booking_days));
                              return minCheckout;
                            } else if (dateRange?.from) {
                              return dateRange.from;
                            }
                            return new Date();
                          })()}
                          numberOfMonths={1}
                          disabled={[
                            { before: new Date() },
                            ...(property.rental_type === 'long-term' && property.starting_date && property.minimum_booking_days
                              ? (() => {
                                  // For long-term with fixed starting date and minimum months
                                  // Disable all dates before the minimum checkout date
                                  const startDate = new Date(property.starting_date);
                                  const minCheckout = new Date(startDate);
                                  minCheckout.setMonth(minCheckout.getMonth() + parseInt(property.minimum_booking_days));
                                  return [{ before: minCheckout }];
                                })()
                              : property.available_from 
                                ? [{ before: new Date(property.available_from) }] 
                                : []
                            ),
                            ...blockedDates.map(d => new Date(d))
                          ]}
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