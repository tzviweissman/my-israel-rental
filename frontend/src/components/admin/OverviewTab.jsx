import React from 'react';
import { useTranslation } from 'react-i18next';
import { Home, Eye, FileText, Users, MessageCircle, Mail, CheckCircle, AlertTriangle, Ban, Calendar } from 'lucide-react';

/**
 * Super Admin → Overview tab. Pure presentational; the parent owns the
 * `dashboard` and `emailHealth` fetches because the parent already needs
 * `dashboard` for its initial loading-spinner gate.
 *
 * The Bookings stat card is clickable — it jumps the admin to the new
 * dedicated Bookings tab via the parent-provided ``onNavigate`` callback,
 * matching the pattern other dashboards use for drill-down. Non-clickable
 * cards just render as plain divs so a misclick on Total Views doesn't
 * navigate anywhere.
 */
export const OverviewTab = ({ dashboard, emailHealth, token, onNavigate }) => {
  const { t } = useTranslation();
  return (
    <div data-testid="admin-overview-section">
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-6 gap-4 mb-10">
        {[
          { label: t('admin.activeListings'), key: 'active-listings', value: dashboard.active_listings, icon: Home },
          { label: t('admin.totalViews'), key: 'total-views', value: dashboard.total_views, icon: Eye },
          { label: t('admin.inquiries'), key: 'inquiries', value: dashboard.total_inquiries, icon: FileText },
          { label: t('admin.totalUsers'), key: 'total-users', value: dashboard.total_users, icon: Users },
          // Clickable — drills into the dedicated Bookings tab. The new
          // card sits *next to* Total Users as the user explicitly asked.
          {
            label: t('admin.totalBookings', 'Total Bookings'),
            key: 'total-bookings',
            value: dashboard.total_bookings ?? dashboard.total_inquiries ?? 0,
            icon: Calendar,
            onClick: () => onNavigate && onNavigate('bookings'),
          },
        ].map(stat => {
          const Icon = stat.icon;
          const clickable = !!stat.onClick;
          return (
            <button
              type={clickable ? 'button' : undefined}
              key={stat.key}
              onClick={stat.onClick}
              disabled={!clickable}
              className={`bg-white p-5 rounded-xl border border-[#E5E5E5] text-left w-full ${
                clickable ? 'cursor-pointer hover:border-[var(--gold)] hover:shadow-md transition-all' : 'cursor-default'
              }`}
              data-testid={`stat-${stat.key}`}
            >
              <div className="flex items-center gap-3">
                <div className="p-2 rounded-lg" style={{ backgroundColor: 'var(--brand-primary)' }}>
                  <Icon size={18} color="var(--gold)" />
                </div>
                <div>
                  <p className="text-2xl font-bold">{stat.value}</p>
                  <p className="text-xs text-gray-500">{stat.label}</p>
                </div>
              </div>
            </button>
          );
        })}
      </div>

      <h2 className="text-xl font-bold mb-4" style={{ fontFamily: 'Playfair Display' }}>{t('admin.recentListings')}</h2>
      <div className="bg-white rounded-xl border border-[#E5E5E5] overflow-hidden">
        <table className="w-full">
          <thead className="bg-gray-50">
            <tr>
              <th className="px-5 py-3 text-left text-xs font-semibold text-gray-600 uppercase">{t('admin.colTitle')}</th>
              <th className="px-5 py-3 text-left text-xs font-semibold text-gray-600 uppercase">{t('admin.colArea')}</th>
              <th className="px-5 py-3 text-left text-xs font-semibold text-gray-600 uppercase">{t('admin.colType')}</th>
              <th className="px-5 py-3 text-left text-xs font-semibold text-gray-600 uppercase">{t('admin.colPrice')}</th>
              <th className="px-5 py-3 text-left text-xs font-semibold text-gray-600 uppercase">{t('admin.colViews')}</th>
            </tr>
          </thead>
          <tbody>
            {dashboard.recent_properties.map(p => (
              <tr key={p.id} className="border-t border-[#E5E5E5] hover:bg-gray-50" data-testid={`overview-property-${p.id}`}>
                <td className="px-5 py-3 font-medium text-sm">{p.title}</td>
                <td className="px-5 py-3 text-sm text-gray-600">{p.area}</td>
                <td className="px-5 py-3"><span className="px-2 py-1 rounded-full text-xs bg-[#E5E5E5]">{p.rental_type}</span></td>
                <td className="px-5 py-3 font-bold text-sm">{p.currency === 'USD' ? '$' : '₪'}{p.monthly_price || p.nightly_price || 0}</td>
                <td className="px-5 py-3 text-sm">{p.views || 0}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {emailHealth && (
        <div className="mt-10" data-testid="admin-email-health">
          <div className="flex items-center gap-2 mb-4">
            <Mail size={18} className="text-[var(--brand-primary)]" />
            <h2 className="text-xl font-bold" style={{ fontFamily: 'Playfair Display' }}>
              {t('admin.emailDeliverability')} <span className="text-sm font-normal text-gray-500">{t('admin.lastNDays', { days: emailHealth.window_days })}</span>
            </h2>
          </div>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-4">
            <div className="bg-white p-4 rounded-xl border border-[#E5E5E5]" data-testid="email-delivered">
              <div className="flex items-center gap-2 mb-1">
                <CheckCircle size={14} className="text-green-600" />
                <span className="text-xs text-gray-500 uppercase tracking-wide">{t('admin.delivered')}</span>
              </div>
              <p className="text-2xl font-bold">{emailHealth.delivered}</p>
            </div>
            <div className="bg-white p-4 rounded-xl border border-[#E5E5E5]" data-testid="email-bounced">
              <div className="flex items-center gap-2 mb-1">
                <AlertTriangle size={14} className="text-amber-600" />
                <span className="text-xs text-gray-500 uppercase tracking-wide">{t('admin.bounced')}</span>
              </div>
              <p className="text-2xl font-bold">{emailHealth.bounced}</p>
            </div>
            <div className="bg-white p-4 rounded-xl border border-[#E5E5E5]" data-testid="email-complained">
              <div className="flex items-center gap-2 mb-1">
                <Ban size={14} className="text-red-600" />
                <span className="text-xs text-gray-500 uppercase tracking-wide">{t('admin.spamComplaints')}</span>
              </div>
              <p className="text-2xl font-bold">{emailHealth.complained}</p>
            </div>
            <div className="bg-white p-4 rounded-xl border border-[#E5E5E5]" data-testid="email-delivery-rate">
              <div className="flex items-center gap-2 mb-1">
                <span className="text-xs text-gray-500 uppercase tracking-wide">{t('admin.deliveryRate')}</span>
              </div>
              <p className="text-2xl font-bold">
                {emailHealth.delivery_rate_pct !== null ? `${emailHealth.delivery_rate_pct}%` : '—'}
              </p>
              {emailHealth.suppressed_users > 0 && (
                <p className="text-xs text-red-500 mt-1">{t('admin.usersSuppressed', { count: emailHealth.suppressed_users })}</p>
              )}
            </div>
          </div>

          {emailHealth.recent_events?.length > 0 && (
            <div className="bg-white rounded-xl border border-[#E5E5E5] overflow-hidden">
              <div className="px-5 py-3 border-b border-[#E5E5E5] bg-gray-50">
                <p className="text-xs font-semibold text-gray-600 uppercase">{t('admin.recentEvents')}</p>
              </div>
              <div className="divide-y divide-[#E5E5E5] max-h-80 overflow-y-auto">
                {emailHealth.recent_events.slice(0, 15).map(ev => {
                  const badgeColor =
                    ev.record_type === 'Delivery' ? 'bg-green-100 text-green-700' :
                    ev.record_type === 'Bounce' ? 'bg-amber-100 text-amber-700' :
                    ev.record_type === 'SpamComplaint' ? 'bg-red-100 text-red-700' :
                    'bg-gray-100 text-gray-700';
                  return (
                    <div key={ev.id} className="px-5 py-3 flex items-center justify-between gap-3 text-sm" data-testid={`email-event-${ev.id}`}>
                      <div className="flex items-center gap-3 min-w-0 flex-1">
                        <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${badgeColor}`}>
                          {ev.record_type}{ev.bounce_type ? ` · ${ev.bounce_type}` : ''}
                        </span>
                        <span className="truncate text-gray-700">{ev.email || '—'}</span>
                        {ev.tag && <span className="text-xs text-gray-400 shrink-0">#{ev.tag}</span>}
                      </div>
                      <span className="text-xs text-gray-400 shrink-0">
                        {new Date(ev.received_at).toLocaleString()}
                      </span>
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </div>
      )}

    </div>
  );
};

export default OverviewTab;
