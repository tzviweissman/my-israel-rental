import React from 'react';
import { useTranslation } from 'react-i18next';
import { Circle, CheckCircle2 } from 'lucide-react';

/**
 * What is still missing from a business's public page (spec B6).
 *
 * The real fix for an empty business page is that it has content, and
 * the only person who can supply that is the owner. So the dashboard
 * says what is missing, in the order it matters, with each item wired to
 * the thing that fixes it.
 *
 * Four checks, not fourteen. A list long enough to feel like homework
 * gets closed; a list of four gets finished. They are also, in order,
 * exactly what a stranger looks for: what you are called, what you do,
 * where you work, and what it looks like.
 *
 * NO invented statistics. The spec is explicit and it is right: nobody
 * has measured what a logo does to enquiries here, and "businesses with
 * photos get 3x more customers" would be a number we made up to create
 * urgency. The list of gaps is its own argument.
 *
 * Disappears entirely at 100%. A permanent "you are done!" panel is
 * clutter that trains people to skim past the dashboard.
 */
export default function BusinessCompleteness({ business, onEditDetails, onOpenListings }) {
  const { t } = useTranslation();
  const b = business || {};

  const items = [
    // Two RECEIPTS before the four tasks. Both are real fields with real
    // truthiness checks - a business cannot be created without a name, and
    // categories come from its listings - so nothing is credited that was
    // not done. Without them a minute-old business read "0% complete"
    // under a setup checklist that, for the same business, read 1 of 5:
    // the two panels disagreed on the starting number. Never actionable,
    // never rendered as buttons.
    {
      key: 'named',
      done: !!(b.name || '').trim(),
      label: t('businesses.needName', 'Name your business'),
      action: null,
    },
    {
      key: 'category',
      done: ((b.listing_categories || []).length + (b.categories || []).length) > 0,
      label: t('businesses.needCategory', 'Choose your categories'),
      action: null,
    },
    {
      key: 'logo',
      done: !!b.logo_url,
      label: t('businesses.needLogo', 'Add a logo'),
      action: onEditDetails,
    },
    {
      key: 'description',
      done: !!(b.description || '').trim(),
      label: t('businesses.needDescription', 'Write a description'),
      action: onEditDetails,
    },
    {
      key: 'areas',
      done: (b.areas || []).length > 0,
      label: t('businesses.needAreas', 'Add your service areas'),
      action: onEditDetails,
    },
    {
      key: 'photo',
      // A listing with no photo is the single biggest gap on a business
      // page, and the hardest to notice from the owner's side — they
      // know what their work looks like.
      done: !!b.has_listing_photo,
      label: t('businesses.needPhoto', 'Add one photo to a service'),
      action: onOpenListings,
    },
  ];

  const done = items.filter((i) => i.done).length;
  const pct = Math.round((done / items.length) * 100);
  if (done === items.length) return null;

  return (
    <div
      className="rounded-xl border p-3 mb-3"
      style={{ background: 'rgb(var(--brand-primary-rgb) / 0.05)', borderColor: 'var(--brand-border)' }}
      data-testid={`business-completeness-${b.id}`}
    >
      <p className="text-xs font-bold mb-2" style={{ color: 'var(--ink)' }}>
        {t('businesses.completePct', 'Your page is {{pct}}% complete', { pct })}
      </p>

      {/* A bar, because a percentage on its own is a number; a bar that
          is visibly short is a nudge. */}
      <div className="h-1.5 rounded-full mb-2.5 overflow-hidden" style={{ background: 'var(--brand-border)' }}>
        <div
          className="h-full rounded-full transition-all"
          style={{ width: `${pct}%`, background: 'var(--brand-primary)' }}
        />
      </div>

      <ul className="space-y-1">
        {items.map(({ key, done: isDone, label, action }) => (
          <li key={key}>
            {isDone ? (
              <span className="inline-flex items-center gap-1.5 text-xs" style={{ color: 'var(--brand-muted)' }}>
                <CheckCircle2 size={12} style={{ color: '#1F8A50' }} aria-hidden="true" />
                <s>{label}</s>
              </span>
            ) : !action ? (
              <span className="inline-flex items-center gap-1.5 text-xs" style={{ color: 'var(--brand-muted)' }}>
                <Circle size={12} aria-hidden="true" />
                {label}
              </span>
            ) : (
              <button
                type="button"
                onClick={action}
                className="inline-flex items-center gap-1.5 text-xs font-semibold hover:underline"
                style={{ color: 'var(--brand-primary)' }}
                data-testid={`completeness-${key}`}
              >
                <Circle size={12} aria-hidden="true" />
                {label}
              </button>
            )}
          </li>
        ))}
      </ul>
    </div>
  );
}
