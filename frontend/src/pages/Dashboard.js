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
import GovernmentServicesTab from '../components/dashboard/GovernmentServicesTab';
import MyRequestsTab from '../components/dashboard/MyRequestsTab';
import PropertyList from '../components/dashboard/PropertyList';
import AddPropertyModal from '../components/dashboard/AddPropertyModal';
import BulkUploadModal from '../components/dashboard/BulkUploadModal';
import BulkManagerTab from '../components/dashboard/BulkManagerTab';
import MessagesTab from '../components/dashboard/MessagesTab';
import MyGigsTab from '../components/dashboard/MyGigsTab';
import JobRequestsTab from '../components/dashboard/JobRequestsTab';
import MyJobsTab from '../components/dashboard/MyJobsTab';
import ManagerHeader from '../components/dashboard/ManagerHeader';
import ShareListingsPanel from '../components/dashboard/ShareListingsPanel';
import DashboardTabs from '../components/dashboard/DashboardTabs';
import { canPublishGigs } from '../utils/providerTrial';
import { DOCUMENT_SERVICES_ENABLED } from '../config/features';

const Dashboard = () => {
  const { t } = useTranslation();
  const { user, token } = useContext(AuthContext);
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const [properties, setProperties] = useState([]);
  // D3 — the My Jobs tab is gated on this. Fetched once here rather than
  // inside the tab strip, which is presentational and should not make
  // network calls to decide what to draw. A failure leaves the tab hidden,
  // which is the same state as "no jobs" and therefore safe.
  const [hasPostedJobs, setHasPostedJobs] = useState(false);
  const [bookings, setBookings] = useState([]);
  const [showAddProperty, setShowAddProperty] = useState(false);
  const [showBulkUpload, setShowBulkUpload] = useState(false);
  const [editingProperty, setEditingProperty] = useState(null);
  const [activeTab, setActiveTab] = useState('properties');
  const [unreadConversations, setUnreadConversations] = useState(0);

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
    if (!user || activeTab !== 'properties') return;
    if (user.role === 'provider') setActiveTab('my-gigs');
    else if (user.role === 'renter') setActiveTab('bookings');
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
    const tab = searchParams.get('tab');
    if (tab) setActiveTab(tab);
    // Support the /dashboard/settings deep-link (used by notification
    // emails with ?section=notifications). Any path that ends in
    // /settings auto-selects the settings tab; NotificationSettings
    // itself reads ?section from the URL and scrolls into view.
    if (typeof window !== 'undefined' && window.location.pathname.endsWith('/dashboard/settings')) {
      setActiveTab('settings');
    }
  }, [searchParams]);

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
    if (activeTab === 'properties' || activeTab === 'bulk-manager') {
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
  // Providers only interact with the marketplace (My Gigs). Hide all the
  // property-listing / contract / bulk-import UI from them so their
  // dashboard stays focused. Owner/manager/admin still see everything.
  const isPropertyLister = user && ['owner', 'manager', 'admin'].includes(user.role);

  return (
    <div className="min-h-screen" data-testid="dashboard-page">
      <div className="max-w-7xl mx-auto px-4 md:px-6 pt-36 sm:pt-28 md:pt-28 pb-12">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 sm:gap-4 mb-6 md:mb-8">
          <h1 className="text-2xl sm:text-3xl md:text-4xl font-bold" style={{ fontFamily: 'Playfair Display' }}>
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

        {isRenter && !DOCUMENT_SERVICES_ENABLED && (
          <div
            className="mb-5 flex items-start gap-3 rounded-2xl border border-[rgb(var(--gold-rgb)/<alpha-value>)]/30 bg-gradient-to-r from-[#fff8e6] to-[#fffaf0] px-5 py-3.5"
            data-testid="services-coming-soon-banner"
          >
            <div className="flex-shrink-0 w-8 h-8 rounded-full bg-[rgb(var(--gold-rgb)/<alpha-value>)]/15 text-[#a37d10] flex items-center justify-center">
              <Sparkles size={16} />
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-semibold text-gray-900">Document filing services — launching soon</p>
              <p className="text-xs text-gray-600 mt-0.5">
                Bituach Leumi benefits, Arnona discount, apartment name change, and more. We'll handle the paperwork so you don't have to.
              </p>
            </div>
          </div>
        )}

        <DashboardTabs
          activeTab={activeTab}
          setActiveTab={setActiveTab}
          role={user?.role}
          user={user}
          unreadMessages={unreadConversations}
          hasPostedJobs={hasPostedJobs}
        />

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

        {activeTab === 'services' && isRenter && DOCUMENT_SERVICES_ENABLED && (
          <GovernmentServicesTab API={API} token={token} />
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
              API={API}
              token={token}
            />
            {/* D6 — below the listings, collapsed, and absent entirely when
                there are none. */}
            <ShareListingsPanel userId={user?.id} propertyCount={properties.length} />
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
          />
        )}

        {activeTab === 'messages' && (
          <MessagesTab API={API} token={token} onUnreadChange={setUnreadConversations} />
        )}

        {activeTab === 'my-gigs' && canPublishGigs(user) && (
          <MyGigsTab API={API} token={token} />
        )}

        {activeTab === 'job-requests' && canPublishGigs(user) && (
          <JobRequestsTab API={API} token={token} />
        )}

        {activeTab === 'my-jobs' && (
          <MyJobsTab API={API} token={token} />
        )}
      </div>
    </div>
  );
};

export default Dashboard;
