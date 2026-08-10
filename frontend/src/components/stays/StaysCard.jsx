/**
 * StaysCard — bordered white card for a single listing, from `.card` in
 * stays-preview.html (Phase 2b).
 *
 * Used both as a snap carousel item (default) and as a grid cell
 * (`fullWidth`) on the Stays page. Heart toggles the favorite without
 * navigating; clicking the body navigates via the parent's `onClick`.
 *
 * Two deliberate departures from the preview, both because the preview
 * is placeholder data and this renders real listings:
 *
 *   • No `★ 4.9` rating row. Nothing in this product stores a rating —
 *     not on the listing, not anywhere — so the preview's `.rate` element
 *     has no value to bind to. Printing one would be inventing a number
 *     about someone's apartment. The price row keeps its `space-between`
 *     so it still reads as a row when the right side is empty.
 *   • The photo keeps its `.ph` height of 200px, but real listings can
 *     have no photo, a video-derived cover, or a placeholder — so the
 *     badges the app already had (DefaultImageBadge / VideoCoverBadge)
 *     stay, as do the distance chip, the FX hint and the freshness
 *     stamp. The preview had no state for any of those.
 *
 * When `displayCurrency` is supplied AND differs from the listing's
 * native `currency`, an "≈ $X / night" hint renders under the headline
 * price so renters comparing budgets in their preferred currency don't
 * have to do the FX math themselves.
 */
import React from 'react';
import { useTranslation } from 'react-i18next';
import { Heart, Bed, Bath, Maximize2 } from 'lucide-react';
import { getCoverImage } from '../../utils/coverImage';
import { srcSet } from '../../utils/cdnImage';
import { areaLabel } from '../../utils/areaNames';
import { propertyTitle } from '../../utils/propertyTitle';
import { listedAgoLabel, isFreshListing } from '../../utils/listedAgo';
import DefaultImageBadge from '../property/DefaultImageBadge';
import VideoCoverBadge from '../property/VideoCoverBadge';

// Re-exported from utils/listingPrice so the card, the /stays filter and the
// /stays price sort all convert with the same rate.
import { FX_USD_TO_ILS, priceIn } from '../../utils/listingPrice';

const StaysCard = ({
  property,
  onClick,
  fullWidth = false,
  liked = false,
  onToggleLike,
  displayCurrency = null,
  // Live USD->ILS, passed down from the page so every card on a results
  // grid converts with the same number and none of them fetch it. Falls
  // back to the constant when a caller hasn't wired it through yet.
  fxRate = FX_USD_TO_ILS,
}) => {
  const { t } = useTranslation();
  const cover = getCoverImage(property.images, 400, '', property.videos, property.id);
  const propCur = property.currency || 'ILS';
  const sym = propCur === 'ILS' ? '₪' : '$';
  const price = property.rental_type === 'vacation' ? property.nightly_price : property.monthly_price;
  const unit = property.rental_type === 'vacation' ? t('stays.unitNight', 'night') : t('stays.unitMonth', 'month');
  const listedAgo = listedAgoLabel(property.created_at, t);
  const fresh = isFreshListing(property.created_at);

  let convertedHint = null;
  if (price && displayCurrency && displayCurrency !== propCur) {
    // Shared with the /stays price filter and sort so a card can't show one
    // number while the filter uses another.
    const converted = priceIn(property, displayCurrency, fxRate);
    const convSym = displayCurrency === 'ILS' ? '₪' : '$';
    convertedHint = `≈ ${convSym}${Math.round(converted).toLocaleString()}`;
  }

  // Carousel sizing — mobile keeps ~2 cards visible; tablet/desktop bumps.
  // Wider than the pre-2b widths (180/200/220) because the card now has a
  // border, 16px body padding and a meta row: at the old widths the title
  // truncated after roughly two words.
  const sizeClasses = fullWidth
    ? 'w-full'
    : 'snap-start shrink-0 w-[230px] sm:w-[250px] lg:w-[270px]';

  // The rental-type pill (`.tag`). Falls back to the raw value so a
  // rental_type the catalogue doesn't know still labels the card rather
  // than rendering an empty pill.
  const typeLabelMap = {
    'long-term': t('property.longTerm', 'Long-term'),
    'short-term': t('property.shortTerm', 'Short-term'),
    vacation: t('property.vacationType', 'Vacation'),
    storage: t('property.storageType', 'Storage'),
  };
  const typeLabel = typeLabelMap[property.rental_type] || property.rental_type;

  // `.meta` — only the facts this listing actually has. A 0-bedroom studio
  // and a listing that simply never recorded its bedroom count are
  // indistinguishable in the data, so both are omitted rather than
  // printing "0".
  //
  // lucide icons rather than the preview's 🛏/🛁/▫ emoji: PropertyCard
  // already uses Bed/Bath/Home for this exact row, and emoji render at
  // wildly different weights and sizes across Windows, Android and iOS —
  // the one place a preview's glyph choice doesn't survive contact with
  // real devices.
  const metaBits = [
    property.bedrooms > 0 && { Icon: Bed, value: property.bedrooms, key: 'bed' },
    property.bathrooms > 0 && { Icon: Bath, value: property.bathrooms, key: 'bath' },
    property.square_meters > 0 && { Icon: Maximize2, value: `${property.square_meters} m²`, key: 'sqm' },
  ].filter(Boolean);

  // Matches the Stays grid (2 → 6 columns) in `fullWidth` mode and the fixed
  // carousel widths above otherwise, so the browser picks the smallest
  // Cloudinary variant it can get away with.
  const imgSizes = fullWidth
    ? '(max-width: 640px) 50vw, (max-width: 768px) 33vw, (max-width: 1024px) 25vw, (max-width: 1280px) 20vw, 16vw'
    : '(max-width: 640px) 180px, (max-width: 1024px) 200px, 220px';

  return (
    <div
      onClick={onClick}
      role="button"
      tabIndex={0}
      onKeyDown={(e) => { if (e.key === 'Enter') onClick?.(); }}
      className={`${sizeClasses} stays-card text-left group`}
      data-testid={`stays-card-${property.id}`}
    >
      {/* `.ph` — the preview's flat 200px. The card no longer clips the
          photo with its own radius: `.stays-card` has overflow:hidden, so
          the photo inherits the card's 18px top corners. */}
      <div className="relative w-full h-[200px] bg-gray-100 overflow-hidden">
        {/*
         * Real <img> rather than a CSS background-image: `loading="lazy"` only
         * works on img/iframe, and the Stays grid mounts the entire filtered
         * result set (300+ cards) at once — as a background it fired 300+
         * simultaneous image requests on load. `decoding="async"` keeps the
         * decode off the main thread. Same treatment as PropertyCard.jsx.
         * Absolute inset-0 + object-cover reproduces `background-size: cover;
         * background-position: center` pixel-for-pixel, and keeping the img
         * first in DOM order leaves the badges/heart painting above it.
         */}
        <img
          src={cover.url}
          srcSet={srcSet(cover.url, 400)}
          sizes={imgSizes}
          alt={property.title || ''}
          loading="lazy"
          decoding="async"
          className="absolute inset-0 w-full h-full object-cover"
        />
        {/* `.tag` — rental type. Sits at top/inset-start, which is where
            the two cover badges also sit, so it renders only when the
            photo is a real one and there is no badge to collide with. */}
        {!cover.isDefault && !cover.fromVideo && typeLabel && (
          <span className="stays-card-tag" data-testid={`stays-card-type-${property.id}`}>
            {typeLabel}
          </span>
        )}
        {cover.isDefault && <DefaultImageBadge />}
        {cover.fromVideo && <VideoCoverBadge />}
        <button
          type="button"
          onClick={(e) => onToggleLike?.(e)}
          className="absolute top-2 end-2 p-1.5 rounded-full hover:scale-110 active:scale-95 transition-transform"
          aria-label={liked ? t('stays.removeFromFavorites', 'Remove from favorites') : t('stays.saveToFavorites', 'Save to favorites')}
          aria-pressed={liked}
          data-testid={`stays-card-like-${property.id}`}
        >
          <Heart
            size={22}
            strokeWidth={2}
            className={liked ? 'text-[#FF385C]' : 'text-white drop-shadow-[0_1px_2px_rgba(0,0,0,0.45)]'}
            fill={liked ? '#FF385C' : 'rgba(0,0,0,0.35)'}
          />
        </button>
      </div>
      <div className="stays-card-body">
        {/* Same display layer as PropertyCard: 120 listings store the area
            as their title, which repeats the line directly below and makes
            distinct apartments look like one card duplicated.

            `h4` per the preview — it is not a section heading, it labels a
            card inside a list, so it must not outrank the page's own H1. */}
        <h4 className="text-gray-900 truncate">
          {propertyTitle(property, t)}
        </h4>
        <p className="stays-card-loc truncate">
          {/* `area` is a raw DB string — localise it (and normalise the
              stored spelling variants) via utils/areaNames. Unknown areas
              render exactly as the host typed them. */}
          {areaLabel(property.area, t)}
          {/* Distance chip — only when the parent has stamped
              `distance_km` (i.e. renter picked an address). Colored
              teal so it reads as an actionable data point rather than
              just decoration; the chip auto-picks between "m" and
              "km" so 640 m stays readable and 12 km isn't over-precise. */}
          {typeof property.distance_km === 'number' && (
            <span className="ms-1 inline-flex items-center gap-0.5 text-[10px] text-[var(--brand-primary)] font-semibold">
              · {property.distance_km < 1
                ? `${Math.round(property.distance_km * 1000)} m`
                : `${property.distance_km.toFixed(property.distance_km < 10 ? 1 : 0)} km`}
            </span>
          )}
        </p>
        {/* `.meta` — bed / bath / m². Hidden from assistive tech as a
            group and re-announced as plain text, because "🛏 2 🛁 1" read
            aloud icon-by-icon is noise. */}
        {metaBits.length > 0 && (
          <div className="stays-card-meta" data-testid={`stays-card-meta-${property.id}`}>
            {metaBits.map(({ Icon, value, key }) => (
              <span key={key} className="inline-flex items-center gap-1">
                <Icon size={13} aria-hidden="true" />
                {value}
              </span>
            ))}
          </div>
        )}
        {price ? (
          <>
            <div className="stays-card-price">
              <span className="stays-card-amt">
                {sym}{price.toLocaleString()}
                <span className="unit"> / {unit}</span>
              </span>
            </div>
            {convertedHint && (
              <p className="text-[11px] text-gray-400 mt-0.5" data-testid={`stays-card-fx-${property.id}`}>
                {convertedHint} / {unit}
              </p>
            )}
          </>
        ) : (
          /* Same row slot as a real price, so a card without one lines up
             with its neighbours in the grid instead of sitting 11px high. */
          <div className="stays-card-price">
            <span className="text-[13px] font-semibold text-gray-400">
              {t('stays.priceOnRequest', 'Price on request')}
            </span>
          </div>
        )}
        {/* Freshness. Good listings here go within hours, so how recently
            something was posted is among the first things a renter wants.
            Rendered only when the listing actually has a usable timestamp —
            claiming "Listed today" for an undated listing would be worse
            than saying nothing. */}
        {listedAgo && (
          <p
            className={`text-[11px] mt-0.5 ${fresh ? 'text-[var(--brand-primary)] font-semibold' : 'text-gray-400'}`}
            data-testid={`stays-card-listed-${property.id}`}
          >
            {listedAgo}
          </p>
        )}
      </div>
    </div>
  );
};

export default StaysCard;
