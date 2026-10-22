/**
 * Pieces for prices customers accept (Tzvi, 22 Oct 2026, backend quotes.py):
 * a price broken into lines, sending the price link on WhatsApp / text /
 * email, a price the business sends first, and a payment request from an
 * accepted price (payment_requests.py).
 */
import React, { useState } from 'react';
import { useTranslation } from 'react-i18next';
import axios from 'axios';
import { toast } from 'sonner';
import { Copy, Loader2, MessageCircle, Plus, Trash2, Banknote } from 'lucide-react';
import { money } from '../../utils/currency';

const box = 'px-3 py-2 rounded-lg border text-sm bg-white min-h-[44px]';
const boxStyle = { borderColor: 'var(--brand-border)', color: 'var(--ink)' };

export const linesTotal = (lines) => lines.reduce((s, l) => s + (Number(l.amount) || 0), 0);
export const cleanLines = (lines) => lines.filter((l) => l.label.trim() && Number(l.amount) > 0)
  .map((l) => ({ label: l.label.trim(), amount: Number(l.amount) }));

/** Rows of "what" and "₪". Empty means a single price is used instead. */
export function LinesEditor({ lines, setLines }) {
  const { t } = useTranslation();
  const set = (i, k, v) => setLines(lines.map((l, j) => (j === i ? { ...l, [k]: v } : l)));
  return (
    <div className="space-y-2" data-testid="quote-lines">
      {lines.map((l, i) => (
        <div key={i} className="flex gap-2 items-center">
          <input value={l.label} maxLength={80} onChange={(e) => set(i, 'label', e.target.value)} dir="auto"
                 placeholder={t('quoteSend.linePh', 'For example: two movers, 4 hours')} aria-label={t('quoteSend.lineLabel', 'What')}
                 className={`${box} flex-1 min-w-0`} style={boxStyle} />
          <input type="number" min="1" inputMode="decimal" value={l.amount} onChange={(e) => set(i, 'amount', e.target.value)}
                 aria-label={t('quoteSend.lineAmount', 'Amount in shekels')} placeholder="₪" className={`${box} w-24`} style={boxStyle} />
          <button type="button" onClick={() => setLines(lines.filter((_, j) => j !== i))} className="grid place-content-center w-11 h-11 shrink-0"
                  aria-label={t('quoteSend.removeLine', 'Remove this line')}><Trash2 size={15} /></button>
        </div>
      ))}
      <div className="flex items-center justify-between gap-2">
        <button type="button" onClick={() => setLines([...lines, { label: '', amount: '' }])}
                className="inline-flex items-center gap-1 min-h-[44px] text-sm font-semibold underline underline-offset-4" style={{ color: 'var(--gold)' }}>
          <Plus size={14} /> {lines.length ? t('quoteSend.addLine', 'Add a line') : t('quoteSend.breakDown', 'Break the price into lines')}
        </button>
        {lines.length > 0 && <span className="text-sm font-semibold" style={{ color: 'var(--ink)' }}>{t('quoteSend.total', 'Total')} {money(linesTotal(lines), 'ILS')}</span>}
      </div>
    </div>
  );
}

/** Send a ready message (`message`, with the link in it) on WhatsApp, text or email, or copy it. */
export function ShareRow({ item, subject }) {
  const { t } = useTranslation();
  if (!item?.message) return null;
  const copy = async () => {
    try { await navigator.clipboard.writeText(item.message); toast.success(t('quoteSend.copied', 'Copied')); } catch { toast.error(item.message); }
  };
  const pill = 'inline-flex items-center gap-1.5 px-4 min-h-[44px] rounded-full border text-sm font-semibold';
  return (
    <div className="flex flex-wrap gap-2">
      <a href={`https://wa.me/${item.whatsapp_to || ''}?text=${encodeURIComponent(item.message)}`} target="_blank" rel="noopener noreferrer"
         className="inline-flex items-center gap-1.5 px-4 min-h-[44px] rounded-full text-sm font-semibold" style={{ background: 'var(--action)', color: 'var(--action-ink)' }} data-testid="share-whatsapp">
        <MessageCircle size={15} /> {t('quoteSend.whatsapp', 'Send on WhatsApp')}
      </a>
      {item.phone && <a href={`sms:${item.phone}?&body=${encodeURIComponent(item.message)}`} className={pill} style={boxStyle}>{t('quoteSend.sms', 'Text message')}</a>}
      {item.email && <a href={`mailto:${item.email}?subject=${encodeURIComponent(subject || '')}&body=${encodeURIComponent(item.message)}`} className={pill} style={boxStyle}>{t('quoteSend.email', 'Email')}</a>}
      <button type="button" onClick={copy} className={pill} style={boxStyle}><Copy size={14} /> {t('quoteSend.copy', 'Copy the message')}</button>
    </div>
  );
}

/** From an accepted price: a payment request for the same amount, ready to send. */
export function PayFromQuote({ API, auth, q }) {
  const { t } = useTranslation();
  const [busy, setBusy] = useState(false);
  const [made, setMade] = useState(null);
  const go = async () => {
    setBusy(true);
    try {
      const { data } = await axios.post(`${API}/marketplace/businesses/${q.business_id}/payment-requests`, {
        amount: q.quote.price, description: (q.gig_title || q.description || '').slice(0, 160).trim() || t('quoteSend.theJob', 'The job'),
        customer_name: q.name, customer_phone: q.phone || null, customer_email: q.email || null, lang: q.lang || 'he',
      }, auth);
      setMade({ ...data, phone: q.phone, email: q.email });
    } catch (err) {
      // The server's "add a payment link first" is in English; say it in the owner's language.
      const noLinks = err?.response?.status === 400 && /payment link/i.test(err?.response?.data?.detail || '');
      toast.error(noLinks ? t('payReq.needLinks') : (err?.response?.data?.detail || t('quoteSend.failed', 'Something went wrong. Try again.')));
    } finally { setBusy(false); }
  };
  if (made) {
    return (
      <div className="rounded-lg p-3 space-y-2" style={{ background: '#F9FAFB' }}>
        <p className="text-sm whitespace-pre-line" dir="auto">{made.message}</p>
        <ShareRow item={made} subject={t('payReq.mailSubject', 'Payment request')} />
      </div>
    );
  }
  return (
    <button type="button" onClick={go} disabled={busy} className="inline-flex items-center gap-1.5 px-4 min-h-[44px] rounded-full border text-sm font-semibold disabled:opacity-50"
            style={boxStyle} data-testid={`quote-pay-${q.id}`}>
      {busy ? <Loader2 size={14} className="animate-spin" /> : <Banknote size={14} />} {t('quoteSend.requestPayment', 'Request payment for {{amount}}', { amount: money(q.quote.price, 'ILS') })}
    </button>
  );
}

/** A price the business sends first, after a call or a visit. */
export function NewQuoteForm({ API, auth, businessId, onDone, onClose }) {
  const { t, i18n } = useTranslation();
  const [f, setF] = useState({ name: '', phone: '', email: '', description: '', price: '', note: '', valid_days: 14,
    lang: String(i18n.language || '').startsWith('he') ? 'he' : 'en' });
  const [lines, setLines] = useState([]);
  const [busy, setBusy] = useState(false);
  const [made, setMade] = useState(null);
  const set = (k) => (e) => setF({ ...f, [k]: e.target.value });
  const total = lines.length ? linesTotal(cleanLines(lines)) : Number(f.price);
  const ready = f.name.trim().length >= 2 && f.description.trim().length >= 2 && total > 0;
  const send = async (e) => {
    e.preventDefault();
    setBusy(true);
    try {
      const { data } = await axios.post(`${API}/marketplace/businesses/${businessId}/quotes`, {
        ...f, phone: f.phone || null, email: f.email || null, price: lines.length ? null : Number(f.price),
        lines: cleanLines(lines), valid_days: Number(f.valid_days),
      }, auth);
      setMade(data);
      onDone();
    } catch (err) {
      toast.error(err?.response?.data?.detail || t('quoteSend.failed', 'Something went wrong. Try again.'));
    } finally { setBusy(false); }
  };
  const label = 'text-sm';
  if (made) {
    return (
      <div className="rounded-xl border bg-white p-4 space-y-2 mb-3" style={{ borderColor: 'var(--brand-border)' }} data-testid="quote-new-made">
        <p className="text-sm font-semibold" style={{ color: '#2E7D4F' }}>{t('quoteSend.ready', 'Your price is ready to send')}</p>
        <p className="text-sm whitespace-pre-line" dir="auto" style={{ color: 'var(--ink)' }}>{made.message}</p>
        <ShareRow item={made} subject={t('quoteSend.mailSubject', 'Your price')} />
        <button type="button" onClick={onClose} className="text-sm underline min-h-[44px]" style={{ color: 'var(--brand-muted)' }}>{t('quoteSend.done', 'Done')}</button>
      </div>
    );
  }
  return (
    <form onSubmit={send} className="rounded-xl border bg-white p-4 space-y-3 mb-3" style={{ borderColor: 'var(--brand-border)', color: 'var(--ink)' }} data-testid="quote-new-form">
      <p className="text-sm" style={{ color: 'var(--brand-muted)' }}>
        {t('quoteSend.body', 'After a call or a visit: send the price as a link. The customer sees the details and accepts with one tap, and you are told.')}
      </p>
      <div className="grid gap-2 sm:grid-cols-3">
        <label className={label}>{t('quoteSend.name', 'Customer name')}
          <input value={f.name} maxLength={80} onChange={set('name')} className={`${box} w-full mt-1`} style={boxStyle} dir="auto" required data-testid="quote-new-name" />
        </label>
        <label className={label}>{t('quoteSend.phone', 'Phone, for WhatsApp (optional)')}
          <input type="tel" value={f.phone} maxLength={40} onChange={set('phone')} className={`${box} w-full mt-1`} style={boxStyle} dir="ltr" />
        </label>
        <label className={label}>{t('quoteSend.emailField', 'Email (optional, we email the price too)')}
          <input type="email" value={f.email} maxLength={200} onChange={set('email')} className={`${box} w-full mt-1`} style={boxStyle} dir="ltr" />
        </label>
      </div>
      <label className={`${label} block`}>{t('quoteSend.job', 'The job')}
        <input value={f.description} maxLength={2000} onChange={set('description')} className={`${box} w-full mt-1`} style={boxStyle} dir="auto" required
               placeholder={t('quoteSend.jobPh', 'Moving a 3 room flat, Haifa to Tel Aviv, 3rd floor without a lift')} data-testid="quote-new-job" />
      </label>
      {!lines.length && (
        <label className={`${label} inline-flex items-center gap-2`}>{t('quotes.price', 'Price ₪')}
          <input type="number" min="1" value={f.price} onChange={set('price')} className={`${box} w-32`} style={boxStyle} data-testid="quote-new-price" />
        </label>
      )}
      <LinesEditor lines={lines} setLines={setLines} />
      <textarea rows={2} maxLength={1000} dir="auto" value={f.note} onChange={set('note')} className={`${box} w-full`} style={boxStyle}
                placeholder={t('quotes.notePh', 'What the price includes, e.g. two movers, half a day')} />
      <div className="flex flex-wrap gap-3 items-center">
        <label className={`${label} inline-flex items-center gap-2`}>{t('quotes.valid', 'Holds for')}
          <select value={f.valid_days} onChange={set('valid_days')} className={box} style={boxStyle}>
            {[3, 7, 14, 30].map((d) => <option key={d} value={d}>{t('quotes.days', '{{n}} days', { n: d })}</option>)}
          </select>
        </label>
        <label className={`${label} inline-flex items-center gap-2`}>{t('quoteSend.lang', 'Written in')}
          <select value={f.lang} onChange={set('lang')} className={box} style={boxStyle}>
            <option value="he">עברית</option>
            <option value="en">English</option>
          </select>
        </label>
      </div>
      <div className="flex gap-2">
        <button type="submit" disabled={!ready || busy} className="inline-flex items-center gap-1.5 px-5 min-h-[44px] rounded-full text-sm font-semibold disabled:opacity-50"
                style={{ background: 'var(--action)', color: 'var(--action-ink)' }} data-testid="quote-new-send">
          {busy && <Loader2 size={14} className="animate-spin" />} {t('quoteSend.make', 'Make the price link')}
        </button>
        <button type="button" onClick={onClose} className="px-3 min-h-[44px] text-sm underline" style={{ color: 'var(--brand-muted)' }}>{t('quoteSend.cancel', 'Cancel')}</button>
      </div>
    </form>
  );
}
