import React, { useContext } from 'react';
import { useTranslation } from 'react-i18next';
import {
  CheckCircle2, XCircle, FileText, FileCheck, Download, MessageCircle,
} from 'lucide-react';
import { AuthContext } from '../../App';
import openAuthedFile from '../../utils/openAuthedFile';

const STATUS_PILL = {
  confirmed: { bg: '#DCFCE7', fg: '#16A34A', labelKey: 'dashboard.confirmed', fallback: 'Confirmed' },
  pending: { bg: '#E0F2FE', fg: '#0EA5E9', labelKey: 'dashboard.pending', fallback: 'Pending' },
  cancellation_requested: { bg: '#FEE2E2', fg: '#DC2626', labelKey: 'dashboard.cancellationRequested', fallback: 'Cancellation requested' },
  cancelled: { bg: '#F3F4F6', fg: '#6B7280', labelKey: 'dashboard.cancelled', fallback: 'Cancelled' },
  completed: { bg: '#F3F4F6', fg: '#6B7280', labelKey: 'dashboard.completed', fallback: 'Completed' },
};

/**
 * Compact per-booking card rendered inside the expanded property card on
 * the owner-stacked Bookings tab. Pure presentational — every mutation
 * is dispatched via the action callbacks supplied by `useBookingActions`.
 */
const BookingChip = ({
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
  const b = booking;
  const todayIso = new Date().toISOString().slice(0, 10);
  const isCurrent = b.start_date <= todayIso && todayIso <= b.end_date && ['confirmed', 'pending'].includes(b.status);

  // Relationship to THIS booking, never the account's role — the backend
  // authorises on owner_id / renter_id alone, so `user.role === 'owner'`
  // put a Cancel button on bookings the caller didn't own and the request
  // came back 403. See the note in BookingRow.jsx.
  const ownsAsLister = b.owner_id === user.id;
  const isRenterOnBooking = b.renter_id === user.id;
  const cancellable = ['pending', 'confirmed'].includes(b.status);
  // The lister can directly cancel only while the booking is still pending.
  // After accepting, they must use the cancellation-request flow.
  const canDirectCancel = ownsAsLister && b.status === 'pending';
  const canRequestCancelAsLister = ownsAsLister && b.status === 'confirmed';
  const canRequestCancelAsRenter = isRenterOnBooking && !ownsAsLister && cancellable;
  const canAccept = ownsAsLister && b.status === 'pending';
  const canApprove = ownsAsLister && b.status === 'cancellation_requested';
  const needsSignature =
    b.renter_id === user.id &&
    b.status === 'confirmed' &&
    b.contract_sent_at &&
    !b.contract_signed;
  // Signed contracts now come from a permission-checked endpoint (they used
  // to be public files), so they're fetched with the token rather than linked.
  const { token } = useContext(AuthContext);
  const hasSigned = Boolean(b.signed_contract_url);
  const openSigned = (download) =>
    openAuthedFile(`/bookings/${b.id}/signed-contract`, API, token, {
      download,
      filename: `signed-contract-${b.id}`,
    });

  const pill = STATUS_PILL[b.status] || { bg: '#F3F4F6', fg: '#6B7280', labelKey: '', fallback: b.status };
  const renterDisplay = b.renter_name || b.guest_name || (isRenterOnBooking ? t('dashboard.you', 'You') : t('dashboard.guest', 'Guest'));
  const startLabel = new Date(b.start_date).toLocaleDateString();
  const endLabel = new Date(b.end_date).toLocaleDateString();

  return (
    <div
      className="bg-white border border-gray-200 rounded-lg px-3 py-2.5"
      data-testid={`booking-row-${b.id}`}
    >
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2 flex-wrap mb-0.5">
            <span className="font-medium text-gray-800 text-sm">{renterDisplay}</span>
            {isCurrent && (
              <span className="px-2 py-0.5 rounded text-[10px] font-bold" style={{ backgroundColor: '#FEF3C7', color: '#A16207' }}>
                {t('dashboard.inProgress', 'IN PROGRESS')}
              </span>
            )}
            <span
              className="px-2 py-0.5 rounded text-[10px] font-semibold uppercase"
              style={{ backgroundColor: pill.bg, color: pill.fg }}
            >
              {pill.labelKey ? t(pill.labelKey, pill.fallback) : pill.fallback}
            </span>
          </div>
          <div className="text-xs text-gray-600">{startLabel} → {endLabel}</div>
          {b.message && (
            <div className="text-[11px] text-gray-500 mt-1 line-clamp-2">
              <span className="font-medium">{t('dashboard.message')}:</span> {b.message}
            </div>
          )}
          {b.cancellation_reason && ['cancelled', 'cancellation_requested'].includes(b.status) && (
            <div className="text-[11px] text-gray-600 mt-1">
              <span className="font-medium">{t('dashboard.cancellationReason')}:</span> {b.cancellation_reason}
            </div>
          )}
          {b.cancellation_denial_reason && (
            <div className="text-[11px] text-red-700 mt-1">
              <span className="font-medium">{t('dashboard.denialReason')}:</span> {b.cancellation_denial_reason}
            </div>
          )}
        </div>
      </div>

      <div className="flex flex-wrap gap-1.5 mt-2.5 pt-2.5 border-t border-gray-100">
        {needsSignature && (
          <button
            onClick={() => onSignContract(b.id)}
            className="px-2.5 py-1.5 rounded-md text-[11px] font-semibold text-white inline-flex items-center gap-1"
            style={{ backgroundColor: '#D4AF37' }}
            data-testid={`sign-contract-${b.id}`}
          >
            <FileText size={12} />
            {t('dashboard.signContract')}
          </button>
        )}

        {b.contract_signed && hasSigned && (
          <>
            <button
              type="button"
              onClick={() => openSigned(false)}
              className="px-2.5 py-1.5 rounded-md text-[11px] font-semibold text-white bg-green-500 hover:bg-green-600 inline-flex items-center gap-1"
              data-testid={`view-signed-contract-${b.id}`}
            >
              <FileCheck size={12} />
              {t('dashboard.viewSignedContract')}
            </button>
            <button
              type="button"
              onClick={() => openSigned(true)}
              className="px-2.5 py-1.5 rounded-md text-[11px] font-semibold text-white bg-[#1E6A6A] hover:bg-[#175555] inline-flex items-center gap-1"
              data-testid={`download-signed-contract-${b.id}`}
            >
              <Download size={12} />
              {t('dashboard.download')}
            </button>
          </>
        )}

        {canAccept && (
          <button
            onClick={() => onAccept(b.id)}
            className="px-2.5 py-1.5 rounded-md text-[11px] font-semibold text-white inline-flex items-center gap-1"
            style={{ backgroundColor: '#1E6A6A' }}
            data-testid={`accept-booking-${b.id}`}
          >
            <CheckCircle2 size={12} />
            {t('dashboard.accept')}
          </button>
        )}

        {canApprove && (
          <>
            <button
              onClick={() => onApproveCancel(b.id)}
              className="px-2.5 py-1.5 rounded-md text-[11px] font-semibold text-white bg-green-500 hover:bg-green-600 inline-flex items-center gap-1"
              data-testid={`approve-cancel-${b.id}`}
            >
              <CheckCircle2 size={12} />
              {t('dashboard.accept')}
            </button>
            <button
              onClick={() => onDenyCancel(b.id)}
              className="px-2.5 py-1.5 rounded-md text-[11px] font-semibold text-white bg-red-500 hover:bg-red-600 inline-flex items-center gap-1"
              data-testid={`deny-cancel-${b.id}`}
            >
              <XCircle size={12} />
              {t('dashboard.deny')}
            </button>
          </>
        )}

        {canDirectCancel && (
          <button
            onClick={() => onCancel(b.id)}
            className="ms-auto px-2.5 py-1.5 rounded-md text-[11px] font-semibold text-white bg-red-500 hover:bg-red-600 inline-flex items-center gap-1"
            data-testid={`cancel-booking-${b.id}`}
          >
            <XCircle size={12} />
            {t('dashboard.cancelBooking')}
          </button>
        )}

        {canRequestCancelAsLister && (
          <button
            onClick={() => onRequestCancel(b.id)}
            className="ms-auto px-2.5 py-1.5 rounded-md text-[11px] font-semibold text-orange-700 border border-orange-500 hover:bg-orange-50 inline-flex items-center gap-1"
            data-testid={`request-cancel-${b.id}`}
          >
            <XCircle size={12} />
            {t('dashboard.requestCancellation')}
          </button>
        )}

        {canRequestCancelAsRenter && (
          <button
            onClick={() => onRequestCancel(b.id)}
            className="ms-auto px-2.5 py-1.5 rounded-md text-[11px] font-semibold text-white bg-orange-500 hover:bg-orange-600 inline-flex items-center gap-1"
            data-testid={`request-cancel-${b.id}`}
          >
            <XCircle size={12} />
            {t('dashboard.requestCancellation')}
          </button>
        )}

        {/* Chat shortcut — always visible */}
        <a
          href={`/chat/${b.property_id}?with=${ownsAsLister ? b.renter_id : b.owner_id}`}
          className="px-2.5 py-1.5 rounded-md text-[11px] font-semibold text-[#1E6A6A] border border-[#1E6A6A] hover:bg-[#1E6A6A]/5 inline-flex items-center gap-1"
          data-testid={`booking-message-${b.id}`}
        >
          <MessageCircle size={12} />
          {t('dashboard.message')}
        </a>
      </div>
    </div>
  );
};

export default BookingChip;
