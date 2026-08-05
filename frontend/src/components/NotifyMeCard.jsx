import React, { useState, useContext } from 'react';
import axios from 'axios';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { Bell, Sparkles } from 'lucide-react';
import { toast } from 'sonner';
import { API, AuthContext } from '../App';
import { areaLabel } from '../utils/areaNames';

// Rental-type filter value → the shared translation key already used for
// this same label elsewhere (StayTypePicker, FiltersModal) so the chip
// text matches exactly instead of introducing a second translation of
// the same concept.
const RENTAL_TYPE_KEY = {
  vacation: 'property.vacationType',
  'short-term': 'property.shortTerm',
  'long-term': 'property.longTerm',
};

/**
 * Renter-facing "save this search" card. Rendered inside the search results'
 * empty state when there are 0 matching properties. Requires sign-in; if the
 * user isn't logged in we redirect them to /auth with a return URL.
 */
const NotifyMeCard = ({ filters, dateRange }) => {
  const { t } = useTranslation();
  const { token } = useContext(AuthContext);
  const navigate = useNavigate();
  const [saving, setSaving] = useState(false);

  // Build the summary chips from the current filters
  const chips = [];
  if (filters.rental_type) {
    const key = RENTAL_TYPE_KEY[filters.rental_type];
    chips.push(key ? t(key, String(filters.rental_type).replace('-', ' ')) : String(filters.rental_type).replace('-', ' '));
  }
  if (filters.area) chips.push(areaLabel(filters.area, t));
  if (filters.min_bedrooms) chips.push(t('stays.bedroomsPlusChip', '{{count}}+ BR', { count: filters.min_bedrooms }));
  if (filters.max_price) chips.push(`≤ ${Number(filters.max_price).toLocaleString()}`);
  if (dateRange?.from && dateRange?.to) {
    const fmt = (d) => d.toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
    chips.push(`${fmt(dateRange.from)} → ${fmt(dateRange.to)}`);
  }

  const handleSave = async () => {
    if (!token) {
      toast.error(t('stays.notifySignInToast', 'Please sign in to save this alert.'));
      navigate('/auth?return=' + encodeURIComponent(window.location.pathname + window.location.search));
      return;
    }
    setSaving(true);
    try {
      const body = {
        filters: {
          rental_type: filters.rental_type || null,
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
        toast.success(t('stays.notifyAlreadyActive', "Alert already active — we'll notify you when something matches."));
      } else {
        toast.success(t('stays.notifySaved', "Saved! We'll email and notify you when a match becomes available."));
      }
    } catch (err) {
      toast.error(err.response?.data?.detail || t('stays.notifySaveFailed', 'Failed to save alert'));
    } finally {
      setSaving(false);
    }
  };

  return (
    <div
      className="max-w-2xl mx-auto mt-10 rounded-2xl p-8 md:p-10 text-center"
      style={{
        background: 'linear-gradient(135deg, var(--brand-primary) 0%, #2A8585 100%)',
        boxShadow: '0 20px 50px rgba(30, 95, 140,0.25)',
      }}
      data-testid="notify-me-card"
    >
      <div className="flex justify-center mb-4">
        <div className="w-14 h-14 rounded-full bg-[rgb(var(--gold-rgb)/<alpha-value>)]/20 border border-[rgb(var(--gold-rgb)/<alpha-value>)]/40 flex items-center justify-center">
          <Bell className="text-[var(--gold)]" size={24} />
        </div>
      </div>
      <h3 className="text-2xl font-bold text-white mb-2" style={{ fontFamily: 'Playfair Display' }}>
        {t('stays.notifyTitle', "Don't see what you're looking for?")}
      </h3>
      <p className="text-white/80 text-sm leading-relaxed mb-5 max-w-md mx-auto">
        {t('stays.notifyBody', "We'll watch new listings for you and ping you by email + in-app the moment a property matches your filters — including ±30 days around your dates.")}
      </p>

      {chips.length > 0 && (
        <div className="flex flex-wrap gap-2 justify-center mb-6">
          {chips.map((c, i) => (
            <span
              key={`${c}-${i}`}
              className="px-3 py-1 rounded-full text-[11px] font-semibold tracking-wide bg-white/10 text-white border border-white/15"
              data-testid={`notify-chip-${i}`}
            >
              {c}
            </span>
          ))}
        </div>
      )}

      <button
        onClick={handleSave}
        disabled={saving}
        className="inline-flex items-center gap-2 px-6 py-3 rounded-xl text-sm font-bold tracking-wide text-[var(--brand-primary)] transition-all duration-200 hover:shadow-xl hover:scale-[1.02] active:scale-[0.98] disabled:opacity-60"
        style={{ backgroundColor: 'var(--gold)' }}
        data-testid="notify-me-save-btn"
      >
        <Sparkles size={16} />
        {saving ? t('stays.notifySaving', 'Saving…') : t('stays.notifyCta', 'Notify me when available')}
      </button>

      <p className="text-white/50 text-[11px] mt-4">
        {t('stays.notifyFooter', 'Alert auto-expires after 60 days. Manage alerts in your dashboard.')}
      </p>
    </div>
  );
};

export default NotifyMeCard;
