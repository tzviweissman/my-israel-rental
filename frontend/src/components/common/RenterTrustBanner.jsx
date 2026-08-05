import React from 'react';
import { useTranslation } from 'react-i18next';
import { Search, MessageCircle, Globe } from 'lucide-react';

/**
 * Positioning strip for renters, on Home and the Stays results header.
 *
 * The wedge against Yad2 and Facebook groups is that this is searchable, in
 * English, and puts you in touch with the owner directly.
 *
 * **Deliberately says nothing about agent, broker or key-money fees.**
 * MyIsraelRental being free to use says nothing about what an owner or a
 * managing agent charges — and some listings here do carry an agent fee,
 * which the listing page shows. "No broker fees" would be a promise the
 * platform cannot keep on someone else's behalf, and it's the kind of claim
 * a renter only discovers is wrong at the worst possible moment. Every claim
 * in here is about OUR costs and OUR experience, nothing about third
 * parties'. Two SEO descriptions that did say "no broker fees" were removed
 * in the same change; please don't reintroduce them.
 */
const POINTS = [
  { key: 'free', icon: Search },
  { key: 'direct', icon: MessageCircle },
  { key: 'english', icon: Globe },
];

const RenterTrustBanner = ({ variant = 'full', className = '' }) => {
  const { t } = useTranslation();

  // Compact: a single line for the results header, where a three-column
  // block would push the actual listings below the fold.
  if (variant === 'compact') {
    return (
      <p
        className={`text-xs text-gray-500 ${className}`}
        data-testid="renter-trust-banner-compact"
      >
        {t(
          'trust.compact',
          'Free to search and contact owners directly — listings in English.',
        )}
      </p>
    );
  }

  return (
    <div
      className={`rounded-2xl border border-[rgb(var(--brand-primary-rgb)/<alpha-value>)]/15 bg-[#f2f8f8] px-5 py-4 ${className}`}
      data-testid="renter-trust-banner"
    >
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 sm:gap-6">
        {POINTS.map(({ key, icon: Icon }) => (
          <div key={key} className="flex items-start gap-2.5">
            <Icon size={18} className="shrink-0 mt-0.5 text-[var(--brand-primary)]" aria-hidden="true" />
            <div>
              <p className="text-sm font-semibold text-gray-900">
                {t(`trust.${key}Title`, key)}
              </p>
              <p className="text-xs text-gray-600 mt-0.5">
                {t(`trust.${key}Body`, '')}
              </p>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};

export default RenterTrustBanner;
