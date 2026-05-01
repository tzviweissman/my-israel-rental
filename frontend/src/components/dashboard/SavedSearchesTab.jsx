import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import axios from 'axios';
import { Bell, Trash2, Calendar, MapPin, Home as HomeIcon, DollarSign } from 'lucide-react';
import { toast } from 'sonner';

/**
 * Renter dashboard tab — list & remove the user's active availability alerts.
 * Alerts expire after 60 days (enforced server-side); we show the remaining
 * days for each so renters know when they'll need to re-subscribe.
 */
const SavedSearchesTab = ({ API, token }) => {
  const [searches, setSearches] = useState([]);
  const [loading, setLoading] = useState(true);
  const navigate = useNavigate();

  const fetchSearches = async () => {
    setLoading(true);
    try {
      const res = await axios.get(`${API}/saved-searches`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      setSearches(res.data || []);
    } catch (err) {
      toast.error('Failed to load alerts');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchSearches();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleDelete = async (id) => {
    try {
      await axios.delete(`${API}/saved-searches/${id}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      setSearches((prev) => prev.filter((s) => s.id !== id));
      toast.success('Alert removed');
    } catch (err) {
      toast.error('Failed to remove alert');
    }
  };

  const daysRemaining = (expiresAt) => {
    if (!expiresAt) return null;
    const ms = new Date(expiresAt).getTime() - Date.now();
    return Math.max(0, Math.ceil(ms / (1000 * 60 * 60 * 24)));
  };

  // Deep-link to the Properties page with the saved filters applied, so the
  // renter sees the matching listings immediately.
  const openSearch = (s) => {
    const f = s.filters || {};
    const segment = (f.rental_type && f.rental_type !== 'all') ? f.rental_type : 'all';
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
        // Normalize field names between saved-search schema and Properties.js URL params
        if (k === 'start_date') params.append('date_from', f[k]);
        else if (k === 'end_date') params.append('date_to', f[k]);
        else if (k === 'bedrooms_min') params.append('min_bedrooms', f[k]);
        else params.append(k, f[k]);
      }
    });
    const qs = params.toString();
    navigate(`/properties/${segment}${qs ? `?${qs}` : ''}`);
  };

  return (
    <div className="space-y-6" data-testid="saved-searches-tab">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold" style={{ fontFamily: 'Playfair Display' }}>
            My Alerts
          </h2>
          <p className="text-sm text-gray-500 mt-1">
            We'll email and notify you in-app when a property matches.
          </p>
        </div>
      </div>

      {loading ? (
        <div className="flex justify-center py-12">
          <div className="w-8 h-8 border-[3px] border-[#1E6A6A] border-t-transparent rounded-full animate-spin" />
        </div>
      ) : searches.length === 0 ? (
        <div
          className="rounded-2xl p-12 text-center border border-dashed"
          style={{ borderColor: '#d4cec2', background: '#fafaf8' }}
          data-testid="saved-searches-empty"
        >
          <div className="w-14 h-14 rounded-full bg-[#1E6A6A]/10 flex items-center justify-center mx-auto mb-4">
            <Bell className="text-[#1E6A6A]" size={22} />
          </div>
          <p className="text-gray-600 mb-2">You have no active alerts.</p>
          <p className="text-gray-500 text-sm">
            Run a search and tap "Notify me when available" on the empty results page to start one.
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {searches.map((s) => {
            const f = s.filters || {};
            const days = daysRemaining(s.expires_at);
            return (
              <div
                key={s.id}
                onClick={() => openSearch(s)}
                className="rounded-2xl bg-white p-5 transition-all hover:shadow-md cursor-pointer"
                style={{ border: '1px solid #e8e4dc' }}
                data-testid={`saved-search-${s.id}`}
                role="button"
                tabIndex={0}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' || e.key === ' ') {
                    e.preventDefault();
                    openSearch(s);
                  }
                }}
              >
                <div className="flex items-start justify-between mb-3">
                  <div className="flex items-center gap-2">
                    <div className="w-8 h-8 rounded-lg bg-[#D4AF37]/15 flex items-center justify-center">
                      <Bell className="text-[#D4AF37]" size={14} />
                    </div>
                    <h3 className="text-sm font-bold text-[#1E6A6A] line-clamp-1">{s.name}</h3>
                  </div>
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      handleDelete(s.id);
                    }}
                    className="text-gray-400 hover:text-red-500 transition-colors p-1"
                    data-testid={`saved-search-delete-${s.id}`}
                    aria-label="Remove alert"
                  >
                    <Trash2 size={15} />
                  </button>
                </div>

                <div className="space-y-1.5 text-xs text-gray-600 mb-3">
                  {f.area && (
                    <div className="flex items-center gap-1.5">
                      <MapPin size={12} className="text-[#1E6A6A]" />
                      <span>{f.area}</span>
                    </div>
                  )}
                  {f.rental_type && (
                    <div className="flex items-center gap-1.5">
                      <HomeIcon size={12} className="text-[#1E6A6A]" />
                      <span className="capitalize">{String(f.rental_type).replace('-', ' ')}</span>
                    </div>
                  )}
                  {(f.bedrooms_min || f.max_price) && (
                    <div className="flex items-center gap-1.5">
                      <DollarSign size={12} className="text-[#1E6A6A]" />
                      <span>
                        {f.bedrooms_min ? `${f.bedrooms_min}+ BR` : ''}
                        {f.bedrooms_min && f.max_price ? ' · ' : ''}
                        {f.max_price ? `≤ ${Number(f.max_price).toLocaleString()}` : ''}
                      </span>
                    </div>
                  )}
                  {f.start_date && f.end_date && (
                    <div className="flex items-center gap-1.5">
                      <Calendar size={12} className="text-[#1E6A6A]" />
                      <span>
                        {f.start_date} → {f.end_date}
                      </span>
                    </div>
                  )}
                </div>

                <div className="flex items-center justify-between text-[11px] text-gray-400 pt-3 border-t border-[#f0ece4]">
                  <span>±{s.date_fuzziness_days || 30} days fuzziness</span>
                  <span>
                    {days > 0 ? `Expires in ${days} day${days === 1 ? '' : 's'}` : 'Expired'}
                  </span>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};

export default SavedSearchesTab;
