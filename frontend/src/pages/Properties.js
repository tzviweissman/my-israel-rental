import React, { useState, useEffect, useContext, useRef, useCallback } from 'react';
import { useParams, useNavigate, useSearchParams } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import axios from 'axios';
import { API, AuthContext } from '../App';
import { Filter, Palmtree, Sun, Sparkles, Loader2, Bell } from 'lucide-react';
import { toast } from 'sonner';
import NotifyMeCard from '../components/NotifyMeCard';
import MyAlertsPopover from '../components/MyAlertsPopover';
import { HOLIDAY_WINDOWS } from '../constants/holidayWindows';
import { loadHolidayWindows } from '../utils/holidayWindows';

import PropertyCard from '../components/property/PropertyCard';
import HolidayBanner from '../components/property/HolidayBanner';
import FiltersPanel, { PRICE_MAX } from '../components/property/FiltersPanel';
import PageMeta from '../components/PageMeta';
import { saveReturnPath } from '../hooks/useBackNavigation';

// Per-rental-type SEO copy. Each entry maps the URL segment (e.g.
// `long-term`) to a unique title + meta description so search engines
// see a distinct snippet for every listing page and no longer flag
// duplicate-title errors (audit error #6 / #15).
const RENTAL_TYPE_META = {
  'all': {
    title: 'All rentals in Israel — apartments, vacation, long & short term | MyIsraelRental',
    description: 'Search every rental on MyIsraelRental — long-term apartments, short-term lets, vacation homes — across Jerusalem, Tel Aviv, Haifa and more. Free for renters.',
  },
  'long-term': {
    title: 'Long-term apartment rentals in Israel | MyIsraelRental',
    // No "No broker fees." here — see the note in Home.js. The platform is
    // free to use; what an owner or managing agent charges is theirs to set,
    // and listings that do carry an agent fee display it.
    description: '12-month and longer apartment rentals across Israel. Browse verified listings in Jerusalem, Tel Aviv, Haifa, Beit Shemesh and more — free to search and contact owners directly.',
  },
  'short-term': {
    title: 'Short-term rentals in Israel (1–6 months) | MyIsraelRental',
    description: 'Furnished short-term rentals across Israel — perfect for olim, students, and remote workers. Browse 1-to-6 month stays in Jerusalem, Tel Aviv, Haifa and more.',
  },
  'vacation': {
    title: 'Vacation rentals in Israel — nightly stays | MyIsraelRental',
    description: 'Nightly vacation rentals across Israel. Find apartments and homes for Pesach, Sukkot, summer holidays and weekend getaways — Jerusalem, Tel Aviv, Eilat and beyond.',
  },
  // Storage retired but legacy URL still resolves — keep a real
  // (non-promoted) title so it isn't a duplicate of the others.
  'storage': {
    title: 'Storage rentals in Israel (legacy) | MyIsraelRental',
    description: 'Legacy storage rentals page. The storage category is being retired; please browse our apartment rentals instead.',
  },
};

const Properties = () => {
  const { type } = useParams();
  const { t } = useTranslation();
  const navigate = useNavigate();
  const [urlSearchParams, setUrlSearchParams] = useSearchParams();
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
  // Pagination — `properties` accumulates pages 1..N as the user scrolls.
  // `hasMore` flips false when the latest fetch returns < PAGE_SIZE rows;
  // `loadingMore` gates the IntersectionObserver to one inflight request.
  const PAGE_SIZE = 24;
  const [page, setPage] = useState(1);
  const [hasMore, setHasMore] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  // Filter panel stays closed by default — even when the URL carries filter
  // params (e.g. user returning from a property detail with filters intact,
  // or a saved-search deep link). The "Filters N" badge on the toggle
  // button + the live result count below the page heading already tell the
  // user what's applied; auto-opening the panel was disorienting on every
  // back-navigation.
  const [showFilters, setShowFilters] = useState(false);
  // True while a filter-change refetch is in flight. Lets us dim the grid
  // so renters get visible feedback that their filter tweak is taking
  // effect, even when the panel is open and the grid is partially obscured.
  const [filtering, setFiltering] = useState(false);
  // Bumps each time a saved-search alert is created so the inline
  // MyAlertsPopover can re-fetch its list (keeps the "(N)" count fresh
  // without forcing the renter to close + reopen).
  const [alertsRefreshKey, setAlertsRefreshKey] = useState(0);
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

  const fetchProperties = async (pageOverride = 1, append = false) => {
    try {
      if (append) setLoadingMore(true);
      else setFiltering(true);
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
      // Server-side pagination — keeps first paint fast no matter how
      // many listings the catalog grows to. Subleases are merged in
      // client-side on the holiday pages (separate endpoint, no paging).
      params.append('page', String(pageOverride));
      params.append('limit', String(PAGE_SIZE));

      const response = await axios.get(`${API}/properties?${params.toString()}`);
      let merged = response.data;

      // On Sukkot/Pesach pages, also pull matching subleases and merge them
      // into the grid. Subleases are a separate entity (not in the
      // `properties` collection), so they'd otherwise be invisible here.
      // Only attach subleases on page 1 — they're a fixed-size sidecar
      // list, not paginated alongside properties.
      if (holidayTag && pageOverride === 1) {
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

      // "Less than a full page" is the signal that we've hit the tail.
      setHasMore(response.data.length === PAGE_SIZE);
      setPage(pageOverride);
      if (append) {
        setProperties((prev) => [...prev, ...merged]);
      } else {
        setProperties(merged);
      }
    } catch (error) {
      console.error('Failed to fetch properties', error);
    } finally {
      if (append) setLoadingMore(false);
      else setFiltering(false);
    }
  };

  // IntersectionObserver-backed "load more when sentinel scrolls into
  // view". Attached via the callback ref below on the empty <div> we
  // render right under the grid. Using a ref-callback rather than a
  // useRef + useEffect lets the observer rebind whenever the sentinel
  // unmounts (filter change clears results) or remounts (results come back).
  const loadingSentinelRef = useRef(null);
  const observerRef = useRef(null);
  const sentinelRefCb = useCallback((node) => {
    if (observerRef.current) observerRef.current.disconnect();
    if (!node) return;
    observerRef.current = new IntersectionObserver(
      (entries) => {
        if (entries[0].isIntersecting && hasMore && !loadingMore) {
          fetchProperties(page + 1, true);
        }
      },
      { rootMargin: '400px' },  // start fetching ~one viewport before reaching the sentinel
    );
    observerRef.current.observe(node);
    loadingSentinelRef.current = node;
  }, [hasMore, loadingMore, page]);  // eslint-disable-line react-hooks/exhaustive-deps

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

  // Live-refresh results as the user tweaks filters (debounced 300ms) so
  // the "Show N places" button text stays accurate. The Apply button is now
  // really just "close panel" — but the count it shows always matches what
  // the user will get when they close it. No more "28 places → 0 results".
  useEffect(() => {
    const id = setTimeout(() => fetchProperties(), 300);
    return () => clearTimeout(id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filters, priceCurrency, dateRange]);

  // Mirror the current filter state into the URL query string so the page is
  // shareable, refreshable, and — crucially — survives a round-trip through
  // a property-detail page. PropertyDetail's "Back to Listings" reads the
  // saved `previousPath` (now path+search), which lands us here with the
  // URL still carrying the filters; the initialFilters block hydrates state
  // from URL on mount, so the renter sees their previous filtered results.
  // `replace: true` keeps the browser history clean while typing.
  useEffect(() => {
    const next = new URLSearchParams();
    const passthrough = [
      'min_bedrooms', 'max_price', 'min_price', 'area', 'min_bathrooms',
      'max_floor', 'min_porches', 'has_elevator', 'condition',
      'date_from', 'date_to',
    ];
    passthrough.forEach((k) => {
      const v = filters[k];
      if (v != null && v !== '') next.set(k, String(v));
    });
    if (priceCurrency && priceCurrency !== 'ILS') next.set('currency', priceCurrency);
    // Avoid spamming the URL when nothing changed.
    const currentStr = urlSearchParams.toString();
    const nextStr = next.toString();
    if (currentStr !== nextStr) {
      setUrlSearchParams(next, { replace: true });
    }
  }, [filters, priceCurrency]);

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
      // Signal the inline MyAlertsPopover to re-fetch so its "(N)" count
      // reflects the new alert without forcing a manual reopen.
      setAlertsRefreshKey((k) => k + 1);
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
    setPage(1);
    setHasMore(true);
    const params = new URLSearchParams();
    if (cleared.rental_type && cleared.rental_type !== 'all') params.append('rental_type', cleared.rental_type);
    params.append('page', '1');
    params.append('limit', String(PAGE_SIZE));
    axios.get(`${API}/properties?${params.toString()}`).then(res => {
      setProperties(res.data);
      setHasMore(res.data.length === PAGE_SIZE);
    }).catch(() => {});
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
        params.append('page', '1');
        params.append('limit', String(PAGE_SIZE));
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
        setPage(1);
        setHasMore(propsRes.data.length === PAGE_SIZE);
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
    // Persist BOTH pathname and search so PropertyDetail's "Back to Listings"
    // returns the renter to the exact filtered view they came from — not
    // just /properties/<type> with all filters wiped.
    saveReturnPath();
    // Sublease cards route to the standalone sublease detail page. This is
    // independent of the underlying property — if the original was deleted,
    // the sublease still has a working detail view (option-b detach).
    if (property.isSublease && property.sublease_id) {
      navigate(`/sublease/${property.sublease_id}`);
    } else {
      // Propagate the current holiday context to the detail page so the
      // booking sidebar lands on the matching holiday rate by default.
      const holidayQS = ['sukkot', 'pesach'].includes(type) ? `?holiday=${type}` : '';
      navigate(`/property/${property.id}${holidayQS}`);
    }
  };

  return (
    <div className="min-h-screen">
      <PageMeta
        title={(RENTAL_TYPE_META[type] || RENTAL_TYPE_META['all']).title}
        description={(RENTAL_TYPE_META[type] || RENTAL_TYPE_META['all']).description}
        path={`/properties/${type || 'all'}`}
      />
      <div className="max-w-7xl mx-auto px-6 pt-36 sm:pt-32 md:pt-28 pb-12">
        <div className="flex items-center justify-between mb-3 gap-3">
          <h1
            className="text-2xl sm:text-3xl md:text-4xl font-bold truncate"
            style={{ fontFamily: 'Playfair Display' }}
            data-testid="properties-title"
          >
            {rentalTypeLabel[type] || t('filters.allProperties')}
          </h1>
          <button
            onClick={() => setShowFilters(!showFilters)}
            className="flex items-center gap-1.5 sm:gap-2 px-3 sm:px-5 py-2 sm:py-2.5 rounded-xl text-xs sm:text-sm font-semibold tracking-wide transition-all duration-200 hover:shadow-md active:scale-[0.98] shrink-0"
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

        {/* Live result counter — always visible just below the page title so
            renters can see their filter tweaks taking effect WITHOUT having
            to scroll past the filter panel or click "Show N places". When a
            fetch is in flight (typing in price field, dragging slider) the
            counter shows a pulsing dot so the renter gets immediate
            feedback that the system is recomputing. */}
        <div
          className="flex items-center justify-between gap-2 mb-6 text-sm text-gray-600 flex-wrap"
          data-testid="live-result-count"
        >
          <div className="flex items-center gap-2">
            {filtering ? (
              <>
                <Loader2 size={14} className="animate-spin text-[#D4AF37]" />
                <span>{t('filters.updating') || 'Updating results...'}</span>
              </>
            ) : (
              <span>
                <span className="font-semibold text-[#1E6A6A]" data-testid="live-result-count-number">
                  {properties.length}
                </span>{' '}
                {properties.length === 1
                  ? (t('filters.placeSingular') || 'place')
                  : (t('filters.places') || 'places')}
                {activeFilterCount > 0 && (
                  <span className="text-gray-400">
                    {' '}· {t('filters.matchingFilters') || 'matching your filters'}
                  </span>
                )}
              </span>
            )}
          </div>
          {/* Right-side cluster: My Alerts popover (always visible when
              signed in) + Save-as-alert pill (only when filters are
              applied AND there are still results — the zero-results banner
              replaces this when results=0). */}
          <div className="flex items-center gap-2">
            <MyAlertsPopover refreshSignal={alertsRefreshKey} />
            {activeFilterCount > 0 && properties.length > 0 && (
              <button
                onClick={saveCurrentFiltersAsAlert}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-semibold transition-all hover:shadow-sm active:scale-[0.97]"
                style={{
                  backgroundColor: '#fafaf0',
                  color: '#1E6A6A',
                  border: '1px solid #D4AF37',
                }}
                data-testid="save-as-alert-inline-btn"
                title={t('filters.saveAsAlertTooltip') || "We'll email you when a new place matches your filters"}
              >
                <Bell size={12} />
                {t('filters.saveAsAlert') || 'Save as alert'}
              </button>
            )}
          </div>
        </div>

        {/* Prominent zero-results rescue banner — visible the moment the live
            counter hits 0 with at least one filter active. Empty-result
            moments are the highest-churn point in a search session; this
            converts them into saved alerts before the renter bounces to a
            competitor. The original bottom-of-page NotifyMeCard is still
            rendered as a secondary placement for non-filtered empty
            states. */}
        {properties.length === 0 && activeFilterCount > 0 && !filtering && (
          <div
            className="mb-6 rounded-2xl p-5 sm:p-6 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4"
            style={{
              backgroundColor: '#1E6A6A',
              color: '#fafaf0',
              border: '1.5px solid #D4AF37',
            }}
            data-testid="zero-results-alert-cta"
          >
            <div className="flex items-start gap-3">
              <div
                className="shrink-0 w-10 h-10 rounded-full flex items-center justify-center"
                style={{ backgroundColor: 'rgba(212,175,55,0.15)' }}
              >
                <Bell size={18} style={{ color: '#D4AF37' }} />
              </div>
              <div>
                <h3
                  className="text-base sm:text-lg font-semibold mb-0.5"
                  style={{ color: '#D4AF37', fontFamily: 'Playfair Display' }}
                >
                  {t('filters.zeroResultsHeading') || 'No matches right now'}
                </h3>
                <p className="text-xs sm:text-sm opacity-90 leading-snug">
                  {t('filters.zeroResultsBody') ||
                    "We'll email you the moment a new place matches your filters — usually within 24h of a fresh listing."}
                </p>
              </div>
            </div>
            <button
              onClick={saveCurrentFiltersAsAlert}
              className="shrink-0 inline-flex items-center gap-2 px-5 py-2.5 rounded-full text-sm font-semibold transition-all hover:shadow-md active:scale-[0.97]"
              style={{ backgroundColor: '#D4AF37', color: '#1E6A6A' }}
              data-testid="zero-results-save-alert-btn"
            >
              <Bell size={14} />
              {t('filters.notifyMe') || 'Notify me'}
            </button>
          </div>
        )}

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
                    saveReturnPath();
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

        {/* Holiday window banner suppressed on both Sukkot and Pesach pages
            (per user request). Renters can still pick dates from filters. */}

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

        <div
          className={`grid grid-cols-2 md:grid-cols-2 lg:grid-cols-3 gap-3 md:gap-8 transition-opacity duration-200 ${
            filtering ? 'opacity-60' : 'opacity-100'
          }`}
          data-testid="properties-grid"
        >
          {properties.map((property) => (
            <PropertyCard
              key={property.id}
              property={property}
              isLiked={likedIds.has(property.id)}
              onClick={() => handleCardClick(property)}
              onToggleLike={toggleLike}
              convertPrice={convertPrice}
              apiBase={API}
              // When the user is on /properties/sukkot or /properties/pesach,
              // tell the card which holiday context they're browsing in so
              // the price switches to the matching holiday rate. /vacation
              // and /all keep the regular nightly rate visible.
              holidayContext={['sukkot', 'pesach'].includes(type) ? type : null}
            />
          ))}
        </div>

        {/* Infinite-scroll sentinel + loading spinner. Sits below the grid;
            IntersectionObserver triggers the next page fetch ~one viewport
            before it actually scrolls into view (rootMargin: 400px). */}
        {properties.length > 0 && hasMore && (
          <div
            ref={sentinelRefCb}
            className="flex items-center justify-center py-8 text-gray-400 text-sm"
            data-testid="properties-infinite-sentinel"
          >
            {loadingMore ? (
              <span className="inline-flex items-center gap-2">
                <Loader2 size={16} className="animate-spin" />
                {t('filters.loadingMore') || 'Loading more…'}
              </span>
            ) : null}
          </div>
        )}

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
