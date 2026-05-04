import React from 'react';
import { X, ShieldCheck } from 'lucide-react';
import PayPalCheckout from './PayPalCheckout';

/**
 * Post-booking modal shown for sublease bookings only.
 *
 * After the user has successfully submitted the booking request, we prompt
 * them to pay a 2.5% service fee via PayPal. If they dismiss, the booking
 * stays pending as usual; the sublessor can still cancel. If they pay, the
 * backend links the payment to the booking (service_fee_paid=true).
 *
 * Props:
 *  - open:           boolean
 *  - onClose:        () => void
 *  - booking:        the created booking (has id, sublease_id, ...)
 *  - bookingAmount:  number — the full booking total (price * nights, etc.)
 *  - currency:       'USD' | 'ILS'
 */
const SubleaseFeePayModal = ({ open, onClose, booking, bookingAmount, currency = 'USD' }) => {
  if (!open || !booking) return null;

  const fee = Math.round(Number(bookingAmount || 0) * 0.025 * 100) / 100;
  const currencySymbol = currency === 'ILS' ? '₪' : '$';

  return (
    <div
      className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4 overflow-y-auto"
      data-testid="sublease-fee-modal"
    >
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md overflow-hidden my-auto max-h-[calc(100vh-2rem)] flex flex-col">
        <div className="px-6 py-5 border-b border-gray-100 flex items-center justify-between flex-shrink-0">
          <div className="flex items-center gap-2">
            <ShieldCheck size={20} className="text-[#D4AF37]" />
            <h2 className="text-lg font-bold text-gray-900">Sublease service fee</h2>
          </div>
          <button onClick={onClose} className="p-1 rounded hover:bg-gray-100" data-testid="sublease-fee-close">
            <X size={18} />
          </button>
        </div>
        <div className="p-6 overflow-y-auto">
          <p className="text-sm text-gray-600 mb-4">
            Your booking request has been sent to the sublessor. To confirm it, please pay the <strong>2.5% service fee</strong>.
          </p>
          <div className="rounded-xl bg-gray-50 border border-gray-100 p-4 mb-5 text-sm">
            <div className="flex justify-between mb-1.5">
              <span className="text-gray-500">Booking total</span>
              <span className="text-gray-900">{currencySymbol}{Number(bookingAmount).toLocaleString()}</span>
            </div>
            <div className="flex justify-between mb-1.5">
              <span className="text-gray-500">Service fee (2.5%)</span>
              <span className="text-gray-900 font-medium">{currencySymbol}{fee.toFixed(2)}</span>
            </div>
            <div className="pt-2 mt-2 border-t border-gray-200 flex justify-between items-baseline">
              <span className="text-gray-700 font-semibold">You pay today</span>
              <span className="text-xl font-bold text-[#1E6A6A]" data-testid="sublease-fee-amount">
                {currencySymbol}{fee.toFixed(2)}
              </span>
            </div>
          </div>
          <PayPalCheckout
            productType="sublease_booking"
            metadata={{
              sublease_id: booking.sublease_id,
              booking_id: booking.id,
              booking_amount: Number(bookingAmount),
              currency,
            }}
            currency={currency}
            onCaptured={() => {
              // close modal, parent shows its own success toast
              onClose({ captured: true });
            }}
          />
          <button
            onClick={() => onClose({ captured: false })}
            className="w-full mt-3 text-xs text-gray-500 hover:text-gray-700 py-2"
            data-testid="sublease-fee-pay-later"
          >
            Pay later
          </button>
        </div>
      </div>
    </div>
  );
};

export default SubleaseFeePayModal;
