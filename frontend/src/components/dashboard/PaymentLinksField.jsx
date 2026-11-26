/**
 * How customers pay the business: its own payment links (Bit, PayBox, …) and a short note, in Texts and emails
 * (Tzvi, 25 Nov 2026: "make it easier for them"); the same fields as the page editor's Payment links. The server
 * (utils/payment_links) is the gate; matchProvider only says so while the owner types.
 */
import React, { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import axios from 'axios';
import { AlertCircle, Plus, Trash2 } from 'lucide-react';
import { matchProvider } from './BusinessPageEditor';

export default function PaymentLinksField({ API, links, setLinks, note, setNote }) {
  const { t } = useTranslation();
  const [providers, setProviders] = useState([]);
  const [max, setMax] = useState(5);
  useEffect(() => {
    axios.get(`${API}/marketplace/payment-providers`)
      .then(({ data }) => { setProviders(data.providers || []); if (data.max) setMax(data.max); })
      .catch(() => setProviders([]));
  }, [API]);

  const muted = { color: 'var(--brand-muted)' };
  const field = { borderColor: 'var(--brand-border)', color: 'var(--ink)', fontSize: 16 };
  const setRow = (i, patch) => setLinks(links.map((l, j) => (j === i ? { ...l, ...patch } : l)));
  const names = [...new Set(providers.map((p) => p.name))].join(', ');

  return (
    <div className="mb-4 rounded-xl border p-3" style={{ borderColor: 'var(--brand-border)' }} data-testid="pay-links-field">
      <p className="text-sm font-semibold" style={{ color: 'var(--ink)' }}>{t('orderTexts.payTitle', 'How customers pay you')}</p>
      <p className="text-[12px] mt-0.5 mb-2" style={muted}>{t('orderTexts.payHint', 'Your own payment links, shown on your page, on the order and booking pages and in the order email. The money goes straight to you, never through us.')}</p>
      <div className="space-y-2">
        {links.map((l, i) => {
          const provider = matchProvider(l.url, providers);
          const bad = l.url.trim() && providers.length > 0 && !provider;
          return (
            <div key={i} className="space-y-1.5" data-testid="pay-link-row">
              <div className="flex gap-1.5">
                <input value={l.url} dir="ltr" placeholder="https://paybox.co.il/…" aria-label={t('pageDesign.paymentUrl', 'Payment link')} aria-invalid={!!bad}
                       onChange={(e) => { const p = matchProvider(e.target.value, providers); setRow(i, { url: e.target.value, label: !l.label || providers.some((x) => x.name === l.label) ? (p ? p.name : '') : l.label }); }}
                       className="flex-1 min-w-0 px-2 min-h-[44px] rounded-lg border bg-white" style={bad ? { ...field, borderColor: '#FCA5A5' } : field} data-testid="pay-link-url" />
                <button type="button" onClick={() => setLinks(links.filter((_, j) => j !== i))} className="shrink-0 inline-flex items-center justify-center min-h-[44px] min-w-[44px] rounded-lg"
                        style={muted} aria-label={t('pageDesign.paymentRemove', 'Remove this link')} data-testid="pay-link-remove"><Trash2 size={15} /></button>
              </div>
              {provider && (
                <input value={l.label} maxLength={40} placeholder={provider.name} aria-label={t('pageDesign.paymentLabel', 'Button text')} onChange={(e) => setRow(i, { label: e.target.value })}
                       className="w-full px-2 min-h-[44px] rounded-lg border bg-white" style={field} dir="auto" data-testid="pay-link-label" />
              )}
              {bad && (
                <p className="text-xs flex items-start gap-1 text-red-700" data-testid="pay-link-error">
                  <AlertCircle size={13} className="shrink-0 mt-px" />{t('pageDesign.paymentRefused', 'We can only show links from a payment provider we recognise, over https.')}
                </p>
              )}
            </div>
          );
        })}
      </div>
      {links.length < max && (
        <button type="button" onClick={() => setLinks([...links, { url: '', label: '' }])} className="mt-2 inline-flex items-center gap-1.5 min-h-[44px] text-[13px] font-semibold"
                style={{ color: 'var(--brand-primary)' }} data-testid="pay-link-add"><Plus size={14} /> {t('pageDesign.paymentAdd', 'Add a payment link')}</button>
      )}
      {names && <p className="text-[11px] mt-1" style={muted}>{t('pageDesign.paymentAccepted', 'Accepted: {{list}}', { list: names })}</p>}
      <label htmlFor="pay-note-input" className="block text-[13px] font-semibold mt-3" style={{ color: 'var(--ink)' }}>{t('orderTexts.payNoteLabel', 'Other ways to pay (optional)')}</label>
      <input id="pay-note-input" maxLength={200} value={note} onChange={(e) => setNote(e.target.value)} dir="auto"
             placeholder={t('orderTexts.payNotePlaceholder', 'For example: cash on delivery, or bank transfer')}
             className="mt-1 px-2 min-h-[44px] rounded-lg border bg-white w-full" style={field} data-testid="pay-note-input" />
    </div>
  );
}
