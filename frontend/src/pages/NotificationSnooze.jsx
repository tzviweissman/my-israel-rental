/**
 * NotificationSnooze — public landing page for the "Snooze this
 * category for 7 days" link in notification emails.
 *
 * Auth-via-token only: the signed JWT in the URL carries the
 * (user_id, category) tuple, so a provider can act on the email
 * without logging in. The token is verified server-side.
 *
 * URL shape: /notification-snooze?t=<signed_jwt>
 *
 * On success the visitor sees a confirmation + a link to their
 * notification settings; on failure a friendly error + a "log in
 * to manage settings" CTA.
 */
import React, { useEffect, useRef, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import axios from 'axios';
import { CheckCircle2, XCircle, Bell, ArrowRight, Loader2 } from 'lucide-react';
import { API } from '../App';

const CATEGORY_LABELS = {
  'home-repair': 'Home Repair',
  'womens-spa': "Women's Spa",
  'transportation': 'Transportation',
  'tours-activities': 'Tours & Activities',
  'music-entertainment': 'Music & Entertainment',
  'photo-video': 'Photo & Video',
  'other': 'Other',
};

const NotificationSnooze = () => {
  const [params] = useSearchParams();
  const navigate = useNavigate();
  const [status, setStatus] = useState('loading');
  const [result, setResult] = useState(null);
  const [error, setError] = useState(null);
  const ran = useRef(false);

  useEffect(() => {
    if (ran.current) return;
    ran.current = true;

    const token = params.get('t');
    if (!token) {
      setStatus('error');
      setError('This link is missing its token.');
      return;
    }

    axios
      .post(`${API}/marketplace/notification-preferences/snooze-consume`, { token })
      .then(({ data }) => {
        setResult(data);
        setStatus('success');
      })
      .catch((err) => {
        setError(err.response?.data?.detail || 'This link is no longer valid.');
        setStatus('error');
      });
  }, [params]);

  const daysLeft = (until) =>
    Math.max(0, Math.ceil((new Date(until).getTime() - Date.now()) / 86400000));
  const label = (slug) => CATEGORY_LABELS[slug] || slug;

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-white to-gray-50 p-4">
      <div className="bg-white border border-gray-100 rounded-2xl shadow-sm max-w-md w-full p-8">
        {status === 'loading' && (
          <div className="text-center" data-testid="snooze-loading">
            <Loader2 className="mx-auto animate-spin text-[#1E6A6A]" size={28} />
            <p className="mt-3 text-sm text-gray-500">Applying snooze…</p>
          </div>
        )}

        {status === 'success' && result && (
          <div className="text-center" data-testid="snooze-success">
            <div className="mx-auto w-14 h-14 rounded-full bg-emerald-50 flex items-center justify-center mb-4">
              <CheckCircle2 className="text-emerald-600" size={26} />
            </div>
            <h1 className="text-lg font-bold text-gray-900 mb-2">
              Snoozed — you&apos;ll get a quieter inbox
            </h1>
            <p className="text-sm text-gray-600 leading-relaxed">
              We&apos;ll stop emailing you about new{' '}
              <span className="font-semibold text-[#1E6A6A]">{label(result.category)}</span> jobs
              for the next{' '}
              <span className="font-semibold">{daysLeft(result.until)} days</span>. You can
              undo or extend this any time.
            </p>
            <button
              type="button"
              onClick={() => navigate('/dashboard/settings?section=notifications')}
              className="mt-6 inline-flex items-center gap-1.5 px-5 py-2.5 rounded-lg bg-[#1E6A6A] text-white text-sm font-semibold hover:bg-[#0F3A3A]"
              data-testid="snooze-goto-settings"
            >
              <Bell size={14} /> Notification settings <ArrowRight size={13} />
            </button>
          </div>
        )}

        {status === 'error' && (
          <div className="text-center" data-testid="snooze-error">
            <div className="mx-auto w-14 h-14 rounded-full bg-red-50 flex items-center justify-center mb-4">
              <XCircle className="text-red-500" size={26} />
            </div>
            <h1 className="text-lg font-bold text-gray-900 mb-2">Link no longer valid</h1>
            <p className="text-sm text-gray-600 mb-6">{error}</p>
            <button
              type="button"
              onClick={() => navigate('/dashboard/settings?section=notifications')}
              className="inline-flex items-center gap-1.5 px-5 py-2.5 rounded-lg border border-[#1E6A6A] text-[#1E6A6A] text-sm font-semibold hover:bg-[#1E6A6A]/10"
              data-testid="snooze-manual-settings"
            >
              Log in to manage settings <ArrowRight size={13} />
            </button>
          </div>
        )}
      </div>
    </div>
  );
};

export default NotificationSnooze;
