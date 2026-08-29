/**
 * "Get found by people already looking" — a feature card that performs
 * the feature instead of describing it.
 *
 * The pattern is lifted from nomu.store (Tzvi, 29 Aug 2026). Their
 * feature cards each contain a small mock UI that plays a three or four
 * beat sequence — an order card that types "Contacting warehouse…" then
 * resolves to "32 units left". It reads as alive, and more usefully it
 * makes an abstract capability legible in about two seconds, which a
 * paragraph does not.
 *
 * NOT A HOVER EFFECT, deliberately, though it looks like one. It plays
 * when the card scrolls into view. Hover would mean the whole idea is
 * invisible on a phone, which is where most of this audience is.
 *
 * FAIL-SAFE ORDERING. The component renders its FINISHED state and JS
 * rewinds it to the first beat before paint. If the script never runs, a
 * reader sees the completed search with the result in it — the same
 * principle as the `.js-reveal` pattern already used here, and the
 * opposite of the usual `opacity: 0` that leaves a blank card when
 * anything fails.
 *
 * NO NUMBERS. There is no result count, no rating, no "seen by N
 * people". Every figure shown to a user has to come from the database
 * (CLAUDE.md), and this is an illustration — so it shows the shape of a
 * search and nothing that could be read as a statistic.
 */
import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Search, MapPin, Check } from 'lucide-react';

const BEATS = [0, 550, 1150, 1750];
const LAST = BEATS.length - 1;

const prefersReducedMotion = () => {
  try {
    return window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  } catch {
    return false;
  }
};

export default function GetFoundCard() {
  const { t } = useTranslation();
  // Starts FINISHED. See the note above — this is what makes a failed or
  // absent script degrade to a complete card rather than an empty one.
  const [beat, setBeat] = useState(LAST);
  const [reduced, setReduced] = useState(false);
  const ref = useRef(null);
  const timers = useRef([]);

  useLayoutEffect(() => {
    if (prefersReducedMotion()) {
      setReduced(true);
      return;
    }
    // Rewind before paint, so there is no flash of the finished state.
    setBeat(0);
  }, []);

  useEffect(() => {
    if (reduced || !ref.current) return undefined;
    const el = ref.current;

    const play = () => {
      timers.current.forEach(clearTimeout);
      timers.current = BEATS.map((ms, i) => setTimeout(() => setBeat(i), ms));
    };

    // Plays once, when it is actually on screen. A sequence that runs
    // while the card is three screens below has already finished by the
    // time anybody looks at it.
    let seen = false;
    const io = new IntersectionObserver((entries) => {
      entries.forEach((e) => {
        if (e.isIntersecting && !seen) { seen = true; play(); }
      });
    }, { threshold: 0.4 });
    io.observe(el);

    // Replaying on pointer-enter is a desktop nicety only; the observer
    // above is what makes it work at all.
    const replay = () => { if (beat === LAST) play(); };
    el.addEventListener('mouseenter', replay);

    return () => {
      io.disconnect();
      el.removeEventListener('mouseenter', replay);
      timers.current.forEach(clearTimeout);
    };
    // `beat` is read inside replay only; re-subscribing on every beat
    // would tear down the observer mid-sequence.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [reduced]);

  const shown = reduced ? LAST : beat;
  const at = (n) => shown >= n;

  return (
    <div
      ref={ref}
      className="rounded-2xl border overflow-hidden grid md:grid-cols-2"
      style={{ borderColor: 'var(--brand-border)', background: 'var(--surface)' }}
      data-testid="get-found-card"
      data-beat={shown}
    >
      {/* The claim */}
      <div className="p-6 sm:p-8 flex flex-col justify-center">
        <h3
          className="text-xl sm:text-2xl font-bold mb-2"
          style={{ fontFamily: 'var(--font-head)', color: 'var(--ink)' }}
        >
          {t('whyList.getFoundTitle', 'Get found by people already looking')}
        </h3>
        <p className="text-sm leading-relaxed" style={{ color: 'var(--brand-muted)' }}>
          {t('whyList.getFoundBody',
            'Someone searches for what you do, in the area you work, and your business is one of the answers. No ads, no commission.')}
        </p>
      </div>

      {/* The demonstration */}
      <div
        className="p-6 sm:p-8"
        style={{ background: 'var(--bg)', borderInlineStart: '1px solid var(--brand-border)' }}
      >
        {/* The search box */}
        <div
          className="flex items-center gap-2 rounded-xl px-3 py-2.5 mb-3"
          style={{ background: 'var(--surface)', border: '1px solid var(--brand-border)' }}
          data-testid="get-found-query"
        >
          <Search size={15} style={{ color: 'var(--brand-muted)' }} aria-hidden="true" />
          <span
            className="text-sm"
            dir="auto"
            style={{ color: at(1) ? 'var(--ink)' : 'var(--brand-muted)' }}
          >
            {at(1)
              ? t('whyList.getFoundQuery', 'cleaner in Jerusalem')
              : ' '}
          </span>
          {!at(1) && (
            <span
              aria-hidden="true"
              className="gf-caret"
              style={{ background: 'var(--brand-primary)' }}
            />
          )}
        </div>

        {/* Results. Two neutral rows, then the one that is theirs. */}
        <div className="space-y-2" data-testid="get-found-results">
          {[0, 1].map((i) => (
            <div
              key={i}
              className="rounded-xl px-3 py-2.5 flex items-center gap-3 gf-row"
              style={{
                background: 'var(--surface)',
                border: '1px solid var(--brand-border)',
                opacity: at(2) ? 1 : 0,
                transform: at(2) ? 'none' : 'translateY(6px)',
                transitionDelay: `${i * 70}ms`,
              }}
            >
              <span className="w-7 h-7 rounded-lg shrink-0" style={{ background: 'var(--brand-border)' }} />
              <span className="flex-1 space-y-1.5">
                <span className="block h-2 rounded-full" style={{ background: 'var(--brand-border)', width: '58%' }} />
                <span className="block h-2 rounded-full" style={{ background: 'var(--brand-border)', width: '34%' }} />
              </span>
            </div>
          ))}

          {/* Theirs. Gold on white is the accent the system already uses;
              no rank, no count, no rating — it is a card in a list, not a
              claim about position. */}
          <div
            className="rounded-xl px-3 py-2.5 flex items-center gap-3 gf-row"
            style={{
              background: 'var(--surface)',
              border: '1.5px solid var(--gold)',
              boxShadow: at(3) ? '0 6px 18px -8px rgba(35,32,27,.28)' : 'none',
              opacity: at(3) ? 1 : 0,
              transform: at(3) ? 'none' : 'translateY(8px)',
            }}
            data-testid="get-found-yours"
          >
            <span
              className="w-7 h-7 rounded-lg shrink-0 inline-flex items-center justify-center"
              style={{ background: 'var(--gold)', color: 'var(--ink)' }}
            >
              <Check size={14} aria-hidden="true" />
            </span>
            <span className="min-w-0">
              <span className="block text-sm font-semibold truncate" style={{ color: 'var(--ink)' }}>
                {t('whyList.getFoundYours', 'Your business')}
              </span>
              <span
                className="flex items-center gap-1 text-[11px]"
                style={{ color: 'var(--brand-muted)' }}
              >
                <MapPin size={11} aria-hidden="true" />
                {t('whyList.getFoundArea', 'Jerusalem')}
              </span>
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}
