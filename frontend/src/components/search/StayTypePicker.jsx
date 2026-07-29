/**
 * StayTypePicker — third segment of the /stays search pill.
 *
 * Renders the small uppercase "Stay type" label + the currently
 * selected value (or a "Any" placeholder), and opens a small popover
 * below the segment with the four options: Any / Vacation / Short-term
 * / Long-term. Storage was retired from the platform earlier this year.
 *
 * Mirrors the visual contract of WherePicker / WhenPicker so the three
 * segments line up exactly inside the same pill.
 */
import React, { useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { ChevronDown, X, Home, Briefcase, Palmtree } from 'lucide-react';

const StayTypePicker = ({
  value,
  onChange,
  labelClassName = '',
  testidPrefix = 'stay-type',
}) => {
  const { t } = useTranslation();
  const [open, setOpen] = useState(false);
  const wrapRef = useRef(null);

  // Close on outside click — same pattern as WherePicker (popover is
  // anchored under the segment, no portal needed).
  useEffect(() => {
    if (!open) return;
    const onDown = (e) => {
      if (wrapRef.current && !wrapRef.current.contains(e.target)) setOpen(false);
    };
    document.addEventListener('mousedown', onDown);
    return () => document.removeEventListener('mousedown', onDown);
  }, [open]);

  // The four options live in the picker so adding/removing one
  // doesn't require touching Stays.jsx — storage is intentionally
  // absent since it's retired.
  const options = [
    { v: 'vacation', label: t('property.vacationType', 'Vacation'), icon: Palmtree },
    { v: 'short-term', label: t('property.shortTerm', 'Short-term'), icon: Home },
    { v: 'long-term', label: t('property.longTerm', 'Long-term'), icon: Briefcase },
  ];
  const selected = options.find((o) => o.v === value);

  const handlePick = (v) => {
    onChange(v);
    setOpen(false);
  };

  return (
    <div className="relative w-full" ref={wrapRef} data-testid={`${testidPrefix}-wrapper`}>
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className="w-full px-4 py-2 text-start min-w-0"
        data-testid={`${testidPrefix}-toggle`}
      >
        <p className={`text-[10px] font-bold uppercase tracking-wide ${labelClassName || 'text-gray-400'}`}>
          {t('stays.stayType', 'Stay type')}
        </p>
        <div className="flex items-center justify-between gap-1">
          <span className={`text-sm font-medium truncate ${selected ? 'text-gray-800' : 'text-gray-400'}`}>
            {selected ? selected.label : t('stays.any', 'Any')}
          </span>
          <div className="flex items-center gap-1 shrink-0">
            {selected && (
              <span
                role="button"
                tabIndex={0}
                onClick={(e) => { e.stopPropagation(); onChange(''); }}
                onKeyDown={(e) => { if (e.key === 'Enter') { e.stopPropagation(); onChange(''); } }}
                className="p-0.5 text-gray-400 hover:text-gray-700 cursor-pointer"
                aria-label={t('stays.clearStayType', 'Clear stay type')}
                data-testid={`${testidPrefix}-clear`}
              >
                <X size={14} />
              </span>
            )}
            <ChevronDown size={14} className="text-gray-400" />
          </div>
        </div>
      </button>

      {open && (
        <div
          className="absolute z-50 left-0 right-0 mt-2 bg-white rounded-2xl shadow-2xl border border-gray-100 py-2 origin-top transition-all duration-150 animate-in fade-in zoom-in-95"
          data-testid={`${testidPrefix}-menu`}
        >
          <button
            type="button"
            onClick={() => handlePick('')}
            className={`w-full text-left px-4 py-2.5 hover:bg-gray-50 flex items-center gap-3 ${!selected ? 'bg-gray-50' : ''}`}
            data-testid={`${testidPrefix}-option-any`}
          >
            <span className="w-8 h-8 rounded-lg bg-gray-100 flex items-center justify-center shrink-0">
              <span className="text-xs font-bold text-gray-500">∗</span>
            </span>
            <span className="text-sm font-medium text-gray-800">{t('stays.any', 'Any')}</span>
          </button>
          {options.map((o) => {
            const Icon = o.icon;
            const active = value === o.v;
            return (
              <button
                key={o.v}
                type="button"
                onClick={() => handlePick(o.v)}
                className={`w-full text-left px-4 py-2.5 hover:bg-gray-50 flex items-center gap-3 ${active ? 'bg-gray-50' : ''}`}
                data-testid={`${testidPrefix}-option-${o.v}`}
              >
                <span className="w-8 h-8 rounded-lg bg-gray-100 flex items-center justify-center shrink-0">
                  <Icon size={14} className="text-gray-500" />
                </span>
                <span className="text-sm font-medium text-gray-800">{o.label}</span>
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
};

export default StayTypePicker;
