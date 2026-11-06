/**
 * Where visits come from, phone or laptop, language, new or returning, taps and
 * the busiest pages and listings (backend marketplace/visit_data.py). The same
 * card for an owner and, with `everyone`, for Super Admin on the whole site.
 */
import React, { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import axios from 'axios';

function Rows({ title, rows, label, testid }) {
  if (!rows?.length) return null;
  const top = Math.max(...rows.map((r) => r.n));
  return (
    <div data-testid={testid}>
      <h3 className="text-sm font-semibold mb-2" style={{ color: 'var(--ink)' }}>{title}</h3>
      <ul className="space-y-1.5">
        {rows.map((r) => (
          <li key={r.key} className="text-sm">
            <div className="flex justify-between gap-3" style={{ color: 'var(--ink)' }}>
              <span className="min-w-0 truncate" dir="auto">{label(r.key)}</span>
              <span className="font-semibold shrink-0">{r.n}</span>
            </div>
            <div className="h-1 rounded-full mt-1" style={{ background: '#F3F4F6' }}>
              <div className="h-1 rounded-full" style={{ width: `${Math.max(4, (r.n / top) * 100)}%`, background: 'var(--gold)' }} />
            </div>
          </li>
        ))}
      </ul>
    </div>
  );
}

export default function VisitBreakdown({ API, token, everyone = false, className = 'mb-6' }) {
  const { t } = useTranslation();
  const [d, setD] = useState(null);
  useEffect(() => {
    axios.get(`${API}/marketplace/visits/breakdown`, { params: { days: 30, everyone }, headers: { Authorization: `Bearer ${token}` } })
      .then((r) => setD(r.data)).catch(() => setD(null));
  }, [API, token, everyone]);
  if (!d || !d.visits) return null;
  const word = (group, fallback) => (k) => t(`visits.${group}_${k}`, fallback ? fallback(k) : k);
  const whoIs = [
    d.new > 0 && { key: 'new', n: d.new },
    d.returning > 0 && { key: 'returning', n: d.returning },
  ].filter(Boolean);
  const listings = (d.listings || []).map((l) => ({ key: l.id, n: l.n, name: l.name }));
  const nameOf = (id) => listings.find((l) => l.key === id)?.name || id;
  return (
    <div className={`rounded-xl border p-5 ${className}`} style={{ borderColor: 'var(--brand-border)', background: 'var(--surface, #fff)' }} data-testid="visit-breakdown">
      <h2 className="text-base font-semibold" style={{ color: 'var(--ink)' }}>{t('visits.title', 'Who visits, last {{n}} days', { n: d.days })}</h2>
      <p className="text-xs mt-0.5 mb-4" style={{ color: 'var(--brand-muted)' }}>
        {t('visits.total', '{{n}} visits', { n: d.visits })}
        {d.since ? ` · ${t('visits.since', 'details counted from {{date}}', { date: d.since })}` : ''}
      </p>
      <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-5">
        <Rows title={t('visits.sources', 'Where they came from')} rows={d.sources} label={word('source')} testid="visits-sources" />
        <Rows title={t('visits.devices', 'Phone or laptop')} rows={d.devices} label={word('device')} testid="visits-devices" />
        <Rows title={t('visits.newOrBack', 'New or returning')} rows={whoIs} label={word('who')} testid="visits-who" />
        <Rows title={t('visits.langs', 'Language')} rows={d.langs} label={word('lang')} testid="visits-langs" />
        <Rows title={t('visits.taps', 'Taps on your site')} rows={d.taps} label={word('tap')} testid="visits-taps" />
        <Rows title={t('visits.pages', 'Busiest pages on your site')} rows={d.pages} label={word('page')} testid="visits-pages" />
        <Rows title={t('visits.listings', 'Most visited')} rows={listings} label={nameOf} testid="visits-listings" />
      </div>
    </div>
  );
}
