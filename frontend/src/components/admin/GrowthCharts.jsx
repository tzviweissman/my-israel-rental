/**
 * GrowthCharts - one small line graph per measure, a dot per Israel day,
 * so growth in visits, pages, views and taps is visible at a glance
 * (Tzvi, 12 Nov 2026: "better graphs so i can easily visualize growth").
 *
 * Data from /admin/metrics/daily, which reads the same collections as the
 * cards above it. Each graph shows the period total and how it compares
 * with the same length of time just before it. Plain SVG: the app has no
 * chart library and these need nothing one would add.
 */
import React, { useEffect, useState } from 'react';
import axios from 'axios';
import { useTranslation } from 'react-i18next';
import { API } from '../../lib/apiBase';

const SPANS = [30, 90, 180];
const W = 300;
const H = 90;

const MEASURES = [
  ['site_visitors', 'admin.kpiSiteVisitors', 'Site visitors'],
  ['site_pageviews', 'admin.kpiSitePageviews', 'Pages opened'],
  ['views', 'admin.kpiViews', 'Property views'],
  ['service_views', 'admin.kpiServiceViews', 'Service & business views'],
  ['whatsapp_clicks', 'admin.kpiWhatsappClicks', 'WhatsApp taps'],
  ['qr_scans', 'admin.kpiQrScans', 'QR scans'],
  ['new_users', 'admin.kpiNewUsers', 'New users'],
];

// Weekly sums smooth the day-of-week wobble, which on a daily line hides
// the trend the graph is for. Grouped from the newest day backwards so the
// last point is always a full, current week.
const weekly = (vals) => {
  const out = [];
  for (let end = vals.length; end > 0; end -= 7) {
    out.unshift(vals.slice(Math.max(0, end - 7), end).reduce((a, b) => a + b, 0));
  }
  return out;
};

function Spark({ values, label }) {
  const max = Math.max(1, ...values);
  const step = values.length > 1 ? W / (values.length - 1) : W;
  const pts = values.map((v, i) => [i * step, H - 4 - (v / max) * (H - 12)]);
  const line = pts.map(([x, y], i) => `${i ? 'L' : 'M'}${x.toFixed(1)},${y.toFixed(1)}`).join(' ');
  const area = `${line} L${W},${H} L0,${H} Z`;
  return (
    <svg viewBox={`0 0 ${W} ${H}`} preserveAspectRatio="none" className="w-full h-20 block" role="img" aria-label={label}>
      <path d={area} fill="rgb(var(--brand-primary-rgb) / 0.10)" />
      <path d={line} fill="none" stroke="var(--brand-primary)" strokeWidth="2" vectorEffect="non-scaling-stroke" strokeLinejoin="round" />
      {pts.map(([x, y], i) => (
        <circle key={i} cx={x} cy={y} r="2.5" fill="var(--brand-primary)" vectorEffect="non-scaling-stroke">
          <title>{values[i].toLocaleString()}</title>
        </circle>
      ))}
    </svg>
  );
}

export default function GrowthCharts({ token }) {
  const { t } = useTranslation();
  const [span, setSpan] = useState(90);
  const [data, setData] = useState(null);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    let cancelled = false;
    setFailed(false);
    // Twice the span, so each graph can compare with the period before it.
    axios.get(`${API}/admin/metrics/daily`, { params: { days: span * 2 }, headers: { Authorization: `Bearer ${token}` } })
      .then(({ data: d }) => { if (!cancelled) setData(d); })
      .catch(() => { if (!cancelled) setFailed(true); });
    return () => { cancelled = true; };
  }, [token, span]);

  return (
    <section className="mb-10" data-testid="admin-growth">
      <div className="flex items-center justify-between gap-3 mb-3 flex-wrap">
        <h2 className="text-xl font-bold" style={{ fontFamily: 'var(--font-head)', color: 'var(--ink)' }}>
          {t('admin.growthTitle', 'Growth, week by week')}
        </h2>
        <div className="flex items-center gap-1 p-1 rounded-lg" style={{ background: 'rgb(var(--brand-primary-rgb) / 0.07)' }}>
          {SPANS.map((d) => (
            <button
              key={d}
              type="button"
              onClick={() => setSpan(d)}
              className={`px-3 py-1 rounded-md text-xs font-semibold ${span === d ? 'bg-white shadow-sm' : ''}`}
              style={{ color: span === d ? 'var(--brand-primary)' : 'var(--brand-muted)' }}
              data-testid={`admin-growth-${d}`}
            >
              {t('admin.growthDays', '{{n}} days', { n: d })}
            </button>
          ))}
        </div>
      </div>

      {failed && (
        <p className="text-sm" style={{ color: 'var(--brand-muted)' }}>{t('admin.kpiUnavailable', 'These numbers could not be loaded.')}</p>
      )}

      {data && (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
          {MEASURES.map(([key, labelKey, fallback]) => {
            const all = data.series[key] || [];
            const now = all.slice(-span);
            const before = all.slice(0, all.length - span);
            const total = now.reduce((a, b) => a + b, 0);
            const prev = before.reduce((a, b) => a + b, 0);
            const change = prev ? Math.round(((total - prev) / prev) * 100) : null;
            const label = t(labelKey, fallback);
            return (
              <div key={key} className="bg-white p-4 rounded-xl border border-[var(--brand-border)]" data-testid={`admin-growth-card-${key}`}>
                <p className="text-xs text-gray-500">{label}</p>
                <div className="flex items-baseline gap-2 mb-2">
                  <p className="text-2xl font-bold">{total.toLocaleString()}</p>
                  {change !== null && (
                    <span
                      className="text-xs font-semibold px-1.5 py-0.5 rounded"
                      style={change >= 0
                        ? { background: 'var(--success-bg, #E6F4EA)', color: 'var(--success, #2E7D4F)' }
                        : { background: '#FBECEC', color: '#B23B3B' }}
                      title={t('admin.growthVsBefore', 'Compared with the {{n}} days before', { n: span })}
                    >
                      {change >= 0 ? '+' : ''}{change}%
                    </span>
                  )}
                </div>
                <Spark values={weekly(now)} label={label} />
              </div>
            );
          })}
        </div>
      )}
      <p className="text-xs mt-2" style={{ color: 'var(--brand-muted)' }}>
        {t('admin.growthHint', 'Each dot is one week. The % compares with the same number of days just before.')}
      </p>
    </section>
  );
}
