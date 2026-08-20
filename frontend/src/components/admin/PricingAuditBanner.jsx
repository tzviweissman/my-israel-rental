import React from 'react';
import { Loader2, AlertTriangle, Wand2, RotateCcw } from 'lucide-react';

/**
 * The pricing-audit banner from the Listings tab (spec A7).
 *
 * Split out of ListingsTab, which held the list, the filters, the bulk
 * actions, duplicate detection and this banner in one 1,235-line file.
 * Extracted verbatim — this is a move, not a rewrite, so the markup is
 * byte-for-byte what it was.
 *
 * Owns its own "is there anything to say?" test. Previously the caller
 * repeated that three-way sum inline before deciding to render, which
 * meant the condition and the numbers it guarded could drift apart.
 */
export default function PricingAuditBanner({
  priceAudit,
  autoFixing,
  unquarantining,
  handleAutoFixPricing,
  handleRestoreQuarantined,
}) {
  const t = priceAudit?.totals;
  const flagged = (t?.zero_price || 0) + (t?.low_monthly || 0) + (t?.wrong_field || 0);
  if (!priceAudit || flagged <= 0) return null;

  return (
    <div
      className="mb-4 flex items-start gap-3 rounded-lg border border-amber-200 bg-amber-50 p-3"
      data-testid="pricing-audit-banner"
    >
      <AlertTriangle size={18} className="text-amber-600 shrink-0 mt-0.5" />
      <div className="flex-1 min-w-0">
        <div className="text-sm font-semibold text-amber-900">
          {(priceAudit.totals.zero_price + priceAudit.totals.low_monthly + priceAudit.totals.wrong_field).toLocaleString()} listing{(priceAudit.totals.zero_price + priceAudit.totals.low_monthly + priceAudit.totals.wrong_field) === 1 ? '' : 's'} may have wrong prices
        </div>
        <div className="text-xs text-amber-800 mt-0.5 flex flex-wrap gap-x-4 gap-y-1">
          {priceAudit.totals.zero_price > 0 && (
            <span data-testid="audit-zero-price">
              <b>{priceAudit.totals.zero_price}</b> with no price set
            </span>
          )}
          {priceAudit.totals.low_monthly > 0 && (
            <span data-testid="audit-low-monthly">
              <b>{priceAudit.totals.low_monthly}</b> long-term under ₪{priceAudit.thresholds.low_monthly_ils}/mo (likely stranded nightly rate)
            </span>
          )}
          {priceAudit.totals.wrong_field > 0 && (
            <span data-testid="audit-wrong-field">
              <b>{priceAudit.totals.wrong_field}</b> with both monthly + nightly set
            </span>
          )}
        </div>
      </div>
      <div className="flex flex-col sm:flex-row gap-2 shrink-0">
        <button
          onClick={handleAutoFixPricing}
          disabled={autoFixing}
          className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold bg-emerald-600 text-white hover:bg-emerald-700 disabled:opacity-50 shadow-sm"
          title="Strip stranded nightly rates and quarantine broken-price listings in one pass"
          data-testid="pricing-autofix-btn"
        >
          {autoFixing ? <Loader2 size={14} className="animate-spin" /> : <Wand2 size={14} />}
          {autoFixing ? 'Fixing…' : 'Auto-fix all'}
        </button>
        <button
          onClick={handleRestoreQuarantined}
          disabled={unquarantining}
          className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold bg-white text-amber-800 border border-amber-300 hover:bg-amber-100 disabled:opacity-50"
          title="Un-hide every listing quarantined by a previous auto-fix"
          data-testid="pricing-unquarantine-btn"
        >
          {unquarantining ? <Loader2 size={14} className="animate-spin" /> : <RotateCcw size={14} />}
          {unquarantining ? 'Restoring…' : 'Restore quarantined'}
        </button>
      </div>
    </div>
  );
}
