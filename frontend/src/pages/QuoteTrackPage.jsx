/**
 * /quotes/:token — a customer's quote request (backend
 * routes/marketplace/quotes.py), no account. Shows what they asked, and
 * once the business answers, the price with Accept and Decline.
 */
import React, { useCallback, useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import axios from 'axios';
import { toast } from 'sonner';
import { Loader2, Calculator } from 'lucide-react';
import { API } from '../lib/apiBase';
import { money } from '../utils/currency';

export default function QuoteTrackPage() {
  const { token } = useParams();
  const { t, i18n } = useTranslation();
  const [d, setD] = useState(null);
  const [busy, setBusy] = useState('');
  const lang = String(i18n.language || 'en').split('-')[0];
  const load = useCallback(() => axios.get(`${API}/marketplace/quotes/track/${encodeURIComponent(token)}`)
    .then(({ data }) => setD(data)).catch(() => setD(false)), [token]);
  useEffect(() => { document.body.classList.add('orders-bare'); return () => document.body.classList.remove('orders-bare'); }, []);
  useEffect(() => { load(); const id = setInterval(() => { if (!document.hidden) load(); }, 30000); return () => clearInterval(id); }, [load]);

  const answer = async (a) => {
    setBusy(a);
    try {
      await axios.post(`${API}/marketplace/quotes/track/${encodeURIComponent(token)}/answer`, { answer: a });
      toast.success(a === 'accept' ? t('quote.acceptedToast', 'Accepted. The business will contact you to arrange it.') : t('quote.declinedToast', 'Declined.'));
      load();
    } catch (err) { toast.error(err?.response?.data?.detail || t('quote.failed', 'Could not send. Try again.')); } finally { setBusy(''); }
  };

  if (d === null) return <div className="py-24 text-center"><Loader2 className="animate-spin inline" size={20} /></div>;
  if (d === false) return <div className="max-w-md mx-auto px-4 py-24 text-center"><h1 className="text-lg font-bold" style={{ color: 'var(--ink)' }}>{t('bookingTrack.badLink', 'This link no longer works')}</h1></div>;
  const biz = (lang === 'he' && d.business.name_he) || d.business.name;
  const title = (lang === 'he' && d.gig_title_he) || d.gig_title;
  const STATUS = {
    new: t('quote.st.new', 'Waiting for a price from the business'),
    quoted: d.expired ? t('quote.st.expired', 'This price has expired') : t('quote.st.quoted', 'You have a price'),
    accepted: t('quote.st.accepted', 'You accepted. The business will contact you.'),
    declined_by_customer: t('quote.st.youDeclined', 'You declined this price'),
    declined: t('quote.st.declined', "The business can't take this job"),
  };
  return (
    <div className="min-h-screen" style={{ background: 'var(--bg)' }} data-testid="quote-track-page" data-status={d.status}>
      <main className="max-w-md mx-auto px-4 py-10">
        <p className="text-xs uppercase tracking-wide" style={{ color: 'var(--brand-muted)' }}>{t('quote.yourRequest', 'Your quote request to')}</p>
        <h1 className="text-xl font-semibold" style={{ color: 'var(--ink)', fontFamily: 'var(--font-head)' }} dir="auto">{biz}</h1>
        <section className="mt-5 rounded-2xl border bg-white p-5" style={{ borderColor: 'var(--brand-border)' }}>
          <p className="inline-flex items-center gap-2 font-semibold" style={{ color: 'var(--ink)' }} data-testid="quote-status"><Calculator size={17} /> {STATUS[d.status] || d.status}</p>
          {d.status === 'quoted' || d.status === 'accepted' || d.status === 'declined_by_customer' ? (
            <div className="mt-3 rounded-xl p-4" style={{ background: '#F9FAFB' }}>
              <p className="text-2xl font-bold tabular-nums" style={{ color: 'var(--ink)' }} data-testid="quote-price">{money(d.quote.price, d.quote.currency || 'ILS')}</p>
              {d.quote.note && <p className="text-sm mt-1 whitespace-pre-line" dir="auto" style={{ color: 'var(--ink)' }}>{d.quote.note}</p>}
              {d.quote.valid_until && <p className="text-xs mt-1" style={{ color: 'var(--brand-muted)' }}>{t('quote.validUntil', 'Valid until {{d}}', { d: d.quote.valid_until })}</p>}
              {d.status === 'quoted' && !d.expired && (
                <div className="flex gap-2 mt-4">
                  <button type="button" disabled={!!busy} onClick={() => answer('accept')} className="flex-1 inline-flex items-center justify-center gap-1.5 min-h-[48px] rounded-full text-sm font-semibold disabled:opacity-60"
                          style={{ background: 'var(--action)', color: 'var(--action-ink)' }} data-testid="quote-accept">
                    {busy === 'accept' && <Loader2 size={14} className="animate-spin" />} {t('quote.accept', 'Accept')}
                  </button>
                  <button type="button" disabled={!!busy} onClick={() => answer('decline')} className="flex-1 min-h-[48px] rounded-full text-sm font-semibold border disabled:opacity-60"
                          style={{ borderColor: 'var(--brand-border)', color: 'var(--ink)' }} data-testid="quote-decline">{t('quote.decline', 'Decline')}</button>
                </div>
              )}
              <p className="text-[11px] mt-3" style={{ color: 'var(--brand-muted)' }}>{t('quote.payNote', 'You pay the business directly, not through MyIsraelRental.')}</p>
            </div>
          ) : null}
          <div className="mt-4 text-sm" style={{ color: 'var(--ink)' }}>
            <p className="text-xs font-semibold" style={{ color: 'var(--brand-muted)' }}>{title}</p>
            <p className="whitespace-pre-line mt-1 text-start" dir="auto">{d.description}</p>
            {(d.preferred_date || d.area) && <p className="text-xs mt-1" style={{ color: 'var(--brand-muted)' }}>{[d.preferred_date, d.area].filter(Boolean).join(' · ')}</p>}
            {d.photos.length > 0 && (
              <div className="flex flex-wrap gap-2 mt-2">{d.photos.map((u) => <img key={u} src={u} alt="" className="w-16 h-16 rounded-lg object-cover" />)}</div>
            )}
          </div>
        </section>
        <p className="text-xs mt-6 text-center" style={{ color: 'var(--brand-muted)' }}>{t('quote.keep', 'Keep this page: the price appears here.')}</p>
      </main>
    </div>
  );
}
