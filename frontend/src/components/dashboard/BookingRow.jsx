import React from 'react';
import { useTranslation } from 'react-i18next';
import { FileText, FileCheck, Download } from 'lucide-react';

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
}) => {
  const { t } = useTranslation();
  const statusLabel = (s) => {
    if (s === 'confirmed') return t('dashboard.confirmed');
    if (s === 'pending') return t('dashboard.pending');
    if (s === 'cancelled') return t('dashboard.cancelled');
    if (s === 'cancellation_requested') return t('dashboard.cancellationRequested');
    return s;
  };
  const isOwner = user.role === 'owner' || user.role === 'manager';
  const isRenter = user.role === 'renter';
  // The lister side of any booking owns the calendar via booking.owner_id.
  // For sublease bookings, that is the sublessor (a renter-role user).
  const ownsBookingAsLister = booking.owner_id === user.id;
  const cancellableStatuses = ['pending', 'confirmed'];
  const canCancel = (isOwner || ownsBookingAsLister) && cancellableStatuses.includes(booking.status);
  const canRequestCancel =
    isRenter && !ownsBookingAsLister && cancellableStatuses.includes(booking.status);
  const canApprove =
    (isOwner || ownsBookingAsLister) && booking.status === 'cancellation_requested';
  const canAccept = (isOwner || ownsBookingAsLister) && booking.status === 'pending';
  const needsSignature =
    booking.renter_id === user.id &&
    booking.status === 'confirmed' &&
    booking.contract_sent_at &&
    !booking.contract_signed;

  const signedHref = booking.signed_contract_url
    ? `${API.replace('/api', '')}${booking.signed_contract_url}`
    : null;

  return (
    <div
      className="bg-white rounded-2xl border border-gray-200 p-6"
      data-testid={`booking-row-${booking.id}`}
    >
      <div className="flex items-start justify-between gap-4">
        <div className="flex-1">
          <div className="flex items-center gap-3 mb-3">
            <h3 className="text-lg font-bold text-gray-900">
              {booking.property_title || booking.property_id}
            </h3>
            <span
              className={`px-3 py-1 rounded-full text-xs font-semibold ${
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
                <span className="font-medium">Message:</span> {booking.message}
              </p>
            )}
          </div>

          {booking.cancellation_reason &&
            ['cancelled', 'cancellation_requested'].includes(booking.status) && (
              <div className="mt-3 p-3 bg-gray-50 rounded-lg">
                <p className="text-sm">
                  <span className="font-medium text-gray-700">Cancellation Reason:</span>{' '}
                  {booking.cancellation_reason}
                </p>
              </div>
            )}
          {booking.cancellation_denial_reason && (
            <div className="mt-3 p-3 bg-red-50 rounded-lg">
              <p className="text-sm">
                <span className="font-medium text-red-700">Denial Reason:</span>{' '}
                {booking.cancellation_denial_reason}
              </p>
            </div>
          )}
        </div>

        <div className="flex gap-2 flex-wrap justify-end">
          {needsSignature && (
            <button
              onClick={() => onSignContract(booking.id)}
              className="px-4 py-2 rounded-lg text-sm font-medium text-white hover:bg-opacity-90 transition-colors flex items-center gap-2"
              style={{ backgroundColor: '#D4AF37' }}
              data-testid={`sign-contract-${booking.id}`}
            >
              <FileText size={16} />
              {t('dashboard.signContract')}
            </button>
          )}
          {booking.contract_signed && signedHref && (
            <>
              <a
                href={signedHref}
                target="_blank"
                rel="noopener noreferrer"
                className="px-4 py-2 rounded-lg text-sm font-medium bg-green-500 text-white hover:bg-green-600 transition-colors flex items-center gap-2"
                data-testid={`view-signed-contract-${booking.id}`}
              >
                <FileCheck size={16} />
                {t('dashboard.viewSignedContract')}
              </a>
              <a
                href={signedHref}
                download
                className="px-4 py-2 rounded-lg text-sm font-medium bg-[#1E6A6A] text-white hover:bg-[#1E6A6A]/90 transition-colors flex items-center gap-2"
                data-testid={`download-signed-contract-${booking.id}`}
              >
                <Download size={16} />
                {t('dashboard.download')}
              </a>
            </>
          )}
          {canAccept && (
            <button
              onClick={() => onAccept(booking.id)}
              className="px-4 py-2 rounded-lg text-sm font-medium text-white hover:bg-opacity-90 transition-colors"
              style={{ backgroundColor: '#1E6A6A' }}
              data-testid={`accept-booking-${booking.id}`}
            >
              {t('dashboard.accept')}
            </button>
          )}
          {canCancel && (
            <button
              onClick={() => onCancel(booking.id)}
              className="px-4 py-2 rounded-lg text-sm font-medium bg-red-500 text-white hover:bg-red-600 transition-colors"
              data-testid={`cancel-booking-${booking.id}`}
            >
              {t('dashboard.cancelBooking')}
            </button>
          )}
          {canRequestCancel && (
            <button
              onClick={() => onRequestCancel(booking.id)}
              className="px-4 py-2 rounded-lg text-sm font-medium bg-orange-500 text-white hover:bg-orange-600 transition-colors"
              data-testid={`request-cancel-${booking.id}`}
            >
              {t('dashboard.requestCancellation')}
            </button>
          )}
          {canApprove && (
            <>
              <button
                onClick={() => onApproveCancel(booking.id)}
                className="px-4 py-2 rounded-lg text-sm font-medium bg-green-500 text-white hover:bg-green-600 transition-colors"
                data-testid={`approve-cancel-${booking.id}`}
              >
                {t('dashboard.accept')}
              </button>
              <button
                onClick={() => onDenyCancel(booking.id)}
                className="px-4 py-2 rounded-lg text-sm font-medium bg-red-500 text-white hover:bg-red-600 transition-colors"
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
