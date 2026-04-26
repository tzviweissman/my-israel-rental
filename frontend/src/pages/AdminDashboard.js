import React, { useState, useEffect, useContext } from 'react';
import axios from 'axios';
import { Eye, Home, Users, MessageCircle, FileText, Settings } from 'lucide-react';
import { API, AuthContext } from '../App';
import OverviewTab from '../components/admin/OverviewTab';
import ListingsTab from '../components/admin/ListingsTab';
import UsersTab from '../components/admin/UsersTab';
import ChatsTab from '../components/admin/ChatsTab';
import ServicesTab from '../components/admin/ServicesTab';
import SettingsTab from '../components/admin/SettingsTab';

const TABS = [
  { key: 'overview', label: 'Overview', icon: Eye },
  { key: 'listings', label: 'Listings', icon: Home },
  { key: 'users', label: 'Users', icon: Users },
  { key: 'chats', label: 'Chats', icon: MessageCircle },
  { key: 'services', label: 'Document Services', icon: FileText },
  { key: 'settings', label: 'Site Settings', icon: Settings },
];

/**
 * Super Admin Dashboard — top-level shell.
 * Owns:
 *  - the `dashboard` summary used by the loading gate + Overview tab
 *  - the `emailHealth` summary used by the Overview tab
 *  - the active-tab state
 *
 * Each tab is a self-contained component under /components/admin/ that owns
 * its own data fetching, state, and actions.
 */
const AdminDashboard = () => {
  const { token } = useContext(AuthContext);
  const [activeTab, setActiveTab] = useState('overview');
  const [dashboard, setDashboard] = useState(null);
  const [emailHealth, setEmailHealth] = useState(null);

  const headers = { Authorization: `Bearer ${token}` };

  const fetchDashboard = async () => {
    try {
      const res = await axios.get(`${API}/admin/dashboard`, { headers });
      setDashboard(res.data);
    } catch (e) { console.error(e); }
  };

  const fetchEmailHealth = async () => {
    try {
      const res = await axios.get(`${API}/admin/email-health`, { headers });
      setEmailHealth(res.data);
    } catch (e) { console.error(e); }
  };

  useEffect(() => {
    fetchDashboard();
    fetchEmailHealth();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  if (!dashboard) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="w-8 h-8 border-4 border-black border-t-transparent rounded-full animate-spin"></div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#fafafa]" data-testid="admin-dashboard-page">
      <div className="max-w-7xl mx-auto px-6 pt-20 pb-8">
        <h1 className="text-4xl font-bold mb-8" style={{ fontFamily: 'Playfair Display' }} data-testid="admin-title">
          Super Admin Dashboard
        </h1>

        {/* Tab navigation */}
        <div className="flex flex-wrap gap-2 mb-8 border-b border-[#E5E5E5] pb-4" data-testid="admin-tabs">
          {TABS.map(tab => {
            const Icon = tab.icon;
            return (
              <button
                key={tab.key}
                onClick={() => setActiveTab(tab.key)}
                className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-all ${activeTab === tab.key ? 'bg-black text-[#D4AF37]' : 'bg-white text-gray-700 border border-[#E5E5E5] hover:bg-gray-50'}`}
                data-testid={`admin-tab-${tab.key}`}
              >
                <Icon size={16} />
                {tab.label}
              </button>
            );
          })}
        </div>

        {activeTab === 'overview' && <OverviewTab dashboard={dashboard} emailHealth={emailHealth} />}
        {activeTab === 'listings' && <ListingsTab token={token} onStatsChange={fetchDashboard} />}
        {activeTab === 'users' && <UsersTab token={token} onStatsChange={fetchDashboard} />}
        {activeTab === 'chats' && <ChatsTab token={token} />}
        {activeTab === 'services' && <ServicesTab token={token} onStatsChange={fetchDashboard} />}
        {activeTab === 'settings' && <SettingsTab token={token} />}
      </div>
    </div>
  );
};

export default AdminDashboard;
