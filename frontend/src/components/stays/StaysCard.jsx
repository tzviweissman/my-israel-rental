/**
 * StaysCard — flat, borderless Airbnb-style card for a single listing.
 *
 * Used both as a snap carousel item (default) and as a grid cell
 * (`fullWidth`) on the Stays page. Heart toggles the favorite without
 * navigating; clicking the body navigates via the parent's `onClick`.
 *
 * When `displayCurrency` is supplied AND differs from the listing's
 * native `currency`, an "≈ $X / night" hint renders under the headline
 * price so renters comparing budgets in their preferred currency don't
 * have to do the FX math themselves.
 */
import React from 'react';
import { useTranslation } from 'react-i18next';
import { Heart } from 'lucide-react';
import { getCoverImage } from '../../utils/coverImage';
import { srcSet } from '../../utils/cdnImage';
import { areaLabel } from '../../utils/areaNames';
import DefaultImageBadge from '../property/DefaultImageBadge';
import VideoCoverBadge from '../property/VideoCoverBadge';

// Same constant the Stays filter chain + Properties.js + backend fallback
// (utils/helpers.py) use. Keep in sync if FX strategy ever changes.
const FX_USD_TO_ILS = 3.65;

const StaysCard = ({
  property,
  onClick,
  fullWidth = false,
  liked = false,
  onToggleLike,
  displayCurrency = null,
}) => {
  const { t } = useTranslation();
  const cover = getCoverImage(property.images, 400, '', property.videos, property.id);
  const propCur = property.currency || 'ILS';
  const sym = propCur === 'ILS' ? '₪' : '$';
  const price = property.rental_type === 'vacation' ? property.nightly_price : property.monthly_price;
  const unit = property.rental_type === 'vacation' ? t('stays.unitNight', 'night') : t('stays.unitMonth', 'month');

  let convertedHint = null;
  if (price && displayCurrency && displayCurrency !== propCur) {
    let converted = price;
    if (displayCurrency === 'USD' && propCur === 'ILS') converted = price / FX_USD_TO_ILS;
    else if (displayCurrency === 'ILS' && propCur === 'USD') converted = price * FX_USD_TO_ILS;
    const convSym = displayCurrency === 'ILS' ? '₪' : '$';
    convertedHint = `≈ ${convSym}${Math.round(converted).toLocaleString()}`;
  }

  // Carousel sizing — mobile keeps ~2 cards visible; tablet/desktop bumps.
  const sizeClasses = fullWidth
    ? 'w-full'
    : 'snap-start shrink-0 w-[180px] sm:w-[200px] lg:w-[220px]';

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
      className={`${sizeClasses} bg-transparent text-left group cursor-pointer`}
      data-testid={`stays-card-${property.id}`}
    >
      <div className="relative aspect-square w-full bg-gray-100 rounded-xl overflow-hidden">
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
      <div className="pt-2 px-0.5">
        <p className="font-semibold text-sm text-gray-900 truncate">{property.title}</p>
        <p className="text-xs text-gray-500 truncate">
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
            <span className="ms-1 inline-flex items-center gap-0.5 text-[10px] text-[#1E6A6A] font-semibold">
              · {property.distance_km < 1
                ? `${Math.round(property.distance_km * 1000)} m`
                : `${property.distance_km.toFixed(property.distance_km < 10 ? 1 : 0)} km`}
            </span>
          )}
        </p>
        {price ? (
          <>
            <p className="text-xs mt-0.5 text-gray-900">
              <span className="font-semibold">{sym}{price.toLocaleString()}</span>
              <span className="text-gray-500"> / {unit}</span>
            </p>
            {convertedHint && (
              <p className="text-[11px] text-gray-400" data-testid={`stays-card-fx-${property.id}`}>
                {convertedHint} / {unit}
              </p>
            )}
          </>
        ) : (
          <p className="text-xs text-gray-400 mt-0.5">{t('stays.priceOnRequest', 'Price on request')}</p>
        )}
      </div>
    </div>
  );
};

export default StaysCard;
