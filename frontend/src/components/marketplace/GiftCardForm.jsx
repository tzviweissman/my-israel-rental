/**
 * The gift card order form (backend routes/marketplace/gift_cards.py): amount as tiles, then who it is for and
 * a message. Used by the /gift-cards/:slug page and, in place, on the business's own page (GiftCardPanel), so a
 * customer never has to leave it (Tzvi, 5 Nov 2026). Designed sites have their own copy of this flow in
 * scrollcraft/starter/gift.js.
 */
import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import axios from 'axios';
import { Loader2, Check } from 'lucide-react';
import { API } from '../../lib/apiBase';
import { money, symbolFor } from '../../utils/currency';
import PayLinks from '../forms/PayLinks';

const field = 'w-full px-3 py-2 rounded-lg border text-base bg-white min-h-[48px]';
const fieldStyle = { borderColor: 'var(--brand-border)', color: 'var(--ink)' };

export default function GiftCardForm({ slug, data, onDone }) {
  const { t, i18n } = useTranslation();
  const lang = String(i18n.language || 'en').split('-')[0];
  const [amount, setAmount] = useState(data.amounts[Math.min(1, data.amounts.length - 1)]);
  const [other, setOther] = useState('');
  const [forSelf, setForSelf] = useState(false);
  const [form, setForm] = useState({ buyer_name: '', buyer_email: '', buyer_phone: '', to_name: '', to_email: '', message: '' });
  const [sending, setSending] = useState(false);
  const [error, setError] = useState('');

  const set = (k) => (e) => setForm({ ...form, [k]: e.target.value });
  const chosen = amount === 'other' ? Number(other) : amount;
  const amountOk = Number.isFinite(chosen) && chosen >= data.min && chosen <= data.max;

  const submit = async (e) => {
    e.preventDefault();
    setError('');
    setSending(true);
    try {
      const { data: r } = await axios.post(`${API}/marketplace/gift-cards/${encodeURIComponent(slug)}/buy`, {
        amount: Math.round(chosen), buyer_name: form.buyer_name.trim(), buyer_email: form.buyer_email.trim(),
        buyer_phone: form.buyer_phone.trim() || null, for_self: forSelf,
        to_name: forSelf ? null : form.to_name.trim(), to_email: forSelf ? null : (form.to_email.trim() || null),
        message: forSelf ? null : (form.message.trim() || null), lang: lang === 'he' ? 'he' : 'en',
      });
      onDone(r);
    } catch (err) {
      const d = err?.response?.data?.detail;
      setError(typeof d === 'string' ? d : Array.isArray(d) ? (d[0]?.msg || '').replace(/^Value error, /, '') : t('gift.failed', 'Could not send. Check your details and try again.'));
    } finally { setSending(false); }
  };

  return (
    <form onSubmit={submit} className="space-y-6">
      <fieldset>
        <legend className="text-sm font-semibold mb-2" style={{ color: 'var(--ink)' }}>{t('gift.amount', 'Amount')}</legend>
        <div className="grid grid-cols-3 gap-2">
          {data.amounts.map((a) => {
            const on = amount === a;
            return (
              <button key={a} type="button" onClick={() => setAmount(a)} aria-pressed={on} data-testid={`gift-amount-${a}`}
                      className="relative rounded-2xl border bg-white min-h-[64px] text-lg font-bold tabular-nums"
                      style={{ borderColor: on ? 'var(--ink)' : 'var(--brand-border)', boxShadow: on ? '0 0 0 1px var(--ink)' : 'none', color: 'var(--ink)' }}>
                {on && <Check size={15} className="absolute top-2 end-2" />}{money(a, data.currency)}
              </button>
            );
          })}
          {data.custom && (
            <button type="button" onClick={() => setAmount('other')} aria-pressed={amount === 'other'} data-testid="gift-amount-other"
                    className="rounded-2xl border bg-white min-h-[64px] text-sm font-semibold"
                    style={{ borderColor: amount === 'other' ? 'var(--ink)' : 'var(--brand-border)', boxShadow: amount === 'other' ? '0 0 0 1px var(--ink)' : 'none', color: 'var(--ink)' }}>
              {t('gift.other', 'Other amount')}
            </button>
          )}
        </div>
        {amount === 'other' && (
          <input type="number" inputMode="numeric" min={data.min} max={data.max} value={other} onChange={(e) => setOther(e.target.value)} autoFocus
                 className={`${field} mt-2`} style={fieldStyle} aria-label={t('gift.other', 'Other amount')} placeholder={t('gift.otherPh', '{{s}}{{a}} to {{s}}{{b}}', { s: symbolFor(data.currency), a: data.min, b: data.max })} data-testid="gift-other" />
        )}
      </fieldset>

      <fieldset className="space-y-3">
        <legend className="text-sm font-semibold mb-2" style={{ color: 'var(--ink)' }}>{t('gift.forWho', 'Who is it for?')}</legend>
        <div className="inline-flex rounded-full border p-1" style={{ borderColor: 'var(--brand-border)' }} role="group">
          {[[false, t('gift.someoneElse', 'Someone else')], [true, t('gift.myself', 'Myself')]].map(([v, label]) => (
            <button key={String(v)} type="button" onClick={() => setForSelf(v)} aria-pressed={forSelf === v} className="px-4 min-h-[40px] rounded-full text-sm font-semibold"
                    style={forSelf === v ? { background: 'var(--ink)', color: 'var(--action-ink)' } : { color: 'var(--brand-muted)' }}>{label}</button>
          ))}
        </div>
        {!forSelf && (
          <>
            <input required minLength={2} maxLength={80} value={form.to_name} onChange={set('to_name')} className={field} style={fieldStyle} aria-label={t('gift.toName', 'Their name')} placeholder={t('gift.toName', 'Their name')} data-testid="gift-to-name" />
            <input type="email" maxLength={200} value={form.to_email} onChange={set('to_email')} className={field} style={fieldStyle} aria-label={t('gift.toEmail', 'Their email, to send it to them (optional)')} placeholder={t('gift.toEmail', 'Their email, to send it to them (optional)')} data-testid="gift-to-email" />
            <textarea maxLength={400} rows={3} dir="auto" value={form.message} onChange={set('message')} className={field} style={fieldStyle} aria-label={t('gift.message', 'A message on the card (optional)')} placeholder={t('gift.message', 'A message on the card (optional)')} />
            <p className="text-xs" style={{ color: 'var(--brand-muted)' }}>{t('gift.noEmailNote', 'Without their email, the card comes to you to pass on.')}</p>
          </>
        )}
      </fieldset>

      <fieldset className="space-y-3">
        <legend className="text-sm font-semibold mb-2" style={{ color: 'var(--ink)' }}>{t('gift.yourDetails', 'Your details')}</legend>
        <input required minLength={2} maxLength={80} autoComplete="name" value={form.buyer_name} onChange={set('buyer_name')} className={field} style={fieldStyle} aria-label={t('members.name', 'Full name')} placeholder={t('members.name', 'Full name')} data-testid="gift-buyer-name" />
        <input required type="email" maxLength={200} autoComplete="email" value={form.buyer_email} onChange={set('buyer_email')} className={field} style={fieldStyle} aria-label={t('gift.buyerEmail', 'Your email')} placeholder={t('gift.buyerEmail', 'Your email')} data-testid="gift-buyer-email" />
        <input type="tel" maxLength={20} autoComplete="tel" value={form.buyer_phone} onChange={set('buyer_phone')} className={field} style={fieldStyle} aria-label={t('gift.phone', 'Phone, so the business can arrange payment (optional)')} placeholder={t('gift.phone', 'Phone, so the business can arrange payment (optional)')} />
      </fieldset>

      {error && <p className="text-sm" role="alert" style={{ color: 'var(--error-text)' }}>{error}</p>}
      <button type="submit" disabled={!amountOk || sending} className="w-full inline-flex justify-center items-center gap-2 min-h-[52px] rounded-full text-base font-semibold disabled:opacity-60"
              style={{ background: 'var(--action)', color: 'var(--action-ink)' }} data-testid="gift-submit">
        {sending && <Loader2 size={16} className="animate-spin" />}
        {amountOk ? t('gift.order', 'Order a {{v}} gift card', { v: money(chosen, data.currency) }) : t('gift.orderPlain', 'Order the gift card')}
      </button>
      <p className="text-xs text-center" style={{ color: 'var(--brand-muted)' }}>{t('members.noChargeNote', 'Nothing is charged on this site. You arrange payment with the business.')}</p>
    </form>
  );
}

// The form in place on the business's page; the customer stays there and is told how to pay when it is sent.
export function GiftCardPanel({ slug, bizName }) {
  const { t } = useTranslation();
  const [data, setData] = useState(null);
  const [done, setDone] = useState(null);

  useEffect(() => {
    axios.get(`${API}/marketplace/gift-cards/${encodeURIComponent(slug)}`).then(({ data: d }) => setData(d)).catch(() => setData(false));
  }, [slug]);

  const box = 'mt-4 max-w-xl rounded-2xl border bg-white p-5 text-start';
  const boxStyle = { borderColor: 'var(--brand-border)', color: 'var(--ink)' };
  if (data === null) return <div className={box} style={boxStyle}><Loader2 className="animate-spin" size={18} /></div>;
  if (data === false) return <p className={box} style={boxStyle} data-testid="gift-none">{t('gift.none', 'Gift cards are not on sale here right now')}</p>;
  if (done) {
    return (
      <div className={box} style={boxStyle} role="status" data-testid="gift-ordered">
        <p className="font-semibold">{t('gift.orderedTitle', 'Your gift card is ordered')}</p>
        <p className="mt-1 text-sm" style={{ color: 'var(--brand-muted)' }}>{t('gift.orderedBody', 'Pay {{name}} directly. As soon as they confirm, the card is emailed with its code.', { name: bizName })}</p>
        {data.note && <p className="mt-3 text-sm whitespace-pre-line" dir="auto">{data.note}</p>}
        <div className="mt-3"><PayLinks links={data.payment_links} testid="gift-pay-links" /></div>
        <Link to={done.path} className="mt-3 inline-block text-sm font-semibold underline" style={{ color: 'var(--gold-text-on-light, #167AB8)' }}>{t('gift.seeCard', 'See your gift card')}</Link>
      </div>
    );
  }
  return (
    <div className={box} style={boxStyle} data-testid="gift-panel">
      <p className="text-sm mb-5" style={{ color: 'var(--brand-muted)' }}>{t('gift.body', 'Choose an amount and who it is for. You pay the business directly; once they confirm, the card is emailed with its code. Valid for {{y}} years.', { y: data.valid_years })}</p>
      <GiftCardForm slug={slug} data={data} onDone={setDone} />
    </div>
  );
}
