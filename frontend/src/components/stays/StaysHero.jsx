/**
 * StaysHero — the dark photo band at the top of /stays, from
 * stays-preview.html's `.band`.
 *
 * The global nav is `position: fixed` and floats over this band, which is
 * the whole point of the glass treatment: the bubbles read as glass only
 * when there is a photo behind them. That means /stays must NOT pad its
 * page wrapper by `--nav-h` the way the other pages do — the band starts
 * at y=0 and `.stays-band-head` carries the nav's height as padding
 * instead. See App.css.
 *
 * SEO landing routes (/kosher-stays-in-israel and friends) pass their own
 * `heroTitle` / `heroLede`, which take over the band's copy. Those pages
 * exist to rank for a long-tail phrase, so their H1 has to be the
 * landing phrase — not the generic "Find your stay." Keeping one H1 per
 * page also means the band can't introduce a second one.
 */
import React from 'react';

// Same CloudFront bucket the cinematic home scenes already load from
// (see components/home/scenes.js) — this is the exact asset the preview
// specifies, not a re-pick.
const CDN = 'https://d8j0ntlcm91z4.cloudfront.net/user_3HWGlZDXVCAOoMKfZq628Ml9cM5';
const BAND_IMAGE = `${CDN}/hf_20260806_140841_dd0ae729-6af8-43e0-b4c5-15f63a29c9cc.png`;

const StaysHero = ({ landing, t }) => {
  const hasLandingCopy = Boolean(landing?.heroTitle);

  return (
    <div className="stays-band" data-testid="stays-band">
      {/* Decorative only — the headline carries the meaning, so the photo
          gets no alt text and is painted as a background rather than an
          <img> a screen reader would announce. */}
      <div
        className="stays-band-bg"
        style={{ backgroundImage: `url('${BAND_IMAGE}')` }}
        aria-hidden="true"
      />
      <div className="stays-band-shade" aria-hidden="true" />
      <div className="stays-band-head">
        {hasLandingCopy ? (
          <>
            <h1 data-testid="stays-landing-h1">{landing.heroTitle}</h1>
            {landing.heroLede && (
              <p className="mx-auto max-w-2xl" data-testid="stays-landing-lede">
                {landing.heroLede}
              </p>
            )}
          </>
        ) : (
          <>
            <h1 data-testid="stays-hero-title">
              {t('stays.heroTitle', 'Find your')}{' '}
              <span className="accent">{t('stays.heroAccent', 'stay.')}</span>
            </h1>
            <p className="mx-auto max-w-2xl">
              {t(
                'stays.heroLede',
                'Long-term, short-term and vacation rentals — direct from owners, zero service fees.',
              )}
            </p>
          </>
        )}
      </div>
    </div>
  );
};

export default StaysHero;
