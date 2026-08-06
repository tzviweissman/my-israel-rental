import React from 'react';
import { useTranslation } from 'react-i18next';
import { AlertTriangle, RefreshCw } from 'lucide-react';

/**
 * Shown when listings could not be LOADED — as distinct from a search that
 * legitimately returned nothing.
 *
 * On 2026-08-06 the production database was unreachable for hours. The
 * frontend served fine, every listings call failed, and the site rendered
 * as a rental marketplace with zero rentals. Worse, /stays told visitors
 * "No stays match those filters" — blaming their search for a server
 * outage and inviting them to widen a filter that could never help.
 *
 * A visitor cannot tell those two states apart, but they need completely
 * different things: one should change their filters, the other should come
 * back later. Conflating them means an outage looks like an empty business.
 *
 * So this is deliberately NOT the empty-results component. Call it only
 * when a request actually failed.
 *
 * Colours are literal because that's what this branch has — the brand
 * token set (--brand-primary, --gold-rgb, --font-head) is still on the
 * redesign branch. Swap them for the tokens when that branch lands.
 */
const ListingsUnavailable = ({ onRetry, compact = false }) => {
  const { t } = useTranslation();

  return (
    <div
      role="status"
      aria-live="polite"
      className={`w-full text-center ${compact ? 'py-8' : 'py-16'}`}
      data-testid="listings-unavailable"
    >
      <div
        className="mx-auto flex items-center justify-center rounded-full"
        style={{
          width: compact ? 40 : 56,
          height: compact ? 40 : 56,
          background: 'rgba(212, 175, 55, 0.14)',
        }}
      >
        <AlertTriangle
          size={compact ? 20 : 26}
          style={{ color: 'var(--gold-text-on-light)' }}
          aria-hidden="true"
        />
      </div>

      <p className={`font-bold text-gray-900 ${compact ? 'text-base mt-3' : 'text-xl mt-4'}`}>
        {t('errors.listingsTitle', "We couldn't load listings just now")}
      </p>

      {/* Says explicitly that the listings still exist. Without this line a
          visitor's reasonable conclusion is that the site is empty. */}
      <p className={`mx-auto max-w-md text-gray-600 ${compact ? 'text-xs mt-1.5' : 'text-sm mt-2'}`}>
        {t(
          'errors.listingsBody',
          'This is a problem on our side, not with your search — the properties are still here. Please try again in a moment.',
        )}
      </p>

      {onRetry && (
        <button
          type="button"
          onClick={onRetry}
          className="mt-5 inline-flex items-center gap-2 rounded-full px-5 py-2.5 text-sm font-semibold text-white transition-transform duration-200 hover:-translate-y-0.5"
          style={{ background: '#1E6A6A' }}
          data-testid="listings-unavailable-retry"
        >
          <RefreshCw size={15} aria-hidden="true" />
          {t('errors.listingsRetry', 'Try again')}
        </button>
      )}
    </div>
  );
};

export default ListingsUnavailable;
