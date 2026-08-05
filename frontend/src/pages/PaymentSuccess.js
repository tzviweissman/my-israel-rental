import React, { useContext, useEffect, useState } from 'react';
import { useSearchParams, useNavigate, Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import axios from 'axios';
import { CheckCircle2, Loader2, ArrowRight, ArrowLeft, Receipt, MessageCircle } from 'lucide-react';
import { API, AuthContext } from '../App';
import { SERVICE_BY_KEY } from '../lib/documentServices';

// Same number the global floating WhatsAppButton uses.
const WHATSAPP_NUMBER = '972553225141';

function buildWhatsAppMessage(order) {
  const services = (order.metadata?.services || []).filter(s => SERVICE_BY_KEY[s]);
  if (!services.length) return '';
  const orderShort = order.id.slice(0, 8).toUpperCase();
  const lines = [
    `Hi! I just completed payment for my document filing services.`,
    `Order ID: ${orderShort}`,
    `Amount: $${Number(order.amount).toFixed(2)} ${order.currency}`,
    '',
    `Services purchased:`,
    ...services.map(s => `• ${SERVICE_BY_KEY[s].label}`),
    '',
    `Here are the details you need from me:`,
  ];
  services.forEach(s => {
    lines.push('');
    lines.push(`*${SERVICE_BY_KEY[s].label}*`);
    SERVICE_BY_KEY[s].items.forEach(item => {
      lines.push(`- ${item}: `);
    });
  });
  return lines.join('\n');
}

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
  const { t } = useTranslation();
  const [searchParams] = useSearchParams();
  const { token } = useContext(AuthContext);
  const navigate = useNavigate();
  const [order, setOrder] = useState(null);
  const [error, setError] = useState(null);
  const [loading, setLoading] = useState(true);

  const internalId = searchParams.get('orderId');
  const paypalToken = searchParams.get('token'); // PayPal order id when they redirect us
  const flow = searchParams.get('flow'); // e.g. 'marketplace-subscription'
  const [subState, setSubState] = useState(null); // {status, subscribed_until}

  useEffect(() => {
    let cancelled = false;
    const auth = { headers: { Authorization: `Bearer ${token}` } };

    // --- Marketplace subscription flow ---
    // PayPal redirects here after the provider approves the subscription.
    // We hit /marketplace/subscription/activate which re-fetches the
    // subscription from PayPal and flips the provider row to 'active'.
    if (flow === 'marketplace-subscription') {
      (async () => {
        try {
          const res = await axios.post(`${API}/marketplace/subscription/activate`, {}, auth);
          if (!cancelled) setSubState(res.data);
        } catch (e) {
          if (!cancelled) setError(e.response?.data?.detail || e.message || 'Activation failed');
        } finally {
          if (!cancelled) setLoading(false);
        }
      })();
      return () => { cancelled = true; };
    }

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
  }, [internalId, paypalToken, token, flow]);

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center" data-testid="payment-success-loading">
        <Loader2 size={32} className="animate-spin text-[var(--brand-primary)]" />
      </div>
    );
  }

  // --- Marketplace subscription success screen ---
  if (flow === 'marketplace-subscription') {
    return (
      <div className="min-h-screen bg-[#fafafa] pt-24 pb-16 px-4" data-testid="subscription-success-page">
        <div className="max-w-md mx-auto bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
          <div className="bg-gradient-to-br from-[var(--brand-primary)] to-[#155454] px-8 py-10 text-white text-center">
            <div className="w-16 h-16 bg-white/20 rounded-full flex items-center justify-center mx-auto mb-4">
              <CheckCircle2 size={36} />
            </div>
            <h1 className="text-2xl font-bold mb-1" style={{ fontFamily: 'Playfair Display' }}>
              {subState?.ok ? 'You\u2019re now Pro!' : 'Subscription pending'}
            </h1>
            <p className="text-white/80 text-sm">
              {subState?.ok
                ? 'Your MyIsraelRental Pro subscription is active.'
                : (subState?.message || 'PayPal is still processing your approval.')}
            </p>
          </div>
          <div className="p-8 space-y-4 text-sm">
            {subState?.subscribed_until && (
              <div className="flex justify-between border-b border-gray-100 pb-2.5">
                <dt className="text-gray-500">Next billing</dt>
                <dd className="text-gray-900 font-medium" data-testid="subscription-next-billing">
                  {new Date(subState.subscribed_until).toLocaleDateString()}
                </dd>
              </div>
            )}
            <p className="text-gray-600">
              Your Pro benefits are live now — publish unlimited gigs, appear in category browse, and get a Pro badge on your provider profile.
            </p>
            <button
              onClick={() => navigate('/dashboard?tab=my-gigs')}
              className="w-full mt-4 primary-btn flex items-center justify-center gap-2"
              data-testid="subscription-goto-my-gigs"
            >
              Go to My Gigs <ArrowRight size={16} />
            </button>
            {error && <p className="text-xs text-red-500 text-center">{error}</p>}
          </div>
        </div>
      </div>
    );
  }

  if (error || !order) {
    return (
      <div className="min-h-screen flex items-center justify-center px-6" data-testid="payment-success-error">
        <div className="max-w-md w-full bg-white rounded-2xl p-8 border border-red-100 text-center">
          <h1 className="text-xl font-bold text-red-600 mb-2">{t('paymentSuccess.couldNotLoad')}</h1>
          <p className="text-sm text-gray-500 mb-6">{error || t('common.loading')}</p>
          <button onClick={() => navigate('/dashboard')} className="primary-btn" data-testid="payment-success-back-dashboard">
            {t('paymentSuccess.viewDashboard')}
          </button>
        </div>
      </div>
    );
  }

  const currencySymbol = order.currency === 'ILS' ? '₪' : '$';
  const statusLabel = order.status === 'captured' ? 'Paid' : (order.status || 'Pending').replace(/_/g, ' ');

  // For Bituach Leumi orders show a 1-tap WhatsApp deeplink pre-filled with
  // the order id + per-service checklist so the customer can hand off the
  // info to us right away.
  const isDocumentService = order.product_type === 'document_service';
  const services = (order.metadata?.services || []).filter(s => SERVICE_BY_KEY[s]);
  const whatsappUrl = isDocumentService && services.length
    ? `https://wa.me/${WHATSAPP_NUMBER}?text=${encodeURIComponent(buildWhatsAppMessage(order))}`
    : null;

  return (
    <div className="min-h-screen bg-[#fafafa] pt-24 pb-16 px-4" data-testid="payment-success-page">
      <div className="max-w-xl mx-auto">
        <button
          type="button"
          onClick={() => navigate('/dashboard')}
          className="inline-flex items-center gap-1.5 text-sm font-medium text-gray-600 hover:text-[var(--brand-primary)] mb-4 transition-colors"
          data-testid="payment-success-back-link"
        >
          <ArrowLeft size={16} /> {t('paymentSuccess.viewDashboard')}
        </button>
        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
          <div className="bg-gradient-to-br from-[var(--brand-primary)] to-[#155454] px-8 py-10 text-white text-center">
            <div className="w-16 h-16 bg-white/20 rounded-full flex items-center justify-center mx-auto mb-4">
              <CheckCircle2 size={36} />
            </div>
            <h1 className="text-3xl font-bold mb-1" style={{ fontFamily: 'Playfair Display' }}>{t('paymentSuccess.title')}</h1>
            <p className="text-white/80 text-sm">{t('paymentSuccess.thankYou')}</p>
          </div>
          <div className="p-8">
            <h2 className="text-base font-semibold text-gray-700 mb-4 flex items-center gap-2">
              <Receipt size={18} className="text-[var(--gold)]" /> Order summary
            </h2>
            <dl className="space-y-3 text-sm">
              <div className="flex justify-between border-b border-gray-100 pb-2.5">
                <dt className="text-gray-500">Description</dt>
                <dd className="text-gray-900 font-medium text-right max-w-[60%]" data-testid="order-description">{order.description}</dd>
              </div>
              <div className="flex justify-between border-b border-gray-100 pb-2.5">
                <dt className="text-gray-500">{t('paymentSuccess.orderId')}</dt>
                <dd className="text-gray-900 font-mono text-xs" data-testid="order-id">{order.id.slice(0, 8).toUpperCase()}</dd>
              </div>
              <div className="flex justify-between border-b border-gray-100 pb-2.5">
                <dt className="text-gray-500">{t('paymentSuccess.paypalTxn')}</dt>
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
                  <dt className="text-gray-500">{t('paymentSuccess.paidAt')}</dt>
                  <dd className="text-gray-900" data-testid="order-captured-at">{new Date(order.captured_at).toLocaleString()}</dd>
                </div>
              )}
            </dl>

            <button
              onClick={() => navigate('/dashboard')}
              className="w-full mt-8 primary-btn flex items-center justify-center gap-2"
              data-testid="payment-success-dashboard-btn"
            >
              {t('paymentSuccess.viewDashboard')} <ArrowRight size={16} />
            </button>

            {whatsappUrl && (
              <div className="mt-6 rounded-2xl border border-[#25D366]/30 bg-gradient-to-br from-[#25D366]/5 to-emerald-50 p-5" data-testid="whatsapp-cta">
                <div className="flex items-start gap-3 mb-3">
                  <div className="w-10 h-10 rounded-xl bg-[#25D366] text-white flex items-center justify-center flex-shrink-0">
                    <MessageCircle size={20} />
                  </div>
                  <div>
                    <h3 className="text-sm font-bold text-gray-900">Next step — send us your details on WhatsApp</h3>
                    <p className="text-xs text-gray-600 mt-0.5">
                      Tap below — your order ID and a checklist will be pre-filled. Just fill in the values and hit send.
                    </p>
                  </div>
                </div>
                <a
                  href={whatsappUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="w-full flex items-center justify-center gap-2 px-4 py-3 rounded-xl bg-[#25D366] hover:bg-[#1fb558] text-white font-semibold text-sm transition-colors"
                  data-testid="whatsapp-handoff-btn"
                >
                  <MessageCircle size={18} />
                  Open WhatsApp with my checklist
                </a>
                <p className="text-[11px] text-gray-500 text-center mt-2.5">
                  We&apos;ve also emailed you the full checklist as a backup.
                </p>
              </div>
            )}

            <p className="text-center text-xs text-gray-400 mt-4">
              Need help? <Link to="/" className="text-[var(--brand-primary)] hover:underline">{t('paymentSuccess.contactUs')}</Link>
            </p>
          </div>
        </div>
      </div>
    </div>
  );
};

export default PaymentSuccess;
