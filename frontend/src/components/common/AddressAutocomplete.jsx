/**
 * Google-Maps-style autocomplete input for address / neighborhood /
 * landmark search. Used by both Stays and Services to fix the "I
 * spelled it wrong and got nothing" UX problem the plain text input
 * had.
 *
 * Behaviour:
 *   • Debounced fetch (250ms) against /api/geocode/suggest so we
 *     don't hammer the endpoint on every keystroke.
 *   • Renders a dropdown with two-line suggestion cards
 *     (bold primary label, muted sublabel).
 *   • Full keyboard nav: ArrowUp/ArrowDown to move, Enter to select,
 *     Escape to close.
 *   • Click-outside closes the dropdown.
 *   • Selecting a row calls `onSelect({ label, lat, lng })` — the
 *     parent doesn't need to re-geocode, we already have coords.
 *   • Enter with no highlight OR the submit button click falls back
 *     to `onSubmit(query)` so power users can still type-and-go.
 */
import React, { useEffect, useMemo, useRef, useState } from 'react';
import axios from 'axios';
import { Loader2, MapPin, Search, X } from 'lucide-react';

const API = `${process.env.REACT_APP_BACKEND_URL}/api`;

/**
 * @param {object} props
 * @param {string} props.value           Controlled input value.
 * @param {(v:string)=>void} props.onChange
 * @param {(hit:{label:string,lat:number,lng:number})=>void} props.onSelect
 * @param {(q:string)=>void} [props.onSubmit] Fallback for free-form Enter/submit.
 * @param {()=>void} [props.onClear]      Called when the X button is clicked.
 * @param {boolean} [props.hasSelection]  When true, shows an X instead of the search icon.
 * @param {string} props.placeholder
 * @param {string} props.testId           Base test-id (used for input + dropdown items).
 */
const AddressAutocomplete = ({
  value,
  onChange,
  onSelect,
  onSubmit,
  onClear,
  hasSelection,
  placeholder,
  testId = 'address-autocomplete',
}) => {
  const [suggestions, setSuggestions] = useState([]);
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [highlight, setHighlight] = useState(-1);
  const wrapRef = useRef(null);
  const debounceRef = useRef(0);
  const requestIdRef = useRef(0);
  // After picking a suggestion, the parent typically writes the label
  // back into `value` which would retrigger the debounced fetch and
  // pop the dropdown open again. This ref suppresses exactly one
  // fetch cycle following a pick so the dropdown stays closed.
  const suppressNextFetchRef = useRef(false);

  // Debounced fetch. The `requestIdRef` guards against a slow older
  // request landing after a newer one — without it, a quick typist
  // could see stale suggestions if two responses arrive out of order.
  useEffect(() => {
    if (debounceRef.current) window.clearTimeout(debounceRef.current);
    if (suppressNextFetchRef.current) {
      suppressNextFetchRef.current = false;
      return undefined;
    }
    const q = (value || '').trim();
    if (q.length < 2) {
      setSuggestions([]);
      setOpen(false);
      return undefined;
    }
    debounceRef.current = window.setTimeout(async () => {
      const rid = ++requestIdRef.current;
      setLoading(true);
      try {
        const r = await axios.get(`${API}/geocode/suggest`, {
          params: { q, limit: 6 },
        });
        if (rid !== requestIdRef.current) return;
        setSuggestions(r.data?.results || []);
        setOpen(true);
        setHighlight(-1);
      } catch {
        if (rid !== requestIdRef.current) return;
        setSuggestions([]);
      } finally {
        if (rid === requestIdRef.current) setLoading(false);
      }
    }, 250);
    return () => window.clearTimeout(debounceRef.current);
  }, [value]);

  // Close on outside click. Attached to the document with capture
  // so we can react to clicks on portalled content too.
  useEffect(() => {
    if (!open) return undefined;
    const handler = (e) => {
      if (wrapRef.current && !wrapRef.current.contains(e.target)) {
        setOpen(false);
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [open]);

  const pick = (hit) => {
    suppressNextFetchRef.current = true;
    setOpen(false);
    setSuggestions([]);
    setHighlight(-1);
    onSelect(hit);
  };

  const onKeyDown = (e) => {
    if (!open || !suggestions.length) {
      if (e.key === 'Enter' && onSubmit) {
        e.preventDefault();
        onSubmit(value);
      }
      return;
    }
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setHighlight((h) => (h + 1) % suggestions.length);
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setHighlight((h) => (h - 1 + suggestions.length) % suggestions.length);
    } else if (e.key === 'Enter') {
      e.preventDefault();
      if (highlight >= 0 && suggestions[highlight]) {
        pick(suggestions[highlight]);
      } else if (onSubmit) {
        onSubmit(value);
      }
    } else if (e.key === 'Escape') {
      setOpen(false);
    }
  };

  // Render — kept intentionally simple so this component drops into
  // any page style. The parent controls the outer chrome (padding,
  // pill background, focus ring).
  const showDropdown = open && suggestions.length > 0;
  return (
    <div ref={wrapRef} className="relative flex-1 min-w-[240px]">
      <div className="flex items-center bg-gray-50 rounded-full border border-gray-200 focus-within:border-[#1E6A6A] focus-within:bg-white transition-colors">
        <MapPin size={14} className="ms-3 text-gray-500 shrink-0" />
        <input
          value={value}
          onChange={(e) => onChange(e.target.value)}
          onKeyDown={onKeyDown}
          onFocus={() => suggestions.length && setOpen(true)}
          placeholder={placeholder}
          className="flex-1 px-2 py-2 text-xs sm:text-sm bg-transparent focus:outline-none"
          data-testid={`${testId}-input`}
          autoComplete="off"
        />
        {hasSelection ? (
          <button
            type="button"
            onClick={() => { onClear?.(); }}
            className="pe-3 ps-1 text-[#1E6A6A] hover:opacity-70"
            title="Clear"
            data-testid={`${testId}-clear`}
          >
            <X size={14} />
          </button>
        ) : (
          <button
            type="button"
            onClick={() => { onSubmit?.(value); }}
            disabled={loading || !(value || '').trim()}
            className="pe-3 ps-1 text-[#1E6A6A] hover:opacity-70 disabled:opacity-30"
            title="Search"
            data-testid={`${testId}-submit`}
          >
            {loading ? <Loader2 size={14} className="animate-spin" /> : <Search size={14} />}
          </button>
        )}
      </div>

      {showDropdown && (
        <div
          className="absolute z-50 mt-1 w-full bg-white rounded-2xl shadow-[0_20px_50px_-15px_rgba(15,58,58,0.35)] ring-1 ring-black/5 overflow-hidden"
          role="listbox"
          data-testid={`${testId}-dropdown`}
        >
          {suggestions.map((s, i) => {
            const active = i === highlight;
            return (
              <button
                key={`${s.label}-${s.lat}-${s.lng}`}
                type="button"
                onMouseDown={(e) => { e.preventDefault(); pick(s); }}
                onMouseEnter={() => setHighlight(i)}
                className={`w-full text-start flex items-start gap-3 px-4 py-2.5 transition-colors ${
                  active ? 'bg-[#1E6A6A]/8' : 'hover:bg-gray-50'
                }`}
                role="option"
                aria-selected={active}
                data-testid={`${testId}-item-${i}`}
              >
                <MapPin size={16} className={active ? 'text-[#1E6A6A] mt-0.5 shrink-0' : 'text-gray-400 mt-0.5 shrink-0'} />
                <div className="min-w-0 flex-1">
                  <div className="text-sm font-semibold text-gray-900 truncate">{s.label}</div>
                  {s.sublabel && (
                    <div className="text-[11px] text-gray-500 truncate">{s.sublabel}</div>
                  )}
                </div>
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
};

export default AddressAutocomplete;
