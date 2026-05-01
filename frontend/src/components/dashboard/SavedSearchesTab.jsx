import React, { useEffect, useState, useCallback } from 'react';
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
} from 'lucide-react';
import { toast } from 'sonner';

/**
 * Renter dashboard — "Alerts" tab.
 *
 * Primary content: properties that have matched any of the renter's active
 * availability alerts (pulled from ``GET /api/saved-searches/matches``).
 * The underlying alert criteria are collapsed into a secondary "Manage my
 * alerts" drawer so the page's hero is *matching listings*, not settings.
 */
const SavedSearchesTab = ({ API, token }) => {
  const navigate = useNavigate();
  const [searches, setSearches] = useState([]);
  const [matches, setMatches] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showManage, setShowManage] = useState(false);

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
            My Alerts
          </h2>
          <p className="text-sm text-gray-500 mt-1">
            New listings that match your criteria show up here. You'll also get an email + in-app ping.
          </p>
        </div>
        <button
          onClick={() => navigate('/properties/all')}
          className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-semibold text-white transition-all hover:shadow-md"
          style={{ backgroundColor: '#1E6A6A' }}
          data-testid="create-alert-cta"
          title="Run a search, then tap 'Save as alert' in the filter drawer"
        >
          <Sparkles size={15} />
          Create new alert
        </button>
      </div>

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
            {searches.length === 0 ? 'No alerts yet' : 'No new matches yet'}
          </p>
          <p className="text-gray-500 text-sm max-w-md mx-auto">
            {searches.length === 0
              ? 'Head to properties, pick your filters, and hit "Save as alert" — we\'ll watch new listings for you.'
              : "We're watching for you. You'll be notified the moment a property matches one of your alerts."}
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
                ? 'Price drop'
                : m.reason === 'reactivated'
                ? 'Back on market'
                : 'Just listed';
            return (
              <button
                key={m.id}
                type="button"
                onClick={() => navigate(`/property/${m.property_id}`)}
                className="text-left rounded-2xl bg-white overflow-hidden border border-gray-100 transition-all hover:shadow-lg hover:border-[#D4AF37]/40"
                data-testid={`alert-match-${m.property_id}`}
              >
                <div className="relative h-40 bg-gray-100">
                  {Array.isArray(p.images) && p.images[0] ? (
                    <img
                      src={p.images[0]}
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
              </button>
            );
          })}
        </div>
      )}

      {/* Secondary: collapsible alert management */}
      {searches.length > 0 && (
        <div className="pt-2">
          <button
            onClick={() => setShowManage((v) => !v)}
            className="inline-flex items-center gap-2 text-sm font-semibold text-[#1E6A6A] hover:text-[#155454] transition-colors"
            data-testid="toggle-manage-alerts"
          >
            <Settings size={14} />
            Manage my alerts ({searches.length})
            {showManage ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
          </button>

          {showManage && (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3 mt-4" data-testid="manage-alerts-panel">
              {searches.map((s) => {
                const f = s.filters || {};
                const days = daysRemaining(s.expires_at);
                return (
                  <div
                    key={s.id}
                    onClick={() => navigate(buildSearchPath(s))}
                    className="rounded-2xl bg-white p-4 transition-all hover:shadow-md cursor-pointer"
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
                    <div className="flex items-start justify-between mb-2">
                      <div className="flex items-center gap-2 min-w-0">
                        <div className="w-7 h-7 rounded-lg bg-[#D4AF37]/15 flex items-center justify-center flex-shrink-0">
                          <Bell className="text-[#D4AF37]" size={13} />
                        </div>
                        <h3 className="text-sm font-bold text-[#1E6A6A] line-clamp-1">{s.name}</h3>
                      </div>
                      <div className="flex items-center gap-1 flex-shrink-0">
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            copySearchLink(s);
                          }}
                          className="text-gray-400 hover:text-[#1E6A6A] transition-colors p-1"
                          data-testid={`saved-search-copy-${s.id}`}
                          aria-label="Copy search link"
                          title="Copy search link"
                        >
                          <LinkIcon size={14} />
                        </button>
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            handleDelete(s.id);
                          }}
                          className="text-gray-400 hover:text-red-500 transition-colors p-1"
                          data-testid={`saved-search-delete-${s.id}`}
                          aria-label="Remove alert"
                        >
                          <Trash2 size={14} />
                        </button>
                      </div>
                    </div>

                    <div className="space-y-1 text-[11px] text-gray-600 mb-2">
                      {f.area && (
                        <div className="flex items-center gap-1.5">
                          <MapPin size={11} className="text-[#1E6A6A]" />
                          <span>{f.area}</span>
                        </div>
                      )}
                      {f.rental_type && (
                        <div className="flex items-center gap-1.5">
                          <HomeIcon size={11} className="text-[#1E6A6A]" />
                          <span className="capitalize">{String(f.rental_type).replace('-', ' ')}</span>
                        </div>
                      )}
                      {(f.bedrooms_min || f.max_price) && (
                        <div className="flex items-center gap-1.5">
                          <DollarSign size={11} className="text-[#1E6A6A]" />
                          <span>
                            {f.bedrooms_min ? `${f.bedrooms_min}+ BR` : ''}
                            {f.bedrooms_min && f.max_price ? ' · ' : ''}
                            {f.max_price ? `≤ ${Number(f.max_price).toLocaleString()}` : ''}
                          </span>
                        </div>
                      )}
                      {f.start_date && f.end_date && (
                        <div className="flex items-center gap-1.5">
                          <Calendar size={11} className="text-[#1E6A6A]" />
                          <span>
                            {f.start_date} → {f.end_date}
                          </span>
                        </div>
                      )}
                    </div>

                    <div className="text-[10px] text-gray-400 pt-2 border-t border-[#f0ece4]">
                      {days > 0 ? `Expires in ${days} day${days === 1 ? '' : 's'}` : 'Expired'}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}
    </div>
  );
};

export default SavedSearchesTab;
