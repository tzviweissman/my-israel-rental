/**
 * Customers → "Request a payment" (backend routes/marketplace/payment_requests.py).
 * Amount, what it is for, who it is to; then a link to send on WhatsApp, by
 * text or copied anywhere. The customer pays with the business's own payment
 * links and presses "I have paid"; the business marks it paid here once the
 * money is in. We never touch the money.
 */
import React, { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import axios from 'axios';
import { toast } from 'sonner';
import { Check, Copy, Loader2, MessageCircle, X } from 'lucide-react';

const field = 'w-full px-3 py-2 rounded-lg border text-sm bg-white min-h-[44px]';
const fieldStyle = { borderColor: 'var(--brand-border)', color: 'var(--ink)' };
const fmt = (n) => `₪${Number(n).toLocaleString('en-US', { maximumFractionDigits: 2 })}`;

export default function PaymentRequestsPanel({ API, auth, businessId, onClose }) {
  const { t, i18n } = useTranslation();
  const [list, setList] = useState(null);
  const [form, setForm] = useState({ amount: '', description: '', customer_name: '', customer_phone: '', customer_email: '',
    lang: String(i18n.language || '').startsWith('he') ? 'he' : 'en' });
  const [busy, setBusy] = useState(false);
  const [made, setMade] = useState(null);
  const base = `${API}/marketplace/businesses/${businessId}/payment-requests`;

  const load = () => axios.get(base, auth).then(({ data }) => setList(data)).catch(() => setList(false));
  useEffect(() => { load(); }, [base]); // eslint-disable-line react-hooks/exhaustive-deps

  const set = (k) => (e) => setForm({ ...form, [k]: e.target.value });
  const ready = Number(form.amount) > 0 && form.description.trim().length >= 2;
  const create = async (e) => {
    e.preventDefault();
    setBusy(true);
    try {
      const { data } = await axios.post(base, { ...form, amount: Number(form.amount) }, auth);
      setMade(data);
      setForm({ ...form, amount: '', description: '', customer_name: '', customer_phone: '', customer_email: '' });
      load();
    } catch (err) {
      toast.error(err?.response?.data?.detail || t('payReq.failed', 'Something went wrong. Try again.'));
    } finally { setBusy(false); }
  };
  const setStatus = async (r, status) => {
    try { await axios.post(`${base}/${r.id}/status`, { status }, auth); load(); } catch { toast.error(t('payReq.failed', 'Something went wrong. Try again.')); }
  };
  const copy = async (text) => {
    try { await navigator.clipboard.writeText(text); toast.success(t('payReq.copied', 'Copied')); } catch { toast.error(text); }
  };
  const wa = (r) => `https://wa.me/${r.whatsapp_to || ''}?text=${encodeURIComponent(r.message)}`;
  const sms = (r) => `sms:${r.customer_phone || ''}?&body=${encodeURIComponent(r.message)}`;
  const mail = (r) => `mailto:${r.customer_email || ''}?subject=${encodeURIComponent(t('payReq.mailSubject', 'Payment request'))}&body=${encodeURIComponent(r.message)}`;

  const statusLabel = {
    open: t('payReq.st.open', 'Sent'),
    customer_paid: t('payReq.st.customerPaid', 'Customer says paid, check it came in'),
    paid: t('payReq.st.paid', 'Paid'),
    cancelled: t('payReq.st.cancelled', 'Withdrawn'),
  };
  const statusColor = { open: 'var(--brand-muted)', customer_paid: '#B45309', paid: 'var(--status-open)', cancelled: 'var(--brand-muted)' };
  const sendRow = (r) => (
    <div className="flex flex-wrap gap-2">
      <a href={wa(r)} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1.5 px-4 min-h-[44px] rounded-full text-sm font-semibold"
         style={{ background: 'var(--action)', color: 'var(--action-ink)' }} data-testid="payreq-whatsapp">
        <MessageCircle size={15} /> {t('payReq.sendWhatsApp', 'Send on WhatsApp')}
      </a>
      {r.customer_phone && <a href={sms(r)} className="inline-flex items-center px-4 min-h-[44px] rounded-full border text-sm font-semibold" style={fieldStyle}>{t('payReq.sendSms', 'Text message')}</a>}
      {r.customer_email && <a href={mail(r)} className="inline-flex items-center px-4 min-h-[44px] rounded-full border text-sm font-semibold" style={fieldStyle}>{t('payReq.sendEmail', 'Email')}</a>}
      <button type="button" onClick={() => copy(r.message)} className="inline-flex items-center gap-1.5 px-4 min-h-[44px] rounded-full border text-sm font-semibold" style={fieldStyle}>
        <Copy size={14} /> {t('payReq.copyMessage', 'Copy the message')}
      </button>
    </div>
  );

  return (
    <section className="rounded-2xl border bg-white p-4 mb-4 space-y-3" style={{ borderColor: 'var(--brand-border)' }} data-testid="payreq-panel">
      <div className="flex items-center justify-between gap-2">
        <h3 className="text-base font-semibold" style={{ color: 'var(--ink)' }}>{t('payReq.title', 'Request a payment')}</h3>
        <button type="button" className="grid place-content-center w-11 h-11" aria-label={t('customers.close', 'Close')} onClick={onClose}><X size={18} /></button>
      </div>
      <p className="text-sm" style={{ color: 'var(--brand-muted)' }}>
        {t('payReq.body', 'Send a customer a link with the amount and your payment options (Bit, PayBox and the others on your page). They pay you directly and tell you when they have; you mark it paid once it comes in.')}
      </p>

      {list === null ? (
        <div className="py-4"><Loader2 size={16} className="animate-spin" /></div>
      ) : list && !list.can_take_payment ? (
        <p className="text-sm rounded-lg px-3 py-2" style={{ background: 'rgba(36,175,235,.12)', color: 'var(--ink)' }} data-testid="payreq-no-links">
          {t('payReq.needLinks', 'First add a payment link (Bit, PayBox, Grow...) or a payment note in your business details, under "Business details", so customers have a way to pay.')}
        </p>
      ) : made ? (
        <div className="rounded-xl p-3 space-y-2" style={{ background: '#F9FAFB' }} data-testid="payreq-made">
          <p className="text-sm font-semibold flex items-center gap-1.5" style={{ color: 'var(--status-open)' }}><Check size={16} /> {t('payReq.ready', 'Ready to send')}</p>
          <p className="text-sm whitespace-pre-line" style={{ color: 'var(--ink)' }} dir="auto">{made.message}</p>
          {sendRow(made)}
          <button type="button" onClick={() => setMade(null)} className="text-sm font-semibold underline underline-offset-4 min-h-[44px]" style={{ color: 'var(--gold)' }}>
            {t('payReq.another', 'Request another payment')}
          </button>
        </div>
      ) : (
        <form onSubmit={create} className="grid gap-2 sm:grid-cols-2">
          <label className="text-sm" style={{ color: 'var(--ink)' }}>{t('payReq.amount', 'Amount (₪)')}
            <input type="number" inputMode="decimal" min="1" step="0.01" value={form.amount} onChange={set('amount')} className={`${field} mt-1`} style={fieldStyle} required data-testid="payreq-amount" />
          </label>
          <label className="text-sm" style={{ color: 'var(--ink)' }}>{t('payReq.forWhat', 'What it is for')}
            <input value={form.description} maxLength={160} onChange={set('description')} className={`${field} mt-1`} style={fieldStyle} dir="auto" required
                   placeholder={t('payReq.forPh', 'Deep clean, 3 rooms')} data-testid="payreq-description" />
          </label>
          <label className="text-sm" style={{ color: 'var(--ink)' }}>{t('payReq.name', 'Customer name (optional)')}
            <input value={form.customer_name} maxLength={80} onChange={set('customer_name')} className={`${field} mt-1`} style={fieldStyle} dir="auto" />
          </label>
          <label className="text-sm" style={{ color: 'var(--ink)' }}>{t('payReq.phone', 'Their phone, for WhatsApp (optional)')}
            <input type="tel" value={form.customer_phone} maxLength={30} onChange={set('customer_phone')} className={`${field} mt-1`} style={fieldStyle} dir="ltr" />
          </label>
          <label className="text-sm" style={{ color: 'var(--ink)' }}>{t('payReq.email', 'Their email (optional)')}
            <input type="email" value={form.customer_email} maxLength={120} onChange={set('customer_email')} className={`${field} mt-1`} style={fieldStyle} dir="ltr" />
          </label>
          <label className="text-sm" style={{ color: 'var(--ink)' }}>{t('payReq.lang', 'Message and page in')}
            <select value={form.lang} onChange={set('lang')} className={`${field} mt-1`} style={fieldStyle}>
              <option value="he">עברית</option>
              <option value="en">English</option>
            </select>
          </label>
          <div className="sm:col-span-2">
            <button type="submit" disabled={!ready || busy} className="inline-flex items-center gap-1.5 px-5 min-h-[44px] rounded-full text-sm font-semibold disabled:opacity-50"
                    style={{ background: 'var(--action)', color: 'var(--action-ink)' }} data-testid="payreq-create">
              {busy && <Loader2 size={14} className="animate-spin" />} {t('payReq.create', 'Make the payment link')}
            </button>
          </div>
        </form>
      )}

      {list && list.requests.length > 0 && (
        <div className="pt-2 border-t" style={{ borderColor: 'var(--brand-border)' }}>
          <p className="text-sm font-semibold mb-1" style={{ color: 'var(--ink)' }}>{t('payReq.recent', 'Recent requests')}</p>
          <ul className="divide-y" style={{ borderColor: 'var(--brand-border)' }}>
            {list.requests.map((r) => (
              <li key={r.id} className="py-2 flex flex-wrap items-center justify-between gap-2" data-testid="payreq-row">
                <div className="min-w-0">
                  <p className="text-sm" style={{ color: 'var(--ink)' }} dir="auto">
                    <b><bdi>{fmt(r.amount)}</bdi></b> · {r.description}{r.customer_name ? ` · ${r.customer_name}` : ''}
                  </p>
                  <p className="text-xs font-semibold" style={{ color: statusColor[r.status] }}>{statusLabel[r.status]}</p>
                </div>
                <div className="flex flex-wrap gap-1.5">
                  {(r.status === 'open' || r.status === 'customer_paid') && (
                    <button type="button" onClick={() => setStatus(r, 'paid')} className="px-3 min-h-[36px] rounded-full border text-xs font-semibold" style={fieldStyle} data-testid="payreq-mark-paid">
                      {t('payReq.markPaid', 'Mark paid')}
                    </button>
                  )}
                  {r.status === 'open' && (
                    <>
                      <button type="button" onClick={() => setMade(r)} className="px-3 min-h-[36px] rounded-full border text-xs font-semibold" style={fieldStyle}>{t('payReq.sendAgain', 'Send again')}</button>
                      <button type="button" onClick={() => setStatus(r, 'cancelled')} className="px-3 min-h-[36px] rounded-full border text-xs font-semibold" style={fieldStyle}>{t('payReq.withdraw', 'Withdraw')}</button>
                    </>
                  )}
                  {(r.status === 'paid' || r.status === 'cancelled') && (
                    <button type="button" onClick={() => setStatus(r, 'open')} className="px-3 min-h-[36px] text-xs font-semibold underline" style={{ color: 'var(--brand-muted)' }}>{t('payReq.undo', 'Undo')}</button>
                  )}
                </div>
              </li>
            ))}
          </ul>
        </div>
      )}
    </section>
  );
}
