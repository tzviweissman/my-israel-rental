/**
 * The community section — words on the left, a ring of real listings
 * morphing into an arch on the right, both moving off ONE scroll.
 *
 * Replaces "How MyIsraelRental works" on the home page (Tzvi, 3 Sep).
 *
 * WHY ONE PROGRESS VALUE. Each component ships with its own scroll
 * measurement, and two measurements of the same scroll drift the moment the
 * elements they measure are different heights — the words would finish
 * while the cards were mid-morph, on a section whose whole point is that
 * the two move together. So the section measures once and hands the value
 * to both.
 *
 * The section is tall and its inside is sticky: the reader scrolls the
 * page normally, the frame holds still, and the progress through the tall
 * part is what drives everything. Nothing traps the wheel — the source
 * component did, which on a page halfway down means the page stops moving
 * while the pointer is over it.
 *
 * The cards are the site's own listings and businesses, not stock. They
 * flip on hover to name what they are showing, and clicking one opens it.
 */
import React, { useEffect, useMemo, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { useMotionValue, useReducedMotion, useTransform } from 'motion/react';

import PixelTextFill from '../ui/pixel-text-fill';
import ScrollMorphCards from '../ui/scroll-morph-hero';

// Twelve. The source uses twenty on a full-screen stage; on this one that
// many overlap by more than half their width, and ten left the ring looking
// sparse. Twelve fills the circle and still leaves the arch legible.
const CARD_COUNT = 12;

export default function CommunitySection({ items = [] }) {
  const { t, i18n } = useTranslation();
  const navigate = useNavigate();
  const sectionRef = useRef(null);
  const reduced = useReducedMotion();

  const isHe = (i18n.language || '').startsWith('he');

  const cards = useMemo(() => {
    const pool = items.filter((it) => it && it.src);
    if (!pool.length) return [];
    return Array.from({ length: CARD_COUNT }, (_, i) => {
      const it = pool[i % pool.length];
      return {
        key: `${it.key || it.href || it.src}-${i}`,
        src: it.src,
        alt: '',
        title: isHe && it.title_he ? it.title_he : it.title,
        sub: it.kind === 'stay'
          ? t('home.v2.community.cardStay', 'Rental')
          : t('home.v2.community.cardBiz', 'Business'),
        href: it.href,
      };
    });
  }, [items, isHe, t]);

  // ONE measurement, both halves, computed here rather than taken from
  // `useScroll`. The library's version reported exactly 0 at every scroll
  // position on this page - words dim, ring frozen, no error to show for it
  // - and a section whose whole job is to respond to scrolling is not the
  // place for a number I cannot read. This is a handful of lines and the
  // browser check samples it at five points down the section.
  //
  // 0 when the section's top meets the top of the viewport, 1 when its
  // bottom does: exactly the span over which the inner frame is pinned.
  //
  // `cards.length` is in the dependency list, and it is load-bearing. The
  // section renders NOTHING until the listings arrive, so on first mount
  // there is no element to measure: the effect bailed out, never ran again,
  // and the whole section sat at progress 0 for ever - words dim, ring
  // frozen, no error anywhere. Re-running when the cards appear is what
  // attaches the listener to an element that exists.
  const scrollYProgress = useMotionValue(0);
  useEffect(() => {
    const el = sectionRef.current;
    if (!el) return undefined;
    const measure = () => {
      const r = el.getBoundingClientRect();
      const travel = r.height - window.innerHeight;
      const p = travel <= 0 ? 0 : Math.min(1, Math.max(0, -r.top / travel));
      scrollYProgress.set(p);
    };
    measure();
    window.addEventListener('scroll', measure, { passive: true });
    window.addEventListener('resize', measure);
    return () => {
      window.removeEventListener('scroll', measure);
      window.removeEventListener('resize', measure);
    };
  }, [scrollYProgress, cards.length]);

  // The scene finishes at 85% of the pinned travel, not at 100%. Driving it
   // to the very end means it completes at the exact moment the section
   // starts leaving, so the finished picture is never on screen standing
   // still - "you don't see the whole scene until you have scrolled past
   // it". The last 28% is a hold: everything is complete, the frame is still
   // pinned, and the reader gets a beat to look at it before moving on.
  // 0.85, up from 0.72: with the section this tall, a 28% hold was a whole
  // screen of nothing happening. 15% is still a beat.
  const anim = useTransform(scrollYProgress, [0, 0.85], [0, 1], { clamp: true });

  if (!cards.length) return null;

  return (
    <section className="hv2-community" ref={sectionRef} id="community" data-testid="home-preview-community">
      <div className="hv2-community-sticky">
        <div className="hv2-wrap hv2-community-grid">
          <div className="hv2-community-words">
            <p className="hv2-community-kicker">
              {t('home.v2.community.kicker', 'What we are building')}
            </p>
            {/* The passage fills in behind a dithered wavefront rather than
                lighting word by word. Same progress value as the cards, so
                the two still move together - the component takes the number
                instead of measuring the scroll itself, which is also what
                lets it run without GSAP. */}
            <PixelTextFill
              progress={anim}
              text={t('home.v2.community.text')}
              className="hv2-community-pixel"
            />
          </div>
          <div className="hv2-community-cards">
            <ScrollMorphCards
              cards={cards}
              progress={anim}
              reduced={!!reduced}
              onOpen={(card) => card.href && navigate(card.href)}
            />
          </div>
        </div>
      </div>
    </section>
  );
}
