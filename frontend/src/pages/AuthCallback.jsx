/**
 * AuthCallback — mounted synchronously in App.js BEFORE the normal
 * <Routes>, whenever the URL hash contains `session_id=<one-shot>`.
 *
 * REMINDER: DO NOT HARDCODE THE URL, OR ADD ANY FALLBACKS OR REDIRECT
 * URLS, THIS BREAKS THE AUTH. Any redirect target we compute must come
 * from window.location.origin — never from an env var or a literal.
 *
 * Flow:
 *   1. Google → Emergent Auth → this app at /dashboard#session_id=…
 *   2. AppRouter sees the hash and renders <AuthCallback /> instead of
 *      the normal routing tree, so the ProtectedRoute check that
 *      normally bounces unauthenticated users to /auth/login can't fire
 *      before we've had a chance to exchange the session_id.
 *   3. We POST the session_id to our backend, receive a JWT + user, feed
 *      them to the AuthContext, then navigate to the app.
 *
 * Uses a `useRef` guard (not useState) so React StrictMode's double-
 * invoke can't consume the same one-shot session_id twice.
 */
import { useContext, useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import axios from 'axios';
import { toast } from 'sonner';
import { AuthContext, API } from '../App';
import { SIGNUP_INTENT_ROLE_KEY } from '../components/auth/GoogleSignInButton';

// localStorage key for the "Continue as {name}" banner on /auth/login.
// Set here so the constant lives with the auth flow that populates it.
export const LAST_LOGIN_HINT_KEY = 'last_login_hint';

export default function AuthCallback() {
  const navigate = useNavigate();
  const { login } = useContext(AuthContext);
  const hasProcessed = useRef(false);
  const [error, setError] = useState('');

  useEffect(() => {
    // Idempotency guard — StrictMode invokes effects twice in dev, and
    // consuming the session_id twice is a hard 401 the second time.
    if (hasProcessed.current) return;
    hasProcessed.current = true;

    const hash = window.location.hash || '';
    const match = /(?:^|[?&#])session_id=([^&]+)/.exec(hash);
    const sessionId = match ? decodeURIComponent(match[1]) : '';

    // Strip the session_id out of the visible URL immediately so a
    // refresh or "share this link" can't leak the token.
    window.history.replaceState(null, '', window.location.pathname + window.location.search);

    if (!sessionId) {
      setError('Missing session_id in callback URL');
      return;
    }

    (async () => {
      try {
        const res = await axios.post(`${API}/auth/google/session`, { session_id: sessionId });
        let { token, user } = res.data || {};
        if (!token || !user) throw new Error('Invalid response from auth server');

        // ── Role intent promotion ────────────────────────────────────────
        // If the visitor picked "Host" or "Provider" on /signup before
        // hitting the Google button, the desired role was stashed in
        // sessionStorage. Emergent Auth doesn't know about our roles, so
        // the account was created as `renter` — promote it now before we
        // let AuthContext see the user, otherwise the dashboard would
        // briefly render in the wrong shape.
        let intentRole = '';
        try {
          intentRole = sessionStorage.getItem(SIGNUP_INTENT_ROLE_KEY) || '';
          sessionStorage.removeItem(SIGNUP_INTENT_ROLE_KEY);
        } catch { /* private mode etc */ }

        if (intentRole && ['owner', 'provider'].includes(intentRole) && user.role !== intentRole) {
          try {
            const r = await axios.put(
              `${API}/auth/role`,
              { role: intentRole },
              { headers: { Authorization: `Bearer ${token}` } },
            );
            // The endpoint returns a fresh token minted with the new
            // role claim — use it instead of the original so any RBAC
            // dependency sees the up-to-date role.
            if (r.data?.token) token = r.data.token;
            if (r.data?.user)  user  = r.data.user;
          } catch (e) {
            // Non-fatal: land them on the dashboard as `renter` and let
            // them upgrade via the "Switch role" flow if the auto-
            // promotion failed.
            console.warn('Role auto-promotion failed:', e?.response?.data || e.message);
          }
        }

        // Persist "Continue as X" hint for the next visit (Track 2).
        try {
          localStorage.setItem(LAST_LOGIN_HINT_KEY, JSON.stringify({
            name: user.name || '',
            email: user.email || '',
            picture: user.picture || null,
            provider: 'google',
            ts: Date.now(),
          }));
        } catch { /* quota / private mode */ }

        login(token, user);
        toast.success(`Welcome, ${user.name || user.email}`);

        // Route by final role. Provider intent → straight into gig
        // creation. Owner intent → dashboard with the welcome flag so
        // Dashboard shows the "Add your first property" prompt.
        if (user.role === 'provider') {
          navigate('/services/create-gig?welcome=1', { replace: true });
        } else if (user.role === 'owner') {
          navigate('/dashboard?welcome=1', { replace: true });
        } else {
          navigate('/dashboard', { replace: true });
        }
      } catch (e) {
        const msg = e?.response?.data?.detail || e.message || 'Google sign-in failed';
        setError(String(msg));
        toast.error(String(msg));
        // Give the user a way out without a stuck spinner.
        setTimeout(() => navigate('/auth/login', { replace: true }), 2500);
      }
    })();
  }, [login, navigate]);

  return (
    <div
      className="min-h-screen flex items-center justify-center bg-[#FAFAF7]"
      data-testid="auth-callback-loading"
    >
      <div className="text-center px-6">
        {!error ? (
          <>
            <div
              className="mx-auto mb-4 h-10 w-10 rounded-full border-2 border-[#1E6A6A] border-t-transparent animate-spin"
              aria-hidden="true"
            />
            <p className="text-sm text-gray-600">Signing you in…</p>
          </>
        ) : (
          <p className="text-sm text-red-600" data-testid="auth-callback-error">
            {error}
          </p>
        )}
      </div>
    </div>
  );
}
