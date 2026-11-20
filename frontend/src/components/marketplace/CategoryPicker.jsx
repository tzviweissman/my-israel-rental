/**
 * The grouped category grid (spec N2).
 *
 * Two forms rendered their own flat grid of every category — the listing
 * wizard and Post a Job. Both comments in those files reasoned about "15
 * categories fitting in four rows", which stops being true the moment N1
 * lands. Rather than fix the same grid twice and let the two drift, they
 * now share this.
 *
 * Grouping is presentation only; `lib/categoryGroups.js` says why, and
 * owns the order. Nothing here is stored.
 *
 * WHY HEADINGS AND NOT A DROPDOWN. This is the screen where a business
 * says what it does, and it is the one place where seeing the whole
 * taxonomy at once is worth the height: somebody who does not find their
 * trade needs to see that before they commit, not after. A collapsed
 * accordion would hide exactly the thing they are scanning for.
 *
 * The two callers differ only in the selected-chip colour — the wizard is
 * brand blue, Post a Job is the gold-on-black it already used — so that
 * is the only thing `variant` controls. Everything else is deliberately
 * identical.
 */
import { useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { groupCategories } from '../../lib/categoryGroups';

const VARIANTS = {
  primary: {
    on:  'bg-[var(--brand-primary)] text-white border-[var(--brand-primary)]',
    off: 'bg-white text-gray-700 border-gray-200 hover:border-[var(--brand-primary)]',
  },
  gold: {
    on:  'bg-black text-[var(--gold)] border-black',
    off: 'bg-white text-gray-700 border-gray-200 hover:border-[var(--gold)]',
  },
};

/**
 * The add-a-business form's version (Tzvi, 20 Nov 2026: "make them choose from a drop down their category and
 * then a new drop down appears for the subcategory"). Native selects: the phone's own picker, nothing to scroll
 * past, and the same groups as the grid as <optgroup>s. The second one appears only for a category that has
 * subcategories (lib/categories.js SUBCATEGORIES), which are what /businesses sorts its rows and chips by.
 * 16 px text so an iPhone does not zoom in on focus.
 */
export function CategoryDropdowns({ categories, value, sub, subs, onChange, onSubChange, subLabel, testidPrefix }) {
  const { t } = useTranslation();
  const groups = useMemo(() => groupCategories(categories, t), [categories, t]);
  const cls = 'w-full mt-1 px-3 py-2.5 rounded-lg border bg-white border-gray-300 focus:outline-none focus:border-[var(--brand-primary)] text-[16px]';
  return (
    <div className="space-y-3">
      <select id={`${testidPrefix}-select`} value={value || ''} onChange={(e) => onChange(e.target.value)} className={cls}
        aria-label={t('wizard.category', 'Category')} data-testid={`${testidPrefix}-select`}>
        <option value="" disabled>{t('wizard.pickCategory', 'Choose your category')}</option>
        {groups.map((g) => (
          <optgroup key={g.id} label={g.label}>
            {g.items.map((c) => <option key={c.slug} value={c.slug} data-testid={`${testidPrefix}-${c.slug}`}>{c.label}</option>)}
          </optgroup>
        ))}
      </select>
      {subs && subs.length > 0 && (
        <div>
          <label htmlFor={`${testidPrefix}-sub-select`} className="text-sm font-semibold text-gray-700">{subLabel}</label>
          <select id={`${testidPrefix}-sub-select`} value={sub || ''} onChange={(e) => onSubChange(e.target.value)} className={cls}
            data-testid={`${testidPrefix}-sub-select`}>
            <option value="">{t('wizard.pickSubcategory', 'Choose what you do')}</option>
            {subs.map((s) => <option key={s.slug} value={s.slug}>{s.label}</option>)}
          </select>
        </div>
      )}
    </div>
  );
}

export default function CategoryPicker({
  categories,
  value,
  onChange,
  testidPrefix,
  variant = 'primary',
  columns = 'grid-cols-2 sm:grid-cols-3',
}) {
  const { t } = useTranslation();
  const groups = useMemo(() => groupCategories(categories, t), [categories, t]);
  const skin = VARIANTS[variant] || VARIANTS.primary;

  return (
    <div className="space-y-4" data-testid={`${testidPrefix}-groups`}>
      {groups.map((g) => (
        <div key={g.id} data-testid={`${testidPrefix}-group-${g.id}`}>
          <div
            className="text-[11px] font-semibold uppercase tracking-wider mb-2"
            style={{ color: 'var(--brand-muted)' }}
          >
            {g.label}
          </div>
          <div className={`grid ${columns} gap-2`}>
            {g.items.map((c) => {
              const selected = value === c.slug;
              return (
                <button
                  key={c.slug}
                  type="button"
                  aria-pressed={selected}
                  onClick={() => onChange(c.slug)}
                  className={`px-3 py-2 min-h-[44px] rounded-lg text-xs font-semibold border transition-colors ${
                    selected ? skin.on : skin.off
                  }`}
                  data-testid={`${testidPrefix}-${c.slug}`}
                >
                  {c.label}
                </button>
              );
            })}
          </div>
        </div>
      ))}
    </div>
  );
}
