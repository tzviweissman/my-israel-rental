/**
 * "Invite a friend" on an order's tracking page and a membership pass
 * (backend routes/marketplace/referrals.py). Shows nothing unless the
 * business has referrals on. The page's own token is the credential.
 */
import React, { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import axios from 'axios';
import { toast } from 'sonner';
import { Gift, Copy, Share2 } from 'lucide-react';
import { API } from '../../lib/apiBase';
import { money } from '../../utils/currency';

const offText = (r) => (r.kind === 'percent' ? `${r.value}%` : money(r.value, 'ILS'));

export default function ReferralCard({ kind, token }) {
  const { t } = useTranslation();
  const [d, setD] = useState(null);
  useEffect(() => {
    axios.get(`${API}/marketplace/referrals/${kind}/${token}`).then(({ data }) => setD(data)).catch(() => setD(null));
  }, [kind, token]);
  if (!d || !d.on) return null;

  const text = t('referrals.shareText', 'Here is {{off}} off your first time: {{url}}', { off: offText(d.friend), url: d.url });
  const copy = async () => {
    try { await navigator.clipboard.writeText(d.url); toast.success(t('referrals.copied', 'Link copied')); } catch { /* clipboard blocked */ }
  };
  return (
    <section className="rounded-2xl border bg-white p-4 mt-4" style={{ borderColor: 'var(--brand-border)' }} data-testid="referral-card">
      <p className="flex items-center gap-2 text-sm font-semibold" style={{ color: 'var(--ink)' }}>
        <Gift size={16} aria-hidden="true" /> {t('referrals.title', 'Invite a friend')}
      </p>
      <p className="text-sm mt-1" style={{ color: 'var(--ink)' }}>
        {t('referrals.body', 'They get {{friend}} off their first time. When they order or join, you get {{reward}} off.', { friend: offText(d.friend), reward: offText(d.reward) })}
      </p>
      <p className="text-xs mt-2" style={{ color: 'var(--brand-muted)' }}>
        {t('referrals.yourCode', 'Your code:')} <b dir="ltr" className="tracking-wider" style={{ color: 'var(--ink)' }} data-testid="referral-code">{d.code}</b>
      </p>
      <div className="flex flex-wrap gap-2 mt-3">
        <a href={`https://wa.me/?text=${encodeURIComponent(text)}`} target="_blank" rel="noopener noreferrer"
           className="inline-flex items-center gap-1.5 px-4 min-h-[44px] rounded-full text-sm font-semibold" style={{ background: 'var(--action)', color: 'var(--action-ink)' }}>
          <Share2 size={14} /> {t('referrals.whatsapp', 'Send on WhatsApp')}
        </a>
        <button type="button" onClick={copy} className="inline-flex items-center gap-1.5 px-4 min-h-[44px] rounded-full border text-sm font-semibold"
                style={{ borderColor: 'var(--brand-border)', color: 'var(--ink)' }}>
          <Copy size={14} /> {t('referrals.copy', 'Copy link')}
        </button>
      </div>
      {d.rewards.length > 0 && (
        <div className="mt-3 text-sm" style={{ color: 'var(--ink)' }} data-testid="referral-rewards">
          <p className="font-semibold">{t('referrals.yourRewards', 'Your thank-you codes')}</p>
          <ul className="mt-1 space-y-1">
            {d.rewards.map((r) => (
              <li key={r.code} className={r.used ? 'line-through opacity-60' : ''}>
                <b dir="ltr" className="tracking-wider">{r.code}</b> · {t('referrals.off', '{{off}} off', { off: offText(r) })}{r.used ? ` · ${t('referrals.used', 'used')}` : ''}
              </li>
            ))}
          </ul>
        </div>
      )}
    </section>
  );
}
