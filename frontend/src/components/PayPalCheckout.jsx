import React, { useContext } from 'react';
import { PayPalScriptProvider, PayPalButtons } from '@paypal/react-paypal-js';
import axios from 'axios';
import { toast } from 'sonner';
import { API, AuthContext } from '../App';

const PAYPAL_CLIENT_ID = process.env.REACT_APP_PAYPAL_CLIENT_ID;

/**
 * Reusable PayPal Smart Buttons.
 *
 * Props:
 *  - productType: 'document_service' | 'sublease_booking'
 *  - metadata:    object (forwarded to backend; server computes authoritative amount)
 *  - currency:    'USD' | 'ILS' — must match what the server will compute; only
 *                 controls which PayPal script variant is loaded.
 *  - disabled:    boolean — greys out the buttons
 *  - onCaptured:  (order) => void — called after successful capture
 */
const PayPalCheckout = ({ productType, metadata, currency = 'USD', disabled, onCaptured }) => {
  const { token } = useContext(AuthContext);

  if (!PAYPAL_CLIENT_ID) {
    return (
      <div className="p-4 rounded-lg bg-yellow-50 border border-yellow-200 text-sm text-yellow-800" data-testid="paypal-missing-config">
        PayPal Client ID is not configured. Set <code>REACT_APP_PAYPAL_CLIENT_ID</code> in your frontend env.
      </div>
    );
  }

  const auth = { headers: { Authorization: `Bearer ${token}` } };

  return (
    <div className={disabled ? 'opacity-50 pointer-events-none' : ''} data-testid="paypal-buttons-wrapper">
      <PayPalScriptProvider options={{ clientId: PAYPAL_CLIENT_ID, currency, intent: 'capture' }}>
        <PayPalButtons
          style={{ layout: 'vertical', color: 'gold', shape: 'rect', label: 'paypal' }}
          createOrder={async () => {
            try {
              const res = await axios.post(
                `${API}/payments/orders`,
                { product_type: productType, metadata },
                auth,
              );
              return res.data.paypal_order_id;
            } catch (e) {
              toast.error(e.response?.data?.detail || 'Unable to start PayPal checkout');
              throw e;
            }
          }}
          onApprove={async (data) => {
            try {
              // find our internal order id by paypal_order_id via a round-trip:
              // since createOrder stored both, we can look it up via GET /payments/my
              // but it's faster to capture directly by searching our DB row.
              // Here we just call /capture with our internal id (fetched via /my).
              const myOrders = await axios.get(`${API}/payments/my`, auth);
              const match = (myOrders.data || []).find(o => o.paypal_order_id === data.orderID);
              if (!match) throw new Error('Order not found in our system');
              const res = await axios.post(`${API}/payments/orders/${match.id}/capture`, {}, auth);
              if (res.data?.status === 'captured') {
                toast.success('Payment captured successfully');
                onCaptured && onCaptured(res.data.order);
              } else {
                toast.error('Payment did not complete');
              }
            } catch (e) {
              toast.error(e.response?.data?.detail || e.message || 'Capture failed');
            }
          }}
          onError={(err) => {
            // eslint-disable-next-line no-console
            console.error('PayPal error', err);
            toast.error('PayPal reported an error. Please try again.');
          }}
          onCancel={() => {
            toast('Checkout cancelled', { description: 'No charge was made.' });
          }}
        />
      </PayPalScriptProvider>
    </div>
  );
};

export default PayPalCheckout;
