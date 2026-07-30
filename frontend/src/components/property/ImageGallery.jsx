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
          className="w-full aspect-[4/3] rounded-2xl object-cover"
        />
        <DefaultImageBadge />
      </div>
    );
  }

  return (
    <div className="relative" data-testid="image-gallery">
      <div className="overflow-hidden rounded-2xl bg-black">
        <div
          className="flex transition-transform duration-500 ease-in-out"
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
                className="w-full aspect-[4/3] object-cover flex-shrink-0"
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
                className="w-full aspect-[4/3] object-contain flex-shrink-0 bg-black"
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
      {media.length > 1 && (
        <div className="flex gap-2 mt-3 overflow-x-auto pb-2" data-testid="gallery-thumbnails">
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
