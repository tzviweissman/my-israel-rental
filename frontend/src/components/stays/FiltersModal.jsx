/**
 * FiltersModal — bottom-half of the Stays search UX.
 *
 * Renders all the granular filters the search-bar pill doesn't surface:
 * Dates (mobile only), Stay type, Price range w/ ILS↔USD toggle,
 * Bedrooms, Bathrooms, Porches/Balcony, Property condition, Features
 * (Furnished + Elevator), and free-form Amenities chips.
 *
 * All filter state is owned by the Stays page — this component is a
 * controlled view layer. The footer's Apply button just closes the
 * modal; results update live via the filter chain.
 */
import React from 'react';
import { X } from 'lucide-react';

// Amenities the renter can multi-select. `Elevator` and `Balcony` live
// as first-class chips in Features / Porches instead, so they're not
// duplicated here.
export const ALL_AMENITIES = [
  'WiFi', 'Pool', 'AC', 'Kitchen', 'Parking', 'Washer', 'Dryer', 'TV',
  'Workspace', 'Pet-friendly', 'Sea view', 'Gym',
];

// Pill-chip row helper used for several filter sections. Hoisted to
// module scope so React doesn't unmount its subtree on every parent
// render (`react/no-unstable-nested-components`).
const ChipRow = ({ value, onChange, options, testidPrefix }) => (
  <div className="flex flex-wrap gap-2">
    {options.map((o) => (
      <button
        key={o.v || 'any'}
        type="button"
        onClick={() => onChange(o.v)}
        className={`px-3 py-1.5 rounded-full text-xs font-semibold border transition-colors ${
          value === o.v ? 'bg-black text-[#D4AF37] border-black' : 'bg-white text-gray-700 border-gray-200 hover:border-[#D4AF37]'
        }`}
        data-testid={`${testidPrefix}-${o.v || 'any'}`}
      >
        {o.label}
      </button>
    ))}
  </div>
);

const FiltersModal = ({
  onClose,
  priceMin, setPriceMin, priceMax, setPriceMax,
  priceCurrency, setPriceCurrency,
  bedrooms, setBedrooms,
  bathrooms, setBathrooms,
  porches, setPorches,
  condition, setCondition,
  furnished, setFurnished,
  hasElevator, setHasElevator,
  subType, setSubType,
  amenities, setAmenities,
  checkin, setCheckin, checkout, setCheckout,
  totalCount, t,
}) => {
  const toggleAmenity = (a) => {
    setAmenities((prev) => (prev.includes(a) ? prev.filter((x) => x !== a) : [...prev, a]));
  };
  const clearAll = () => {
    setPriceMin(''); setPriceMax(''); setPriceCurrency('ILS');
    setBedrooms(''); setBathrooms('');
    setPorches(''); setCondition(''); setFurnished(false); setHasElevator(false);
    setSubType(''); setAmenities([]);
    setCheckin(''); setCheckout('');
  };
  return (
    <div className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4" onClick={onClose} data-testid="stays-filters-modal">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg max-h-[90vh] overflow-hidden flex flex-col" onClick={(e) => e.stopPropagation()}>
        <div className="px-6 py-4 border-b border-gray-100 flex items-center justify-between">
          <h2 className="text-lg font-bold">{t('stays.filters', 'Filters')}</h2>
          <button onClick={onClose} className="p-2 hover:bg-gray-100 rounded-lg" data-testid="stays-filters-close">
            <X size={18} />
          </button>
        </div>
        <div className="flex-1 overflow-y-auto p-6 space-y-6">
          {/* Dates — mobile-only since the search-bar's When segment
              collapses on small screens. */}
          <div className="sm:hidden">
            <h3 className="text-sm font-bold mb-2">{t('stays.dates', 'Dates')}</h3>
            <div className="flex gap-3">
              <input
                type="date"
                value={checkin}
                onChange={(e) => setCheckin(e.target.value)}
                className="flex-1 px-3 py-2 rounded-lg border border-gray-200 text-sm focus:outline-none focus:border-[#D4AF37]"
                data-testid="stays-filter-checkin"
              />
              <input
                type="date"
                value={checkout}
                min={checkin || undefined}
                onChange={(e) => setCheckout(e.target.value)}
                className="flex-1 px-3 py-2 rounded-lg border border-gray-200 text-sm focus:outline-none focus:border-[#D4AF37]"
                data-testid="stays-filter-checkout"
              />
            </div>
          </div>

          {/* Stay type */}
          <div>
            <h3 className="text-sm font-bold mb-2">{t('stays.stayType', 'Stay type')}</h3>
            <ChipRow
              value={subType}
              onChange={setSubType}
              testidPrefix="stays-filter-subtype"
              options={[
                { v: '', label: t('stays.any', 'Any') },
                { v: 'vacation', label: t('property.vacationType', 'Vacation') },
                { v: 'short-term', label: t('property.shortTerm', 'Short-term') },
                { v: 'long-term', label: t('property.longTerm', 'Long-term') },
              ]}
            />
          </div>

          {/* Price range with currency toggle */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <h3 className="text-sm font-bold">{t('stays.priceRange', 'Price range')}</h3>
              <div
                className="flex bg-gray-100 rounded-full p-0.5 text-[11px] font-bold"
                data-testid="stays-filter-currency"
              >
                <button
                  type="button"
                  onClick={() => setPriceCurrency('ILS')}
                  className={`px-3 py-1 rounded-full transition-colors ${
                    priceCurrency === 'ILS' ? 'bg-black text-[#D4AF37]' : 'text-gray-600'
                  }`}
                  data-testid="stays-filter-currency-ils"
                >
                  ₪ ILS
                </button>
                <button
                  type="button"
                  onClick={() => setPriceCurrency('USD')}
                  className={`px-3 py-1 rounded-full transition-colors ${
                    priceCurrency === 'USD' ? 'bg-black text-[#D4AF37]' : 'text-gray-600'
                  }`}
                  data-testid="stays-filter-currency-usd"
                >
                  $ USD
                </button>
              </div>
            </div>
            <div className="flex gap-3 items-stretch">
              <div className="flex-1 flex items-center rounded-lg border border-gray-200 focus-within:border-[#D4AF37] overflow-hidden">
                <span className="ps-3 text-gray-500 text-sm select-none">
                  {priceCurrency === 'ILS' ? '₪' : '$'}
                </span>
                <input
                  type="number" placeholder={t('stays.min', 'Min')}
                  value={priceMin}
                  onChange={(e) => setPriceMin(e.target.value)}
                  className="flex-1 px-2 py-2 text-sm focus:outline-none bg-transparent"
                  data-testid="stays-filter-price-min"
                />
              </div>
              <div className="flex-1 flex items-center rounded-lg border border-gray-200 focus-within:border-[#D4AF37] overflow-hidden">
                <span className="ps-3 text-gray-500 text-sm select-none">
                  {priceCurrency === 'ILS' ? '₪' : '$'}
                </span>
                <input
                  type="number" placeholder={t('stays.max', 'Max')}
                  value={priceMax}
                  onChange={(e) => setPriceMax(e.target.value)}
                  className="flex-1 px-2 py-2 text-sm focus:outline-none bg-transparent"
                  data-testid="stays-filter-price-max"
                />
              </div>
            </div>
          </div>

          {/* Bedrooms — exact match for 1-3, 4+ collapses to >= 4. */}
          <div>
            <h3 className="text-sm font-bold mb-2">{t('stays.bedrooms', 'Bedrooms')}</h3>
            <ChipRow
              value={bedrooms}
              onChange={setBedrooms}
              testidPrefix="stays-filter-bedrooms"
              options={[
                { v: '', label: t('stays.any', 'Any') },
                { v: '1', label: '1' },
                { v: '2', label: '2' },
                { v: '3', label: '3' },
                { v: '4', label: '4+' },
              ]}
            />
          </div>

          {/* Bathrooms — min-N semantics. */}
          <div>
            <h3 className="text-sm font-bold mb-2">{t('stays.bathrooms', 'Bathrooms')}</h3>
            <ChipRow
              value={bathrooms}
              onChange={setBathrooms}
              testidPrefix="stays-filter-bathrooms"
              options={[
                { v: '', label: t('stays.any', 'Any') },
                { v: '1', label: '1+' },
                { v: '2', label: '2+' },
                { v: '3', label: '3+' },
              ]}
            />
          </div>

          {/* Porches / balconies */}
          <div>
            <h3 className="text-sm font-bold mb-2">{t('stays.porches', 'Porches / Balcony')}</h3>
            <ChipRow
              value={porches}
              onChange={setPorches}
              testidPrefix="stays-filter-porches"
              options={[
                { v: '', label: t('stays.any', 'Any') },
                { v: '1', label: '1+' },
                { v: '2', label: '2+' },
              ]}
            />
          </div>

          {/* Property condition */}
          <div>
            <h3 className="text-sm font-bold mb-2">{t('stays.condition', 'Property condition')}</h3>
            <ChipRow
              value={condition}
              onChange={setCondition}
              testidPrefix="stays-filter-condition"
              options={[
                { v: '', label: t('stays.any', 'Any') },
                { v: 'renovated', label: t('property.renovated', 'Renovated') },
                { v: 'partially_renovated', label: t('property.partiallyRenovated', 'Partially renovated') },
                { v: 'good', label: t('property.goodCondition', 'Good condition') },
              ]}
            />
          </div>

          {/* Features (furnished + elevator as toggle pills) */}
          <div>
            <h3 className="text-sm font-bold mb-2">{t('stays.features', 'Features')}</h3>
            <div className="flex flex-wrap gap-2">
              <button
                type="button"
                onClick={() => setFurnished((v) => !v)}
                className={`px-3 py-1.5 rounded-full text-xs font-semibold border transition-colors ${
                  furnished ? 'bg-black text-[#D4AF37] border-black' : 'bg-white text-gray-700 border-gray-200 hover:border-[#D4AF37]'
                }`}
                data-testid="stays-filter-furnished"
              >
                {t('property.furnished', 'Furnished')}
              </button>
              <button
                type="button"
                onClick={() => setHasElevator((v) => !v)}
                className={`px-3 py-1.5 rounded-full text-xs font-semibold border transition-colors ${
                  hasElevator ? 'bg-black text-[#D4AF37] border-black' : 'bg-white text-gray-700 border-gray-200 hover:border-[#D4AF37]'
                }`}
                data-testid="stays-filter-elevator"
              >
                {t('property.elevator', 'Elevator')}
              </button>
            </div>
          </div>

          {/* Free-form amenities */}
          <div>
            <h3 className="text-sm font-bold mb-2">{t('stays.amenities', 'Amenities')}</h3>
            <div className="flex flex-wrap gap-2">
              {ALL_AMENITIES.map((a) => (
                <button
                  key={a}
                  onClick={() => toggleAmenity(a)}
                  className={`px-3 py-1.5 rounded-full text-xs font-semibold border ${
                    amenities.includes(a) ? 'bg-[#D4AF37] text-white border-[#D4AF37]' : 'bg-white text-gray-700 border-gray-200 hover:border-[#D4AF37]'
                  }`}
                  data-testid={`stays-filter-amenity-${a.replace(/\s/g, '-')}`}
                >
                  {a}
                </button>
              ))}
            </div>
          </div>
        </div>
        <div className="px-6 py-4 border-t border-gray-100 flex items-center justify-between bg-gray-50">
          <button onClick={clearAll} className="text-sm font-semibold text-gray-600 hover:text-gray-900 underline" data-testid="stays-filters-clear">
            {t('stays.clearAll', 'Clear all')}
          </button>
          <button
            onClick={onClose}
            className="px-6 py-2 rounded-lg text-sm font-semibold text-white"
            style={{ backgroundColor: '#1E6A6A' }}
            data-testid="stays-filters-apply"
          >
            {t('stays.showCount', { count: totalCount, defaultValue: `Show ${totalCount} stays` })}
          </button>
        </div>
      </div>
    </div>
  );
};

export default FiltersModal;
