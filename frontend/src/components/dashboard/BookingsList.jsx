import React, { useState, useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { Search, X } from 'lucide-react';
import ContractSignModal from '../modals/ContractSignModal';
import AcceptBookingModal from '../modals/AcceptBookingModal';
import CancelBookingModal from '../modals/CancelBookingModal';
import BookingRow from './BookingRow';
import useBookingActions from './useBookingActions';

const STATUS_FILTERS = [
  { key: 'all', labelKey: 'dashboard.statusAll' },
  { key: 'pending', labelKey: 'dashboard.statusPending' },
  { key: 'confirmed', labelKey: 'dashboard.statusConfirmed' },
  { key: 'cancellation_requested', labelKey: 'dashboard.statusCancellationRequested' },
  { key: 'cancelled', labelKey: 'dashboard.statusCancelled' },
  { key: 'completed', labelKey: 'dashboard.statusCompleted' },
];

/**
 * Bookings tab — renders a filter input + list of `BookingRow`s and owns
 * the three modals (Accept / Cancel / ContractSign). All mutation logic
 * lives in the `useBookingActions` hook.
 *
 * Search supports: property title/location, guest/owner name, dates, status,
 * and the renter's free-text message. Combined with quick-status chips
 * (with live counts) so finding a single booking is one tap.
 */
const BookingsList = ({ bookings, onUpdate, user, token, API }) => {
  const { t } = useTranslation();
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const actions = useBookingActions({ bookings, API, token, onUpdate });

  // Counts per status — used in chip labels so users see "Pending (3)" etc.
  const statusCounts = useMemo(() => {
    const acc = { all: bookings.length };
    for (const b of bookings) {
      acc[b.status] = (acc[b.status] || 0) + 1;
    }
    return acc;
  }, [bookings]);

  const filtered = useMemo(() => {
    const term = search.trim().toLowerCase();
    return [...bookings]
      .filter((b) => {
        if (statusFilter !== 'all' && b.status !== statusFilter) return false;
        if (!term) return true;
        const haystack = [
          b.property_title,
          b.property_location,
          b.status,
          b.message,
          b.renter_name,
          b.owner_name,
          b.guest_name,
          b.check_in,
          b.check_out,
          b.start_date,
          b.end_date,
        ]
          .filter(Boolean)
          .join(' ')
          .toLowerCase();
        return haystack.includes(term);
      })
      .sort((a, b) => new Date(b.created_at || 0) - new Date(a.created_at || 0));
  }, [bookings, search, statusFilter]);

  const isFiltering = !!search || statusFilter !== 'all';
  const clearAll = () => {
    setSearch('');
    setStatusFilter('all');
  };

  return (
    <div>
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 sm:gap-4 mb-4">
        <h2 className="text-2xl font-bold" style={{ fontFamily: 'Playfair Display' }}>
          {t('dashboard.myBookings')}
        </h2>

        {bookings.length > 0 && (
          <div className="w-full sm:max-w-md">
            <div className="relative">
              <input
                type="text"
                placeholder={t('dashboard.searchBookingsHint', 'Search by property, guest, dates…')}
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="w-full px-4 py-2.5 pl-10 rounded-xl border-2 border-gray-200 focus:border-[#1E6A6A] focus:outline-none text-sm"
                data-testid="bookings-search"
              />
              <Search
                size={16}
                className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400"
              />
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
                  active
                    ? 'bg-[#1E6A6A] text-white shadow-sm'
                    : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
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
              className="ml-auto inline-flex items-center gap-1 px-3 py-1.5 rounded-full text-xs font-medium text-[#1E6A6A] hover:bg-[#1E6A6A]/5 transition-colors"
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
          {filtered.length} {filtered.length === 1 ? 'booking' : 'bookings'} found
        </p>
      )}

      {filtered.length === 0 ? (
        <div className="bg-white rounded-2xl border border-gray-200 p-12 text-center">
          {isFiltering ? (
            <>
              <p className="text-gray-500 mb-2">No bookings match your filter</p>
              <button
                onClick={clearAll}
                className="text-[#1E6A6A] hover:underline text-sm"
                data-testid="bookings-empty-clear"
              >
                Clear filters
              </button>
            </>
          ) : (
            <p className="text-gray-500">No bookings yet</p>
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

      {/* Modals */}
      <ContractSignModal
        isOpen={actions.showContractSignModal}
        onClose={actions.closeContractSign}
        bookingId={actions.contractBookingId}
        contractPreviewUrl={actions.contractPreviewUrl}
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
