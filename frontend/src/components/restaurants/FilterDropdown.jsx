/**
 * One filter as a dropdown (Tzvi, 14 Oct 2026: "make the search by area a
 * search like the hechsher one and make the drop downs look nicer").
 *
 * A pill that reads "Hechsher" or "Area" until something is picked, then the
 * choice itself, filled, with an x to take it off. It opens a list with each
 * choice's count; a long list gets a type-to-find box. Escape, a click
 * outside or a choice closes it. A native <select> could not show counts
 * beside the names, a selected state, or the x.
 */
import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Check, ChevronDown, Search, X } from 'lucide-react';

export default function FilterDropdown({ label, allLabel, value, valueLabel, options, onChange, searchLabel, testId }) {
  const [open, setOpen] = useState(false);
  const [q, setQ] = useState('');
  const box = useRef(null);
  const findRef = useRef(null);
  const long = options.length > 8;

  useEffect(() => {
    if (!open) return undefined;
    const away = (e) => { if (box.current && !box.current.contains(e.target)) setOpen(false); };
    const key = (e) => { if (e.key === 'Escape') setOpen(false); };
    document.addEventListener('mousedown', away);
    document.addEventListener('touchstart', away);
    document.addEventListener('keydown', key);
    if (long && findRef.current) findRef.current.focus();
    return () => {
      document.removeEventListener('mousedown', away);
      document.removeEventListener('touchstart', away);
      document.removeEventListener('keydown', key);
    };
  }, [open, long]);
  useEffect(() => { if (!open) setQ(''); }, [open]);

  const shown = useMemo(() => {
    const s = q.trim().toLowerCase();
    return s ? options.filter((o) => String(o.label).toLowerCase().includes(s)) : options;
  }, [options, q]);
  const pick = (v) => { onChange(v); setOpen(false); };
  const on = !!value;

  return (
    <div className="relative" ref={box}>
      <div
        className="inline-flex items-center rounded-full border transition-colors"
        style={on
          ? { borderColor: 'var(--ink)', background: 'var(--ink)', color: '#fff' }
          : { borderColor: 'var(--brand-border)', background: '#fff', color: 'var(--ink)' }}
      >
        <button
          type="button"
          onClick={() => setOpen((x) => !x)}
          aria-haspopup="listbox"
          aria-expanded={open}
          className={`inline-flex min-h-[40px] items-center gap-1.5 ps-4 text-sm font-semibold ${on ? 'pe-1.5' : 'pe-3'}`}
          data-testid={testId}
        >
          <span className="max-w-[12rem] truncate">{on ? (valueLabel || value) : label}</span>
          {!on && <ChevronDown size={15} aria-hidden="true" className={`transition-transform ${open ? 'rotate-180' : ''}`} />}
        </button>
        {on && (
          <button
            type="button"
            onClick={() => pick('')}
            className="me-1 inline-flex h-8 w-8 items-center justify-center rounded-full hover:bg-white/15"
            aria-label={`${allLabel}`}
            data-testid={testId && `${testId}-clear`}
          >
            <X size={14} aria-hidden="true" />
          </button>
        )}
      </div>

      {open && (
        <div
          className="absolute start-0 z-40 mt-2 w-[min(19rem,calc(100vw-2rem))] overflow-hidden rounded-2xl border bg-white shadow-[0_18px_40px_-16px_rgba(17,24,39,0.35)]"
          style={{ borderColor: 'var(--brand-border)' }}
        >
          {long && (
            <label className="flex items-center gap-2 border-b px-3.5" style={{ borderColor: 'var(--brand-border)' }}>
              <Search size={15} aria-hidden="true" className="shrink-0 text-gray-400" />
              <input
                ref={findRef}
                value={q}
                onChange={(e) => setQ(e.target.value)}
                placeholder={searchLabel}
                aria-label={searchLabel}
                className="min-h-[44px] w-full bg-transparent text-sm outline-none"
              />
            </label>
          )}
          <ul role="listbox" aria-label={label} className="max-h-[18rem] overflow-y-auto py-1.5">
            {[{ value: '', label: allLabel }, ...shown].map((o) => {
              const sel = (o.value || '') === (value || '');
              return (
                <li key={o.value || '_all'}>
                  <button
                    type="button"
                    role="option"
                    aria-selected={sel}
                    onClick={() => pick(o.value)}
                    className="flex min-h-[42px] w-full items-center gap-2 px-3.5 text-start text-sm hover:bg-gray-50"
                    style={{ color: 'var(--ink)', fontWeight: sel ? 700 : 500 }}
                  >
                    <span className="w-4 shrink-0">{sel && <Check size={15} aria-hidden="true" style={{ color: 'var(--brand-primary)' }} />}</span>
                    <span className="min-w-0 flex-1 truncate" dir="auto">{o.label}</span>
                    {o.count != null && <span className="shrink-0 text-xs text-gray-500">{o.count}</span>}
                  </button>
                </li>
              );
            })}
            {!shown.length && <li className="px-3.5 py-3 text-sm text-gray-500">–</li>}
          </ul>
        </div>
      )}
    </div>
  );
}
