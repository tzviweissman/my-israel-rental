/**
 * FaqEditor - the question-and-answer pairs a listing shows under "FAQs".
 *
 * The backend has accepted `faqs: [{q, a}]` on a listing since the
 * marketplace was built, and the listing page has rendered them; the only
 * way to write one was the demo seed script (dead-ends audit 2026-09-03,
 * #9). This is the editor, shared by the create wizard and the dashboard's
 * edit sheet so the two cannot drift.
 *
 * Shape is the one the listing page reads: `{ q, a }`. Empty rows are
 * dropped by `cleanFaqs` before anything is sent, so a person who opened
 * a row and changed their mind has nothing to undo.
 *
 * IT OPENS WITH ONE EMPTY ROW rather than a button. The placeholders are
 * the persuasive part of this component - they show a provider what a
 * good question looks like - and hiding them behind "Add a question"
 * asked people to commit before seeing what they were committing to.
 * The seeded row is DISPLAY ONLY: it is never written into the caller's
 * state on mount, so the edit sheet's "nothing changed" check still
 * sees nothing changed, and `cleanFaqs` drops it if it is left alone.
 * (2026-09-05 audit, the improvement.)
 */
import React from 'react';
import { useTranslation } from 'react-i18next';
import { Plus, Trash2 } from 'lucide-react';

export const MAX_FAQS = 8;

/** Rows worth keeping: both halves written. Trimmed. */
export const cleanFaqs = (faqs) => (Array.isArray(faqs) ? faqs : [])
  // `_k` is the row's identity while it is being edited (see below) and
  // is never part of the listing.
  .map((f) => ({ q: String(f?.q || '').trim(), a: String(f?.a || '').trim() }))
  .filter((f) => f.q && f.a)
  .slice(0, MAX_FAQS);

let seq = 0;
const newRow = () => { seq += 1; return { q: '', a: '', _k: `faq-${seq}` }; };

/**
 * @param {Object} props
 * @param {{q: string, a: string}[]} props.faqs
 * @param {(next: {q: string, a: string}[]) => void} props.onChange
 * @param {string} [props.testidPrefix]
 */
export default function FaqEditor({ faqs = [], onChange, testidPrefix = 'faq' }) {
  const { t } = useTranslation();
  const given = Array.isArray(faqs) ? faqs : [];
  // One open row when there are none. Held in a ref so it keeps its
  // identity across renders and is not re-created under the caret.
  const seeded = React.useRef(null);
  if (!seeded.current) seeded.current = [newRow()];
  const rows = given.length ? given : seeded.current;

  // The first keystroke is what commits the seeded row to the caller.
  const setRow = (i, patch) => onChange(rows.map((r, idx) => (idx === i ? { ...r, ...patch } : r)));
  const remove = (i) => onChange(rows.filter((_, idx) => idx !== i));
  const add = () => { if (rows.length < MAX_FAQS) onChange([...rows, newRow()]); };

  return (
    <div className="space-y-3" data-testid={`${testidPrefix}-editor`}>
      <div>
        <p className="text-xs font-semibold text-gray-700">{t('faqEditor.title', 'Questions customers ask')}</p>
        <p className="text-[11px] text-gray-500">
          {t('faqEditor.hint', 'Optional. Answer the things people message you about anyway: turnaround, what is included, how to pay. Shown on your listing under "FAQs".')}
        </p>
      </div>

      {rows.map((row, i) => (
        <div key={row._k || i} className="rounded-xl border p-3 space-y-2" style={{ borderColor: 'var(--brand-border)' }} data-testid={`${testidPrefix}-row-${i}`}>
          <input
            value={row.q || ''}
            onChange={(e) => setRow(i, { q: e.target.value })}
            maxLength={160}
            className="w-full px-3 py-2 rounded-lg border bg-white text-sm font-semibold"
            style={{ borderColor: 'var(--brand-border)' }}
            placeholder={t('faqEditor.qPh', 'e.g. How far in advance should I book?')}
            aria-label={t('faqEditor.question', 'Question')}
            data-testid={`${testidPrefix}-q-${i}`}
          />
          <textarea
            value={row.a || ''}
            onChange={(e) => setRow(i, { a: e.target.value })}
            rows={2}
            maxLength={600}
            className="w-full px-3 py-2 rounded-lg border bg-white text-sm"
            style={{ borderColor: 'var(--brand-border)' }}
            placeholder={t('faqEditor.aPh', 'e.g. A week is plenty. Same-day is sometimes possible, message me.')}
            aria-label={t('faqEditor.answer', 'Answer')}
            data-testid={`${testidPrefix}-a-${i}`}
          />
          <button
            type="button"
            onClick={() => remove(i)}
            className="inline-flex items-center gap-1 text-xs font-semibold"
            style={{ color: 'var(--brand-muted)' }}
            data-testid={`${testidPrefix}-remove-${i}`}
          >
            <Trash2 size={12} aria-hidden="true" /> {t('faqEditor.remove', 'Remove')}
          </button>
        </div>
      ))}

      {/* The deep accent on the label, not `--brand-primary`: 12px text
          needs 4.5:1 and the accent is 3.61:1 on white; the deep is 6.96. */}
      {rows.length < MAX_FAQS && (
        <button
          type="button"
          onClick={add}
          className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg border text-xs font-semibold"
          style={{ borderColor: 'var(--brand-border)', color: 'var(--brand-primary-deep)' }}
          data-testid={`${testidPrefix}-add`}
        >
          <Plus size={13} aria-hidden="true" /> {rows.length ? t('faqEditor.addAnother', 'Add another question') : t('faqEditor.add', 'Add a question')}
        </button>
      )}
    </div>
  );
}
