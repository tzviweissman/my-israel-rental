import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import axios from 'axios';
import { API } from '../App';
import { Search, Bed, Bath, Home as HomeIcon, MapPin, Filter, Building2, X, ChevronDown, ChevronUp } from 'lucide-react';

const Properties = () => {
  const { type } = useParams();
  const { t } = useTranslation();
  const navigate = useNavigate();
  const [properties, setProperties] = useState([]);
  const [filters, setFilters] = useState({
    rental_type: type !== 'all' ? type : '',
    min_bedrooms: '',
    max_price: '',
    area: '',
    min_bathrooms: '',
    max_floor: '',
    min_porches: '',
    has_elevator: '',
    condition: ''
  });
  const [showFilters, setShowFilters] = useState(false);

  useEffect(() => {
    setFilters(prev => ({ ...prev, rental_type: type !== 'all' ? type : '' }));
  }, [type]);

  useEffect(() => {
    fetchProperties();
  }, [type]);

  const fetchProperties = async () => {
    try {
      const params = new URLSearchParams();
      if (filters.rental_type && filters.rental_type !== 'all') params.append('rental_type', filters.rental_type);
      if (filters.min_bedrooms) params.append('min_bedrooms', filters.min_bedrooms);
      if (filters.max_price) params.append('max_price', filters.max_price);
      if (filters.area) params.append('area', filters.area);
      if (filters.min_bathrooms) params.append('min_bathrooms', filters.min_bathrooms);
      if (filters.max_floor) params.append('max_floor', filters.max_floor);
      if (filters.min_porches) params.append('min_porches', filters.min_porches);
      if (filters.has_elevator === 'true') params.append('has_elevator', 'true');
      if (filters.condition) params.append('condition', filters.condition);

      const response = await axios.get(`${API}/properties?${params.toString()}`);
      setProperties(response.data);
    } catch (error) {
      console.error('Failed to fetch properties', error);
    }
  };

  const handleFilterChange = (key, value) => {
    setFilters({ ...filters, [key]: value });
  };

  const applyFilters = () => {
    fetchProperties();
    setShowFilters(false);
  };

  const clearFilters = () => {
    setFilters({
      rental_type: type !== 'all' ? type : '',
      min_bedrooms: '',
      max_price: '',
      area: '',
      min_bathrooms: '',
      max_floor: '',
      min_porches: '',
      has_elevator: '',
      condition: ''
    });
  };

  const activeFilterCount = Object.entries(filters).filter(([k, v]) => v && k !== 'rental_type').length;

  const rentalTypeLabel = {
    'long-term': t('property.longTerm'),
    'short-term': t('property.shortTerm'),
    'vacation': t('property.vacationType'),
    'storage': t('property.storageType'),
    'all': t('filters.allProperties')
  };

  return (
    <div className="min-h-screen">
      <div className="max-w-7xl mx-auto px-6 py-12">
        <div className="flex items-center justify-between mb-8">
          <h1 className="text-4xl font-bold" style={{ fontFamily: 'Playfair Display' }} data-testid="properties-title">
            {rentalTypeLabel[type] || t('filters.allProperties')}
          </h1>
          <button
            onClick={() => setShowFilters(!showFilters)}
            className="secondary-btn flex items-center gap-2"
            data-testid="filter-toggle-button"
          >
            <Filter size={18} />
            {t('filters.filters')}
            {activeFilterCount > 0 && (
              <span className="w-5 h-5 rounded-full text-xs flex items-center justify-center font-bold" style={{ backgroundColor: '#D4AF37', color: '#000' }}>
                {activeFilterCount}
              </span>
            )}
            {showFilters ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
          </button>
        </div>

        {showFilters && (
          <div className="bg-white rounded-2xl p-6 border border-[#E5E5E5] mb-8" data-testid="filters-panel">
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-4">
              {/* Property Location */}
              <div>
                <label className="block text-xs font-semibold text-gray-500 uppercase mb-1.5">{t('property.propertyLocation')}</label>
                <select
                  value={filters.area}
                  onChange={(e) => handleFilterChange('area', e.target.value)}
                  className="w-full px-3 py-2.5 rounded-lg border border-[#E5E5E5] focus:outline-none focus:ring-2 focus:ring-[#000000]/20 text-sm"
                  data-testid="filter-area-input"
                >
                  <option value="">{t('filters.anyLocation')}</option>
                  <optgroup label="Jerusalem">
                    {['Abu Tor','Arnona','Arzei HaBira','Baka','Bayit VeGan','Beit HaKerem','French Hill','Geula','German Colony','Gilo','Givat HaMivtar','Givat Shaul','Har Nof','Jewish Quarter','Katamon','Kiryat HaYovel','Kiryat Moshe','Maalot Dafna','Mamilla','Mea Shearim','Nachlaot','Neve Yaakov','Old City','Pisgat Zeev','Ramat Eshkol','Ramat Shlomo','Ramot','Rehavia','Sanhedria','Talbiya','Talpiot'].map(n => <option key={n} value={`Jerusalem - ${n}`}>{n}</option>)}
                  </optgroup>
                  <optgroup label="Tel Aviv">
                    {['City Center','Florentin','Jaffa (Yafo)','Neve Tzedek','Old North','Ramat Aviv','Ramat HaHayal','Sarona','Shapira','White City','Yad Eliyahu'].map(n => <option key={n} value={`Tel Aviv - ${n}`}>{n}</option>)}
                  </optgroup>
                  <optgroup label="Haifa">
                    {['Ahuza','Carmel Center','German Colony','Hadar HaCarmel','Neve Sha\'anan','Stella Maris','Wadi Nisnas'].map(n => <option key={n} value={`Haifa - ${n}`}>{n}</option>)}
                  </optgroup>
                  <optgroup label="Other">
                    {['Ashdod','Ashkelon','Bat Yam','Beersheba','Beit Shemesh','Bnei Brak','Eilat','Herzliya','Kfar Saba','Modiin','Netanya','Petah Tikva','Raanana','Ramat Gan','Rehovot','Rishon LeZion'].map(n => <option key={n} value={n}>{n}</option>)}
                  </optgroup>
                </select>
              </div>

              {/* Max Price */}
              <div>
                <label className="block text-xs font-semibold text-gray-500 uppercase mb-1.5">{t('filters.maxPrice')}</label>
                <input
                  type="number"
                  value={filters.max_price}
                  onChange={(e) => handleFilterChange('max_price', e.target.value)}
                  min="0"
                  placeholder={t('filters.anyPrice')}
                  className="w-full px-3 py-2.5 rounded-lg border border-[#E5E5E5] focus:outline-none focus:ring-2 focus:ring-[#000000]/20 text-sm"
                  data-testid="filter-price-input"
                />
              </div>

              {/* Min Bedrooms */}
              <div>
                <label className="block text-xs font-semibold text-gray-500 uppercase mb-1.5">{t('filters.minBedrooms')}</label>
                <select
                  value={filters.min_bedrooms}
                  onChange={(e) => handleFilterChange('min_bedrooms', e.target.value)}
                  className="w-full px-3 py-2.5 rounded-lg border border-[#E5E5E5] focus:outline-none focus:ring-2 focus:ring-[#000000]/20 text-sm"
                  data-testid="filter-bedrooms-input"
                >
                  <option value="">{t('filters.any')}</option>
                  <option value="1">1+</option>
                  <option value="2">2+</option>
                  <option value="3">3+</option>
                  <option value="4">4+</option>
                  <option value="5">5+</option>
                </select>
              </div>

              {/* Min Bathrooms */}
              <div>
                <label className="block text-xs font-semibold text-gray-500 uppercase mb-1.5">{t('filters.minBathrooms')}</label>
                <select
                  value={filters.min_bathrooms}
                  onChange={(e) => handleFilterChange('min_bathrooms', e.target.value)}
                  className="w-full px-3 py-2.5 rounded-lg border border-[#E5E5E5] focus:outline-none focus:ring-2 focus:ring-[#000000]/20 text-sm"
                  data-testid="filter-bathrooms-input"
                >
                  <option value="">{t('filters.any')}</option>
                  <option value="1">1+</option>
                  <option value="1.5">1.5+</option>
                  <option value="2">2+</option>
                  <option value="3">3+</option>
                </select>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-5">
              {/* Max Floor */}
              <div>
                <label className="block text-xs font-semibold text-gray-500 uppercase mb-1.5">{t('filters.maxFloor')}</label>
                <select
                  value={filters.max_floor}
                  onChange={(e) => handleFilterChange('max_floor', e.target.value)}
                  className="w-full px-3 py-2.5 rounded-lg border border-[#E5E5E5] focus:outline-none focus:ring-2 focus:ring-[#000000]/20 text-sm"
                  data-testid="filter-floor-input"
                >
                  <option value="">{t('filters.any')}</option>
                  <option value="0">{t('property.groundFloor')}</option>
                  <option value="2">{t('filters.upTo')} 2</option>
                  <option value="5">{t('filters.upTo')} 5</option>
                  <option value="10">{t('filters.upTo')} 10</option>
                  <option value="15">{t('filters.upTo')} 15</option>
                  <option value="20">{t('filters.upTo')} 20+</option>
                </select>
              </div>

              {/* Min Porches */}
              <div>
                <label className="block text-xs font-semibold text-gray-500 uppercase mb-1.5">{t('filters.minPorches')}</label>
                <select
                  value={filters.min_porches}
                  onChange={(e) => handleFilterChange('min_porches', e.target.value)}
                  className="w-full px-3 py-2.5 rounded-lg border border-[#E5E5E5] focus:outline-none focus:ring-2 focus:ring-[#000000]/20 text-sm"
                  data-testid="filter-porches-input"
                >
                  <option value="">{t('filters.any')}</option>
                  <option value="1">1+</option>
                  <option value="2">2+</option>
                  <option value="3">3+</option>
                </select>
              </div>

              {/* Elevator */}
              <div>
                <label className="block text-xs font-semibold text-gray-500 uppercase mb-1.5">{t('property.elevator')}</label>
                <select
                  value={filters.has_elevator}
                  onChange={(e) => handleFilterChange('has_elevator', e.target.value)}
                  className="w-full px-3 py-2.5 rounded-lg border border-[#E5E5E5] focus:outline-none focus:ring-2 focus:ring-[#000000]/20 text-sm"
                  data-testid="filter-elevator-input"
                >
                  <option value="">{t('filters.any')}</option>
                  <option value="true">{t('filters.yes')}</option>
                </select>
              </div>

              {/* Condition */}
              <div>
                <label className="block text-xs font-semibold text-gray-500 uppercase mb-1.5">{t('property.condition')}</label>
                <select
                  value={filters.condition}
                  onChange={(e) => handleFilterChange('condition', e.target.value)}
                  className="w-full px-3 py-2.5 rounded-lg border border-[#E5E5E5] focus:outline-none focus:ring-2 focus:ring-[#000000]/20 text-sm"
                  data-testid="filter-condition-input"
                >
                  <option value="">{t('filters.any')}</option>
                  <option value="renovated">{t('property.renovated')}</option>
                  <option value="partially_renovated">{t('property.partiallyRenovated')}</option>
                  <option value="good">{t('property.goodCondition')}</option>
                </select>
              </div>
            </div>

            <div className="flex items-center gap-3">
              <button onClick={applyFilters} className="primary-btn" data-testid="apply-filters-button">
                {t('filters.apply')}
              </button>
              <button onClick={() => { clearFilters(); fetchProperties(); }} className="text-sm text-gray-500 hover:text-black transition-colors flex items-center gap-1" data-testid="clear-filters-button">
                <X size={14} />
                {t('filters.clear')}
              </button>
              <span className="text-sm text-gray-400 ml-auto">{properties.length} {t('filters.results')}</span>
            </div>
          </div>
        )}

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
          {properties.map((property) => (
            <div
              key={property.id}
              className="property-card"
              onClick={() => navigate(`/property/${property.id}`)}
              data-testid={`property-card-${property.id}`}
            >
              <div className="h-64 bg-gray-200" style={{
                backgroundImage: `url(${property.images?.[0] ? (property.images[0].startsWith('/api') ? `${API.replace('/api', '')}${property.images[0]}` : property.images[0]) : 'https://images.pexels.com/photos/1669799/pexels-photo-1669799.jpeg?auto=compress&cs=tinysrgb&dpr=2&h=650&w=940'})`,
                backgroundSize: 'cover',
                backgroundPosition: 'center'
              }}></div>
              <div className="p-6">
                <h3 className="text-xl font-bold mb-2">{property.title}</h3>
                <div className="flex items-center gap-2 text-gray-600 mb-3">
                  <MapPin size={16} />
                  <span className="text-sm">{property.area}</span>
                </div>
                <div className="flex items-center gap-4 mb-4 text-sm text-gray-700">
                  {property.bedrooms > 0 && (
                    <div className="flex items-center gap-1">
                      <Bed size={16} />
                      <span>{property.bedrooms}</span>
                    </div>
                  )}
                  {property.bathrooms > 0 && (
                    <div className="flex items-center gap-1">
                      <Bath size={16} />
                      <span>{property.bathrooms}</span>
                    </div>
                  )}
                  {property.square_meters > 0 && (
                    <div className="flex items-center gap-1">
                      <HomeIcon size={16} />
                      <span>{property.square_meters} m²</span>
                    </div>
                  )}
                  {property.floor !== null && property.floor !== undefined && (
                    <div className="flex items-center gap-1">
                      <Building2 size={16} />
                      <span>{t('property.floor')} {property.floor}</span>
                    </div>
                  )}
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-2xl font-bold" style={{ color: "#D4AF37" }}>
                    {property.currency === 'USD' ? '$' : '₪'}{property.monthly_price || property.nightly_price}
                    <span className="text-sm font-normal text-gray-600">
                      {property.rental_type === 'vacation' ? t('property.perNight') : t('property.perMonth')}
                    </span>
                  </span>
                  <span className="text-sm px-3 py-1 rounded-full" style={{ backgroundColor: '#E5E5E5', color: '#000000' }}>
                    {{'long-term': t('property.longTerm'), 'short-term': t('property.shortTerm'), 'vacation': t('property.vacationType'), 'storage': t('property.storageType')}[property.rental_type] || property.rental_type}
                  </span>
                </div>
              </div>
            </div>
          ))}
        </div>

        {properties.length === 0 && (
          <div className="text-center py-16">
            <p className="text-xl text-gray-600">{t('filters.noResults')}</p>
          </div>
        )}
      </div>
    </div>
  );
};

export default Properties;
