import React, { useRef } from 'react';
import { ChevronLeft, ChevronRight, Film, Play } from 'lucide-react';
import { sizedImage, srcSet, videoPoster } from '../../utils/cdnImage';
import { pickFallback } from '../../utils/coverImage';
import useIsRtl from '../../hooks/useIsRtl';
import DefaultImageBadge from './DefaultImageBadge';

// No hardcoded hero fallback any more — we seed off the same property id the
// card grid used so a photo-less listing keeps the SAME placeholder when the
// visitor clicks into it. It used to be an unrelated one-off Pexels photo,
// which made the image appear to change for no reason.

/**
 * Image + video carousel with thumbnail strip. Pure presentational.
 *
 *   media: [{ type: 'image' | 'video', url: string }]
 *   currentIndex / onIndexChange — controlled by parent so deep-linking and
 *                                  back-nav can drive the gallery too.
 *   apiBase — used to resolve `/api/...` upload URLs to absolute. Pass the
 *             frontend's API constant.
 *   seed    — property id. Only used when there is no media at all, to pick
 *             the same rotating placeholder the card grid showed.
 */
const ImageGallery = ({ media, currentIndex, onIndexChange, alt, apiBase, seed }) => {
  const videoRefs = useRef({});
  const isRtl = useIsRtl();
  // In RTL: Prev sits on the right edge (start in RTL = right), with
  // an arrow that POINTS right; Next sits on the left edge (end), with
  // an arrow that points left. Logical Tailwind utilities (start-/end-)
  // handle the positioning; the icons swap explicitly.
  const PrevIcon = isRtl ? ChevronRight : ChevronLeft;
  const NextIcon = isRtl ? ChevronLeft : ChevronRight;

  const toSrc = (url) => (url.startsWith('/api') ? `${apiBase.replace('/api', '')}${url}` : url);

  const goTo = (newIdx) => {
    // Pause any video that was playing before navigating
    Object.values(videoRefs.current).forEach((v) => {
      try {
        if (v) v.pause();
      } catch {
        /* noop */
      }
    });
    onIndexChange(newIdx);
  };

  if (!media || media.length === 0) {
    const placeholder = pickFallback(seed);
    return (
      <div className="relative">
        <img
          src={sizedImage(placeholder, 1200)}
          srcSet={srcSet(placeholder, 1200)}
          sizes="(max-width: 1024px) 100vw, 1200px"
          alt={alt || ''}
          loading="lazy"
          decoding="async"
          // `cover` is fine here: this is our own placeholder art, not a
          // photo of anyone's property, and it is chosen to crop well.
          className="w-full rounded-2xl object-cover"
          style={{ height: 'min(75vw, 52vh, 520px)' }}
        />
        <DefaultImageBadge />
      </div>
    );
  }

  return (
    <div className="relative" data-testid="image-gallery">
      {/* Height is capped against the VIEWPORT, not derived from the
          column width.

          It was `aspect-[4/3]`, which on a 1130px content column resolves
          to roughly 850px — taller than a laptop screen. The thumbnail
          strip lives directly underneath, so it was always below the fold:
          to look at the second photo you scrolled down to the strip, picked
          one, then scrolled back up to see it. Every photo cost a round
          trip.

          `min` keeps the ratio honest on a phone, where 4:3 is smaller than
          the ceiling anyway and the old behaviour was already correct. The
          520px cap stops a very tall desktop window from growing the hero
          back past the strip. */}
      {/* The overlays (arrows, counter) are positioned against THIS box, not
          the whole gallery. They used to be siblings of the thumbnail strip,
          so `bottom-3` meant the bottom of the strip and `top-1/2` meant the
          middle of photo-plus-strip. Invisible while the photo was 850px
          tall and the strip was off-screen anyway; the moment the strip came
          into view the "1 / 6" counter sat on top of it. */}
      <div className="relative">
      <div
        className="overflow-hidden rounded-2xl bg-black mx-auto"
        style={{
          height: 'min(75vw, 52vh, 520px)',
          // Cap the WIDTH as well, so the box is roughly photo-shaped
          // instead of taking whatever the column happens to be.
          //
          // Height alone made it about 2.5:1 on a laptop — a letterbox
          // slot. With `contain` that meant a quarter of the frame was
          // black bars; with `cover` it meant quietly cropping the top and
          // bottom off the owner's photo. Neither is acceptable, and the
          // shape was the actual cause of both.
          //
          // 1.6 is a compromise across what listings really contain: 4:3
          // stills, 3:2 cameras and 16:9 video frames. Nothing is cropped
          // at any of them, and none of them sit in much empty space.
          maxWidth: 'calc(min(75vw, 52vh, 520px) * 1.6)',
        }}
      >
        <div
          className="flex h-full transition-transform duration-500 ease-in-out"
          style={{ transform: `translateX(-${currentIndex * 100}%)` }}
        >
          {media.map((m, idx) =>
            m.type === 'image' ? (
              <img
                key={m.url}
                src={sizedImage(toSrc(m.url), 1200)}
                srcSet={srcSet(toSrc(m.url), 1200)}
                sizes="(max-width: 1024px) 100vw, 1200px"
                alt={`${alt} - ${idx + 1}`}
                // `contain`, not `cover`. The hero box is capped against the
                // VIEWPORT, so its shape is whatever the window happens to
                // be — roughly 2.5:1 on a laptop. `cover` fills that by
                // cropping whatever does not fit, which on a 16:9 phone
                // video frame silently cut the top and bottom off: a sign
                // above the counter and an object on the floor, both gone.
                //
                // A listing photo is evidence about a property. Cropping it
                // to fit a box is the site editing what the owner showed,
                // and the renter cannot tell it happened. Letterboxing is
                // visible and honest; the black surround is already there.
                className="w-full h-full object-contain flex-shrink-0"
                data-testid={idx === currentIndex ? 'gallery-main-image' : undefined}
              />
            ) : (
              <video
                key={m.url}
                ref={(el) => {
                  videoRefs.current[idx] = el;
                }}
                src={toSrc(m.url)}
                poster={videoPoster(toSrc(m.url), 1200)}
                controls
                playsInline
                preload="metadata"
                className="w-full h-full object-contain flex-shrink-0 bg-black"
                data-testid={`gallery-video-${idx}`}
              />
            )
          )}
        </div>
      </div>
      {media.length > 1 && (
        <>
          <button
            onClick={() => goTo(currentIndex === 0 ? media.length - 1 : currentIndex - 1)}
            className="absolute start-3 top-1/2 -translate-y-1/2 bg-black/60 text-white p-2 rounded-full hover:bg-black/80 transition-colors z-10"
            data-testid="gallery-prev"
          >
            <PrevIcon size={20} />
          </button>
          <button
            onClick={() => goTo(currentIndex === media.length - 1 ? 0 : currentIndex + 1)}
            className="absolute end-3 top-1/2 -translate-y-1/2 bg-black/60 text-white p-2 rounded-full hover:bg-black/80 transition-colors z-10"
            data-testid="gallery-next"
          >
            <NextIcon size={20} />
          </button>
          <div className="absolute bottom-3 left-1/2 -translate-x-1/2 bg-black/60 text-white text-xs px-3 py-1 rounded-full pointer-events-none">
            {currentIndex + 1} / {media.length}
            {media[currentIndex]?.type === 'video' && (
              <span className="ml-2 inline-flex items-center gap-1">
                <Film size={11} /> video
              </span>
            )}
          </div>
        </>
      )}
      </div>
      {media.length > 1 && (
        <div
          className="flex gap-2 mt-3 overflow-x-auto pb-2 mx-auto"
          // Same ceiling as the photo above it, so the strip reads as
          // belonging to that image rather than to the page.
          style={{ maxWidth: 'calc(min(75vw, 52vh, 520px) * 1.6)' }}
          data-testid="gallery-thumbnails"
        >
          {media.map((m, idx) => (
            <div
              key={`thumb-${m.url}`}
              onClick={() => goTo(idx)}
              className={`relative w-20 h-14 rounded-lg cursor-pointer flex-shrink-0 transition-all overflow-hidden ${
                idx === currentIndex ? 'ring-2 ring-black opacity-100' : 'opacity-60 hover:opacity-100'
              }`}
              data-testid={`gallery-thumb-${idx}`}
            >
              {m.type === 'image' ? (
                <img
                  src={sizedImage(toSrc(m.url), 160)}
                  alt={`Thumb ${idx + 1}`}
                  className="w-full h-full object-cover"
                />
              ) : (
                <>
                  {videoPoster(toSrc(m.url), 160) ? (
                    <img
                      src={videoPoster(toSrc(m.url), 160)}
                      alt={`Video thumb ${idx + 1}`}
                      className="w-full h-full object-cover bg-black"
                    />
                  ) : (
                    <video
                      src={toSrc(m.url)}
                      preload="metadata"
                      muted
                      className="w-full h-full object-cover bg-black"
                    />
                  )}
                  <div className="absolute inset-0 flex items-center justify-center bg-black/30 pointer-events-none">
                    <Play size={18} className="text-white drop-shadow" fill="white" />
                  </div>
                </>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

export default ImageGallery;
