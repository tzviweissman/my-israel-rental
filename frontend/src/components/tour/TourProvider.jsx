/**
 * The walk engine (spec T4, rebuilt 22 Sep 2026 as the site's one guide -
 * see tourSteps.js for what it walks through and why).
 *
 * Mounted once for the whole app, not inside the dashboard: the walk
 * visits the Requests board and sends people to the add-a-service form,
 * and the "Continue the walk" bar has to follow them there.
 *
 * WHEN IT RUNS
 *   * `?tour=first` - set once, by the add-a-business wizard, the first
 *     time someone publishes. Starts only if this account has never started
 *     a walk (server-side, so a second device does not replay it).
 *   * `?tour=1` - "Show me around", from the nav menu or the dashboard.
 *     Picks up where they left off (the server's resume point), or starts
 *     again once finished.
 *   Nothing else starts it. There is no effect here that begins a walk on
 *   its own account.
 *
 * SEQUENCING, which is where tours actually break:
 *   1. Navigate to the stop's page if we are not on it.
 *   2. Poll for a `data-tour` target to exist, with a timeout.
 *   3. Scroll it to the middle of the screen.
 *   4. WAIT FOR THE SCROLL TO SETTLE, then hand it to the coach-mark.
 * Measuring while a smooth scroll is still running gives the rect the
 * target had a moment ago; the wait is a stability check, not a timeout.
 *
 * A MISSING TARGET IS SKIPPED SILENTLY. A host with no contract uploaded,
 * or a business with no listing yet, has nothing to point at there, and an
 * arrow pointing at nothing is worse than a walk that moves on.
 *
 * "DO IT NOW" PAUSES rather than ends: the coach-mark steps aside, the
 * form opens, and a small bar at the bottom of the screen carries them
 * back ("Continue the walk") whenever they are done or change their mind.
 */
import React, {
  createContext, useCallback, useContext, useEffect, useMemo, useRef, useState,
} from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import axios from 'axios';
import { toast } from 'sonner';
import { Compass, X } from 'lucide-react';
import { API, AuthContext } from '../../App';
import CoachMark from './CoachMark';
import { WALKS, stepKey, tourRoleFor } from './tourSteps';

const TourContext = createContext(null);

const TARGET_TIMEOUT_MS = 4000;
const SETTLE_TIMEOUT_MS = 900;

const selectorFor = (target) => (Array.isArray(target) ? target : [target])
  .map((t) => `[data-tour="${t}"]`).join(',');

const prefersReducedMotion = () => typeof window !== 'undefined'
  && window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;

/** The first of the stop's targets to appear, or null. Visible ones only:
 *  a phone hides the sidebar, and pointing at a hidden element draws a
 *  spotlight on nothing. */
function waitForTarget(target, timeout = TARGET_TIMEOUT_MS) {
  const find = () => [...document.querySelectorAll(selectorFor(target))]
    .find((el) => el.getClientRects().length > 0) || null;
  return new Promise((resolve) => {
    const started = Date.now();
    const tick = () => {
      const el = find();
      if (el) { resolve(el); return; }
      if (Date.now() - started > timeout) { resolve(null); return; }
      requestAnimationFrame(tick);
    };
    tick();
  });
}

function scrollAndSettle(el) {
  return new Promise((resolve) => {
    const behavior = prefersReducedMotion() ? 'auto' : 'smooth';
    try { el.scrollIntoView({ block: 'center', inline: 'nearest', behavior }); } catch { /* older browsers */ }
    const started = Date.now();
    let last = null;
    let stable = 0;
    const tick = () => {
      const r = el.getBoundingClientRect();
      const key = `${Math.round(r.top)}x${Math.round(r.left)}`;
      if (key === last) stable += 1; else { stable = 0; last = key; }
      if (stable >= 2 || Date.now() - started > SETTLE_TIMEOUT_MS) { resolve(); return; }
      requestAnimationFrame(tick);
    };
    requestAnimationFrame(tick);
  });
}

export default function TourProvider({ children }) {
  const { t } = useTranslation();
  const { user, token } = useContext(AuthContext) || {};
  const navigate = useNavigate();
  const location = useLocation();

  const [kind, setKind] = useState('business');
  const [active, setActive] = useState(false);
  const [paused, setPaused] = useState(false);
  const [stepIndex, setStepIndex] = useState(0);
  const [targetEl, setTargetEl] = useState(null);
  const [skipped, setSkipped] = useState(() => new Set());
  const [hasListings, setHasListings] = useState(false);
  const returnTo = useRef(null);
  const runId = useRef(0);

  const steps = WALKS[kind] || [];
  const auth = useMemo(() => ({ headers: { Authorization: `Bearer ${token}` } }), [token]);

  const record = useCallback((event, stepId) => {
    if (!token) return;
    axios.post(`${API}/onboarding/tour`, { event, step_id: stepId || null, role: kind }, auth).catch(() => {});
  }, [token, auth, kind]);

  /** What this account has, from the same state the checklist reads. */
  const readState = useCallback(async () => {
    try {
      const { data } = await axios.get(`${API}/onboarding/state`, auth);
      const roles = (data.checklists || []).map((l) => l.role);
      return {
        business: roles.includes('business'),
        host: roles.includes('property'),
        started: Boolean(data.tour?.started),
        lastStep: data.tour?.last_step_id || null,
        completed: Boolean(data.tour?.completed),
      };
    } catch {
      return { business: false, host: false, started: false, lastStep: null, completed: false };
    }
  }, [auth]);

  const offerHostWalk = useCallback(() => {
    toast(t('tour.hostOffer', 'You also rent out a place. Want the short walk for hosts?'), {
      duration: 12000,
      action: { label: t('tour.hostOfferCta', 'Show me'), onClick: () => startRef.current?.({ kind: 'host', fromStart: true }) },
    });
  }, [t]);

  const finish = useCallback((event) => {
    setActive(false);
    setPaused(false);
    setTargetEl(null);
    record(event);
    const back = returnTo.current;
    returnTo.current = null;
    if (back && back !== window.location.pathname + window.location.search) navigate(back, { replace: true });
    if (event === 'completed' && kind === 'business' && hasListings) offerHostWalk();
  }, [navigate, record, kind, hasListings, offerHostWalk]);

  /* Resolve the current stop. Each run is stamped so a stop that resolves
     late - after two quick Nexts - cannot overwrite a newer one. */
  useEffect(() => {
    if (!active || paused) return undefined;
    const step = steps[stepIndex];
    if (!step) { finish('completed'); return undefined; }

    const myRun = (runId.current += 1);
    let cancelled = false;
    setTargetEl(null);

    (async () => {
      const here = window.location.pathname + window.location.search;
      if (step.route && here !== step.route) navigate(step.route);
      const el = await waitForTarget(step.target);
      if (cancelled || myRun !== runId.current) return;
      if (!el) {
        setSkipped((prev) => new Set(prev).add(step.id));
        record('step_skipped', step.id);
        setStepIndex((i) => i + 1);
        return;
      }
      await scrollAndSettle(el);
      if (cancelled || myRun !== runId.current) return;
      setTargetEl(el);
      record('step_viewed', step.id);
    })();

    return () => { cancelled = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [active, paused, stepIndex, kind]);

  const start = useCallback(async ({ kind: wanted, fromStart = false, onlyIfNew = false } = {}) => {
    if (!token) return;
    const s = await readState();
    if (onlyIfNew && s.started) return;
    setHasListings(s.host);
    const k = wanted || (s.business ? 'business' : s.host ? 'host' : tourRoleFor(user?.role));
    const walk = WALKS[k];
    const resumeAt = !fromStart && !s.completed && s.lastStep
      ? Math.max(0, walk.findIndex((st) => st.id === s.lastStep)) : 0;

    const clean = new URLSearchParams(location.search);
    clean.delete('tour');
    const q = clean.toString();
    returnTo.current = `${location.pathname}${q ? `?${q}` : ''}`;
    setKind(k);
    setSkipped(new Set());
    setPaused(false);
    setStepIndex(resumeAt);
    setActive(true);
    record('started');
  }, [token, readState, user?.role, location, record]);

  const startRef = useRef(start);
  startRef.current = start;

  /* `?tour=1` carries a "Show me around" press across pages; `?tour=first`
     is the add-a-business wizard's one-time hand-off. Stripped at once so a
     refresh, bookmark or shared link does not replay it. */
  useEffect(() => {
    if (active || !token) return;
    const params = new URLSearchParams(location.search);
    const flag = params.get('tour');
    if (flag !== '1' && flag !== 'first') return;
    params.delete('tour');
    const rest = params.toString();
    navigate(`${location.pathname}${rest ? `?${rest}` : ''}`, { replace: true });
    start({ onlyIfNew: flag === 'first' });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [location.search, token, active]);

  const next = useCallback(() => setStepIndex((i) => i + 1), []);
  const back = useCallback(() => setStepIndex((i) => Math.max(0, i - 1)), []);
  const exit = useCallback(() => {
    record('exited', steps[stepIndex]?.id);
    setActive(false);
    setPaused(false);
    setTargetEl(null);
    const backTo = returnTo.current;
    returnTo.current = null;
    if (backTo) navigate(backTo, { replace: true });
  }, [steps, stepIndex, navigate, record]);

  /** "Do it now": step aside, open the form, keep our place. */
  const doIt = useCallback(() => {
    const step = steps[stepIndex];
    if (!step?.doIt) return;
    setPaused(true);
    setTargetEl(null);
    returnTo.current = null;   // they are doing something; do not yank them back
    if (step.doIt.href) navigate(step.doIt.href);
    else if (step.doIt.click) {
      const el = document.querySelector(selectorFor(step.doIt.click));
      // After the overlay is gone, or the click lands on the overlay.
      requestAnimationFrame(() => el?.click());
    }
  }, [steps, stepIndex, navigate]);

  const resume = useCallback(() => {
    setPaused(false);
    if (stepIndex >= steps.length - 1) finish('completed');
    else next();
  }, [stepIndex, steps.length, finish, next]);

  const value = useMemo(() => ({
    start: (opts) => start(opts), active, available: Boolean(token),
  }), [start, active, token]);

  const total = steps.length - skipped.size;
  const shownIndex = steps.slice(0, stepIndex + 1).filter((s) => !skipped.has(s.id)).length;
  const step = steps[stepIndex];
  const key = step ? stepKey(step.id) : '';

  return (
    <TourContext.Provider value={value}>
      {children}
      {active && !paused && step && targetEl && (
        <CoachMark
          targetEl={targetEl}
          title={t(`${key}.title`, step.id)}
          body={t(`${key}.body`, '')}
          doItLabel={step.doIt ? t(`${key}.doIt`, t('tour.doIt', 'Do it now')) : null}
          onDoIt={doIt}
          index={shownIndex}
          total={Math.max(total, shownIndex)}
          isFirst={stepIndex === 0}
          isLast={stepIndex >= steps.length - 1}
          onNext={() => (stepIndex >= steps.length - 1 ? finish('completed') : next())}
          onBack={back}
          onExit={exit}
        />
      )}
      {active && paused && (
        // z-40: under every dialog (z-50 and up), so the form "Do it now"
        // opened is never covered - it sat over a Save button until 23 Sep.
        <div className="fixed inset-x-0 bottom-4 z-40 flex justify-center px-4 pointer-events-none" data-testid="tour-paused">
          <div className="pointer-events-auto flex items-center gap-3 rounded-full border px-4 py-2 shadow-xl"
            style={{ background: 'var(--surface)', borderColor: 'var(--brand-border)' }}>
            <Compass size={16} aria-hidden="true" style={{ color: 'var(--brand-primary)' }} />
            <span className="text-sm" style={{ color: 'var(--ink)' }}>
              {t('tour.pausedAt', 'The walk is waiting: {{index}} of {{total}}', { index: shownIndex, total: Math.max(total, shownIndex) })}
            </span>
            <button type="button" onClick={resume}
              className="px-4 min-h-[44px] rounded-full text-sm font-semibold" style={{ background: 'var(--action, #000)', color: 'var(--action-ink, #fff)' }}
              data-testid="tour-continue">
              {t('tour.continue', 'Continue the walk')}
            </button>
            <button type="button" onClick={exit} aria-label={t('tour.exit', 'End the walk')}
              className="inline-flex items-center justify-center min-h-[44px] min-w-[44px] rounded" style={{ color: 'var(--brand-muted)' }} data-testid="tour-paused-exit">
              <X size={15} />
            </button>
          </div>
        </div>
      )}
    </TourContext.Provider>
  );
}

export function useTour() {
  return useContext(TourContext);
}
