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
                  className={`px-3 py-2 rounded-lg text-xs font-semibold border transition-colors ${
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
