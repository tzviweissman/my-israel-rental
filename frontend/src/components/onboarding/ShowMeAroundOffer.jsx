/**
 * T7 — the inline "Show me around" offers.
 *
 * The corollary of "never forced" is that discovery has to be deliberate:
 * an optional tour nobody can find is dead weight.
 *
 * ONE NAME EVERYWHERE. The label comes from a single key, `help.showAround`
 * / "בוא נעשה סיור", used here and in the header menu. A tour called three
 * different things in three places reads as three different features, so
 * there is deliberately no per-surface wording.
 *
 * Each offer competes for the single on-screen slot (see OnboardingProvider)
 * and is dismissible on its own. The header control is not — it is the
 * permanent home, and permanence is the whole point of it.
 */
import React from 'react';
import { useTranslation } from 'react-i18next';
import { Link } from 'react-router-dom';
import { Compass, X } from 'lucide-react';
import { useOnboarding, useOnboardingSlot } from './OnboardingProvider';
import { featureLibraryFor } from './helpDestinations';

const MOMENTS = {
  // First dashboard load after signup. One quiet line, never a popup.
  firstLogin: { id: 'offer.firstLogin', keyPrefix: 'help.offerFirstLogin' },
  // Beneath the setup checklist.
  checklist: { id: 'offer.checklist', keyPrefix: 'help.offerChecklist' },
  // When the checklist completes — appetite for more is highest here.
  complete: { id: 'offer.complete', keyPrefix: 'help.offerComplete' },
  // A tab with nothing in it is the clearest signal of a stuck user.
  emptyState: { id: 'offer.emptyState', keyPrefix: 'help.offerEmptyState' },
};

/**
 * @param {string}  moment    key of MOMENTS
 * @param {boolean} eligible  extra precondition beyond "not dismissed"
 * @param {boolean} inline    render as a bare link with no surrounding box
 */
export default function ShowMeAroundOffer({ moment, eligible = true, inline = false }) {
  const { t } = useTranslation();
  const config = MOMENTS[moment];
  const ctx = useOnboarding();
  const { visible, dismiss } = useOnboardingSlot(config?.id, eligible);
  const href = featureLibraryFor(ctx?.state?.role);

  if (!config || !visible) return null;

  const lead = t(`${config.keyPrefix}`, '');
  const cta = t('help.showAround', 'Show me around');

  if (inline) {
    return (
      <Link
        to={href}
        className="text-sm font-semibold shrink-0 hover:underline"
        style={{ color: 'var(--brand-primary)' }}
        data-testid={`show-around-${moment}`}
      >
        {t('help.offerCompleteCta', 'See what else this site can do')}
      </Link>
    );
  }

  return (
    <div
      className="mt-4 pt-3 border-t flex items-center gap-2 flex-wrap"
      style={{ borderColor: 'var(--brand-border)' }}
      data-testid={`show-around-${moment}`}
    >
      <Compass size={14} aria-hidden="true" style={{ color: 'var(--brand-muted)' }} />
      {lead ? (
        <span className="text-xs" style={{ color: 'var(--brand-muted)' }}>{lead}</span>
      ) : null}
      <Link
        to={href}
        className="text-xs font-semibold hover:underline"
        style={{ color: 'var(--brand-primary)' }}
        data-testid={`show-around-${moment}-link`}
      >
        {cta}
      </Link>
      <button
        type="button"
        onClick={dismiss}
        aria-label={t('common.dismiss', 'Dismiss')}
        className="ms-auto p-1 rounded"
        style={{ color: 'var(--brand-muted)' }}
        data-testid={`show-around-${moment}-dismiss`}
      >
        <X size={13} />
      </button>
    </div>
  );
}
