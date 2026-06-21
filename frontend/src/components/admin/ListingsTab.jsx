import React, { useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import axios from 'axios';
import { toast } from 'sonner';
import {
  Trash2, ToggleLeft, ToggleRight, Search,
  CalendarX, CalendarCheck, Lock, Briefcase, Star, Copy, ImageOff, Camera, DollarSign,
} from 'lucide-react';
import { API } from '../../App';
import { useApiSWR } from '../../hooks/useApiSWR';
import MarkAsBookedModal from './MarkAsBookedModal';
import DuplicatesModal from './DuplicatesModal';
import BulkDeleteConfirmToast from './BulkDeleteConfirmToast';


// Backend already returns properties sorted by created_at desc, so the
// table reads newest-first. Helper used to render "5h ago" / "3d ago"
// strings on both desktop and mobile rows.
const relativeAdded = (iso) => {
  if (!iso) return '—';
  const d = typeof iso === 'string' ? new Date(iso) : iso;
  if (Number.isNaN(d.getTime())) return '—';
  const mins = Math.floor((Date.now() - d.getTime()) / 60000);
  if (mins < 1) return 'just now';
  if (mins < 60) return `${mins} min ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  const days = Math.floor(hrs / 24);
  if (days < 30) return `${days}d ago`;
  const months = Math.floor(days / 30);
  return `${months}mo ago`;
};
/**
 * Tiny cover-image thumbnail for each listing row. Falls back to a
 * placeholder tile when the property has no images so the admin can
 * still see at a glance "this listing needs photos". The image opens
 * in a new tab on click so the admin can sanity-check the full-size
 * shot without leaving the table.
 */
const CoverThumb = ({ property, size = 'md' }) => {
  const src = property.images?.[0];
  const dim = size === 'sm' ? 'w-12 h-12' : 'w-14 h-14';
  if (!src) {
    return (
      <div
        className={`${dim} rounded-md border border-gray-200 bg-gray-50 flex items-center justify-center text-gray-400 shrink-0`}
        title="No photos yet"
        data-testid={`cover-thumb-empty-${property.id}`}
      >
        <ImageOff size={14} />
      </div>
    );
  }
  return (
    <a
      href={src}
      target="_blank"
      rel="noopener noreferrer"
      className={`${dim} rounded-md overflow-hidden border border-gray-200 shrink-0 block hover:ring-2 hover:ring-[#1E6A6A]/40 transition-shadow`}
      title="Open full-size cover image"
      data-testid={`cover-thumb-${property.id}`}
      onClick={(e) => e.stopPropagation()}
    >
      <img
        src={src}
        alt={property.title || 'Cover'}
        loading="lazy"
        className="w-full h-full object-cover"
      />
    </a>
  );
};

/**
 * Super Admin → Listings tab.
 */
export const ListingsTab = ({ token, onStatsChange }) => {
  const { t } = useTranslation();
  const headers = { Authorization: `Bearer ${token}` };

  const { data: properties, refresh: fetchProperties } = useApiSWR(
    `${API}/admin/properties`, token, { initial: [] }
  );
  const [searchTerm, setSearchTerm] = useState('');
  const [showDuplicates, setShowDuplicates] = useState(false);
  // Keep filters + search in the URL so browser back/forward preserves them
  // when the admin clicks into a property and returns. Without this, the
  // filter resets to "all" because the listings tab unmounts on navigation.
  const [searchParams, setSearchParams] = useSearchParams();
  const managedFilter = searchParams.get('managed') === '1' ? 'managed' : 'all';
  const setManagedFilter = (val) => {
    const next = new URLSearchParams(searchParams);
    if (val === 'managed') next.set('managed', '1');
    else next.delete('managed');
    setSearchParams(next, { replace: true });
  };
  const featuredFilter = searchParams.get('featured') === '1' ? 'featured' : 'all';
  const setFeaturedFilter = (val) => {
    const next = new URLSearchParams(searchParams);
    if (val === 'featured') next.set('featured', '1');
    else next.delete('featured');
    setSearchParams(next, { replace: true });
  };
  // Rental-type filter — URL-synced so deep links + back/forward keep it.
  // Valid values: 'all' | 'long-term' | 'short-term' | 'vacation' | 'storage'.
  const rentalTypeFilter = searchParams.get('rt') || 'all';
  const setRentalTypeFilter = (val) => {
    const next = new URLSearchParams(searchParams);
    if (val && val !== 'all') next.set('rt', val);
    else next.delete('rt');
    setSearchParams(next, { replace: true });
  };
  // Price-range filter — URL-synced. Compares against the same effective
  // price the table renders (monthly_price ?? nightly_price). Currency
  // mixing is intentional: we match what the admin sees in the column.
  const minPrice = searchParams.get('min') || '';
  const maxPrice = searchParams.get('max') || '';
  const setPriceParam = (key, val) => {
    const next = new URLSearchParams(searchParams);
    if (val) next.set(key, val);
    else next.delete(key);
    setSearchParams(next, { replace: true });
  };
  const clearPriceRange = () => {
    const next = new URLSearchParams(searchParams);
    next.delete('min');
    next.delete('max');
    setSearchParams(next, { replace: true });
  };
  const [selectedPropIds, setSelectedPropIds] = useState(new Set());
  // Re-mirror photos: scans every listing and queues background mirroring
  // for the ones still pointing at non-Cloudinary URLs. Recovery path for
  // imports that landed but whose mirror task was killed before finishing.
  const [remirroring, setRemirroring] = useState(false);
  // Repair-prices: one-shot tool for listings whose nightly vs monthly
  // price landed in the wrong field (older imports that mapped the CSV
  // ``price`` column to monthly_price for every row, leaving vacation
  // listings showing ₪0/night). Safe to re-run — idempotent.
  const [repairingPrices, setRepairingPrices] = useState(false);

  const handleRepairPrices = async () => {
    if (!window.confirm(
      'Move misplaced prices into the right field for each listing? '
      + 'Vacation/short-term listings with only a monthly price will have it moved to nightly_price. '
      + 'Long-term listings with only a nightly price will have it moved to monthly_price. '
      + 'Safe to run multiple times.',
    )) return;
    setRepairingPrices(true);
    try {
      const res = await axios.post(`${API}/admin/properties/repair-prices`, {}, { headers });
      const d = res.data;
      if (d.total_repaired === 0) {
        toast.success('All listing prices are already in the correct field — nothing to repair.');
      } else {
        toast.success(d.message, { duration: 8000 });
      }
      fetchProperties();
    } catch (e) {
      toast.error(e.response?.data?.detail || 'Price repair failed');
    } finally {
      setRepairingPrices(false);
    }
  };

  const handleRemirrorPhotos = async () => {
    if (!window.confirm(
      'Scan every listing and re-mirror photos that are still on source URLs (not Cloudinary)? '
      + "Listings already on Cloudinary won't be touched. Listings with no photos at all will be reported "
      + 'so you can re-upload the CSV in "Sync photos" mode for those.',
    )) return;
    setRemirroring(true);
    try {
      const res = await axios.post(`${API}/admin/properties/remirror`, {}, { headers });
      const d = res.data;
      toast.success(d.message, { duration: 8000 });
      if (d.no_images > 0) {
        // Surface the listings that need a CSV re-upload in a separate toast
        // so the admin doesn't miss them in the green success message.
        toast.warning(
          `${d.no_images} listings have no photo URLs at all — re-upload the CSV with "Sync photos" mode to fix those. `
          + `Sample: ${(d.no_images_sample || []).slice(0, 3).map(x => x.title || x.id).join(', ')}`,
          { duration: 12000 },
        );
      }
      fetchProperties();
    } catch (e) {
      toast.error(e.response?.data?.detail || 'Re-mirror failed');
    } finally {
      setRemirroring(false);
    }
  };
  const [bookedModalOpen, setBookedModalOpen] = useState(false);
  // bookedTarget: null | { mode: 'single', id } | { mode: 'bulk' }
  const [bookedTarget, setBookedTarget] = useState(null);
  const [blockSaving, setBlockSaving] = useState(false);

  const notifyStatsChange = () => { if (onStatsChange) onStatsChange(); };

  // --- Row actions ---
  const togglePropertyStatus = async (propertyId) => {
    try {
      const res = await axios.put(`${API}/admin/properties/${propertyId}/status`, {}, { headers });
      toast.success(res.data.message);
      fetchProperties();
      notifyStatsChange();
    } catch (e) { toast.error('Failed to update property'); }
  };

  /**
   * Flip the "I'm managing this for the owner" flag. Pure marker — admins
   * already have full control over every property, but this lets us filter
   * the giant listings table to just the ones we're personally handling.
   */
  const toggleAdminManaged = async (propertyId) => {
    try {
      const res = await axios.put(`${API}/admin/properties/${propertyId}/managed`, {}, { headers });
      toast.success(res.data.message);
      fetchProperties();
    } catch (e) { toast.error('Failed to update managed status'); }
  };

  /**
   * Add/remove a property from the homepage Featured grid. Hits the new
   * `/admin/properties/{id}/featured` endpoint which mutates the global
   * `site_settings.featured_property_ids` array atomically — no more
   * pasting IDs into a textarea on the Settings tab.
   */
  const toggleFeatured = async (propertyId) => {
    try {
      const res = await axios.put(`${API}/admin/properties/${propertyId}/featured`, {}, { headers });
      toast.success(res.data.message);
      fetchProperties();
    } catch (e) { toast.error('Failed to update featured status'); }
  };

  /**
   * Bulk hard-delete the currently-selected properties. Backend cascades
   * cleanup across chats, bookings, admin blocks, featured list, etc.
   * Wrapped in a confirmation toast — destructive + cannot be undone.
   */
  const bulkDelete = () => {
    const ids = Array.from(selectedPropIds);
    if (ids.length === 0) {
      toast.error('No properties selected');
      return;
    }
    toast.custom((tid) => (
      <BulkDeleteConfirmToast
        tid={tid}
        ids={ids}
        t={t}
        API={API}
        headers={headers}
        setSelectedPropIds={setSelectedPropIds}
        fetchProperties={fetchProperties}
        notifyStatsChange={notifyStatsChange}
      />
    ), { duration: 12000 });
  };

  /**
   * Bulk add or remove the currently-selected properties from the
   * homepage Featured grid in a single round-trip.
   */
  const bulkSetFeatured = async (featured) => {
    const ids = Array.from(selectedPropIds);
    if (ids.length === 0) {
      toast.error('No properties selected');
      return;
    }
    try {
      const res = await axios.post(
        `${API}/admin/properties/bulk-featured`,
        { property_ids: ids, featured },
        { headers },
      );
      toast.success(res.data.message);
      setSelectedPropIds(new Set());
      fetchProperties();
    } catch (e) {
      toast.error(e.response?.data?.detail || 'Failed to update featured status');
    }
  };

  const deleteProperty = (propertyId) => {
    toast.custom((tid) => (
      <div className="bg-white rounded-xl shadow-xl border border-gray-200 p-4 w-80">
        <p className="text-sm font-semibold text-gray-800 mb-1">{t('admin.deleteListingTitle')}</p>
        <p className="text-xs text-gray-500 mb-3">{t('admin.deleteListingDesc')}</p>
        <div className="flex gap-2 justify-end">
          <button onClick={() => toast.dismiss(tid)} className="px-3 py-1.5 rounded-lg text-xs font-medium text-gray-600 hover:bg-gray-100">
            {t('admin.cancel')}
          </button>
          <button
            onClick={async () => {
              toast.dismiss(tid);
              try {
                const res = await axios.delete(`${API}/properties/${propertyId}`, { headers });
                toast.success(res.data?.message || 'Property deleted');
                fetchProperties();
                notifyStatsChange();
              } catch (e) { toast.error('Failed to delete property'); }
            }}
            className="px-3 py-1.5 rounded-lg text-xs font-semibold text-white bg-red-500 hover:bg-red-600"
            data-testid={`confirm-delete-listing-${propertyId}`}
          >
            {t('admin.deleteAction')}
          </button>
        </div>
      </div>
    ), { duration: 10000 });
  };

  // --- Mark-as-booked flow ---
  const openMarkBookedModal = (target) => {
    setBookedTarget(target);
    setBookedModalOpen(true);
  };

  const closeMarkBookedModal = () => {
    setBookedModalOpen(false);
    setBookedTarget(null);
  };

  const submitMarkBooked = async (body) => {
    if (!bookedTarget) return;
    setBlockSaving(true);
    try {
      if (bookedTarget.mode === 'single') {
        await axios.post(`${API}/admin/properties/${bookedTarget.id}/mark-booked`, body, { headers });
        toast.success('Property marked as booked');
      } else {
        const ids = Array.from(selectedPropIds);
        if (ids.length === 0) {
          toast.error('No properties selected');
          return;
        }
        const res = await axios.post(
          `${API}/admin/properties/bulk-mark-booked`,
          { ...body, property_ids: ids },
          { headers }
        );
        toast.success(res.data.message || `${ids.length} properties marked as booked`);
        setSelectedPropIds(new Set());
      }
      closeMarkBookedModal();
      fetchProperties();
    } catch (e) {
      toast.error(e.response?.data?.detail || 'Failed to mark as booked');
    } finally {
      setBlockSaving(false);
    }
  };

  const unmarkBooked = (property) => {
    const block = property.active_admin_block;
    if (!block) return;
    toast.custom((tid) => (
      <div className="bg-white rounded-xl shadow-xl border border-gray-200 p-4 w-80">
        <p className="text-sm font-semibold text-gray-800 mb-1">{t('admin.removeBlockTitle')}</p>
        <p className="text-xs text-gray-500 mb-3">
          {block.indefinite
            ? t('admin.removeBlockDesc')
            : t('admin.removeBlockDescRange', { start: block.start_date?.slice(0, 10), end: block.end_date?.slice(0, 10) })}
        </p>
        <div className="flex gap-2 justify-end">
          <button onClick={() => toast.dismiss(tid)} className="px-3 py-1.5 rounded-lg text-xs font-medium text-gray-600 hover:bg-gray-100">
            {t('admin.cancel')}
          </button>
          <button
            onClick={async () => {
              toast.dismiss(tid);
              try {
                await axios.delete(`${API}/admin/properties/blocks/${block.id}`, { headers });
                toast.success('Admin block removed');
                fetchProperties();
              } catch (e) { toast.error('Failed to remove block'); }
            }}
            className="px-3 py-1.5 rounded-lg text-xs font-semibold text-white bg-black hover:bg-gray-800"
            data-testid={`confirm-unblock-${property.id}`}
          >
            {t('admin.removeBlock')}
          </button>
        </div>
      </div>
    ), { duration: 10000 });
  };

  const togglePropSelected = (id) => {
    setSelectedPropIds(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  };

  const filteredProperties = properties.filter(p => {
    if (managedFilter === 'managed' && !p.managed_by_admin) return false;
    if (featuredFilter === 'featured' && !p.is_featured) return false;
    if (rentalTypeFilter !== 'all' && p.rental_type !== rentalTypeFilter) return false;
    // Effective price = whatever the table column shows: monthly first,
    // nightly as fallback. Keeps the filter result consistent with what
    // the admin sees on screen.
    const price = p.monthly_price || p.nightly_price || 0;
    const minN = minPrice ? Number(minPrice) : null;
    const maxN = maxPrice ? Number(maxPrice) : null;
    if (minN !== null && !Number.isNaN(minN) && price < minN) return false;
    if (maxN !== null && !Number.isNaN(maxN) && price > maxN) return false;
    if (!searchTerm) return true;
    const t = searchTerm.toLowerCase();
    return (
      p.title?.toLowerCase().includes(t) ||
      p.area?.toLowerCase().includes(t) ||
      p.owner_name?.toLowerCase().includes(t)
    );
  });
  const managedCount = properties.filter(p => p.managed_by_admin).length;
  const featuredCount = properties.filter(p => p.is_featured).length;
  // Per-rental-type counts surfaced on each filter chip so the admin can
  // tell at a glance how many vacation rentals vs long-term leases exist
  // before clicking. The four canonical rental types match what
  // /app/backend ships in the `rental_type` enum.
  const rentalTypeCounts = properties.reduce((acc, p) => {
    const key = p.rental_type || 'long-term';
    acc[key] = (acc[key] || 0) + 1;
    return acc;
  }, {});

  return (
    <div data-testid="admin-listings-section">
      <div className="flex items-center gap-4 mb-6 flex-wrap">
        <div className="relative flex-1 max-w-md">
          <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
          <input
            type="text"
            value={searchTerm}
            onChange={e => setSearchTerm(e.target.value)}
            placeholder={t('admin.searchListings')}
            className="w-full pl-9 pr-4 py-2 rounded-lg border border-[#E5E5E5] text-sm focus:outline-none focus:ring-2 focus:ring-black/20"
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
        <div className="inline-flex bg-white rounded-lg border border-[#E5E5E5] p-0.5 ml-1" data-testid="managed-filter">
          <button
            onClick={() => setManagedFilter('all')}
            className={`px-2.5 py-1 rounded-md text-xs font-semibold transition-colors ${managedFilter === 'all' ? 'bg-[#1E6A6A] text-white' : 'text-gray-600 hover:bg-gray-50'}`}
            data-testid="managed-filter-all"
          >
            All
          </button>
          <button
            onClick={() => setManagedFilter('managed')}
            className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-md text-xs font-semibold transition-colors ${managedFilter === 'managed' ? 'bg-[#1E6A6A] text-white' : 'text-gray-600 hover:bg-gray-50'}`}
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
                className={`px-2.5 py-1 rounded-md text-xs font-semibold transition-colors disabled:opacity-30 disabled:cursor-not-allowed ${isActive ? 'bg-[#1E6A6A] text-white' : 'text-gray-600 hover:bg-gray-50'}`}
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
            className="w-20 px-2 py-1 rounded border border-transparent hover:border-gray-200 focus:border-[#1E6A6A] focus:outline-none focus:ring-1 focus:ring-[#1E6A6A]/30 text-xs"
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
            className="w-20 px-2 py-1 rounded border border-transparent hover:border-gray-200 focus:border-[#1E6A6A] focus:outline-none focus:ring-1 focus:ring-[#1E6A6A]/30 text-xs"
            data-testid="price-max-input"
          />
          {(minPrice || maxPrice) && (
            <button
              type="button"
              onClick={clearPriceRange}
              className="text-[10px] uppercase tracking-wider text-gray-400 hover:text-gray-700 ml-0.5"
              data-testid="price-clear-btn"
              title="Clear price range"
            >
              clear
            </button>
          )}
        </div>
        {selectedPropIds.size > 0 && (
          <div className="flex items-center gap-2 ml-auto flex-wrap">
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

      <div className="bg-white rounded-xl border border-[#E5E5E5] overflow-hidden">
        {/* Desktop table — hidden on small screens */}
        <table className="w-full hidden md:table">
          <thead className="bg-gray-50">
            <tr>
              <th className="px-3 py-3 w-8">
                <input
                  type="checkbox"
                  checked={filteredProperties.length > 0 && filteredProperties.every(p => selectedPropIds.has(p.id))}
                  onChange={e => {
                    if (e.target.checked) {
                      setSelectedPropIds(new Set(filteredProperties.map(p => p.id)));
                    } else {
                      setSelectedPropIds(new Set());
                    }
                  }}
                  data-testid="select-all-listings"
                />
              </th>
              <th className="px-3 py-3 w-16"></th>
              <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase">{t('admin.colTitle')}</th>
              <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase">{t('admin.colOwner')}</th>
              <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase">{t('admin.colArea')}</th>
              <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase">{t('admin.colType')}</th>
              <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase">{t('admin.colPrice')}</th>
              <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase">Added</th>
              <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase">{t('admin.status')}</th>
              <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase">{t('admin.actions')}</th>
            </tr>
          </thead>
          <tbody>
            {filteredProperties.map(p => (
              <tr key={p.id} className="border-t border-[#E5E5E5] hover:bg-gray-50" data-testid={`listing-row-${p.id}`}>
                <td className="px-3 py-3">
                  <input
                    type="checkbox"
                    checked={selectedPropIds.has(p.id)}
                    onChange={() => togglePropSelected(p.id)}
                    data-testid={`select-listing-${p.id}`}
                  />
                </td>
                <td className="px-3 py-2 w-16">
                  <CoverThumb property={p} />
                </td>
                <td className="px-4 py-3 font-medium text-sm">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span>{p.title}</span>
                    {p.is_featured && (
                      <span
                        className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold bg-amber-100 text-amber-800"
                        title={t('admin.featuredOnHome', 'Featured on homepage')}
                        data-testid={`featured-badge-${p.id}`}
                      >
                        <Star size={10} fill="currentColor" /> {t('admin.featured', 'Featured')}
                      </span>
                    )}
                    {p.managed_by_admin && (
                      <span
                        className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold bg-[#1E6A6A]/10 text-[#1E6A6A]"
                        title="Admin-managed for the owner"
                        data-testid={`managed-badge-${p.id}`}
                      >
                        <Briefcase size={10} /> Managing
                      </span>
                    )}
                    {p.admin_blocked_now && (
                      <span
                        className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold bg-amber-100 text-amber-800"
                        title={p.active_admin_block?.indefinite ? t('admin.adminBlockedIndefinite') : t('admin.adminBlockedRange', { start: p.active_admin_block?.start_date?.slice(0,10), end: p.active_admin_block?.end_date?.slice(0,10) })}
                        data-testid={`admin-blocked-badge-${p.id}`}
                      >
                        <Lock size={10} /> {t('admin.adminBlocked')}
                      </span>
                    )}
                  </div>
                </td>
                <td className="px-4 py-3 text-sm text-gray-600">
                  {p.owner_name}<br />
                  <span className="text-xs text-gray-400">{p.owner_email}</span>
                </td>
                <td className="px-4 py-3 text-sm">{p.area}</td>
                <td className="px-4 py-3"><span className="px-2 py-1 rounded-full text-xs bg-[#E5E5E5]">{p.rental_type}</span></td>
                <td className="px-4 py-3 font-bold text-sm">{p.currency === 'USD' ? '$' : '₪'}{p.monthly_price || p.nightly_price || 0}</td>
                <td className="px-4 py-3 text-xs text-gray-500" title={p.created_at ? new Date(p.created_at).toLocaleString() : ''}>
                  {p.created_at ? relativeAdded(p.created_at) : '—'}
                </td>
                <td className="px-4 py-3">
                  <span className={`px-2 py-1 rounded-full text-xs font-medium ${p.status === 'active' ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'}`}>
                    {p.status}
                  </span>
                </td>
                <td className="px-4 py-3">
                  <div className="flex items-center gap-1">
                    <button
                      onClick={() => toggleFeatured(p.id)}
                      className={`p-1.5 rounded transition-colors ${p.is_featured ? 'bg-amber-100 text-amber-600 hover:bg-amber-200' : 'hover:bg-gray-100 text-gray-400'}`}
                      title={p.is_featured ? t('admin.removeFromFeatured', 'Remove from featured listings') : t('admin.addToFeatured', 'Add to featured listings')}
                      data-testid={`toggle-featured-${p.id}`}
                    >
                      <Star size={16} fill={p.is_featured ? 'currentColor' : 'none'} />
                    </button>
                    {p.admin_blocked_now ? (
                      <button
                        onClick={() => unmarkBooked(p)}
                        className="p-1.5 rounded hover:bg-green-50 text-green-600"
                        title={t('admin.removeAdminBlock')}
                        data-testid={`unmark-booked-${p.id}`}
                      >
                        <CalendarCheck size={18} />
                      </button>
                    ) : (
                      <button
                        onClick={() => openMarkBookedModal({ mode: 'single', id: p.id })}
                        className="p-1.5 rounded hover:bg-amber-50 text-amber-600"
                        title={t('admin.markAsBooked')}
                        data-testid={`mark-booked-${p.id}`}
                      >
                        <CalendarX size={18} />
                      </button>
                    )}
                    <button
                      onClick={() => toggleAdminManaged(p.id)}
                      className={`p-1.5 rounded transition-colors ${p.managed_by_admin ? 'bg-[#1E6A6A]/10 text-[#1E6A6A] hover:bg-[#1E6A6A]/15' : 'hover:bg-gray-100 text-gray-400'}`}
                      title={p.managed_by_admin ? 'Stop managing this property' : 'Start managing this property for the owner'}
                      data-testid={`toggle-managed-${p.id}`}
                    >
                      <Briefcase size={16} />
                    </button>
                    <button
                      onClick={() => togglePropertyStatus(p.id)}
                      className="p-1.5 rounded hover:bg-gray-100"
                      title={p.status === 'active' ? t('admin.deactivate') : t('admin.activate')}
                      data-testid={`toggle-property-${p.id}`}
                    >
                      {p.status === 'active'
                        ? <ToggleRight size={18} className="text-green-600" />
                        : <ToggleLeft size={18} className="text-gray-400" />}
                    </button>
                    <button
                      onClick={() => deleteProperty(p.id)}
                      className="p-1.5 rounded hover:bg-red-50 text-red-500"
                      title={t('admin.deleteTooltip')}
                      data-testid={`delete-property-${p.id}`}
                    >
                      <Trash2 size={16} />
                    </button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>

        {/* Mobile card list — visible on small screens only.
            Each card shows all the same info + actions in a stacked layout
            so admins can manage listings without a sideways-scrolling table. */}
        <div className="md:hidden">
          {filteredProperties.length > 0 && (
            <div className="flex items-center justify-between px-3 py-2 bg-gray-50 border-b border-[#E5E5E5] text-xs font-medium text-gray-600">
              <label className="inline-flex items-center gap-2">
                <input
                  type="checkbox"
                  checked={filteredProperties.every(p => selectedPropIds.has(p.id))}
                  onChange={e => {
                    if (e.target.checked) setSelectedPropIds(new Set(filteredProperties.map(p => p.id)));
                    else setSelectedPropIds(new Set());
                  }}
                  data-testid="select-all-listings-mobile"
                />
                {t('admin.selectAllVisible', 'Select all visible')}
              </label>
              {selectedPropIds.size > 0 && (
                <span className="text-[#1E6A6A] font-semibold" data-testid="selected-count-mobile">
                  {t('admin.selectedCount', { count: selectedPropIds.size })}
                </span>
              )}
            </div>
          )}
          <div className="divide-y divide-[#E5E5E5]">
          {filteredProperties.map(p => (
            <div key={p.id} className="p-3" data-testid={`listing-card-${p.id}`}>
              <div className="flex items-start gap-2 mb-2">
                <input
                  type="checkbox"
                  checked={selectedPropIds.has(p.id)}
                  onChange={() => togglePropSelected(p.id)}
                  className="mt-1 shrink-0"
                  data-testid={`select-listing-mobile-${p.id}`}
                />
                <CoverThumb property={p} size="sm" />
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-1.5 flex-wrap">
                    <p className="font-semibold text-sm break-words">{p.title || '—'}</p>
                    <span className={`px-1.5 py-0.5 rounded-full text-[10px] font-medium ${p.status === 'active' ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'}`}>
                      {p.status}
                    </span>
                  </div>
                  <p className="text-xs text-gray-500 mt-0.5">{p.owner_name} · {p.area}</p>
                  <p className="text-xs text-gray-700 mt-0.5">
                    <span className="font-semibold">{p.currency === 'USD' ? '$' : '₪'}{p.monthly_price || p.nightly_price || 0}</span>
                    <span className="text-gray-400"> · {p.rental_type}</span>
                    {p.created_at && (
                      <span
                        className="text-gray-400"
                        title={new Date(p.created_at).toLocaleString()}
                      > · added {relativeAdded(p.created_at)}</span>
                    )}
                  </p>
                  <div className="flex items-center gap-1 flex-wrap mt-1.5">
                    {p.is_featured && (
                      <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded-full text-[9px] font-semibold bg-amber-100 text-amber-800">
                        <Star size={9} fill="currentColor" /> {t('admin.featured', 'Featured')}
                      </span>
                    )}
                    {p.managed_by_admin && (
                      <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded-full text-[9px] font-semibold bg-[#1E6A6A]/10 text-[#1E6A6A]">
                        <Briefcase size={9} /> Managing
                      </span>
                    )}
                    {p.admin_blocked_now && (
                      <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded-full text-[9px] font-semibold bg-amber-100 text-amber-800">
                        <Lock size={9} /> {t('admin.adminBlocked')}
                      </span>
                    )}
                  </div>
                </div>
              </div>
              {/* Actions row — full-width grid so every button is reachable
                  on a small screen without horizontal scroll. */}
              <div className="grid grid-cols-5 gap-1 mt-2">
                <button
                  onClick={() => toggleFeatured(p.id)}
                  className={`flex flex-col items-center justify-center gap-0.5 py-2 rounded text-[10px] font-medium transition-colors ${p.is_featured ? 'bg-amber-100 text-amber-700' : 'bg-gray-50 text-gray-500 hover:bg-gray-100'}`}
                  data-testid={`toggle-featured-mobile-${p.id}`}
                >
                  <Star size={16} fill={p.is_featured ? 'currentColor' : 'none'} />
                  {p.is_featured ? t('admin.unfeature', 'Unfeature') : t('admin.feature', 'Feature')}
                </button>
                {p.admin_blocked_now ? (
                  <button
                    onClick={() => unmarkBooked(p)}
                    className="flex flex-col items-center justify-center gap-0.5 py-2 rounded text-[10px] font-medium bg-green-50 text-green-700 hover:bg-green-100"
                    data-testid={`unmark-booked-mobile-${p.id}`}
                  >
                    <CalendarCheck size={16} />
                    {t('admin.unblock', 'Unblock')}
                  </button>
                ) : (
                  <button
                    onClick={() => openMarkBookedModal({ mode: 'single', id: p.id })}
                    className="flex flex-col items-center justify-center gap-0.5 py-2 rounded text-[10px] font-medium bg-amber-50 text-amber-700 hover:bg-amber-100"
                    data-testid={`mark-booked-mobile-${p.id}`}
                  >
                    <CalendarX size={16} />
                    {t('admin.block', 'Block')}
                  </button>
                )}
                <button
                  onClick={() => toggleAdminManaged(p.id)}
                  className={`flex flex-col items-center justify-center gap-0.5 py-2 rounded text-[10px] font-medium ${p.managed_by_admin ? 'bg-[#1E6A6A]/10 text-[#1E6A6A]' : 'bg-gray-50 text-gray-500 hover:bg-gray-100'}`}
                  data-testid={`toggle-managed-mobile-${p.id}`}
                >
                  <Briefcase size={16} />
                  {p.managed_by_admin ? t('admin.unmanage', 'Unmanage') : t('admin.manage', 'Manage')}
                </button>
                <button
                  onClick={() => togglePropertyStatus(p.id)}
                  className="flex flex-col items-center justify-center gap-0.5 py-2 rounded text-[10px] font-medium bg-gray-50 text-gray-700 hover:bg-gray-100"
                  data-testid={`toggle-property-mobile-${p.id}`}
                >
                  {p.status === 'active'
                    ? <ToggleRight size={16} className="text-green-600" />
                    : <ToggleLeft size={16} className="text-gray-400" />}
                  {p.status === 'active' ? t('admin.deactivate') : t('admin.activate')}
                </button>
                <button
                  onClick={() => deleteProperty(p.id)}
                  className="flex flex-col items-center justify-center gap-0.5 py-2 rounded text-[10px] font-medium bg-red-50 text-red-600 hover:bg-red-100"
                  data-testid={`delete-property-mobile-${p.id}`}
                >
                  <Trash2 size={14} />
                  {t('admin.deleteAction', 'Delete')}
                </button>
              </div>
            </div>
          ))}
          </div>
        </div>

        {filteredProperties.length === 0 && (
          <p className="text-center text-gray-400 py-8 text-sm">{t('admin.noListings')}</p>
        )}
      </div>

      <MarkAsBookedModal
        open={bookedModalOpen}
        target={bookedTarget}
        selectedCount={selectedPropIds.size}
        saving={blockSaving}
        onClose={closeMarkBookedModal}
        onSubmit={submitMarkBooked}
      />

      {showDuplicates && (
        <DuplicatesModal
          token={token}
          onClose={() => setShowDuplicates(false)}
          onDeleted={fetchProperties}
        />
      )}
    </div>
  );
};

export default ListingsTab;
