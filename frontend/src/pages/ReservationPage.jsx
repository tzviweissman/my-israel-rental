/**
 * /reservations/:token — places reserved on a tour or workshop date
 * (backend routes/marketplace/sessions.py), no account, with Cancel.
 */
import React, { useCallback, useEffect, useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import axios from 'axios';
import { toast } from 'sonner';
import { Loader2, CalendarDays } from 'lucide-react';
import { API } from '../lib/apiBase';

export default function ReservationPage() {
  const { token } = useParams();
  const { t, i18n } = useTranslation();
  const [d, setD] = useState(null);
  const [confirm, setConfirm] = useState(false);
  const [busy, setBusy] = useState(false);
  const lang = String(i18n.language || 'en').split('-')[0];
  const load = useCallback(() => axios.get(`${API}/marketplace/reservations/${encodeURIComponent(token)}`)
    .then(({ data }) => setD(data)).catch(() => setD(false)), [token]);
  useEffect(() => { document.body.classList.add('orders-bare'); return () => document.body.classList.remove('orders-bare'); }, []);
  useEffect(() => { load(); }, [load]);

  const cancel = async () => {
    setBusy(true);
    try {
      await axios.post(`${API}/marketplace/reservations/${encodeURIComponent(token)}/cancel`);
      toast.success(t('sessions.cancelled', 'Cancelled. Your places are free for someone else.'));
      setConfirm(false);
      load();
    } catch (err) { toast.error(err?.response?.data?.detail || t('sessions.failed', 'Could not reserve. Try again.')); } finally { setBusy(false); }
  };

  if (d === null) return <div className="py-24 text-center"><Loader2 className="animate-spin inline" size={20} /></div>;
  if (d === false) return <div className="max-w-md mx-auto px-4 py-24 text-center"><h1 className="text-lg font-bold" style={{ color: 'var(--ink)' }}>{t('bookingTrack.badLink', 'This link no longer works')}</h1></div>;
  const biz = (lang === 'he' && d.business.name_he) || d.business.name;
  const title = (lang === 'he' && d.gig_title_he) || d.gig_title;
  const when = new Date(`${d.date}T12:00:00`).toLocaleDateString(i18n.language, { weekday: 'long', day: 'numeric', month: 'long' });
  return (
    <div className="min-h-screen" style={{ background: 'var(--bg)' }} data-testid="reservation-page" data-status={d.status}>
      <main className="max-w-md mx-auto px-4 py-10">
        <p className="text-xs uppercase tracking-wide" style={{ color: 'var(--brand-muted)' }}>{t('sessions.yourPlaces', 'Your places with')}</p>
        <h1 className="text-xl font-semibold" style={{ color: 'var(--ink)', fontFamily: 'var(--font-head)' }} dir="auto">{biz}</h1>
        <section className="mt-5 rounded-2xl border bg-white p-5" style={{ borderColor: 'var(--brand-border)' }}>
          <p className="inline-flex items-center gap-2 font-semibold" style={{ color: 'var(--ink)' }} data-testid="reservation-status">
            <CalendarDays size={17} /> {d.status === 'reserved' ? t('sessions.reserved', 'Reserved') : t('sessions.cancelledShort', 'Cancelled')}
          </p>
          <p className="mt-3 text-sm" dir="auto" style={{ color: 'var(--ink)' }}>{title}</p>
          <p className="text-sm" style={{ color: 'var(--brand-muted)' }}>{when}{d.time ? ` · ${d.time}` : ''} · {t('sessions.placesN', '{{n}} places', { n: d.seats })}</p>
          {d.can_cancel && (confirm ? (
            <div className="mt-4 flex gap-2">
              <button type="button" disabled={busy} onClick={cancel} className="inline-flex items-center gap-1.5 px-4 min-h-[44px] rounded-full text-sm font-semibold disabled:opacity-60"
                      style={{ background: 'var(--action)', color: 'var(--action-ink)' }} data-testid="reservation-cancel-confirm">
                {busy && <Loader2 size={14} className="animate-spin" />} {t('bookingTrack.cancelYes', 'Yes, cancel it')}
              </button>
              <button type="button" onClick={() => setConfirm(false)} className="px-3 min-h-[44px] text-sm underline" style={{ color: 'var(--brand-muted)' }}>{t('bookingTrack.keepIt', 'Keep it')}</button>
            </div>
          ) : (
            <button type="button" onClick={() => setConfirm(true)} className="mt-4 px-4 min-h-[44px] rounded-full border text-sm font-semibold" style={{ borderColor: 'var(--brand-border)', color: 'var(--ink)' }} data-testid="reservation-cancel">
              {t('bookingTrack.cancel', 'Cancel')}
            </button>
          ))}
        </section>
        <p className="text-xs mt-6 text-center" style={{ color: 'var(--brand-muted)' }}>
          <Link to={`/businesses/${d.gig_id}`} className="underline">{t('sessions.backToListing', 'See the listing')}</Link>
        </p>
      </main>
    </div>
  );
}
