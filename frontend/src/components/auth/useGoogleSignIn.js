/**
 * Shared Google Sign-In trigger (Google Identity Services popup).
 *
 * Single source of truth for *starting* the flow, so every entry point
 * (the primary button, the "Continue as X" banner) behaves identically.
 * Previously each one hardcoded its own redirect to auth.emergentagent.com,
 * which is exactly how one of them got missed when the flow changed.
 *
 * Returns:
 *   start(intentRole?) — opens Google's popup and completes sign-in
 *   busy               — true while the popup / exchange is in flight
 *   available          — false when REACT_APP_GOOGLE_CLIENT_ID is unset
 */
import { useCallback, useContext, useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { toast } from 'sonner';
import { AuthContext } from '../../App';
import completeGoogleSignIn, { SIGNUP_INTENT_ROLE_KEY } from './completeGoogleSignIn';

export const GOOGLE_CLIENT_ID = process.env.REACT_APP_GOOGLE_CLIENT_ID;
const GIS_SRC = 'https://accounts.google.com/gsi/client';

/** Inject the GIS script once; resolve when the OAuth namespace is ready. */
let gisPromise = null;
function loadGis() {
  if (gisPromise) return gisPromise;
  gisPromise = new Promise((resolve, reject) => {
    if (window.google?.accounts?.oauth2) return resolve();
    const existing = document.querySelector(`script[src="${GIS_SRC}"]`);
    const el = existing || document.createElement('script');
    el.addEventListener('load', () => resolve());
    el.addEventListener('error', () => reject(new Error('Failed to load Google sign-in')));
    if (!existing) {
      el.src = GIS_SRC;
      el.async = true;
      el.defer = true;
      document.head.appendChild(el);
    }
  });
  return gisPromise;
}

export default function useGoogleSignIn() {
  const navigate = useNavigate();
  const { login } = useContext(AuthContext);
  const [busy, setBusy] = useState(false);
  const clientRef = useRef(null);

  // Preload the script so the first click doesn't wait on a network hop
  // (popup blockers are less forgiving once a click has been awaited).
  useEffect(() => {
    if (GOOGLE_CLIENT_ID) loadGis().catch(() => { /* surfaced on click */ });
  }, []);

  const start = useCallback(async (intentRole = '') => {
    if (busy) return;
    setBusy(true);

    // Stash role intent before the popup so it survives the round-trip.
    if (intentRole && ['owner', 'provider'].includes(intentRole)) {
      try { sessionStorage.setItem(SIGNUP_INTENT_ROLE_KEY, intentRole); } catch { /* private mode */ }
    }

    try {
      await loadGis();
      if (!clientRef.current) {
        clientRef.current = window.google.accounts.oauth2.initTokenClient({
          client_id: GOOGLE_CLIENT_ID,
          scope: 'openid email profile',
          callback: async (resp) => {
            if (resp?.error || !resp?.access_token) {
              setBusy(false);
              toast.error(resp?.error_description || 'Google sign-in was cancelled');
              return;
            }
            try {
              await completeGoogleSignIn(resp.access_token, login, navigate);
            } catch (e) {
              const msg = e?.response?.data?.detail || e.message || 'Google sign-in failed';
              toast.error(String(msg));
            } finally {
              setBusy(false);
            }
          },
          // Popup closed or blocked — reset so the user can retry.
          error_callback: () => setBusy(false),
        });
      }
      clientRef.current.requestAccessToken();
    } catch (e) {
      setBusy(false);
      toast.error(e.message || 'Google sign-in unavailable');
    }
  }, [busy, login, navigate]);

  return { start, busy, available: Boolean(GOOGLE_CLIENT_ID) };
}
