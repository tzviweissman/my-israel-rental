import React from 'react';
import { useTranslation } from 'react-i18next';
import logoMark from '../../assets/brand/logo-mark.png';
import { playWhenAllowed } from '../../utils/videoAutoplay';

/**
 * The /home-preview hero: three generated clips played as one continuous
 * shot, resolving on the site's mark.
 *
 * PREVIEW PAGE ONLY. The live home page's hero is CinematicHero, and it is
 * exempt by ruling (CLAUDE.md, "the cinematic home page is exempt"). This
 * file exists rather than a `sequence` prop on CinematicHero because that
 * component renders the LIVE hero whole — its own <h1>, its own CTAs, its
 * own copy — and mounting it here would import the live page's wording into
 * a page whose copy is meant to stay exactly as it is. The autoplay logic
 * that must not be written twice lives in utils/videoAutoplay.js, and both
 * components call it; the poster-on-top trick below is CinematicHero's, kept
 * deliberately identical because it is load-bearing (see the comment on it).
 *
 * THE THREE CLIPS ARE ONE SHOT. Each clip's final frame is the next clip's
 * first frame — measured, not assumed: SSIM 0.95 across the first joint and
 * 0.82 across the second, against 0.58 for two unrelated frames from the
 * same sequence. So there is nothing to cross-fade, and a fade would in fact
 * show as a dip in brightness where none belongs. They are swapped by
 * opacity on the frame boundary, and clip N+1 is only allowed to start
 * fetching once clip N is genuinely playing.
 *
 * IT DOES NOT LOOP. Thirty-two seconds is a short film, and restarting it
 * behind somebody who is reading is hostile. Clip 3 ends and simply stays on
 * its final frame, which is the end card; the mark fades in over it.
 *
 * Three things break this, and each one is handled by showing a designed
 * frame rather than a broken one:
 *
 *   prefers-reduced-motion — no <video> is rendered at all. Not a paused
 *   video, not a play button: the finished end card with the mark already
 *   in place. Rendering the element and hiding it with CSS is what shipped
 *   here before, and iOS paints a native play glyph over any video that is
 *   not playing, whatever its attributes say.
 *
 *   A phone — one clip, 12 seconds, 567 KB, then a cut to the end card.
 *   Thirty-two seconds of video on cellular data is not a background.
 *
 *   A stall or a failed fetch — if clip 1 has not advanced a single frame
 *   within two seconds, or any element reports an error, the whole reel is
 *   dropped and the end card takes over. The hero is never a black
 *   rectangle and never a broken-video icon.
 */

const BASE = '/videos/preview-hero';

// 1440 wide, CRF 30 (h264) / 46 (VP9), no audio track at all. WebM is listed
// first because on this material it is genuinely the smaller file — glass on
// white is unusual that way, and at the CRFs that look identical VP9 lands
// 15-30% under x264. Both are under 2 MB; neither bands on the ribbon, which
// is the worst case here and was checked at 2x on a crop before this shipped.
const CLIPS = [
  { webm: `${BASE}/seq1.webm`, mp4: `${BASE}/seq1.mp4`, poster: `${BASE}/seq1.jpg` },
  { webm: `${BASE}/seq2.webm`, mp4: `${BASE}/seq2.mp4`, poster: `${BASE}/seq2.jpg` },
  { webm: `${BASE}/seq3.webm`, mp4: `${BASE}/seq3.mp4`, poster: `${BASE}/seq3.jpg` },
];

const PHONE_CLIPS = [
  { webm: `${BASE}/seq1-m.webm`, mp4: `${BASE}/seq1-m.mp4`, poster: `${BASE}/seq1.jpg` },
];

const END_CARD = `${BASE}/endcard.jpg`;

// Long enough that a slow-but-working connection is not punished, short
// enough that nobody watches a white rectangle wondering if it is broken.
const START_DEADLINE_MS = 2000;

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

const SequenceHero = () => {
  const { t } = useTranslation();
  const reduced = useMedia('(prefers-reduced-motion: reduce)');
  const phone = useMedia('(max-width: 767px)');

  const reel = phone ? PHONE_CLIPS : CLIPS;
  const lastIndex = reel.length - 1;

  const videos = React.useRef([]);
  const [index, setIndex] = React.useState(0);
  const [started, setStarted] = React.useState(false);
  const [settled, setSettled] = React.useState(false);
  const [failed, setFailed] = React.useState(false);
  // How far ahead the browser may fetch. Clip 2 is not allowed to compete
  // with clip 1 for bandwidth while clip 1 is the thing on screen.
  const [armed, setArmed] = React.useState(0);

  // Crossing the phone breakpoint swaps the reel for a different file, so the
  // run starts over rather than resuming into an element that no longer
  // exists. `failed` is deliberately NOT reset: a connection that could not
  // deliver clip 1 will not do better because the window was resized.
  //
  // NOTE: this deliberately does NOT clear `videos.current`. Ref callbacks run
  // at commit, before effects, so wiping the array here left the effect below
  // with nothing to watch and the two-second deadline never armed at all — a
  // stalled clip 1 sat on its poster forever instead of falling through to the
  // end card. Caught by delaying the clip requests by 8s in the capture rig.
  // React nulls the stale indices itself when the reel shortens.
  React.useEffect(() => {
    setIndex(0);
    setStarted(false);
    setSettled(false);
    setArmed(0);
  }, [phone, reduced]);

  const showStill = reduced || failed || (phone && settled);

  React.useEffect(() => {
    if (showStill) return undefined;
    const first = videos.current[0];
    if (!first) return undefined;
    playWhenAllowed(first);
    const bail = window.setTimeout(() => {
      // Read the element rather than a state flag: `started` here would be
      // whatever it was when this effect ran, which is always false.
      if (!first.currentTime) setFailed(true);
    }, START_DEADLINE_MS);
    return () => window.clearTimeout(bail);
  }, [showStill, phone]);

  const handlePlaying = (i) => () => {
    if (i === 0) setStarted(true);
    setArmed((far) => Math.max(far, i + 1));
  };

  const handleEnded = (i) => () => {
    if (i >= lastIndex) {
      setSettled(true);
      return;
    }
    setIndex(i + 1);
    const next = videos.current[i + 1];
    if (next) {
      next.currentTime = 0;
      playWhenAllowed(next);
    }
  };

  return (
    <div className="hv2-blocks hv2-seq" data-testid="home-preview-sequence">
      {!showStill &&
        reel.map((clip, i) => (
          <video
            key={clip.mp4}
            ref={(el) => {
              videos.current[i] = el;
            }}
            className="hv2-seq-clip"
            style={{ opacity: index === i ? 1 : 0 }}
            // muted and playsInline are what make autoplay permissible at
            // all; playWhenAllowed writes the muted ATTRIBUTE too, because
            // React only ever sets the property and the mobile policy reads
            // the attribute.
            autoPlay={i === 0}
            muted
            playsInline
            preload={i === 0 ? (phone ? 'none' : 'auto') : armed >= i ? 'auto' : 'none'}
            poster={clip.poster}
            aria-hidden="true"
            onPlaying={handlePlaying(i)}
            onEnded={handleEnded(i)}
            onError={() => setFailed(true)}
          >
            <source src={clip.webm} type="video/webm" />
            <source src={clip.mp4} type="video/mp4" />
          </video>
        ))}

      {/* The poster sits ON TOP of the video and fades out once it is
          genuinely running, rather than the video being transparent until
          then. Safari can refuse to autoplay a video it considers not
          visible, so hiding the video to hide its paused frame risks causing
          the very refusal it was meant to paper over. Covering it instead
          leaves the video fully visible to the autoplay policy throughout,
          and nobody ever sees a paused frame. It is clip 1's own frame zero,
          pulled from the encoded file rather than the source, so the swap
          from poster to first frame is not a swap at all. */}
      {!showStill && (
        <div
          className="hv2-seq-poster"
          style={{ backgroundImage: `url('${CLIPS[0].poster}')`, opacity: started ? 0 : 1 }}
          aria-hidden="true"
        />
      )}

      {showStill && (
        <div
          className="hv2-seq-poster hv2-seq-end"
          style={{ backgroundImage: `url('${END_CARD}')`, opacity: 1 }}
          aria-hidden="true"
        />
      )}

      {/* Not composited into the mp4: crisp at any DPR, and the wordmark is
          real text, so it takes the RTL heading font from --font-head and a
          screen reader can read it. */}
      <div className={`hv2-seq-mark${settled || showStill ? ' is-in' : ''}`}>
        <img src={logoMark} alt="" aria-hidden="true" />
        <span>{t('home.v2.hero.wordmark', 'MyIsraelRental')}</span>
      </div>
    </div>
  );
};

export default SequenceHero;
