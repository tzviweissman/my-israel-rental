import React, { useState, useEffect, useContext } from 'react';
import { useParams, useNavigate, useSearchParams } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import axios from 'axios';
import { API, AuthContext } from '../App';
import { Bed, Bath, Home as HomeIcon, MapPin, Filter, Building2, X, ChevronDown, ChevronUp, Calendar as CalendarIcon, Minus, Plus, Heart } from 'lucide-react';
import { Calendar } from '../components/ui/calendar';
import { Popover, PopoverContent, PopoverTrigger } from '../components/ui/popover';
import { Slider } from '../components/ui/slider';
import { format } from 'date-fns';
import { toast } from 'sonner';
import NotifyMeCard from '../components/NotifyMeCard';
import { HOLIDAY_WINDOWS } from '../constants/holidayWindows';
import { loadHolidayWindows } from '../utils/holidayWindows';

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
      <span className="w-7 text-center text-[14px] font-semibold text-[#1E6A6A] tabular-nums" data-testid={`${testId}-value`}>
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
  const [urlSearchParams] = useSearchParams();
  const [properties, setProperties] = useState([]);

  // Initial filter state honors any URL query params so clicking a saved-search
  // alert card deep-links directly to the matching results.
  const initialFilters = (() => {
    const base = {
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
      date_to: '',
    };
    const allowed = Object.keys(base).filter((k) => k !== 'rental_type');
    allowed.forEach((k) => {
      const v = urlSearchParams.get(k);
      if (v) base[k] = v;
    });
    return base;
  })();
  const [filters, setFilters] = useState(initialFilters);
  const [showFilters, setShowFilters] = useState(
    !!(urlSearchParams.get('area') || urlSearchParams.get('min_bedrooms') || urlSearchParams.get('max_price'))
  );
  const [dateRange, setDateRange] = useState(() => {
    const df = urlSearchParams.get('date_from');
    const dt = urlSearchParams.get('date_to');
    if (df && dt) {
      try {
        return { from: new Date(df), to: new Date(dt) };
      } catch {
        /* noop */
      }
    }
    return { from: undefined, to: undefined };
  });
  const [priceRange, setPriceRange] = useState([0, PRICE_MAX]);
  const [priceCurrency, setPriceCurrency] = useState(() => {
    const c = urlSearchParams.get('currency');
    return c === 'USD' ? 'USD' : 'ILS';
  });
  const [exchangeRate, setExchangeRate] = useState(null);
  const { user, token } = useContext(AuthContext);
  const [likedIds, setLikedIds] = useState(new Set());
  // Auto-rolling holiday windows from Hebcal — falls back to static defaults
  const [holidayWindows, setHolidayWindows] = useState(HOLIDAY_WINDOWS);

  useEffect(() => {
    let cancelled = false;
    loadHolidayWindows().then((win) => {
      if (!cancelled) setHolidayWindows(win);
    });
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    if (token) {
      axios.get(`${API}/liked-property-ids`, { headers: { Authorization: `Bearer ${token}` } })
        .then(res => setLikedIds(new Set(res.data)))
        .catch(() => {});
    }
  }, [token]);

  const toggleLike = async (e, propertyId) => {
    e.stopPropagation();
    if (!token) {
      toast.error('Please log in to save properties.');
      return;
    }
    try {
      const res = await axios.post(`${API}/properties/${propertyId}/like`, {}, {
        headers: { Authorization: `Bearer ${token}` }
      });
      setLikedIds(prev => {
        const next = new Set(prev);
        if (res.data.liked) next.add(propertyId);
        else next.delete(propertyId);
        return next;
      });
      toast.success(res.data.liked ? 'Saved to favorites!' : 'Removed from favorites');
    } catch (err) {
      toast.error('Failed to update favorites');
    }
  };

  useEffect(() => {
    axios.get(`${API}/exchange-rate`).then(res => setExchangeRate(res.data)).catch(() => setExchangeRate({ usd_to_ils: 3.65, ils_to_usd: 0.274 }));
  }, []);

  useEffect(() => {
    setFilters(prev => ({ ...prev, rental_type: type !== 'all' ? type : '' }));
  }, [type]);

  useEffect(() => {
    fetchProperties();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [type]);

  const fetchProperties = async () => {
    try {
      const params = new URLSearchParams();
      // The URL `type` segment is the source of truth for the rental_type
      // filter when navigating between /properties/<type> pages — `filters`
      // state lags one render behind `useParams`, so reading it here would
      // leak the previous page's value (e.g. clicking "Short Term" from
      // /properties/vacation would still send rental_type=vacation).
      // Sukkot/Pesach are vacation sub-categories: they map to
      // rental_type=vacation + holiday_tag=<sukkot|pesach>.
      const HOLIDAY_TYPES = new Set(['sukkot', 'pesach']);
      let rentalType = '';
      let holidayTag = '';
      if (type && type !== 'all') {
        if (HOLIDAY_TYPES.has(type)) {
          rentalType = 'vacation';
          holidayTag = type;
        } else {
          rentalType = type;
        }
      }
      if (rentalType) params.append('rental_type', rentalType);
      if (holidayTag) params.append('holiday_tag', holidayTag);
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
      let merged = response.data;

      // On Sukkot/Pesach pages, also pull matching subleases and merge them
      // into the grid. Subleases are a separate entity (not in the
      // `properties` collection), so they'd otherwise be invisible here.
      if (holidayTag) {
        try {
          const subRes = await axios.get(
            `${API}/subleases?holiday_tag=${encodeURIComponent(holidayTag)}`,
          );
          const normalized = (subRes.data || []).map((s) => normalizeSublease(s));
          merged = [...merged, ...normalized];
        } catch (subErr) {
          console.warn('Failed to fetch subleases', subErr);
        }
      }

      setProperties(merged);
    } catch (error) {
      console.error('Failed to fetch properties', error);
    }
  };

  // Shape a sublease doc into a property-card-compatible object so the
  // existing grid renderer works unchanged. `isSublease=true` lets the card
  // render a "Sublease" ribbon and navigate to the underlying property.
  const normalizeSublease = (sub) => ({
    id: `sub-${sub.id}`,
    sublease_id: sub.id,
    isSublease: true,
    property_id: sub.property_id || sub.original_property_id,
    title: sub.title || 'Sublease',
    area: sub.area || '',
    bedrooms: sub.bedrooms_available || 0,
    bathrooms: 0,
    floor: null,
    square_meters: 0,
    images: sub.images || [],
    nightly_price: sub.price_type === 'per_night' ? sub.price : null,
    monthly_price: sub.price_type !== 'per_night' ? sub.price : null,
    currency: sub.currency || 'ILS',
    rental_type: 'vacation',
    holiday_tags: sub.holiday_tags || [],
    available_from: sub.available_from,
    available_to: sub.available_to,
  });

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

  // Apply a pre-defined holiday window (Sukkot/Pesach) to the date filter
  // and immediately fetch — used by the banner CTA on the holiday pages.
  const parseLocalDate = (s) => {
    const [y, m, d] = String(s).split('-').map(Number);
    return new Date(y, m - 1, d);
  };
  const applyHolidayWindow = (winKey) => {
    const win = holidayWindows[winKey];
    if (!win) return;
    setFilters((prev) => ({ ...prev, date_from: win.start, date_to: win.end }));
    setDateRange({ from: parseLocalDate(win.start), to: parseLocalDate(win.end) });
    // Immediate fetch: build params from the URL `type` + the new dates,
    // sidestepping the lagging `filters` closure.
    (async () => {
      try {
        const params = new URLSearchParams();
        params.append('rental_type', 'vacation');
        params.append('holiday_tag', winKey);
        params.append('date_from', win.start);
        params.append('date_to', win.end);
        const [propsRes, subsRes] = await Promise.all([
          axios.get(`${API}/properties?${params.toString()}`),
          axios
            .get(`${API}/subleases?holiday_tag=${encodeURIComponent(winKey)}`)
            .catch(() => ({ data: [] })),
        ]);
        // Client-side date-overlap filter for subleases (backend doesn't yet
        // support date_from/date_to on /api/subleases).
        const filteredSubs = (subsRes.data || []).filter((s) => {
          if (!s.available_from || !s.available_to) return true;
          return !(s.available_to < win.start || s.available_from > win.end);
        });
        const merged = [...propsRes.data, ...filteredSubs.map(normalizeSublease)];
        setProperties(merged);
        toast.success(`Showing homes available during ${win.label}`);
      } catch (err) {
        console.error('Failed to apply holiday filter', err);
      }
    })();
  };

  const rentalTypeLabel = {
    'long-term': t('property.longTerm'),
    'short-term': t('property.shortTerm'),
    'vacation': t('property.vacationType'),
    'storage': t('property.storageType'),
    'sukkot': 'Sukkot Rentals',
    'pesach': 'Pesach Rentals',
    'all': t('filters.allProperties')
  };

  return (
    <div className="min-h-screen">
      <div className="max-w-7xl mx-auto px-6 pt-28 pb-12">
        <div className="flex items-center justify-between mb-8">
          <h1 className="text-4xl font-bold" style={{ fontFamily: 'Playfair Display' }} data-testid="properties-title">
            {rentalTypeLabel[type] || t('filters.allProperties')}
          </h1>
          <button
            onClick={() => setShowFilters(!showFilters)}
            className="flex items-center gap-2 px-5 py-2.5 rounded-xl text-sm font-semibold tracking-wide transition-all duration-200 hover:shadow-md active:scale-[0.98]"
            style={{ 
              backgroundColor: showFilters ? '#1E6A6A' : '#fafaf8', 
              color: showFilters ? '#D4AF37' : '#1E6A6A',
              border: showFilters ? '1.5px solid #1E6A6A' : '1.5px solid #e0dcd4'
            }}
            data-testid="filter-toggle-button"
          >
            <Filter size={16} />
            {t('filters.filters')}
            {activeFilterCount > 0 && (
              <span className="w-5 h-5 rounded-full text-[10px] flex items-center justify-center font-bold bg-[#D4AF37] text-[#1E6A6A]">
                {activeFilterCount}
              </span>
            )}
          </button>
        </div>

        {/* Holiday window banner — only on /properties/sukkot and /properties/pesach */}
        {(type === 'sukkot' || type === 'pesach') && holidayWindows[type] && (
          <div
            className="mb-8 rounded-2xl overflow-hidden border border-[#D4AF37]/30 bg-gradient-to-br from-[#fffaee] via-white to-[#fffaee] shadow-sm"
            data-testid={`holiday-banner-${type}`}
          >
            <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4 px-6 py-5">
              <div className="flex items-start gap-4">
                <div className="shrink-0 w-12 h-12 rounded-xl bg-[#D4AF37]/15 flex items-center justify-center">
                  <CalendarIcon size={22} style={{ color: '#8a6d1d' }} />
                </div>
                <div>
                  <p className="text-[11px] font-semibold tracking-[0.15em] uppercase text-[#8a6d1d] mb-1">
                    {holidayWindows[type].label} {holidayWindows[type].year}
                  </p>
                  <h2 className="text-lg font-bold text-gray-900 mb-0.5">
                    {format(parseLocalDate(holidayWindows[type].start), 'MMM d')} —{' '}
                    {format(parseLocalDate(holidayWindows[type].end), 'MMM d, yyyy')}
                  </h2>
                  <p className="text-sm text-gray-600">
                    Find homes available throughout the holiday — one click pre-fills the date filter.
                  </p>
                </div>
              </div>
              <button
                onClick={() => applyHolidayWindow(type)}
                className="shrink-0 px-5 py-2.5 rounded-xl text-sm font-semibold transition-all hover:shadow-md active:scale-[0.98] flex items-center gap-2 self-start md:self-center"
                style={{ backgroundColor: '#1E6A6A', color: '#D4AF37' }}
                data-testid={`apply-holiday-window-${type}`}
              >
                <Filter size={14} />
                Find homes available these dates
              </button>
            </div>
          </div>
        )}

        {showFilters && (
          <div className="mb-8 rounded-2xl overflow-hidden" style={{ border: '1px solid #e0dcd4', boxShadow: '0 8px 40px rgba(0,0,0,0.08), 0 1px 3px rgba(0,0,0,0.04)' }} data-testid="filters-panel">
            {/* Header */}
            <div className="px-7 py-4 flex items-center justify-between" style={{ background: 'linear-gradient(135deg, #1E6A6A 0%, #2A8585 100%)' }}>
              <div className="flex items-center gap-2.5">
                <Filter size={16} className="text-[#D4AF37]" />
                <span className="text-[13px] font-semibold tracking-[0.08em] uppercase text-white/90">{t('filters.filters')}</span>
                {activeFilterCount > 0 && (
                  <span className="ml-1 w-5 h-5 rounded-full text-[10px] flex items-center justify-center font-bold bg-[#D4AF37] text-[#1E6A6A]">
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
                      <h3 className="text-[13px] font-bold tracking-[0.06em] uppercase text-[#1E6A6A]">{t('filters.priceRange')}</h3>
                      <div className="flex rounded-lg overflow-hidden" style={{ border: '1.5px solid #d0ccc4' }} data-testid="filter-currency-toggle">
                        <button
                          onClick={() => { setPriceCurrency('ILS'); setPriceRange([0, PRICE_MAX]); handleFilterChange('min_price', ''); handleFilterChange('max_price', ''); }}
                          className={`px-3 py-1 text-xs font-bold tracking-wider transition-all duration-200 ${priceCurrency === 'ILS' ? 'bg-[#1E6A6A] text-[#D4AF37]' : 'bg-transparent text-[#999] hover:text-[#666]'}`}
                          data-testid="filter-currency-ils"
                        >
                          ₪ ILS
                        </button>
                        <div className="w-px bg-[#d0ccc4]" />
                        <button
                          onClick={() => { setPriceCurrency('USD'); setPriceRange([0, PRICE_MAX]); handleFilterChange('min_price', ''); handleFilterChange('max_price', ''); }}
                          className={`px-3 py-1 text-xs font-bold tracking-wider transition-all duration-200 ${priceCurrency === 'USD' ? 'bg-[#1E6A6A] text-[#D4AF37]' : 'bg-transparent text-[#999] hover:text-[#666]'}`}
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
                        className="[&_[role=slider]]:h-5 [&_[role=slider]]:w-5 [&_[role=slider]]:border-[2.5px] [&_[role=slider]]:border-[#1E6A6A] [&_[role=slider]]:bg-white [&_[role=slider]]:shadow-md [&_[role=slider]]:hover:shadow-lg [&_[role=slider]]:hover:scale-110 [&_[role=slider]]:transition-all [&_.bg-primary\\/20]:bg-[#e0dcd4] [&_.bg-primary\\/20]:h-[3px] [&_.bg-primary]:bg-[#D4AF37] [&_.bg-primary]:h-[3px]"
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
                            className="w-full text-sm font-medium bg-transparent outline-none text-[#1E6A6A] placeholder:text-[#ccc]"
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
                            className="w-full text-sm font-medium bg-transparent outline-none text-[#1E6A6A] placeholder:text-[#ccc]"
                            data-testid="filter-price-max-input"
                          />
                        </div>
                      </div>
                    </div>
                  </div>

                  <div className="mx-7 border-t" style={{ borderColor: '#e8e4dc' }} />

                  {/* Rooms & Details Section */}
                  <div className="px-7 py-5" data-testid="filter-rooms-section">
                    <h3 className="text-[13px] font-bold tracking-[0.06em] uppercase text-[#1E6A6A] mb-1">{t('filters.roomsAndDetails')}</h3>
                    
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
                    <h3 className="text-[13px] font-bold tracking-[0.06em] uppercase text-[#1E6A6A] mb-4">{t('filters.propertySection')}</h3>
                    
                    <div className="space-y-4">
                      {/* Location */}
                      <div>
                        <label className="text-[11px] font-semibold text-[#aaa] uppercase tracking-wider mb-1.5 block">{t('property.propertyLocation')}</label>
                        <select
                          value={filters.area}
                          onChange={(e) => handleFilterChange('area', e.target.value)}
                          className="w-full px-3.5 py-2.5 rounded-lg text-sm bg-white focus:outline-none focus:shadow-sm transition-all duration-200 text-[#1E6A6A] appearance-none"
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
                          className="w-full px-3.5 py-2.5 rounded-lg text-sm bg-white focus:outline-none focus:shadow-sm transition-all duration-200 text-[#1E6A6A] appearance-none"
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
                    <h3 className="text-[13px] font-bold tracking-[0.06em] uppercase text-[#1E6A6A] mb-3">{t('filters.datesAvailable')}</h3>
                    <Popover>
                      <PopoverTrigger asChild>
                        <button
                          className="w-full px-3.5 py-2.5 rounded-lg text-sm flex items-center gap-2.5 bg-white hover:shadow-sm transition-all duration-200 text-left"
                          style={{ border: '1.5px solid #e0dcd4' }}
                          data-testid="filter-date-picker-trigger"
                        >
                          <CalendarIcon size={15} className="text-[#D4AF37] shrink-0" />
                          {dateRange.from ? (
                            <span className="text-[#1E6A6A] font-medium text-[13px]">
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
                        <div className="px-4 py-3 flex items-center justify-between" style={{ background: 'linear-gradient(135deg, #1E6A6A 0%, #2A8585 100%)' }}>
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
                            caption_label: "text-sm font-bold text-[#1E6A6A]",
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
                            day_range_start: "day-range-start bg-[#1E6A6A] text-white hover:bg-[#1E6A6A] rounded-l-md",
                            day_range_end: "day-range-end bg-[#1E6A6A] text-white hover:bg-[#1E6A6A] rounded-r-md",
                            day_selected: "bg-[#1E6A6A] text-white hover:bg-[#1E6A6A] focus:bg-[#1E6A6A] focus:text-white",
                            day_today: "border border-[#D4AF37] text-[#D4AF37] font-bold",
                            day_outside: "text-gray-300 aria-selected:bg-[#D4AF37]/5 aria-selected:text-gray-400",
                            day_disabled: "text-gray-300 opacity-40 cursor-not-allowed",
                            day_range_middle: "aria-selected:bg-[#D4AF37]/10 aria-selected:text-[#1E6A6A]",
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
            <div className="px-7 py-4 flex items-center justify-between" style={{ background: 'linear-gradient(135deg, #1E6A6A 0%, #2A8585 100%)' }}>
              <button
                onClick={clearFilters}
                className="text-[13px] font-medium text-white/50 hover:text-white transition-colors underline underline-offset-4 decoration-white/20 hover:decoration-white/50"
                data-testid="clear-filters-button"
              >
                {t('filters.clear')}
              </button>
              <button
                onClick={applyFilters}
                className="px-7 py-2.5 rounded-lg text-[13px] font-bold tracking-wide text-[#1E6A6A] transition-all duration-200 hover:shadow-lg hover:scale-[1.02] active:scale-[0.98]"
                style={{ backgroundColor: '#D4AF37' }}
                data-testid="apply-filters-button"
              >
                {t('filters.showResults')} {properties.length} {t('filters.places')}
              </button>
            </div>
          </div>
        )}

        <div className="grid grid-cols-2 md:grid-cols-2 lg:grid-cols-3 gap-3 md:gap-8">
          {properties.map((property) => (
            <div
              key={property.id}
              className="property-card"
              onClick={() => {
                sessionStorage.setItem('previousPath', window.location.pathname);
                // Sublease cards deep-link to the underlying property, passing
                // the sublease window so the booking form pre-fills those
                // exact dates (holiday rental conversion path).
                if (property.isSublease && property.property_id) {
                  const params = new URLSearchParams();
                  if (property.available_from) params.append('from', property.available_from);
                  if (property.available_to) params.append('to', property.available_to);
                  if (property.sublease_id) params.append('sublease_id', property.sublease_id);
                  const qs = params.toString();
                  navigate(`/property/${property.property_id}${qs ? `?${qs}` : ''}`);
                } else {
                  navigate(`/property/${property.id}`);
                }
              }}
              data-testid={`property-card-${property.id}`}
            >
              <div className="h-36 md:h-64 bg-gray-200 relative" style={{
                backgroundImage: `url(${property.images?.[0] ? (property.images[0].startsWith('/api') ? `${API.replace('/api', '')}${property.images[0]}` : property.images[0]) : 'https://images.pexels.com/photos/1669799/pexels-photo-1669799.jpeg?auto=compress&cs=tinysrgb&dpr=2&h=650&w=940'})`,
                backgroundSize: 'cover',
                backgroundPosition: 'center'
              }}>
                {property.isSublease && (
                  <span
                    className="absolute top-2 left-2 md:top-3 md:left-3 px-2.5 py-1 rounded-full text-[10px] md:text-xs font-bold uppercase tracking-wide shadow-md z-10"
                    style={{ backgroundColor: '#D4AF37', color: '#1E6A6A' }}
                    data-testid="sublease-ribbon"
                  >
                    Sublease
                  </span>
                )}
                <button
                  onClick={(e) => toggleLike(e, property.id)}
                  className="absolute top-2 right-2 md:top-3 md:right-3 w-8 h-8 md:w-10 md:h-10 rounded-full bg-white/90 hover:bg-white flex items-center justify-center shadow-md transition-all hover:scale-110 active:scale-95 z-10"
                  data-testid={`like-btn-${property.id}`}
                  style={{ display: property.isSublease ? 'none' : undefined }}
                >
                  <Heart
                    size={16}
                    className={`md:w-5 md:h-5 transition-colors ${likedIds.has(property.id) ? 'fill-red-500 text-red-500' : 'text-gray-500'}`}
                  />
                </button>
              </div>
              <div className="p-3 md:p-6">
                <h3 className="text-sm md:text-xl font-bold mb-1 md:mb-2 line-clamp-1">{property.title}</h3>
                <div className="flex items-center gap-2 text-gray-600 mb-2 md:mb-3">
                  <MapPin size={14} className="md:w-4 md:h-4 shrink-0" />
                  <span className="text-xs md:text-sm truncate">{property.area}</span>
                </div>
                <div className="hidden md:flex items-center gap-4 mb-4 text-sm text-gray-700">
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
                    <span className="text-base md:text-2xl font-bold" style={{ color: "#D4AF37" }} data-testid={`property-price-${property.id}`}>
                      {property.currency === 'USD' ? '$' : '₪'}{(property.monthly_price || property.nightly_price || 0).toLocaleString()}
                      <span className="text-[10px] md:text-sm font-normal text-gray-600">
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
                  <span className="hidden md:inline text-sm px-3 py-1 rounded-full" style={{ backgroundColor: '#E5E5E5', color: '#000000' }}>
                    {{'long-term': t('property.longTerm'), 'short-term': t('property.shortTerm'), 'vacation': t('property.vacationType'), 'storage': t('property.storageType')}[property.rental_type] || property.rental_type}
                  </span>
                </div>
              </div>
            </div>
          ))}
        </div>

        {properties.length === 0 && (
          <div className="text-center py-16" data-testid="no-results-empty-state">
            <p className="text-xl text-gray-600 mb-2">{t('filters.noResults')}</p>
            <NotifyMeCard filters={filters} dateRange={dateRange} />
          </div>
        )}
      </div>
    </div>
  );
};

export default Properties;
