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
 *
 * `labelFor` (optional) localises what the user SEES without touching what
 * gets stored in `value`. The Stays page passes `areaLabel` so Hebrew mode
 * shows "רמת אשכול" while the filter value stays the canonical English
 * string the backend understands. Suggestions match on the label as well as
 * the raw option, so typing Hebrew finds the right area too.
 */
import React, { useState, useRef, useEffect, useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { MapPin, X, Clock } from 'lucide-react';

/** One suggestion. Kept local — it is this panel's layout, not a shape
 *  anything else needs. `onMouseDown` rather than `onClick` so the pick
 *  lands before the input's blur closes the panel out from under it. */
const Row = ({ id, icon: Icon, label, count = null, active, onPick, testid }) => (
  <button
    id={id}
    role="option"
    aria-selected={active}
    type="button"
    onMouseDown={(e) => { e.preventDefault(); onPick(); }}
    className={`w-full text-start px-4 py-2.5 flex items-center gap-3 ${
      active ? 'bg-gray-100' : 'hover:bg-gray-50'
    }`}
    data-testid={testid}
  >
    <span className="w-8 h-8 rounded-lg bg-gray-100 flex items-center justify-center shrink-0">
      <Icon size={14} className="text-gray-500" />
    </span>
    <span className="text-sm font-medium text-gray-800 truncate flex-1">{label}</span>
    {count !== null && (
      <span className="text-xs text-gray-400 shrink-0 tabular-nums">{count}</span>
    )}
  </button>
);

const WherePicker = ({
  value,
  onChange,
  options = [],
  placeholder,
  labelClassName = '',
  labelFor = null,
  testidPrefix = 'where',
  // Real listing counts per option, e.g. { 'Tel Aviv': 42 }. Drives the
  // "most listings" ordering and the number beside each row. Omit it and
  // the panel just lists areas alphabetically, as before.
  counts = null,
  // The user's own previous searches for this surface. Omit for none.
  recent = [],
  // Called when a suggestion is committed, so the caller can record it.
  onCommit = null,
}) => {
  const { t } = useTranslation();
  const effectivePlaceholder = placeholder ?? t('stays.anywhere', 'Anywhere');
  const [open, setOpen] = useState(false);
  // Which row the keyboard is on. -1 = the input itself.
  const [active, setActive] = useState(-1);
  // True while the user is typing their own text. Drives whether the input
  // shows the raw value (mid-typing — anything else would fight the
  // keystrokes) or its localised label (after a pick / on load).
  const [typing, setTyping] = useState(false);
  const wrapRef = useRef(null);
  const inputRef = useRef(null);
  const display = (opt) => (labelFor ? labelFor(opt) : opt);

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

  // Substring match (case-insensitive) against both the raw option and its
  // localised label, so a Hebrew-mode user typing "רמת" gets the same hits
  // an English-mode user gets typing "ramat". When the input is empty, show
  // every area; users glance at the full list as a hint.
  const filteredOptions = useMemo(() => {
    const q = (value || '').trim().toLowerCase();
    if (!q) {
      // Nothing typed: lead with the areas that actually have the most to
      // show. Alphabetical is a filing order, not a helpful one — it puts
      // whichever area starts with 'A' above the city half the inventory
      // is in. Falls back to the caller's order when no counts are given.
      if (!counts) return options;
      return [...options].sort((a, b) => (counts[b] || 0) - (counts[a] || 0));
    }
    return options.filter((o) => {
      if (o.toLowerCase().includes(q)) return true;
      const lbl = labelFor ? labelFor(o) : '';
      return Boolean(lbl) && String(lbl).toLowerCase().includes(q);
    });
  }, [value, options, labelFor, counts]);

  const isBrowsing = !(value || '').trim();

  // Recent searches only make sense before the user starts narrowing —
  // once they are typing, the list they want is the matches. Filtered
  // against the current options so a saved area that no longer has any
  // listings cannot be offered.
  const recentRows = useMemo(() => {
    if (!isBrowsing || !recent?.length) return [];
    const known = new Set(options);
    return recent.filter((r) => known.has(r.value)).slice(0, 3);
  }, [isBrowsing, recent, options]);

  const optionRows = useMemo(
    // Areas already offered above as "recent" are not repeated below.
    () => {
      const shown = new Set(recentRows.map((r) => r.value));
      return filteredOptions.filter((o) => !shown.has(o)).slice(0, 12);
    },
    [filteredOptions, recentRows],
  );

  // One flat list is what the arrow keys walk, regardless of which section
  // a row is drawn in — a keyboard user should not have to know the panel
  // has headings.
  const rows = useMemo(
    () => [...recentRows.map((r) => r.value), ...optionRows],
    [recentRows, optionRows],
  );

  // Reopening, or typing, must not leave the highlight on a row that has
  // moved or vanished under it.
  useEffect(() => { setActive(-1); }, [value, open]);

  const handlePick = (opt) => {
    // Always hands the parent the RAW option (canonical English), never the
    // translated label — the value doubles as the filter/URL param.
    onChange(opt);
    onCommit?.(opt, display(opt));
    setTyping(false);
    setOpen(false);
    setActive(-1);
    inputRef.current?.blur();
  };

  const onKeyDown = (e) => {
    if (e.key === 'Escape') {
      setOpen(false);
      setActive(-1);
      return;
    }
    if (e.key === 'Enter') {
      // Enter on a highlighted row picks it. Enter with nothing highlighted
      // is left alone — the parent may be submitting a free-text search,
      // and swallowing it would break typing an area we do not list.
      if (active >= 0 && rows[active]) {
        e.preventDefault();
        handlePick(rows[active]);
      }
      return;
    }
    if (e.key !== 'ArrowDown' && e.key !== 'ArrowUp') return;
    if (!rows.length) return;
    e.preventDefault();
    if (!open) { setOpen(true); return; }
    const step = e.key === 'ArrowDown' ? 1 : -1;
    // Wraps, and -1 (the input) is part of the cycle so ArrowUp from the
    // first row returns focus to what you typed rather than trapping you.
    const next = active + step;
    setActive(next >= rows.length ? -1 : next < -1 ? rows.length - 1 : next);
  };

  const rowId = (i) => `${testidPrefix}-row-${i}`;

  return (
    <div className="relative w-full" ref={wrapRef} data-testid={`${testidPrefix}-wrapper`}>
      <div className="px-4 py-2 min-w-0">
        <p className={`text-[10px] font-bold uppercase tracking-wide ${labelClassName || 'text-gray-400'}`}>
          {t('stays.where', 'Where')}
        </p>
        <div className="flex items-center">
          <input
            ref={inputRef}
            type="text"
            // Mid-typing the input must echo the keystrokes verbatim; once
            // the user has picked (or on first load from the URL) we show
            // the localised label for the underlying value instead.
            value={typing ? value : display(value)}
            onChange={(e) => { setTyping(true); onChange(e.target.value); setOpen(true); }}
            onFocus={() => setOpen(true)}
            onBlur={() => setTyping(false)}
            onKeyDown={onKeyDown}
            placeholder={effectivePlaceholder}
            className="w-full bg-transparent text-sm font-medium text-gray-800 outline-none placeholder:text-gray-400"
            data-testid={`${testidPrefix}-input`}
            autoComplete="off"
            role="combobox"
            aria-expanded={open && rows.length > 0}
            aria-controls={`${testidPrefix}-suggestions`}
            aria-autocomplete="list"
            aria-activedescendant={active >= 0 ? rowId(active) : undefined}
          />
          {value && (
            <button
              type="button"
              onClick={() => { setTyping(false); onChange(''); inputRef.current?.focus(); }}
              className="ms-1 p-0.5 text-gray-400 hover:text-gray-700"
              aria-label={t('stays.clear', 'Clear')}
              data-testid={`${testidPrefix}-clear`}
            >
              <X size={14} />
            </button>
          )}
        </div>
      </div>

      {/* Nothing to say → nothing rendered. No "no results" card, no
          placeholder rows: an empty panel under a search field is worse
          than no panel, because it still covers the page. */}
      {open && rows.length > 0 && (
        <div
          id={`${testidPrefix}-suggestions`}
          role="listbox"
          className="absolute z-50 start-0 end-0 mt-2 bg-white rounded-2xl shadow-2xl border border-gray-100 max-h-72 overflow-y-auto py-2 origin-top transition-all duration-150 animate-in fade-in zoom-in-95"
          data-testid={`${testidPrefix}-suggestions`}
        >
          {recentRows.length > 0 && (
            <p className="px-4 pt-1 pb-1.5 text-[10px] font-bold uppercase tracking-wide text-gray-400">
              {t('stays.recentSearches', 'Recent searches')}
            </p>
          )}
          {recentRows.map((r, i) => (
            <Row
              key={`recent-${r.value}`}
              id={rowId(i)}
              icon={Clock}
              label={display(r.value) || r.label}
              active={active === i}
              onPick={() => handlePick(r.value)}
              testid={`${testidPrefix}-recent-${r.value.replace(/\s+/g, '-')}`}
            />
          ))}

          {recentRows.length > 0 && optionRows.length > 0 && (
            <p className="px-4 pt-2 pb-1.5 text-[10px] font-bold uppercase tracking-wide text-gray-400">
              {isBrowsing && counts
                ? t('stays.mostListings', 'Most listings')
                : t('stays.areas', 'Areas')}
            </p>
          )}
          {optionRows.map((opt, i) => (
            <Row
              key={opt}
              id={rowId(recentRows.length + i)}
              icon={MapPin}
              label={display(opt)}
              // Real inventory, counted from what the page loaded. Absent
              // rather than zero when we have no count for an area — "0"
              // would read as "we checked, there is nothing".
              count={counts && counts[opt] ? counts[opt] : null}
              active={active === recentRows.length + i}
              onPick={() => handlePick(opt)}
              testid={`${testidPrefix}-option-${opt.replace(/\s+/g, '-')}`}
            />
          ))}
        </div>
      )}
    </div>
  );
};

export default WherePicker;
