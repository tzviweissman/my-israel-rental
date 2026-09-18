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
  // Nothing has EVER been recorded for this half — not "a quiet month" but
  // "we were not counting yet". They look identical as a `0`, and the two
  // halves start at different times: taps have months of history, visitors
  // begin the day this ships. Printed side by side that reads as
  // "0 visitors, 3 people messaged you", which is impossible and looks like
  // a broken page rather than a young metric.
  const notCountingYet = !since && !allTime;
  return (
    <div className="flex-1 min-w-0">
      <div className="flex items-center gap-1.5 mb-1">
        <Icon size={14} className="text-[var(--brand-primary)] shrink-0" />
        <span className="text-xs font-semibold text-gray-700">{label}</span>
      </div>
      {notCountingYet ? (
        <p className="text-xs text-gray-500" data-testid={`${testid}-not-yet`}>
          {t('perf.notCountingYet', 'Just switched on — check back tomorrow.')}
        </p>
      ) : (
      <>
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
      </>
      )}
    </div>
  );
}

// `endpoint` and `params` because properties and services answer the same
// question from different routes but return the same shape — one panel,
// so the two halves of the site cannot drift into reporting differently.
export default function PerformancePanel({
  API, token, businessId = null,
  endpoint = '/marketplace/leads/summary',
  rowsLabel = null,
}) {
  const { t } = useTranslation();
  const [data, setData] = useState(null);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const { data: d } = await axios.get(`${API}${endpoint}`, {
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
  }, [API, token, businessId, endpoint]);

  if (failed || !data) return null;

  const views = data.views || { total: 0, period_total: 0, daily: [], since: null };
  // Services return `by_gig`, properties `by_listing` — same shape.
  const rows = data.by_gig || data.by_listing || [];
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
              label={t('perf.viewsLabel', 'Visitors in the last 30 days')}
              periodTotal={views.period_total}
              allTime={views.total}
              daily={views.daily}
              chartTitle={t('perf.viewsChart', 'Visitors — last 14 days')}
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

          {/* Visitors AND taps per listing (18 Sep 2026). Rows used to carry
              taps alone, so the listing most worth rewriting - plenty of
              people looked, nobody messaged - never appeared. The business
              page gets its own row because a visit to the storefront is a
              visit to no single service. */}
          {(rows.length > 0 || data.page_views > 0) && (
            <table className="mt-4 w-full text-xs border-t border-gray-100" data-testid="perf-by-gig">
              <thead>
                <tr className="text-[11px] font-semibold text-gray-500">
                  <th className="pt-3 pb-1 text-start font-semibold">
                    {rowsLabel || t('perf.byListing', 'By listing, last 30 days')}
                  </th>
                  <th className="pt-3 pb-1 px-2 text-end font-semibold">{t('perf.colVisitors', 'Visitors')}</th>
                  <th className="pt-3 pb-1 text-end font-semibold">{t('perf.colTaps', 'Taps')}</th>
                </tr>
              </thead>
              <tbody>
                {data.page_views > 0 && (
                  <tr data-testid="perf-row-business-page">
                    <td className="py-0.5 text-gray-700 italic">{t('perf.businessPage', 'Your business page')}</td>
                    <td className="py-0.5 px-2 text-end tabular-nums text-gray-900">{data.page_views}</td>
                    <td className="py-0.5 text-end text-gray-400">–</td>
                  </tr>
                )}
                {rows.map((r) => (
                  <tr key={r.gig_id || r.id} data-testid="perf-row">
                    <td className="py-0.5 text-gray-700 truncate max-w-[16rem]" dir="auto">{r.title}</td>
                    <td className="py-0.5 px-2 text-end tabular-nums text-gray-900">{r.views ?? 0}</td>
                    <td className="py-0.5 text-end tabular-nums font-semibold text-gray-900">{r.count}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </>
      )}
    </div>
  );
}
