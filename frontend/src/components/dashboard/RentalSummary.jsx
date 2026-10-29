/**
 * Dashboard → Overview → Your rentals (backend properties/browse.py
 * property_analytics; Tzvi, 29 Oct 2026). For a property owner what the
 * sales summary is for a business: booking requests, nights booked, how
 * full the vacation rentals were, the booked value at their prices, and
 * visitors, for any period against the period before or last year, night
 * by night or month by month, with the bookings to download.
 */
import React, { useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import axios from 'axios';
import { Loader2 } from 'lucide-react';
import { money } from '../../utils/currency';
import { Change, Tile, Section } from './BusinessInsights';
import { PeriodPicker, TrendChart, DownloadButton, usePeriod } from './AnalyticsKit';

export default function RentalSummary({ API, token }) {
  const { t, i18n } = useTranslation();
  const lang = String(i18n.language || 'en').split('-')[0];
  const auth = useMemo(() => ({ headers: { Authorization: `Bearer ${token}` } }), [token]);
  const { period, setPeriod, params, key } = usePeriod();
  const [d, setD] = useState(null);
  const [show, setShow] = useState('nights');

  useEffect(() => {
    if (params.start && (!params.end || params.end < params.start)) return;
    let alive = true;
    setD(null);
    axios.get(`${API}/properties/performance/analytics`, { ...auth, params }).then(({ data }) => alive && setD(data)).catch(() => alive && setD(false));
    return () => { alive = false; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [API, auth, key]);

  if (d && !d.listings) return null;
  const cur = d?.currency || 'ILS';
  const n = d?.now;
  const b = d?.before;
  const cmp = d?.compare;
  const versus = d?.compare_with === 'year' ? t('analytics.lastYearShort', 'last year') : t('insights.before', 'the period before');

  return (
    <section className="rounded-xl border p-5 mb-6" style={{ borderColor: 'var(--brand-border)', background: 'var(--surface, #fff)' }} data-testid="rental-summary">
      <h2 className="text-base font-semibold mb-1" style={{ color: 'var(--ink)' }}>{t('rentals.title', 'Your rentals')}</h2>
      <p className="text-sm mb-4 hidden sm:block" style={{ color: 'var(--brand-muted)' }}>{t('rentals.body', 'Booking requests, nights booked and visitors, counted from your own bookings.')}</p>
      <PeriodPicker period={period} setPeriod={setPeriod} t={t} />
      {d === null ? <div className="py-10 text-center"><Loader2 className="animate-spin inline" size={18} /></div>
        : d === false ? <p className="text-sm" style={{ color: 'var(--brand-muted)' }}>{t('summary.loadFailed', 'Could not load the summary. Try again.')}</p>
          : (
            <>
              <div className="grid gap-3 grid-cols-2 lg:grid-cols-4 mb-4">
                <Tile label={t('rentals.nights', 'Nights booked')} value={n.nights} testid="rentals-nights">
                  <Change now={n.nights} before={b.nights} compare={cmp} t={t} versus={versus} />
                </Tile>
                {n.occupancy != null && (
                  <Tile label={t('rentals.occupancy', 'How full (vacation rentals)')} value={`${n.occupancy}%`} testid="rentals-occupancy">
                    <Change now={n.occupancy} before={b.occupancy} shown={`${b.occupancy}%`} compare={cmp} t={t} versus={versus} />
                  </Tile>
                )}
                <Tile label={t('rentals.value', 'Booked value')} value={money(n.value, cur)} testid="rentals-value">
                  <Change now={n.value} before={b.value} shown={money(b.value, cur)} compare={cmp} t={t} versus={versus} />
                  {n.unpriced > 0 && <p className="text-[11px] mt-1" style={{ color: 'var(--brand-muted)' }}>{t('rentals.unpriced', 'Stays with no value recorded: {{n}}', { n: n.unpriced })}</p>}
                </Tile>
                <Tile label={t('rentals.requests', 'Booking requests')} value={n.requests} testid="rentals-requests">
                  <p className="text-xs mt-1" style={{ color: 'var(--ink)' }}>{t('rentals.requestSplit', '{{a}} accepted, {{p}} waiting, {{c}} cancelled', { a: n.accepted, p: n.pending, c: n.cancelled })}</p>
                </Tile>
              </div>

              <div className="grid gap-3 md:grid-cols-3">
                <div className="md:col-span-2">
                  <Section title={show === 'nights' ? t('rentals.nightsBy', 'Nights booked') : t('rentals.valueBy', 'Booked value, by check-in')} testid="rentals-chart">
                    <div className="inline-flex rounded-full border p-0.5 mb-3" style={{ borderColor: 'var(--brand-border)' }} role="group">
                      {['nights', 'value'].map((k) => (
                        <button key={k} type="button" onClick={() => setShow(k)} aria-pressed={show === k} className="px-3 min-h-[36px] rounded-full text-xs font-semibold"
                          style={show === k ? { background: 'var(--ink)', color: 'var(--action-ink)' } : { color: 'var(--brand-muted)' }}>
                          {k === 'nights' ? t('rentals.nights', 'Nights booked') : t('rentals.value', 'Booked value')}
                        </button>
                      ))}
                    </div>
                    <TrendChart points={d.series.points} unit={d.series.unit} lang={lang} t={t}
                      value={(p) => (show === 'nights' ? p.nights : p.value)} before={(p) => (show === 'nights' ? p.nights_before : p.value_before)}
                      format={(v) => (show === 'nights' ? v : money(v, cur))} title={t('rentals.nightsBy', 'Nights booked')} />
                  </Section>
                </div>
                <Section title={t('analytics.visitors', 'Visitors')} testid="rentals-visitors">
                  <p className="text-2xl font-bold tabular-nums" style={{ color: 'var(--ink)' }}>{d.visitors.count}</p>
                  <Change now={d.visitors.count} before={d.visitors.before} compare={cmp} t={t} versus={versus} />
                  <p className="text-sm mt-2" style={{ color: 'var(--ink)' }}>
                    {d.visitors.rate != null
                      ? t('rentals.rate', '{{r}} booking requests for every 100 visitors', { r: d.visitors.rate })
                      : t('analytics.rateTooFew', 'The rate shows once 20 people have visited in the period.')}
                  </p>
                </Section>
              </div>

              {d.by_listing.length > 1 && (
                <div className="mt-3">
                  <Section title={t('rentals.byListing', 'By listing')} testid="rentals-by-listing">
                    <ul className="space-y-1.5 text-sm">
                      {d.by_listing.map((r) => (
                        <li key={r.id} className="flex items-baseline justify-between gap-3">
                          <span className="truncate" style={{ color: 'var(--ink)' }}>{r.title}</span>
                          <span className="whitespace-nowrap tabular-nums" style={{ color: 'var(--brand-muted)' }}>
                            {t('rentals.listingLine', '{{n}} nights · {{r}} requests', { n: r.nights, r: r.requests })}
                          </span>
                        </li>
                      ))}
                    </ul>
                  </Section>
                </div>
              )}
              <div className="mt-4">
                <DownloadButton url={`${API}/properties/performance/bookings.csv`} params={params} auth={auth} t={t} label={t('rentals.download', 'Download bookings for Excel')} />
              </div>
            </>
          )}
    </section>
  );
}
