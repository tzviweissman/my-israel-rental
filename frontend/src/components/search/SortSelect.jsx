import React from 'react';

/**
 * Result-ordering control, shared by /stays and /properties.
 *
 * A native <select> on purpose: one tap on mobile, keyboard- and
 * screen-reader-accessible without any extra work, and it mirrors correctly
 * in RTL for free — which a custom dropdown in this codebase has repeatedly
 * not done.
 */

// These strings are the URL values too, so they end up in links people share.
// Keep them stable; the backend `?sort=` param accepts the same vocabulary.
export const SORT_NEWEST = 'newest';
export const SORT_PRICE_ASC = 'price_asc';
export const SORT_PRICE_DESC = 'price_desc';
export const SORT_NEAREST = 'nearest';
export const SORT_KEYS = [SORT_NEWEST, SORT_PRICE_ASC, SORT_PRICE_DESC, SORT_NEAREST];

/** Coerce an untrusted URL value to a known key, or '' for "use the default". */
export const parseSort = (raw) => (SORT_KEYS.includes(raw) ? raw : '');

const SortSelect = ({ value, onChange, allowNearest = false, t, testid = 'sort-select' }) => (
  <label className="flex items-center gap-2 text-sm">
    <span className="text-gray-500 hidden sm:inline">{t('stays.sortBy', 'Sort')}</span>
    <select
      value={value}
      onChange={(e) => onChange(e.target.value)}
      className="rounded-lg border border-[#E5E5E5] bg-white px-3 py-1.5 text-sm text-gray-800 focus:outline-none focus:ring-2 focus:ring-[#1E6A6A]/40"
      data-testid={testid}
    >
      <option value={SORT_NEWEST}>{t('stays.sortNewest', 'Newest')}</option>
      <option value={SORT_PRICE_ASC}>{t('stays.sortPriceAsc', 'Price: low to high')}</option>
      <option value={SORT_PRICE_DESC}>{t('stays.sortPriceDesc', 'Price: high to low')}</option>
      {/* Only offered while an address search is active — without coordinates
          there is no distance to sort by, and an option that silently does
          nothing is worse than one that isn't there. */}
      {allowNearest && (
        <option value={SORT_NEAREST}>{t('stays.sortNearest', 'Nearest')}</option>
      )}
    </select>
  </label>
);

export default SortSelect;
