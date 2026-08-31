/**
 * The goods composer's specifics block: category, then the fields that
 * category earns.
 *
 * THE FRICTION RULE GOVERNS EVERY DECISION IN HERE. Listing is the
 * scarce act — a seller asked eight questions about a sofa posts fewer
 * sofas — and eBay measured 50% fewer listing steps purely from moving
 * photos to position one. So none of this may slow listing down. The
 * photo produces the attributes and the seller's job is REVIEW, not
 * authorship: everything arrives pre-filled and correctable, and nothing
 * here is required beyond the category itself.
 *
 * WHY CATEGORY IS ASKED FOR AT ALL, given it used to be optional. It was
 * optional because the only tree on offer was the SERVICES tree, where
 * nothing fits a sofa and requiring an answer just meant a random wrong
 * one. That reason is gone: goods have their own tree now, with
 * "Something else" as a labelled, legitimate answer, and the photo
 * usually fills it in before the seller reads the question. An item with
 * no category appears in no category filter, which is the whole point of
 * the exercise.
 *
 * WHAT A WRONG GUESS COSTS. The category is a row of chips with the
 * guess pre-selected, not a hidden default — every alternative is on
 * screen and one tap away. When the model says it is unsure, nothing is
 * pre-selected and its guess is shown as a suggestion instead, because a
 * wrong PRE-SELECTED category is a listing filed where nobody looks and
 * the seller will not notice: the field already looks answered.
 *
 * DRAFTED FIELDS ARE MARKED. A seller who cannot tell what they wrote
 * from what was written for them either checks nothing or checks
 * everything, and both defeat the point.
 *
 * THE TWO SAFETY FIELDS get their own treatment and their own sentence.
 * `serial_or_imei` and `frame_number` are never drafted — a model
 * reading digits off a blurry sticker produces a plausible wrong number,
 * which is worse than a blank one because it looks checked — and the
 * form says why entering one helps rather than presenting it as one more
 * box to fill.
 */
import React from 'react';
import { useTranslation } from 'react-i18next';
import { Sparkles, ShieldCheck } from 'lucide-react';
import { fieldsFor, categoryLabel, attributeLabel, optionLabel } from './itemSchema';

const inputCls = 'w-full rounded-xl border bg-white px-4 py-3 text-sm outline-none focus:border-[var(--brand-primary)]';

const chipCls = (active) => `px-3 py-1.5 rounded-full text-xs font-semibold border transition-colors ${
  active
    ? 'bg-[var(--brand-primary)] text-white border-[var(--brand-primary)]'
    : 'bg-white text-gray-700 border-gray-200 hover:border-[var(--brand-primary)]'
}`;

/** "We filled this in — check it." Never shown on a field the seller typed. */
const DraftedMark = ({ label }) => (
  <span
    className="inline-flex items-center gap-1 text-[10px] font-semibold rounded-full px-1.5 py-0.5 ms-2 align-middle"
    style={{ background: 'var(--bg)', color: 'var(--brand-muted)', border: '1px solid var(--brand-border)' }}
  >
    <Sparkles size={10} aria-hidden="true" />
    {label}
  </span>
);

const Label = ({ children, drafted, draftedLabel }) => (
  <label className="block text-xs font-semibold uppercase tracking-wide mb-1.5" style={{ color: 'var(--brand-muted)' }}>
    {children}
    {drafted && <DraftedMark label={draftedLabel} />}
  </label>
);

/**
 * @param {object} schema        from GET /marketplace/item-schema
 * @param {string} category      currently chosen slug
 * @param {object} attributes    {key: value} as it will be posted
 * @param {Set}    draftedKeys   which of those the photo produced
 * @param {object} draft         the vision result, or null
 */
export default function ItemSpecifics({
  schema, category, attributes, draftedKeys, draft,
  onCategoryChange, onAttributeChange,
}) {
  const { t } = useTranslation();
  if (!schema) return null;

  const categories = schema.categories || [];
  const fields = fieldsFor(schema, category);
  const provenance = new Set(schema.provenance_fields || []);
  const drafted = draftedKeys || new Set();
  const draftedLabel = t('requests.fromYourPhoto', 'from your photo');

  // Shown only when the model was unsure. A low-confidence guess is a
  // suggestion the seller picks, never a pre-selection they have to
  // notice is wrong.
  const suggestion = (!category && draft?.category && draft?.confidence === 'low')
    ? draft.category
    : null;

  const setAttr = (key, value) => onAttributeChange(key, value);

  const renderField = (field) => {
    const value = attributes[field.key] ?? '';
    const isDrafted = drafted.has(field.key);
    const label = attributeLabel(t, field);

    if (field.type === 'enum') {
      return (
        <div key={field.key} data-testid={`item-attr-${field.key}`}>
          <Label drafted={isDrafted} draftedLabel={draftedLabel}>{label}</Label>
          <div className="flex flex-wrap gap-2">
            {(field.options || []).map((option) => {
              const active = value === option.value;
              return (
                <button
                  key={option.value}
                  type="button"
                  aria-pressed={active}
                  // Tapping the chosen chip clears it. Every field here is
                  // optional, so there has to be a way back to "I do not
                  // know" after a wrong tap — otherwise the only escape
                  // from a mis-tap is a wrong answer.
                  onClick={() => setAttr(field.key, active ? '' : option.value)}
                  className={chipCls(active)}
                  data-testid={`item-attr-${field.key}-${option.value}`}
                >
                  {optionLabel(t, field.key, option)}
                </button>
              );
            })}
          </div>
        </div>
      );
    }

    if (field.type === 'bool') {
      return (
        <div key={field.key} data-testid={`item-attr-${field.key}`}>
          <Label drafted={isDrafted} draftedLabel={draftedLabel}>{label}</Label>
          <div className="flex flex-wrap gap-2">
            {[['true', t('common.yes', 'Yes')], ['false', t('common.no', 'No')]].map(([v, text]) => {
              const active = value === v;
              return (
                <button
                  key={v}
                  type="button"
                  aria-pressed={active}
                  onClick={() => setAttr(field.key, active ? '' : v)}
                  className={chipCls(active)}
                  data-testid={`item-attr-${field.key}-${v}`}
                >
                  {text}
                </button>
              );
            })}
          </div>
        </div>
      );
    }

    if (field.type === 'number') {
      return (
        <div key={field.key} data-testid={`item-attr-${field.key}`}>
          <Label drafted={isDrafted} draftedLabel={draftedLabel}>{label}</Label>
          <div className="flex items-center gap-2">
            <input
              type="number"
              min="0"
              inputMode="numeric"
              className={inputCls}
              style={{ borderColor: 'var(--brand-border)' }}
              value={value}
              onChange={(e) => setAttr(field.key, e.target.value)}
              data-testid={`item-attr-${field.key}-input`}
            />
            {field.unit && (
              <span className="text-xs shrink-0" style={{ color: 'var(--brand-muted)' }}>
                {t(`itemUnits.${field.unit}`, field.unit)}
              </span>
            )}
          </div>
        </div>
      );
    }

    const isProvenance = provenance.has(field.key);
    return (
      <div key={field.key} data-testid={`item-attr-${field.key}`}>
        <Label drafted={isDrafted} draftedLabel={draftedLabel}>{label}</Label>
        <input
          className={inputCls}
          style={{ borderColor: 'var(--brand-border)' }}
          value={value}
          onChange={(e) => setAttr(field.key, e.target.value)}
          maxLength={120}
          // `dir="auto"` and not `dir="rtl"`: a Hebrew seller types a
          // brand name in Latin script constantly, and forcing the
          // direction puts the punctuation on the wrong end of it.
          dir="auto"
          data-testid={`item-attr-${field.key}-input`}
        />
        {isProvenance && (
          <p className="text-[11px] mt-1 inline-flex items-start gap-1.5" style={{ color: 'var(--brand-muted)' }}>
            <ShieldCheck size={12} className="shrink-0 mt-0.5" aria-hidden="true" />
            {t('requests.provenanceHint',
              'Optional — but a stolen item cannot show one, so buyers trust a listing that does.')}
          </p>
        )}
      </div>
    );
  };

  return (
    <div className="space-y-4" data-testid="item-specifics">
      <div>
        <Label drafted={category && drafted.has('__category')} draftedLabel={draftedLabel}>
          {t('requests.fieldItemCategory', 'What kind of thing is it?')}
        </Label>
        <div className="flex flex-wrap gap-2" data-testid="item-category-chips">
          {categories.map((c) => {
            const active = category === c.slug;
            return (
              <button
                key={c.slug}
                type="button"
                aria-pressed={active}
                onClick={() => onCategoryChange(c.slug)}
                className={chipCls(active)}
                data-testid={`item-category-${c.slug}`}
              >
                {categoryLabel(t, c.slug, c.label)}
              </button>
            );
          })}
        </div>
        {suggestion && (
          <p className="text-[11px] mt-2" style={{ color: 'var(--brand-muted)' }} data-testid="item-category-suggestion">
            {t('requests.categoryGuess', 'Your photo looks like {{name}} — tap it if that is right.', {
              name: categoryLabel(t, suggestion),
            })}
          </p>
        )}
      </div>

      {category && fields.length > 0 && (
        <div className="grid sm:grid-cols-2 gap-4" data-testid="item-attribute-fields">
          {fields.map(renderField)}
        </div>
      )}

      {category && (
        <p className="text-[11px]" style={{ color: 'var(--brand-muted)' }}>
          {t('requests.specificsOptional',
            'All optional. Every one you fill in is a filter someone can find you through.')}
        </p>
      )}
    </div>
  );
}
