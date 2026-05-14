import React from 'react';

const AcceptBookingModal = ({ isOpen, onConfirm, onCancel }) => {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-[70]" onClick={onCancel}>
      <div className="bg-white rounded-2xl p-6 max-w-md w-full mx-4" onClick={(e) => e.stopPropagation()}>
        <h3 className="text-xl font-bold mb-4 text-[#1E6A6A]">Accept Booking Request</h3>
        
        <p className="text-gray-600 mb-6">
          Are you sure you want to accept this booking request? The dates will be reserved and the renter will be notified.
        </p>
        
        <div className="flex gap-3">
          <button
            onClick={onConfirm}
            className="flex-1 px-4 py-3 rounded-lg text-sm font-medium bg-[#1E6A6A] text-white hover:bg-[#1E6A6A]/90 transition-colors"
          >
            Accept Booking
          </button>
          <button
            onClick={onCancel}
            className="px-4 py-3 rounded-lg text-sm font-medium border border-gray-300 hover:bg-gray-50 transition-colors"
          >
            Cancel
          </button>
        </div>
      </div>
    </div>
  );
};

export default AcceptBookingModal;
