/**
 * HomePreview — the proposed home page overhaul, on its own route so it can
 * be judged against the live cinematic page before it replaces it.
 *
 * Route: /home-preview. Nothing links here; it is a preview surface.
 *
 * What is different from the cinematic page:
 *
 *   • The hero is built from what is actually on the site. The corridor
 *     (components/ui/image-stream-hero) is fed the real listings and
 *     businesses from the public lists, rentals first, and the same rows
 *     feed the two rails beneath it. A visitor sees the site's own supply
 *     in the first second instead of generated stills.
 *   • The sections are the section library's (home-redesign-preview.html):
 *     search doors, featured rentals, businesses, how it works, the supply
 *     band, and the finale the current page already ends with.
 *
 * Positioning per CLAUDE.md: rentals lead; the supply CTA is "Add your
 * business — free"; nothing here addresses "owners" as the default
 * audience.
 */
import React, { useEffect, useRef } from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';
import { ArrowRight, Home as HomeIcon, Store, Megaphone } from 'lucide-react';

import PageMeta from '../components/PageMeta';
import useFavorites from '../hooks/useFavorites';
import ImageStreamHero from '../components/ui/image-stream-hero';
import useHomeShowcase from '../components/home/useHomeShowcase';
import FinaleStats from '../components/home/FinaleStats';
import StaysCard from '../components/stays/StaysCard';
import ServiceCard from '../components/marketplace/ServiceCard';
import SiteFooter from '../components/common/SiteFooter';
import '../styles/home-v2.css';

/** Fail-safe reveal: content is visible unless JS proves it is running. */
function useReveal(root) {
  useEffect(() => {
    const el = root.current;
    if (!el || typeof IntersectionObserver === 'undefined') return undefined;
    document.documentElement.classList.add('js-reveal');
    const io = new IntersectionObserver(
      (entries) => entries.forEach((e) => {
        if (e.isIntersecting) { e.target.classList.add('in'); io.unobserve(e.target); }
      }),
      { threshold: 0.12 },
    );
    el.querySelectorAll('.reveal').forEach((n) => io.observe(n));
    return () => io.disconnect();
  }, [root]);
}

export default function HomePreview() {
  const { t, i18n } = useTranslation();
  const navigate = useNavigate();
  const { streamImages, rentals, businesses, loaded } = useHomeShowcase();
  // The card renders a heart whether or not it is given a handler, so it has
  // to be wired here — a control that does nothing is worse than no control.
  const { likedIds, toggleLike } = useFavorites();
  const root = useRef(null);
  useReveal(root);

  const doors = [
    { key: 'stays', to: '/stays', Icon: HomeIcon },
    { key: 'businesses', to: '/businesses', Icon: Store },
    { key: 'requests', to: '/requests', Icon: Megaphone },
  ];

  return (
    <div ref={root} className="hv2" data-testid="home-preview">
      <PageMeta
        title="MyIsraelRental — Rentals and local businesses across Israel"
        description="Find a place to rent and the people to help you settle in. Free to search, free to list, no commission."
        path="/home-preview"
        noindex
      />

      {/* ── Hero: the corridor of real listings and businesses ─────────── */}
      <ImageStreamHero
        images={streamImages}
        // Twelve, not the component's default nine: both rails walk the same
        // sequence from index 0, so `cards` is also how many DISTINCT photos
        // ever appear. Nine cards showed nine listings and ignored the rest.
        // Raising it only makes the corridor denser (the tearing failure mode
        // is lowering it), so this is the safe direction.
        cards={12}
        speed={22}
        axis={56}
        className="hv2-hero"
        data-testid="home-preview-hero"
      >
        <div className="hv2-hero-scrim" aria-hidden="true" />
        <div className="hv2-hero-inner">
          <div>
            <div className="kick">{t('home.v2.hero.kick', 'Rentals · Businesses · Requests')}</div>
            <h1>
              {t('home.hero.h1', 'Find your place')}{' '}
              <span className="a">{t('home.hero.accent', 'in Israel.')}</span>
            </h1>
          </div>
          <div className="hv2-hero-foot">
            <p>{t('home.v2.hero.sub', 'Every card behind this text is a real listing or business on the site right now.')}</p>
            <div className="hv2-hero-ctas">
              <button type="button" className="btn btn-white" onClick={() => navigate('/stays')}>
                {t('home.hero.ctaStays', 'Search rentals')}
              </button>
              <button type="button" className="btn btn-outline-white" onClick={() => navigate('/businesses')}>
                {t('home.v2.hero.ctaBusinesses', 'Find a business')}
              </button>
            </div>
            <button type="button" className="hv2-hero-link" onClick={() => navigate('/businesses/add')}>
              {t('home.v2.hero.ctaAdd', 'Add your business — free')} <ArrowRight size={14} className="rtl:rotate-180" />
            </button>
          </div>
        </div>
      </ImageStreamHero>

      {/* ── Doors ──────────────────────────────────────────────────────── */}
      <section className="hv2-pad hv2-doors-wrap">
        <div className="hv2-wrap">
          <h2 className="hv2-doors-head reveal">{t('home.v2.doors.h2', 'Start your search')}</h2>
          <div className="hv2-doors reveal">
            {doors.map(({ key, to, Icon }) => (
              <button key={key} type="button" className="hv2-door" onClick={() => navigate(to)} data-testid={`home-preview-door-${key}`}>
                <span className="hv2-door-ic"><Icon size={22} /></span>
                <span className="hv2-door-body">
                  <b>{t(`home.v2.doors.${key}.title`)}</b>
                  <small>{t(`home.v2.doors.${key}.sub`)}</small>
                </span>
                <ArrowRight size={18} className="hv2-door-arw rtl:rotate-180" />
              </button>
            ))}
          </div>
        </div>
      </section>

      {/* ── Featured rentals ───────────────────────────────────────────── */}
      <section className="hv2-pad" id="rentals">
        <div className="hv2-wrap">
          <div className="hv2-sec-head reveal">
            <div>
              <div className="hv2-eyebrow">{t('home.v2.rentals.eyebrow', 'Handpicked')}</div>
              <h2>{t('home.v2.rentals.h2', 'Featured rentals')}</h2>
              <p>{t('home.v2.rentals.p', 'Live listings, posted by the people who hold the keys.')}</p>
            </div>
            <button type="button" className="hv2-more" onClick={() => navigate('/stays')}>
              {t('home.v2.rentals.more', 'See all stays')} <ArrowRight size={16} className="rtl:rotate-180" />
            </button>
          </div>
          <div className="hv2-grid-3 reveal" data-testid="home-preview-rentals">
            {rentals.map((p) => (
              <StaysCard
                key={p.id}
                property={p}
                fullWidth
                liked={likedIds.has(p.id)}
                onToggleLike={(e) => toggleLike(p.id, e)}
                onClick={() => navigate(`/property/${p.id}`)}
              />
            ))}
            {loaded && rentals.length === 0 && (
              <p className="hv2-empty">{t('home.v2.rentals.empty', 'New listings are on their way.')}</p>
            )}
          </div>
        </div>
      </section>

      {/* ── Businesses ─────────────────────────────────────────────────── */}
      <section className="hv2-pad hv2-biz-wrap" id="businesses">
        <div className="hv2-wrap">
          <div className="hv2-sec-head reveal">
            <div>
              <div className="hv2-eyebrow">{t('home.v2.biz.eyebrow', 'Local businesses')}</div>
              <h2>{t('home.v2.biz.h2', 'The people who help you settle in')}</h2>
              <p>{t('home.v2.biz.p', 'Cleaners, movers, caterers, tutors and more — message them directly, no booking fees.')}</p>
            </div>
            <button type="button" className="hv2-more" onClick={() => navigate('/businesses')}>
              {t('home.v2.biz.more', 'See all businesses')} <ArrowRight size={16} className="rtl:rotate-180" />
            </button>
          </div>
          <div className="hv2-grid-4 reveal" data-testid="home-preview-businesses">
            {businesses.map((g) => (
              <ServiceCard key={g.id} gig={g} i18n={i18n} t={t} onClick={() => navigate(`/businesses/${g.id}`)} />
            ))}
          </div>
        </div>
      </section>

      {/* ── How it works ───────────────────────────────────────────────── */}
      <section className="hv2-pad hv2-how" id="how">
        <div className="hv2-wrap">
          <div className="hv2-eyebrow reveal">{t('home.v2.how.eyebrow', 'Simple & direct')}</div>
          <h2 className="reveal">{t('home.v2.how.h2', 'How MyIsraelRental works')}</h2>
          <div className="hv2-how-cols reveal">
            {['rent', 'hire'].map((track) => (
              <div key={track} className="hv2-how-col">
                <h3>{t(`home.v2.how.${track}.title`)}</h3>
                {[1, 2, 3].map((n) => (
                  <div key={n} className="hv2-step">
                    <div className="hv2-num">{n}</div>
                    <div>
                      <h4>{t(`home.v2.how.${track}.s${n}.h`)}</h4>
                      <p>{t(`home.v2.how.${track}.s${n}.p`)}</p>
                    </div>
                  </div>
                ))}
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── Supply band ────────────────────────────────────────────────── */}
      <section className="hv2-pad" id="supply">
        <div className="hv2-wrap">
          <div className="hv2-band reveal">
            <div>
              <div className="hv2-eyebrow hv2-eyebrow-gold">{t('home.v2.supply.eyebrow', 'For businesses & property owners')}</div>
              <h2>{t('home.v2.supply.h2', 'Add your business — free')}</h2>
              <p>{t('home.v2.supply.p', 'Free to list, free to be found, no commission. Have a place to rent? List it the same way.')}</p>
              <div className="hv2-cta-row">
                <button type="button" className="btn btn-gold btn-lg" onClick={() => navigate('/businesses/add')}>
                  {t('home.v2.supply.ctaBiz', 'Add your business')}
                </button>
                <button type="button" className="btn btn-outline-white btn-lg" onClick={() => navigate('/join')}>
                  {t('home.v2.supply.ctaStay', 'List a place')}
                </button>
              </div>
            </div>
            <div className="hv2-facts">
              {['free', 'leads', 'tools'].map((k) => (
                <div key={k} className="hv2-fact">
                  <b>{t(`home.v2.supply.${k}.h`)}</b>
                  <small>{t(`home.v2.supply.${k}.p`)}</small>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* ── Finale: unchanged from the live page ───────────────────────── */}
      <section className="finale">
        <div>
          <div className="kick">MyIsraelRental</div>
          <h2>
            {t('home.finale.h2', 'Rent a home. Hire the pros.')}
            <br />
            <span className="a">{t('home.finale.accent', 'One place for both.')}</span>
          </h2>
          <p className="finale-price">{t('home.finale.price', 'Free to list. Free to book. No commission.')}</p>
          <p>{t('home.finale.p', 'Fully bilingual (English + Hebrew), verified listings and reviews, and on-platform chat.')}</p>
          <div className="ctas">
            <button type="button" className="b-blue" onClick={() => navigate('/stays')}>
              {t('home.finale.ctaStays', 'Search rentals')}
            </button>
            <button type="button" className="b-gold" onClick={() => navigate('/requests')}>
              {t('home.finale.ctaRequest', 'Post a request')}
            </button>
          </div>
          <FinaleStats t={t} />
        </div>
      </section>

      <SiteFooter />
    </div>
  );
}
