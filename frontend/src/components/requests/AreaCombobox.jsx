/**
 * Type-to-filter area picker, backed by the canonical list in
 * `constants/locations.js`.
 *
 * Free text is still allowed and still submitted verbatim — the field is
 * free text on the server and someone posting about a village we have
 * never heard of must not be blocked by our list. The dropdown is a
 * shortcut, not a gate.
 *
 * Why it matters beyond convenience: `area` is what the matching digest
 * greps to decide which owners hear about a request, and what the board's
 * area filter matches on. "Ramat Eshkol" and "ramat eshkol jerusalem" and
 * "R. Eshkol" are the same place to a person and three different places to
 * a regex. Every pick from this list is one that spells itself the same
 * way as the listings do.
 *
 * Deliberately not a <select>: a select cannot be typed into, and the list
 * is ~300 entries long. Deliberately not react-select either — this is a
 * text input, a filtered list and arrow keys, and the app already carries
 * enough dependency weight.
 */
import React, { useEffect, useMemo, useRef, useState } from 'react';
import { MapPin } from 'lucide-react';
import { ALL_AREA_VALUES } from '../../constants/locations';

const MAX_SUGGESTIONS = 8;

export default function AreaCombobox({
  value,
  onChange,
  placeholder,
  className,
  style,
  testid = 'area-combobox',
  emptyHint,
}) {
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(-1);
  const wrapRef = useRef(null);

  const matches = useMemo(() => {
    const q = (value || '').trim().toLowerCase();
    if (!q) return ALL_AREA_VALUES.slice(0, MAX_SUGGESTIONS);
    // Substring, not prefix: people type the neighbourhood, and the
    // canonical value starts with the city ("Jerusalem - Nachlaot"), so a
    // prefix match would find nothing for the word they actually typed.
    const hits = ALL_AREA_VALUES.filter((a) => a.toLowerCase().includes(q));
    // Whatever starts with the query is the better guess, so it goes first.
    hits.sort((a, b) => {
      const ai = a.toLowerCase().indexOf(q);
      const bi = b.toLowerCase().indexOf(q);
      return ai - bi || a.localeCompare(b);
    });
    return hits.slice(0, MAX_SUGGESTIONS);
  }, [value]);

  // Close on an outside click. Without this the list stays open behind the
  // next field and swallows its first click.
  useEffect(() => {
    if (!open) return undefined;
    const onDown = (e) => {
      if (wrapRef.current && !wrapRef.current.contains(e.target)) setOpen(false);
    };
    document.addEventListener('mousedown', onDown);
    return () => document.removeEventListener('mousedown', onDown);
  }, [open]);

  const pick = (v) => {
    onChange(v);
    setOpen(false);
    setActive(-1);
  };

  const onKeyDown = (e) => {
    if (!open && (e.key === 'ArrowDown' || e.key === 'ArrowUp')) { setOpen(true); return; }
    if (!open) return;
    if (e.key === 'ArrowDown') { e.preventDefault(); setActive((i) => Math.min(i + 1, matches.length - 1)); }
    else if (e.key === 'ArrowUp') { e.preventDefault(); setActive((i) => Math.max(i - 1, -1)); }
    else if (e.key === 'Enter') {
      // Only swallow Enter when a suggestion is highlighted. Otherwise it
      // must keep meaning "I typed my own answer, move on" — this sits in a
      // wizard, and stealing Enter would strand anyone using the keyboard.
      if (active >= 0 && matches[active]) { e.preventDefault(); pick(matches[active]); }
      else setOpen(false);
    } else if (e.key === 'Escape') { setOpen(false); setActive(-1); }
  };

  return (
    <div ref={wrapRef} className="relative">
      <div className="relative">
        <MapPin
          size={15}
          className="absolute top-1/2 -translate-y-1/2 start-3.5 pointer-events-none"
          style={{ color: 'var(--brand-muted)' }}
          aria-hidden="true"
        />
        <input
          className={`${className} ps-10`}
          style={style}
          value={value}
          onChange={(e) => { onChange(e.target.value); setOpen(true); setActive(-1); }}
          onFocus={() => setOpen(true)}
          onKeyDown={onKeyDown}
          placeholder={placeholder}
          maxLength={120}
          role="combobox"
          aria-expanded={open}
          aria-autocomplete="list"
          aria-controls={`${testid}-list`}
          autoComplete="off"
          data-testid={testid}
        />
      </div>

      {open && matches.length > 0 && (
        <ul
          id={`${testid}-list`}
          role="listbox"
          className="absolute z-30 mt-1 w-full max-h-64 overflow-auto rounded-xl border bg-white py-1 shadow-lg"
          style={{ borderColor: 'var(--brand-border)' }}
          data-testid={`${testid}-list`}
        >
          {matches.map((a, i) => (
            <li key={a}>
              <button
                type="button"
                role="option"
                aria-selected={i === active}
                // onMouseDown, not onClick: the input's blur would close the
                // list before a click ever landed.
                onMouseDown={(e) => { e.preventDefault(); pick(a); }}
                onMouseEnter={() => setActive(i)}
                className="w-full text-start px-3.5 py-2 text-sm"
                style={{
                  background: i === active ? 'rgb(var(--brand-primary-rgb) / 0.08)' : 'transparent',
                  color: 'var(--ink)',
                }}
                data-testid={`${testid}-option-${i}`}
              >
                {a}
              </button>
            </li>
          ))}
        </ul>
      )}

      {open && matches.length === 0 && emptyHint && (
        <p className="mt-1.5 text-[11px]" style={{ color: 'var(--brand-muted)' }} data-testid={`${testid}-empty`}>
          {emptyHint}
        </p>
      )}
    </div>
  );
}
