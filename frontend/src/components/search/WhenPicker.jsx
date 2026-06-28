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
import { Calendar as CalendarIcon, X } from 'lucide-react';
import { DayPicker } from 'react-day-picker';
import {
  format, parseISO, isValid,
  addDays, addMonths, startOfMonth, endOfMonth, getDay,
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

// Resolve a Flexible-mode selection into concrete check-in / check-out
// dates. Returns ISO strings the parent can store as if the user had
// picked them on the calendar — keeps downstream filters identical.
const resolveFlexible = (stayLength, monthDate) => {
  const monthStart = startOfMonth(monthDate);
  const today = new Date();
  // Never resolve to a check-in in the past (for the current month).
  const base = monthStart < today ? today : monthStart;
  if (stayLength === 'weekend') {
    // First Friday >= base. If base is already Fri (5) we use it.
    const d = new Date(base);
    while (getDay(d) !== 5) d.setDate(d.getDate() + 1);
    return { checkin: toIso(d), checkout: toIso(addDays(d, 2)) };
  }
  if (stayLength === 'week') {
    return { checkin: toIso(base), checkout: toIso(addDays(base, 7)) };
  }
  // month
  return { checkin: toIso(base), checkout: toIso(endOfMonth(monthDate)) };
};

const MONTH_LABEL = (d) => format(d, 'MMMM');
const YEAR_LABEL = (d) => format(d, 'yyyy');

const WhenPicker = ({
  checkin,
  checkout,
  onChange,
  variant = 'light',
  labelClassName = '',
  valueClassName = '',
  testidPrefix = 'when',
}) => {
  const [open, setOpen] = useState(false);
  const [mode, setMode] = useState('dates'); // 'dates' | 'flexible'
  const [stayLength, setStayLength] = useState('week');
  const [flexMonth, setFlexMonth] = useState(null); // Date or null
  const wrapRef = useRef(null);

  useEffect(() => {
    if (!open) return;
    const onKey = (e) => { if (e.key === 'Escape') setOpen(false); };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [open]);

  const range = { from: fromIso(checkin), to: fromIso(checkout) };

  let displayValue;
  if (range.from && range.to) {
    displayValue = `${formatShort(range.from)} – ${formatShort(range.to)}`;
  } else if (range.from) {
    displayValue = `${formatShort(range.from)} – ?`;
  } else {
    displayValue = 'Add dates';
  }
  const isPlaceholder = !range.from;

  // 12 upcoming month cards, starting from the current month.
  const monthCards = useMemo(() => {
    const out = [];
    const first = startOfMonth(new Date());
    for (let i = 0; i < 12; i += 1) out.push(addMonths(first, i));
    return out;
  }, []);

  const handleCalendarSelect = (selected) => {
    if (!selected) {
      onChange({ checkin: '', checkout: '' });
      return;
    }
    onChange({ checkin: toIso(selected.from), checkout: toIso(selected.to) });
  };

  const handleApply = () => {
    if (mode === 'flexible' && flexMonth) {
      onChange(resolveFlexible(stayLength, flexMonth));
    }
    setOpen(false);
  };

  const handleClear = () => {
    onChange({ checkin: '', checkout: '' });
    setFlexMonth(null);
  };

  const applyDisabled = mode === 'flexible' ? !flexMonth : !(range.from && range.to);

  return (
    <div className="relative" ref={wrapRef} data-testid={`${testidPrefix}-wrapper`}>
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="w-full text-left px-4 py-2 hover:bg-black/5 transition-colors min-w-0"
        data-testid={`${testidPrefix}-trigger`}
      >
        <p className={`text-[10px] font-bold uppercase tracking-wide ${labelClassName || 'text-gray-400'}`}>
          When
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
                  Dates
                </button>
                <button
                  type="button"
                  onClick={() => setMode('flexible')}
                  className={`px-5 py-1.5 rounded-full text-sm font-semibold transition-all ${
                    mode === 'flexible' ? 'bg-white shadow text-gray-900' : 'text-gray-600 hover:text-gray-900'
                  }`}
                  data-testid={`${testidPrefix}-tab-flexible`}
                >
                  Flexible
                </button>
              </div>
              <button
                onClick={() => setOpen(false)}
                className="absolute right-4 top-4 p-1.5 hover:bg-gray-100 rounded-full"
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
                testidPrefix={testidPrefix}
              />
            )}

            <div className="flex items-center justify-between mt-4 pt-3 border-t border-gray-100">
              <button
                onClick={handleClear}
                className="text-sm font-semibold text-gray-700 underline hover:text-black"
                data-testid={`${testidPrefix}-clear`}
              >
                Clear
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
                  ? (flexMonth ? 'Apply' : 'Pick a month')
                  : (range.from && range.to ? 'Apply' : 'Close')}
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
const FlexiblePanel = ({ stayLength, setStayLength, monthCards, flexMonth, setFlexMonth, testidPrefix }) => {
  const lengths = [
    { v: 'weekend', label: 'Weekend' },
    { v: 'week', label: 'Week' },
    { v: 'month', label: 'Month' },
  ];
  return (
    <div className="space-y-5" data-testid={`${testidPrefix}-flexible-panel`}>
      {/* "How long would you like to stay?" */}
      <div className="text-center">
        <h3 className="text-base font-bold text-gray-900 mb-3">
          How long would you like to stay?
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

      {/* "Go anytime" — horizontal scrollable month cards */}
      <div>
        <h3 className="text-base font-bold text-gray-900 text-center mb-3">
          Go anytime
        </h3>
        <div
          className="flex gap-3 overflow-x-auto pb-2 -mx-2 px-2 snap-x snap-mandatory"
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
  );
};

export default WhenPicker;
