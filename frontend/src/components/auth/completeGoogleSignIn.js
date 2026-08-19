/**
 * Shared "we have a Google access token — finish signing the user in" step.
 *
 * Extracted from the old <AuthCallback /> so the popup flow can reuse it.
 * With Google Identity Services there is no redirect and no `#session_id`
 * round-trip: the token arrives in-page, so this runs inline in the button's
 * callback instead of on a dedicated callback route.
 */
import axios from 'axios';
import { toast } from 'sonner';
import { API } from '../../App';

// sessionStorage key used to smuggle role intent through the sign-in step.
// Lives here (single source of truth) so the button and this helper can't
// drift apart; GoogleSignInButton re-exports it for existing importers.
export const SIGNUP_INTENT_ROLE_KEY = 'signup_intent_role';

// localStorage key for the "Continue as {name}" banner on /auth/login.
export const LAST_LOGIN_HINT_KEY = 'last_login_hint';

/**
 * @param {string} accessToken  Google OAuth access token from the GIS popup.
 * @param {(token: string, user: object) => void} login  AuthContext.login
 * @param {(to: string, opts?: object) => void} navigate  react-router navigate
 */
export default async function completeGoogleSignIn(accessToken, login, navigate) {
  const res = await axios.post(`${API}/auth/google/session`, { access_token: accessToken });
  let { token, user } = res.data || {};
  if (!token || !user) throw new Error('Invalid response from auth server');

  // ── Role intent promotion ──────────────────────────────────────────────
  // If the visitor picked "Host" or "Provider" on /signup before hitting the
  // Google button, the desired role was stashed in sessionStorage. Google
  // doesn't know about our roles, so the account is created as `renter` —
  // promote it before AuthContext sees the user, otherwise the dashboard
  // briefly renders in the wrong shape.
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
      // The endpoint returns a fresh token minted with the new role claim —
      // use it so any RBAC dependency sees the up-to-date role.
      if (r.data?.token) token = r.data.token;
      if (r.data?.user) user = r.data.user;
    } catch (e) {
      // Non-fatal: land them on the dashboard as `renter`; they can upgrade
      // via the "Switch role" flow.
      console.warn('Role auto-promotion failed:', e?.response?.data || e.message);
    }
  }

  // Persist "Continue as X" hint for the next visit.
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

  // Route by final role.
  if (user.role === 'provider') {
    navigate('/businesses/add?welcome=1', { replace: true });
  } else if (user.role === 'owner') {
    navigate('/dashboard?welcome=1', { replace: true });
  } else {
    navigate('/dashboard', { replace: true });
  }

  return user;
}
