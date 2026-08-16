/**
 * "On date / Before date / I'm flexible" — the date question on a request
 * (C3 of the marketplace research).
 *
 * Pills rather than a dropdown, for a reason worth stating: for rentals,
 * *flexible* is the common answer. A dropdown hides every option behind a
 * click and makes whichever one is listed first look like the default, so
 * the most common answer becomes the least visible. Three pills show all
 * three at once and cost nothing to compare.
 *
 * Flexible hides the date input entirely rather than disabling it. A
 * disabled field still reads as something you failed to fill in.
 *
 * The mode is stored separately from the date and is never inferred from a
 * blank one — a missing date means "the seeker did not say", which is not
 * the same claim as "the seeker is flexible", and only one of those is
 * worth showing to an owner.
 */
import React from 'react';
import { CalendarDays, CalendarClock, Sparkles } from 'lucide-react';

const MODES = [
  { key: 'on', Icon: CalendarDays, tKey: 'requests.dateOn', label: 'On date' },
  { key: 'before', Icon: CalendarClock, tKey: 'requests.dateBefore', label: 'Before date' },
  { key: 'flexible', Icon: Sparkles, tKey: 'requests.dateFlexible', label: "I'm flexible" },
];

export default function DateModePills({ value, onChange, t, testidPrefix = 'request-date-mode' }) {
  return (
    <div
      className="flex flex-wrap gap-2"
      role="radiogroup"
      aria-label={t('requests.dateModeLabel', 'When do you need it?')}
    >
      {MODES.map(({ key, Icon, tKey, label }) => {
        const active = value === key;
        return (
          <button
            key={key}
            type="button"
            role="radio"
            aria-checked={active}
            onClick={() => onChange(key)}
            data-testid={`${testidPrefix}-${key}`}
            className="inline-flex items-center gap-1.5 rounded-full px-3.5 py-2 text-[13px] font-semibold transition-colors"
            style={{
              // Selected is the filled one; the other two are outlined. One
              // filled element in the group, which is the same rule the rest
              // of the site follows.
              background: active ? 'var(--brand-primary)' : 'transparent',
              color: active ? '#fff' : 'var(--ink)',
              border: `1.5px solid ${active ? 'var(--brand-primary)' : 'var(--brand-border)'}`,
            }}
          >
            <Icon size={13} aria-hidden="true" />
            {t(tKey, label)}
          </button>
        );
      })}
    </div>
  );
}
