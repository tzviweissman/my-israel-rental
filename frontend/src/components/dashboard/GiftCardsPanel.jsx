/**
 * Discounts → Gift cards (backend routes/marketplace/gift_cards.py).
 * Folded to one line until opened. Inside: the on/off switch, the amounts
 * and how to pay, the link to the buying page, cards waiting for payment
 * (Mark paid), selling one at the counter, and using a card at the counter.
 */
import React, { useCallback, useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import axios from 'axios';
import { toast } from 'sonner';
import { Loader2, Gift, ChevronDown, ChevronUp, Copy } from 'lucide-react';
import { money } from '../../utils/currency';

const box = 'px-3 py-2 rounded-lg border text-sm bg-white min-h-[40px]';
const boxStyle = { borderColor: 'var(--brand-border)', color: 'var(--ink)' };
const solid = { background: 'var(--action)', color: 'var(--action-ink)' };

function CardRow({ c, base, auth, onChanged }) {
  const { t } = useTranslation();
  const [use, setUse] = useState('');
  const [busy, setBusy] = useState('');
  const act = async (what, body) => {
    setBusy(what);
    try {
      await axios.post(`${base}/${c.id}/${what}`, body || {}, auth);
      toast.success(what === 'paid' ? t('giftBiz.paidOk', 'Marked paid. The card was emailed with its code.') : what === 'use' ? t('giftBiz.usedOk', 'Taken off the card.') : t('giftBiz.cancelledOk', 'Cancelled.'));
      setUse('');
      onChanged();
    } catch (err) { toast.error(err?.response?.data?.detail || t('auto.failed', 'Could not save. Try again.')); } finally { setBusy(''); }
  };
  const who = c.to?.name ? t('giftBiz.forFrom', 'for {{to}}, from {{from}}', { to: c.to.name, from: c.buyer.name }) : c.buyer.name;
  const st = { awaiting_payment: t('giftBiz.st.waiting', 'Waiting for payment'), active: t('giftBiz.st.active', 'Active'), used_up: t('giftBiz.st.usedUp', 'Used up'), expired: t('giftBiz.st.expired', 'Expired') }[c.status] || c.status;
  return (
    <li className="rounded-xl border bg-white p-3 text-sm" style={{ borderColor: c.status === 'awaiting_payment' ? 'var(--ink)' : 'var(--brand-border)', color: 'var(--ink)' }} data-testid="gift-row">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <span className="font-semibold tabular-nums">{money(c.balance, 'ILS')}{c.balance !== c.amount && <span className="font-normal text-xs" style={{ color: 'var(--brand-muted)' }}> / {money(c.amount, 'ILS')}</span>}</span>
        <span className="text-xs" style={{ color: 'var(--brand-muted)' }}>{st}</span>
      </div>
      <p className="text-xs mt-0.5" dir="auto" style={{ color: 'var(--brand-muted)' }}>{who}{c.buyer.email ? ` · ${c.buyer.email}` : ''}{c.buyer.phone ? ` · ${c.buyer.phone}` : ''}</p>
      {c.code && <p className="text-xs font-bold tracking-wider mt-1" dir="ltr">{c.code}</p>}
      {c.status === 'awaiting_payment' && (
        <div className="flex gap-2 mt-2">
          <button type="button" disabled={!!busy} onClick={() => act('paid')} className="inline-flex items-center gap-1.5 px-4 min-h-[40px] rounded-full text-sm font-semibold disabled:opacity-60" style={solid} data-testid="gift-mark-paid">
            {busy === 'paid' && <Loader2 size={13} className="animate-spin" />} {t('giftBiz.markPaid', 'Mark paid and send')}
          </button>
          <button type="button" disabled={!!busy} onClick={() => act('cancel')} className="px-3 min-h-[40px] text-sm underline" style={{ color: 'var(--brand-muted)' }}>{t('giftBiz.cancel', 'Cancel order')}</button>
        </div>
      )}
      {c.status === 'active' && (
        <div className="flex flex-wrap items-center gap-2 mt-2">
          <input type="number" min="1" max={c.balance} step="any" value={use} onChange={(e) => setUse(e.target.value)} className={`${box} w-28`} style={boxStyle}
                 placeholder="₪" aria-label={t('giftBiz.useAmount', 'Amount to take off')} data-testid="gift-use-amount" />
          <button type="button" disabled={!!busy || !(Number(use) > 0)} onClick={() => act('use', { amount: Number(use) })} className="px-3.5 min-h-[40px] rounded-full border text-sm font-semibold disabled:opacity-50" style={boxStyle} data-testid="gift-use">
            {t('giftBiz.use', 'Use at the counter')}
          </button>
        </div>
      )}
    </li>
  );
}

export default function GiftCardsPanel({ API, auth, businessId, slug }) {
  const { t, i18n } = useTranslation();
  const [d, setD] = useState(null);
  const [open, setOpen] = useState(false);
  const [st, setSt] = useState(null);
  const [saving, setSaving] = useState(false);
  const [sell, setSell] = useState({ amount: '', to_name: '', email: '' });
  const base = `${API}/marketplace/businesses/${businessId}/gift-cards`;
  const load = useCallback(() => axios.get(base, auth).then(({ data }) => { setD(data); setSt((s) => s || { ...data.settings, amountsText: data.settings.amounts.join(', ') }); }).catch(() => setD(false)), [base, auth]);
  useEffect(() => { setSt(null); load(); }, [load]);
  if (!d) return null;
  const waiting = d.cards.filter((c) => c.status === 'awaiting_payment').length;
  const link = `${window.location.origin}/gift-cards/${slug || businessId}`;

  const save = async (patch) => {
    const next = { ...st, ...patch };
    const amounts = String(next.amountsText).split(/[,\s]+/).map(Number).filter((n) => n > 0);
    setSaving(true);
    try {
      const { data } = await axios.put(`${API}/marketplace/businesses/${businessId}/gift-card-settings`, { on: next.on, amounts, custom: next.custom, note: next.note || '' }, auth);
      setSt({ ...data, amountsText: data.amounts.join(', ') });
      toast.success(t('giftBiz.saved', 'Saved'));
    } catch (err) {
      const det = err?.response?.data?.detail;
      toast.error(Array.isArray(det) ? (det[0]?.msg || '').replace(/^Value error, /, '') : det || t('auto.failed', 'Could not save. Try again.'));
    } finally { setSaving(false); }
  };
  const sellNow = async () => {
    setSaving(true);
    try {
      await axios.post(base, { amount: Math.round(Number(sell.amount)), to_name: sell.to_name || null, email: sell.email || null, lang: i18n.language?.startsWith('he') ? 'he' : 'en' }, auth);
      toast.success(t('giftBiz.soldOk', 'Gift card made. Its code is in the list.'));
      setSell({ amount: '', to_name: '', email: '' });
      load();
    } catch (err) { toast.error(err?.response?.data?.detail || t('auto.failed', 'Could not save. Try again.')); } finally { setSaving(false); }
  };

  return (
    <section className="rounded-2xl border bg-white mb-4" style={{ borderColor: 'var(--brand-border)' }} data-testid="gift-cards-panel">
      <button type="button" onClick={() => setOpen(!open)} aria-expanded={open} className="w-full flex items-center justify-between gap-2 p-3 text-start">
        <span className="inline-flex items-center gap-2 text-sm font-semibold" style={{ color: 'var(--ink)' }}>
          <Gift size={16} /> {t('giftBiz.title', 'Gift cards')}
          <span className="font-normal text-xs" style={{ color: 'var(--brand-muted)' }}>
            {st?.on ? (waiting ? t('giftBiz.waitingN', '{{n}} waiting for payment', { n: waiting }) : t('giftBiz.onShort', 'On sale')) : t('giftBiz.offShort', 'Off')}
            {d.outstanding > 0 ? ` · ${t('giftBiz.outstanding', '{{v}} on active cards', { v: money(d.outstanding, 'ILS') })}` : ''}
          </span>
        </span>
        {open ? <ChevronUp size={15} /> : <ChevronDown size={15} />}
      </button>
      {open && st && (
        <div className="px-3 pb-4 space-y-5 text-sm" style={{ color: 'var(--ink)' }}>
          <label className="flex items-center justify-between gap-3">
            <span>{t('giftBiz.sell', 'Sell gift cards on my page')}</span>
            <button type="button" role="switch" aria-checked={!!st.on} disabled={saving} onClick={() => save({ on: !st.on })} data-testid="gift-switch"
                    className="relative w-10 h-6 rounded-full shrink-0" style={{ background: st.on ? 'var(--ink)' : '#D1D5DB' }}>
              <span className="absolute top-0.5 w-5 h-5 rounded-full bg-white" style={{ insetInlineStart: st.on ? '18px' : '2px' }} />
            </button>
          </label>
          <div className="grid gap-3 sm:grid-cols-2">
            <label className="block">{t('giftBiz.amounts', 'Amounts (₪, separated by commas)')}
              <input value={st.amountsText} onChange={(e) => setSt({ ...st, amountsText: e.target.value })} className={`${box} w-full mt-1`} style={boxStyle} dir="ltr" data-testid="gift-amounts" />
            </label>
            <label className="flex items-center gap-2 sm:mt-6">
              <input type="checkbox" checked={!!st.custom} onChange={(e) => setSt({ ...st, custom: e.target.checked })} /> {t('giftBiz.custom', 'Let buyers choose another amount')}
            </label>
          </div>
          <label className="block">{t('giftBiz.note', 'How to pay you (shown to the buyer)')}
            <textarea rows={2} maxLength={400} dir="auto" value={st.note || ''} onChange={(e) => setSt({ ...st, note: e.target.value })} className={`${box} w-full mt-1`} style={boxStyle}
                      placeholder={t('giftBiz.notePh', 'For example: Bit to 050-1234567, or pay at the shop')} />
            <span className="block text-xs mt-1" style={{ color: 'var(--brand-muted)' }}>{t('giftBiz.noteHint', 'Your payment links (Bit, PayBox) from your business details show too.')}</span>
          </label>
          <button type="button" disabled={saving} onClick={() => save({})} className="inline-flex items-center gap-1.5 px-4 min-h-[40px] rounded-full text-sm font-semibold disabled:opacity-60" style={solid} data-testid="gift-save">
            {saving && <Loader2 size={13} className="animate-spin" />} {t('giftBiz.save', 'Save')}
          </button>
          {st.on && (
            <div className="flex flex-wrap items-center gap-2 text-xs rounded-lg p-2.5" style={{ background: '#F9FAFB' }}>
              <span style={{ color: 'var(--brand-muted)' }}>{t('giftBiz.link', 'Your gift card page:')}</span>
              <a href={link} target="_blank" rel="noopener noreferrer" dir="ltr" className="underline break-all" style={{ color: 'var(--gold)' }}>{link}</a>
              <button type="button" className="grid place-content-center w-9 h-9" aria-label={t('discounts.copy', 'Copy')} onClick={() => navigator.clipboard?.writeText(link).then(() => toast.success(t('discounts.copied', 'Copied')))}><Copy size={13} /></button>
            </div>
          )}

          <div>
            <p className="font-semibold mb-1">{t('giftBiz.sellCounter', 'Sold one in person?')}</p>
            <div className="flex flex-wrap gap-2">
              <input type="number" min="20" max="5000" value={sell.amount} onChange={(e) => setSell({ ...sell, amount: e.target.value })} className={`${box} w-24`} style={boxStyle} placeholder="₪" data-testid="gift-sell-amount" />
              <input value={sell.to_name} maxLength={80} onChange={(e) => setSell({ ...sell, to_name: e.target.value })} className={`${box} flex-1 min-w-[8rem]`} style={boxStyle} placeholder={t('giftBiz.sellName', 'Name (optional)')} />
              <input type="email" value={sell.email} maxLength={200} onChange={(e) => setSell({ ...sell, email: e.target.value })} className={`${box} flex-1 min-w-[10rem]`} style={boxStyle} placeholder={t('giftBiz.sellEmail', 'Email it to (optional)')} />
              <button type="button" disabled={saving || !(Number(sell.amount) >= 20)} onClick={sellNow} className="px-4 min-h-[40px] rounded-full border text-sm font-semibold disabled:opacity-50" style={boxStyle} data-testid="gift-sell">
                {t('giftBiz.make', 'Make the card')}
              </button>
            </div>
          </div>

          {d.cards.length > 0 && (
            <ul className="space-y-2">{d.cards.slice(0, 50).map((c) => <CardRow key={c.id} c={c} base={base} auth={auth} onChanged={load} />)}</ul>
          )}
        </div>
      )}
    </section>
  );
}
