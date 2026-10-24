/**
 * Design your page → Notice at the top (components/marketplace/NoticeBar.jsx,
 * backend businesses.py Notice). One line, optional dates; the preview
 * shows it at once, whatever its dates.
 */
import React from 'react';
import { useTranslation } from 'react-i18next';

const box = 'w-full px-3 py-2 rounded-lg border text-sm bg-white min-h-[44px]';
const boxStyle = { borderColor: 'var(--brand-border)', color: 'var(--ink)' };

export default function NoticeEditor({ notice, onChange }) {
  const { t } = useTranslation();
  const n = notice || { text: '', starts_on: '', ends_on: '' };
  const set = (k) => (e) => onChange({ ...n, [k]: e.target.value });
  const badDates = n.starts_on && n.ends_on && n.ends_on < n.starts_on;
  return (
    <section className="pt-5 border-t" style={{ borderColor: 'var(--brand-border)' }} data-testid="notice-editor">
      <h3 className="text-sm font-bold" style={{ color: 'var(--ink)' }}>{t('notice.title', 'Notice at the top')}</h3>
      <p className="text-xs mt-0.5 mb-2" style={{ color: 'var(--brand-muted)' }}>
        {t('notice.hint', 'One line customers see first, on your page and your order page. For example: Closed for Sukkot, back on 20 October.')}
      </p>
      <input className={box} style={boxStyle} maxLength={140} dir="auto" value={n.text || ''} onChange={set('text')}
             placeholder={t('notice.placeholder', 'Free delivery this week')} data-testid="notice-text" />
      <div className="grid grid-cols-2 gap-2 mt-2">
        <label className="text-xs font-semibold" style={{ color: 'var(--brand-muted)' }}>
          {t('notice.from', 'From (optional)')}
          <input type="date" className={`${box} mt-1`} style={boxStyle} value={n.starts_on || ''} onChange={set('starts_on')} data-testid="notice-from" />
        </label>
        <label className="text-xs font-semibold" style={{ color: 'var(--brand-muted)' }}>
          {t('notice.until', 'Until (optional)')}
          <input type="date" className={`${box} mt-1`} style={boxStyle} value={n.ends_on || ''} onChange={set('ends_on')} data-testid="notice-until" />
        </label>
      </div>
      {badDates && <p className="text-xs mt-1" role="alert" style={{ color: 'var(--error-text)' }}>{t('notice.badDates', 'The end date is before the start date.')}</p>}
      {n.text && (
        <button type="button" onClick={() => onChange(null)} className="text-xs underline mt-2 min-h-[36px]" style={{ color: 'var(--brand-muted)' }} data-testid="notice-remove">
          {t('notice.remove', 'Remove the notice')}
        </button>
      )}
    </section>
  );
}
