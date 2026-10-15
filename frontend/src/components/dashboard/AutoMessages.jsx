/**
 * Members → Automatic messages (backend routes/marketplace/member_messages.py):
 * welcome, renewal reminder, class reminder, "we haven't seen you". Each
 * on or off, with its own timing and, if the business wants, its own words.
 * Collapsed to one line until opened.
 */
import React, { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import axios from 'axios';
import { toast } from 'sonner';
import { Loader2, ChevronDown, ChevronUp, MailCheck } from 'lucide-react';

const TRIGGERS = ['welcome', 'renewal', 'class', 'winback'];
const field = 'w-full px-3 py-2 rounded-lg border text-sm bg-white min-h-[44px]';
const fieldStyle = { borderColor: 'var(--brand-border)', color: 'var(--ink)' };

export default function AutoMessages({ API, auth, businessId }) {
  const { t, i18n } = useTranslation();
  const lang = String(i18n.language || 'en').startsWith('he') ? 'he' : 'en';
  const [open, setOpen] = useState(false);
  const [s, setS] = useState(null);
  const [own, setOwn] = useState({});
  const [busy, setBusy] = useState('');
  const base = `${API}/marketplace/businesses/${businessId}/member-messages`;

  useEffect(() => {
    if (!open) return;
    axios.get(base, { ...auth, params: { lang } }).then(({ data }) => {
      setS(data);
      setOwn(Object.fromEntries(TRIGGERS.map((tr) => [tr, !!(data[tr].text || data[tr].subject)])));
    }).catch(() => setS(false));
  }, [open, base, auth, lang]);

  const upd = (tr, patch) => setS({ ...s, [tr]: { ...s[tr], ...patch } });
  const save = async () => {
    setBusy('save');
    try {
      const body = Object.fromEntries(TRIGGERS.map((tr) => [tr, {
        on: s[tr].on, days: s[tr].days ?? null, hours: s[tr].hours ?? null,
        subject: own[tr] ? s[tr].subject || '' : '', text: own[tr] ? s[tr].text || '' : '',
      }]));
      const { data } = await axios.put(base, body, { ...auth, params: { lang } });
      setS(data);
      toast.success(t('auto.saved', 'Saved'));
    } catch { toast.error(t('auto.failed', 'Could not save. Try again.')); } finally { setBusy(''); }
  };
  const test = async (tr) => {
    setBusy(tr);
    try {
      const { data } = await axios.post(`${base}/${tr}/test`, null, { ...auth, params: { lang } });
      if (data.sent) toast.success(t('messages.testSent', 'Test sent to {{email}}', { email: data.to }));
      else toast.error(t('messages.testFailed', 'The test could not be sent.'));
    } catch (e) { toast.error(e?.response?.data?.detail || t('auto.failed', 'Could not save. Try again.')); } finally { setBusy(''); }
  };
  const when = (tr) => ({
    welcome: t('auto.when.welcome', 'When a membership is activated'),
    renewal: t('auto.when.renewal', 'Before a membership renews'),
    class: t('auto.when.class', 'Before a class someone booked'),
    winback: t('auto.when.winback', 'When an active member has not come for a while'),
  }[tr]);

  return (
    <section className="rounded-2xl border bg-white" style={{ borderColor: 'var(--brand-border)' }} data-testid="auto-messages">
      <button type="button" onClick={() => setOpen(!open)} className="w-full flex items-center justify-between gap-2 p-4 text-start min-h-[44px]" aria-expanded={open}>
        <span className="flex items-center gap-2 text-sm font-semibold" style={{ color: 'var(--ink)' }}><MailCheck size={16} aria-hidden="true" /> {t('auto.title', 'Automatic messages to members')}</span>
        {open ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
      </button>
      {open && (
        <div className="px-4 pb-4 space-y-3">
          <p className="text-xs" style={{ color: 'var(--brand-muted)' }}>{t('auto.body', 'Sent by email on their own, in each member’s language. Only to members who gave an email. You can use {name}, {business}, {plan}, {date}, {class} and {time} in your own words.')}</p>
          {s === null ? <Loader2 className="animate-spin" size={16} /> : s === false ? null : (
            <>
              {TRIGGERS.map((tr) => (
                <div key={tr} className="rounded-xl border p-3 space-y-2" style={{ borderColor: 'var(--brand-border)' }} data-testid={`auto-${tr}`}>
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <p className="text-sm font-semibold" style={{ color: 'var(--ink)' }}>{t(`auto.name.${tr}`, tr)}</p>
                      <p className="text-xs" style={{ color: 'var(--brand-muted)' }}>{when(tr)}</p>
                    </div>
                    <label className="shrink-0 inline-flex items-center gap-2 text-sm min-h-[44px]" style={{ color: 'var(--ink)' }}>
                      <input type="checkbox" checked={!!s[tr].on} onChange={(e) => upd(tr, { on: e.target.checked })} data-testid={`auto-on-${tr}`} />
                      {t('auto.on', 'On')}
                    </label>
                  </div>
                  {s[tr].on && (
                    <>
                      {tr === 'renewal' && (
                        <label className="flex items-center gap-2 text-sm" style={{ color: 'var(--ink)' }}>
                          <input type="number" min="1" max="30" value={s[tr].days ?? 3} onChange={(e) => upd(tr, { days: Number(e.target.value) })} className="w-20 px-2 py-1.5 rounded-lg border text-sm" style={fieldStyle} />
                          {t('auto.daysBefore', 'days before')}
                        </label>
                      )}
                      {tr === 'class' && (
                        <label className="flex items-center gap-2 text-sm" style={{ color: 'var(--ink)' }}>
                          <input type="number" min="1" max="24" value={s[tr].hours ?? 3} onChange={(e) => upd(tr, { hours: Number(e.target.value) })} className="w-20 px-2 py-1.5 rounded-lg border text-sm" style={fieldStyle} />
                          {t('auto.hoursBefore', 'hours before')}
                        </label>
                      )}
                      {tr === 'winback' && (
                        <>
                          <label className="flex items-center gap-2 text-sm" style={{ color: 'var(--ink)' }}>
                            {t('auto.after', 'After')}
                            <input type="number" min="7" max="120" value={s[tr].days ?? 21} onChange={(e) => upd(tr, { days: Number(e.target.value) })} className="w-20 px-2 py-1.5 rounded-lg border text-sm" style={fieldStyle} />
                            {t('auto.daysNoVisit', 'days without a visit')}
                          </label>
                          <p className="text-xs" style={{ color: 'var(--brand-muted)' }}>{t('auto.winbackNote', 'This one invites people back, so it carries an unsubscribe link and skips anyone who unsubscribed.')}</p>
                        </>
                      )}
                      <label className="inline-flex items-center gap-2 text-xs min-h-[36px]" style={{ color: 'var(--ink)' }}>
                        <input type="checkbox" checked={!!own[tr]} onChange={(e) => setOwn({ ...own, [tr]: e.target.checked })} /> {t('auto.ownWords', 'Use my own words')}
                      </label>
                      {own[tr] ? (
                        <>
                          <input value={s[tr].subject || ''} maxLength={150} onChange={(e) => upd(tr, { subject: e.target.value })} className={field} style={fieldStyle}
                                 placeholder={s[tr].default_subject} aria-label={t('messages.subject', 'Subject')} dir="auto" />
                          <textarea rows={4} maxLength={3000} value={s[tr].text || ''} onChange={(e) => upd(tr, { text: e.target.value })} className={field} style={fieldStyle}
                                    placeholder={s[tr].default_text} aria-label={t('messages.body', 'Message')} dir="auto" />
                        </>
                      ) : (
                        <p className="text-xs whitespace-pre-line rounded-lg p-2" style={{ background: 'var(--surface-muted, #F9FAFB)', color: 'var(--ink)' }}>
                          <b>{s[tr].default_subject}</b>{'\n'}{s[tr].default_text}
                        </p>
                      )}
                      <button type="button" disabled={!!busy} onClick={() => test(tr)} className="text-xs underline" style={{ color: 'var(--ink)' }}>
                        {busy === tr ? <Loader2 size={12} className="animate-spin inline" /> : t('messages.test', 'Send me a test')}
                      </button>
                    </>
                  )}
                </div>
              ))}
              <button type="button" disabled={!!busy} onClick={save} className="inline-flex items-center gap-1.5 px-5 min-h-[44px] rounded-full text-sm font-semibold disabled:opacity-60"
                      style={{ background: 'var(--action)', color: 'var(--action-ink)' }} data-testid="auto-save">
                {busy === 'save' && <Loader2 size={14} className="animate-spin" />} {t('auto.save', 'Save')}
              </button>
            </>
          )}
        </div>
      )}
    </section>
  );
}
