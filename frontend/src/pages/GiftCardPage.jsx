/**
 * /gift/:token: one gift card (backend routes/marketplace/gift_cards.py),
 * for whoever holds the link. Before payment it says how to pay; after,
 * it is the card: business, balance, code, message, valid until.
 */
import React, { useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import axios from 'axios';
import { toast } from 'sonner';
import { Loader2, Copy, Gift } from 'lucide-react';
import { API } from '../lib/apiBase';
import { money } from '../utils/currency';
import PayLinks from '../components/forms/PayLinks';

export default function GiftCardPage() {
  const { token } = useParams();
  const { t, i18n } = useTranslation();
  const lang = String(i18n.language || 'en').split('-')[0];
  const [d, setD] = useState(null);

  useEffect(() => { document.body.classList.add('orders-bare'); return () => document.body.classList.remove('orders-bare'); }, []);
  useEffect(() => {
    const load = () => axios.get(`${API}/marketplace/gift/${encodeURIComponent(token)}`).then(({ data }) => setD(data)).catch(() => setD(false));
    load();
    const id = setInterval(() => { if (!document.hidden) load(); }, 30000);
    return () => clearInterval(id);
  }, [token]);

  if (d === null) return <div className="py-24 text-center"><Loader2 className="animate-spin inline" size={20} /></div>;
  if (d === false) return <div className="max-w-md mx-auto px-4 py-24 text-center"><h1 className="text-lg font-bold" style={{ color: 'var(--ink)' }}>{t('bookingTrack.badLink', 'This link no longer works')}</h1></div>;
  const biz = d.business || {};
  const bizName = (lang === 'he' && biz.name_he) || biz.name;
  const fmt = (s) => new Intl.DateTimeFormat(lang === 'he' ? 'he-IL' : 'en-GB', { day: 'numeric', month: 'long', year: 'numeric' }).format(new Date(`${s}T00:00`));
  const waiting = d.status === 'awaiting_payment';

  return (
    <div className="min-h-screen" style={{ background: 'var(--bg)' }} data-testid="gift-card-page" data-status={d.status}>
      <main className="max-w-md mx-auto px-4 py-10">
        <div className="rounded-3xl p-6 text-center shadow-sm" style={{ background: '#111827', color: '#fff' }} data-testid="gift-card">
          {biz.logo_url ? <img src={biz.logo_url} alt="" className="w-14 h-14 rounded-2xl object-cover mx-auto mb-3 bg-white" /> : <Gift size={28} className="mx-auto mb-3" aria-hidden="true" />}
          <p className="text-sm opacity-80">{t('gift.cardFor', 'A gift card for {{name}}', { name: bizName })}</p>
          <p className="text-4xl font-bold tabular-nums mt-2" data-testid="gift-balance">{money(waiting ? d.amount : d.balance, d.currency || 'ILS')}</p>
          {!waiting && d.balance < d.amount && <p className="text-xs opacity-75 mt-1">{t('gift.ofAmount', 'left of {{v}}', { v: money(d.amount, d.currency || 'ILS') })}</p>}
          {d.code && (
            <button type="button" onClick={() => navigator.clipboard?.writeText(d.code).then(() => toast.success(t('discounts.copied', 'Copied')))}
                    className="mt-4 inline-flex items-center gap-2 px-4 min-h-[44px] rounded-full text-lg font-bold tracking-widest" dir="ltr"
                    style={{ background: 'rgba(255,255,255,.12)' }} data-testid="gift-code">
              {d.code} <Copy size={15} aria-hidden="true" />
            </button>
          )}
          <p className="text-sm mt-4 opacity-90">{d.for_self ? d.from_name : t('gift.toFrom', 'For {{to}}, from {{from}}', { to: d.to_name, from: d.from_name })}</p>
          {d.message && <p className="text-sm mt-2 italic opacity-90 whitespace-pre-line" dir="auto">“{d.message}”</p>}
        </div>

        <section className="mt-5 rounded-2xl border bg-white p-5 text-sm" style={{ borderColor: 'var(--brand-border)', color: 'var(--ink)' }}>
          {waiting ? (
            <div data-testid="gift-waiting">
              <p className="font-semibold">{t('gift.waitingTitle', 'Waiting for the business to confirm payment')}</p>
              <p className="mt-1" style={{ color: 'var(--brand-muted)' }}>{t('gift.waitingBody', 'Pay {{name}} directly. As soon as they confirm, the code appears here and the card is emailed.', { name: bizName })}</p>
              {d.note && <p className="mt-3 whitespace-pre-line" dir="auto">{d.note}</p>}
              <div className="mt-3"><PayLinks links={d.payment_links} testid="gift-pay-links" /></div>
            </div>
          ) : d.status === 'cancelled' ? (
            <p>{t('gift.cancelled', 'This gift card order was cancelled.')}</p>
          ) : !d.valid ? (
            <p>{d.status === 'used_up' ? t('gift.usedUp', 'This gift card has been used up.') : t('gift.expired', 'This gift card has expired.')}</p>
          ) : (
            <>
              <p className="font-semibold">{t('gift.howTitle', 'How to use it')}</p>
              <p className="mt-1" style={{ color: 'var(--brand-muted)' }}>{t('gift.howBody', 'Type the code in the discount code box when you order or sign up online, or show this page at {{name}}. Whatever you do not spend stays on the card.', { name: bizName })}</p>
              {d.expires_on && <p className="mt-2 text-xs" style={{ color: 'var(--brand-muted)' }}>{t('gift.validUntil', 'Valid until {{d}}', { d: fmt(d.expires_on) })}</p>}
            </>
          )}
        </section>
        {biz.slug && (
          <p className="text-center mt-6">
            <Link to={`/business/${biz.slug}`} className="inline-flex items-center px-5 min-h-[44px] rounded-full border text-sm font-semibold" style={{ borderColor: 'var(--ink)', color: 'var(--ink)' }}>
              {t('gift.visit', 'Visit {{name}}', { name: bizName })}
            </Link>
          </p>
        )}
      </main>
    </div>
  );
}
