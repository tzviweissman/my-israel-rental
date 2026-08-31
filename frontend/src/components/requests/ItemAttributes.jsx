/**
 * The item specifics as a buyer reads them.
 *
 * WHY LABEL-ABOVE-VALUE AND NOT A TWO-COLUMN TABLE. A label/value table
 * is the standard shape for this and it is the shape that breaks in RTL:
 * the columns mirror, but a value like "220V" or "IKEA" is Latin script
 * and does not, so the reading order of the row stops matching the
 * reading order of its parts. Stacking the label over its value removes
 * the problem rather than patching it — each cell is one direction, the
 * grid flows whichever way the page flows, and nothing needs a
 * `[dir="rtl"]` override to look right.
 *
 * `dir="auto"` on the value for the same reason one line down: a Hebrew
 * listing carries Latin brand names and model numbers constantly, and
 * letting the browser decide per value is the only thing that puts the
 * punctuation on the correct end of each one.
 *
 * ONLY WHAT WAS FILLED IN. Empty fields are not rendered as "—". A
 * listing showing eight blank rows reads as a seller who could not be
 * bothered, when it is really a seller who answered the questions that
 * applied to their sofa.
 *
 * THE SERIAL NUMBER IS NOT HERE, and that is deliberate rather than an
 * omission. The API does not serve it: a serial printed on a public page
 * can be copied onto a stolen listing in one paste, and the marker then
 * means nothing on either. What is served, and what this renders, is
 * that the seller published one — the buyer checks it against the object
 * when they collect it.
 */
import React from 'react';
import { useTranslation } from 'react-i18next';
import { ShieldCheck } from 'lucide-react';
import { useItemSchema, fieldsFor, categoryLabel, attributeLabel, valueLabel } from './itemSchema';

export default function ItemAttributes({ category, attributes, provenanceProvided }) {
  const { t } = useTranslation();
  const schema = useItemSchema();

  const values = attributes || {};
  const provided = provenanceProvided || [];
  const filled = schema
    ? fieldsFor(schema, category).filter((f) => {
      const v = values[f.key];
      return v !== undefined && v !== null && v !== '';
    })
    : [];

  if (!category && !filled.length && !provided.length) return null;

  return (
    <div className="mb-6" data-testid="item-attributes">
      {category && (
        <p className="text-xs font-semibold uppercase tracking-wide mb-3" style={{ color: 'var(--brand-muted)' }}>
          {categoryLabel(t, category)}
        </p>
      )}

      {filled.length > 0 && (
        <dl className="grid grid-cols-2 sm:grid-cols-3 gap-x-4 gap-y-3">
          {filled.map((field) => (
            <div key={field.key} data-testid={`item-attribute-${field.key}`}>
              <dt className="text-[11px] font-semibold uppercase tracking-wide" style={{ color: 'var(--brand-muted)' }}>
                {attributeLabel(t, field)}
              </dt>
              <dd className="text-sm mt-0.5" style={{ color: 'var(--ink)' }} dir="auto">
                {valueLabel(t, field, values[field.key])}
              </dd>
            </div>
          ))}
        </dl>
      )}

      {provided.length > 0 && (
        <p
          className="inline-flex items-start gap-1.5 text-xs mt-4 rounded-xl px-3 py-2"
          style={{ background: 'var(--bg)', border: '1px solid var(--brand-border)', color: 'var(--brand-muted)' }}
          data-testid="item-provenance-marker"
        >
          <ShieldCheck size={14} className="shrink-0 mt-0.5" aria-hidden="true" />
          <span>
            {provided.includes('frame_number')
              ? t('requests.frameProvided', 'The seller has the frame number and will show it on collection.')
              : t('requests.serialProvided', 'The seller has the serial number and will show it on collection.')}
          </span>
        </p>
      )}
    </div>
  );
}
