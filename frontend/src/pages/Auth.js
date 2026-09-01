import React, { useState, useContext } from 'react';
import { useParams, useNavigate, useSearchParams } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import axios from 'axios';
import DOMPurify from 'dompurify';
import { API, AuthContext } from '../App';
import { toast } from 'sonner';
import { apiErrorMessage } from '../utils/apiError';
import { Eye, EyeOff, ArrowLeft, Mail, KeyRound, CheckCircle, Home, Building2, Briefcase } from 'lucide-react';
import WelcomePopups from '../components/WelcomePopups';
import OwnerManagementOfferModal from '../components/OwnerManagementOfferModal';
import GoogleSignInButton from '../components/auth/GoogleSignInButton';
import { GOOGLE_CLIENT_ID } from '../components/auth/useGoogleSignIn';
import { phoneError, phonePreview } from '../utils/phoneValidation';
import PhoneInput from '../components/common/PhoneInput';
import ContinueAsBanner from '../components/auth/ContinueAsBanner';
import { LAST_LOGIN_HINT_KEY } from '../components/auth/completeGoogleSignIn';

const Auth = () => {
  const { mode } = useParams();
  const { t } = useTranslation();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { login, user: currentUser } = useContext(AuthContext);
  // After auth, honor an explicit ?redirect=… (set when the user was trying
  // to book or message from a property page) — otherwise drop them on their
  // dashboard. Admins go to /admin.
  const redirectParam = searchParams.get('redirect');
  const postAuthDestination = (u) => {
    if (redirectParam) return redirectParam;
    if (u?.role === 'admin') return '/admin';
    return '/dashboard';
  };
  // Keep `redirectUrl` for the existing modal flows (they fall back to home
  // only when no other destination is known).
  const redirectUrl = redirectParam || (currentUser?.role === 'admin' ? '/admin' : '/dashboard');
  const [formData, setFormData] = useState({
    email: '',
    password: '',
    name: '',
    phone: '',
    role: 'renter'
  });
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [termsAccepted, setTermsAccepted] = useState(false);

  // Forgot password state
  const [forgotEmail, setForgotEmail] = useState('');
  const [forgotSending, setForgotSending] = useState(false);
  const [forgotSent, setForgotSent] = useState(false);

  // Reset password state
  const [resetPassword, setResetPassword] = useState('');
  const [resetConfirmPassword, setResetConfirmPassword] = useState('');
  const [resetToken] = useState(searchParams.get('token') || '');
  const [resetting, setResetting] = useState(false);
  const [resetDone, setResetDone] = useState(false);
  const [showResetPassword, setShowResetPassword] = useState(false);
  const [showWelcomePopups, setShowWelcomePopups] = useState(false);
  const [showOwnerOffer, setShowOwnerOffer] = useState(false);

  // Recomputed each render — cheap, and keeps the message in step with the
  // input without another piece of state to keep in sync.
  const phoneErr = mode === 'signup' ? phoneError(formData.phone, t) : '';

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (mode === 'signup' && phoneErr) {
      // Block rather than silently save an ambiguous number: it would get
      // no WhatsApp button later, with nothing to explain why.
      toast.error(phoneErr);
      return;
    }
    if (mode === 'signup' && formData.password !== confirmPassword) {
      toast.error(t('auth.passwordMismatch'));
      return;
    }
    if (mode === 'signup' && !termsAccepted) {
      toast.error(t('auth.mustAcceptTerms'));
      return;
    }
    try {
      const endpoint = mode === 'login' ? '/auth/login' : '/auth/register';
      const response = await axios.post(`${API}${endpoint}`, formData);
      login(response.data.token, response.data.user);
      // Persist "Continue as X" hint for the next visit — populated on
      // both email/password and Google flows so returning visitors get
      // a one-tap re-login regardless of how they originally signed up.
      try {
        localStorage.setItem(LAST_LOGIN_HINT_KEY, JSON.stringify({
          name: response.data.user?.name || '',
          email: response.data.user?.email || '',
          picture: response.data.user?.picture || null,
          provider: 'email',
          ts: Date.now(),
        }));
      } catch { /* quota / private mode */ }
      toast.success(mode === 'login' ? t('auth.welcomeBack') : t('auth.accountCreated'));
      const destination = postAuthDestination(response.data.user);
      if (mode === 'signup' && formData.role === 'renter') {
        setShowWelcomePopups(true);
      } else if (mode === 'signup' && formData.role === 'owner') {
        // Pitch our property-management service the moment a fresh owner
        // lands on the platform — they're most receptive right after signup.
        // Managers already run their own property portfolio and don't need
        // this offer, and renters get a different modal (see above).
        setShowOwnerOffer(true);
      } else if (mode === 'signup' && formData.role === 'provider') {
        // Service providers land straight in the gig-creation wizard —
        // no property-management upsell, they're here to list services.
        navigate('/businesses/add');
      } else {
        navigate(destination);
      }
    } catch (error) {
      toast.error(apiErrorMessage(error, t('auth.failed', 'Something went wrong. Please try again.'), t));
    }
  };

  const handleForgotPassword = async (e) => {
    e.preventDefault();
    if (!forgotEmail.trim()) {
      toast.error('Please enter your email address.');
      return;
    }
    setForgotSending(true);
    try {
      await axios.post(`${API}/auth/forgot-password`, { email: forgotEmail });
      // For security we never expose the reset token in the response — the
      // user MUST receive it via the emailed link. Always show the same
      // generic "check your email" confirmation regardless of whether the
      // email exists.
      setForgotSent(true);
    } catch (err) {
      // The backend now only errors on malformed requests. Show a generic
      // failure so we never leak whether the email existed.
      toast.error(apiErrorMessage(err, t('auth.failed', 'Something went wrong. Please try again.'), t));
    } finally {
      setForgotSending(false);
    }
  };

  const handleResetPassword = async (e) => {
    e.preventDefault();
    if (resetPassword.length < 6) {
      toast.error('Password must be at least 6 characters.');
      return;
    }
    if (resetPassword !== resetConfirmPassword) {
      toast.error('Passwords do not match.');
      return;
    }
    setResetting(true);
    try {
      await axios.post(`${API}/auth/reset-password`, {
        token: resetToken,
        new_password: resetPassword
      });
      setResetDone(true);
      toast.success('Password has been reset successfully!');
    } catch (err) {
      toast.error(apiErrorMessage(err, t('auth.resetFailed', 'Failed to reset password. The link may have expired.'), t));
    } finally {
      setResetting(false);
    }
  };

  // --- Forgot Password View ---
  if (mode === 'forgot-password') {
    return (
      <div className="min-h-screen flex items-center justify-center px-6 pt-20 pb-12">
        <div className="w-full max-w-md">
          <div className="bg-white rounded-2xl p-8 border border-[#E5E5E5]">
            {forgotSent ? (
              <div className="text-center py-4">
                <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-4">
                  <CheckCircle size={32} className="text-green-600" />
                </div>
                <h2 className="text-2xl font-bold mb-3" style={{ fontFamily: 'Playfair Display' }}>{t('auth.checkYourEmail')}</h2>
                <p className="text-gray-600 text-sm mb-6" dangerouslySetInnerHTML={{ __html: DOMPurify.sanitize(t('auth.resetLinkSent', { email: `<strong>${forgotEmail}</strong>` })) }} />
                <button
                  onClick={() => navigate('/auth/login')}
                  className="w-full primary-btn"
                >
                  {t('auth.backToLogin')}
                </button>
              </div>
            ) : (
              <>
                <button
                  onClick={() => navigate('/auth/login')}
                  className="flex items-center gap-1 text-sm text-gray-500 hover:text-[var(--brand-primary)] mb-6 transition-colors"
                >
                  <ArrowLeft size={16} />
                  {t('auth.backToLogin')}
                </button>
                <div className="text-center mb-6">
                  <div className="w-14 h-14 bg-[rgb(var(--brand-primary-rgb)/<alpha-value>)]/10 rounded-full flex items-center justify-center mx-auto mb-3">
                    <KeyRound size={24} className="text-[var(--brand-primary)]" />
                  </div>
                  <h2 className="text-2xl font-bold" style={{ fontFamily: 'Playfair Display' }}>{t('auth.forgotPasswordTitle')}</h2>
                  <p className="text-sm text-gray-500 mt-2">{t('auth.forgotPasswordHint')}</p>
                </div>
                <form onSubmit={handleForgotPassword} className="space-y-5" data-testid="forgot-password-form">
                  <div>
                    <label htmlFor="forgot-email" className="block text-sm font-medium mb-2">{t('auth.emailAddress')}</label>
                    <div className="relative">
                      <Mail size={18} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
                      <input
                        id="forgot-email"
                        type="email"
                        value={forgotEmail}
                        onChange={(e) => setForgotEmail(e.target.value)}
                        placeholder={t('auth.emailPlaceholder')}
                        className="w-full pl-10 pr-4 py-3 rounded-lg border border-[#E5E5E5] focus:outline-none focus:ring-2 focus:ring-[rgb(var(--brand-primary-rgb)/<alpha-value>)]/50"
                        required
                        data-testid="forgot-email-input"
                      />
                    </div>
                  </div>
                  <button
                    type="submit"
                    disabled={forgotSending}
                    className="w-full primary-btn disabled:opacity-50"
                    data-testid="forgot-submit-btn"
                  >
                    {forgotSending ? t('auth.sending') : t('auth.resetPasswordBtn')}
                  </button>
                </form>
              </>
            )}
          </div>
        </div>
      </div>
    );
  }

  // --- Reset Password View ---
  if (mode === 'reset-password') {
    // Require a token in the URL — the whole point of the email-link flow is
    // that only someone with the emailed token can reach this form.
    if (!resetToken && !resetDone) {
      return (
        <div className="min-h-screen flex items-center justify-center px-6 pt-20 pb-12" data-testid="reset-password-invalid">
          <div className="w-full max-w-md">
            <div className="bg-white rounded-2xl p-8 border border-[#E5E5E5] text-center">
              <div className="w-14 h-14 bg-red-50 rounded-full flex items-center justify-center mx-auto mb-3">
                <KeyRound size={24} className="text-red-500" />
              </div>
              <h2 className="text-2xl font-bold mb-2" style={{ fontFamily: 'Playfair Display' }}>
                {t('auth.invalidResetLinkTitle', 'Invalid Reset Link')}
              </h2>
              <p className="text-sm text-gray-500 mb-6">
                {t('auth.invalidResetLinkHint', 'This page can only be opened from the secure link in your password-reset email. Please start from “Forgot your password?”.')}
              </p>
              <button
                onClick={() => navigate('/auth/forgot-password')}
                className="w-full primary-btn"
                data-testid="reset-password-restart"
              >
                {t('auth.requestResetEmail', 'Request a Reset Email')}
              </button>
            </div>
          </div>
        </div>
      );
    }
    return (
      <div className="min-h-screen flex items-center justify-center px-6 pt-20 pb-12">
        <div className="w-full max-w-md">
          <div className="bg-white rounded-2xl p-8 border border-[#E5E5E5]">
            {resetDone ? (
              <div className="text-center py-4">
                <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-4">
                  <CheckCircle size={32} className="text-green-600" />
                </div>
                <h2 className="text-2xl font-bold mb-3" style={{ fontFamily: 'Playfair Display' }}>{t('auth.passwordResetTitle')}</h2>
                <p className="text-gray-600 text-sm mb-6">{t('auth.passwordResetSuccess')}</p>
                <button
                  onClick={() => navigate('/auth/login')}
                  className="w-full primary-btn"
                  data-testid="back-to-login-btn"
                >
                  {t('auth.goToLogin')}
                </button>
              </div>
            ) : (
              <>
                <div className="text-center mb-6">
                  <div className="w-14 h-14 bg-[rgb(var(--gold-rgb)/<alpha-value>)]/10 rounded-full flex items-center justify-center mx-auto mb-3">
                    <KeyRound size={24} className="text-[var(--gold)]" />
                  </div>
                  <h2 className="text-2xl font-bold" style={{ fontFamily: 'Playfair Display' }}>{t('auth.setNewPassword')}</h2>
                  <p className="text-sm text-gray-500 mt-2">{t('auth.setNewPasswordHint')}</p>
                </div>
                <form onSubmit={handleResetPassword} className="space-y-5" data-testid="reset-password-form">
                  <div>
                    <label htmlFor="reset-new-password" className="block text-sm font-medium mb-2">{t('auth.newPassword')}</label>
                    <div className="relative">
                      <input
                        id="reset-new-password"
                        type={showResetPassword ? 'text' : 'password'}
                        value={resetPassword}
                        onChange={(e) => setResetPassword(e.target.value)}
                        placeholder={t('auth.newPasswordPlaceholderShort')}
                        className="w-full px-4 py-3 pr-12 rounded-lg border border-[#E5E5E5] focus:outline-none focus:ring-2 focus:ring-[rgb(var(--brand-primary-rgb)/<alpha-value>)]/50"
                        required
                        minLength={6}
                        data-testid="reset-new-password-input"
                      />
                      <button
                        type="button"
                        onClick={() => setShowResetPassword(!showResetPassword)}
                        className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-700"
                      >
                        {showResetPassword ? <Eye size={20} /> : <EyeOff size={20} />}
                      </button>
                    </div>
                  </div>
                  <div>
                    <label htmlFor="reset-confirm-password" className="block text-sm font-medium mb-2">{t('auth.confirmNewPassword')}</label>
                    <input
                      id="reset-confirm-password"
                      type="password"
                      value={resetConfirmPassword}
                      onChange={(e) => setResetConfirmPassword(e.target.value)}
                      placeholder={t('auth.confirmNewPasswordPlaceholder')}
                      className={`w-full px-4 py-3 rounded-lg border focus:outline-none focus:ring-2 focus:ring-[rgb(var(--brand-primary-rgb)/<alpha-value>)]/50 ${resetConfirmPassword && resetConfirmPassword !== resetPassword ? 'border-red-400' : 'border-[#E5E5E5]'}`}
                      required
                      data-testid="reset-confirm-password-input"
                    />
                    {resetConfirmPassword && resetConfirmPassword !== resetPassword && (
                      <p className="text-xs text-red-500 mt-1">{t('auth.passwordMismatch')}</p>
                    )}
                  </div>
                  <button
                    type="submit"
                    disabled={resetting}
                    className="w-full primary-btn disabled:opacity-50"
                    data-testid="reset-submit-btn"
                  >
                    {resetting ? t('auth.resetting') : t('auth.setNewPassword')}
                  </button>
                </form>
              </>
            )}
          </div>
        </div>
      </div>
    );
  }

  // --- Login / Signup View ---
  return (
    <div className="min-h-screen flex items-center justify-center px-6 pt-20 pb-12">
      {showWelcomePopups && <WelcomePopups onDismiss={() => { setShowWelcomePopups(false); navigate(redirectUrl); }} />}
      <OwnerManagementOfferModal
        open={showOwnerOffer}
        onDismiss={() => {
          setShowOwnerOffer(false);
          navigate(redirectUrl);
        }}
      />
      <div className="w-full max-w-md">
        <div className="bg-white rounded-2xl p-8 border border-[#E5E5E5]">
          <h2 className="text-3xl font-bold mb-8 text-center" style={{ fontFamily: 'Playfair Display' }}>
            {mode === 'login' ? t('auth.loginTitle') : t('auth.signupTitle')}
          </h2>

          {/* Track-2: "Continue as X" one-tap re-login. Only shown on
              login mode — on signup the visitor is (by definition) a
              first-time user and shouldn't be nudged into a return flow. */}
          {mode === 'login' && (
            <ContinueAsBanner
              onFocusEmailField={(email) => {
                setFormData((f) => ({ ...f, email }));
                // Focus the password field so the user only has to type
                // their password and hit enter.
                setTimeout(() => {
                  document.querySelector('input[type="password"]')?.focus();
                }, 50);
              }}
            />
          )}

          {/* Google Sign-In — sits above the email/password form so
              returning users don't scroll past it. Same button shape on
              login + signup because the underlying flow is identical
              (we upsert by email server-side). Divider is gated with the
              button so it can't render orphaned when Google is unconfigured. */}
          {GOOGLE_CLIENT_ID && (
            <>
              <GoogleSignInButton className="mb-4" />
              <div className="flex items-center gap-3 mb-6" aria-hidden="true">
                <div className="flex-1 h-px bg-gray-200" />
                <span className="text-xs uppercase tracking-wider text-gray-400">
                  {t('auth.orContinueWith', 'or')}
                </span>
                <div className="flex-1 h-px bg-gray-200" />
              </div>
            </>
          )}

          <form onSubmit={handleSubmit} className="space-y-6" data-testid="auth-form">
            {mode === 'signup' && (
              <div>
                <label htmlFor="auth-name" className="block text-sm font-medium mb-2">{t('auth.name')}</label>
                <input
                  id="auth-name"
                  type="text"
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  className="w-full px-4 py-3 rounded-lg border border-[#E5E5E5] focus:outline-none focus:ring-2 focus:ring-[rgb(var(--brand-primary-rgb)/<alpha-value>)]/50"
                  required
                  data-testid="auth-name-input"
                />
              </div>
            )}

            <div>
              <label htmlFor="auth-email" className="block text-sm font-medium mb-2">{t('auth.email')}</label>
              <input
                id="auth-email"
                type="email"
                value={formData.email}
                onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                className="w-full px-4 py-3 rounded-lg border border-[#E5E5E5] focus:outline-none focus:ring-2 focus:ring-[rgb(var(--brand-primary-rgb)/<alpha-value>)]/50"
                required
                data-testid="auth-email-input"
              />
            </div>

            <div>
              <label htmlFor="auth-password" className="block text-sm font-medium mb-2">{t('auth.password')}</label>
              <div className="relative">
                <input
                  id="auth-password"
                  type={showPassword ? 'text' : 'password'}
                  value={formData.password}
                  onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                  className="w-full px-4 py-3 pr-12 rounded-lg border border-[#E5E5E5] focus:outline-none focus:ring-2 focus:ring-[rgb(var(--brand-primary-rgb)/<alpha-value>)]/50"
                  required
                  data-testid="auth-password-input"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-700 transition-colors"
                  data-testid="toggle-password-visibility"
                >
                  {showPassword ? <Eye size={20} /> : <EyeOff size={20} />}
                </button>
              </div>
              {mode === 'login' && (
                <div className="mt-2 text-right">
                  <a
                    href="/auth/forgot-password"
                    className="text-sm font-medium hover:underline transition-colors"
                    style={{ color: 'var(--gold)' }}
                    data-testid="forgot-password-link"
                  >
                    {t('auth.forgotPassword')}
                  </a>
                </div>
              )}
            </div>

            {mode === 'signup' && (
              <>
                <div>
                  <label htmlFor="auth-confirm-password" className="block text-sm font-medium mb-2">{t('auth.confirmPassword')}</label>
                  <div className="relative">
                    <input
                      id="auth-confirm-password"
                      type={showConfirmPassword ? 'text' : 'password'}
                      value={confirmPassword}
                      onChange={(e) => setConfirmPassword(e.target.value)}
                      className={`w-full px-4 py-3 pr-12 rounded-lg border focus:outline-none focus:ring-2 focus:ring-[rgb(var(--brand-primary-rgb)/<alpha-value>)]/50 ${confirmPassword && confirmPassword !== formData.password ? 'border-red-400' : 'border-[#E5E5E5]'}`}
                      required
                      data-testid="auth-confirm-password-input"
                    />
                    <button
                      type="button"
                      onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-700 transition-colors"
                      data-testid="toggle-confirm-password-visibility"
                    >
                      {showConfirmPassword ? <Eye size={20} /> : <EyeOff size={20} />}
                    </button>
                  </div>
                  {confirmPassword && confirmPassword !== formData.password && (
                    <p className="text-xs text-red-500 mt-1" data-testid="password-mismatch-error">{t('auth.passwordMismatch')}</p>
                  )}
                </div>

                <div>
                  <label htmlFor="auth-phone" className="block text-sm font-medium mb-2">
                    {t('auth.whatsappNumber', 'WhatsApp number')}
                    <span className="text-gray-500 font-normal ml-2 text-xs">
                      ({t('auth.recommendedOptional', 'recommended, optional')})
                    </span>
                  </label>
                  <PhoneInput
                    value={formData.phone}
                    onChange={(v) => setFormData({ ...formData, phone: v })}
                    error={phoneErr}
                    hint={phonePreview(formData.phone)
                      ? t('phone.willDial', {
                          number: phonePreview(formData.phone),
                          defaultValue: `Renters will reach you at ${phonePreview(formData.phone)}`,
                        })
                      : t('auth.whatsappHelp', 'Shown on your listings so renters can WhatsApp you, and used to notify you.')}
                    testid="auth-phone"
                  />
                </div>

                <div>
                  <span id="auth-role-label" className="block text-sm font-medium mb-2">{t('auth.role', 'I want to')}</span>
                  <div className="grid grid-cols-3 gap-2" role="group" aria-labelledby="auth-role-label" data-testid="auth-role-select">
                    {[
                      { value: 'renter', label: t('auth.renter', 'Rent'), sub: t('auth.renterSub', 'Find a home'), Icon: Home },
                      // Group `owner` and `manager` under one "List" card
                      // so the top-level picker stays at three tiles.
                      // Clicking it either selects owner OR expands a
                      // secondary picker (below) — see `listGroupActive`.
                      { value: 'list', label: t('auth.list', 'List a home'), sub: t('auth.listSub', 'Owner or manager'), Icon: Building2 },
                      { value: 'provider', label: t('auth.provider', 'Offer services'), sub: t('auth.providerSub', 'Cleaner, mover, etc.'), Icon: Briefcase },
                    ].map(({ value, label, sub, Icon }) => {
                      const listGroupActive = value === 'list' && (formData.role === 'owner' || formData.role === 'manager');
                      const active = value === 'list' ? listGroupActive : formData.role === value;
                      return (
                        <button
                          type="button"
                          key={value}
                          onClick={() => {
                            if (value === 'list') {
                              // Default to `owner` when the group is first
                              // opened; the secondary picker below lets
                              // the user toggle to `manager` if they run
                              // multiple listings and want bulk-import
                              // + a public agency page with a logo.
                              if (!listGroupActive) setFormData({ ...formData, role: 'owner' });
                            } else {
                              setFormData({ ...formData, role: value });
                            }
                          }}
                          className={`flex flex-col items-start gap-1 rounded-lg border p-3 text-left transition-all ${
                            active
                              ? 'border-[var(--brand-primary)] bg-[rgb(var(--brand-primary-rgb)/<alpha-value>)]/5 ring-2 ring-[rgb(var(--brand-primary-rgb)/<alpha-value>)]/25'
                              : 'border-[#E5E5E5] hover:border-[rgb(var(--brand-primary-rgb)/<alpha-value>)]/50'
                          }`}
                          data-testid={`auth-role-${value}`}
                          aria-pressed={active}
                        >
                          <Icon size={18} className={active ? 'text-[var(--brand-primary)]' : 'text-gray-500'} />
                          <span className="text-sm font-semibold text-gray-900 leading-tight">{label}</span>
                          <span className="text-[11px] text-gray-500 leading-tight">{sub}</span>
                        </button>
                      );
                    })}
                  </div>

                  {/* Secondary picker — appears only when the "List a
                      home" group is active. Owner keeps the flow simple
                      (one or two personal properties, no logo). Manager
                      unlocks bulk CSV/paste import and a public agency
                      page with a custom logo. */}
                  {(formData.role === 'owner' || formData.role === 'manager') && (
                    <div className="mt-3 grid grid-cols-2 gap-2" data-testid="auth-list-subrole">
                      {[
                        { value: 'owner', label: t('auth.ownerSubroleLabel', 'Owner'), sub: t('auth.ownerSub', '1-2 personal properties') },
                        { value: 'manager', label: t('auth.manager', 'Manager'), sub: t('auth.managerSub', 'Multiple listings · bulk import · agency page') },
                      ].map(({ value, label, sub }) => {
                        const isActive = formData.role === value;
                        return (
                          <button
                            type="button"
                            key={value}
                            onClick={() => setFormData({ ...formData, role: value })}
                            className={`flex flex-col items-start gap-0.5 rounded-lg border p-2.5 text-left transition-all ${
                              isActive
                                ? 'border-[var(--brand-primary)] bg-[rgb(var(--brand-primary-rgb)/<alpha-value>)]/5 ring-2 ring-[rgb(var(--brand-primary-rgb)/<alpha-value>)]/25'
                                : 'border-[#E5E5E5] hover:border-[rgb(var(--brand-primary-rgb)/<alpha-value>)]/50'
                            }`}
                            data-testid={`auth-subrole-${value}`}
                            aria-pressed={isActive}
                          >
                            <span className="text-xs font-semibold text-gray-900 leading-tight">{label}</span>
                            <span className="text-[10px] text-gray-500 leading-tight">{sub}</span>
                          </button>
                        );
                      })}
                    </div>
                  )}
                </div>
              </>
            )}

            {mode === 'signup' && (
              <div className="flex items-start gap-3">
                <input
                  type="checkbox"
                  id="terms"
                  checked={termsAccepted}
                  onChange={(e) => setTermsAccepted(e.target.checked)}
                  className="mt-1 w-4 h-4 rounded border-gray-300 accent-[var(--gold)] cursor-pointer"
                  required
                  data-testid="auth-terms-checkbox"
                />
                <label htmlFor="terms" className="text-sm text-gray-600 cursor-pointer leading-snug">
                  {t('auth.agreeToTerms')}{' '}
                  <a href="/terms" target="_blank" className="font-medium underline underline-offset-2" style={{ color: 'var(--gold)' }} data-testid="auth-terms-link">
                    {t('auth.termsAndConditions')}
                  </a>
                </label>
              </div>
            )}

            <button type="submit" className="w-full primary-btn" data-testid="auth-submit-button">
              {mode === 'login' ? t('auth.loginButton', 'Log in') : t('auth.signupButton', 'Create Account')}
            </button>
          </form>

          <div className="mt-6 text-center">
            {(() => {
              // Preserve ?redirect=… across the login↔signup toggle so a user
              // who came from "Book" or "Message Owner" on a property still
              // returns to that property after auth.
              const qs = redirectParam ? `?redirect=${encodeURIComponent(redirectParam)}` : '';
              return mode === 'login' ? (
                <p className="text-sm text-gray-600">
                  {t('auth.noAccount')}{' '}
                  <a href={`/signup${qs}`} className="font-medium" style={{ color: 'var(--brand-primary)' }} data-testid="auth-toggle-link">
                    {t('auth.signUpHere')}
                  </a>
                </p>
              ) : (
                <p className="text-sm text-gray-600">
                  {t('auth.haveAccount')}{' '}
                  <a href={`/auth/login${qs}`} className="font-medium" style={{ color: 'var(--brand-primary)' }} data-testid="auth-toggle-link">
                    {t('auth.loginHere')}
                  </a>
                </p>
              );
            })()}
          </div>
        </div>
      </div>
    </div>
  );
};

export default Auth;
