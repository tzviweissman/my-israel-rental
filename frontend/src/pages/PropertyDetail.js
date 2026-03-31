import React, { useState, useEffect, useContext } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import axios from 'axios';
import { API, AuthContext } from '../App';
import { Bed, Bath, Home as HomeIcon, MapPin, Building2, MessageCircle, Calendar as CalendarIcon, ChevronLeft, ChevronRight, Film, Snowflake, WashingMachine, UtensilsCrossed, DoorOpen, ArrowUpFromLine, ShowerHead, Warehouse, Flame, Dumbbell, Waves, Sparkles, Car, Wifi, Mail, Users, X } from 'lucide-react';
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
    guest_count: 1,
    message: ''
  });
  const [showBooking, setShowBooking] = useState(false);
  const [exchangeRate, setExchangeRate] = useState(null);
  const [blockedDates, setBlockedDates] = useState([]);

  useEffect(() => {
    axios.get(`${API}/exchange-rate`).then(res => setExchangeRate(res.data)).catch(() => setExchangeRate({ usd_to_ils: 3.65, ils_to_usd: 0.274 }));
  }, []);

  const convertPrice = (price, fromCurrency) => {
    if (!exchangeRate || !price) return null;
    if (fromCurrency === 'USD') return { amount: Math.round(price * exchangeRate.usd_to_ils), symbol: '₪' };
    return { amount: Math.round(price * exchangeRate.ils_to_usd), symbol: '$' };
  };

  useEffect(() => {
    fetchProperty();
  }, [id]);

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
    } catch (error) {
      console.error('Failed to fetch property', error);
      toast.error('Property not found');
    }
  };

  const handleBooking = async () => {
    if (!user) {
      navigate('/auth/login');
      return;
    }

    try {
      await axios.post(`${API}/bookings`, {
        property_id: id,
        ...bookingData
      }, {
        headers: { Authorization: `Bearer ${token}` }
      });
      toast.success('Booking request sent successfully!');
      setShowBooking(false);
    } catch (error) {
      toast.error('Failed to create booking');
    }
  };

  const handleChat = () => {
    if (!user) {
      navigate('/auth/login');
      return;
    }
    navigate(`/chat/${id}`);
  };

  if (!property) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <p className="text-xl">Loading...</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen -mt-[180px] pt-[130px]" data-testid="property-detail-page">
      <div className="max-w-7xl mx-auto px-6 pt-0 pb-12">
        <button onClick={() => navigate(-1)} className="flex items-center gap-2 text-sm font-medium mb-2 hover:text-[#D4AF37] transition-colors" data-testid="back-button">
          <ArrowLeft size={18} />
          {user && user.role !== 'renter' ? t('property.backToDashboard') : t('property.backToListings')}
        </button>
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
                          key={idx}
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
                          key={idx}
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
                        key={idx}
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

            <h1 className="text-4xl font-bold mb-4" style={{ fontFamily: 'Playfair Display' }} data-testid="property-title">
              {property.title}
            </h1>

            <div className="flex items-center gap-2 text-gray-600 mb-6">
              <MapPin size={20} />
              <span className="text-lg">{property.address}, {property.area}</span>
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

            <div className="bg-white p-6 rounded-2xl border border-[#E5E5E5] mb-8">
              <h2 className="text-2xl font-bold mb-4" style={{ fontFamily: 'Playfair Display' }}>{t('property.description')}</h2>
              <p className="text-gray-700 leading-relaxed">{property.description}</p>
            </div>

            {property.amenities && property.amenities.length > 0 && (
              <div className="bg-white p-6 rounded-2xl border border-[#E5E5E5] mb-8">
                <h2 className="text-2xl font-bold mb-4" style={{ fontFamily: 'Playfair Display' }}>{t('property.amenities')}</h2>
                <div className="grid grid-cols-2 gap-3">
                  {property.amenities.map((amenity, index) => {
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
                      <div key={index} className="flex items-center gap-2">
                        <Icon size={16} style={{ color: "#D4AF37" }} />
                        <span>{amenity}</span>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

            <div className="flex flex-wrap gap-3">
              {property.has_agent_fee && property.agent_fee_price && (
                <span className="px-4 py-2 rounded-full text-sm font-medium" style={{ backgroundColor: '#D4AF37', color: '#1E6A6A' }}>
                  {t('property.agentFee')}: {property.agent_fee_currency === 'USD' ? '$' : '₪'}{property.agent_fee_price.toLocaleString()}
                  {(() => {
                    const c = convertPrice(property.agent_fee_price, property.agent_fee_currency);
                    return c ? ` (≈ ${c.symbol}${c.amount.toLocaleString()})` : '';
                  })()}
                </span>
              )}
              {property.furniture_package && (
                <span className="px-4 py-2 rounded-full text-sm font-medium" style={{ backgroundColor: '#E5E5E5', color: '#1E6A6A' }}>
                  {t('property.furniture')}
                </span>
              )}
            </div>
          </div>

          <div className="lg:col-span-1">
            <div className="bg-white p-6 rounded-2xl border border-[#E5E5E5] sticky top-40">
              <div className="mb-6">
                <span className="text-4xl font-bold" style={{ color: "#D4AF37" }} data-testid="property-detail-price">
                  {property.currency === 'USD' ? '$' : '₪'}{(property.monthly_price || property.nightly_price || 0).toLocaleString()}
                </span>
                <span className="text-lg text-gray-600">
                  {property.rental_type === 'vacation' ? t('property.perNight') : t('property.perMonth')}
                </span>
                {(() => {
                  const converted = convertPrice(property.monthly_price || property.nightly_price, property.currency);
                  if (!converted) return null;
                  return (
                    <div className="text-sm text-gray-400 mt-1" data-testid="property-detail-converted-price">
                      ≈ {converted.symbol}{converted.amount.toLocaleString()}{property.rental_type === 'vacation' ? t('property.perNight') : t('property.perMonth')}
                    </div>
                  );
                })()}
              </div>

              {!showBooking ? (
                <div className="space-y-3">
                  <button onClick={() => setShowBooking(true)} className="w-full primary-btn flex items-center justify-center gap-2" data-testid="book-now-button">
                    <CalendarIcon size={20} />
                    {t('property.book')}
                  </button>
                  <button onClick={handleChat} className="w-full secondary-btn flex items-center justify-center gap-2" data-testid="message-owner-button">
                    <MessageCircle size={20} />
                    {t('property.messageOwner')}
                  </button>
                  {property.owner_email && (
                    <a
                      href={`mailto:${property.owner_email}?subject=${encodeURIComponent(t('property.emailSubject') + ': ' + property.title)}`}
                      className="w-full flex items-center justify-center gap-2 px-6 py-3 rounded-full text-sm font-medium border-2 transition-colors"
                      style={{ borderColor: '#D4AF37', color: '#D4AF37' }}
                      data-testid="email-owner-button"
                    >
                      <Mail size={20} />
                      {t('property.emailOwner')}
                    </a>
                  )}
                </div>
              ) : (
                <div className="space-y-4" data-testid="booking-form">
                  <div>
                    <label className="block text-sm font-medium mb-2">{t('property.checkIn')} & {t('property.checkOut')}</label>
                    <div className="grid grid-cols-2 gap-2">
                      <button
                        type="button"
                        onClick={() => setShowCalendar(showCalendar === 'range' ? null : 'range')}
                        className="flex items-center gap-2 px-3 py-2.5 rounded-lg border border-[#E5E5E5] text-sm text-left hover:border-black/30 transition-colors"
                        data-testid="booking-start-date"
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
                    {showCalendar === 'range' && (
                      <div className="mt-2 bg-white rounded-xl border border-[#E5E5E5] shadow-lg p-1 relative" data-testid="booking-calendar">
                        <button
                          onClick={() => setShowCalendar(null)}
                          className="absolute top-2 right-2 p-1 rounded-full hover:bg-gray-100 z-10"
                        >
                          <X size={14} />
                        </button>
                        <Calendar
                          mode="range"
                          selected={dateRange}
                          onSelect={(range) => {
                            setDateRange(range || { from: undefined, to: undefined });
                            if (range?.from) setBookingData(prev => ({ ...prev, start_date: format(range.from, 'yyyy-MM-dd') }));
                            if (range?.to) {
                              setBookingData(prev => ({ ...prev, end_date: format(range.to, 'yyyy-MM-dd') }));
                              setShowCalendar(null);
                            }
                          }}
                          numberOfMonths={1}
                          disabled={[{ before: new Date() }, ...blockedDates.map(d => new Date(d))]}
                          className="rounded-xl"
                          classNames={{
                            months: "flex flex-col",
                            month: "space-y-3",
                            caption: "flex justify-center pt-1 relative items-center",
                            caption_label: "text-sm font-bold",
                            nav: "space-x-1 flex items-center",
                            nav_button: "h-7 w-7 bg-transparent p-0 opacity-50 hover:opacity-100 inline-flex items-center justify-center rounded-md border border-[#E5E5E5]",
                            nav_button_previous: "absolute left-1",
                            nav_button_next: "absolute right-1",
                            table: "w-full border-collapse",
                            head_row: "flex",
                            head_cell: "text-gray-500 rounded-md w-9 font-medium text-[0.75rem] uppercase",
                            row: "flex w-full mt-1",
                            cell: "relative p-0 text-center text-sm focus-within:relative focus-within:z-20 [&:has([aria-selected])]:bg-black/5 first:[&:has([aria-selected])]:rounded-l-full last:[&:has([aria-selected])]:rounded-r-full [&:has(>.day-range-start)]:rounded-l-full [&:has(>.day-range-end)]:rounded-r-full",
                            day: "h-9 w-9 p-0 font-normal rounded-full hover:bg-gray-100 inline-flex items-center justify-center",
                            day_range_start: "day-range-start bg-black text-white rounded-full hover:bg-black",
                            day_range_end: "day-range-end bg-black text-white rounded-full hover:bg-black",
                            day_selected: "bg-black text-white hover:bg-black focus:bg-black",
                            day_today: "font-bold text-[#D4AF37]",
                            day_outside: "text-gray-300",
                            day_disabled: "text-gray-200",
                            day_range_middle: "aria-selected:bg-black/5 aria-selected:text-black",
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
                  <div>
                    <label className="block text-sm font-medium mb-2">{t('property.guests')}</label>
                    <div className="flex items-center gap-3">
                      <button
                        type="button"
                        onClick={() => setBookingData(prev => ({ ...prev, guest_count: Math.max(1, prev.guest_count - 1) }))}
                        className="w-9 h-9 rounded-full border border-[#E5E5E5] flex items-center justify-center hover:border-black/40 transition-colors text-lg"
                      >
                        -
                      </button>
                      <div className="flex items-center gap-2">
                        <Users size={16} className="text-gray-400" />
                        <span className="text-sm font-medium w-4 text-center" data-testid="booking-guest-count">{bookingData.guest_count}</span>
                      </div>
                      <button
                        type="button"
                        onClick={() => setBookingData(prev => ({ ...prev, guest_count: prev.guest_count + 1 }))}
                        className="w-9 h-9 rounded-full border border-[#E5E5E5] flex items-center justify-center hover:border-black/40 transition-colors text-lg"
                      >
                        +
                      </button>
                    </div>
                  </div>
                  <div>
                    <label className="block text-sm font-medium mb-2">{t('property.messageLabel')}</label>
                    <textarea
                      value={bookingData.message}
                      onChange={(e) => setBookingData({ ...bookingData, message: e.target.value })}
                      rows="3"
                      placeholder={t('property.messagePlaceholder')}
                      className="w-full px-4 py-2 rounded-lg border border-[#E5E5E5] focus:outline-none focus:ring-2 focus:ring-[#1E6A6A]/50 text-sm resize-none"
                      data-testid="booking-message"
                    ></textarea>
                  </div>
                  <div className="flex gap-2">
                    <button onClick={handleBooking} className="flex-1 primary-btn" data-testid="confirm-booking-button">
                      {t('property.confirm')}
                    </button>
                    <button onClick={() => { setShowBooking(false); setShowCalendar(null); }} className="flex-1 secondary-btn" data-testid="cancel-booking-button">
                      {t('dashboard.cancel')}
                    </button>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default PropertyDetail;