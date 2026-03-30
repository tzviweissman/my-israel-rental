import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import axios from 'axios';
import { API } from '../App';
import { Bed, Bath, Home as HomeIcon, MapPin, Filter, Building2, X, ChevronDown, ChevronUp, Calendar as CalendarIcon, Minus, Plus } from 'lucide-react';
import { Calendar } from '../components/ui/calendar';
import { Popover, PopoverContent, PopoverTrigger } from '../components/ui/popover';
import { Slider } from '../components/ui/slider';
import { format } from 'date-fns';

const PRICE_MAX = 50000;

const StepperControl = ({ label, value, onDecrement, onIncrement, displayValue, testId }) => (
  <div className="flex items-center justify-between py-3">
    <span className="text-[14px] text-[#3a3a3a] tracking-wide">{label}</span>
    <div className="flex items-center gap-2.5">
      <button
        onClick={onDecrement}
        disabled={!value}
        className="w-9 h-9 rounded-full border border-[#d0d0d0] flex items-center justify-center text-[#888] hover:border-[#D4AF37] hover:text-[#D4AF37] hover:bg-[#D4AF37]/5 transition-all duration-200 disabled:opacity-20 disabled:cursor-not-allowed disabled:hover:border-[#d0d0d0] disabled:hover:text-[#888] disabled:hover:bg-transparent"
        data-testid={`${testId}-minus`}
      >
        <Minus size={14} strokeWidth={2.5} />
      </button>
      <span className="w-7 text-center text-[14px] font-semibold text-[#0B1D3A] tabular-nums" data-testid={`${testId}-value`}>
        {displayValue}
      </span>
      <button
        onClick={onIncrement}
        className="w-9 h-9 rounded-full border border-[#d0d0d0] flex items-center justify-center text-[#888] hover:border-[#D4AF37] hover:text-[#D4AF37] hover:bg-[#D4AF37]/5 transition-all duration-200"
        data-testid={`${testId}-plus`}
      >
        <Plus size={14} strokeWidth={2.5} />
      </button>
    </div>
  </div>
);

const Properties = () => {
  const { type } = useParams();
  const { t } = useTranslation();
  const navigate = useNavigate();
  const [properties, setProperties] = useState([]);
  const [filters, setFilters] = useState({
    rental_type: type !== 'all' ? type : '',
    min_bedrooms: '',
    max_price: '',
    min_price: '',
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
  const [priceRange, setPriceRange] = useState([0, PRICE_MAX]);
  const [priceCurrency, setPriceCurrency] = useState('ILS');
  const [exchangeRate, setExchangeRate] = useState(null);

  useEffect(() => {
    axios.get(`${API}/exchange-rate`).then(res => setExchangeRate(res.data)).catch(() => setExchangeRate({ usd_to_ils: 3.65, ils_to_usd: 0.274 }));
  }, []);

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
      if (filters.min_price) params.append('min_price', filters.min_price);
      if (filters.area) params.append('area', filters.area);
      if (filters.min_bathrooms) params.append('min_bathrooms', filters.min_bathrooms);
      if (filters.max_floor) params.append('max_floor', filters.max_floor);
      if (filters.min_porches) params.append('min_porches', filters.min_porches);
      if (filters.has_elevator === 'true') params.append('has_elevator', 'true');
      if (filters.condition) params.append('condition', filters.condition);
      if (filters.date_from) params.append('date_from', filters.date_from);
      if (filters.date_to) params.append('date_to', filters.date_to);
      if (filters.min_price || filters.max_price) params.append('currency', priceCurrency);

      const response = await axios.get(`${API}/properties?${params.toString()}`);
      setProperties(response.data);
    } catch (error) {
      console.error('Failed to fetch properties', error);
    }
  };

  const handleFilterChange = (key, value) => {
    setFilters(prev => ({ ...prev, [key]: value }));
  };

  const applyFilters = () => {
    fetchProperties();
    setShowFilters(false);
  };

  const convertPrice = (price, fromCurrency) => {
    if (!exchangeRate || !price) return null;
    if (fromCurrency === 'USD') return { amount: Math.round(price * exchangeRate.usd_to_ils), symbol: '₪' };
    return { amount: Math.round(price * exchangeRate.ils_to_usd), symbol: '$' };
  };

  const clearFilters = () => {
    const cleared = {
      rental_type: type !== 'all' ? type : '',
      min_bedrooms: '',
      max_price: '',
      min_price: '',
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
    setPriceRange([0, PRICE_MAX]);
    setPriceCurrency('ILS');
    const params = new URLSearchParams();
    if (cleared.rental_type && cleared.rental_type !== 'all') params.append('rental_type', cleared.rental_type);
    axios.get(`${API}/properties?${params.toString()}`).then(res => setProperties(res.data)).catch(() => {});
  };

  const handlePriceSliderChange = (values) => {
    setPriceRange(values);
    handleFilterChange('min_price', values[0] > 0 ? String(values[0]) : '');
    handleFilterChange('max_price', values[1] < PRICE_MAX ? String(values[1]) : '');
  };

  const stepValue = (key, direction, max = 10, step = 1) => {
    const current = filters[key] ? Number(filters[key]) : 0;
    const next = Math.round((current + direction * step) * 10) / 10;
    if (next < 0) return;
    if (next > max) return;
    handleFilterChange(key, next === 0 ? '' : String(next));
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
            className="flex items-center gap-2 px-5 py-2.5 rounded-xl text-sm font-semibold tracking-wide transition-all duration-200 hover:shadow-md active:scale-[0.98]"
            style={{ 
              backgroundColor: showFilters ? '#0B1D3A' : '#fafaf8', 
              color: showFilters ? '#D4AF37' : '#0B1D3A',
              border: showFilters ? '1.5px solid #0B1D3A' : '1.5px solid #e0dcd4'
            }}
            data-testid="filter-toggle-button"
          >
            <Filter size={16} />
            {t('filters.filters')}
            {activeFilterCount > 0 && (
              <span className="w-5 h-5 rounded-full text-[10px] flex items-center justify-center font-bold bg-[#D4AF37] text-[#0B1D3A]">
                {activeFilterCount}
              </span>
            )}
          </button>
        </div>

        {showFilters && (
          <div className="mb-8 rounded-2xl overflow-hidden" style={{ border: '1px solid #e0dcd4', boxShadow: '0 8px 40px rgba(0,0,0,0.08), 0 1px 3px rgba(0,0,0,0.04)' }} data-testid="filters-panel">
            {/* Header */}
            <div className="px-7 py-4 flex items-center justify-between" style={{ background: 'linear-gradient(135deg, #0B1D3A 0%, #142d54 100%)' }}>
              <div className="flex items-center gap-2.5">
                <Filter size={16} className="text-[#D4AF37]" />
                <span className="text-[13px] font-semibold tracking-[0.08em] uppercase text-white/90">{t('filters.filters')}</span>
                {activeFilterCount > 0 && (
                  <span className="ml-1 w-5 h-5 rounded-full text-[10px] flex items-center justify-center font-bold bg-[#D4AF37] text-[#0B1D3A]">
                    {activeFilterCount}
                  </span>
                )}
              </div>
              <button onClick={() => setShowFilters(false)} className="text-white/50 hover:text-white transition-colors">
                <X size={18} />
              </button>
            </div>

            <div className="bg-[#fafaf8]">
              <div className="grid grid-cols-1 lg:grid-cols-2">
                {/* Left Column */}
                <div className="lg:border-r" style={{ borderColor: '#e8e4dc' }}>
                  {/* Price Range Section */}
                  <div className="px-7 pt-6 pb-5" data-testid="filter-price-section">
                    <div className="flex items-center justify-between mb-1">
                      <h3 className="text-[13px] font-bold tracking-[0.06em] uppercase text-[#0B1D3A]">{t('filters.priceRange')}</h3>
                      <div className="flex rounded-lg overflow-hidden" style={{ border: '1.5px solid #d0ccc4' }} data-testid="filter-currency-toggle">
                        <button
                          onClick={() => { setPriceCurrency('ILS'); setPriceRange([0, PRICE_MAX]); handleFilterChange('min_price', ''); handleFilterChange('max_price', ''); }}
                          className={`px-3 py-1 text-xs font-bold tracking-wider transition-all duration-200 ${priceCurrency === 'ILS' ? 'bg-[#0B1D3A] text-[#D4AF37]' : 'bg-transparent text-[#999] hover:text-[#666]'}`}
                          data-testid="filter-currency-ils"
                        >
                          ₪ ILS
                        </button>
                        <div className="w-px bg-[#d0ccc4]" />
                        <button
                          onClick={() => { setPriceCurrency('USD'); setPriceRange([0, PRICE_MAX]); handleFilterChange('min_price', ''); handleFilterChange('max_price', ''); }}
                          className={`px-3 py-1 text-xs font-bold tracking-wider transition-all duration-200 ${priceCurrency === 'USD' ? 'bg-[#0B1D3A] text-[#D4AF37]' : 'bg-transparent text-[#999] hover:text-[#666]'}`}
                          data-testid="filter-currency-usd"
                        >
                          $ USD
                        </button>
                      </div>
                    </div>
                    <p className="text-[11px] text-[#999] tracking-wide mb-5">{t('filters.priceSubtitle')}</p>
                    
                    <div className="px-1 mb-5">
                      <Slider
                        value={priceRange}
                        onValueChange={handlePriceSliderChange}
                        min={0}
                        max={PRICE_MAX}
                        step={100}
                        className="[&_[role=slider]]:h-5 [&_[role=slider]]:w-5 [&_[role=slider]]:border-[2.5px] [&_[role=slider]]:border-[#0B1D3A] [&_[role=slider]]:bg-white [&_[role=slider]]:shadow-md [&_[role=slider]]:hover:shadow-lg [&_[role=slider]]:hover:scale-110 [&_[role=slider]]:transition-all [&_.bg-primary\\/20]:bg-[#e0dcd4] [&_.bg-primary\\/20]:h-[3px] [&_.bg-primary]:bg-[#D4AF37] [&_.bg-primary]:h-[3px]"
                        data-testid="filter-price-slider"
                      />
                    </div>
                    
                    <div className="flex items-center gap-3">
                      <div className="flex-1">
                        <label className="text-[10px] font-semibold text-[#aaa] uppercase tracking-wider mb-1 block">{t('filters.minimum')}</label>
                        <div className="flex items-center rounded-lg px-3.5 py-2.5 bg-white transition-all duration-200 hover:shadow-sm" style={{ border: '1.5px solid #e0dcd4' }}>
                          <span className="text-sm font-bold text-[#D4AF37] mr-1.5">{priceCurrency === 'USD' ? '$' : '₪'}</span>
                          <input
                            type="number"
                            value={priceRange[0] || ''}
                            onChange={(e) => {
                              const val = Number(e.target.value) || 0;
                              const newRange = [Math.min(val, priceRange[1]), priceRange[1]];
                              setPriceRange(newRange);
                              handleFilterChange('min_price', val > 0 ? String(val) : '');
                            }}
                            placeholder="0"
                            className="w-full text-sm font-medium bg-transparent outline-none text-[#0B1D3A] placeholder:text-[#ccc]"
                            data-testid="filter-price-min-input"
                          />
                        </div>
                      </div>
                      <div className="w-4 h-px bg-[#d0ccc4] mt-5" />
                      <div className="flex-1">
                        <label className="text-[10px] font-semibold text-[#aaa] uppercase tracking-wider mb-1 block">{t('filters.maximum')}</label>
                        <div className="flex items-center rounded-lg px-3.5 py-2.5 bg-white transition-all duration-200 hover:shadow-sm" style={{ border: '1.5px solid #e0dcd4' }}>
                          <span className="text-sm font-bold text-[#D4AF37] mr-1.5">{priceCurrency === 'USD' ? '$' : '₪'}</span>
                          <input
                            type="number"
                            value={priceRange[1] >= PRICE_MAX ? '' : priceRange[1]}
                            onChange={(e) => {
                              const val = Number(e.target.value) || PRICE_MAX;
                              const newRange = [priceRange[0], Math.max(val, priceRange[0])];
                              setPriceRange(newRange);
                              handleFilterChange('max_price', val < PRICE_MAX ? String(val) : '');
                            }}
                            placeholder={`${PRICE_MAX.toLocaleString()}+`}
                            className="w-full text-sm font-medium bg-transparent outline-none text-[#0B1D3A] placeholder:text-[#ccc]"
                            data-testid="filter-price-max-input"
                          />
                        </div>
                      </div>
                    </div>
                  </div>

                  <div className="mx-7 border-t" style={{ borderColor: '#e8e4dc' }} />

                  {/* Rooms & Details Section */}
                  <div className="px-7 py-5" data-testid="filter-rooms-section">
                    <h3 className="text-[13px] font-bold tracking-[0.06em] uppercase text-[#0B1D3A] mb-1">{t('filters.roomsAndDetails')}</h3>
                    
                    <StepperControl
                      label={t('property.bedrooms')}
                      value={filters.min_bedrooms ? Number(filters.min_bedrooms) : 0}
                      onDecrement={() => stepValue('min_bedrooms', -1, 8, 0.5)}
                      onIncrement={() => stepValue('min_bedrooms', 1, 8, 0.5)}
                      displayValue={filters.min_bedrooms || t('filters.any')}
                      testId="filter-bedrooms"
                    />
                    <div className="border-t" style={{ borderColor: '#f0ece4' }} />
                    <StepperControl
                      label={t('property.bathrooms')}
                      value={filters.min_bathrooms ? Number(filters.min_bathrooms) : 0}
                      onDecrement={() => stepValue('min_bathrooms', -1, 5, 0.5)}
                      onIncrement={() => stepValue('min_bathrooms', 1, 5, 0.5)}
                      displayValue={filters.min_bathrooms || t('filters.any')}
                      testId="filter-bathrooms"
                    />
                    <div className="border-t" style={{ borderColor: '#f0ece4' }} />
                    <StepperControl
                      label={t('property.porches')}
                      value={filters.min_porches ? Number(filters.min_porches) : 0}
                      onDecrement={() => stepValue('min_porches', -1)}
                      onIncrement={() => stepValue('min_porches', 1, 5)}
                      displayValue={filters.min_porches || t('filters.any')}
                      testId="filter-porches"
                    />
                    <div className="border-t" style={{ borderColor: '#f0ece4' }} />
                    <StepperControl
                      label={t('filters.maxFloor')}
                      value={filters.max_floor ? Number(filters.max_floor) : 0}
                      onDecrement={() => stepValue('max_floor', -1, 30)}
                      onIncrement={() => stepValue('max_floor', 1, 30)}
                      displayValue={filters.max_floor || t('filters.any')}
                      testId="filter-floor"
                    />
                  </div>
                </div>

                {/* Right Column */}
                <div>
                  {/* Property Section */}
                  <div className="px-7 pt-6 pb-5" data-testid="filter-property-section">
                    <h3 className="text-[13px] font-bold tracking-[0.06em] uppercase text-[#0B1D3A] mb-4">{t('filters.propertySection')}</h3>
                    
                    <div className="space-y-4">
                      {/* Location */}
                      <div>
                        <label className="text-[11px] font-semibold text-[#aaa] uppercase tracking-wider mb-1.5 block">{t('property.propertyLocation')}</label>
                        <select
                          value={filters.area}
                          onChange={(e) => handleFilterChange('area', e.target.value)}
                          className="w-full px-3.5 py-2.5 rounded-lg text-sm bg-white focus:outline-none focus:shadow-sm transition-all duration-200 text-[#0B1D3A] appearance-none"
                          style={{ border: '1.5px solid #e0dcd4', backgroundImage: `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='12' height='12' viewBox='0 0 24 24' fill='none' stroke='%23D4AF37' stroke-width='2.5' stroke-linecap='round' stroke-linejoin='round'%3E%3Cpolyline points='6 9 12 15 18 9'%3E%3C/polyline%3E%3C/svg%3E")`, backgroundRepeat: 'no-repeat', backgroundPosition: 'right 12px center' }}
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

                      {/* Elevator Toggle */}
                      <div className="flex items-center justify-between py-2">
                        <span className="text-[14px] text-[#3a3a3a] tracking-wide">{t('property.elevator')}</span>
                        <button
                          onClick={() => handleFilterChange('has_elevator', filters.has_elevator === 'true' ? '' : 'true')}
                          className={`relative w-[52px] h-[28px] rounded-full transition-all duration-300 ${filters.has_elevator === 'true' ? 'bg-[#D4AF37]' : 'bg-[#d4d0c8]'}`}
                          style={{ boxShadow: 'inset 0 1px 3px rgba(0,0,0,0.15)' }}
                          data-testid="filter-elevator-toggle"
                        >
                          <span className={`absolute top-[3px] left-[3px] w-[22px] h-[22px] bg-white rounded-full shadow-md transition-transform duration-300 ${filters.has_elevator === 'true' ? 'translate-x-[24px]' : 'translate-x-0'}`} />
                        </button>
                      </div>

                      {/* Condition */}
                      <div>
                        <label className="text-[11px] font-semibold text-[#aaa] uppercase tracking-wider mb-1.5 block">{t('property.condition')}</label>
                        <select
                          value={filters.condition}
                          onChange={(e) => handleFilterChange('condition', e.target.value)}
                          className="w-full px-3.5 py-2.5 rounded-lg text-sm bg-white focus:outline-none focus:shadow-sm transition-all duration-200 text-[#0B1D3A] appearance-none"
                          style={{ border: '1.5px solid #e0dcd4', backgroundImage: `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='12' height='12' viewBox='0 0 24 24' fill='none' stroke='%23D4AF37' stroke-width='2.5' stroke-linecap='round' stroke-linejoin='round'%3E%3Cpolyline points='6 9 12 15 18 9'%3E%3C/polyline%3E%3C/svg%3E")`, backgroundRepeat: 'no-repeat', backgroundPosition: 'right 12px center' }}
                          data-testid="filter-condition-input"
                        >
                          <option value="">{t('filters.any')}</option>
                          <option value="renovated">{t('property.renovated')}</option>
                          <option value="partially_renovated">{t('property.partiallyRenovated')}</option>
                          <option value="good">{t('property.goodCondition')}</option>
                        </select>
                      </div>
                    </div>
                  </div>

                  <div className="mx-7 border-t" style={{ borderColor: '#e8e4dc' }} />

                  {/* Dates Available Section */}
                  <div className="px-7 py-5" data-testid="filter-dates-section">
                    <h3 className="text-[13px] font-bold tracking-[0.06em] uppercase text-[#0B1D3A] mb-3">{t('filters.datesAvailable')}</h3>
                    <Popover>
                      <PopoverTrigger asChild>
                        <button
                          className="w-full px-3.5 py-2.5 rounded-lg text-sm flex items-center gap-2.5 bg-white hover:shadow-sm transition-all duration-200 text-left"
                          style={{ border: '1.5px solid #e0dcd4' }}
                          data-testid="filter-date-picker-trigger"
                        >
                          <CalendarIcon size={15} className="text-[#D4AF37] shrink-0" />
                          {dateRange.from ? (
                            <span className="text-[#0B1D3A] font-medium text-[13px]">
                              {format(dateRange.from, 'MMM d, yyyy')}
                              {dateRange.to && (
                                <span className="text-[#D4AF37] font-bold mx-1.5">&#8594;</span>
                              )}
                              {dateRange.to && format(dateRange.to, 'MMM d, yyyy')}
                            </span>
                          ) : (
                            <span className="text-[#bbb] text-[13px]">{t('filters.startDate')} — {t('filters.endDate')}</span>
                          )}
                          {dateRange.from && (
                            <span
                              role="button"
                              className="ml-auto text-[#bbb] hover:text-[#666] transition-colors"
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
                        <div className="px-4 py-3 flex items-center justify-between" style={{ background: 'linear-gradient(135deg, #0B1D3A 0%, #142d54 100%)' }}>
                          <span className="text-[12px] font-semibold tracking-[0.06em] uppercase text-white/90">{t('filters.datesAvailable')}</span>
                          {dateRange.from && dateRange.to && (
                            <span className="text-[11px] px-2.5 py-0.5 rounded-full bg-[#D4AF37]/20 text-[#D4AF37] font-semibold">
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
                            caption_label: "text-sm font-bold text-[#0B1D3A]",
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
                            day_range_start: "day-range-start bg-[#0B1D3A] text-white hover:bg-[#0B1D3A] rounded-l-md",
                            day_range_end: "day-range-end bg-[#0B1D3A] text-white hover:bg-[#0B1D3A] rounded-r-md",
                            day_selected: "bg-[#0B1D3A] text-white hover:bg-[#0B1D3A] focus:bg-[#0B1D3A] focus:text-white",
                            day_today: "border border-[#D4AF37] text-[#D4AF37] font-bold",
                            day_outside: "text-gray-300 aria-selected:bg-[#D4AF37]/5 aria-selected:text-gray-400",
                            day_disabled: "text-gray-300 opacity-40 cursor-not-allowed",
                            day_range_middle: "aria-selected:bg-[#D4AF37]/10 aria-selected:text-[#0B1D3A]",
                            day_hidden: "invisible"
                          }}
                          data-testid="filter-date-calendar"
                        />
                      </PopoverContent>
                    </Popover>
                  </div>
                </div>
              </div>
            </div>

            {/* Bottom Action Bar */}
            <div className="px-7 py-4 flex items-center justify-between" style={{ background: 'linear-gradient(135deg, #0B1D3A 0%, #142d54 100%)' }}>
              <button
                onClick={clearFilters}
                className="text-[13px] font-medium text-white/50 hover:text-white transition-colors underline underline-offset-4 decoration-white/20 hover:decoration-white/50"
                data-testid="clear-filters-button"
              >
                {t('filters.clear')}
              </button>
              <button
                onClick={applyFilters}
                className="px-7 py-2.5 rounded-lg text-[13px] font-bold tracking-wide text-[#0B1D3A] transition-all duration-200 hover:shadow-lg hover:scale-[1.02] active:scale-[0.98]"
                style={{ backgroundColor: '#D4AF37' }}
                data-testid="apply-filters-button"
              >
                {t('filters.showResults')} {properties.length} {t('filters.places')}
              </button>
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
                  <div>
                    <span className="text-2xl font-bold" style={{ color: "#D4AF37" }} data-testid={`property-price-${property.id}`}>
                      {property.currency === 'USD' ? '$' : '₪'}{(property.monthly_price || property.nightly_price || 0).toLocaleString()}
                      <span className="text-sm font-normal text-gray-600">
                        {property.rental_type === 'vacation' ? t('property.perNight') : t('property.perMonth')}
                      </span>
                    </span>
                    {(() => {
                      const converted = convertPrice(property.monthly_price || property.nightly_price, property.currency);
                      if (!converted) return null;
                      return (
                        <div className="text-xs text-gray-400 mt-0.5" data-testid={`property-converted-price-${property.id}`}>
                          ≈ {converted.symbol}{converted.amount.toLocaleString()}
                          {property.rental_type === 'vacation' ? t('property.perNight') : t('property.perMonth')}
                        </div>
                      );
                    })()}
                  </div>
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
