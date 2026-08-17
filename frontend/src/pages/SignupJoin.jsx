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
import { phoneError, phonePreview } from '../utils/phoneValidation';
import PhoneInput from '../components/common/PhoneInput';
import {
  ArrowLeft, ArrowRight, Check, Eye, EyeOff,
  Plane, Home, Sparkles,
} from 'lucide-react';
import { API, AuthContext } from '../App';
import WelcomePopups from '../components/WelcomePopups';
import OwnerManagementOfferModal from '../components/OwnerManagementOfferModal';
import GoogleSignInButton from '../components/auth/GoogleSignInButton';
import { GOOGLE_CLIENT_ID } from '../components/auth/useGoogleSignIn';

// This page is now the single front door for all three audiences — the
// nav's one CTA points here and the role picker does the routing. That
// makes it a persuasion surface, not just a form, so each card carries a
// one-line reason to pick it. `valueLine` is that line; `learnMore` gives
// the host the full pitch on /why-list, which left the nav but still
// exists as the page it always was.
const ROLE_CARDS = [
  {
    key: 'traveler',
    backendRole: 'renter',
    Icon: Plane,
    tKey: 'signupJoin.traveler',
    defaultLabel: 'Traveler',
    tDescKey: 'signupJoin.travelerDesc',
    defaultDesc: 'I want to book stays and hire local services for my trip',
    tValueKey: 'signupJoin.travelerValue',
    defaultValue: 'free to browse · no booking fees',
    tBadgeKey: 'signupJoin.travelerBadge',
    defaultBadge: 'Most popular',
    tCtaKey: 'signupJoin.travelerCta',
    defaultCta: 'Continue as a traveler',
    tDetailsSubKey: 'signupJoin.travelerDetailsSub',
    defaultDetailsSub: "We'll only email you about your account and stays you care about.",
  },
  {
    key: 'host',
    backendRole: 'owner',
    Icon: Home,
    tKey: 'signupJoin.host',
    defaultLabel: 'Host',
    tDescKey: 'signupJoin.hostDesc',
    defaultDesc: 'I want to list my vacation rental or property',
    tValueKey: 'signupJoin.hostValue',
    defaultValue: 'Free to list · no booking fees · no commission',
    // /why-host, NOT /why-list — the latter is the service-provider value
    // page and would mis-describe itself to a property owner.
    learnMoreHref: '/why-host',
    tLearnMoreKey: 'signupJoin.hostLearnMore',
    defaultLearnMore: 'See how hosting works',
    tBadgeKey: null,
    defaultBadge: null,
    tCtaKey: 'signupJoin.hostCta',
    defaultCta: 'Continue as a host',
    tDetailsSubKey: 'signupJoin.hostDetailsSub',
    defaultDetailsSub: "We'll only email you about your account and bookings on your listings.",
  },
  {
    key: 'provider',
    backendRole: 'provider',
    Icon: Sparkles,
    tKey: 'signupJoin.provider',
    defaultLabel: 'Service Provider',
    tDescKey: 'signupJoin.providerDesc',
    defaultDesc: 'Cleaner, mover, tour guide, or any local service',
    tValueKey: 'signupJoin.providerValue',
    defaultValue: 'Free to list · no booking fees · no commission',
    // /why-list lives here rather than on the Host card: it is the
    // provider value page. This keeps it reachable now that "List / Offer"
    // has left the nav, which was the point of linking it at all.
    learnMoreHref: '/why-list',
    tLearnMoreKey: 'signupJoin.providerLearnMore',
    defaultLearnMore: 'See what providers get',
    tBadgeKey: null,
    defaultBadge: null,
    tCtaKey: 'signupJoin.providerCta',
    defaultCta: 'Continue as a service provider',
    tDetailsSubKey: 'signupJoin.providerDetailsSub',
    defaultDetailsSub: "We'll only email you about your account and requests for your services.",
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

  // Recomputed each render so the message tracks the input without extra
  // state. Empty phone is always fine — the field is optional.
  const phoneErr = phoneError(form.phone, t);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!activeCard) return;
    if (phoneErr) {
      // Blocked rather than saved: an ambiguous number gets no WhatsApp
      // button later and nothing explains why.
      toast.error(phoneErr);
      return;
    }
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
        // Limestone base with a gold and a blue bloom. Was hardcoded
        // rgba() + #FBF7EF from the teal era — the numbers had been
        // find-replaced to the new blue but never moved onto tokens, so
        // this page would not have followed a future palette change.
        background:
          'radial-gradient(1200px 600px at 20% -10%, rgb(var(--gold-rgb) / 0.10), transparent 60%),'
          + ' radial-gradient(900px 500px at 100% 100%, rgb(var(--brand-primary-rgb) / 0.10), transparent 60%),'
          + ' var(--bg)',
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
              className="font-semibold text-[var(--brand-primary)] hover:underline"
              data-testid="signup-login-link"
            >
              {t('signupJoin.logIn', 'Log in')}
            </Link>
          </div>
        </header>

        {/* Step indicator */}
        <div className="mt-6 sm:mt-10 flex items-center gap-3 text-xs font-semibold tracking-wide text-gray-500">
          <span className={`inline-flex h-6 w-6 items-center justify-center rounded-full ${step >= 1 ? 'bg-[var(--brand-primary)] text-white' : 'bg-gray-200 text-gray-500'}`}>1</span>
          <span className={step === 1 ? 'text-[var(--brand-primary)]' : ''}>{t('signupJoin.stepRole', 'YOUR ROLE')}</span>
          <div className="h-px w-8 bg-gray-300" />
          <span className={`inline-flex h-6 w-6 items-center justify-center rounded-full ${step >= 2 ? 'bg-[var(--brand-primary)] text-white' : 'bg-gray-200 text-gray-500'}`}>2</span>
          <span className={step === 2 ? 'text-[var(--brand-primary)]' : ''}>{t('signupJoin.stepDetails', 'YOUR DETAILS')}</span>
        </div>

        {/* STEP 1 — role picker */}
        {step === 1 && (
          <section className="mt-8 sm:mt-12" data-testid="signup-step-role">
            <h1
              className="display-weight text-4xl sm:text-5xl lg:text-6xl font-semibold lg:font-normal tracking-tight"
              // Playfair (Frank Ruhl Libre in Hebrew) via the token, and
              // --ink instead of the leftover #0F3A3A dark teal.
              // font-black is dropped: Playfair ships 600–800 here, so a
              // 900 weight silently fell back to a synthesised bold.
              // A1: extrabold below lg, regular at lg+ where this hits
              // 60px. `lg:font-normal` is needed as well as
              // `.display-weight` because a bare Tailwind utility would
              // otherwise beat the token rule on source order; the class
              // is what carries the RTL 500 override.
              style={{ fontFamily: 'var(--font-head)', color: 'var(--ink)' }}
              data-testid="signup-headline"
            >
              {t('signupJoin.headline', 'Join My Israel Rental')}
            </h1>
            <p className="mt-3 text-base sm:text-lg text-gray-600 max-w-2xl">
              {t('signupJoin.sub', 'Book a stay, list a property, or offer your services — all in one place.')}
            </p>

            <p className="mt-10 sm:mt-14 text-sm font-semibold tracking-wide uppercase text-gray-500">
              {t('signupJoin.question', 'What best describes you?')}
            </p>

            <div
              className="mt-4 grid grid-cols-1 sm:grid-cols-3 gap-4 sm:gap-5"
              data-testid="signup-role-cards"
            >
              {ROLE_CARDS.map(({
                key, Icon, tKey, defaultLabel, tDescKey, defaultDesc,
                tValueKey, defaultValue, learnMoreHref, tLearnMoreKey, defaultLearnMore,
                tBadgeKey, defaultBadge, tCtaKey, defaultCta,
              }) => {
                const active = selectedRole === key;
                return (
                  /* Wrapper exists so the Host card's "See how hosting
                     works" link can be a SIBLING of the selection button.
                     A link inside a button is invalid HTML, and clicking it
                     would also toggle the card. */
                  <div key={key} className="relative flex flex-col h-full">
                  <button
                    type="button"
                    onClick={() => setSelectedRole(key)}
                    className={`group relative w-full flex-1 text-start rounded-2xl border bg-white p-6 sm:p-7 transition-all duration-200 focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--brand-primary)] focus-visible:ring-offset-2 ${
                      // The "See how it works" link used to be pinned to
                      // the card's bottom over reserved padding, which
                      // collided with the CTA row by 7px once B2 grew the
                      // value line and it started wrapping. Bottom padding
                      // could not fix it: the row sits in normal flow after
                      // the content, so it moves down with the content
                      // while the pinned link never moves. The link is now
                      // in flow below the button, where nothing can reach
                      // it. Cards keep equal heights via the flex column.
                      learnMoreHref ? 'rounded-b-none border-b-0' : ''
                    } ${
                      active
                        ? 'border-[var(--brand-primary)] -translate-y-0.5'
                        : 'border-gray-200 hover:border-gray-300 hover:-translate-y-0.5'
                    }`}
                    style={{
                      // Inline rather than a Tailwind arbitrary value: these
                      // shadows carry rgba() with spaces, and an arbitrary
                      // value containing a space is silently dropped. The
                      // selected card had NO shadow because of exactly that.
                      boxShadow: active
                        ? '0 20px 50px -15px rgb(var(--brand-primary-rgb) / 0.35)'
                        : '0 4px 15px -8px rgba(0,0,0,0.15)',
                    }}
                    aria-pressed={active}
                    data-testid={`signup-role-${key}`}
                  >
                    {defaultBadge && (
                      /* Gold pill, matching the badge treatment used across
                         the redesign. Gold fill with brand-primary text —
                         the reverse (gold text on white) fails contrast at
                         this size. */
                      <span
                        className="absolute top-3 end-3 text-[10px] font-bold uppercase tracking-wider px-2.5 py-1 rounded-full"
                        style={{ background: 'var(--gold)', color: 'var(--brand-primary-deep)' }}
                      >
                        {tBadgeKey ? t(tBadgeKey, defaultBadge) : defaultBadge}
                      </span>
                    )}
                    <div
                      className="h-14 w-14 rounded-2xl flex items-center justify-center transition-colors"
                      style={{
                        background: active
                          ? 'linear-gradient(135deg, var(--brand-primary) 0%, var(--brand-primary-dark) 100%)'
                          : 'rgb(var(--brand-primary-rgb) / 0.07)',
                      }}
                    >
                      <Icon size={26} className={active ? 'text-[var(--gold)]' : 'text-[var(--brand-primary)]'} />
                    </div>
                    <h3
                      className="mt-5 text-xl font-bold"
                      style={{ fontFamily: 'var(--font-head)', color: 'var(--ink)' }}
                    >
                      {t(tKey, defaultLabel)}
                    </h3>
                    <p className="mt-1.5 text-sm leading-relaxed" style={{ color: 'var(--brand-muted)' }}>
                      {t(tDescKey, defaultDesc)}
                    </p>

                    {/* The reason to pick this card, in one line. This page
                        is the only supply-side pitch most visitors will
                        see now that the nav's "List / Offer" link is gone,
                        so "free" has to appear on the card itself. */}
                    {tValueKey && (
                      <p
                        // B2: on the two supply-side cards this is the
                        // offer, not a footnote, so it steps up from 12px
                        // fine print to a readable claim. The traveler card
                        // keeps the small treatment — "free to browse" is
                        // expected of any listings site and promoting it
                        // would spend emphasis on the least surprising
                        // thing on the page.
                        className={
                          key === 'traveler'
                            ? 'mt-2.5 text-xs font-bold'
                            : 'mt-3 text-[15px] font-bold leading-snug'
                        }
                        style={{ color: 'var(--gold-text-on-light)' }}
                        data-testid={`signup-role-value-${key}`}
                      >
                        {t(tValueKey, defaultValue)}
                      </p>
                    )}

                    <div className="mt-5 flex items-center justify-between">
                      <span className={`text-xs font-semibold ${active ? 'text-[var(--brand-primary)]' : 'text-gray-400 group-hover:text-gray-600'}`}>
                        {active
                          ? t('signupJoin.selected', 'Selected')
                          : t(tCtaKey, defaultCta)}
                      </span>
                      {active ? (
                        <span className="inline-flex h-6 w-6 items-center justify-center rounded-full bg-[var(--brand-primary)] text-white">
                          <Check size={14} strokeWidth={3} />
                        </span>
                      ) : (
                        <ArrowRight size={16} className="text-gray-400 group-hover:text-[var(--brand-primary)] transition-colors" />
                      )}
                    </div>
                  </button>

                  {/* Host's deeper pitch. /why-list left the nav in this
                      change but is still the page that sells hosting, so
                      the card that cares about it links there directly.
                      Sits over the button's reserved bottom padding. */}
                  {learnMoreHref && (
                    <Link
                      to={learnMoreHref}
                      className="rounded-b-2xl border border-t-0 bg-white px-6 sm:px-7 pb-5 pt-1 inline-flex items-center gap-1 text-xs font-bold hover:underline"
                      style={{ color: 'var(--brand-primary)', borderColor: 'var(--brand-border)' }}
                      data-testid={`signup-role-learnmore-${key}`}
                    >
                      {t(tLearnMoreKey, defaultLearnMore)}
                      <ArrowRight size={12} aria-hidden="true" />
                    </Link>
                  )}
                  </div>
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
                style={{ background: 'var(--brand-primary)', color: 'var(--gold)' }}
                data-testid="signup-continue-btn"
              >
                {t('signupJoin.continue', 'Continue')}
                <ArrowRight size={16} />
              </button>
            </div>

            {/* One-tap Google sign-up — respects the role card the user
                clicked (if any). completeGoogleSignIn picks up `signup_intent_role`
                from sessionStorage after the OAuth roundtrip and promotes
                the fresh account before landing them on the dashboard. */}
            {GOOGLE_CLIENT_ID && (
              <div className="mt-8 max-w-sm mx-auto">
                <div className="flex items-center gap-3 mb-3" aria-hidden="true">
                  <div className="flex-1 h-px bg-gray-200" />
                  <span className="text-xs uppercase tracking-wider text-gray-400">
                    {t('signupJoin.orQuickSignup', 'or sign up in one tap')}
                  </span>
                  <div className="flex-1 h-px bg-gray-200" />
                </div>
                <GoogleSignInButton intentRole={activeCard?.backendRole || ''} />
              </div>
            )}

            <p className="mt-10 text-center sm:hidden text-sm text-gray-600">
              {t('signupJoin.haveAccount', 'Already have an account?')}{' '}
              <Link to={loginHref} className="font-semibold text-[var(--brand-primary)]" data-testid="signup-login-link-mobile">
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
              className="inline-flex items-center gap-2 text-sm font-semibold text-gray-600 hover:text-[var(--brand-primary)] transition-colors"
              data-testid="signup-back-btn"
            >
              <ArrowLeft size={16} />
              {t('signupJoin.back', 'Back to role')}
            </button>

            <div className="mt-6 max-w-xl">
              <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-[rgb(var(--brand-primary-rgb)/<alpha-value>)]/8 text-[var(--brand-primary)] text-xs font-semibold">
                <activeCard.Icon size={14} />
                {t('signupJoin.signingUpAs', 'Signing up as')} · {t(activeCard.tKey, activeCard.defaultLabel)}
              </div>
              <h1
                className="mt-4 text-3xl sm:text-4xl font-extrabold tracking-tight"
                style={{ fontFamily: 'var(--font-head)', color: 'var(--ink)' }}
              >
                {t('signupJoin.detailsHeadline', 'Create your account')}
              </h1>
              <p className="mt-2 text-sm text-gray-600">
                {t(activeCard.tDetailsSubKey, activeCard.defaultDetailsSub)}
              </p>

              {/* Google Sign-In — one-tap alternative to the multi-field
                  form. On success, the visitor lands at /dashboard as a
                  freshly-created `renter` (the least-privileged role);
                  they can promote themselves to owner/provider later
                  from the dashboard. See completeGoogleSignIn.js. */}
              {GOOGLE_CLIENT_ID && (
                <div className="mt-6">
                  <GoogleSignInButton intentRole={activeCard?.backendRole || ''} />
                  <div className="flex items-center gap-3 mt-4 mb-1" aria-hidden="true">
                    <div className="flex-1 h-px bg-gray-200" />
                    <span className="text-xs uppercase tracking-wider text-gray-400">
                      {t('auth.orContinueWith', 'or')}
                    </span>
                    <div className="flex-1 h-px bg-gray-200" />
                  </div>
                </div>
              )}

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
                    className="w-full rounded-xl border border-gray-200 bg-white px-4 py-3 text-sm focus:outline-none focus:border-[var(--brand-primary)] focus:ring-2 focus:ring-[rgb(var(--brand-primary-rgb)/<alpha-value>)]/20"
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
                    className="w-full rounded-xl border border-gray-200 bg-white px-4 py-3 text-sm focus:outline-none focus:border-[var(--brand-primary)] focus:ring-2 focus:ring-[rgb(var(--brand-primary-rgb)/<alpha-value>)]/20"
                    placeholder="you@example.com"
                    data-testid="signup-email-input"
                  />
                </Field>
                <Field
                  label={t('signupJoin.phone', 'Phone')}
                  optional
                  testId="signup-phone"
                >
                  <PhoneInput
                    value={form.phone}
                    onChange={(v) => setForm({ ...form, phone: v })}
                    error={phoneErr}
                    hint={phonePreview(form.phone)
                      ? t('phone.willDial', {
                          number: phonePreview(form.phone),
                          defaultValue: `Renters will reach you at ${phonePreview(form.phone)}`,
                        })
                      : ''}
                    testid="signup-phone"
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
                      className="w-full rounded-xl border border-gray-200 bg-white px-4 py-3 pe-11 text-sm focus:outline-none focus:border-[var(--brand-primary)] focus:ring-2 focus:ring-[rgb(var(--brand-primary-rgb)/<alpha-value>)]/20"
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
                      className="w-full rounded-xl border border-gray-200 bg-white px-4 py-3 pe-11 text-sm focus:outline-none focus:border-[var(--brand-primary)] focus:ring-2 focus:ring-[rgb(var(--brand-primary-rgb)/<alpha-value>)]/20"
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
                    className="mt-1 h-4 w-4 rounded border-gray-300 accent-[var(--gold)]"
                    required
                    data-testid="signup-terms-checkbox"
                  />
                  <span className="text-sm text-gray-600 leading-snug">
                    {t('signupJoin.agree', 'I agree to the')}{' '}
                    <a href="/terms" target="_blank" rel="noreferrer" className="font-semibold text-[var(--brand-primary)] underline underline-offset-2">
                      {t('signupJoin.terms', 'Terms & Privacy Policy')}
                    </a>
                  </span>
                </label>

                <button
                  type="submit"
                  disabled={submitting}
                  className="w-full mt-2 inline-flex items-center justify-center gap-2 rounded-full px-8 py-3.5 text-sm font-bold shadow-lg transition-all hover:shadow-xl hover:-translate-y-0.5 disabled:opacity-60 disabled:cursor-not-allowed"
                  style={{ background: 'var(--brand-primary)', color: 'var(--gold)' }}
                  data-testid="signup-submit-btn"
                >
                  {submitting
                    ? t('signupJoin.creating', 'Creating your account…')
                    : t('signupJoin.createAccount', 'Create account')}
                </button>

                <p className="text-center text-sm text-gray-600 pt-2">
                  {t('signupJoin.haveAccount', 'Already have an account?')}{' '}
                  <Link to={loginHref} className="font-semibold text-[var(--brand-primary)]" data-testid="signup-login-link-form">
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
