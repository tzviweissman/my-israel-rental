/**
 * "Have a code?" on the order form and the membership sign-up (backend
 * routes/marketplace/discounts.py). The check here is a preview; the
 * server checks the code again when the form is sent.
 */
import React, { useState } from 'react';
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

export default function DiscountCodeInput({ businessId, form, amount, phone, applied, onApplied }) {
  const { t } = useTranslation();
  const [open, setOpen] = useState(false);
  const [code, setCode] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  const apply = async () => {
    if (!code.trim()) return;
    setBusy(true); setError('');
    try {
      const { data } = await axios.post(`${API}/marketplace/businesses/${businessId}/discount-codes/check`,
        { code: code.trim(), form, amount: amount || 0, phone: phone || null });
      if (data.ok) { onApplied({ code: data.code, kind: data.kind, value: data.value }); setOpen(false); }
      else setError(data.reason);
    } catch { setError(t('discounts.checkFailed', 'Could not check the code. Try again.')); } finally { setBusy(false); }
  };

  if (applied) {
    return (
      <p className="flex items-center gap-2 text-sm" style={{ color: '#1F5F3A' }} data-testid="discount-applied">
        <Check size={15} /> {t('discounts.applied', 'Code {{code}} applied', { code: applied.code })}
        <button type="button" className="underline text-xs" style={{ color: 'var(--ink)' }} onClick={() => { onApplied(null); setCode(''); }}>{t('discounts.remove', 'Remove')}</button>
      </p>
    );
  }
  if (!open) {
    return (
      <button type="button" onClick={() => setOpen(true)} className="inline-flex items-center gap-1.5 text-sm underline min-h-[44px]" style={{ color: 'var(--ink)' }} data-testid="discount-open">
        <Tag size={14} /> {t('discounts.haveCode', 'Have a discount code?')}
      </button>
    );
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
      {error && <p className="text-sm mt-1" role="alert" style={{ color: '#B42318' }} data-testid="discount-error">{error}</p>}
    </div>
  );
}
