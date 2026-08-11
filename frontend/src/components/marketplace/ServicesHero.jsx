/**
 * ServicesHero — /services' photo band. Thin wrapper over the shared
 * HeroBand, same as StaysHero; only the photo and the copy differ.
 */
import React from 'react';
import HeroBand from '../common/HeroBand';

// NOTE: hotlinked to Higgsfield's CDN and must be self-hosted before
// production — see the blocker in docs/redesign-and-wanted-board-prompt.md
// (Phase 4). Keep the URL in this one constant so the repoint stays a
// one-line change per file.
const CDN = 'https://d8j0ntlcm91z4.cloudfront.net/user_3HWGlZDXVCAOoMKfZq628Ml9cM5';
const BAND_IMAGE = `${CDN}/hf_20260806_140841_7194d0ec-edc0-40b5-87c2-ce574b273e13.png`;

const ServicesHero = ({ t }) => (
  <HeroBand
    image={BAND_IMAGE}
    title={t('services.heroTitle', 'Hire')}
    accent={t('services.heroAccent', 'the pros.')}
    lede={t(
      'services.heroLede',
      'Cleaners, movers, plumbers, electricians and more — reviewed, rated, zero booking fees.',
    )}
    headlineTestId="services-hero-title"
    ledeTestId="services-hero-subtitle"
    testId="services-band"
  />
);

export default ServicesHero;
