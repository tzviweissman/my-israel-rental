/**
 * "Have a question?" on a business page (backend routes/marketplace/ask.py):
 * an instant answer from what the business wrote on the site, and when it
 * is not sure, the question goes to the business as a lead. No sign-in.
 */
import React, { useState } from 'react';
import { useTranslation } from 'react-i18next';
import axios from 'axios';
import { Loader2, MessageCircleQuestion, Send } from 'lucide-react';
import { API } from '../../App';

const field = 'w-full px-3 min-h-[44px] rounded-lg border text-sm bg-white';
const line = { borderColor: 'var(--brand-border)' };

export default function AskBusiness({ biz, className = '' }) {
  const { t, i18n } = useTranslation();
  const he = String(i18n.language || '').startsWith('he');
  const name = (he && biz.name_he) || biz.name;
  const [q, setQ] = useState('');
  const [busy, setBusy] = useState(false);
  const [res, setRes] = useState(null);          // {question, answer, known} | {error}
  const [fwd, setFwd] = useState(false);
  const [who, setWho] = useState({ name: '', contact: '' });
  const [fwdState, setFwdState] = useState(null); // 'sending' | 'sent' | error text

  const ask = async (e) => {
    e.preventDefault();
    const question = q.trim();
    if (question.length < 3) return;
    setBusy(true); setFwd(false); setFwdState(null);
    try {
      const { data } = await axios.post(`${API}/marketplace/business/${encodeURIComponent(biz.slug || biz.id)}/ask`, { question, lang: he ? 'he' : 'en' });
      setRes({ question, ...data });
      if (!data.known) setFwd(true);
    } catch (err) {
      setRes({ question, error: err?.response?.status === 429
        ? t('ask.tooMany', 'That is a lot of questions. Try again a little later, or send this one to the business.')
        : t('ask.failed', 'We could not answer that right now. You can send the question to the business.') });
      setFwd(true);
    }
    setBusy(false);
  };

  const send = async (e) => {
    e.preventDefault();
    setFwdState('sending');
    try {
      await axios.post(`${API}/marketplace/business/${encodeURIComponent(biz.slug || biz.id)}/ask/forward`,
        { question: res.question, name: who.name.trim(), contact: who.contact.trim() });
      setFwdState('sent');
    } catch (err) {
      setFwdState(err?.response?.status === 422
        ? t('ask.badContact', 'Add a phone number or an email address so they can answer you.')
        : t('ask.sendFailed', 'That did not send. Try again.'));
    }
  };

  return (
    <section className={`rounded-2xl border p-4 sm:p-5 ${className}`} style={{ ...line, background: 'var(--surface, #F9FAFB)' }} data-testid="ask-business">
      <h2 className="text-xl font-bold flex items-center gap-2" style={{ color: 'var(--ink)', fontFamily: 'var(--font-head)' }}>
        <MessageCircleQuestion size={22} style={{ color: 'var(--gold)' }} aria-hidden="true" />
        {t('ask.title', 'Have a question?')}
      </h2>
      <p className="text-sm mt-1 mb-3" style={{ color: 'var(--brand-muted)' }}>
        {t('ask.body', 'Ask anything about {{name}} and get an answer straight away, from what they have written here.', { name })}
      </p>
      <form onSubmit={ask} className="flex gap-2">
        <input value={q} onChange={(e) => setQ(e.target.value)} maxLength={300} dir="auto" className={field} style={line}
               aria-label={t('ask.label', 'Your question')} placeholder={t('ask.placeholder', 'For example: do you deliver to my area?')}
               data-testid="ask-input" />
        <button type="submit" disabled={busy || q.trim().length < 3}
                className="shrink-0 min-h-[44px] px-5 rounded-full text-sm font-bold inline-flex items-center gap-2 disabled:opacity-50"
                style={{ background: 'var(--action)', color: 'var(--action-ink)' }} data-testid="ask-send">
          {busy ? <Loader2 size={16} className="animate-spin" aria-hidden="true" /> : null}
          {t('ask.ask', 'Ask')}
        </button>
      </form>

      <div aria-live="polite">
        {res && (
          <div className="mt-3 rounded-xl border p-3 bg-white" style={line} data-testid="ask-answer">
            <p className="text-sm whitespace-pre-line" dir="auto" style={{ color: 'var(--ink)' }}>{res.error || res.answer}</p>
            {!res.error && (
              <p className="text-xs mt-2" style={{ color: 'var(--brand-muted)' }}>
                {t('ask.automatic', 'An automatic answer from their page. Check anything important with them.')}
                {res.known && !fwd && (
                  <> <button type="button" onClick={() => setFwd(true)} className="underline font-semibold min-h-[44px] sm:min-h-0" style={{ color: 'var(--ink)' }} data-testid="ask-forward-open">
                    {t('ask.stillAsk', 'Ask them yourself')}
                  </button></>
                )}
              </p>
            )}
          </div>
        )}

        {res && fwd && fwdState !== 'sent' && (
          <form onSubmit={send} className="mt-3 grid gap-2 sm:grid-cols-[1fr_1fr_auto]" data-testid="ask-forward">
            <p className="text-sm sm:col-span-3" style={{ color: 'var(--ink)' }}>
              {t('ask.forwardTitle', 'Send your question to {{name}}. They will answer you directly.', { name })}
            </p>
            <input value={who.name} onChange={(e) => setWho({ ...who, name: e.target.value })} required maxLength={80} dir="auto"
                   className={field} style={line} aria-label={t('ask.yourName', 'Your name')} placeholder={t('ask.yourName', 'Your name')} data-testid="ask-name" />
            <input value={who.contact} onChange={(e) => setWho({ ...who, contact: e.target.value })} required minLength={5} maxLength={80} dir="ltr"
                   className={field} style={line} aria-label={t('ask.contact', 'Phone or email')} placeholder={t('ask.contact', 'Phone or email')} data-testid="ask-contact" />
            <button type="submit" disabled={fwdState === 'sending'}
                    className="min-h-[44px] px-5 rounded-full text-sm font-bold inline-flex items-center justify-center gap-2 disabled:opacity-50 btn-accent" data-testid="ask-forward-send">
              <Send size={15} aria-hidden="true" /> {t('ask.send', 'Send')}
            </button>
            {fwdState && fwdState !== 'sending' && <p className="text-xs sm:col-span-3" style={{ color: '#B42318' }} role="alert">{fwdState}</p>}
          </form>
        )}
        {fwdState === 'sent' && (
          <p className="mt-3 text-sm font-semibold" style={{ color: '#2E7D4F' }} data-testid="ask-forward-done">
            {t('ask.sent', 'Sent. {{name}} will get back to you.', { name })}
          </p>
        )}
      </div>
    </section>
  );
}
