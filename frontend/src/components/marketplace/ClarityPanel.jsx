/**
 * ClarityPanel: the top of an UPGRADED page (the paid page upgrade,
 * backend utils/page_upgrade; docs/ai-page-builder-spec.md P4a). Rendered
 * only when the page's payload says page_upgrade: true, and never on a
 * standard page.
 *
 * Four lines, one per question, readable in five seconds:
 *   1. Where am I?        who, what they do, where
 *   2. What do I get?     up to three things, each with a price or
 *                          "Ask for a quote", never a blank
 *   3. Why should I care? the backed strengths and real proof only
 *   4. What do I do next? ONE solid action; anything else a quiet link
 *
 * The page builds the lines from its own data; which action leads and
 * which strengths may show come from the server (upgrade_view), so the
 * rules are not decided twice.
 */
import React from 'react';
import { useTranslation } from 'react-i18next';
import { ArrowRight } from 'lucide-react';

export default function ClarityPanel({ where, offers = [], why = null, primary, secondary = [], className = '', testid = 'clarity' }) {
  const { t } = useTranslation();
  const shown = offers.slice(0, 3);
  // `where` is [who, what, place]: who leads on its own line, the rest follow
  // with at most one separator dot (taste-skill: one per line; UI audit 24 Sep).
  const [who, ...about] = Array.isArray(where) ? where : [where];
  return (
    <section
      className={`rounded-2xl border bg-white p-4 sm:p-5 ${className}`}
      style={{ borderColor: 'var(--brand-border)' }}
      aria-label={t('upgrade.panelLabel', 'At a glance')}
      data-testid={testid}
    >
      <div data-testid={`${testid}-where`}>
        <p className="text-base sm:text-lg font-semibold leading-snug" style={{ color: 'var(--ink)', fontFamily: 'var(--font-head)' }} dir="auto">
          {who}
        </p>
        {about.length > 0 && (
          <p className="text-sm leading-snug" style={{ color: 'var(--brand-muted)' }} dir="auto">{about.join(' · ')}</p>
        )}
      </div>
      {shown.length > 0 && (
        // Spacing between offers, not dots: three offers made two dots on
        // one line, and a dot left alone at a line end when they wrapped.
        <p className="mt-1.5 flex flex-wrap gap-x-5 gap-y-0.5 text-sm leading-snug" style={{ color: 'var(--ink)' }} data-testid={`${testid}-offer`}>
          {shown.map((o, i) => (
            <span key={i}>
              <span dir="auto">{o.name}</span>{' '}
              <span className="font-semibold" style={{ color: o.price ? 'var(--gold-text-on-light)' : 'var(--brand-muted)' }}>
                {o.price || t('upgrade.askQuote', 'Ask for a quote')}
              </span>
            </span>
          ))}
        </p>
      )}
      {why && <div className="mt-2" data-testid={`${testid}-why`}>{why}</div>}
      {primary && (
        <div className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-2">
          {primary.href ? (
            <a href={primary.href} className="inline-flex items-center justify-center gap-2 min-h-[44px] px-5 rounded-full text-sm font-bold"
              style={{ background: 'var(--action)', color: 'var(--action-ink)' }} data-testid={`${testid}-primary`}>
              {primary.label} <ArrowRight size={15} className="rtl:rotate-180" aria-hidden="true" />
            </a>
          ) : (
            <button type="button" onClick={primary.onClick} className="inline-flex items-center justify-center gap-2 min-h-[44px] px-5 rounded-full text-sm font-bold"
              style={{ background: 'var(--action)', color: 'var(--action-ink)' }} data-testid={`${testid}-primary`}>
              {primary.label} <ArrowRight size={15} className="rtl:rotate-180" aria-hidden="true" />
            </button>
          )}
          {secondary.map((s) => (
            <button key={s.label} type="button" onClick={s.onClick} className="min-h-[44px] text-sm font-semibold underline underline-offset-2"
              style={{ color: 'var(--brand-muted)' }} data-testid={`${testid}-secondary`}>
              {s.label}
            </button>
          ))}
        </div>
      )}
    </section>
  );
}

/** The backed strengths as quiet chips. Labels are visitor-facing. */
export function StrengthChips({ strengths = [], testid = 'clarity-strengths' }) {
  const { t } = useTranslation();
  if (!strengths.length) return null;
  const label = {
    quality: t('upgrade.strength_quality', 'Quality work'),
    speed: t('upgrade.strength_speed', 'Fast'),
    price: t('upgrade.strength_price', 'Good prices'),
    experience: t('upgrade.strength_experience', 'Experienced'),
    kosher: t('upgrade.strength_kosher', 'Kosher certified'),
    english: t('upgrade.strength_english', 'Speaks English'),
    family: t('upgrade.strength_family', 'Family business'),
    licensed: t('upgrade.strength_licensed', 'Licensed and insured'),
  };
  return (
    <span className="inline-flex flex-wrap gap-1.5 me-2" data-testid={testid}>
      {strengths.slice(0, 2).map((s) => (
        <span key={s} className="px-2.5 py-0.5 rounded-full text-xs font-semibold"
          style={{ background: 'rgb(var(--brand-primary-rgb) / 0.10)', color: 'var(--brand-primary-deep)' }}>
          {label[s] || s}
        </span>
      ))}
    </span>
  );
}
