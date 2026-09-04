/**
 * OverviewTab — the dashboard's front page: what is happening, in numbers
 * that exist, and what needs a reply.
 *
 * The layout is the "dashboard-with-collapsible-sidebar" component's
 * content area: a row of stat cards, a two-thirds/one-third split with
 * recent activity on the left and quick figures on the right. What is NOT
 * carried over is any of its numbers. That demo prints "$24,567", "+12%
 * from last month" and prices from Math.random(). Every figure here is
 * read from an endpoint that already exists, and a figure that cannot be
 * computed honestly is absent, not estimated - the rule the finale strip,
 * the trust line and the performance panel all follow.
 *
 * Four cards, four sources, none invented:
 *
 *   Leads      /marketplace/leads/summary  - WhatsApp taps on services,
 *              plus /properties/performance/summary for listings. Raw
 *              actions, not people: a tap is a tap (spec L4).
 *   Visitors   the `views` halves of the same two calls. One visitor per
 *              listing per day, never the owner (spec L2/L4).
 *   Scans      /short-links/mine - every QR and short link the person
 *              owns, summed. "Not scanned yet" at zero, never blank (Q2).
 *   Waiting    /dashboard/summary - bookings and offers awaiting THEIR
 *              reply, which is the number that most deserves the top row.
 *
 * There is no "+12% from last month" anywhere. A period-over-period change
 * needs two windows and none of these endpoints serve the previous one;
 * printing a delta would mean inventing the denominator. "Counting since"
 * is shown instead, because a small number on a young counter is not a
 * verdict.
 */
import React, { useEffect, useMemo, useState } from 'react';
import axios from 'axios';
import { useTranslation } from 'react-i18next';
import { MessageCircle, Eye, QrCode, CalendarCheck, Bell, ArrowRight } from 'lucide-react';

import ScanChart from '../common/ScanChart';
import formatDate from '../../utils/formatDate';

function StatCard({ Icon, label, value, sub, chart, testid, onClick, cta }) {
  return (
    <div
      className="rounded-xl border p-5 flex flex-col gap-3"
      style={{ borderColor: 'var(--brand-border)', background: 'var(--surface, #fff)', boxShadow: 'var(--shadow-sm)' }}
      data-testid={`overview-card-${testid}`}
    >
      <div className="flex items-center justify-between">
        <span
          className="inline-flex h-9 w-9 items-center justify-center rounded-lg"
          style={{ background: 'rgb(var(--brand-primary-rgb) / 0.10)', color: 'var(--brand-primary)' }}
        >
          <Icon size={18} aria-hidden="true" />
        </span>
        {onClick && (
          <button type="button" onClick={onClick} className="text-xs font-semibold hover:underline inline-flex items-center gap-1" style={{ color: 'var(--brand-primary)' }} data-testid={`overview-card-${testid}-link`}>
            {cta} <ArrowRight size={12} className="rtl:rotate-180" aria-hidden="true" />
          </button>
        )}
      </div>
      <div>
        <p className="text-sm font-medium" style={{ color: 'var(--brand-muted)' }}>{label}</p>
        <p className="text-2xl font-bold" style={{ color: 'var(--ink)' }} data-testid={`overview-card-${testid}-value`}>{value}</p>
        {sub && <p className="text-xs mt-1" style={{ color: 'var(--brand-muted)' }} data-testid={`overview-card-${testid}-sub`}>{sub}</p>}
      </div>
      {chart}
    </div>
  );
}

/** Add two zero-filled daily series that share the same dates. */
function addDaily(a, b) {
  if (!a?.length) return b || [];
  if (!b?.length) return a;
  const byDate = new Map(a.map((r) => [r.date, r.count || 0]));
  for (const r of b) byDate.set(r.date, (byDate.get(r.date) || 0) + (r.count || 0));
  return [...byDate.entries()].sort(([x], [y]) => (x < y ? -1 : 1)).map(([date, count]) => ({ date, count }));
}

export default function OverviewTab({ API, token, user, summary = {}, unreadMessages = 0, bookings = [], isPropertyLister, showGigTabs, onGoToTab }) {
  const { t } = useTranslation();
  const [services, setServices] = useState(null);   // /marketplace/leads/summary
  const [listings, setListings] = useState(null);   // /properties/performance/summary
  const [scans, setScans] = useState(null);         // /short-links/mine
  const [awaiting, setAwaiting] = useState([]);     // leads with no reply
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    if (!token) return undefined;
    let alive = true;
    const h = { headers: { Authorization: `Bearer ${token}` } };
    const calls = [
      showGigTabs ? axios.get(`${API}/marketplace/leads/summary`, h) : Promise.resolve({ data: null }),
      isPropertyLister ? axios.get(`${API}/properties/performance/summary`, h) : Promise.resolve({ data: null }),
      axios.get(`${API}/short-links/mine`, h),
      showGigTabs ? axios.get(`${API}/marketplace/leads/awaiting-answer`, h) : Promise.resolve({ data: [] }),
    ];
    Promise.allSettled(calls).then(([s, l, q, a]) => {
      if (!alive) return;
      if (s.status === 'fulfilled') setServices(s.value.data);
      if (l.status === 'fulfilled') setListings(l.value.data);
      if (q.status === 'fulfilled') setScans(q.value.data);
      if (a.status === 'fulfilled' && Array.isArray(a.value.data)) setAwaiting(a.value.data);
      setLoaded(true);
    });
    return () => { alive = false; };
  }, [API, token, showGigTabs, isPropertyLister]);

  // Leads and visitors, across services and listings. Each source carries
  // its own "since"; the earliest is shown, because that is when counting
  // began for this person, whichever half started first.
  const leads = useMemo(() => {
    const parts = [services, listings].filter(Boolean);
    if (!parts.length) return null;
    return {
      period: parts.reduce((n, p) => n + (p.period_total || 0), 0),
      total: parts.reduce((n, p) => n + (p.total || 0), 0),
      daily: parts.reduce((acc, p) => addDaily(acc, p.daily), []),
      since: parts.map((p) => p.since).filter(Boolean).sort()[0] || null,
      days: parts[0].period_days || 30,
    };
  }, [services, listings]);

  const visitors = useMemo(() => {
    const parts = [services?.views, listings?.views].filter(Boolean);
    if (!parts.length) return null;
    return {
      period: parts.reduce((n, p) => n + (p.period_total || 0), 0),
      total: parts.reduce((n, p) => n + (p.total || 0), 0),
      daily: parts.reduce((acc, p) => addDaily(acc, p.daily), []),
      since: parts.map((p) => p.since).filter(Boolean).sort()[0] || null,
    };
  }, [services, listings]);

  const waiting = (summary.bookings_awaiting_reply || 0) + (summary.work_offers_open || 0);
  // The denominator. `live_since` is the day the caller's oldest listing
  // went live; `since` is the day of the first recorded event, which is
  // not the same thing - a listing live since June with its first visitor
  // yesterday was "counting since yesterday", and one with no visitors at
  // all was "just switched on" six months in. The window in the LABEL is
  // the real one: a listing three days old shows "last 3 days", not a
  // month it never had. (2026-09-04 audit 2, the improvement.)
  const liveSince = [services?.live_since, listings?.live_since].filter(Boolean).sort()[0] || null;
  const ageDays = liveSince ? Math.max(1, Math.floor((Date.now() - new Date(liveSince).getTime()) / 86400000) + 1) : null;
  const windowDays = (period) => (ageDays ? Math.min(ageDays, period) : period);
  const notYet = t('overview.notCountingYet', 'Just switched on');
  const sinceLine = (since) => {
    if (since) return t('overview.since', { defaultValue: 'Counting since {{date}}', date: formatDate(since) });
    // No events at all: either brand new, or live a while and not visited.
    if (ageDays && ageDays > 1) return t('overview.noneYetSince', { defaultValue: 'None yet, live since {{date}}', date: formatDate(liveSince) });
    return notYet;
  };

  const pendingBookings = bookings.filter((b) => b.status === 'pending' && b.owner_id === user?.id).slice(0, 5);

  return (
    <div data-testid="overview-tab">
      {/* ── the four cards ─────────────────────────────────────────── */}
      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4 mb-6">
        <StatCard
          Icon={CalendarCheck}
          label={t('overview.waiting', 'Waiting on you')}
          value={waiting}
          sub={waiting === 0 ? t('overview.waitingNone', 'Nothing needs a reply') : t('overview.waitingSub', { defaultValue: '{{b}} bookings · {{o}} work offers', b: summary.bookings_awaiting_reply || 0, o: summary.work_offers_open || 0 })}
          testid="waiting"
          onClick={() => onGoToTab(summary.bookings_awaiting_reply ? 'bookings' : 'job-requests')}
          cta={t('overview.open', 'Open')}
        />
        <StatCard
          Icon={MessageCircle}
          label={t('overview.leads', { defaultValue: 'Leads, last {{n}} days', n: windowDays(leads?.days || 30) })}
          value={leads ? leads.period : 0}
          sub={leads ? (leads.since ? t('overview.allTime', { defaultValue: '{{n}} all time · counting since {{date}}', n: leads.total, date: formatDate(leads.since) }) : sinceLine(null)) : t('overview.leadsNa', 'Add a listing to start counting')}
          chart={leads?.since ? <div className="max-w-xs"><ScanChart daily={leads.daily} testidPrefix="overview-leads" /></div> : null}
          testid="leads"
        />
        <StatCard
          Icon={Eye}
          label={t('overview.visitorsN', { defaultValue: 'Visitors, last {{n}} days', n: windowDays(30) })}
          value={visitors ? visitors.period : 0}
          sub={visitors ? sinceLine(visitors.since) : t('overview.leadsNa', 'Add a listing to start counting')}
          chart={visitors?.since ? <div className="max-w-xs"><ScanChart daily={visitors.daily} testidPrefix="overview-visitors" /></div> : null}
          testid="visitors"
        />
        <StatCard
          Icon={QrCode}
          label={t('overview.scans', 'QR & link scans')}
          value={scans ? scans.total_scans : 0}
          sub={
            !scans ? '' : scans.links.length === 0
              ? t('overview.noLinks', 'No share links yet')
              : scans.total_scans === 0
                ? t('qr.scanned0', 'Not scanned yet')
                : t('overview.scansSub', { defaultValue: 'across {{n}} links', n: scans.links.length })
          }
          chart={scans && scans.total_scans > 0 ? <div className="max-w-xs"><ScanChart daily={scans.daily} testidPrefix="overview-scans" /></div> : null}
          testid="scans"
          onClick={isPropertyLister ? () => onGoToTab('properties') : showGigTabs ? () => onGoToTab('my-businesses') : undefined}
          cta={t('overview.share', 'Share')}
        />
      </div>

      {/* ── activity on the left, needs-attention on the right ────── */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 rounded-xl border p-5" style={{ borderColor: 'var(--brand-border)', background: 'var(--surface, #fff)' }} data-testid="overview-activity">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-base font-semibold" style={{ color: 'var(--ink)' }}>{t('overview.recent', 'Recent activity')}</h3>
          </div>

          {loaded && awaiting.length === 0 && pendingBookings.length === 0 && (
            <p className="text-sm" style={{ color: 'var(--brand-muted)' }} data-testid="overview-activity-empty">
              {t('overview.recentEmpty', 'Nothing new. When someone books, taps to message you, or scans your code, it shows up here.')}
            </p>
          )}

          <ul className="divide-y" style={{ borderColor: 'var(--brand-border)' }}>
            {awaiting.slice(0, 5).map((lead) => (
              <li key={lead.id} className="py-3 flex items-center gap-3" data-testid="overview-activity-lead">
                <span className="inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-lg" style={{ background: 'rgb(var(--brand-primary-rgb) / 0.10)', color: 'var(--brand-primary)' }}>
                  <MessageCircle size={15} aria-hidden="true" />
                </span>
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-medium truncate" style={{ color: 'var(--ink)' }}>
                    {t('overview.leadTapped', { defaultValue: 'Someone messaged you about {{gig}}', gig: lead.gig_title || t('overview.aListing', 'a listing') })}
                  </p>
                  <p className="text-xs" style={{ color: 'var(--brand-muted)' }}>{t('overview.unanswered', 'Not answered yet')} · {formatDate(lead.created_at)}</p>
                </div>
                <button type="button" onClick={() => onGoToTab('my-gigs')} className="text-xs font-semibold hover:underline" style={{ color: 'var(--brand-primary)' }}>
                  {t('overview.reply', 'Reply')}
                </button>
              </li>
            ))}
            {pendingBookings.map((b) => (
              <li key={b.id} className="py-3 flex items-center gap-3" data-testid="overview-activity-booking">
                <span className="inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-lg" style={{ background: 'var(--success-bg, #E3F3EA)', color: 'var(--success, #1F8A50)' }}>
                  <CalendarCheck size={15} aria-hidden="true" />
                </span>
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-medium truncate" style={{ color: 'var(--ink)' }}>
                    {t('overview.bookingPending', 'A booking request is waiting for your answer')}
                  </p>
                  <p className="text-xs" style={{ color: 'var(--brand-muted)' }}>{formatDate(b.created_at)}</p>
                </div>
                <button type="button" onClick={() => onGoToTab('bookings')} className="text-xs font-semibold hover:underline" style={{ color: 'var(--brand-primary)' }}>
                  {t('overview.open', 'Open')}
                </button>
              </li>
            ))}
          </ul>
        </div>

        <div className="rounded-xl border p-5" style={{ borderColor: 'var(--brand-border)', background: 'var(--surface, #fff)' }} data-testid="overview-attention">
          <h3 className="text-base font-semibold mb-3 flex items-center gap-2" style={{ color: 'var(--ink)' }}>
            <Bell size={16} aria-hidden="true" style={{ color: 'var(--brand-primary)' }} />
            {t('overview.attention', 'Needs your attention')}
          </h3>
          {(() => {
            const rows = [
              unreadMessages > 0 && { key: 'messages', tab: 'messages', text: t('dashboard.attentionMessages', '{{n}} unread messages', { n: unreadMessages }) },
              summary.bookings_awaiting_reply > 0 && { key: 'bookings', tab: 'bookings', text: t('dashboard.attentionBookings', '{{n}} bookings awaiting your reply', { n: summary.bookings_awaiting_reply }) },
              summary.requests_expiring_soon > 0 && { key: 'expiring', tab: 'my-requests', text: t('dashboard.attentionExpiring', '{{n}} requests expiring this week', { n: summary.requests_expiring_soon }) },
              summary.requests_with_responses > 0 && { key: 'responses', tab: 'my-requests', text: t('dashboard.attentionResponses', '{{n}} requests have replies', { n: summary.requests_with_responses }) },
              summary.work_offers_open > 0 && { key: 'offers', tab: 'job-requests', text: t('dashboard.attentionOffers', '{{n}} work offers you have not answered', { n: summary.work_offers_open }) },
            ].filter(Boolean);
            if (!rows.length) {
              return <p className="text-sm" style={{ color: 'var(--brand-muted)' }} data-testid="overview-attention-empty">{t('overview.attentionNone', 'All clear.')}</p>;
            }
            return (
              <ul className="space-y-2">
                {rows.map((r) => (
                  <li key={r.key}>
                    <button type="button" onClick={() => onGoToTab(r.tab)} className="w-full text-start text-sm font-medium rounded-lg px-3 py-2 hover:bg-[var(--surface-muted,#f9fafb)]" style={{ color: 'var(--brand-primary)' }} data-testid={`overview-attention-${r.key}`}>
                      {r.text}
                    </button>
                  </li>
                ))}
              </ul>
            );
          })()}
        </div>
      </div>
    </div>
  );
}
