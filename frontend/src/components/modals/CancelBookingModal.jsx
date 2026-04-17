import React, { useState } from 'react';

const CancelBookingModal = ({ 
  isOpen, 
  onClose, 
  onSubmit, 
  type, // 'cancel', 'request', 'deny'
  processing 
}) => {
  const [cancelReason, setCancelReason] = useState('');
  const [customCancelReason, setCustomCancelReason] = useState('');

  const handleSubmit = () => {
    const reason = cancelReason === 'other' ? customCancelReason : cancelReason;
    onSubmit(reason);
  };

  const handleClose = () => {
    setCancelReason('');
    setCustomCancelReason('');
    onClose();
  };

  if (!isOpen) return null;

  const getTitle = () => {
    switch(type) {
      case 'cancel': return 'Cancel Booking';
      case 'request': return 'Request Cancellation';
      case 'deny': return 'Deny Cancellation Request';
      default: return 'Cancel Booking';
    }
  };

  const getButtonText = () => {
    switch(type) {
      case 'cancel': return 'Cancel Booking';
      case 'request': return 'Request Cancellation';
      case 'deny': return 'Deny Request';
      default: return 'Submit';
    }
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50" onClick={handleClose}>
      <div className="bg-white rounded-2xl p-6 max-w-md w-full mx-4" onClick={(e) => e.stopPropagation()}>
        <h3 className="text-xl font-bold mb-4">{getTitle()}</h3>
        
        <div className="mb-6">
          <label className="block text-sm font-medium mb-2">
            {type === 'deny' ? 'Reason for denial:' : 'Cancellation reason:'}
          </label>
          <select
            value={cancelReason}
            onChange={(e) => setCancelReason(e.target.value)}
            className="w-full px-4 py-2 rounded-lg border border-gray-300 focus:outline-none focus:ring-2 focus:ring-[#1E6A6A]/50 mb-3"
          >
            <option value="">Select a reason</option>
            <option value="change_of_plans">Change of plans</option>
            <option value="found_better_option">Found a better option</option>
            <option value="property_issues">Property issues</option>
            <option value="scheduling_conflict">Scheduling conflict</option>
            <option value="financial_reasons">Financial reasons</option>
            <option value="other">Other</option>
          </select>

          {cancelReason === 'other' && (
            <textarea
              value={customCancelReason}
              onChange={(e) => setCustomCancelReason(e.target.value)}
              placeholder="Please specify the reason..."
              rows={3}
              className="w-full px-4 py-2 rounded-lg border border-gray-300 focus:outline-none focus:ring-2 focus:ring-[#1E6A6A]/50"
            />
          )}
        </div>

        <div className="flex gap-3">
          <button
            onClick={handleSubmit}
            disabled={processing || !cancelReason || (cancelReason === 'other' && !customCancelReason)}
            className="flex-1 px-4 py-3 rounded-lg text-sm font-medium bg-red-500 text-white hover:bg-red-600 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          >
            {processing ? 'Processing...' : getButtonText()}
          </button>
          <button
            onClick={handleClose}
            disabled={processing}
            className="px-4 py-3 rounded-lg text-sm font-medium border border-gray-300 hover:bg-gray-50 transition-colors"
          >
            Cancel
          </button>
        </div>
      </div>
    </div>
  );
};

export default CancelBookingModal;
