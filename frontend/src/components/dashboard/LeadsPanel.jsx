/**
 * LeadsPanel — how many people tapped through to message this owner.
 *
 * L1 of docs/leads-and-views-spec.md. These taps have been recorded since
 * the WhatsApp redirect shipped and nothing has ever read them; this is the
 * first place the owner sees their own number.
 *
 * Deliberately narrow. It reports one thing — contact attempts — and does
 * not imply views, conversion or unique people, none of which are tracked
 * yet. A panel that quietly mixes a real number with an invented one is
 * worse than a smaller panel.
 *
 * Renders even at zero, unlike the admin attention queue. A brand-new
 * business needs to see that counting is switched on; "no taps yet" is
 * information, whereas an absent panel reads as a missing feature — and
 * /why-list promises this one by name.
 */
import React, { useEffect, useState } from 'react';
import axios from 'axios';
import { MessageCircle } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import ScanChart from '../common/ScanChart';
import formatDate from '../../utils/formatDate';

export default function LeadsPanel({ API, token, businessId = null }) {
  const { t } = useTranslation();
  const [data, setData] = useState(null);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const { data: d } = await axios.get(`${API}/marketplace/leads/summary`, {
          headers: { Authorization: `Bearer ${token}` },
          // Scoped server-side, so every number on screen — headline,
          // chart and rows — describes the same set of listings.
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

  const rows = data.by_gig || [];

  const hasAny = (data.total || 0) > 0;

  return (
    <div className="bg-white border border-gray-200 rounded-2xl p-5" data-testid="leads-panel">
      <div className="flex items-center gap-2 mb-1">
        <MessageCircle size={15} className="text-[var(--brand-primary)] shrink-0" />
        <h3 className="text-sm font-bold text-gray-900">
          {t('leads.title', 'People who tapped to message you')}
        </h3>
      </div>

      {!hasAny ? (
        <p className="text-xs text-gray-500" data-testid="leads-empty">
          {t('leads.none', 'No one has tapped to message you yet — this counts them from now on.')}
        </p>
      ) : (
        <>
          <div className="flex items-baseline gap-2 flex-wrap">
            <span className="text-2xl font-bold text-gray-900" data-testid="leads-period-total">
              {data.period_total}
            </span>
            <span className="text-xs text-gray-500">
              {t('leads.inLastDays', {
                defaultValue: 'in the last {{n}} days',
                n: data.period_days,
              })}
            </span>
            <span className="text-xs text-gray-400">·</span>
            <span className="text-xs text-gray-500" data-testid="leads-total">
              {t('leads.allTime', { defaultValue: '{{n}} all time', n: data.total })}
            </span>
          </div>

          {/* Capped: the chart's text is drawn in viewBox units and scales
              with its width, so stretched across a full-width dashboard
              card the axis dates come out enormous. It was built for a
              320px popover. */}
          <div className="max-w-sm mt-1">
            <ScanChart
              daily={data.daily}
              testidPrefix="leads"
              title={t('leads.chartTitle', 'Taps — last 14 days')}
            />
          </div>

          {rows.length > 0 && (
            <ul className="mt-3 space-y-1" data-testid="leads-by-gig">
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

      {/* Without this the number reads as a verdict on the listing rather
          than on however long we have been counting. */}
      {data.since && (
        <p className="text-[11px] text-gray-400 mt-3" data-testid="leads-since">
          {t('leads.countingSince', {
            defaultValue: 'Counting since {{date}}',
            date: formatDate(data.since),
          })}
        </p>
      )}
    </div>
  );
}
