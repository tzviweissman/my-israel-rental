import React, { useContext, useEffect, useState } from 'react';
import { useSearchParams, useNavigate, Link } from 'react-router-dom';
import axios from 'axios';
import { CheckCircle2, Loader2, ArrowRight, Receipt } from 'lucide-react';
import { API, AuthContext } from '../App';

/**
 * Shown after a PayPal redirect (return_url).
 *
 * Supports two landing modes:
 *   1. From our own PayPalButtons flow we already captured before redirecting.
 *      The URL has `?orderId=...` (our internal id) and status is 'captured'.
 *   2. Directly from PayPal after a redirect-based checkout. URL has `?token=...`
 *      which is the PayPal order id. We look it up and capture if needed.
 */
const PaymentSuccess = () => {
  const [searchParams] = useSearchParams();
  const { token } = useContext(AuthContext);
  const navigate = useNavigate();
  const [order, setOrder] = useState(null);
  const [error, setError] = useState(null);
  const [loading, setLoading] = useState(true);

  const internalId = searchParams.get('orderId');
  const paypalToken = searchParams.get('token'); // PayPal order id when they redirect us

  useEffect(() => {
    let cancelled = false;
    const auth = { headers: { Authorization: `Bearer ${token}` } };
    const load = async () => {
      try {
        let orderId = internalId;
        if (!orderId && paypalToken) {
          // Look up our internal id via /payments/my
          const mine = await axios.get(`${API}/payments/my`, auth);
          const match = (mine.data || []).find(o => o.paypal_order_id === paypalToken);
          if (!match) throw new Error('Order not found');
          orderId = match.id;
          // If the order hasn't been captured yet, try to capture now.
          if (match.status !== 'captured') {
            await axios.post(`${API}/payments/orders/${orderId}/capture`, {}, auth);
          }
        }
        if (!orderId) throw new Error('Missing order id');
        const res = await axios.get(`${API}/payments/orders/${orderId}`, auth);
        if (!cancelled) setOrder(res.data);
      } catch (e) {
        if (!cancelled) setError(e.response?.data?.detail || e.message || 'Failed to load order');
      } finally {
        if (!cancelled) setLoading(false);
      }
    };
    load();
    return () => { cancelled = true; };
  }, [internalId, paypalToken, token]);

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center" data-testid="payment-success-loading">
        <Loader2 size={32} className="animate-spin text-[#1E6A6A]" />
      </div>
    );
  }

  if (error || !order) {
    return (
      <div className="min-h-screen flex items-center justify-center px-6" data-testid="payment-success-error">
        <div className="max-w-md w-full bg-white rounded-2xl p-8 border border-red-100 text-center">
          <h1 className="text-xl font-bold text-red-600 mb-2">We couldn't load your order</h1>
          <p className="text-sm text-gray-500 mb-6">{error || 'Unknown error'}</p>
          <button onClick={() => navigate('/dashboard')} className="primary-btn" data-testid="payment-success-back-dashboard">
            Back to Dashboard
          </button>
        </div>
      </div>
    );
  }

  const currencySymbol = order.currency === 'ILS' ? '₪' : '$';
  const statusLabel = order.status === 'captured' ? 'Paid' : (order.status || 'Pending').replace(/_/g, ' ');

  return (
    <div className="min-h-screen bg-[#fafafa] pt-24 pb-16 px-4" data-testid="payment-success-page">
      <div className="max-w-xl mx-auto">
        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
          <div className="bg-gradient-to-br from-[#1E6A6A] to-[#155454] px-8 py-10 text-white text-center">
            <div className="w-16 h-16 bg-white/20 rounded-full flex items-center justify-center mx-auto mb-4">
              <CheckCircle2 size={36} />
            </div>
            <h1 className="text-3xl font-bold mb-1" style={{ fontFamily: 'Playfair Display' }}>Payment successful</h1>
            <p className="text-white/80 text-sm">Thank you — a receipt has been sent to your email.</p>
          </div>
          <div className="p-8">
            <h2 className="text-base font-semibold text-gray-700 mb-4 flex items-center gap-2">
              <Receipt size={18} className="text-[#D4AF37]" /> Order summary
            </h2>
            <dl className="space-y-3 text-sm">
              <div className="flex justify-between border-b border-gray-100 pb-2.5">
                <dt className="text-gray-500">Description</dt>
                <dd className="text-gray-900 font-medium text-right max-w-[60%]" data-testid="order-description">{order.description}</dd>
              </div>
              <div className="flex justify-between border-b border-gray-100 pb-2.5">
                <dt className="text-gray-500">Order ID</dt>
                <dd className="text-gray-900 font-mono text-xs" data-testid="order-id">{order.id.slice(0, 8).toUpperCase()}</dd>
              </div>
              <div className="flex justify-between border-b border-gray-100 pb-2.5">
                <dt className="text-gray-500">PayPal Transaction</dt>
                <dd className="text-gray-900 font-mono text-xs" data-testid="order-paypal-id">{order.paypal_order_id}</dd>
              </div>
              <div className="flex justify-between border-b border-gray-100 pb-2.5">
                <dt className="text-gray-500">Amount</dt>
                <dd className="text-gray-900 font-semibold" data-testid="order-amount">
                  {currencySymbol}{Number(order.amount).toFixed(2)} {order.currency}
                </dd>
              </div>
              <div className="flex justify-between border-b border-gray-100 pb-2.5">
                <dt className="text-gray-500">Status</dt>
                <dd>
                  <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-semibold bg-green-50 text-green-700" data-testid="order-status">
                    <CheckCircle2 size={12} /> {statusLabel}
                  </span>
                </dd>
              </div>
              {order.captured_at && (
                <div className="flex justify-between pb-2.5">
                  <dt className="text-gray-500">Paid at</dt>
                  <dd className="text-gray-900" data-testid="order-captured-at">{new Date(order.captured_at).toLocaleString()}</dd>
                </div>
              )}
            </dl>

            <button
              onClick={() => navigate('/dashboard')}
              className="w-full mt-8 primary-btn flex items-center justify-center gap-2"
              data-testid="payment-success-dashboard-btn"
            >
              Back to Dashboard <ArrowRight size={16} />
            </button>
            <p className="text-center text-xs text-gray-400 mt-4">
              Need help? <Link to="/" className="text-[#1E6A6A] hover:underline">Contact us</Link>
            </p>
          </div>
        </div>
      </div>
    </div>
  );
};

export default PaymentSuccess;
