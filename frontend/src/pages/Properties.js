import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import axios from 'axios';
import { API } from '../App';
import { Search, Bed, Bath, Home as HomeIcon, MapPin, Filter } from 'lucide-react';

const Properties = () => {
  const { type } = useParams();
  const { t } = useTranslation();
  const navigate = useNavigate();
  const [properties, setProperties] = useState([]);
  const [filters, setFilters] = useState({
    rental_type: type !== 'all' ? type : '',
    min_bedrooms: '',
    max_price: '',
    area: ''
  });
  const [showFilters, setShowFilters] = useState(false);

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

  return (
    <div className="min-h-screen">
      <div className="max-w-7xl mx-auto px-6 py-12">
        <div className="flex items-center justify-between mb-8">
          <h1 className="text-4xl font-bold" style={{ fontFamily: 'Playfair Display' }} data-testid="properties-title">
            {type === 'all' ? 'All Properties' : `${type.charAt(0).toUpperCase() + type.slice(1)} Rentals`}
          </h1>
          <button
            onClick={() => setShowFilters(!showFilters)}
            className="secondary-btn flex items-center gap-2"
            data-testid="filter-toggle-button"
          >
            <Filter size={20} />
            Filters
          </button>
        </div>

        {showFilters && (
          <div className="bg-white rounded-2xl p-6 border border-[#E5E3DC] mb-8" data-testid="filters-panel">
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
              <div>
                <label className="block text-sm font-medium mb-2">Area</label>
                <input
                  type="text"
                  value={filters.area}
                  onChange={(e) => handleFilterChange('area', e.target.value)}
                  placeholder="e.g., Tel Aviv, Jerusalem"
                  className="w-full px-4 py-2 rounded-lg border border-[#E5E3DC] focus:outline-none focus:ring-2 focus:ring-[#2C4A3B]/50"
                  data-testid="filter-area-input"
                />
              </div>
              <div>
                <label className="block text-sm font-medium mb-2">Min Bedrooms</label>
                <input
                  type="number"
                  value={filters.min_bedrooms}
                  onChange={(e) => handleFilterChange('min_bedrooms', e.target.value)}
                  min="0"
                  className="w-full px-4 py-2 rounded-lg border border-[#E5E3DC] focus:outline-none focus:ring-2 focus:ring-[#2C4A3B]/50"
                  data-testid="filter-bedrooms-input"
                />
              </div>
              <div>
                <label className="block text-sm font-medium mb-2">Max Price</label>
                <input
                  type="number"
                  value={filters.max_price}
                  onChange={(e) => handleFilterChange('max_price', e.target.value)}
                  min="0"
                  className="w-full px-4 py-2 rounded-lg border border-[#E5E3DC] focus:outline-none focus:ring-2 focus:ring-[#2C4A3B]/50"
                  data-testid="filter-price-input"
                />
              </div>
              <div className="flex items-end">
                <button onClick={applyFilters} className="w-full primary-btn" data-testid="apply-filters-button">
                  Apply Filters
                </button>
              </div>
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
                backgroundImage: `url(${property.images?.[0] || 'https://images.pexels.com/photos/1669799/pexels-photo-1669799.jpeg?auto=compress&cs=tinysrgb&dpr=2&h=650&w=940'})`,
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
                  <span className="text-2xl font-bold" style={{ color: '#2C4A3B' }}>
                    ₪{property.monthly_price || property.nightly_price}
                    <span className="text-sm font-normal text-gray-600">
                      {property.rental_type === 'vacation' ? '/night' : '/month'}
                    </span>
                  </span>
                  <span className="text-sm px-3 py-1 rounded-full" style={{ backgroundColor: '#E5E3DC', color: '#2C4A3B' }}>
                    {property.rental_type}
                  </span>
                </div>
              </div>
            </div>
          ))}
        </div>

        {properties.length === 0 && (
          <div className="text-center py-16">
            <p className="text-xl text-gray-600">No properties found. Try adjusting your filters.</p>
          </div>
        )}
      </div>
    </div>
  );
};

export default Properties;