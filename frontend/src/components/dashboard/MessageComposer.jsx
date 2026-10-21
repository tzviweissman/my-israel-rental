/**
 * Customers → Email customers (backend routes/marketplace/customer_messages.py).
 * Pick a group, write, send yourself a test, then send. Shows how many
 * will receive it before anything goes out.
 */
import React, { useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import axios from 'axios';
import { toast } from 'sonner';
import { Loader2, Send, X } from 'lucide-react';

const field = 'w-full px-3 py-2 rounded-lg border text-sm bg-white min-h-[44px]';
const fieldStyle = { borderColor: 'var(--brand-border)', color: 'var(--ink)' };
const btnOutline = 'inline-flex items-center gap-1.5 px-4 min-h-[44px] rounded-full border text-sm font-semibold disabled:opacity-50';

export default function MessageComposer({ API, auth, businessId, tags, initialKind, initialTag, initial, onClose }) {
  const { t, i18n } = useTranslation();
  const [kind, setKind] = useState(initial?.kind || initialKind || 'all');
  const [days, setDays] = useState(initial?.days || 90);
  const [tag, setTag] = useState(initialTag || '');
  const [subject, setSubject] = useState(initial?.subject || '');
  const [body, setBody] = useState(initial?.body || '');
  // A ready-made message is about the business, so it is marked as one; the owner can untick it.
  const [promo, setPromo] = useState(!!initial);
  const [lang, setLang] = useState(initial?.lang || (String(i18n.language || 'en').startsWith('he') ? 'he' : 'en'));
  const [pv, setPv] = useState(null);
  const [busy, setBusy] = useState('');
  const [history, setHistory] = useState([]);
  const audience = useMemo(() => ({ kind, tag: tag || null, days }), [kind, tag, days]);
  const base = `${API}/marketplace/businesses/${businessId}/messages`;

  useEffect(() => {
    setPv(null);
    axios.post(`${base}/preview`, audience, auth).then(({ data }) => setPv(data)).catch(() => setPv(false));
  }, [base, audience, auth]);
  const loadHistory = () => axios.get(base, auth).then(({ data }) => setHistory(data)).catch(() => {});
  useEffect(() => { loadHistory(); }, [base]); // eslint-disable-line react-hooks/exhaustive-deps

  const msg = { subject: subject.trim(), body: body.trim(), promo, lang, audience };
  // The parts of a ready-made message only the business can write (backend: _UNFILLED).
  const unfilled = /\[[^\]\n]{3,}\]/.test(`${msg.subject}\n${msg.body}`);
  const ready = msg.subject.length >= 2 && msg.body.length >= 2;
  // A ready-made message still as we wrote it follows the language picked.
  const changeLang = (next) => {
    if (initial?.make) {
      const was = initial.make(lang);
      if (subject === was.subject && body === was.body) {
        const now = initial.make(next);
        setSubject(now.subject); setBody(now.body);
      }
    }
    setLang(next);
  };
  const err = (e) => toast.error(e?.response?.data?.detail || t('messages.failed', 'Could not send. Try again.'));

  const test = async () => {
    setBusy('test');
    try {
      const { data } = await axios.post(`${base}/test`, msg, auth);
      if (data.sent) toast.success(t('messages.testSent', 'Test sent to {{email}}', { email: data.to }));
      else toast.error(t('messages.testFailed', 'The test could not be sent.'));
    } catch (e) { err(e); } finally { setBusy(''); }
  };
  const send = async () => {
    if (!window.confirm(t('messages.confirm', 'Send this email to {{n}} people? It cannot be taken back.', { n: pv?.will_receive || 0 }))) return;
    setBusy('send');
    try {
      const { data } = await axios.post(base, msg, auth);
      toast.success(t('messages.sending', 'Sending to {{n}} people.', { n: data.recipients }));
      setSubject(''); setBody(''); setPromo(false);
      setTimeout(loadHistory, 1500);
    } catch (e) { err(e); } finally { setBusy(''); }
  };

  const kinds = [['all', t('customers.kind.all', 'Everyone')], ['orders', t('customers.kind.orders', 'Ordered')],
    ['active_members', t('customers.kind.activeMembers', 'Active members')], ['members', t('messages.allMembers', 'All members, past and present')],
    ['bookings', t('customers.kind.bookings', 'Booked')],
    ['lapsed', t('messages.lapsedKind', 'Not back in a while')]];
  const fmt = (s) => (s ? new Intl.DateTimeFormat(i18n.language?.startsWith('he') ? 'he-IL' : 'en-GB', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' }).format(new Date(s)) : '');

  return (
    <section className="rounded-2xl border bg-white p-4 mb-4 space-y-3" style={{ borderColor: 'var(--brand-border)' }} data-testid="message-composer">
      <div className="flex items-center justify-between gap-2">
        <h3 className="text-base font-semibold" style={{ color: 'var(--ink)' }}>{t('messages.title', 'Email your customers')}</h3>
        <button type="button" className="grid place-content-center w-11 h-11" aria-label={t('customers.close', 'Close')} onClick={onClose}><X size={18} /></button>
      </div>

      <div className="grid gap-2 sm:grid-cols-2">
        <label className="text-sm" style={{ color: 'var(--ink)' }}>{t('messages.to', 'To')}
          <select value={kind} onChange={(e) => setKind(e.target.value)} className={`${field} mt-1`} style={fieldStyle} data-testid="message-kind">
            {kinds.map(([k, l]) => <option key={k} value={k}>{l}</option>)}
          </select>
        </label>
        {kind === 'lapsed' && (
          <label className="text-sm" style={{ color: 'var(--ink)' }}>{t('messages.lapsedFor', 'Last came more than')}
            <select value={days} onChange={(e) => setDays(Number(e.target.value))} className={`${field} mt-1`} style={fieldStyle} data-testid="message-days">
              {[60, 90, 180, 365].map((d) => <option key={d} value={d}>{t('messages.daysAgo', '{{count}} days ago', { count: d })}</option>)}
            </select>
          </label>
        )}
        {tags.length > 0 && (
          <label className="text-sm" style={{ color: 'var(--ink)' }}>{t('messages.withTag', 'With the tag')}
            <select value={tag} onChange={(e) => setTag(e.target.value)} className={`${field} mt-1`} style={fieldStyle}>
              <option value="">{t('customers.anyTag', 'Any tag')}</option>
              {tags.map((tg) => <option key={tg} value={tg}>{tg}</option>)}
            </select>
          </label>
        )}
      </div>
      <p className="text-sm" style={{ color: 'var(--ink)' }} data-testid="message-count">
        {pv === null ? <Loader2 size={14} className="animate-spin inline" /> : pv === false ? null : (
          <>
            <b>{t('messages.willReceive', '{{n}} will receive it', { n: pv.will_receive })}</b>
            {(pv.no_email > 0 || pv.unsubscribed > 0) && (
              <span style={{ color: 'var(--brand-muted)' }}>
                {' · '}{t('messages.skipped', '{{a}} have no email, {{b}} unsubscribed', { a: pv.no_email, b: pv.unsubscribed })}
              </span>
            )}
            <span className="block text-xs" style={{ color: 'var(--brand-muted)' }}>
              {t('messages.allowance', 'Up to {{max}} people a message. {{left}} left this month.', { max: pv.max_per_send, left: pv.left_this_month })}
            </span>
          </>
        )}
      </p>

      <input value={subject} maxLength={120} onChange={(e) => setSubject(e.target.value)} className={field} style={fieldStyle}
             placeholder={t('messages.subject', 'Subject')} aria-label={t('messages.subject', 'Subject')} dir="auto" data-testid="message-subject" />
      <textarea rows={initial ? 10 : 7} maxLength={5000} value={body} onChange={(e) => setBody(e.target.value)} className={field} style={fieldStyle}
                placeholder={t('messages.bodyPh', 'Your message. For example: the new class schedule, holiday opening hours, or a new menu.')}
                aria-label={t('messages.body', 'Message')} dir="auto" data-testid="message-body" />
      <div className="flex flex-wrap gap-4 text-sm" style={{ color: 'var(--ink)' }}>
        <label className="inline-flex items-start gap-2 min-h-[44px]">
          <input type="checkbox" className="mt-1" checked={promo} onChange={(e) => setPromo(e.target.checked)} data-testid="message-promo" />
          <span>{t('messages.promo', 'This is a promotion (a sale, an offer, an advert)')}
            <span className="block text-xs" style={{ color: 'var(--brand-muted)' }}>{t('messages.promoWhy', 'The law requires the subject to start with “Advertisement”. We add it.')}</span>
          </span>
        </label>
        <label className="inline-flex items-center gap-2 min-h-[44px]">
          {t('messages.lang', 'Written in')}
          <select value={lang} onChange={(e) => changeLang(e.target.value)} className="px-2 py-1 rounded-lg border text-sm bg-white" style={fieldStyle}>
            <option value="he">עברית</option>
            <option value="en">English</option>
          </select>
        </label>
      </div>
      {unfilled && (
        <p className="text-sm rounded-lg px-3 py-2" style={{ background: 'var(--gold-soft, rgba(36,175,235,.12))', color: 'var(--ink)' }} data-testid="message-unfilled">
          {t('messages.unfilled', 'Replace the parts in [square brackets] with your own words. Sending is possible once they are gone.')}
        </p>
      )}
      <p className="text-xs" style={{ color: 'var(--brand-muted)' }}>
        {t('messages.rules', 'Sent from your business name. Replies come to your email. Every email has an unsubscribe link, and anyone who unsubscribes is never emailed by you again. Only email people who bought from you or agreed to hear from you.')}
      </p>
      <div className="flex flex-wrap gap-2">
        <button type="button" disabled={!ready || !!busy} onClick={test} className={btnOutline} style={fieldStyle} data-testid="message-test">
          {busy === 'test' && <Loader2 size={14} className="animate-spin" />} {t('messages.test', 'Send me a test')}
        </button>
        <button type="button" disabled={!ready || unfilled || !!busy || !pv || !pv.will_receive} onClick={send}
                className="inline-flex items-center gap-1.5 px-5 min-h-[44px] rounded-full text-sm font-semibold disabled:opacity-50"
                style={{ background: 'var(--action)', color: 'var(--action-ink)' }} data-testid="message-send">
          {busy === 'send' ? <Loader2 size={14} className="animate-spin" /> : <Send size={14} />} {t('messages.send', 'Send')}
        </button>
      </div>

      {history.length > 0 && (
        <div className="pt-2 border-t" style={{ borderColor: 'var(--brand-border)' }}>
          <p className="text-sm font-semibold mb-1" style={{ color: 'var(--ink)' }}>{t('messages.history', 'Sent')}</p>
          <ul className="space-y-1">
            {history.map((h) => (
              <li key={h.id} className="text-xs flex justify-between gap-2" style={{ color: 'var(--ink)' }}>
                <span className="truncate" dir="auto">{h.subject}</span>
                <span className="shrink-0" style={{ color: 'var(--brand-muted)' }}>
                  {h.status === 'sending' ? t('messages.stillSending', 'sending…') : t('messages.sentTo', '{{n}} sent', { n: h.sent })} · {fmt(h.created_at)}
                </span>
              </li>
            ))}
          </ul>
        </div>
      )}
    </section>
  );
}
