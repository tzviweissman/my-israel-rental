import React from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';
import SITE_ASSETS from '../../lib/siteAssets';
import { playWhenAllowed } from '../../utils/videoAutoplay';

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
 * NO PAUSED VIDEO IS EVER VISIBLE, and that is the whole trick. iOS paints a
 * large native play glyph over any <video> that is not playing, whatever its
 * attributes say and whether or not the webkit pseudo-element is hidden. So
 * the poster is a real image layer underneath, and the video is transparent
 * until it actually reports `playing`.
 *
 * Under reduced motion the video is not rendered at all. The old comment here
 * claimed CSS hid it and "the poster shows through" — it did not: the
 * reduced-motion rule only covered `.scene video`, never `.hero video`, so
 * with Reduce Motion switched on the hero was a paused video wearing a play
 * button. Reproduced with Playwright's `reducedMotion: 'reduce'` before this
 * was changed, and asserted against afterwards.
 */
const CinematicHero = ({ reducedMotion }) => {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const videoRef = React.useRef(null);
  // Only once the browser confirms it is playing. `autoplay` being present
  // is not the same thing — Low Power Mode refuses it and says nothing.
  const [playing, setPlaying] = React.useState(false);

  // The `autoplay` attribute alone is not enough here. The element mounts
  // inside a React tree, and browsers evaluate autoplay at parse time — so a
  // muted, playsinline video can still come up paused. The scene observer
  // does not cover this one either: it watches [data-scene] video, and the
  // hero is a plain <header> outside that.
  //
  // `muted` below is a React PROPERTY, not an attribute, and the mobile
  // autoplay policy reads the attribute — which is why this played on a
  // laptop and showed a play button on a phone. playWhenAllowed sets both
  // before asking, and retries once on the first touch for the cases muting
  // cannot fix (Low Power Mode). A rejection still leaves the poster up.
  React.useEffect(() => {
    if (reducedMotion) return;
    playWhenAllowed(videoRef.current);
  }, [reducedMotion]);

  return (
    <header className="hero">
      {!reducedMotion && (
        <video
          ref={videoRef}
          // muted + playsInline are what make autoplay permissible at all on
          // mobile Safari; the attribute is written by playWhenAllowed too,
          // because React only ever sets the property.
          autoPlay
          muted
          loop
          playsInline
          preload="auto"
          aria-hidden="true"
          onPlaying={() => setPlaying(true)}
        >
          <source
            src={SITE_ASSETS['clip0-aerial']}
            type="video/mp4"
          />
        </video>
      )}

      {/* The still sits ON TOP of the video and fades out once it is
          genuinely running — rather than the video being transparent until
          then, which was the first attempt.

          The difference matters: Safari can refuse to autoplay a video it
          considers not visible, so hiding the video to hide a paused frame
          risks causing the very refusal it was meant to paper over. Covering
          it instead leaves the video fully visible to the autoplay policy
          the whole time, and nobody ever sees a paused frame. */}
      <div
        className="media-poster"
        style={{
          backgroundImage: `url('${SITE_ASSETS['scene1-aerial']}')`,
          opacity: playing ? 0 : 1,
        }}
        aria-hidden="true"
      />

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
          {/* The supply-side door. Now "Join free" → the role picker rather
              than "List your property" → /why-list: the hero speaks to
              hosts AND service providers, and the old label only invited
              one of them. /why-list is still the full host pitch, reached
              from the Host card on the join page. */}
          <button type="button" className="b-line" onClick={() => navigate('/join')}>
            {t('home.hero.ctaJoin', 'Join free')}
          </button>
        </div>
      </div>

      <div className="hint">{t('home.hero.hint', 'Scroll — the story moves with you')}</div>
    </header>
  );
};

export default CinematicHero;
