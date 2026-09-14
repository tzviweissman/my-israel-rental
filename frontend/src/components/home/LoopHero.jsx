import React from 'react';
import { playWhenAllowed } from '../../utils/videoAutoplay';

/**
 * The /home-preview hero: one seamless glass loop behind the copy.
 *
 * PREVIEW PAGE ONLY. The live home page's hero is CinematicHero and is exempt
 * by ruling (CLAUDE.md). The shared autoplay logic lives in
 * utils/videoAutoplay.js so it is not written twice.
 *
 * WHY A LOOP, NOT THE 40s FILM. This replaces a one-shot film that resolved on
 * the site's mark at the very end. A hero gets a few seconds before somebody
 * scrolls or clicks, so a payoff at 0:36 is a payoff nobody sees. The loop is
 * built from four segments chained through shared stills — scattered blocks →
 * locked cube → flat chip plane → spiral ribbon → back to scattered blocks —
 * so its last frame IS its first frame and `loop` needs no crossfade. Whatever
 * moment a visitor lands on is a good one.
 *
 * The mark is deliberately NOT overlaid any more. It only made sense as the
 * resolution of a film that ended; on a loop there is no end to resolve to,
 * and the nav already carries the same lockup a few dozen pixels above.
 *
 * TWO DELIBERATE DEPARTURES from the integration spec, both because the spec's
 * version reintroduces a bug this repo has already shipped once:
 *
 *   1. Reduced motion renders NO <video> at all, rather than pausing one.
 *      iOS paints a large native play glyph over any video that is not
 *      playing, whatever its attributes say, so `v.pause()` leaves a paused
 *      video wearing a play button. The poster is shown on its own instead.
 *
 *   2. The failure path. If the loop has not advanced a frame within two
 *      seconds, or the element errors, the video is dropped and the poster
 *      stands in. The hero is never a black rectangle or a broken-video icon.
 */

const BASE = '/videos/preview-hero';

// Two renditions. The desktop file is 1440 wide; the phone one is 720 and a
// third of the bytes, because a 4 MB background on cellular data is not a
// background, it is a tax. Picked in JS rather than with <source media>,
// which browsers apply inconsistently for video.
const LOOP = {
  wide: { mp4: `${BASE}/hero-loop.mp4`, webm: `${BASE}/hero-loop.webm` },
  phone: { mp4: `${BASE}/hero-loop-m.mp4`, webm: `${BASE}/hero-loop-m.webm` },
};
// Frame one of the encoded file, so the first paint and the loop's start are
// the same pixels and there is no jump when playback begins.
const POSTER = `${BASE}/hero-loop-poster.jpg`;

// Two budgets, because the two starts are not comparable. The video is
// preload="metadata", so no frame is buffered before play() — on a phone the
// clock and the download start together, over cellular, and a 2s budget sent
// merely-slow connections to the still for the whole visit (`failed` is never
// reset). The deadline is also cancelled the moment data arrives: a video that
// has loaded but not yet been allowed to start is not a failure.
const START_DEADLINE_MS = 2000;
const COLD_START_DEADLINE_MS = 6000;
// Degrees of travel, matching the spec. Small enough to read as depth rather
// than as the page moving under the pointer.
const TILT_PX = 8;

const useMedia = (query) => {
  const [matches, setMatches] = React.useState(
    () => typeof window !== 'undefined' && window.matchMedia(query).matches,
  );
  React.useEffect(() => {
    const mq = window.matchMedia(query);
    const sync = () => setMatches(mq.matches);
    sync();
    mq.addEventListener('change', sync);
    return () => mq.removeEventListener('change', sync);
  }, [query]);
  return matches;
};

const LoopHero = () => {
  const reduced = useMedia('(prefers-reduced-motion: reduce)');
  // `hover: none` is the honest test for "this is a touch device", rather than
  // a width breakpoint: a pointer that cannot hover cannot drive a parallax.
  const canHover = useMedia('(hover: hover)');
  const phone = useMedia('(max-width: 767px)');
  const src = phone ? LOOP.phone : LOOP.wide;

  const videoRef = React.useRef(null);
  const [playing, setPlaying] = React.useState(false);
  const [failed, setFailed] = React.useState(false);
  const [tilt, setTilt] = React.useState({ x: 0, y: 0 });

  const showStill = reduced || failed;

  React.useEffect(() => {
    if (showStill) return undefined;
    const video = videoRef.current;
    if (!video) return undefined;
    playWhenAllowed(video);
    const bail = window.setTimeout(() => {
      // Read the element, not a state flag: `playing` captured here is always
      // false, so the flag would fire the fallback on a working video.
      if (!video.currentTime) setFailed(true);
    }, phone ? COLD_START_DEADLINE_MS : START_DEADLINE_MS);
    const arrived = () => window.clearTimeout(bail);
    video.addEventListener('loadeddata', arrived, { once: true });
    return () => {
      window.clearTimeout(bail);
      video.removeEventListener('loadeddata', arrived);
    };
  }, [showStill, phone]);

  React.useEffect(() => {
    if (reduced || !canHover || showStill) return undefined;
    const onMove = (e) => {
      setTilt({
        x: (e.clientX / window.innerWidth - 0.5) * TILT_PX,
        y: (e.clientY / window.innerHeight - 0.5) * TILT_PX,
      });
    };
    window.addEventListener('pointermove', onMove, { passive: true });
    return () => window.removeEventListener('pointermove', onMove);
  }, [reduced, canHover, showStill]);

  return (
    <div
      className="hv2-blocks hv2-loop"
      data-testid="home-preview-loop"
      style={{ transform: `translate3d(${tilt.x}px, ${tilt.y}px, 0)` }}
    >
      {!showStill && (
        <video
          // Keyed on the rendition: crossing the phone breakpoint swaps the
          // file, and React would otherwise keep the old element with its old
          // buffered source. A remount reloads it.
          key={src.mp4}
          ref={videoRef}
          className="hv2-loop-video"
          style={{ opacity: playing ? 1 : 0 }}
          // muted + playsInline are what make autoplay permissible at all;
          // playWhenAllowed writes the muted ATTRIBUTE too, because React only
          // ever sets the property and the mobile policy reads the attribute.
          autoPlay
          muted
          loop
          playsInline
          preload="metadata"
          disablePictureInPicture
          poster={POSTER}
          aria-hidden="true"
          tabIndex={-1}
          onPlaying={() => setPlaying(true)}
          onError={() => setFailed(true)}
        >
          <source src={src.webm} type="video/webm" />
          <source src={src.mp4} type="video/mp4" />
        </video>
      )}

      {/* The poster sits underneath and the video fades in over it once it is
          genuinely running. Covering the video instead of hiding it is what
          CinematicHero does, and for a reason: Safari can refuse to autoplay a
          video it considers not visible, so hiding one to conceal its paused
          frame risks causing the very refusal it was meant to paper over. */}
      <div
        className="hv2-loop-poster"
        style={{ backgroundImage: `url('${POSTER}')` }}
        aria-hidden="true"
      />
    </div>
  );
};

export default LoopHero;
