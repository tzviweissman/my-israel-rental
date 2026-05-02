import React, { useState, useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { Filter, X } from 'lucide-react';
import ContractSignModal from '../modals/ContractSignModal';
import AcceptBookingModal from '../modals/AcceptBookingModal';
import CancelBookingModal from '../modals/CancelBookingModal';
import BookingRow from './BookingRow';
import useBookingActions from './useBookingActions';

/**
 * Bookings tab — renders a filter input + list of `BookingRow`s and owns
 * the three modals (Accept / Cancel / ContractSign). All mutation logic
 * lives in the `useBookingActions` hook.
 */
const BookingsList = ({ bookings, onUpdate, user, token, API }) => {
  const { t } = useTranslation();
  const [search, setSearch] = useState('');
  const actions = useBookingActions({ bookings, API, token, onUpdate });

  const filtered = useMemo(() => {
    const term = search.toLowerCase();
    return [...bookings]
      .filter((b) => {
        if (!term) return true;
        return (
          (b.property_title || '').toLowerCase().includes(term) ||
          (b.property_location || '').toLowerCase().includes(term) ||
          (b.status || '').toLowerCase().includes(term) ||
          (b.message || '').toLowerCase().includes(term)
        );
      })
      .sort((a, b) => new Date(b.created_at || 0) - new Date(a.created_at || 0));
  }, [bookings, search]);

  return (
    <div>
      <div className="flex items-center justify-between mb-6 gap-4">
        <h2 className="text-2xl font-bold" style={{ fontFamily: 'Playfair Display' }}>
          {t('dashboard.myBookings')}
        </h2>

        {bookings.length > 0 && (
          <div className="flex-1 max-w-md">
            <div className="relative">
              <input
                type="text"
                placeholder={t('dashboard.searchBookings')}
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="w-full px-4 py-2.5 pl-10 rounded-xl border-2 border-gray-200 focus:border-[#1E6A6A] focus:outline-none text-sm"
                data-testid="bookings-search"
              />
              <Filter
                size={18}
                className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400"
              />
              {search && (
                <button
                  onClick={() => setSearch('')}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
                  data-testid="bookings-search-clear"
                >
                  <X size={16} />
                </button>
              )}
            </div>
          </div>
        )}
      </div>

      {filtered.length === 0 ? (
        <div className="bg-white rounded-2xl border border-gray-200 p-12 text-center">
          {search ? (
            <>
              <p className="text-gray-500 mb-2">No bookings match your search</p>
              <button
                onClick={() => setSearch('')}
                className="text-[#1E6A6A] hover:underline text-sm"
              >
                Clear filter
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
