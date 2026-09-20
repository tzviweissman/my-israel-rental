import React from 'react';
import { useTranslation } from 'react-i18next';
import { shownPrice, unitLabel } from '../../utils/listingPrice';
import { Bed, Bath, Home as HomeIcon, MapPin, Building2, Heart } from 'lucide-react';
import { getCoverImage } from '../../utils/coverImage';
import { srcSet } from '../../utils/cdnImage';
import { areaLabel } from '../../utils/areaNames';
import { propertyTitle } from '../../utils/propertyTitle';
import { listedAgoLabel, isFreshListing } from '../../utils/listedAgo';
import DefaultImageBadge from './DefaultImageBadge';
import VideoCoverBadge from './VideoCoverBadge';

/**
 * Property card used on the /properties/<type> grid. Pure presentational —
 * the parent owns navigation, like-toggling, and FX conversion.
 */
const PropertyCard = ({
  property, isLiked, onClick, onToggleLike, convertPrice, apiBase,
  // `holidayContext` (e.g. 'sukkot' / 'pesach') tells the card the user is
  // browsing a holiday page — switches the displayed price to the
  // holiday rate. Browsing /vacation or /all keeps the regular nightly
  // rate visible. Default null = no context (regular browsing).
  holidayContext = null,
}) => {
  const { t } = useTranslation();
  const listedAgo = listedAgoLabel(property.created_at, t);
  const fresh = isFreshListing(property.created_at);
  // Grid cards render at ~470px wide on desktop, ~360px on mobile.
  // Request 600px from Cloudinary so 2x-DPR displays stay crisp without
  // overpaying. Non-Cloudinary URLs pass through untouched.
  const { url: heroSrc, isDefault: isDefaultImage, fromVideo: isVideoCover } = getCoverImage(property.images, 600, apiBase, property.videos, property.id);
  const rentalLabelMap = {
    'long-term': t('property.longTerm'),
    'short-term': t('property.shortTerm'),
    vacation: t('property.vacationType'),
    storage: t('property.storageType'),
  };
  // The shared rule (utils/listingPrice.shownPrice), with this page's holiday
  // as context: on the Sukkot page a flat offered for Sukkot shows its Sukkot
  // price; elsewhere its everyday price, or the holiday price when that is
  // the only one it has. This card used to decide for itself, and printed
  // "per night ()" for a per-night holiday price seen outside a holiday page.
  const shown = shownPrice(property, { holiday: holidayContext || null });
  const hasAnyPrice = !!shown;
  const priceCurrency = shown?.currency || property.currency;
  const rawPrice = shown?.amount || 0;
  // Eight live listings have no price of any kind; they read as missing,
  // never as "₪0", which reads as free.
  const converted = hasAnyPrice ? convertPrice(rawPrice, priceCurrency) : null;
  const perLabel = hasAnyPrice ? ` / ${unitLabel(shown, t)}` : '';

  return (
    <div
      className="property-card"
      onClick={onClick}
      data-testid={`property-card-${property.id}`}
    >
      <div className="h-36 md:h-64 bg-gray-200 relative overflow-hidden">
        {/*
         * Native lazy-loading + srcset. Switching from CSS background-image
         * to <img loading="lazy"> means off-screen cards no longer download
         * their hero until the browser is near them — eliminates 30+
         * simultaneous full-resolution downloads on listing pages with many
         * results. `decoding="async"` keeps decode off the main thread.
         */}
        <img
          src={heroSrc}
          srcSet={srcSet(heroSrc, 600)}
          sizes="(max-width: 768px) 50vw, 33vw"
          alt={property.title || ''}
          loading="lazy"
          decoding="async"
          className="absolute inset-0 w-full h-full object-cover"
        />
        {isDefaultImage && <DefaultImageBadge />}
        {isVideoCover && <VideoCoverBadge />}
        <button
          onClick={(e) => onToggleLike(e, property.id)}
          className="absolute top-2 right-2 md:top-3 md:right-3 w-8 h-8 md:w-10 md:h-10 rounded-full bg-white/90 hover:bg-white flex items-center justify-center shadow-md transition-all hover:scale-110 active:scale-95 z-10"
          data-testid={`like-btn-${property.id}`}
          style={{ display: property.isSublease ? 'none' : undefined }}
        >
          <Heart
            size={16}
            className={`md:w-5 md:h-5 transition-colors ${isLiked ? 'fill-red-500 text-red-500' : 'text-gray-500'}`}
          />
        </button>
      </div>
      <div className="p-3 md:p-6">
        {/* Localised via utils/propertyTitle: 120 listings store the area as
            their title, so the raw value repeats the line right below it and
            makes distinct apartments look like one duplicated card. */}
        <h3 className="text-sm md:text-xl font-bold mb-1 md:mb-2 line-clamp-1">
          {propertyTitle(property, t)}
        </h3>
        <div className="flex items-center gap-2 text-gray-600 mb-2 md:mb-3">
          <MapPin size={14} className="md:w-4 md:h-4 shrink-0" />
          {/* Localised via utils/areaNames — `area` is a DB value, so it
              never went through the i18n catalogue. Unmapped areas render
              exactly as stored. */}
          <span className="text-xs md:text-sm truncate">{areaLabel(property.area, t)}</span>
        </div>
        {/* Freshness stamp — see StaysCard for the reasoning. Omitted
            entirely when the listing has no usable created_at. */}
        {listedAgo && (
          <p
            className={`text-[11px] md:text-xs -mt-1 mb-2 ${fresh ? 'text-[var(--brand-primary)] font-semibold' : 'text-[var(--brand-muted)]'}`}
            data-testid={`property-card-listed-${property.id}`}
          >
            {listedAgo}
          </p>
        )}
        <div className="hidden md:flex items-center gap-4 mb-4 text-sm text-gray-700">
          {property.bedrooms > 0 && (
            <div className="flex items-center gap-1">
              <Bed size={16} />
              <span>{property.bedrooms}</span>
            </div>
          )}
          {property.bathrooms > 0 && (
            <div className="flex items-center gap-1">
              <Bath size={16} />
              <span>{property.bathrooms}</span>
            </div>
          )}
          {property.square_meters > 0 && (
            <div className="flex items-center gap-1">
              <HomeIcon size={16} />
              <span>{property.square_meters} m²</span>
            </div>
          )}
          {property.floor !== null && property.floor !== undefined && (
            <div className="flex items-center gap-1">
              <Building2 size={16} />
              <span>
                {t('property.floor')} {property.floor === 0 ? t('property.groundFloor') : property.floor}
              </span>
            </div>
          )}
        </div>
        <div className="flex items-center justify-between">
          <div>
            <span
              className="text-base md:text-2xl font-bold"
              style={{ color: 'var(--gold-text-on-light)' }}
              data-testid={`property-price-${property.id}`}
            >
              {hasAnyPrice ? (
                <>
                  {/* priceCurrency, not property.currency — the holiday rate
                      carries its own currency, so a USD holiday price on an
                      ILS listing was rendering a dollar amount behind a ₪. */}
                  {priceCurrency === 'USD' ? '$' : '₪'}{Number(rawPrice).toLocaleString()}
                  <span className="text-[10px] md:text-sm font-normal text-gray-600">{perLabel}</span>
                </>
              ) : (
                <span className="text-sm md:text-lg text-gray-500 font-semibold">
                  {/* Reuses the key StaysCard already uses (and which is
                      translated in both locales) rather than adding a second
                      spelling of the same sentence. StaysCard has always
                      handled the no-price case; this card printed ₪0. */}
                  {t('stays.priceOnRequest', 'Price on request')}
                </span>
              )}
            </span>
            {hasAnyPrice && converted && (
              <div
                className="text-xs text-[var(--brand-muted)] mt-0.5"
                data-testid={`property-converted-price-${property.id}`}
              >
                ≈ {converted.symbol}{converted.amount.toLocaleString()}{perLabel}
              </div>
            )}
          </div>
          <span
            className="hidden md:inline text-sm px-3 py-1 rounded-full"
            style={{ backgroundColor: '#E5E5E5', color: '#000000' }}
          >
            {rentalLabelMap[property.rental_type] || property.rental_type}
          </span>
        </div>
      </div>
    </div>
  );
};

export default PropertyCard;
