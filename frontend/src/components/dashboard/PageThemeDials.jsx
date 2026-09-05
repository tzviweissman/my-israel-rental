/**
 * Phase 2: the dials, and the presets that move several at once.
 *
 * No AI, no quota, nothing that costs anything. That sequencing is the
 * spec's own (P6, and again in the research brief's recommendations): if
 * a preset system covers most of what owners actually want, it is worth
 * knowing that before paying a model to do it, and every review of the
 * generative builders describes their output as a starting point that
 * still needed a manual pass.
 *
 * WHY BUTTONS AND NOT SLIDERS. A slider implies a continuum and invites
 * a value between two designed positions. There is no design between
 * "airy" and "balanced"; there is a stylesheet with two rules in it.
 *
 * WHY NO PALETTE DIAL HERE. There is one, and it is the accent picker
 * two sections above in the same editor. A second control for the same
 * decision is two controls that can disagree, and the one that loses is
 * whichever the owner used first.
 *
 * WHY NO TEXT BOX. P7's governing principle: a blank text box is a
 * failure of design, not a feature. An owner cannot describe a design;
 * they can recognise one instantly. Everything here is recognising.
 */
import React from 'react';
import { useTranslation } from 'react-i18next';

import { DIALS, PRESETS, PRESET_NAMES, normalizeTheme } from '../../utils/pageComposition';

// The five the owner sets here. `palette` is the accent picker's, above.
const SHOWN_DIALS = ['type', 'density', 'imagery', 'price_prominence', 'motion'];

/** English fallbacks, so a missing Hebrew key is the only thing that can
 *  go wrong rather than a blank button. Every one has a real key in both
 *  locale files; these are what `t` falls back to. */
const LABELS = {
  type: 'Lettering',
  density: 'Spacing',
  imagery: 'Photos',
  price_prominence: 'Prices',
  motion: 'Movement',
};

const VALUES = {
  type: { serif: 'Classic', grotesque: 'Strong', geometric: 'Plain' },
  density: { airy: 'Roomy', balanced: 'Even', packed: 'Compact' },
  imagery: { 'full-bleed': 'Large', grid: 'Square', thumbnail: 'Small' },
  price_prominence: { quiet: 'Discreet', normal: 'Clear', loud: 'Front and centre' },
  motion: { still: 'None', subtle: 'Gentle' },
};

const PRESET_LABELS = {
  quiet: 'Understated',
  warm: 'Warm',
  bold: 'Bold',
  plain: 'Straightforward',
};

/** The words for a dial and for one of its positions.
 *  Exported so the "what changed" line in the editor says exactly what
 *  the buttons say. Two tables of the same labels drift, and the one that
 *  drifts is the one nobody is looking at. */
export const dialLabel = (t, dial) => t(`pageDesign.dial_${dial}`, LABELS[dial] || dial);
export const dialValueLabel = (t, dial, value) => t(
  `pageDesign.dialValue_${dial}_${value}`,
  (VALUES[dial] || {})[value] || value,
);

export default function PageThemeDials({ theme, onChange, touched, onTouch }) {
  const { t } = useTranslation();
  const current = normalizeTheme(theme);

  const applyPreset = (name) => {
    // A preset is every dial at once, including ones the owner had set by
    // hand: choosing a finished look is choosing a finished look. What it
    // does NOT touch is the palette, which is not in PRESETS at all.
    onChange({ ...current, ...PRESETS[name] });
    onTouch && onTouch(SHOWN_DIALS);
  };

  const setDial = (dial, value) => {
    onChange({ ...current, [dial]: value });
    onTouch && onTouch([dial]);
  };

  const activePreset = PRESET_NAMES.find(
    (name) => Object.entries(PRESETS[name]).every(([k, v]) => current[k] === v),
  ) || null;

  return (
    <section
      className="pt-5 border-t"
      style={{ borderColor: 'var(--brand-border)' }}
      data-testid="page-design-theme"
    >
      <h3 className="text-sm font-bold" style={{ color: 'var(--ink)' }}>
        {t('pageDesign.look', 'The look')}
      </h3>
      <p className="text-xs mt-0.5 mb-2" style={{ color: 'var(--brand-muted)' }}>
        {t('pageDesign.lookHint', 'Try one, then adjust anything. Nothing here costs you anything and you can always change it back.')}
      </p>

      <div className="flex flex-wrap gap-1.5 mb-4" data-testid="page-design-presets">
        {PRESET_NAMES.map((name) => (
          <button
            key={name}
            type="button"
            onClick={() => applyPreset(name)}
            aria-pressed={activePreset === name}
            className="px-3 py-2 rounded-lg text-xs font-semibold border"
            style={{
              borderColor: activePreset === name ? 'var(--ink)' : 'var(--brand-border)',
              background: activePreset === name ? 'var(--ink)' : 'var(--surface)',
              color: activePreset === name ? '#fff' : 'var(--ink)',
            }}
            data-testid={`page-design-preset-${name}`}
          >
            {t(`pageDesign.preset_${name}`, PRESET_LABELS[name])}
          </button>
        ))}
      </div>

      <div className="space-y-3">
        {SHOWN_DIALS.map((dial) => (
          <div key={dial}>
            <div className="flex items-baseline justify-between gap-2">
              <p className="text-xs font-semibold" style={{ color: 'var(--ink)' }}>
                {t(`pageDesign.dial_${dial}`, LABELS[dial])}
              </p>
              {touched && touched.has(dial) && (
                <span className="text-[10px]" style={{ color: 'var(--brand-muted)' }}>
                  {t('pageDesign.dialYours', 'yours')}
                </span>
              )}
            </div>
            <div
              className="mt-1 flex gap-1"
              role="radiogroup"
              aria-label={t(`pageDesign.dial_${dial}`, LABELS[dial])}
              data-testid={`page-design-dial-${dial}`}
            >
              {DIALS[dial].map((value) => (
                <button
                  key={value}
                  type="button"
                  role="radio"
                  aria-checked={current[dial] === value}
                  onClick={() => setDial(dial, value)}
                  /* 44px minimum, at every dial position. Touch-target
                     size is not an opinion and is not on any dial (P4). */
                  className="flex-1 min-h-[44px] px-2 rounded-lg text-xs font-semibold border"
                  style={{
                    borderColor: current[dial] === value ? 'var(--brand-primary)' : 'var(--brand-border)',
                    background: current[dial] === value ? 'rgb(var(--brand-primary-rgb) / 0.10)' : 'var(--surface)',
                    color: current[dial] === value ? 'var(--brand-primary-deep, var(--brand-primary))' : 'var(--brand-muted)',
                  }}
                  data-testid={`page-design-dial-${dial}-${value}`}
                >
                  {t(`pageDesign.dialValue_${dial}_${value}`, VALUES[dial][value])}
                </button>
              ))}
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}
