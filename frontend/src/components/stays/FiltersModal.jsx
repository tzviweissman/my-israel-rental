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
import DateField from '../common/DateField';
import {
  SERVICE_CATEGORIES, serviceLabel, serviceCategoryLabel,
} from '../property/services/servicesCatalog';

// Amenity taxonomy comes from the shared services catalog so hosts and
// renters see the exact same strings — enabling exact-string match on
// `property.amenities: string[]`. `Elevator` and porches/balconies are
// filtered out here because they're surfaced as first-class chips in
// Features and Porches, so we don't want to duplicate them.
const DEDUPED_AMENITY_KEYS = new Set(['Elevator']);
export const AMENITY_CATEGORIES = SERVICE_CATEGORIES.map((c) => ({
  ...c,
  services: c.services.filter((s) => !DEDUPED_AMENITY_KEYS.has(s)),
})).filter((c) => c.services.length > 0);

// Signature "one-click" presets that bundle several catalog strings.
// These are our differentiator vs generic OTAs — no Airbnb / Booking
// exposes a "kosher kitchen + Shabbat elevator + synagogue nearby" combo.
// Keys map to translation IDs so we can localize the labels later.
export const AMENITY_PRESETS = [
  {
    id: 'observant-traveler',
    label: 'Observant traveler',
    icon: '✡',
    items: ['Kosher-certified kitchen', 'Shabbat elevator', 'Synagogue nearby', 'Mikveh nearby'],
  },
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
          value === o.v ? 'bg-black text-[var(--gold)] border-black' : 'bg-white text-gray-700 border-gray-200 hover:border-[var(--gold)]'
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
      {/* role/aria-modal sit on the PANEL, not the backdrop above it: the
          backdrop is the click-outside catcher, and naming it the dialog
          would tell a screen reader the dimmed overlay is the dialog and
          put the whole page inside it. `aria-labelledby` points at the
          heading that is already there, so the dialog announces as
          "Filters" instead of an unnamed dialog. */}
      <div
        className="bg-white rounded-2xl shadow-2xl w-full max-w-lg max-h-[90vh] overflow-hidden flex flex-col"
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-modal="true"
        aria-labelledby="stays-filters-title"
      >
        <div className="px-6 py-4 border-b border-gray-100 flex items-center justify-between">
          <h2 className="text-lg font-bold" id="stays-filters-title">{t('stays.filters', 'Filters')}</h2>
          <button
            onClick={onClose}
            className="p-2 hover:bg-gray-100 rounded-lg"
            // Icon-only button: without this it announces as just "button".
            aria-label={t('stays.closeFilters', 'Close filters')}
            data-testid="stays-filters-close"
          >
            <X size={18} aria-hidden="true" />
          </button>
        </div>
        <div className="flex-1 overflow-y-auto p-6 space-y-6">
          {/* Dates — mobile-only since the search-bar's When segment
              collapses on small screens. */}
          <div className="sm:hidden">
            <h3 className="text-sm font-bold mb-2">{t('stays.dates', 'Dates')}</h3>
            <div className="flex gap-3">
              <DateField
                value={checkin}
                onChange={setCheckin}
                className="flex-1 px-3 py-2 rounded-lg border border-gray-200 text-sm bg-white focus:outline-none focus:border-[var(--gold)]"
                testid="stays-filter-checkin"
              />
              <DateField
                value={checkout}
                onChange={setCheckout}
                min={checkin || undefined}
                className="flex-1 px-3 py-2 rounded-lg border border-gray-200 text-sm bg-white focus:outline-none focus:border-[var(--gold)]"
                testid="stays-filter-checkout"
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
                    priceCurrency === 'ILS' ? 'bg-black text-[var(--gold)]' : 'text-gray-600'
                  }`}
                  data-testid="stays-filter-currency-ils"
                >
                  ₪ ILS
                </button>
                <button
                  type="button"
                  onClick={() => setPriceCurrency('USD')}
                  className={`px-3 py-1 rounded-full transition-colors ${
                    priceCurrency === 'USD' ? 'bg-black text-[var(--gold)]' : 'text-gray-600'
                  }`}
                  data-testid="stays-filter-currency-usd"
                >
                  $ USD
                </button>
              </div>
            </div>
            <div className="flex gap-3 items-stretch">
              <div className="flex-1 flex items-center rounded-lg border border-gray-200 focus-within:border-[var(--gold)] overflow-hidden">
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
              <div className="flex-1 flex items-center rounded-lg border border-gray-200 focus-within:border-[var(--gold)] overflow-hidden">
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
                  furnished ? 'bg-black text-[var(--gold)] border-black' : 'bg-white text-gray-700 border-gray-200 hover:border-[var(--gold)]'
                }`}
                data-testid="stays-filter-furnished"
              >
                {t('property.furnished', 'Furnished')}
              </button>
              <button
                type="button"
                onClick={() => setHasElevator((v) => !v)}
                className={`px-3 py-1.5 rounded-full text-xs font-semibold border transition-colors ${
                  hasElevator ? 'bg-black text-[var(--gold)] border-black' : 'bg-white text-gray-700 border-gray-200 hover:border-[var(--gold)]'
                }`}
                data-testid="stays-filter-elevator"
              >
                {t('property.elevator', 'Elevator')}
              </button>
            </div>
          </div>

          {/* Amenities — categorized accordion (taxonomy shared with hosts
              via servicesCatalog.js so strings match exactly). */}
          <div data-testid="stays-filter-amenities">
            <div className="flex items-center justify-between mb-2">
              <h3 className="text-sm font-bold">{t('stays.amenities', 'Amenities')}</h3>
              {amenities.length > 0 && (
                <button
                  type="button"
                  onClick={() => setAmenities([])}
                  className="text-[11px] font-semibold text-gray-500 hover:text-gray-900 underline"
                  data-testid="stays-filter-amenities-clear"
                >
                  {t('stays.clearAmenities', `Clear (${amenities.length})`, { count: amenities.length })}
                </button>
              )}
            </div>

            {/* Signature presets — one-click bundles that no generic OTA
                surfaces (kosher kitchen + Shabbat elevator + synagogue
                + mikveh). Clicking toggles the whole set at once. */}
            <div className="mb-3 flex flex-wrap gap-1.5">
              {AMENITY_PRESETS.map((preset) => {
                const active = preset.items.every((s) => amenities.includes(s));
                return (
                  <button
                    key={preset.id}
                    type="button"
                    onClick={() => {
                      setAmenities((prev) => {
                        if (active) return prev.filter((a) => !preset.items.includes(a));
                        return Array.from(new Set([...prev, ...preset.items]));
                      });
                    }}
                    className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-[11px] font-semibold border transition-colors ${
                      active
                        ? 'bg-[var(--brand-primary)] text-white border-[var(--brand-primary)]'
                        : 'bg-white text-[var(--brand-primary)] border-[rgb(var(--brand-primary-rgb)/<alpha-value>)]/40 hover:border-[var(--brand-primary)]'
                    }`}
                    data-testid={`stays-filter-preset-${preset.id}`}
                    title={preset.items.map((s) => serviceLabel(t, s)).join(' + ')}
                  >
                    <span aria-hidden="true">{preset.icon}</span>
                    {t(`stays.preset.${preset.id}`, preset.label)}
                  </button>
                );
              })}
            </div>

            {/* Selected summary strip — makes it obvious what's active
                without having to open every category. */}
            {amenities.length > 0 && (
              <div className="mb-3 flex flex-wrap gap-1.5" data-testid="stays-filter-amenities-selected">
                {amenities.map((a) => (
                  <button
                    key={a}
                    type="button"
                    onClick={() => toggleAmenity(a)}
                    className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[11px] font-semibold bg-[var(--gold)] text-white hover:bg-[#b8951f]"
                    data-testid={`stays-filter-amenity-selected-${a.replace(/[^a-z0-9]+/gi, '-').toLowerCase()}`}
                  >
                    {serviceLabel(t, a)}
                    <X size={11} />
                  </button>
                ))}
              </div>
            )}

            <div className="space-y-2">
              {AMENITY_CATEGORIES.map((cat) => {
                const selectedInCat = cat.services.filter((s) => amenities.includes(s)).length;
                return (
                  <details
                    key={cat.slug}
                    open={selectedInCat > 0}
                    className="group border border-gray-200 rounded-lg overflow-hidden"
                    data-testid={`stays-filter-amenity-cat-${cat.slug}`}
                  >
                    <summary
                      className="flex items-center justify-between cursor-pointer px-3 py-2 text-sm font-semibold hover:bg-gray-50 list-none [&::-webkit-details-marker]:hidden"
                    >
                      <span className="flex items-center gap-2">
                        <span className={`text-[11px] leading-none transition-transform ${''}`}>▸</span>
                        {serviceCategoryLabel(t, cat)}
                      </span>
                      <span className="text-[11px] font-bold text-gray-500">
                        {selectedInCat > 0 ? `${selectedInCat} / ${cat.services.length}` : cat.services.length}
                      </span>
                    </summary>
                    <div className="px-3 py-2 flex flex-wrap gap-2 border-t border-gray-100 bg-gray-50/50">
                      {cat.services.map((a) => {
                        const active = amenities.includes(a);
                        return (
                          <button
                            key={a}
                            type="button"
                            onClick={() => toggleAmenity(a)}
                            className={`px-3 py-1.5 rounded-full text-xs font-semibold border transition-colors ${
                              active
                                ? 'bg-[var(--gold)] text-white border-[var(--gold)]'
                                : 'bg-white text-gray-700 border-gray-200 hover:border-[var(--gold)]'
                            }`}
                            data-testid={`stays-filter-amenity-${a.replace(/[^a-z0-9]+/gi, '-').toLowerCase()}`}
                          >
                            {serviceLabel(t, a)}
                          </button>
                        );
                      })}
                    </div>
                  </details>
                );
              })}
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
            style={{ backgroundColor: 'var(--brand-primary)' }}
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
