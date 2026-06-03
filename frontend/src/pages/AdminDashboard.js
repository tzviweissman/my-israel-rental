import React, { useState, useContext } from 'react';
import { useTranslation } from 'react-i18next';
import { Eye, Home, Users, MessageCircle, FileText, Settings, Upload, Sparkles } from 'lucide-react';
import { API, AuthContext } from '../App';
import { useApiSWR } from '../hooks/useApiSWR';
import { useAdminLiveEvents } from '../hooks/useAdminLiveEvents';
import OverviewTab from '../components/admin/OverviewTab';
import ListingsTab from '../components/admin/ListingsTab';
import UsersTab from '../components/admin/UsersTab';
import ChatsTab from '../components/admin/ChatsTab';
import ServicesTab from '../components/admin/ServicesTab';
import SettingsTab from '../components/admin/SettingsTab';
import ImportTab from '../components/admin/ImportTab';
import SmartListsTab from '../components/admin/SmartListsTab';
import { DOCUMENT_SERVICES_ENABLED } from '../config/features';

const TAB_KEYS = [
  { key: 'overview', labelKey: 'admin.overview', icon: Eye },
  { key: 'listings', labelKey: 'admin.listings', icon: Home },
  { key: 'users', labelKey: 'admin.users', icon: Users },
  { key: 'chats', labelKey: 'admin.chats', icon: MessageCircle },
  { key: 'smart-lists', labelKey: 'admin.smartLists', icon: Sparkles },
  { key: 'import', labelKey: 'admin.import', icon: Upload },
  ...(DOCUMENT_SERVICES_ENABLED ? [{ key: 'services', labelKey: 'admin.services', icon: FileText }] : []),
  { key: 'settings', labelKey: 'admin.settings', icon: Settings },
];

/**
 * Super Admin Dashboard — top-level shell.
 */
const AdminDashboard = () => {
  const { t } = useTranslation();
  const { token } = useContext(AuthContext);
  const [activeTab, setActiveTab] = useState('overview');

  const { data: dashboard, refresh: fetchDashboard } = useApiSWR(
    `${API}/admin/dashboard`, token
  );
  const { data: emailHealth } = useApiSWR(`${API}/admin/email-health`, token);

  useAdminLiveEvents(token);

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
          {t('admin.title')}
        </h1>

        {/* Tab navigation */}
        <div className="flex flex-wrap gap-2 mb-8 border-b border-[#E5E5E5] pb-4" data-testid="admin-tabs">
          {TAB_KEYS.map(tab => {
            const Icon = tab.icon;
            return (
              <button
                key={tab.key}
                onClick={() => setActiveTab(tab.key)}
                className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-all ${activeTab === tab.key ? 'bg-black text-[#D4AF37]' : 'bg-white text-gray-700 border border-[#E5E5E5] hover:bg-gray-50'}`}
                data-testid={`admin-tab-${tab.key}`}
              >
                <Icon size={16} />
                {t(tab.labelKey)}
              </button>
            );
          })}
        </div>

        {activeTab === 'overview' && <OverviewTab dashboard={dashboard} emailHealth={emailHealth} token={token} />}
        {activeTab === 'listings' && <ListingsTab token={token} onStatsChange={fetchDashboard} />}
        {activeTab === 'users' && <UsersTab token={token} onStatsChange={fetchDashboard} />}
        {activeTab === 'chats' && <ChatsTab token={token} />}
        {activeTab === 'smart-lists' && <SmartListsTab token={token} />}
        {activeTab === 'import' && <ImportTab token={token} />}
        {activeTab === 'services' && DOCUMENT_SERVICES_ENABLED && <ServicesTab token={token} onStatsChange={fetchDashboard} />}
        {activeTab === 'settings' && <SettingsTab token={token} />}
      </div>
    </div>
  );
};

export default AdminDashboard;
