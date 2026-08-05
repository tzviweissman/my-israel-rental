/**
 * "Continue as {name}" one-tap re-login banner.
 *
 * Shown on `/auth/login` when we have a hint from a previous successful
 * login stashed in localStorage. Clicking it fires the same OAuth flow
 * the user completed last time — usually Google — so return visitors
 * are back in with a single tap.
 *
 * The hint is populated by:
 *   • completeGoogleSignIn.js on Google login
 *   • pages/Auth.js on email/password login (falls back to a generic
 *     "Continue as X" that just pre-fills the email field)
 *
 * "Not you?" clears the hint and reveals the normal login controls.
 */
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { User as UserIcon, X } from 'lucide-react';
import { LAST_LOGIN_HINT_KEY } from './completeGoogleSignIn';
import useGoogleSignIn from './useGoogleSignIn';

export default function ContinueAsBanner({ onFocusEmailField }) {
  const { t } = useTranslation();
  // Same Google popup the primary sign-in button uses — shared so the two
  // entry points can't drift (they previously each hardcoded their own
  // redirect, and only one got updated when the provider changed).
  const { start: startGoogleFlow } = useGoogleSignIn();

  // Parse the hint once at mount; if it's malformed we treat it as
  // absent rather than crashing the whole login page.
  const [hint, setHint] = useState(() => {
    try {
      const raw = localStorage.getItem(LAST_LOGIN_HINT_KEY);
      if (!raw) return null;
      const parsed = JSON.parse(raw);
      // Expire hints older than 30 days — after that the user probably
      // changed devices or shared the machine, so bug them for the full
      // login again.
      if (!parsed?.email || (Date.now() - (parsed.ts || 0)) > 30 * 24 * 3600 * 1000) return null;
      return parsed;
    } catch {
      return null;
    }
  });

  if (!hint) return null;

  const displayName = hint.name || hint.email.split('@')[0];
  const initials = displayName
    .split(/\s+/)
    .map((p) => p[0])
    .join('')
    .slice(0, 2)
    .toUpperCase() || '?';

  const handleContinue = () => {
    // Google-signed users get the OAuth flow; email/password users get
    // their email pre-filled so they only need to type their password.
    if (hint.provider === 'google') {
      startGoogleFlow();
    } else if (typeof onFocusEmailField === 'function') {
      onFocusEmailField(hint.email);
    }
  };

  const handleForget = (e) => {
    e.stopPropagation();
    try { localStorage.removeItem(LAST_LOGIN_HINT_KEY); } catch { /* private mode */ }
    setHint(null);
  };

  return (
    <button
      type="button"
      onClick={handleContinue}
      className="group w-full flex items-center gap-3 p-3 mb-4 rounded-xl border border-gray-200 bg-white hover:border-[var(--brand-primary)] hover:shadow-sm transition-all text-left"
      data-testid="continue-as-banner"
    >
      {/* Avatar — picture from Google, otherwise a coloured initials chip */}
      {hint.picture ? (
        <img
          src={hint.picture}
          alt=""
          className="w-11 h-11 rounded-full object-cover shrink-0"
          referrerPolicy="no-referrer"
        />
      ) : (
        <div
          className="w-11 h-11 rounded-full bg-[var(--brand-primary)] text-white flex items-center justify-center font-semibold shrink-0"
          aria-hidden="true"
        >
          {initials}
        </div>
      )}
      <div className="flex-1 min-w-0">
        <div className="text-[11px] font-semibold uppercase tracking-wider text-gray-500">
          {hint.provider === 'google'
            ? t('auth.continueAsGoogle', 'Continue with Google as')
            : t('auth.continueAs', 'Continue as')}
        </div>
        <div className="text-sm font-semibold text-gray-900 truncate" data-testid="continue-as-name">
          {displayName}
        </div>
        <div className="text-xs text-gray-500 truncate">{hint.email}</div>
      </div>
      <UserIcon size={16} className="text-gray-400 group-hover:text-[var(--brand-primary)] transition-colors shrink-0" />
      {/* Tiny dismiss icon in the corner — small so it doesn't compete
          with the primary tap target. */}
      <span
        role="button"
        tabIndex={0}
        onClick={handleForget}
        onKeyDown={(e) => (e.key === 'Enter' || e.key === ' ') && handleForget(e)}
        className="text-gray-300 hover:text-gray-500 transition-colors p-1 -m-1 shrink-0"
        aria-label={t('auth.notYou', 'Not you?')}
        title={t('auth.notYou', 'Not you?')}
        data-testid="continue-as-forget"
      >
        <X size={14} />
      </span>
    </button>
  );
}
