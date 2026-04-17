import React, { useState, useEffect, useContext } from 'react';
import { useParams, useNavigate, useLocation } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import axios from 'axios';
import { API, AuthContext } from '../App';
import { Bed, Bath, Home as HomeIcon, MapPin, User, LogIn } from 'lucide-react';

const RENTAL_TYPES = [
  { key: 'all', label: 'All' },
  { key: 'long-term', label: 'Long Term' },
  { key: 'short-term', label: 'Short Term' },
  { key: 'vacation', label: 'Vacation' },
  { key: 'storage', label: 'Storage' },
];

const ManagerPage = () => {
  const { managerId } = useParams();
  const navigate = useNavigate();
  const location = useLocation();
  const { t } = useTranslation();
  const { user } = useContext(AuthContext);
  const [data, setData] = useState(null);
  const [activeType, setActiveType] = useState('all');

  useEffect(() => {
    fetchManagerData();
  }, [managerId]);

  const fetchManagerData = async () => {
    try {
      const response = await axios.get(`${API}/manager/${managerId}/properties`);
      setData(response.data);
    } catch (error) {
      console.error('Failed to fetch manager data', error);
    }
  };

  if (!data) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <p className="text-xl">Loading...</p>
      </div>
    );
  }

  const filteredProperties = activeType === 'all'
    ? data.properties
    : data.properties.filter(p => p.rental_type === activeType);

  // Only show tabs that have properties
  const availableTypes = RENTAL_TYPES.filter(
    rt => rt.key === 'all' || data.properties.some(p => p.rental_type === rt.key)
  );

  const rentalTypeLabels = {
    'long-term': t('property.longTerm'),
    'short-term': t('property.shortTerm'),
    'vacation': t('property.vacationType'),
    'storage': t('property.storageType'),
  };

  return (
    <div className="min-h-screen" data-testid="manager-page">
      <div className="max-w-7xl mx-auto px-6 pt-28 pb-12">
        <div className="rounded-2xl p-8 border border-[#E5E5E5] mb-10" style={{ background: 'linear-gradient(135deg, #1E6A6A 0%, #2A8585 100%)' }}>
          <div className="flex items-center gap-6">
            {data.manager.business_logo ? (
              <img
                src={data.manager.business_logo.startsWith('/api') ? `${API.replace('/api', '')}${data.manager.business_logo}` : data.manager.business_logo}
                alt={`${data.manager.name} logo`}
                className="w-24 h-24 rounded-xl object-cover border-2 border-[#D4AF37]"
                data-testid="manager-logo"
              />
            ) : (
              <div className="w-24 h-24 rounded-full flex items-center justify-center" style={{ backgroundColor: 'rgba(255,255,255,0.15)' }}>
                <User size={48} style={{ color: '#D4AF37' }} />
              </div>
            )}
            <div>
              <h1 className="text-4xl font-bold mb-2 text-white" style={{ fontFamily: 'Playfair Display' }} data-testid="manager-name">
                {data.manager.name}
              </h1>
              <p className="mt-2 text-sm" style={{ color: '#D4AF37' }}>
                {data.properties.length} {data.properties.length === 1 ? 'Property' : 'Properties'} Available
              </p>
            </div>
          </div>
        </div>

        {/* Rental Type Tabs */}
        {availableTypes.length > 2 && (
          <div className="flex flex-wrap gap-3 mb-8" data-testid="rental-type-tabs">
            {availableTypes.map(rt => (
              <button
                key={rt.key}
                onClick={() => setActiveType(rt.key)}
                className="px-5 py-2.5 rounded-full text-sm font-semibold tracking-wide transition-all duration-200"
                style={{
                  backgroundColor: activeType === rt.key ? '#1E6A6A' : 'transparent',
                  color: activeType === rt.key ? '#D4AF37' : '#1E6A6A',
                  border: activeType === rt.key ? '1.5px solid #1E6A6A' : '1.5px solid #d0d0d0',
                }}
                data-testid={`tab-${rt.key}`}
              >
                {rt.key === 'all' ? 'All Properties' : (rentalTypeLabels[rt.key] || rt.label)}
                {rt.key !== 'all' && (
                  <span className="ml-2 text-xs opacity-60">
                    ({data.properties.filter(p => p.rental_type === rt.key).length})
                  </span>
                )}
              </button>
            ))}
          </div>
        )}

        <h2 className="text-3xl font-bold mb-8" style={{ fontFamily: 'Playfair Display' }} data-testid="properties-heading">
          {activeType === 'all' ? 'Available Properties' : (rentalTypeLabels[activeType] || activeType)}
        </h2>

        <div className="grid grid-cols-2 md:grid-cols-2 lg:grid-cols-3 gap-3 md:gap-8">
          {filteredProperties.map((property) => (
            <div
              key={property.id}
              className="property-card"
              onClick={() => {
                sessionStorage.setItem('previousPath', window.location.pathname);
                navigate(`/property/${property.id}`);
              }}
              data-testid={`manager-property-${property.id}`}
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
                  <span className="text-base md:text-2xl font-bold" style={{ color: '#D4AF37' }}>
                    {property.currency === 'USD' ? '$' : '₪'}{(property.monthly_price || property.nightly_price || 0).toLocaleString()}
                    <span className="text-[10px] md:text-sm font-normal text-gray-600">
                      {property.rental_type === 'vacation' ? t('property.perNight') : t('property.perMonth')}
                    </span>
                  </span>
                  <span className="hidden md:inline text-sm px-3 py-1 rounded-full" style={{ backgroundColor: '#E5E5E5', color: '#1E6A6A' }}>
                    {rentalTypeLabels[property.rental_type] || property.rental_type}
                  </span>
                </div>
              </div>
            </div>
          ))}
        </div>

        {filteredProperties.length === 0 && (
          <div className="text-center py-16">
            <p className="text-xl text-gray-600">
              {activeType === 'all' ? 'No properties available at the moment.' : `No ${rentalTypeLabels[activeType] || activeType} properties available.`}
            </p>
          </div>
        )}
      </div>
    </div>
  );
};

export default ManagerPage;
