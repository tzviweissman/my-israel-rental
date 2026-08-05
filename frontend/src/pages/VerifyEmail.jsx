import React from 'react';
import { useLocation, Link, useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { CheckCircle2, AlertCircle, Clock, MailCheck } from 'lucide-react';

/**
 * Landing page after the backend redirects back from /api/auth/verify-email.
 * The status comes through as a `?status=` query param:
 *   success  — token was valid, email is now verified
 *   already  — user was already verified (idempotent re-click)
 *   expired  — token has expired (>24h old)
 *   invalid  — token doesn't match anyone (already used / typo)
 */
const STATUS_THEME = {
  success: { Icon: CheckCircle2, color: '#16A34A', bg: '#DCFCE7',
    titleKey: 'auth.verifyEmail.successTitle', titleFallback: 'Email verified',
    bodyKey: 'auth.verifyEmail.successBody', bodyFallback: 'Your email is confirmed. Welcome aboard — you can now use every feature of MyIsraelRental.' },
  already: { Icon: MailCheck, color: 'var(--brand-primary)', bg: 'var(--brand-primary)1A',
    titleKey: 'auth.verifyEmail.alreadyTitle', titleFallback: 'Already verified',
    bodyKey: 'auth.verifyEmail.alreadyBody', bodyFallback: "This account is already verified — you're good to go." },
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
  const status = new URLSearchParams(search).get('status') || 'invalid';
  const theme = STATUS_THEME[status] || STATUS_THEME.invalid;
  const Icon = theme.Icon;
  const success = status === 'success' || status === 'already';

  return (
    <div className="min-h-screen flex items-center justify-center bg-[#F8F5EF] px-4 py-12" data-testid={`verify-email-page-${status}`}>
      <div className="max-w-md w-full bg-white rounded-2xl shadow-sm border border-gray-200 p-8 text-center">
        <div
          className="inline-flex items-center justify-center w-14 h-14 rounded-full mb-5"
          style={{ background: theme.bg, color: theme.color }}
        >
          <Icon size={26} />
        </div>
        <h1 className="text-2xl font-bold mb-3" style={{ fontFamily: 'Playfair Display' }}>
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
