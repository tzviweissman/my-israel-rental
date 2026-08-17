/**
 * ServicesHero — /services' photo band. Thin wrapper over the shared
 * HeroBand, same as StaysHero; only the photo and the copy differ.
 */
import React from 'react';
import HeroBand from '../common/HeroBand';
import SITE_ASSETS from '../../lib/siteAssets';

const BAND_IMAGE = SITE_ASSETS['scene7-ac-pro'];

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
