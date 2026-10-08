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
import React, { useContext, useEffect, useMemo, useState } from 'react';
import { useFormDraft, readDraft, clearDraft } from '../hooks/useFormDraft';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import axios from 'axios';
import { toast } from 'sonner';
import { phoneError, phonePreview } from '../utils/phoneValidation';
import { apiErrorMessage } from '../utils/apiError';
import PhoneInput from '../components/common/PhoneInput';
import {
  ArrowLeft, ArrowRight, Check, Eye, EyeOff,
  Plane, Home, Sparkles,
} from 'lucide-react';
import { API, AuthContext } from '../App';
import WelcomePopups from '../components/WelcomePopups';
import GoogleSignInButton from '../components/auth/GoogleSignInButton';
import AuthShell from '../components/auth/AuthShell';

// Namespaced so it cannot collide with the listing wizard's draft.
const SIGNUP_DRAFT = 'signup-join';
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
    defaultValue: 'Free to browse · no booking fees',
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
    defaultLearnMore: 'See what business owners get',
    tBadgeKey: null,
    defaultBadge: null,
    tCtaKey: 'signupJoin.providerCta',
    defaultCta: 'Continue as a business owner',
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

  // Signing up is a multi-step form like the listing wizards, and until
  // now it kept nothing: leaving the page and coming back put you on step
  // one with the name, email and phone blank again. Reported by someone
  // who was halfway through adding a business.
  //
  // The PASSWORD IS DELIBERATELY NOT SAVED, here or anywhere. A draft
  // lives in localStorage, which is readable by any script on the origin
  // and survives on a shared or stolen device — convenience is not worth
  // leaving a password lying there, and someone re-typing one field is a
  // far smaller cost than the rest of the form. Same for the
  // confirmation field.
  const savedSignup = readDraft(SIGNUP_DRAFT);
  const [step, setStep] = useState(() => savedSignup?.step || 1);
  const [selectedRole, setSelectedRole] = useState(() => savedSignup?.selectedRole || null); // "traveler" | "host" | "provider"
  const [form, setForm] = useState(() => ({
    name: '', email: '', phone: '',
    ...(savedSignup?.form || {}),
    // Last, and unconditional: a password must never come back from a
    // draft even if an older build once wrote one.
    password: '',
  }));
  const [showPwd, setShowPwd] = useState(false);
  // Never saved either (see above).
  const [confirmPwd, setConfirmPwd] = useState('');
  const pwdMismatch = confirmPwd.length > 0 && confirmPwd !== form.password;
  const [termsAccepted, setTermsAccepted] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [signedUp, setSignedUp] = useState(false);
  // `password` is destructured out and thrown away rather than filtered
  // later, so there is no path where it reaches storage.
  useFormDraft(
    SIGNUP_DRAFT,
    { step, selectedRole, form: { name: form.name, email: form.email, phone: form.phone } },
    !signedUp,
  );

  // Post-signup modals (mirrors Auth.js behaviour so the two entry
  // points feel identical after account creation).
  const [showWelcomePopups, setShowWelcomePopups] = useState(false);

  const activeCard = ROLE_CARDS.find((r) => r.key === selectedRole);

  const handleContinue = () => {
    if (!selectedRole) return;
    setStep(2);
  };
  // Each step opens at its top: Continue sits below the role list, and
  // the form used to open scrolled to where the list ended.
  const stepShown = React.useRef(step);
  useEffect(() => {
    if (stepShown.current === step) return;
    stepShown.current = step;
    window.scrollTo({ top: 0, behavior: 'auto' });
  }, [step]);

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
    if (confirmPwd !== form.password) {
      toast.error(t('auth.passwordMismatch', 'Passwords do not match'));
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
      // Cleared before navigating: the account exists now, so the draft
      // is spent. Flag first so the debounced save cannot rewrite it.
      setSignedUp(true);
      clearDraft(SIGNUP_DRAFT);
      login(res.data.token, res.data.user);
      toast.success(t('auth.accountCreated', 'Account created - welcome!'));
      if (activeCard.backendRole === 'renter') {
        setShowWelcomePopups(true);
      } else if (activeCard.backendRole === 'owner') {
        // Straight into "Add a property" (Dashboard opens it on
        // ?welcome=1). A property-management sales pop-up stood here and
        // was removed (Tzvi, 23 Sep 2026): the first thing a new host
        // sees is their own listing, not an offer.
        navigate(redirectParam || '/dashboard?welcome=1');
      } else if (activeCard.backendRole === 'provider') {
        // Someone who came to post a job goes back to posting it, not to
        // "Add your business". (Dead-ends audit 2026-09-03, #6.)
        navigate(redirectParam || '/businesses/add');
      } else {
        navigate(redirectParam || '/dashboard');
      }
    } catch (err) {
      // See Auth.js — the signup path is where the incident happened.
      toast.error(apiErrorMessage(err, t('auth.failed', 'Something went wrong. Please try again.'), t), { duration: 8000 });
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <>
    <AuthShell testId="signup-join-page">
        {/* Step indicator */}
        <div className="flex items-center gap-3 [@media(max-height:760px)]:hidden text-xs font-semibold tracking-wide text-gray-500">
          <span className={`inline-flex h-6 w-6 items-center justify-center rounded-full ${step >= 1 ? 'bg-[var(--brand-primary)] text-white' : 'bg-gray-200 text-gray-700'}`}>1</span>
          <span className={step === 1 ? 'text-[var(--brand-primary)]' : ''}>{t('signupJoin.stepRole', 'YOUR ROLE')}</span>
          <div className="h-px w-8 bg-gray-300" />
          <span className={`inline-flex h-6 w-6 items-center justify-center rounded-full ${step >= 2 ? 'bg-[var(--brand-primary)] text-white' : 'bg-gray-200 text-gray-700'}`}>2</span>
          <span className={step === 2 ? 'text-[var(--brand-primary)]' : ''}>{t('signupJoin.stepDetails', 'YOUR DETAILS')}</span>
        </div>

        {/* STEP 1 — role picker */}
        {step === 1 && (
          <section className="mt-6 [@media(max-height:760px)]:mt-0" data-testid="signup-step-role">
            <h1
              className="display-weight text-3xl sm:text-4xl font-semibold lg:font-normal tracking-tight"
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
            <p className="mt-2 text-base text-gray-600 [@media(max-height:760px)]:hidden">
              {t('signupJoin.sub', 'Book a stay, list a property, or offer your services - all in one place.')}
            </p>

            <p className="mt-6 text-xs font-semibold tracking-wide uppercase text-gray-500 [@media(max-height:680px)]:hidden">
              {t('signupJoin.question', 'What best describes you?')}
            </p>

            {/* The three roles as one list of rows (redesign, 7 Oct 2026):
                icon, who it is for, what it costs, and a round mark that
                fills when chosen. The tall cards with their own "Continue
                as" line and arrow made three choices take two screens; a
                choice is a tile you tap, and the one button below is the
                only action (page rules 3c: choices are tiles, one quiet
                system, no arrows that do nothing). The "Most popular"
                badge is gone: nothing measured it. */}
            <div className="mt-3 [@media(max-height:680px)]:mt-4 space-y-2.5" role="radiogroup" aria-label={t('signupJoin.question', 'What best describes you?')} data-testid="signup-role-cards">
              {ROLE_CARDS.map(({
                key, Icon, tKey, defaultLabel, tDescKey, defaultDesc,
                tValueKey, defaultValue, learnMoreHref, tLearnMoreKey, defaultLearnMore,
              }) => {
                const active = selectedRole === key;
                return (
                  /* The learn-more link is a SIBLING of the choice button
                     (a link inside a button is invalid, and clicking it
                     would also choose the row); the frame holds both. */
                  <div
                    key={key}
                    className="rounded-2xl border bg-white transition-colors"
                    style={{
                      borderColor: active ? 'var(--brand-primary)' : 'var(--brand-border)',
                      background: active ? 'rgb(var(--brand-primary-rgb) / 0.04)' : 'var(--surface, #fff)',
                      boxShadow: active ? '0 0 0 1px var(--brand-primary)' : 'none',
                    }}
                  >
                    <button
                      type="button"
                      role="radio"
                      aria-checked={active}
                      onClick={() => setSelectedRole(key)}
                      onDoubleClick={() => { setSelectedRole(key); setStep(2); }}
                      className="w-full flex items-start gap-3.5 p-3.5 text-start rounded-2xl focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--brand-primary)] focus-visible:ring-offset-2 active:scale-[0.995] transition-transform"
                      data-testid={`signup-role-${key}`}
                    >
                      <span
                        className={`shrink-0 h-10 w-10 rounded-xl flex items-center justify-center transition-colors ${active ? 'text-white' : 'text-[var(--brand-primary)]'}`}
                        style={{ background: active ? 'var(--brand-primary)' : 'rgb(var(--brand-primary-rgb) / 0.08)' }}
                      >
                        <Icon size={20} aria-hidden="true" />
                      </span>
                      <span className="min-w-0 flex-1">
                        <span className="block text-base font-semibold leading-tight" style={{ fontFamily: 'var(--font-head)', color: 'var(--ink)' }}>
                          {t(tKey, defaultLabel)}
                        </span>
                        <span className="mt-0.5 block text-sm leading-snug" style={{ color: 'var(--brand-muted)' }}>
                          {t(tDescKey, defaultDesc)}
                        </span>
                        {tValueKey && (
                          /* Each part with its own tick, not dots between them: a
                             dot left at a line end on a phone reads as a stray
                             mark, and bare spacing ran the parts together. */
                          <span className="mt-1 flex flex-wrap gap-x-3 gap-y-0.5 text-[13px] font-semibold" style={{ color: 'var(--gold-text-on-light)' }} data-testid={`signup-role-value-${key}`}>
                            {t(tValueKey, defaultValue).split(/\s*·\s*/).map((part) => (
                              <span key={part} className="inline-flex items-center gap-1 first-letter:uppercase">
                                <Check size={13} strokeWidth={3} aria-hidden="true" className="shrink-0" />
                                <span className="inline-block first-letter:uppercase">{part}</span>
                              </span>
                            ))}
                          </span>
                        )}
                      </span>
                      <span
                        className="shrink-0 mt-1 h-6 w-6 rounded-full border-2 flex items-center justify-center transition-colors"
                        style={{
                          borderColor: active ? 'var(--brand-primary)' : 'var(--brand-border)',
                          background: active ? 'var(--brand-primary)' : 'transparent',
                        }}
                        aria-hidden="true"
                      >
                        {active && <Check size={14} strokeWidth={3} className="text-white" />}
                      </span>
                    </button>
                    {learnMoreHref && (
                      <Link
                        to={learnMoreHref}
                        className="block px-3.5 pb-2.5 -mt-2 ps-[4.75rem] text-sm sm:text-xs font-semibold hover:underline"
                        style={{ color: 'var(--brand-primary)' }}
                        data-testid={`signup-role-learnmore-${key}`}
                      >
                        {t(tLearnMoreKey, defaultLearnMore)}
                      </Link>
                    )}
                  </div>
                );
              })}
            </div>

            <div className="mt-5 [@media(max-height:680px)]:mt-4 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
              <p className="text-sm sm:text-xs text-gray-600 max-w-md">
                {t('signupJoin.roleHint', 'You can always add another role later from your account settings.')}
              </p>
              <button
                type="button"
                onClick={handleContinue}
                disabled={!selectedRole}
                className="w-full sm:w-auto justify-center inline-flex items-center gap-2 rounded-full px-8 py-3 text-sm font-bold shadow-lg transition-all disabled:opacity-40 disabled:cursor-not-allowed hover:shadow-xl hover:-translate-y-0.5 active:translate-y-0"
                // The theme's black action with a white label. This read `--gold` on
                  // the primary blue; since the flow theme put the accent blue into
                  // every gold name, the label was blue on blue and the button blank.
                  style={{ background: 'var(--action, #000)', color: 'var(--action-ink, #fff)' }}
                data-testid="signup-continue-btn"
              >
                {t('signupJoin.continue', 'Continue')}
                <ArrowRight size={16} className="[[dir=rtl]_&]:rotate-180" aria-hidden="true" />
              </button>
            </div>

            {/* NO Google button on this step, deliberately.

                It used to sit here, below the cards, and it could be
                pressed with no card selected — in which case no role was
                remembered and the new account was created as a traveller
                in silence. A cleaner or a plumber taking the fastest-
                looking route landed on a traveller's dashboard with
                nothing to say why.

                It lives on step 2 instead, above the form, where a role
                has necessarily been chosen to get there. That also puts
                it in front of someone BEFORE they type out name, phone
                and password — offering the one-tap route after the form
                is filled in is offering it too late to be worth
                anything. */}

            {/* F4 — the feature library, linked from /join. Someone still
                deciding which card to press is exactly who benefits from
                reading what the site actually does. Below the cards, so it
                never competes with the choice itself. */}
            <div className="mt-5 flex flex-wrap justify-center gap-x-5 gap-y-1 text-sm" style={{ color: 'var(--brand-muted)' }}>
              <span>
                {t('signupJoin.haveAccount', 'Already have an account?')}{' '}
                <Link to={loginHref} className="font-semibold text-[var(--brand-primary)] hover:underline" data-testid="signup-login-link">
                  {t('signupJoin.logIn', 'Log in')}
                </Link>
              </span>
              <span>
                {t('signupJoin.notSure', 'Not sure yet?')}{' '}
                <Link
                  to="/what-you-can-do"
                  className="font-semibold text-[var(--brand-primary)] hover:underline"
                  data-testid="signup-what-you-can-do"
                >
                  {t('features.title', 'What you can do here')}
                </Link>
              </span>
            </div>
          </section>
        )}

        {/* STEP 2 — details form */}
        {step === 2 && activeCard && (
          <section className="mt-5 [@media(max-height:760px)]:mt-0" data-testid="signup-step-details">
            <div className="flex flex-wrap items-center justify-between gap-3">
            <button
              type="button"
              onClick={() => setStep(1)}
              className="inline-flex items-center gap-2 text-sm font-semibold text-gray-600 hover:text-[var(--brand-primary)] transition-colors"
              data-testid="signup-back-btn"
            >
              <ArrowLeft size={16} className="[[dir=rtl]_&]:rotate-180" aria-hidden="true" />
              {t('signupJoin.back', 'Back to role')}
            </button>
              <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-[rgb(var(--brand-primary-rgb)/<alpha-value>)]/8 text-[var(--brand-primary)] text-xs font-semibold">
                <activeCard.Icon size={14} />
                {t('signupJoin.signingUpAs', 'Signing up as')} · {t(activeCard.tKey, activeCard.defaultLabel)}
              </div>
            </div>

            <div className="mt-3">
              <h1
                className="text-2xl sm:text-3xl font-extrabold tracking-tight"
                style={{ fontFamily: 'var(--font-head)', color: 'var(--ink)' }}
              >
                {t('signupJoin.detailsHeadline', 'Create your account')}
              </h1>
              <p className="mt-1.5 text-sm text-gray-600 [@media(max-height:760px)]:hidden">
                {t(activeCard.tDetailsSubKey, activeCard.defaultDetailsSub)}
              </p>

              {/* Google Sign-In — the one-tap alternative to the form
                  below, and deliberately ABOVE it: someone who would
                  rather use Google should meet that option before
                  filling anything in, not after.

                  `activeCard` cannot be empty here — reaching step 2
                  requires choosing a role — so the intent always makes
                  it through. The account is created as `renter` and
                  promoted to owner/provider immediately after, which is
                  the least-privileged order to do it in. See
                  completeGoogleSignIn.js. */}
              {GOOGLE_CLIENT_ID && (
                <div className="mt-3">
                  <GoogleSignInButton intentRole={activeCard?.backendRole || ''} />
                  <div className="flex items-center gap-3 mt-2.5" aria-hidden="true">
                    <div className="flex-1 h-px bg-gray-200" />
                    <span className="text-xs uppercase tracking-wider text-gray-400">
                      {t('auth.orContinueWith', 'or')}
                    </span>
                    <div className="flex-1 h-px bg-gray-200" />
                  </div>
                </div>
              )}

              <form onSubmit={handleSubmit} className="mt-3 space-y-3 [@media(max-height:680px)]:space-y-2" data-testid="signup-form">
                <div className="grid gap-3 sm:grid-cols-2">
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
                    className="w-full rounded-xl border border-gray-200 bg-white px-4 py-2.5 text-sm focus:outline-none focus:border-[var(--brand-primary)] focus:ring-2 focus:ring-[rgb(var(--brand-primary-rgb)/<alpha-value>)]/20"
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
                    className="w-full rounded-xl border border-gray-200 bg-white px-4 py-2.5 text-sm focus:outline-none focus:border-[var(--brand-primary)] focus:ring-2 focus:ring-[rgb(var(--brand-primary-rgb)/<alpha-value>)]/20"
                    placeholder="you@example.com"
                    data-testid="signup-email-input"
                  />
                </Field>
                </div>
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
                      // Who calls this number depends on who is signing up:
                      // renters call a host, customers call a provider, and
                      // owners/pros call a traveler back. The old hint said
                      // "Renters" to all three — nonsense to a plumber.
                      ? t(
                          activeCard?.backendRole === 'provider'
                            ? 'phone.willDialCustomers'
                            : activeCard?.backendRole === 'renter'
                              ? 'phone.willDialOwners'
                              : 'phone.willDial',
                          {
                            number: phonePreview(form.phone),
                            defaultValue: `You can be reached at ${phonePreview(form.phone)}`,
                          },
                        )
                      : ''}
                    testid="signup-phone"
                  />
                </Field>
                {/* Password, then the same again. The repeat box was taken
                    out on 23 Sep 2026 as one field too many, and put back
                    on 7 Oct 2026 (Tzvi: "it doesn't ask to confirm the
                    password anymore"). The eye shows both. */}
                <div className="grid gap-3 sm:grid-cols-2">
                <Field label={t('signupJoin.password', 'Password')} testId="signup-password">
                  <div className="relative">
                    <input
                      type={showPwd ? 'text' : 'password'}
                      required
                      minLength={6}
                      autoComplete="new-password"
                      value={form.password}
                      onChange={(e) => setForm({ ...form, password: e.target.value })}
                      className="w-full rounded-xl border border-gray-200 bg-white px-4 py-2.5 pe-11 text-sm focus:outline-none focus:border-[var(--brand-primary)] focus:ring-2 focus:ring-[rgb(var(--brand-primary-rgb)/<alpha-value>)]/20"
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
                  <input
                    type={showPwd ? 'text' : 'password'}
                    required
                    autoComplete="new-password"
                    value={confirmPwd}
                    onChange={(e) => setConfirmPwd(e.target.value)}
                    aria-invalid={pwdMismatch}
                    aria-describedby={pwdMismatch ? 'signup-confirm-error' : undefined}
                    className={`w-full rounded-xl border bg-white px-4 py-2.5 text-sm focus:outline-none focus:ring-2 ${pwdMismatch ? 'border-red-400 focus:border-red-500 focus:ring-red-200' : 'border-gray-200 focus:border-[var(--brand-primary)] focus:ring-[rgb(var(--brand-primary-rgb)/<alpha-value>)]/20'}`}
                    placeholder={t('signupJoin.confirmPasswordPh', 'Type it again')}
                    data-testid="signup-confirm-input"
                  />
                  {pwdMismatch && (
                    <p id="signup-confirm-error" className="mt-1.5 text-xs text-red-600" role="alert" data-testid="signup-confirm-error">
                      {t('auth.passwordMismatch', 'Passwords do not match')}
                    </p>
                  )}
                </Field>
                </div>

                <label className="flex items-start gap-3 pt-1 cursor-pointer">
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
                  className="w-full mt-1 inline-flex items-center justify-center gap-2 rounded-full px-8 py-3 text-sm font-bold shadow-lg transition-all hover:shadow-xl hover:-translate-y-0.5 disabled:opacity-60 disabled:cursor-not-allowed"
                  // The theme's black action with a white label. This read `--gold` on
                  // the primary blue; since the flow theme put the accent blue into
                  // every gold name, the label was blue on blue and the button blank.
                  style={{ background: 'var(--action, #000)', color: 'var(--action-ink, #fff)' }}
                  data-testid="signup-submit-btn"
                >
                  {submitting
                    ? t('signupJoin.creating', 'Creating your account…')
                    : t('signupJoin.createAccount', 'Create account')}
                </button>

                <p className="text-center text-sm text-gray-600 [@media(max-height:680px)]:hidden">
                  {t('signupJoin.haveAccount', 'Already have an account?')}{' '}
                  <Link to={loginHref} className="font-semibold text-[var(--brand-primary)]" data-testid="signup-login-link-form">
                    {t('signupJoin.logIn', 'Log in')}
                  </Link>
                </p>
              </form>
            </div>
          </section>
        )}
    </AuthShell>

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
    </>
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
