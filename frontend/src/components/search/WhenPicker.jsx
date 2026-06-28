/**
 * WhenPicker — Airbnb-style "When" search segment with range calendar popover.
 *
 * Used by the Home and Stays search pills. Replaces the previous pair of
 * native date inputs (Check in / Check out) with a single segment that
 * reads "When / Add dates" until a range is picked, then shows the chosen
 * range (e.g. "Jun 5 – Jul 12"). Clicking the segment opens a centered
 * popover containing a 2-month side-by-side range calendar (1 month on
 * mobile). The component is fully controlled — parent owns `checkin` /
 * `checkout` as ISO YYYY-MM-DD strings so existing URL-state and search
 * code keeps working unchanged.
 */
import React, { useState, useRef, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { Calendar as CalendarIcon, X } from 'lucide-react';
import { DayPicker } from 'react-day-picker';
import { format, parseISO, isValid } from 'date-fns';
import 'react-day-picker/dist/style.css';
import './whenpicker.css';

const toIso = (d) => (d ? format(d, 'yyyy-MM-dd') : '');
const fromIso = (s) => {
  if (!s) return undefined;
  const d = parseISO(s);
  return isValid(d) ? d : undefined;
};

// Format a single date for the segment label. Local-month abbreviated
// (en-US default) — e.g. "Jun 5".
const formatShort = (d) => (d ? format(d, 'MMM d') : '');

const WhenPicker = ({
  checkin,
  checkout,
  onChange,
  variant = 'light', // "light" (white pill on Stays) | "dark" (white-on-dark on Home hero)
  labelClassName = '',
  valueClassName = '',
  testidPrefix = 'when',
}) => {
  const [open, setOpen] = useState(false);
  const wrapRef = useRef(null);

  // Close on Escape. Outside-click is handled by the portal backdrop
  // below (we can't rely on a contains() check because the popover is
  // rendered into document.body via a portal — clicking inside it would
  // appear "outside" the wrapper ref and incorrectly close the picker).
  useEffect(() => {
    if (!open) return;
    const onKey = (e) => { if (e.key === 'Escape') setOpen(false); };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [open]);

  const range = {
    from: fromIso(checkin),
    to: fromIso(checkout),
  };

  // Render the picked range or the placeholder.
  let displayValue;
  if (range.from && range.to) {
    displayValue = `${formatShort(range.from)} – ${formatShort(range.to)}`;
  } else if (range.from) {
    displayValue = `${formatShort(range.from)} – ?`;
  } else {
    displayValue = 'Add dates';
  }
  const isPlaceholder = !range.from;

  const handleSelect = (selected) => {
    // DayPicker calls this with undefined when the user clicks an already
    // selected single date again. Treat that as "start over".
    if (!selected) {
      onChange({ checkin: '', checkout: '' });
      return;
    }
    onChange({
      checkin: toIso(selected.from),
      checkout: toIso(selected.to),
    });
  };

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
          {/* Backdrop — full-screen so the popover feels modal. Clicking
              it closes the picker. */}
          <div
            className="fixed inset-0 z-[60] bg-black/40 transition-opacity duration-200"
            onClick={() => setOpen(false)}
            aria-hidden="true"
            data-testid={`${testidPrefix}-backdrop`}
          />

          {/* Centered popover. Rendered via React portal so the host pill's
              `overflow-hidden` (used to clip the rounded-full background)
              cannot crop the calendar. */}
          <div
            className="fixed z-[61] left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 bg-white rounded-3xl shadow-2xl border border-gray-100 p-4 sm:p-6 origin-center transition-all duration-200 ease-out animate-in fade-in zoom-in-95"
            style={{ width: 'min(94vw, 760px)', maxHeight: '92vh', overflowY: 'auto' }}
            data-testid={`${testidPrefix}-popover`}
          >
            <div className="flex items-center justify-between mb-3">
              <p className="text-sm font-bold">Select dates</p>
              <button
                onClick={() => setOpen(false)}
                className="p-1.5 hover:bg-gray-100 rounded-full"
                data-testid={`${testidPrefix}-close`}
                aria-label="Close"
              >
                <X size={16} />
              </button>
            </div>

            <DayPicker
              mode="range"
              selected={range}
              onSelect={handleSelect}
              numberOfMonths={window.matchMedia('(min-width: 768px)').matches ? 2 : 1}
              disabled={{ before: new Date() }}
              showOutsideDays={false}
              className="rdp-airbnb"
            />

            <div className="flex items-center justify-between mt-4 pt-3 border-t border-gray-100">
              <button
                onClick={() => onChange({ checkin: '', checkout: '' })}
                className="text-sm font-semibold text-gray-700 underline hover:text-black"
                data-testid={`${testidPrefix}-clear`}
              >
                Clear
              </button>
              <button
                onClick={() => setOpen(false)}
                className="px-5 py-2 rounded-lg text-sm font-semibold text-white"
                style={{ backgroundColor: '#1E6A6A' }}
                data-testid={`${testidPrefix}-apply`}
              >
                {range.from && range.to ? 'Apply' : 'Close'}
              </button>
            </div>
          </div>
        </>,
        document.body,
      )}
    </div>
  );
};

export default WhenPicker;
