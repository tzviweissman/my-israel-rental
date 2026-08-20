import React, { useState, useEffect } from 'react';
import { useSearchParams } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import axios from 'axios';
import { toast } from 'sonner';
import { API } from '../../App';
import { useApiSWR } from '../../hooks/useApiSWR';
import MarkAsBookedModal from './MarkAsBookedModal';
import DuplicatesModal from './DuplicatesModal';
import BulkDeleteConfirmToast from './BulkDeleteConfirmToast';
import PricingAuditBanner from './PricingAuditBanner';
import ListingsFilterBar from './ListingsFilterBar';
import ListingsTable from './ListingsTable';



/**
 * Super Admin → Listings tab.
 */
export const ListingsTab = ({ token, onStatsChange }) => {
  const { t } = useTranslation();
  const headers = { Authorization: `Bearer ${token}` };

  // `error` matters as much as `data` here: a failed fetch leaves `data` at
  // its `initial: []`, which is indistinguishable from "this account really
  // has no listings" unless we look. Rendering the two the same way sent a
  // false "all your listings are gone" during a backend restart.
  const {
    data: properties,
    error: propertiesError,
    isValidating: propertiesLoading,
    refresh: fetchProperties,
  } = useApiSWR(`${API}/admin/properties`, token, { initial: [] });
  const [searchTerm, setSearchTerm] = useState('');
  const [showDuplicates, setShowDuplicates] = useState(false);
  const [sweeping, setSweeping] = useState(false);

  // ── Pricing audit banner ──────────────────────────────────────────
  // Read-only diagnostic that runs when the tab mounts. If we find any
  // listings whose price fields look wrong (zero rent, absurdly low
  // monthly, or a long-term row with a stranded nightly value), we show
  // a compact amber summary at the top of the tab pointing the admin at
  // the "Repair prices" button — so bad data has a discovery path
  // beyond scrolling the whole list. Purely informational; no rows are
  // touched until the admin clicks a resolve action.
  const [priceAudit, setPriceAudit] = useState(null);
  const [autoFixing, setAutoFixing] = useState(false);
  const refreshAudit = async () => {
    try {
      const res = await axios.get(`${API}/admin/properties/pricing-audit`, { headers });
      setPriceAudit(res.data);
    } catch {
      setPriceAudit(null);
    }
  };
  useEffect(() => {
    refreshAudit();
  }, []);

  // One-click auto-fix for every listing surfaced by the pricing audit.
  // Backend strips stranded nightly rates on long-term listings and
  // quarantines the rest (zero-price + implausibly low monthly) so the
  // public feed stops serving broken prices while the owner reviews.
  const handleAutoFixPricing = async () => {
    if (autoFixing) return;
    const t = priceAudit?.totals || {};
    const total = (t.zero_price || 0) + (t.low_monthly || 0) + (t.wrong_field || 0);
    if (!window.confirm(
      `Auto-fix ${total} listing${total === 1 ? '' : 's'} flagged by the pricing audit?\n\n` +
      `• ${t.wrong_field || 0} with a stranded nightly rate → nightly stripped, monthly kept.\n` +
      `• ${t.low_monthly || 0} long-term under ₪1,500/mo → hidden from public feed pending owner review.\n` +
      `• ${t.zero_price || 0} with no price at all → hidden from public feed pending owner review.\n\n` +
      `Owners still see these in their own dashboard. Reversible via "Restore quarantined".`
    )) return;
    setAutoFixing(true);
    try {
      const res = await axios.post(`${API}/admin/properties/pricing-autofix`, {}, { headers });
      const d = res.data;
      if (d.totals?.total_fixed === 0) {
        toast.success('Nothing to fix — pricing audit is clean.');
      } else {
        toast.success(d.message, { duration: 8000 });
      }
      await Promise.all([refreshAudit(), fetchProperties()]);
    } catch (e) {
      toast.error(e?.response?.data?.detail || 'Auto-fix failed — try again');
    } finally {
      setAutoFixing(false);
    }
  };

  // Undo pricing-autofix quarantine — restores every listing hidden by
  // the auto-fix pass. Useful if the threshold flagged too many owners.
  const [unquarantining, setUnquarantining] = useState(false);
  const handleRestoreQuarantined = async () => {
    if (unquarantining) return;
    if (!window.confirm(
      'Restore every listing that was quarantined by the pricing auto-fix?\n\n' +
      'They will re-appear in the public feed with their current prices — ' +
      'even if the prices are still wrong. Owners will need to update them manually.'
    )) return;
    setUnquarantining(true);
    try {
      const res = await axios.post(`${API}/admin/properties/pricing-unquarantine`, {}, { headers });
      toast.success(res.data?.message || 'Restored quarantined listings');
      await Promise.all([refreshAudit(), fetchProperties()]);
    } catch (e) {
      toast.error(e?.response?.data?.detail || 'Restore failed — try again');
    } finally {
      setUnquarantining(false);
    }
  };

  // Per-row restore — one-click "this listing was flagged in error"
  // from a quarantined row without touching the other quarantined ones.
  const [restoringId, setRestoringId] = useState(null);
  const handleRestoreSingle = async (property) => {
    if (restoringId) return;
    if (!window.confirm(
      `Restore "${property.title}" to the public feed?\n\nThis lifts the pricing quarantine only for this listing — the current price will be shown to renters as-is.`
    )) return;
    setRestoringId(property.id);
    try {
      const res = await axios.post(
        `${API}/admin/properties/${property.id}/pricing-restore`, {}, { headers },
      );
      toast.success(res.data?.message || 'Listing restored');
      await Promise.all([refreshAudit(), fetchProperties()]);
    } catch (e) {
      toast.error(e?.response?.data?.detail || 'Restore failed — try again');
    } finally {
      setRestoringId(null);
    }
  };

  // One-click "Sweep duplicates" — runs the identical-fields auto-cleanup
  // first (safest, only touches groups where every visible field matches),
  // then falls back to the fuzzier "keep richest photo set" resolve on any
  // remaining groups. All in a single click from the tab top bar, so an
  // admin can flatten every dupe group without opening the modal or
  // reviewing each group individually. Confirmation copy tells the admin
  // exactly what will happen before we hit the API.
  const sweepDuplicates = async () => {
    if (sweeping) return;
    if (!window.confirm(
      'Delete every duplicate listing in one pass?\n\n' +
      '• First: merge listings where every field is identical (safest).\n' +
      '• Then: for any remaining dupe groups, keep the copy with the most photos and delete the rest.\n\n' +
      'Chats, bookings, and favourites are automatically re-attached to the survivor. This cannot be undone.'
    )) return;
    setSweeping(true);
    try {
      // Phase 1 — strict identical-fields merge.
      const strict = await axios.post(`${API}/admin/duplicates/auto-resolve`, {}, { headers });
      // Phase 2 — keep-richest pass on any groups the strict pass didn't touch.
      const richest = await axios.post(
        `${API}/admin/duplicates/resolve`,
        { mode: 'keep_richest' },
        { headers },
      );
      const deleted = (strict.data?.deleted || 0) + (richest.data?.deleted || 0);
      const groups = (strict.data?.groups_resolved || 0) + (richest.data?.groups_resolved || 0);
      const rescuedPhotos = (richest.data?.report || [])
        .reduce((acc, row) => acc + (row.images_merged || 0), 0);
      if (deleted === 0) {
        toast.success('No duplicate listings found — nothing to sweep');
      } else {
        toast.success(
          `Swept ${deleted} duplicate ${deleted === 1 ? 'listing' : 'listings'} across ${groups} ${groups === 1 ? 'group' : 'groups'}` +
          (rescuedPhotos > 0 ? ` · rescued ${rescuedPhotos} photo ${rescuedPhotos === 1 ? 'URL' : 'URLs'} into survivors` : '')
        );
      }
      fetchProperties();
    } catch (e) {
      toast.error(e?.response?.data?.detail || 'Sweep failed — try again or use "Find duplicates" for manual review');
    } finally {
      setSweeping(false);
    }
  };
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
  // Quarantined filter — URL-synced. Values: 'all' | 'quarantined'.
  // Quarantined rows are the ones the pricing auto-fix hid from the
  // public feed (is_hidden=True + pricing_review_reason set). Surfacing
  // them behind a one-click chip lets the admin audit false positives.
  const quarantinedFilter = searchParams.get('quarantined') === '1' ? 'quarantined' : 'all';
  const setQuarantinedFilter = (val) => {
    const next = new URLSearchParams(searchParams);
    if (val === 'quarantined') next.set('quarantined', '1');
    else next.delete('quarantined');
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
    if (quarantinedFilter === 'quarantined' && !p.is_hidden) return false;
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
  const quarantinedCount = properties.filter(p => p.is_hidden).length;
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
      <PricingAuditBanner
        priceAudit={priceAudit}
        autoFixing={autoFixing}
        unquarantining={unquarantining}
        handleAutoFixPricing={handleAutoFixPricing}
        handleRestoreQuarantined={handleRestoreQuarantined}
      />
      <ListingsFilterBar
        t={t}
        searchTerm={searchTerm}
        setSearchTerm={setSearchTerm}
        filteredProperties={filteredProperties}
        properties={properties}
        selectedPropIds={selectedPropIds}
        setSelectedPropIds={setSelectedPropIds}
        managedFilter={managedFilter}
        setManagedFilter={setManagedFilter}
        featuredFilter={featuredFilter}
        setFeaturedFilter={setFeaturedFilter}
        quarantinedFilter={quarantinedFilter}
        setQuarantinedFilter={setQuarantinedFilter}
        rentalTypeFilter={rentalTypeFilter}
        setRentalTypeFilter={setRentalTypeFilter}
        rentalTypeCounts={rentalTypeCounts}
        managedCount={managedCount}
        featuredCount={featuredCount}
        quarantinedCount={quarantinedCount}
        minPrice={minPrice}
        maxPrice={maxPrice}
        setPriceParam={setPriceParam}
        clearPriceRange={clearPriceRange}
        bulkDelete={bulkDelete}
        bulkSetFeatured={bulkSetFeatured}
        openMarkBookedModal={openMarkBookedModal}
        sweepDuplicates={sweepDuplicates}
        sweeping={sweeping}
        handleRemirrorPhotos={handleRemirrorPhotos}
        remirroring={remirroring}
        handleRepairPrices={handleRepairPrices}
        repairingPrices={repairingPrices}
        setShowDuplicates={setShowDuplicates}
      />

      <ListingsTable
        t={t}
        filteredProperties={filteredProperties}
        propertiesError={propertiesError}
        selectedPropIds={selectedPropIds}
        setSelectedPropIds={setSelectedPropIds}
        togglePropSelected={togglePropSelected}
        togglePropertyStatus={togglePropertyStatus}
        toggleAdminManaged={toggleAdminManaged}
        toggleFeatured={toggleFeatured}
        deleteProperty={deleteProperty}
        openMarkBookedModal={openMarkBookedModal}
        unmarkBooked={unmarkBooked}
        handleRestoreSingle={handleRestoreSingle}
        restoringId={restoringId}
      />

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
