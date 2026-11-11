/**
 * Customers → Leads: the business's own email address (backend
 * routes/marketplace/email_inbox.py) and the "remind me about waiting
 * customers" switch (lead_nudge.py). Customer emails themselves appear as
 * cards on the leads board below, with their suggested reply.
 *
 * Hidden entirely when the server has no inbound email domain set up.
 */
import React, { useCallback, useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import axios from 'axios';
import { toast } from 'sonner';
import { Mail, Copy, BellRing, ChevronDown } from 'lucide-react';

const chip = 'px-3 min-h-[36px] inline-flex items-center gap-1 rounded-lg border text-xs font-semibold bg-white';
const chipStyle = { borderColor: 'var(--brand-border)', color: 'var(--ink)' };

export default function InboxCard({ API, auth, businessId, onChange }) {
  const { t } = useTranslation();
  const [s, setS] = useState(null);
  const [showHow, setShowHow] = useState(false);
  const [showFiltered, setShowFiltered] = useState(false);
  const base = `${API}/marketplace/businesses/${businessId}`;
  const load = useCallback(() => axios.get(`${base}/inbox`, auth).then(({ data }) => setS(data)).catch(() => setS(false)), [base, auth]);
  useEffect(() => { setS(null); load(); }, [load]);
  if (!s || !s.address) return null;

  const copy = async () => {
    try { await navigator.clipboard.writeText(s.address); toast.success(t('inbox.copied', 'Address copied')); } catch { /* the address is on screen to copy by hand */ }
  };
  const nudge = async (on) => {
    setS({ ...s, nudge_on: on });
    try {
      await axios.put(`${base}/lead-nudge`, { on }, auth);
      toast.success(on ? t('inbox.nudgeOn', 'Reminders are on') : t('inbox.nudgeOff', 'Reminders are off'));
    } catch { toast.error(t('inbox.failed', 'That did not save. Try again.')); load(); }
  };
  const status = async (id, value) => {
    try { await axios.post(`${base}/inbox/${id}/status`, { status: value }, auth); load(); if (onChange) onChange(); } catch { toast.error(t('inbox.failed', 'That did not save. Try again.')); }
  };

  return (
    <section className="rounded-2xl border p-4 mb-4" style={{ borderColor: 'var(--brand-border)', background: 'var(--surface, #F9FAFB)' }} data-testid="inbox-card">
      <div className="flex gap-3 items-start">
        <Mail size={20} className="shrink-0 mt-0.5" style={{ color: 'var(--gold)' }} aria-hidden="true" />
        <div className="min-w-0 flex-1">
          <h3 className="text-sm font-semibold" style={{ color: 'var(--ink)' }}>{t('inbox.title', 'Your business email address')}</h3>
          <p className="text-xs mt-1" style={{ color: 'var(--brand-muted)' }}>
            {t('inbox.body', 'Forward customer emails here, or add this address in CC. We keep spam out, put each customer on your leads board below, and write a reply from what your page says. Nothing is sent until you press Send.')}
          </p>
          <div className="flex flex-wrap items-center gap-2 mt-2">
            <code className="px-3 py-2 rounded-lg border bg-white text-sm break-all" style={{ borderColor: 'var(--brand-border)', color: 'var(--ink)' }} dir="ltr" data-testid="inbox-address">{s.address}</code>
            <button type="button" onClick={copy} className={chip} style={chipStyle} data-testid="inbox-copy"><Copy size={14} /> {t('inbox.copy', 'Copy')}</button>
            <button type="button" onClick={() => setShowHow(!showHow)} aria-expanded={showHow} className={chip} style={chipStyle}>
              {t('inbox.howTo', 'How to forward automatically')} <ChevronDown size={14} style={{ transform: showHow ? 'rotate(180deg)' : 'none' }} />
            </button>
          </div>
          {showHow && (
            <ul className="text-xs mt-2 space-y-1 list-disc ps-5" style={{ color: 'var(--ink)' }}>
              <li>{t('inbox.gmail')}</li>
              <li>{t('inbox.outlook')}</li>
              <li>{t('inbox.byHand')}</li>
            </ul>
          )}

          {s.setup.map((c) => (
            <div key={c.id} className="mt-3 rounded-xl border bg-white p-3" style={{ borderColor: 'var(--ink)' }} data-testid="inbox-confirm">
              <p className="text-sm font-semibold" style={{ color: 'var(--ink)' }}>{t('inbox.confirmTitle', 'Gmail is asking you to confirm forwarding')}</p>
              {c.code && <p className="text-sm mt-1" style={{ color: 'var(--ink)' }}>{t('inbox.confirmCode', { code: c.code, defaultValue: 'Your code: {{code}}' })}</p>}
              <div className="flex flex-wrap gap-2 mt-2">
                {c.link && <a href={c.link} target="_blank" rel="noopener noreferrer" className="px-4 min-h-[40px] inline-flex items-center rounded-full text-sm font-semibold" style={{ background: 'var(--action)', color: 'var(--action-ink)' }}>{t('inbox.confirmOpen', 'Confirm in Gmail')}</a>}
                <button type="button" onClick={() => status(c.id, 'done')} className={chip} style={chipStyle}>{t('inbox.confirmDone', 'Done')}</button>
              </div>
            </div>
          ))}

          <label className="flex items-center justify-between gap-3 min-h-[44px] cursor-pointer mt-3 pt-3 border-t" style={{ borderColor: 'var(--brand-border)' }}>
            <span className="flex items-center gap-2 text-sm font-semibold" style={{ color: 'var(--ink)' }}><BellRing size={16} style={{ color: 'var(--gold)' }} aria-hidden="true" />{t('inbox.nudgeTitle', 'Remind me about waiting customers')}</span>
            <input type="checkbox" role="switch" checked={!!s.nudge_on} onChange={(e) => nudge(e.target.checked)} className="w-5 h-5 shrink-0" style={{ accentColor: 'var(--gold)' }} data-testid="lead-nudge-on" />
          </label>
          <p className="text-xs" style={{ color: 'var(--brand-muted)' }}>{t('inbox.nudgeBody', 'If a customer waits more than an hour for your answer, we email you with a reply ready to send. Daytime only.')}</p>

          <div className="flex flex-wrap items-center gap-x-4 gap-y-1 mt-2 text-xs" style={{ color: 'var(--brand-muted)' }}>
            <span>{t('inbox.drafts', { used: s.drafts_today, cap: s.drafts_cap, defaultValue: 'Suggested replies today: {{used}} of {{cap}}' })}</span>
            {s.filtered.length > 0 && (
              <button type="button" onClick={() => setShowFiltered(!showFiltered)} className="underline min-h-[36px]" style={{ color: 'var(--ink)' }} aria-expanded={showFiltered}>
                {t('inbox.filtered', { count: s.filtered.length })} · {showFiltered ? t('inbox.hide', 'Hide') : t('inbox.show', 'Show')}
              </button>
            )}
          </div>
          {showFiltered && (
            <ul className="mt-2 space-y-1" data-testid="inbox-filtered">
              {s.filtered.map((f) => (
                <li key={f.id} className="flex items-center justify-between gap-2 rounded-lg border bg-white px-3 py-1.5" style={{ borderColor: 'var(--brand-border)' }}>
                  <span className="min-w-0 text-xs truncate" style={{ color: 'var(--ink)' }} dir="auto"><b>{f.from_name || f.from_email}</b> · {f.subject}</span>
                  <button type="button" onClick={() => status(f.id, 'open')} className={chip} style={chipStyle}>{t('inbox.notSpam', 'Not spam')}</button>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>
    </section>
  );
}
