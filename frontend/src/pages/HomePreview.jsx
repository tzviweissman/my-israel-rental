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
import { formatDate } from '../utils/formatDate';
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
import LoopHero from '../components/home/LoopHero';
import AntiMetalButton from '../components/ui/anti-metal-button';
import LiquidButton from '../components/ui/liquid-button';
import FlowButton from '../components/ui/flow-button';
import { GradientText } from '../components/ui/gradient-text';
import CoverflowCarousel from '../components/ui/coverflow-carousel';
import useHomeShowcase from '../components/home/useHomeShowcase';
import CommunitySection from '../components/home/CommunitySection';
import FinaleStats from '../components/home/FinaleStats';
import StaysCard from '../components/stays/StaysCard';
import ServiceCard from '../components/marketplace/ServiceCard';
import SiteFooter from '../components/common/SiteFooter';
import { prettyArea } from '../utils/areaNames';
import { propertyTitle, isAreaOnlyTitle } from '../utils/propertyTitle';
import '../styles/home-v2.css';

// Below this a moving row has too few cards to fill the track twice over,
// so the wrap would be visible. It falls back to a static grid instead.
const MARQUEE_MIN = 6;

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
    // `theme-preview` is the scope for palette experiments. Tzvi's rule,
    // 3 September, after a trial palette reached the live home page for ten
    // minutes: a theme under test is written under `body.theme-preview` and
    // so exists on this page and nowhere else. scripts/test-theme-scope.mjs
    // fails the build if an experimental theme file has a rule outside it.
    document.body.classList.add('theme-preview');
    return () => {
      document.body.classList.remove('hv2-light-nav');
      document.body.classList.remove('theme-preview');
    };
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
  const { gallery, picks, dealCards, hasDeals, recent, rentals, businesses, loaded } = useHomeShowcase();
  // Offers win when any exist; otherwise the daily rotation. Never a mix,
  // and never padded to reach a count.
  //
  // A card whose photo fails to load is dropped, not shown. The hook filters
  // offers with NO cover, but it cannot know a cover URL has since been
  // deleted — that rendered a broken-image glyph over an empty square, the
  // very empty card this section exists to avoid. If every photo is dead,
  // the section falls through to its honest "no offers" state.
  const [deadImages, setDeadImages] = useState(() => new Set());
  const markDead = (key) => setDeadImages((s) => (s.has(key) ? s : new Set(s).add(key)));
  const shelf = (hasDeals ? dealCards : picks).filter((it) => !deadImages.has(it.key));
  // Which card the coverflow has centred. The component names it in its
  // caption but cannot open it, so the page renders the control.
  const [pick, setPick] = useState(0);
  // The card renders a heart whether or not it is given a handler, so it has
  // to be wired here — a control that does nothing is worse than no control.
  const { likedIds, toggleLike } = useFavorites();
  const root = useRef(null);

  // The moving row starts from its first card when somebody reaches it. The
  // animation begins at mount, so a visitor arriving twenty seconds later
  // landed on an arbitrary offset, usually with the newest listing — the one
  // the row is ordered to show first — already out of view. Once per page
  // view, so scrolling back does not yank the row out from under a reader.
  const marqueeRef = useRef(null);
  const hasMarquee = recent.length >= MARQUEE_MIN;
  useEffect(() => {
    const box = marqueeRef.current;
    if (!box || typeof IntersectionObserver === 'undefined') return undefined;
    const io = new IntersectionObserver(([entry]) => {
      if (!entry.isIntersecting) return;
      io.disconnect();
      const track = box.querySelector('.hv2-marquee-track');
      (track?.getAnimations?.() || []).forEach((a) => { a.currentTime = 0; });
    }, { threshold: 0.25 });
    io.observe(box);
    return () => io.disconnect();
  }, [hasMarquee]);
  useReveal(root);
  useLightNav();

  // The carousel takes flat slides; the page keeps the objects so its own CTA
  // can open whichever card is centred.
  const pickSlides = shelf.map((it) => {
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
        it.discount?.ends_at ? { label: t('home.v2.picks.until', 'Until'), value: formatDate(it.discount.ends_at, i18n.language) } : null,
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

      {/* ── Hero: the loop ────────────────────────────────────────────────
          A seamless 40s glass loop: scattered blocks lock into a cube, the
          cube blooms into a flat chip plane, the chips curl up into a ribbon,
          and the ribbon unwinds back to the scattered blocks it started from.
          Segment four ends on segment one's first frame, so it loops with no
          crossfade.

          It replaces a one-shot film that resolved on the site's mark at the
          very end. A hero gets a few seconds before somebody scrolls, so a
          payoff at 0:36 was a payoff nobody saw; with a loop there is no
          beginning to miss and whatever moment a visitor lands on is a good
          one. The long cut is still a good asset elsewhere.

          Framed with its subject in the inline-end third and the other half
          empty, so the copy has clean ground. Reduced motion gets the poster
          and no video element at all; so does a stall past two seconds. All
          of that lives in LoopHero.

          Preview page only (body.theme-preview). The live home page's hero is
          exempt by ruling and is untouched. */}
      <section className="hv2-hero hv2-hero--film" data-testid="home-preview-hero">
        <LoopHero />
        <div className="hv2-hero-scrim" aria-hidden="true" />
        <div className="hv2-hero-inner">
          <div>
            <div className="kick">{t('home.v2.hero.kick', 'Rentals · Businesses · Requests')}</div>
            {/* Its own keys, not the live hero's home.hero.h1/accent — that
                page is exempt and reads the same two strings. */}
            <h1>
              {t('home.v2.hero.h1', 'Grow. Build.')}{' '}
              <span className="a">{t('home.v2.hero.accent', 'Any revenue stream')}</span>
            </h1>
            {/* The supply-side promise, under the demand-side headline. The
                gradient is on "without limits" rather than the whole phrase:
                the effect is a light behind the words, and lighting all three
                leaves nothing steady to read it against. */}
            <p className="hv2-hero-tagline">
              {t('home.hero.growA', 'Grow')}{' '}
              <GradientText className="hv2-gradient-word">
                {t('home.hero.growB', 'without limits')}
              </GradientText>
            </p>
          </div>
          <div className="hv2-hero-foot">
            <p>{t('home.v2.hero.sub', 'Free to search, free to list, no commission.')}</p>
            <div className="hv2-hero-ctas">
              {/* The SOLID liquid button is used once on the page, here.
                  This is the single action the home page most wants — a
                  visitor searching for somewhere to live — and it is the one
                  place a control that loud is answering a real question
                  rather than competing with its neighbours. Its resting
                  state is the theme's solid black action, so it belongs even
                  before it is touched. */}
              <LiquidButton onClick={() => navigate('/stays')} data-testid="home-preview-hero-primary">
                {t('home.hero.ctaStays', 'Search rentals')}
                <ArrowRight size={16} className="rtl:rotate-180" />
              </LiquidButton>
              {/* The second action rests as an outline and floods with the
                  same liquid on hover: the pair reads as one family with one
                  leader. Tzvi asked for the fill on this button by name. */}
              <LiquidButton variant="ghost" onClick={() => navigate('/businesses')} data-testid="home-preview-hero-secondary">
                {t('home.v2.hero.ctaBusinesses', 'Find a business')}
              </LiquidButton>
            </div>
            <button type="button" className="hv2-hero-link" onClick={() => navigate('/businesses/add')}>
              {t('home.v2.hero.ctaAdd', 'Add your business — free')} <ArrowRight size={14} className="rtl:rotate-180" />
            </button>
          </div>
        </div>
      </section>

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

      {/* ── Today's deals, or today's picks ──────────────────────────────
          The heading follows the data; the data is never bent to fit the
          heading. Three states, and each one is the truth:

            offers running   "Today's deals", exactly as many cards as there
                             are offers. Four or more get the coverflow; one,
                             two or three get a plain row, because a ring of
                             three raked cards reads as three loose photos —
                             and because dropping a business's only offer to
                             protect a carousel's geometry is the wrong trade.
                             Every offer here has a cover image; the hook
                             filters the ones that do not, which is what used
                             to put a blank card under this heading.
            no offers        "Today's picks", the daily rotation of everything
                             listed. Real cards, honestly labelled.
            nothing at all   a line saying so. Not an empty grid, and not a
                             section that silently vanishes. */}
      {loaded && shelf.length === 0 && (
        <section className="hv2-picks" id="picks">
          <div className="hv2-wrap">
            <div className="hv2-picks-head">
              {/* Not "On offer now" — there is nothing on offer. */}
              <div className="hv2-eyebrow hv2-eyebrow-gold">
                {t('home.v2.picks.eyebrowNone', 'Offers')}
              </div>
              <h2>{t('home.v2.picks.h2Deals', "Today's deals")}</h2>
              <p>
                {t('home.v2.picks.empty',
                  'No offers yet. When a business puts one up, it shows here the same day.')}
              </p>
            </div>
          </div>
        </section>
      )}
      {shelf.length > 0 && shelf.length < 4 && (
        <section className="hv2-picks" id="picks">
          <div className="hv2-wrap">
            <div className="hv2-picks-head">
              <div className="hv2-eyebrow hv2-eyebrow-gold">
                {t('home.v2.picks.eyebrowDeals', 'On offer now')}
              </div>
              <h2>{t('home.v2.picks.h2Deals', "Today's deals")}</h2>
              <p>
                {t('home.v2.picks.pDealsFew', 'Put up by the businesses themselves.')}
              </p>
            </div>
            <div className="hv2-deal-row" data-testid="home-preview-deal-row">
              {shelf.map((it) => (
                <button
                  key={it.key}
                  type="button"
                  className="hv2-deal-card"
                  onClick={() => navigate(it.href)}
                  data-href={it.href}
                >
                  <img src={it.src} alt="" loading="lazy" onError={() => markDead(it.key)} />
                  <span className="hv2-deal-body">
                    <span className="hv2-deal-title">
                      {(i18n.language || '').startsWith('he') && it.title_he ? it.title_he : it.title}
                    </span>
                    {it.discount?.percent ? (
                      <span className="hv2-deal-off">
                        {t('offers.percentOff', { defaultValue: '{{percent}}% off', percent: it.discount.percent })}
                      </span>
                    ) : null}
                    {it.area ? <span className="hv2-deal-where">{prettyArea(it.area, t)}</span> : null}
                  </span>
                </button>
              ))}
            </div>
          </div>
        </section>
      )}
      {shelf.length >= 4 && (
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
              // Cards per second: one every ten. A continuous drift rather
              // than a step, and it stops the moment a pointer lands on it —
              // as it does mid-drag, off screen, and for anyone who has asked
              // for reduced motion.
              autoplay={0.1}
              showPagination={false}
              onSelect={setPick}
              label={hasDeals ? t('home.v2.picks.h2Deals', "Today's deals") : t('home.v2.picks.h2', "Today's picks")}
              prevLabel={t('home.v2.picks.prev', 'Previous')}
              nextLabel={t('home.v2.picks.next', 'Next')}
              goToLabel={(n) => t('home.v2.picks.goTo', 'Go to card {{n}}', { n })}
              className="hv2-coverflow"
              cardWidth="clamp(160px, 24vw, 280px)"
            />
            <div className="hv2-picks-cta">
              <button
                type="button"
                className="btn btn-white"
                onClick={() => navigate(shelf[pick]?.href || '/stays')}
                data-testid="home-preview-pick-open"
                data-href={shelf[pick]?.href || ''}
              >
                {shelf[pick]?.discount?.percent
                  ? t('home.v2.picks.openOffer', 'See this offer')
                  : (shelf[pick]?.kind === 'biz'
                    ? t('home.v2.picks.openBiz', 'See this business')
                    : t('home.v2.picks.openStay', 'See this rental'))}
              </button>
            </div>
          </div>
        </section>
      )}

      {/* ── Recently added ─────────────────────────────────────────────
          Was "Featured rentals". Five of the live listings actually carry
          is_featured, so the heading was a claim the data did not support and
          the row underneath was mostly ordinary listings sorted newest-first
          anyway. Now it says what it is, and the order is purely by when the
          listing was posted.

          It moves. The track is the same twelve cards twice over, translated
          by exactly half its width, so the wrap lands on an identical frame
          and there is no jump. The copy is aria-hidden so a screen reader
          reads twelve listings rather than twenty-four. It pauses on hover
          and on focus — a row that keeps sliding while somebody is trying to
          click a card is hostile — and under reduced motion it does not move
          at all, becoming a normal scrollable row. */}
      <section className="hv2-pad" id="rentals">
        <div className="hv2-wrap">
          <div className="hv2-sec-head reveal">
            <div>
              <div className="hv2-eyebrow">{t('home.v2.rentals.eyebrow', 'Just listed')}</div>
              <h2>{t('home.v2.rentals.h2', 'Recently added')}</h2>
              <p>{t('home.v2.rentals.p', 'The newest listings on the site, posted by the people who hold the keys.')}</p>
            </div>
            {/* Flow buttons carry the repeated secondary actions. At rest
                this is a hairline and a word, which is what a "see all" should
                be next to six listings; the arrow it animates on hover is the
                same arrow this control already had. */}
            <FlowButton
              text={t('home.v2.rentals.more', 'See all stays')}
              onClick={() => navigate('/stays')}
              className="shrink-0"
              data-testid="home-preview-more-stays"
            />
          </div>
          {hasMarquee ? (
            <div
              ref={marqueeRef}
              className="hv2-marquee reveal"
              data-testid="home-preview-recent"
              aria-label={t('home.v2.rentals.h2', 'Recently added')}
            >
              <div className="hv2-marquee-track">
                {recent.map((p) => (
                  <div className="hv2-marquee-cell" key={p.id}>
                    <StaysCard
                      property={p}
                      liked={likedIds.has(p.id)}
                      onToggleLike={(e) => toggleLike(p.id, e)}
                      onClick={() => navigate(`/property/${p.id}`)}
                    />
                  </div>
                ))}
                {/* The second pass is what makes the wrap seamless. It is
                    decoration only — the same listings are already above.
                    `inert`, not aria-hidden: aria-hidden hid it from screen
                    readers but left every card and heart in the tab order,
                    so a keyboard walked 24 silent stops through a copy of
                    what it had just read. inert removes it from both. */}
                {recent.map((p) => (
                  <div className="hv2-marquee-cell" key={`dup-${p.id}`} inert>
                    <StaysCard
                      property={p}
                      liked={likedIds.has(p.id)}
                      onClick={() => navigate(`/property/${p.id}`)}
                    />
                  </div>
                ))}
              </div>
            </div>
          ) : (
            <div className="hv2-grid-3 reveal" data-testid="home-preview-recent">
              {recent.map((p) => (
                <StaysCard
                  key={p.id}
                  property={p}
                  fullWidth
                  liked={likedIds.has(p.id)}
                  onToggleLike={(e) => toggleLike(p.id, e)}
                  onClick={() => navigate(`/property/${p.id}`)}
                />
              ))}
              {loaded && recent.length === 0 && (
                <p className="hv2-empty">{t('home.v2.rentals.empty', 'New listings are on their way.')}</p>
              )}
            </div>
          )}
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
            <FlowButton
              text={t('home.v2.biz.more', 'See all businesses')}
              onClick={() => navigate('/businesses')}
              className="shrink-0"
              data-testid="home-preview-more-businesses"
            />
          </div>
          <div className="hv2-grid-4 reveal" data-testid="home-preview-businesses">
            {businesses.map((g) => (
              <ServiceCard key={g.id} gig={g} i18n={i18n} t={t} onClick={() => navigate(`/businesses/${g.id}`)} />
            ))}
          </div>
        </div>
      </section>

      {/* ── What we are building ──────────────────────────────────────
          Replaces the how-it-works columns. Words on the left reveal as the
          cards on the right morph from a ring into an arch, both off the
          same scroll. See components/home/CommunitySection.jsx for why one
          progress value drives both. */}
      <CommunitySection items={shelf.length ? shelf : gallery} />

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
