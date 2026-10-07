/**
 * The owner's first featured item, large, at the top of the storefront.
 *
 * Shown only when the owner has featured something ("Feature this" in the
 * dashboard); never picked for them. The headline is the owner's own line
 * (60 characters at most), shown in the reader's language when the
 * background translation produced one, and exactly as typed otherwise.
 * The remaining featured items stay in the "Start here" row below.
 */
import React from 'react';
import { ArrowRight } from 'lucide-react';
import FitImage from '../common/FitImage';
import { getGigCover } from '../../utils/gigAvailability';
import { gigPriceParts } from '../../utils/gigPrice';
import { localizedTitle, localizedDescription } from '../../utils/gigLocale';

/** The first featured item that is still on the page, or null. */
export function firstFeatured(business) {
  const listings = business?.listings || [];
  for (const id of (business?.pinned_service_ids || []).slice(0, 3)) {
    const g = listings.find((x) => x.id === id);
    if (g) return g;
  }
  return null;
}

/** The owner's headline in the reader's language, else as typed. */
export function featuredHeadline(business, lang) {
  const text = business?.featured_headline;
  if (!text) return '';
  const source = business.featured_headline_lang || 'en';
  return lang === source ? text : (business.featured_headline_translated || text);
}

export default function FeaturedHero({ business, t, i18n, onOpen }) {
  const gig = firstFeatured(business);
  if (!gig) return null;
  const lang = String(i18n.language || 'en').split('-')[0];
  const headline = featuredHeadline(business, lang);
  const title = localizedTitle(gig, i18n);
  const desc = (localizedDescription(gig, i18n) || '').trim();
  const price = gigPriceParts(gig);
  // No photo: no image half. A big placeholder block reads as an empty
  // page; the words carry the card instead, on a quiet accent band.
  const cover = getGigCover(gig);
  return (
    <section className="mt-6" aria-label={t('featured.label', 'Featured')} data-testid="featured-hero">
      <button type="button" onClick={() => onOpen(gig)}
        className={`group w-full text-start rounded-3xl overflow-hidden border bg-white grid ${cover ? 'md:grid-cols-[1.15fr_1fr]' : ''} shadow-[0_18px_44px_-24px_rgba(17,24,39,.35)] transition-transform hover:-translate-y-0.5`}
        style={{ borderColor: 'var(--brand-border)', ...(cover ? {} : { borderInlineStart: '6px solid var(--gold)' }) }}>
        {cover && (
          <div className="relative aspect-[16/10] md:aspect-auto md:min-h-[320px]">
            <FitImage src={cover} name={title} category={gig.category} className="absolute inset-0" />
          </div>
        )}
        <div className="p-6 md:p-8 flex flex-col justify-center gap-3">
          <span className="text-xs font-bold uppercase tracking-[0.14em]" style={{ color: 'var(--gold)' }}>
            {t('featured.kicker', 'Featured')}
          </span>
          {headline && (
            <p className="text-2xl md:text-3xl leading-tight font-semibold" dir="auto"
              style={{ fontFamily: 'var(--font-head)', color: 'var(--ink)' }} data-testid="featured-headline">
              {headline}
            </p>
          )}
          <h2 className={headline ? 'text-base font-semibold' : 'text-2xl md:text-3xl leading-tight font-semibold'} dir="auto"
            style={{ fontFamily: headline ? undefined : 'var(--font-head)', color: 'var(--ink)' }}>
            {title}
          </h2>
          {desc && <p className="text-sm line-clamp-3" style={{ color: 'var(--brand-muted)' }} dir="auto">{desc}</p>}
          <div className="mt-2 flex flex-wrap items-center gap-4">
            <span className="text-lg font-bold" style={{ color: 'var(--ink)' }} data-testid="featured-price">
              {price.quote
                ? t('services.askForQuote', 'Ask for a quote')
                : <>{price.from && <span style={{ color: 'var(--brand-muted)' }}>{t('services.from', 'from')} </span>}{price.text}</>}
            </span>
            <span className="inline-flex items-center gap-1.5 px-5 py-2.5 rounded-full text-sm font-bold"
              style={{ background: 'var(--action)', color: 'var(--action-ink)' }}>
              {t('featured.see', 'See details')} <ArrowRight size={15} className="rtl:rotate-180" aria-hidden="true" />
            </span>
          </div>
        </div>
      </button>
    </section>
  );
}
