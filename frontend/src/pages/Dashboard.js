import React, { useState, useEffect, useContext } from 'react';
import { useSearchParams } from 'react-router-dom';
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
import PropertyList from '../components/dashboard/PropertyList';
import AddPropertyModal from '../components/dashboard/AddPropertyModal';
import BulkUploadModal from '../components/dashboard/BulkUploadModal';
import BulkManagerTab from '../components/dashboard/BulkManagerTab';
import MessagesTab from '../components/dashboard/MessagesTab';
import ManagerHeader from '../components/dashboard/ManagerHeader';
import DashboardTabs from '../components/dashboard/DashboardTabs';
import { DOCUMENT_SERVICES_ENABLED } from '../config/features';

const Dashboard = () => {
  const { t } = useTranslation();
  const { user, token } = useContext(AuthContext);
  const [searchParams] = useSearchParams();
  const [properties, setProperties] = useState([]);
  const [bookings, setBookings] = useState([]);
  const [showAddProperty, setShowAddProperty] = useState(false);
  const [showBulkUpload, setShowBulkUpload] = useState(false);
  const [editingProperty, setEditingProperty] = useState(null);
  const [activeTab, setActiveTab] = useState('properties');
  const [unreadConversations, setUnreadConversations] = useState(0);

  // Renters don't have a Properties tab — fall back to Bookings on first load.
  useEffect(() => {
    if (user?.role === 'renter' && activeTab === 'properties') {
      setActiveTab('bookings');
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user]);

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

  return (
    <div className="min-h-screen" data-testid="dashboard-page">
      <div className="max-w-7xl mx-auto px-4 md:px-6 pt-24 md:pt-28 pb-12">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 sm:gap-4 mb-6 md:mb-8">
          <h1 className="text-3xl md:text-4xl font-bold" style={{ fontFamily: 'Playfair Display' }}>
            {t('dashboard.title')}
          </h1>
          {isOwnerLike && (
            <div className="flex gap-2 w-full sm:w-auto">
              <button
                onClick={() => setShowBulkUpload(true)}
                className="secondary-btn flex flex-1 sm:flex-none items-center justify-center gap-2 whitespace-nowrap"
                data-testid="bulk-upload-button"
              >
                <Upload size={16} />
                {t('dashboard.bulkUpload')}
              </button>
              <button
                onClick={() => {
                  setEditingProperty(null);
                  setShowAddProperty(true);
                }}
                className="primary-btn flex flex-1 sm:flex-none items-center justify-center gap-2 whitespace-nowrap"
                data-testid="add-property-button"
              >
                <Plus size={18} />
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

        {isOwnerLike && <ManagerHeader user={user} token={token} API={API} />}

        {isRenter && !DOCUMENT_SERVICES_ENABLED && (
          <div
            className="mb-5 flex items-start gap-3 rounded-2xl border border-[#D4AF37]/30 bg-gradient-to-r from-[#fff8e6] to-[#fffaf0] px-5 py-3.5"
            data-testid="services-coming-soon-banner"
          >
            <div className="flex-shrink-0 w-8 h-8 rounded-full bg-[#D4AF37]/15 text-[#a37d10] flex items-center justify-center">
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
          unreadMessages={unreadConversations}
        />

        {activeTab === 'contracts' && isOwnerLike && (
          <ContractManager properties={properties} />
        )}

        {activeTab === 'settings' && (
          <SettingsTab user={user} token={token} API={API} />
        )}

        {activeTab === 'alerts' && isRenter && (
          <SavedSearchesTab API={API} token={token} />
        )}

        {activeTab === 'liked' && <LikedTab API={API} token={token} />}

        {activeTab === 'subleases' && isRenter && (
          <SubleasesTab API={API} token={token} />
        )}

        {activeTab === 'services' && isRenter && DOCUMENT_SERVICES_ENABLED && (
          <GovernmentServicesTab API={API} token={token} />
        )}

        {activeTab === 'properties' && isOwnerLike && (
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
              onRefresh={fetchProperties}
              API={API}
              token={token}
            />
          </>
        )}

        {activeTab === 'bulk-manager' && isOwnerLike && (
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
      </div>
    </div>
  );
};

export default Dashboard;
