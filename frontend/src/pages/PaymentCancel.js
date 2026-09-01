import React from 'react';
import { useNavigate } from 'react-router-dom';
import { XCircle } from 'lucide-react';

const PaymentCancel = () => {
  const navigate = useNavigate();
  return (
    <div className="min-h-screen flex items-center justify-center px-6" data-testid="payment-cancel-page">
      <div className="max-w-md w-full bg-white rounded-2xl p-8 border border-gray-100 text-center">
        <div className="w-14 h-14 bg-amber-50 rounded-full flex items-center justify-center mx-auto mb-4">
          <XCircle size={28} className="text-amber-500" />
        </div>
        <h1 className="text-2xl font-bold text-gray-900 mb-2" style={{ fontFamily: 'var(--font-head)' }}>Checkout cancelled</h1>
        <p className="text-sm text-gray-500 mb-6">
          No charge was made. You can restart the checkout whenever you're ready.
        </p>
        <button onClick={() => navigate('/dashboard')} className="primary-btn" data-testid="payment-cancel-back-btn">
          Back to Dashboard
        </button>
      </div>
    </div>
  );
};

export default PaymentCancel;
