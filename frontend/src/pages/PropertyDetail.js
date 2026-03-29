import React, { useState, useEffect, useContext } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import axios from 'axios';
import { API, AuthContext } from '../App';
import { Bed, Bath, Home as HomeIcon, MapPin, Building2, Star, MessageCircle, Calendar, ChevronLeft, ChevronRight, Film } from 'lucide-react';
import { toast } from 'sonner';

const PropertyDetail = () => {
  const { id } = useParams();
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { user, token } = useContext(AuthContext);
  const [property, setProperty] = useState(null);
  const [currentImageIndex, setCurrentImageIndex] = useState(0);
  const [bookingData, setBookingData] = useState({
    start_date: '',
    end_date: '',
    guest_count: 1,
    message: ''
  });
  const [showBooking, setShowBooking] = useState(false);

  useEffect(() => {
    fetchProperty();
  }, [id]);

  const fetchProperty = async () => {
    try {
      const response = await axios.get(`${API}/properties/${id}`);
      setProperty(response.data);
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
    <div className="min-h-screen" data-testid="property-detail-page">
      <div className="max-w-7xl mx-auto px-6 py-12">
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
                  <h3 className="text-sm font-medium mb-2 flex items-center gap-2"><Film size={16} /> Videos</h3>
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
                </div>
              )}
            </div>

            <div className="bg-white p-6 rounded-2xl border border-[#E5E5E5] mb-8">
              <h2 className="text-2xl font-bold mb-4" style={{ fontFamily: 'Playfair Display' }}>Description</h2>
              <p className="text-gray-700 leading-relaxed">{property.description}</p>
            </div>

            {property.amenities && property.amenities.length > 0 && (
              <div className="bg-white p-6 rounded-2xl border border-[#E5E5E5] mb-8">
                <h2 className="text-2xl font-bold mb-4" style={{ fontFamily: 'Playfair Display' }}>{t('property.amenities')}</h2>
                <div className="grid grid-cols-2 gap-3">
                  {property.amenities.map((amenity, index) => (
                    <div key={index} className="flex items-center gap-2">
                      <Star size={16} style={{ color: "#D4AF37" }} />
                      <span>{amenity}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            <div className="flex flex-wrap gap-3">
              {property.has_elevator && (
                <span className="px-4 py-2 rounded-full text-sm font-medium" style={{ backgroundColor: '#E5E5E5', color: '#000000' }}>
                  {t('property.elevator')}
                </span>
              )}
              {property.is_shabbat_elevator && (
                <span className="px-4 py-2 rounded-full text-sm font-medium" style={{ backgroundColor: '#D99A5B', color: 'white' }}>
                  {t('property.shabbatElevator')}
                </span>
              )}
              {property.sukkah_compatible && (
                <span className="px-4 py-2 rounded-full text-sm font-medium" style={{ backgroundColor: '#345C45', color: 'white' }}>
                  {t('property.sukkah')}
                </span>
              )}
              {property.furniture_package && (
                <span className="px-4 py-2 rounded-full text-sm font-medium" style={{ backgroundColor: '#E5E5E5', color: '#000000' }}>
                  {t('property.furniture')}
                </span>
              )}
            </div>
          </div>

          <div className="lg:col-span-1">
            <div className="bg-white p-6 rounded-2xl border border-[#E5E5E5] sticky top-24">
              <div className="mb-6">
                <span className="text-4xl font-bold" style={{ color: "#D4AF37" }}>
                  ₪{property.monthly_price || property.nightly_price}
                </span>
                <span className="text-lg text-gray-600">
                  {property.rental_type === 'vacation' ? '/night' : '/month'}
                </span>
              </div>

              {!showBooking ? (
                <div className="space-y-3">
                  <button onClick={() => setShowBooking(true)} className="w-full primary-btn flex items-center justify-center gap-2" data-testid="book-now-button">
                    <Calendar size={20} />
                    {t('property.book')}
                  </button>
                  <button onClick={handleChat} className="w-full secondary-btn flex items-center justify-center gap-2" data-testid="contact-owner-button">
                    <MessageCircle size={20} />
                    {t('property.contact')}
                  </button>
                </div>
              ) : (
                <div className="space-y-4" data-testid="booking-form">
                  <div>
                    <label className="block text-sm font-medium mb-2">Check-in</label>
                    <input
                      type="date"
                      value={bookingData.start_date}
                      onChange={(e) => setBookingData({ ...bookingData, start_date: e.target.value })}
                      className="w-full px-4 py-2 rounded-lg border border-[#E5E5E5] focus:outline-none focus:ring-2 focus:ring-[#000000]/50"
                      data-testid="booking-start-date"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium mb-2">Check-out</label>
                    <input
                      type="date"
                      value={bookingData.end_date}
                      onChange={(e) => setBookingData({ ...bookingData, end_date: e.target.value })}
                      className="w-full px-4 py-2 rounded-lg border border-[#E5E5E5] focus:outline-none focus:ring-2 focus:ring-[#000000]/50"
                      data-testid="booking-end-date"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium mb-2">Guests</label>
                    <input
                      type="number"
                      value={bookingData.guest_count}
                      onChange={(e) => setBookingData({ ...bookingData, guest_count: parseInt(e.target.value) })}
                      min="1"
                      className="w-full px-4 py-2 rounded-lg border border-[#E5E5E5] focus:outline-none focus:ring-2 focus:ring-[#000000]/50"
                      data-testid="booking-guest-count"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium mb-2">Message</label>
                    <textarea
                      value={bookingData.message}
                      onChange={(e) => setBookingData({ ...bookingData, message: e.target.value })}
                      rows="3"
                      className="w-full px-4 py-2 rounded-lg border border-[#E5E5E5] focus:outline-none focus:ring-2 focus:ring-[#000000]/50"
                      data-testid="booking-message"
                    ></textarea>
                  </div>
                  <div className="flex gap-2">
                    <button onClick={handleBooking} className="flex-1 primary-btn" data-testid="confirm-booking-button">
                      Confirm
                    </button>
                    <button onClick={() => setShowBooking(false)} className="flex-1 secondary-btn" data-testid="cancel-booking-button">
                      Cancel
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