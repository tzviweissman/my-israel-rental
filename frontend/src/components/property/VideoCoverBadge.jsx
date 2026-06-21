/**
 * Overlay shown on a property card whose cover image was synthesized from
 * a video (the listing has no still photos, just a clip). Two purposes:
 *   1. Centered translucent play button — instantly tells the renter the
 *      card represents playable content, not a static photo.
 *   2. Small "Video" pill in the bottom-left so the signal survives even
 *      on tiny mobile cards where the center overlay can be missed.
 *
 * Purely presentational; rendered absolutely over the card's hero image.
 */
import React from 'react';
import { useTranslation } from 'react-i18next';
import { Play } from 'lucide-react';

const VideoCoverBadge = () => {
  const { t } = useTranslation();
  return (
    <>
      {/* Centered play button — clickable affordance, even though the whole
          card is the click target. Pointer-events disabled so it never
          intercepts the parent card's onClick. */}
      <div
        className="absolute inset-0 flex items-center justify-center pointer-events-none"
        data-testid="video-cover-play-overlay"
      >
        <div className="w-10 h-10 md:w-14 md:h-14 rounded-full bg-black/55 backdrop-blur-sm flex items-center justify-center shadow-lg ring-2 ring-white/80">
          <Play
            size={18}
            className="md:w-6 md:h-6 text-white fill-white ml-0.5"
            strokeWidth={2}
          />
        </div>
      </div>
      {/* Bottom-left "Video" pill — survives small viewports and gives a
          secondary text cue for screen-reader users via aria-label. */}
      <div
        className="absolute bottom-2 left-2 inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-black/60 backdrop-blur-sm text-white text-[10px] font-semibold uppercase tracking-wide"
        aria-label={t('property.videoCoverLabel', 'Video listing')}
        data-testid="video-cover-pill"
      >
        <Play size={10} className="shrink-0 fill-white" />
        <span>{t('property.videoLabel', 'Video')}</span>
      </div>
    </>
  );
};

export default VideoCoverBadge;
