/**
 * useDashboardNav — the dashboard's navigation, as data.
 *
 * ONE list, read by two renderers: the sidebar on wide screens and the tab
 * strip on narrow ones. Before this the groups lived inside DashboardTabs,
 * and giving the desktop a sidebar would have meant a second copy of the
 * role gating, the badge wiring and the labels — which is how the tab and
 * its panel drifted apart once already (see the note on My Gigs in
 * Dashboard.js). Two renderers of one list cannot disagree about what
 * exists.
 *
 * Everything below is lifted verbatim from DashboardTabs: the role checks,
 * the `showGigTabs` rule, the badge sources, the order. Only the Overview
 * entry is new. It is first because it is the page the dashboard should
 * open on (docs/dashboard-ux-spec.md, "nothing summarises what needs
 * attention"), and it is shown to every role because every role has
 * something to keep track of, even if for a renter that is only bookings
 * and replies.
 */
import { useTranslation } from 'react-i18next';
import {
  LayoutDashboard, Building2, Layers, Store, CalendarCheck, CalendarClock, Inbox, Briefcase, ClipboardList, Bike, ShoppingBag,
  Home, MessageCircle, Bell, Heart, KeyRound, FileText, Network, Users, SlidersHorizontal, Contact, TicketPercent, BarChart3, UserCog, DoorOpen,
} from 'lucide-react';
import { canPublishGigs } from '../../utils/providerTrial';

export default function useDashboardNav({ role, user, unreadMessages = 0, hasPostedJobs = false, summary = {} }) {
  const { t } = useTranslation();
  const isRenter = role === 'renter';
  const isPropertyLister = ['owner', 'manager', 'admin'].includes(role);
  const canPublish = canPublishGigs(user);
  const hasGigs = (summary?.gigs_count || 0) > 0;
  const showGigTabs = canPublish || hasGigs;

  // Grouped by what the person RUNS, not by type of record (Tzvi, 22 Sep
  // 2026: "we need to make the dashboard workflow easier to use"). Each
  // section shows only to people it applies to, and an item that can be
  // either side (bookings, appointments, jobs) sits in exactly one place:
  // with the business or rentals when the person runs one, otherwise
  // under what they ordered. "My gigs" is gone as a separate item: a
  // business's services are inside it, in Businesses.
  const runsRentals = isPropertyLister;
  // The same rule Dashboard.js renders these panels on; a looser one here
  // would show menu items that open an empty page.
  const runsBusiness = showGigTabs;
  // Which business tools this person uses, by what the business sells
  // and their own choices (backend utils/business_tools.py, Tzvi 14 Oct
  // 2026). Until the summary arrives, everything shows, as before.
  const tool = (id) => runsBusiness && (!summary.business_tools || !!summary.business_tools[id]);
  // Areas this person has as staff at someone else's business (backend
  // routes/marketplace/staff.py): shown whether or not they run one.
  const staff = (area) => (summary.staff_permissions || []).includes(area);
  const groups = [
    {
      key: 'overview',
      tabs: [
        { id: 'overview', label: t('dashboard.overview', 'Overview'), Icon: LayoutDashboard, show: true },
      ],
    },
    {
      key: 'business',
      label: t('dashboard.groupBusiness', 'My business'),
      tabs: [
        { id: 'my-businesses', label: t('dashboard.myBusinesses', 'Businesses'), Icon: Store, show: runsBusiness },
        // Every business has customers, whatever it sells: not a tool to switch.
        { id: 'summary', label: t('dashboard.summary', 'Sales summary'), Icon: BarChart3, show: runsBusiness || staff('summary') },
        { id: 'customers', label: t('dashboard.customers', 'Customers'), Icon: Contact, show: runsBusiness || staff('customers') },
        { id: 'discounts', label: t('dashboard.discounts', 'Discounts'), Icon: TicketPercent, show: tool('orders') || tool('members') || staff('discounts') },
        { id: 'staff', label: t('dashboard.staff', 'Staff'), Icon: UserCog, show: runsBusiness },
        { id: 'orders', label: t('dashboard.orders', 'Orders'), Icon: ClipboardList, show: tool('orders') || staff('orders') },
        { id: 'members', label: t('dashboard.members', 'Members'), Icon: Users, show: tool('members') || staff('members') },
        // Staff who only check members in (backend business_access.py "checkin").
        { id: 'checkin', label: t('dashboard.checkin', 'Check-in'), Icon: DoorOpen, show: staff('checkin') },
        // Waiting appointments or network requests always show: a badge
        // nobody can see is a customer nobody answers.
        { id: 'appointments', label: t('dashboard.appointments', 'Appointments'), Icon: CalendarClock, badge: summary.service_bookings_pending, show: tool('appointments') || (runsBusiness && (summary.service_bookings_pending || 0) > 0) },
        { id: 'network', label: t('dashboard.network', 'Network'), Icon: Network, badge: summary.network_requests_in, show: tool('network') || (summary.network_requests_in || 0) > 0 },
        { id: 'job-requests', label: t('dashboard.jobRequests', 'Work Offers'), Icon: Briefcase, badge: summary.work_offers_open, show: tool('job-requests') },
        { id: 'my-jobs', label: t('dashboard.myJobs', "Jobs I've Posted"), Icon: Briefcase, show: runsBusiness && (hasPostedJobs || !summary.business_tools) },
        { id: 'tools', label: t('dashboard.tools', 'Tools'), Icon: SlidersHorizontal, show: runsBusiness },
        // A courier's own deliveries: shown to anyone a business invited.
        { id: 'deliveries', label: t('dashboard.deliveries', 'Deliveries'), Icon: Bike, badge: (summary.courier_deliveries_open || 0) + (summary.courier_invites || 0), show: (summary.courier_businesses || 0) > 0 || (summary.courier_invites || 0) > 0 },
      ],
    },
    {
      key: 'rentals',
      label: t('dashboard.groupRentals', 'My rentals'),
      tabs: [
        { id: 'properties', label: t('dashboard.myProperties'), Icon: Building2, show: runsRentals },
        { id: 'bookings', label: t('dashboard.rentalBookings', 'Bookings'), Icon: CalendarCheck, badge: summary.bookings_awaiting_reply, show: runsRentals },
        { id: 'bulk-manager', label: t('dashboard.bulkManager'), Icon: Layers, show: runsRentals },
        { id: 'contracts', label: t('dashboard.contracts', 'Contracts'), Icon: FileText, show: runsRentals },
      ],
    },
    {
      key: 'mine',
      label: t('dashboard.groupMine', 'What I ordered'),
      tabs: [
        // A renter's side of the same tabs, when the person runs nothing
        // that would already show them above.
        { id: 'bookings', label: t('dashboard.myBookings'), Icon: CalendarCheck, show: !runsRentals && (isRenter || (summary.my_rental_bookings || 0) > 0) },
        { id: 'appointments', label: t('dashboard.appointments', 'Appointments'), Icon: CalendarClock, show: !runsBusiness && (summary.my_service_bookings || 0) > 0 },
        { id: 'my-orders', label: t('dashboard.myOrders', 'My orders'), Icon: ShoppingBag, show: (summary.customer_orders || 0) > 0 },
        { id: 'my-requests', label: t('dashboard.myRequests', 'My Requests'), Icon: Inbox, badge: summary.requests_with_responses, show: true },
        { id: 'my-jobs', label: t('dashboard.myJobs', "Jobs I've Posted"), Icon: Briefcase, show: !runsBusiness && hasPostedJobs },
        { id: 'subleases', label: t('dashboard.subleases'), Icon: Home, show: isRenter },
        // Saved searches and liked homes are for someone looking for a
        // place. A business or owner sees them only if they have used them,
        // so nothing anyone saved disappears.
        { id: 'alerts', label: t('dashboard.alerts'), Icon: Bell, show: isRenter || !!summary.has_saved_searches },
        { id: 'liked', label: t('dashboard.liked'), Icon: Heart, show: isRenter || !!summary.has_liked },
      ],
    },
    {
      key: 'account',
      label: t('dashboard.groupAccount', 'Account'),
      tabs: [
        { id: 'messages', label: t('dashboard.messages'), Icon: MessageCircle, badge: unreadMessages, urgent: true, show: true },
        { id: 'settings', label: t('dashboard.settings'), Icon: KeyRound, show: true },
      ],
    },
  ]
    .map((g) => ({ ...g, tabs: g.tabs.filter((tab) => tab.show) }))
    .filter((g) => g.tabs.length > 0);

  const ids = groups.flatMap((g) => g.tabs.map((t) => t.id));
  return { groups, ids, isRenter, isPropertyLister, showGigTabs };
}

/**
 * EVERY tab id this hook can produce, for any role. Used to validate a
 * `?tab=` deep link: the owner checklist pointed at `my-properties` for
 * months while the tab is `properties`, and the dashboard set whatever
 * the URL said, so the pane rendered empty (dead-ends audit 2026-09-04).
 *
 * Deliberately the FULL set, not the ids visible right now: the role
 * gating depends on `summary`, which arrives a moment after the first
 * render, so validating against the visible subset would bounce a
 * perfectly good link to the Overview and never come back.
 */
export const ALL_TAB_IDS = [
  'overview',
  'properties',
  'bulk-manager',
  'my-businesses',
  'my-gigs',
  'contracts',
  'bookings',
  'appointments',
  'orders',
  'members',
  'tools',
  'customers',
  'discounts',
  'summary',
  'staff',
  'checkin',
  'network',
  'deliveries',
  'my-orders',
  'my-requests',
  'my-jobs',
  'job-requests',
  'subleases',
  'messages',
  'alerts',
  'liked',
  'settings',
];
