/**
 * One date field for the whole app: a readable button that opens a
 * calendar, replacing `<input type="date">`.
 *
 * The native input is why this exists. It renders as "mm/dd/yyyy" — US
 * order, in a product whose users are in Israel and mostly write dates the
 * other way round, so it is ambiguous exactly where being wrong costs a
 * viewing or a booking. It cannot be styled to match anything around it,
 * it looks different in every browser, and its picker ignores the site's
 * language entirely.
 *
 * This shows the date the way the current language writes it, and opens a
 * calendar built from the same react-day-picker the booking sidebar
 * already uses — so there is one calendar in the product, not two that
 * disagree.
 *
 * Values in and out stay `YYYY-MM-DD` strings, which is what every caller
 * and every endpoint already speaks. Parsing is deliberately manual rather
 * than `new Date('2026-11-01')`: that constructor reads a bare date as UTC
 * midnight, so anyone west of Greenwich gets the day before. This app has
 * had that bug in a booking flow before.
 */
import React, { useEffect, useMemo, useRef, useState } from 'react';
import { DayPicker } from 'react-day-picker';
import { useTranslation } from 'react-i18next';
import { CalendarDays, X } from 'lucide-react';
import 'react-day-picker/dist/style.css';

/** 'YYYY-MM-DD' → local Date, or null. Never via new Date(string). */
export const parseISODate = (s) => {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(String(s || '').trim());
  if (!m) return null;
  const d = new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3]));
  return Number.isNaN(d.getTime()) ? null : d;
};

/** Date → 'YYYY-MM-DD' in LOCAL time, for the same reason as above. */
export const toISODate = (d) => {
  if (!d) return '';
  const p = (n) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
};

export default function DateField({
  value,
  onChange,
  min,
  max,
  placeholder,
  disabled = false,
  clearable = true,
  className = '',
  style,
  testid = 'date-field',
}) {
  const { t, i18n } = useTranslation();
  const [open, setOpen] = useState(false);
  const wrapRef = useRef(null);

  const selected = useMemo(() => parseISODate(value), [value]);
  const minDate = useMemo(() => parseISODate(min), [min]);
  const maxDate = useMemo(() => parseISODate(max), [max]);

  const label = useMemo(() => {
    if (!selected) return placeholder || t('common.pickDate', 'Pick a date');
    try {
      return new Intl.DateTimeFormat(i18n.language === 'he' ? 'he-IL' : 'en-GB', {
        day: 'numeric', month: 'short', year: 'numeric',
      }).format(selected);
    } catch {
      return value;
    }
  }, [selected, placeholder, t, i18n.language, value]);

  useEffect(() => {
    if (!open) return undefined;
    const onDown = (e) => {
      if (wrapRef.current && !wrapRef.current.contains(e.target)) setOpen(false);
    };
    const onKey = (e) => { if (e.key === 'Escape') setOpen(false); };
    document.addEventListener('mousedown', onDown);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('mousedown', onDown);
      document.removeEventListener('keydown', onKey);
    };
  }, [open]);

  const disabledDays = [];
  if (minDate) disabledDays.push({ before: minDate });
  if (maxDate) disabledDays.push({ after: maxDate });

  return (
    <div ref={wrapRef} className="relative">
      <button
        type="button"
        disabled={disabled}
        onClick={() => setOpen((o) => !o)}
        aria-haspopup="dialog"
        aria-expanded={open}
        className={`${className} flex items-center gap-2 text-start disabled:opacity-60`}
        style={style}
        data-testid={testid}
      >
        <CalendarDays size={15} style={{ color: 'var(--brand-muted)' }} aria-hidden="true" />
        <span
          className="flex-1 truncate"
          style={{ color: selected ? 'var(--ink)' : 'var(--brand-muted)' }}
        >
          {label}
        </span>
        {clearable && selected && !disabled && (
          // A span, not a nested button — a button inside a button is
          // invalid HTML and React will render it but the browser will not
          // nest the click targets the way you expect.
          <span
            role="button"
            tabIndex={0}
            aria-label={t('common.clearDate', 'Clear date')}
            onClick={(e) => { e.stopPropagation(); onChange(''); setOpen(false); }}
            onKeyDown={(e) => {
              if (e.key === 'Enter' || e.key === ' ') {
                e.preventDefault(); e.stopPropagation(); onChange(''); setOpen(false);
              }
            }}
            className="inline-flex h-5 w-5 items-center justify-center rounded-full hover:bg-black/5"
            data-testid={`${testid}-clear`}
          >
            <X size={13} style={{ color: 'var(--brand-muted)' }} aria-hidden="true" />
          </span>
        )}
      </button>

      {open && (
        <div
          className="absolute z-40 mt-2 rounded-2xl border bg-white p-2 shadow-xl"
          style={{ borderColor: 'var(--brand-border)' }}
          role="dialog"
          data-testid={`${testid}-popover`}
        >
          <DayPicker
            mode="single"
            selected={selected || undefined}
            defaultMonth={selected || minDate || undefined}
            disabled={disabledDays.length ? disabledDays : undefined}
            onSelect={(d) => {
              // A second click on the chosen day returns undefined, which
              // reads as "clear it" — honour that rather than ignoring it.
              onChange(d ? toISODate(d) : '');
              if (d) setOpen(false);
            }}
            dir={i18n.language === 'he' ? 'rtl' : 'ltr'}
            weekStartsOn={0}
            showOutsideDays
            className="mir-daypicker"
          />
        </div>
      )}
    </div>
  );
}
