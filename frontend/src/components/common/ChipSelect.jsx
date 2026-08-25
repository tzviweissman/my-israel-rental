/**
 * A short list of options, all visible at once, instead of a dropdown.
 *
 * A `<select>` with three entries costs a click, a read and a second click
 * to learn something the form could simply have shown — and until that
 * click, the person filling it in cannot tell whether the choice is easy or
 * hard, or whether the default already suits them. Chips answer all of that
 * before they are touched.
 *
 * Only for SHORT lists. This is not a general replacement for `<select>`:
 * bedrooms, floors and areas run to fifteen or thirty options, and a wall
 * of thirty chips is worse than the dropdown it replaced. The rule of
 * thumb used in this codebase is roughly four options with short labels;
 * `cancellation_policy` stays a dropdown despite having four, because its
 * labels are full sentences.
 *
 * Keyboard behaviour follows the radio-group pattern rather than the
 * tab-through-every-button one: one tab stop for the whole group, arrows to
 * move within it. Tabbing through four chips to reach the next field is the
 * kind of accessibility regression that "just use buttons" quietly ships.
 */
import React, { useRef } from 'react';

export default function ChipSelect({
  value,
  onChange,
  options,          // [{ value, label }]
  label = null,
  name,
  className = '',
  testid,
}) {
  const groupRef = useRef(null);

  const move = (delta) => {
    const i = options.findIndex((o) => String(o.value) === String(value));
    // Wraps, so the last chip's ArrowRight returns to the first rather than
    // dead-ending.
    const next = options[(i + delta + options.length) % options.length];
    if (!next) return;
    onChange(next.value);
    // Follow the selection with focus, or the arrow keys move the highlight
    // somewhere the screen reader is not.
    requestAnimationFrame(() => {
      groupRef.current
        ?.querySelector(`[data-chip-value="${CSS.escape(String(next.value))}"]`)
        ?.focus();
    });
  };

  const onKeyDown = (e) => {
    // Logical, not physical: under RTL the visual order is mirrored, so
    // ArrowRight must mean "previous". Reading the group's own direction
    // rather than a global flag keeps it right inside a mirrored subtree.
    const rtl = groupRef.current
      && getComputedStyle(groupRef.current).direction === 'rtl';
    const forward = rtl ? 'ArrowLeft' : 'ArrowRight';
    const back = rtl ? 'ArrowRight' : 'ArrowLeft';
    if (e.key === forward || e.key === 'ArrowDown') { e.preventDefault(); move(1); }
    else if (e.key === back || e.key === 'ArrowUp') { e.preventDefault(); move(-1); }
  };

  return (
    <div className={className}>
      {label && <span className="block text-sm font-medium mb-2">{label}</span>}
      <div
        ref={groupRef}
        role="radiogroup"
        aria-label={typeof label === 'string' ? label : name}
        className="flex flex-wrap gap-2"
        onKeyDown={onKeyDown}
        data-testid={testid}
      >
        {options.map((o) => {
          const active = String(o.value) === String(value);
          return (
            <button
              key={String(o.value)}
              type="button"
              role="radio"
              aria-checked={active}
              // One tab stop for the group: only the selected chip is
              // reachable by Tab, and arrows move within.
              tabIndex={active ? 0 : -1}
              data-chip-value={String(o.value)}
              onClick={() => onChange(o.value)}
              className={`px-3 py-1.5 rounded-full text-sm font-medium border transition-colors
                focus:outline-none focus-visible:ring-2 focus-visible:ring-offset-1
                focus-visible:ring-[rgb(var(--brand-primary-rgb)/0.55)]`}
              style={{
                borderColor: active ? 'var(--brand-primary)' : 'var(--brand-border)',
                // A wash rather than a solid fill — a filled chip at this
                // size reads as a pressed button, and there are several of
                // these on one form.
                backgroundColor: active ? 'rgb(var(--brand-primary-rgb) / 0.08)' : '#FFFFFF',
                color: active ? 'var(--brand-primary)' : 'var(--ink)',
                fontWeight: active ? 700 : 500,
              }}
              data-testid={testid ? `${testid}-${o.value}` : undefined}
            >
              {o.label}
            </button>
          );
        })}
      </div>
    </div>
  );
}
