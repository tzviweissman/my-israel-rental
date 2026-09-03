import React from 'react';
import { Award, Zap } from 'lucide-react';
import StarRating from './StarRating';
import OfferBadge from './OfferBadge';
import FitImage from '../common/FitImage';
import { localizedTitle, localizedDescription } from '../../utils/gigLocale';
import { isAvailableNow, getGigCover } from '../../utils/gigAvailability';
import { gigPriceParts } from '../../utils/gigPrice';
import { prettyArea } from '../../utils/areaNames';
import { serviceFacts } from '../../utils/serviceFacts';
import { Clock, Check } from 'lucide-react';

const GOLD = 'var(--gold)';

/**
 * One service, in one of two shapes (spec B8 + C2).
 *
 * Lifted out of Services.jsx, where it was a local GigCard, because the
 * business page needed the same card and both specs say the same thing:
 * the list row is a VARIANT of this component, not a second one. A
 * duplicate would drift the first time somebody restyled one of them.
 *
 *   variant="grid"  the square card the services board has always used,
 *                   moved here byte-for-byte so nothing about it changes
 *   variant="list"  a compact row: 96px thumbnail, title, one truncated
 *                   description line, price
 *
 * The row exists because a business with fifteen services becomes an
 * endless wall of squares. Six to eight rows fit one phone screen where
 * two cards would, and the rhythm repeats identically down the page, so
 * nothing looks arbitrary. 96px rather than the 72 a WhatsApp catalog
 * uses: 72px of a sourdough loaf is a brown blob.
 */
export default function ServiceCard({ gig, onClick, variant = 'grid', i18n, t }) {
  if (variant === 'list') {
    return <ServiceRow gig={gig} onClick={onClick} i18n={i18n} t={t} />;
  }
  return <ServiceGridCard gig={gig} onClick={onClick} i18n={i18n} t={t} />;
}

// --- grid: the original card, unchanged ---
const ServiceGridCard = ({ gig, onClick, i18n, t }) => {
  const cover = getGigCover(gig);
  const price = gigPriceParts(gig);
  const bucket = gig.provider?.response_bucket;
  const availableNow = isAvailableNow(gig);
  return (
    <button
      onClick={onClick}
      // `w-full` is load-bearing: a <button> is inline-block, so when it
      // is not itself the grid item (the admin featuring toggle wraps it
      // in a positioned div) it shrinks to its content and the cards
      // overlap. Harmless when it IS the grid item.
      //
      // S1 — the card is a SURFACE now. It used to be a bare button: an
      // image div and some text, no background, border or shadow. Where
      // there was a photo the photo was the card; where there wasn't,
      // there was nothing to see at all. Matches the Stays cards.
      className="svc-card text-left group w-full h-full flex flex-col"
      data-testid={`services-gig-${gig.id}`}
    >
      <div className="relative aspect-square w-full rounded-xl overflow-hidden">
        {/* C8 — a real <img> rather than a CSS background, because only
            an <img> can be lazy. A background-image is fetched as soon as
            the element exists, so a business with twenty-five services
            pulled twenty-five photos before the reader saw the second
            row. */}
        {/* S2 — a designed cover instead of a grey box reporting an
            absence. The old placeholder was #EDE7DA on a #EFE9DC page:
            two values apart per channel, invisible.
            SafeImage covers the third case: a URL that exists but no
            longer loads, which used to render as a torn-page glyph. */}
        <FitImage
          src={cover}
          name={gig.provider?.name || localizedTitle(gig, i18n)}
          category={gig.category}
          loading="lazy"
          decoding="async"
          className="absolute inset-0"
        />
        {/* An offer outranks the top-rated pill for this corner: it is the
            reason someone stops on this card, and two pills stacked in one
            corner is how neither gets read. */}
        {gig.discount?.percent ? (
          <span className="absolute top-2 start-2">
            <OfferBadge discount={gig.discount} testId={`gig-offer-${gig.id}`} />
          </span>
        ) : null}
        {/* Top-Rated overlay pill */}
        {gig.is_top_rated && !gig.discount?.percent && (
          <span
            className="absolute top-2 start-2 inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wide shadow"
            style={{ background: GOLD, color: 'var(--brand-primary)' }}
            data-testid={`gig-top-rated-${gig.id}`}
          >
            <Award size={10} />
            {t('services.topRated', 'Top rated')}
          </span>
        )}
        {/* Available-now chip — only for appointment gigs whose weekly
            hours include the current wall-clock. Positioned top-right so
            it never collides with the top-rated pill (top-left) or the
            response-time chip (bottom-right). */}
        {availableNow && (
          <span
            className="absolute top-2 end-2 inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wide shadow bg-emerald-500 text-white"
            data-testid={`gig-available-now-${gig.id}`}
          >
            <span className="w-1.5 h-1.5 rounded-full bg-white animate-pulse" />
            {t('services.availableNow', 'Available now')}
          </span>
        )}
        {/* Response-time chip */}
        {bucket && (
          <span
            className="absolute bottom-2 end-2 inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold bg-white/95 text-emerald-700 shadow"
            data-testid={`gig-response-${gig.id}`}
          >
            <Zap size={10} />
            {bucket === '1h'
              ? t('services.replies1h', 'Replies in 1h')
              : t('services.replies24h', 'Replies in 24h')}
          </span>
        )}
      </div>
      <p className="font-semibold text-sm text-gray-900 truncate mt-2">
        {localizedTitle(gig, i18n)}
      </p>
      <p className="text-xs text-[var(--brand-muted)] truncate">
        {/* areaLabel, not the raw field: `area` is a stored slug, so this
            line printed "· tel-aviv" at the reader — lower-case, hyphen
            and all — on a page meant to look considered. The helper also
            returns the Hebrew name under RTL. */}
        {gig.provider?.name}{gig.area ? ` · ${prettyArea(gig.area, t)}` : ''}
        {typeof gig.distance_km === 'number' && (
          <span className="ms-1 inline-flex items-center gap-0.5 text-[10px] text-[var(--brand-primary)] font-semibold">
            · {gig.distance_km < 1
              ? `${Math.round(gig.distance_km * 1000)} m`
              : `${gig.distance_km.toFixed(gig.distance_km < 10 ? 1 : 0)} km`}
          </span>
        )}
      </p>
      {(gig.rating_count > 0) && (
        <div className="mt-0.5">
          <StarRating value={gig.rating_avg || 0} count={gig.rating_count} size={12} testidPrefix={`gig-stars-${gig.id}`} />
        </div>
      )}
      {/* C7 — a price line is always rendered. A blank where a number
          should be reads as a broken card. */}
      <p className="text-xs mt-0.5 text-gray-900">
        {price.quote ? (
          <span className="text-[var(--brand-muted)]">{t('services.askForQuote', 'Ask for a quote')}</span>
        ) : (
          <>
            {price.from && <span className="text-[var(--brand-muted)]">{t('services.from', 'from')} </span>}
            <span className="font-semibold">{price.text}</span>
          </>
        )}
      </p>
    </button>
  );
};


// --- list: the compact row ---
const ServiceRow = ({ gig, onClick, i18n, t }) => {
  const cover = getGigCover(gig);
  const price = gigPriceParts(gig);
  const desc = (localizedDescription(gig, i18n) || '').trim();
  // What a customer needs before they will ask: how long, and what is in
  // it. Both come off the owner's own tiers, and both are omitted entirely
  // when the owner has not said — an invented duration is worse than none.
  const facts = serviceFacts(gig, t);
  return (
    <button
      onClick={onClick}
      className="svc-card text-start group w-full flex items-center gap-3 p-2.5"
      data-testid={`services-gig-${gig.id}`}
    >
      {/* Same 96px square whether or not there is a photo, so the column
          of titles beside it stays on one ladder. */}
      <div className="relative w-24 h-24 shrink-0 rounded-xl overflow-hidden">
        {/* SafeImage, not <img>: a dead URL used to render the browser's
            torn-page glyph on a page a business shares with its own
            customers. It falls back to the same designed placeholder the
            no-photo case uses. */}
        <FitImage
          src={cover}
          name={gig.provider?.name || localizedTitle(gig, i18n)}
          category={gig.category}
          loading="lazy"
          decoding="async"
          className="absolute inset-0"
        />
      </div>

      <div className="min-w-0 flex-1">
        <p className="font-semibold text-sm text-gray-900 truncate">
          {localizedTitle(gig, i18n)}
        </p>
        {/* Exactly one line, always truncated: a row that grows to fit
            its description breaks the rhythm the list depends on. */}
        {desc && (
          <p className="text-xs text-[var(--brand-muted)] truncate mt-0.5">{desc}</p>
        )}
        {/* One quiet line of fact under the description. Deliberately not
            a second description: a duration and a count are scannable
            down a column, a sentence is not. */}
        {(facts.duration || facts.includes.length > 0) && (
          <p className="mt-1 flex items-center gap-2.5 text-[11px] flex-wrap"
             style={{ color: 'var(--brand-muted)' }}
             data-testid={`gig-facts-${gig.id}`}>
            {facts.duration && (
              <span className="inline-flex items-center gap-1">
                <Clock size={11} aria-hidden="true" />{facts.duration}
              </span>
            )}
            {facts.includes.length > 0 && (
              <span className="inline-flex items-center gap-1 min-w-0">
                <Check size={11} aria-hidden="true" className="shrink-0" />
                <span className="truncate">
                  {facts.includes.length === 1
                    ? facts.includes[0]
                    : t('serviceFacts.includesN', {
                        defaultValue: '{{first}} +{{n}} more',
                        first: facts.includes[0],
                        n: facts.includes.length - 1,
                      })}
                </span>
              </span>
            )}
          </p>
        )}
        {gig.rating_count > 0 && (
          <div className="mt-1">
            <StarRating value={gig.rating_avg || 0} count={gig.rating_count} size={11} testidPrefix={`gig-stars-${gig.id}`} />
          </div>
        )}
      </div>

      {/* Price pinned to the end so the eye can ladder down the column
          comparing, which is the one thing a long list is good at. */}
      <p className="text-sm shrink-0 ps-2 text-gray-900 text-end">
        {price.quote ? (
          <span className="text-[var(--brand-muted)] text-xs">{t('services.askForQuote', 'Ask for a quote')}</span>
        ) : (
          <>
            {price.from && <span className="text-[var(--brand-muted)] text-xs">{t('services.from', 'from')} </span>}
            <span className="font-semibold">{price.text}</span>
          </>
        )}
      </p>
    </button>
  );
};
