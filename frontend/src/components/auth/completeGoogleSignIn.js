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
import i18n from 'i18next';
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
      /* Non-fatal by design — they are signed in, and refusing the whole
         sign-in over a role would be worse. But it must not be SILENT: a
         console warning is invisible to the person it happened to, and
         they would land on a traveller's dashboard having asked to be a
         host, with nothing on screen to explain it or to fix it.

         So say what happened and name where the fix is. Settings → role
         is the same endpoint this just failed to call, so the retry costs
         them two clicks rather than a support message. */
      console.warn('Role auto-promotion failed:', e?.response?.data || e.message);
      toast.error(
        // i18n note: this file has no `t` — it is a plain helper, not a
        // component — so the caller's language is reached through the
        // shared i18next instance rather than a hook.
        i18n.t('auth.rolePromotionFailed', {
          defaultValue:
            "You're signed in, but we couldn't set you up as a {{role}} just yet. "
            + 'You can switch that in Settings.',
          role: intentRole === 'owner'
            ? i18n.t('signupJoin.host', { defaultValue: 'host' })
            : i18n.t('signupJoin.provider', { defaultValue: 'business owner' }),
        }),
      );
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
