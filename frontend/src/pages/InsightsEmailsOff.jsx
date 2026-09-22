/**
 * InsightsEmailsOff: where "Stop these weekly emails" in the Monday
 * "how your listings did" email lands (backend routes/weekly_insights.py).
 *
 * The signed token in the URL is the auth, so it works straight from the
 * inbox without signing in. Same shape as RequestsEmailsOff, but in both
 * languages: the email it answers is sent in Hebrew too.
 *
 * URL shape: /insights-emails-off?t=<signed_jwt>
 */
import React, { useEffect, useRef, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import axios from 'axios';
import { useTranslation } from 'react-i18next';
import { CheckCircle2, XCircle, Loader2, ArrowRight } from 'lucide-react';
import { API } from '../App';

export default function InsightsEmailsOff() {
  const { t } = useTranslation();
  const [params] = useSearchParams();
  const navigate = useNavigate();
  const [status, setStatus] = useState('loading');
  // StrictMode runs effects twice in dev; the call is idempotent, this keeps it single.
  const ran = useRef(false);

  useEffect(() => {
    if (ran.current) return;
    ran.current = true;
    const token = params.get('t');
    if (!token) { setStatus('error'); return; }
    axios.post(`${API}/marketplace/insights/emails/opt-out`, { token })
      .then(() => setStatus('success'))
      .catch(() => setStatus('error'));
  }, [params]);

  return (
    <div className="min-h-screen flex items-center justify-center p-4" style={{ background: 'var(--bg)' }}>
      <div
        className="bg-white border rounded-2xl shadow-sm max-w-md w-full p-8 text-center"
        style={{ borderColor: 'var(--brand-border)' }}
        data-testid="insights-emails-off"
      >
        {status === 'loading' && (
          <Loader2 size={28} className="animate-spin mx-auto" style={{ color: 'var(--brand-primary)' }} aria-label={t('insightsOff.loading', 'One moment')} />
        )}
        {status !== 'loading' && (
          <>
            {status === 'success'
              ? <CheckCircle2 size={40} className="mx-auto mb-4" style={{ color: 'var(--brand-primary)' }} aria-hidden="true" />
              : <XCircle size={40} className="mx-auto mb-4" style={{ color: 'var(--brand-muted)' }} aria-hidden="true" />}
            <h1 className="text-xl font-bold mb-2" style={{ fontFamily: 'var(--font-head)', color: 'var(--ink)' }}>
              {status === 'success'
                ? t('insightsOff.doneTitle', 'Done. No more weekly emails')
                : t('insightsOff.errorTitle', 'That link did not work')}
            </h1>
            <p className="text-sm mb-6" style={{ color: 'var(--brand-muted)' }}>
              {status === 'success'
                ? t('insightsOff.doneBody', 'We will not send you the Monday summary again. Your numbers are still on your dashboard any time.')
                : t('insightsOff.errorBody', 'It may have expired. Your dashboard shows the same numbers.')}
            </p>
            <button type="button" onClick={() => navigate('/dashboard?tab=overview')} className="btn-primary inline-flex items-center gap-2 min-h-[44px] px-5 rounded-full">
              {t('insightsOff.dashboard', 'Open your dashboard')}
              <ArrowRight size={16} className="rtl:rotate-180" aria-hidden="true" />
            </button>
          </>
        )}
      </div>
    </div>
  );
}
