import React, { useEffect, useMemo, useState } from 'react';
import axios from 'axios';
import { toast } from 'sonner';
import { format, parseISO, differenceInDays } from 'date-fns';
import {
  CalendarClock, Home as HomeIcon, MapPin, ChevronRight,
  CheckCircle2, Clock, Calendar as CalendarIcon, Bed,
} from 'lucide-react';
import { sizedImage } from '../../utils/cdnImage';

/**
 * Availability dashboard for owners/managers. Shows at a glance:
 *  - which properties are currently booked vs free
 *  - when each booked property becomes available
 *  - upcoming bookings (next 365 days)
 *  - 90-day occupancy % so listers can spot underperforming units
 *
 * Sort modes are kept in URL-less local state — this view is a planning
 * tool, not a permalink target.
 */

const STATUS_THEME = {
  available: { color: '#16A34A', label: 'Available now', icon: CheckCircle2 },
  upcoming: { color: '#0EA5E9', label: 'Booked upcoming', icon: Clock },
  booked: { color: '#D4AF37', label: 'Currently booked', icon: CalendarIcon },
};

const safeDateLabel = (iso) => {
  if (!iso) return '—';
  try { return format(parseISO(iso), 'MMM d, yyyy'); } catch { return iso; }
};

const daysFromToday = (iso) => {
  if (!iso) return null;
  try { return differenceInDays(parseISO(iso), new Date()); } catch { return null; }
};

const RelativeDate = ({ iso, prefix = '' }) => {
  const d = daysFromToday(iso);
  const label = safeDateLabel(iso);
  if (d == null) return <span>{label}</span>;
  let relative;
  if (d <= 0) relative = 'today';
  else if (d === 1) relative = 'tomorrow';
  else if (d < 7) relative = `in ${d} days`;
  else if (d < 30) relative = `in ${Math.round(d / 7)} weeks`;
  else relative = `in ${Math.round(d / 30)} months`;
  return (
    <span>
      {prefix}{label}{' '}
      <span className="text-gray-500 text-xs">({relative})</span>
    </span>
  );
};

const OccupancyBar = ({ pct }) => (
  <div className="w-full h-1.5 rounded-full bg-gray-100 overflow-hidden" title={`${pct}% occupied over next 90 days`}>
    <div
      className="h-full rounded-full transition-all"
      style={{
        width: `${pct}%`,
        background: pct >= 80 ? '#16A34A' : pct >= 40 ? '#D4AF37' : '#9CA3AF',
      }}
    />
  </div>
);

const PropertyRow = ({ row, expanded, onToggle, apiBase }) => {
  const theme = STATUS_THEME[row.status] || STATUS_THEME.available;
  const Icon = theme.icon;
  const cover = row.image ? sizedImage(row.image, 200) : null;

  return (
    <div
      className="bg-white border border-gray-200 rounded-xl overflow-hidden hover:border-[#1E6A6A]/40 transition-colors"
      data-testid={`availability-row-${row.property_id}`}
    >
      <button
        type="button"
        onClick={onToggle}
        className="w-full flex items-center gap-3 p-3 md:p-4 text-left"
      >
        <div
          className="w-14 h-14 md:w-16 md:h-16 rounded-lg bg-gray-200 shrink-0"
          style={cover ? {
            backgroundImage: `url(${cover})`,
            backgroundSize: 'cover',
            backgroundPosition: 'center',
          } : undefined}
        >
          {!cover && <HomeIcon size={20} className="text-gray-400 m-auto translate-y-5" />}
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2 mb-0.5">
            <h4 className="font-semibold text-sm md:text-base text-gray-800 truncate">
              {row.title || 'Untitled property'}
            </h4>
          </div>
          <div className="flex flex-wrap items-center gap-x-3 gap-y-0.5 text-xs text-gray-600">
            {row.area && <span className="inline-flex items-center gap-1"><MapPin size={11} />{row.area}</span>}
            {row.bedrooms != null && <span className="inline-flex items-center gap-1"><Bed size={11} />{row.bedrooms} bd</span>}
            <span className="capitalize text-gray-500">{row.rental_type}</span>
          </div>
          <div className="mt-1.5">
            <OccupancyBar pct={row.occupancy_pct_next_90} />
            <p className="text-[10px] text-gray-500 mt-0.5">
              {row.booked_days_next_90} of 90 days booked · {row.vacant_days_next_90} vacant
            </p>
          </div>
        </div>
        <div className="text-right shrink-0">
          <div
            className="inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs font-semibold mb-1"
            style={{ backgroundColor: `${theme.color}1A`, color: theme.color }}
          >
            <Icon size={11} />
            {theme.label}
          </div>
          <p className="text-xs font-medium text-gray-700">
            {row.status === 'available'
              ? 'Free to list'
              : <RelativeDate iso={row.next_available} prefix="Free " />}
          </p>
        </div>
        <ChevronRight
          size={18}
          className={`text-gray-400 shrink-0 transition-transform ${expanded ? 'rotate-90' : ''}`}
        />
      </button>

      {expanded && (
        <div className="border-t border-gray-100 px-3 md:px-4 py-3 bg-gray-50/60">
          {row.upcoming.length === 0 ? (
            <p className="text-sm text-gray-500 text-center py-2">No upcoming bookings — open to take new reservations.</p>
          ) : (
            <ul className="space-y-1.5" data-testid={`availability-upcoming-${row.property_id}`}>
              {row.upcoming.map((b) => {
                const isCurrent = row.current_until === b.end_date && row.status === 'booked';
                return (
                  <li
                    key={b.id || `${b.start_date}-${b.end_date}`}
                    className="flex items-center justify-between bg-white rounded-lg border border-gray-200 px-3 py-2 text-sm"
                  >
                    <div className="min-w-0">
                      <span className="font-medium text-gray-700">{b.renter_name}</span>
                      <span className="mx-1.5 text-gray-300">·</span>
                      <span className="text-gray-600">
                        {safeDateLabel(b.start_date)} — {safeDateLabel(b.end_date)}
                      </span>
                    </div>
                    <span
                      className="px-2 py-0.5 rounded-md text-[10px] font-semibold uppercase tracking-wide shrink-0 ml-2"
                      style={{
                        backgroundColor: isCurrent ? '#FEF3C7' : b.status === 'confirmed' ? '#DCFCE7' : '#E0F2FE',
                        color: isCurrent ? '#A16207' : b.status === 'confirmed' ? '#15803D' : '#0369A1',
                      }}
                    >
                      {isCurrent ? 'In progress' : b.status}
                    </span>
                  </li>
                );
              })}
            </ul>
          )}
        </div>
      )}
    </div>
  );
};

const SORT_OPTIONS = [
  { v: 'soonest_free', label: 'Becoming available soonest' },
  { v: 'occupancy_high', label: 'Most booked (next 90d)' },
  { v: 'occupancy_low', label: 'Least booked (next 90d)' },
  { v: 'title', label: 'Title A → Z' },
];

const AvailabilityTab = ({ API, token }) => {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [sort, setSort] = useState('soonest_free');
  const [statusFilter, setStatusFilter] = useState('all');
  const [expanded, setExpanded] = useState(new Set());

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const { data: d } = await axios.get(`${API}/owner/availability`, {
          headers: { Authorization: `Bearer ${token}` },
        });
        if (!cancelled) setData(d);
      } catch (e) {
        if (!cancelled) toast.error(e.response?.data?.detail || 'Failed to load availability');
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, [API, token]);

  const rows = useMemo(() => {
    if (!data?.properties) return [];
    const filtered = statusFilter === 'all'
      ? data.properties
      : data.properties.filter(p => p.status === statusFilter);
    const sorted = [...filtered].sort((a, b) => {
      if (sort === 'soonest_free') {
        return String(a.next_available).localeCompare(String(b.next_available));
      }
      if (sort === 'occupancy_high') return b.occupancy_pct_next_90 - a.occupancy_pct_next_90;
      if (sort === 'occupancy_low') return a.occupancy_pct_next_90 - b.occupancy_pct_next_90;
      return (a.title || '').localeCompare(b.title || '');
    });
    return sorted;
  }, [data, sort, statusFilter]);

  const counts = useMemo(() => {
    if (!data?.properties) return { available: 0, booked: 0, upcoming: 0, all: 0 };
    return data.properties.reduce(
      (acc, p) => ({ ...acc, [p.status]: (acc[p.status] || 0) + 1, all: acc.all + 1 }),
      { available: 0, booked: 0, upcoming: 0, all: 0 },
    );
  }, [data]);

  const toggle = (pid) => setExpanded(prev => {
    const next = new Set(prev);
    next.has(pid) ? next.delete(pid) : next.add(pid);
    return next;
  });

  if (loading) {
    return <div className="text-center py-12 text-gray-500" data-testid="availability-loading">Loading availability…</div>;
  }
  if (!data || data.total === 0) {
    return (
      <div className="text-center py-12" data-testid="availability-empty">
        <CalendarClock size={42} className="mx-auto text-gray-300 mb-3" />
        <p className="text-gray-600">No active listings yet. Add a property to start tracking availability.</p>
      </div>
    );
  }

  return (
    <div className="space-y-4" data-testid="availability-tab">
      <div className="flex items-start gap-2 mb-2">
        <CalendarClock size={20} className="text-[#1E6A6A] mt-0.5 shrink-0" />
        <div>
          <h2 className="text-lg font-semibold text-gray-800">Property availability</h2>
          <p className="text-xs text-gray-500">
            At-a-glance view of when each unit becomes free and how booked you are over the next 90 days.
          </p>
        </div>
      </div>

      {/* Status pills */}
      <div className="flex flex-wrap items-center gap-2" data-testid="availability-status-filters">
        {[
          { v: 'all', label: `All (${counts.all})`, color: '#1E6A6A' },
          { v: 'available', label: `Available now (${counts.available || 0})`, color: '#16A34A' },
          { v: 'booked', label: `Currently booked (${counts.booked || 0})`, color: '#D4AF37' },
          { v: 'upcoming', label: `Booked upcoming (${counts.upcoming || 0})`, color: '#0EA5E9' },
        ].map(opt => (
          <button
            key={opt.v}
            onClick={() => setStatusFilter(opt.v)}
            className="px-3 py-1.5 rounded-full text-xs font-semibold border transition-colors"
            style={{
              backgroundColor: statusFilter === opt.v ? opt.color : 'transparent',
              color: statusFilter === opt.v ? '#fff' : opt.color,
              borderColor: opt.color,
            }}
            data-testid={`availability-filter-${opt.v}`}
          >
            {opt.label}
          </button>
        ))}
        <div className="ml-auto flex items-center gap-2">
          <label htmlFor="avail-sort" className="text-xs text-gray-600">Sort:</label>
          <select
            id="avail-sort"
            value={sort}
            onChange={(e) => setSort(e.target.value)}
            className="px-3 py-1.5 rounded-lg border border-gray-200 bg-white text-xs"
            data-testid="availability-sort"
          >
            {SORT_OPTIONS.map(o => <option key={o.v} value={o.v}>{o.label}</option>)}
          </select>
        </div>
      </div>

      <div className="space-y-2">
        {rows.length === 0 ? (
          <p className="text-center text-sm text-gray-500 py-8">No properties match this filter.</p>
        ) : (
          rows.map(row => (
            <PropertyRow
              key={row.property_id}
              row={row}
              expanded={expanded.has(row.property_id)}
              onToggle={() => toggle(row.property_id)}
              apiBase={API}
            />
          ))
        )}
      </div>
    </div>
  );
};

export default AvailabilityTab;
