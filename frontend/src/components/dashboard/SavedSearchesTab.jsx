import React, { useEffect, useState, useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';
import axios from 'axios';
import {
  Bell,
  Trash2,
  Calendar,
  MapPin,
  Home as HomeIcon,
  DollarSign,
  Link as LinkIcon,
  ChevronDown,
  ChevronUp,
  Settings,
  Sparkles,
  Bed,
  Bath,
  X,
  Search,
} from 'lucide-react';
import { toast } from 'sonner';
import { sizedImage, srcSet } from '../../utils/cdnImage';

// Same neighborhood groupings used by /properties — keeping them in sync.
const AREA_GROUPS = [
  {
    label: 'Jerusalem',
    cities: ['Abu Tor','Arnona','Arzei HaBira','Baka','Bayit VeGan','Beit HaKerem','French Hill','Geula','German Colony','Gilo','Givat HaMivtar','Givat Shaul','Har Nof','Jewish Quarter','Katamon','Kiryat HaYovel','Kiryat Moshe','Maalot Dafna','Mamilla','Mea Shearim','Nachlaot','Neve Yaakov','Old City','Pisgat Zeev','Ramat Eshkol','Ramat Shlomo','Ramot','Rehavia','Sanhedria','Talbiya','Talpiot'],
    prefix: 'Jerusalem - ',
  },
  {
    label: 'Tel Aviv',
    cities: ['City Center','Florentin','Jaffa (Yafo)','Neve Tzedek','Old North','Ramat Aviv','Ramat HaHayal','Sarona','Shapira','White City','Yad Eliyahu'],
    prefix: 'Tel Aviv - ',
  },
  {
    label: 'Haifa',
    cities: ['Ahuza','Carmel Center','German Colony','Hadar HaCarmel',"Neve Sha'anan",'Stella Maris','Wadi Nisnas'],
    prefix: 'Haifa - ',
  },
  {
    label: 'Other',
    cities: ['Ashdod','Ashkelon','Bat Yam','Beersheba','Beit Shemesh','Bnei Brak','Eilat','Herzliya','Kfar Saba','Modiin','Netanya','Petah Tikva','Raanana','Ramat Gan','Rehovot','Rishon LeZion'],
    prefix: '',
  },
];

const RENTAL_TYPES = [
  { value: 'all', tk: 'anyType' },
  { value: 'long-term', tk: 'longTermLabel' },
  { value: 'short-term', tk: 'shortTermLabel' },
  { value: 'vacation', tk: 'vacationLabel' },
  { value: 'storage', tk: 'storageLabel' },
];

const EMPTY_FILTERS = {
  name: '',
  rental_type: 'all',
  area: '',
  bedrooms_min: '',
  max_price: '',
  max_price_currency: 'ILS',
  start_date: '',
  flexible_dates: false,
};

// Fuzziness window applied to start_date when matching properties.
// Long-term & storage searches are inherently fuzzy (people move on flexible
// dates); short-term/vacation only fuzz when the renter opts in.
function fuzzinessForFilters({ rental_type, flexible_dates }) {
  if (rental_type === 'short-term' || rental_type === 'vacation') {
    return flexible_dates ? 7 : 0;
  }
  // long-term, storage, or "all" → default 30-day window
  return 30;
}

/**
 * Inline form for creating a saved-search alert. Lets the renter pick
 * filters directly inside the Alerts tab — no need to bounce to the
 * properties page. Mirrors the backend SavedSearchFilters schema.
 */
const CreateAlertForm = ({ API, token, onCreated, onCancel }) => {
  const { t } = useTranslation();
  const [form, setForm] = useState(EMPTY_FILTERS);
  const [submitting, setSubmitting] = useState(false);

  const update = (k, v) => setForm((prev) => ({ ...prev, [k]: v }));

  const submit = async (e) => {
    e.preventDefault();
    if (!form.area && !form.max_price && !form.bedrooms_min && form.rental_type === 'all') {
      toast.error('Please add at least one filter so we know what to watch for.');
      return;
    }
    setSubmitting(true);
    try {
      const filters = {
        rental_type: form.rental_type !== 'all' ? form.rental_type : null,
        area: form.area || null,
        bedrooms_min: form.bedrooms_min ? Number(form.bedrooms_min) : null,
        max_price: form.max_price ? Number(form.max_price) : null,
        max_price_currency: form.max_price ? form.max_price_currency : null,
        start_date: form.start_date || null,
        end_date: null,
      };
      await axios.post(
        `${API}/saved-searches`,
        {
          name: form.name?.trim() || null,
          filters,
          date_fuzziness_days: fuzzinessForFilters(form),
        },
        { headers: { Authorization: `Bearer ${token}` } },
      );
      toast.success(t('savedSearches.toastCreated'));
      setForm(EMPTY_FILTERS);
      onCreated?.();
    } catch (err) {
      toast.error(err.response?.data?.detail || t('savedSearches.toastFailed'));
    } finally {
      setSubmitting(false);
    }
  };

  const inputCls = 'w-full px-3.5 py-2.5 rounded-lg text-sm bg-white focus:outline-none focus:ring-2 focus:ring-[#1E6A6A]/20 focus:border-[#1E6A6A] transition-all border border-gray-200';

  return (
    <form
      onSubmit={submit}
      className="rounded-2xl border border-[#1E6A6A]/20 bg-gradient-to-br from-white to-[#f7faf9] p-5 md:p-6 space-y-4"
      data-testid="create-alert-form"
    >
      <div className="flex items-start justify-between gap-3 mb-1">
        <div>
          <h3 className="text-base font-bold text-gray-900 flex items-center gap-2">
            <Sparkles size={16} className="text-[#D4AF37]" /> {t('savedSearches.newAlertHeading')}
          </h3>
          <p className="text-xs text-gray-500 mt-0.5">
            {t('savedSearches.newAlertSub')}
          </p>
        </div>
        <button
          type="button"
          onClick={onCancel}
          className="text-gray-400 hover:text-gray-600 p-1"
          aria-label={t('savedSearches.close')}
          data-testid="create-alert-close"
        >
          <X size={18} />
        </button>
      </div>

      <div>
        <label className="text-[11px] font-semibold text-gray-500 uppercase tracking-wider mb-1.5 block">{t('savedSearches.alertName')}</label>
        <input
          type="text"
          value={form.name}
          onChange={(e) => update('name', e.target.value)}
          placeholder="e.g. 3BR in Jerusalem under ₪7,000"
          className={inputCls}
          data-testid="alert-name-input"
        />
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-3.5">
        <div>
          <label className="text-[11px] font-semibold text-gray-500 uppercase tracking-wider mb-1.5 block">{t('savedSearches.rentalType')}</label>
          <select
            value={form.rental_type}
            onChange={(e) => update('rental_type', e.target.value)}
            className={inputCls}
            data-testid="alert-rental-type"
          >
            {RENTAL_TYPES.map((rt) => (
              <option key={rt.value} value={rt.value}>{t(`savedSearches.${rt.tk}`)}</option>
            ))}
          </select>
        </div>

        <div>
          <label className="text-[11px] font-semibold text-gray-500 uppercase tracking-wider mb-1.5 block">{t('savedSearches.area')}</label>
          <select
            value={form.area}
            onChange={(e) => update('area', e.target.value)}
            className={inputCls}
            data-testid="alert-area"
          >
            <option value="">{t('savedSearches.anywhere')}</option>
            {AREA_GROUPS.map((g) => (
              <optgroup key={g.label} label={g.label}>
                {g.cities.map((c) => (
                  <option key={`${g.prefix}${c}`} value={`${g.prefix}${c}`}>{c}</option>
                ))}
              </optgroup>
            ))}
          </select>
        </div>

        <div>
          <label className="text-[11px] font-semibold text-gray-500 uppercase tracking-wider mb-1.5 block">{t('savedSearches.minBedrooms')}</label>
          <input
            type="number"
            min="0"
            step="0.5"
            value={form.bedrooms_min}
            onChange={(e) => update('bedrooms_min', e.target.value)}
            placeholder="Any"
            className={inputCls}
            data-testid="alert-bedrooms"
          />
        </div>

        <div>
          <label className="text-[11px] font-semibold text-gray-500 uppercase tracking-wider mb-1.5 block">{t('savedSearches.maxPrice')}</label>
          <div className="flex">
            <select
              value={form.max_price_currency}
              onChange={(e) => update('max_price_currency', e.target.value)}
              className="px-2.5 py-2.5 rounded-l-lg text-sm bg-gray-50 border border-r-0 border-gray-200 text-gray-700 focus:outline-none focus:ring-2 focus:ring-[#1E6A6A]/20 focus:border-[#1E6A6A] cursor-pointer"
              data-testid="alert-currency"
              aria-label={t('savedSearches.currency')}
            >
              <option value="ILS">₪ ILS</option>
              <option value="USD">$ USD</option>
            </select>
            <input
              type="number"
              min="0"
              value={form.max_price}
              onChange={(e) => update('max_price', e.target.value)}
              placeholder="No max"
              className={`${inputCls} rounded-l-none border-l-0 flex-1`}
              data-testid="alert-max-price"
            />
          </div>
        </div>

        <div>
          <label className="text-[11px] font-semibold text-gray-500 uppercase tracking-wider mb-1.5 block">{t('savedSearches.availableFrom')}</label>
          <input
            type="date"
            value={form.start_date}
            onChange={(e) => update('start_date', e.target.value)}
            className={inputCls}
            data-testid="alert-start-date"
          />
          {form.start_date && (
            <p className="text-[11px] text-gray-500 mt-1.5" data-testid="alert-fuzziness-hint">
              {form.rental_type === 'short-term' || form.rental_type === 'vacation'
                ? form.flexible_dates
                  ? 'Including listings ±7 days around this date.'
                  : 'Only exact-date matches. Toggle "Flexible dates" to widen.'
                : 'Including listings ±30 days around this date.'}
            </p>
          )}
        </div>
      </div>

      {(form.rental_type === 'short-term' || form.rental_type === 'vacation') && (
        <div className="flex items-center justify-between gap-3 rounded-xl border border-gray-200 bg-white px-4 py-3" data-testid="flexible-dates-toggle">
          <div className="flex-1 min-w-0">
            <p className="text-sm font-semibold text-gray-800">{t('savedSearches.flexibleDates')}</p>
            <p className="text-xs text-gray-500 mt-0.5">
              Also notify me about listings starting within 7 days of my move-in date.
            </p>
          </div>
          <button
            type="button"
            role="switch"
            aria-checked={form.flexible_dates}
            onClick={() => update('flexible_dates', !form.flexible_dates)}
            className={`relative inline-flex h-6 w-11 flex-shrink-0 items-center rounded-full transition-colors ${form.flexible_dates ? 'bg-[#1E6A6A]' : 'bg-gray-300'}`}
            data-testid="flexible-dates-switch"
          >
            <span
              className={`inline-block h-5 w-5 transform rounded-full bg-white transition-transform ${form.flexible_dates ? 'translate-x-5' : 'translate-x-0.5'}`}
            />
          </button>
        </div>
      )}

      <div className="flex items-center justify-between gap-3 pt-1">
        <p className="text-[11px] text-gray-400">
          {t('savedSearches.leaveBlankTip')}
        </p>
        <div className="flex gap-2">
          <button
            type="button"
            onClick={onCancel}
            className="px-4 py-2 rounded-xl text-sm font-medium text-gray-600 hover:text-gray-900 transition-colors"
            data-testid="alert-cancel-btn"
          >
            {t('savedSearches.cancelBtn')}
          </button>
          <button
            type="submit"
            disabled={submitting}
            className="inline-flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-semibold text-white transition-all hover:shadow-md disabled:opacity-50"
            style={{ backgroundColor: '#1E6A6A' }}
            data-testid="alert-submit-btn"
          >
            <Bell size={14} />
            {submitting ? t('savedSearches.savingDots') : t('savedSearches.createAlert')}
          </button>
        </div>
      </div>
    </form>
  );
};

/**
 * Renter dashboard — "Alerts" tab.
 *
 * Primary content: properties that have matched any of the renter's active
 * availability alerts (pulled from ``GET /api/saved-searches/matches``).
 * The underlying alert criteria are collapsed into a secondary "Manage my
 * alerts" drawer so the page's hero is *matching listings*, not settings.
 */
const SavedSearchesTab = ({ API, token }) => {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const [searches, setSearches] = useState([]);
  const [matches, setMatches] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showManage, setShowManage] = useState(false);
  const [showCreate, setShowCreate] = useState(false);

  const fetchAll = useCallback(async () => {
    setLoading(true);
    try {
      const [sRes, mRes] = await Promise.all([
        axios.get(`${API}/saved-searches`, { headers: { Authorization: `Bearer ${token}` } }),
        axios.get(`${API}/saved-searches/matches`, {
          headers: { Authorization: `Bearer ${token}` },
        }),
      ]);
      setSearches(sRes.data || []);
      setMatches(mRes.data || []);
    } catch (err) {
      console.error('Failed to load alerts', err);
      toast.error('Failed to load alerts');
    } finally {
      setLoading(false);
    }
  }, [API, token]);

  useEffect(() => {
    fetchAll();
  }, [fetchAll]);

  const handleDelete = async (id) => {
    try {
      await axios.delete(`${API}/saved-searches/${id}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      setSearches((prev) => prev.filter((s) => s.id !== id));
      setMatches((prev) => prev.filter((m) => m.search_id !== id));
      toast.success('Alert removed');
    } catch {
      toast.error('Failed to remove alert');
    }
  };

  const handleHideMatch = async (matchId) => {
    // Optimistic removal; restore on failure
    const prev = matches;
    setMatches((cur) => cur.filter((m) => m.id !== matchId));
    try {
      await axios.post(
        `${API}/saved-searches/matches/${matchId}/hide`,
        {},
        { headers: { Authorization: `Bearer ${token}` } }
      );
    } catch {
      setMatches(prev);
      toast.error('Could not hide this match');
    }
  };

  const daysRemaining = (expiresAt) => {
    if (!expiresAt) return null;
    const ms = new Date(expiresAt).getTime() - Date.now();
    return Math.max(0, Math.ceil(ms / (1000 * 60 * 60 * 24)));
  };

  // ---- Shareable search URL ------------------------------------------------
  const buildSearchPath = (s) => {
    const f = s.filters || {};
    const segment = f.rental_type && f.rental_type !== 'all' ? f.rental_type : 'all';
    const params = new URLSearchParams();
    const passthrough = [
      'area',
      'bedrooms_min',
      'max_price',
      'min_price',
      'min_bathrooms',
      'max_floor',
      'min_porches',
      'has_elevator',
      'condition',
      'start_date',
      'end_date',
    ];
    passthrough.forEach((k) => {
      if (f[k] !== undefined && f[k] !== null && f[k] !== '') {
        if (k === 'start_date') params.append('date_from', f[k]);
        else if (k === 'end_date') params.append('date_to', f[k]);
        else if (k === 'bedrooms_min') params.append('min_bedrooms', f[k]);
        else params.append(k, f[k]);
      }
    });
    const qs = params.toString();
    return `/properties/${segment}${qs ? `?${qs}` : ''}`;
  };

  const copySearchLink = async (s) => {
    const url = `${window.location.origin}${buildSearchPath(s)}`;
    try {
      await navigator.clipboard.writeText(url);
      toast.success('Search link copied');
    } catch {
      try {
        const ta = document.createElement('textarea');
        ta.value = url;
        ta.style.position = 'fixed';
        ta.style.opacity = '0';
        document.body.appendChild(ta);
        ta.select();
        document.execCommand('copy');
        document.body.removeChild(ta);
        toast.success('Search link copied');
      } catch {
        toast.error('Could not copy link');
      }
    }
  };

  // ---- Render --------------------------------------------------------------
  if (loading) {
    return (
      <div className="flex justify-center py-12" data-testid="saved-searches-loading">
        <div className="w-8 h-8 border-[3px] border-[#1E6A6A] border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div className="space-y-6" data-testid="saved-searches-tab">
      <div className="flex items-start justify-between gap-3 flex-wrap">
        <div>
          <h2 className="text-2xl font-bold" style={{ fontFamily: 'Playfair Display' }}>
            {t('dashboard.myAlerts')}
          </h2>
          <p className="text-sm text-gray-500 mt-1">
            {t('dashboard.myAlertsHint')}
          </p>
        </div>
        <button
          onClick={() => setShowCreate((v) => !v)}
          className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-semibold text-white transition-all hover:shadow-md"
          style={{ backgroundColor: '#1E6A6A' }}
          data-testid="create-alert-cta"
        >
          <Sparkles size={15} />
          {showCreate ? 'Close' : t('dashboard.createNewAlert')}
        </button>
      </div>

      {showCreate && (
        <CreateAlertForm
          API={API}
          token={token}
          onCancel={() => setShowCreate(false)}
          onCreated={() => {
            setShowCreate(false);
            fetchAll();
          }}
        />
      )}

      {/* Manage existing alerts — sits right under create so the controls
          live together; the matched-listings hero stays below. */}
      {searches.length > 0 && (
        <div>
          <button
            onClick={() => setShowManage((v) => !v)}
            className="inline-flex items-center gap-2 text-sm font-semibold text-[#1E6A6A] hover:text-[#155454] transition-colors"
            data-testid="toggle-manage-alerts"
          >
            <Settings size={14} />
            {t('dashboard.manageMyAlerts')} ({searches.length})
            {showManage ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
          </button>

          {showManage && (
            <div
              className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-2.5 mt-3"
              data-testid="manage-alerts-panel"
            >
              {searches.map((s) => {
                const f = s.filters || {};
                const days = daysRemaining(s.expires_at);
                return (
                  <div
                    key={s.id}
                    onClick={() => navigate(buildSearchPath(s))}
                    className="rounded-xl bg-white p-3 transition-all hover:shadow-md cursor-pointer"
                    style={{ border: '1px solid #e8e4dc' }}
                    data-testid={`saved-search-${s.id}`}
                    role="button"
                    tabIndex={0}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' || e.key === ' ') {
                        e.preventDefault();
                        navigate(buildSearchPath(s));
                      }
                    }}
                  >
                    <div className="flex items-start justify-between mb-1.5 gap-2">
                      <div className="flex items-center gap-1.5 min-w-0 flex-1">
                        <Bell className="text-[#D4AF37] flex-shrink-0" size={12} />
                        <h3 className="text-xs font-bold text-[#1E6A6A] line-clamp-1">{s.name}</h3>
                      </div>
                      <div className="flex items-center gap-0.5 flex-shrink-0">
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            copySearchLink(s);
                          }}
                          className="text-gray-400 hover:text-[#1E6A6A] transition-colors p-0.5"
                          data-testid={`saved-search-copy-${s.id}`}
                          aria-label={t('savedSearches.copyLink')}
                          title="Copy search link"
                        >
                          <LinkIcon size={12} />
                        </button>
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            handleDelete(s.id);
                          }}
                          className="text-gray-400 hover:text-red-500 transition-colors p-0.5"
                          data-testid={`saved-search-delete-${s.id}`}
                          aria-label={t('savedSearches.removeAlert')}
                        >
                          <Trash2 size={12} />
                        </button>
                      </div>
                    </div>

                    <div className="space-y-0.5 text-[11px] text-gray-600">
                      {f.area && (
                        <div className="flex items-center gap-1 truncate">
                          <MapPin size={10} className="text-[#1E6A6A] flex-shrink-0" />
                          <span className="truncate">{f.area}</span>
                        </div>
                      )}
                      {f.rental_type && (
                        <div className="flex items-center gap-1">
                          <HomeIcon size={10} className="text-[#1E6A6A] flex-shrink-0" />
                          <span className="capitalize truncate">{String(f.rental_type).replace('-', ' ')}</span>
                        </div>
                      )}
                      {(f.bedrooms_min || f.max_price) && (
                        <div className="flex items-center gap-1">
                          <DollarSign size={10} className="text-[#1E6A6A] flex-shrink-0" />
                          <span className="truncate">
                            {f.bedrooms_min ? `${f.bedrooms_min}+ BR` : ''}
                            {f.bedrooms_min && f.max_price ? ' · ' : ''}
                            {f.max_price
                              ? `≤ ${(f.max_price_currency || 'ILS') === 'USD' ? '$' : '₪'}${Number(f.max_price).toLocaleString()}`
                              : ''}
                          </span>
                        </div>
                      )}
                      {f.start_date && f.end_date && (
                        <div className="flex items-center gap-1">
                          <Calendar size={10} className="text-[#1E6A6A] flex-shrink-0" />
                          <span className="truncate">{f.start_date} → {f.end_date}</span>
                        </div>
                      )}
                    </div>

                    <div className="text-[10px] text-gray-400 mt-2 pt-1.5 border-t border-[#f0ece4]">
                      {days > 0
                        ? `${days}${days === 1 ? 'd' : 'd'} left`
                        : t('dashboard.expired')}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* Primary: matching properties */}
      {matches.length === 0 ? (
        <div
          className="rounded-2xl p-12 text-center border border-dashed"
          style={{ borderColor: '#d4cec2', background: '#fafaf8' }}
          data-testid="matches-empty"
        >
          <div className="w-14 h-14 rounded-full bg-[#1E6A6A]/10 flex items-center justify-center mx-auto mb-4">
            <Bell className="text-[#1E6A6A]" size={22} />
          </div>
          <p className="text-gray-700 font-medium mb-1">
            {searches.length === 0 ? t('dashboard.noAlerts') : t('dashboard.noNewMatches')}
          </p>
          <p className="text-gray-500 text-sm max-w-md mx-auto">
            {searches.length === 0
              ? t('dashboard.noAlertsHint')
              : t('dashboard.watchingForYou')}
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4" data-testid="alert-matches-grid">
          {matches.map((m) => {
            const p = m.property || {};
            const bed = p.bedrooms;
            const bath = p.bathrooms;
            const priceLabel = p.price
              ? `${(p.currency || 'ILS') === 'USD' ? '$' : '₪'}${Number(p.price).toLocaleString()}`
              : '';
            const reasonLabel =
              m.reason === 'price_drop'
                ? t('dashboard.priceDrop')
                : m.reason === 'reactivated'
                ? t('dashboard.backOnMarket')
                : t('dashboard.justListed');
            return (
              <div
                key={m.id}
                onClick={() => navigate(`/property/${m.property_id}`)}
                className="text-left rounded-2xl bg-white overflow-hidden border border-gray-100 transition-all hover:shadow-lg hover:border-[#D4AF37]/40 cursor-pointer relative group"
                data-testid={`alert-match-${m.property_id}`}
                role="button"
                tabIndex={0}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' || e.key === ' ') {
                    e.preventDefault();
                    navigate(`/property/${m.property_id}`);
                  }
                }}
              >
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    handleHideMatch(m.id);
                  }}
                  className="absolute top-2 right-2 z-10 w-7 h-7 rounded-full bg-white/90 backdrop-blur-sm text-gray-600 hover:text-red-500 hover:bg-white shadow-sm flex items-center justify-center transition-all opacity-0 group-hover:opacity-100 focus:opacity-100"
                  data-testid={`alert-match-hide-${m.id}`}
                  aria-label={t('savedSearches.hideMatch')}
                  title="Hide this match"
                >
                  <X size={14} />
                </button>
                <div className="relative h-40 bg-gray-100">
                  {Array.isArray(p.images) && p.images[0] ? (
                    <img
                      src={sizedImage(p.images[0], 400)}
                      srcSet={srcSet(p.images[0], 400)}
                      sizes="(max-width: 768px) 50vw, 400px"
                      alt={p.title || 'Property'}
                      className="w-full h-full object-cover"
                    />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center">
                      <HomeIcon size={36} className="text-gray-300" />
                    </div>
                  )}
                  <span
                    className="absolute top-2 left-2 px-2 py-1 rounded-full text-[10px] font-bold tracking-wide text-[#1E6A6A]"
                    style={{ backgroundColor: '#D4AF37' }}
                  >
                    {reasonLabel}
                  </span>
                </div>
                <div className="p-4 space-y-1.5">
                  <p className="text-[11px] text-[#D4AF37] font-bold uppercase tracking-wider line-clamp-1">
                    {m.search_name}
                  </p>
                  <p className="text-sm font-bold text-gray-900 line-clamp-1">
                    {p.title || 'Untitled property'}
                  </p>
                  <div className="flex items-center gap-3 text-xs text-gray-500">
                    {p.area && (
                      <span className="inline-flex items-center gap-1">
                        <MapPin size={11} /> {p.area}
                      </span>
                    )}
                    {bed !== undefined && bed !== null && (
                      <span className="inline-flex items-center gap-1">
                        <Bed size={11} /> {bed}
                      </span>
                    )}
                    {bath !== undefined && bath !== null && (
                      <span className="inline-flex items-center gap-1">
                        <Bath size={11} /> {bath}
                      </span>
                    )}
                  </div>
                  {priceLabel && (
                    <p className="text-sm font-semibold text-[#1E6A6A] pt-1">{priceLabel}</p>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Secondary: collapsible alert management */}
    </div>
  );
};

export default SavedSearchesTab;
