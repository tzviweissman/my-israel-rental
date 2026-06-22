import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import axios from 'axios';
import { Edit, Eye, Trash2, Upload, FileText, CalendarSync, Link2, X, RefreshCw, Copy, Check, Sparkles, Image as ImageIcon, Loader2, CalendarCheck, TrendingUp } from 'lucide-react';
import { toast } from 'sonner';
import { getCoverImage } from '../../utils/coverImage';
import DefaultImageBadge from '../property/DefaultImageBadge';
import VideoCoverBadge from '../property/VideoCoverBadge';
import SmartPricingModal from './SmartPricingModal';

/**
 * Owner-facing property card grid with edit / delete / contract-upload /
 * iCal panel controls. Self-contained: owns ical panel state + all mutation
 * handlers. Uses toast-confirms for destructive actions (window.confirm is
 * blocked inside the Emergent preview iframe).
 */

// Stacked price renderer for owner dashboard cards. A single listing can carry
// both a regular nightly/monthly rate AND a holiday lump (Sukkot/Pesach) rate,
// so we show whichever are set rather than the old `monthly || nightly` fall-
// through (which left holiday-only listings displaying just a bare currency
// glyph with no number).
const PriceBlock = ({ property, t }) => {
  const isVacation = property.rental_type === 'vacation';
  const regularPrice = isVacation ? property.nightly_price : property.monthly_price;
  const regularSym = property.currency === 'USD' ? '$' : '₪';
  const regularLabel = isVacation ? t('property.perNight') : t('property.perMonth');

  const hasHoliday =
    isVacation && property.holiday_lump_price != null && property.holiday_lump_price > 0;
  const holidaySym =
    (property.holiday_lump_currency || property.currency) === 'USD' ? '$' : '₪';
  const tags = property.holiday_tags || [];
  // Pick the suffix label. Existing i18n keys are full suffixes (e.g. '/ Sukkot'),
  // so we use them directly for the lump-sum case. For per-night holiday pricing
  // we tag onto `/night` so renters know it's the holiday rate variant.
  let holidaySuffix;
  if (property.holiday_lump_is_per_night) {
    const tagName = tags.includes('sukkot') && tags.includes('pesach')
      ? 'Sukkot/Pesach'
      : tags.includes('pesach') ? 'Pesach' : 'Sukkot';
    holidaySuffix = `${t('property.perNight')} (${tagName})`;
  } else if (tags.includes('sukkot') && tags.includes('pesach')) {
    holidaySuffix = `${t('property.perSukkot')} / ${t('property.perPesach').replace(/^\/\s*/, '')}`;
  } else if (tags.includes('pesach')) {
    holidaySuffix = t('property.perPesach');
  } else if (tags.includes('sukkot')) {
    holidaySuffix = t('property.perSukkot');
  } else {
    holidaySuffix = t('property.perHoliday');
  }

  const hasRegular = regularPrice != null && regularPrice > 0;

  if (!hasRegular && !hasHoliday) {
    return (
      <span
        className="text-sm text-gray-400 italic"
        data-testid={`dashboard-no-price-${property.id}`}
      >
        No price set
      </span>
    );
  }

  return (
    <div className="flex flex-col gap-0.5 min-w-0">
      {hasRegular && (
        <span
          className="text-lg font-bold leading-tight"
          style={{ color: '#1E6A6A' }}
          data-testid={`dashboard-regular-price-${property.id}`}
        >
          {regularSym}
          {Number(regularPrice).toLocaleString()}
          <span className="text-[11px] font-normal text-gray-500 ml-1">{regularLabel}</span>
        </span>
      )}
      {hasHoliday && (
        <span
          className="text-sm font-semibold leading-tight"
          style={{ color: '#D4AF37' }}
          data-testid={`dashboard-holiday-price-${property.id}`}
        >
          {holidaySym}
          {Number(property.holiday_lump_price).toLocaleString()}
          <span className="text-[10px] font-normal text-gray-500 ml-1">{holidaySuffix}</span>
        </span>
      )}
    </div>
  );
};

const PropertyList = ({ properties, bookings = [], onEdit, onRefresh, API, token }) => {
  const { t } = useTranslation();
  const navigate = useNavigate();

  const [icalPanel, setIcalPanel] = useState(null);
  const [icalUrl, setIcalUrl] = useState('');
  const [icalSyncing, setIcalSyncing] = useState(false);
  // Exactly one filter can be active at a time ('bulk' | 'no_images' | null).
  const [activeFilter, setActiveFilter] = useState(null);
  // Drag-and-drop bulk image upload (visible only while Needs Images filter is active)
  const [dropHover, setDropHover] = useState(false);
  const [imageAssignments, setImageAssignments] = useState([]); // [{file, propertyId}]
  const [bulkImgUploading, setBulkImgUploading] = useState(false);
  const [icalData, setIcalData] = useState({});
  const [copiedExport, setCopiedExport] = useState(false);
  // Smart Pricing modal — single instance, opened with whichever property's
  // button was clicked. Vacation-only (button is hidden on other types).
  const [smartPricingProperty, setSmartPricingProperty] = useState(null);

  const authHeaders = { headers: { Authorization: `Bearer ${token}` } };

  // ---- Destructive actions with toast confirm (iframe-safe) ----
  const handleDeleteProperty = (propertyId) => {
    toast.custom(
      (tid) => (
        <div className="bg-white rounded-xl shadow-xl border border-gray-200 p-4 w-80">
          <p className="text-sm font-semibold text-gray-800 mb-1">Delete this property?</p>
          <p className="text-xs text-gray-500 mb-3">This cannot be undone. All bookings and images will be unlinked.</p>
          <div className="flex gap-2 justify-end">
            <button onClick={() => toast.dismiss(tid)} className="px-3 py-1.5 rounded-lg text-xs font-medium text-gray-600 hover:bg-gray-100">
              Cancel
            </button>
            <button
              onClick={async () => {
                toast.dismiss(tid);
                try {
                  const res = await axios.delete(`${API}/properties/${propertyId}`, authHeaders);
                  toast.success(res.data?.message || 'Property deleted');
                  onRefresh && onRefresh();
                } catch (err) {
                  toast.error(err?.response?.data?.detail || 'Failed to delete property');
                }
              }}
              className="px-3 py-1.5 rounded-lg text-xs font-semibold text-white bg-red-500 hover:bg-red-600"
              data-testid={`confirm-delete-property-${propertyId}`}
            >
              Delete
            </button>
          </div>
        </div>
      ),
      { duration: 10000 },
    );
  };

  const handleContractUpload = async (propertyId, file, inputEl) => {
    if (!file) return;
    const allowed = ['application/pdf', 'image/jpeg', 'image/jpg', 'image/png', 'image/webp', 'image/heic', 'image/heif'];
    if (!allowed.includes(file.type)) {
      toast.error('Only PDF and image files (JPG, PNG, WEBP, HEIC) are allowed');
      if (inputEl) inputEl.value = '';
      return;
    }
    try {
      const formData = new FormData();
      formData.append('file', file);
      await axios.post(`${API}/properties/${propertyId}/contract`, formData, {
        headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'multipart/form-data' },
      });
      toast.success('Contract uploaded successfully!');
      onRefresh && (await onRefresh());
    } catch (err) {
      toast.error(err.response?.data?.detail || 'Failed to upload contract');
    } finally {
      if (inputEl) inputEl.value = '';
    }
  };

  const handleDeleteContract = (propertyId) => {
    toast.custom((tid) => (
      <div className="bg-white rounded-xl shadow-xl border border-gray-200 p-4 w-80">
        <p className="text-sm font-semibold text-gray-800 mb-1">Delete this contract?</p>
        <p className="text-xs text-gray-500 mb-3">Renters with pending bookings will no longer see it.</p>
        <div className="flex gap-2 justify-end">
          <button onClick={() => toast.dismiss(tid)} className="px-3 py-1.5 rounded-lg text-xs font-medium text-gray-600 hover:bg-gray-100">
            Cancel
          </button>
          <button
            type="button"
            onClick={async () => {
              toast.dismiss(tid);
              try {
                await axios.delete(`${API}/properties/${propertyId}/contract`, authHeaders);
                toast.success('Contract deleted successfully!');
                onRefresh && (await onRefresh());
              } catch (err) {
                toast.error(err?.response?.data?.detail || 'Failed to delete contract');
              }
            }}
            className="px-3 py-1.5 rounded-lg text-xs font-semibold text-white bg-red-500 hover:bg-red-600"
            data-testid="confirm-delete-contract-btn"
          >
            Delete
          </button>
        </div>
      </div>
    ), { duration: 10000 });
  };

  // ---- iCal handlers ----
  const openIcalPanel = async (propertyId) => {
    setIcalPanel(icalPanel === propertyId ? null : propertyId);
    setIcalUrl('');
    setCopiedExport(false);
    if (icalPanel !== propertyId) {
      try {
        const res = await axios.get(`${API}/properties/${propertyId}/blocked-dates`);
        setIcalData((prev) => ({ ...prev, [propertyId]: res.data }));
      } catch {
        toast.error('Could not load calendar data');
      }
    }
  };

  const addIcalUrl = async (propertyId) => {
    if (!icalUrl.trim()) return;
    setIcalSyncing(true);
    try {
      await axios.post(`${API}/properties/${propertyId}/ical`, { url: icalUrl.trim() }, authHeaders);
      toast.success(t('property.ical.copied') || 'iCal feed added!');
      setIcalUrl('');
      const res = await axios.get(`${API}/properties/${propertyId}/blocked-dates`);
      setIcalData((prev) => ({ ...prev, [propertyId]: res.data }));
      onRefresh && onRefresh();
    } catch (err) {
      toast.error(err.response?.data?.detail || 'Failed to add iCal feed');
    }
    setIcalSyncing(false);
  };

  const removeIcalUrl = async (propertyId, url) => {
    try {
      await axios.delete(`${API}/properties/${propertyId}/ical`, { data: { url }, headers: { Authorization: `Bearer ${token}` } });
      toast.success('iCal feed removed');
      const res = await axios.get(`${API}/properties/${propertyId}/blocked-dates`);
      setIcalData((prev) => ({ ...prev, [propertyId]: res.data }));
      onRefresh && onRefresh();
    } catch {
      toast.error('Failed to remove iCal feed');
    }
  };

  const manualSync = async (propertyId) => {
    setIcalSyncing(true);
    try {
      await axios.post(`${API}/properties/${propertyId}/ical-sync`, {}, authHeaders);
      const res = await axios.get(`${API}/properties/${propertyId}/blocked-dates`);
      setIcalData((prev) => ({ ...prev, [propertyId]: res.data }));
      toast.success('Sync complete');
    } catch {
      toast.error('Sync failed');
    }
    setIcalSyncing(false);
  };

  const copyExportUrl = async (propertyId) => {
    const url = `${API.replace('/api', '')}/api/properties/${propertyId}/ical-export`;
    try {
      await navigator.clipboard.writeText(url);
    } catch {
      const textarea = document.createElement('textarea');
      textarea.value = url;
      document.body.appendChild(textarea);
      textarea.select();
      document.execCommand('copy');
      document.body.removeChild(textarea);
    }
    setCopiedExport(true);
    toast.success('URL copied!');
    setTimeout(() => setCopiedExport(false), 3000);
  };

  const propImage = (property) => {
    const { url } = getCoverImage(property.images, 480, API, property.videos, property.id);
    return url;
  };

  const propIsDefault = (property) => getCoverImage(property.images, 480, API, property.videos, property.id).isDefault;
  const propIsVideoCover = (property) => getCoverImage(property.images, 480, API, property.videos, property.id).fromVideo;

  // "NEW" badge on bulk-created listings, fades out after 24h so managers
  // can spot the ones they just uploaded without scrolling.
  const isFreshBulkUpload = (property) => {
    if (!property.bulk_created || !property.created_at) return false;
    const ageMs = Date.now() - new Date(property.created_at).getTime();
    return ageMs < 24 * 60 * 60 * 1000;
  };

  const bulkCount = properties.filter(isFreshBulkUpload).length;
  const needsImagesCount = properties.filter((p) => !p.images || p.images.length === 0).length;

  // "Booked" — properties with an active confirmed booking that hasn't ended
  // yet (covers both already-running stays and confirmed future stays the
  // owner has on the books). Owners think of these as off-market.
  const todayISO = new Date().toISOString().slice(0, 10);
  const bookedIds = new Set(
    (bookings || [])
      .filter((b) => b.status === 'confirmed' && b.end_date && b.end_date >= todayISO)
      .map((b) => b.property_id)
  );
  const bookedCount = properties.filter((p) => bookedIds.has(p.id)).length;

  const displayedProperties =
    activeFilter === 'bulk' ? properties.filter(isFreshBulkUpload)
    : activeFilter === 'no_images' ? properties.filter((p) => !p.images || p.images.length === 0)
    : activeFilter === 'booked' ? properties.filter((p) => bookedIds.has(p.id))
    : properties;
  const toggleFilter = (f) => {
    setActiveFilter((prev) => (prev === f ? null : f));
    setImageAssignments([]); // clear pending assignments when switching filters
  };

  // ---- Bulk image drop handlers ----
  // Normalize for filename-prefix matching. Three steps:
  //   1. Lowercase + strip the file extension
  //   2. NFD-decompose Unicode and remove combining marks → "Bâtiment" → "batiment"
  //   3. Keep any Unicode letter or digit (so Hebrew, Arabic, Cyrillic etc. still
  //      match against themselves); drop everything else.
  // Note: cross-script matching won't work (Hebrew ↔ English), but same-script
  // matching now does, which covers the realistic "בניין-א.jpg" → "בניין א" case.
  const slug = (s) =>
    String(s || '')
      .toLowerCase()
      .replace(/\.[^.]+$/, '')
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .replace(/[^\p{L}\p{N}]/gu, '');

  const addDroppedFiles = (fileList) => {
    const incoming = Array.from(fileList).filter((f) => f.type.startsWith('image/'));
    if (incoming.length === 0) {
      toast.error('Drop image files only (.jpg, .png, .webp, .heic)');
      return;
    }
    const pending = displayedProperties; // already filtered to no-image set
    if (pending.length === 0) {
      toast.error('No properties need images right now');
      return;
    }
    // Precompute slugs once, longest title first so "BuildingA1" wins over "BuildingA".
    // Require ≥3 chars to avoid a trivial title like "A" collapsing to "a" matching
    // every filename that happens to contain the letter 'a'.
    const slugged = pending
      .map((p) => ({ id: p.id, titleSlug: slug(p.title) }))
      .filter((x) => x.titleSlug.length >= 3)
      .sort((a, b) => b.titleSlug.length - a.titleSlug.length);

    setImageAssignments((prev) => {
      const base = [...prev];
      let matchedCount = 0;
      incoming.forEach((f, i) => {
        const fslug = slug(f.name);
        // `.includes` catches both "buildinga_hero" AND "hero_buildinga"
        const hit = slugged.find((x) => fslug.includes(x.titleSlug));
        if (hit) matchedCount += 1;
        const propertyId = hit ? hit.id : pending[(base.length + i) % pending.length].id;
        // Stable id for React keys — needed because rows can be removed
        // out of order, which would shift index-based keys and bleed
        // state (e.g. the dropdown selection) onto wrong rows.
        const _id = (typeof crypto !== 'undefined' && crypto.randomUUID)
          ? crypto.randomUUID() : `a-${Date.now()}-${i}`;
        base.push({ _id, file: f, propertyId });
      });
      // Flash a tiny hint if smart-match actually helped
      if (matchedCount > 0 && matchedCount < incoming.length) {
        toast.success(`Matched ${matchedCount} of ${incoming.length} by filename — rest distributed in order`);
      } else if (matchedCount === incoming.length) {
        toast.success(`All ${incoming.length} matched by filename`);
      }
      return base;
    });
  };

  const handleDrop = (e) => {
    e.preventDefault();
    setDropHover(false);
    addDroppedFiles(e.dataTransfer.files);
  };

  const removeAssignment = (idx) => setImageAssignments((prev) => prev.filter((_, i) => i !== idx));

  const updateAssignment = (idx, propertyId) =>
    setImageAssignments((prev) => prev.map((a, i) => (i === idx ? { ...a, propertyId } : a)));

  const submitBulkImages = async () => {
    if (imageAssignments.length === 0) return;
    setBulkImgUploading(true);
    try {
      // Build {property_id: [filename]} mapping
      const mapping = {};
      imageAssignments.forEach(({ file, propertyId }) => {
        if (!mapping[propertyId]) mapping[propertyId] = [];
        mapping[propertyId].push(file.name);
      });
      const formData = new FormData();
      formData.append('mapping', JSON.stringify(mapping));
      imageAssignments.forEach(({ file }) => formData.append('files', file));
      const res = await axios.post(`${API}/properties/bulk/images/attach`, formData, {
        headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'multipart/form-data' },
      });
      toast.success(`${res.data.attached.length} image(s) attached`);
      setImageAssignments([]);
      await onRefresh();
    } catch (err) {
      toast.error(err.response?.data?.detail || 'Bulk image upload failed');
    } finally {
      setBulkImgUploading(false);
    }
  };

  return (
    <div className="mb-12">
      <div className="flex items-center justify-between flex-wrap gap-3 mb-6">
        <h2 className="text-2xl font-bold" style={{ fontFamily: 'Playfair Display' }}>{t('dashboard.myProperties')}</h2>
        <div className="flex gap-2 flex-wrap">
          {bulkCount > 0 && (
            <button
              onClick={() => toggleFilter('bulk')}
              className={`inline-flex items-center gap-1.5 pl-2.5 pr-3 py-1.5 rounded-full text-xs font-semibold transition-all ${
                activeFilter === 'bulk'
                  ? 'bg-[#D4AF37] text-[#1E6A6A] shadow-sm'
                  : 'bg-[#fafaf5] text-gray-600 hover:text-[#1E6A6A] border border-[#E5E5E5]'
              }`}
              data-testid="filter-bulk-only-btn"
              title="Show only properties added in the last 24 hours via bulk upload"
            >
              <Sparkles size={12} />
              Recently Bulk-Uploaded
              <span className={`ml-0.5 px-1.5 py-0.5 rounded-full text-[10px] ${activeFilter === 'bulk' ? 'bg-[#1E6A6A] text-[#D4AF37]' : 'bg-white text-[#1E6A6A]'}`}>
                {bulkCount}
              </span>
              {activeFilter === 'bulk' && <X size={12} className="opacity-70" />}
            </button>
          )}
          {needsImagesCount > 0 && (
            <button
              onClick={() => toggleFilter('no_images')}
              className={`inline-flex items-center gap-1.5 pl-2.5 pr-3 py-1.5 rounded-full text-xs font-semibold transition-all ${
                activeFilter === 'no_images'
                  ? 'bg-[#1E6A6A] text-[#D4AF37] shadow-sm'
                  : 'bg-[#fafaf5] text-gray-600 hover:text-[#1E6A6A] border border-[#E5E5E5]'
              }`}
              data-testid="filter-no-images-btn"
              title="Listings missing cover photos — add images to boost views"
            >
              <ImageIcon size={12} />
              Needs Images
              <span className={`ml-0.5 px-1.5 py-0.5 rounded-full text-[10px] ${activeFilter === 'no_images' ? 'bg-[#D4AF37] text-[#1E6A6A]' : 'bg-white text-[#1E6A6A]'}`}>
                {needsImagesCount}
              </span>
              {activeFilter === 'no_images' && <X size={12} className="opacity-70" />}
            </button>
          )}
          {bookedCount > 0 && (
            <button
              onClick={() => toggleFilter('booked')}
              className={`inline-flex items-center gap-1.5 pl-2.5 pr-3 py-1.5 rounded-full text-xs font-semibold transition-all ${
                activeFilter === 'booked'
                  ? 'bg-emerald-600 text-white shadow-sm'
                  : 'bg-[#fafaf5] text-gray-600 hover:text-emerald-700 border border-[#E5E5E5]'
              }`}
              data-testid="filter-booked-btn"
              title="Listings with a confirmed booking on the books (current or upcoming)"
            >
              <CalendarCheck size={12} />
              Booked
              <span className={`ml-0.5 px-1.5 py-0.5 rounded-full text-[10px] ${activeFilter === 'booked' ? 'bg-white text-emerald-700' : 'bg-white text-emerald-700'}`}>
                {bookedCount}
              </span>
              {activeFilter === 'booked' && <X size={12} className="opacity-70" />}
            </button>
          )}
        </div>
      </div>

      {/* Bulk drag-and-drop image upload — only when Needs Images filter is active */}
      {activeFilter === 'no_images' && (
        <div className="mb-6" data-testid="bulk-image-dropzone-wrapper">
          <div
            onDragOver={(e) => { e.preventDefault(); setDropHover(true); }}
            onDragLeave={() => setDropHover(false)}
            onDrop={handleDrop}
            className={`rounded-2xl border-2 border-dashed p-6 text-center transition-all ${
              dropHover ? 'border-[#D4AF37] bg-[#fafaf0]' : 'border-gray-300 bg-[#fafaf5]'
            }`}
            data-testid="bulk-image-dropzone"
          >
            <div className="flex flex-col items-center gap-2">
              <div className="w-12 h-12 rounded-full bg-[#1E6A6A]/10 flex items-center justify-center">
                <Upload className="text-[#1E6A6A]" size={22} />
              </div>
              <p className="text-sm font-semibold text-gray-800">Drop images here</p>
              <p className="text-xs text-gray-500 max-w-md">
                We match files to listings by filename (e.g. <code className="bg-white px-1 rounded">tel-aviv-hero.jpg</code> → <em>Tel Aviv</em> listing) and round-robin the rest. Re-map any row below before confirming.
              </p>
              <label className="mt-1 text-xs text-[#1E6A6A] font-medium cursor-pointer hover:underline">
                or click to choose files
                <input
                  type="file"
                  accept="image/*"
                  multiple
                  className="hidden"
                  onChange={(e) => { addDroppedFiles(e.target.files); e.target.value = ''; }}
                  data-testid="bulk-image-file-input"
                />
              </label>
            </div>
          </div>

          {imageAssignments.length > 0 && (
            <div className="mt-3 rounded-2xl bg-white border border-[#E5E5E5] overflow-hidden" data-testid="bulk-image-assignments">
              <div className="px-4 py-3 border-b border-gray-100 flex items-center justify-between">
                <span className="text-sm font-semibold text-gray-800">
                  {imageAssignments.length} image{imageAssignments.length === 1 ? '' : 's'} ready
                </span>
                <div className="flex gap-2">
                  <button
                    onClick={() => setImageAssignments([])}
                    className="text-xs text-gray-500 hover:text-gray-800 px-2 py-1"
                    data-testid="bulk-image-clear-btn"
                  >
                    Clear
                  </button>
                  <button
                    onClick={submitBulkImages}
                    disabled={bulkImgUploading}
                    className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold text-white disabled:opacity-50"
                    style={{ backgroundColor: '#1E6A6A' }}
                    data-testid="bulk-image-attach-btn"
                  >
                    {bulkImgUploading ? <Loader2 size={12} className="animate-spin" /> : <Check size={12} />}
                    {bulkImgUploading ? 'Attaching...' : `Attach ${imageAssignments.length}`}
                  </button>
                </div>
              </div>
              <div className="divide-y divide-gray-100 max-h-[320px] overflow-auto">
                {imageAssignments.map((a, i) => (
                  <div key={a._id || i} className="flex items-center gap-3 px-4 py-2 hover:bg-gray-50" data-testid={`bulk-image-row-${i}`}>
                    <img
                      src={URL.createObjectURL(a.file)}
                      alt={a.file.name}
                      className="w-12 h-12 rounded-lg object-cover shrink-0"
                      onLoad={(e) => URL.revokeObjectURL(e.target.src)}
                    />
                    <div className="flex-1 min-w-0">
                      <p className="text-xs font-medium text-gray-800 truncate">{a.file.name}</p>
                      <p className="text-[10px] text-gray-400">{(a.file.size / 1024).toFixed(0)} KB</p>
                    </div>
                    <select
                      value={a.propertyId}
                      onChange={(e) => updateAssignment(i, e.target.value)}
                      className="text-xs px-2 py-1.5 rounded-lg border border-gray-200 focus:outline-none focus:border-[#1E6A6A] max-w-[240px]"
                      data-testid={`bulk-image-select-${i}`}
                    >
                      {displayedProperties.map((p) => (
                        <option key={p.id} value={p.id}>{p.title}</option>
                      ))}
                    </select>
                    <button
                      onClick={() => removeAssignment(i)}
                      className="text-gray-400 hover:text-red-500 p-1"
                      data-testid={`bulk-image-remove-${i}`}
                      aria-label="Remove"
                    >
                      <X size={14} />
                    </button>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {displayedProperties.map((property) => (
          <div key={property.id} className="bg-white rounded-2xl border border-[#E5E5E5] overflow-hidden" data-testid={`dashboard-property-${property.id}`}>
            <div
              className="h-48 bg-gray-200 relative"
              style={{ backgroundImage: `url(${propImage(property)})`, backgroundSize: 'cover', backgroundPosition: 'center' }}
            >
              {propIsDefault(property) && (
                <DefaultImageBadge className="!top-3 !left-3" />
              )}
              {propIsVideoCover(property) && <VideoCoverBadge />}
              {isFreshBulkUpload(property) && (
                <span
                  className="absolute top-3 right-3 px-2.5 py-1 rounded-full text-[10px] font-bold tracking-[0.1em] uppercase shadow-md"
                  style={{ backgroundColor: '#D4AF37', color: '#1E6A6A' }}
                  data-testid={`new-badge-${property.id}`}
                  title="Added in the last 24 hours via bulk upload"
                >
                  New
                </span>
              )}
            </div>
            <div className="p-4">
              <h3 className="text-lg font-bold mb-2">{property.title}</h3>
              <p className="text-gray-600 text-sm mb-4">{property.area}</p>
              <div className="flex items-start justify-between gap-2">
                <PriceBlock property={property} t={t} />
                <div className="flex gap-2 shrink-0">
                  <button onClick={() => onEdit(property)} className="p-2 hover:bg-gray-100 rounded-lg" data-testid={`edit-property-${property.id}`}>
                    <Edit size={18} />
                  </button>
                  <button
                    onClick={() => {
                      // Persist where we came from so PropertyDetail's
                      // "Back to Dashboard" button can route back here
                      // instead of dumping the user onto /properties/all.
                      sessionStorage.setItem('previousPath', window.location.pathname);
                      navigate(`/property/${property.id}`);
                    }}
                    className="p-2 hover:bg-gray-100 rounded-lg"
                    data-testid={`view-property-${property.id}`}
                  >
                    <Eye size={18} />
                  </button>
                  <button onClick={() => handleDeleteProperty(property.id)} className="p-2 hover:bg-red-50 rounded-lg text-red-600" data-testid={`delete-property-${property.id}`}>
                    <Trash2 size={18} />
                  </button>
                </div>
              </div>

              {/* Contract Upload for Long-Term/Short-Term */}
              {(property.rental_type === 'long-term' || property.rental_type === 'short-term') && (
                <div className="mt-3 pt-3 border-t border-gray-100">
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-xs font-medium text-gray-700">Property Contract</span>
                    {property.contract_url && (
                      <a
                        href={`${API.replace('/api', '')}${property.contract_url}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-xs text-[#1E6A6A] hover:text-[#D4AF37] flex items-center gap-1"
                      >
                        <FileText size={12} /> View
                      </a>
                    )}
                  </div>
                  <label
                    className="w-full flex items-center justify-center gap-2 px-3 py-2 rounded-lg text-xs font-medium cursor-pointer transition-all border border-dashed"
                    style={{
                      borderColor: property.contract_url ? '#D4AF37' : '#ccc',
                      backgroundColor: property.contract_url ? '#f5f5f0' : 'transparent',
                      color: property.contract_url ? '#1E6A6A' : '#666',
                    }}
                  >
                    <Upload size={14} />
                    {property.contract_url ? 'Replace Contract' : 'Upload Contract'}
                    <input
                      type="file"
                      accept=".pdf,.jpg,.jpeg,.png,.webp,.heic,.heif"
                      className="hidden"
                      onChange={(e) => handleContractUpload(property.id, e.target.files[0], e.target)}
                      data-testid={`upload-contract-${property.id}`}
                    />
                  </label>
                  {property.contract_url && (
                    <button
                      type="button"
                      onClick={(e) => { e.preventDefault(); e.stopPropagation(); handleDeleteContract(property.id); }}
                      className="w-full mt-2 text-xs text-red-500 hover:text-red-700 py-2 border border-red-200 rounded-lg hover:bg-red-50 transition-colors"
                      data-testid={`delete-contract-${property.id}`}
                    >
                      Delete Contract
                    </button>
                  )}
                  <div className="mt-2 flex items-center gap-2 text-[11px] text-gray-500">
                    <span>Need a template?</span>
                    <a href={`${API}/contract-template/en`} target="_blank" rel="noopener noreferrer" className="text-[#1E6A6A] hover:text-[#D4AF37] underline" data-testid={`template-en-${property.id}`}>
                      EN
                    </a>
                    <span className="text-gray-300">·</span>
                    <a href={`${API}/contract-template/he`} target="_blank" rel="noopener noreferrer" className="text-[#1E6A6A] hover:text-[#D4AF37] underline" data-testid={`template-he-${property.id}`}>
                      HE
                    </a>
                  </div>
                </div>
              )}

              {/* iCal Sync for Vacation Properties */}
              {property.rental_type === 'vacation' && (
                <div className="mt-3 pt-3 border-t border-gray-100 space-y-2">
                  {/* Smart Pricing — opens the rules + calendar + forecast modal */}
                  <button
                    onClick={() => setSmartPricingProperty(property)}
                    className="w-full flex items-center justify-center gap-2 px-3 py-2 rounded-lg text-sm font-medium transition-all"
                    style={{
                      backgroundColor: property.smart_pricing?.enabled ? '#1E6A6A' : '#f5f5f0',
                      color: property.smart_pricing?.enabled ? '#D4AF37' : '#1E6A6A',
                    }}
                    data-testid={`smart-pricing-btn-${property.id}`}
                  >
                    <TrendingUp size={15} />
                    Smart Pricing
                    {property.smart_pricing?.enabled && (
                      <span className="text-[10px] font-bold uppercase tracking-wide px-1.5 py-0.5 rounded bg-[#D4AF37] text-white">
                        {property.smart_pricing?.auto_apply ? 'Auto' : 'On'}
                      </span>
                    )}
                  </button>
                  <button
                    onClick={() => openIcalPanel(property.id)}
                    className="w-full flex items-center justify-center gap-2 px-3 py-2 rounded-lg text-sm font-medium transition-all"
                    style={{
                      backgroundColor: icalPanel === property.id ? '#1E6A6A' : '#f5f5f0',
                      color: icalPanel === property.id ? '#D4AF37' : '#1E6A6A',
                    }}
                    data-testid={`ical-toggle-${property.id}`}
                  >
                    <CalendarSync size={15} />
                    {t('property.ical.title')}
                    {property.ical_urls?.length > 0 && (
                      <span className="w-5 h-5 rounded-full text-[10px] flex items-center justify-center font-bold bg-[#D4AF37] text-white">
                        {property.ical_urls.length}
                      </span>
                    )}
                  </button>

                  {icalPanel === property.id && (
                    <div className="mt-3 space-y-3" data-testid={`ical-panel-${property.id}`}>
                      <p className="text-xs text-gray-500">{t('property.ical.subtitle')}</p>
                      <div className="flex gap-2">
                        <input
                          type="url"
                          value={icalUrl}
                          onChange={(e) => setIcalUrl(e.target.value)}
                          placeholder={t('property.ical.urlPlaceholder')}
                          className="flex-1 px-3 py-2 rounded-lg border border-gray-200 text-sm focus:outline-none focus:border-[#D4AF37]"
                          data-testid={`ical-url-input-${property.id}`}
                        />
                        <button
                          onClick={() => addIcalUrl(property.id)}
                          disabled={icalSyncing || !icalUrl.trim()}
                          className="px-3 py-2 rounded-lg text-sm font-medium text-white disabled:opacity-40"
                          style={{ backgroundColor: '#1E6A6A' }}
                          data-testid={`ical-add-btn-${property.id}`}
                        >
                          {icalSyncing ? t('property.ical.syncing') : t('property.ical.add')}
                        </button>
                      </div>

                      {property.ical_urls?.length > 0 ? (
                        <div className="space-y-1.5">
                          {property.ical_urls.map((url, i) => (
                            <div key={url} className="flex items-center gap-2 px-3 py-2 rounded-lg bg-gray-50 text-xs">
                              <Link2 size={12} className="text-[#D4AF37] shrink-0" />
                              <span className="flex-1 truncate text-gray-600">{url}</span>
                              <button onClick={() => removeIcalUrl(property.id, url)} className="text-red-400 hover:text-red-600 shrink-0" data-testid={`ical-remove-${i}`}>
                                <X size={14} />
                              </button>
                            </div>
                          ))}
                        </div>
                      ) : (
                        <p className="text-xs text-gray-400 text-center py-2">{t('property.ical.noUrls')}</p>
                      )}

                      {icalData[property.id] && (
                        <div className="flex items-center justify-between text-xs text-gray-500">
                          <span>{icalData[property.id].external?.length || 0} {t('property.ical.blockedDates')}</span>
                          <button onClick={() => manualSync(property.id)} disabled={icalSyncing} className="flex items-center gap-1 text-[#D4AF37] hover:underline disabled:opacity-40" data-testid={`ical-sync-btn-${property.id}`}>
                            <RefreshCw size={12} className={icalSyncing ? 'animate-spin' : ''} />
                            {t('property.ical.autoSync')}
                          </button>
                        </div>
                      )}

                      <div className="pt-2 border-t border-gray-100">
                        <p className="text-xs font-medium text-gray-700 mb-1">{t('property.ical.exportTitle')}</p>
                        <p className="text-[11px] text-gray-400 mb-2">{t('property.ical.exportDesc')}</p>
                        <button
                          onClick={() => copyExportUrl(property.id)}
                          className="w-full flex items-center justify-center gap-2 px-3 py-2 rounded-lg border border-gray-200 text-sm hover:border-[#D4AF37] transition-colors"
                          data-testid={`ical-export-btn-${property.id}`}
                        >
                          {copiedExport ? <Check size={14} className="text-green-500" /> : <Copy size={14} className="text-gray-500" />}
                          <span className="text-gray-700">{copiedExport ? t('property.ical.copied') : t('property.ical.copyUrl')}</span>
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>
        ))}
      </div>
      <SmartPricingModal
        isOpen={!!smartPricingProperty}
        onClose={() => {
          setSmartPricingProperty(null);
          // Re-fetch so the "On / Auto" pill flips immediately after the
          // user toggles Smart Pricing in the modal.
          onRefresh && onRefresh();
        }}
        property={smartPricingProperty}
        API={API}
        token={token}
      />
    </div>
  );
};

export default PropertyList;
