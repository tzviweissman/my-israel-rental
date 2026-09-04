/**
 * The "-20%" badge a business's offer shows as.
 *
 * One component for every surface, because the alternative is a card and a
 * listing page that disagree about what the same offer says. Two sizes: the
 * chip that rides a card photo, and the line the listing page prints beside
 * the price.
 *
 * The percentage is the whole claim. No price is recomputed anywhere in the
 * app from this number - the business's prices are shown as the business
 * wrote them, and the offer is applied when the two people agree the job.
 * See the note in backend/routes/marketplace/shared.py (GigDiscount).
 *
 * The accent wash with ink text - the pairing the flow theme's own palette
 * specifies (`--accent` with `--accent-foreground`), which composites to
 * about 12:1 on white. Never green: green is functional here, reserved for
 * status and verification.
 */
import React from 'react';
import { useTranslation } from 'react-i18next';
import { formatDate } from '../../utils/formatDate';

export function offerLabel(discount, i18n) {
  if (!discount) return '';
  return (i18n?.language || '').startsWith('he') && discount.label_he
    ? discount.label_he
    : (discount.label || '');
}

export default function OfferBadge({ discount, variant = 'chip', className = '', testId }) {
  const { t, i18n } = useTranslation();
  if (!discount?.percent) return null;
  const pct = t('offers.percentOff', {
    defaultValue: '{{percent}}% off',
    percent: discount.percent,
  });
  const label = offerLabel(discount, i18n);

  if (variant === 'chip') {
    return (
      <span
        className={`inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-extrabold uppercase tracking-wide shadow ${className}`}
        style={{ background: 'var(--accent-soft)', color: 'var(--accent-soft-ink)' }}
        data-testid={testId || 'offer-badge'}
      >
        {pct}
      </span>
    );
  }

  return (
    <span
      className={`inline-flex flex-wrap items-baseline gap-2 rounded-lg px-3 py-2 ${className}`}
      style={{ background: 'var(--accent-soft)', color: 'var(--accent-soft-ink)' }}
      data-testid={testId || 'offer-badge'}
    >
      <b className="text-sm font-extrabold">{pct}</b>
      {label ? <span className="text-xs">{label}</span> : null}
      {discount.ends_at ? (
        <span className="text-[11px] opacity-80">
          {t('offers.until', { defaultValue: 'until {{date}}', date: formatDate(discount.ends_at, i18n.language) })}
        </span>
      ) : null}
    </span>
  );
}
