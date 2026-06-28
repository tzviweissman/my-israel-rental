/**
 * QuickChips — one-tap date presets that sit just below the search pill
 * on mobile. Each chip resolves to a concrete check-in / check-out range
 * and calls the parent's `onPick` callback, which decides whether to
 * navigate (Home) or live-filter (Stays).
 *
 * Hidden on md+ where the full WhenPicker calendar is the primary
 * date-selection affordance — chips are a mobile-only conversion lift,
 * matching the Airbnb iOS pattern.
 *
 * Chip math is recomputed on every render via `date-fns`:
 *   - Tonight       → today → tomorrow
 *   - This weekend  → next Fri (or today if Fri) → Sun (+2 nights)
 *   - Next week     → next Mon → +7 nights
 *   - This month    → today → last day of current month
 */
import React, { useMemo } from 'react';
import { format, addDays, getDay, endOfMonth } from 'date-fns';

const toIso = (d) => format(d, 'yyyy-MM-dd');
const fmt = (d) => format(d, 'MMM d');

const buildChips = () => {
  const today = new Date();
  const dow = getDay(today); // 0=Sun … 6=Sat
  // Next Friday (today if already Fri).
  const daysToFri = ((5 - dow) + 7) % 7;
  const nextFri = addDays(today, daysToFri || 0);
  const sun = addDays(nextFri, 2);
  // Next Monday (skip today if already Mon, jump to next week instead).
  const daysToMon = (((1 - dow) + 7) % 7) || 7;
  const nextMon = addDays(today, daysToMon);
  const weekEnd = addDays(nextMon, 7);
  const tomorrow = addDays(today, 1);
  const monthLast = endOfMonth(today);

  return [
    { key: 'tonight',      label: 'Tonight',      sub: `${fmt(today)} – ${fmt(tomorrow)}`, checkin: toIso(today),   checkout: toIso(tomorrow) },
    { key: 'this-weekend', label: 'This weekend', sub: `${fmt(nextFri)} – ${fmt(sun)}`,    checkin: toIso(nextFri), checkout: toIso(sun) },
    { key: 'next-week',    label: 'Next week',    sub: `${fmt(nextMon)} – ${fmt(weekEnd)}`,checkin: toIso(nextMon), checkout: toIso(weekEnd) },
    { key: 'this-month',   label: 'This month',   sub: `${fmt(today)} – ${fmt(monthLast)}`,checkin: toIso(today),   checkout: toIso(monthLast) },
  ];
};

const QuickChips = ({
  onPick,
  variant = 'light', // 'light' (white pills) | 'dark' (white-on-translucent for hero)
  testidPrefix = 'quick-chips',
}) => {
  const chips = useMemo(buildChips, []);

  const base = variant === 'dark'
    ? 'bg-white/15 border-white/40 text-white hover:bg-white/25 backdrop-blur-sm'
    : 'bg-white border-gray-200 text-gray-800 hover:border-gray-400 shadow-sm';

  return (
    <div
      className="md:hidden flex gap-2 overflow-x-auto pb-1 -mx-1 px-1 snap-x"
      data-testid={testidPrefix}
      style={{ scrollbarWidth: 'none' }}
    >
      {chips.map((c) => (
        <button
          key={c.key}
          type="button"
          onClick={() => onPick({ checkin: c.checkin, checkout: c.checkout })}
          className={`snap-start shrink-0 px-3 py-1.5 rounded-full border text-xs font-semibold flex items-center gap-1.5 transition-colors ${base}`}
          data-testid={`${testidPrefix}-${c.key}`}
        >
          <span>{c.label}</span>
          <span className={variant === 'dark' ? 'opacity-75' : 'text-gray-500'}>· {c.sub}</span>
        </button>
      ))}
    </div>
  );
};

export default QuickChips;
