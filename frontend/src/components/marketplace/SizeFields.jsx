/**
 * A product's real size, optional: width and length in centimetres.
 *
 * Read by the size-ladder section (docs/page-generation-rules.md §9),
 * which draws a shop's products to scale beside a ruler. A scale nobody
 * measured would be an invented number, so the ladder only uses options
 * whose owner filled this in.
 */
import React from 'react';
import { useTranslation } from 'react-i18next';

/** The number to store, or null for blank or nonsense. */
export const sizeValue = (v) => {
  const n = parseFloat(v);
  return Number.isFinite(n) && n > 0 && n <= 500 ? Math.round(n * 10) / 10 : null;
};

/** Merge the two sizes into an option being saved; blank removes them. */
export function withSize(base, option) {
  const out = { ...base };
  for (const k of ['width_cm', 'length_cm']) {
    const v = sizeValue(option[k]);
    if (v) out[k] = v;
    else delete out[k];
  }
  return out;
}

export default function SizeFields({ option, onChange, testid }) {
  const { t } = useTranslation();
  const field = (k, label) => (
    <input
      type="number"
      inputMode="decimal"
      min="1"
      max="500"
      step="0.5"
      value={option[k] ?? ''}
      onChange={(e) => onChange({ [k]: e.target.value })}
      placeholder={label}
      aria-label={label}
      className="w-24 min-h-[44px] px-3 rounded-lg border bg-white text-sm"
      style={{ borderColor: 'var(--brand-border)' }}
      data-testid={`${testid}-${k}`}
    />
  );
  return (
    <fieldset className="space-y-1" data-testid={testid}>
      <legend className="text-xs font-semibold" style={{ color: 'var(--ink)' }}>
        {t('sizeFields.label', 'Real size, in cm (optional)')}
      </legend>
      <div className="flex items-center gap-2">
        {field('width_cm', t('sizeFields.width', 'Width'))}
        <span aria-hidden="true" style={{ color: 'var(--brand-muted)' }}>×</span>
        {field('length_cm', t('sizeFields.length', 'Length'))}
      </div>
      <p className="text-xs" style={{ color: 'var(--brand-muted)' }}>
        {t('sizeFields.hint', 'Measure it and your page can show your products to scale.')}
      </p>
    </fieldset>
  );
}
