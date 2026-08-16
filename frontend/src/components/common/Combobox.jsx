/**
 * Type-to-filter picker: a text input, a filtered list, arrow keys.
 *
 * Exists because a <select> cannot be typed into. That is fine for three
 * options and hostile for fifteen or three hundred — the user knows the
 * word they are looking for and a select makes them hunt for it.
 *
 * Two modes, and the difference matters:
 *   allowFreeText  — the typed string is a valid answer (an area we have
 *                    never heard of is still a real place)
 *   otherwise      — only a listed option is valid, because the value is a
 *                    slug the API validates, so unmatched typing reverts
 *                    to the last good answer rather than being submitted
 *                    for the server to reject
 *
 * `options` take plain strings or {value,label} pairs, so a field whose
 * display text differs from its stored value (a category label against its
 * slug) shows the label and submits the slug.
 *
 * Not react-select: this is an input, a filtered list and a keydown
 * handler, and the bundle already carries enough.
 */
import React, { useEffect, useMemo, useRef, useState } from 'react';
const MAX_SUGGESTIONS = 8;

export default function Combobox({
  value,
  onChange,
  options,
  // When false the typed text is not a valid answer on its own — the
  // caller needs one of the options, so an unmatched string is discarded
  // on blur rather than submitted. Areas allow free text (a village we
  // have never heard of is still a real place); a service category does
  // not, because the value is a slug the API validates.
  allowFreeText = true,
  // options may be plain strings or {value,label} pairs.
  placeholder,
  icon: Icon,
  className,
  style,
  testid = 'combobox',
  emptyHint,
}) {
  const pairs = useMemo(
    () => (options || []).map((o) => (typeof o === 'string' ? { value: o, label: o } : o)),
    [options],
  );
  // What the user sees while typing. Kept separate from `value` so a
  // label-vs-slug pair (category) can show the label and submit the slug.
  const selectedLabel = useMemo(
    () => pairs.find((o) => o.value === value)?.label ?? (allowFreeText ? value : ''),
    [pairs, value, allowFreeText],
  );
  // Two jobs, so two behaviours:
  //
  //   free text  — every keystroke IS the answer, so it goes straight out
  //                through onChange. Buffering it and committing on blur
  //                read as tidier and silently threw the typing away when
  //                someone typed an area and hit Next in one motion, which
  //                is the most likely thing anyone does here.
  //   fixed list — the typed string is only a query; the answer is a slug.
  //                So the text is buffered and only a real pick commits.
  const [typed, setTyped] = useState(null);
  const text = allowFreeText ? (value ?? '') : (typed ?? selectedLabel ?? '');
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(-1);
  const wrapRef = useRef(null);

  const matches = useMemo(() => {
    const q = String(text || '').trim().toLowerCase();
    if (!q) return pairs.slice(0, MAX_SUGGESTIONS);
    // Substring, not prefix: an area's canonical value leads with the city
    // ("Jerusalem - Nachlaot"), so someone typing the neighbourhood would
    // match nothing under a prefix rule.
    const hits = pairs.filter((o) => o.label.toLowerCase().includes(q));
    // Whatever starts with the query is the better guess, so it leads.
    hits.sort((a, b) => {
      const ai = a.label.toLowerCase().indexOf(q);
      const bi = b.label.toLowerCase().indexOf(q);
      return ai - bi || a.label.localeCompare(b.label);
    });
    return hits.slice(0, MAX_SUGGESTIONS);
  }, [text, pairs]);

  // Close on an outside click. Without this the list stays open behind the
  // next field and swallows its first click.
  useEffect(() => {
    if (!open) return undefined;
    const onDown = (e) => {
      if (wrapRef.current && !wrapRef.current.contains(e.target)) { commitOnClose(); setOpen(false); }
    };
    document.addEventListener('mousedown', onDown);
    return () => document.removeEventListener('mousedown', onDown);
  }, [open]);

  const pick = (o) => {
    onChange(o.value);
    setTyped(null);
    setOpen(false);
    setActive(-1);
  };

  // Typing something that matches nothing: keep it if free text is
  // allowed, drop it if the caller needs a real option. Dropping it
  // silently would be worse, so the field visibly reverts to the last
  // valid answer rather than submitting a value the API will reject.
  // Only the fixed-list mode has anything to discard — free text has
  // already been committed keystroke by keystroke.
  const commitOnClose = () => setTyped(null);

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
      else { commitOnClose(); setOpen(false); }
    } else if (e.key === 'Escape') { setTyped(null); setOpen(false); setActive(-1); }
  };

  return (
    <div ref={wrapRef} className="relative">
      <div className="relative">
        {Icon && (
          <Icon
            size={15}
            className="absolute top-1/2 -translate-y-1/2 start-3.5 pointer-events-none"
            style={{ color: 'var(--brand-muted)' }}
            aria-hidden="true"
          />
        )}
        <input
          className={`${className} ${Icon ? 'ps-10' : ''}`}
          style={style}
          value={text}
          onChange={(e) => {
            if (allowFreeText) onChange(e.target.value); else setTyped(e.target.value);
            setOpen(true); setActive(-1);
          }}
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
          {matches.map((o, i) => (
            <li key={o.value}>
              <button
                type="button"
                role="option"
                aria-selected={i === active}
                // onMouseDown, not onClick: the input's blur would close the
                // list before a click ever landed.
                onMouseDown={(e) => { e.preventDefault(); pick(o); }}
                onMouseEnter={() => setActive(i)}
                className="w-full text-start px-3.5 py-2 text-sm"
                style={{
                  background: i === active ? 'rgb(var(--brand-primary-rgb) / 0.08)' : 'transparent',
                  color: 'var(--ink)',
                }}
                data-testid={`${testid}-option-${i}`}
              >
                {o.label}
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
