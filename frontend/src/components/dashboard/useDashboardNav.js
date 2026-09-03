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
  LayoutDashboard, Building2, Layers, Store, Wrench, CalendarCheck, Inbox, Briefcase,
  Home, MessageCircle, Bell, Heart, KeyRound, FileText,
} from 'lucide-react';
import { canPublishGigs } from '../../utils/providerTrial';

export default function useDashboardNav({ role, user, unreadMessages = 0, hasPostedJobs = false, summary = {} }) {
  const { t } = useTranslation();
  const isRenter = role === 'renter';
  const isPropertyLister = ['owner', 'manager', 'admin'].includes(role);
  const canPublish = canPublishGigs(user);
  const hasGigs = (summary?.gigs_count || 0) > 0;
  const showGigTabs = canPublish || hasGigs;

  const groups = [
    {
      key: 'overview',
      tabs: [
        { id: 'overview', label: t('dashboard.overview', 'Overview'), Icon: LayoutDashboard, show: true },
      ],
    },
    {
      key: 'listings',
      label: t('dashboard.groupListings', 'Listings'),
      tabs: [
        { id: 'properties', label: t('dashboard.myProperties'), Icon: Building2, show: isPropertyLister },
        { id: 'bulk-manager', label: t('dashboard.bulkManager'), Icon: Layers, show: isPropertyLister },
        { id: 'my-businesses', label: t('dashboard.myBusinesses', 'Businesses'), Icon: Store, show: showGigTabs },
        { id: 'my-gigs', label: t('dashboard.myGigs'), Icon: Wrench, show: showGigTabs },
        { id: 'contracts', label: t('dashboard.contracts', 'Contracts'), Icon: FileText, show: isPropertyLister },
      ],
    },
    {
      key: 'activity',
      label: t('dashboard.groupActivity', 'Activity'),
      tabs: [
        { id: 'bookings', label: t('dashboard.myBookings'), Icon: CalendarCheck, badge: summary.bookings_awaiting_reply, show: true },
        { id: 'my-requests', label: t('dashboard.myRequests', 'My Requests'), Icon: Inbox, badge: summary.requests_with_responses, show: true },
        { id: 'my-jobs', label: t('dashboard.myJobs', "Jobs I've Posted"), Icon: Briefcase, show: showGigTabs || hasPostedJobs },
        { id: 'job-requests', label: t('dashboard.jobRequests', 'Work Offers'), Icon: Briefcase, badge: summary.work_offers_open, show: showGigTabs },
        { id: 'subleases', label: t('dashboard.subleases'), Icon: Home, show: isRenter },
      ],
    },
    {
      key: 'account',
      label: t('dashboard.groupAccount', 'Account'),
      tabs: [
        { id: 'messages', label: t('dashboard.messages'), Icon: MessageCircle, badge: unreadMessages, urgent: true, show: true },
        { id: 'alerts', label: t('dashboard.alerts'), Icon: Bell, show: isRenter },
        { id: 'liked', label: t('dashboard.liked'), Icon: Heart, show: true },
        { id: 'settings', label: t('dashboard.settings'), Icon: KeyRound, show: true },
      ],
    },
  ]
    .map((g) => ({ ...g, tabs: g.tabs.filter((tab) => tab.show) }))
    .filter((g) => g.tabs.length > 0);

  return { groups, isRenter, isPropertyLister, showGigTabs };
}
