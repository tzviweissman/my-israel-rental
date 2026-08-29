/**
 * The shell behind the self-playing cards on /why-list.
 *
 * Extracted when the second and third card were built. The beat
 * machinery is the part with all the decisions in it — play-on-scroll,
 * finished-by-default, reduced motion — and three copies of it is three
 * places for one of those decisions to quietly not travel.
 *
 * WHAT A CARD IS. Copy on one side, a small mock UI on the other that
 * plays a short sequence. The pattern is from nomu.store (Tzvi, 29 Aug
 * 2026), where each feature card performs its feature rather than
 * describing it — legible in about two seconds, which the paragraph
 * underneath is not.
 *
 * THE THREE RULES THE SHELL ENFORCES, so a card body cannot get them
 * wrong:
 *
 *   Plays on SCROLL, not hover. Hover would make the idea invisible on a
 *   phone, which is where this audience is. Pointer-enter replays it on
 *   desktop as a bonus, never as the mechanism.
 *
 *   Renders FINISHED; JS rewinds before paint. The usual `opacity: 0`
 *   start leaves a blank card whenever the script does not run, and
 *   nobody notices because whoever checks has working JS. Same principle
 *   as the `.js-reveal` pattern already used here.
 *
 *   Reduced motion gets the finished state and no transitions.
 *
 * A card body receives `at(n)` and renders whatever it likes. It must not
 * show a NUMBER — no counts, no ratings, no "seen by N people". These sit
 * in the most persuasive position on the page, which is exactly where an
 * invented figure does the most damage; every figure a user sees comes
 * from the database (CLAUDE.md). `scripts/check-get-found-card.mjs`
 * fails on any digit inside a card.
 */
import { useEffect, useLayoutEffect, useRef, useState } from 'react';

const prefersReducedMotion = () => {
  try {
    return window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  } catch {
    return false;
  }
};

/**
 * @param {number} count how many beats, including the resting first one
 * @param {number} gap   ms between beats
 */
export function useBeats(count, gap = 570) {
  const last = count - 1;
  // Starts FINISHED — see the note above.
  const [beat, setBeat] = useState(last);
  const [reduced, setReduced] = useState(false);
  const ref = useRef(null);
  const timers = useRef([]);

  useLayoutEffect(() => {
    if (prefersReducedMotion()) { setReduced(true); return; }
    setBeat(0);   // rewind before paint, so the finish never flashes
  }, []);

  useEffect(() => {
    if (reduced || !ref.current) return undefined;
    const el = ref.current;

    const play = () => {
      timers.current.forEach(clearTimeout);
      timers.current = Array.from({ length: count }, (_, i) =>
        setTimeout(() => setBeat(i), i * gap));
    };

    // Once, and only once it is actually on screen: a sequence that runs
    // three screens below has finished before anybody looks at it.
    let seen = false;
    const io = new IntersectionObserver((entries) => {
      entries.forEach((e) => { if (e.isIntersecting && !seen) { seen = true; play(); } });
    }, { threshold: 0.4 });
    io.observe(el);

    const replay = () => { if (seen) play(); };
    el.addEventListener('mouseenter', replay);

    return () => {
      io.disconnect();
      el.removeEventListener('mouseenter', replay);
      timers.current.forEach(clearTimeout);
    };
  }, [reduced, count, gap]);

  const shown = reduced ? last : beat;
  return { ref, shown, at: (n) => shown >= n };
}

/**
 * @param {string}   title
 * @param {string}   body
 * @param {boolean}  flip   demo on the start side instead of the end side
 * @param {node}     children  the mock UI
 */
export default function DemoCard({ title, body, flip = false, testid, innerRef, beat, children }) {
  return (
    <div
      ref={innerRef}
      className="rounded-2xl border overflow-hidden grid md:grid-cols-2"
      style={{ borderColor: 'var(--brand-border)', background: 'var(--surface)' }}
      data-testid={testid}
      data-beat={beat}
    >
      {/* The claim. `order` rather than a reversed grid: on mobile every
          card must read copy-then-demo regardless of which side the demo
          takes on desktop, or the alternating rhythm turns into a
          paragraph that arrives after its own illustration. */}
      <div className={`p-6 sm:p-8 flex flex-col justify-center ${flip ? 'md:order-2' : ''}`}>
        <h3
          className="text-xl sm:text-2xl font-bold mb-2"
          style={{ fontFamily: 'var(--font-head)', color: 'var(--ink)' }}
        >
          {title}
        </h3>
        <p className="text-sm leading-relaxed" style={{ color: 'var(--brand-muted)' }}>
          {body}
        </p>
      </div>

      <div
        className={`p-6 sm:p-8 ${flip ? 'md:order-1' : ''}`}
        style={{
          background: 'var(--bg)',
          // Logical, so the divider lands on the correct edge in RTL.
          [flip ? 'borderInlineEnd' : 'borderInlineStart']: '1px solid var(--brand-border)',
        }}
      >
        {children}
      </div>
    </div>
  );
}
