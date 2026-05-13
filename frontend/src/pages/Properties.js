import React, { useState, useEffect, useContext } from 'react';
import { useParams, useNavigate, useSearchParams } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import axios from 'axios';
import { API, AuthContext } from '../App';
import { Filter, Palmtree, Sun, Sparkles } from 'lucide-react';
import { toast } from 'sonner';
import NotifyMeCard from '../components/NotifyMeCard';
import { HOLIDAY_WINDOWS } from '../constants/holidayWindows';
import { loadHolidayWindows } from '../utils/holidayWindows';

import PropertyCard from '../components/property/PropertyCard';
import HolidayBanner from '../components/property/HolidayBanner';
import FiltersPanel, { PRICE_MAX } from '../components/property/FiltersPanel';

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
          // Subleases come from /api/subleases (no price filter), so apply it
          // client-side here using the same currency-aware logic the backend
          // uses for /api/properties.
          merged = [...merged, ...applyPriceFilter(normalized)];
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

  // Apply the active min/max price filter to a collection of property-shaped
  // objects (works for both real properties AND normalized subleases).
  // Subleases come from a separate endpoint that doesn't honor the price
  // query params, so without this they'd silently bypass the filter — which
  // is how a ₪3,000 sublease was showing up for a "max $400" search.
  const applyPriceFilter = (items, opts = {}) => {
    const minP = opts.min_price ?? filters.min_price;
    const maxP = opts.max_price ?? filters.max_price;
    const targetCurrency = opts.currency ?? priceCurrency;
    if (!minP && !maxP) return items;
    const FX_USD_TO_ILS = 3.65; // matches backend fallback in utils/helpers.py
    return items.filter((p) => {
      const raw = p.monthly_price || p.nightly_price || 0;
      if (!raw) return true; // no price listed — don't block
      const propCurrency = p.currency || 'ILS';
      let priceInTarget = raw;
      if (propCurrency !== targetCurrency) {
        if (targetCurrency === 'USD' && propCurrency === 'ILS') {
          priceInTarget = raw / FX_USD_TO_ILS;
        } else if (targetCurrency === 'ILS' && propCurrency === 'USD') {
          priceInTarget = raw * FX_USD_TO_ILS;
        }
      }
      if (minP && priceInTarget < Number(minP)) return false;
      if (maxP && priceInTarget > Number(maxP)) return false;
      return true;
    });
  };

  const handleFilterChange = (key, value) => {
    setFilters(prev => ({ ...prev, [key]: value }));
  };

  const applyFilters = () => {
    fetchProperties();
    setShowFilters(false);
  };

  // Save the currently-applied filters as an availability alert. Triggered by
  // the "Save as alert" button in the filter drawer so renters don't have to
  // wait for an empty search result.
  const saveCurrentFiltersAsAlert = async () => {
    if (!token) {
      toast.error('Please sign in to save this alert.');
      navigate('/auth?return=' + encodeURIComponent(window.location.pathname + window.location.search));
      return;
    }
    try {
      const body = {
        filters: {
          rental_type: filters.rental_type || (type && type !== 'all' ? type : null),
          area: filters.area || null,
          bedrooms_min: filters.min_bedrooms ? Number(filters.min_bedrooms) : null,
          max_price: filters.max_price ? Number(filters.max_price) : null,
          start_date: filters.date_from || null,
          end_date: filters.date_to || null,
        },
        date_fuzziness_days: 30,
      };
      const res = await axios.post(`${API}/saved-searches`, body, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (res.data.existing) {
        toast.success("Alert already active — we'll notify you.");
      } else {
        toast.success("Alert saved! We'll notify you when a match lists.");
      }
    } catch (err) {
      toast.error(err.response?.data?.detail || 'Failed to save alert');
    }
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
        const merged = [...propsRes.data, ...applyPriceFilter(filteredSubs.map(normalizeSublease))];
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
    'sukkot': t('filters.sukkotRentals'),
    'pesach': t('filters.pesachRentals'),
    'all': t('filters.allProperties')
  };

  const handleCardClick = (property) => {
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
  };

  return (
    <div className="min-h-screen">
      <div className="max-w-7xl mx-auto px-6 pt-28 pb-12">
        <div className="flex items-center justify-between mb-8">
          <h1
            className="text-4xl font-bold"
            style={{ fontFamily: 'Playfair Display' }}
            data-testid="properties-title"
          >
            {rentalTypeLabel[type] || t('filters.allProperties')}
          </h1>
          <button
            onClick={() => setShowFilters(!showFilters)}
            className="flex items-center gap-2 px-5 py-2.5 rounded-xl text-sm font-semibold tracking-wide transition-all duration-200 hover:shadow-md active:scale-[0.98]"
            style={{
              backgroundColor: showFilters ? '#1E6A6A' : '#fafaf8',
              color: showFilters ? '#D4AF37' : '#1E6A6A',
              border: showFilters ? '1.5px solid #1E6A6A' : '1.5px solid #e0dcd4',
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

        {/* Holiday quick-filter pills — only visible on the vacation
            family of pages (vacation / sukkot / pesach). Lets renters
            jump between "all vacation rentals" and the two big holiday
            windows without opening the full filters drawer. */}
        {['vacation', 'sukkot', 'pesach'].includes(type) && (
          <div
            className="flex flex-wrap items-center gap-2 -mt-3 mb-6"
            data-testid="vacation-quick-filters"
          >
            <span className="text-xs font-semibold tracking-wider uppercase text-gray-500 mr-1">
              {t('filters.quickPick') || 'Quick pick'}:
            </span>
            {[
              { slug: 'vacation', label: t('property.vacationType'), Icon: Palmtree },
              { slug: 'sukkot', label: t('filters.sukkotRentals'), Icon: Sparkles },
              { slug: 'pesach', label: t('filters.pesachRentals'), Icon: Sun },
            ].map(({ slug, label, Icon }) => {
              const active = type === slug;
              return (
                <button
                  key={slug}
                  onClick={() => {
                    sessionStorage.setItem('previousPath', window.location.pathname);
                    navigate(`/properties/${slug}`);
                  }}
                  className="inline-flex items-center gap-2 px-4 py-2 rounded-full text-sm font-semibold transition-all hover:shadow-md active:scale-[0.97]"
                  style={{
                    backgroundColor: active ? '#1E6A6A' : '#ffffff',
                    color: active ? '#D4AF37' : '#1E6A6A',
                    border: `1.5px solid ${active ? '#1E6A6A' : '#e0dcd4'}`,
                  }}
                  data-testid={`quick-filter-${slug}`}
                >
                  <Icon size={15} />
                  {label}
                </button>
              );
            })}
          </div>
        )}

        {/* Holiday window banner — only on /properties/pesach. The Sukkot
            page no longer auto-prefills its date range (per request) so the
            banner is suppressed there; renters can still pick the dates
            themselves from the filters panel. */}
        {type === 'pesach' && (
          <HolidayBanner
            window={holidayWindows[type]}
            type={type}
            onApply={applyHolidayWindow}
          />
        )}

        {showFilters && (
          <FiltersPanel
            filters={filters}
            onFilterChange={handleFilterChange}
            dateRange={dateRange}
            onDateRangeChange={setDateRange}
            priceRange={priceRange}
            setPriceRange={setPriceRange}
            onPriceSliderChange={handlePriceSliderChange}
            priceCurrency={priceCurrency}
            onSetPriceCurrency={setPriceCurrency}
            resultsCount={properties.length}
            activeFilterCount={activeFilterCount}
            user={user}
            onApply={applyFilters}
            onClear={clearFilters}
            onClose={() => setShowFilters(false)}
            onSaveAsAlert={saveCurrentFiltersAsAlert}
            stepValue={stepValue}
          />
        )}

        <div className="grid grid-cols-2 md:grid-cols-2 lg:grid-cols-3 gap-3 md:gap-8">
          {properties.map((property) => (
            <PropertyCard
              key={property.id}
              property={property}
              isLiked={likedIds.has(property.id)}
              onClick={() => handleCardClick(property)}
              onToggleLike={toggleLike}
              convertPrice={convertPrice}
              apiBase={API}
            />
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
