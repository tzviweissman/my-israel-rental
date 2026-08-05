import React, { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import axios from 'axios';
import { API } from '../../App';

/**
 * Commitment ladder for the provider subscription.
 *
 * The plans and the USD→ILS rate both come from
 * `GET /marketplace/subscription/plans` rather than being written here. Two
 * reasons: the prices then exist in exactly one place (they're also what
 * PayPal is told to charge), and the shekel figure is computed from the same
 * live rate the rentals side uses instead of a constant that goes stale
 * without anyone noticing.
 *
 * The shekel amount is **advisory**. PayPal bills in USD; ₪ is shown because
 * the audience lives in Israel and thinks in shekels, and it is always
 * labelled approximate so nobody expects that exact number on their
 * statement.
 */
const PlanPicker = ({ value, onChange, disabled = false }) => {
  const { t } = useTranslation();
  const [data, setData] = useState(null);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    let alive = true;
    axios
      .get(`${API}/marketplace/subscription/plans`)
      .then((res) => { if (alive) setData(res.data); })
      .catch(() => { if (alive) setFailed(true); });
    return () => { alive = false; };
  }, []);

  // Preselect the headline tier once the ladder arrives, but never fight a
  // choice the provider has already made.
  useEffect(() => {
    if (data && !value && onChange) onChange(data.default_plan_key);
  }, [data, value, onChange]);

  if (failed) {
    // No invented fallback prices: showing a number we aren't sure of on a
    // billing screen is worse than showing none.
    return (
      <p className="text-sm text-gray-500" data-testid="plan-picker-error">
        {t('plans.loadFailed', "Couldn't load pricing — please try again in a moment.")}
      </p>
    );
  }
  if (!data) {
    return (
      <div className="grid gap-2 sm:grid-cols-3" data-testid="plan-picker-loading">
        {[0, 1, 2].map((i) => (
          <div key={i} className="h-24 rounded-xl bg-gray-100 animate-pulse" />
        ))}
      </div>
    );
  }

  return (
    <div className="grid gap-2 sm:grid-cols-3" data-testid="plan-picker">
      {data.plans.map((plan) => {
        const selected = value === plan.key;
        return (
          <button
            key={plan.key}
            type="button"
            disabled={disabled}
            onClick={() => onChange && onChange(plan.key)}
            aria-pressed={selected}
            className={`relative text-start rounded-xl border p-3 transition-colors disabled:opacity-60 ${
              selected
                ? 'border-[var(--brand-primary)] bg-[rgb(var(--brand-primary-rgb)/<alpha-value>)]/5 ring-2 ring-[rgb(var(--brand-primary-rgb)/<alpha-value>)]/25'
                : 'border-gray-200 hover:border-[rgb(var(--brand-primary-rgb)/<alpha-value>)]/40'
            }`}
            data-testid={`plan-option-${plan.key}`}
          >
            {plan.headline && (
              <span
                className="absolute -top-2 end-2 px-2 py-0.5 rounded-full text-[10px] font-bold text-white"
                style={{ backgroundColor: 'var(--brand-primary)' }}
              >
                {t('plans.bestValue', 'Best value')}
              </span>
            )}
            <p className="text-xs text-gray-500">
              {t('plans.months', { n: plan.months, defaultValue: `${plan.months} months` })}
            </p>
            <p className="text-lg font-bold text-gray-900 mt-0.5">
              ${plan.monthly_price}
              <span className="text-xs font-normal text-gray-500">
                {' '}/ {t('plans.perMonth', 'mo')}
              </span>
            </p>
            {/* Secondary, lighter, and explicitly approximate — the billed
                amount is the USD one above. */}
            <p className="text-[11px] text-gray-400 mt-0.5">
              {t('plans.approxIls', {
                amount: plan.approx_monthly_ils.toLocaleString(),
                defaultValue: `approx. ₪${plan.approx_monthly_ils} / mo`,
              })}
            </p>
          </button>
        );
      })}
      <p className="sm:col-span-3 text-[11px] text-gray-400">
        {t(
          'plans.billingNote',
          'Billed monthly in USD. Shekel amounts are approximate and move with the exchange rate.',
        )}
      </p>
    </div>
  );
};

export default PlanPicker;
