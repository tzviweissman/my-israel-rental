import React, { useState, useEffect, Suspense, lazy } from 'react';
import { Helmet } from 'react-helmet-async';

import { BrowserRouter, Routes, Route, Navigate, useLocation } from 'react-router-dom';
import useBuildRefresh from './hooks/useBuildRefresh';
import { useTranslation } from 'react-i18next';
import axios from 'axios';
import './i18n';
import '@/App.css';

import Navigation from './components/Navigation';
import ImpersonationBanner from './components/ImpersonationBanner';
import WhatsAppButton from './components/WhatsAppButton';
import AccessibilityButton from './components/AccessibilityButton';
import ThemePreviewOverride from './components/ThemePreviewOverride';
import { installStaleBuildInterceptor } from './utils/staleBuildInterceptor';
import { startVersionWatcher } from './utils/appVersion';
import ShortLinkRedirect from './pages/ShortLinkRedirect';
import BusinessPage from './pages/BusinessPage';
import ProviderRedirect from './pages/ProviderRedirect';

// Install the "backend hasn't caught up with this build" detector exactly
// once at module-load. Surfaces a single "Please refresh" toast when a
// freshly-deployed frontend hits an API route the backend rollout hasn't
// reached yet — catches the post-deploy race that previously made users
// think a feature was broken when it was just stale.
installStaleBuildInterceptor();
// Frontend-only deploys move no backend header and break no route, so the
// interceptor above never sees them. This watches the bundle itself.
startVersionWatcher();

/**
 * The floating WhatsApp CTA, suppressed on the cinematic home page.
 *
 * Not hidden with CSS — not rendered at all, so it costs nothing on that
 * route and cannot flash before being hidden.
 *
 * Two reasons it goes. It floats over scene media and captions for the full
 * length of an immersive full-bleed story that was never laid out around it.
 * And it argues against the page: a generic WhatsApp bubble hovering beside
 * the scene whose whole message is "chat happens inside MyIsraelRental"
 * undercuts the thing being said. The home page carries its own CTAs in the
 * hero and the finale for anyone ready to act.
 *
 * Every other route keeps it. This is a wrapper rather than a check inside
 * WhatsAppButton so the widget stays a generic component that knows nothing
 * about routing.
 */
function FloatingContact() {
  const { pathname } = useLocation();
  if (pathname === '/') return null;
  return <WhatsAppButton />;
}

function ScrollToTop() {
  const { pathname } = useLocation();
  useEffect(() => { window.scrollTo(0, 0); }, [pathname]);
  return null;
}

/* Picks up a newly deployed build and applies it at the next route
   change, so a tab left open since this morning stops running this
   morning's code. Renders nothing; it has to sit inside the router
   because it watches navigation. */
function BuildRefresh() {
  useBuildRefresh();
  return null;
}

// Route-level code splitting. Each page becomes its own webpack chunk so
// a visitor landing on `/` only downloads the Home shell instead of also
// pulling in admin dashboards, contract signing, gig marketplace, jobs
// board, etc. Cuts the initial bundle by ~60% on cold loads.
//
// ONLY split page components — small always-mounted chrome (Navigation,
// banners, floating buttons, ThemePreviewOverride) stays static so we
// don't ship a spinner where the chrome should already be visible.
const Home = lazy(() => import('./pages/Home'));
// Prefetch the top destinations users navigate to from Home during
// idle browser time. Webpack emits `<link rel="prefetch">` for these
// chunks, so click-through from Home feels instant while still keeping
// the pages lazy (they don't run on initial paint). Kept conservative
// — over-prefetching burns bandwidth on visitors who never navigate.
const Properties = lazy(() => import(/* webpackPrefetch: true */ './pages/Properties'));
const Stays = lazy(() => import(/* webpackPrefetch: true */ './pages/Stays'));
const RequestsBoard = lazy(() => import(/* webpackPrefetch: true */ './pages/RequestsBoard'));
const RequestDetail = lazy(() => import('./pages/RequestDetail'));
const PostRequest = lazy(() => import('./pages/PostRequest'));
const Services = lazy(() => import(/* webpackPrefetch: true */ './pages/Services'));
const WhyList = lazy(() => import('./pages/WhyList'));
const WhyHost = lazy(() => import('./pages/WhyHost'));
// The feature library (perks spec Part 1). Lazy like its neighbours:
// it is a marketing surface, not part of the first paint.
const WhatYouCanDo = lazy(() => import('./pages/WhatYouCanDo'));
const FeatureDetail = lazy(() => import('./pages/FeatureDetail'));
const PropertyDetail = lazy(() => import('./pages/PropertyDetail'));
const SubleaseDetail = lazy(() => import('./pages/SubleaseDetail'));
const Auth = lazy(() => import('./pages/Auth'));
const AuthDeeplink = lazy(() => import('./pages/AuthDeeplink'));
const NotificationSnooze = lazy(() => import('./pages/NotificationSnooze'));
const RequestsEmailsOff = lazy(() => import('./pages/RequestsEmailsOff'));
const JobsEmailsOff = lazy(() => import('./pages/JobsEmailsOff'));
const SignupJoin = lazy(() => import('./pages/SignupJoin'));
const VerifyPending = lazy(() => import('./pages/VerifyPending'));
const VerifyEmail = lazy(() => import('./pages/VerifyEmail'));
const Dashboard = lazy(() => import('./pages/Dashboard'));
const AdminDashboard = lazy(() => import('./pages/AdminDashboard'));
const ManagerPage = lazy(() => import('./pages/ManagerPage'));
const Chat = lazy(() => import('./pages/Chat'));
const SignContract = lazy(() => import('./pages/SignContract'));
const PaymentSuccess = lazy(() => import('./pages/PaymentSuccess'));
const PaymentCancel = lazy(() => import('./pages/PaymentCancel'));
const AvailabilityExtended = lazy(() => import('./pages/AvailabilityExtended'));
const GigDetail = lazy(() => import('./pages/GigDetail'));
const CreateGig = lazy(() => import('./pages/CreateGig'));
const JobsBoard = lazy(() => import('./pages/JobsBoard'));
const JobDetail = lazy(() => import('./pages/JobDetail'));
const PostJob = lazy(() => import('./pages/PostJob'));
const FAQ = lazy(() => import('./pages/FAQ'));
const NotFound = lazy(() => import('./pages/NotFound'));

// Shared spinner used both by the initial auth-loading gate AND by the
// route <Suspense> fallback so page-to-page transitions feel visually
// identical to app boot.
const RouteFallback = () => (
  <div className="min-h-screen flex items-center justify-center">
    <div className="w-8 h-8 border-4 border-black border-t-transparent rounded-full animate-spin" />
  </div>
);

import ErrorBoundary from './components/common/ErrorBoundary';

// Preview builds keep the entire app out of search results. Read once at
// module load — CRA inlines REACT_APP_* at build time, so this is a
// constant and the whole block below compiles away in production.
const PREVIEW_NOINDEX = process.env.REACT_APP_PREVIEW === '1';

// WHERE THE API LIVES. Set this to "/" for same origin, which is what
// production uses: `frontend/server.js` proxies /api to the backend, so
// the browser makes no cross-origin request and no CORS preflight.
//
// That is not a tidiness preference. A real user spent three minutes
// failing to sign up because her network passed our GETs and passed our
// CORS preflights and silently dropped every cross-origin POST — a thing
// filtering software does, and which we cannot fix from her side. There
// is nothing to single out if the request never leaves the origin.
//
// A full URL still wins, which is what local dev uses: the CRA dev server
// has no proxy, so `.env` points at http://localhost:8001.
//
// "undefined" AND "null" ARE TREATED AS UNSET, and that is not paranoia.
// Setting this variable to an empty string on Railway made the build
// inline the four-letter STRING "undefined", so every call went to
// `/undefined/api/...`, which the SPA fallback answered with index.html
// and a 200 — the app parsing a web page as JSON. It shipped for about
// six minutes. An absent value, an empty one and a stringified-nothing
// now all mean the same safe thing.
const RAW_BACKEND_URL = (process.env.REACT_APP_BACKEND_URL || '').trim();
const BACKEND_URL = (
  RAW_BACKEND_URL === 'undefined' || RAW_BACKEND_URL === 'null' || RAW_BACKEND_URL === '/'
    ? ''
    : RAW_BACKEND_URL
).replace(/\/+$/, '');
export const API = `${BACKEND_URL}/api`;

export const AuthContext = React.createContext();

function App() {
  const { i18n } = useTranslation();
  const [user, setUser] = useState(null);
  // Use sessionStorage instead of localStorage for better security
  // sessionStorage is cleared when browser tab is closed, reducing XSS attack window
  const [token, setToken] = useState(sessionStorage.getItem('token'));
  const [loading, setLoading] = useState(!!sessionStorage.getItem('token'));

  useEffect(() => {
    if (token) {
      fetchCurrentUser();
    }
  }, [token]);

  // Note: <html lang> and <html dir> are managed centrally inside
  // src/i18n.js — it binds a `languageChanged` listener that sets both
  // attributes (LTR for default locales, RTL for he/ar/fa/ur). Don't
  // duplicate the writes here or it'll race the i18n handler.

  const fetchCurrentUser = async () => {
    try {
      const response = await axios.get(`${API}/auth/me`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      setUser(response.data);
      // Apply the user's saved UI language preference (cross-device).
      const pref = response.data?.preferred_language;
      if (pref && (pref === 'en' || pref === 'he') && !i18n.language.startsWith(pref)) {
        i18n.changeLanguage(pref);
      }
    } catch (error) {
      console.error('Failed to fetch user', error);
      logout();
    } finally {
      setLoading(false);
    }
  };

  const login = (newToken, userData) => {
    // Store token in sessionStorage (more secure than localStorage)
    // sessionStorage is cleared when browser tab closes, limiting XSS exposure window
    sessionStorage.setItem('token', newToken);
    setToken(newToken);
    setUser(userData);
  };

  // Admin-only helper: swap into a target user's session while stashing the
  // current admin's token so we can restore it in one click. The banner
  // rendered in App reads `sessionStorage.impersonate_admin_token` to know
  // we're in impersonation mode and offer a "Return to admin" affordance.
  const impersonate = (targetToken, targetUser) => {
    // Stash BEFORE overwriting `token` so we don't lose the admin session.
    // Only stash if we're not already impersonating (nested impersonations
    // would obliterate the original admin token).
    if (!sessionStorage.getItem('impersonate_admin_token') && token && user) {
      sessionStorage.setItem('impersonate_admin_token', token);
      sessionStorage.setItem('impersonate_admin_user', JSON.stringify(user));
    }
    login(targetToken, targetUser);
  };

  const endImpersonation = async () => {
    const adminToken = sessionStorage.getItem('impersonate_admin_token');
    const adminUserJson = sessionStorage.getItem('impersonate_admin_user');
    if (!adminToken || !adminUserJson) return;
    sessionStorage.removeItem('impersonate_admin_token');
    sessionStorage.removeItem('impersonate_admin_user');
    try {
      login(adminToken, JSON.parse(adminUserJson));
    } catch {
      logout();
    }
  };

  const logout = () => {
    sessionStorage.removeItem('token');
    setToken(null);
    setUser(null);
    setLoading(false);
  };

  if (loading) {
    return <RouteFallback />;
  }

  // NOTE: Google Sign-In no longer round-trips through a redirect, so there
  // is no `#session_id=…` fragment to intercept before <Routes> evaluate.
  // Google Identity Services hands us the token in-page — see
  // components/auth/GoogleSignInButton.jsx.

  return (
    <AuthContext.Provider value={{ user, token, login, logout, impersonate, endImpersonation }}>
      <BrowserRouter>
        <>
            {/* Preview-environment noindex, emitted ONCE for the whole app.
                It used to live only in PageMeta, which 17 pages never
                render — /join, /auth/*, /dashboard and /property/:id among
                them — so the preview was leaving its most linkable pages
                indexable while the pages that did render PageMeta looked
                correctly protected. Putting it at the root means a new
                route is covered the moment it exists, without anyone
                remembering to add a meta tag. */}
            {PREVIEW_NOINDEX && (
              <Helmet prioritizeSeoTags>
                <meta name="robots" content="noindex,nofollow" />
              </Helmet>
            )}
            <ScrollToTop />
            <BuildRefresh />
            <ThemePreviewOverride />
            <div className="App">
              <ImpersonationBanner />
              <Navigation />
          {/* The "Start my free month" services upsell used to render here for
              every logged-in non-admin who hadn't actioned it — which meant it
              fired immediately after signup, interrupting someone who had just
              told us what they came to do.

              Removed rather than retimed: the job it was doing is now done
              better and in context by /why-list (what a provider gets, with
              real pricing) and by the gig wizard's plan step, which states the
              free month at the point it actually applies.

              The component and /api/user/services-pitch/action still exist, so
              re-enabling is a one-line change if you want it back on a
              different trigger. `services_pitch_seen_at` on the user doc is
              now unread by the UI. */}
          <FloatingContact />
          <AccessibilityButton />
          {/* Around the ROUTES only: a page-level crash then leaves the
              nav bar intact so the user can click their way out, instead
              of being stranded on a blank document. */}
          <ErrorBoundary>
          <Suspense fallback={<RouteFallback />}>
          <Routes>
            {/* `/` lands on the marketing-style Home page (hero +
                slideshow + featured properties + 3-segment search pill).
                Tapping Search there pushes the renter to `/stays` with
                pre-applied query params for live filtering. `/stays`
                remains directly addressable (e.g. for chip-link sharing
                and bookmarks). `/home` keeps working as an alias so any
                external link juice already pointing there still lands
                on the same hero. */}
            <Route path="/" element={<Home />} />
            <Route path="/home" element={<Navigate to="/" replace />} />
            <Route path="/properties/:type" element={<Properties />} />
            <Route path="/property/:id" element={<PropertyDetail />} />
            <Route path="/sublease/:id" element={<SubleaseDetail />} />
            <Route path="/auth/:mode" element={<Auth />} />
            <Route path="/signup" element={<SignupJoin />} />
            <Route path="/join" element={<SignupJoin />} />
            <Route path="/verify-pending" element={<VerifyPending />} />
            <Route path="/verify-email" element={<VerifyEmail />} />
            <Route path="/dashboard" element={user ? <Dashboard /> : <Navigate to="/auth/login" />} />
            <Route path="/dashboard/settings" element={user ? <Dashboard /> : <Navigate to="/auth/login" />} />
            <Route path="/auth/deeplink" element={<AuthDeeplink />} />
            <Route path="/notification-snooze" element={<NotificationSnooze />} />
            {/* Public on purpose — the unsubscribe link in the requests
                matching email must work without logging in. */}
            <Route path="/requests-emails-off" element={<RequestsEmailsOff />} />
            {/* L2 — the jobs digest now has a real one-click
                unsubscribe, and this is where its link lands. */}
            <Route path="/jobs-emails-off" element={<JobsEmailsOff />} />
            <Route path="/admin" element={user?.role === 'admin' ? <AdminDashboard /> : <Navigate to="/" />} />
            <Route path="/manager/:managerId" element={<ManagerPage />} />
            {/* Where a scanned QR lands. Deliberately NOT lazy like the
                pages around it: this is the first thing someone sees after
                scanning a printed sign, often on a phone on a bad
                connection, and a chunk fetch before the redirect is dead
                time on the one screen nobody should have to look at. */}
            <Route path="/p/:slug" element={<ShortLinkRedirect />} />
            <Route path="/chat/:propertyId" element={user ? <Chat /> : <Navigate to="/auth/login" />} />
            <Route path="/sign/:signToken" element={<SignContract />} />
            <Route path="/payment/success" element={user ? <PaymentSuccess /> : <Navigate to="/auth/login" />} />
            <Route path="/payment/cancel" element={<PaymentCancel />} />
            <Route path="/availability-extended" element={<AvailabilityExtended />} />
            <Route path="/stays" element={<Stays />} />
            {/* Demand board. Reading is public; posting needs an account,
                which is what keeps the board from being scraped for leads.
                /requests/post sits BEFORE /requests/:id so "post" is never
                swallowed as an id. */}
            <Route path="/requests" element={<RequestsBoard />} />
            {/* C4 — no longer gated. Anyone can fill the wizard in; the
                account is asked for at the final step, with the draft
                preserved across the sign-in round trip. Posting still
                REQUIRES an account, which the server enforces regardless
                of what the UI does — only the timing of the ask moved.
                Sending someone to a signup form before they have seen what
                they are signing up for is where most of them leave. */}
            <Route path="/requests/post" element={<PostRequest />} />
            <Route path="/requests/:id" element={<RequestDetail />} />
            <Route
              path="/kosher-stays-in-israel"
              element={<Stays landing={{
                path: '/kosher-stays-in-israel',
                title: 'Kosher Stays in Israel — Sabbath-observant vacation rentals & apartments | MyIsraelRental',
                description: 'Browse kosher stays in Israel with kosher-certified kitchens, Shabbat elevators, and synagogues + mikvehs nearby. Long-term, short-term & vacation rentals for observant travelers in Jerusalem, Tel Aviv, Bnei Brak, Beit Shemesh and more.',
                heroTitle: 'Kosher stays in Israel',
                heroLede: 'Sabbath-observant vacation rentals & apartments — every listing below has a kosher-certified kitchen, Shabbat elevator, and synagogue + mikveh nearby. Adjust the filters to widen or narrow the match.',
                defaultAmenities: ['Kosher-certified kitchen', 'Shabbat elevator', 'Synagogue nearby', 'Mikveh nearby'],
              }} />}
            />
            {/* Two URLs, one page. The label became "Businesses" because
                the board carries shops as well as trades, but /services is
                already shared, bookmarked and indexed — and the QR rule
                applies to every public URL, not just printed ones: it must
                keep resolving. So /businesses is the name people see and
                /services keeps working, permanently. Neither redirects, so
                a link of either shape lands where it says it will. */}
            <Route path="/services" element={<Services />} />
            <Route path="/businesses" element={<Services />} />
            {/* Value page in front of plan selection. /for-providers is an
                alias so either URL works in outreach. */}
            {/* Two supply-side pitches: /why-list sells to service
                providers, /why-host to property owners. Neither is in
                the nav — both are reached from their role card on /join. */}
            {/* A real page per feature, not a modal, so each one is
                linkable, shareable and indexable — and so the help
                menu has somewhere real to send people. */}
            <Route path="/what-you-can-do" element={<WhatYouCanDo />} />
            <Route path="/features/:slug" element={<FeatureDetail />} />
            <Route path="/why-list" element={<WhyList />} />
            <Route path="/why-host" element={<WhyHost />} />
            <Route path="/for-providers" element={<WhyList />} />
            {/* Every /services/* path keeps working, permanently — the
                same promise as /services itself. Nothing redirects, so an
                old link and a new link both land where they say they will,
                and any QR or message already sent stays valid. */}
            <Route path="/services/jobs" element={<JobsBoard />} />
            <Route path="/services/jobs/:id" element={<JobDetail />} />
            <Route path="/services/post-job" element={user ? <PostJob /> : <Navigate to="/signup" />} />
            <Route path="/services/gig/:id" element={<GigDetail />} />
            <Route path="/services/create-gig" element={user ? <CreateGig /> : <Navigate to="/signup" />} />

            {/* The names people see and share from now on. */}
            <Route path="/businesses/jobs" element={<JobsBoard />} />
            <Route path="/businesses/jobs/:id" element={<JobDetail />} />
            <Route path="/businesses/post-job" element={user ? <PostJob /> : <Navigate to="/signup" />} />
            <Route path="/businesses/:id" element={<GigDetail />} />
            <Route path="/businesses/add" element={user ? <CreateGig /> : <Navigate to="/signup" />} />
            {/* M4 — the public page for ONE business, by slug or by id.
                Both resolve: the spec allows either as canonical and the
                short-link table already points at /business/{id}. */}
            <Route path="/business/:slug" element={<BusinessPage />} />

            {/* The old per-person pages keep working, as the spec requires,
                by resolving to that person's first business. Kept for both
                URL spellings so nothing already shared 404s. */}
            <Route path="/businesses/provider/:userId" element={<ProviderRedirect />} />
            <Route path="/services/provider/:userId" element={<ProviderRedirect />} />
            <Route path="/faq" element={<FAQ />} />
            {/* Catch-all — any URL no route above claims. Without it an
                unknown URL rendered the nav shell over an empty content
                area, which looks like a broken site rather than a wrong
                address. Must stay LAST in this list. */}
            <Route path="*" element={<NotFound />} />
          </Routes>
          </Suspense>
          </ErrorBoundary>
        </div>
          </>
      </BrowserRouter>
    </AuthContext.Provider>
  );
}

export default App;