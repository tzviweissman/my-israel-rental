import React, { useState, useRef, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { LOCATION_OPTIONS } from '../../../constants/locations';

/**
 * City–neighborhood combobox with type-ahead.
 *   value: e.g. "Tel Aviv - Florentin"
 *   onChange(value): called with the same combined string when picked.
 */
const LocationPicker = ({ value, onChange, required = false, testid = 'property-area-input' }) => {
  const { t } = useTranslation();
  const [search, setSearch] = useState('');
  const [open, setOpen] = useState(false);
  const ref = useRef(null);

  // Close on outside click.
  useEffect(() => {
    if (!open) return;
    const handleClickOutside = (e) => {
      if (ref.current && !ref.current.contains(e.target)) setOpen(false);
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [open]);

  const filtered = LOCATION_OPTIONS.flatMap((cityGroup) =>
    cityGroup.neighborhoods
      .filter((neighborhood) => {
        if (!search || search.trim() === '') return true;
        const s = search.toLowerCase();
        return (
          neighborhood.toLowerCase().includes(s) ||
          cityGroup.city.toLowerCase().includes(s) ||
          `${cityGroup.city} - ${neighborhood}`.toLowerCase().includes(s)
        );
      })
      .map((neighborhood) => ({
        value: `${cityGroup.city} - ${neighborhood}`,
        city: cityGroup.city,
        neighborhood,
      }))
  );

  return (
    <div className="relative" ref={ref}>
      <label className="block text-sm font-medium mb-2">{t('property.propertyLocation')}</label>
      <input
        type="text"
        value={open ? search : value || ''}
        onChange={(e) => {
          setSearch(e.target.value);
          if (e.target.value === '') onChange('');
          setOpen(true);
        }}
        onFocus={() => {
          setSearch('');
          setOpen(true);
        }}
        placeholder="Type to search location..."
        className="w-full px-4 py-2 rounded-lg border border-[#E5E5E5] focus:outline-none focus:ring-2 focus:ring-[rgb(var(--brand-primary-rgb)/<alpha-value>)]/50"
        required={required && !value}
        data-testid={testid}
      />
      {open && (
        <div className="absolute z-50 w-full mt-1 bg-white border border-gray-200 rounded-lg shadow-lg max-h-60 overflow-y-auto">
          {filtered.length === 0 ? (
            <div className="px-4 py-3 text-sm text-gray-500">No locations found</div>
          ) : (
            filtered.map((location) => (
              <div
                key={location.value}
                onClick={() => {
                  onChange(location.value);
                  setSearch('');
                  setOpen(false);
                }}
                className="px-4 py-2 hover:bg-[rgb(var(--brand-primary-rgb)/<alpha-value>)]/10 cursor-pointer text-sm transition-colors"
              >
                <span className="font-medium text-gray-700">{location.neighborhood}</span>
                <span className="text-gray-500 text-xs ms-2">({location.city})</span>
              </div>
            ))
          )}
        </div>
      )}
    </div>
  );
};

export default LocationPicker;
