/**
 * /bookings/owner/:token — the business's one-booking page, opened from the
 * new-booking text (backend routes/marketplace/order_texts.py), the same way
 * OwnerOrderPage works for orders: no sign-in, Confirm and Decline on one
 * screen. Deciding tells the customer by text and email, with their link.
 */
import React, { useCallback, useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import axios from 'axios';
import { Loader2, ClipboardList, Check, X, Clock, Phone, Mail } from 'lucide-react';
import { API } from '../lib/apiBase';

export default function OwnerBookingPage() {
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

  const url = `${API}/marketplace/bookings/owner/${encodeURIComponent(token)}`;
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
      <div className="max-w-md mx-auto px-4 py-24 text-center" data-testid="owner-booking-bad-link">
        <ClipboardList size={26} className="inline mb-3" style={{ color: 'var(--brand-muted)' }} />
        <h1 className="text-lg font-bold" style={{ color: 'var(--ink)', fontFamily: 'var(--font-head)' }}>{t('orders.track.badLinkTitle', 'This link no longer works')}</h1>
        <p className="text-sm mt-2" style={{ color: 'var(--brand-muted)' }}>{t('ownerOrder.badLinkBody', 'Open the order from your dashboard instead.')}</p>
      </div>
    );
  }

  const bizName = (lang === 'he' && data.business?.name_he) || data.business?.name || '';
  const pending = data.status === 'pending';
  const bad = ['declined', 'cancelled', 'expired'].includes(data.status);
  const stateText = {
    accepted: t('ownerBooking.confirmed', 'Confirmed. The customer has their tracking link.'),
    declined: t('ownerBooking.declined', 'Declined. The customer was told.'),
    cancelled: t('ownerBooking.cancelled', 'This booking was cancelled.'),
    completed: t('ownerBooking.completed', 'This booking is complete.'),
    expired: t('ownerBooking.expired', 'The time to answer this booking has passed.'),
  }[data.status] || data.status;
  const btn = 'flex items-center justify-center gap-2 w-full min-h-[52px] rounded-full text-base font-semibold disabled:opacity-60';

  return (
    <div className="min-h-screen" style={{ background: 'var(--bg)' }} data-testid="owner-booking-page" data-status={data.status}>
      <main className="max-w-md mx-auto px-4 py-8">
        <div className="flex items-center gap-3 mb-6">
          {data.business?.logo_url && <img src={data.business.logo_url} alt="" className="w-11 h-11 rounded-xl object-cover" />}
          <div className="min-w-0">
            <p className="text-[11px] uppercase tracking-wide" style={{ color: 'var(--brand-muted)' }}>{bizName}</p>
            <h1 className="text-lg font-bold" style={{ color: 'var(--ink)', fontFamily: 'var(--font-head)' }}>{t('ownerBooking.title', 'New booking request')}</h1>
          </div>
        </div>

        {!pending && (
          <p className="rounded-2xl border p-4 mb-3 text-base font-semibold flex items-center gap-2" role="status" data-testid="owner-booking-state"
             style={bad
               ? { borderColor: 'var(--brand-border)', background: 'var(--surface-muted)', color: 'var(--ink)' }
               : { borderColor: 'var(--status-open)', background: 'var(--status-open-bg)', color: 'var(--status-open)' }}>
            {bad ? <X size={18} aria-hidden="true" /> : <Check size={18} aria-hidden="true" />}
            {stateText}
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
          <p className="pt-1 border-t" dir="auto" style={{ color: 'var(--ink)', borderColor: 'var(--brand-border)' }}>{[data.title, data.tier_name].filter(Boolean).join(' - ')}</p>
          {(data.date || data.time) && <p className="flex items-center gap-2" style={{ color: 'var(--ink)' }}><Clock size={14} aria-hidden="true" /> <span dir="ltr">{[data.date, data.time].filter(Boolean).join(' ')}</span></p>}
          {data.message && <p className="whitespace-pre-line" dir="auto" style={{ color: 'var(--brand-muted)' }}>{data.message}</p>}
        </section>

        {pending && !askDecline && (
          <div className="mt-4 space-y-3">
            <button type="button" className={btn} onClick={() => decide('confirm')} disabled={!!busy}
                    style={{ background: 'var(--action)', color: 'var(--action-ink)' }} data-testid="owner-booking-confirm">
              {busy === 'confirm' ? <Loader2 size={18} className="animate-spin" /> : <Check size={18} aria-hidden="true" />}
              {t('ownerBooking.confirm', 'Confirm booking')}
            </button>
            <button type="button" className={`${btn} border`} onClick={() => setAskDecline(true)} disabled={!!busy}
                    style={{ borderColor: 'var(--brand-border)', background: 'white', color: 'var(--ink)' }} data-testid="owner-booking-decline">
              <X size={18} aria-hidden="true" /> {t('ownerOrder.decline', 'Decline')}
            </button>
          </div>
        )}
        {pending && askDecline && (
          <div className="mt-4 rounded-2xl border bg-white p-4 space-y-3" style={{ borderColor: 'var(--brand-border)' }} data-testid="owner-booking-decline-ask">
            <p className="text-sm font-semibold" style={{ color: 'var(--ink)' }}>{t('ownerBooking.declineAsk', 'Decline this booking? The customer gets a text saying you can\'t take it.')}</p>
            <button type="button" className={btn} onClick={() => decide('decline')} disabled={!!busy}
                    style={{ background: 'var(--action)', color: 'var(--action-ink)' }} data-testid="owner-booking-decline-yes">
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
          {t('ownerBooking.footer', 'This booking is also in your dashboard.')}
        </p>
      </main>
    </div>
  );
}
