/**
 * Dedicated "Join My Israel Rental" signup screen.
 *
 * Two-step wizard:
 *   1. Role selection — three big cards (Traveler / Host / Service Provider)
 *      mapped to the existing backend roles (renter / owner / provider).
 *   2. Account details — name, email, password + terms (the phone is asked later, 17 Nov 2026).
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
import { apiErrorMessage } from '../utils/apiError';
import {
  Eye, EyeOff,
  Plane, Home, Sparkles,
} from 'lucide-react';
import { API, AuthContext } from '../App';
import WelcomePopups from '../components/WelcomePopups';
import GoogleSignInButton from '../components/auth/GoogleSignInButton';
import AuthShell from '../components/auth/AuthShell';
import WorkForYou from '../components/auth/WorkForYou';
import { countStep } from '../utils/tapKind';

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
    defaultValue: 'Free to list · no commission · paste the ad you already have',
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
    defaultValue: 'Free to list · no commission · paste the ad you already have',
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
  // From the business wizard's "Use my email instead": the role and the
  // address are already known, so the account form opens straight away.
  const fromWizard = searchParams.get('role') === 'provider' && !!redirectParam;
  const [step, setStep] = useState(() => (fromWizard ? 2 : savedSignup?.step || 1));
  // How far people get (admin overview, "Where people stop").
  useEffect(() => { countStep('signup', step === 1 ? 'open' : 'details'); }, [step]);
  const [selectedRole, setSelectedRole] = useState(() => (fromWizard ? 'provider' : savedSignup?.selectedRole || null)); // "traveler" | "host" | "provider"
  const [form, setForm] = useState(() => ({
    name: '', email: '', phone: '',
    ...(savedSignup?.form || {}),
    ...(searchParams.get('email') ? { email: searchParams.get('email') } : {}),
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

  // A business builds its page first and makes the account at the end,
  // inside the wizard (Tzvi, 9 Nov 2026: the new sign-up funnel).
  const handleContinue = (role = selectedRole) => {
    if (!role) return;
    if (role === 'provider' && !redirectParam) { navigate('/businesses/add?welcome=1'); return; }
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

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!activeCard) return;
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
      countStep('signup', 'done');
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
    <AuthShell testId="signup-join-page" below={<WorkForYou />}>
        {/* STEP 1: the three choices and nothing else (Tzvi, 16 Nov 2026: the
            Wix look, "theirs look much cleaner"). Tapping a choice moves on,
            so there is no grey Continue waiting for one. Google is NOT here,
            deliberately: pressed with no role chosen it once made every new
            account a traveller in silence. It lives on step 2, where a role
            has necessarily been chosen. */}
        {step === 1 && (
          <section className="text-center" data-testid="signup-step-role">
            <h1
              className="text-[26px] leading-tight font-medium tracking-tight"
              style={{ fontFamily: 'var(--font-body)', color: 'var(--ink)' }}
              data-testid="signup-headline"
            >
              {t('signupJoin.headline', 'Join My Israel Rental')}
            </h1>
            <p className="mt-2 text-sm" style={{ color: 'var(--brand-muted)' }}>
              {t('signupJoin.haveAccount', 'Already have an account?')}{' '}
              <Link to={loginHref} className="font-semibold text-[var(--brand-primary)] hover:underline" data-testid="signup-login-link">
                {t('signupJoin.logIn', 'Log in')}
              </Link>
            </p>
            <div className="mt-6 space-y-3 text-start" role="group" aria-label={t('signupJoin.question', 'What best describes you?')} data-testid="signup-role-cards">
              {ROLE_CARDS.map(({ key, tKey, defaultLabel, tDescKey, defaultDesc }) => (
                <button
                  key={key}
                  type="button"
                  onClick={() => { setSelectedRole(key); handleContinue(key); }}
                  className="w-full rounded border border-gray-300 bg-white px-4 py-3 text-start transition-colors hover:border-gray-900 focus:outline-none focus-visible:border-gray-900 focus-visible:ring-1 focus-visible:ring-gray-900"
                  data-testid={`signup-role-${key}`}
                >
                  <span className="block text-[15px] font-medium" style={{ color: 'var(--ink)' }}>{t(tKey, defaultLabel)}</span>
                  <span className="mt-0.5 block text-[13px] leading-snug" style={{ color: 'var(--brand-muted)' }}>{t(tDescKey, defaultDesc)}</span>
                </button>
              ))}
            </div>
            <p className="mt-5 text-xs" style={{ color: 'var(--brand-muted)' }}>
              {t('signupJoin.notSure', 'Not sure yet?')}{' '}
              <Link to="/what-you-can-do" className="font-semibold text-[var(--brand-primary)] hover:underline" data-testid="signup-what-you-can-do">
                {t('features.title', 'What you can do here')}
              </Link>
            </p>
          </section>
        )}

        {/* STEP 2 — details form */}
        {step === 2 && activeCard && (
          <section data-testid="signup-step-details">
            {/* One quiet line instead of a back button and a pill (Tzvi, 17 Nov
                2026: "ours is very busy"). */}
            <p className="text-sm" style={{ color: 'var(--brand-muted)' }}>
              {t('signupJoin.signingUpAs', 'Signing up as')}{' '}
              <span className="font-semibold" style={{ color: 'var(--ink)' }}>{t(activeCard.tKey, activeCard.defaultLabel)}</span>
              {' · '}
              <button type="button" onClick={() => setStep(1)}
                className="font-semibold text-[var(--brand-primary)] hover:underline" data-testid="signup-back-btn">
                {t('signupJoin.change', 'Change')}
              </button>
            </p>

            <div className="mt-3">
              <h1
                className="text-2xl font-medium tracking-tight"
                style={{ fontFamily: 'var(--font-body)', color: 'var(--ink)' }}
              >
                {t('signupJoin.detailsHeadline', 'Create your account')}
              </h1>

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
                {/* Password, then the same again. The repeat box was taken
                    out on 23 Sep 2026 as one field too many, and put back
                    on 7 Oct 2026 (Tzvi: "it doesn't ask to confirm the
                    password anymore"). The eye shows both. */}
                <div className="grid gap-3 grid-cols-2">
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
                      placeholder={t('signupJoin.passwordPh', '6+ characters')}
                      data-testid="signup-password-input"
                    />
                    <button
                      type="button"
                      onClick={() => setShowPwd((s) => !s)}
                      className="absolute end-0 top-1/2 -translate-y-1/2 flex h-11 w-11 items-center justify-center text-gray-500 hover:text-gray-800"
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
