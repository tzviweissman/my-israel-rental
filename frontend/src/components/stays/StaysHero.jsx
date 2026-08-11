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

// Same CloudFront bucket the cinematic home scenes already load from (see
// components/home/scenes.js) — this is the exact asset the preview
// specifies, not a re-pick.
//
// NOTE: this is a hotlink to Higgsfield's CDN and must be self-hosted
// before production. See the blocker in
// docs/redesign-and-wanted-board-prompt.md (Phase 4). Keep the URL in this
// one constant so the repoint stays a one-line change.
const CDN = 'https://d8j0ntlcm91z4.cloudfront.net/user_3HWGlZDXVCAOoMKfZq628Ml9cM5';
const BAND_IMAGE = `${CDN}/hf_20260806_140841_dd0ae729-6af8-43e0-b4c5-15f63a29c9cc.png`;

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
