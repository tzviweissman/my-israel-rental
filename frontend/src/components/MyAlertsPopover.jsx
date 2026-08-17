import React, { useState, useEffect, useContext, useRef } from 'react';
import axios from 'axios';
import { useTranslation } from 'react-i18next';
import { Bell, Trash2, Loader2, ChevronDown } from 'lucide-react';
import { toast } from 'sonner';
import { API, AuthContext } from '../App';
import { areaLabel } from '../utils/areaNames';

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

const filterSummary = (s, t) => {
  const f = s.filters || {};
  const chips = [];
  if (f.rental_type) chips.push(String(f.rental_type).replace('-', ' '));
  // DB-sourced area → localised label (utils/areaNames); unknown areas
  // fall through as stored.
  if (f.area) chips.push(areaLabel(f.area, t));
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
  // Recent matches (alerts where the system flagged a property as a fit). Used
  // ONLY to compute the unread badge — the popover itself stays focused on
  // managing the saved-search definitions; the matched listings live in
  // Dashboard → Alerts.
  const [matches, setMatches] = useState([]);
  const [deletingId, setDeletingId] = useState(null);
  const wrapRef = useRef(null);

  const authHeaders = { headers: { Authorization: `Bearer ${token}` } };

  // Per-user localStorage key — keeps "last seen" pointer scoped so two
  // accounts on the same browser don't clobber each other's unread state.
  const lastSeenKey = `alertsLastSeenAt:${token ? token.slice(-12) : 'anon'}`;
  const [lastSeenAt, setLastSeenAt] = useState(() => {
    try {
      return localStorage.getItem(lastSeenKey) || null;
    } catch {
      return null;
    }
  });

  const fetchAlerts = async () => {
    if (!token) return;
    setLoading(true);
    try {
      const [defsRes, matchesRes] = await Promise.all([
        axios.get(`${API}/saved-searches`, authHeaders),
        axios.get(`${API}/saved-searches/matches`, authHeaders).catch(() => ({ data: [] })),
      ]);
      setAlerts(defsRes.data || []);
      setMatches(matchesRes.data || []);
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
  // Compute unread matches — properties the system flagged for one of this
  // renter's searches AFTER they last opened the popover. Capped to 99 in
  // the badge to keep it visually compact ("99+").
  const newCount = lastSeenAt
    ? matches.filter((m) => m.sent_at && new Date(m.sent_at) > new Date(lastSeenAt)).length
    : matches.length;

  const handleTriggerClick = () => {
    setOpen((v) => {
      const next = !v;
      // When transitioning to OPEN, persist "now" as last-seen so the badge
      // clears immediately. The renter has visibly engaged with the list.
      if (next && newCount > 0) {
        const now = new Date().toISOString();
        try {
          localStorage.setItem(lastSeenKey, now);
        } catch {
          /* localStorage may be unavailable in private mode */
        }
        setLastSeenAt(now);
      }
      return next;
    });
  };

  return (
    <div ref={wrapRef} className="relative inline-block" data-testid="my-alerts-popover-wrap">
      <button
        type="button"
        onClick={handleTriggerClick}
        className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium transition-all hover:bg-gray-100 text-gray-500 hover:text-[var(--brand-primary)]"
        data-testid="my-alerts-trigger"
        title={t('filters.myAlertsTooltip') || 'Manage your saved alerts'}
      >
        <Bell size={12} />
        <span>
          {t('filters.myAlerts') || 'My alerts'}{' '}
          <span className="font-semibold text-[var(--brand-primary)]">({count})</span>
        </span>
        {newCount > 0 && (
          <span
            className="inline-flex items-center justify-center min-w-[18px] h-[18px] px-1 rounded-full text-[10px] font-bold text-white"
            style={{ backgroundColor: '#E07A2C' }}
            data-testid="my-alerts-new-badge"
            title={t('filters.newMatchesTooltip') || 'New matches since you last looked'}
          >
            {newCount > 99 ? '99+' : `${newCount} ${t('filters.newShort') || 'new'}`}
          </span>
        )}
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
          {/* Unread-matches hint — only renders if there are recent matches
              the renter hasn't reviewed yet. Deep-links into Dashboard →
              Alerts where the matched property cards live. */}
          {matches.length > 0 && (
            <a
              href="/dashboard?tab=alerts"
              className="block px-4 py-2.5 text-xs border-b border-gray-100 transition-colors"
              style={{ backgroundColor: '#fff8e8', color: '#7a5a14' }}
              data-testid="my-alerts-view-matches-link"
            >
              <span className="font-semibold">
                {matches.length}{' '}
                {matches.length === 1
                  ? (t('filters.matchSingular') || 'new property matched')
                  : (t('filters.matchPlural') || 'new properties matched')}
              </span>{' '}
              <span className="opacity-80">
                · {t('filters.viewInDashboard') || 'View in Dashboard →'}
              </span>
            </a>
          )}
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
                  const chips = filterSummary(a, t);
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
                                className="inline-block px-2 py-0.5 rounded-full text-[10px] font-medium bg-[#fafaf0] text-[var(--brand-primary)] border border-[#e5dfc8]"
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
