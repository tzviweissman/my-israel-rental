import React, { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';
import axios from 'axios';
import DOMPurify from 'dompurify';
import { API } from '../App';
import { Search, Bed, Bath, Home as HomeIcon, MapPin, Check } from 'lucide-react';
import HeroSlideshow from '../components/HeroSlideshow';
import DefaultImageBadge from '../components/property/DefaultImageBadge';
import { getCoverImage } from '../utils/coverImage';
import { sizedImage } from '../utils/cdnImage';

// Hero background rotation. Keep widths consistent so the cross-fade is
// imperceptible at the image edges (browser caches the second slide while
// the first is showing).
const HERO_IMAGES = [
  // Tel Aviv coastline at sunset (original hero)
  'https://images.unsplash.com/photo-1547483036-24bc77c79804?auto=format&fit=crop&w=1920&q=80',
  // Kotel + Dome of the Rock — wide majestic view, golden hour
  'https://images.pexels.com/photos/2087387/pexels-photo-2087387.jpeg?auto=compress&cs=tinysrgb&w=1920&q=80',
  // Haifa coastline aerial — Mediterranean + Mount Carmel, sunny day
  'https://images.pexels.com/photos/27638436/pexels-photo-27638436.jpeg?auto=compress&cs=tinysrgb&w=1920&q=80',
  // Modern open-plan apartment living + kitchen with urban skyline view
  'https://images.pexels.com/photos/32178051/pexels-photo-32178051.png?auto=compress&cs=tinysrgb&w=1920&q=80',
];

const Home = () => {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const [featuredProperties, setFeaturedProperties] = useState([]);
  const [searchQuery, setSearchQuery] = useState('');

  useEffect(() => {
    fetchFeaturedProperties();
  }, []);

  const fetchFeaturedProperties = async () => {
    try {
      const response = await axios.get(`${API}/properties`);
      setFeaturedProperties(response.data.slice(0, 6));
    } catch (error) {
      console.error('Failed to fetch properties', error);
    }
  };

  const handleSearch = () => {
    navigate(`/properties/all?search=${searchQuery}`);
  };

  return (
    <div className="min-h-screen">
      <HeroSlideshow
        images={HERO_IMAGES}
        holdMs={6000}
        fadeMs={1500}
        className="h-[760px] flex items-center justify-center -mt-[210px] pt-[280px]"
      >
        <div data-testid="hero-section" className="h-full flex items-center justify-center">
          <div className="relative z-10 text-center text-white px-6 max-w-4xl mt-44 sm:mt-40 md:mt-16 lg:mt-20">
            <h1 className="text-4xl sm:text-5xl lg:text-6xl font-bold mb-2" style={{ fontFamily: 'Playfair Display', color: 'white' }}>
              {t('hero.title')}
            </h1>
            <p className="text-3xl sm:text-4xl lg:text-5xl font-bold mb-8" style={{ fontFamily: 'Playfair Display', color: '#D4AF37' }}>
              {t('hero.anyDuration')}
            </p>

            {/* No-fees badge — subtle gold border, glass background, gold checkmark.
                Sits between the headline and the search bar. */}
            <div className="flex flex-col items-center mb-6" data-testid="no-fees-badge">
              <div
                className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full backdrop-blur-md border"
                style={{
                  backgroundColor: 'rgba(255, 255, 255, 0.12)',
                  borderColor: 'rgba(212, 175, 55, 0.55)',
                }}
              >
                <Check size={14} strokeWidth={3} style={{ color: '#D4AF37' }} />
                <span
                  className="text-xs sm:text-sm font-semibold uppercase tracking-wider"
                  style={{ color: '#D4AF37', letterSpacing: '0.12em' }}
                >
                  {t('hero.noFeesTagline')}
                </span>
              </div>
              <p
                className="mt-2 text-xs sm:text-sm text-white/85"
                style={{ fontWeight: 400 }}
              >
                {t('hero.noFeesDetail')}
              </p>
            </div>
            <div className="flex gap-2 max-w-2xl mx-auto px-2 sm:px-0">
              <input
                type="text"
                placeholder={t('hero.searchPlaceholder')}
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                onKeyPress={(e) => e.key === 'Enter' && handleSearch()}
                className="flex-1 min-w-0 px-4 sm:px-6 py-3 sm:py-4 rounded-full text-sm sm:text-base text-gray-800 focus:outline-none focus:ring-2 focus:ring-[#1E6A6A]"
                data-testid="hero-search-input"
              />
              <button
                onClick={handleSearch}
                className="primary-btn flex flex-shrink-0 items-center justify-center gap-1.5 sm:gap-2 px-4 sm:px-6 py-3 sm:py-4 text-sm sm:text-base"
                style={{ color: '#FFFFFF' }}
                data-testid="hero-search-button"
              >
                <Search size={18} className="flex-shrink-0" />
                <span className="hidden sm:inline">{t('hero.search')}</span>
              </button>
            </div>
          </div>
        </div>
      </HeroSlideshow>

      <div className="max-w-7xl mx-auto px-6 py-16">
        <h2 className="text-3xl sm:text-4xl font-bold mb-12 text-center" style={{ fontFamily: 'Playfair Display' }}>
          {t('home.featuredProperties')}
        </h2>

        <div className="grid grid-cols-2 md:grid-cols-2 lg:grid-cols-3 gap-3 md:gap-8">
          {featuredProperties.map((property) => (
            <div
              key={property.id}
              className="property-card"
              onClick={() => {
                sessionStorage.setItem('previousPath', window.location.pathname);
                navigate(`/property/${property.id}`);
              }}
              data-testid={`property-card-${property.id}`}
            >
              <div className="relative h-36 md:h-64 bg-gray-200" style={{
                backgroundImage: `url(${getCoverImage(property.images, 600, '', property.videos, property.id).url})`,
                backgroundSize: 'cover',
                backgroundPosition: 'center'
              }}>
                {getCoverImage(property.images, 600, '', property.videos, property.id).isDefault && <DefaultImageBadge />}
              </div>
              <div className="p-3 md:p-6">
                <h3 className="text-sm md:text-xl font-bold mb-1 md:mb-2 line-clamp-1">{property.title}</h3>
                <div className="flex items-center gap-2 text-gray-600 mb-2 md:mb-3">
                  <MapPin size={14} className="md:w-4 md:h-4 shrink-0" />
                  <span className="text-xs md:text-sm truncate">{property.area}</span>
                </div>
                <div className="hidden md:flex items-center gap-4 mb-4 text-sm text-gray-700">
                  {property.bedrooms && (
                    <div className="flex items-center gap-1">
                      <Bed size={16} />
                      <span>{property.bedrooms}</span>
                    </div>
                  )}
                  {property.bathrooms && (
                    <div className="flex items-center gap-1">
                      <Bath size={16} />
                      <span>{property.bathrooms}</span>
                    </div>
                  )}
                  {property.square_meters && (
                    <div className="flex items-center gap-1">
                      <HomeIcon size={16} />
                      <span>{property.square_meters} m²</span>
                    </div>
                  )}
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-base md:text-2xl font-bold" style={{ color: "#D4AF37" }}>
                    ₪{property.monthly_price || property.nightly_price}
                    <span className="text-[10px] md:text-sm font-normal text-gray-600">
                      {property.rental_type === 'vacation' ? t('property.perNight') : t('property.perMonth')}
                    </span>
                  </span>
                  <span className="hidden md:inline text-sm px-3 py-1 rounded-full" style={{ backgroundColor: '#E5E5E5', color: '#1E6A6A' }}>
                    {{'long-term': t('property.longTerm'), 'short-term': t('property.shortTerm'), 'vacation': t('property.vacationType'), 'storage': t('property.storageType')}[property.rental_type] || property.rental_type}
                  </span>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* About Us Section */}
      <div className="py-20" style={{ backgroundColor: '#F5F5F5' }}>
        <div className="max-w-5xl mx-auto px-6">
          <h2 className="text-4xl sm:text-5xl font-bold mb-8 text-center" style={{ fontFamily: 'Playfair Display', color: '#1E6A6A' }}>
            {t('home.aboutUs')}
          </h2>
          <div className="space-y-6 text-lg leading-relaxed text-gray-700">
            <p dangerouslySetInnerHTML={{ __html: DOMPurify.sanitize(t('home.aboutPara1')) }} />
            <p dangerouslySetInnerHTML={{ __html: DOMPurify.sanitize(t('home.aboutPara2')) }} />
          </div>
        </div>
      </div>

      <div className="py-16" style={{ backgroundColor: '#1E6A6A' }}>
        <div className="max-w-7xl mx-auto px-6 text-center" style={{ color: '#D4AF37' }}>
          <h2 className="text-3xl font-bold mb-4" style={{ fontFamily: 'Playfair Display' }}>
            {t('footer.contact')}
          </h2>
          <p className="text-lg mb-2">
            {t('home.whatsapp')}: <a href="https://wa.me/972553225141" target="_blank" rel="noopener noreferrer" className="font-bold hover:underline" data-testid="contact-whatsapp">+972 55 322 5141</a>
          </p>
          <p className="text-lg">
            {t('home.email')}: <a href="mailto:support@myisraelrental.com" className="font-bold hover:underline">support@myisraelrental.com</a>
          </p>
          <div className="mt-6 pt-6 border-t" style={{ borderColor: 'rgba(212,175,55,0.25)' }}>
            <a
              href="/faq"
              onClick={(e) => { e.preventDefault(); navigate('/faq'); }}
              className="inline-flex items-center gap-1.5 text-sm font-medium hover:underline transition-opacity hover:opacity-80"
              data-testid="footer-faq-link"
            >
              {t('footer.faq')} →
            </a>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Home;