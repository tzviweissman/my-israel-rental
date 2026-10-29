/**
 * The pieces every sales screen shares (Tzvi, 29 Oct 2026: "track sales and
 * growth whether by month day or year", as Shopify does): the period picker
 * (a preset or any two dates, against the period before or the same dates
 * last year), the chart that shows the period beside the one compared, and
 * the spreadsheet download. The backend reads the same ?days, ?start, ?end
 * and ?compare everywhere (routes/marketplace/insights.window).
 */
import React, { useId, useMemo, useState } from 'react';
import axios from 'axios';
import { Download, Loader2 } from 'lucide-react';
import { toast } from 'sonner';

const iso = (d) => new Date(d.getTime() - d.getTimezoneOffset() * 60000).toISOString().slice(0, 10);

export const PRESETS = ['7', '30', '90', '365', 'month', 'year', 'lastyear', 'custom'];

/** The period as the API wants it, from a preset or two dates. */
export function periodParams(p) {
  const today = new Date();
  if (/^\d+$/.test(p.preset)) return { days: Number(p.preset), compare: p.compare };
  if (p.preset === 'month') return { start: iso(new Date(today.getFullYear(), today.getMonth(), 1)), end: iso(today), compare: p.compare };
  if (p.preset === 'year') return { start: `${today.getFullYear()}-01-01`, end: iso(today), compare: p.compare };
  if (p.preset === 'lastyear') return { start: `${today.getFullYear() - 1}-01-01`, end: `${today.getFullYear() - 1}-12-31`, compare: p.compare };
  return { start: p.start, end: p.end, compare: p.compare };
}

export function usePeriod() {
  const [p, setP] = useState(() => {
    try { const s = JSON.parse(localStorage.getItem('sales.period') || 'null'); if (s && PRESETS.includes(s.preset)) return s; } catch { /* private mode */ }
    const t = new Date();
    return { preset: '30', compare: 'prev', start: iso(new Date(t.getFullYear(), t.getMonth(), 1)), end: iso(t) };
  });
  const set = (n) => { setP(n); try { localStorage.setItem('sales.period', JSON.stringify(n)); } catch { /* private mode */ } };
  const params = useMemo(() => periodParams(p), [p]);
  // Roughly how many days, for the panels that still take ?days (customer feedback).
  const days = params.days || Math.max(1, Math.round((new Date(params.end) - new Date(params.start)) / 86400000) + 1);
  return { period: p, setPeriod: set, params, days, key: JSON.stringify(params) };
}

const fieldStyle = { borderColor: 'var(--brand-border)', color: 'var(--ink)' };

export function PeriodPicker({ period, setPeriod, t }) {
  const id = useId();
  const label = {
    7: t('analytics.p7', '7 days'), 30: t('insights.d30', '30 days'), 90: t('insights.d90', '3 months'), 365: t('insights.d365', '12 months'),
    month: t('analytics.thisMonth', 'This month'), year: t('analytics.thisYear', 'This year'), lastyear: t('analytics.lastYear', 'Last year'),
    custom: t('analytics.custom', 'Choose dates'),
  };
  const bad = period.preset === 'custom' && (!period.start || !period.end || period.end < period.start);
  return (
    <div className="flex flex-wrap items-end gap-2 mb-4" data-testid="period-picker">
      <label className="text-xs font-semibold flex flex-col gap-1" style={{ color: 'var(--brand-muted)' }}>
        {t('summary.period', 'Period')}
        <select value={period.preset} onChange={(e) => setPeriod({ ...period, preset: e.target.value })}
          className="px-3 rounded-lg border text-sm bg-white min-h-[44px]" style={fieldStyle} data-testid="period-preset">
          {PRESETS.map((k) => <option key={k} value={k}>{label[k]}</option>)}
        </select>
      </label>
      {period.preset === 'custom' && (
        <>
          <label className="text-xs font-semibold flex flex-col gap-1" style={{ color: 'var(--brand-muted)' }} htmlFor={`${id}-a`}>
            {t('analytics.from', 'From')}
            <input id={`${id}-a`} type="date" value={period.start || ''} max={period.end || undefined} onChange={(e) => setPeriod({ ...period, start: e.target.value })}
              className="px-3 rounded-lg border text-sm bg-white min-h-[44px]" style={fieldStyle} data-testid="period-start" />
          </label>
          <label className="text-xs font-semibold flex flex-col gap-1" style={{ color: 'var(--brand-muted)' }} htmlFor={`${id}-b`}>
            {t('analytics.to', 'To')}
            <input id={`${id}-b`} type="date" value={period.end || ''} min={period.start || undefined} onChange={(e) => setPeriod({ ...period, end: e.target.value })}
              className="px-3 rounded-lg border text-sm bg-white min-h-[44px]" style={fieldStyle} data-testid="period-end" />
          </label>
        </>
      )}
      <label className="text-xs font-semibold flex flex-col gap-1" style={{ color: 'var(--brand-muted)' }}>
        {t('analytics.compareWith', 'Compared with')}
        <select value={period.compare} onChange={(e) => setPeriod({ ...period, compare: e.target.value })}
          className="px-3 rounded-lg border text-sm bg-white min-h-[44px]" style={fieldStyle} data-testid="period-compare">
          <option value="prev">{t('analytics.cmpPrev', 'The period before')}</option>
          <option value="year">{t('analytics.cmpYear', 'The same dates last year')}</option>
        </select>
      </label>
      {bad && <p className="text-xs w-full" role="alert" style={{ color: 'var(--error-text)' }}>{t('analytics.badDates', 'Choose an end date on or after the start date.')}</p>}
    </div>
  );
}

/**
 * The period day by day (or month by month), a solid bar for each point and a
 * thin grey one beside it for the period compared, the scale from zero. The
 * numbers are in the bars' titles and in a table for screen readers.
 */
export function TrendChart({ points, unit, value, before, format = (n) => n, lang, title, t }) {
  const max = Math.max(1, ...points.map(value), ...points.map(before));
  const W = Math.max(1, points.length);
  const label = (at) => (unit === 'day'
    ? new Date(`${at}T12:00:00`).toLocaleDateString(lang === 'he' ? 'he-IL' : 'en-GB', { day: 'numeric', month: 'short' })
    : new Date(`${at}-15T12:00:00`).toLocaleDateString(lang === 'he' ? 'he-IL' : 'en-GB', { month: 'short', year: '2-digit' }));
  const ticks = points.length <= 1 ? [0] : [0, Math.floor((points.length - 1) / 2), points.length - 1];
  // Time runs the way the page reads: oldest on the right in Hebrew.
  const rtl = lang === 'he';
  const side = rtl ? 'right' : 'left';
  const shift = (i) => (i === 0 ? 'none' : `translateX(${rtl ? '' : '-'}${i === points.length - 1 ? 100 : 50}%)`);
  return (
    <figure className="m-0" data-testid="trend-chart">
      <div className="flex items-end gap-[2px] h-36" aria-hidden="true">
        {points.map((p, i) => (
          <div key={p.at} className="flex-1 h-full flex items-end gap-[1px] min-w-0" title={`${label(p.at)}: ${format(value(p))} · ${format(before(p))}`}>
            <span className="block flex-1 rounded-t-sm" style={{ height: `${(before(p) / max) * 100}%`, minHeight: before(p) ? 2 : 0, background: 'var(--brand-border, #E3E3E3)' }} />
            <span className="block flex-1 rounded-t-sm" style={{ height: `${(value(p) / max) * 100}%`, minHeight: value(p) ? 2 : 0, background: 'var(--gold)' }} />
          </div>
        ))}
      </div>
      <div className="relative h-5 mt-1 text-[11px]" aria-hidden="true" style={{ color: 'var(--brand-muted)' }}>
        {ticks.map((i) => (
          <span key={i} className="absolute whitespace-nowrap" style={{ [side]: `${((i + 0.5) / W) * 100}%`, transform: shift(i) }}>{label(points[i].at)}</span>
        ))}
      </div>
      <figcaption className="flex flex-wrap gap-3 text-[11px] mt-1" style={{ color: 'var(--brand-muted)' }}>
        <span className="inline-flex items-center gap-1"><span className="w-2.5 h-2.5 rounded-sm inline-block" style={{ background: 'var(--gold)' }} />{t('analytics.thisPeriod', 'This period')}</span>
        <span className="inline-flex items-center gap-1"><span className="w-2.5 h-2.5 rounded-sm inline-block" style={{ background: 'var(--brand-border, #E3E3E3)' }} />{t('analytics.compared', 'The period compared')}</span>
      </figcaption>
      <table className="sr-only">
        <caption>{title}</caption>
        <tbody>{points.map((p) => <tr key={p.at}><th scope="row">{label(p.at)}</th><td>{format(value(p))}</td><td>{format(before(p))}</td></tr>)}</tbody>
      </table>
    </figure>
  );
}

/** A spreadsheet of the period, fetched with the sign-in and saved under the name the API gives it. */
export function DownloadButton({ url, params, auth, t, label }) {
  const [busy, setBusy] = useState(false);
  const go = async () => {
    setBusy(true);
    try {
      const r = await axios.get(url, { ...auth, params, responseType: 'blob' });
      const name = (/filename="([^"]+)"/.exec(r.headers['content-disposition'] || '') || [])[1] || 'download.csv';
      const a = document.createElement('a');
      a.href = URL.createObjectURL(r.data);
      a.download = name;
      document.body.appendChild(a); a.click(); a.remove();
      setTimeout(() => URL.revokeObjectURL(a.href), 2000);
    } catch {
      toast.error(t('analytics.downloadFailed', 'The download did not work. Try again.'));
    } finally {
      setBusy(false);
    }
  };
  return (
    <button type="button" onClick={go} disabled={busy} className="inline-flex items-center gap-1.5 px-4 min-h-[44px] rounded-full border text-sm font-semibold" style={fieldStyle} data-testid="download-csv">
      {busy ? <Loader2 size={15} className="animate-spin" /> : <Download size={15} />} {label || t('analytics.download', 'Download for Excel')}
    </button>
  );
}
