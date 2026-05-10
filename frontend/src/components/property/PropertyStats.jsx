import React from 'react';
import { useTranslation } from 'react-i18next';
import { Bed, Bath, Home as HomeIcon, Building2, Users } from 'lucide-react';

/**
 * Stat-card grid for property details: bedrooms / bathrooms / sqm / floor /
 * porches / max guests. Pure presentational. Each card only renders when
 * the underlying field has a meaningful value.
 */
const PropertyStats = ({ property }) => {
  const { t } = useTranslation();
  return (
    <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
      {property.bedrooms && (
        <div className="bg-white p-4 rounded-xl border border-[#E5E5E5]">
          <div className="flex items-center gap-2 mb-1">
            <Bed size={20} style={{ color: '#D4AF37' }} />
            <span className="text-sm text-gray-600">{t('property.bedrooms')}</span>
          </div>
          <p className="text-2xl font-bold">{property.bedrooms}</p>
        </div>
      )}
      {property.bathrooms && (
        <div className="bg-white p-4 rounded-xl border border-[#E5E5E5]">
          <div className="flex items-center gap-2 mb-1">
            <Bath size={20} style={{ color: '#D4AF37' }} />
            <span className="text-sm text-gray-600">{t('property.bathrooms')}</span>
          </div>
          <p className="text-2xl font-bold">{property.bathrooms}</p>
        </div>
      )}
      {property.square_meters && (
        <div className="bg-white p-4 rounded-xl border border-[#E5E5E5]">
          <div className="flex items-center gap-2 mb-1">
            <HomeIcon size={20} style={{ color: '#D4AF37' }} />
            <span className="text-sm text-gray-600">{t('property.sqm')}</span>
          </div>
          <p className="text-2xl font-bold">{property.square_meters}</p>
        </div>
      )}
      {property.floor !== null && (
        <div className="bg-white p-4 rounded-xl border border-[#E5E5E5]">
          <div className="flex items-center gap-2 mb-1">
            <Building2 size={20} style={{ color: '#D4AF37' }} />
            <span className="text-sm text-gray-600">{t('property.floor')}</span>
          </div>
          <p className="text-2xl font-bold">{property.floor}</p>
          {property.has_elevator && (
            <p className="text-xs mt-1 font-semibold text-gray-600">
              {t('property.elevator')}
              {property.is_shabbat_elevator ? ` (${t('property.shabbatElevator')})` : ''}
            </p>
          )}
        </div>
      )}
      {property.porches > 0 && (
        <div className="bg-white p-4 rounded-xl border border-[#E5E5E5]">
          <div className="flex items-center gap-2 mb-1">
            <HomeIcon size={20} style={{ color: '#D4AF37' }} />
            <span className="text-sm text-gray-600">
              {property.porches === 1 ? t('property.porch') : t('property.porches')}
            </span>
          </div>
          <p className="text-2xl font-bold">
            {property.porches}
            {property.porch_square_meters ? (
              <span className="text-sm font-normal text-gray-500 ml-1">
                ({property.porch_square_meters} sqm)
              </span>
            ) : ''}
          </p>
          {property.sukkah_compatible && (
            <p className="text-xs mt-1" style={{ color: '#345C45', fontWeight: 600 }}>
              {t('property.sukkah')}
            </p>
          )}
        </div>
      )}
      {property.rental_type === 'vacation' && property.max_guests && (
        <div className="bg-white p-4 rounded-xl border border-[#E5E5E5]" data-testid="property-max-guests">
          <div className="flex items-center gap-2 mb-1">
            <Users size={20} style={{ color: '#D4AF37' }} />
            <span className="text-sm text-gray-600">{t('property.maxGuestsLabel', 'Max guests')}</span>
          </div>
          <p className="text-2xl font-bold">{property.max_guests}</p>
        </div>
      )}
    </div>
  );
};

export default PropertyStats;
