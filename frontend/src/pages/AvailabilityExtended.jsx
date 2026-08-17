import React from 'react';
import { useSearchParams, Link } from 'react-router-dom';
import { CalendarCheck, Sparkles } from 'lucide-react';

/**
 * Lightweight confirmation page the backend redirects to after the
 * one-tap "Extend by one month" email button fires. Two states:
 *   • Fresh extension → ?new_to=YYYY-MM-DD → "you're set through DATE"
 *   • Already-extended (idempotent re-click or cap already cleared) →
 *     ?already=1 → "no further action needed"
 *
 * Public route (no auth) so it works directly from email clients without
 * forcing a login round-trip.
 */
const AvailabilityExtended = () => {
  const [params] = useSearchParams();
  const newTo = params.get('new_to');
  const already = params.get('already');
  const pid = params.get('id');

  const formattedDate = newTo
    ? new Date(newTo + 'T12:00:00').toLocaleDateString('en-US', {
        weekday: 'long', month: 'long', day: 'numeric', year: 'numeric',
      })
    : null;

  return (
    <div
      className="min-h-[80vh] flex items-center justify-center px-4 py-12"
      data-testid="availability-extended-page"
    >
      <div className="max-w-md w-full bg-white rounded-2xl shadow-xl border border-gray-100 p-8 text-center">
        <div className="w-16 h-16 rounded-full mx-auto mb-5 flex items-center justify-center" style={{ background: 'linear-gradient(135deg, var(--gold), var(--brand-primary))' }}>
          {already ? (
            <Sparkles size={28} className="text-white" />
          ) : (
            <CalendarCheck size={28} className="text-white" />
          )}
        </div>
        {already ? (
          <>
            <h1 className="text-2xl font-bold text-gray-900 mb-2">All set 🎉</h1>
            <p className="text-gray-600 leading-relaxed">
              Your listing is already in good shape — no further action needed.
              Open your dashboard to fine-tune the availability window any time.
            </p>
          </>
        ) : (
          <>
            <h1 className="text-2xl font-bold text-gray-900 mb-2">Extended ✓</h1>
            <p className="text-gray-600 leading-relaxed">
              Your listing now accepts bookings through{' '}
              {formattedDate ? (
                <strong className="text-[var(--brand-primary)]">{formattedDate}</strong>
              ) : (
                <strong className="text-[var(--brand-primary)]">your new window</strong>
              )}
              . We&apos;ll send another nudge five days before it rolls past again.
            </p>
          </>
        )}
        <Link
          to={pid ? `/dashboard?edit=${pid}` : '/dashboard'}
          className="mt-6 inline-block px-6 py-2.5 rounded-lg font-semibold text-white transition-all"
          style={{ backgroundColor: 'var(--brand-primary)' }}
          data-testid="availability-extended-dashboard-link"
        >
          Open dashboard
        </Link>
      </div>
    </div>
  );
};

export default AvailabilityExtended;
