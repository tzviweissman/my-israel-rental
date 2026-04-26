import React from 'react';
import { Home, Eye, FileText, Users, MessageCircle, Mail, CheckCircle, AlertTriangle, Ban } from 'lucide-react';

/**
 * Super Admin → Overview tab. Pure presentational; the parent owns the
 * `dashboard` and `emailHealth` fetches because the parent already needs
 * `dashboard` for its initial loading-spinner gate.
 */
export const OverviewTab = ({ dashboard, emailHealth }) => {
  return (
    <div data-testid="admin-overview-section">
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4 mb-10">
        {[
          { label: 'Active Listings', value: dashboard.active_listings, icon: Home },
          { label: 'Total Views', value: dashboard.total_views, icon: Eye },
          { label: 'Inquiries', value: dashboard.total_inquiries, icon: FileText },
          { label: 'Total Users', value: dashboard.total_users, icon: Users },
          { label: 'Pending Services', value: dashboard.pending_services || 0, icon: MessageCircle },
        ].map(stat => {
          const Icon = stat.icon;
          return (
            <div key={stat.label} className="bg-white p-5 rounded-xl border border-[#E5E5E5]" data-testid={`stat-${stat.label.toLowerCase().replace(/\s/g, '-')}`}>
              <div className="flex items-center gap-3">
                <div className="p-2 rounded-lg" style={{ backgroundColor: '#1E6A6A' }}>
                  <Icon size={18} color="#D4AF37" />
                </div>
                <div>
                  <p className="text-2xl font-bold">{stat.value}</p>
                  <p className="text-xs text-gray-500">{stat.label}</p>
                </div>
              </div>
            </div>
          );
        })}
      </div>

      <h2 className="text-xl font-bold mb-4" style={{ fontFamily: 'Playfair Display' }}>Recent Listings</h2>
      <div className="bg-white rounded-xl border border-[#E5E5E5] overflow-hidden">
        <table className="w-full">
          <thead className="bg-gray-50">
            <tr>
              <th className="px-5 py-3 text-left text-xs font-semibold text-gray-600 uppercase">Title</th>
              <th className="px-5 py-3 text-left text-xs font-semibold text-gray-600 uppercase">Area</th>
              <th className="px-5 py-3 text-left text-xs font-semibold text-gray-600 uppercase">Type</th>
              <th className="px-5 py-3 text-left text-xs font-semibold text-gray-600 uppercase">Price</th>
              <th className="px-5 py-3 text-left text-xs font-semibold text-gray-600 uppercase">Views</th>
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
            <Mail size={18} className="text-[#1E6A6A]" />
            <h2 className="text-xl font-bold" style={{ fontFamily: 'Playfair Display' }}>
              Email Deliverability <span className="text-sm font-normal text-gray-500">(last {emailHealth.window_days} days)</span>
            </h2>
          </div>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-4">
            <div className="bg-white p-4 rounded-xl border border-[#E5E5E5]" data-testid="email-delivered">
              <div className="flex items-center gap-2 mb-1">
                <CheckCircle size={14} className="text-green-600" />
                <span className="text-xs text-gray-500 uppercase tracking-wide">Delivered</span>
              </div>
              <p className="text-2xl font-bold">{emailHealth.delivered}</p>
            </div>
            <div className="bg-white p-4 rounded-xl border border-[#E5E5E5]" data-testid="email-bounced">
              <div className="flex items-center gap-2 mb-1">
                <AlertTriangle size={14} className="text-amber-600" />
                <span className="text-xs text-gray-500 uppercase tracking-wide">Bounced</span>
              </div>
              <p className="text-2xl font-bold">{emailHealth.bounced}</p>
            </div>
            <div className="bg-white p-4 rounded-xl border border-[#E5E5E5]" data-testid="email-complained">
              <div className="flex items-center gap-2 mb-1">
                <Ban size={14} className="text-red-600" />
                <span className="text-xs text-gray-500 uppercase tracking-wide">Spam complaints</span>
              </div>
              <p className="text-2xl font-bold">{emailHealth.complained}</p>
            </div>
            <div className="bg-white p-4 rounded-xl border border-[#E5E5E5]" data-testid="email-delivery-rate">
              <div className="flex items-center gap-2 mb-1">
                <span className="text-xs text-gray-500 uppercase tracking-wide">Delivery rate</span>
              </div>
              <p className="text-2xl font-bold">
                {emailHealth.delivery_rate_pct !== null ? `${emailHealth.delivery_rate_pct}%` : '—'}
              </p>
              {emailHealth.suppressed_users > 0 && (
                <p className="text-xs text-red-500 mt-1">{emailHealth.suppressed_users} user(s) suppressed</p>
              )}
            </div>
          </div>

          {emailHealth.recent_events?.length > 0 && (
            <div className="bg-white rounded-xl border border-[#E5E5E5] overflow-hidden">
              <div className="px-5 py-3 border-b border-[#E5E5E5] bg-gray-50">
                <p className="text-xs font-semibold text-gray-600 uppercase">Recent events</p>
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
