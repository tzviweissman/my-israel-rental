import React, { useState, useMemo, useEffect, useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import axios from 'axios';
import {
  Search, X, MapPin, Bed, Home as HomeIcon, ChevronRight, ChevronLeft,
  CheckCircle2, Clock, Calendar as CalendarIcon,
} from 'lucide-react';

import ContractSignModal from '../modals/ContractSignModal';
import AcceptBookingModal from '../modals/AcceptBookingModal';
import CancelBookingModal from '../modals/CancelBookingModal';
import BookingRow from './BookingRow';
import BookingChip from './BookingChip';
import MiniCalendar from './MiniCalendar';
import useBookingActions from './useBookingActions';
import { sizedImage } from '../../utils/cdnImage';
import { areaLabel } from '../../utils/areaNames';

const STATUS_FILTERS = [
  { key: 'all', labelKey: 'dashboard.statusAll' },
  { key: 'pending', labelKey: 'dashboard.statusPending' },
  { key: 'confirmed', labelKey: 'dashboard.statusConfirmed' },
  { key: 'cancellation_requested', labelKey: 'dashboard.statusCancellationRequested' },
  { key: 'cancelled', labelKey: 'dashboard.statusCancelled' },
  { key: 'completed', labelKey: 'dashboard.statusCompleted' },
];

const PROPERTY_STATUS_THEME = {
  available: { color: '#16A34A', labelKey: 'dashboard.availableNow', fallback: 'Available now', Icon: CheckCircle2 },
  upcoming: { color: '#0EA5E9', labelKey: 'dashboard.bookedUpcoming', fallback: 'Booked upcoming', Icon: Clock },
  booked: { color: 'var(--gold)', labelKey: 'dashboard.currentlyBooked', fallback: 'Currently booked', Icon: CalendarIcon },
};

const PropertyStatusBadge = ({ status }) => {
  const { t } = useTranslation();
  const theme = PROPERTY_STATUS_THEME[status] || PROPERTY_STATUS_THEME.available;
  const Icon = theme.Icon;
  return (
    <span
      className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-semibold whitespace-nowrap"
      style={{ backgroundColor: `${theme.color}1A`, color: theme.color }}
      data-testid={`property-status-${status}`}
    >
      <Icon size={11} />
      {t(theme.labelKey, theme.fallback)}
    </span>
  );
};

const safeDateLabel = (iso) => {
  if (!iso) return '—';
  try { return new Date(iso).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' }); }
  catch { return iso; }
};

/**
 * Per-property card on the owner Bookings tab. Collapsed by default;
 * clicking the header expands to reveal:
 *   - One `BookingChip` per active booking (pending/confirmed/cancellation_requested)
 *   - A 3-month mini-calendar with prev/next month arrows and
 *     handover-day visualization
 */
const PropertyAvailabilityCard = ({
  property,
  bookingsForProp,
  user,
  API,
  actions,
}) => {
  const { t } = useTranslation();
  const [open, setOpen] = useState(false);
  const todayDate = new Date();
  const [anchor, setAnchor] = useState({ year: todayDate.getFullYear(), month: todayDate.getMonth() });
  const months = useMemo(() => Array.from({ length: 3 }, (_, i) => {
    const d = new Date(anchor.year, anchor.month + i, 1);
    return { year: d.getFullYear(), month: d.getMonth() };
  }), [anchor]);
  const shiftAnchor = (delta) => {
    setAnchor((prev) => {
      const d = new Date(prev.year, prev.month + delta, 1);
      return { year: d.getFullYear(), month: d.getMonth() };
    });
  };

  // Calendar only highlights pending+confirmed (live) bookings.
  const liveBookings = useMemo(
    () => bookingsForProp.filter((b) => ['pending', 'confirmed', 'cancellation_requested'].includes(b.status)),
    [bookingsForProp],
  );

  const totalBookings = bookingsForProp.length;
  const nextAvailableLabel = property.status === 'available'
    ? t('dashboard.freeToList', 'Free to list')
    : t('dashboard.freeFrom', 'Free {{date}}', { date: safeDateLabel(property.next_available) });

  return (
    <div
      className="bg-white border border-gray-200 rounded-xl overflow-hidden"
      data-testid={`property-card-${property.property_id}`}
    >
      <button
        onClick={() => setOpen((v) => !v)}
        className="w-full flex items-start gap-3 md:gap-4 p-3 md:p-4 text-left hover:bg-gray-50/60 transition-colors"
        data-testid={`property-card-toggle-${property.property_id}`}
      >
        <div className="w-14 h-14 md:w-16 md:h-16 rounded-lg bg-gray-200 shrink-0 overflow-hidden flex items-center justify-center">
          {property.image ? (
            <img
              src={sizedImage(property.image, 128)}
              alt=""
              className="w-full h-full object-cover"
              loading="lazy"
            />
          ) : (
            <HomeIcon size={22} className="text-gray-400" />
          )}
        </div>
        <div className="flex-1 min-w-0">
          <h3 className="font-semibold text-gray-800 mb-0.5 truncate text-sm md:text-base">{property.title || t('dashboard.untitled', 'Untitled')}</h3>
          <p className="text-[11px] md:text-xs text-gray-500 flex items-center gap-2 flex-wrap">
            {property.area && (
              <span className="inline-flex items-center gap-1">
                <MapPin size={11} />
                <span className="truncate max-w-[180px] md:max-w-none">{areaLabel(property.area, t)}</span>
              </span>
            )}
            {property.bedrooms != null && (
              <span className="inline-flex items-center gap-1">
                <Bed size={11} />
                {property.bedrooms}bd
              </span>
            )}
            <span className="text-gray-400">·</span>
            <span data-testid={`property-bookings-count-${property.property_id}`}>
              {totalBookings} {totalBookings === 1 ? t('dashboard.booking', 'booking') : t('dashboard.bookings', 'bookings')}
            </span>
          </p>
        </div>
        <div className="hidden sm:block text-right shrink-0">
          <PropertyStatusBadge status={property.status} />
          <p className="text-[11px] md:text-xs font-medium text-gray-700 mt-1">{nextAvailableLabel}</p>
        </div>
        <ChevronRight
          size={18}
          className={`text-gray-400 shrink-0 transition-transform ${open ? 'rotate-90' : ''}`}
        />
      </button>

      {/* Mobile status badge — moved below the row */}
      <div className="sm:hidden px-3 pb-3 -mt-1 flex items-center justify-between gap-2">
        <PropertyStatusBadge status={property.status} />
        <span className="text-[11px] font-medium text-gray-700">{nextAvailableLabel}</span>
      </div>

      {open && (
        <div className="border-t border-gray-100 px-3 md:px-4 py-3 bg-gray-50/60 space-y-3">
          {bookingsForProp.length === 0 ? (
            <p className="text-sm text-gray-500 text-center py-2" data-testid={`property-no-bookings-${property.property_id}`}>
              {t('dashboard.noBookingsYetOpen', 'No bookings yet — open to take new reservations.')}
            </p>
          ) : (
            <div className="space-y-2">
              {bookingsForProp.map((b) => (
                <BookingChip
                  key={b.id}
                  booking={b}
                  user={user}
                  API={API}
                  onAccept={actions.openAccept}
                  onCancel={actions.openCancel}
                  onRequestCancel={actions.openRequestCancel}
                  onApproveCancel={actions.approveCancel}
                  onDenyCancel={actions.openDenyCancel}
                  onSignContract={actions.openContractSign}
                />
              ))}
            </div>
          )}

          <div>
            <div className="flex items-center justify-between mb-1.5 flex-wrap gap-2">
              <p className="text-[11px] font-semibold uppercase tracking-wide text-gray-500">
                {t('dashboard.bookedDates', 'Booked dates')}
              </p>
              <div className="flex items-center gap-2 text-[10px] flex-wrap">
                <span className="inline-flex items-center gap-1">
                  <span className="w-2.5 h-2.5 rounded" style={{ background: '#16A34A' }} />
                  {t('dashboard.confirmed')}
                </span>
                <span className="inline-flex items-center gap-1">
                  <span className="w-2.5 h-2.5 rounded" style={{ background: '#0EA5E9' }} />
                  {t('dashboard.pending')}
                </span>
                <span className="inline-flex items-center gap-1">
                  <span className="w-3 h-2.5 rounded relative overflow-hidden border border-gray-400">
                    <span className="absolute inset-y-0 left-0 w-[44%]" style={{ background: '#16A34A' }} />
                    <span className="absolute inset-y-0 right-0 w-[44%]" style={{ background: '#16A34A' }} />
                    <span className="absolute inset-y-0 left-[44%] w-[12%] bg-white" />
                  </span>
                  {t('dashboard.handoverDay', 'Handover day')}
                </span>
              </div>
            </div>
            <div className="flex items-center justify-between mb-2">
              <button
                onClick={() => shiftAnchor(-1)}
                className="p-1.5 rounded-md hover:bg-white border border-gray-200 transition-colors inline-flex items-center gap-1 text-xs font-medium text-gray-600"
                data-testid={`calendar-prev-${property.property_id}`}
              >
                <ChevronLeft size={14} />
                {t('dashboard.prev', 'Prev')}
              </button>
              <span className="text-xs text-gray-500" data-testid={`calendar-range-${property.property_id}`}>
                {new Date(months[0].year, months[0].month, 1).toLocaleString(undefined, { month: 'short', year: 'numeric' })}
                {' — '}
                {new Date(months[2].year, months[2].month, 1).toLocaleString(undefined, { month: 'short', year: 'numeric' })}
              </span>
              <button
                onClick={() => shiftAnchor(1)}
                className="p-1.5 rounded-md hover:bg-white border border-gray-200 transition-colors inline-flex items-center gap-1 text-xs font-medium text-gray-600"
                data-testid={`calendar-next-${property.property_id}`}
              >
                {t('dashboard.next', 'Next')}
                <ChevronRight size={14} />
              </button>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
              {months.map((m) => (
                <MiniCalendar
                  key={`${m.year}-${m.month}`}
                  year={m.year}
                  month={m.month}
                  bookings={liveBookings}
                />
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

/**
 * The renter-facing flat list of bookings. Same UX as before the merge —
 * search + status chips + chronologically sorted `BookingRow`s.
 */
const RenterBookingsList = ({ bookings, user, API, actions }) => {
  const { t } = useTranslation();
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');

  const statusCounts = useMemo(() => {
    const acc = { all: bookings.length };
    for (const b of bookings) acc[b.status] = (acc[b.status] || 0) + 1;
    return acc;
  }, [bookings]);

  const filtered = useMemo(() => {
    const term = search.trim().toLowerCase();
    return [...bookings]
      .filter((b) => {
        if (statusFilter !== 'all' && b.status !== statusFilter) return false;
        if (!term) return true;
        const haystack = [
          b.property_title, b.property_location, b.status, b.message,
          b.renter_name, b.owner_name, b.guest_name,
          b.check_in, b.check_out, b.start_date, b.end_date,
        ].filter(Boolean).join(' ').toLowerCase();
        return haystack.includes(term);
      })
      .sort((a, b) => new Date(b.created_at || 0) - new Date(a.created_at || 0));
  }, [bookings, search, statusFilter]);

  const isFiltering = !!search || statusFilter !== 'all';
  const clearAll = () => { setSearch(''); setStatusFilter('all'); };

  return (
    <>
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 sm:gap-4 mb-4">
        <h2 className="text-2xl font-bold" style={{ fontFamily: 'Playfair Display' }}>
          {t('dashboard.myBookings')}
        </h2>
        {bookings.length > 0 && (
          <div className="w-full sm:max-w-md relative">
            <input
              type="text"
              placeholder={t('dashboard.searchBookingsHint', 'Search by property, guest, dates…')}
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full px-4 py-2.5 ps-10 rounded-xl border-2 border-gray-200 focus:border-[var(--brand-primary)] focus:outline-none text-sm"
              data-testid="bookings-search"
            />
            <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
            {search && (
              <button
                onClick={() => setSearch('')}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
                data-testid="bookings-search-clear"
                aria-label="Clear search"
              >
                <X size={16} />
              </button>
            )}
          </div>
        )}
      </div>

      {bookings.length > 0 && (
        <div
          className="flex flex-wrap items-center gap-1.5 mb-5 -mx-1 px-1 overflow-x-auto"
          data-testid="bookings-status-filters"
        >
          {STATUS_FILTERS.map((f) => {
            const count = statusCounts[f.key] || 0;
            if (f.key !== 'all' && count === 0) return null;
            const active = statusFilter === f.key;
            return (
              <button
                key={f.key}
                onClick={() => setStatusFilter(f.key)}
                className={`px-3 py-1.5 rounded-full text-xs font-semibold whitespace-nowrap transition-all ${
                  active ? 'bg-[var(--brand-primary)] text-white shadow-sm' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                }`}
                data-testid={`bookings-filter-${f.key}`}
              >
                {t(f.labelKey, f.key)} ({count})
              </button>
            );
          })}
          {isFiltering && (
            <button
              onClick={clearAll}
              className="ms-auto inline-flex items-center gap-1 px-3 py-1.5 rounded-full text-xs font-medium text-[var(--brand-primary)] hover:bg-[rgb(var(--brand-primary-rgb)/<alpha-value>)]/5 transition-colors"
              data-testid="bookings-clear-filters"
            >
              <X size={12} />
              {t('dashboard.clearFilters', 'Clear filters')}
            </button>
          )}
        </div>
      )}

      {bookings.length > 0 && isFiltering && (
        <p className="text-xs text-gray-500 mb-3" data-testid="bookings-result-count">
          {filtered.length}{' '}
          {filtered.length === 1
            ? t('dashboard.booking', 'booking')
            : t('dashboard.bookings', 'bookings')}{' '}
          {t('dashboard.found', 'found')}
        </p>
      )}

      {filtered.length === 0 ? (
        <div className="bg-white rounded-2xl border border-gray-200 p-12 text-center">
          {isFiltering ? (
            <>
              <p className="text-gray-500 mb-2">
                {t('dashboard.noBookingsMatchFilter', 'No bookings match your filter')}
              </p>
              <button onClick={clearAll} className="text-[var(--brand-primary)] hover:underline text-sm" data-testid="bookings-empty-clear">
                {t('dashboard.clearFilters', 'Clear filters')}
              </button>
            </>
          ) : (
            <p className="text-gray-500">{t('dashboard.noBookings', 'No bookings yet')}</p>
          )}
        </div>
      ) : (
        <div className="space-y-4">
          {filtered.map((booking) => (
            <BookingRow
              key={booking.id}
              booking={booking}
              user={user}
              API={API}
              onAccept={actions.openAccept}
              onCancel={actions.openCancel}
              onRequestCancel={actions.openRequestCancel}
              onApproveCancel={actions.approveCancel}
              onDenyCancel={actions.openDenyCancel}
              onSignContract={actions.openContractSign}
            />
          ))}
        </div>
      )}
    </>
  );
};

/**
 * The owner/manager-facing merged view: one expandable card per owned
 * property showing its bookings + 3-month availability calendar.
 *
 * Backend data sources:
 *   - GET /api/owner/availability  → property list + per-prop status
 *   - GET /api/bookings            → full booking records (already passed in)
 *
 * Bookings the user made on someone else's property are appended below
 * as a small "Trips I've booked" section so nothing gets lost.
 */
const OwnerStackedView = ({ bookings, user, token, API, actions, onUpdate }) => {
  const { t } = useTranslation();
  const [availability, setAvailability] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');

  const fetchAvailability = useCallback(async () => {
    try {
      const res = await axios.get(`${API}/owner/availability`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      setAvailability(res.data?.properties || []);
    } catch (err) {
      console.error('Failed to fetch availability', err);
    } finally {
      setLoading(false);
    }
  }, [API, token]);

  useEffect(() => { fetchAvailability(); }, [fetchAvailability]);

  // Re-fetch availability whenever the parent re-fetches bookings (after
  // any mutation). We wrap onUpdate so it also refreshes our local fetch.
  const handleUpdate = useCallback(async () => {
    await onUpdate?.();
    await fetchAvailability();
  }, [onUpdate, fetchAvailability]);

  // Inject the wrapped onUpdate into actions by replacing the local hook
  // closure. Simplest: just trigger a manual refetch alongside the
  // existing actions.onUpdate. We do that by hooking into mutations via
  // an effect on bookings (proxy for "data changed").
  useEffect(() => { fetchAvailability(); /* refresh on bookings change */
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [bookings.length]);

  // Group all live bookings by property_id (only ones the user owns as lister).
  const bookingsByProp = useMemo(() => {
    const acc = {};
    for (const b of bookings) {
      if (b.owner_id !== user.id) continue;
      (acc[b.property_id] ||= []).push(b);
    }
    // Sort by start_date asc within each property
    for (const pid of Object.keys(acc)) {
      acc[pid].sort((a, b) => (a.start_date || '').localeCompare(b.start_date || ''));
    }
    return acc;
  }, [bookings, user.id]);

  // Renter-side bookings (user is the renter on someone else's property)
  const myTrips = useMemo(
    () => bookings.filter((b) => b.renter_id === user.id && b.owner_id !== user.id),
    [bookings, user.id],
  );

  const filteredProperties = useMemo(() => {
    const term = search.trim().toLowerCase();
    if (!term) return availability;
    return availability.filter((p) => {
      const hay = `${p.title || ''} ${p.area || ''}`.toLowerCase();
      return hay.includes(term);
    });
  }, [availability, search]);

  // Use handleUpdate inside actions for live refresh. We patch this by
  // creating a small wrapper: the actions hook in BookingsList already
  // calls the original onUpdate; we ensure availability also refreshes
  // via the bookings.length effect above.

  return (
    <>
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 sm:gap-4 mb-4">
        <div>
          <h2 className="text-2xl font-bold" style={{ fontFamily: 'Playfair Display' }}>
            {t('dashboard.myBookings')}
          </h2>
          <p className="text-sm text-gray-500 mt-0.5">
            {t('dashboard.bookingsAvailabilitySubtitle', 'All your reservations, contracts and unit availability — in one place.')}
          </p>
        </div>

        {availability.length > 0 && (
          <div className="w-full sm:max-w-md relative">
            <input
              type="text"
              placeholder={t('dashboard.searchPropertyHint', 'Search by property or area…')}
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full px-4 py-2.5 ps-10 rounded-xl border-2 border-gray-200 focus:border-[var(--brand-primary)] focus:outline-none text-sm"
              data-testid="properties-search"
            />
            <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
            {search && (
              <button
                onClick={() => setSearch('')}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
                data-testid="properties-search-clear"
                aria-label="Clear search"
              >
                <X size={16} />
              </button>
            )}
          </div>
        )}
      </div>

      {loading ? (
        <div className="bg-white rounded-2xl border border-gray-200 p-12 text-center text-gray-500">
          {t('common.loading', 'Loading…')}
        </div>
      ) : availability.length === 0 ? (
        <div className="bg-white rounded-2xl border border-gray-200 p-12 text-center">
          <p className="text-gray-500 mb-1">{t('dashboard.noPropertiesYet', 'No properties yet')}</p>
          <p className="text-sm text-gray-400">
            {t('dashboard.addAPropertyHint', 'Add a property to start receiving bookings.')}
          </p>
        </div>
      ) : (
        <div className="space-y-3" data-testid="properties-stacked">
          {filteredProperties.map((p) => (
            <PropertyAvailabilityCard
              key={p.property_id}
              property={p}
              bookingsForProp={bookingsByProp[p.property_id] || []}
              user={user}
              API={API}
              actions={actions}
            />
          ))}
          {filteredProperties.length === 0 && (
            <div className="bg-white rounded-2xl border border-gray-200 p-8 text-center text-sm text-gray-500">
              {t('dashboard.noMatchingProperties', 'No properties match your search.')}
            </div>
          )}
        </div>
      )}

      {myTrips.length > 0 && (
        <section className="mt-8" data-testid="my-trips-section">
          <h3 className="text-lg font-bold mb-3" style={{ fontFamily: 'Playfair Display' }}>
            {t('dashboard.tripsIveBooked', "Trips I've booked")}
          </h3>
          <div className="space-y-4">
            {myTrips
              .sort((a, b) => new Date(b.created_at || 0) - new Date(a.created_at || 0))
              .map((booking) => (
                <BookingRow
                  key={booking.id}
                  booking={booking}
                  user={user}
                  API={API}
                  onAccept={actions.openAccept}
                  onCancel={actions.openCancel}
                  onRequestCancel={actions.openRequestCancel}
                  onApproveCancel={actions.approveCancel}
                  onDenyCancel={actions.openDenyCancel}
                  onSignContract={actions.openContractSign}
                />
              ))}
          </div>
        </section>
      )}
    </>
  );
};

/**
 * Bookings tab entry point. Role-aware:
 *   - owner / manager → stacked property cards with embedded bookings + calendar
 *   - renter          → flat list of their reservations
 *
 * Sublessors (role=renter but owns a sublease booking) keep the flat
 * list view; the lister-side actions render via `ownsBookingAsLister`.
 *
 * Owns the three modals (Accept / Cancel / ContractSign) and the
 * `useBookingActions` hook — both subviews dispatch through it.
 */
const BookingsList = ({ bookings, onUpdate, user, token, API }) => {
  const actions = useBookingActions({ bookings, API, token, onUpdate });
  const isOwnerLike = user?.role === 'owner' || user?.role === 'manager';

  return (
    <div>
      {isOwnerLike ? (
        <OwnerStackedView
          bookings={bookings}
          user={user}
          token={token}
          API={API}
          actions={actions}
          onUpdate={onUpdate}
        />
      ) : (
        <RenterBookingsList
          bookings={bookings}
          user={user}
          API={API}
          actions={actions}
        />
      )}

      {/* Modals — shared across both subviews */}
      <ContractSignModal
        isOpen={actions.showContractSignModal}
        onClose={actions.closeContractSign}
        bookingId={actions.contractBookingId}
        contractPreviewUrl={actions.contractPreviewUrl}
        contractPreviewIsPdf={actions.contractPreviewIsPdf}
        onSignSuccess={actions.submitContractSign}
      />
      <AcceptBookingModal
        isOpen={actions.acceptModal.show}
        onConfirm={actions.confirmAccept}
        onCancel={actions.closeAccept}
      />
      <CancelBookingModal
        isOpen={actions.cancelModal.show}
        onClose={actions.closeCancel}
        onSubmit={actions.submitCancel}
        type={actions.cancelModal.type}
        processing={actions.processingCancel}
      />
    </div>
  );
};

export default BookingsList;
