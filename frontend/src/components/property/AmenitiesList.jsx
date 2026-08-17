import React from 'react';
import { useTranslation } from 'react-i18next';
import {
  Home as HomeIcon, Snowflake, WashingMachine, UtensilsCrossed, DoorOpen,
  ArrowUpFromLine, ShowerHead, Warehouse, Flame, Dumbbell, Waves,
  Sparkles, Car, Wifi, Star,
} from 'lucide-react';
import { isCustomService, serviceLabel } from './services/servicesCatalog';

const ICON_MAP = {
  'Central AC / Heating': Snowflake,
  'In-unit washer and dryer': WashingMachine,
  'Dishwasher': UtensilsCrossed,
  'Walk in Closets': DoorOpen,
  'High Ceilings': ArrowUpFromLine,
  'Ensuite Bathroom': ShowerHead,
  'Storage Space': Warehouse,
  'Heated Floors': Flame,
  'Gym / Fitness center': Dumbbell,
  'Swimming pool (indoor or outdoor)': Waves,
  'Hot tub / Spa': Sparkles,
  'On-site parking (garage or lot)': Car,
  'Wi-Fi included': Wifi,
};

/**
 * 2-column amenity list with a matching lucide icon per known amenity.
 * Falls back to a Home icon for any unrecognised string.
 */
const AmenitiesList = ({ amenities }) => {
  const { t } = useTranslation();
  if (!amenities || amenities.length === 0) return null;
  return (
    <div className="bg-white p-6 rounded-2xl border border-[#E5E5E5] mb-8">
      <h2 className="text-2xl font-bold mb-4" style={{ fontFamily: 'Playfair Display' }}>
        {t('property.amenities')}
      </h2>
      <div className="grid grid-cols-2 gap-3">
        {amenities.map((amenity) => {
          // `amenity` stays the canonical stored string — it keys the icon
          // map, the custom-service test and React's list key. Only the
          // rendered text goes through serviceLabel().
          const custom = isCustomService(amenity);
          const Icon = custom ? Star : (ICON_MAP[amenity] || HomeIcon);
          return (
            <div
              key={amenity}
              className="flex items-center gap-2"
              data-testid={custom ? 'amenity-custom' : 'amenity-predefined'}
            >
              <Icon
                size={16}
                style={{ color: 'var(--gold)' }}
                fill={custom ? 'var(--gold)' : 'none'}
              />
              <span>{serviceLabel(t, amenity)}</span>
            </div>
          );
        })}
      </div>
    </div>
  );
};

export default AmenitiesList;
