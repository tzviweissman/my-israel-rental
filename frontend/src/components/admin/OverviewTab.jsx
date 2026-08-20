import React, { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Home, Eye, Users, Calendar, Briefcase, Store, Inbox } from 'lucide-react';
import axios from 'axios';
import { API } from '../../App';
import AttentionQueue from './AttentionQueue';

/**
 * Super Admin → Overview tab.
 *
 * Two KPI groups, not one (spec A6). Every number used to be all-time with
 * no way to compare periods, so "total views: 4,812" told an admin nothing
 * they could act on. Adding a range control raises a question the old
 * single row could not answer honestly: a date range applies to things
 * that HAPPEN (a booking, a signup) and is meaningless for things that
 * ARE (how many listings are live right now). Filtering the first while
 * silently leaving the second unfiltered, under one shared control, is how
 * a dashboard starts lying. So they are separated and labelled: "in this
 * period" and "right now".
 *
 * Cards are only ``<button>`` when they actually go somewhere (spec A4).
 * Every card used to be a disabled button with cursor-default — a control
 * that looks interactive and isn't, which the eye notices even when the
 * mind doesn't. Cards with a destination now drill into it; the rest are
 * plain divs.
 */

// Range keys must match METRIC_RANGES in backend/routes/admin/core.py.
const RANGES = ['today', '7d', '30d', 'all'];

export const OverviewTab = ({ dashboard, token, onNavigate }) => {
  const { t } = useTranslation();
  // All time by default, so the console opens showing what it always
  // showed and the range is something the admin reaches for deliberately.
  const [range, setRange] = useState('all');
  const [metrics, setMetrics] = useState(null);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    let cancelled = false;
    setFailed(false);
    (async () => {
      try {
        const { data } = await axios.get(`${API}/admin/metrics`, {
          params: { range },
          headers: { Authorization: `Bearer ${token}` },
        });
        if (!cancelled) setMetrics(data);
      } catch {
        // Real numbers only: a count that cannot be fetched is a card that
        // is not rendered, never a zero standing in for "unknown".
        if (!cancelled) { setMetrics(null); setFailed(true); }
      }
    })();
    return () => { cancelled = true; };
  }, [token, range]);

  const flow = metrics?.flow;
  const stock = metrics?.stock;

  const flowCards = flow ? [
    { key: 'views', label: t('admin.kpiViews', 'Views'), value: flow.views, icon: Eye },
    { key: 'new-listings', label: t('admin.kpiNewListings', 'New listings'), value: flow.new_listings, icon: Home, go: 'listings' },
    { key: 'new-users', label: t('admin.kpiNewUsers', 'New users'), value: flow.new_users, icon: Users, go: 'users' },
    { key: 'bookings', label: t('admin.kpiBookings', 'Bookings'), value: flow.bookings, icon: Calendar, go: 'bookings' },
    { key: 'new-services', label: t('admin.kpiNewServices', 'New services'), value: flow.new_services, icon: Briefcase, go: 'services' },
  ] : [];

  const stockCards = stock ? [
    { key: 'active-listings', label: t('admin.kpiActiveListings', 'Active listings'), value: stock.active_listings, icon: Home, go: 'listings' },
    { key: 'active-services', label: t('admin.kpiActiveServices', 'Active services'), value: stock.active_services, icon: Briefcase, go: 'services' },
    { key: 'businesses', label: t('admin.kpiBusinesses', 'Businesses'), value: stock.businesses, icon: Store, go: 'services' },
    // No Requests tab exists yet, so this one genuinely has nowhere to go
    // and stays a plain div rather than pretending otherwise.
    { key: 'open-requests', label: t('admin.kpiOpenRequests', 'Open requests'), value: stock.open_requests, icon: Inbox },
  ] : [];

  const renderCard = ({ key, label, value, icon: Icon, go }) => {
    const body = (
      <div className="flex items-center gap-3">
        <div className="p-2 rounded-lg shrink-0" style={{ backgroundColor: 'var(--brand-primary)' }}>
          <Icon size={18} color="var(--gold)" />
        </div>
        <div className="min-w-0">
          <p className="text-2xl font-bold">{typeof value === 'number' ? value.toLocaleString() : value}</p>
          <p className="text-xs text-gray-500">{label}</p>
        </div>
      </div>
    );
    const base = 'bg-white p-4 sm:p-5 rounded-xl border border-[var(--brand-border)] text-start w-full';
    return go ? (
      <button
        type="button"
        key={key}
        onClick={() => onNavigate && onNavigate(go)}
        className={`${base} cursor-pointer hover:border-[var(--gold)] hover:shadow-md transition-all`}
        data-testid={`stat-${key}`}
      >
        {body}
      </button>
    ) : (
      <div key={key} className={base} data-testid={`stat-${key}`}>{body}</div>
    );
  };

  return (
    <div data-testid="admin-overview-section">
      {/* A3 — above the KPI grid, because "what needs me today" outranks
          "how are we doing overall". Renders nothing when all clear. */}
      <AttentionQueue token={token} onNavigate={onNavigate} />

      {/* --- flow: things that happened in the selected period --- */}
      <div className="flex items-center justify-between gap-3 mb-3 flex-wrap">
        <h2 className="text-sm font-bold uppercase tracking-wide" style={{ color: 'var(--brand-muted)' }}>
          {range === 'all' ? t('admin.kpiAllTime', 'All time') : t('admin.kpiInPeriod', 'In this period')}
        </h2>
        <div className="flex items-center gap-1 p-1 rounded-lg" style={{ background: 'rgb(var(--brand-primary-rgb) / 0.07)' }} data-testid="admin-range">
          {RANGES.map((r) => (
            <button
              key={r}
              type="button"
              onClick={() => setRange(r)}
              className={`px-3 py-1 rounded-md text-xs font-semibold transition-colors ${range === r ? 'bg-white shadow-sm' : ''}`}
              style={{ color: range === r ? 'var(--brand-primary)' : 'var(--brand-muted)' }}
              data-testid={`admin-range-${r}`}
            >
              {t(`admin.range_${r}`, { today: 'Today', '7d': '7 days', '30d': '30 days', all: 'All' }[r])}
            </button>
          ))}
        </div>
      </div>

      {failed && (
        <p className="text-sm mb-6" style={{ color: 'var(--brand-muted)' }} data-testid="admin-metrics-failed">
          {t('admin.kpiUnavailable', 'These numbers could not be loaded.')}
        </p>
      )}

      <div className="grid grid-cols-2 lg:grid-cols-5 gap-3 sm:gap-4 mb-3">
        {flowCards.map(renderCard)}
      </div>

      {/* Views only exist from the day event logging started. Saying so
          keeps "All time" from claiming more history than it has. */}
      {metrics?.views_since && (
        <p className="text-xs mb-8" style={{ color: 'var(--brand-muted)' }} data-testid="admin-views-since">
          {t('admin.viewsSince', 'Views counted since {{date}}', {
            date: new Date(metrics.views_since).toLocaleDateString(),
          })}
        </p>
      )}

      {/* --- stock: true right now, whatever the range says --- */}
      <h2 className="text-sm font-bold uppercase tracking-wide mb-3" style={{ color: 'var(--brand-muted)' }}>
        {t('admin.kpiRightNow', 'Right now')}
      </h2>
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4 mb-10">
        {stockCards.map(renderCard)}
      </div>

      <h2 className="text-xl font-bold mb-4" style={{ fontFamily: 'var(--font-head)' }}>{t('admin.recentListings')}</h2>
      <div className="bg-white rounded-xl border border-[var(--brand-border)] overflow-x-auto">
        <table className="w-full">
          <thead className="bg-gray-50">
            <tr>
              <th className="px-5 py-3 text-left text-xs font-semibold text-gray-600 uppercase">{t('admin.colTitle')}</th>
              <th className="px-5 py-3 text-left text-xs font-semibold text-gray-600 uppercase">{t('admin.colArea')}</th>
              <th className="px-5 py-3 text-left text-xs font-semibold text-gray-600 uppercase">{t('admin.colType')}</th>
              <th className="px-5 py-3 text-left text-xs font-semibold text-gray-600 uppercase">{t('admin.colPrice')}</th>
              <th className="px-5 py-3 text-left text-xs font-semibold text-gray-600 uppercase">{t('admin.colViews')}</th>
            </tr>
          </thead>
          <tbody>
            {dashboard.recent_properties.map(p => (
              <tr key={p.id} className="border-t border-[var(--brand-border)] hover:bg-gray-50" data-testid={`overview-property-${p.id}`}>
                <td className="px-5 py-3 font-medium text-sm">{p.title}</td>
                <td className="px-5 py-3 text-sm text-gray-600">{p.area}</td>
                <td className="px-5 py-3"><span className="px-2 py-1 rounded-full text-xs bg-[var(--brand-border)]">{p.rental_type}</span></td>
                <td className="px-5 py-3 font-bold text-sm">{p.currency === 'USD' ? '$' : '₪'}{p.monthly_price || p.nightly_price || 0}</td>
                <td className="px-5 py-3 text-sm">{p.views || 0}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
};

export default OverviewTab;
