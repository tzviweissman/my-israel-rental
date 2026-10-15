/**
 * BusinessInsights: "How it's going", what a business's own orders say
 * (Tzvi, 14 Oct 2026: orders from the order pages are saved "to help
 * businesses use the information to help them grow").
 *
 * Opened from the Orders toolbar. Every number is a count or a sum of their
 * orders (GET /marketplace/businesses/<id>/insights); nothing is estimated,
 * and the panel says from when it is counting. Change against the period
 * before is a word and an arrow, never colour alone, and only once the
 * period before was being counted (a first month cannot be "up").
 */
import React, { useEffect, useState } from 'react';
import axios from 'axios';
import { useTranslation } from 'react-i18next';
import { ArrowUp, ArrowDown, Minus, Loader2, X } from 'lucide-react';
import { money } from '../../utils/currency';
import formatDate from '../../utils/formatDate';

const PERIODS = [30, 90, 365];

function Change({ now, before, shown, compare, t }) {
  if (!compare) return <p className="text-[11px] mt-1" style={{ color: 'var(--brand-muted)' }}>{t('insights.tooNew', 'Not enough history yet to compare.')}</p>;
  const Arrow = now > before ? ArrowUp : now < before ? ArrowDown : Minus;
  const word = now > before ? t('insights.up', 'up from') : now < before ? t('insights.down', 'down from') : t('insights.same', 'the same as');
  return (
    <p className="text-xs mt-1 inline-flex items-center gap-1" style={{ color: 'var(--ink)' }}>
      <Arrow size={13} aria-hidden="true" className="shrink-0" />
      <span>{word} {shown ?? before} {t('insights.before', 'the period before')}</span>
    </p>
  );
}

function Tile({ label, value, children, testid }) {
  return (
    <div className="rounded-xl border bg-white p-3.5 min-w-0" style={{ borderColor: 'var(--brand-border)' }} data-testid={testid}>
      <p className="text-xs font-semibold" style={{ color: 'var(--brand-muted)' }}>{label}</p>
      <p className="text-2xl font-bold mt-0.5 tabular-nums" style={{ color: 'var(--ink)' }}>{value}</p>
      {children}
    </div>
  );
}

function Section({ title, children, testid }) {
  return (
    <section className="rounded-xl border bg-white p-3.5 min-w-0" style={{ borderColor: 'var(--brand-border)' }} data-testid={testid}>
      <h4 className="text-sm font-bold mb-2.5" style={{ color: 'var(--ink)' }}>{title}</h4>
      {children}
    </section>
  );
}

/* Bars: one colour, the value written on each, the scale from zero. */
function Bars({ rows, label, value, title }) {
  const max = Math.max(1, ...rows.map(value));
  return (
    <ul className="space-y-1.5" aria-label={title}>
      {rows.map((r, i) => (
        <li key={i} className="grid items-center gap-2" style={{ gridTemplateColumns: '5.5rem minmax(0,1fr) 2.5rem' }}>
          <span className="text-xs truncate" style={{ color: 'var(--brand-muted)' }}>{label(r)}</span>
          <span className="h-2.5 rounded-full" style={{ background: 'var(--surface-2, #F3F4F6)' }}>
            <span className="block h-full rounded-full" style={{ width: `${(value(r) / max) * 100}%`, minWidth: value(r) ? 4 : 0, background: 'var(--gold)' }} />
          </span>
          <span className="text-xs font-semibold text-end tabular-nums" style={{ color: 'var(--ink)' }}>{value(r)}</span>
        </li>
      ))}
    </ul>
  );
}

export default function BusinessInsights({ API, auth, businessId, onClose }) {
  const { t, i18n } = useTranslation();
  const [days, setDays] = useState(30);
  const [data, setData] = useState(null);
  const [err, setErr] = useState('');

  useEffect(() => {
    let alive = true;
    setData(null); setErr('');
    axios.get(`${API}/marketplace/businesses/${businessId}/insights`, { ...auth, params: { days } })
      .then(({ data: d }) => { if (alive) setData(d); })
      .catch(() => { if (alive) setErr(t('insights.failed', 'Could not load the numbers. Try again in a moment.')); });
    return () => { alive = false; };
  }, [API, auth, businessId, days, t]);

  const lang = i18n.language;
  const cur = data?.currency;
  const monthLabel = (m) => new Date(`${m.month}-15T12:00:00`).toLocaleDateString(lang === 'he' ? 'he-IL' : 'en-GB', { month: 'short' });
  const dayNames = lang === 'he' ? ['א׳', 'ב׳', 'ג׳', 'ד׳', 'ה׳', 'ו׳', 'ש׳'] : ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

  return (
    <div className="rounded-2xl border p-4 mb-4" style={{ borderColor: 'var(--brand-border)', background: 'var(--surface, #F9FAFB)' }} data-testid="insights-panel">
      <div className="flex flex-wrap items-center justify-between gap-2 mb-3">
        <div>
          <h3 className="text-base font-bold" style={{ color: 'var(--ink)', fontFamily: 'var(--font-head)' }}>{t('insights.title', "How it's going")}</h3>
          {data?.since && (
            <p className="text-xs" style={{ color: 'var(--brand-muted)' }}>
              {t('insights.since', { defaultValue: 'From your orders, counting since {{d}}', d: formatDate(data.since, lang) })}
            </p>
          )}
        </div>
        <div className="flex items-center gap-1.5">
          <div className="inline-flex rounded-full border p-0.5" style={{ borderColor: 'var(--brand-border)' }} role="group" aria-label={t('insights.period', 'Period')}>
            {PERIODS.map((d) => (
              <button
                key={d}
                type="button"
                onClick={() => setDays(d)}
                aria-pressed={days === d}
                className="px-3 min-h-[36px] rounded-full text-xs font-semibold"
                style={days === d ? { background: 'var(--ink)', color: 'var(--action-ink)' } : { color: 'var(--brand-muted)' }}
                data-testid={`insights-days-${d}`}
              >
                {d === 30 ? t('insights.d30', '30 days') : d === 90 ? t('insights.d90', '3 months') : t('insights.d365', '12 months')}
              </button>
            ))}
          </div>
          <button type="button" onClick={onClose} className="w-9 h-9 rounded-full inline-flex items-center justify-center hover:bg-gray-100" aria-label={t('common.close', 'Close')} data-testid="insights-close">
            <X size={16} />
          </button>
        </div>
      </div>

      {err && <p className="text-sm" style={{ color: '#B42318' }}>{err}</p>}
      {!data && !err && <div className="py-8 text-center"><Loader2 className="animate-spin inline" size={18} /></div>}

      {data && !data.since && (
        <p className="text-sm py-4" style={{ color: 'var(--brand-muted)' }} data-testid="insights-empty">
          {t('insights.empty', 'No orders yet. Orders from your page, and the ones you enter here, will show up as numbers here.')}
        </p>
      )}

      {data && data.since && (
        <div className="space-y-3">
          <div className="grid gap-3" style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(10.5rem, 1fr))' }}>
            <Tile label={t('insights.orders', 'Orders')} value={data.orders} testid="insights-orders">
              <Change now={data.orders} before={data.orders_before} compare={data.compare} t={t} />
            </Tile>
            <Tile label={t('insights.sales', 'Sales')} value={money(data.revenue, cur)} testid="insights-sales">
              <Change now={data.revenue} before={data.revenue_before} shown={money(data.revenue_before, cur)} compare={data.compare} t={t} />
            </Tile>
            <Tile label={t('insights.average', 'Average order')} value={data.average != null ? money(data.average, cur) : '-'} testid="insights-average" />
            <Tile label={t('insights.customers', 'Customers')} value={data.customers} testid="insights-customers">
              <p className="text-xs mt-1" style={{ color: 'var(--ink)' }}>
                {t('insights.newBack', { defaultValue: '{{n}} new, {{b}} came back', n: data.new_customers, b: data.returning })}
              </p>
            </Tile>
          </div>
          {data.other_currency_orders > 0 && (
            <p className="text-xs" style={{ color: 'var(--brand-muted)' }}>
              {t('insights.otherCurrency', { defaultValue: '{{n}} orders in another currency are counted but not added to sales.', n: data.other_currency_orders })}
            </p>
          )}

          <div className="grid gap-3 md:grid-cols-2">
            <Section title={t('insights.bestSellers', 'Best sellers')} testid="insights-best">
              {data.best_sellers.length ? (
                <ol className="space-y-1.5">
                  {data.best_sellers.map((b) => (
                    <li key={b.name} className="flex items-baseline justify-between gap-3 text-sm">
                      <span className="truncate" style={{ color: 'var(--ink)' }}>{b.name}</span>
                      <span className="whitespace-nowrap tabular-nums" style={{ color: 'var(--brand-muted)' }}>
                        {t('insights.sold', { defaultValue: '{{n}} sold', n: b.qty })} · {money(b.revenue, cur)}
                      </span>
                    </li>
                  ))}
                </ol>
              ) : <p className="text-sm" style={{ color: 'var(--brand-muted)' }}>{t('insights.noLines', 'Orders picked from your products show here.')}</p>}
              {data.typed_orders > 0 && (
                <p className="text-xs mt-2" style={{ color: 'var(--brand-muted)' }}>
                  {t('insights.typed', { defaultValue: '{{n}} orders were typed in by hand, so their items are not counted here.', n: data.typed_orders })}
                </p>
              )}
            </Section>

            <Section title={t('insights.byMonth', 'Orders by month')} testid="insights-months">
              <Bars rows={data.months} label={monthLabel} value={(m) => m.orders} title={t('insights.byMonth', 'Orders by month')} />
            </Section>

            <Section title={t('insights.busiest', 'Busiest days')} testid="insights-days">
              <Bars rows={data.weekdays.map((n, i) => ({ n, i }))} label={(r) => dayNames[r.i]} value={(r) => r.n} title={t('insights.busiest', 'Busiest days')} />
            </Section>

            <Section title={t('insights.where', 'Where orders go')} testid="insights-cities">
              {data.cities.length
                ? <Bars rows={data.cities} label={(c) => c.city} value={(c) => c.orders} title={t('insights.where', 'Where orders go')} />
                : <p className="text-sm" style={{ color: 'var(--brand-muted)' }}>{t('insights.noCities', 'Delivery orders show their cities here.')}</p>}
            </Section>

            <Section title={t('insights.topCustomers', 'Your best customers')} testid="insights-top-customers">
              {data.top_customers.length ? (
                <ol className="space-y-1.5">
                  {data.top_customers.map((c, i) => (
                    <li key={i} className="flex items-baseline justify-between gap-3 text-sm">
                      <span className="truncate" style={{ color: 'var(--ink)' }}>{c.name || t('insights.noName', 'No name given')}</span>
                      <span className="whitespace-nowrap tabular-nums" style={{ color: 'var(--brand-muted)' }}>
                        {t('insights.ordersN', { defaultValue: '{{n}} orders', count: c.orders, n: c.orders })} · {money(c.spent, cur)}
                      </span>
                    </li>
                  ))}
                </ol>
              ) : <p className="text-sm" style={{ color: 'var(--brand-muted)' }}>{t('insights.noCustomers', 'Customers with a phone number show here.')}</p>}
            </Section>

            <Section title={t('insights.how', 'How orders came in')} testid="insights-sources">
              <Bars
                rows={[{ k: 'website', n: data.sources.website }, { k: 'entered', n: data.sources.entered }]}
                label={(r) => (r.k === 'website' ? t('insights.fromPage', 'From your page') : t('insights.entered', 'Entered by you'))}
                value={(r) => r.n}
                title={t('insights.how', 'How orders came in')}
              />
            </Section>
          </div>
        </div>
      )}
    </div>
  );
}
