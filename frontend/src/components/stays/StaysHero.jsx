/**
 * StaysHero — /stays' photo band. Thin wrapper over the shared HeroBand
 * (components/common/HeroBand.jsx); everything structural lives there.
 *
 * All this adds is which photo and which copy, plus the SEO landing case:
 * routes like /kosher-stays-in-israel pass their own `heroTitle` /
 * `heroLede`, which take over the headline. Those pages exist to rank for
 * a long-tail phrase, so their H1 has to be that phrase rather than the
 * generic "Find your stay." — and a page still gets exactly one H1.
 */
import React from 'react';
import HeroBand from '../common/HeroBand';
import SITE_ASSETS from '../../lib/siteAssets';

// The same aerial the cinematic home page opens on (see
// components/home/scenes.js) — the exact asset the preview specifies, not
// a re-pick.
const BAND_IMAGE = SITE_ASSETS['scene1-aerial'];

const StaysHero = ({ landing, t }) => {
  const hasLandingCopy = Boolean(landing?.heroTitle);

  return (
    <HeroBand
      image={BAND_IMAGE}
      headline={hasLandingCopy ? landing.heroTitle : undefined}
      title={t('stays.heroTitle', 'Find your')}
      accent={t('stays.heroAccent', 'stay.')}
      lede={
        hasLandingCopy
          ? landing.heroLede
          : t(
              'stays.heroLede',
              'Long-term, short-term and vacation rentals — direct from owners, zero service fees.',
            )
      }
      headlineTestId={hasLandingCopy ? 'stays-landing-h1' : 'stays-hero-title'}
      ledeTestId={hasLandingCopy ? 'stays-landing-lede' : undefined}
      testId="stays-band"
    />
  );
};

export default StaysHero;
