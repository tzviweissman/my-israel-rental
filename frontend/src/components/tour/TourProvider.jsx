/**
 * The tour engine (spec T4).
 *
 * It never fires by itself. `start()` is called from T7's entry points and
 * from nowhere else — there is no effect in this file that begins a tour.
 *
 * SEQUENCING, which is where tours actually break:
 *
 *   1. Navigate to the step's route if we are not on it.
 *   2. Poll for the `data-tour` target to exist, with a timeout.
 *   3. Scroll it to the middle of the screen.
 *   4. WAIT FOR THE SCROLL TO SETTLE, then hand it to the coach-mark.
 *
 * Step 4 is the one everybody skips. Measuring while a smooth scroll is
 * still running gives you the rect the target had a moment ago, and the
 * tooltip lands somewhere near where the control used to be. The wait here
 * is a stability check — poll the rect until it stops moving — rather than
 * a fixed timeout, because a fixed timeout is either too short on a slow
 * page or wasted on a fast one.
 *
 * A MISSING TARGET IS SKIPPED SILENTLY. An owner with no business yet has
 * no "design your page" button, and a tour that dead-ends there, or draws
 * an arrow pointing at nothing, is worse than one that quietly moves on.
 * Which steps were skipped is recorded (T4's drop-off tracking).
 *
 * THE OWNER IS PUT BACK WHERE THEY STARTED when the tour ends or is exited.
 * Being abandoned three pages deep is its own small betrayal.
 */
import React, {
  createContext, useCallback, useContext, useEffect, useMemo, useRef, useState,
} from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import axios from 'axios';
import { API, AuthContext } from '../../App';
import CoachMark from './CoachMark';
import { stepsForRole, tourRoleFor } from './tourSteps';

const TourContext = createContext(null);

const TARGET_TIMEOUT_MS = 4000;   // long enough for a tab to mount, short
                                  // enough that a missing target is not a
                                  // visible stall
const SETTLE_TIMEOUT_MS = 900;

const sel = (target) => `[data-tour="${target}"]`;

const prefersReducedMotion = () => typeof window !== 'undefined'
  && window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;

/** Wait until `sel` exists, or give up. */
function waitForTarget(target, timeout = TARGET_TIMEOUT_MS) {
  return new Promise((resolve) => {
    const found = document.querySelector(sel(target));
    if (found) { resolve(found); return; }
    const started = Date.now();
    const tick = () => {
      const el = document.querySelector(sel(target));
      if (el) { resolve(el); return; }
      if (Date.now() - started > timeout) { resolve(null); return; }
      requestAnimationFrame(tick);
    };
    requestAnimationFrame(tick);
  });
}

/** Scroll into view, then wait until the rect stops moving. */
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
      // Two identical frames is enough to call a smooth scroll finished.
      if (stable >= 2 || Date.now() - started > SETTLE_TIMEOUT_MS) { resolve(); return; }
      requestAnimationFrame(tick);
    };
    requestAnimationFrame(tick);
  });
}

export default function TourProvider({ children }) {
  const { t } = useTranslation();
  const { user, token } = useContext(AuthContext);
  const navigate = useNavigate();
  const location = useLocation();

  const [active, setActive] = useState(false);
  const [stepIndex, setStepIndex] = useState(0);
  const [targetEl, setTargetEl] = useState(null);
  const [skipped, setSkipped] = useState(() => new Set());
  const returnTo = useRef(null);
  const runId = useRef(0);

  const steps = useMemo(() => stepsForRole(user?.role), [user?.role]);

  /** Fire-and-forget analytics. Never blocks or breaks the tour. */
  const record = useCallback((event, stepId) => {
    if (!token) return;
    axios.post(`${API}/onboarding/tour`, {
      event,
      step_id: stepId || null,
      role: tourRoleFor(user?.role),
    }, { headers: { Authorization: `Bearer ${token}` } }).catch(() => {});
  }, [token, user?.role]);

  const finish = useCallback((event) => {
    setActive(false);
    setTargetEl(null);
    record(event);
    const back = returnTo.current;
    returnTo.current = null;
    if (back && back !== window.location.pathname + window.location.search) {
      navigate(back, { replace: true });
    }
  }, [navigate, record]);

  /* Resolve the current step: navigate, wait, scroll, settle, show. Each
     run is stamped so a step that resolves late — after the owner pressed
     Next twice — cannot overwrite a newer one. */
  useEffect(() => {
    if (!active) return undefined;
    const step = steps[stepIndex];
    if (!step) { finish('completed'); return undefined; }

    const myRun = (runId.current += 1);
    let cancelled = false;
    setTargetEl(null);

    (async () => {
      if (step.route) {
        const here = window.location.pathname + window.location.search;
        if (here !== step.route) navigate(step.route);
      }
      const el = await waitForTarget(step.target);
      if (cancelled || myRun !== runId.current) return;

      if (!el) {
        // Silently skip, and remember that we did.
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
    // `location` is deliberately not a dependency: navigation is driven
    // from inside this effect, and reacting to it would re-run the step.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [active, stepIndex, steps]);

  const start = useCallback((fromIndex = 0) => {
    if (!steps.length) return;
    returnTo.current = location.pathname + location.search;
    setSkipped(new Set());
    setStepIndex(Math.min(Math.max(0, fromIndex), steps.length - 1));
    setActive(true);
    record('started');
  }, [steps.length, location, record]);

  const next = useCallback(() => setStepIndex((i) => i + 1), []);
  const back = useCallback(() => setStepIndex((i) => Math.max(0, i - 1)), []);
  const exit = useCallback(() => {
    const step = steps[stepIndex];
    // Which step lost them is the only version of this number that leads
    // to a fix, so the step id goes with the exit.
    record('exited', step?.id);
    setActive(false);
    setTargetEl(null);
    const backTo = returnTo.current;
    returnTo.current = null;
    if (backTo) navigate(backTo, { replace: true });
  }, [steps, stepIndex, navigate, record]);

  const value = useMemo(() => ({
    start, active, available: steps.length > 0,
  }), [start, active, steps.length]);

  // The count the owner sees excludes steps we already know were skipped,
  // so "3 of 6" does not silently become a tour that ends at 5.
  const total = steps.length - skipped.size;
  const shownIndex = steps
    .slice(0, stepIndex + 1)
    .filter((s) => !skipped.has(s.id)).length;
  const step = steps[stepIndex];

  return (
    <TourContext.Provider value={value}>
      {children}
      {active && step && targetEl && (
        <CoachMark
          targetEl={targetEl}
          title={t(`tour.step.${step.id}.title`, step.id)}
          body={t(`tour.step.${step.id}.body`, '')}
          index={shownIndex}
          total={Math.max(total, shownIndex)}
          isFirst={stepIndex === 0}
          isLast={stepIndex >= steps.length - 1}
          onNext={() => (stepIndex >= steps.length - 1 ? finish('completed') : next())}
          onBack={back}
          onExit={exit}
        />
      )}
    </TourContext.Provider>
  );
}

export function useTour() {
  return useContext(TourContext);
}
