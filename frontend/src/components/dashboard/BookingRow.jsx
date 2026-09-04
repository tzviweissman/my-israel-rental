import React, { useContext, useEffect, useRef } from 'react';
import { useTranslation } from 'react-i18next';
import { FileText, FileCheck, Download } from 'lucide-react';
import { AuthContext } from '../../App';
import openAuthedFile from '../../utils/openAuthedFile';

const STATUS_COLORS = {
  confirmed: 'bg-green-100 text-green-700',
  pending: 'bg-yellow-100 text-yellow-700',
  rejected: 'bg-red-100 text-red-700',
  cancellation_requested: 'bg-orange-100 text-orange-700',
  cancelled: 'bg-gray-100 text-gray-700',
};

/**
 * Single booking card row. Pure presentational — all action handlers come
 * in as props from the parent's `useBookingActions` hook.
 */
const BookingRow = ({
  booking,
  user,
  API,
  onAccept,
  onCancel,
  onRequestCancel,
  onApproveCancel,
  onDenyCancel,
  onSignContract,
  highlighted = false,
}) => {
  const { t } = useTranslation();
  // The notification bell and its email link here with `highlight=<id>`;
  // the row it names scrolls into view with a ring, so the person can see
  // which of twenty bookings the notification was about.
  const rootRef = useRef(null);
  useEffect(() => {
    if (highlighted && rootRef.current) rootRef.current.scrollIntoView({ block: 'center', behavior: 'smooth' });
  }, [highlighted]);
  const statusLabel = (s) => {
    if (s === 'confirmed') return t('dashboard.confirmed');
    if (s === 'pending') return t('dashboard.pending');
    if (s === 'cancelled') return t('dashboard.cancelled');
    if (s === 'cancellation_requested') return t('dashboard.cancellationRequested');
    return s;
  };
  // Every flag here mirrors the backend's own check, which authorises on
  // THIS booking's relationship — owner_id / renter_id — and never on the
  // account's role. Gating the buttons on role instead produced two real
  // bugs:
  //
  //   • `isOwner` (role) showed Cancel on bookings the user doesn't own, and
  //     POST /bookings/{id}/cancel then returned 403 "Not authorized".
  //   • `isRenter` (role) hid "Request cancellation" from anyone whose
  //     account isn't literally role 'renter' — so an owner, manager or
  //     admin who books a place has no way to ask to cancel it, even though
  //     the endpoint would happily accept them.
  //
  // Role and relationship are different questions. Only the second one
  // decides what the server will allow.
  //
  // The lister side of any booking owns the calendar via booking.owner_id.
  // For sublease bookings, that is the sublessor (a renter-role user) —
  // which is itself proof that role can't stand in for relationship.
  const ownsBookingAsLister = booking.owner_id === user.id;
  const isBookingRenter = booking.renter_id === user.id;
  const cancellableStatuses = ['pending', 'confirmed'];
  const canCancel = ownsBookingAsLister && cancellableStatuses.includes(booking.status);
  const canRequestCancel =
    isBookingRenter && !ownsBookingAsLister && cancellableStatuses.includes(booking.status);
  const canApprove =
    ownsBookingAsLister && booking.status === 'cancellation_requested';
  const canAccept = ownsBookingAsLister && booking.status === 'pending';
  const needsSignature =
    booking.renter_id === user.id &&
    booking.status === 'confirmed' &&
    booking.contract_sent_at &&
    !booking.contract_signed;

  // Signed contracts are no longer public files — they're fetched from a
  // permission-checked endpoint with the caller's token, so we can't use a
  // plain <a href>. `hasSigned` just drives whether the buttons render.
  const { token } = useContext(AuthContext);
  const hasSigned = Boolean(booking.signed_contract_url);
  const openSigned = (download) =>
    openAuthedFile(`/bookings/${booking.id}/signed-contract`, API, token, {
      download,
      filename: `signed-contract-${booking.id}`,
    });

  return (
    <div
      ref={rootRef}
      className={`bg-white rounded-2xl border p-4 md:p-6 ${highlighted ? 'border-[var(--brand-primary)] ring-2 ring-[var(--brand-primary)]/30' : 'border-gray-200'}`}
      data-highlighted={highlighted ? '1' : undefined}
      data-testid={`booking-row-${booking.id}`}
    >
      <div className="flex flex-col md:flex-row md:items-start md:justify-between gap-3 md:gap-4">
        <div className="flex-1 min-w-0">
          <div className="flex flex-wrap items-center gap-2 md:gap-3 mb-3">
            <h3 className="text-base md:text-lg font-bold text-gray-900 break-words">
              {booking.property_title || booking.property_id}
            </h3>
            <span
              className={`px-2.5 py-1 rounded-full text-[11px] md:text-xs font-semibold whitespace-nowrap ${
                STATUS_COLORS[booking.status] || 'bg-gray-100 text-gray-700'
              }`}
            >
              {statusLabel(booking.status)}
            </span>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-2 text-sm text-gray-600">
            {booking.property_location && (
              <p>
                <span className="font-medium">{t('dashboard.location')}:</span> {booking.property_location}
              </p>
            )}
            <p>
              <span className="font-medium">{t('dashboard.dates')}:</span>{' '}
              {new Date(booking.start_date).toLocaleDateString()} -{' '}
              {new Date(booking.end_date).toLocaleDateString()}
            </p>
            {booking.message && (
              <p>
                <span className="font-medium">{t('dashboard.message')}:</span> {booking.message}
              </p>
            )}
          </div>

          {booking.cancellation_reason &&
            ['cancelled', 'cancellation_requested'].includes(booking.status) && (
              <div className="mt-3 p-3 bg-gray-50 rounded-lg">
                <p className="text-sm">
                  <span className="font-medium text-gray-700">{t('dashboard.cancellationReason')}:</span>{' '}
                  {booking.cancellation_reason}
                </p>
              </div>
            )}
          {/* Only while the denial is the booking's current state. This box
              used to render on `cancellation_denial_reason` alone, so once a
              request had been denied the red notice stayed forever — beside a
              later request that was still pending, and even beside one that
              was eventually approved. The backend now clears these fields on
              a fresh request; this guard also covers bookings already
              carrying stale fields, with no migration. */}
          {booking.cancellation_denial_reason &&
            ['pending', 'confirmed'].includes(booking.status) && (
            <div className="mt-3 p-3 bg-red-50 rounded-lg">
              <p className="text-sm">
                <span className="font-medium text-red-700">{t('dashboard.denialReason')}:</span>{' '}
                {booking.cancellation_denial_reason}
              </p>
            </div>
          )}
        </div>

        <div className="grid grid-cols-2 md:flex md:flex-wrap md:justify-end gap-2 md:flex-shrink-0 md:max-w-[260px] w-full md:w-auto">
          {needsSignature && (
            <button
              onClick={() => onSignContract(booking.id)}
              className="col-span-2 md:col-auto px-3 py-2 rounded-lg text-xs md:text-sm font-medium text-white hover:bg-opacity-90 transition-colors flex items-center justify-center gap-1.5 whitespace-nowrap"
              style={{ backgroundColor: 'var(--gold)' }}
              data-testid={`sign-contract-${booking.id}`}
            >
              <FileText size={15} />
              {t('dashboard.signContract')}
            </button>
          )}
          {booking.contract_signed && hasSigned && (
            <>
              <button
                type="button"
                onClick={() => openSigned(false)}
                className="px-3 py-2 rounded-lg text-xs md:text-sm font-medium bg-green-500 text-white hover:bg-green-600 transition-colors flex items-center justify-center gap-1.5 whitespace-nowrap"
                data-testid={`view-signed-contract-${booking.id}`}
              >
                <FileCheck size={15} />
                {t('dashboard.viewSignedContract')}
              </button>
              <button
                type="button"
                onClick={() => openSigned(true)}
                className="px-3 py-2 rounded-lg text-xs md:text-sm font-medium bg-[var(--brand-primary)] text-white hover:bg-[rgb(var(--brand-primary-rgb)/<alpha-value>)]/90 transition-colors flex items-center justify-center gap-1.5 whitespace-nowrap"
                data-testid={`download-signed-contract-${booking.id}`}
              >
                <Download size={15} />
                {t('dashboard.download')}
              </button>
            </>
          )}
          {canAccept && (
            <button
              onClick={() => onAccept(booking.id)}
              className="px-3 py-2 rounded-lg text-xs md:text-sm font-medium text-white hover:bg-opacity-90 transition-colors whitespace-nowrap"
              style={{ backgroundColor: 'var(--brand-primary)' }}
              data-testid={`accept-booking-${booking.id}`}
            >
              {t('dashboard.accept')}
            </button>
          )}
          {canCancel && (
            <button
              onClick={() => onCancel(booking.id)}
              className="col-span-2 md:col-auto px-3 py-2 rounded-lg text-xs md:text-sm font-medium bg-red-500 text-white hover:bg-red-600 transition-colors whitespace-nowrap"
              data-testid={`cancel-booking-${booking.id}`}
            >
              {t('dashboard.cancelBooking')}
            </button>
          )}
          {canRequestCancel && (
            <button
              onClick={() => onRequestCancel(booking.id)}
              className="col-span-2 md:col-auto px-3 py-2 rounded-lg text-xs md:text-sm font-medium bg-orange-500 text-white hover:bg-orange-600 transition-colors whitespace-nowrap"
              data-testid={`request-cancel-${booking.id}`}
            >
              {t('dashboard.requestCancellation')}
            </button>
          )}
          {canApprove && (
            <>
              <button
                onClick={() => onApproveCancel(booking.id)}
                className="px-3 py-2 rounded-lg text-xs md:text-sm font-medium bg-green-500 text-white hover:bg-green-600 transition-colors whitespace-nowrap"
                data-testid={`approve-cancel-${booking.id}`}
              >
                {t('dashboard.accept')}
              </button>
              <button
                onClick={() => onDenyCancel(booking.id)}
                className="px-3 py-2 rounded-lg text-xs md:text-sm font-medium bg-red-500 text-white hover:bg-red-600 transition-colors whitespace-nowrap"
                data-testid={`deny-cancel-${booking.id}`}
              >
                {t('dashboard.deny')}
              </button>
            </>
          )}
        </div>
      </div>
    </div>
  );
};

export default BookingRow;
