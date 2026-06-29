/**
 * WhenPicker — Airbnb-style "When" search segment with both a precise
 * **Dates** calendar AND a **Flexible** mode (Weekend / Week / Month
 * presets × pickable upcoming-month cards). Mirrors Airbnb's two-tab
 * popover from the user-shared screenshot.
 *
 * Data contract is unchanged: the parent owns `checkin` / `checkout`
 * as ISO `YYYY-MM-DD` strings. Flexible-mode selections resolve to
 * concrete checkin/checkout dates on Apply so the rest of the app
 * (URL params, /stays filter) needs no awareness of the new mode.
 *   - Weekend → checkin = first Friday of the chosen month, +2 nights
 *   - Week    → checkin = 1st of the chosen month, +7 nights
 *   - Month   → checkin = 1st, checkout = last day of the month
 */
import React, { useState, useRef, useEffect, useMemo } from 'react';
import { createPortal } from 'react-dom';
import { useTranslation } from 'react-i18next';
import { Calendar as CalendarIcon, X, ChevronLeft, ChevronRight } from 'lucide-react';
import { DayPicker } from 'react-day-picker';
import {
  format, parseISO, isValid,
  addMonths, startOfMonth,
} from 'date-fns';
import 'react-day-picker/dist/style.css';
import './whenpicker.css';

const toIso = (d) => (d ? format(d, 'yyyy-MM-dd') : '');
const fromIso = (s) => {
  if (!s) return undefined;
  const d = parseISO(s);
  return isValid(d) ? d : undefined;
};

const formatShort = (d) => (d ? format(d, 'MMM d') : '');

const MONTH_LABEL = (d) => format(d, 'MMMM');
const YEAR_LABEL = (d) => format(d, 'yyyy');

// Friendly label for a Flexible-mode selection — mirrors Airbnb's
// "A week in October" / "A month in July" copy. Returned from the
// picker so the search-bar segment can render the same text without
// needing to know the date math.
const flexLabel = (flex, t) => {
  if (!flex) return '';
  const [year, month] = (flex.monthIso || '').split('-').map(Number);
  if (!year || !month) return '';
  const monthName = format(new Date(year, month - 1, 1), 'MMMM');
  if (flex.stayLength === 'weekend') return t('stays.flexLabelWeekend', { month: monthName, defaultValue: `A weekend in ${monthName}` });
  if (flex.stayLength === 'month') return t('stays.flexLabelMonth', { month: monthName, defaultValue: `A month in ${monthName}` });
  return t('stays.flexLabelWeek', { month: monthName, defaultValue: `A week in ${monthName}` });
};

export { flexLabel };

const WhenPicker = ({
  checkin,
  checkout,
  flexible = null,
  onChange,
  variant = 'light',
  labelClassName = '',
  valueClassName = '',
  testidPrefix = 'when',
}) => {
  const [open, setOpen] = useState(false);
  // Open into whichever tab the parent's value already corresponds to.
  // If `flexible` is set we land on the Flexible tab; otherwise Dates.
  const [mode, setMode] = useState(flexible ? 'flexible' : 'dates');
  const [stayLength, setStayLength] = useState(flexible?.stayLength || 'week');
  // Flex month is a Date pointing to the chosen month's 1st. Seeded
  // from the parent's `flexible.monthIso` so the popover reopens with
  // the right card selected.
  const [flexMonth, setFlexMonth] = useState(() => {
    if (flexible?.monthIso) {
      const [y, m] = flexible.monthIso.split('-').map(Number);
      if (y && m) return new Date(y, m - 1, 1);
    }
    return null;
  });
  const wrapRef = useRef(null);
  const { t } = useTranslation();

  useEffect(() => {
    if (!open) return;
    const onKey = (e) => { if (e.key === 'Escape') setOpen(false); };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [open]);

  const range = { from: fromIso(checkin), to: fromIso(checkout) };

  let displayValue;
  if (flexible) {
    // Flexible-mode display — Airbnb-style "A week in October".
    displayValue = flexLabel(flexible, t);
  } else if (range.from && range.to) {
    displayValue = `${formatShort(range.from)} – ${formatShort(range.to)}`;
  } else if (range.from) {
    displayValue = `${formatShort(range.from)} – ?`;
  } else {
    displayValue = t('stays.addDates', 'Add dates');
  }
  const isPlaceholder = !range.from && !flexible;

  // Lazy-extending month list — start with 24 cards (2 years out)
  // and lengthen by 12 each time the user clicks the "next" chevron
  // past the current end. Caps at 60 months (5 years) to keep the
  // popover snappy.
  const [monthCount, setMonthCount] = useState(24);
  const monthCards = useMemo(() => {
    const out = [];
    const first = startOfMonth(new Date());
    for (let i = 0; i < monthCount; i += 1) out.push(addMonths(first, i));
    return out;
  }, [monthCount]);

  const handleCalendarSelect = (selected) => {
    if (!selected) {
      onChange({ checkin: '', checkout: '', flexible: null });
      return;
    }
    // Picking precise dates clears any prior flexible selection.
    onChange({ checkin: toIso(selected.from), checkout: toIso(selected.to), flexible: null });
  };

  const handleApply = () => {
    if (mode === 'flexible' && flexMonth) {
      // Airbnb-style: emit the flexible window itself, NOT resolved
      // dates. The parent (/stays) widens its availability filter to
      // any N-night sub-window within the chosen month.
      onChange({
        checkin: '',
        checkout: '',
        flexible: { stayLength, monthIso: format(flexMonth, 'yyyy-MM') },
      });
    }
    setOpen(false);
  };

  const handleClear = () => {
    onChange({ checkin: '', checkout: '', flexible: null });
    setFlexMonth(null);
  };

  const applyDisabled = mode === 'flexible' ? !flexMonth : !(range.from && range.to);

  return (
    <div className="relative w-full h-full" ref={wrapRef} data-testid={`${testidPrefix}-wrapper`}>
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="w-full h-full text-left px-4 py-2 hover:bg-black/5 transition-colors min-w-0"
        data-testid={`${testidPrefix}-trigger`}
      >
        <p className={`text-[10px] font-bold uppercase tracking-wide ${labelClassName || 'text-gray-400'}`}>
          {t('stays.when', 'When')}
        </p>
        <p
          className={`text-sm font-medium truncate ${
            isPlaceholder
              ? (variant === 'dark' ? 'text-gray-300' : 'text-gray-400')
              : (valueClassName || 'text-gray-800')
          }`}
        >
          {displayValue}
        </p>
      </button>

      {open && createPortal(
        <>
          <div
            className="fixed inset-0 z-[60] bg-black/40 transition-opacity duration-200"
            onClick={() => setOpen(false)}
            aria-hidden="true"
            data-testid={`${testidPrefix}-backdrop`}
          />
          <div
            className="fixed z-[61] left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 bg-white rounded-3xl shadow-2xl border border-gray-100 p-4 sm:p-6 origin-center transition-all duration-200 ease-out animate-in fade-in zoom-in-95"
            style={{ width: 'min(94vw, 760px)', maxHeight: '92vh', overflowY: 'auto' }}
            data-testid={`${testidPrefix}-popover`}
          >
            {/* Dates | Flexible tab toggle — pill on grey background,
                matches the Airbnb screenshot exactly. */}
            <div className="flex items-center justify-center mb-4">
              <div className="inline-flex items-center bg-[#EBEBEB] rounded-full p-1" data-testid={`${testidPrefix}-tabs`}>
                <button
                  type="button"
                  onClick={() => setMode('dates')}
                  className={`px-5 py-1.5 rounded-full text-sm font-semibold transition-all ${
                    mode === 'dates' ? 'bg-white shadow text-gray-900' : 'text-gray-600 hover:text-gray-900'
                  }`}
                  data-testid={`${testidPrefix}-tab-dates`}
                >
                  {t('stays.tabDates', 'Dates')}
                </button>
                <button
                  type="button"
                  onClick={() => setMode('flexible')}
                  className={`px-5 py-1.5 rounded-full text-sm font-semibold transition-all ${
                    mode === 'flexible' ? 'bg-white shadow text-gray-900' : 'text-gray-600 hover:text-gray-900'
                  }`}
                  data-testid={`${testidPrefix}-tab-flexible`}
                >
                  {t('stays.tabFlexible', 'Flexible')}
                </button>
              </div>
              <button
                onClick={() => setOpen(false)}
                className="absolute end-4 top-4 p-1.5 hover:bg-gray-100 rounded-full"
                data-testid={`${testidPrefix}-close`}
                aria-label="Close"
              >
                <X size={16} />
              </button>
            </div>

            {mode === 'dates' ? (
              <DayPicker
                mode="range"
                selected={range}
                onSelect={handleCalendarSelect}
                numberOfMonths={2}
                disabled={{ before: new Date() }}
                showOutsideDays={false}
                className="rdp-airbnb"
              />
            ) : (
              <FlexiblePanel
                stayLength={stayLength}
                setStayLength={setStayLength}
                monthCards={monthCards}
                flexMonth={flexMonth}
                setFlexMonth={setFlexMonth}
                onExtend={() => setMonthCount((n) => Math.min(n + 12, 60))}
                canExtend={monthCount < 60}
                testidPrefix={testidPrefix}
                t={t}
              />
            )}

            <div className="flex items-center justify-between mt-4 pt-3 border-t border-gray-100">
              <button
                onClick={handleClear}
                className="text-sm font-semibold text-gray-700 underline hover:text-black"
                data-testid={`${testidPrefix}-clear`}
              >
                {t('stays.clear', 'Clear')}
              </button>
              <button
                onClick={handleApply}
                disabled={applyDisabled}
                className={`px-5 py-2 rounded-lg text-sm font-semibold text-white ${
                  applyDisabled ? 'opacity-50 cursor-not-allowed' : ''
                }`}
                style={{ backgroundColor: '#1E6A6A' }}
                data-testid={`${testidPrefix}-apply`}
              >
                {mode === 'flexible'
                  ? (flexMonth ? t('stays.apply', 'Apply') : t('stays.pickAMonth', 'Pick a month'))
                  : (range.from && range.to ? t('stays.apply', 'Apply') : t('stays.close', 'Close'))}
              </button>
            </div>
          </div>
        </>,
        document.body,
      )}
    </div>
  );
};

// ---------------------------------------------------------------------------
// Flexible panel — "How long" + "Go anytime" month cards.
// ---------------------------------------------------------------------------
const FlexiblePanel = ({ stayLength, setStayLength, monthCards, flexMonth, setFlexMonth, onExtend, canExtend, testidPrefix, t }) => {
  const lengths = [
    { v: 'weekend', label: t('stays.lengthWeekend', 'Weekend') },
    { v: 'week',    label: t('stays.lengthWeek', 'Week') },
    { v: 'month',   label: t('stays.lengthMonth', 'Month') },
  ];
  // Programmatic horizontal scroller — drives both the prev/next arrows
  // and the lazy-extend on reaching the right edge. Using `scrollBy` so
  // we move ~3 cards at a time which matches the snap stride.
  const rowRef = useRef(null);
  const SCROLL_STEP = 360; // ~3 cards × 110px + gap
  const scroll = (dir) => {
    const el = rowRef.current;
    if (!el) return;
    // If user scrolled near the right end and we can still extend, load
    // more months before scrolling so the scroll keeps revealing new
    // cards rather than slamming into the boundary.
    if (dir === 1 && canExtend) {
      const nearEnd = el.scrollLeft + el.clientWidth >= el.scrollWidth - SCROLL_STEP;
      if (nearEnd) onExtend?.();
    }
    el.scrollBy({ left: dir * SCROLL_STEP, behavior: 'smooth' });
  };
  // Auto-extend when the user reaches the right edge via touch / wheel.
  useEffect(() => {
    const el = rowRef.current;
    if (!el || !canExtend) return undefined;
    const onScroll = () => {
      if (el.scrollLeft + el.clientWidth >= el.scrollWidth - 80) {
        onExtend?.();
      }
    };
    el.addEventListener('scroll', onScroll, { passive: true });
    return () => el.removeEventListener('scroll', onScroll);
  }, [canExtend, onExtend]);
  return (
    <div className="space-y-5" data-testid={`${testidPrefix}-flexible-panel`}>
      {/* "How long would you like to stay?" */}
      <div className="text-center">
        <h3 className="text-base font-bold text-gray-900 mb-3">
          {t('stays.howLong', 'How long would you like to stay?')}
        </h3>
        <div className="inline-flex flex-wrap items-center justify-center gap-2">
          {lengths.map(({ v, label }) => (
            <button
              key={v}
              type="button"
              onClick={() => setStayLength(v)}
              className={`px-5 py-2 rounded-full border text-sm font-semibold transition-colors ${
                stayLength === v
                  ? 'bg-black text-white border-black'
                  : 'bg-white text-gray-800 border-gray-200 hover:border-gray-900'
              }`}
              data-testid={`${testidPrefix}-length-${v}`}
            >
              {label}
            </button>
          ))}
        </div>
      </div>

      {/* "Go anytime" — horizontal scrollable month strip with arrow
          affordances and lazy-extend on scroll to reveal later months. */}
      <div>
        <h3 className="text-base font-bold text-gray-900 text-center mb-3">
          {t('stays.goAnytime', 'Go anytime')}
        </h3>
        <div className="relative">
          {/* Prev arrow */}
          <button
            type="button"
            onClick={() => scroll(-1)}
            aria-label="Scroll to earlier months"
            className="hidden sm:flex absolute left-0 top-1/2 -translate-y-1/2 z-10 w-8 h-8 rounded-full bg-white border border-gray-300 shadow items-center justify-center text-gray-700 hover:border-gray-900 transition-colors"
            data-testid={`${testidPrefix}-month-prev`}
          >
            <ChevronLeft size={16} />
          </button>
          {/* Next arrow — also triggers lazy extend when near the end */}
          <button
            type="button"
            onClick={() => scroll(1)}
            aria-label="Scroll to later months"
            className="hidden sm:flex absolute right-0 top-1/2 -translate-y-1/2 z-10 w-8 h-8 rounded-full bg-white border border-gray-300 shadow items-center justify-center text-gray-700 hover:border-gray-900 transition-colors"
            data-testid={`${testidPrefix}-month-next`}
          >
            <ChevronRight size={16} />
          </button>
          <div
            ref={rowRef}
            className="flex gap-3 overflow-x-auto pb-2 px-2 sm:px-10 snap-x snap-mandatory scrollbar-hide"
            style={{ scrollbarWidth: 'none' }}
            data-testid={`${testidPrefix}-month-row`}
          >
            {monthCards.map((d) => {
              const key = format(d, 'yyyy-MM');
              const selected = flexMonth && format(flexMonth, 'yyyy-MM') === key;
              return (
                <button
                  key={key}
                  type="button"
                  onClick={() => setFlexMonth(d)}
                  className={`snap-start shrink-0 w-[110px] flex flex-col items-center justify-center gap-1 px-3 py-4 rounded-xl border-2 transition-colors ${
                    selected
                      ? 'border-black bg-gray-50'
                      : 'border-gray-200 hover:border-gray-400'
                  }`}
                  data-testid={`${testidPrefix}-month-${key}`}
                >
                  <CalendarIcon size={22} className="text-gray-600" strokeWidth={1.5} />
                  <p className="text-sm font-semibold text-gray-900 mt-1">
                    {MONTH_LABEL(d)}
                  </p>
                  <p className="text-xs text-gray-500">{YEAR_LABEL(d)}</p>
                </button>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
};

export default WhenPicker;
