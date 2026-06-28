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
 * Generic chips (always present):
 *   - Tonight       → today → tomorrow
 *   - This weekend  → next Fri (or today if Fri) → Sun (+2 nights)
 *   - Next week     → Mon of next calendar week → +7 nights
 *   - This month    → today → last day of current month
 *
 * Israel-specific holiday chips (rendered AFTER the generic set, only
 * when the holiday is still in the future). Hebcal-powered, auto-rolling
 * year to year:
 *   - Sukkot week, Pesach week, Shavuot, Rosh Hashana
 */
import React, { useEffect, useMemo, useState } from 'react';
import { format, addDays, getDay, endOfMonth, parseISO } from 'date-fns';
import { loadHolidayWindows } from '../../utils/holidayWindows';

const toIso = (d) => format(d, 'yyyy-MM-dd');
const fmt = (d) => format(d, 'MMM d');

const buildGenericChips = () => {
  const today = new Date();
  const dow = getDay(today);
  const daysToFri = ((5 - dow) + 7) % 7;
  const nextFri = addDays(today, daysToFri || 0);
  const sun = addDays(nextFri, 2);
  // "Next week" must always mean a FUTURE calendar week — when today is
  // Sun or Mon, jump an extra 7 days so the chip never collides with
  // "Tonight" or trivially overlaps the current week.
  let daysToMon = ((1 - dow) + 7) % 7;
  if (daysToMon < 2) daysToMon += 7;
  const nextMon = addDays(today, daysToMon);
  const weekEnd = addDays(nextMon, 7);
  const tomorrow = addDays(today, 1);
  const monthLast = endOfMonth(today);

  return [
    { key: 'tonight',      label: 'Tonight',      sub: `${fmt(today)} – ${fmt(tomorrow)}`,  checkin: toIso(today),   checkout: toIso(tomorrow) },
    { key: 'this-weekend', label: 'This weekend', sub: `${fmt(nextFri)} – ${fmt(sun)}`,     checkin: toIso(nextFri), checkout: toIso(sun) },
    { key: 'next-week',    label: 'Next week',    sub: `${fmt(nextMon)} – ${fmt(weekEnd)}`, checkin: toIso(nextMon), checkout: toIso(weekEnd) },
    { key: 'this-month',   label: 'This month',   sub: `${fmt(today)} – ${fmt(monthLast)}`, checkin: toIso(today),   checkout: toIso(monthLast) },
  ];
};

// Holiday → chip definition. Only chips whose `end` is on/after today
// are surfaced. Labels add "week" for the multi-day chagim so they read
// naturally as a search intent ("Sukkot week · Oct 6 – 13").
const HOLIDAY_LABEL = {
  sukkot: 'Sukkot week',
  pesach: 'Pesach week',
  shavuot: 'Shavuot',
  roshHashana: 'Rosh Hashana',
};

const buildHolidayChips = (windows) => {
  if (!windows) return [];
  const todayIso = new Date().toISOString().slice(0, 10);
  return Object.entries(HOLIDAY_LABEL)
    .map(([key, label]) => {
      const w = windows[key];
      if (!w || !w.start || !w.end) return null;
      if (w.end < todayIso) return null; // already past — don't surface
      return {
        key: `holiday-${key}`,
        label,
        sub: `${fmt(parseISO(w.start))} – ${fmt(parseISO(w.end))}`,
        checkin: w.start,
        checkout: w.end,
        holiday: true,
      };
    })
    .filter(Boolean);
};

const QuickChips = ({
  onPick,
  variant = 'light',
  testidPrefix = 'quick-chips',
}) => {
  const genericChips = useMemo(buildGenericChips, []);
  const [holidayChips, setHolidayChips] = useState([]);

  // Pull upcoming holiday windows once on mount. The util is cached for
  // 30 days in localStorage, falls back to static defaults if Hebcal is
  // unreachable, and resolves with `{sukkot, pesach, shavuot?, roshHashana?}`.
  useEffect(() => {
    let cancelled = false;
    loadHolidayWindows().then((w) => {
      if (!cancelled) setHolidayChips(buildHolidayChips(w));
    });
    return () => { cancelled = true; };
  }, []);

  const chips = useMemo(() => [...genericChips, ...holidayChips], [genericChips, holidayChips]);

  const base = variant === 'dark'
    ? 'bg-white/15 border-white/40 text-white hover:bg-white/25 backdrop-blur-sm'
    : 'bg-white border-gray-200 text-gray-800 hover:border-gray-400 shadow-sm';

  // Holiday chips get a subtle gold border to set them apart from the
  // generic presets — visual hint that they're seasonal / Israeli.
  const holidayBase = variant === 'dark'
    ? 'bg-white/20 border-[#D4AF37] text-white hover:bg-white/30 backdrop-blur-sm'
    : 'bg-white border-[#D4AF37] text-gray-900 hover:border-[#B98F1F] shadow-sm';

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
          className={`snap-start shrink-0 px-3 py-1.5 rounded-full border text-xs font-semibold flex items-center gap-1.5 transition-colors ${
            c.holiday ? holidayBase : base
          }`}
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
