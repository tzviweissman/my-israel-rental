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
import React, { useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';
import { ArrowRight, Check, Home as HomeIcon, Store, Megaphone } from 'lucide-react';

import { MotionConfig } from 'motion/react';

import PageMeta from '../components/PageMeta';
import {
  ContainerAnimated,
  ContainerStagger,
  GalleryGrid,
  GalleryGridCell,
} from '../components/ui/cta-section-with-gallery';
import useFavorites from '../hooks/useFavorites';
import ImageStreamHero from '../components/ui/image-stream-hero';
import AntiMetalButton from '../components/ui/anti-metal-button';
import CoverflowCarousel from '../components/ui/coverflow-carousel';
import useHomeShowcase from '../components/home/useHomeShowcase';
import FinaleStats from '../components/home/FinaleStats';
import StaysCard from '../components/stays/StaysCard';
import ServiceCard from '../components/marketplace/ServiceCard';
import SiteFooter from '../components/common/SiteFooter';
import { prettyArea } from '../utils/areaNames';
import { propertyTitle, isAreaOnlyTitle } from '../utils/propertyTitle';
import '../styles/home-v2.css';

/**
 * The nav is fixed chrome rendered outside this page, and it is white-on-dark
 * glass — correct over every other page's dark photo band, invisible over this
 * page's white hero. So the page marks the body while it is mounted and
 * `home-v2.css` carries a light variant scoped to that mark. Nothing about the
 * nav's own file changes, and no other page can be affected.
 */
function useLightNav() {
  useEffect(() => {
    document.body.classList.add('hv2-light-nav');
    return () => document.body.classList.remove('hv2-light-nav');
  }, []);
}

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
  const { streamImages, gallery, picks, hasDeals, rentals, businesses, loaded } = useHomeShowcase();
  // Which card the coverflow has centred. The component names it in its
  // caption but cannot open it, so the page renders the control.
  const [pick, setPick] = useState(0);
  // The card renders a heart whether or not it is given a handler, so it has
  // to be wired here — a control that does nothing is worse than no control.
  const { likedIds, toggleLike } = useFavorites();
  const root = useRef(null);
  useReveal(root);
  useLightNav();

  // The carousel takes flat slides; the page keeps the objects so its own CTA
  // can open whichever card is centred.
  const pickSlides = picks.map((it) => {
    // Most rentals are titled with nothing but their neighbourhood, so the
    // headline and the "Where" row said the same words twice. propertyTitle
    // builds the headline the listing cards use, and the row is dropped when
    // the title carries no more than the area already does.
    const title = it.kind === 'stay'
      ? propertyTitle(it.property, t)
      : ((i18n.language || '').startsWith('he') && it.title_he ? it.title_he : it.title);
    const areaIsRedundant = it.kind === 'stay' && isAreaOnlyTitle(title, it.area);
    return {
      src: it.src,
      alt: it.alt,
      title,
      subtitle: it.discount?.percent
        ? t('offers.percentOff', { defaultValue: '{{percent}}% off', percent: it.discount.percent })
        : (it.kind === 'biz' ? t('home.v2.picks.kindBiz', 'Local business') : t('home.v2.picks.kindStay', 'Rental')),
      meta: [
        it.discount?.label ? { label: t('home.v2.picks.offer', 'Offer'), value: it.discount.label } : null,
        it.discount?.ends_at ? { label: t('home.v2.picks.until', 'Until'), value: it.discount.ends_at } : null,
        it.area && !areaIsRedundant ? { label: t('home.v2.picks.where', 'Where'), value: prettyArea(it.area, t) } : null,
        it.beds ? { label: t('home.v2.picks.beds', 'Bedrooms'), value: it.beds } : null,
        it.price ? { label: t('home.v2.picks.price', 'Price'), value: it.price } : null,
      ].filter(Boolean),
    };
  });

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
              <button type="button" className="btn btn-primary" onClick={() => navigate('/stays')}>
                {t('home.hero.ctaStays', 'Search rentals')}
              </button>
              <button type="button" className="btn btn-ghost" onClick={() => navigate('/businesses')}>
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

      {/* ── Today's picks ────────────────────────────────────────────────
          A coverflow of listings and businesses that rotates by the calendar
          day. Deliberately NOT "today's deals": nothing in this product
          records a discount, so a card headed "deal" would claim something
          about price that no field on the listing supports. */}
      {picks.length >= 4 && (
        <section className="hv2-picks" id="picks">
          <div className="hv2-wrap">
            <div className="hv2-picks-head">
              <div className="hv2-eyebrow hv2-eyebrow-gold">
                {hasDeals ? t('home.v2.picks.eyebrowDeals', 'On offer now') : t('home.v2.picks.eyebrow', 'Fresh today')}
              </div>
              <h2>{hasDeals ? t('home.v2.picks.h2Deals', "Today's deals") : t('home.v2.picks.h2', "Today's picks")}</h2>
              <p>
                {hasDeals
                  ? t('home.v2.picks.pDeals', 'Offers running right now, put up by the businesses themselves. Drag to browse.')
                  : t('home.v2.picks.p', 'A new selection every day, from everything listed on the site. Drag to browse.')}
              </p>
            </div>
            <CoverflowCarousel
              slides={pickSlides}
              showCaption
              showNavigation
              showPagination={false}
              onSelect={setPick}
              label={t('home.v2.picks.h2', "Today's picks")}
              className="hv2-coverflow"
              cardWidth="clamp(160px, 24vw, 280px)"
            />
            <div className="hv2-picks-cta">
              <button
                type="button"
                className="btn btn-white"
                onClick={() => navigate(picks[pick]?.href || '/stays')}
                data-testid="home-preview-pick-open"
                data-href={picks[pick]?.href || ''}
              >
                {picks[pick]?.discount?.percent
                  ? t('home.v2.picks.openOffer', 'See this offer')
                  : (picks[pick]?.kind === 'biz'
                    ? t('home.v2.picks.openBiz', 'See this business')
                    : t('home.v2.picks.openStay', 'See this rental'))}
              </button>
            </div>
          </div>
        </section>
      )}

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

      {/* ── Supply CTA, with a gallery of real businesses and homes ────
          Replaces the section library's flat colour band. The four photos
          are live listings and businesses taken from deeper in each list
          than the rails above show, so nothing appears twice on one scroll.

          `reducedMotion="user"` rather than a hand-rolled media query: it
          drops transform and layout animation for anyone who asked for less
          movement while letting the fade run, so the content still arrives
          instead of never appearing. */}
      <MotionConfig reducedMotion="user">
        <section className="hv2-pad hv2-cta" id="supply">
          <div className="hv2-wrap hv2-cta-grid">
            <ContainerStagger>
              <ContainerAnimated className="hv2-eyebrow">
                {t('home.v2.supply.eyebrow', 'For businesses & property owners')}
              </ContainerAnimated>
              <ContainerAnimated>
                <h2 className="hv2-cta-h2">
                  {t('home.v2.supply.h2', 'Scale your business through innovation')}
                </h2>
              </ContainerAnimated>
              <ContainerAnimated className="hv2-cta-p">
                {t('home.v2.supply.p', 'Free to list, free to be found, no commission. Have a place to rent? List it the same way.')}
              </ContainerAnimated>
              <ContainerAnimated>
                <ul className="hv2-cta-facts">
                  {['free', 'leads', 'tools'].map((k) => (
                    <li key={k}>
                      <Check size={16} aria-hidden="true" />
                      <span>
                        <b>{t(`home.v2.supply.${k}.h`)}</b> {t(`home.v2.supply.${k}.p`)}
                      </span>
                    </li>
                  ))}
                </ul>
              </ContainerAnimated>
              <ContainerAnimated className="hv2-cta-row">
                {/* One door, not two (Tzvi, 3 Sep). It used to offer "Add your
                    business" beside "List a place", which asks a visitor to
                    classify themselves before they have signed up — and the
                    two land on flows that both start with the same account.
                    `/join` already asks which they are, so the choice happens
                    once, in the place built for it.

                    `w-44` because the label is absolutely positioned inside
                    the button, so the width has to hold it in both languages. */}
                <AntiMetalButton
                  className="w-44"
                  label={t('nav.joinFree', 'Join free')}
                  onClick={() => navigate('/join')}
                  data-testid="home-preview-cta-primary"
                />
              </ContainerAnimated>
            </ContainerStagger>

            <GalleryGrid className="hv2-gallery" data-testid="home-preview-gallery">
              {gallery.map((item, index) => (
                <GalleryGridCell index={index} key={item.key}>
                  {/* A card, not a photo: the four cells name what they are
                      showing and open it. An unlabelled photo of someone's
                      business on a page asking you to add yours is decoration;
                      with a name on it, it is the evidence for the claim. */}
                  <button
                    type="button"
                    className="hv2-gcard"
                    onClick={() => navigate(item.href)}
                    data-testid={`home-preview-gallery-card-${index}`}
                    data-href={item.href}
                  >
                    <img
                      className="size-full object-cover object-center"
                      src={item.src}
                      alt=""
                      loading="lazy"
                      decoding="async"
                    />
                    <span className="hv2-gcard-cap">
                      <b>{(i18n.language || '').startsWith('he') && item.title_he ? item.title_he : item.title}</b>
                      {item.sub ? <small>{prettyArea(item.sub, t)}</small> : null}
                    </span>
                  </button>
                </GalleryGridCell>
              ))}
            </GalleryGrid>
          </div>
        </section>
      </MotionConfig>

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
