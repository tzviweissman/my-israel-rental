/**
 * Dedicated "Join My Israel Rental" signup screen.
 *
 * Two-step wizard:
 *   1. Role selection — three big cards (Traveler / Host / Service Provider)
 *      mapped to the existing backend roles (renter / owner / provider).
 *   2. Account details — name, email, phone, password + terms.
 *
 * Intentionally kept as a separate page from /auth/login so the funnel
 * feels welcoming rather than "yet another form". Redirects, welcome
 * modals, and post-signup upsells mirror /pages/Auth.js so the two paths
 * stay behaviourally identical from the app's perspective.
 */
import React, { useContext, useMemo, useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import axios from 'axios';
import { toast } from 'sonner';
import {
  ArrowLeft, ArrowRight, Check, Eye, EyeOff,
  Plane, Home, Sparkles,
} from 'lucide-react';
import { API, AuthContext } from '../App';
import WelcomePopups from '../components/WelcomePopups';
import OwnerManagementOfferModal from '../components/OwnerManagementOfferModal';

const ROLE_CARDS = [
  {
    key: 'traveler',
    backendRole: 'renter',
    Icon: Plane,
    tKey: 'signupJoin.traveler',
    defaultLabel: 'Traveler',
    tDescKey: 'signupJoin.travelerDesc',
    defaultDesc: 'I want to book stays and hire local services for my trip',
    tBadgeKey: 'signupJoin.travelerBadge',
    defaultBadge: 'Most popular',
  },
  {
    key: 'host',
    backendRole: 'owner',
    Icon: Home,
    tKey: 'signupJoin.host',
    defaultLabel: 'Host',
    tDescKey: 'signupJoin.hostDesc',
    defaultDesc: 'I want to list my vacation rental or property',
    tBadgeKey: null,
    defaultBadge: null,
  },
  {
    key: 'provider',
    backendRole: 'provider',
    Icon: Sparkles,
    tKey: 'signupJoin.provider',
    defaultLabel: 'Service Provider',
    tDescKey: 'signupJoin.providerDesc',
    defaultDesc: 'Cleaner, mover, tour guide, or any local service',
    tBadgeKey: null,
    defaultBadge: null,
  },
];

const SignupJoin = () => {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { login } = useContext(AuthContext);

  const redirectParam = searchParams.get('redirect');
  const loginHref = useMemo(
    () => `/auth/login${redirectParam ? `?redirect=${encodeURIComponent(redirectParam)}` : ''}`,
    [redirectParam],
  );

  const [step, setStep] = useState(1);
  const [selectedRole, setSelectedRole] = useState(null); // "traveler" | "host" | "provider"
  const [form, setForm] = useState({ name: '', email: '', phone: '', password: '' });
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPwd, setShowPwd] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const [termsAccepted, setTermsAccepted] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  // Post-signup modals (mirrors Auth.js behaviour so the two entry
  // points feel identical after account creation).
  const [showWelcomePopups, setShowWelcomePopups] = useState(false);
  const [showOwnerOffer, setShowOwnerOffer] = useState(false);

  const activeCard = ROLE_CARDS.find((r) => r.key === selectedRole);

  const handleContinue = () => {
    if (!selectedRole) return;
    setStep(2);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!activeCard) return;
    if (form.password.length < 6) {
      toast.error(t('auth.passwordTooShort', 'Password must be at least 6 characters.'));
      return;
    }
    if (form.password !== confirmPassword) {
      toast.error(t('auth.passwordMismatch', 'Passwords do not match.'));
      return;
    }
    if (!termsAccepted) {
      toast.error(t('auth.mustAcceptTerms', 'You must accept the terms and conditions.'));
      return;
    }
    setSubmitting(true);
    try {
      const payload = { ...form, role: activeCard.backendRole };
      const res = await axios.post(`${API}/auth/register`, payload);
      login(res.data.token, res.data.user);
      toast.success(t('auth.accountCreated', 'Account created — welcome!'));
      if (activeCard.backendRole === 'renter') {
        setShowWelcomePopups(true);
      } else if (activeCard.backendRole === 'owner') {
        setShowOwnerOffer(true);
      } else if (activeCard.backendRole === 'provider') {
        navigate('/services/create-gig');
      } else {
        navigate(redirectParam || '/dashboard');
      }
    } catch (err) {
      toast.error(err.response?.data?.detail || t('auth.failed', 'Something went wrong. Please try again.'));
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div
      className="min-h-screen relative overflow-hidden"
      style={{
        // Soft sand-to-white wash keeps the Ocean Teal + Gold brand
        // primary while giving the screen a warm, welcoming atmosphere.
        background: 'radial-gradient(1200px 600px at 20% -10%, rgba(212,175,55,0.10), transparent 60%), radial-gradient(900px 500px at 100% 100%, rgba(30,106,106,0.10), transparent 60%), #FBF7EF',
      }}
      data-testid="signup-join-page"
    >
      <div className="mx-auto max-w-6xl px-4 sm:px-6 pt-24 sm:pt-28 pb-12">
        {/* Top-right: log-in shortcut. The global fixed nav already
            shows the brand mark so we don't duplicate it here. */}
        <header className="flex items-center justify-end">
          <div className="flex items-center gap-2 text-sm text-gray-600">
            {t('signupJoin.haveAccount', 'Already have an account?')}
            <Link
              to={loginHref}
              className="font-semibold text-[#1E6A6A] hover:underline"
              data-testid="signup-login-link"
            >
              {t('signupJoin.logIn', 'Log in')}
            </Link>
          </div>
        </header>

        {/* Step indicator */}
        <div className="mt-6 sm:mt-10 flex items-center gap-3 text-xs font-semibold tracking-wide text-gray-500">
          <span className={`inline-flex h-6 w-6 items-center justify-center rounded-full ${step >= 1 ? 'bg-[#1E6A6A] text-white' : 'bg-gray-200 text-gray-500'}`}>1</span>
          <span className={step === 1 ? 'text-[#1E6A6A]' : ''}>{t('signupJoin.stepRole', 'YOUR ROLE')}</span>
          <div className="h-px w-8 bg-gray-300" />
          <span className={`inline-flex h-6 w-6 items-center justify-center rounded-full ${step >= 2 ? 'bg-[#1E6A6A] text-white' : 'bg-gray-200 text-gray-500'}`}>2</span>
          <span className={step === 2 ? 'text-[#1E6A6A]' : ''}>{t('signupJoin.stepDetails', 'YOUR DETAILS')}</span>
        </div>

        {/* STEP 1 — role picker */}
        {step === 1 && (
          <section className="mt-8 sm:mt-12" data-testid="signup-step-role">
            <h1
              className="text-4xl sm:text-5xl lg:text-6xl font-black tracking-tight text-[#0F3A3A]"
              data-testid="signup-headline"
            >
              {t('signupJoin.headline', 'Join My Israel Rental')}
            </h1>
            <p className="mt-3 text-base sm:text-lg text-gray-600 max-w-2xl">
              {t('signupJoin.sub', 'Plan your perfect Israel trip — stays & local services in one place.')}
            </p>

            <p className="mt-10 sm:mt-14 text-sm font-semibold tracking-wide uppercase text-gray-500">
              {t('signupJoin.question', 'What best describes you?')}
            </p>

            <div
              className="mt-4 grid grid-cols-1 sm:grid-cols-3 gap-4 sm:gap-5"
              data-testid="signup-role-cards"
            >
              {ROLE_CARDS.map(({ key, Icon, tKey, defaultLabel, tDescKey, defaultDesc, tBadgeKey, defaultBadge }) => {
                const active = selectedRole === key;
                return (
                  <button
                    type="button"
                    key={key}
                    onClick={() => setSelectedRole(key)}
                    className={`group relative text-start rounded-2xl border bg-white p-6 sm:p-7 transition-all duration-200 focus:outline-none focus-visible:ring-2 focus-visible:ring-[#1E6A6A] focus-visible:ring-offset-2 ${
                      active
                        ? 'border-[#1E6A6A] shadow-[0_20px_50px_-15px_rgba(30,106,106,0.35)] -translate-y-0.5'
                        : 'border-gray-200 shadow-[0_4px_15px_-8px_rgba(0,0,0,0.15)] hover:border-gray-300 hover:shadow-[0_20px_40px_-20px_rgba(0,0,0,0.25)] hover:-translate-y-0.5'
                    }`}
                    aria-pressed={active}
                    data-testid={`signup-role-${key}`}
                  >
                    {defaultBadge && (
                      <span
                        className="absolute top-3 end-3 text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full"
                        style={{ background: '#D4AF37', color: '#1E6A6A' }}
                      >
                        {tBadgeKey ? t(tBadgeKey, defaultBadge) : defaultBadge}
                      </span>
                    )}
                    <div
                      className="h-14 w-14 rounded-2xl flex items-center justify-center transition-colors"
                      style={{
                        background: active
                          ? 'linear-gradient(135deg, #1E6A6A 0%, #2B8686 100%)'
                          : 'linear-gradient(135deg, rgba(30,106,106,0.08), rgba(30,106,106,0.03))',
                      }}
                    >
                      <Icon size={26} className={active ? 'text-[#D4AF37]' : 'text-[#1E6A6A]'} />
                    </div>
                    <h3 className="mt-5 text-xl font-bold text-[#0F3A3A]">
                      {t(tKey, defaultLabel)}
                    </h3>
                    <p className="mt-1.5 text-sm text-gray-600 leading-relaxed">
                      {t(tDescKey, defaultDesc)}
                    </p>

                    <div className="mt-5 flex items-center justify-between">
                      <span className={`text-xs font-semibold ${active ? 'text-[#1E6A6A]' : 'text-gray-400 group-hover:text-gray-600'}`}>
                        {active
                          ? t('signupJoin.selected', 'Selected')
                          : t('signupJoin.chooseThis', 'Choose this')}
                      </span>
                      {active ? (
                        <span className="inline-flex h-6 w-6 items-center justify-center rounded-full bg-[#1E6A6A] text-white">
                          <Check size={14} strokeWidth={3} />
                        </span>
                      ) : (
                        <ArrowRight size={16} className="text-gray-400 group-hover:text-[#1E6A6A] transition-colors" />
                      )}
                    </div>
                  </button>
                );
              })}
            </div>

            <div className="mt-8 sm:mt-10 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
              <p className="text-xs text-gray-500 max-w-md">
                {t('signupJoin.roleHint', 'You can always add another role later from your account settings.')}
              </p>
              <button
                type="button"
                onClick={handleContinue}
                disabled={!selectedRole}
                className="inline-flex items-center gap-2 rounded-full px-8 py-3 text-sm font-bold shadow-lg transition-all disabled:opacity-40 disabled:cursor-not-allowed hover:shadow-xl hover:-translate-y-0.5"
                style={{ background: '#1E6A6A', color: '#D4AF37' }}
                data-testid="signup-continue-btn"
              >
                {t('signupJoin.continue', 'Continue')}
                <ArrowRight size={16} />
              </button>
            </div>

            <p className="mt-10 text-center sm:hidden text-sm text-gray-600">
              {t('signupJoin.haveAccount', 'Already have an account?')}{' '}
              <Link to={loginHref} className="font-semibold text-[#1E6A6A]" data-testid="signup-login-link-mobile">
                {t('signupJoin.logIn', 'Log in')}
              </Link>
            </p>
          </section>
        )}

        {/* STEP 2 — details form */}
        {step === 2 && activeCard && (
          <section className="mt-8 sm:mt-12" data-testid="signup-step-details">
            <button
              type="button"
              onClick={() => setStep(1)}
              className="inline-flex items-center gap-2 text-sm font-semibold text-gray-600 hover:text-[#1E6A6A] transition-colors"
              data-testid="signup-back-btn"
            >
              <ArrowLeft size={16} />
              {t('signupJoin.back', 'Back to role')}
            </button>

            <div className="mt-6 max-w-xl">
              <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-[#1E6A6A]/8 text-[#1E6A6A] text-xs font-semibold">
                <activeCard.Icon size={14} />
                {t('signupJoin.signingUpAs', 'Signing up as')} · {t(activeCard.tKey, activeCard.defaultLabel)}
              </div>
              <h1 className="mt-4 text-3xl sm:text-4xl font-black tracking-tight text-[#0F3A3A]">
                {t('signupJoin.detailsHeadline', 'Create your account')}
              </h1>
              <p className="mt-2 text-sm text-gray-600">
                {t('signupJoin.detailsSub', "We'll only email you about your account and listings you care about.")}
              </p>

              <form onSubmit={handleSubmit} className="mt-8 space-y-4" data-testid="signup-form">
                <Field
                  label={t('signupJoin.fullName', 'Full name')}
                  testId="signup-name"
                >
                  <input
                    type="text"
                    required
                    autoComplete="name"
                    value={form.name}
                    onChange={(e) => setForm({ ...form, name: e.target.value })}
                    className="w-full rounded-xl border border-gray-200 bg-white px-4 py-3 text-sm focus:outline-none focus:border-[#1E6A6A] focus:ring-2 focus:ring-[#1E6A6A]/20"
                    placeholder={t('signupJoin.fullNamePh', 'Jane Doe')}
                    data-testid="signup-name-input"
                  />
                </Field>
                <Field label={t('signupJoin.email', 'Email')} testId="signup-email">
                  <input
                    type="email"
                    required
                    autoComplete="email"
                    value={form.email}
                    onChange={(e) => setForm({ ...form, email: e.target.value })}
                    className="w-full rounded-xl border border-gray-200 bg-white px-4 py-3 text-sm focus:outline-none focus:border-[#1E6A6A] focus:ring-2 focus:ring-[#1E6A6A]/20"
                    placeholder="you@example.com"
                    data-testid="signup-email-input"
                  />
                </Field>
                <Field
                  label={t('signupJoin.phone', 'Phone')}
                  optional
                  testId="signup-phone"
                >
                  <input
                    type="tel"
                    autoComplete="tel"
                    value={form.phone}
                    onChange={(e) => setForm({ ...form, phone: e.target.value })}
                    className="w-full rounded-xl border border-gray-200 bg-white px-4 py-3 text-sm focus:outline-none focus:border-[#1E6A6A] focus:ring-2 focus:ring-[#1E6A6A]/20"
                    placeholder="+972 50 123 4567"
                    data-testid="signup-phone-input"
                  />
                </Field>
                <Field label={t('signupJoin.password', 'Password')} testId="signup-password">
                  <div className="relative">
                    <input
                      type={showPwd ? 'text' : 'password'}
                      required
                      minLength={6}
                      autoComplete="new-password"
                      value={form.password}
                      onChange={(e) => setForm({ ...form, password: e.target.value })}
                      className="w-full rounded-xl border border-gray-200 bg-white px-4 py-3 pe-11 text-sm focus:outline-none focus:border-[#1E6A6A] focus:ring-2 focus:ring-[#1E6A6A]/20"
                      placeholder={t('signupJoin.passwordPh', 'At least 6 characters')}
                      data-testid="signup-password-input"
                    />
                    <button
                      type="button"
                      onClick={() => setShowPwd((s) => !s)}
                      className="absolute end-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
                      aria-label={showPwd ? 'Hide password' : 'Show password'}
                      data-testid="signup-password-toggle"
                    >
                      {showPwd ? <EyeOff size={18} /> : <Eye size={18} />}
                    </button>
                  </div>
                </Field>
                <Field label={t('signupJoin.confirmPassword', 'Confirm password')} testId="signup-confirm">
                  <div className="relative">
                    <input
                      type={showConfirm ? 'text' : 'password'}
                      required
                      minLength={6}
                      autoComplete="new-password"
                      value={confirmPassword}
                      onChange={(e) => setConfirmPassword(e.target.value)}
                      className="w-full rounded-xl border border-gray-200 bg-white px-4 py-3 pe-11 text-sm focus:outline-none focus:border-[#1E6A6A] focus:ring-2 focus:ring-[#1E6A6A]/20"
                      data-testid="signup-confirm-input"
                    />
                    <button
                      type="button"
                      onClick={() => setShowConfirm((s) => !s)}
                      className="absolute end-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
                      aria-label={showConfirm ? 'Hide password' : 'Show password'}
                      data-testid="signup-confirm-toggle"
                    >
                      {showConfirm ? <EyeOff size={18} /> : <Eye size={18} />}
                    </button>
                  </div>
                </Field>

                <label className="flex items-start gap-3 pt-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={termsAccepted}
                    onChange={(e) => setTermsAccepted(e.target.checked)}
                    className="mt-1 h-4 w-4 rounded border-gray-300 accent-[#D4AF37]"
                    data-testid="signup-terms-checkbox"
                  />
                  <span className="text-sm text-gray-600 leading-snug">
                    {t('signupJoin.agree', 'I agree to the')}{' '}
                    <a href="/terms" target="_blank" rel="noreferrer" className="font-semibold text-[#1E6A6A] underline underline-offset-2">
                      {t('signupJoin.terms', 'Terms & Privacy Policy')}
                    </a>
                  </span>
                </label>

                <button
                  type="submit"
                  disabled={submitting}
                  className="w-full mt-2 inline-flex items-center justify-center gap-2 rounded-full px-8 py-3.5 text-sm font-bold shadow-lg transition-all hover:shadow-xl hover:-translate-y-0.5 disabled:opacity-60 disabled:cursor-not-allowed"
                  style={{ background: '#1E6A6A', color: '#D4AF37' }}
                  data-testid="signup-submit-btn"
                >
                  {submitting
                    ? t('signupJoin.creating', 'Creating your account…')
                    : t('signupJoin.createAccount', 'Create account')}
                </button>

                <p className="text-center text-sm text-gray-600 pt-2">
                  {t('signupJoin.haveAccount', 'Already have an account?')}{' '}
                  <Link to={loginHref} className="font-semibold text-[#1E6A6A]" data-testid="signup-login-link-form">
                    {t('signupJoin.logIn', 'Log in')}
                  </Link>
                </p>
              </form>
            </div>
          </section>
        )}
      </div>

      {/* Post-signup modals (renter welcome + owner upsell), mirrored
          from Auth.js so the two entry points behave identically. */}
      {showWelcomePopups && (
        <WelcomePopups
          onDismiss={() => {
            setShowWelcomePopups(false);
            navigate(redirectParam || '/dashboard');
          }}
        />
      )}
      <OwnerManagementOfferModal
        open={showOwnerOffer}
        onDismiss={() => {
          setShowOwnerOffer(false);
          navigate(redirectParam || '/dashboard');
        }}
      />
    </div>
  );
};

// Small internal helper — keeps each field consistent without pulling
// in a form-lib for a five-field screen.
const Field = ({ label, optional, testId, children }) => (
  <div data-testid={`${testId}-field`}>
    <label className="block text-xs font-semibold uppercase tracking-wide text-gray-500 mb-1.5">
      {label}
      {optional && (
        <span className="ms-1.5 normal-case text-gray-400 font-normal">(optional)</span>
      )}
    </label>
    {children}
  </div>
);

export default SignupJoin;
