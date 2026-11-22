/**
 * "Have a code?" on the order form and the membership sign-up (backend
 * routes/marketplace/discounts.py). The check here is a preview; the
 * server checks the code again when the form is sent.
 */
import React, { useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import axios from 'axios';
import { Loader2, Check, X, Tag } from 'lucide-react';
import { API } from '../../lib/apiBase';

/** The discount a checked code gives on `amount`, the same rule as the server. */
export const discountOn = (applied, amount) => {
  if (!applied) return 0;
  const off = applied.kind === 'percent' ? (amount * applied.value) / 100 : applied.value;
  return Math.round(Math.max(0, Math.min(off, amount)) * 100) / 100;
};

export default function DiscountCodeInput({ businessId, form, amount, phone, currency, applied, onApplied, initialCode, offers = [] }) {
  const { t, i18n } = useTranslation();
  // A friend's link (?ref=CODE, backend referrals.py) opens the box with
  // the code in it and checks it once.
  const [open, setOpen] = useState(!!initialCode);
  const [code, setCode] = useState((initialCode || '').toUpperCase());
  const tried = useRef(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  const apply = async (picked) => {
    const c = typeof picked === 'string' ? picked : code;
    if (!c.trim()) return;
    if (typeof picked === 'string') setCode(picked);
    setBusy(true); setError('');
    try {
      const { data } = await axios.post(`${API}/marketplace/businesses/${businessId}/discount-codes/check`,
        { code: c.trim(), form, amount: amount || 0, phone: phone || null, currency: currency || null, lang: i18n.language });
      if (data.ok) { onApplied({ code: data.code, kind: data.kind, value: data.value }); setOpen(false); }
      else setError(data.reason);
    } catch { setError(t('discounts.checkFailed', 'Could not check the code. Try again.')); } finally { setBusy(false); }
  };

  useEffect(() => {
    if (initialCode && !applied && !tried.current) { tried.current = true; apply(); }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [initialCode]);

  if (applied) {
    return (
      <p className="flex items-center gap-2 text-sm" style={{ color: '#1F5F3A' }} data-testid="discount-applied">
        <Check size={15} /> {t('discounts.applied', 'Code {{code}} applied', { code: applied.code })}
        <button type="button" className="underline text-xs" style={{ color: 'var(--ink)' }} onClick={() => { onApplied(null); setCode(''); }}>{t('discounts.remove', 'Remove')}</button>
      </p>
    );
  }
  // The codes the business shows at checkout, one tap each (Tzvi, 22 Nov 2026: "like Shopify shops").
  const what = (o) => (o.kind === 'free_delivery' ? t('discounts.freeDelivery', 'Free delivery')
    : o.kind === 'percent' ? t('discounts.offPercent', '{{v}}% off', { v: o.value }) : t('discounts.offAmount', '{{v}} off', { v: `${o.currency === 'USD' ? '$' : '₪'}${o.value}` }));
  const chips = offers.length > 0 && (
    <div className="mt-2" data-testid="discount-offers">
      <p className="text-xs mb-1" style={{ color: 'var(--brand-muted)' }}>{t('discounts.available', 'Codes you can use')}</p>
      <div className="flex flex-wrap gap-2">
        {offers.map((o) => (
          <button key={o.code} type="button" onClick={() => apply(o.code)} disabled={busy}
                  className="inline-flex items-center gap-1.5 px-3 min-h-[44px] rounded-full border text-sm" style={{ borderColor: 'var(--ink)', color: 'var(--ink)', borderStyle: 'dashed' }}
                  data-testid={`discount-offer-${o.code}`}>
            <Tag size={13} aria-hidden="true" /> <b dir="ltr" className="tracking-wider">{o.code}</b> <span>{what(o)}{o.min_order ? ` · ${t('discounts.overShort', 'over {{n}}', { n: `${o.currency === 'USD' ? '$' : '₪'}${o.min_order}` })}` : ''}</span>
          </button>
        ))}
      </div>
    </div>
  );
  if (!open) {
    return (<>
      <button type="button" onClick={() => setOpen(true)} className="inline-flex items-center gap-1.5 text-base font-semibold underline min-h-[44px]" style={{ color: 'var(--ink)' }} data-testid="discount-open">
        <Tag size={14} /> {t('discounts.haveCode', 'Have a discount code?')}
      </button>
      {chips}
      {error && <p className="text-sm mt-1" role="alert" style={{ color: 'var(--error-text)' }} data-testid="discount-error">{error}</p>}
    </>);
  }
  return (
    <div data-testid="discount-input">
      <div className="flex gap-2">
        <input value={code} onChange={(e) => setCode(e.target.value.toUpperCase())} onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); apply(); } }}
               maxLength={24} autoCapitalize="characters" autoComplete="off" dir="ltr" placeholder={t('discounts.codePh', 'Code')}
               className="flex-1 px-3 py-2 rounded-lg border text-base bg-white min-h-[48px] tracking-wider" style={{ borderColor: 'var(--brand-border)', color: 'var(--ink)' }}
               aria-label={t('discounts.code', 'Discount code')} data-testid="discount-code" />
        <button type="button" onClick={apply} disabled={busy || !code.trim()} className="px-4 min-h-[48px] rounded-full border text-sm font-semibold disabled:opacity-50"
                style={{ borderColor: 'var(--ink)', color: 'var(--ink)' }} data-testid="discount-apply">
          {busy ? <Loader2 size={14} className="animate-spin" /> : t('discounts.apply', 'Apply')}
        </button>
        <button type="button" className="grid place-content-center w-11" aria-label={t('discounts.close', 'Close')} onClick={() => { setOpen(false); setError(''); }}><X size={16} /></button>
      </div>
      {error && <p className="text-sm mt-1" role="alert" style={{ color: 'var(--error-text)' }} data-testid="discount-error">{error}</p>}
      {chips}
    </div>
  );
}
