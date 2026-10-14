/**
 * A business's own questions, as the customer fills them in (backend
 * routes/marketplace/custom_fields.py). `values` is { fieldId: value };
 * a checkbox is true/false, everything else a string.
 */
import React from 'react';

const field = 'w-full px-3 py-2 rounded-lg border text-base bg-white min-h-[48px]';
const fieldStyle = { borderColor: 'var(--brand-border)', color: 'var(--ink)' };

export default function CustomFieldInputs({ fields, values, onChange, testid = 'custom-fields' }) {
  if (!fields || fields.length === 0) return null;
  const set = (id, v) => onChange({ ...values, [id]: v });
  return (
    <div className="space-y-3" data-testid={testid}>
      {fields.map((f) => {
        const id = `cf-${f.id}`;
        const v = values[f.id];
        if (f.type === 'checkbox') {
          return (
            <label key={f.id} htmlFor={id} className="flex items-start gap-3 text-sm min-h-[44px] cursor-pointer" style={{ color: 'var(--ink)' }}>
              <input id={id} type="checkbox" className="mt-1 w-5 h-5 shrink-0" checked={!!v} required={f.required} onChange={(e) => set(f.id, e.target.checked)} data-testid={`cf-input-${f.id}`} />
              <span>
                {f.label}{f.required && <span aria-hidden="true"> *</span>}
                {f.help && <span className="block text-xs mt-0.5" style={{ color: 'var(--brand-muted)' }}>{f.help}</span>}
              </span>
            </label>
          );
        }
        let input;
        if (f.type === 'longtext') {
          input = <textarea id={id} rows={3} maxLength={2000} required={f.required} value={v || ''} onChange={(e) => set(f.id, e.target.value)} className={field} style={fieldStyle} data-testid={`cf-input-${f.id}`} />;
        } else if (f.type === 'choice') {
          input = (
            <select id={id} required={f.required} value={v || ''} onChange={(e) => set(f.id, e.target.value)} className={field} style={fieldStyle} data-testid={`cf-input-${f.id}`}>
              <option value="" disabled={f.required}>{'—'}</option>
              {(f.options || []).map((o) => <option key={o} value={o}>{o}</option>)}
            </select>
          );
        } else {
          const type = f.type === 'number' ? 'number' : f.type === 'date' ? 'date' : 'text';
          input = <input id={id} type={type} maxLength={300} required={f.required} value={v || ''} onChange={(e) => set(f.id, e.target.value)} className={field} style={fieldStyle} inputMode={f.type === 'number' ? 'decimal' : undefined} data-testid={`cf-input-${f.id}`} />;
        }
        return (
          <label key={f.id} htmlFor={id} className="block text-sm" style={{ color: 'var(--ink)' }}>
            <span className="block mb-1">{f.label}{f.required && <span aria-hidden="true"> *</span>}</span>
            {input}
            {f.help && <span className="block text-xs mt-1" style={{ color: 'var(--brand-muted)' }}>{f.help}</span>}
          </label>
        );
      })}
    </div>
  );
}

/** Answers as stored on a member or order, for the business to read. */
export function AnswersList({ answers, t }) {
  if (!answers || answers.length === 0) return null;
  return (
    <dl className="text-xs mt-1 space-y-0.5" style={{ color: 'var(--ink)' }} data-testid="answers">
      {answers.map((a) => (
        <div key={a.id} className="flex gap-1 flex-wrap">
          <dt style={{ color: 'var(--brand-muted)' }}>{a.label}:</dt>
          <dd className="font-medium">{a.type === 'checkbox' ? (a.value ? t('fields.yes', 'Yes') : t('fields.no', 'No')) : a.value}</dd>
        </div>
      ))}
    </dl>
  );
}
