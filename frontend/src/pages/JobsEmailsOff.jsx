/**
 * JobsEmailsOff — the landing page for the "stop these emails" link at the
 * bottom of the daily jobs digest (spec L2).
 *
 * Auth-via-token only: the signed JWT in the URL carries the user_id, so
 * somebody can turn these off straight from their inbox without logging
 * in. That is the whole point — an unsubscribe that first demands a
 * password is not an unsubscribe.
 *
 * URL shape: /jobs-emails-off?t=<signed_jwt>
 *
 * Deliberately its own page rather than a shared one with
 * RequestsEmailsOff or NotificationSnooze, for the reason RequestsEmailsOff
 * already gives about the snooze page: those turn off DIFFERENT emails, and
 * reusing one would tell somebody something untrue about what just
 * happened. The three are near-identical in shape and must stay distinct in
 * what they claim.
 *
 * The copy is explicit about what is NOT affected. Somebody unsubscribing
 * from a digest is usually trying to quiet one thing, not disappear —
 * leaving them unsure whether they have also stopped hearing about their
 * own work is how an unsubscribe becomes a support message.
 */
import React, { useEffect, useRef, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import axios from 'axios';
import { CheckCircle2, XCircle, Loader2, ArrowRight } from 'lucide-react';
import { API } from '../App';

const JobsEmailsOff = () => {
  const { t } = useTranslation();
  const [params] = useSearchParams();
  const navigate = useNavigate();
  const [status, setStatus] = useState('loading');
  const [error, setError] = useState(null);
  // React 18 StrictMode double-invokes effects in dev; without this the
  // opt-out would post twice. Harmless — it is idempotent — but noisy.
  const ran = useRef(false);

  useEffect(() => {
    if (ran.current) return;
    ran.current = true;

    const token = params.get('t');
    if (!token) {
      setStatus('error');
      setError(t('jobsEmailsOff.missingToken', 'This link is missing its token.'));
      return;
    }

    axios
      .post(`${API}/marketplace/job-searches/emails/opt-out`, { token })
      .then(() => setStatus('success'))
      .catch((err) => {
        setError(
          err.response?.data?.detail
          || t('jobsEmailsOff.invalid', 'This link is no longer valid.'),
        );
        setStatus('error');
      });
  }, [params, t]);

  return (
    <div className="min-h-screen flex items-center justify-center p-4" style={{ background: 'var(--bg)' }}>
      <div
        className="bg-white border rounded-2xl shadow-sm max-w-md w-full p-8 text-center"
        style={{ borderColor: 'var(--brand-border)' }}
        data-testid="jobs-emails-off"
      >
        {status === 'loading' && (
          <>
            <Loader2 size={28} className="animate-spin mx-auto mb-4" style={{ color: 'var(--brand-primary)' }} />
            <p style={{ color: 'var(--brand-muted)' }}>{t('jobsEmailsOff.working', 'One moment…')}</p>
          </>
        )}

        {status === 'success' && (
          <>
            <CheckCircle2 size={40} className="mx-auto mb-4" style={{ color: 'var(--brand-primary)' }} />
            <h1 className="text-xl font-bold mb-2" style={{ fontFamily: 'var(--font-head)', color: 'var(--ink)' }}>
              {t('jobsEmailsOff.doneTitle', 'Done — no more of these emails')}
            </h1>
            <p className="text-sm mb-6" style={{ color: 'var(--brand-muted)' }}>
              {t('jobsEmailsOff.doneBody',
                "We won't send you the daily digest of new jobs any more. Your saved searches, your listings and your messages are all unaffected, and the board is still there whenever you want it.")}
            </p>
            <button
              onClick={() => navigate('/businesses/jobs')}
              className="btn-blue-solid inline-flex items-center gap-2"
              data-testid="jobs-emails-off-board"
            >
              {t('jobsEmailsOff.seeBoard', 'See the jobs board')}
              <ArrowRight size={16} className="rtl:rotate-180" />
            </button>
          </>
        )}

        {status === 'error' && (
          <>
            <XCircle size={40} className="mx-auto mb-4" style={{ color: '#b4232a' }} />
            <h1 className="text-xl font-bold mb-2" style={{ fontFamily: 'var(--font-head)', color: 'var(--ink)' }}>
              {t('jobsEmailsOff.failedTitle', "We couldn't use that link")}
            </h1>
            <p className="text-sm mb-6" style={{ color: 'var(--brand-muted)' }}>{error}</p>
            <button
              onClick={() => navigate('/dashboard/settings?section=notifications')}
              className="btn-blue-solid inline-flex items-center gap-2"
            >
              {t('jobsEmailsOff.manage', 'Manage email settings')}
              <ArrowRight size={16} className="rtl:rotate-180" />
            </button>
          </>
        )}
      </div>
    </div>
  );
};

export default JobsEmailsOff;
