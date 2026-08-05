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
import React, { useEffect, useMemo, useRef, useState, useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import { format, addDays, getDay, endOfMonth, parseISO } from 'date-fns';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { loadHolidayWindows } from '../../utils/holidayWindows';
import useIsRtl from '../../hooks/useIsRtl';

const toIso = (d) => format(d, 'yyyy-MM-dd');
const fmt = (d) => format(d, 'MMM d');

const buildGenericChips = (t) => {
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
    { key: 'tonight',      label: t('stays.chipTonight', 'Tonight'),          sub: `${fmt(today)} – ${fmt(tomorrow)}`,  checkin: toIso(today),   checkout: toIso(tomorrow) },
    { key: 'this-weekend', label: t('stays.chipThisWeekend', 'This weekend'), sub: `${fmt(nextFri)} – ${fmt(sun)}`,     checkin: toIso(nextFri), checkout: toIso(sun) },
    { key: 'next-week',    label: t('stays.chipNextWeek', 'Next week'),       sub: `${fmt(nextMon)} – ${fmt(weekEnd)}`, checkin: toIso(nextMon), checkout: toIso(weekEnd) },
    { key: 'this-month',   label: t('stays.chipThisMonth', 'This month'),     sub: `${fmt(today)} – ${fmt(monthLast)}`, checkin: toIso(today),   checkout: toIso(monthLast) },
  ];
};

// Holiday → translation key. Labels resolved through `t()` so Hebrew /
// other locales render correctly. Only chips whose `end` is on/after
// today are surfaced.
const HOLIDAY_LABEL_KEY = {
  sukkot:      { key: 'stays.chipSukkotWeek',  fallback: 'Sukkot week' },
  pesach:      { key: 'stays.chipPesachWeek',  fallback: 'Pesach week' },
  shavuot:     { key: 'stays.chipShavuot',     fallback: 'Shavuot' },
  roshHashana: { key: 'stays.chipRoshHashana', fallback: 'Rosh Hashana' },
};

const buildHolidayChips = (windows, t) => {
  if (!windows) return [];
  const todayIso = new Date().toISOString().slice(0, 10);
  return Object.entries(HOLIDAY_LABEL_KEY)
    .map(([key, { key: i18nKey, fallback }]) => {
      const w = windows[key];
      if (!w || !w.start || !w.end) return null;
      if (w.end < todayIso) return null;
      return {
        key: `holiday-${key}`,
        label: t(i18nKey, fallback),
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
  const { t, i18n } = useTranslation();
  const isRtl = useIsRtl();
  // Re-build chip labels when the language changes so users switching
  // between English and Hebrew see the translated labels immediately.
  const genericChips = useMemo(() => buildGenericChips(t), [t, i18n.language]);
  const [holidayChips, setHolidayChips] = useState([]);

  useEffect(() => {
    let cancelled = false;
    loadHolidayWindows().then((w) => {
      if (!cancelled) setHolidayChips(buildHolidayChips(w, t));
    });
    return () => { cancelled = true; };
    // Re-run when locale changes so translated holiday labels reflect.
  }, [t, i18n.language]);

  const chips = useMemo(() => [...genericChips, ...holidayChips], [genericChips, holidayChips]);

  const base = variant === 'dark'
    ? 'bg-white/15 border-white/40 text-white hover:bg-white/25 backdrop-blur-sm'
    : 'bg-white border-gray-200 text-gray-800 hover:border-gray-400 shadow-sm';

  // Holiday chips get a subtle gold border to set them apart from the
  // generic presets — visual hint that they're seasonal / Israeli.
  const holidayBase = variant === 'dark'
    ? 'bg-white/20 border-[var(--gold)] text-white hover:bg-white/30 backdrop-blur-sm'
    : 'bg-white border-[var(--gold)] text-gray-900 hover:border-[#B98F1F] shadow-sm';

  // Scroll-arrow affordance for desktop hover — the chip row overflows
  // horizontally, but a hidden scrollbar leaves no visual cue that more
  // content exists. Arrows fade in on hover when the corresponding edge
  // has overflow, mirroring the Airbnb / Fiverr carousel pattern.
  const scrollerRef = useRef(null);
  const [edges, setEdges] = useState({ left: false, right: false });
  const recomputeEdges = useCallback(() => {
    const el = scrollerRef.current;
    if (!el) return;
    const maxScroll = el.scrollWidth - el.clientWidth;
    // Modern browsers report scrollLeft in RTL as 0..-maxScroll (CSSOM View
    // spec) rather than LTR's 0..+maxScroll, so normalize to "distance
    // scrolled from the start" before comparing against thresholds — same
    // fix already applied in AreaRow.jsx for its own carousel.
    const scrolledFromStart = isRtl ? -el.scrollLeft : el.scrollLeft;
    setEdges({
      left: scrolledFromStart > 4,
      right: maxScroll > 4 && scrolledFromStart < maxScroll - 4,
    });
  }, [isRtl]);
  useEffect(() => {
    recomputeEdges();
    const el = scrollerRef.current;
    if (!el) return undefined;
    el.addEventListener('scroll', recomputeEdges, { passive: true });
    window.addEventListener('resize', recomputeEdges);
    return () => {
      el.removeEventListener('scroll', recomputeEdges);
      window.removeEventListener('resize', recomputeEdges);
    };
  }, [recomputeEdges, chips.length]);

  // Force the strip to its true start (first chip = "Tonight") on mount and
  // whenever the language flips. Some mobile browsers default a freshly
  // rtl-flexed overflow container to a scrolled/inconsistent position
  // instead of `scrollLeft: 0` — don't rely on the platform default.
  useEffect(() => {
    const el = scrollerRef.current;
    if (!el) return;
    el.scrollLeft = 0;
  }, [isRtl]);
  const scrollBy = (dir) => {
    const el = scrollerRef.current;
    if (!el) return;
    const sign = isRtl ? -1 : 1;
    el.scrollBy({ left: dir * sign * Math.round(el.clientWidth * 0.7), behavior: 'smooth' });
  };

  return (
    <div className="relative group" data-testid={`${testidPrefix}-wrap`}>
      <div
        ref={scrollerRef}
        className="flex flex-nowrap gap-2 overflow-x-auto pb-1 -mx-1 px-1 snap-x [&::-webkit-scrollbar]:hidden"
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

      {/* Edge fade — a soft background-to-transparent gradient on each
          side where content overflows. Non-interactive so it never
          intercepts chip clicks. Sits behind the arrows. */}
      {edges.left && (
        <div
          aria-hidden="true"
          className={`hidden md:block absolute start-0 top-0 bottom-0 w-12 pointer-events-none bg-gradient-to-r ${
            variant === 'dark' ? 'from-black/40 to-transparent' : 'from-white via-white/80 to-transparent'
          } z-0`}
        />
      )}
      {edges.right && (
        <div
          aria-hidden="true"
          className={`hidden md:block absolute end-0 top-0 bottom-0 w-12 pointer-events-none bg-gradient-to-l ${
            variant === 'dark' ? 'from-black/40 to-transparent' : 'from-white via-white/80 to-transparent'
          } z-0`}
        />
      )}

      {/* Desktop-only scroll arrows — hidden on mobile (touch users can
          swipe). Fade in on parent hover, and only when the corresponding
          edge is actually scrollable. Positioned as absolute overlays
          with a soft gradient fade so they don't clip a chip label. */}
      {edges.left && (
        <button
          type="button"
          onClick={() => scrollBy(-1)}
          aria-label={t('stays.scrollChipsLeft', 'Scroll chips left')}
          className="hidden md:flex absolute start-0 top-1/2 -translate-y-1/2 z-10 h-8 w-8 items-center justify-center rounded-full bg-white shadow-md border border-gray-200 text-gray-700 opacity-0 group-hover:opacity-100 transition-opacity hover:border-[var(--gold)]"
          data-testid={`${testidPrefix}-arrow-left`}
        >
          <ChevronLeft size={16} />
        </button>
      )}
      {edges.right && (
        <button
          type="button"
          onClick={() => scrollBy(1)}
          aria-label={t('stays.scrollChipsRight', 'Scroll chips right')}
          className="hidden md:flex absolute end-0 top-1/2 -translate-y-1/2 z-10 h-8 w-8 items-center justify-center rounded-full bg-white shadow-md border border-gray-200 text-gray-700 opacity-0 group-hover:opacity-100 transition-opacity hover:border-[var(--gold)]"
          data-testid={`${testidPrefix}-arrow-right`}
        >
          <ChevronRight size={16} />
        </button>
      )}
    </div>
  );
};

export default QuickChips;
