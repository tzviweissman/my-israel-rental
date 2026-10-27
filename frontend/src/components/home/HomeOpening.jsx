/**
 * The home page's opening (Tzvi, 15 Oct 2026; chosen from five versions on
 * scrollcraft/builds/home-openings, "go with d").
 *
 *   1. A golden-hour film of the Old City fills the screen (generated with
 *      Higgsfield; Tzvi picked it from five stills). Over it the site's own
 *      counts rise one by one and count up from zero.
 *   2. Scrolling, the words lift away and the picture cracks along a grid;
 *      the pieces part.
 *   3. Each piece turns over, a wave from the middle out, to show a real
 *      business page, stay or business on its back.
 *   4. The wall steps aside and the headline and doors come in.
 *
 * The tiles: real stays and businesses picked by eye (no flyers, logos or
 * collages), from /api/home/opening-tiles, which answers with only the
 * picks still listed and their photos as they are now; and the business
 * pages from /showcase/showcase.json. A photo that fails to load drops its
 * tile, and the wall repeats what is left, so a deleted listing never
 * leaves a hole. Every number is live; a count that has not arrived is not
 * shown. Reduced motion gets the end state, still.
 */
import React, { useEffect, useMemo, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';
import { Home as HomeIcon, Store, UtensilsCrossed, Megaphone } from 'lucide-react';
import { useShowcase } from '../showcase/ShowcaseCard';
import { API } from '../../lib/apiBase';
import '../../styles/home-opening.css';

const STILL = typeof window !== 'undefined' && !!window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
const isPhone = () => typeof window !== 'undefined' && window.innerWidth <= 760;
// The screen height the opening measures against. On an iPhone the address bar shrinks the
// moment you start scrolling and window.innerHeight grows by ~90 px; the opening re-measured
// against it and every piece jumped (Tzvi, 26 Oct 2026: "the hero page glitches a lot on
// mobile"). The height is taken once and only re-taken when the width changes (a rotation).
let steadyH = typeof window !== 'undefined' ? window.innerHeight : 800;
let steadyW = typeof window !== 'undefined' ? window.innerWidth : 0;
const screenH = () => {
  if (window.innerWidth !== steadyW) { steadyW = window.innerWidth; steadyH = window.innerHeight; }
  return steadyH;
};
// Writes a style only when it changed: rewriting the same values on 35 pieces every frame
// made the browser restyle the whole wall each frame, the heaviest part of the opening on a phone.
const put = (el, k, v) => {
  const c = el.__put || (el.__put = {});
  if (c[k] === v) return;
  c[k] = v;
  if (k.startsWith('--')) el.style.setProperty(k, v); else el.style[k] = v;
};
const lin = (x, a, b) => Math.min(1, Math.max(0, (x - a) / (b - a)));
const ease = (x) => 1 - (1 - Math.min(1, Math.max(0, x))) ** 3;

function useTiles(he) {
  const pages = useShowcase();
  const [picks, setPicks] = useState(null);
  const [dead, setDead] = useState(() => new Set());
  useEffect(() => {
    let alive = true;
    fetch(`${API}/home/opening-tiles`).then((r) => (r.ok ? r.json() : {}))
      .then((d) => { if (alive) setPicks(d || {}); })
      .catch(() => { if (alive) setPicks({}); });
    return () => { alive = false; };
  }, []);
  const tiles = useMemo(() => {
    if (!pages || !picks) return [];
    // The Gift Boutique's tile is its box opening, the rest their page clips
    const clips = pages.map((p) => (p.slug === 'the-gift-boutique'
      ? { kind: 'clip', src: '/home/gift-open.mp4', poster: '/home/gift-open.webp', label: p.name, href: `/business/${p.slug}`, full: true }
      : { kind: 'clip', src: `/showcase/${p.slug}.mp4${p.v ? `?v=${p.v}` : ''}`, poster: `/showcase/${p.slug}.webp${p.v ? `?v=${p.v}` : ''}`, label: p.name, href: `/business/${p.slug}`, full: true }));
    const stays = picks.stays || [];
    const biz = (picks.businesses || []).map((b) => ({ ...b, label: (he && b.label_he) || b.label }));
    const out = [];
    for (let i = 0; i < Math.max(stays.length, clips.length, biz.length); i++) {
      [stays[i], clips[i], biz[i]].forEach((x) => { if (x && !dead.has(x.src)) out.push(x); });
    }
    return out;
  }, [pages, picks, dead, he]);
  const drop = (src) => setDead((s) => (s.has(src) ? s : new Set(s).add(src)));
  return [tiles, drop];
}

/** Counts up from zero once, after a delay, so the lines arrive in turn. */
function Rise({ n, delay, children }) {
  const [v, setV] = useState(STILL ? n : 0);
  const [on, setOn] = useState(STILL);
  useEffect(() => {
    if (STILL || n == null) { setOn(true); setV(n); return undefined; }
    let raf = 0;
    const t = setTimeout(() => {
      setOn(true);
      const t0 = performance.now();
      const tick = (now) => {
        const x = Math.min(1, (now - t0) / 1600);
        setV(Math.round(n * (1 - (1 - x) ** 4)));
        if (x < 1) raf = requestAnimationFrame(tick);
      };
      raf = requestAnimationFrame(tick);
    }, delay);
    return () => { clearTimeout(t); cancelAnimationFrame(raf); };
  }, [n, delay]);
  return <li className={on ? 'in' : ''}>{children(v)}</li>;
}

export default function HomeOpening({ counts }) {
  const { t, i18n } = useTranslation();
  const navigate = useNavigate();
  const [tiles, drop] = useTiles((i18n.language || '').startsWith('he'));
  const [phone, setPhone] = useState(isPhone);
  const sec = useRef(null);
  const film = useRef(null);
  const video = useRef(null);
  const grid = useRef(null);
  const shift = useRef(null);
  const scene = useRef(null);
  const copy = useRef(null);

  useEffect(() => {
    const onResize = () => setPhone(isPhone());
    window.addEventListener('resize', onResize);
    return () => window.removeEventListener('resize', onResize);
  }, []);

  const COLS = phone ? 5 : 7;
  const ROWS = phone ? 7 : 5;
  const cells = useMemo(() => {
    if (!tiles.length) return [];
    const midR = (ROWS - 1) / 2;
    const midC = (COLS - 1) / 2;
    return Array.from({ length: COLS * ROWS }, (_, i) => ({
      tile: tiles[i % tiles.length],
      d: Math.hypot((i % COLS) - midC, Math.floor(i / COLS) - midR),
    }));
  }, [tiles, COLS, ROWS]);

  // The light nav once the light ground shows; the site's dark-glass nav
  // over the film.
  useEffect(() => () => document.body.classList.remove('hv2-light-nav'), []);

  useEffect(() => {
    const el = sec.current;
    if (!el || !cells.length) return undefined;
    const maxD = Math.max(...cells.map((c) => c.d));
    const IW = phone ? 720 : 1920;
    const IH = phone ? 1280 : 1080;
    // the wall's size when it steps aside: whatever leaves the headline its
    // full width plus a gap (Tzvi: "the letters cover it a little")
    const cw = Math.min(window.innerWidth * 0.42, 560) + Math.max(16, window.innerWidth * 0.05);
    const fit = Math.min(0.56, (window.innerWidth - cw - 40) / window.innerWidth);
    const pieces = [...grid.current.querySelectorAll('.ho-t')];
    let raf = 0;
    const paint = () => {
      raf = 0;
      const r = el.getBoundingClientRect();
      const p = STILL ? 1 : lin(-r.top, 0, r.height - screenH());
      // 1. the words lift away
      const w = lin(p, 0.03, 0.11);
      put(scene.current, 'opacity', String(1 - w));
      put(scene.current, 'transform', `translateY(${-30 * w}px)`);
      scene.current.classList.toggle('on', w < 0.5);
      // 2. the picture cracks and the pieces part
      const c = ease(lin(p, 0.12, 0.24));
      put(film.current, 'opacity', p < 0.12 ? '1' : '0');
      const g = grid.current;
      // Written straight onto the grid and the faces, not as --gap/--pad/--rad: a custom
      // property is inherited, so changing one on the grid restyled every element in the wall
      // each frame (about 45 ms a frame on a phone-speed test, the whole cost of the opening).
      put(g, 'gap', `${c * (phone ? 6 : 12)}px`);
      put(g, 'padding', `${c * (phone ? 124 : 112)}px ${c * (phone ? 10 : 24)}px ${c * (phone ? 10 : 24)}px`);
      const rad = `${(c * 12).toFixed(1)}px`;
      const vw = window.innerWidth;
      const vh = screenH();
      const sc = Math.max(vw / IW, vh / IH);
      const k = 1 - c * 0.12;
      const W = IW * sc * k;
      const H = IH * sc * k;
      const ox = (vw - W) / 2;
      const oy = (vh - H) / 2;
      // 3. each piece shows its own part of the picture, then turns over. All the pieces are
      // measured first, then all are written: measuring each after writing the one before
      // made the browser lay the page out 35 times a frame, which a phone cannot keep up with.
      const boxes = pieces.map((t) => t.getBoundingClientRect());
      pieces.forEach((t, i) => {
        const b = boxes[i];
        const front = t.firstChild.firstChild;
        put(front, 'backgroundSize', `${W.toFixed(1)}px ${H.toFixed(1)}px`);
        put(front, 'backgroundPosition', `${(ox - b.left).toFixed(1)}px ${(oy - b.top).toFixed(1)}px`);
        const d = cells[i].d / maxD;
        const turn = ease(lin(p, 0.26 + d * 0.26, 0.36 + d * 0.26));
        put(t.firstChild, 'transform', `rotateY(${(turn * 180).toFixed(1)}deg)`);
        put(front, 'borderRadius', rad);
        put(t.firstChild.lastChild, 'borderRadius', rad);
        // a clip plays only once its piece has turned to show it, and is on screen
        const v = t.__clip;
        if (v) {
          const want = !STILL && turn > 0.5 && t.__seen;
          if (want && v.paused) v.play().catch(() => {});
          else if (!want && !v.paused) v.pause();
        }
      });
      // 4. the wall steps aside and the headline comes in
      const q = ease(lin(p, 0.72, 0.9));
      put(shift.current, 'transformOrigin', phone ? '50% 100%' : (document.dir === 'rtl' ? '0% 50%' : '100% 50%'));
      put(shift.current, 'transform', phone
        ? `translateY(${-q}vh) scale(${1 - q * 0.48})`
        : `scale(${1 - q * (1 - fit)})`);
      put(copy.current, 'opacity', String(q));
      put(copy.current, 'transform', `translateX(${(document.dir === 'rtl' ? 24 : -24) * (1 - q)}px)`);
      copy.current.classList.toggle('on', q > 0.5);
      // only once the pieces have parted and the nav sits on the sand, not the sky
      document.body.classList.toggle('hv2-light-nav', p > 0.24);
    };
    const queue = () => { if (!raf) raf = requestAnimationFrame(paint); };
    paint();
    window.addEventListener('scroll', queue, { passive: true });
    window.addEventListener('resize', queue);
    // only the clips in view, on a piece that has turned, play (paint decides; this says
    // which are on screen): up to 29 clips decoding at once was too much for a phone
    pieces.forEach((t) => { t.__clip = t.querySelector('video'); t.__seen = !('IntersectionObserver' in window); });
    const io = 'IntersectionObserver' in window ? new IntersectionObserver((es) => {
      es.forEach((e) => { e.target.__seen = e.isIntersecting; });
      queue();
    }) : null;
    pieces.forEach((t) => io?.observe(t));
    return () => {
      window.removeEventListener('scroll', queue);
      window.removeEventListener('resize', queue);
      if (raf) cancelAnimationFrame(raf);
      io?.disconnect();
    };
  }, [cells, phone]);

  useEffect(() => {
    const v = video.current;
    if (v && !STILL) v.play().catch(() => {});
  }, [phone]);

  const lines = [
    counts.stays != null && { key: 'stays', n: counts.stays, label: t('home.opening.stays', 'stays') },
    counts.restaurants != null && { key: 'rest', n: counts.restaurants, label: t('home.opening.restaurants', 'restaurants') },
    counts.services != null && { key: 'serv', n: counts.services, label: t('home.opening.services', 'local services') },
  ].filter(Boolean);
  const doors = [
    { to: '/stays', Icon: HomeIcon, label: t('home.hero.ctaStays', 'Search rentals'), solid: true },
    { to: '/businesses', Icon: Store, label: t('home.v2.hero.ctaBusinesses', 'Find a business') },
    { to: '/restaurants', Icon: UtensilsCrossed, label: t('home.next.restaurants', 'Restaurants') },
    { to: '/requests', Icon: Megaphone, label: t('home.finale.ctaRequest', 'Post a request') },
  ];
  const proof = [
    counts.stays != null && t('home.next.proofStays', '{{n}} stays', { n: counts.stays.toLocaleString() }),
    counts.restaurants != null && t('home.next.proofRest', '{{n}} restaurants', { n: counts.restaurants.toLocaleString() }),
    counts.services != null && t('home.opening.proofServices', '{{n}} local services', { n: counts.services.toLocaleString() }),
    t('home.next.noFees', 'no commission'),
  ].filter(Boolean);

  return (
    <section ref={sec} className={`ho-open${STILL ? ' ho-still' : ''}`} data-testid="home-opening">
      <div className="ho-stage">
        <div ref={shift} className="ho-shift">
          <div ref={grid} className="ho-grid" style={{ '--cols': COLS, '--rows': ROWS }}>
            {cells.map(({ tile }, i) => (
              // eslint-disable-next-line react/no-array-index-key
              <a key={i} className="ho-t" href={tile.href} tabIndex={-1} aria-hidden="true"
                onClick={(e) => { if (!tile.full) { e.preventDefault(); navigate(tile.href); } }}>
                <span className="ho-card">
                  <span className="ho-face ho-front" style={{ backgroundImage: `url(${phone ? '/home/scene-m.webp' : '/home/scene.webp'})` }} />
                  <span className="ho-face ho-back">
                    {tile.kind === 'clip'
                      ? <video src={tile.src} poster={tile.poster} muted loop playsInline preload="metadata" />
                      : <img src={tile.src} alt="" loading="lazy" onError={() => drop(tile.src)} />}
                    {tile.label ? <span className="ho-lab">{tile.label}</span> : null}
                  </span>
                </span>
              </a>
            ))}
          </div>
        </div>
        <div ref={film} className="ho-film" aria-hidden="true">
          <video ref={video} key={phone ? 'm' : 'd'} src={phone ? '/home/scene-m.mp4' : '/home/scene.mp4'}
            poster={phone ? '/home/scene-m.webp' : '/home/scene.webp'} muted loop playsInline autoPlay={!STILL} />
        </div>
        <div ref={scene} className="ho-scene on">
          <div className="ho-kick">{t('home.opening.kick', 'MyIsraelRental · across Israel')}</div>
          <ul className="ho-nums">
            {lines.map((l, i) => (
              <Rise key={l.key} n={l.n} delay={250 + i * 320}>
                {(v) => <><b>{v.toLocaleString()}</b> {l.label}</>}
              </Rise>
            ))}
            <Rise n={0} delay={250 + lines.length * 320}>
              {() => <><b className="ho-zero">₪0</b> {t('home.opening.fees', 'commission')}</>}
            </Rise>
          </ul>
          <div className="ho-scene-foot">
            <button type="button" className="ho-pill" onClick={() => navigate('/stays')}>{t('home.hero.ctaStays', 'Search rentals')}</button>
            <span>{t('home.opening.scroll', 'Scroll to see them')}</span>
          </div>
        </div>
        <div ref={copy} className="ho-copy">
          <div className="ho-kick2">{t('home.next.kick', 'Rentals · Businesses · Restaurants')}</div>
          <h1>
            {t('home.next.h1', 'Stays, local businesses and restaurants')}{' '}
            <span className="ho-acc">{t('home.next.accent', 'across Israel')}</span>
          </h1>
          <p className="ho-sub">
            {t('home.v2.hero.h1', 'Grow. Build.')} {t('home.v2.hero.accent', 'Any revenue stream')}.{' '}
            {t('home.v2.hero.sub', 'Free to search, free to list, no commission.')}
          </p>
          <div className="ho-doors">
            {doors.map(({ to, Icon, label, solid }) => (
              <button key={to} type="button" className={solid ? 'ho-door ho-door-solid' : 'ho-door'} onClick={() => navigate(to)}>
                <Icon size={18} aria-hidden="true" /> <span>{label}</span>
              </button>
            ))}
          </div>
          <p className="ho-proof">{proof.join(' · ')}</p>
        </div>
      </div>
    </section>
  );
}
