/**
 * Onboarding state, and the rule that only ONE piece of it shows at a time.
 *
 * Specs: `docs/onboarding-tutorial-spec.md` T1 (checklist), T2 (tips),
 * T7 (making the help findable).
 *
 * WHY A PROVIDER RATHER THAN LOCAL STATE PER TIP
 * ----------------------------------------------
 * Both T2 and T7 say the same thing in different words — *"never more than
 * one visible at a time anywhere on screen"*. The tempting reading is that
 * the tips happen to live on different screens so they cannot collide. That
 * is not a guarantee, it is a coincidence of today's routing: the share
 * panel and the availability editor are both reachable inside the same tab,
 * and a checklist offer sits on the dashboard where a first-login line also
 * wants to appear. The spec asks for the gating to be BUILT, so it is built
 * here rather than assumed.
 *
 * Every candidate registers itself while mounted. Exactly one wins, chosen
 * by a fixed priority, and everything else renders nothing.
 *
 * WHY DISMISSALS GO TO THE SERVER
 * -------------------------------
 * `localStorage` alone re-shows every tip the first time someone opens the
 * dashboard on their phone, which reads as the site having forgotten them.
 * The state comes from `/onboarding/state` and dismissal posts to
 * `/onboarding/dismiss`; the local copy updates immediately so the tip
 * disappears on click rather than after a round trip.
 */
import React, {
  createContext, useCallback, useContext, useEffect, useMemo, useState,
} from 'react';
import axios from 'axios';
import { API, AuthContext } from '../../App';

/* Priority order, highest first. Deliberate, not alphabetical:
   - A TIP outranks an offer. A tip is a caption on the thing the owner is
     looking at right now; an offer is a generic invitation, and the
     specific beats the generic when both want the same slot.
   - Among offers, the one tied to a moment beats the standing one:
     finishing the checklist is a real event, arriving for the first time is
     a real event, and "prefer to be shown?" under the checklist is always
     available and can wait. */
const PRIORITY = [
  'tip.share',
  'tip.chat',
  'tip.availability',
  'offer.complete',
  'offer.firstLogin',
  'offer.emptyState',
  'offer.checklist',
];

/* Ids like `tip.share` and `biz.logo` are the API's contract and read
   well in code. They cannot be used as translation keys directly: i18next
   treats "." as a key separator, so `t('tips.tip.share')` looks for
   tips -> tip -> share and silently returns the key itself when it does
   not find it. That failure renders the raw key on screen in both
   languages, which is exactly the kind of thing that ships. */
export const localeKeyFor = (id) => String(id || '').replace(/\./g, '_');

const OnboardingContext = createContext(null);

export default function OnboardingProvider({ children }) {
  const { token } = useContext(AuthContext);
  const [state, setState] = useState(null);
  // Ids currently mounted and otherwise eligible to show.
  const [claims, setClaims] = useState(() => new Set());

  useEffect(() => {
    if (!token) { setState(null); return undefined; }
    let cancelled = false;
    (async () => {
      try {
        const { data } = await axios.get(`${API}/onboarding/state`, {
          headers: { Authorization: `Bearer ${token}` },
        });
        if (!cancelled) setState(data);
      } catch {
        /* Onboarding is help, not function. If it cannot load, the
           dashboard must still work — so this fails to "show nothing"
           rather than to an error state. */
        if (!cancelled) setState({ checklists: [], dismissed: [] });
      }
    })();
    return () => { cancelled = true; };
  }, [token]);

  const dismiss = useCallback(async (id) => {
    // Locally first: the thing vanishes on click. A tip that lingers while
    // a request is in flight reads as a broken close button, and people
    // press it again.
    setState((prev) => (prev
      ? { ...prev, dismissed: [...new Set([...(prev.dismissed || []), id])] }
      : prev));
    try {
      await axios.post(`${API}/onboarding/dismiss`, { id }, {
        headers: { Authorization: `Bearer ${token}` },
      });
    } catch {
      /* Deliberately not rolled back. If the write failed the tip returns
         on the next load, which is a mild annoyance; snapping it back onto
         the screen under the cursor is worse. */
    }
  }, [token]);

  const claim = useCallback((id, wanted) => {
    setClaims((prev) => {
      const has = prev.has(id);
      if (wanted === has) return prev;
      const next = new Set(prev);
      if (wanted) next.add(id); else next.delete(id);
      return next;
    });
  }, []);

  const dismissed = useMemo(
    () => new Set(state?.dismissed || []),
    [state],
  );

  // The single winner. Computed from the fixed order rather than from
  // mount order, so which tip you see does not depend on React's rendering
  // sequence — that would be a different answer on a different day.
  const activeId = useMemo(
    () => PRIORITY.find((id) => claims.has(id) && !dismissed.has(id)) || null,
    [claims, dismissed],
  );

  const value = useMemo(() => ({
    state, dismissed, dismiss, claim, activeId, ready: state !== null,
  }), [state, dismissed, dismiss, claim, activeId]);

  return (
    <OnboardingContext.Provider value={value}>
      {children}
    </OnboardingContext.Provider>
  );
}

export function useOnboarding() {
  return useContext(OnboardingContext);
}

/**
 * Register for the single on-screen slot.
 *
 * @param {string} id        one of PRIORITY
 * @param {boolean} eligible whether this thing would show if it could
 * @returns {{visible: boolean, dismiss: function}}
 */
export function useOnboardingSlot(id, eligible) {
  const ctx = useContext(OnboardingContext);
  const claim = ctx?.claim;
  const wanted = Boolean(eligible) && Boolean(ctx?.ready) && !ctx?.dismissed?.has(id);

  useEffect(() => {
    if (!claim) return undefined;
    claim(id, wanted);
    // Released on unmount so navigating away frees the slot for whatever
    // is on the next screen.
    return () => claim(id, false);
  }, [claim, id, wanted]);

  return {
    visible: Boolean(ctx) && ctx.activeId === id,
    dismiss: () => ctx?.dismiss(id),
  };
}
