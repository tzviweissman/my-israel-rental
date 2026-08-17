import React, { useState } from 'react';
import { Calendar as CalendarIcon, X } from 'lucide-react';
import { format } from 'date-fns';
import { Calendar as CalendarComponent } from '../../ui/calendar';

// Parse YYYY-MM-DD without UTC midnight drift.
const parseLocalDate = (dateStr) => {
  if (!dateStr) return null;
  const [y, m, d] = String(dateStr).split('T')[0].split('-').map(Number);
  return new Date(y, m - 1, d);
};

/**
 * Reusable single-date picker with our pill-style trigger + popover.
 *
 * Variants:
 *   variant="teal"  — used for hard-locked dates (e.g. long-term Starting Date)
 *   variant="gold"  — used for soft availability (e.g. vacation Date Available)
 *
 * value/onChange use the wire format yyyy-MM-dd.
 */
const DateField = ({
  label,
  value,
  onChange,
  helperText,
  helperIcon,
  emoji,
  required = false,
  variant = 'teal',
  testid,
}) => {
  const [open, setOpen] = useState(false);
  const colors =
    variant === 'gold'
      ? {
          chipBg: 'bg-[rgb(var(--gold-rgb)/<alpha-value>)]/10',
          icon: 'var(--gold)',
          border: 'border-[rgb(var(--gold-rgb)/<alpha-value>)]/20 hover:border-[rgb(var(--gold-rgb)/<alpha-value>)]/40',
          calBorder: 'border-[var(--gold)]',
          chev: 'text-[rgb(var(--gold-rgb)/<alpha-value>)]/40 group-hover:text-[rgb(var(--gold-rgb)/<alpha-value>)]/60',
        }
      : {
          chipBg: 'bg-[rgb(var(--brand-primary-rgb)/<alpha-value>)]/10',
          icon: 'var(--brand-primary)',
          border: 'border-[rgb(var(--brand-primary-rgb)/<alpha-value>)]/20 hover:border-[rgb(var(--brand-primary-rgb)/<alpha-value>)]/40',
          calBorder: 'border-[var(--brand-primary)]',
          chev: 'text-[rgb(var(--brand-primary-rgb)/<alpha-value>)]/40 group-hover:text-[rgb(var(--brand-primary-rgb)/<alpha-value>)]/60',
        };
  const parsed = parseLocalDate(value);

  return (
    <div className="relative" data-testid={testid}>
      <label className="block text-sm font-medium mb-3 flex items-center gap-2 text-gray-700">
        <div className={`p-2 ${colors.chipBg} rounded-lg`}>
          <CalendarIcon size={18} style={{ color: colors.icon }} />
        </div>
        <span className="font-semibold">
          {label}
          {required && ' *'}
        </span>
      </label>
      <div className="relative cursor-pointer" onClick={() => setOpen(!open)}>
        <div
          className={`w-full px-5 py-4 rounded-xl border-2 ${colors.border} bg-white hover:shadow-md transition-all duration-200 flex items-center justify-between group`}
        >
          <span
            className={`text-base font-medium ${parsed ? 'text-gray-700' : 'text-gray-400'}`}
          >
            {parsed ? format(parsed, 'MMMM d, yyyy') : `Select ${label.toLowerCase()}`}
          </span>
          <CalendarIcon size={20} className={`${colors.chev} transition-colors`} />
        </div>
      </div>
      {open && (
        <div
          className={`absolute top-full mt-2 bg-white rounded-xl border-2 ${colors.calBorder} shadow-2xl p-4 z-[100] w-[320px]`}
        >
          <button
            onClick={(e) => {
              e.stopPropagation();
              setOpen(false);
            }}
            className="absolute top-2 right-2 p-1 rounded-full hover:bg-gray-100 z-[110]"
          >
            <X size={14} />
          </button>
          <CalendarComponent
            mode="single"
            selected={parsed}
            defaultMonth={parsed || new Date()}
            onSelect={(date) => {
              if (date) {
                onChange(format(date, 'yyyy-MM-dd'));
                setOpen(false);
              }
            }}
            disabled={[{ before: new Date() }]}
            initialFocus
          />
        </div>
      )}
      {helperText && (
        <div
          className={
            variant === 'teal'
              ? 'mt-3 p-3 bg-[rgb(var(--brand-primary-rgb)/<alpha-value>)]/5 rounded-lg border border-[rgb(var(--brand-primary-rgb)/<alpha-value>)]/10'
              : 'mt-3'
          }
        >
          <p
            className={
              variant === 'teal'
                ? 'text-xs text-[var(--brand-primary)] flex items-start gap-2'
                : 'text-xs text-gray-500 flex items-center gap-2'
            }
          >
            {emoji && <span className={variant === 'teal' ? 'text-base' : 'text-sm'}>{emoji}</span>}
            {helperIcon}
            <span className={variant === 'teal' ? 'font-medium' : ''}>{helperText}</span>
          </p>
        </div>
      )}
    </div>
  );
};

export default DateField;
