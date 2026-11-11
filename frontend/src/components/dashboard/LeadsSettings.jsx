/**
 * Customers → Leads: the three things a business can switch on for its
 * enquiries, in one short row above the board so the board stays the first
 * thing seen (Tzvi, 11 Nov 2026: "easy to control and find").
 *
 *   Business email   its own address to forward customer emails to
 *                    (backend email_inbox.py). Hidden when the server has no
 *                    inbound domain.
 *   Reminders        "a customer is waiting" with a reply ready (lead_nudge.py)
 *   Automatic reply  "we got your message" in the chat (away_reply.py)
 *
 * Each button shows whether it is on and opens its own panel; one panel at a
 * time. Gmail's "confirm forwarding" request is shown on its own, above the
 * row, because forwarding does not start until it is clicked.
 */
import React, { useCallback, useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import axios from 'axios';
import { toast } from 'sonner';
import { Mail, Copy, BellRing, MessageSquareReply, ChevronDown } from 'lucide-react';
import AwayReplyCard from './AwayReplyCard';

const chip = 'px-3 min-h-[36px] inline-flex items-center gap-1 rounded-lg border text-xs font-semibold bg-white';
const chipStyle = { borderColor: 'var(--brand-border)', color: 'var(--ink)' };

export default function LeadsSettings({ API, auth, businessId, onChange }) {
  const { t } = useTranslation();
  const [inbox, setInbox] = useState(null);
  const [away, setAway] = useState(null);
  const [panel, setPanel] = useState(null);
  const [showFiltered, setShowFiltered] = useState(false);
  const base = `${API}/marketplace/businesses/${businessId}`;
  const load = useCallback(() => {
    axios.get(`${base}/inbox`, auth).then(({ data }) => setInbox(data)).catch(() => setInbox(false));
    axios.get(`${base}/away-reply`, auth).then(({ data }) => setAway(data)).catch(() => setAway(false));
  }, [base, auth]);
  useEffect(() => { setInbox(null); setAway(null); setPanel(null); load(); }, [load]);
  if (inbox === null && away === null) return null;

  const hasEmail = !!(inbox && inbox.address);
  const copy = async () => {
    try { await navigator.clipboard.writeText(inbox.address); toast.success(t('inbox.copied', 'Address copied')); } catch { /* the address is on screen */ }
  };
  const nudge = async (on) => {
    setInbox({ ...inbox, nudge_on: on });
    try {
      await axios.put(`${base}/lead-nudge`, { on }, auth);
      toast.success(on ? t('inbox.nudgeOn', 'Reminders are on') : t('inbox.nudgeOff', 'Reminders are off'));
    } catch { toast.error(t('inbox.failed', 'That did not save. Try again.')); load(); }
  };
  const status = async (id, value) => {
    try { await axios.post(`${base}/inbox/${id}/status`, { status: value }, auth); load(); if (onChange) onChange(); } catch { toast.error(t('inbox.failed', 'That did not save. Try again.')); }
  };

  const on = t('leadsSettings.on', 'On');
  const off = t('leadsSettings.off', 'Off');
  const buttons = [
    hasEmail && { id: 'email', Icon: Mail, label: t('leadsSettings.email', 'Business email'),
      state: inbox.received_any ? on : t('leadsSettings.setUp', 'Set up'), call: !inbox.received_any },
    inbox && { id: 'remind', Icon: BellRing, label: t('leadsSettings.remind', 'Reminders'), state: inbox.nudge_on ? on : off },
    away && { id: 'auto', Icon: MessageSquareReply, label: t('leadsSettings.auto', 'Automatic reply'), state: away.on ? on : off },
  ].filter(Boolean);

  return (
    <div className="mb-4" data-testid="leads-settings">
      {hasEmail && inbox.setup.map((c) => (
        <div key={c.id} className="mb-3 rounded-xl border bg-white p-3" style={{ borderColor: 'var(--ink)' }} data-testid="inbox-confirm">
          <p className="text-sm font-semibold" style={{ color: 'var(--ink)' }}>{t('inbox.confirmTitle', 'Gmail is asking you to confirm forwarding')}</p>
          {c.code && <p className="text-sm mt-1" style={{ color: 'var(--ink)' }}>{t('inbox.confirmCode', { code: c.code, defaultValue: 'Your code: {{code}}' })}</p>}
          <div className="flex flex-wrap gap-2 mt-2">
            {c.link && <a href={c.link} target="_blank" rel="noopener noreferrer" className="px-4 min-h-[40px] inline-flex items-center rounded-full text-sm font-semibold" style={{ background: 'var(--action)', color: 'var(--action-ink)' }}>{t('inbox.confirmOpen', 'Confirm in Gmail')}</a>}
            <button type="button" onClick={() => status(c.id, 'done')} className={chip} style={chipStyle}>{t('inbox.confirmDone', 'Done')}</button>
          </div>
        </div>
      ))}

      <div className="flex flex-wrap gap-2" role="group" aria-label={t('leadsSettings.label', 'Settings for your enquiries')}>
        {buttons.map(({ id, Icon, label, state, call }) => (
          <button key={id} type="button" onClick={() => setPanel(panel === id ? null : id)} aria-expanded={panel === id}
                  className="inline-flex items-center gap-1.5 px-3 min-h-[40px] rounded-full border text-sm bg-white"
                  style={{ borderColor: panel === id || call ? 'var(--ink)' : 'var(--brand-border)', color: 'var(--ink)' }} data-testid={`leads-setting-${id}`}>
            <Icon size={15} style={{ color: 'var(--gold)' }} aria-hidden="true" />
            <span className="font-semibold">{label}</span>
            <span className="text-xs" style={{ color: call ? 'var(--gold)' : 'var(--brand-muted)', fontWeight: call ? 700 : 400 }}>· {state}</span>
            <ChevronDown size={14} style={{ transform: panel === id ? 'rotate(180deg)' : 'none' }} aria-hidden="true" />
          </button>
        ))}
      </div>

      {panel === 'email' && hasEmail && (
        <section className="rounded-2xl border p-4 mt-3" style={{ borderColor: 'var(--brand-border)', background: 'var(--surface, #F9FAFB)' }} data-testid="inbox-card">
          <p className="text-xs" style={{ color: 'var(--brand-muted)' }}>
            {t('inbox.body', 'Forward customer emails here, or add this address in CC. We keep spam out, put each customer on your leads board below, and write a reply from what your page says. Nothing is sent until you press Send.')}
          </p>
          <div className="flex flex-wrap items-center gap-2 mt-2">
            <code className="px-3 py-2 rounded-lg border bg-white text-sm break-all" style={{ borderColor: 'var(--brand-border)', color: 'var(--ink)' }} dir="ltr" data-testid="inbox-address">{inbox.address}</code>
            <button type="button" onClick={copy} className={chip} style={chipStyle} data-testid="inbox-copy"><Copy size={14} /> {t('inbox.copy', 'Copy')}</button>
          </div>
          <p className="text-xs font-semibold mt-3" style={{ color: 'var(--ink)' }}>{t('inbox.howTo', 'How to forward automatically')}</p>
          <ul className="text-xs mt-1 space-y-1 list-disc ps-5" style={{ color: 'var(--ink)' }}>
            <li>{t('inbox.gmail')}</li>
            <li>{t('inbox.outlook')}</li>
            <li>{t('inbox.byHand')}</li>
          </ul>
          <div className="flex flex-wrap items-center gap-x-4 gap-y-1 mt-3 text-xs" style={{ color: 'var(--brand-muted)' }}>
            <span>{t('inbox.drafts', { used: inbox.drafts_today, cap: inbox.drafts_cap, defaultValue: 'Suggested replies today: {{used}} of {{cap}}' })}</span>
            {inbox.filtered.length > 0 && (
              <button type="button" onClick={() => setShowFiltered(!showFiltered)} className="underline min-h-[36px]" style={{ color: 'var(--ink)' }} aria-expanded={showFiltered}>
                {t('inbox.filtered', { count: inbox.filtered.length })} · {showFiltered ? t('inbox.hide', 'Hide') : t('inbox.show', 'Show')}
              </button>
            )}
          </div>
          {showFiltered && (
            <ul className="mt-2 space-y-1" data-testid="inbox-filtered">
              {inbox.filtered.map((f) => (
                <li key={f.id} className="flex items-center justify-between gap-2 rounded-lg border bg-white px-3 py-1.5" style={{ borderColor: 'var(--brand-border)' }}>
                  <span className="min-w-0 text-xs truncate" style={{ color: 'var(--ink)' }} dir="auto"><b>{f.from_name || f.from_email}</b> · {f.subject}</span>
                  <button type="button" onClick={() => status(f.id, 'open')} className={chip} style={chipStyle}>{t('inbox.notSpam', 'Not spam')}</button>
                </li>
              ))}
            </ul>
          )}
        </section>
      )}

      {panel === 'remind' && inbox && (
        <section className="rounded-2xl border p-4 mt-3" style={{ borderColor: 'var(--brand-border)', background: 'var(--surface, #F9FAFB)' }}>
          <label className="flex items-center justify-between gap-3 min-h-[44px] cursor-pointer">
            <span className="text-sm font-semibold" style={{ color: 'var(--ink)' }}>{t('inbox.nudgeTitle', 'Remind me about waiting customers')}</span>
            <input type="checkbox" role="switch" checked={!!inbox.nudge_on} onChange={(e) => nudge(e.target.checked)} className="w-5 h-5 shrink-0" style={{ accentColor: 'var(--gold)' }} data-testid="lead-nudge-on" />
          </label>
          <p className="text-xs" style={{ color: 'var(--brand-muted)' }}>{t('inbox.nudgeBody', 'If a customer waits more than an hour for your answer, we email you with a reply ready to send. Daytime only.')}</p>
        </section>
      )}

      {panel === 'auto' && (
        <div className="mt-3"><AwayReplyCard API={API} auth={auth} businessId={businessId} onSaved={(s) => setAway({ ...away, ...s })} /></div>
      )}
    </div>
  );
}
