import React from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';

const CDN = 'https://d8j0ntlcm91z4.cloudfront.net/user_3HWGlZDXVCAOoMKfZq628Ml9cM5';

/**
 * The opening aerial — the establishing shot before scene 1.
 *
 * Its absence is why the page "opened cold on the Kotel": the document had no
 * top-level heading at all, so the first thing a visitor (or a crawler, or a
 * screen reader) met was a stone wall with a caption that is invisible at
 * scroll 0 by design.
 *
 * A plain <header>, not a pinned scene: it scrolls away normally. The pinning
 * starts at scene 1, and making this sticky too would mean two elements
 * fighting for the same viewport on the first scroll gesture.
 *
 * The video is unconditional — under reduced motion the CSS hides it and the
 * poster shows through, which is the same fallback the scenes use, so there is
 * no separate code path to keep in sync.
 */
const CinematicHero = ({ reducedMotion }) => {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const videoRef = React.useRef(null);

  // The `autoplay` attribute alone is not enough here. The element mounts
  // inside a React tree, and browsers evaluate autoplay at parse time — so a
  // muted, playsinline video can still come up paused. The scene observer
  // does not cover this one either: it watches [data-scene] video, and the
  // hero is a plain <header> outside that. Ask once on mount and swallow a
  // rejection, which leaves the poster showing rather than a dead frame.
  React.useEffect(() => {
    if (reducedMotion) return;
    videoRef.current?.play().catch(() => {});
  }, [reducedMotion]);

  return (
    <header className="hero">
      <video
        ref={videoRef}
        // autoPlay only when motion is welcome. muted+playsInline are what
        // make autoplay permissible at all on mobile Safari.
        autoPlay={!reducedMotion}
        muted
        loop
        playsInline
        preload="auto"
        poster={`${CDN}/hf_20260806_140841_dd0ae729-6af8-43e0-b4c5-15f63a29c9cc.png`}
        aria-hidden="true"
      >
        <source
          src={`${CDN}/hf_20260806_162843_d02440e3-cf32-4021-8fcd-970452ae7d9f.mp4`}
          type="video/mp4"
        />
      </video>

      <div className="shade2" />

      <div className="center">
        {/* The page's only <h1>. */}
        <h1>
          {t('home.hero.h1', 'Find your place')}{' '}
          <span className="a">{t('home.hero.accent', 'in Israel.')}</span>
        </h1>
        <p>
          {t(
            'home.hero.sub',
            'Rent a home. Hire the pros. — one place for both. Free for renters and owners, no service fees.',
          )}
        </p>
        <div className="ctas">
          <button type="button" className="b-white" onClick={() => navigate('/stays')}>
            {t('home.hero.ctaStays', 'Search rentals')} →
          </button>
          <button type="button" className="b-line" onClick={() => navigate('/why-list')}>
            {t('home.hero.ctaList', 'List your property')}
          </button>
        </div>
      </div>

      <div className="hint">{t('home.hero.hint', 'Scroll — the story moves with you')}</div>
    </header>
  );
};

export default CinematicHero;
