/**
 * Seven of the eight phase-1 blocks. The eighth, `services`, is big
 * enough to have its own file.
 *
 * Every one of these is an ADAPTER, not a new component. The thing that
 * draws is the component that already draws it elsewhere on the site;
 * what this file adds is the bit that turns a bounded, typed `props`
 * object into that component's arguments, and resolves image references
 * against the business's own assets.
 *
 * That is the whole reason these eight were converted first (see the
 * phase-1 block set in docs/ai-page-builder-spec.md): they are already
 * prop-driven, already variant-shaped, or already themeable, so the
 * conversion is a mapping rather than a rewrite. A block library whose
 * first eight members had to be designed from scratch would have told us
 * nothing about whether the vocabulary is right.
 *
 * THREE RULES EVERY BLOCK HERE KEEPS:
 *
 *   1. A prop is data. Nothing here interpolates a prop into a class
 *      name, a style string or a URL.
 *   2. An unresolvable reference draws nothing. A deleted service must
 *      cost a picture, never the page.
 *   3. Headings read their face from `--pg-head-font`, never a literal
 *      family, because RTL swaps the font VARIABLE and Playfair has no
 *      Hebrew glyphs.
 */
import React, { useState } from 'react';

import HeroBand from '../common/HeroBand';
import SkylineRule from '../common/SkylineRule';
import GoodToKnow from '../marketplace/GoodToKnow';
import FeaturedProviders from '../marketplace/FeaturedProviders';
import BusinessCoverBand from '../marketplace/BusinessCoverBand';
import ImageGallery from '../property/ImageGallery';
import ContactChannels from '../marketplace/ContactChannels';
import { getGigCover } from '../../utils/gigAvailability';
import { resolveImage } from '../../utils/pageComposition';

/** Every block draws inside this, so `.pg-block + .pg-block` can own the
 *  rhythm between them and the density dial can change it in one place. */
export const BlockShell = ({ id, type, children }) => (
  <div className="pg-block" data-block-id={id} data-block-type={type} data-testid={`pg-block-${id}`}>
    {children}
  </div>
);

/* ---------------------------------------------------------------- hero
 *
 * common/HeroBand.jsx. 63 lines, not one hardcoded colour, and its three
 * existing wrappers already supply nothing but a photo and some copy -
 * which IS the {type, variant, props} shape. The least work in the repo,
 * and the reason it was converted first.
 *
 * `title` and `accent_word` stay two props because the component keeps
 * them apart on purpose: the accent is the coloured tail of the headline
 * and Hebrew emphasises a different word, so one interpolated string
 * could not be translated.
 */
export function HeroBlock({ block, ctx }) {
  const { business } = ctx;
  const p = block.props || {};
  const image = resolveImage(business, p.image, getGigCover)
    // A hero with no photo is a hero with no hero. The business's own
    // cover, then its first service's, then nothing - never a stock
    // photograph, which would imply these are their premises (P5).
    || business.cover_url
    || (business.listings || []).map(getGigCover).find(Boolean)
    || null;
  if (!image) return null;
  return (
    <div className={block.variant === 'compact' ? 'pg-hero-compact' : ''}>
      <HeroBand
        image={image}
        title={p.title || business.name || ''}
        accent={p.accent_word || ''}
        lede={p.lede || ''}
        testId={`pg-hero-${block.id}`}
        headlineTestId={`pg-hero-${block.id}-headline`}
        ledeTestId={`pg-hero-${block.id}-lede`}
        // The business's own name is already the h1 in the header above.
        // A band that brought a second one would leave a screen reader
        // announcing two page titles.
        headingLevel="h2"
      />
    </div>
  );
}

/* ---------------------------------------------------------------- rule
 *
 * common/SkylineRule.jsx. Takes its colour from the caller and hardcodes
 * nothing, so it was themeable before there was a theme. `tone` names a
 * ROLE and the renderer resolves it, which is what keeps a colour out of
 * the document.
 */
const RULE_HEIGHTS = { s: 4, m: 8, l: 12 };

export function RuleBlock({ block }) {
  const p = block.props || {};
  const color = p.tone === 'accent'
    ? 'var(--pg-accent)'
    : (p.tone === 'muted' ? 'var(--brand-muted)' : 'var(--pg-rule)');
  if (block.variant === 'hairline') {
    return (
      <div
        style={{ height: 1, background: color, opacity: 0.6 }}
        data-testid={`pg-rule-${block.id}`}
        aria-hidden="true"
      />
    );
  }
  return (
    <div data-testid={`pg-rule-${block.id}`}>
      <SkylineRule color={color} height={RULE_HEIGHTS[p.size] || 8} />
    </div>
  );
}

/* --------------------------------------------------------------- facts
 *
 * marketplace/GoodToKnow.jsx. Already all-optional and self-hiding,
 * which is P4's "a page with no photos and no prices still looks
 * deliberate" already built rather than promised. No props: every row is
 * the business's own, and a block that could reorder or hide individual
 * facts would be a way to bury a licence number.
 */
export function FactsBlock({ ctx }) {
  return <GoodToKnow business={ctx.business} />;
}

/* ----------------------------------------------------------- providers
 *
 * marketplace/FeaturedProviders.jsx. Zero hardcoded colour and it renders
 * nothing when there is nothing to feature.
 *
 * On a business page the row shows that business's own best-rated
 * services. `coords` is deliberately not passed: the component only uses
 * it to decide whether it may say "near you", and on a business page that
 * claim is about the reader's location, which this page does not know.
 */
export function ProvidersBlock({ block, ctx }) {
  const { business, t, i18n, openService } = ctx;
  const limit = Math.min(Math.max(Number(block.props?.limit) || 3, 1), 8);
  const rated = (business.listings || [])
    .filter((g) => g && typeof g.rating_avg === 'number')
    .sort((a, b) => (b.rating_avg - a.rating_avg) || ((b.rating_count || 0) - (a.rating_count || 0)))
    .slice(0, limit);
  if (rated.length === 0) return null;
  return (
    <div data-testid={`pg-providers-${block.id}`}>
      <FeaturedProviders gigs={rated} coords={null} onOpen={openService} t={t} i18n={i18n} />
    </div>
  );
}

/* --------------------------------------------------------------- cover
 *
 * marketplace/BusinessCoverBand.jsx, already accent-driven. `photo` uses
 * the business's own cover when it has one and falls back to the drawn
 * band; `tint` is the drawn band whether or not there is a photo, which
 * is a real choice for a business whose only photograph is a poor one.
 */
const COVER_HEIGHTS = { s: 'h-20 sm:h-28', m: 'h-28 sm:h-40', l: 'h-40 sm:h-56' };

export function CoverBlock({ block, ctx }) {
  const { business, accent } = ctx;
  const height = COVER_HEIGHTS[block.props?.height] || COVER_HEIGHTS.m;
  const photo = block.variant === 'photo'
    ? (business.cover_url || (business.listings || []).map(getGigCover).find(Boolean) || null)
    : null;
  return (
    <div className={`relative overflow-hidden rounded-2xl ${height}`} data-testid={`pg-cover-${block.id}`}>
      {photo ? (
        <img src={photo} alt="" className="absolute inset-0 w-full h-full object-cover" aria-hidden="true" />
      ) : (
        <BusinessCoverBand
          name={business.name}
          accent={accent}
          className="absolute inset-0"
          testid={`pg-cover-band-${block.id}`}
        />
      )}
    </div>
  );
}

/* ------------------------------------------------------------- gallery
 *
 * property/ImageGallery.jsx. No colour of its own, CDN-aware, RTL-correct
 * and already controlled by its caller, so the only thing this adapter
 * adds is the index.
 *
 * Photos are drawn whole over a blurred copy of themselves rather than
 * cropped to fit. On a listing page that is because a photo is evidence
 * about a property; here it is because it is the business's own picture
 * and the site should not silently edit what they chose to show.
 */
export function GalleryBlock({ block, ctx }) {
  const { business, apiBase } = ctx;
  const [index, setIndex] = useState(0);
  const refs = Array.isArray(block.props?.images) ? block.props.images : [];
  const media = refs
    .map((ref) => resolveImage(business, ref, getGigCover))
    .filter(Boolean)
    .map((url) => ({ type: 'image', url }));
  if (media.length === 0) return null;
  return (
    <div data-testid={`pg-gallery-${block.id}`}>
      <ImageGallery
        media={media}
        currentIndex={Math.min(index, media.length - 1)}
        onIndexChange={setIndex}
        alt={business.name}
        apiBase={apiBase}
        seed={business.id}
      />
    </div>
  );
}

/* ------------------------------------------------------------- contact
 *
 * marketplace/ContactChannels.jsx.
 *
 * ON-SITE MESSAGING ONLY, and that is not a limitation of the adapter.
 * B1 is explicit that a business page is chat-only: no phone number and
 * no email appears here or in the API behind it, so a visitor reaches
 * the business THROUGH the site. The component's other two channels are
 * driven by what the server says a GIG supports, and no composition can
 * conjure a channel the server has not offered.
 */
export function ContactBlock({ block, ctx }) {
  const { canMessage, messageBusiness } = ctx;
  if (!canMessage) return null;
  return (
    <div data-testid={`pg-contact-${block.id}`}>
      <ContactChannels
        channels={['in_platform']}
        onMessage={messageBusiness}
        testidPrefix={`pg-contact-${block.id}`}
      />
    </div>
  );
}
