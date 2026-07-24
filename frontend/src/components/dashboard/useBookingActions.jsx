import { useState } from 'react';
import { toast } from 'sonner';
import axios from 'axios';

/**
 * Encapsulates every booking-mutation flow used by `BookingsList`:
 * accept, cancel/request-cancel/deny, approve-cancel, and contract sign.
 * Returns the handlers + the modal-control state the parent needs to
 * render `<AcceptBookingModal/>`, `<CancelBookingModal/>`, and
 * `<ContractSignModal/>`.
 *
 * Side-effects: shows toasts, calls `onUpdate()` after success.
 */
export default function useBookingActions({ bookings, API, token, onUpdate }) {
  // Modal state
  const [acceptModal, setAcceptModal] = useState({ show: false, bookingId: null });
  const [cancelModal, setCancelModal] = useState({ show: false, bookingId: null, type: '' });
  const [processingCancel, setProcessingCancel] = useState(false);

  const [showContractSignModal, setShowContractSignModal] = useState(false);
  const [contractBookingId, setContractBookingId] = useState(null);
  const [contractPreviewUrl, setContractPreviewUrl] = useState('');
  // Blob URLs carry no extension, so track the type separately for preview.
  const [contractPreviewIsPdf, setContractPreviewIsPdf] = useState(false);

  const authHeader = { headers: { Authorization: `Bearer ${token}` } };

  // ─── Accept ──────────────────────────────────────────────────────────────
  const openAccept = (bookingId) => setAcceptModal({ show: true, bookingId });
  const closeAccept = () => setAcceptModal({ show: false, bookingId: null });
  const confirmAccept = async () => {
    try {
      await axios.post(`${API}/bookings/${acceptModal.bookingId}/accept`, {}, authHeader);
      toast.success('Booking accepted successfully!');
      closeAccept();
      await onUpdate();
    } catch (error) {
      toast.error(error.response?.data?.detail || 'Failed to accept booking');
    }
  };

  // ─── Cancel / Request-cancel / Deny-cancel ───────────────────────────────
  const openCancel = (bookingId) => setCancelModal({ show: true, bookingId, type: 'cancel' });
  const openRequestCancel = (bookingId) =>
    setCancelModal({ show: true, bookingId, type: 'request' });
  const openDenyCancel = (bookingId) =>
    setCancelModal({ show: true, bookingId, type: 'deny' });
  const closeCancel = () => setCancelModal({ show: false, bookingId: null, type: '' });

  const submitCancel = async (reason) => {
    if (!reason) {
      toast.error('Please provide a reason');
      return;
    }
    setProcessingCancel(true);
    try {
      const ENDPOINTS = {
        cancel: 'cancel',
        request: 'request-cancel',
        deny: 'deny-cancel',
      };
      const path = ENDPOINTS[cancelModal.type];
      await axios.post(
        `${API}/bookings/${cancelModal.bookingId}/${path}`,
        { reason },
        authHeader,
      );
      const MSG = {
        cancel: 'Booking cancelled successfully',
        request: 'Cancellation request submitted',
        deny: 'Cancellation request denied',
      };
      toast.success(MSG[cancelModal.type]);
      closeCancel();
      await onUpdate();
    } catch (error) {
      toast.error(error.response?.data?.detail || 'Failed to process cancellation');
    } finally {
      setProcessingCancel(false);
    }
  };

  // ─── Approve cancellation (inline sonner confirm) ────────────────────────
  const approveCancel = (bookingId) => {
    toast.custom(
      (tid) => (
        <div className="bg-white rounded-xl shadow-xl border border-gray-200 p-4 w-80">
          <p className="text-sm font-semibold text-gray-800 mb-1">Approve this cancellation?</p>
          <p className="text-xs text-gray-500 mb-3">
            The booking will be cancelled and the renter notified.
          </p>
          <div className="flex gap-2 justify-end">
            <button
              onClick={() => toast.dismiss(tid)}
              className="px-3 py-1.5 rounded-lg text-xs font-medium text-gray-600 hover:bg-gray-100"
            >
              Cancel
            </button>
            <button
              onClick={async () => {
                toast.dismiss(tid);
                try {
                  await axios.post(
                    `${API}/bookings/${bookingId}/approve-cancel`,
                    {},
                    authHeader,
                  );
                  toast.success('Cancellation approved');
                  await onUpdate();
                } catch (error) {
                  toast.error(error.response?.data?.detail || 'Failed to approve cancellation');
                }
              }}
              className="px-3 py-1.5 rounded-lg text-xs font-semibold text-white bg-[#1E6A6A] hover:bg-[#175555]"
              data-testid={`confirm-approve-cancel-${bookingId}`}
            >
              Approve
            </button>
          </div>
        </div>
      ),
      { duration: 10000 },
    );
  };

  // ─── Contract sign ───────────────────────────────────────────────────────
  const openContractSign = async (bookingId) => {
    setContractBookingId(bookingId);
    setShowContractSignModal(true);
    try {
      const booking = bookings.find((b) => b.id === bookingId);
      if (!booking) return;
      const propertyRes = await axios.get(`${API}/properties/${booking.property_id}/contract`, authHeader);
      if (propertyRes.data.has_contract && propertyRes.data.contract_url) {
        // The contract is no longer a public file — pull it through the
        // permission-checked endpoint and preview it as a blob.
        setContractPreviewIsPdf(
          String(propertyRes.data.contract_url).toLowerCase().endsWith('.pdf'),
        );
        const fileRes = await axios.get(
          `${API}/properties/${booking.property_id}/contract-file`,
          { ...authHeader, responseType: 'blob' },
        );
        setContractPreviewUrl(URL.createObjectURL(fileRes.data));
      }
    } catch (error) {
      console.error('Failed to fetch contract:', error);
    }
  };

  const closeContractSign = () => {
    setShowContractSignModal(false);
    setContractBookingId(null);
    // Release the blob so we don't leak object URLs across sign attempts.
    setContractPreviewUrl((prev) => {
      if (prev && prev.startsWith('blob:')) URL.revokeObjectURL(prev);
      return '';
    });
    setContractPreviewIsPdf(false);
  };

  const submitContractSign = async (
    signatureData,
    signaturePosition,
    signatureSize,
    displayDims,
    legalName,
  ) => {
    if (!signatureData) {
      toast.error('Please provide a signature');
      return;
    }
    if (!legalName || !legalName.trim()) {
      toast.error('Please enter your full legal name');
      return;
    }
    try {
      await axios.post(
        `${API}/bookings/${contractBookingId}/sign-contract`,
        {
          signature_data: signatureData,
          signature_x: signaturePosition.x,
          signature_y: signaturePosition.y,
          signature_width: signatureSize.width,
          signature_height: signatureSize.height,
          display_width: displayDims?.width,
          display_height: displayDims?.height,
          legal_name: legalName.trim(),
        },
        authHeader,
      );
      toast.success('Contract signed successfully!');
      closeContractSign();
      await onUpdate();
    } catch (error) {
      toast.error(error.response?.data?.detail || 'Failed to sign contract');
    }
  };

  return {
    // Accept
    openAccept,
    closeAccept,
    confirmAccept,
    acceptModal,
    // Cancel
    openCancel,
    openRequestCancel,
    openDenyCancel,
    closeCancel,
    submitCancel,
    cancelModal,
    processingCancel,
    approveCancel,
    // Contract
    openContractSign,
    closeContractSign,
    submitContractSign,
    showContractSignModal,
    contractBookingId,
    contractPreviewUrl,
    contractPreviewIsPdf,
  };
}
