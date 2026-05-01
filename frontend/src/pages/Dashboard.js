import React, { useState, useEffect, useContext } from 'react';
import { useSearchParams } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import axios from 'axios';
import { Plus, Upload, Home } from 'lucide-react';
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
    }
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
      <div className="max-w-7xl mx-auto px-6 pt-28 pb-12">
        <div className="flex items-center justify-between mb-8">
          <h1 className="text-4xl font-bold" style={{ fontFamily: 'Playfair Display' }}>
            Dashboard
          </h1>
          {isOwnerLike && (
            <div className="flex gap-2">
              <button
                onClick={() => setShowBulkUpload(true)}
                className="secondary-btn flex items-center gap-2"
                data-testid="bulk-upload-button"
              >
                <Upload size={18} />
                Bulk Upload
              </button>
              <button
                onClick={() => {
                  setEditingProperty(null);
                  setShowAddProperty(true);
                }}
                className="primary-btn flex items-center gap-2"
                data-testid="add-property-button"
              >
                <Plus size={20} />
                {t('dashboard.addProperty')}
              </button>
            </div>
          )}
          {isRenter && (
            <button
              onClick={() => setActiveTab('subleases')}
              className="primary-btn flex items-center gap-2"
              data-testid="sublease-property-button"
            >
              <Home size={20} />
              Sublease Property
            </button>
          )}
        </div>

        {isOwnerLike && <ManagerHeader user={user} token={token} API={API} />}

        <DashboardTabs activeTab={activeTab} setActiveTab={setActiveTab} role={user?.role} />

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

        {activeTab === 'services' && isRenter && (
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
          <MessagesTab API={API} token={token} />
        )}
      </div>
    </div>
  );
};

export default Dashboard;
