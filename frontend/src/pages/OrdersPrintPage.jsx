/**
 * /orders/print?business=…&from=…&to=… — a day's orders as one clean
 * page (spec O3, "Kitchens still print").
 *
 * Owner-only: it reads through the owner's own session, the same call
 * the Orders tab makes. Opens the print dialog once the rows are in;
 * the Print button is there for a second copy. Black on white, no
 * chrome, no colour pills — a kitchen printer is monochrome and a pill
 * without its colour is just a word, so the word is what we print.
 */
import React, { useContext, useEffect, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import axios from 'axios';
import { ArrowLeft, Printer } from 'lucide-react';
import { API, AuthContext } from '../App';

const pad = (n) => String(n).padStart(2, '0');
const localDate = (d) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;

export default function OrdersPrintPage() {
  const { t, i18n } = useTranslation();
  const { token } = useContext(AuthContext);
  const [params] = useSearchParams();
  const navigate = useNavigate();
  const businessId = params.get('business');
  const from = params.get('from') || localDate(new Date());
  const to = params.get('to') || from;
  const [rows, setRows] = useState(null);
  const [bizName, setBizName] = useState('');

  useEffect(() => {
    document.body.classList.add('orders-bare');
    return () => document.body.classList.remove('orders-bare');
  }, []);

  useEffect(() => {
    if (!businessId || !token) return;
    const auth = { headers: { Authorization: `Bearer ${token}` } };
    Promise.all([
      axios.get(`${API}/marketplace/businesses/${businessId}/orders`, { ...auth, params: { from, to, status: 'open' } }),
      axios.get(`${API}/marketplace/businesses`, auth),
    ]).then(([o, b]) => {
      setRows(o.data.orders || []);
      const biz = (b.data || []).find((x) => x.id === businessId);
      setBizName(biz?.name || '');
    }).catch(() => setRows([]));
  }, [businessId, token, from, to]);

  // Print once the list is on the page, not before.
  useEffect(() => {
    if (rows && rows.length) {
      const id = setTimeout(() => window.print(), 400);
      return () => clearTimeout(id);
    }
    return undefined;
  }, [rows]);

  const lang = String(i18n.language || 'en').split('-')[0];
  const fmtDay = (day) => new Intl.DateTimeFormat(lang === 'he' ? 'he-IL' : 'en-GB', { weekday: 'long', day: 'numeric', month: 'long' }).format(new Date(`${day}T00:00`));

  if (!businessId) return <p className="p-6 text-sm">{t('orders.print.noBusiness', 'No business given.')}</p>;
  if (rows === null) return <p className="p-6 text-sm">{t('orders.print.loading', 'Preparing…')}</p>;

  const days = new Map();
  for (const o of rows) {
    const d = (o.needed_by || '').slice(0, 10);
    if (!days.has(d)) days.set(d, []);
    days.get(d).push(o);
  }

  return (
    <div className="orders-print max-w-3xl mx-auto p-6" data-testid="orders-print">
      <div className="flex items-start justify-between gap-4 mb-4">
        <div>
          <h1 className="text-xl font-bold" style={{ fontFamily: 'var(--font-head)' }}>{bizName}</h1>
          <p className="text-sm">
            {t('orders.print.title', 'Orders')} · {from === to ? fmtDay(from) : `${fmtDay(from)} - ${fmtDay(to)}`}
            {' · '}{t('orders.print.count', '{{n}} open', { n: rows.length })}
          </p>
        </div>
        <div className="print-hide flex items-center gap-2 shrink-0">
          <button type="button" onClick={() => navigate('/dashboard?tab=orders')} className="inline-flex items-center gap-1.5 px-3 min-h-[44px] rounded-full text-sm font-semibold border" style={{ borderColor: 'var(--brand-border)', color: 'var(--ink)' }} data-testid="print-back">
            <ArrowLeft size={15} className="rtl:rotate-180" /> {t('orders.print.back', 'Back to orders')}
          </button>
          <button type="button" onClick={() => window.print()} className="inline-flex items-center gap-1.5 px-4 min-h-[44px] rounded-full text-sm font-semibold" style={{ background: 'var(--action)', color: 'var(--action-ink)' }}>
            <Printer size={15} /> {t('orders.print.button', 'Print')}
          </button>
        </div>
      </div>

      {rows.length === 0 && <p className="text-sm">{t('orders.emptyToday', 'Nothing due today.')}</p>}

      {[...days.entries()].map(([day, list]) => (
        <section key={day} className="mb-6">
          {days.size > 1 && <h2 className="text-sm font-bold uppercase tracking-wide mb-2">{fmtDay(day)}</h2>}
          <table className="w-full text-sm border-collapse">
            <thead>
              <tr className="text-start">
                <th className="text-start py-1 pe-2 border-b border-black w-14">{t('orders.time', 'Time')}</th>
                <th className="text-start py-1 pe-2 border-b border-black">{t('orders.name', 'Customer')}</th>
                <th className="text-start py-1 pe-2 border-b border-black">{t('orders.items', 'Items')}</th>
                <th className="text-start py-1 pe-2 border-b border-black">{t('orders.fulfilment', 'Pickup or delivery')}</th>
                <th className="text-start py-1 pe-2 border-b border-black w-16">{t('orders.total', 'Total (₪)')}</th>
                <th className="text-start py-1 border-b border-black w-16">{t('orders.print.done', 'Done')}</th>
              </tr>
            </thead>
            <tbody>
              {list.map((o) => (
                <tr key={o.id} className="align-top">
                  <td className="py-2 pe-2 border-b border-gray-300 tabular-nums font-semibold">{(o.needed_by || '').includes('T') ? o.needed_by.slice(11, 16) : ''}</td>
                  <td className="py-2 pe-2 border-b border-gray-300">
                    <div className="font-semibold" dir="auto">{o.customer_name}</div>
                    {o.customer_phone && <div className="text-xs" dir="ltr">{o.customer_phone}</div>}
                  </td>
                  <td className="py-2 pe-2 border-b border-gray-300 whitespace-pre-line" dir="auto">
                    {o.items}
                    {o.notes && <div className="text-xs italic mt-1">{o.notes}</div>}
                  </td>
                  <td className="py-2 pe-2 border-b border-gray-300">
                    {o.fulfilment === 'delivery' ? t('orders.delivery', 'Delivery') : t('orders.pickup', 'Pickup')}
                    {o.address && <div className="text-xs" dir="auto">{o.address}</div>}
                  </td>
                  <td className="py-2 pe-2 border-b border-gray-300 tabular-nums">{o.total != null ? Number(o.total).toLocaleString() : ''}</td>
                  <td className="py-2 border-b border-gray-300"><span className="inline-block w-5 h-5 border border-black rounded-sm" aria-hidden="true" /></td>
                </tr>
              ))}
            </tbody>
          </table>
        </section>
      ))}
    </div>
  );
}
