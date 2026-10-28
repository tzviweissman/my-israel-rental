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

/** Counts up from zero once, after a delay, so the lines arrive in turn. While it rises only
 * the number's own text is rewritten: re-rendering the line every frame kept a phone busy for
 * the first seconds of the page (27 Oct 2026, a phone-speed test). */
function Rise({ n, delay, children }) {
  const [v, setV] = useState(STILL ? n : 0);
  const [on, setOn] = useState(STILL);
  const li = useRef(null);
  useEffect(() => {
    if (STILL || n == null) { setOn(true); setV(n); return undefined; }
    let raf = 0;
    const t = setTimeout(() => {
      setOn(true);
      const t0 = performance.now();
      const text = n > 0 ? li.current?.querySelector('b')?.firstChild : null;
      const tick = (now) => {
        const x = Math.min(1, (now - t0) / 1600);
        const nv = Math.round(n * (1 - (1 - x) ** 4));
        if (text) { const s = nv.toLocaleString(); if (text.nodeValue !== s) text.nodeValue = s; }
        if (x < 1) raf = requestAnimationFrame(tick);
        else setV(n);
      };
      raf = requestAnimationFrame(tick);
    }, delay);
    return () => { clearTimeout(t); cancelAnimationFrame(raf); };
  }, [n, delay]);
  return <li ref={li} className={on ? 'in' : ''}>{children(v)}</li>;
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
    const rtl = document.dir === 'rtl';
    // The crack and the turns are animations tied to the scroll (a ViewTimeline on the opening),
    // which the browser plays by itself as the page scrolls, off the page's main work; where
    // that is missing they are paused and moved to the scroll's place each frame. Writing each
    // piece's transform as a style instead made the browser work out all 140 elements' styles
    // from scratch every frame (27 Oct 2026, a phone-speed test). The grid is laid out once where the pieces end
    // (the gap and padding in the CSS); while it cracks, each piece is drawn from there back
    // towards its place in the whole picture, with transforms only, so nothing is laid out or
    // repainted. Where each piece sits is worked out from the grid's size, never measured between
    // writes; the stage is pinned at the top of the screen, so the grid starts at 0,0.
    const G = phone ? 6 : 12;
    const PT = phone ? 124 : 112;
    const PS = phone ? 10 : 24;
    const STEPS = [0, 0.25, 0.5, 0.75, 1];
    const seek = (a, x) => { if (a.__tied) return; if (a.__x !== x) { a.__x = x; a.currentTime = x * 1000; } };
    const tl = !STILL && typeof window.ViewTimeline === 'function' && window.CSS?.percent
      ? new window.ViewTimeline({ subject: el, axis: 'block' }) : null;
    // an animation over [a, b] of the opening's scroll (the same 0..1 as p below), eased like ease()
    const still = (el2, frames, a, b) => {
      if (tl) {
        const an = el2.animate(frames, {
          timeline: tl, fill: 'both', easing: 'cubic-bezier(.33, 1, .68, 1)',
          rangeStart: { rangeName: 'contain', offset: window.CSS.percent(a * 100) },
          rangeEnd: { rangeName: 'contain', offset: window.CSS.percent(b * 100) },
        });
        an.__tied = true;
        return an;
      }
      const an = el2.animate(frames, { duration: 1000, fill: 'both' });
      an.pause();
      an.__x = -1;
      return an;
    };
    let anims = [];
    const build = () => {
      anims.forEach((a) => a.cancel());
      anims = [];
      const gw = grid.current.clientWidth;
      const gh = grid.current.clientHeight;
      const box = (cc, i) => {
        const gap = cc * G;
        const padT = cc * PT;
        const padS = cc * PS;
        const cw2 = (gw - 2 * padS - (COLS - 1) * gap) / COLS;
        const ch = (gh - padT - padS - (ROWS - 1) * gap) / ROWS;
        const col = i % COLS;
        return [rtl ? gw - padS - (col + 1) * cw2 - col * gap : padS + col * (cw2 + gap), padT + Math.floor(i / COLS) * (ch + gap), cw2, ch];
      };
      const vw = window.innerWidth;
      const vh = screenH();
      const sc = Math.max(vw / IW, vh / IH);
      const W0 = IW * sc;
      const H0 = IH * sc;
      pieces.forEach((t, i) => {
        const [fl, ft, fw, fh] = box(1, i);
        const moves = [];
        // The picture inside the piece: the whole picture at its full-screen size (W0 x H0),
        // placed by translate (tx, ty) and scale (kx, ky). The piece carries only the part of the
        // picture it ever shows (u0..u1, plus a little): 35 full-screen pictures, each its own
        // layer, cost more than the rest of the opening put together.
        const pl = STEPS.map((cc) => {
          const [l, tp, w2, h2] = box(cc, i);
          const sx = w2 / fw;
          const sy = h2 / fh;
          const k = 1 - cc * 0.12;
          moves.push({ offset: cc, transform: `translate(${(l - fl).toFixed(2)}px, ${(tp - ft).toFixed(2)}px) scale(${sx.toFixed(4)}, ${sy.toFixed(4)})` });
          return { cc, tx: ((vw - W0 * k) / 2 - l) / sx, ty: ((vh - H0 * k) / 2 - tp) / sy, kx: k / sx, ky: k / sy };
        });
        const m = 6;
        const ux0 = Math.max(0, Math.min(...pl.map((q) => -q.tx / q.kx)) - m);
        const uy0 = Math.max(0, Math.min(...pl.map((q) => -q.ty / q.ky)) - m);
        const ux1 = Math.min(W0, Math.max(...pl.map((q) => (fw - q.tx) / q.kx)) + m);
        const uy1 = Math.min(H0, Math.max(...pl.map((q) => (fh - q.ty) / q.ky)) + m);
        const pics = pl.map((q) => ({ offset: q.cc, transform: `translate(${(q.tx + q.kx * ux0).toFixed(2)}px, ${(q.ty + q.ky * uy0).toFixed(2)}px) scale(${q.kx.toFixed(4)}, ${q.ky.toFixed(4)})` }));
        put(t.__pic, 'width', `${(ux1 - ux0).toFixed(1)}px`);
        put(t.__pic, 'height', `${(uy1 - uy0).toFixed(1)}px`);
        put(t.__pic, 'backgroundSize', `${W0.toFixed(1)}px ${H0.toFixed(1)}px`);
        put(t.__pic, 'backgroundPosition', `${(-ux0).toFixed(1)}px ${(-uy0).toFixed(1)}px`);
        const d = cells[i].d / maxD;
        t.__move = still(t, moves, 0.12, 0.24);
        t.__picA = still(t.__pic, pics, 0.12, 0.24);
        t.__turn = still(t.firstChild, [{ transform: 'rotateY(0deg)' }, { transform: 'rotateY(180deg)' }], 0.26 + d * 0.26, 0.36 + d * 0.26);
        anims.push(t.__move, t.__picA, t.__turn);
      });
    };
    let fresh = true;
    let built = false;
    let raf = 0;
    const paint = () => {
      raf = 0;
      const r = el.getBoundingClientRect();
      const p = STILL ? 1 : lin(-r.top, 0, r.height - screenH());
      // The pieces' 105 animations exist only from just before the crack: while the film plays
      // they made every frame of the page heavier (the counts rising) for nothing on screen.
      if (p > 0.07 && (fresh || !built)) { build(); built = true; fresh = false; }
      else if (p < 0.05 && built) { anims.forEach((a) => a.cancel()); anims = []; built = false; }
      // 1. the words lift away
      const w = lin(p, 0.03, 0.11);
      put(scene.current, 'opacity', String(1 - w));
      put(scene.current, 'transform', `translateY(${-30 * w}px)`);
      scene.current.classList.toggle('on', w < 0.5);
      // 2. the picture cracks and the pieces part
      const c = ease(lin(p, 0.12, 0.24));
      put(film.current, 'opacity', p < 0.12 ? '1' : '0');
      // the wall is not drawn while the film covers it
      put(shift.current, 'visibility', p < 0.11 ? 'hidden' : 'visible');
      // the pieces are all on screen while the opening is (the stage is pinned)
      const seen = r.bottom > 0 && r.top < window.innerHeight;
      // the corners round in a few steps, not every frame: each change repaints the faces
      const rad = `${Math.round(c * 4) * 3}px`;
      // 3. each piece shows its own part of the picture, then turns over
      pieces.forEach((t, i) => {
        const d = cells[i].d / maxD;
        const turn = ease(lin(p, 0.26 + d * 0.26, 0.36 + d * 0.26));
        if (built) {
          seek(t.__move, c);
          seek(t.__picA, c);
          seek(t.__turn, turn);
        }
        put(t.firstChild.firstChild, 'borderRadius', rad);
        // the back (its clip, label and shadow) is left out until the turns begin: while the
        // picture cracked, every frame repainted all 35 backs
        put(t.firstChild.lastChild, 'visibility', p < 0.25 ? 'hidden' : 'visible');
        put(t.firstChild.lastChild, 'borderRadius', rad);
        // a clip plays only once its piece has turned to show it, and is on screen; on a phone
        // only the three nearest the middle play (13 at once was too much), the rest hold a still
        const v = t.__clip;
        if (v) {
          const want = !STILL && turn > 0.5 && seen && t.__play;
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
    const resized = () => { fresh = true; queue(); };
    pieces.forEach((t) => { t.__clip = t.querySelector('video'); t.__pic = t.querySelector('.ho-pic'); });
    pieces.map((t, i) => i).filter((i) => pieces[i].__clip).sort((a, b) => cells[a].d - cells[b].d)
      .forEach((i, n) => { pieces[i].__play = !phone || n < 3; });
    paint();
    window.addEventListener('scroll', queue, { passive: true });
    window.addEventListener('resize', resized);
    return () => {
      window.removeEventListener('scroll', queue);
      window.removeEventListener('resize', resized);
      if (raf) cancelAnimationFrame(raf);
      anims.forEach((x) => x.cancel());
    };
  }, [cells, phone, COLS, ROWS]);

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
                  <span className="ho-face ho-front">
                    <span className="ho-pic" style={{ backgroundImage: `url(${phone ? '/home/scene-m.webp' : '/home/scene.webp'})` }} />
                  </span>
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
