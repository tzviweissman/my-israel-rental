/**
 * HomeNext — the next home page, judged on /home-preview before it goes near
 * "/" (Tzvi, 15 Oct 2026: "yes build it on the preview"). The live home page
 * is still pages/HomePreview.jsx.
 *
 * Built to the page rules (docs/page-generation-rules.md §0b, §3g):
 *
 *   1. Opening: components/home/HomeOpening.jsx. A golden-hour film of the
 *      Old City with the counts rising over it; the picture breaks into tiles
 *      that turn over to real pages, stays and businesses; the wall steps
 *      aside for the headline and doors. Chosen by Tzvi from five versions
 *      (scrollcraft/builds/home-openings, 15 Oct 2026).
 *   2. Pages we built: every showcase page with its own clip (Higgsfield's
 *      Marketing Studio wall on Mobbin: the work itself is the pitch).
 *   3. Recently added and local businesses, photo-first.
 *   4. Today's deals only when a business is running one; an empty shelf is
 *      not shown (it told every visitor the site was quiet).
 *   The ground is golden hour, pale sky into Jerusalem-stone sand (Tzvi: "light
 *      and happy but before it was too white"), on /home-preview only.
 *   5. What we are building, cut from a five-screen paragraph to one line
 *      and three counts from the database. A count under its floor hides.
 *   6. Closing: the name huge and cut by the edge, with the supply button.
 *
 * Rentals lead where a choice is made (the first door is stays). The home
 * page is exempt from the positioning rule; the services line Tzvi ruled for
 * the headline ("Grow. Build. Any revenue stream") stays, as the line under it.
 */
import React, { useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Link, useNavigate } from 'react-router-dom';
import axios from 'axios';
import { ArrowRight } from 'lucide-react';

import PageMeta from '../components/PageMeta';
import useHomeShowcase from '../components/home/useHomeShowcase';
import HomeOpening from '../components/home/HomeOpening';
import ShowcaseCard, { useShowcase, SHOWCASE_CARD_CSS } from '../components/showcase/ShowcaseCard';
import StaysCard from '../components/stays/StaysCard';
import ServiceCard from '../components/marketplace/ServiceCard';
import SiteFooter from '../components/common/SiteFooter';
import useFavorites from '../hooks/useFavorites';
import { API } from '../lib/apiBase';
import '../styles/home-v2.css'; // only for the light nav variant (body.hv2-light-nav)
import '../styles/home-next.css';

const STILL = typeof window !== 'undefined' && !!window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;

// Floors, as on the finale strip (components/home/FinaleStats.jsx): a proof
// line reading "3 stays" argues against the site.
// Kept off the home page's rails by Tzvi's request: the Sukkot flyer
// (15 Oct 2026, "remove the sukkot"). The listing itself is untouched.
const OFF_HOME = new Set(['c1378e46-414e-497c-a6b8-107e1b66abfd']);

const FLOOR = { stays: 25, businesses: 10, restaurants: 100, services: 10 };

function useCounts() {
  const [c, setC] = useState({});
  useEffect(() => {
    let alive = true;
    const set = (k, v) => alive && Number.isFinite(v) && setC((o) => ({ ...o, [k]: v }));
    axios.get(`${API}/properties/stats/trust`).then((r) => set('stays', r.data?.listings)).catch(() => {});
    axios.get(`${API}/restaurants`, { params: { limit: 1 } }).then((r) => set('restaurants', r.data?.total)).catch(() => {});
    // No count endpoint for businesses: the public list, one business per
    // owner record, counted. Capped by the list's own limit, so it can only
    // ever undercount.
    axios.get(`${API}/marketplace/gigs`, { params: { limit: 200 } })
      .then((r) => {
        if (!Array.isArray(r.data)) return;
        set('businesses', new Set(r.data.map((g) => g.business_id || g.provider_id)).size);
        // every listing is a service someone can book (Tzvi: "change to 53")
        set('services', r.data.length);
      })
      .catch(() => {});
    return () => { alive = false; };
  }, []);
  const shown = (k) => (c[k] >= FLOOR[k] ? c[k] : null);
  return { stays: shown('stays'), businesses: shown('businesses'), restaurants: shown('restaurants'), services: shown('services') };
}

/** Counts up once when seen. */
function Count({ n }) {
  const ref = useRef(null);
  const [v, setV] = useState(STILL ? n : 0);
  useEffect(() => {
    const el = ref.current;
    if (STILL || !el || !('IntersectionObserver' in window)) { setV(n); return undefined; }
    let raf = 0;
    const io = new IntersectionObserver(([e]) => {
      if (!e.isIntersecting) return;
      io.disconnect();
      const t0 = performance.now();
      const tick = (now) => {
        const x = Math.min(1, (now - t0) / 1100);
        setV(Math.round(n * (1 - (1 - x) ** 3)));
        if (x < 1) raf = requestAnimationFrame(tick);
      };
      raf = requestAnimationFrame(tick);
    }, { threshold: 0.6 });
    io.observe(el);
    return () => { io.disconnect(); cancelAnimationFrame(raf); };
  }, [n]);
  return <b ref={ref}>{v.toLocaleString()}</b>;
}

/**
 * The closing name, sunk into the bottom edge. Where the pointer touches it
 * the letters rise out, the nearest most, like a wave following the pointer,
 * and sink back when it leaves (Tzvi, 15 Oct 2026). Touch works the same
 * while a finger moves across it. Reduced motion keeps it still.
 */
function SinkingName({ text }) {
  const ref = useRef(null);
  useEffect(() => {
    const el = ref.current;
    if (!el || STILL) return undefined;
    const letters = [...el.children];
    let raf = 0;
    let x = null;
    const paint = () => {
      raf = 0;
      letters.forEach((l) => {
        const r = l.getBoundingClientRect();
        const d = x == null ? Infinity : Math.abs(r.left + r.width / 2 - x) / r.height;
        // a bell around the pointer, about two letters wide; the full rise
        // brings the hidden fifth of the letter above the edge
        const up = Math.exp(-d * d * 1.6);
        l.style.transform = up > 0.01 ? `translateY(${(-0.3 * up).toFixed(3)}em)` : '';
      });
    };
    const move = (e) => { x = (e.touches ? e.touches[0] : e).clientX; if (!raf) raf = requestAnimationFrame(paint); };
    const leave = () => { x = null; if (!raf) raf = requestAnimationFrame(paint); };
    el.addEventListener('pointermove', move);
    el.addEventListener('pointerleave', leave);
    el.addEventListener('touchmove', move, { passive: true });
    el.addEventListener('touchend', leave);
    return () => {
      el.removeEventListener('pointermove', move);
      el.removeEventListener('pointerleave', leave);
      el.removeEventListener('touchmove', move);
      el.removeEventListener('touchend', leave);
      if (raf) cancelAnimationFrame(raf);
    };
  }, []);
  return (
    <div ref={ref} className="hn-name" aria-hidden="true">
      {[...text].map((c, i) => <span key={i}>{c}</span>)}
    </div>
  );
}

export default function HomeNext() {
  const { t, i18n } = useTranslation();
  const he = (i18n.language || '').startsWith('he');
  const navigate = useNavigate();
  const { recent, rentals, businesses, dealCards } = useHomeShowcase();
  const pages = useShowcase();
  const counts = useCounts();
  const { likedIds, toggleLike } = useFavorites();

  useEffect(() => {
    // the opening switches the light nav on once the light ground shows
    document.body.classList.add('theme-preview');
    return () => document.body.classList.remove('theme-preview');
  }, []);

  const deals = dealCards.slice(0, 4);
  return (
    <div className="hn" data-testid="home-next">
      <PageMeta
        title="MyIsraelRental - Stays, local businesses and restaurants in Israel"
        description="Browse rentals, local businesses and restaurants across Israel. Free to search, free to list, no commission."
        path="/"
        noindex
      />
      {SHOWCASE_CARD_CSS && <style>{SHOWCASE_CARD_CSS}</style>}

      {/* 1. Opening */}
      <HomeOpening counts={counts} />

      {/* 2. Pages we built */}
      {pages && pages.length > 0 && (
        <section className="hn-sec hn-built" id="pages">
          <div className="hn-wrap">
            <div className="hn-head">
              <div>
                <div className="hn-eyebrow">{t('home.next.built.eyebrow', 'Pages we built')}</div>
                <h2>{t('home.next.built.h2', 'Pages we built for local businesses')}</h2>
                <p>{t('home.next.built.p', 'Each with its own photos, prices and a button to order.')}</p>
              </div>
              <Link className="hn-more" to="/showcase">
                {t('home.next.built.all', 'See all pages')} <ArrowRight size={16} className="rtl:rotate-180" aria-hidden="true" />
              </Link>
            </div>
            <div className="hn-built-grid">
              {pages.map((p) => <ShowcaseCard key={p.slug} item={p} />)}
            </div>
            <div className="hn-built-cta">
              <button type="button" className="hn-btn" onClick={() => navigate('/businesses/add')}>
                {t('home.v2.hero.ctaAdd', 'Add your business, free')} <ArrowRight size={16} className="rtl:rotate-180" aria-hidden="true" />
              </button>
            </div>
          </div>
        </section>
      )}

      {/* 3. Today's deals, only when there are some */}
      {deals.length > 0 && (
        <section className="hn-sec">
          <div className="hn-wrap">
            <div className="hn-head"><div>
              <div className="hn-eyebrow">{t('home.v2.picks.eyebrowDeals', 'On offer now')}</div>
              <h2>{t('home.v2.picks.h2Deals', "Today's deals")}</h2>
            </div></div>
            <div className="hn-grid hn-grid-4">
              {deals.map((d) => (
                <button key={d.key} type="button" className="hn-deal" onClick={() => navigate(d.href)}>
                  <img src={d.src} alt="" loading="lazy" />
                  <b>{(he && d.title_he) || d.title}</b>
                  {d.discount?.percent ? <span>{t('offers.percentOff', { defaultValue: '{{percent}}% off', percent: d.discount.percent })}</span> : null}
                </button>
              ))}
            </div>
          </div>
        </section>
      )}

      {/* 4. Recently added */}
      {recent.length > 0 && (
        <section className="hn-sec" id="rentals">
          <div className="hn-wrap">
            <div className="hn-head">
              <div>
                <div className="hn-eyebrow">{t('home.v2.rentals.eyebrow', 'Just listed')}</div>
                <h2>{t('home.v2.rentals.h2', 'Recently added')}</h2>
              </div>
              <Link className="hn-more" to="/stays">
                {t('home.v2.rentals.more', 'See all stays')} <ArrowRight size={16} className="rtl:rotate-180" aria-hidden="true" />
              </Link>
            </div>
            <div className="hn-grid hn-grid-3">
              {recent.filter((p) => !OFF_HOME.has(p.id)).slice(0, 6).map((p) => (
                <StaysCard key={p.id} property={p} fullWidth liked={likedIds.has(p.id)}
                  onToggleLike={(e) => toggleLike(p.id, e)} onClick={() => navigate(`/property/${p.id}`)} />
              ))}
            </div>
          </div>
        </section>
      )}

      {/* 5. Local businesses */}
      {businesses.length > 0 && (
        <section className="hn-sec" id="businesses">
          <div className="hn-wrap">
            <div className="hn-head">
              <div>
                <div className="hn-eyebrow">{t('home.v2.biz.eyebrow', 'Local businesses')}</div>
                <h2>{t('home.v2.biz.h2', 'The people who help you settle in')}</h2>
              </div>
              <Link className="hn-more" to="/businesses">
                {t('home.v2.biz.more', 'See all businesses')} <ArrowRight size={16} className="rtl:rotate-180" aria-hidden="true" />
              </Link>
            </div>
            <div className="hn-grid hn-grid-4">
              {businesses.slice(0, 8).map((g) => (
                <ServiceCard key={g.id} gig={g} i18n={i18n} t={t} onClick={() => navigate(`/businesses/${g.id}`)} />
              ))}
            </div>
          </div>
        </section>
      )}

      {/* 6. What we are building: one line, true counts */}
      <section className="hn-sec hn-about">
        <div className="hn-wrap">
          <h2 className="hn-line">{t('home.next.about.line', 'One place for what you need to live in Israel')}</h2>
          <div className="hn-counts">
            {counts.stays && <div><Count n={counts.stays} /><span>{t('home.next.about.stays', 'stays')}</span></div>}
            {counts.services && <div><Count n={counts.services} /><span>{t('home.opening.services', 'local services')}</span></div>}
            {counts.restaurants && <div><Count n={counts.restaurants} /><span>{t('home.next.about.rest', 'restaurants')}</span></div>}
            <div><b className="hn-zero">₪0</b><span>{t('home.next.about.fees', 'commission')}</span></div>
          </div>
        </div>
      </section>

      {/* 7. Closing */}
      <section className="hn-close">
        <div className="hn-wrap hn-close-row">
          <p>{t('home.finale.price', 'Free to list. Free to book. No commission.')}</p>
          <button type="button" className="hn-btn" onClick={() => navigate('/businesses/add')}>
            {t('home.v2.hero.ctaAdd', 'Add your business, free')} <ArrowRight size={16} className="rtl:rotate-180" aria-hidden="true" />
          </button>
        </div>
        <SinkingName text="MyIsraelRental" />
      </section>

      <SiteFooter />
    </div>
  );
}
