/**
 * Dashboard → My orders: what a signed-in customer ordered from stores
 * on the site (Tzvi, 2026-09-08). Same face as the status link, plus the
 * delivery photo once it has arrived - the proof, kept where they can
 * find it again.
 */
import React, { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Link } from 'react-router-dom';
import axios from 'axios';
import { Loader2, ClipboardList, Bike, Store as StoreIcon, Camera, ExternalLink } from 'lucide-react';
import { pillStyle } from './OrderCard';

export default function MyOrdersTab({ API, token }) {
  const { t, i18n } = useTranslation();
  const [orders, setOrders] = useState(null);
  const lang = String(i18n.language || 'en').split('-')[0];

  useEffect(() => {
    axios.get(`${API}/marketplace/orders/mine`, { headers: { Authorization: `Bearer ${token}` } })
      .then(({ data }) => setOrders(data || []))
      .catch(() => setOrders([]));
  }, [API, token]);

  if (orders === null) return <div className="py-16 text-center" style={{ color: 'var(--brand-muted)' }}><Loader2 className="animate-spin inline" size={18} /></div>;

  const stepLabel = (o) => {
    if (o.status === 'cancelled') return t('orders.status.cancelled', 'Cancelled');
    if (o.status === 'failed') return t('orders.track.failed', "We couldn't deliver this one. The store will be in touch to sort it out.");
    if (o.status === 'done') return o.fulfilment === 'delivery' ? t('orders.track.delivered', 'Delivered') : t('orders.track.collected', 'Collected');
    if (o.status === 'ready') return o.fulfilment === 'delivery' ? t('orders.track.outForDelivery', 'Out for delivery') : t('orders.track.readyToCollect', 'Ready to collect');
    if (o.status === 'preparing') return t('orders.track.preparing', 'Preparing');
    return t('orders.status.new', 'New');
  };
  const fmt = (nb) => {
    if (!nb) return '';
    return new Intl.DateTimeFormat(lang === 'he' ? 'he-IL' : 'en-GB', { weekday: 'short', day: 'numeric', month: 'short' }).format(new Date(`${nb.slice(0, 10)}T00:00`));
  };

  return (
    <div data-testid="my-orders-tab">
      <h2 className="text-lg font-bold mb-1" style={{ color: 'var(--ink)' }}>{t('myOrders.title', 'My orders')}</h2>
      <p className="text-sm mb-4" style={{ color: 'var(--brand-muted)' }}>{t('myOrders.body', 'Orders you placed with stores on the site, and where each one is.')}</p>
      {orders.length === 0 ? (
        <div className="rounded-2xl border p-8 text-center" style={{ borderColor: 'var(--brand-border)', color: 'var(--brand-muted)' }}>
          <ClipboardList size={22} className="inline mb-2" />
          <p className="text-sm">{t('myOrders.empty', 'Nothing yet. Order from any store page and it will show up here.')}</p>
        </div>
      ) : (
        <div className="space-y-2">
          {orders.map((o) => (
            <article key={o.id} className="rounded-2xl border bg-white p-3" style={{ borderColor: 'var(--brand-border)' }} data-testid={`my-order-${o.id}`} data-status={o.status}>
              <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
                {o.business?.logo_url && <img src={o.business.logo_url} alt="" className="w-8 h-8 rounded-lg object-cover" />}
                <span className="font-semibold" dir="auto" style={{ color: 'var(--ink)' }}>
                  {o.business?.slug ? <Link to={`/business/${o.business.slug}`}>{(lang === 'he' && o.business.name_he) || o.business.name}</Link> : o.business?.name}
                </span>
                <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-semibold border" style={pillStyle(o.status, false)}>{stepLabel(o)}</span>
                <span className="inline-flex items-center gap-1 text-[11px] ms-auto" style={{ color: 'var(--brand-muted)' }}>
                  {o.fulfilment === 'delivery' ? <Bike size={12} /> : <StoreIcon size={12} />} {fmt(o.needed_by)}{o.window ? ` ${o.window.start}–${o.window.end}` : (o.needed_by || '').includes('T') ? ` ${o.needed_by.slice(11, 16)}` : ''}
                </span>
              </div>
              <p className="text-sm mt-2 whitespace-pre-line" dir="auto" style={{ color: 'var(--ink)' }}>{o.items}</p>
              {o.total != null && <p className="text-sm mt-1" style={{ color: 'var(--ink)' }}>{t('orders.track.total', 'Total: ₪{{n}}', { n: Number(o.total).toLocaleString() })}{o.paid && <span className="ms-2" style={{ color: 'var(--status-open)' }}>· {t('orders.paidShort', 'paid')}</span>}</p>}
              {o.delivered_photo_url && (
                <a href={o.delivered_photo_url} target="_blank" rel="noopener noreferrer" className="mt-2 inline-flex items-center gap-2 text-xs" style={{ color: 'var(--ink)' }} data-testid="my-order-photo">
                  <img src={o.delivered_photo_url} alt="" className="w-16 h-16 rounded-lg object-cover" />
                  <span className="inline-flex items-center gap-1"><Camera size={12} /> {t('myOrders.deliveredPhoto', 'Delivered {{time}} - photo', { time: String(o.delivered_at || '').slice(11, 16) })}</span>
                </a>
              )}
              {o.track_token && (
                <a href={`/orders/track/${o.track_token}`} target="_blank" rel="noopener noreferrer" className="mt-2 ms-2 inline-flex items-center gap-1 text-xs underline" style={{ color: 'var(--brand-muted)' }}>
                  {t('order.follow', 'Follow my order')} <ExternalLink size={11} />
                </a>
              )}
            </article>
          ))}
        </div>
      )}
    </div>
  );
}
