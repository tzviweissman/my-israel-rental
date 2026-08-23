/**
 * PerformancePanel — how many people saw this business's listings, and how
 * many of them tried to make contact.
 *
 * L1 + L2 of docs/leads-and-views-spec.md. It was LeadsPanel until views
 * existed to sit beside them.
 *
 * The two numbers belong together and are read together: views alone says
 * nothing about whether the listing works, and taps alone cannot tell a
 * quiet week from an unconvincing page. Deliberately NOT shown as a
 * conversion percentage — a view and a tap cannot yet be linked to the same
 * person, so the ratio would look like a funnel while being two unrelated
 * counts divided by each other.
 *
 * Each half carries its own "counting since": view tracking started long
 * after lead tracking, so a single shared date would be wrong for one of
 * them. That difference is temporary but the honesty is not.
 *
 * Renders even at zero, unlike the admin attention queue. A new business
 * needs to see that counting is on; an absent panel reads as a missing
 * feature, and /why-list promises this one by name.
 */
import React, { useEffect, useState } from 'react';
import axios from 'axios';
import { Eye, MessageCircle } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import ScanChart from '../common/ScanChart';
import formatDate from '../../utils/formatDate';

// One column of the panel. Kept local: it is the panel's own layout, not a
// shape anything else needs.
function Stat({ icon: Icon, label, periodTotal, allTime, daily, chartTitle, since, testid, t }) {
  return (
    <div className="flex-1 min-w-0">
      <div className="flex items-center gap-1.5 mb-1">
        <Icon size={14} className="text-[var(--brand-primary)] shrink-0" />
        <span className="text-xs font-semibold text-gray-700">{label}</span>
      </div>
      <div className="flex items-baseline gap-2 flex-wrap">
        <span className="text-2xl font-bold text-gray-900" data-testid={`${testid}-period`}>
          {periodTotal}
        </span>
        <span className="text-xs text-gray-500" data-testid={`${testid}-all`}>
          {t('perf.allTime', { defaultValue: '{{n}} all time', n: allTime })}
        </span>
      </div>
      {/* Capped: ScanChart draws its text in viewBox units and scales with
          width, so across a full dashboard card the axis dates come out
          enormous. It was built for a 320px popover. */}
      <div className="max-w-sm mt-1">
        <ScanChart daily={daily} testidPrefix={testid} title={chartTitle} />
      </div>
      {since && (
        <p className="text-[11px] text-gray-400 mt-1" data-testid={`${testid}-since`}>
          {t('perf.countingSince', { defaultValue: 'Counting since {{date}}', date: formatDate(since) })}
        </p>
      )}
    </div>
  );
}

export default function PerformancePanel({ API, token, businessId = null }) {
  const { t } = useTranslation();
  const [data, setData] = useState(null);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const { data: d } = await axios.get(`${API}/marketplace/leads/summary`, {
          headers: { Authorization: `Bearer ${token}` },
          // Scoped server-side, so every number on screen — both headlines,
          // both charts and the rows — describes the same set of listings.
          params: businessId ? { business_id: businessId } : {},
        });
        if (!cancelled) setData(d);
      } catch {
        // Render nothing rather than a zero. A failed request and a
        // genuinely quiet month look identical once they are both "0",
        // and one of them is a lie.
        if (!cancelled) setFailed(true);
      }
    })();
    return () => { cancelled = true; };
  }, [API, token, businessId]);

  if (failed || !data) return null;

  const views = data.views || { total: 0, period_total: 0, daily: [], since: null };
  const rows = data.by_gig || [];
  const anything = (data.total || 0) > 0 || (views.total || 0) > 0;

  return (
    <div className="bg-white border border-gray-200 rounded-2xl p-5" data-testid="performance-panel">
      <h3 className="text-sm font-bold text-gray-900 mb-3">
        {t('perf.title', 'How your listings are doing')}
      </h3>

      {!anything ? (
        <p className="text-xs text-gray-500" data-testid="perf-empty">
          {t('perf.none', 'Nobody has visited these listings yet — this counts them from now on.')}
        </p>
      ) : (
        <>
          <div className="flex flex-col sm:flex-row gap-5">
            <Stat
              icon={Eye}
              label={t('perf.viewsLabel', 'Views in the last 30 days')}
              periodTotal={views.period_total}
              allTime={views.total}
              daily={views.daily}
              chartTitle={t('perf.viewsChart', 'Views — last 14 days')}
              since={views.since}
              testid="perf-views"
              t={t}
            />
            <Stat
              icon={MessageCircle}
              label={t('perf.leadsLabel', 'Tapped to message you')}
              periodTotal={data.period_total}
              allTime={data.total}
              daily={data.daily}
              chartTitle={t('perf.leadsChart', 'Taps — last 14 days')}
              since={data.since}
              testid="perf-leads"
              t={t}
            />
          </div>

          {rows.length > 0 && (
            <ul className="mt-4 pt-3 border-t border-gray-100 space-y-1" data-testid="perf-by-gig">
              <li className="text-[11px] font-semibold text-gray-500 mb-1">
                {t('perf.byListing', 'Taps by listing')}
              </li>
              {rows.map((r) => (
                <li key={r.gig_id} className="flex items-center justify-between gap-3 text-xs">
                  <span className="text-gray-700 truncate">{r.title}</span>
                  <span className="font-semibold text-gray-900 shrink-0">{r.count}</span>
                </li>
              ))}
            </ul>
          )}
        </>
      )}
    </div>
  );
}
