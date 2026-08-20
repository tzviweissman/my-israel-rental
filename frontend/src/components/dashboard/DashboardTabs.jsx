import React, { useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import {
  Layers, KeyRound, Home, Sparkles, Bell, Heart, MessageCircle, Briefcase,
  Inbox, MoreHorizontal, Store,
} from 'lucide-react';
import { canPublishGigs } from '../../utils/providerTrial';

/**
 * Horizontal tab navigation for the Dashboard. Pure presentational —
 * caller owns the active state and passes role to control visibility.
 *
 * The tabs are DATA now, not markup (spec D2/D9). They used to be sixteen
 * hand-written <button> blocks in a flat row, which is why they could not
 * be grouped, counted, or moved into an overflow without rewriting each
 * one. A list of descriptors gets all three for free, and adding a tab is
 * one row rather than a copied block.
 *
 * Three groups, in this order, with a thin divider between them:
 *   listings  — what the user is offering
 *   activity  — what is happening to them
 *   account   — the rest
 *
 * A divider only appears between two groups that BOTH have something in
 * them, so a renter (who has no listings group at all) does not get a rule
 * floating at the start of their strip.
 */
const BASE =
  'flex-shrink-0 py-2.5 px-3 md:px-4 rounded-lg text-xs md:text-sm font-medium transition-all whitespace-nowrap';
// D8 — the strip read as a grey admin panel bolted onto a limestone site.
// These are the brand's own colours now. The ink/muted pair also fixes a
// contrast problem nobody had measured: gray-500 on gray-100 is 4.0:1,
// under the 4.5 an inactive-but-readable label needs.
const INACTIVE = 'text-[var(--brand-muted)] hover:text-[var(--ink)]';
const ACTIVE_TEAL = 'bg-white text-[var(--brand-primary)] shadow-sm';
const ACTIVE_GOLD = 'bg-white text-[var(--gold)] shadow-sm';
const ACTIVE_RED = 'bg-white text-red-500 shadow-sm';

// D4 — a count that is merely information, in the brand blue. Red is kept
// for the one thing that is genuinely time-sensitive (unread messages),
// which is what makes red mean anything at all: four red badges teach a
// person to ignore red.
const BADGE_NEUTRAL = 'bg-[var(--brand-primary)] text-white';
const BADGE_URGENT = 'bg-red-500 text-white';

const cls = (active, activeColor = ACTIVE_TEAL) =>
  `${BASE} ${active ? activeColor : INACTIVE}`;

// D9 — on a phone the strip WRAPS instead of scrolling sideways.
//
// The spec asked for an overflow "More" menu, and I built one first. Then
// I measured: at 375px the strip is 710px of tabs in a 343px box, so
// folding the four account tabs still leaves five that do not fit. The
// menu moved the scroll bar without removing it, and put half the
// dashboard behind a click.
//
// Wrapping to two short rows shows every tab at once, which is what the
// spec actually wanted ("tabs beyond the fold are effectively invisible")
// and what Tzvi asked for in the same breath — everything reachable. It
// costs about 40px of height and hides nothing.
//
// The More menu is kept in the code for the case where a future role has
// enough tabs to justify it, but it is off unless that happens.
const MOBILE_TAB_LIMIT = 99;

const DashboardTabs = ({
  activeTab, setActiveTab, role, user, unreadMessages = 0, hasPostedJobs = false,
  summary = {},
}) => {
  const { t } = useTranslation();
  const isRenter = role === 'renter';
  // Property-listing tabs are hidden for pure service providers — they
  // only need bookings + messages + My Gigs.
  const isPropertyLister = ['owner', 'manager', 'admin'].includes(role);
  // My Gigs is unlocked for pure providers AND for anyone else (owner /
  // manager / renter / admin) who accepted the $0 provider trial from
  // the "Take Your Services to the Next Level" upsell modal.
  const canPublish = canPublishGigs(user);
  // ...but ALSO for anyone who simply has services, whatever their role.
  //
  // The role check alone was hiding people's own listings from them: an
  // owner who added a service could create it and then had no tab to
  // view, edit or delete it. Roles are not exclusive here — per CLAUDE.md
  // the site serves anyone with something to offer, and the multi-business
  // work assumes one person can be both a landlord and a plumber.
  //
  // Owning a gig is the honest test of whether this tab is useful to you.
  // It does not widen who may CREATE one — that is still the provider
  // check on the create path, untouched.
  const hasGigs = (summary?.gigs_count || 0) > 0;
  const showGigTabs = canPublish || hasGigs;

  const [moreOpen, setMoreOpen] = useState(false);
  const [isNarrow, setIsNarrow] = useState(false);
  const moreRef = useRef(null);

  // Width, not a media query in CSS, because the decision is about how many
  // tabs exist — which only JS knows — not about the viewport alone.
  useEffect(() => {
    const check = () => setIsNarrow(window.innerWidth < 640);
    check();
    window.addEventListener('resize', check);
    return () => window.removeEventListener('resize', check);
  }, []);

  useEffect(() => {
    if (!moreOpen) return undefined;
    const onDown = (e) => {
      if (moreRef.current && !moreRef.current.contains(e.target)) setMoreOpen(false);
    };
    const onKey = (e) => { if (e.key === 'Escape') setMoreOpen(false); };
    document.addEventListener('mousedown', onDown);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('mousedown', onDown);
      document.removeEventListener('keydown', onKey);
    };
  }, [moreOpen]);

  const GROUPS = [
    {
      key: 'listings',
      tabs: [
        { id: 'properties', label: t('dashboard.myProperties'), show: isPropertyLister },
        { id: 'bulk-manager', label: t('dashboard.bulkManager'), Icon: Layers, show: isPropertyLister },
        { id: 'my-businesses', label: t('dashboard.myBusinesses', 'Businesses'), Icon: Store, colour: ACTIVE_GOLD, show: showGigTabs },
        { id: 'my-gigs', label: t('dashboard.myGigs', 'My Gigs'), Icon: Briefcase, colour: ACTIVE_GOLD, show: showGigTabs },
      ],
    },
    {
      key: 'activity',
      tabs: [
        { id: 'bookings', label: t('dashboard.myBookings'), badge: summary.bookings_awaiting_reply, show: true },
        // Anyone can post a request — not a role-gated surface.
        { id: 'my-requests', label: t('dashboard.myRequests', 'My Requests'), Icon: Inbox, colour: ACTIVE_GOLD, badge: summary.requests_with_responses, show: true },
        // D3: only for someone who has actually posted a job, or who is
        // already publishing gigs. It used to render for everyone.
        { id: 'my-jobs', label: t('dashboard.myJobs', "Jobs I've Posted"), Icon: Briefcase, colour: ACTIVE_GOLD, show: showGigTabs || hasPostedJobs },
        { id: 'job-requests', label: t('dashboard.jobRequests', 'Work Offers'), Icon: Briefcase, colour: ACTIVE_GOLD, badge: summary.work_offers_open, show: showGigTabs },
        { id: 'subleases', label: t('dashboard.subleases'), Icon: Home, show: isRenter },
      ],
    },
    {
      key: 'account',
      tabs: [
        { id: 'messages', label: t('dashboard.messages'), Icon: MessageCircle, badge: unreadMessages, urgent: true, show: true },
        { id: 'alerts', label: t('dashboard.alerts'), Icon: Bell, colour: ACTIVE_GOLD, show: isRenter },
        { id: 'liked', label: t('dashboard.liked'), Icon: Heart, colour: ACTIVE_RED, show: true },
        { id: 'settings', label: t('dashboard.settings'), Icon: KeyRound, show: true },
      ],
    },
  ].map((g) => ({ ...g, tabs: g.tabs.filter((tab) => tab.show) }))
    .filter((g) => g.tabs.length > 0);

  const totalVisible = GROUPS.reduce((n, g) => n + g.tabs.length, 0);
  // Only fold when there is actually too much AND folding would help — an
  // overflow menu holding one item is worse than the item.
  const accountGroup = GROUPS.find((g) => g.key === 'account');
  const foldAccount = isNarrow && totalVisible > MOBILE_TAB_LIMIT && (accountGroup?.tabs.length || 0) > 1;
  const shownGroups = foldAccount ? GROUPS.filter((g) => g.key !== 'account') : GROUPS;
  const overflowTabs = foldAccount ? accountGroup.tabs : [];

  const renderTab = (tab) => (
    <button
      key={tab.id}
      onClick={() => setActiveTab(tab.id)}
      className={`${cls(activeTab === tab.id, tab.colour)} ${tab.Icon || tab.badge ? 'flex items-center justify-center gap-1.5 relative' : ''}`}
      data-testid={`tab-${tab.id}`}
    >
      {tab.Icon && <tab.Icon size={14} />}
      {tab.label}
      {tab.badge > 0 && (
        <span
          className={`ms-1 inline-flex items-center justify-center min-w-[18px] h-[18px] px-1 rounded-full text-[10px] font-bold leading-none ${tab.urgent ? BADGE_URGENT : BADGE_NEUTRAL}`}
          data-testid={tab.id === 'messages' ? 'messages-unread-badge' : `tab-badge-${tab.id}`}
        >
          {tab.badge > 9 ? '9+' : tab.badge}
        </span>
      )}
    </button>
  );

  return (
    <div className="relative">
      {/* The fade masks used to sit here, hinting at content off the edge.
          Nothing scrolls off the edge on a phone any more — the strip wraps
          — so a fade would be pointing at nothing. */}

      <div
        className="flex flex-wrap lg:flex-nowrap gap-1 mb-6 rounded-xl p-1 lg:overflow-x-auto scrollbar-hide"
        style={{ background: 'rgb(var(--brand-primary-rgb) / 0.05)' }}
        data-testid="dashboard-tabs"
      >
        {shownGroups.map((group, i) => (
          <React.Fragment key={group.key}>
            {i > 0 && (
              // A hairline, not a gap: the groups have to read as one strip
              // with seams, or the dashboard grows three separate toolbars.
              <span
                aria-hidden="true"
                className="hidden lg:block self-center mx-1 h-5 w-px flex-shrink-0"
                style={{ background: 'var(--brand-border)' }}
                data-testid={`tab-divider-${group.key}`}
              />
            )}
            {group.tabs.map(renderTab)}
          </React.Fragment>
        ))}

        {foldAccount && (
          <div className="relative flex-shrink-0" ref={moreRef}>
            <button
              type="button"
              onClick={() => setMoreOpen((o) => !o)}
              aria-expanded={moreOpen}
              aria-haspopup="menu"
              className={`${cls(overflowTabs.some((tab) => tab.id === activeTab))} flex items-center justify-center gap-1.5`}
              data-testid="tab-more"
            >
              <MoreHorizontal size={14} />
              {t('dashboard.more', 'More')}
              {unreadMessages > 0 && (
                <span
                  className="ms-1 inline-flex items-center justify-center min-w-[18px] h-[18px] px-1 rounded-full bg-red-500 text-white text-[10px] font-bold leading-none"
                  data-testid="more-unread-badge"
                >
                  {unreadMessages > 9 ? '9+' : unreadMessages}
                </span>
              )}
            </button>
            {moreOpen && (
              <div
                role="menu"
                className="absolute z-30 mt-1 end-0 min-w-[190px] rounded-xl border bg-white py-1 shadow-lg"
                style={{ borderColor: 'var(--brand-border)' }}
                data-testid="tab-more-menu"
              >
                {overflowTabs.map((tab) => (
                  <button
                    key={tab.id}
                    role="menuitem"
                    type="button"
                    onClick={() => { setActiveTab(tab.id); setMoreOpen(false); }}
                    className="flex w-full items-center gap-2 px-3.5 py-2.5 text-start text-sm"
                    style={{ color: activeTab === tab.id ? 'var(--brand-primary)' : 'var(--ink)' }}
                    data-testid={`tab-more-${tab.id}`}
                  >
                    {tab.Icon && <tab.Icon size={14} aria-hidden="true" />}
                    <span className="flex-1">{tab.label}</span>
                    {tab.badge > 0 && (
                      <span className="inline-flex items-center justify-center min-w-[18px] h-[18px] px-1 rounded-full bg-red-500 text-white text-[10px] font-bold leading-none">
                        {tab.badge > 9 ? '9+' : tab.badge}
                      </span>
                    )}
                  </button>
                ))}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
};

export default DashboardTabs;
