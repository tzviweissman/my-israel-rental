/**
 * /orders/owner/:token — the business's one-order page, opened from the
 * new-order text (backend routes/marketplace/order_texts.py).
 *
 * Tzvi, 2 Nov 2026: no sign-in for each order. Everything the owner needs
 * is on one screen, with Confirm and Decline; on Confirm the customer and
 * the business each get a text with the order number and their link.
 * The order is in the dashboard as well, as every order is.
 */
import React, { useCallback, useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import axios from 'axios';
import { Loader2, ClipboardList, Check, X, Bike, Store as StoreIcon, Clock, MapPin, Phone, Mail } from 'lucide-react';
import { API } from '../lib/apiBase';
import { money } from '../utils/currency';

export default function OwnerOrderPage() {
  const { token } = useParams();
  const { t, i18n } = useTranslation();
  const [data, setData] = useState(null);
  const [busy, setBusy] = useState('');
  const [askDecline, setAskDecline] = useState(false);
  const [err, setErr] = useState('');

  useEffect(() => {
    document.body.classList.add('orders-bare');
    return () => document.body.classList.remove('orders-bare');
  }, []);

  const url = `${API}/marketplace/orders/owner/${encodeURIComponent(token)}`;
  const load = useCallback(async () => {
    try {
      const { data: d } = await axios.get(url);
      setData(d);
    } catch (e) {
      if (e?.response?.status === 404) setData(false);
    }
  }, [url]);
  useEffect(() => { load(); }, [load]);

  const decide = async (what) => {
    setBusy(what);
    setErr('');
    try {
      const { data: d } = await axios.post(`${url}/${what}`);
      setData(d);
      setAskDecline(false);
    } catch {
      setErr(t('ownerOrder.failed', 'That did not go through. Please tap again.'));
    } finally {
      setBusy('');
    }
  };

  const lang = String(i18n.language || 'en').split('-')[0];
  if (data === null) return <div className="py-24 text-center" style={{ color: 'var(--brand-muted)' }}><Loader2 className="animate-spin inline" size={20} /></div>;
  if (data === false) {
    return (
      <div className="max-w-md mx-auto px-4 py-24 text-center" data-testid="owner-order-bad-link">
        <ClipboardList size={26} className="inline mb-3" style={{ color: 'var(--brand-muted)' }} />
        <h1 className="text-lg font-bold" style={{ color: 'var(--ink)', fontFamily: 'var(--font-head)' }}>{t('orders.track.badLinkTitle', 'This link no longer works')}</h1>
        <p className="text-sm mt-2" style={{ color: 'var(--brand-muted)' }}>{t('ownerOrder.badLinkBody', 'Open the order from your dashboard instead.')}</p>
      </div>
    );
  }

  const bizName = (lang === 'he' && data.business?.name_he) || data.business?.name || '';
  const delivery = data.fulfilment === 'delivery';
  const nb = data.needed_by || '';
  const when = nb ? new Intl.DateTimeFormat(lang === 'he' ? 'he-IL' : 'en-GB', { weekday: 'long', day: 'numeric', month: 'long', ...(nb.includes('T') ? { hour: '2-digit', minute: '2-digit' } : {}) }).format(new Date(nb.includes('T') ? nb : `${nb}T00:00`)) : '';
  const isNew = data.status === 'new';
  const btn = 'flex items-center justify-center gap-2 w-full min-h-[52px] rounded-full text-base font-semibold disabled:opacity-60';

  return (
    <div className="min-h-screen" style={{ background: 'var(--bg)' }} data-testid="owner-order-page" data-status={data.status}>
      <main className="max-w-md mx-auto px-4 py-8">
        <div className="flex items-center gap-3 mb-6">
          {data.business?.logo_url && <img src={data.business.logo_url} alt="" className="w-11 h-11 rounded-xl object-cover" />}
          <div className="min-w-0">
            <p className="text-[11px] uppercase tracking-wide" style={{ color: 'var(--brand-muted)' }}>{bizName}</p>
            <h1 className="text-lg font-bold" style={{ color: 'var(--ink)', fontFamily: 'var(--font-head)' }}>
              {t('ownerOrder.title', 'Order {{no}}', { no: data.order_no })}
            </h1>
          </div>
        </div>

        {!isNew && (
          <p className="rounded-2xl border p-4 mb-3 text-base font-semibold flex items-center gap-2" role="status" data-testid="owner-order-state"
             style={data.status === 'cancelled'
               ? { borderColor: 'var(--brand-border)', background: 'var(--surface-muted)', color: 'var(--ink)' }
               : { borderColor: 'var(--status-open)', background: 'var(--status-open-bg)', color: 'var(--status-open)' }}>
            {data.status === 'cancelled' ? <X size={18} aria-hidden="true" /> : <Check size={18} aria-hidden="true" />}
            {data.status === 'cancelled'
              ? t('ownerOrder.declined', 'Declined. The customer was told.')
              : data.status === 'preparing'
                ? t('ownerOrder.confirmed', 'Confirmed. The customer has their order number and tracking link.')
                : t(`orders.status.${data.status}`, data.status)}
          </p>
        )}

        <section className="rounded-2xl border bg-white p-4 text-sm space-y-2" style={{ borderColor: 'var(--brand-border)' }}>
          <p className="text-base font-semibold" dir="auto" style={{ color: 'var(--ink)' }}>{data.customer_name}</p>
          {data.customer_phone && (
            <a href={`tel:${data.customer_phone}`} className="flex items-center gap-2 underline" style={{ color: 'var(--gold-text-on-light)' }}>
              <Phone size={14} aria-hidden="true" /> <span dir="ltr">{data.customer_phone}</span>
            </a>
          )}
          {data.customer_email && (
            <a href={`mailto:${data.customer_email}`} className="flex items-center gap-2 underline break-all" style={{ color: 'var(--gold-text-on-light)' }}>
              <Mail size={14} aria-hidden="true" /> {data.customer_email}
            </a>
          )}
          {when && <p className="flex items-center gap-2 pt-1 border-t" style={{ color: 'var(--ink)', borderColor: 'var(--brand-border)' }}><Clock size={14} /> {when}</p>}
          <p className="flex items-center gap-2" style={{ color: 'var(--ink)' }}>
            {delivery ? <Bike size={14} /> : <StoreIcon size={14} />}
            {data.table ? t('tableOrder.table', 'Table {{n}}', { n: data.table }) : delivery ? t('orders.delivery', 'Delivery') : t('ownerOrder.pickup', 'Pickup')}
          </p>
          {delivery && data.address && <p className="flex items-start gap-2" dir="auto" style={{ color: 'var(--ink)' }}><MapPin size={14} className="mt-0.5 shrink-0" /> <span>{data.address}</span></p>}
          <p className="whitespace-pre-line pt-1 border-t" dir="auto" style={{ color: 'var(--ink)', borderColor: 'var(--brand-border)' }}>{data.items}</p>
          {data.notes && <p className="whitespace-pre-line" dir="auto" style={{ color: 'var(--brand-muted)' }}>{data.notes}</p>}
          {data.total != null && (
            <p className="font-semibold" style={{ color: 'var(--ink)' }}>{t('orders.track.total', 'Total: {{n}}', { n: money(data.total, data.currency) })}</p>
          )}
        </section>

        {isNew && !askDecline && (
          <div className="mt-4 space-y-3">
            <button type="button" className={btn} onClick={() => decide('confirm')} disabled={!!busy}
                    style={{ background: 'var(--action)', color: 'var(--action-ink)' }} data-testid="owner-order-confirm">
              {busy === 'confirm' ? <Loader2 size={18} className="animate-spin" /> : <Check size={18} aria-hidden="true" />}
              {t('ownerOrder.confirm', 'Confirm order')}
            </button>
            <button type="button" className={`${btn} border`} onClick={() => setAskDecline(true)} disabled={!!busy}
                    style={{ borderColor: 'var(--brand-border)', background: 'white', color: 'var(--ink)' }} data-testid="owner-order-decline">
              <X size={18} aria-hidden="true" /> {t('ownerOrder.decline', 'Decline')}
            </button>
          </div>
        )}
        {isNew && askDecline && (
          <div className="mt-4 rounded-2xl border bg-white p-4 space-y-3" style={{ borderColor: 'var(--brand-border)' }} data-testid="owner-order-decline-ask">
            <p className="text-sm font-semibold" style={{ color: 'var(--ink)' }}>{t('ownerOrder.declineAsk', 'Decline this order? The customer gets a text saying you can\'t take it.')}</p>
            <button type="button" className={btn} onClick={() => decide('decline')} disabled={!!busy}
                    style={{ background: 'var(--action)', color: 'var(--action-ink)' }} data-testid="owner-order-decline-yes">
              {busy === 'decline' && <Loader2 size={18} className="animate-spin" />}
              {t('ownerOrder.declineYes', 'Yes, decline')}
            </button>
            <button type="button" className="w-full min-h-[44px] text-sm underline" onClick={() => setAskDecline(false)} style={{ color: 'var(--brand-muted)' }}>
              {t('ownerOrder.keep', 'Keep it')}
            </button>
          </div>
        )}
        {err && <p className="text-sm mt-3" role="alert" style={{ color: 'var(--ink)' }}>{err}</p>}

        <p className="text-[11px] mt-6 text-center" style={{ color: 'var(--brand-muted)' }}>
          {t('ownerOrder.footer', 'This order is also in your dashboard.')}
        </p>
      </main>
    </div>
  );
}
