/**
 * WherePicker — typeable area search input with autocomplete dropdown.
 *
 * Replaces the previous read-only `<select>` "Where" segment in the
 * home/stays search pills. Users can type freely; matching areas from
 * the existing inventory are surfaced as click-to-pick suggestions.
 * The parent owns `value` as a plain string (same contract as before)
 * so URL params and the downstream Stays filter keep working — Stays
 * now does a case-insensitive substring match on the value so partial
 * city names ("tel", "jeru") return the right listings.
 */
import React, { useState, useRef, useEffect, useMemo } from 'react';
import { MapPin, X } from 'lucide-react';

const WherePicker = ({
  value,
  onChange,
  options = [],
  placeholder = 'Anywhere',
  labelClassName = '',
  testidPrefix = 'where',
}) => {
  const [open, setOpen] = useState(false);
  const wrapRef = useRef(null);
  const inputRef = useRef(null);

  // Close the suggestions popover on outside click. Unlike the calendar
  // popover, this one is anchored under the input (no portal), so a
  // simple ref-contains check is correct.
  useEffect(() => {
    if (!open) return;
    const onDown = (e) => {
      if (wrapRef.current && !wrapRef.current.contains(e.target)) setOpen(false);
    };
    document.addEventListener('mousedown', onDown);
    return () => document.removeEventListener('mousedown', onDown);
  }, [open]);

  // Substring match (case-insensitive). When the input is empty, show
  // every area; users glance at the full list as a hint.
  const filteredOptions = useMemo(() => {
    const q = (value || '').trim().toLowerCase();
    if (!q) return options;
    return options.filter((o) => o.toLowerCase().includes(q));
  }, [value, options]);

  const handlePick = (opt) => {
    onChange(opt);
    setOpen(false);
    inputRef.current?.blur();
  };

  return (
    <div className="relative w-full" ref={wrapRef} data-testid={`${testidPrefix}-wrapper`}>
      <div className="px-4 py-2 min-w-0">
        <p className={`text-[10px] font-bold uppercase tracking-wide ${labelClassName || 'text-gray-400'}`}>
          Where
        </p>
        <div className="flex items-center">
          <input
            ref={inputRef}
            type="text"
            value={value}
            onChange={(e) => { onChange(e.target.value); setOpen(true); }}
            onFocus={() => setOpen(true)}
            placeholder={placeholder}
            className="w-full bg-transparent text-sm font-medium text-gray-800 outline-none placeholder:text-gray-400"
            data-testid={`${testidPrefix}-input`}
            autoComplete="off"
          />
          {value && (
            <button
              type="button"
              onClick={() => { onChange(''); inputRef.current?.focus(); }}
              className="ml-1 p-0.5 text-gray-400 hover:text-gray-700"
              aria-label="Clear"
              data-testid={`${testidPrefix}-clear`}
            >
              <X size={14} />
            </button>
          )}
        </div>
      </div>

      {open && filteredOptions.length > 0 && (
        <div
          className="absolute z-50 left-0 right-0 mt-2 bg-white rounded-2xl shadow-2xl border border-gray-100 max-h-72 overflow-y-auto py-2 origin-top transition-all duration-150 animate-in fade-in zoom-in-95"
          data-testid={`${testidPrefix}-suggestions`}
        >
          {filteredOptions.slice(0, 12).map((opt) => (
            <button
              key={opt}
              type="button"
              onClick={() => handlePick(opt)}
              className="w-full text-left px-4 py-2.5 hover:bg-gray-50 flex items-center gap-3"
              data-testid={`${testidPrefix}-option-${opt.replace(/\s+/g, '-')}`}
            >
              <span className="w-8 h-8 rounded-lg bg-gray-100 flex items-center justify-center shrink-0">
                <MapPin size={14} className="text-gray-500" />
              </span>
              <span className="text-sm font-medium text-gray-800 truncate">{opt}</span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
};

export default WherePicker;
