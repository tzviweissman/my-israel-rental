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
          chipBg: 'bg-[#D4AF37]/10',
          icon: '#D4AF37',
          border: 'border-[#D4AF37]/20 hover:border-[#D4AF37]/40',
          calBorder: 'border-[#D4AF37]',
          chev: 'text-[#D4AF37]/40 group-hover:text-[#D4AF37]/60',
        }
      : {
          chipBg: 'bg-[#1E6A6A]/10',
          icon: '#1E6A6A',
          border: 'border-[#1E6A6A]/20 hover:border-[#1E6A6A]/40',
          calBorder: 'border-[#1E6A6A]',
          chev: 'text-[#1E6A6A]/40 group-hover:text-[#1E6A6A]/60',
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
              ? 'mt-3 p-3 bg-[#1E6A6A]/5 rounded-lg border border-[#1E6A6A]/10'
              : 'mt-3'
          }
        >
          <p
            className={
              variant === 'teal'
                ? 'text-xs text-[#1E6A6A] flex items-start gap-2'
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
