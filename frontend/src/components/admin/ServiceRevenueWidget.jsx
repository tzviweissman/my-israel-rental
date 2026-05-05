import React, { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { TrendingUp } from 'lucide-react';
import { API } from '../../App';
import { useApiSWR } from '../../hooks/useApiSWR';

const WINDOWS = [
  { days: 30, label: '30d' },
  { days: 90, label: '90d' },
  { days: 0, label: 'All' },
];

/**
 * Per-service revenue widget for the admin Overview tab. Pulls
 * /admin/document-services/revenue and renders a compact bar chart
 * keyed by service_type.
 */
export const ServiceRevenueWidget = ({ token }) => {
  const { t } = useTranslation();
  const [windowDays, setWindowDays] = useState(30);
  const { data } = useApiSWR(
    `${API}/admin/document-services/revenue?window_days=${windowDays}`,
    token,
  );

  if (!data) return null;
  const { rows, total_revenue_usd, total_filings } = data;
  const max = Math.max(1, ...rows.map(r => r.revenue_usd));

  return (
    <div className="mt-10" data-testid="admin-service-revenue">
      <div className="flex items-center justify-between flex-wrap gap-3 mb-4">
        <div className="flex items-center gap-2">
          <TrendingUp size={18} className="text-[#1E6A6A]" />
          <h2 className="text-xl font-bold" style={{ fontFamily: 'Playfair Display' }}>
            {t('admin.serviceRevenueTitle', 'Revenue by service')}
          </h2>
        </div>
        <div className="flex gap-1 bg-white rounded-lg border border-[#E5E5E5] p-0.5" data-testid="revenue-window-toggle">
          {WINDOWS.map(w => (
            <button
              key={w.days}
              onClick={() => setWindowDays(w.days)}
              className={`px-3 py-1 rounded-md text-xs font-medium transition-colors ${
                windowDays === w.days
                  ? 'bg-[#1E6A6A] text-white'
                  : 'text-gray-600 hover:bg-gray-50'
              }`}
              data-testid={`revenue-window-${w.days}`}
            >
              {w.label}
            </button>
          ))}
        </div>
      </div>

      <div className="bg-white rounded-xl border border-[#E5E5E5] p-5">
        <div className="flex items-baseline gap-6 mb-5 flex-wrap">
          <div>
            <p className="text-xs text-gray-500 uppercase tracking-wide">Total revenue</p>
            <p className="text-3xl font-bold text-[#1E6A6A]" data-testid="revenue-total">
              ${total_revenue_usd.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
            </p>
          </div>
          <div>
            <p className="text-xs text-gray-500 uppercase tracking-wide">Filings</p>
            <p className="text-2xl font-semibold text-gray-700" data-testid="revenue-filings">{total_filings}</p>
          </div>
        </div>

        {total_filings === 0 ? (
          <div className="text-sm text-gray-500 text-center py-6" data-testid="revenue-empty">
            No filings paid yet in this window. Bars will populate as customers complete PayPal checkouts.
          </div>
        ) : (
          <div className="space-y-3">
            {rows.map(r => {
              const pct = max > 0 ? (r.revenue_usd / max) * 100 : 0;
              return (
                <div key={r.service_type} className="space-y-1.5" data-testid={`revenue-row-${r.service_type}`}>
                  <div className="flex justify-between items-baseline text-sm">
                    <span className="font-medium text-gray-800 truncate pr-3">{r.label}</span>
                    <span className="flex items-baseline gap-2 flex-shrink-0">
                      <span className="text-xs text-gray-500">{r.count} filing{r.count === 1 ? '' : 's'}</span>
                      <span className="font-semibold text-gray-900">
                        ${r.revenue_usd.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                      </span>
                    </span>
                  </div>
                  <div className="h-2 rounded-full bg-gray-100 overflow-hidden">
                    <div
                      className="h-full bg-gradient-to-r from-[#1E6A6A] to-[#2a8a8a] rounded-full transition-all duration-500"
                      style={{ width: `${pct}%` }}
                    />
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
};

export default ServiceRevenueWidget;
