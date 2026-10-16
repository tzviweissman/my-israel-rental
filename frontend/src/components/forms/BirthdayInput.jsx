/**
 * An optional birthday, day and month only (never the year), for a
 * business's birthday treat (backend birthdays.py). Shown only when the
 * business has the treat switched on. Value: "MM-DD" or "".
 */
import React from 'react';
import { useTranslation } from 'react-i18next';
import { Cake } from 'lucide-react';

export default function BirthdayInput({ value, onChange, businessName, className = '', testid = 'birthday' }) {
  const { t, i18n } = useTranslation();
  const [m, d] = (value || '').split('-');
  const he = i18n.language?.startsWith('he');
  const months = Array.from({ length: 12 }, (_, i) => new Intl.DateTimeFormat(he ? 'he-IL' : 'en-GB', { month: 'long' }).format(new Date(2024, i, 1)));
  const days = (mm) => (mm ? new Date(2024, Number(mm), 0).getDate() : 31);
  const set = (mm, dd) => {
    if (!mm || !dd) { onChange(mm || dd ? `${mm || ''}-${dd || ''}` : ''); return; }
    const capped = Math.min(Number(dd), days(mm));
    onChange(`${mm}-${String(capped).padStart(2, '0')}`);
  };
  const sel = 'px-3 py-2 rounded-lg border text-sm bg-white min-h-[44px]';
  const st = { borderColor: 'var(--brand-border)', color: 'var(--ink)' };
  return (
    <fieldset className={className} data-testid={testid}>
      <legend className="text-sm font-semibold inline-flex items-center gap-1.5 mb-1" style={{ color: 'var(--ink)' }}>
        <Cake size={15} aria-hidden="true" /> {t('birthday.label', 'Your birthday')} <span className="font-normal" style={{ color: 'var(--brand-muted)' }}>· {t('orders.optional', 'optional')}</span>
      </legend>
      <div className="flex gap-2">
        <select value={d || ''} onChange={(e) => set(m, e.target.value)} className={sel} style={st} aria-label={t('birthday.day', 'Day')} data-testid={`${testid}-day`}>
          <option value="">{t('birthday.day', 'Day')}</option>
          {Array.from({ length: days(m) }, (_, i) => String(i + 1).padStart(2, '0')).map((x) => <option key={x} value={x}>{Number(x)}</option>)}
        </select>
        <select value={m || ''} onChange={(e) => set(e.target.value, d)} className={`${sel} flex-1`} style={st} aria-label={t('birthday.month', 'Month')} data-testid={`${testid}-month`}>
          <option value="">{t('birthday.month', 'Month')}</option>
          {months.map((name, i) => <option key={name} value={String(i + 1).padStart(2, '0')}>{name}</option>)}
        </select>
      </div>
      <p className="text-[11px] mt-1" style={{ color: 'var(--brand-muted)' }}>{t('birthday.why', '{{name}} sends a small birthday gift. No year needed.', { name: businessName })}</p>
    </fieldset>
  );
}

/** "MM-DD" only when both parts are chosen, else null for the request. */
export const birthdayOrNull = (v) => (/^\d{2}-\d{2}$/.test(v || '') ? v : null);
