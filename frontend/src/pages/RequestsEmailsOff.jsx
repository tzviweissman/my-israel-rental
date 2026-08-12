/**
 * RequestsEmailsOff — the landing page for the "Stop these emails" link
 * at the bottom of the requests matching email.
 *
 * Auth-via-token only: the signed JWT in the URL carries the user_id, so
 * someone can turn these emails off straight from their inbox without
 * logging in. That is the whole point — an unsubscribe that first demands
 * a password is not an unsubscribe.
 *
 * URL shape: /requests-emails-off?t=<signed_jwt>
 *
 * Deliberately separate from NotificationSnooze: that page snoozes ONE
 * job category for 7 days and its copy says so. Reusing it here would
 * tell people something untrue about what just happened.
 */
import React, { useEffect, useRef, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import axios from 'axios';
import { CheckCircle2, XCircle, Loader2, ArrowRight } from 'lucide-react';
import { API } from '../App';

const RequestsEmailsOff = () => {
  const [params] = useSearchParams();
  const navigate = useNavigate();
  const [status, setStatus] = useState('loading');
  const [error, setError] = useState(null);
  // React 18 StrictMode double-invokes effects in dev; without this the
  // opt-out would post twice. Harmless (it's idempotent) but noisy.
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
      .post(`${API}/marketplace/requests/emails/opt-out`, { token })
      .then(() => setStatus('success'))
      .catch((err) => {
        setError(err.response?.data?.detail || 'This link is no longer valid.');
        setStatus('error');
      });
  }, [params]);

  return (
    <div className="min-h-screen flex items-center justify-center p-4" style={{ background: 'var(--bg)' }}>
      <div
        className="bg-white border rounded-2xl shadow-sm max-w-md w-full p-8 text-center"
        style={{ borderColor: 'var(--brand-border)' }}
        data-testid="requests-emails-off"
      >
        {status === 'loading' && (
          <>
            <Loader2 size={28} className="animate-spin mx-auto mb-4" style={{ color: 'var(--brand-primary)' }} />
            <p style={{ color: 'var(--brand-muted)' }}>One moment…</p>
          </>
        )}

        {status === 'success' && (
          <>
            <CheckCircle2 size={40} className="mx-auto mb-4" style={{ color: 'var(--brand-primary)' }} />
            <h1 className="text-xl font-bold mb-2" style={{ fontFamily: 'var(--font-head)', color: 'var(--ink)' }}>
              Done — no more of these emails
            </h1>
            <p className="text-sm mb-6" style={{ color: 'var(--brand-muted)' }}>
              We won&apos;t email you again when someone posts a request that matches
              your listings. Your listings and messages are unaffected, and you can
              still browse the board any time.
            </p>
            <button
              onClick={() => navigate('/requests')}
              className="btn-blue-solid inline-flex items-center gap-2"
            >
              See the board
              <ArrowRight size={16} className="rtl:rotate-180" />
            </button>
          </>
        )}

        {status === 'error' && (
          <>
            <XCircle size={40} className="mx-auto mb-4" style={{ color: '#b4232a' }} />
            <h1 className="text-xl font-bold mb-2" style={{ fontFamily: 'var(--font-head)', color: 'var(--ink)' }}>
              We couldn&apos;t use that link
            </h1>
            <p className="text-sm mb-6" style={{ color: 'var(--brand-muted)' }}>{error}</p>
            <button
              onClick={() => navigate('/dashboard/settings?section=notifications')}
              className="btn-blue-solid inline-flex items-center gap-2"
            >
              Manage email settings
              <ArrowRight size={16} className="rtl:rotate-180" />
            </button>
          </>
        )}
      </div>
    </div>
  );
};

export default RequestsEmailsOff;
