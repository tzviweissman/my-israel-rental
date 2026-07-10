import React from 'react';
import { useTranslation } from 'react-i18next';
import { Layers, KeyRound, Home, Sparkles, Bell, Heart, MessageCircle, Briefcase } from 'lucide-react';
import { DOCUMENT_SERVICES_ENABLED } from '../../config/features';
import { canPublishGigs } from '../../utils/providerTrial';

/**
 * Horizontal tab navigation for the Dashboard. Pure presentational —
 * caller owns the active state and passes role to control visibility.
 */
const BASE =
  'flex-shrink-0 py-2.5 px-3 md:px-4 rounded-lg text-xs md:text-sm font-medium transition-all whitespace-nowrap';
const INACTIVE = 'text-gray-500 hover:text-gray-700';
const ACTIVE_TEAL = 'bg-white text-[#1E6A6A] shadow-sm';
const ACTIVE_GOLD = 'bg-white text-[#D4AF37] shadow-sm';
const ACTIVE_RED = 'bg-white text-red-500 shadow-sm';

const cls = (active, activeColor = ACTIVE_TEAL) =>
  `${BASE} ${active ? activeColor : INACTIVE}`;

const DashboardTabs = ({ activeTab, setActiveTab, role, user, unreadMessages = 0 }) => {
  const { t } = useTranslation();
  const isRenter = role === 'renter';
  // Property-listing tabs are hidden for pure service providers — they
  // only need bookings + messages + My Gigs.
  const isPropertyLister = ['owner', 'manager', 'admin'].includes(role);
  // My Gigs is unlocked for pure providers AND for anyone else (owner /
  // manager / renter / admin) who accepted the $0 provider trial from
  // the "Take Your Services to the Next Level" upsell modal.
  const canPublish = canPublishGigs(user);

  return (
    <div className="relative">
      {/* Mobile fade indicators */}
      <div className="absolute left-0 top-0 bottom-0 w-8 bg-gradient-to-r from-gray-100 to-transparent pointer-events-none z-10 md:hidden" />
      <div className="absolute right-0 top-0 bottom-0 w-8 bg-gradient-to-l from-gray-100 to-transparent pointer-events-none z-10 md:hidden" />

      <div
        className="flex gap-1 mb-6 bg-gray-100 rounded-xl p-1 overflow-x-auto scrollbar-hide"
        data-testid="dashboard-tabs"
      >
        {isPropertyLister && (
          <button
            onClick={() => setActiveTab('properties')}
            className={cls(activeTab === 'properties')}
            data-testid="tab-properties"
          >
            {t('dashboard.myProperties')}
          </button>
        )}

        {isPropertyLister && (
          <button
            onClick={() => setActiveTab('bulk-manager')}
            className={`${cls(activeTab === 'bulk-manager')} flex items-center justify-center gap-1.5`}
            data-testid="tab-bulk-manager"
          >
            <Layers size={14} />
            {t('dashboard.bulkManager')}
          </button>
        )}

        {canPublish && (
          <button
            onClick={() => setActiveTab('my-gigs')}
            className={`${cls(activeTab === 'my-gigs', ACTIVE_GOLD)} flex items-center justify-center gap-1.5`}
            data-testid="tab-my-gigs"
          >
            <Briefcase size={14} />
            {t('dashboard.myGigs', 'My Gigs')}
          </button>
        )}

        {canPublish && (
          <button
            onClick={() => setActiveTab('job-requests')}
            className={`${cls(activeTab === 'job-requests', ACTIVE_GOLD)} flex items-center justify-center gap-1.5`}
            data-testid="tab-job-requests"
          >
            <Briefcase size={14} />
            {t('dashboard.jobRequests', 'Job Requests')}
          </button>
        )}

        <button
          onClick={() => setActiveTab('bookings')}
          className={cls(activeTab === 'bookings')}
          data-testid="tab-bookings"
        >
          {t('dashboard.myBookings')}
        </button>

        {isRenter && (
          <button
            onClick={() => setActiveTab('subleases')}
            className={`${cls(activeTab === 'subleases')} flex items-center justify-center gap-1.5`}
            data-testid="tab-subleases"
          >
            <Home size={14} />
            {t('dashboard.subleases')}
          </button>
        )}

        <button
          onClick={() => setActiveTab('messages')}
          className={`${cls(activeTab === 'messages')} flex items-center justify-center gap-1.5 relative`}
          data-testid="tab-messages"
        >
          <MessageCircle size={14} />
          {t('dashboard.messages')}
          {unreadMessages > 0 && (
            <span
              className="ms-1 inline-flex items-center justify-center min-w-[18px] h-[18px] px-1 rounded-full bg-red-500 text-white text-[10px] font-bold leading-none"
              data-testid="messages-unread-badge"
            >
              {unreadMessages > 9 ? '9+' : unreadMessages}
            </span>
          )}
        </button>

        {isRenter && (
          <button
            onClick={() => setActiveTab('alerts')}
            className={`${cls(activeTab === 'alerts', ACTIVE_GOLD)} flex items-center justify-center gap-1.5`}
            data-testid="tab-alerts"
          >
            <Bell size={14} />
            {t('dashboard.alerts')}
          </button>
        )}

        <button
          onClick={() => setActiveTab('liked')}
          className={`${cls(activeTab === 'liked', ACTIVE_RED)} flex items-center justify-center gap-1.5`}
          data-testid="tab-liked"
        >
          <Heart size={14} />
          {t('dashboard.liked')}
        </button>

        {isRenter && DOCUMENT_SERVICES_ENABLED && (
          <button
            onClick={() => setActiveTab('services')}
            className={`${cls(activeTab === 'services', ACTIVE_GOLD)} flex items-center justify-center gap-1.5`}
            data-testid="tab-services"
          >
            <Sparkles size={14} />
            {t('dashboard.services')}
          </button>
        )}

        <button
          onClick={() => setActiveTab('settings')}
          className={`${cls(activeTab === 'settings')} flex items-center justify-center gap-1.5`}
          data-testid="tab-settings"
        >
          <KeyRound size={14} />
          {t('dashboard.settings')}
        </button>
      </div>
    </div>
  );
};

export default DashboardTabs;
