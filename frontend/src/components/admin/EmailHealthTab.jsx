import React from 'react';
import { useTranslation } from 'react-i18next';
import { Mail, CheckCircle, AlertTriangle, Ban, Loader2 } from 'lucide-react';
import { API } from '../../App';
import { useApiSWR } from '../../hooks/useApiSWR';

/**
 * Super Admin → System → Email health (spec A5).
 *
 * This lived on Overview, where deliverability stats, a bounce list and
 * spam complaints pushed the actual business numbers off the first screen.
 * It is infrastructure: worth having, not worth being the first thing an
 * admin reads every morning.
 *
 * The exception still reaches Overview — the attention queue carries an
 * "N emails bounced in the last 7 days" row that links straight here — so
 * moving this out hides the noise without hiding the problem.
 *
 * Fetched here rather than by the parent, so a console that never opens
 * this tab never makes the request.
 */
export default function EmailHealthTab({ token }) {
  const { t } = useTranslation();
  const { data: emailHealth, error } = useApiSWR(`${API}/admin/email-health`, token);

  if (error) {
    return (
      <p className="text-sm py-10 text-center" style={{ color: 'var(--brand-muted)' }} data-testid="admin-email-health-error">
        {t('admin.emailHealthUnavailable', 'Email health could not be loaded.')}
      </p>
    );
  }

  if (!emailHealth) {
    return (
      <div className="py-16 text-center" style={{ color: 'var(--brand-muted)' }}>
        <Loader2 className="animate-spin inline" size={18} />
      </div>
    );
  }

  const cards = [
    { key: 'delivered', label: t('admin.delivered'), value: emailHealth.delivered, Icon: CheckCircle, tone: 'text-green-600' },
    { key: 'bounced', label: t('admin.bounced'), value: emailHealth.bounced, Icon: AlertTriangle, tone: 'text-amber-600' },
    { key: 'complained', label: t('admin.spamComplaints'), value: emailHealth.complained, Icon: Ban, tone: 'text-red-600' },
  ];

  return (
    <div data-testid="admin-email-health">
      <div className="flex items-center gap-2 mb-4">
        <Mail size={18} className="text-[var(--brand-primary)]" />
        <h2 className="text-xl font-bold" style={{ fontFamily: 'var(--font-head)' }}>
          {t('admin.emailDeliverability')}{' '}
          <span className="text-sm font-normal text-gray-500">
            {t('admin.lastNDays', { days: emailHealth.window_days })}
          </span>
        </h2>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
        {cards.map(({ key, label, value, Icon, tone }) => (
          <div key={key} className="bg-white p-4 rounded-xl border border-[var(--brand-border)]" data-testid={`email-${key}`}>
            <div className="flex items-center gap-2 mb-1">
              <Icon size={14} className={tone} />
              <span className="text-xs text-gray-500 uppercase tracking-wide">{label}</span>
            </div>
            <p className="text-2xl font-bold">{value}</p>
          </div>
        ))}
        <div className="bg-white p-4 rounded-xl border border-[var(--brand-border)]" data-testid="email-delivery-rate">
          <div className="flex items-center gap-2 mb-1">
            <span className="text-xs text-gray-500 uppercase tracking-wide">{t('admin.deliveryRate')}</span>
          </div>
          {/* An em dash, not 0% — no mail sent is not a 0% delivery rate. */}
          <p className="text-2xl font-bold">
            {emailHealth.delivery_rate_pct !== null ? `${emailHealth.delivery_rate_pct}%` : '—'}
          </p>
          {emailHealth.suppressed_users > 0 && (
            <p className="text-xs text-red-500 mt-1">
              {t('admin.usersSuppressed', { count: emailHealth.suppressed_users })}
            </p>
          )}
        </div>
      </div>

      {emailHealth.recent_events?.length > 0 && (
        <div className="bg-white rounded-xl border border-[var(--brand-border)] overflow-hidden">
          <div className="px-5 py-3 border-b border-[var(--brand-border)] bg-gray-50">
            <p className="text-xs font-semibold text-gray-600 uppercase">{t('admin.recentEvents')}</p>
          </div>
          <div className="divide-y divide-[var(--brand-border)] max-h-96 overflow-y-auto">
            {emailHealth.recent_events.slice(0, 50).map((ev) => {
              const badgeColor =
                ev.record_type === 'Delivery' ? 'bg-green-100 text-green-700' :
                ev.record_type === 'Bounce' ? 'bg-amber-100 text-amber-700' :
                ev.record_type === 'SpamComplaint' ? 'bg-red-100 text-red-700' :
                'bg-gray-100 text-gray-700';
              return (
                <div key={ev.id} className="px-5 py-3 flex items-center justify-between gap-3 text-sm" data-testid={`email-event-${ev.id}`}>
                  <div className="flex items-center gap-3 min-w-0 flex-1">
                    <span className={`px-2 py-0.5 rounded-full text-xs font-medium shrink-0 ${badgeColor}`}>
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
  );
}
