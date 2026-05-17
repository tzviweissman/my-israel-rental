import React from 'react';
import { useTranslation } from 'react-i18next';
import { Bed, Bath, Home as HomeIcon, MapPin, Building2, Heart } from 'lucide-react';
import { sizedImage } from '../../utils/cdnImage';

const FALLBACK_HERO = 'https://images.pexels.com/photos/1669799/pexels-photo-1669799.jpeg?auto=compress&cs=tinysrgb&dpr=2&h=650&w=940';

/**
 * Property card used on the /properties/<type> grid. Pure presentational —
 * the parent owns navigation, like-toggling, and FX conversion.
 */
const PropertyCard = ({ property, isLiked, onClick, onToggleLike, convertPrice, apiBase }) => {
  const { t } = useTranslation();
  const rawHero = property.images?.[0]
    ? (property.images[0].startsWith('/api')
        ? `${apiBase.replace('/api', '')}${property.images[0]}`
        : property.images[0])
    : FALLBACK_HERO;
  // Grid cards render at ~470px wide on desktop, ~360px on mobile.
  // Request 600px from Cloudinary so 2x-DPR displays stay crisp without
  // overpaying. Non-Cloudinary URLs pass through untouched.
  const heroSrc = sizedImage(rawHero, 600);
  const rentalLabelMap = {
    'long-term': t('property.longTerm'),
    'short-term': t('property.shortTerm'),
    vacation: t('property.vacationType'),
    storage: t('property.storageType'),
  };
  // Pricing display: vacation listings tagged with a holiday tag can carry
  // a lump-sum "whole holiday" price. When set, surface that instead of the
  // nightly rate so the renter immediately sees the holiday option. Tags
  // (Sukkot/Pesach) are optional metadata — a lump price alone activates.
  const hasHolidayLump =
    property.rental_type === 'vacation' &&
    property.holiday_lump_price != null &&
    property.holiday_lump_price > 0;

  const priceCurrency = hasHolidayLump
    ? (property.holiday_lump_currency || property.currency)
    : property.currency;
  const rawPrice = hasHolidayLump
    ? property.holiday_lump_price
    : property.monthly_price || property.nightly_price || 0;
  const converted = convertPrice(rawPrice, priceCurrency);

  const holidayLabelMap = {
    sukkot: t('property.perSukkot') || '/ Sukkot',
    pesach: t('property.perPesach') || '/ Pesach',
  };
  const firstTag = (property.holiday_tags || [])[0];
  const perLabel = hasHolidayLump
    ? (firstTag && holidayLabelMap[firstTag]) || (t('property.perHoliday') || '/ holiday')
    : property.rental_type === 'vacation'
      ? t('property.perNight')
      : t('property.perMonth');

  return (
    <div
      className="property-card"
      onClick={onClick}
      data-testid={`property-card-${property.id}`}
    >
      <div
        className="h-36 md:h-64 bg-gray-200 relative"
        style={{
          backgroundImage: `url(${heroSrc})`,
          backgroundSize: 'cover',
          backgroundPosition: 'center',
        }}
      >
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
        <h3 className="text-sm md:text-xl font-bold mb-1 md:mb-2 line-clamp-1">{property.title}</h3>
        <div className="flex items-center gap-2 text-gray-600 mb-2 md:mb-3">
          <MapPin size={14} className="md:w-4 md:h-4 shrink-0" />
          <span className="text-xs md:text-sm truncate">{property.area}</span>
        </div>
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
              <span>{t('property.floor')} {property.floor}</span>
            </div>
          )}
        </div>
        <div className="flex items-center justify-between">
          <div>
            <span
              className="text-base md:text-2xl font-bold"
              style={{ color: '#D4AF37' }}
              data-testid={`property-price-${property.id}`}
            >
              {property.currency === 'USD' ? '$' : '₪'}{rawPrice.toLocaleString()}
              <span className="text-[10px] md:text-sm font-normal text-gray-600">{perLabel}</span>
            </span>
            {converted && (
              <div
                className="text-xs text-gray-400 mt-0.5"
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
