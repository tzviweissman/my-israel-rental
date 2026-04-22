import React, { useState } from 'react';
import { Filter, X, FileText, FileCheck, Download } from 'lucide-react';
import { toast } from 'sonner';
import axios from 'axios';
import ContractSignModal from '../modals/ContractSignModal';
import AcceptBookingModal from '../modals/AcceptBookingModal';
import CancelBookingModal from '../modals/CancelBookingModal';

const BookingsList = ({ bookings, onUpdate, user, token, API }) => {
  const [bookingsFilter, setBookingsFilter] = useState('');
  const [showContractSignModal, setShowContractSignModal] = useState(false);
  const [contractBookingId, setContractBookingId] = useState(null);
  const [contractPreviewUrl, setContractPreviewUrl] = useState('');
  const [cancelModal, setCancelModal] = useState({ show: false, bookingId: null, type: '' });
  const [acceptModal, setAcceptModal] = useState({ show: false, bookingId: null });
  const [processingCancel, setProcessingCancel] = useState(false);

  // Open contract sign modal
  const openContractSignModal = async (bookingId) => {
    setContractBookingId(bookingId);
    setShowContractSignModal(true);
    
    // Fetch contract for preview
    try {
      const booking = bookings.find(b => b.id === bookingId);
      if (booking) {
        const propertyRes = await axios.get(`${API}/properties/${booking.property_id}/contract`);
        if (propertyRes.data.has_contract && propertyRes.data.contract_url) {
          const fullContractUrl = `${API.replace('/api', '')}${propertyRes.data.contract_url}`;
          setContractPreviewUrl(fullContractUrl);
        }
      }
    } catch (error) {
      console.error('Failed to fetch contract:', error);
    }
  };

  // Submit contract signature
  const submitContractSignature = async (signatureData, signaturePosition, signatureSize, displayDims, legalName) => {
    if (!signatureData) {
      toast.error('Please provide a signature');
      return;
    }
    if (!legalName || !legalName.trim()) {
      toast.error('Please enter your full legal name');
      return;
    }

    try {
      await axios.post(`${API}/bookings/${contractBookingId}/sign-contract`, {
        signature_data: signatureData,
        signature_x: signaturePosition.x,
        signature_y: signaturePosition.y,
        signature_width: signatureSize.width,
        signature_height: signatureSize.height,
        display_width: displayDims?.width,
        display_height: displayDims?.height,
        legal_name: legalName.trim(),
      }, {
        headers: { Authorization: `Bearer ${token}` }
      });
      toast.success('Contract signed successfully!');
      setShowContractSignModal(false);
      setContractBookingId(null);
      setContractPreviewUrl('');
      await onUpdate();
    } catch (error) {
      toast.error(error.response?.data?.detail || 'Failed to sign contract');
    }
  };

  // Accept booking
  const handleAcceptBooking = (bookingId) => {
    setAcceptModal({ show: true, bookingId });
  };

  const confirmAcceptBooking = async () => {
    try {
      await axios.post(`${API}/bookings/${acceptModal.bookingId}/accept`, {}, {
        headers: { Authorization: `Bearer ${token}` }
      });
      toast.success('Booking accepted successfully!');
      setAcceptModal({ show: false, bookingId: null });
      await onUpdate();
    } catch (error) {
      toast.error(error.response?.data?.detail || 'Failed to accept booking');
    }
  };

  // Cancel booking handlers
  const handleCancelBooking = (bookingId) => {
    setCancelModal({ show: true, bookingId, type: 'cancel' });
  };

  const handleRequestCancel = (bookingId) => {
    setCancelModal({ show: true, bookingId, type: 'request' });
  };

  const handleDenyCancel = (bookingId) => {
    setCancelModal({ show: true, bookingId, type: 'deny' });
  };

  const handleApproveCancel = async (bookingId) => {
    try {
      await axios.post(`${API}/bookings/${bookingId}/approve-cancel`, {}, {
        headers: { Authorization: `Bearer ${token}` }
      });
      toast.success('Cancellation approved');
      await onUpdate();
    } catch (error) {
      toast.error(error.response?.data?.detail || 'Failed to approve cancellation');
    }
  };

  const submitCancellation = async (reason) => {
    if (!reason) {
      toast.error('Please provide a reason');
      return;
    }

    setProcessingCancel(true);
    try {
      let endpoint = '';
      if (cancelModal.type === 'cancel') {
        endpoint = `${API}/bookings/${cancelModal.bookingId}/cancel`;
      } else if (cancelModal.type === 'request') {
        endpoint = `${API}/bookings/${cancelModal.bookingId}/request-cancel`;
      } else if (cancelModal.type === 'deny') {
        endpoint = `${API}/bookings/${cancelModal.bookingId}/deny-cancel`;
      }

      await axios.post(endpoint, { reason }, {
        headers: { Authorization: `Bearer ${token}` }
      });

      const message = cancelModal.type === 'deny' ? 'Cancellation request denied' :
                      cancelModal.type === 'request' ? 'Cancellation request submitted' :
                      'Booking cancelled successfully';
      toast.success(message);
      
      setCancelModal({ show: false, bookingId: null, type: '' });
      await onUpdate();
    } catch (error) {
      toast.error(error.response?.data?.detail || 'Failed to process cancellation');
    } finally {
      setProcessingCancel(false);
    }
  };

  // Filter and sort bookings
  const filteredBookings = bookings
    .filter(booking => {
      if (!bookingsFilter) return true;
      const searchTerm = bookingsFilter.toLowerCase();
      return (
        (booking.property_title || '').toLowerCase().includes(searchTerm) ||
        (booking.property_location || '').toLowerCase().includes(searchTerm) ||
        (booking.status || '').toLowerCase().includes(searchTerm) ||
        (booking.message || '').toLowerCase().includes(searchTerm)
      );
    })
    .sort((a, b) => {
      const dateA = new Date(a.created_at || 0);
      const dateB = new Date(b.created_at || 0);
      return dateB - dateA;
    });

  const getStatusColor = (status) => {
    switch(status) {
      case 'confirmed': return 'bg-green-100 text-green-700';
      case 'pending': return 'bg-yellow-100 text-yellow-700';
      case 'rejected': return 'bg-red-100 text-red-700';
      case 'cancellation_requested': return 'bg-orange-100 text-orange-700';
      case 'cancelled': return 'bg-gray-100 text-gray-700';
      default: return 'bg-gray-100 text-gray-700';
    }
  };

  return (
    <div>
      <div className="flex items-center justify-between mb-6 gap-4">
        <h2 className="text-2xl font-bold" style={{ fontFamily: 'Playfair Display' }}>My Bookings</h2>
        
        {/* Search Filter */}
        {bookings.length > 0 && (
          <div className="flex-1 max-w-md">
            <div className="relative">
              <input
                type="text"
                placeholder="Search bookings by property, location, or status..."
                value={bookingsFilter}
                onChange={(e) => setBookingsFilter(e.target.value)}
                className="w-full px-4 py-2.5 pl-10 rounded-xl border-2 border-gray-200 focus:border-[#1E6A6A] focus:outline-none text-sm"
              />
              <Filter size={18} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
              {bookingsFilter && (
                <button
                  onClick={() => setBookingsFilter('')}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
                >
                  <X size={16} />
                </button>
              )}
            </div>
          </div>
        )}
      </div>
      
      {filteredBookings.length === 0 ? (
        <div className="bg-white rounded-2xl border border-gray-200 p-12 text-center">
          {bookingsFilter ? (
            <>
              <p className="text-gray-500 mb-2">No bookings match your search</p>
              <button
                onClick={() => setBookingsFilter('')}
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
          {filteredBookings.map((booking) => {
            const isOwner = user.role === 'owner' || user.role === 'manager';
            const isRenter = user.role === 'renter';
            const canCancel = isOwner && ['pending', 'confirmed'].includes(booking.status);
            const canRequestCancel = isRenter && ['pending', 'confirmed'].includes(booking.status);
            const canApprove = isOwner && booking.status === 'cancellation_requested';
            const canAccept = isOwner && booking.status === 'pending';
            const needsSignature = isRenter && booking.status === 'confirmed' && booking.contract_sent_at && !booking.contract_signed;

            return (
              <div key={booking.id} className="bg-white rounded-2xl border border-gray-200 p-6" data-testid={`booking-row-${booking.id}`}>
                <div className="flex items-start justify-between gap-4">
                  <div className="flex-1">
                    <div className="flex items-center gap-3 mb-3">
                      <h3 className="text-lg font-bold text-gray-900">{booking.property_title || booking.property_id}</h3>
                      <span className={`px-3 py-1 rounded-full text-xs font-semibold ${getStatusColor(booking.status)}`}>
                        {booking.status === 'cancellation_requested' ? 'Cancellation Requested' : booking.status}
                      </span>
                    </div>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-2 text-sm text-gray-600">
                      {booking.property_location && (
                        <p><span className="font-medium">Location:</span> {booking.property_location}</p>
                      )}
                      <p><span className="font-medium">Dates:</span> {new Date(booking.start_date).toLocaleDateString()} - {new Date(booking.end_date).toLocaleDateString()}</p>
                      {booking.message && <p><span className="font-medium">Message:</span> {booking.message}</p>}
                    </div>
                    {booking.cancellation_reason && ['cancelled', 'cancellation_requested'].includes(booking.status) && (
                      <div className="mt-3 p-3 bg-gray-50 rounded-lg">
                        <p className="text-sm"><span className="font-medium text-gray-700">Cancellation Reason:</span> {booking.cancellation_reason}</p>
                      </div>
                    )}
                    {booking.cancellation_denial_reason && (
                      <div className="mt-3 p-3 bg-red-50 rounded-lg">
                        <p className="text-sm"><span className="font-medium text-red-700">Denial Reason:</span> {booking.cancellation_denial_reason}</p>
                      </div>
                    )}
                  </div>
                  <div className="flex gap-2">
                    {needsSignature && (
                      <button
                        onClick={() => openContractSignModal(booking.id)}
                        className="px-4 py-2 rounded-lg text-sm font-medium text-white hover:bg-opacity-90 transition-colors flex items-center gap-2"
                        style={{ backgroundColor: '#D4AF37' }}
                      >
                        <FileText size={16} />
                        Sign Contract
                      </button>
                    )}
                    {booking.contract_signed && booking.signed_contract_url && (
                      <>
                        <a
                          href={`${API.replace('/api', '')}${booking.signed_contract_url}`}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="px-4 py-2 rounded-lg text-sm font-medium bg-green-500 text-white hover:bg-green-600 transition-colors flex items-center gap-2"
                          data-testid={`view-signed-contract-${booking.id}`}
                        >
                          <FileCheck size={16} />
                          View Signed Contract
                        </a>
                        <a
                          href={`${API.replace('/api', '')}${booking.signed_contract_url}`}
                          download
                          className="px-4 py-2 rounded-lg text-sm font-medium bg-[#1E6A6A] text-white hover:bg-[#1E6A6A]/90 transition-colors flex items-center gap-2"
                          data-testid={`download-signed-contract-${booking.id}`}
                        >
                          <Download size={16} />
                          Download
                        </a>
                      </>
                    )}
                    {canAccept && (
                      <button
                        onClick={() => handleAcceptBooking(booking.id)}
                        className="px-4 py-2 rounded-lg text-sm font-medium text-white hover:bg-opacity-90 transition-colors"
                        style={{ backgroundColor: '#1E6A6A' }}
                      >
                        Accept Booking
                      </button>
                    )}
                    {canCancel && (
                      <button
                        onClick={() => handleCancelBooking(booking.id)}
                        className="px-4 py-2 rounded-lg text-sm font-medium bg-red-500 text-white hover:bg-red-600 transition-colors"
                      >
                        Cancel Booking
                      </button>
                    )}
                    {canRequestCancel && (
                      <button
                        onClick={() => handleRequestCancel(booking.id)}
                        className="px-4 py-2 rounded-lg text-sm font-medium bg-orange-500 text-white hover:bg-orange-600 transition-colors"
                      >
                        Request Cancellation
                      </button>
                    )}
                    {canApprove && (
                      <>
                        <button
                          onClick={() => handleApproveCancel(booking.id)}
                          className="px-4 py-2 rounded-lg text-sm font-medium bg-green-500 text-white hover:bg-green-600 transition-colors"
                        >
                          Approve
                        </button>
                        <button
                          onClick={() => handleDenyCancel(booking.id)}
                          className="px-4 py-2 rounded-lg text-sm font-medium bg-red-500 text-white hover:bg-red-600 transition-colors"
                        >
                          Deny
                        </button>
                      </>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Modals */}
      <ContractSignModal
        isOpen={showContractSignModal}
        onClose={() => {
          setShowContractSignModal(false);
          setContractBookingId(null);
          setContractPreviewUrl('');
        }}
        bookingId={contractBookingId}
        contractPreviewUrl={contractPreviewUrl}
        onSignSuccess={submitContractSignature}
      />

      <AcceptBookingModal
        isOpen={acceptModal.show}
        onConfirm={confirmAcceptBooking}
        onCancel={() => setAcceptModal({ show: false, bookingId: null })}
      />

      <CancelBookingModal
        isOpen={cancelModal.show}
        onClose={() => setCancelModal({ show: false, bookingId: null, type: '' })}
        onSubmit={submitCancellation}
        type={cancelModal.type}
        processing={processingCancel}
      />
    </div>
  );
};

export default BookingsList;
