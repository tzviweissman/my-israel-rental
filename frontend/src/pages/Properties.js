import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import axios from 'axios';
import { API } from '../App';
import { Search, Bed, Bath, Home as HomeIcon, MapPin, Filter, Building2, X, ChevronDown, ChevronUp, Calendar as CalendarIcon } from 'lucide-react';
import { Calendar } from '../components/ui/calendar';
import { Popover, PopoverContent, PopoverTrigger } from '../components/ui/popover';
import { format } from 'date-fns';

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
    condition: '',
    date_from: '',
    date_to: ''
  });
  const [showFilters, setShowFilters] = useState(false);
  const [dateRange, setDateRange] = useState({ from: undefined, to: undefined });

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
      if (filters.date_from) params.append('date_from', filters.date_from);
      if (filters.date_to) params.append('date_to', filters.date_to);

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
    const cleared = {
      rental_type: type !== 'all' ? type : '',
      min_bedrooms: '',
      max_price: '',
      area: '',
      min_bathrooms: '',
      max_floor: '',
      min_porches: '',
      has_elevator: '',
      condition: '',
      date_from: '',
      date_to: ''
    };
    setFilters(cleared);
    setDateRange({ from: undefined, to: undefined });
    // Fetch with cleared filters directly to avoid stale state
    const params = new URLSearchParams();
    if (cleared.rental_type && cleared.rental_type !== 'all') params.append('rental_type', cleared.rental_type);
    axios.get(`${API}/properties?${params.toString()}`).then(res => setProperties(res.data)).catch(() => {});
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

            {/* Dates Available Row */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-5">
              <div className="lg:col-span-2">
                <label className="block text-xs font-semibold text-gray-500 uppercase mb-1.5">{t('filters.datesAvailable')}</label>
                <Popover>
                  <PopoverTrigger asChild>
                    <button
                      className="w-full px-3 py-2.5 rounded-lg border border-[#E5E5E5] focus:outline-none focus:ring-2 focus:ring-[#D4AF37]/30 text-sm flex items-center gap-2 bg-white hover:border-[#D4AF37] transition-colors text-left"
                      data-testid="filter-date-picker-trigger"
                    >
                      <CalendarIcon size={16} className="text-[#D4AF37] shrink-0" />
                      {dateRange.from ? (
                        <span className="text-gray-800">
                          {format(dateRange.from, 'MMM d, yyyy')}
                          {dateRange.to && (
                            <span className="text-[#D4AF37] font-medium mx-1.5">&#8594;</span>
                          )}
                          {dateRange.to && format(dateRange.to, 'MMM d, yyyy')}
                        </span>
                      ) : (
                        <span className="text-gray-400">{t('filters.startDate')} — {t('filters.endDate')}</span>
                      )}
                      {dateRange.from && (
                        <span
                          role="button"
                          className="ml-auto text-gray-400 hover:text-gray-700 transition-colors"
                          onClick={(e) => {
                            e.stopPropagation();
                            setDateRange({ from: undefined, to: undefined });
                            handleFilterChange('date_from', '');
                            handleFilterChange('date_to', '');
                          }}
                          data-testid="filter-date-clear"
                        >
                          <X size={14} />
                        </span>
                      )}
                    </button>
                  </PopoverTrigger>
                  <PopoverContent
                    className="w-auto p-0 border-0 shadow-xl rounded-xl overflow-hidden"
                    align="start"
                    sideOffset={8}
                    style={{ minWidth: '580px' }}
                  >
                    <div className="bg-[#1a1a1a] text-white px-4 py-3 flex items-center justify-between">
                      <span className="text-sm font-semibold tracking-wide">{t('filters.datesAvailable')}</span>
                      {dateRange.from && dateRange.to && (
                        <span className="text-xs px-2 py-0.5 rounded-full bg-[#D4AF37]/20 text-[#D4AF37]">
                          {Math.ceil((dateRange.to - dateRange.from) / (1000 * 60 * 60 * 24))} {t('property.nights')}
                        </span>
                      )}
                    </div>
                    <Calendar
                      mode="range"
                      selected={dateRange}
                      onSelect={(range) => {
                        setDateRange(range || { from: undefined, to: undefined });
                        if (range?.from) {
                          handleFilterChange('date_from', format(range.from, 'yyyy-MM-dd'));
                        } else {
                          handleFilterChange('date_from', '');
                        }
                        if (range?.to) {
                          handleFilterChange('date_to', format(range.to, 'yyyy-MM-dd'));
                        } else {
                          handleFilterChange('date_to', '');
                        }
                      }}
                      numberOfMonths={2}
                      disabled={{ before: new Date() }}
                      className="bg-white"
                      classNames={{
                        months: "flex flex-col sm:flex-row gap-0 divide-x divide-[#E5E5E5]",
                        month: "p-4",
                        caption: "flex justify-center pt-1 relative items-center mb-2",
                        caption_label: "text-sm font-bold text-[#1a1a1a]",
                        nav: "space-x-1 flex items-center",
                        nav_button: "h-7 w-7 bg-transparent border border-[#E5E5E5] rounded-md p-0 opacity-60 hover:opacity-100 hover:border-[#D4AF37] transition-all inline-flex items-center justify-center",
                        nav_button_previous: "absolute left-1",
                        nav_button_next: "absolute right-1",
                        table: "w-full border-collapse",
                        head_row: "flex",
                        head_cell: "text-[#D4AF37] rounded-md w-9 font-semibold text-[0.7rem] uppercase",
                        row: "flex w-full mt-1",
                        cell: "relative p-0 text-center text-sm focus-within:relative focus-within:z-20 [&:has([aria-selected])]:bg-[#D4AF37]/10 [&:has([aria-selected].day-outside)]:bg-[#D4AF37]/5 [&:has([aria-selected].day-range-end)]:rounded-r-md [&:has(>.day-range-end)]:rounded-r-md [&:has(>.day-range-start)]:rounded-l-md first:[&:has([aria-selected])]:rounded-l-md last:[&:has([aria-selected])]:rounded-r-md",
                        day: "h-9 w-9 p-0 font-normal rounded-md hover:bg-[#D4AF37]/10 transition-colors inline-flex items-center justify-center aria-selected:opacity-100 cursor-pointer",
                        day_range_start: "day-range-start bg-[#1a1a1a] text-white hover:bg-[#1a1a1a] rounded-l-md",
                        day_range_end: "day-range-end bg-[#1a1a1a] text-white hover:bg-[#1a1a1a] rounded-r-md",
                        day_selected: "bg-[#1a1a1a] text-white hover:bg-[#1a1a1a] focus:bg-[#1a1a1a] focus:text-white",
                        day_today: "border border-[#D4AF37] text-[#D4AF37] font-bold",
                        day_outside: "text-gray-300 aria-selected:bg-[#D4AF37]/5 aria-selected:text-gray-400",
                        day_disabled: "text-gray-300 opacity-40 cursor-not-allowed",
                        day_range_middle: "aria-selected:bg-[#D4AF37]/10 aria-selected:text-[#1a1a1a]",
                        day_hidden: "invisible"
                      }}
                      data-testid="filter-date-calendar"
                    />
                  </PopoverContent>
                </Popover>
              </div>
            </div>

            <div className="flex items-center gap-3">
              <button onClick={applyFilters} className="primary-btn" data-testid="apply-filters-button">
                {t('filters.apply')}
              </button>
              <button onClick={clearFilters} className="text-sm text-gray-500 hover:text-black transition-colors flex items-center gap-1" data-testid="clear-filters-button">
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
