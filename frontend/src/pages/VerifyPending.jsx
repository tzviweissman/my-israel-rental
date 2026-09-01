import React, { useEffect, useState } from 'react';
import { useLocation, Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import axios from 'axios';
import { toast } from 'sonner';
import { Mail, RefreshCw, MailWarning } from 'lucide-react';

import { API } from '../lib/apiBase';
const RESEND_COOLDOWN_SEC = 60;

/**
 * Post-signup / blocked-login landing page. Tells the user to check their
 * inbox + spam folder and gives them a "Resend verification email" button
 * with a 60-second cooldown to dodge accidental double-taps.
 */
const VerifyPending = () => {
  const { t } = useTranslation();
  const { search } = useLocation();
  const email = new URLSearchParams(search).get('email') || '';
  const [cooldown, setCooldown] = useState(0);
  const [sending, setSending] = useState(false);

  useEffect(() => {
    if (cooldown <= 0) return;
    const t = setTimeout(() => setCooldown(cooldown - 1), 1000);
    return () => clearTimeout(t);
  }, [cooldown]);

  const handleResend = async () => {
    if (!email) {
      toast.error(t('auth.verifyPending.noEmailOnRecord', "We don't know your email — please log in or sign up again."));
      return;
    }
    setSending(true);
    try {
      await axios.post(`${API}/auth/resend-verification`, { email });
      toast.success(t('auth.verifyPending.resent', 'If an account exists for that email, a new verification link is on its way.'));
      setCooldown(RESEND_COOLDOWN_SEC);
    } catch (err) {
      toast.error(err.response?.data?.detail || t('common.somethingWentWrong', 'Something went wrong.'));
    } finally {
      setSending(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-[#F8F5EF] px-4 py-12" data-testid="verify-pending-page">
      <div className="max-w-md w-full bg-white rounded-2xl shadow-sm border border-gray-200 p-8 text-center">
        <div className="inline-flex items-center justify-center w-14 h-14 rounded-full bg-[rgb(var(--brand-primary-rgb)/<alpha-value>)]/10 text-[var(--brand-primary)] mb-5">
          <Mail size={26} />
        </div>
        <h1 className="text-2xl font-bold mb-2" style={{ fontFamily: 'Playfair Display' }}>
          {t('auth.verifyPending.title', 'Check your email')}
        </h1>
        <p className="text-sm text-gray-600 leading-relaxed mb-1">
          {t('auth.verifyPending.body1', "We've sent a verification link to")}
        </p>
        {email && <p className="font-semibold text-gray-900 mb-4 break-all" data-testid="verify-pending-email">{email}</p>}
        <p className="text-sm text-gray-600 leading-relaxed mb-6">
          {t('auth.verifyPending.body2', 'Click the link inside the email to activate your account.')}
        </p>

        <div className="flex items-start gap-2 text-left text-xs bg-amber-50 border border-amber-200 rounded-lg p-3 mb-6">
          <MailWarning size={16} className="text-amber-600 shrink-0 mt-0.5" />
          <p className="text-amber-800 leading-snug">
            {t('auth.verifyPending.checkSpam', "Can't see it? Check your spam or junk folder — and mark it as 'Not spam' so future updates land in your inbox.")}
          </p>
        </div>

        <button
          onClick={handleResend}
          disabled={cooldown > 0 || sending}
          className={`w-full inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-lg font-semibold text-sm transition-colors ${
            cooldown > 0 || sending
              ? 'bg-gray-100 text-gray-400 cursor-not-allowed'
              : 'bg-[var(--brand-primary)] text-white hover:bg-[#175555]'
          }`}
          data-testid="resend-verification-btn"
        >
          <RefreshCw size={14} className={sending ? 'animate-spin' : ''} />
          {cooldown > 0
            ? t('auth.verifyPending.resendIn', `Resend in ${cooldown}s`, { count: cooldown })
            : t('auth.verifyPending.resend', 'Resend verification email')}
        </button>

        <p className="text-xs text-gray-500 mt-6">
          {t('auth.verifyPending.alreadyVerified', 'Already verified?')}{' '}
          <Link to="/auth/login" className="text-[var(--brand-primary)] font-semibold hover:underline" data-testid="verify-pending-login-link">
            {t('auth.login', 'Log in')}
          </Link>
        </p>
      </div>
    </div>
  );
};

export default VerifyPending;
