import React, { useState, useEffect, useContext } from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import axios from 'axios';
import { Plus, Upload, Home, Sparkles } from 'lucide-react';
import { API, AuthContext } from '../App';

import ContractManager from '../components/ContractManager';
import BookingsList from '../components/dashboard/BookingsList';
import SettingsTab from '../components/dashboard/SettingsTab';
import SavedSearchesTab from '../components/dashboard/SavedSearchesTab';
import LikedTab from '../components/dashboard/LikedTab';
import SubleasesTab from '../components/dashboard/SubleasesTab';
import MyRequestsTab from '../components/dashboard/MyRequestsTab';
import PropertyList from '../components/dashboard/PropertyList';
import AddPropertyModal from '../components/dashboard/AddPropertyModal';
import BulkUploadModal from '../components/dashboard/BulkUploadModal';
import BulkManagerTab from '../components/dashboard/BulkManagerTab';
import MessagesTab from '../components/dashboard/MessagesTab';
import MyGigsTab from '../components/dashboard/MyGigsTab';
import MyBusinessesTab from '../components/dashboard/MyBusinessesTab';
import JobRequestsTab from '../components/dashboard/JobRequestsTab';
import MyJobsTab from '../components/dashboard/MyJobsTab';
import ManagerHeader from '../components/dashboard/ManagerHeader';
import DashboardTabs from '../components/dashboard/DashboardTabs';
import DashboardShell from '../components/ui/dashboard-shell';
import useDashboardNav, { ALL_TAB_IDS } from '../components/dashboard/useDashboardNav';
import OverviewTab from '../components/dashboard/OverviewTab';
import useIsWide from '../hooks/useIsWide';
import OnboardingProvider from '../components/onboarding/OnboardingProvider';
import TourProvider from '../components/tour/TourProvider';
import SetupChecklist from '../components/onboarding/SetupChecklist';
import ShowMeAroundOffer from '../components/onboarding/ShowMeAroundOffer';
import { useOnboarding } from '../components/onboarding/OnboardingProvider';
import AttentionStrip from '../components/dashboard/AttentionStrip';
import { canPublishGigs } from '../utils/providerTrial';

const Dashboard = () => {
  const { t } = useTranslation();
  const { user, token } = useContext(AuthContext);
  const [searchParams, setSearchParams] = useSearchParams();
  const navigate = useNavigate();
  const [properties, setProperties] = useState([]);
  // D3 — the My Jobs tab is gated on this. Fetched once here rather than
  // inside the tab strip, which is presentational and should not make
  // network calls to decide what to draw. A failure leaves the tab hidden,
  // which is the same state as "no jobs" and therefore safe.
  const [hasPostedJobs, setHasPostedJobs] = useState(false);
  // D4/D5 — one call feeding both the tab badges and the attention strip,
  // so the two can never show different numbers for the same fact.
  const [summary, setSummary] = useState({});
  // Show the service tabs to anyone who may publish OR who already owns a
  // service — an owner who added one had no way to manage it before.
  const showGigTabs = canPublishGigs(user) || (summary?.gigs_count || 0) > 0;
  const [bookings, setBookings] = useState([]);
  const [showAddProperty, setShowAddProperty] = useState(false);
  const [showBulkUpload, setShowBulkUpload] = useState(false);
  const [editingProperty, setEditingProperty] = useState(null);
  // The dashboard opens on the Overview for everyone. It used to open on
  // a list of properties (or gigs, or bookings, by role), which answers
  // "what do I have" when the question a person arrives with is "what
  // changed" - docs/dashboard-ux-spec.md, item 5.
  const [activeTab, setActiveTab] = useState('overview');
  // The setup checklist removes itself once complete; the offer that lived
  // inside its "complete" state - the one route to the feature library for
  // someone who has already taken the tour - is rendered here instead.
  const onboarding = useOnboarding();
  const setupLists = onboarding?.state?.checklists || [];
  const setupAllDone = setupLists.length > 0 && setupLists.every((l) => l.done === l.total);
  const [unreadConversations, setUnreadConversations] = useState(0);

  // One list for both renderers (spec: the tab and its panel drifted once).
  // Declared HERE, above the effects that read it: a const referenced by
  // something that runs earlier in the body is a temporal dead zone, and
  // this file's neighbours have been bitten by exactly that.
  const nav = useDashboardNav({ role: user?.role, user, unreadMessages: unreadConversations, hasPostedJobs, summary });

  // Land everyone on a tab they actually have.
  //
  // The default was always 'properties', with a renter-only correction. A
  // provider has no Properties tab at all (it's gated to owner / manager /
  // admin), so they opened their dashboard on a tab that isn't in their tab
  // bar and renders nothing — a blank page on the first screen after signup.
  //
  // Keyed off role rather than patching case by case, so a role added later
  // gets a deliberate answer instead of an empty panel.
  useEffect(() => {
    // Overview is the front page for every role now; nothing to redirect.
    if (!user) return;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user]);

  // Post-signup onboarding hook — when the auth callback lands an owner
  // here with `?welcome=1`, auto-open the AddPropertyModal so the very
  // first thing they see is "list your first property". We then strip
  // the flag from the URL to keep refresh-friendly behaviour (no popup
  // on every reload). Provider signups are handled by CreateGig.jsx.
  const welcomeParam = searchParams.get('welcome');
  useEffect(() => {
    if (welcomeParam === '1' && user?.role === 'owner') {
      setShowAddProperty(true);
      // Strip the flag from the URL without adding a history entry.
      const url = new URL(window.location.href);
      url.searchParams.delete('welcome');
      navigate(url.pathname + (url.search ? url.search : '') + url.hash, { replace: true });
    }
  }, [welcomeParam, user?.role, navigate]);

  const fetchUnreadConversations = async () => {
    if (!user) return;
    try {
      const res = await axios.get(`${API}/chat/conversations`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      setUnreadConversations((res.data || []).filter((c) => c.unread).length);
    } catch (err) {
      console.error('Failed to fetch conversations', err);
    }
  };

  const fetchProperties = async () => {
    if (!user) return;
    try {
      const res = await axios.get(`${API}/properties?owner_id=${user.id}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      setProperties(res.data);
    } catch (err) {
      console.error('Failed to fetch properties', err);
    }
  };

  const fetchBookings = async () => {
    try {
      const res = await axios.get(`${API}/bookings`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      setBookings(res.data);
    } catch (err) {
      console.error('Failed to fetch bookings', err);
    }
  };

  // Initial load whenever user identity changes
  useEffect(() => {
    if (user) {
      fetchProperties();
      fetchBookings();
      fetchUnreadConversations();
      // D3 — decides whether the "Jobs I've Posted" tab exists at all.
      // Silent on failure: no jobs and a failed fetch both mean "do not
      // show the tab", which is the safe direction to be wrong in.
      axios
        .get(`${API}/marketplace/my-jobs`, { headers: { Authorization: `Bearer ${token}` } })
        .then((r) => setHasPostedJobs((r.data || []).length > 0))
        .catch(() => {});
      // Silent on failure: no badges and no strip is the same as nothing
      // needing attention, and an error banner over a dashboard because a
      // COUNT failed would be worse than the missing count.
      axios
        .get(`${API}/dashboard/summary`, { headers: { Authorization: `Bearer ${token}` } })
        .then((r) => setSummary(r.data || {}))
        .catch(() => {});
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user]);

  // Poll unread conversations badge while on the dashboard
  useEffect(() => {
    if (!user) return;
    const interval = setInterval(fetchUnreadConversations, 20000);
    return () => clearInterval(interval);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user]);

  // Handle tab query parameter from notifications
  useEffect(() => {
    // A tab id from the URL is only honoured if it EXISTS. The owner
    // checklist linked to `my-properties` for months while the tab is
    // `properties`, and this line set it regardless - so the sidebar
    // highlighted nothing and the pane rendered empty, with no error.
    // An unknown id now falls back to the Overview, which is at least a
    // page. (Dead-ends audit 2026-09-04.)
    const tab = searchParams.get('tab');
    if (tab) setActiveTab(ALL_TAB_IDS.includes(tab) ? tab : 'overview');
    // `?edit=<property id>` means the properties tab whatever else the URL
    // says: the quarantine email and the availability nudge both send
    // people here to change one listing.
    if (searchParams.get('edit')) setActiveTab('properties');
    // Support the /dashboard/settings deep-link (used by notification
    // emails with ?section=notifications). Any path that ends in
    // /settings auto-selects the settings tab; NotificationSettings
    // itself reads ?section from the URL and scrolls into view.
    if (typeof window !== 'undefined' && window.location.pathname.endsWith('/dashboard/settings')) {
      setActiveTab('settings');
    }
  }, [searchParams]);

  // `?edit=<property id>` opens that listing's edit form once the list
  // has loaded, then leaves the URL so a reload or Cancel does not reopen
  // it. Two emails linked here for months and nothing read the param.
  useEffect(() => {
    const editId = searchParams.get('edit');
    if (!editId || !properties.length) return;
    const target = properties.find((p) => p.id === editId);
    if (target) {
      setEditingProperty(target);
      setShowAddProperty(true);
    }
    const next = new URLSearchParams(searchParams);
    next.delete('edit');
    setSearchParams(next, { replace: true });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [properties, searchParams]);

  // Refetch bookings whenever the user lands on the Bookings tab,
  // and whenever a notification deep-links here with a `highlight=` param.
  const highlightBookingId = searchParams.get('highlight');
  useEffect(() => {
    if (!user) return;
    if (activeTab === 'bookings') fetchBookings();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeTab, highlightBookingId, user]);

  // Keep Properties + Bulk-Manager live whenever the user re-enters either view
  useEffect(() => {
    if (!user) return;
    if (activeTab === 'properties' || activeTab === 'bulk-manager' || activeTab === 'overview') {
      fetchProperties();
      fetchBookings();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeTab, user]);

  // Refetch when the user returns to the tab (visibilitychange)
  useEffect(() => {
    if (!user) return;
    const onVisible = () => {
      if (document.visibilityState === 'visible') {
        fetchProperties();
        fetchBookings();
      }
    };
    document.addEventListener('visibilitychange', onVisible);
    return () => document.removeEventListener('visibilitychange', onVisible);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user]);

  const isRenter = user?.role === 'renter';
  const isOwnerLike = user && user.role !== 'renter';
  // The sidebar needs 256px it can spare; below that the tab strip stays.
  const isWide = useIsWide(1024);
  // Providers only interact with the marketplace (My Gigs). Hide all the
  // property-listing / contract / bulk-import UI from them so their
  // dashboard stays focused. Owner/manager/admin still see everything.
  const isPropertyLister = user && ['owner', 'manager', 'admin'].includes(user.role);

  return (
    /* Wraps the WHOLE dashboard, not just the checklist: the tips live
       deep inside the tab components, and the "only one on screen at a
       time" rule can only be enforced from a common ancestor. */
    <OnboardingProvider>
    {/* Inside OnboardingProvider, because the tour's entry points live in
        the onboarding surfaces and both need the same auth context. */}
    <TourProvider>
    <div className="min-h-screen" data-testid="dashboard-page">
      <div className="max-w-7xl mx-auto px-4 md:px-6 pt-36 sm:pt-28 md:pt-28 pb-12">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 sm:gap-4 mb-6 md:mb-8">
          {/* `var(--font-head)`, not the literal face: an inline
              'Playfair Display' beats the RTL variable swap, and Playfair
              has no Hebrew glyphs — so a Hebrew reader silently got a
              system serif. Fixed here because this heading was touched. */}
          <h1 className="text-2xl sm:text-3xl md:text-4xl font-bold" style={{ fontFamily: 'var(--font-head)' }}>
            {t('dashboard.title')}
          </h1>
          {isPropertyLister && (
            <div className="flex gap-2 justify-end sm:justify-start sm:w-auto">
              <button
                onClick={() => setShowBulkUpload(true)}
                className="secondary-btn flex items-center justify-center gap-1.5 sm:gap-2 whitespace-nowrap !px-3.5 sm:!px-8 !py-2 sm:!py-3 text-xs sm:text-sm"
                data-testid="bulk-upload-button"
              >
                <Upload size={14} className="sm:w-4 sm:h-4" />
                {t('dashboard.bulkUpload')}
              </button>
              <button
                onClick={() => {
                  setEditingProperty(null);
                  setShowAddProperty(true);
                }}
                className="primary-btn flex items-center justify-center gap-1.5 sm:gap-2 whitespace-nowrap !px-3.5 sm:!px-8 !py-2 sm:!py-3 text-xs sm:text-sm"
                data-testid="add-property-button"
                data-tour="add-property"
              >
                <Plus size={14} className="sm:w-[18px] sm:h-[18px]" />
                {t('dashboard.addProperty')}
              </button>
            </div>
          )}
          {isRenter && (
            <button
              onClick={() => setActiveTab('subleases')}
              className="primary-btn flex items-center justify-center gap-2 whitespace-nowrap w-full sm:w-auto"
              data-testid="sublease-property-button"
            >
              <Home size={18} />
              {t('dashboard.subleaseProperty')}
            </button>
          )}
        </div>

        {/* Manager-only — owners don't need a public manager page or
            business logo since they typically list a single property. */}
        {(user?.role === 'manager' || user?.role === 'admin') && (
          <ManagerHeader user={user} token={token} API={API} />
        )}

        {/* D6 — the share link used to live here, above the tabs, always
            open, showing a raw uuid, and rendered even with zero listings.
            It now sits at the bottom of My Properties (ShareListingsPanel),
            collapsed, and disappears entirely when there is nothing to
            share. The dashboard opens on the user's properties instead of
            on a URL. */}

        <AttentionStrip
          summary={summary}
          unreadMessages={unreadConversations}
          onGoToTab={setActiveTab}
        />

        {/* T7 — first dashboard load after signup. One quiet line, never a
            popup, and it competes for the same single slot as everything
            else so it cannot stack with a tip. */}
        <ShowMeAroundOffer moment="firstLogin" />

        {/* T1 — the backbone. Above the tabs because it is about the
            account as a whole, not about whichever tab is open. */}
        <SetupChecklist />
        {setupAllDone && (
          <div className="mb-6 text-sm">
            <ShowMeAroundOffer moment="complete" eligible={setupAllDone} inline />
          </div>
        )}

        {/* Wide screens get the sidebar; narrow ones keep the tab strip. Same
            groups, same badges, one source: useDashboardNav. */}
        <DashboardShell
          groups={isWide ? nav.groups : []}
          selected={activeTab}
          onSelect={setActiveTab}
          hideLabel={t('dashboard.hideSidebar', 'Hide')}
          className={isWide ? '' : 'hv-shell-narrow'}
          brand={(open) => (
            <div className="flex items-center gap-3 px-2 py-1">
              <span className="grid size-9 shrink-0 place-content-center rounded-lg text-sm font-bold" style={{ background: 'var(--action, #000)', color: 'var(--action-ink, #fff)' }} aria-hidden="true">
                {(user?.name || user?.email || '?').trim().charAt(0).toUpperCase()}
              </span>
              {open && (
                <span className="min-w-0">
                  <span className="block text-sm font-semibold truncate" style={{ color: 'var(--ink)' }}>{user?.name || user?.email}</span>
                  <span className="block text-xs truncate" style={{ color: 'var(--brand-muted)' }}>{t(`dashboard.role_${user?.role || 'renter'}`, user?.role || '')}</span>
                </span>
              )}
            </div>
          )}
        >
        {!isWide && (
          <DashboardTabs
            activeTab={activeTab}
            setActiveTab={setActiveTab}
            role={user?.role}
            user={user}
            unreadMessages={unreadConversations}
            hasPostedJobs={hasPostedJobs}
            summary={summary}
          />
        )}

        {activeTab === 'overview' && (
          <OverviewTab
            API={API}
            token={token}
            user={user}
            summary={summary}
            unreadMessages={unreadConversations}
            bookings={bookings}
            isPropertyLister={!!isPropertyLister}
            showGigTabs={showGigTabs}
            onGoToTab={setActiveTab}
          />
        )}

        {activeTab === 'contracts' && isPropertyLister && (
          <ContractManager properties={properties} />
        )}

        {activeTab === 'settings' && (
          <SettingsTab user={user} token={token} API={API} />
        )}

        {activeTab === 'alerts' && isRenter && (
          <SavedSearchesTab API={API} token={token} />
        )}

        {activeTab === 'liked' && <LikedTab API={API} token={token} />}

        {activeTab === 'my-requests' && (
          <MyRequestsTab API={API} token={token} />
        )}

        {activeTab === 'subleases' && isRenter && (
          <SubleasesTab API={API} token={token} />
        )}

        {activeTab === 'properties' && isPropertyLister && (
          <>
            <AddPropertyModal
              isOpen={showAddProperty}
              onClose={() => {
                setShowAddProperty(false);
                setEditingProperty(null);
              }}
              editingProperty={editingProperty}
              onSaved={fetchProperties}
              API={API}
              token={token}
            />
            <BulkUploadModal
              isOpen={showBulkUpload}
              onClose={() => setShowBulkUpload(false)}
              onDone={fetchProperties}
              API={API}
              token={token}
            />
            <PropertyList
              properties={properties}
              bookings={bookings}
              onEdit={(p) => {
                setEditingProperty(p);
                setShowAddProperty(true);
              }}
              onAddProperty={() => {
                setEditingProperty(null);
                setShowAddProperty(true);
              }}
              onRefresh={fetchProperties}
              ownerId={user?.id}
              API={API}
              token={token}
            />
          </>
        )}

        {activeTab === 'bulk-manager' && isPropertyLister && (
          <BulkManagerTab
            properties={properties}
            onRefresh={fetchProperties}
            API={API}
            token={token}
          />
        )}

        {activeTab === 'bookings' && (
          <BookingsList
            bookings={bookings}
            onUpdate={fetchBookings}
            user={user}
            token={token}
            API={API}
            highlightId={highlightBookingId}
          />
        )}

        {activeTab === 'messages' && (
          <MessagesTab API={API} token={token} onUnreadChange={setUnreadConversations} />
        )}

        {/* Same rule as the TAB in DashboardTabs — role OR ownership.
            These were gated on the role alone while the tab used its own
            check, which is exactly the drift providerTrial.js warns
            about: fixing only the tab would have shown a My Gigs button
            that rendered an empty panel. */}
        {activeTab === 'my-businesses' && showGigTabs && (
          <MyBusinessesTab API={API} token={token} />
        )}

        {activeTab === 'my-gigs' && showGigTabs && (
          <MyGigsTab API={API} token={token} />
        )}

        {activeTab === 'job-requests' && showGigTabs && (
          <JobRequestsTab API={API} token={token} />
        )}

        {activeTab === 'my-jobs' && (
          <MyJobsTab API={API} token={token} />
        )}
        </DashboardShell>
      </div>
    </div>
    </TourProvider>
    </OnboardingProvider>
  );
};

export default Dashboard;
