/**
 * Where a business works: any number of cities, and/or the whole country.
 *
 * NOT AN EITHER/OR. A Jerusalem shop that also ships nationwide is both,
 * and that is the common case rather than the awkward one (Tzvi,
 * 30 Aug 2026). So "All of Israel" is a checkbox alongside the cities,
 * not a mode that disables them — ticking it does not clear what the
 * owner already chose, and unticking it does not lose it.
 *
 * WHY NOT ChipSelect. That component is a radio group — one value, arrow
 * keys moving a single selection — and its own docstring says it is for
 * roughly four short options. Twelve cities with multi-select is a
 * different control, so this is a checkbox grid: every option visible,
 * each independently focusable, no dropdown hiding half the country.
 *
 * WHAT THE CITIES MEAN once nationwide is on: they stop being the limit
 * and become the base — the places this business is actually near. The
 * caption changes to say so, because a list of cities under a "whole
 * country" tick otherwise reads as a contradiction the owner cannot
 * resolve.
 */
import React from 'react';
import { useTranslation } from 'react-i18next';
import { Check, Globe } from 'lucide-react';

// Mirrors backend/routes/marketplace/shared.py::MAX_SERVICE_AREAS. The
// server truncates past this; the UI stops before it so nobody picks a
// seventh city, saves, and silently loses it.
export const MAX_SERVICE_AREAS = 6;

export default function ServiceAreaPicker({
  locations = [],          // [{ slug, label }]
  areas = [],              // selected slugs
  nationwide = false,
  onChange,                // ({ areas, nationwide })
  disabled = false,
}) {
  const { t } = useTranslation();
  const atCap = areas.length >= MAX_SERVICE_AREAS;

  const toggleArea = (slug) => {
    const has = areas.includes(slug);
    if (!has && atCap) return;
    onChange({
      areas: has ? areas.filter((a) => a !== slug) : [...areas, slug],
      nationwide,
    });
  };

  return (
    <div data-testid="service-area-picker" data-nationwide={nationwide ? '1' : '0'}>
      <span className="text-xs font-semibold" style={{ color: 'var(--brand-muted)' }}>
        {t('serviceArea.label', 'Where do you work?')}
      </span>

      <div className="flex flex-wrap gap-2 mt-2">
        {locations.map((loc) => {
          const on = areas.includes(loc.slug);
          const blocked = !on && atCap;
          return (
            <button
              key={loc.slug}
              type="button"
              role="checkbox"
              aria-checked={on}
              disabled={disabled || blocked}
              onClick={() => toggleArea(loc.slug)}
              className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl text-sm font-medium transition-colors disabled:opacity-40"
              style={{
                background: on ? 'var(--brand-primary)' : 'var(--surface)',
                color: on ? '#fff' : 'var(--ink)',
                border: `1px solid ${on ? 'var(--brand-primary)' : 'var(--brand-border)'}`,
              }}
              data-testid={`service-area-${loc.slug}`}
            >
              {on && <Check size={14} aria-hidden="true" />}
              {loc.label}
            </button>
          );
        })}
      </div>

      {atCap && (
        <p className="text-xs mt-2" style={{ color: 'var(--brand-muted)' }} data-testid="service-area-cap">
          {t('serviceArea.cap',
            'That is the most cities you can list. Covering more than this is what "All of Israel" is for.')}
        </p>
      )}

      {/* Gold, because it is the wider claim and the one worth noticing —
          and solid rather than frosted, per the button rule in CLAUDE.md. */}
      <button
        type="button"
        role="checkbox"
        aria-checked={nationwide}
        disabled={disabled}
        onClick={() => onChange({ areas, nationwide: !nationwide })}
        className="mt-3 w-full inline-flex items-center gap-2 px-3 py-2.5 rounded-xl text-sm font-semibold transition-colors disabled:opacity-40"
        style={{
          background: nationwide ? 'var(--gold)' : 'var(--surface)',
          color: nationwide ? 'var(--ink)' : 'var(--brand-muted)',
          border: `1px solid ${nationwide ? 'var(--gold)' : 'var(--brand-border)'}`,
        }}
        data-testid="service-area-nationwide"
      >
        {nationwide ? <Check size={15} aria-hidden="true" /> : <Globe size={15} aria-hidden="true" />}
        {t('serviceArea.nationwide', 'I serve all of Israel')}
      </button>

      <p className="text-xs mt-2" style={{ color: 'var(--brand-muted)' }} data-testid="service-area-hint">
        {nationwide
          ? t('serviceArea.hintNationwide',
            'You will show up in every city. Any cities picked above are shown as your base.')
          : t('serviceArea.hintCities',
            'Pick every city you travel to. If you ship or travel anywhere in the country, tick the box instead.')}
      </p>
    </div>
  );
}
