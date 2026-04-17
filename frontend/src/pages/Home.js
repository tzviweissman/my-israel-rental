import React, { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';
import axios from 'axios';
import DOMPurify from 'dompurify';
import { API } from '../App';
import { Search, Bed, Bath, Home as HomeIcon, MapPin } from 'lucide-react';

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
      <div
        className="relative h-[600px] flex items-center justify-center -mt-[210px] pt-[210px]"
        style={{
          backgroundImage: 'url(https://images.unsplash.com/photo-1547483036-24bc77c79804?crop=entropy&cs=srgb&fm=jpg&ixid=M3w4NjA2MjJ8MHwxfHNlYXJjaHwyfHxUZWwlMjBBdml2JTIwc2t5bGluZSUyMGNvYXN0bGluZSUyMGFlcmlhbCUyMHBhbm9yYW1pYyUyMHN1bnNldCUyMGRpc3RhbnQlMjB2aWV3fGVufDB8fHx8MTc3NDk5NTExMHww&ixlib=rb-4.1.0&q=85)',
          backgroundSize: 'cover',
          backgroundPosition: 'center'
        }}
        data-testid="hero-section"
      >
        <div className="absolute inset-0 bg-black/30"></div>
        <div className="relative z-10 text-center text-white px-6 max-w-4xl mt-24 md:mt-0">
          <h1 className="text-4xl sm:text-5xl lg:text-6xl font-bold mb-2" style={{ fontFamily: 'Playfair Display', color: 'white' }}>
            {t('hero.title')}
          </h1>
          <p className="text-3xl sm:text-4xl lg:text-5xl font-bold mb-8" style={{ fontFamily: 'Playfair Display', color: '#D4AF37' }}>
          {t('hero.anyDuration')}
          </p>
          <div className="flex gap-2 max-w-2xl mx-auto">
            <input
              type="text"
              placeholder={t('hero.searchPlaceholder')}
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              onKeyPress={(e) => e.key === 'Enter' && handleSearch()}
              className="flex-1 px-6 py-4 rounded-full text-gray-800 focus:outline-none focus:ring-2 focus:ring-[#1E6A6A]"
              data-testid="hero-search-input"
            />
            <button onClick={handleSearch} className="primary-btn flex items-center gap-2" style={{ color: '#FFFFFF' }} data-testid="hero-search-button">
              <Search size={20} />
              {t('hero.search')}
            </button>
          </div>
        </div>
      </div>

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
              <div className="h-36 md:h-64 bg-gray-200" style={{
                backgroundImage: `url(${property.images?.[0] || 'https://images.pexels.com/photos/1669799/pexels-photo-1669799.jpeg?auto=compress&cs=tinysrgb&dpr=2&h=650&w=940'})`,
                backgroundSize: 'cover',
                backgroundPosition: 'center'
              }}></div>
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
            {t('footer.phone')}: <a href="tel:+972553225141" className="font-bold hover:underline">+972 55 322 5141</a>
          </p>
          <p className="text-lg">
            {t('home.email')}: <a href="mailto:mir@myisraelrental.com" className="font-bold hover:underline">mir@myisraelrental.com</a>
          </p>
        </div>
      </div>
    </div>
  );
};

export default Home;