/**
 * /members/:token: the member's own pass. The link is the credential (no
 * account), like the order tracking page. It shows whether they can come
 * in, renewal or visits left, and the QR the door scans. The QR holds a
 * separate check-in code, so it is not a key to this page.
 */
import React, { useCallback, useEffect, useState } from 'react';
import { Link, useParams, useSearchParams } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import axios from 'axios';
import { QRCodeSVG } from 'qrcode.react';
import { Loader2, IdCard, CheckCircle2 } from 'lucide-react';
import { API } from '../lib/apiBase';
import { planPrice, planVisits, stateLabel } from '../components/members/memberText';
import { money } from '../utils/currency';

export default function MemberPassPage() {
  const { token } = useParams();
  const [params] = useSearchParams();
  const { t, i18n } = useTranslation();
  const lang = String(i18n.language || 'en').split('-')[0];
  const [d, setD] = useState(null);

  useEffect(() => {
    document.body.classList.add('orders-bare');
    return () => document.body.classList.remove('orders-bare');
  }, []);

  const load = useCallback(() => axios.get(`${API}/marketplace/memberships/me/${encodeURIComponent(token)}`)
    .then(({ data }) => setD(data)).catch((err) => err?.response?.status === 404 && setD(false)), [token]);
  useEffect(() => { load(); const id = setInterval(() => !document.hidden && load(), 30000); return () => clearInterval(id); }, [load]);

  const fmt = (s) => (s ? new Intl.DateTimeFormat(lang === 'he' ? 'he-IL' : 'en-GB', { day: 'numeric', month: 'long', year: 'numeric' }).format(new Date(`${s.slice(0, 10)}T00:00`)) : '');

  if (d === null) return <div className="py-24 text-center" style={{ color: 'var(--brand-muted)' }}><Loader2 className="animate-spin inline" size={20} /></div>;
  if (d === false) {
    return (
      <div className="max-w-md mx-auto px-4 py-24 text-center" data-testid="pass-bad-link">
        <IdCard size={26} className="inline mb-3" style={{ color: 'var(--brand-muted)' }} />
        <h1 className="text-lg font-bold" style={{ color: 'var(--ink)', fontFamily: 'var(--font-head)' }}>{t('members.badLink', 'This link no longer works')}</h1>
        <p className="text-sm mt-2" style={{ color: 'var(--brand-muted)' }}>{t('members.badLinkBody', 'Ask the business to send it again.')}</p>
      </div>
    );
  }
  const bizName = (lang === 'he' && d.business.name_he) || d.business.name;
  const ok = d.state.ok;
  return (
    <div className="min-h-screen" style={{ background: 'var(--bg)' }} data-testid="member-pass" data-status={d.status}>
      <main className="max-w-md mx-auto px-4 py-8">
        {params.get('joined') && (
          <div className="rounded-2xl border p-4 mb-5 flex gap-3" style={{ borderColor: 'var(--brand-border)', background: '#fff' }} data-testid="pass-joined">
            <CheckCircle2 size={22} className="shrink-0" style={{ color: 'var(--status-open, #2E7D4F)' }} />
            <div className="text-sm" style={{ color: 'var(--ink)' }}>
              <p className="font-semibold">{t('members.joinedTitle', 'You’re signed up')}</p>
              <p>{t('members.joinedBody', '{{name}} will contact you about payment and then activate your membership. Save this page: it is your membership pass.', { name: bizName })}</p>
            </div>
          </div>
        )}
        <div className="flex items-center gap-3 mb-5">
          {d.business.logo_url && <img src={d.business.logo_url} alt="" className="w-11 h-11 rounded-xl object-cover" />}
          <div className="min-w-0">
            <p className="text-[11px] uppercase tracking-wide" style={{ color: 'var(--brand-muted)' }}>{t('members.passAt', 'Membership at')}</p>
            <h1 className="text-lg font-bold truncate" style={{ color: 'var(--ink)', fontFamily: 'var(--font-head)' }}>
              {d.business.slug ? <Link to={`/business/${d.business.slug}`}>{bizName}</Link> : bizName}
            </h1>
          </div>
        </div>

        <section className="rounded-2xl border bg-white p-5 text-center" style={{ borderColor: 'var(--brand-border)' }}>
          <p className="text-xl font-bold" style={{ color: 'var(--ink)' }}>{d.name}</p>
          <p className="text-sm" style={{ color: 'var(--brand-muted)' }}>{d.plan.name} · {planPrice(t, d.plan)} · {planVisits(t, d.plan)}</p>
          {d.discount && <p className="text-sm" style={{ color: '#1F5F3A' }}>{t('discounts.passLine', 'Code {{code}}: {{amount}} off', { code: d.discount.code, amount: money(d.discount.amount, 'ILS') })}</p>}
          <p className="mt-3 inline-block px-3 py-1 rounded-full text-sm font-semibold" data-testid="pass-state"
             style={ok ? { background: '#E6F4EA', color: '#2E7D4F' } : { background: '#F3F4F6', color: 'var(--ink)' }}>
            {ok ? t('members.okToEnter', 'Active') : stateLabel(t, d.state.reason)}
          </p>
          {d.status === 'active' && (
            <div className="mt-5">
              <div className="inline-block p-3 bg-white rounded-xl border" style={{ borderColor: 'var(--brand-border)' }}>
                <QRCodeSVG value={d.checkin_url} size={200} level="M" includeMargin={false} />
              </div>
              <p className="text-sm mt-3" style={{ color: 'var(--ink)' }}>
                {t('members.showAtDoor', 'Show this at the door, or say your code:')} <b className="text-lg tracking-widest" dir="ltr">{d.short_code}</b>
              </p>
            </div>
          )}
          <dl className="mt-5 grid grid-cols-2 gap-3 text-start text-sm">
            {d.renews_on && (
              <div><dt style={{ color: 'var(--brand-muted)' }}>{d.plan.period === 'pack' ? t('members.expires', 'Expires') : t('members.renews', 'Renews')}</dt><dd className="font-semibold" style={{ color: 'var(--ink)' }}>{fmt(d.renews_on)}</dd></div>
            )}
            {d.visits_left !== null && d.visits_left !== undefined && (
              <div><dt style={{ color: 'var(--brand-muted)' }}>{t('members.visitsLeftLabel', 'Visits left')}</dt><dd className="font-semibold" style={{ color: 'var(--ink)' }}>{d.visits_left}</dd></div>
            )}
            <div><dt style={{ color: 'var(--brand-muted)' }}>{t('members.visitsSoFar', 'Visits so far')}</dt><dd className="font-semibold" style={{ color: 'var(--ink)' }}>{d.visits}</dd></div>
            {d.last_visit_at && <div><dt style={{ color: 'var(--brand-muted)' }}>{t('members.lastVisit', 'Last visit')}</dt><dd className="font-semibold" style={{ color: 'var(--ink)' }}>{fmt(d.last_visit_at)}</dd></div>}
          </dl>
        </section>
      </main>
    </div>
  );
}
