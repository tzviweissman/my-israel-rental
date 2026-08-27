/**
 * T2 — a contextual tip: a caption on a feature, not a tour step.
 *
 *   A small dismissible tip beside a feature the first time an owner is in
 *   a position to use it.
 *
 * Three rules, all enforced rather than hoped for:
 *
 *   1. One per surface, shown once, dismissed forever — the dismissal is
 *      stored server-side per user per tip id, so it does not come back on
 *      their phone.
 *   2. Never more than one visible at a time anywhere on screen. Enforced
 *      by the single slot in OnboardingProvider, not by the tips happening
 *      to live on different screens today.
 *   3. Beside the feature, never over it. This is a block in the flow, not
 *      an absolutely-positioned coach-mark — which is also why it cannot
 *      mis-position under `dir="rtl"`, the failure mode the spec calls out.
 *      Anchored tooltips are T4's problem, and T4 is not built.
 */
import React from 'react';
import { useTranslation } from 'react-i18next';
import { Lightbulb, X } from 'lucide-react';
import { useOnboardingSlot, localeKeyFor } from './OnboardingProvider';

/**
 * @param {string}  id        'tip.share' | 'tip.chat' | 'tip.availability'
 * @param {boolean} eligible  whether the owner is actually in a position to
 *                            use the feature — a tip about blocking dates,
 *                            shown to someone with nothing to block, is
 *                            noise rather than help.
 */
export default function OnboardingTip({ id, eligible = true, className = '' }) {
  const { t } = useTranslation();
  const { visible, dismiss } = useOnboardingSlot(id, eligible);
  if (!visible) return null;

  return (
    <div
      className={`rounded-xl border px-3 py-2.5 flex items-start gap-2.5 ${className}`}
      style={{
        // A tinted panel from the brand primary, not a new colour. Gold
        // would read as promotional and green is reserved for status.
        background: 'rgb(var(--brand-primary-rgb) / 0.06)',
        borderColor: 'var(--brand-border)',
      }}
      role="note"
      data-testid={`onboarding-${id}`}
    >
      <Lightbulb
        size={15}
        aria-hidden="true"
        className="shrink-0 mt-0.5"
        style={{ color: 'var(--brand-primary)' }}
      />
      <p className="text-xs leading-relaxed flex-1 min-w-0" style={{ color: 'var(--ink)' }}>
        {t(`tips.${localeKeyFor(id)}`, '')}
      </p>
      <button
        type="button"
        onClick={dismiss}
        aria-label={t('common.dismiss', 'Dismiss')}
        className="shrink-0 p-0.5 rounded"
        style={{ color: 'var(--brand-muted)' }}
        data-testid={`onboarding-${id}-dismiss`}
      >
        <X size={14} />
      </button>
    </div>
  );
}
