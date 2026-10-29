/**
 * Dashboard → Sales summary (backend routes/marketplace/sales_summary.py):
 * one page across everything the business runs here, orders, memberships,
 * door visits, appointments and discount codes, for 30 days, 3 months or
 * 12 months against the period before. Since 29 Oct 2026 (Tzvi: "by month
 * day or year" as on Shopify): any dates against the period before or last
 * year, a chart day by day or month by month, visitors and how many of them
 * ordered, and the orders to download (AnalyticsKit). Sections only appear for what the
 * business actually uses. The order detail is the existing "How it's
 * going" panel, opened from here rather than repeated.
 */
import React, { useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import axios from 'axios';
import { Loader2, BarChart3 } from 'lucide-react';
import { money } from '../../utils/currency';
import BusinessInsights, { Change, Tile, Section, Bars } from './BusinessInsights';
import CustomerFeedback from './CustomerFeedback';
import { PeriodPicker, TrendChart, DownloadButton, usePeriod } from './AnalyticsKit';
const fieldStyle = { borderColor: 'var(--brand-border)', color: 'var(--ink)' };

// `embedded`: shown inside Overview for anyone who runs a business (Tzvi,
// 15 Oct 2026: "sales summary should be in the overview"); the tab of its
// own remains only for staff whose one area is the summary.
export default function SummaryTab({ API, token, embedded = false }) {
  const { t, i18n } = useTranslation();
  const lang = String(i18n.language || 'en').split('-')[0];
  const auth = useMemo(() => ({ headers: { Authorization: `Bearer ${token}` } }), [token]);
  const [businesses, setBusinesses] = useState(null);
  const [bizId, setBizId] = useState(() => { try { return localStorage.getItem('orders.business') || ''; } catch { return ''; } });
  const { period, setPeriod, params, days, key } = usePeriod();
  const [show, setShow] = useState('revenue');
  const [d, setD] = useState(null);
  const [orderDetail, setOrderDetail] = useState(false);

  useEffect(() => {
    let alive = true;
    axios.get(`${API}/marketplace/my-workplaces`, { ...auth, params: { perm: 'summary' } }).then(({ data }) => {
      if (!alive) return;
      const active = (data || []).filter((b) => b.active);
      setBusinesses(active);
      if (!active.find((b) => b.id === bizId) && active[0]) setBizId(active[0].id);
    }).catch(() => alive && setBusinesses([]));
    return () => { alive = false; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [API, token]);
  useEffect(() => { try { if (bizId) localStorage.setItem('orders.business', bizId); } catch { /* private mode */ } }, [bizId]);
  const ready = businesses && businesses.some((b) => b.id === bizId);
  useEffect(() => {
    if (!ready || (params.start && (!params.end || params.end < params.start))) return;
    // Only the answer for the dates now chosen: one for dates changed since must not land after it.
    let alive = true;
    setD(null);
    axios.get(`${API}/marketplace/businesses/${bizId}/summary`, { ...auth, params }).then(({ data }) => alive && setD(data)).catch(() => alive && setD(false));
    return () => { alive = false; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ready, API, bizId, auth, key]);

  if (businesses === null) return embedded ? null : <div className="py-16 text-center"><Loader2 className="animate-spin inline" size={18} /></div>;
  if (businesses.length === 0 && embedded) return null;
  if (businesses.length === 0) return <p className="rounded-2xl border p-8 text-center text-sm" style={{ ...fieldStyle, color: 'var(--brand-muted)' }}>{t('summary.needBusiness', 'Add a business first.')}</p>;
  const biz = businesses.find((b) => b.id === bizId) || businesses[0];
  const dayNames = lang === 'he' ? ['א׳', 'ב׳', 'ג׳', 'ד׳', 'ה׳', 'ו׳', 'ש׳'] : ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
  const cur = d?.currency || 'ILS';
  const o = d?.orders;
  const nothing = d && !o.orders && !o.compare && !d.memberships.has_any && !d.appointments.has_any && !d.visits.count && !d.visitors?.count;
  const versus = d?.compare_with === 'year' ? t('analytics.lastYearShort', 'last year') : t('insights.before', 'the period before');

  return (
    <div data-testid="summary-tab" data-tour="sales-summary">
      <div className="flex flex-wrap items-center justify-between gap-3 mb-1">
        <h2 className={embedded ? 'text-base font-semibold' : 'text-lg font-bold'} style={{ color: 'var(--ink)' }}>{t('summary.title', 'Sales summary')}</h2>
        {businesses.length > 1 && (
          <select value={biz.id} onChange={(e) => setBizId(e.target.value)} className="px-3 py-2 rounded-lg border text-sm bg-white min-h-[44px]" style={fieldStyle} aria-label={t('orders.pickBusiness', 'Business')}>
            {businesses.map((b) => <option key={b.id} value={b.id}>{b.name}</option>)}
          </select>
        )}
      </div>
      <p className={`text-sm mb-4 ${embedded ? 'hidden sm:block' : ''}`} style={{ color: 'var(--brand-muted)' }}>{t('summary.body', 'How the business is doing across orders, memberships, visits and appointments. Every number is counted from your own records.')}</p>
      <PeriodPicker period={period} setPeriod={setPeriod} t={t} />

      {d === null ? <div className="py-10 text-center"><Loader2 className="animate-spin inline" size={18} /></div>
        : d === false ? <p className="text-sm" style={{ color: 'var(--brand-muted)' }}>{t('summary.loadFailed', 'Could not load the summary. Try again.')}</p>
          : nothing ? (
            <div className="rounded-2xl border p-8 text-center text-sm" style={{ ...fieldStyle, color: 'var(--brand-muted)' }} data-testid="summary-empty">
              <BarChart3 size={22} className="inline mb-2" />
              <p>{t('summary.empty', 'Nothing to count yet. Your first orders, members and appointments will show here.')}</p>
            </div>
          ) : (
            <>
              <div className="grid gap-3 grid-cols-2 lg:grid-cols-4 mb-4">
                <Tile label={t('summary.revenue', 'Sales from orders')} value={money(o.revenue, cur)} testid="summary-revenue">
                  <Change now={o.revenue} before={o.revenue_before} shown={money(o.revenue_before, cur)} compare={o.compare} t={t} versus={versus} />
                </Tile>
                <Tile label={t('summary.orders', 'Orders')} value={o.orders} testid="summary-orders">
                  <Change now={o.orders} before={o.orders_before} compare={o.compare} t={t} versus={versus} />
                </Tile>
                {d.memberships.has_any && (
                  <Tile label={t('summary.activeMembers', 'Active members')} value={d.memberships.active} testid="summary-members">
                    <p className="text-xs mt-1" style={{ color: 'var(--ink)' }}>{t('summary.monthlyValue', '{{v}} a month at plan prices', { v: money(d.memberships.monthly_value, cur) })}</p>
                  </Tile>
                )}
                <Tile label={t('summary.customers', 'Customers')} value={d.customers.in_period} testid="summary-customers">
                  <p className="text-xs mt-1" style={{ color: 'var(--ink)' }}>{t('summary.newReturning', '{{a}} new, {{b}} returning', { a: d.customers.new, b: d.customers.returning })}</p>
                </Tile>
              </div>

              <div className="grid gap-3 md:grid-cols-3 mb-3">
                <div className="md:col-span-2">
                  <Section title={o.series.unit === 'day' ? t('analytics.byDay', 'Day by day') : t('analytics.byMonth', 'Month by month')} testid="summary-chart">
                    <div className="inline-flex rounded-full border p-0.5 mb-3" style={{ borderColor: 'var(--brand-border)' }} role="group">
                      {['revenue', 'orders'].map((k) => (
                        <button key={k} type="button" onClick={() => setShow(k)} aria-pressed={show === k} className="px-3 min-h-[36px] rounded-full text-xs font-semibold"
                          style={show === k ? { background: 'var(--ink)', color: 'var(--action-ink)' } : { color: 'var(--brand-muted)' }} data-testid={`summary-show-${k}`}>
                          {k === 'revenue' ? t('summary.revenue', 'Sales from orders') : t('summary.orders', 'Orders')}
                        </button>
                      ))}
                    </div>
                    <TrendChart points={o.series.points} unit={o.series.unit} lang={lang} t={t}
                      value={(p) => (show === 'revenue' ? p.revenue : p.orders)} before={(p) => (show === 'revenue' ? p.revenue_before : p.orders_before)}
                      format={(v) => (show === 'revenue' ? money(v, cur) : v)} title={t('summary.revenue', 'Sales from orders')} />
                  </Section>
                </div>
                <Section title={t('analytics.visitors', 'Visitors')} testid="summary-visitors">
                  <p className="text-2xl font-bold tabular-nums" style={{ color: 'var(--ink)' }}>{d.visitors.count}</p>
                  <Change now={d.visitors.count} before={d.visitors.before} compare={d.visitors.before > 0} t={t} versus={versus} />
                  <p className="text-sm mt-2" style={{ color: 'var(--ink)' }}>
                    {d.visitors.rate != null
                      ? t('analytics.rate', '{{r}} orders or appointment requests for every 100 visitors', { r: d.visitors.rate })
                      : t('analytics.rateTooFew', 'The rate shows once 20 people have visited in the period.')}
                  </p>
                  {d.visitors.rate != null && d.visitors.rate_before != null && (
                    <p className="text-xs mt-1" style={{ color: 'var(--brand-muted)' }}>{t('analytics.rateBefore', '{{r}} {{versus}}', { r: d.visitors.rate_before, versus })}</p>
                  )}
                </Section>
              </div>

              <div className="grid gap-3 md:grid-cols-2">
                {d.memberships.has_any && (
                  <Section title={t('summary.memberships', 'Memberships')} testid="summary-memberships">
                    <ul className="text-sm space-y-1" style={{ color: 'var(--ink)' }}>
                      <li>{t('summary.joined', '{{n}} signed up', { n: d.memberships.joined })}
                        <span style={{ color: 'var(--brand-muted)' }}> · {t('summary.before', '{{n}} the period before', { n: d.memberships.joined_before })}</span></li>
                      <li>{t('summary.cancelled', '{{n}} cancelled', { n: d.memberships.cancelled })}</li>
                      {d.memberships.waiting_payment > 0 && <li>{t('summary.waiting', '{{n}} waiting for you to confirm payment', { n: d.memberships.waiting_payment })}</li>}
                    </ul>
                    {d.memberships.by_plan.length > 0 && (
                      <div className="mt-3">
                        <Bars rows={d.memberships.by_plan} label={(r) => r.plan} value={(r) => r.active} title={t('summary.byPlan', 'Active members by plan')} />
                      </div>
                    )}
                  </Section>
                )}
                {d.visits.count > 0 && (
                  <Section title={t('summary.visits', 'Visits at the door: {{n}}', { n: d.visits.count })} testid="summary-visits">
                    <Bars rows={d.visits.weekdays.map((n, i) => ({ n, i }))} label={(r) => dayNames[r.i]} value={(r) => r.n} title={t('summary.visitsByDay', 'Visits by day')} />
                    {d.visits.busiest_hour != null && (
                      <p className="text-xs mt-2" style={{ color: 'var(--ink)' }}>{t('summary.busiestHour', 'Busiest hour: {{h}}:00 to {{h2}}:00', { h: d.visits.busiest_hour, h2: (d.visits.busiest_hour + 1) % 24 })}</p>
                    )}
                    <Change now={d.visits.count} before={d.visits.before} compare={d.visits.before > 0} t={t} />
                  </Section>
                )}
                {d.appointments.has_any && (
                  <Section title={t('summary.appointments', 'Appointments: {{n}} requested', { n: d.appointments.count })} testid="summary-appointments">
                    <ul className="text-sm space-y-1" style={{ color: 'var(--ink)' }}>
                      <li>{t('summary.apAccepted', '{{n}} accepted', { n: d.appointments.accepted })}</li>
                      <li>{t('summary.apCompleted', '{{n}} completed', { n: d.appointments.completed })}</li>
                      {d.appointments.pending > 0 && <li>{t('summary.apPending', '{{n}} still waiting for your answer', { n: d.appointments.pending })}</li>}
                      {d.appointments.declined > 0 && <li>{t('summary.apDeclined', '{{n}} declined', { n: d.appointments.declined })}</li>}
                    </ul>
                  </Section>
                )}
                {(d.discounts.orders > 0 || d.discounts.members > 0) && (
                  <Section title={t('summary.discounts', 'Discount codes')} testid="summary-discounts">
                    <ul className="text-sm space-y-1" style={{ color: 'var(--ink)' }}>
                      {d.discounts.orders > 0 && <li>{t('summary.discOrders', '{{n}} orders used a code, {{v}} off', { n: d.discounts.orders, v: money(d.discounts.orders_amount, cur) })}</li>}
                      {d.discounts.members > 0 && <li>{t('summary.discMembers', '{{n}} sign-ups used a code, {{v}} off', { n: d.discounts.members, v: money(d.discounts.members_amount, cur) })}</li>}
                    </ul>
                    {d.discounts.top_codes.length > 0 && (
                      <div className="mt-3"><Bars rows={d.discounts.top_codes} label={(r) => r.code} value={(r) => r.uses} title={t('summary.topCodes', 'Most used codes')} /></div>
                    )}
                  </Section>
                )}
                <CustomerFeedback API={API} auth={auth} businessId={biz.id} days={days} show={d.appointments.has_any || o.orders > 0} />
              </div>

              {(o.orders > 0 || o.compare) && (
                <div className="mt-4 flex flex-wrap gap-2">
                  {!orderDetail && <DownloadButton url={`${API}/marketplace/businesses/${biz.id}/orders.csv`} params={params} auth={auth} t={t} />}
                  {orderDetail
                    ? <div className="w-full"><BusinessInsights API={API} auth={auth} businessId={biz.id} params={params} onClose={() => setOrderDetail(false)} /></div>
                    : (
                      <button type="button" onClick={() => setOrderDetail(true)} className="inline-flex items-center gap-1.5 px-4 min-h-[44px] rounded-full border text-sm font-semibold" style={fieldStyle} data-testid="summary-order-detail">
                        <BarChart3 size={15} /> {t('summary.orderDetail', 'Orders in detail: best sellers, busiest days, top customers')}
                      </button>
                    )}
                </div>
              )}
            </>
          )}
    </div>
  );
}
