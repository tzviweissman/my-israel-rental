/**
 * "Why host with us" - the property-owner pitch, at /why-host.
 *
 * The counterpart to /why-list (the service-provider pitch). The Host card
 * on /join links here; neither page is in the nav.
 *
 * Two rules inherited from /why-list, and the reason this page says less
 * than the mockup does:
 *
 *   1. **Only claim what exists today.** Every line below maps to shipped
 *      code: free listing, direct WhatsApp/in-app contact, message
 *      translation, digital contract signing, iCal sync, Requests board.
 *
 *   2. **No invented people.** The mockup's testimonials are three named
 *      renters with stock headshots and five-star ratings. They are
 *      fictional. `Testimonials` renders nothing until there is something
 *      real, same call as `SocialProof` on /why-list.
 *
 * LAYOUT REBUILD (Aug 2026). The structure came out of running the
 * taste-skill (.claude/skills/taste-skill) against this page twice: once
 * with the brand pinned, once with nothing pinned at all. The brand is
 * unchanged - palette, Playfair, limestone, tokens - and only the
 * composition moved. What changed and why:
 *
 *   - Hero was centred. Split composition lets a photograph carry the
 *     emotional load, which matters when the ask is "trust us with your
 *     apartment". The small line under the CTA is gone: it was a fifth
 *     text element in a block that should hold four, and it works harder
 *     in the proof strip below.
 *   - Six identical cards in a three-column grid is the most generic
 *     shape a feature list can take. They are now a numbered editorial
 *     run with hairline rules, which reads denser and more confident and
 *     puts the feature name and its explanation on one line together.
 *     This came from the unpinned run, which reached for it unprompted.
 *   - Three eyebrows across the page became one. The headline was already
 *     saying what each section was.
 *   - Steps were numbered 1/2/3 with the number as the visual. The verb
 *     is the label; the ordinal adds nothing sighted users cannot see.
 *     Kept for screen readers.
 *
 * RTL: the numbered list is a CSS grid, so column order flips with
 * direction automatically. Headings read `var(--font-head)`, never a
 * literal face, so the Hebrew swap in design-tokens.css applies.
 */
import React, { useState, useEffect, useRef } from 'react';
import { useTranslation } from 'react-i18next';
import BackLink from '../components/common/BackLink';
import { useNavigate } from 'react-router-dom';
import { ArrowRight } from 'lucide-react';
import PageMeta from '../components/PageMeta';
import SITE_ASSETS from '../lib/siteAssets';
import SkylineRule from '../components/common/SkylineRule';

// Shipped features only. Each key resolves to whyHost.<key>Title/<key>Body.
const FEATURES = ['free', 'direct', 'bilingual', 'contract', 'ical', 'requests'];

// The poster is only ever shown at ~535px wide, so ask Cloudinary for a
// width rather than shipping the 2048px original. The full-size file is
// 320KB, over the project's 300KB image budget, for pixels nobody sees.
const POSTER = SITE_ASSETS['scene3-interior-reveal'].replace('/f_auto,q_auto/', '/f_auto,q_auto,w_1100/');

const TABS = ['longTerm', 'vacation'];

/**
 * Intentionally renders nothing.
 *
 * The mockup's testimonial cards are invented - fictional names, stock
 * photos, five stars each. A placeholder on a live pitch page is still
 * something a visitor reads and believes. When there are real, consented
 * testimonials, render them here bound to something stored. Do not
 * hardcode quotes.
 */
const Testimonials = () => null;

/**
 * Ties the hero clip's playhead to scroll position, so the apartment comes
 * apart as the reader moves down the page instead of looping on its own.
 *
 * The idea is borrowed: when a page has one big three-dimensional element,
 * carry it into the next section rather than leaving it stranded in the
 * hero. Here the apartment finishes opening at roughly the moment "What
 * you get" arrives, so the picture and the list are one movement.
 *
 * FAIL-SAFE BY CONSTRUCTION, which is the house rule for anything driven
 * by JavaScript here. The markup already autoplays and loops, so if this
 * effect never runs - JS disabled, an error earlier in the tree, an old
 * browser - the visitor still gets a playing video. Scrubbing is an
 * upgrade applied on top, never a prerequisite.
 *
 * Skipped entirely for `prefers-reduced-motion`, where the markup shows a
 * still instead, and on narrow screens, where scroll-scrubbing a video is
 * unreliable and the loop reads better anyway.
 */
function useScrollScrub(videoRef) {
  useEffect(() => {
    const v = videoRef.current;
    if (!v) return undefined;
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return undefined;
    if (window.innerWidth < 768) return undefined;

    let frame = 0;
    let duration = 0;

    const takeOver = () => {
      duration = v.duration;
      if (!duration || !Number.isFinite(duration)) return;
      v.pause();
      v.loop = false;
    };

    const update = () => {
      frame = 0;
      if (!duration) return;
      const rect = v.getBoundingClientRect();
      // 0 when the clip sits where it loads, 1 once it has travelled its
      // own height plus half a viewport upward, which lands the end of
      // the animation on the section below.
      const travelled = -rect.top;
      const span = rect.height + window.innerHeight * 0.5;
      const progress = Math.min(1, Math.max(0, travelled / span));
      const target = progress * (duration - 0.05);
      // Seeking to a value we are already at makes some browsers stutter.
      if (Math.abs(v.currentTime - target) > 0.02) v.currentTime = target;
    };

    const onScroll = () => {
      if (!frame) frame = window.requestAnimationFrame(update);
    };

    if (v.readyState >= 1) takeOver();
    else v.addEventListener('loadedmetadata', takeOver, { once: true });

    window.addEventListener('scroll', onScroll, { passive: true });
    window.addEventListener('resize', onScroll, { passive: true });
    return () => {
      window.removeEventListener('scroll', onScroll);
      window.removeEventListener('resize', onScroll);
      if (frame) window.cancelAnimationFrame(frame);
    };
  }, [videoRef]);
}

const WhyHost = () => {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const [tab, setTab] = useState('longTerm');
  const heroVideo = useRef(null);
  useScrollScrub(heroVideo);

  const startHosting = () => navigate('/join');

  return (
    <div className="min-h-screen" style={{ background: 'var(--bg)' }} data-testid="why-host-page">
      <PageMeta
        title="List your property on MyIsraelRental | For owners"
        description="List your apartment or vacation rental free — no listing fee, no booking fees, no commission. Renters message you directly, contracts are signed digitally, and your calendar stays in sync."
        path="/why-host"
      />

      {/* Hero - split, photo carries the trust */}
      <section className="px-6 pt-24 pb-14">
        {/* Reached mid-signup from the join page's "See how hosting
            works" — same stranding problem as /why-list. */}
        <div className="max-w-6xl mx-auto mb-6">
          <BackLink fallback="/signup" testId="why-host-back" />
        </div>
        <div className="max-w-6xl mx-auto grid gap-10 lg:gap-14 lg:grid-cols-[1.05fr_1fr] lg:items-center">
          <div>
            <div className="wh-eyebrow" style={{ color: 'var(--gold-text-on-light)' }}>
              {t('whyHost.eyebrow', 'For property owners')}
            </div>
            <h1
              className="text-4xl md:text-5xl lg:text-6xl font-bold mt-4 mb-5"
              style={{ fontFamily: 'var(--font-head)', color: 'var(--ink)', lineHeight: 1.06 }}
            >
              {t('whyHost.heroTitle', 'List your property. Keep every shekel.')}
            </h1>
            {/* B2 — the price position promoted out of the paragraph it was
                buried in. Kindred makes "No membership fee" its
                second-largest text; ours is the stronger offer and was one
                clause of three in a sentence a visitor may not reach.
                Sized between the h1 and the body so it reads as a claim
                rather than as detail. */}
            <p className="wh-price">
              {t('whyHost.heroPrice', 'No listing fee. No booking fees. No commission.')}
            </p>
            <p className="text-base sm:text-lg mb-8 max-w-[48ch]" style={{ color: 'var(--brand-muted)' }}>
              {t(
                'whyHost.heroBody',
                'Renters looking for a home in English find you here and message you directly — you keep whatever you agree with them.',
              )}
            </p>
            <button
              onClick={startHosting}
              className="btn-blue-solid inline-flex items-center gap-2"
              data-testid="why-host-hero-cta"
            >
              {t('whyHost.cta', 'List your property free')}
              <ArrowRight size={16} className="rtl:rotate-180" />
            </button>
          </div>

          {/* The star of the page, and it has to earn that by referring to
              what this product does, not merely by being a nice picture.
              It was a photograph of an owner on a sofa: warm, but it said
              nothing about keeping every shekel or about the paperwork
              disappearing. An apartment coming apart into its layers says
              "your property, and everything in it" in one shot, which is
              the actual offer.

              Muted and loop-played, so it never asks for a decision, and
              the still is the poster so nothing is blank while it loads.
              Anyone who has asked for reduced motion gets the still only. */}
          <div
            className="rounded-2xl overflow-hidden"
            style={{ boxShadow: '0 24px 60px -30px rgba(18,59,87,0.45)', background: 'var(--surface)' }}
          >
            <video
              ref={heroVideo}
              src={SITE_ASSETS['scene11-apartment-exploded']}
              poster={POSTER}
              autoPlay
              muted
              loop
              playsInline
              preload="metadata"
              aria-label={t('whyHost.heroImageAlt', 'An apartment separating into its rooms, floors and furnishings')}
              className="w-full h-full object-cover motion-reduce:hidden"
              style={{ aspectRatio: '4 / 3' }}
            />
            <img
              src={POSTER}
              alt={t('whyHost.heroImageAlt', 'An apartment separating into its rooms, floors and furnishings')}
              className="w-full h-full object-cover hidden motion-reduce:block"
              style={{ aspectRatio: '4 / 3' }}
            />
          </div>
        </div>
      </section>

      {/* Proof strip - the three numbers, given their own row */}
      <section className="px-6 pb-16">
        <div
          className="max-w-6xl mx-auto grid gap-px sm:grid-cols-3 overflow-hidden rounded-2xl"
          style={{ background: 'var(--brand-border)' }}
          data-testid="why-host-proof"
        >
          {[
            ['₪0', 'proofFree'],
            ['0%', 'proofCommission'],
            ['2', 'proofLang'],
          ].map(([figure, key]) => (
            <div key={key} className="p-7" style={{ background: 'var(--surface)' }}>
              <div
                className="text-3xl font-bold mb-2"
                style={{ fontFamily: 'var(--font-head)', color: 'var(--gold-text-on-light)' }}
              >
                {figure}
              </div>
              <div className="font-semibold mb-1" style={{ color: 'var(--ink)' }}>
                {t(`whyHost.${key}Title`, '')}
              </div>
              <p className="text-sm" style={{ color: 'var(--brand-muted)' }}>
                {t(`whyHost.${key}Body`, '')}
              </p>
            </div>
          ))}
        </div>
      </section>

      {/* What you get - numbered editorial run, not a card grid */}
      <section className="px-6 pb-16">
        <div className="max-w-5xl mx-auto">
          <h2
            className="text-2xl sm:text-3xl font-bold mb-9 max-w-[20ch]"
            style={{ fontFamily: 'var(--font-head)', color: 'var(--ink)' }}
          >
            {t('whyHost.benefitsTitle', 'What you get')}
          </h2>

          <div style={{ borderTop: '1px solid var(--brand-border)' }}>
            {FEATURES.map((key, i) => (
              <div
                key={key}
                className="grid gap-x-8 gap-y-2 py-7 sm:grid-cols-[3rem_minmax(0,1fr)] md:grid-cols-[3rem_minmax(0,14rem)_minmax(0,1fr)] items-start"
                style={{ borderBottom: '1px solid var(--brand-border)' }}
                data-testid={`why-host-benefit-${key}`}
              >
                <div
                  className="text-sm pt-1 tabular-nums"
                  style={{ color: 'var(--gold-text-on-light)', letterSpacing: '0.06em' }}
                  aria-hidden="true"
                >
                  {String(i + 1).padStart(2, '0')}
                </div>
                <h3 className="text-lg font-semibold" style={{ color: 'var(--ink)' }}>
                  {t(`whyHost.${key}Title`, key)}
                </h3>
                <p className="text-sm max-w-[62ch]" style={{ color: 'var(--brand-muted)' }}>
                  {t(`whyHost.${key}Body`, '')}
                </p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Visual rhyme, and the only one on the page. The logo's skyline
          becomes the edge where the white section meets the limestone.
          Tried first as an 8px hairline in two places: at that size the
          buildings are imperceptible, so it read as a slightly wobbly
          line and bought nothing. A rhyme has to be recognisable to be a
          rhyme, so it appears once, large. */}
      <SkylineRule color="var(--surface)" height={30} style={{ marginTop: -1 }} />

      {/* How it works - the verb is the label */}
      <section className="px-6 pb-16 pt-6 bg-white">
        <div className="max-w-5xl mx-auto">
          <div className="flex flex-wrap items-end justify-between gap-5 mb-10">
            <h2
              className="text-2xl sm:text-3xl font-bold max-w-[16ch]"
              style={{ fontFamily: 'var(--font-head)', color: 'var(--ink)' }}
            >
              {t('whyHost.howTitle', 'How hosting works')}
            </h2>
            <div className="wh-tabs" role="tablist" aria-label={t('whyHost.howTitle', 'How hosting works')}>
              {TABS.map((k) => (
                <button
                  key={k}
                  type="button"
                  role="tab"
                  className="wh-tab"
                  aria-selected={tab === k}
                  aria-controls={`why-host-steps-${k}`}
                  onClick={() => setTab(k)}
                  data-testid={`why-host-tab-${k}`}
                >
                  {t(`whyHost.tab_${k}`, k)}
                </button>
              ))}
            </div>
          </div>

          {TABS.map((k) => (
            <ol
              key={k}
              id={`why-host-steps-${k}`}
              role="tabpanel"
              className="grid gap-8 sm:grid-cols-3"
              // Driven from React rather than the `hidden` attribute: `hidden`
              // is a user-agent display rule and loses to any author `display`,
              // which is exactly how both panels once rendered at once here.
              style={{ display: tab === k ? 'grid' : 'none' }}
              data-testid={`why-host-steps-${k}`}
            >
              {[1, 2, 3].map((n) => (
                <li key={n} className="pt-4" style={{ borderTop: '2px solid var(--gold)' }}>
                  <h3
                    className="text-xl font-bold mb-2"
                    style={{ fontFamily: 'var(--font-head)', color: 'var(--ink)' }}
                  >
                    {t(`whyHost.${k}_s${n}_verb`, '')}
                  </h3>
                  <p className="text-sm" style={{ color: 'var(--brand-muted)' }}>
                    {t(`whyHost.${k}_s${n}_body`, '')}
                  </p>
                  <span className="sr-only">{`${n}`}</span>
                </li>
              ))}
            </ol>
          ))}
        </div>
      </section>

      <Testimonials />

      {/* Closing - same CTA label as the hero, one label per intent */}
      <section className="px-6 py-20">
        <div className="max-w-3xl mx-auto text-center">
          <h2
            className="text-2xl sm:text-3xl font-bold mb-3"
            style={{ fontFamily: 'var(--font-head)', color: 'var(--ink)' }}
          >
            {t('whyHost.closingTitle', 'Your next tenant is already looking')}
          </h2>
          <p className="text-sm mb-7" style={{ color: 'var(--brand-muted)' }}>
            {t('whyHost.closingBody', 'Listing takes a few minutes and costs nothing.')}
          </p>
          <button
            onClick={startHosting}
            className="btn-blue-solid inline-flex items-center gap-2"
            data-testid="why-host-closing-cta"
          >
            {t('whyHost.cta', 'List your property free')}
            <ArrowRight size={16} className="rtl:rotate-180" />
          </button>
        </div>
      </section>
    </div>
  );
};

export default WhyHost;
