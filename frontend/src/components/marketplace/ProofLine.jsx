/**
 * ProofLine: the rating and the owner's credentials, beside the main
 * button on every business, service and property page (Tzvi, 23 Sep 2026,
 * part A of the page-upgrade job). Every page gets it; there is no setting.
 *
 * Each item appears only when it is true:
 *   stars      only with at least one review. Never "0 reviews", never
 *              placeholder stars. The average is the honest one.
 *   verified   the business was verified by us.
 *   years      derived from the founding year; or "New on MyIsraelRental"
 *              for a business that joined this year; else nothing.
 *   kosher     a certifying body on a food business.
 * With nothing true, it renders nothing at all.
 *
 * The rules live in utils/businessProof.js, shared with the "Good to
 * know" band, so there is one source for each fact.
 *
 * `compact` (the phone sticky bar) keeps the stars and the badge only, so
 * the bar stays one line above the button.
 */
import React from 'react';
import { useTranslation } from 'react-i18next';
import { BadgeCheck } from 'lucide-react';
import { StarRating } from './StarRating';
import { yearsInBusiness, isNewHere, kosherBody } from '../../utils/businessProof';

export default function ProofLine({
  ratingAvg, ratingCount, verified, foundedYear, memberSince, kosher, categories,
  onRatingClick, compact = false, className = '', testid = 'proof-line',
}) {
  const { t } = useTranslation();
  const count = Number(ratingCount) || 0;
  const years = yearsInBusiness(foundedYear);
  const newHere = !years && isNewHere(memberSince);
  const body = kosherBody(kosher, categories);

  const items = [];
  if (count > 0) {
    const stars = <StarRating value={Number(ratingAvg) || 0} count={count} size={12} testidPrefix={`${testid}-stars`} />;
    items.push(onRatingClick ? (
      <button key="stars" type="button" onClick={onRatingClick} className="inline-flex items-center hover:underline"
        aria-label={t('proof.seeReviews', { defaultValue: 'Rated {{avg}} from {{n}} reviews. See the reviews', avg: ratingAvg, n: ratingCount })}
        data-testid={`${testid}-rating`}>
        {stars}
      </button>
    ) : <span key="stars" className="inline-flex items-center" data-testid={`${testid}-rating`}>{stars}</span>);
  }
  if (verified) {
    items.push(
      <span key="verified" className="inline-flex items-center gap-1 rounded-full px-2 py-0.5 font-semibold"
        style={{ background: 'var(--success-bg)', color: 'var(--success)' }} data-testid={`${testid}-verified`}>
        <BadgeCheck size={12} aria-hidden="true" /> {t('proof.verified', 'Verified')}
      </span>,
    );
  }
  if (!compact && years) {
    items.push(<span key="years" data-testid={`${testid}-years`}>{t('proof.years', { count: years, defaultValue: '{{count}} years in business' })}</span>);
  }
  if (!compact && newHere) {
    items.push(<span key="new" data-testid={`${testid}-new`}>{t('businessPage.newHere', 'New on MyIsraelRental')}</span>);
  }
  if (!compact && body) {
    items.push(<span key="kosher" dir="auto" data-testid={`${testid}-kosher`}>{t('proof.kosher', { defaultValue: 'Kosher: {{body}}', body })}</span>);
  }
  if (!items.length) return null;

  return (
    // Spacing, not separator dots: a dot left at the end of a wrapped
    // line reads as a stray mark.
    <div className={`flex flex-wrap items-center gap-x-3 gap-y-1 text-xs leading-snug ${className}`}
      style={{ color: 'var(--brand-muted)' }} data-testid={testid}>
      {items}
    </div>
  );
}
