import React, { useState, useEffect } from 'react';
import { BrowserRouter, Routes, Route, Navigate, useLocation } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import axios from 'axios';
import './i18n';
import '@/App.css';

import Navigation from './components/Navigation';
import ImpersonationBanner from './components/ImpersonationBanner';
import ServicesUpsellModal from './components/ServicesUpsellModal';
import WhatsAppButton from './components/WhatsAppButton';
import AccessibilityButton from './components/AccessibilityButton';
import { installStaleBuildInterceptor } from './utils/staleBuildInterceptor';

// Install the "backend hasn't caught up with this build" detector exactly
// once at module-load. Surfaces a single "Please refresh" toast when a
// freshly-deployed frontend hits an API route the backend rollout hasn't
// reached yet — catches the post-deploy race that previously made users
// think a feature was broken when it was just stale.
installStaleBuildInterceptor();

function ScrollToTop() {
  const { pathname } = useLocation();
  useEffect(() => { window.scrollTo(0, 0); }, [pathname]);
  return null;
}
import Home from './pages/Home';
import Properties from './pages/Properties';
import PropertyDetail from './pages/PropertyDetail';
import SubleaseDetail from './pages/SubleaseDetail';
import Auth from './pages/Auth';
import AuthCallback from './pages/AuthCallback';
import AuthDeeplink from './pages/AuthDeeplink';
import NotificationSnooze from './pages/NotificationSnooze';import ThemePreviewOverride from './components/ThemePreviewOverride';
import SignupJoin from './pages/SignupJoin';
import VerifyPending from './pages/VerifyPending';
import VerifyEmail from './pages/VerifyEmail';
import Dashboard from './pages/Dashboard';
import AdminDashboard from './pages/AdminDashboard';
import ManagerPage from './pages/ManagerPage';
import Chat from './pages/Chat';
import DocumentService from './pages/DocumentService';
import SignContract from './pages/SignContract';
import PaymentSuccess from './pages/PaymentSuccess';
import PaymentCancel from './pages/PaymentCancel';
import AvailabilityExtended from './pages/AvailabilityExtended';
import Stays from './pages/Stays';
import Services from './pages/Services';
import GigDetail from './pages/GigDetail';
import CreateGig from './pages/CreateGig';
import JobsBoard from './pages/JobsBoard';
import JobDetail from './pages/JobDetail';
import PostJob from './pages/PostJob';
import ProviderProfile from './pages/ProviderProfile';
import FAQ from './pages/FAQ';
import { DOCUMENT_SERVICES_ENABLED } from './config/features';

const BACKEND_URL = process.env.REACT_APP_BACKEND_URL;
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
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="w-8 h-8 border-4 border-black border-t-transparent rounded-full animate-spin"></div>
      </div>
    );
  }

  // Emergent Google Sign-In callback — when we return from
  // auth.emergentagent.com the URL fragment carries a one-shot
  // `#session_id=…`. We must handle it BEFORE the normal <Routes>
  // evaluate `user ? … : Navigate(/auth/login)`, otherwise the
  // ProtectedRoute check bounces the visitor to the login page while
  // the session_id is still unspent. Reading window.location.hash here
  // (outside any hook) makes the check synchronous with the first
  // render, avoiding the classic useEffect race.
  // REMINDER: DO NOT HARDCODE THE URL, OR ADD ANY FALLBACKS OR REDIRECT
  // URLS, THIS BREAKS THE AUTH.
  const hasGoogleCallback = typeof window !== 'undefined' && window.location.hash?.includes('session_id=');

  return (
    <AuthContext.Provider value={{ user, token, login, logout, impersonate, endImpersonation }}>
      <BrowserRouter>
        {hasGoogleCallback ? (
          <AuthCallback />
        ) : (
          <>
            <ScrollToTop />
            <ThemePreviewOverride />
            <div className="App">
              <ImpersonationBanner />
              <Navigation />
          {/* One-time services marketplace upsell — shown to every logged-in
              user until they either accept (→ $0 provider trial + My Gigs
              redirect) or dismiss. Admins are exempt so the internal team
              never gets nagged. `services_pitch_seen_at` is stamped on the
              user doc by /api/user/services-pitch/action so the modal
              never reappears once actioned. */}
          {user && !user.services_pitch_seen_at && user.role !== 'admin' && (
            <ServicesUpsellModal />
          )}
          <WhatsAppButton />
          <AccessibilityButton />
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
            <Route path="/admin" element={user?.role === 'admin' ? <AdminDashboard /> : <Navigate to="/" />} />
            <Route path="/manager/:managerId" element={<ManagerPage />} />
            <Route path="/chat/:propertyId" element={user ? <Chat /> : <Navigate to="/auth/login" />} />
            <Route path="/document-service" element={DOCUMENT_SERVICES_ENABLED ? (user ? <DocumentService /> : <Navigate to="/auth/login" />) : <Navigate to="/" />} />
            <Route path="/sign/:signToken" element={<SignContract />} />
            <Route path="/payment/success" element={user ? <PaymentSuccess /> : <Navigate to="/auth/login" />} />
            <Route path="/payment/cancel" element={<PaymentCancel />} />
            <Route path="/availability-extended" element={<AvailabilityExtended />} />
            <Route path="/stays" element={<Stays />} />
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
            <Route path="/services" element={<Services />} />
            <Route path="/services/jobs" element={<JobsBoard />} />
            <Route path="/services/jobs/:id" element={<JobDetail />} />
            <Route path="/services/post-job" element={user ? <PostJob /> : <Navigate to="/auth/login" />} />
            <Route path="/services/gig/:id" element={<GigDetail />} />
            <Route path="/services/create-gig" element={user ? <CreateGig /> : <Navigate to="/auth/login" />} />
            <Route path="/services/provider/:userId" element={<ProviderProfile />} />
            <Route path="/faq" element={<FAQ />} />
          </Routes>
        </div>
          </>
        )}
      </BrowserRouter>
    </AuthContext.Provider>
  );
}

export default App;