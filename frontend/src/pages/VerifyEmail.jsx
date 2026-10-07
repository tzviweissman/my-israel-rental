import React, { useEffect } from 'react';
import { useLocation, Link, useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { CheckCircle2, AlertCircle, Clock, MailCheck, Loader2 } from 'lucide-react';
import { API } from '../lib/apiBase';

/**
 * Landing page after the backend redirects back from /api/auth/verify-email.
 * The status comes through as a `?status=` query param:
 *   success  — token was valid, email is now verified
 *   already  — user was already verified (idempotent re-click)
 *   expired  — token has expired (>24h old)
 *   invalid  — token doesn't match anyone (already used / typo)
 *
 * THE EMAIL LINKS HERE WITH `?token=`, not to the API (auth.py
 * _send_verification_email). This page used to read only `?status=`, so
 * every emailed link showed "Invalid link" and no account was ever
 * verified (dead-ends audit 6 Oct 2026; broken since about 16 Sep). Now a
 * visit carrying a token hands it straight to the API, which verifies and
 * comes back here with the status. Fixing it here, rather than changing
 * the email's link, also repairs every email already sent.
 */
const STATUS_THEME = {
  success: { Icon: CheckCircle2, color: '#16A34A', bg: '#DCFCE7',
    titleKey: 'auth.verifyEmail.successTitle', titleFallback: 'Email verified',
    bodyKey: 'auth.verifyEmail.successBody', bodyFallback: 'Your email is confirmed. Welcome aboard - you can now use every feature of MyIsraelRental.' },
  already: { Icon: MailCheck, color: 'var(--brand-primary)', bg: 'var(--brand-primary)1A',
    titleKey: 'auth.verifyEmail.alreadyTitle', titleFallback: 'Already verified',
    bodyKey: 'auth.verifyEmail.alreadyBody', bodyFallback: "This account is already verified - you're good to go." },
  expired: { Icon: Clock, color: '#D97706', bg: '#FEF3C7',
    titleKey: 'auth.verifyEmail.expiredTitle', titleFallback: 'Link expired',
    bodyKey: 'auth.verifyEmail.expiredBody', bodyFallback: 'This verification link has expired. Log in and request a new one.' },
  invalid: { Icon: AlertCircle, color: '#DC2626', bg: '#FEE2E2',
    titleKey: 'auth.verifyEmail.invalidTitle', titleFallback: 'Invalid link',
    bodyKey: 'auth.verifyEmail.invalidBody', bodyFallback: "This verification link isn't valid. It may already have been used. Log in and request a fresh one." },
};

const VerifyEmail = () => {
  const { t } = useTranslation();
  const { search } = useLocation();
  const navigate = useNavigate();
  const params = new URLSearchParams(search);
  const token = params.get('token');
  const checking = Boolean(token) && !params.get('status');
  useEffect(() => {
    if (checking) window.location.replace(`${API}/auth/verify-email?token=${encodeURIComponent(token)}`);
  }, [checking, token]);
  const status = params.get('status') || 'invalid';
  const theme = STATUS_THEME[status] || STATUS_THEME.invalid;
  const Icon = theme.Icon;
  const success = status === 'success' || status === 'already';

  if (checking) {
    return (
      <div className="min-h-screen flex items-center justify-center px-4 py-12" style={{ background: 'var(--bg)' }} data-testid="verify-email-page-checking">
        <p className="inline-flex items-center gap-2 text-sm" style={{ color: 'var(--brand-muted)' }}>
          <Loader2 size={16} className="animate-spin" aria-hidden="true" /> {t('auth.verifyEmail.checking', 'Confirming your email…')}
        </p>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-[#F8F5EF] px-4 py-12" data-testid={`verify-email-page-${status}`}>
      <div className="max-w-md w-full bg-white rounded-2xl shadow-sm border border-gray-200 p-8 text-center">
        <div
          className="inline-flex items-center justify-center w-14 h-14 rounded-full mb-5"
          style={{ background: theme.bg, color: theme.color }}
        >
          <Icon size={26} />
        </div>
        <h1 className="text-2xl font-bold mb-3" style={{ fontFamily: 'var(--font-head)' }}>
          {t(theme.titleKey, theme.titleFallback)}
        </h1>
        <p className="text-sm text-gray-600 leading-relaxed mb-6">
          {t(theme.bodyKey, theme.bodyFallback)}
        </p>
        {success ? (
          <button
            onClick={() => navigate('/dashboard')}
            className="w-full px-4 py-2.5 rounded-lg font-semibold text-sm bg-[var(--brand-primary)] text-white hover:bg-[#175555]"
            data-testid="verify-email-cta-dashboard"
          >
            {t('auth.verifyEmail.goToDashboard', 'Go to dashboard')}
          </button>
        ) : (
          <Link
            to="/auth/login"
            className="inline-block w-full px-4 py-2.5 rounded-lg font-semibold text-sm bg-[var(--brand-primary)] text-white hover:bg-[#175555]"
            data-testid="verify-email-cta-login"
          >
            {t('auth.verifyEmail.goToLogin', 'Log in to resend')}
          </Link>
        )}
      </div>
    </div>
  );
};

export default VerifyEmail;
