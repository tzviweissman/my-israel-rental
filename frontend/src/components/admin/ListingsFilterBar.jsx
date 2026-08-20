import React from 'react';
import { Trash2, Search, Loader2, CalendarX, Briefcase, Star, Copy, Camera, DollarSign, EyeOff } from 'lucide-react';

/**
 * Search, filter chips and bulk-action buttons for the Listings tab
 * (spec A7).
 *
 * Extracted verbatim from ListingsTab — a move, not a rewrite. The prop
 * list is long because this row genuinely reads most of the tab's state;
 * every name is kept identical to the original so the markup inside did
 * not have to be touched, which is the whole reason this can be trusted
 * to behave the same.
 *
 * The filter values live in the URL (the caller owns that), so back and
 * forward still restore a filtered view.
 */
export default function ListingsFilterBar({
  t,
  searchTerm,
  setSearchTerm,
  filteredProperties,
  properties,
  selectedPropIds,
  setSelectedPropIds,
  managedFilter,
  setManagedFilter,
  featuredFilter,
  setFeaturedFilter,
  quarantinedFilter,
  setQuarantinedFilter,
  rentalTypeFilter,
  setRentalTypeFilter,
  rentalTypeCounts,
  managedCount,
  featuredCount,
  quarantinedCount,
  minPrice,
  maxPrice,
  setPriceParam,
  clearPriceRange,
  bulkDelete,
  bulkSetFeatured,
  openMarkBookedModal,
  sweepDuplicates,
  sweeping,
  handleRemirrorPhotos,
  remirroring,
  handleRepairPrices,
  repairingPrices,
  setShowDuplicates,
}) {
  return (
    <div className="flex items-center gap-4 mb-6 flex-wrap">
      <div className="relative flex-1 max-w-md">
        <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
        <input
          type="text"
          value={searchTerm}
          onChange={e => setSearchTerm(e.target.value)}
          placeholder={t('admin.searchListings')}
          className="w-full ps-9 pe-4 py-2 rounded-lg border border-[#E5E5E5] text-sm focus:outline-none focus:ring-2 focus:ring-black/20"
          data-testid="listings-search-input"
        />
      </div>
      <span className="text-sm text-gray-500">{t('admin.listingsCount', { count: filteredProperties.length })}</span>
      <button
        onClick={() => setShowDuplicates(true)}
        className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold bg-amber-50 text-amber-700 border border-amber-200 hover:bg-amber-100"
        title="Find owners with multiple listings at the same address + rental type"
        data-testid="find-duplicates-btn"
      >
        <Copy size={14} /> Find duplicates
      </button>
      <button
        onClick={sweepDuplicates}
        disabled={sweeping}
        className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold bg-rose-50 text-rose-700 border border-rose-200 hover:bg-rose-100 disabled:opacity-50"
        title="Delete every duplicate listing in one pass — identical-fields first, then keep richest of the rest"
        data-testid="sweep-duplicates-btn"
      >
        {sweeping ? <Loader2 size={14} className="animate-spin" /> : <Trash2 size={14} />}
        {sweeping ? 'Sweeping…' : 'Sweep all duplicates'}
      </button>
      <button
        onClick={handleRemirrorPhotos}
        disabled={remirroring}
        className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold bg-sky-50 text-sky-700 border border-sky-200 hover:bg-sky-100 disabled:opacity-50"
        title="Move every listing's photos onto Cloudinary. Use after a half-finished import."
        data-testid="remirror-photos-btn"
      >
        <Camera size={14} /> {remirroring ? 'Re-mirroring…' : 'Re-mirror photos'}
      </button>
      <button
        onClick={handleRepairPrices}
        disabled={repairingPrices}
        className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold bg-amber-50 text-amber-800 border border-amber-200 hover:bg-amber-100 disabled:opacity-50"
        title="Move misplaced prices to the right field (vacation→nightly, long-term→monthly). Safe to re-run."
        data-testid="repair-prices-btn"
      >
        <DollarSign size={14} /> {repairingPrices ? 'Repairing…' : 'Repair prices'}
      </button>
      {/* Quick chip toggle: All vs "Properties I manage" */}
      <div className="inline-flex bg-white rounded-lg border border-[#E5E5E5] p-0.5 ms-1" data-testid="managed-filter">
        <button
          onClick={() => setManagedFilter('all')}
          className={`px-2.5 py-1 rounded-md text-xs font-semibold transition-colors ${managedFilter === 'all' ? 'bg-[var(--brand-primary)] text-white' : 'text-gray-600 hover:bg-gray-50'}`}
          data-testid="managed-filter-all"
        >
          All
        </button>
        <button
          onClick={() => setManagedFilter('managed')}
          className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-md text-xs font-semibold transition-colors ${managedFilter === 'managed' ? 'bg-[var(--brand-primary)] text-white' : 'text-gray-600 hover:bg-gray-50'}`}
          data-testid="managed-filter-managed"
        >
          <Briefcase size={12} /> I manage ({managedCount})
        </button>
      </div>
      {/* Quick chip toggle: show only featured listings — clicking the
          chip below restricts the table to just the ones surfaced on
          the home page. Disabled state when there's nothing featured
          so the admin doesn't get confused by an empty view. */}
      <div className="inline-flex bg-white rounded-lg border border-[#E5E5E5] p-0.5" data-testid="featured-filter">
        <button
          onClick={() => setFeaturedFilter('featured')}
          disabled={featuredCount === 0}
          className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-md text-xs font-semibold transition-colors disabled:opacity-40 disabled:cursor-not-allowed ${featuredFilter === 'featured' ? 'bg-amber-500 text-white' : 'text-gray-600 hover:bg-gray-50'}`}
          data-testid="featured-filter-on"
          title={featuredCount === 0 ? "Nothing featured yet — toggle a property's star to mark it" : 'Show only featured listings'}
        >
          <Star size={12} fill={featuredFilter === 'featured' ? 'currentColor' : 'none'} /> Featured ({featuredCount})
        </button>
      </div>
      {/* Quick chip toggle: show only quarantined listings — hidden
          from the public feed by a previous pricing auto-fix. Lets
          the admin audit what was paused and catch false positives. */}
      <div className="inline-flex bg-white rounded-lg border border-[#E5E5E5] p-0.5" data-testid="quarantined-filter">
        <button
          onClick={() => setQuarantinedFilter(quarantinedFilter === 'quarantined' ? 'all' : 'quarantined')}
          disabled={quarantinedCount === 0}
          className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-md text-xs font-semibold transition-colors disabled:opacity-40 disabled:cursor-not-allowed ${quarantinedFilter === 'quarantined' ? 'bg-rose-600 text-white' : 'text-gray-600 hover:bg-gray-50'}`}
          data-testid="quarantined-filter-on"
          title={quarantinedCount === 0 ? 'Nothing quarantined right now' : 'Show only listings hidden by the pricing auto-fix'}
        >
          <EyeOff size={12} /> Quarantined ({quarantinedCount})
        </button>
      </div>
      {/* Rental-type filter — lets the admin slice the table down to
          just Long-term / Short-term / Vacation / Storage. Combines
          with the other filters (managed, featured, search). */}
      <div className="inline-flex bg-white rounded-lg border border-[#E5E5E5] p-0.5 flex-wrap" data-testid="rental-type-filter">
        {[
          { v: 'all',        label: 'All types' },
          { v: 'long-term',  label: 'Long-term' },
          { v: 'short-term', label: 'Short-term' },
          { v: 'vacation',   label: 'Vacation' },
          { v: 'storage',    label: 'Storage' },
        ].map((opt) => {
          const count = opt.v === 'all'
            ? properties.length
            : (rentalTypeCounts[opt.v] || 0);
          const isActive = rentalTypeFilter === opt.v;
          const isEmpty = opt.v !== 'all' && count === 0;
          return (
            <button
              key={opt.v}
              onClick={() => setRentalTypeFilter(opt.v)}
              disabled={isEmpty}
              className={`px-2.5 py-1 rounded-md text-xs font-semibold transition-colors disabled:opacity-30 disabled:cursor-not-allowed ${isActive ? 'bg-[var(--brand-primary)] text-white' : 'text-gray-600 hover:bg-gray-50'}`}
              data-testid={`rental-type-${opt.v}`}
              title={isEmpty ? `No ${opt.label.toLowerCase()} listings yet` : `Show only ${opt.label.toLowerCase()}`}
            >
              {opt.label} ({count})
            </button>
          );
        })}
      </div>
      {/* Price range filter — raw numeric compare against the same
          effective price the table column shows (monthly first,
          nightly as fallback). Currency mixing is intentional. */}
      <div className="inline-flex items-center gap-1.5 bg-white rounded-lg border border-[#E5E5E5] px-2 py-1" data-testid="price-range-filter">
        <span className="text-xs font-semibold text-gray-500">Price</span>
        <input
          type="number"
          inputMode="numeric"
          min="0"
          value={minPrice}
          onChange={(e) => setPriceParam('min', e.target.value)}
          placeholder="min"
          className="w-20 px-2 py-1 rounded border border-transparent hover:border-gray-200 focus:border-[var(--brand-primary)] focus:outline-none focus:ring-1 focus:ring-[rgb(var(--brand-primary-rgb)/<alpha-value>)]/30 text-xs"
          data-testid="price-min-input"
        />
        <span className="text-xs text-gray-400">–</span>
        <input
          type="number"
          inputMode="numeric"
          min="0"
          value={maxPrice}
          onChange={(e) => setPriceParam('max', e.target.value)}
          placeholder="max"
          className="w-20 px-2 py-1 rounded border border-transparent hover:border-gray-200 focus:border-[var(--brand-primary)] focus:outline-none focus:ring-1 focus:ring-[rgb(var(--brand-primary-rgb)/<alpha-value>)]/30 text-xs"
          data-testid="price-max-input"
        />
        {(minPrice || maxPrice) && (
          <button
            type="button"
            onClick={clearPriceRange}
            className="text-[10px] uppercase tracking-wider text-gray-400 hover:text-gray-700 ms-0.5"
            data-testid="price-clear-btn"
            title="Clear price range"
          >
            clear
          </button>
        )}
      </div>
      {selectedPropIds.size > 0 && (
        <div className="flex items-center gap-2 ms-auto flex-wrap">
          <span className="text-xs font-medium text-gray-700" data-testid="selected-count">
            {t('admin.selectedCount', { count: selectedPropIds.size })}
          </span>
          <button
            onClick={() => bulkSetFeatured(true)}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-amber-500 text-white text-xs font-semibold hover:bg-amber-600"
            data-testid="bulk-feature-btn"
          >
            <Star size={14} fill="currentColor" /> {t('admin.featureSelected', 'Feature selected')}
          </button>
          <button
            onClick={() => bulkSetFeatured(false)}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-white border border-amber-500 text-amber-600 text-xs font-semibold hover:bg-amber-50"
            data-testid="bulk-unfeature-btn"
          >
            <Star size={14} /> {t('admin.unfeatureSelected', 'Unfeature selected')}
          </button>
          <button
            onClick={() => openMarkBookedModal({ mode: 'bulk' })}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-black text-white text-xs font-semibold hover:bg-gray-800"
            data-testid="bulk-mark-booked-btn"
          >
            <CalendarX size={14} /> {t('admin.markSelectedBooked')}
          </button>
          <button
            onClick={bulkDelete}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-red-500 text-white text-xs font-semibold hover:bg-red-600"
            data-testid="bulk-delete-btn"
            title={t('admin.deleteSelectedTooltip', 'Permanently delete selected listings and their related data')}
          >
            <Trash2 size={14} /> {t('admin.deleteSelected', 'Delete selected')} ({selectedPropIds.size})
          </button>
          <button
            onClick={() => setSelectedPropIds(new Set())}
            className="px-2 py-1.5 rounded-lg text-xs font-medium text-gray-600 hover:bg-gray-100"
            data-testid="clear-selection-btn"
          >
            {t('admin.clear')}
          </button>
        </div>
      )}
    </div>
  );
}
