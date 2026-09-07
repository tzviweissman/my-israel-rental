/**
 * /orders/track/:token — the customer's status link (spec O7).
 *
 * Sent once by the store in the chat or WhatsApp thread. Shows the step
 * the order is at — Preparing → Ready → Out for delivery → Delivered
 * (or Ready to collect → Collected for a pickup) — with what was
 * ordered and when it is needed. It makes a one-person bakery look like
 * it has a system, and it cuts the "where's my order?" messages that are
 * most of a Friday's inbound.
 *
 * For a delivery it also carries the line the spec requires: the
 * delivery person will see your number to reach you. No login, no site
 * chrome, refreshes itself while open.
 */
import React, { useCallback, useEffect, useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import axios from 'axios';
import { Loader2, ClipboardList, Check, Bike, Store as StoreIcon, Clock, MapPin } from 'lucide-react';
import { API } from '../lib/apiBase';

const REFRESH_MS = 30_000;

export default function OrderTrackPage() {
  const { token } = useParams();
  const { t, i18n } = useTranslation();
  const [data, setData] = useState(null);

  useEffect(() => {
    document.body.classList.add('orders-bare');
    return () => document.body.classList.remove('orders-bare');
  }, []);

  const load = useCallback(async () => {
    try {
      const { data: d } = await axios.get(`${API}/marketplace/orders/track/${encodeURIComponent(token)}`);
      setData(d);
    } catch (err) {
      if (err?.response?.status === 404) setData(false);
    }
  }, [token]);

  useEffect(() => { load(); }, [load]);
  useEffect(() => {
    const id = setInterval(() => { if (!document.hidden) load(); }, REFRESH_MS);
    return () => clearInterval(id);
  }, [load]);

  const lang = String(i18n.language || 'en').split('-')[0];

  if (data === null) return <div className="py-24 text-center" style={{ color: 'var(--brand-muted)' }}><Loader2 className="animate-spin inline" size={20} /></div>;
  if (data === false) {
    return (
      <div className="max-w-md mx-auto px-4 py-24 text-center" data-testid="track-bad-link">
        <ClipboardList size={26} className="inline mb-3" style={{ color: 'var(--brand-muted)' }} />
        <h1 className="text-lg font-bold" style={{ color: 'var(--ink)', fontFamily: 'var(--font-head)' }}>{t('orders.track.badLinkTitle', 'This link no longer works')}</h1>
        <p className="text-sm mt-2" style={{ color: 'var(--brand-muted)' }}>{t('orders.track.badLinkBody', 'Ask the store to send it again.')}</p>
      </div>
    );
  }

  const bizName = (lang === 'he' && data.business?.name_he) || data.business?.name || '';
  const delivery = data.fulfilment === 'delivery';
  const steps = delivery
    ? [['preparing', t('orders.track.preparing', 'Preparing')], ['ready', t('orders.track.outForDelivery', 'Out for delivery')], ['done', t('orders.track.delivered', 'Delivered')]]
    : [['preparing', t('orders.track.preparing', 'Preparing')], ['ready', t('orders.track.readyToCollect', 'Ready to collect')], ['done', t('orders.track.collected', 'Collected')]];
  const rank = { new: 0, preparing: 1, ready: 2, done: 3 };
  const current = rank[data.status] ?? -1;
  const closedBad = data.status === 'cancelled' || data.status === 'failed';
  const nb = data.needed_by || '';
  const when = nb ? new Intl.DateTimeFormat(lang === 'he' ? 'he-IL' : 'en-GB', { weekday: 'long', day: 'numeric', month: 'long', ...(nb.includes('T') ? { hour: '2-digit', minute: '2-digit' } : {}) }).format(new Date(nb.includes('T') ? nb : `${nb}T00:00`)) : '';

  return (
    <div className="min-h-screen" style={{ background: 'var(--bg)' }} data-testid="track-page" data-status={data.status}>
      <main className="max-w-md mx-auto px-4 py-8">
        <div className="flex items-center gap-3 mb-6">
          {data.business?.logo_url && <img src={data.business.logo_url} alt="" className="w-11 h-11 rounded-xl object-cover" />}
          <div className="min-w-0">
            <p className="text-[11px] uppercase tracking-wide" style={{ color: 'var(--brand-muted)' }}>{t('orders.track.yourOrderFrom', 'Your order from')}</p>
            <h1 className="text-lg font-bold truncate" style={{ color: 'var(--ink)', fontFamily: 'var(--font-head)' }}>
              {data.business?.slug ? <Link to={`/business/${data.business.slug}`}>{bizName}</Link> : bizName}
            </h1>
          </div>
        </div>

        <section className="rounded-2xl border bg-white p-4" style={{ borderColor: 'var(--brand-border)' }}>
          {closedBad ? (
            <p className="text-base font-semibold" style={{ color: 'var(--ink)' }} data-testid="track-closed">
              {data.status === 'cancelled'
                ? t('orders.track.cancelled', 'This order was cancelled. If that is a surprise, get in touch with the store.')
                : t('orders.track.failed', "We couldn't deliver this one. The store will be in touch to sort it out.")}
            </p>
          ) : (
            <ol className="space-y-3" data-testid="track-steps">
              {steps.map(([key, label], i) => {
                const idx = i + 1;
                const done = current > idx;
                const now = current === idx;
                return (
                  <li key={key} className="flex items-center gap-3" data-step={key} data-state={done ? 'done' : now ? 'now' : 'todo'}>
                    <span
                      className="grid place-content-center w-8 h-8 rounded-full shrink-0 text-sm font-bold"
                      style={done
                        ? { background: 'var(--status-open-bg)', color: 'var(--status-open)' }
                        : now
                          ? { background: 'var(--ink)', color: 'var(--action-ink)' }
                          : { background: 'var(--surface-muted)', color: 'var(--brand-muted)' }}
                      aria-hidden="true"
                    >
                      {done ? <Check size={16} /> : idx}
                    </span>
                    <span className={`text-base ${now || done ? 'font-semibold' : ''}`} style={{ color: now || done ? 'var(--ink)' : 'var(--brand-muted)' }}>
                      {label}
                      {now && key === 'ready' && delivery && !data.out_for_delivery && (
                        <span className="block text-xs font-normal" style={{ color: 'var(--brand-muted)' }}>{t('orders.track.readyWaitingCourier', 'Packed and waiting for the courier')}</span>
                      )}
                    </span>
                  </li>
                );
              })}
            </ol>
          )}
          {current === 0 && !closedBad && (
            <p className="text-xs mt-3" style={{ color: 'var(--brand-muted)' }}>{t('orders.track.received', 'The store has your order and will start on it soon.')}</p>
          )}
        </section>

        <section className="rounded-2xl border bg-white p-4 mt-3 text-sm space-y-2" style={{ borderColor: 'var(--brand-border)' }}>
          {when && <p className="flex items-center gap-2" style={{ color: 'var(--ink)' }}><Clock size={14} /> {when}</p>}
          <p className="flex items-center gap-2" style={{ color: 'var(--ink)' }}>
            {delivery ? <Bike size={14} /> : <StoreIcon size={14} />}
            {delivery ? t('orders.delivery', 'Delivery') : t('orders.track.pickupAtStore', 'Pickup at the store')}
          </p>
          {delivery && data.address && <p className="flex items-start gap-2" dir="auto" style={{ color: 'var(--ink)' }}><MapPin size={14} className="mt-0.5 shrink-0" /> <span>{data.address}</span></p>}
          <p className="whitespace-pre-line pt-1 border-t" dir="auto" style={{ color: 'var(--ink)', borderColor: 'var(--brand-border)' }}>{data.items}</p>
          {data.total != null && (
            <p style={{ color: 'var(--ink)' }}>
              {t('orders.track.total', 'Total: ₪{{n}}', { n: Number(data.total).toLocaleString() })}
              {data.paid && <span className="ms-2" style={{ color: 'var(--status-open)' }}>· {t('orders.paidShort', 'paid')}</span>}
            </p>
          )}
        </section>

        {delivery && !closedBad && data.status !== 'done' && (
          <p className="text-xs mt-4 px-1" style={{ color: 'var(--brand-muted)' }} data-testid="track-phone-notice">
            {t('orders.track.phoneNotice', 'The delivery person will see your number to reach you.')}
          </p>
        )}
        <p className="text-[11px] mt-6 text-center" style={{ color: 'var(--brand-muted)' }}>
          {t('orders.track.footer', 'Questions about the order? Contact the store directly.')}
        </p>
      </main>
    </div>
  );
}
