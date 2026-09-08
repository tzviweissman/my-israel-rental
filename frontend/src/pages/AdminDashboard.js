import React, { useState, useContext } from 'react';
import { useTranslation } from 'react-i18next';
import { Eye, Home, Users, MessageCircle, FileText, Settings, Upload, Sparkles, Calendar, Briefcase, MapPin, Mail, Flag } from 'lucide-react';
import { API, AuthContext } from '../App';
import { useApiSWR } from '../hooks/useApiSWR';
import { useAdminLiveEvents } from '../hooks/useAdminLiveEvents';
import OverviewTab from '../components/admin/OverviewTab';
import SiteQrPanel from '../components/admin/SiteQrPanel';
import ServicesTab from '../components/admin/ServicesTab';
import RequestReportsTab from '../components/admin/RequestReportsTab';
import AreaAliasManager from '../components/admin/AreaAliasManager';
import ListingsTab from '../components/admin/ListingsTab';
import UsersTab from '../components/admin/UsersTab';
import ChatsTab from '../components/admin/ChatsTab';
import SettingsTab from '../components/admin/SettingsTab';
import ImportTab from '../components/admin/ImportTab';
import SmartListsTab from '../components/admin/SmartListsTab';
import BookingsTab from '../components/admin/BookingsTab';
import EmailHealthTab from '../components/admin/EmailHealthTab';

/**
 * Grouped navigation (spec A2).
 *
 * Nine tabs in one wrapping pill row already broke down: on a phone they
 * took five rows before any content appeared, and Import and Smart Lists —
 * occasional tools — sat between tabs used daily.
 *
 * Grouped by what the thing IS, so a new tab has an obvious home rather
 * than being appended to the end of a row. Order is daily-use first,
 * tools and infrastructure last.
 *
 * Kept as a grouped LIST rather than a fixed left sidebar: the console is
 * used on a phone too, and a sidebar at 375px is a drawer, which is a
 * second navigation pattern to build and maintain. Groups solve the
 * finding problem; the layout stays one column that reflows.
 */
const TAB_GROUPS = [
  { group: null, items: [
    { key: 'overview', labelKey: 'admin.overview', icon: Eye },
  ] },
  { group: 'admin.groupSupply', items: [
    { key: 'listings', labelKey: 'admin.listings', icon: Home },
    { key: 'services', labelKey: 'admin.servicesTab', icon: Briefcase },
  ] },
  { group: 'admin.groupDemand', items: [
    { key: 'bookings', labelKey: 'admin.bookings', icon: Calendar },
    { key: 'chats', labelKey: 'admin.chats', icon: MessageCircle },
    // Dead-ends audit 2026-09-08 finding #1/#2: the attention queue's
    // "requests expiring" row, and the report queue underneath it, had no
    // tab to land on — this closes both at once.
    { key: 'requests', labelKey: 'admin.requestsTab', icon: Flag },
  ] },
  { group: 'admin.groupPeople', items: [
    { key: 'users', labelKey: 'admin.users', icon: Users },
  ] },
  { group: 'admin.groupTools', items: [
    { key: 'smart-lists', labelKey: 'admin.smartLists', icon: Sparkles },
    { key: 'import', labelKey: 'admin.import', icon: Upload },
    // Areas was reachable ONLY by scrolling to the bottom of Smart Lists,
    // which is not a place anyone would look for it. Canonical area
    // aliases are load-bearing for bilingual search, so it gets a name.
    { key: 'areas', labelKey: 'admin.areas', icon: MapPin },
  ] },
  { group: 'admin.groupSystem', items: [
    { key: 'settings', labelKey: 'admin.settings', icon: Settings },
    // A5 — deliverability is infrastructure. It used to sit on Overview
    // pushing the business numbers off the first screen; the exception
    // still surfaces there through the attention queue.
    { key: 'email-health', labelKey: 'admin.emailHealth', icon: Mail },
  ] },
];

// The closed set `navigate()` checks against, so an attention-queue row or
// KPI card that names a tab which doesn't exist falls back to Overview
// instead of setting state nothing matches (dead-ends audit 2026-09-08
// finding #1 — the same class of bug already fixed once for the owner
// dashboard's `?tab=` deep link).
const ADMIN_TAB_IDS = TAB_GROUPS.flatMap((g) => g.items).map((i) => i.key);

/**
 * Super Admin Dashboard — top-level shell.
 */
const AdminDashboard = () => {
  const { t } = useTranslation();
  const { token } = useContext(AuthContext);
  const [activeTab, setActiveTab] = useState('overview');
  // Optional search-term prefilter applied to the Users tab on mount.
  // Cleared after the Users tab consumes it, so re-clicking the Users
  // tab in the nav resets to a blank search.
  const [usersPrefilter, setUsersPrefilter] = useState('');
  // Same idea for Services: the attention queue's "no photo" / "not
  // verified" rows carry a filter so the destination can actually show
  // which N, not just the tab that contains them somewhere.
  const [servicesFilter, setServicesFilter] = useState(null);

  const navigate = (tab, filter) => {
    if (tab === 'services') setServicesFilter(filter || null);
    if (tab === 'users') setUsersPrefilter('');
    setActiveTab(ADMIN_TAB_IDS.includes(tab) ? tab : 'overview');
  };

  const { data: dashboard, refresh: fetchDashboard } = useApiSWR(
    `${API}/admin/dashboard`, token
  );

  useAdminLiveEvents(token);

  // Deep-link helper used by the Quick Add form's success chip — lets the
  // admin jump to the Users tab pre-filtered to the just-imported owner.
  const jumpToUser = (email) => {
    setUsersPrefilter(email || '');
    setActiveTab('users');
  };

  if (!dashboard) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="w-8 h-8 border-4 border-black border-t-transparent rounded-full animate-spin"></div>
      </div>
    );
  }

  return (
    <div className="min-h-screen" style={{ background: 'var(--bg)' }} data-testid="admin-dashboard-page">
      <div className="max-w-7xl mx-auto px-6 pt-20 pb-8">
        <h1 className="text-4xl font-bold mb-8" style={{ fontFamily: 'var(--font-head)' }} data-testid="admin-title">
          {t('admin.title')}
        </h1>

        {/* Tab navigation */}
        {/* On a phone the grouped pills cost 349px — seven rows of
            navigation before any content on an 812px screen, worse than
            the ungrouped row they replaced. A native picker gives the same
            grouping through <optgroup> in ONE row, and it is the control
            a phone already knows how to render full-screen. */}
        <div className="sm:hidden mb-6">
          <select
            value={activeTab}
            onChange={(e) => navigate(e.target.value)}
            className="w-full px-3 py-2.5 rounded-lg border bg-white text-sm font-medium"
            style={{ borderColor: 'var(--brand-border)', color: 'var(--ink)' }}
            data-testid="admin-tabs-mobile"
          >
            {TAB_GROUPS.map(({ group, items }) =>
              group ? (
                <optgroup key={group} label={t(group)}>
                  {items.map((tab) => (
                    <option key={tab.key} value={tab.key}>{t(tab.labelKey)}</option>
                  ))}
                </optgroup>
              ) : (
                items.map((tab) => (
                  <option key={tab.key} value={tab.key}>{t(tab.labelKey)}</option>
                ))
              ),
            )}
          </select>
        </div>

        <div className="hidden sm:flex flex-wrap items-center gap-x-4 gap-y-3 mb-8 border-b border-[var(--brand-border)] pb-4" data-testid="admin-tabs">
          {TAB_GROUPS.map(({ group, items }) => (
            <div key={group || 'root'} className="flex items-center gap-2 flex-wrap">
              {group && (
                <span
                  className="text-[10px] font-bold uppercase tracking-wider"
                  style={{ color: 'var(--brand-muted)' }}
                >
                  {t(group)}
                </span>
              )}
              {items.map((tab) => {
                const Icon = tab.icon;
                return (
                  <button
                    key={tab.key}
                    onClick={() => navigate(tab.key)}
                    className={`flex items-center gap-2 px-3 py-2 rounded-lg text-sm font-medium transition-all ${activeTab === tab.key ? 'bg-[var(--brand-primary)] text-white' : 'bg-white text-gray-700 border border-[var(--brand-border)] hover:bg-gray-50'}`}
                    data-testid={`admin-tab-${tab.key}`}
                  >
                    <Icon size={16} />
                    {t(tab.labelKey)}
                  </button>
                );
              })}
            </div>
          ))}
        </div>

        {activeTab === 'overview' && (
          <>
            <OverviewTab dashboard={dashboard} token={token} onNavigate={navigate} />
            {/* Codes for advertising the site itself — one per campaign,
                each with its own scan count. */}
            <SiteQrPanel API={API} token={token} />
          </>
        )}
        {activeTab === 'listings' && <ListingsTab token={token} onStatsChange={fetchDashboard} />}
        {activeTab === 'services' && <ServicesTab token={token} initialFilter={servicesFilter} />}
        {activeTab === 'requests' && <RequestReportsTab token={token} />}
        {activeTab === 'areas' && <AreaAliasManager token={token} />}
        {activeTab === 'bookings' && <BookingsTab token={token} />}
        {activeTab === 'users' && <UsersTab token={token} onStatsChange={fetchDashboard} prefilter={usersPrefilter} />}
        {activeTab === 'chats' && <ChatsTab token={token} />}
        {activeTab === 'smart-lists' && <SmartListsTab token={token} />}
        {activeTab === 'import' && <ImportTab token={token} onJumpToOwner={jumpToUser} />}
        {activeTab === 'settings' && <SettingsTab token={token} />}
        {activeTab === 'email-health' && <EmailHealthTab token={token} />}
      </div>
    </div>
  );
};

export default AdminDashboard;
