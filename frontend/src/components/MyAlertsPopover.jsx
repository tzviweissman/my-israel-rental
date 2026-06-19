import React, { useState, useEffect, useContext, useRef } from 'react';
import axios from 'axios';
import { useTranslation } from 'react-i18next';
import { Bell, Trash2, Loader2, ChevronDown } from 'lucide-react';
import { toast } from 'sonner';
import { API, AuthContext } from '../App';

/**
 * Compact "My saved alerts" trigger that lives inline next to the live result
 * counter on the Properties page. Click opens a small popover listing the
 * renter's active saved searches (filters summary per row) with a one-click
 * delete. Today the only way to manage saved alerts is to navigate into the
 * Dashboard → Alerts tab; surfacing them where they were CREATED keeps the
 * renter on the search page.
 *
 * - Only renders when the user is logged in (saved searches are user-scoped).
 * - Lazy-loads on first open so we don't pay the GET on every page mount.
 * - Auto-closes on outside click + ESC.
 */

const filterSummary = (s) => {
  const f = s.filters || {};
  const chips = [];
  if (f.rental_type) chips.push(String(f.rental_type).replace('-', ' '));
  if (f.area) chips.push(f.area);
  if (f.bedrooms_min) chips.push(`${f.bedrooms_min}+ BR`);
  if (f.max_price) chips.push(`≤ ${Number(f.max_price).toLocaleString()}`);
  if (f.start_date && f.end_date) {
    const fmt = (d) => new Date(d).toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
    chips.push(`${fmt(f.start_date)} → ${fmt(f.end_date)}`);
  }
  return chips;
};

const MyAlertsPopover = ({ refreshSignal }) => {
  const { t } = useTranslation();
  const { token } = useContext(AuthContext);
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [alerts, setAlerts] = useState([]);
  const [deletingId, setDeletingId] = useState(null);
  const wrapRef = useRef(null);

  const authHeaders = { headers: { Authorization: `Bearer ${token}` } };

  const fetchAlerts = async () => {
    if (!token) return;
    setLoading(true);
    try {
      const res = await axios.get(`${API}/saved-searches`, authHeaders);
      setAlerts(res.data || []);
    } catch {
      // Soft-fail — we don't want a saved-search hiccup to break the page.
    } finally {
      setLoading(false);
    }
  };

  // Refresh whenever the parent signals a new alert was saved (so the count
  // chip stays accurate without a manual reopen).
  useEffect(() => {
    if (token) fetchAlerts();
  }, [token, refreshSignal]);

  // Close on outside click + ESC
  useEffect(() => {
    if (!open) return undefined;
    const onClick = (e) => {
      if (wrapRef.current && !wrapRef.current.contains(e.target)) setOpen(false);
    };
    const onKey = (e) => {
      if (e.key === 'Escape') setOpen(false);
    };
    document.addEventListener('mousedown', onClick);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('mousedown', onClick);
      document.removeEventListener('keydown', onKey);
    };
  }, [open]);

  const handleDelete = async (id) => {
    setDeletingId(id);
    try {
      await axios.delete(`${API}/saved-searches/${id}`, authHeaders);
      setAlerts((prev) => prev.filter((a) => a.id !== id));
      toast.success(t('filters.alertDeleted') || 'Alert removed');
    } catch (err) {
      toast.error(err.response?.data?.detail || 'Failed to remove alert');
    } finally {
      setDeletingId(null);
    }
  };

  if (!token) return null;

  const count = alerts.length;

  return (
    <div ref={wrapRef} className="relative inline-block" data-testid="my-alerts-popover-wrap">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium transition-all hover:bg-gray-100 text-gray-500 hover:text-[#1E6A6A]"
        data-testid="my-alerts-trigger"
        title={t('filters.myAlertsTooltip') || 'Manage your saved alerts'}
      >
        <Bell size={12} />
        <span>
          {t('filters.myAlerts') || 'My alerts'}{' '}
          <span className="font-semibold text-[#1E6A6A]">({count})</span>
        </span>
        <ChevronDown size={11} className={`transition-transform ${open ? 'rotate-180' : ''}`} />
      </button>

      {open && (
        <div
          className="absolute right-0 mt-2 w-80 rounded-2xl border border-gray-200 bg-white shadow-xl z-50 overflow-hidden"
          data-testid="my-alerts-popover"
        >
          <div className="px-4 py-3 border-b border-gray-100 flex items-center justify-between">
            <span className="text-sm font-semibold text-gray-800">
              {t('filters.myAlertsHeading') || 'Your saved alerts'}
            </span>
            {count > 0 && (
              <span className="text-xs text-gray-400" data-testid="my-alerts-count">
                {count} {count === 1
                  ? (t('filters.alertSingular') || 'active')
                  : (t('filters.alertPlural') || 'active')}
              </span>
            )}
          </div>
          <div className="max-h-72 overflow-y-auto">
            {loading ? (
              <div className="flex items-center justify-center py-8 text-gray-400">
                <Loader2 size={16} className="animate-spin" />
              </div>
            ) : count === 0 ? (
              <p className="text-xs text-gray-500 px-4 py-8 text-center">
                {t('filters.noAlerts')
                  || "No saved alerts yet. Apply some filters and tap “Save as alert” to get notified about new matches."}
              </p>
            ) : (
              <ul className="divide-y divide-gray-100">
                {alerts.map((a) => {
                  const chips = filterSummary(a);
                  return (
                    <li
                      key={a.id}
                      className="px-4 py-3 flex items-start gap-3 hover:bg-gray-50"
                      data-testid={`my-alert-row-${a.id}`}
                    >
                      <div className="flex-1 min-w-0">
                        <div className="flex flex-wrap gap-1 mb-1">
                          {chips.length === 0 ? (
                            <span className="text-xs text-gray-400 italic">
                              {t('filters.anyMatch') || 'Any new listing'}
                            </span>
                          ) : (
                            chips.map((c) => (
                              <span
                                key={c}
                                className="inline-block px-2 py-0.5 rounded-full text-[10px] font-medium bg-[#fafaf0] text-[#1E6A6A] border border-[#e5dfc8]"
                              >
                                {c}
                              </span>
                            ))
                          )}
                        </div>
                        {a.expires_at && (
                          <p className="text-[10px] text-gray-400">
                            {t('filters.alertExpiresOn') || 'Expires'}{' '}
                            {new Date(a.expires_at).toLocaleDateString(undefined, {
                              month: 'short',
                              day: 'numeric',
                              year: 'numeric',
                            })}
                          </p>
                        )}
                      </div>
                      <button
                        type="button"
                        onClick={() => handleDelete(a.id)}
                        disabled={deletingId === a.id}
                        className="shrink-0 p-1.5 rounded-lg text-gray-400 hover:text-red-500 hover:bg-red-50 transition-colors disabled:opacity-40"
                        data-testid={`my-alert-delete-${a.id}`}
                        aria-label={t('filters.removeAlert') || 'Remove alert'}
                      >
                        {deletingId === a.id ? (
                          <Loader2 size={14} className="animate-spin" />
                        ) : (
                          <Trash2 size={14} />
                        )}
                      </button>
                    </li>
                  );
                })}
              </ul>
            )}
          </div>
        </div>
      )}
    </div>
  );
};

export default MyAlertsPopover;
