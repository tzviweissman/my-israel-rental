import React, { useState, useEffect, useRef } from 'react';
import { useTranslation } from 'react-i18next';
import axios from 'axios';
import { toast } from 'sonner';

import { Sparkles, X, AlertTriangle, ArrowRight } from 'lucide-react';

import DateField from './propertyForm/DateField';
import LocationPicker from './propertyForm/LocationPicker';
import MediaUploadSection from './propertyForm/MediaUploadSection';
import PropertyServicesSelector from '../property/services/PropertyServicesSelector';
import { nextHolidayWindow } from '../../utils/holidayCalendar';

const EMPTY_FORM = {
  title: '', description: '', rental_type: 'long-term', property_type: 'apartment',
  bedrooms: 1, bathrooms: 1, area: '', address: '', square_meters: '', porch_square_meters: '',
  floor: 1, has_elevator: false, is_shabbat_elevator: false, is_tama: false,
  has_agent_fee: false, agent_fee_price: '', agent_fee_currency: 'ILS',
  has_cleaning_fee: false, cleaning_fee_price: '', cleaning_fee_currency: 'ILS',
  max_guests: '',
  porches: 0, sukkah_compatible: false, condition: 'renovated', furniture_option: 'no_furniture',
  amenities: [], monthly_price: '', nightly_price: '', currency: 'ILS',
  images: [], videos: [], cancellation_policy: 'flexible', custom_cancellation_policy: '',
  available_from: '', available_to: '', starting_date: '', minimum_booking_days: '',
  holiday_tags: [],
  holiday_lump_price: '',
  holiday_lump_currency: 'ILS',
  // When true, `holiday_lump_price` is a per-night rate during the holiday
  // window rather than the lump total. Lets owners charge a holiday-night
  // premium without committing to a fixed package price.
  holiday_lump_is_per_night: false,
  // Multi-list — extra rental types this same apartment surfaces under.
  // Primary `rental_type` is always included implicitly by the backend.
  // Example: `rental_type='short-term', rental_types=['short-term','vacation']`
  // → shows in Short-term AND in Vacation feeds (for Sukkot travelers).
  rental_types: [],
  // Instant book vs request to book. `null` means "not chosen" and is NOT
  // the same as false — the backend falls back to its legacy rule (vacation
  // rentals confirm instantly, everything else is a request) until the lister
  // actually picks. Keep it null here so opening the form doesn't itself
  // count as a choice.
  instant_booking: null,
  // Holiday window — when set, the primary monthly/nightly booking flow
  // rejects overlaps with these dates and steers renters to the holiday
  // lump price. Owners can auto-fill this from the Jewish calendar.
  holiday_start_date: '',
  holiday_end_date: '',
};

/**
 * Add/Edit Property modal — self-contained. Hydrates from `editingProperty`
 * prop when editing, otherwise starts from EMPTY_FORM.
 */
const AddPropertyModal = ({ isOpen, onClose, editingProperty, onSaved, API, token }) => {
  const { t } = useTranslation();
  const [propertyForm, setPropertyForm] = useState(EMPTY_FORM);
  const [uploadedFiles, setUploadedFiles] = useState([]);
  // Ref to the custom cancellation policy textarea so we can scroll it into
  // view + auto-focus when the owner picks "Custom" — otherwise it renders
  // below the visible modal area and users assume it's missing.
  const customCancelRef = useRef(null);

  // Scroll + focus the custom cancellation textarea the moment it appears.
  useEffect(() => {
    if (propertyForm.cancellation_policy === 'custom' && customCancelRef.current) {
      // Wait a tick so the textarea is in the DOM
      const id = window.setTimeout(() => {
        customCancelRef.current?.scrollIntoView({ behavior: 'smooth', block: 'center' });
        customCancelRef.current?.focus();
      }, 50);
      return () => window.clearTimeout(id);
    }
  }, [propertyForm.cancellation_policy]);

  // Smart paste — paste a free-form description (WhatsApp, email, etc.)
  // and let Claude extract structured fields. Only shown for new properties,
  // never for edits (we don't want to silently clobber a saved listing).
  const [smartPaste, setSmartPaste] = useState('');
  const [smartPasting, setSmartPasting] = useState(false);

  // ── Soft duplicate warning ─────────────────────────────────────────
  // As the host types their address (or edits an existing listing's
  // address to a new one), we debounce-poll `/properties/check-duplicate`
  // so we can surface a "you already have a listing here" banner BEFORE
  // they hit Submit. The backend still enforces the block at submit
  // time, but catching it here saves the round-trip + confusion.
  const [duplicateWarning, setDuplicateWarning] = useState(null);
  // Guards against double-submit. The backend dedupe check is
  // read-then-insert with no unique index, so two racing POSTs (an
  // impatient double-click on a slow connection) both pass the check and
  // both insert — creating exactly the duplicate listings this modal is
  // supposed to prevent.
  const [submitting, setSubmitting] = useState(false);
  useEffect(() => {
    // Only poll once the host has provided the minimum signature fields.
    // Empty/short addresses would either 400 or false-negative — skip.
    const addr = (propertyForm.address || '').trim();
    const rt = propertyForm.rental_type;
    if (!isOpen || !addr || addr.length < 4 || !rt) {
      setDuplicateWarning(null);
      return;
    }

    const timer = setTimeout(async () => {
      try {
        const params = new URLSearchParams({ address: addr, rental_type: rt });
        if (propertyForm.bedrooms != null && propertyForm.bedrooms !== '') {
          params.set('bedrooms', String(propertyForm.bedrooms));
        }
        if (propertyForm.floor != null && propertyForm.floor !== '') {
          params.set('floor', String(propertyForm.floor));
        }
        // When editing, exclude the row itself so we don't flag it against
        // its own signature.
        if (editingProperty?.id) params.set('exclude_property_id', editingProperty.id);

        const res = await axios.get(`${API}/properties/check-duplicate?${params.toString()}`, {
          headers: { Authorization: `Bearer ${token}` },
        });
        setDuplicateWarning(res.data?.duplicate || null);
      } catch {
        // Non-fatal — a network hiccup here shouldn't get in the host's
        // way. Silently drop the warning; the submit-time block is still
        // authoritative.
        setDuplicateWarning(null);
      }
    }, 500);

    return () => clearTimeout(timer);
  }, [
    isOpen, propertyForm.address, propertyForm.rental_type,
    propertyForm.bedrooms, propertyForm.floor,
    editingProperty?.id, API, token,
  ]);

  const handleSmartPaste = async () => {
    if (!smartPaste.trim()) {
      toast.error('Paste some property text first');
      return;
    }
    setSmartPasting(true);
    try {
      const res = await axios.post(
        `${API}/properties/bulk/extract`,
        { text: smartPaste },
        { headers: { Authorization: `Bearer ${token}` } },
      );
      const extracted = (res.data.properties || [])[0];
      if (!extracted) {
        toast.error('Could not find a property in that text');
        return;
      }
      // Merge extracted fields into the current form, keeping defaults for
      // anything Claude didn't populate.
      const merged = { ...propertyForm };
      for (const [k, v] of Object.entries(extracted)) {
        if (v === null || v === undefined) continue;
        merged[k] = v;
      }
      if (typeof merged.amenities === 'string') {
        merged.amenities = merged.amenities.split(/[,;]/).map(a => a.trim()).filter(Boolean);
      } else if (!Array.isArray(merged.amenities)) {
        merged.amenities = [];
      }
      // Shabbat elevator implies regular elevator (backend does this for
      // bulk uploads — replicate here so the UI stays consistent pre-save).
      if (merged.is_shabbat_elevator) merged.has_elevator = true;
      setPropertyForm(merged);
      setSmartPaste('');
      toast.success('Filled in fields — review and save');
    } catch (e) {
      toast.error(e.response?.data?.detail || 'AI extraction failed');
    } finally {
      setSmartPasting(false);
    }
  };

  // Hydrate form whenever the caller supplies an editingProperty
  useEffect(() => {
    if (!isOpen) return;
    if (editingProperty) {
      setPropertyForm({
        title: editingProperty.title || '',
        description: editingProperty.description || '',
        rental_type: editingProperty.rental_type || 'long-term',
        property_type: editingProperty.property_type || 'apartment',
        bedrooms: editingProperty.bedrooms || 1,
        bathrooms: editingProperty.bathrooms || 1,
        area: editingProperty.area || '',
        address: editingProperty.address || '',
        square_meters: editingProperty.square_meters || '',
        porch_square_meters: editingProperty.porch_square_meters || '',
        floor: editingProperty.floor || 1,
        has_elevator: editingProperty.has_elevator || false,
        is_shabbat_elevator: editingProperty.is_shabbat_elevator || false,
        is_tama: editingProperty.is_tama || false,
        has_agent_fee: editingProperty.has_agent_fee || false,
        agent_fee_price: editingProperty.agent_fee_price || '',
        agent_fee_currency: editingProperty.agent_fee_currency || 'ILS',
        has_cleaning_fee: editingProperty.has_cleaning_fee || false,
        cleaning_fee_price: editingProperty.cleaning_fee_price || '',
        cleaning_fee_currency: editingProperty.cleaning_fee_currency || 'ILS',
        max_guests: editingProperty.max_guests || '',
        porches: editingProperty.porches || 0,
        sukkah_compatible: editingProperty.sukkah_compatible || false,
        condition: editingProperty.condition || 'renovated',
        furniture_option: editingProperty.furniture_option || 'no_furniture',
        amenities: editingProperty.amenities || [],
        monthly_price: editingProperty.monthly_price || '',
        nightly_price: editingProperty.nightly_price || '',
        currency: editingProperty.currency || 'ILS',
        images: editingProperty.images || [],
        videos: editingProperty.videos || [],
        cancellation_policy: editingProperty.cancellation_policy || 'flexible',
        custom_cancellation_policy: editingProperty.custom_cancellation_policy || '',
        available_from: editingProperty.available_from || '',
        available_to: editingProperty.available_to || '',
        starting_date: editingProperty.starting_date || '',
        minimum_booking_days: editingProperty.minimum_booking_days ? String(editingProperty.minimum_booking_days) : '',
        holiday_tags: editingProperty.holiday_tags || [],
        holiday_lump_price: editingProperty.holiday_lump_price || '',
        holiday_lump_currency: editingProperty.holiday_lump_currency || 'ILS',
        holiday_lump_is_per_night: !!editingProperty.holiday_lump_is_per_night,
        // Multi-list + holiday window hydration — legacy rows won't have
        // these so default to a safe empty state.
        rental_types: editingProperty.rental_types || [],
        // `??` and not `||`: false is a real choice here ("request to book")
        // and `||` would quietly turn it back into null, i.e. "not chosen",
        // handing the listing back to the legacy vacation rule on every edit.
        instant_booking: editingProperty.instant_booking ?? null,
        holiday_start_date: editingProperty.holiday_start_date || '',
        holiday_end_date: editingProperty.holiday_end_date || '',
      });
      setUploadedFiles([
        ...(editingProperty.images || []).map((url, i) => ({ url, file_type: 'image', filename: url.split('/').pop(), original_name: `Image ${i + 1}` })),
        ...(editingProperty.videos || []).map((url, i) => ({ url, file_type: 'video', filename: url.split('/').pop(), original_name: `Video ${i + 1}` })),
      ]);
    } else {
      // Default starting/available date to today on a fresh add. The user
      // can override it via the calendar picker; this just removes a step
      // for the common case of "list it now, available immediately".
      const today = new Date();
      const todayIso = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`;
      setPropertyForm({
        ...EMPTY_FORM,
        available_from: todayIso,
        starting_date: todayIso,
      });
      setUploadedFiles([]);
    }
  }, [isOpen, editingProperty]);

  const authHeaders = { headers: { Authorization: `Bearer ${token}` } };

  // Compute which required fields the user hasn't filled yet, so we can
  // surface a proactive hint right above the Submit button instead of
  // relying on the browser's per-field validation popup (which only
  // shows one field at a time and looks alien to the app's design).
  const missingRequiredFields = React.useMemo(() => {
    const missing = [];
    if (!(propertyForm.title || '').trim()) missing.push('Title');
    if (!(propertyForm.area || '').trim()) missing.push('Area / city');
    // A listing needs A price, not specifically the regular one. Someone who
    // only rents over Pesach sets a holiday rate and leaves the nightly rate
    // blank; someone who never touches holidays does the reverse. Requiring
    // the regular price unconditionally made the holiday-only case
    // impossible to submit — the Add button just stayed disabled, naming a
    // field the lister had deliberately left empty.
    const hasRegularPrice = propertyForm.rental_type === 'long-term'
      ? Number(propertyForm.monthly_price) > 0
      : Number(propertyForm.nightly_price) > 0;
    const hasHolidayPrice =
      (propertyForm.holiday_tags || []).length > 0 &&
      Number(propertyForm.holiday_lump_price) > 0;
    if (!hasRegularPrice && !hasHolidayPrice) {
      missing.push(propertyForm.rental_type === 'long-term'
        ? 'Monthly price (or a holiday rate)'
        : 'Nightly price (or a holiday rate)');
    }
    if (propertyForm.rental_type === 'long-term' && !propertyForm.starting_date) {
      missing.push('Starting date');
    }
    return missing;
  // holiday_tags / holiday_lump_price belong here now that they can satisfy
  // the price requirement. Without them the memo wouldn't recompute when a
  // lister typed a holiday rate, so the Submit button would stay disabled —
  // still naming the nightly price — until some unrelated field changed.
  }, [propertyForm.title, propertyForm.area, propertyForm.monthly_price,
      propertyForm.nightly_price, propertyForm.starting_date,
      propertyForm.rental_type, propertyForm.holiday_tags,
      propertyForm.holiday_lump_price]);
  const canSubmit = missingRequiredFields.length === 0;

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (submitting) return;
    setSubmitting(true);
    const toNumOrNull = (v) => (v === '' || v === null || v === undefined ? null : Number(v));
    const toIntOrNull = (v) => {
      if (v === '' || v === null || v === undefined) return null;
      const n = parseInt(v, 10);
      return Number.isNaN(n) ? null : n;
    };
    const cleaned = {
      ...propertyForm,
      square_meters: toNumOrNull(propertyForm.square_meters),
      porch_square_meters: toNumOrNull(propertyForm.porch_square_meters),
      agent_fee_price: toNumOrNull(propertyForm.agent_fee_price),
      cleaning_fee_price: toNumOrNull(propertyForm.cleaning_fee_price),
      max_guests: toNumOrNull(propertyForm.max_guests),
      monthly_price: toNumOrNull(propertyForm.monthly_price),
      nightly_price: toNumOrNull(propertyForm.nightly_price),
      bedrooms: toNumOrNull(propertyForm.bedrooms),
      bathrooms: toNumOrNull(propertyForm.bathrooms),
      floor: toNumOrNull(propertyForm.floor),
      porches: toIntOrNull(propertyForm.porches) ?? 0,
      minimum_booking_days: toIntOrNull(propertyForm.minimum_booking_days),
      holiday_lump_price: toNumOrNull(propertyForm.holiday_lump_price),
      holiday_lump_is_per_night: !!propertyForm.holiday_lump_is_per_night,
    };
    try {
      if (editingProperty?.id) {
        await axios.put(`${API}/properties/${editingProperty.id}`, cleaned, authHeaders);
        toast.success('Property updated successfully!');
      } else {
        await axios.post(`${API}/properties`, cleaned, authHeaders);
        toast.success('Property added successfully!');
      }
      onSaved && (await onSaved());
      onClose();
    } catch (error) {
      const detail = error?.response?.data?.detail;
      let msg = editingProperty?.id ? 'Failed to update property' : 'Failed to add property';
      // Duplicate-listing 409 returns a structured detail object with a
      // human message we can surface directly — no need to wrap it.
      if (detail && typeof detail === 'object' && detail.code === 'DUPLICATE_LISTING') {
        toast.error(detail.message, { duration: 7000 });
        return;
      }
      if (Array.isArray(detail) && detail[0]?.msg) {
        msg = `${msg}: ${detail[0].loc?.slice(1).join('.') || 'field'} — ${detail[0].msg}`;
      } else if (typeof detail === 'string') {
        msg = `${msg}: ${detail}`;
      }
      toast.error(msg);
    } finally {
      setSubmitting(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-[70] p-2 md:p-6" data-testid="add-property-modal">
      <div className="relative bg-white rounded-2xl p-4 md:p-8 max-w-4xl w-full max-h-[90vh] overflow-y-auto overflow-x-hidden">
        <button
          type="button"
          onClick={onClose}
          className="sticky top-0 float-right -mt-3 -me-3 z-10 p-2 rounded-full bg-white/95 backdrop-blur-sm border border-gray-200 text-gray-500 hover:text-gray-900 hover:bg-gray-50 shadow-sm transition-colors"
          aria-label="Close"
          data-testid="add-property-close-x"
        >
          <X size={18} />
        </button>
        <h2 className="text-3xl font-bold mb-6" style={{ fontFamily: 'Playfair Display' }}>
          {editingProperty && editingProperty.id ? t('dashboard.editProperty') : t('dashboard.addNewProperty')}
        </h2>
        <form onSubmit={handleSubmit} className="space-y-6">
          {/* Photos/videos first so users see the most engaging step at the
              top of the form, then fill in the remaining details below. */}
          <MediaUploadSection
            form={propertyForm}
            setForm={setPropertyForm}
            uploadedFiles={uploadedFiles}
            setUploadedFiles={setUploadedFiles}
            API={API}
            token={token}
          />

          {!editingProperty?.id && (
            <div
              className="p-4 rounded-xl bg-gradient-to-br from-[rgb(var(--brand-primary-rgb)/<alpha-value>)]/5 to-[rgb(var(--gold-rgb)/<alpha-value>)]/10 border border-[rgb(var(--brand-primary-rgb)/<alpha-value>)]/20"
              data-testid="smart-paste-panel"
            >
              <div className="flex items-start gap-2 mb-2">
                <Sparkles size={18} className="text-[var(--gold)] mt-0.5 shrink-0" />
                <div>
                  <h3 className="text-sm font-semibold">AI smart paste</h3>
                  <p className="text-xs text-gray-600">
                    Paste a property description from WhatsApp, email, a listing site — anything. Claude reads it and pre-fills the form below.
                  </p>
                </div>
              </div>
              <textarea
                value={smartPaste}
                onChange={(e) => setSmartPaste(e.target.value)}
                placeholder='e.g. "2BR for rent in Rechavia, 4th floor, shabbat elevator, fully furnished, 7,500₪/mo, available October 1. Great area, near supermarket. WhatsApp 050-XXX-XXXX."'
                rows={smartPaste ? 5 : 2}
                className="w-full px-3 py-2 rounded-lg border border-[#E5E5E5] focus:outline-none focus:ring-2 focus:ring-[rgb(var(--brand-primary-rgb)/<alpha-value>)]/50 text-sm bg-white/80"
                maxLength={30000}
                data-testid="smart-paste-input"
              />
              <div className="flex items-center justify-between mt-2">
                <p className="text-[11px] text-gray-500">{smartPaste.length.toLocaleString()} / 30,000 characters</p>
                <button
                  type="button"
                  onClick={handleSmartPaste}
                  disabled={smartPasting || !smartPaste.trim()}
                  className="px-4 py-1.5 rounded-lg bg-[var(--brand-primary)] text-white text-sm font-semibold hover:bg-[#175757] transition-colors disabled:opacity-50 disabled:cursor-not-allowed inline-flex items-center gap-1.5"
                  data-testid="smart-paste-btn"
                >
                  <Sparkles size={14} />
                  {smartPasting ? 'Reading…' : 'Extract & fill'}
                </button>
              </div>
            </div>
          )}

          <div>
            <label className="block text-sm font-medium mb-2">Title</label>
            <input
              type="text"
              value={propertyForm.title}
              onChange={(e) => setPropertyForm({ ...propertyForm, title: e.target.value })}
              className="w-full px-4 py-2 rounded-lg border border-[#E5E5E5] focus:outline-none focus:ring-2 focus:ring-[rgb(var(--brand-primary-rgb)/<alpha-value>)]/50"
              required
              data-testid="property-title-input"
            />
          </div>

          <div>
            <label className="block text-sm font-medium mb-2">Description</label>
            <textarea
              value={propertyForm.description}
              onChange={(e) => setPropertyForm({ ...propertyForm, description: e.target.value })}
              rows="4"
              className="w-full px-4 py-2 rounded-lg border border-[#E5E5E5] focus:outline-none focus:ring-2 focus:ring-[rgb(var(--brand-primary-rgb)/<alpha-value>)]/50"
              data-testid="property-description-input"
            ></textarea>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div>
              <label className="block text-sm font-medium mb-2">{t('property.rentalType')}</label>
              <select
                value={propertyForm.rental_type}
                onChange={(e) => {
                  // Clear the price field that belongs to the OLD rental
                  // type. Otherwise a value entered under (say) `vacation`
                  // stays stranded in `nightly_price` after switching to
                  // `long-term`, and the "Repair prices" admin tool later
                  // migrates it into `monthly_price` — producing wildly
                  // low "monthly rent" values on the listings table.
                  const nextType = e.target.value;
                  const oldType = propertyForm.rental_type;
                  const patch = { rental_type: nextType };
                  if (oldType !== nextType) {
                    const oldWasNightly = oldType === 'vacation';
                    const newIsNightly = nextType === 'vacation';
                    if (oldWasNightly !== newIsNightly) {
                      // Zero the stranded field to force a fresh price entry.
                      patch.nightly_price = newIsNightly ? propertyForm.nightly_price : '';
                      patch.monthly_price = newIsNightly ? '' : propertyForm.monthly_price;
                    }
                  }
                  setPropertyForm({ ...propertyForm, ...patch });
                }}
                className="w-full px-4 py-2 rounded-lg border border-[#E5E5E5] focus:outline-none focus:ring-2 focus:ring-[rgb(var(--brand-primary-rgb)/<alpha-value>)]/50"
                data-testid="property-rental-type-select"
              >
                <option value="long-term">{t('property.longTerm')}</option>
                <option value="short-term">{t('property.shortTerm')}</option>
                <option value="vacation">{t('property.vacationType')}</option>
              </select>
            </div>
            {propertyForm.rental_type !== 'storage' && (
              <div>
                <label className="block text-sm font-medium mb-2">{t('property.propertyType')}</label>
                <select
                  value={propertyForm.property_type}
                  onChange={(e) => setPropertyForm({ ...propertyForm, property_type: e.target.value })}
                  className="w-full px-4 py-2 rounded-lg border border-[#E5E5E5] focus:outline-none focus:ring-2 focus:ring-[rgb(var(--brand-primary-rgb)/<alpha-value>)]/50"
                  data-testid="property-type-select"
                >
                  <option value="apartment">{t('property.apartment')}</option>
                  <option value="house">{t('property.house')}</option>
                  <option value="villa">Villa</option>
                </select>
              </div>
            )}
            <LocationPicker
              value={propertyForm.area}
              onChange={(area) => setPropertyForm({ ...propertyForm, area })}
              required
            />
            <div>
              <label className="block text-sm font-medium mb-2">{t('property.address')}</label>
              <input
                type="text"
                value={propertyForm.address}
                onChange={(e) => setPropertyForm({ ...propertyForm, address: e.target.value })}
                className="w-full px-4 py-2 rounded-lg border border-[#E5E5E5] focus:outline-none focus:ring-2 focus:ring-[rgb(var(--brand-primary-rgb)/<alpha-value>)]/50"
                data-testid="property-address-input"
              />
              {duplicateWarning && (
                <div
                  className="mt-2 flex items-start gap-2 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-sm"
                  data-testid="duplicate-warning-banner"
                >
                  <AlertTriangle size={16} className="mt-0.5 text-amber-600 shrink-0" />
                  <div className="flex-1 min-w-0">
                    <div className="font-semibold text-amber-900">
                      {t(
                        'property.duplicateWarning.title',
                        'You already have a listing at this address',
                      )}
                    </div>
                    <div className="text-xs text-amber-700 mt-0.5 truncate">
                      {duplicateWarning.title}
                      {duplicateWarning.rental_type ? ` · ${duplicateWarning.rental_type}` : ''}
                      {duplicateWarning.bedrooms != null ? ` · ${duplicateWarning.bedrooms} BR` : ''}
                    </div>
                  </div>
                  <a
                    href={`/property/${duplicateWarning.id}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-1 text-xs font-semibold text-amber-900 hover:text-amber-950 underline shrink-0"
                    data-testid="duplicate-warning-view-existing"
                  >
                    {t('property.duplicateWarning.viewExisting', 'View existing')}
                    <ArrowRight size={12} />
                  </a>
                </div>
              )}
            </div>
            <div>
              <label className="block text-sm font-medium mb-2">{t('property.sqm')}</label>
              <input
                type="number"
                value={propertyForm.square_meters}
                onChange={(e) => setPropertyForm({ ...propertyForm, square_meters: parseFloat(e.target.value) || '' })}
                min="0"
                step="0.1"
                placeholder={propertyForm.rental_type === 'storage' ? 'Storage area size' : 'Total apartment size'}
                className="w-full px-4 py-2 rounded-lg border border-[#E5E5E5] focus:outline-none focus:ring-2 focus:ring-[rgb(var(--brand-primary-rgb)/<alpha-value>)]/50"
                data-testid="property-sqm-input"
              />
            </div>
            {propertyForm.rental_type !== 'storage' && (
              <div>
                <label className="block text-sm font-medium mb-2">{t('property.bedrooms')}</label>
                <select
                  value={propertyForm.bedrooms}
                  onChange={(e) => setPropertyForm({ ...propertyForm, bedrooms: parseFloat(e.target.value) })}
                  className="w-full px-4 py-2 rounded-lg border border-[#E5E5E5] focus:outline-none focus:ring-2 focus:ring-[rgb(var(--brand-primary-rgb)/<alpha-value>)]/50"
                  data-testid="property-bedrooms-input"
                >
                  <option value="0">Studio</option>
                  {[1, 1.5, 2, 2.5, 3, 3.5, 4, 4.5, 5, 5.5, 6, 6.5, 7].map((n) => (
                    <option key={n} value={n}>{n}</option>
                  ))}
                  <option value="8">8+</option>
                </select>
              </div>
            )}
            {propertyForm.rental_type !== 'storage' && (
              <div>
                <label className="block text-sm font-medium mb-2">{t('property.bathrooms')}</label>
                <select
                  value={propertyForm.bathrooms}
                  onChange={(e) => setPropertyForm({ ...propertyForm, bathrooms: parseFloat(e.target.value) })}
                  className="w-full px-4 py-2 rounded-lg border border-[#E5E5E5] focus:outline-none focus:ring-2 focus:ring-[rgb(var(--brand-primary-rgb)/<alpha-value>)]/50"
                  data-testid="property-bathrooms-input"
                >
                  {[1, 1.5, 2, 2.5, 3, 3.5, 4, 4.5, 5, 5.5].map((n) => (
                    <option key={n} value={n}>{n}</option>
                  ))}
                  <option value="6">6+</option>
                </select>
              </div>
            )}
            <div>
              <label className="block text-sm font-medium mb-2">{t('property.floor')}</label>
              <select
                value={propertyForm.floor}
                onChange={(e) => setPropertyForm({ ...propertyForm, floor: parseFloat(e.target.value) })}
                className="w-full px-4 py-2 rounded-lg border border-[#E5E5E5] focus:outline-none focus:ring-2 focus:ring-[rgb(var(--brand-primary-rgb)/<alpha-value>)]/50"
                data-testid="property-floor-input"
              >
                <option value="-2">Basement 2</option>
                <option value="-1">Basement 1</option>
                <option value="0">{t('property.groundFloor')}</option>
                {[1, 1.5, 2, 2.5, 3, 3.5, 4, 4.5, 5, 5.5, 6, 6.5, 7, 7.5, 8, 8.5, 9, 9.5, 10, 11, 12, 13, 14, 15].map((n) => (
                  <option key={n} value={n}>{n}</option>
                ))}
                <option value="20">20+</option>
              </select>
            </div>



            {/* ── Holidays (optional) ──────────────────────────────────────
                Tag, date window and holiday rate are ONE card: ticking
                "Sukkot Rental" should answer every Sukkot question in one
                place. It used to put the regular price in between, so the
                rate box read as though it belonged to a different question. */}
            {/* Holiday Categories — available on ANY rental_type so a
                short-term monthly listing can ALSO surface under vacation
                for Sukkot / Pesach at a different lump price. When any
                tag is checked we implicitly add `vacation` to the
                property's `rental_types` array so the same physical
                apartment appears in BOTH feeds. */}
            {propertyForm.rental_type !== 'sublease' && (
              <div className="md:col-span-2 bg-[#FBF8F2] rounded-xl p-4 border border-[rgb(var(--gold-rgb)/<alpha-value>)]/30">
                <h3 className="text-base font-bold mb-1 text-[var(--brand-primary)]">{t('sweep.holidayCategories', 'Holiday Categories')}</h3>
                <p className="text-xs text-gray-500 mb-3">
                  Optional — tag this listing so it also shows under <span className="font-medium">Sukkot Rentals</span> or <span className="font-medium">Pesach Rentals</span>. Unlocks a separate one-price-for-the-whole-holiday rate below AND auto-lists this apartment under Vacation Rentals during the holiday window.
                </p>
                <div className="flex flex-wrap gap-2">
                  {[
                    { key: 'sukkot', label: 'Sukkot Rental' },
                    { key: 'pesach', label: 'Pesach Rental' },
                  ].map(({ key, label }) => {
                    const checked = (propertyForm.holiday_tags || []).includes(key);
                    return (
                      <label
                        key={key}
                        className={`flex items-center gap-2 px-3 py-2 rounded-lg border-2 cursor-pointer transition-all text-sm ${
                          checked
                            ? 'border-[var(--gold)] bg-[rgb(var(--gold-rgb)/<alpha-value>)]/15 text-[var(--brand-primary)]'
                            : 'bg-white border-gray-200 hover:border-[rgb(var(--gold-rgb)/<alpha-value>)]/40 text-gray-600'
                        }`}
                        data-testid={`holiday-tag-${key}`}
                      >
                        <input
                          type="checkbox"
                          className="w-4 h-4 accent-[var(--brand-primary)]"
                          checked={checked}
                          onChange={(e) => {
                            const current = propertyForm.holiday_tags || [];
                            const next = e.target.checked
                              ? [...current, key]
                              : current.filter((tag) => tag !== key);
                            // Auto-fill dates + auto-add 'vacation' to
                            // rental_types when a tag is added. When all
                            // tags cleared, also clear the lump price and
                            // the date window so the listing UI doesn't
                            // show a stale holiday card.
                            const patch = { holiday_tags: next };
                            if (next.length === 0) {
                              patch.holiday_lump_price = '';
                              patch.holiday_lump_currency = 'ILS';
                              patch.holiday_start_date = '';
                              patch.holiday_end_date = '';
                              patch.rental_types = (propertyForm.rental_types || [])
                                .filter((t) => t !== 'vacation');
                            } else {
                              const win = nextHolidayWindow(next);
                              if (win) {
                                // Only auto-fill blanks — never overwrite an
                                // owner's explicit choice (e.g. they included
                                // extra Chol HaMoed days on purpose).
                                if (!propertyForm.holiday_start_date) patch.holiday_start_date = win.start;
                                if (!propertyForm.holiday_end_date)   patch.holiday_end_date   = win.end;
                              }
                              // Merge 'vacation' into rental_types so the
                              // listing appears in the vacation feed too.
                              const existing = new Set(propertyForm.rental_types || []);
                              if (propertyForm.rental_type !== 'vacation') existing.add('vacation');
                              patch.rental_types = [...existing];
                            }
                            setPropertyForm({ ...propertyForm, ...patch });
                          }}
                        />
                        <span className="font-medium">{label}</span>
                      </label>
                    );
                  })}
                </div>

                {(propertyForm.holiday_tags || []).length > 0 && (
                  <div className="mt-4 grid grid-cols-1 sm:grid-cols-2 gap-3" data-testid="holiday-window-row">
                    <DateField
                      label="Holiday window — start"
                      value={propertyForm.holiday_start_date}
                      onChange={(v) => setPropertyForm({ ...propertyForm, holiday_start_date: v })}
                      variant="gold"
                      emoji="🕎"
                      helperText="Auto-filled from the Jewish calendar. Adjust to include Chol HaMoed if you like."
                      testid="property-holiday-start"
                    />
                    <DateField
                      label="Holiday window — end"
                      value={propertyForm.holiday_end_date}
                      onChange={(v) => setPropertyForm({ ...propertyForm, holiday_end_date: v })}
                      variant="gold"
                      emoji="🍯"
                      helperText="Bookings under the regular rate will be blocked during this window."
                      testid="property-holiday-end"
                    />
                    <button
                      type="button"
                      className="sm:col-span-2 self-start text-[11px] font-semibold text-[var(--brand-primary)] hover:underline"
                      onClick={() => {
                        const win = nextHolidayWindow(propertyForm.holiday_tags);
                        if (!win) return;
                        setPropertyForm({
                          ...propertyForm,
                          holiday_start_date: win.start,
                          holiday_end_date: win.end,
                        });
                      }}
                      data-testid="holiday-autofill-btn"
                    >
                      Reset to Jewish-calendar defaults →
                    </button>
                  </div>
                )}
            {(propertyForm.holiday_tags || []).length > 0 && (() => {
              const tagsLabel = (propertyForm.holiday_tags || [])
                .map((tag) => tag.charAt(0).toUpperCase() + tag.slice(1))
                .join(' / ');
              const isPerNight = !!propertyForm.holiday_lump_is_per_night;
              return (
                <div className="mt-4 pt-4 border-t border-[rgb(var(--gold-rgb)/<alpha-value>)]/40" data-testid="holiday-rate-block">
                  <div className="flex items-start justify-between gap-3 flex-wrap mb-3">
                    <div className="min-w-0">
                      <h4 className="text-sm font-bold text-[var(--brand-primary)]">{tagsLabel} rate</h4>
                      <p className="text-xs text-gray-500 mt-0.5">
                        Renters browsing {tagsLabel} rentals see this price.
                        {propertyForm.rental_type === 'vacation'
                          ? ' Other vacation renters see the regular per-night rate above.'
                          : ` During the holiday window (${propertyForm.holiday_start_date || '—'} → ${propertyForm.holiday_end_date || '—'}), the regular ${propertyForm.rental_type === 'long-term' ? 'monthly' : 'per-night'} rate is blocked so nobody grabs a bargain over the holidays.`}
                      </p>
                    </div>
                    <div className="inline-flex items-center gap-1 p-1 rounded-lg bg-white border border-[rgb(var(--gold-rgb)/<alpha-value>)]/30" data-testid="holiday-price-mode-toggle">
                      <button
                        type="button"
                        onClick={() => setPropertyForm({ ...propertyForm, holiday_lump_is_per_night: false })}
                        className="px-3 py-1 rounded-md text-xs font-semibold transition-all"
                        style={{
                          backgroundColor: !isPerNight ? 'var(--brand-primary)' : 'transparent',
                          color: !isPerNight ? '#FFFFFF' : 'var(--brand-primary)',
                        }}
                        data-testid="holiday-mode-lump-btn"
                      >Total for whole holiday</button>
                      <button
                        type="button"
                        onClick={() => setPropertyForm({ ...propertyForm, holiday_lump_is_per_night: true })}
                        className="px-3 py-1 rounded-md text-xs font-semibold transition-all"
                        style={{
                          backgroundColor: isPerNight ? 'var(--brand-primary)' : 'transparent',
                          color: isPerNight ? '#FFFFFF' : 'var(--brand-primary)',
                        }}
                        data-testid="holiday-mode-night-btn"
                      >{t('sweep.perNightHoliday', 'Per night during holiday')}</button>
                    </div>
                  </div>
                  <div className="flex gap-2">
                    <input
                      type="number"
                      value={propertyForm.holiday_lump_price}
                      onChange={(e) => setPropertyForm({ ...propertyForm, holiday_lump_price: e.target.value })}
                      min="0"
                      placeholder={isPerNight ? 'e.g. 800 (per night during the holiday)' : 'e.g. 10000 (total for whole holiday window)'}
                      className="flex-1 px-4 py-2 rounded-lg border border-[#E5E5E5] focus:outline-none focus:ring-2 focus:ring-[rgb(var(--brand-primary-rgb)/<alpha-value>)]/50"
                      data-testid="holiday-price-input"
                    />
                    <select
                      value={propertyForm.holiday_lump_currency}
                      onChange={(e) => setPropertyForm({ ...propertyForm, holiday_lump_currency: e.target.value })}
                      className="px-4 py-2 rounded-lg border border-[#E5E5E5] focus:outline-none focus:ring-2 focus:ring-[rgb(var(--brand-primary-rgb)/<alpha-value>)]/50"
                      data-testid="holiday-price-currency-select"
                    >
                      <option value="ILS">₪ ILS</option>
                      <option value="USD">$ USD</option>
                    </select>
                  </div>
                </div>
              );
            })()}
              </div>
            )}

            {/* ── The regular rate ─────────────────────────────────────────
                Asked after the holiday card, because a lister who came here
                to list a Sukkot rental has just finished that thought. It is
                optional: a holiday rate alone is a valid listing. */}
            {/* Price section — always a single nightly/monthly input, with an
                optional additive holiday-rate block below when one or more
                holiday tags are selected. Owners enter BOTH a regular vacation
                price and (optionally) a holiday premium — the UI/UX on the
                listing pages picks the right one based on whether the renter
                is browsing /vacation vs /sukkot. */}
            <div className="md:col-span-2">
              <label className="block text-sm font-medium mb-2">
                {propertyForm.rental_type === 'vacation' ? 'Price (per night)' : 'Price (monthly)'}
              </label>
              <div className="flex gap-2">
                <input
                  type="number"
                  value={propertyForm.rental_type === 'vacation' ? propertyForm.nightly_price : propertyForm.monthly_price}
                  onChange={(e) => {
                    const raw = e.target.value;
                    const parsed = raw === '' ? '' : parseFloat(raw);
                    if (propertyForm.rental_type === 'vacation') {
                      setPropertyForm({ ...propertyForm, nightly_price: parsed });
                    } else {
                      setPropertyForm({ ...propertyForm, monthly_price: parsed });
                    }
                  }}
                  min="0"
                  className="flex-1 px-4 py-2 rounded-lg border border-[#E5E5E5] focus:outline-none focus:ring-2 focus:ring-[rgb(var(--brand-primary-rgb)/<alpha-value>)]/50"
                  required
                  data-testid="property-price-input"
                />
                <select
                  value={propertyForm.currency}
                  onChange={(e) => setPropertyForm({ ...propertyForm, currency: e.target.value })}
                  className="px-4 py-2 rounded-lg border border-[#E5E5E5] focus:outline-none focus:ring-2 focus:ring-[rgb(var(--brand-primary-rgb)/<alpha-value>)]/50"
                  data-testid="property-currency-select"
                >
                  <option value="ILS">₪ ILS</option>
                  <option value="USD">$ USD</option>
                </select>
              </div>
              {/* Sanity-check warning — a monthly rent under ₪1,500 (or
                  $500) is almost never real in Israel, and typically
                  means the host confused nightly with monthly, dropped a
                  digit, or the number is stale from a rental-type flip.
                  We warn instead of block: some sublets are legitimately
                  cheap (e.g. yeshiva students, family arrangements). */}
              {(() => {
                const isLongTerm = propertyForm.rental_type !== 'vacation';
                const rawVal = isLongTerm ? propertyForm.monthly_price : propertyForm.nightly_price;
                const val = Number(rawVal);
                if (!val || Number.isNaN(val)) return null;
                const cur = propertyForm.currency || 'ILS';
                const lowMonthly = isLongTerm && (
                  (cur === 'ILS' && val < 1500) || (cur === 'USD' && val < 500)
                );
                const highNightly = !isLongTerm && (
                  (cur === 'ILS' && val > 5000) || (cur === 'USD' && val > 1500)
                );
                if (!lowMonthly && !highNightly) return null;
                return (
                  <div
                    className="mt-2 flex items-start gap-2 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-sm"
                    data-testid="price-sanity-warning"
                  >
                    <AlertTriangle size={16} className="mt-0.5 text-amber-600 shrink-0" />
                    <div className="text-xs text-amber-900">
                      {lowMonthly
                        ? `This monthly rent looks unusually low. Did you mean to enter a nightly rate, or is this really ${cur === 'ILS' ? '₪' : '$'}${val.toLocaleString()} per month?`
                        : `This nightly rate looks high. Did you mean to enter a monthly rate, or is this really ${cur === 'ILS' ? '₪' : '$'}${val.toLocaleString()} per night?`}
                    </div>
                  </div>
                );
              })()}
            </div>
          </div>

          {/* Date picker — Starting Date for long-term, Date Available for everything else */}
          {propertyForm.rental_type === 'long-term' ? (
            <DateField
              label="Starting Date"
              required
              value={propertyForm.starting_date}
              onChange={(starting_date) => setPropertyForm({ ...propertyForm, starting_date })}
              variant="teal"
              emoji="📌"
              helperText="Fixed start date for this long-term rental (cannot be changed by renters)"
              testid="property-starting-date"
            />
          ) : (
            <>
              <DateField
                label="Date Available From"
                value={propertyForm.available_from}
                onChange={(available_from) => setPropertyForm({ ...propertyForm, available_from })}
                variant="gold"
                emoji="ℹ️"
                helperText="The earliest date this property can be booked from"
                testid="property-available-from"
              />
              {/* Optional cap on availability — for owners who only rent
                  for a fixed window (e.g. a single week while travelling).
                  Renters' calendar disables anything after this date and
                  the booking API rejects overflowing checkouts. */}
              <DateField
                label="Date Available Until (optional)"
                value={propertyForm.available_to}
                onChange={(available_to) => setPropertyForm({ ...propertyForm, available_to })}
                variant="gold"
                emoji="🗓️"
                helperText="Leave blank for open-ended availability. Set this if you're only renting for a fixed window (e.g. one week while travelling)."
                testid="property-available-to"
              />
              {/* An expired or nearly-expired cap silently makes a listing
                  unbookable: the renter's calendar greys out every date after
                  it, so the page looks live while nothing can be selected.
                  Three live listings were sitting at an 11-day remaining
                  window this way, which is what "only 2 days available the
                  whole year" turned out to be. Nothing anywhere told the
                  owner, so say it here, where they can fix it. */}
              {(() => {
                if (!propertyForm.available_to) return null;
                const cap = new Date(`${propertyForm.available_to}T00:00:00`);
                if (Number.isNaN(cap.getTime())) return null;
                const today = new Date();
                today.setHours(0, 0, 0, 0);
                const daysLeft = Math.round((cap - today) / 86400000);
                if (daysLeft > 30) return null;
                const expired = daysLeft < 0;
                return (
                  <div
                    className={`md:col-span-2 -mt-2 p-3 rounded-xl text-sm border ${
                      expired
                        ? 'bg-red-50 border-red-200 text-red-800'
                        : 'bg-amber-50 border-amber-200 text-amber-900'
                    }`}
                    data-testid="available-to-warning"
                  >
                    {expired ? (
                      <>
                        <strong>Nobody can book this listing.</strong> Your
                        availability ended on{' '}
                        {new Date(cap).toLocaleDateString()}, so every date is
                        greyed out on the renter's calendar.
                      </>
                    ) : (
                      <>
                        <strong>
                          Only {daysLeft === 0 ? 'today' : `${daysLeft} more day${daysLeft === 1 ? '' : 's'}`} bookable.
                        </strong>{' '}
                        Renters can't pick any date after{' '}
                        {new Date(cap).toLocaleDateString()} — including next
                        summer or the holidays.
                      </>
                    )}
                    {/* Actionable, not just informative. Telling an owner
                        their listing is dead is only useful if fixing it is
                        one tap away — most won't hand-pick a date, and the
                        common intent is "keep me open through the next chag".
                        The windows come from utils/holidayCalendar, which is
                        now Hebcal-verified; building this on the old table
                        would have rolled listings forward to the wrong week. */}
                    <div className="mt-3 flex flex-wrap gap-2">
                      {['sukkot', 'pesach'].map((tag) => {
                        const win = nextHolidayWindow([tag]);
                        // Skip a holiday the cap already covers — offering to
                        // "extend" to a date earlier than the current one
                        // would silently shorten the window instead.
                        if (!win || win.end <= propertyForm.available_to) return null;
                        const label = tag.charAt(0).toUpperCase() + tag.slice(1);
                        return (
                          <button
                            key={tag}
                            type="button"
                            onClick={() =>
                              setPropertyForm({ ...propertyForm, available_to: win.end })
                            }
                            className="px-3 py-1.5 rounded-lg text-xs font-semibold bg-white border border-[var(--brand-primary)] text-[var(--brand-primary)] hover:bg-[var(--brand-primary)] hover:text-white transition-colors"
                            data-testid={`extend-availability-${tag}`}
                          >
                            Open through {label} (
                            {new Date(`${win.end}T00:00:00`).toLocaleDateString(undefined, {
                              month: 'short', day: 'numeric', year: 'numeric',
                            })}
                            )
                          </button>
                        );
                      })}
                      <button
                        type="button"
                        onClick={() => setPropertyForm({ ...propertyForm, available_to: '' })}
                        className="px-3 py-1.5 rounded-lg text-xs font-semibold bg-white border border-gray-300 text-gray-700 hover:bg-gray-50 transition-colors"
                        data-testid="extend-availability-clear"
                      >
                        No end date
                      </button>
                    </div>
                    <p className="text-[11px] mt-2 opacity-80">
                      Remember to save the listing after choosing.
                    </p>
                  </div>
                );
              })()}
            </>
          )}

          {/* Minimum Rental Period (long/short-term) or Minimum Booking Length (vacation) */}
          <div>
            <label className="block text-sm font-medium mb-2">
              {propertyForm.rental_type === 'vacation'
                ? 'Minimum Booking Length (Days)'
                : 'Minimum Rental Period (Months)'}
            </label>
            <input
              type="number"
              value={propertyForm.minimum_booking_days}
              onChange={(e) => setPropertyForm({ ...propertyForm, minimum_booking_days: e.target.value })}
              placeholder={propertyForm.rental_type === 'vacation' ? 'e.g. 7' : 'e.g. 12'}
              className="w-full px-4 py-2 rounded-lg border border-[#E5E5E5] focus:outline-none focus:ring-2 focus:ring-[rgb(var(--brand-primary-rgb)/<alpha-value>)]/50"
              min="1"
            />
            <p className="text-xs text-gray-500 mt-1">
              {propertyForm.rental_type === 'vacation'
                ? 'Minimum number of days a renter must book (e.g., 3, 7, 14 days)'
                : 'Minimum number of months a renter must book (e.g., 6, 12, 24 months)'}
            </p>
          </div>

          {/* How bookings arrive — instant confirm vs. request to book.
              Three states, not two: null means the lister hasn't chosen and
              the backend applies its legacy rule.

              This was two equal segmented buttons with one line of help
              underneath. Two identical-looking options with nothing selected
              is the shape that makes people pick whichever sounds safest and
              move on — and the one line only ever described the option
              already chosen, so the thing you needed in order to choose was
              the thing you could not see until after choosing.

              Cards instead, each carrying its own consequence inside it, at
              the moment the decision is made.

              What is NOT done here: pre-selecting one. The brief asks for a
              recommended default, but `instant_booking: null` is a real,
              distinct state — "never chosen" — that the backend and
              BookingSidebar both read, and writing a value into it on render
              would silently convert every listing that has not decided. The
              honest substitute is to SAY which one is in force right now,
              which is a fact rather than a recommendation. */}
          <div>
            <label className="block text-sm font-medium mb-2">
              {t('property.bookingMode.label', 'How do you want to receive bookings?')}
            </label>
            <div
              className="grid grid-cols-1 sm:grid-cols-2 gap-3"
              role="radiogroup"
              aria-label={t('property.bookingMode.label', 'How do you want to receive bookings?')}
              data-testid="instant-booking-toggle"
            >
              {[
                {
                  value: false,
                  label: t('property.bookingMode.request', 'Review each request'),
                  help: t(
                    'property.bookingMode.requestHelp',
                    'Bookings arrive as requests. Nothing is confirmed until you accept, and the dates stay held until you do.',
                  ),
                },
                {
                  value: true,
                  label: t('property.bookingMode.instant', 'Book instantly'),
                  help: t(
                    'property.bookingMode.instantHelp',
                    "Bookings are confirmed straight away and the dates are blocked. You won't be asked to approve them.",
                  ),
                },
              ].map(({ value, label, help }) => {
                const active = propertyForm.instant_booking === value;
                // Which option the backend would apply if this lister never
                // chooses. Mirrors utils/instantBooking's legacy rule; it is
                // reported, not imposed.
                const isCurrentDefault =
                  propertyForm.instant_booking === null &&
                  value === (propertyForm.rental_type === 'vacation');
                return (
                  <button
                    key={String(value)}
                    type="button"
                    role="radio"
                    aria-checked={active}
                    onClick={() => setPropertyForm({ ...propertyForm, instant_booking: value })}
                    className={`text-start p-3 rounded-xl border transition-all ${
                      active ? 'shadow-sm' : 'hover:border-gray-300'
                    }`}
                    style={{
                      borderColor: active ? 'var(--brand-primary)' : 'var(--brand-border)',
                      // A wash, not a fill: the card has to stay readable,
                      // and a solid brand block would read as a pressed
                      // button rather than a chosen option.
                      backgroundColor: active
                        ? 'rgb(var(--brand-primary-rgb) / 0.06)'
                        : isCurrentDefault ? '#FBF8F2' : '#FFFFFF',
                    }}
                    data-testid={`instant-booking-${value ? 'on' : 'off'}`}
                  >
                    <span className="flex items-center gap-2 flex-wrap">
                      <span
                        className="text-sm font-semibold"
                        style={{ color: active ? 'var(--brand-primary)' : 'var(--ink)' }}
                      >
                        {label}
                      </span>
                      {isCurrentDefault && (
                        <span
                          className="text-[10px] font-bold uppercase tracking-wide px-1.5 py-0.5 rounded"
                          style={{ background: '#FBF8F2', color: 'var(--gold-lg)' }}
                          data-testid={`instant-booking-current-${value ? 'on' : 'off'}`}
                        >
                          {t('property.bookingMode.currentTag', 'In force now')}
                        </span>
                      )}
                    </span>
                    {/* The consequence lives in the card, not in a line
                        below that only describes the option already picked. */}
                    <span className="block text-xs text-gray-600 mt-1 leading-relaxed">{help}</span>
                  </button>
                );
              })}
            </div>
            {propertyForm.instant_booking === null && (
              <p className="text-xs text-gray-500 mt-2" data-testid="instant-booking-unset-note">
                {t(
                  'property.bookingMode.unsetNote',
                  'You have not chosen yet — the option marked above is what applies until you do.',
                )}
              </p>
            )}
          </div>

          {/* Cancellation Policy - Vacation + Short-Term Rentals */}
          {(propertyForm.rental_type === 'vacation' || propertyForm.rental_type === 'short-term') && (
            <div className="border-t border-gray-200 pt-6">
              <h3 className="text-lg font-bold mb-4">{t('sweep.cancellationPolicy', 'Cancellation Policy')}</h3>
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium mb-2">Policy Type</label>
                  <select
                    value={propertyForm.cancellation_policy}
                    onChange={(e) => setPropertyForm({ ...propertyForm, cancellation_policy: e.target.value })}
                    className="w-full px-4 py-2 rounded-lg border border-[#E5E5E5] focus:outline-none focus:ring-2 focus:ring-[rgb(var(--brand-primary-rgb)/<alpha-value>)]/50"
                  >
                    <option value="flexible">Flexible - Full refund 7+ days before check-in</option>
                    <option value="moderate">Moderate - 50% refund 14+ days before check-in</option>
                    <option value="strict">Strict - No refunds after booking</option>
                    <option value="custom">Custom - Write your own policy</option>
                  </select>
                </div>
                {propertyForm.cancellation_policy === 'custom' && (
                  <div>
                    <label className="block text-sm font-medium mb-2">{t('sweep.customCancellationPolicy', 'Custom Cancellation Policy')}</label>
                    <textarea
                      ref={customCancelRef}
                      value={propertyForm.custom_cancellation_policy}
                      onChange={(e) => setPropertyForm({ ...propertyForm, custom_cancellation_policy: e.target.value })}
                      placeholder="Describe your cancellation policy in detail..."
                      rows={3}
                      className="w-full px-4 py-2 rounded-lg border-2 border-[var(--gold)] focus:outline-none focus:ring-2 focus:ring-[rgb(var(--brand-primary-rgb)/<alpha-value>)]/50"
                      data-testid="custom-cancellation-policy-textarea"
                    />
                  </div>
                )}
              </div>
            </div>
          )}

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {propertyForm.rental_type !== 'storage' && (
              <div>
                <label className="block text-sm font-medium mb-2">{t('property.condition')}</label>
                <select
                  value={propertyForm.condition}
                  onChange={(e) => setPropertyForm({ ...propertyForm, condition: e.target.value })}
                  className="w-full px-4 py-2 rounded-lg border border-[#E5E5E5] focus:outline-none focus:ring-2 focus:ring-[rgb(var(--brand-primary-rgb)/<alpha-value>)]/50"
                  data-testid="property-condition-select"
                >
                  <option value="renovated">{t('property.renovated')}</option>
                  <option value="partially_renovated">{t('property.partiallyRenovated')}</option>
                  <option value="good">{t('property.goodCondition')}</option>
                </select>
              </div>
            )}
            {propertyForm.rental_type !== 'storage' && (
              <div>
                <label className="block text-sm font-medium mb-2">{t('property.numberOfPorches')}</label>
                <select
                  value={typeof propertyForm.porches === 'number' ? propertyForm.porches : 0}
                  onChange={(e) => {
                    const next = parseInt(e.target.value, 10);
                    setPropertyForm({
                      ...propertyForm,
                      porches: next,
                      sukkah_compatible: next > 0 ? propertyForm.sukkah_compatible : false,
                    });
                  }}
                  className="w-full px-4 py-2 rounded-lg border border-[#E5E5E5] focus:outline-none focus:ring-2 focus:ring-[rgb(var(--brand-primary-rgb)/<alpha-value>)]/50"
                  data-testid="property-porches-input"
                >
                  {[0, 1, 2, 3, 4, 5].map((n) => (
                    <option key={n} value={n}>{n}</option>
                  ))}
                  <option value="6">6+</option>
                </select>
                {typeof propertyForm.porches === 'number' && propertyForm.porches > 0 && (
                  <>
                    <div className="ms-2 mt-2">
                      <label className="block text-sm text-gray-600 mb-1">{t('property.parchSqm')}</label>
                      <input
                        type="number"
                        value={propertyForm.porch_square_meters}
                        onChange={(e) => setPropertyForm({ ...propertyForm, porch_square_meters: parseFloat(e.target.value) || '' })}
                        min="0"
                        step="0.1"
                        className="w-full px-3 py-2 rounded-lg border border-[#E5E5E5] focus:outline-none focus:ring-2 focus:ring-[rgb(var(--brand-primary-rgb)/<alpha-value>)]/50 text-sm"
                        data-testid="property-porch-sqm-input"
                      />
                    </div>
                    <label className="flex items-center gap-2 ms-2 mt-2">
                      <input
                        type="checkbox"
                        checked={propertyForm.sukkah_compatible}
                        onChange={(e) => setPropertyForm({ ...propertyForm, sukkah_compatible: e.target.checked })}
                        className="w-4 h-4 rounded border-[#E5E5E5]"
                        data-testid="property-sukkah-checkbox"
                      />
                      <span className="text-sm text-gray-600">{t('property.sukkah')}</span>
                    </label>
                  </>
                )}
              </div>
            )}
            {propertyForm.rental_type === 'long-term' && (
              <div>
                <label className="block text-sm font-medium mb-2">{t('property.furnitureOption')}</label>
                <select
                  value={propertyForm.furniture_option}
                  onChange={(e) => setPropertyForm({ ...propertyForm, furniture_option: e.target.value })}
                  className="w-full px-4 py-2 rounded-lg border border-[#E5E5E5] focus:outline-none focus:ring-2 focus:ring-[rgb(var(--brand-primary-rgb)/<alpha-value>)]/50"
                  data-testid="property-furniture-select"
                >
                  <option value="no_furniture">{t('property.noFurniture')}</option>
                  <option value="furniture_package">{t('property.furniturePackage')}</option>
                  <option value="partially_furnished">{t('property.partiallyFurnished', 'Partially furnished')}</option>
                  <option value="furniture_free">{t('property.furnitureFree')}</option>
                </select>
              </div>
            )}
          </div>

          <div className="grid grid-cols-2 md:grid-cols-3 gap-6">
            <div className="flex flex-col gap-2">
              <label className="flex items-center gap-2">
                <input
                  type="checkbox"
                  checked={propertyForm.has_elevator}
                  onChange={(e) => setPropertyForm({
                    ...propertyForm,
                    has_elevator: e.target.checked,
                    is_shabbat_elevator: e.target.checked ? propertyForm.is_shabbat_elevator : false,
                  })}
                  className="w-5 h-5 rounded border-[#E5E5E5]"
                  data-testid="property-elevator-checkbox"
                />
                <span>{t('property.elevator')}</span>
              </label>
              {propertyForm.has_elevator && (
                <label className="flex items-center gap-2 ms-7">
                  <input
                    type="checkbox"
                    checked={propertyForm.is_shabbat_elevator}
                    onChange={(e) => setPropertyForm({ ...propertyForm, is_shabbat_elevator: e.target.checked })}
                    className="w-4 h-4 rounded border-[#E5E5E5]"
                    data-testid="property-shabbat-elevator-checkbox"
                  />
                  <span className="text-sm text-gray-600">{t('property.shabbatElevator')}</span>
                </label>
              )}
            </div>
            <div>
              <label className="flex items-center gap-2">
                <input
                  type="checkbox"
                  checked={propertyForm.is_tama}
                  onChange={(e) => setPropertyForm({ ...propertyForm, is_tama: e.target.checked })}
                  className="w-5 h-5 rounded border-[#E5E5E5]"
                  data-testid="property-tama-checkbox"
                />
                <span>Tama (Under Construction)</span>
              </label>
            </div>
            <div className="flex flex-col gap-2">
              {propertyForm.rental_type === 'vacation' ? (
                <>
                  <label className="flex items-center gap-2">
                    <input
                      type="checkbox"
                      checked={propertyForm.has_cleaning_fee}
                      onChange={(e) => setPropertyForm({
                        ...propertyForm,
                        has_cleaning_fee: e.target.checked,
                        cleaning_fee_price: e.target.checked ? propertyForm.cleaning_fee_price : '',
                      })}
                      className="w-5 h-5 rounded border-[#E5E5E5]"
                      data-testid="property-cleaning-fee-checkbox"
                    />
                    <span>{t('property.cleaningFee', 'Cleaning fee')}</span>
                  </label>
                  {propertyForm.has_cleaning_fee && (
                    <div className="ms-7">
                      <div className="flex gap-2">
                        <input
                          type="number"
                          value={propertyForm.cleaning_fee_price}
                          onChange={(e) => setPropertyForm({ ...propertyForm, cleaning_fee_price: parseFloat(e.target.value) })}
                          placeholder={t("sweep.feeAmount", "Fee amount")}
                          min="0"
                          className="flex-1 px-3 py-2 rounded-lg border border-[#E5E5E5] focus:outline-none focus:ring-2 focus:ring-[rgb(var(--brand-primary-rgb)/<alpha-value>)]/50 text-sm"
                          data-testid="property-cleaning-fee-input"
                        />
                        <select
                          value={propertyForm.cleaning_fee_currency}
                          onChange={(e) => setPropertyForm({ ...propertyForm, cleaning_fee_currency: e.target.value })}
                          className="px-3 py-2 rounded-lg border border-[#E5E5E5] focus:outline-none focus:ring-2 focus:ring-[rgb(var(--brand-primary-rgb)/<alpha-value>)]/50 text-sm"
                          data-testid="property-cleaning-fee-currency-select"
                        >
                          <option value="ILS">₪</option>
                          <option value="USD">$</option>
                        </select>
                      </div>
                    </div>
                  )}
                  {/* Vacation-only optional guest cap */}
                  <div className="mt-1">
                    <label className="text-sm text-gray-600 block mb-1">
                      {t('property.maxGuests', 'Max guests (optional)')}
                    </label>
                    <input
                      type="number"
                      min="1"
                      max="50"
                      value={propertyForm.max_guests}
                      onChange={(e) => setPropertyForm({ ...propertyForm, max_guests: e.target.value })}
                      placeholder={t("sweep.noLimit", "No limit")}
                      className="w-32 px-3 py-2 rounded-lg border border-[#E5E5E5] focus:outline-none focus:ring-2 focus:ring-[rgb(var(--brand-primary-rgb)/<alpha-value>)]/50 text-sm"
                      data-testid="property-max-guests-input"
                    />
                  </div>
                </>
              ) : (
                <>
                  <label className="flex items-center gap-2">
                    <input
                      type="checkbox"
                      checked={propertyForm.has_agent_fee}
                      onChange={(e) => setPropertyForm({
                        ...propertyForm,
                        has_agent_fee: e.target.checked,
                        agent_fee_price: e.target.checked ? propertyForm.agent_fee_price : '',
                      })}
                      className="w-5 h-5 rounded border-[#E5E5E5]"
                      data-testid="property-agent-fee-checkbox"
                    />
                    <span>{t('property.agentFee')}</span>
                  </label>
                  {propertyForm.has_agent_fee && (
                    <div className="ms-7">
                      <div className="flex gap-2">
                        <input
                          type="number"
                          value={propertyForm.agent_fee_price}
                          onChange={(e) => setPropertyForm({ ...propertyForm, agent_fee_price: parseFloat(e.target.value) })}
                          placeholder={t("sweep.feeAmount", "Fee amount")}
                          min="0"
                          className="flex-1 px-3 py-2 rounded-lg border border-[#E5E5E5] focus:outline-none focus:ring-2 focus:ring-[rgb(var(--brand-primary-rgb)/<alpha-value>)]/50 text-sm"
                          data-testid="property-agent-fee-input"
                        />
                        <select
                          value={propertyForm.agent_fee_currency}
                          onChange={(e) => setPropertyForm({ ...propertyForm, agent_fee_currency: e.target.value })}
                          className="px-3 py-2 rounded-lg border border-[#E5E5E5] focus:outline-none focus:ring-2 focus:ring-[rgb(var(--brand-primary-rgb)/<alpha-value>)]/50 text-sm"
                          data-testid="property-agent-fee-currency-select"
                        >
                          <option value="ILS">₪</option>
                          <option value="USD">$</option>
                        </select>
                      </div>
                    </div>
                  )}
                </>
              )}
            </div>
          </div>

          {propertyForm.rental_type !== 'storage' && (
            <div>
              <PropertyServicesSelector
                value={propertyForm.amenities}
                onChange={(next) => setPropertyForm({ ...propertyForm, amenities: next })}
                rentalType={propertyForm.rental_type}
                holidayContext={propertyForm.holiday_context}
                firstEdit={!(editingProperty && editingProperty.id)}
              />
            </div>
          )}

          <div className="flex gap-4">
          {/* Proactive "what's still missing" hint — mirrors the pattern
              on the gig creation wizard so hosts don't have to hunt for
              the empty required field via browser tooltip loops. */}
          <div className="flex-1 flex flex-col gap-3">
            {!canSubmit && (
              <div
                className="rounded-xl border border-red-100 bg-red-50/40 p-3 text-xs text-red-700 leading-snug"
                data-testid="add-property-missing-hint"
              >
                <p className="font-semibold mb-1 flex items-center gap-1">
                  <span className="inline-block w-1.5 h-1.5 rounded-full bg-red-500" />
                  Still needed to publish:
                </p>
                <ul className="list-disc ms-5 space-y-0.5">
                  {missingRequiredFields.map((f) => (
                    <li key={f}>{f}</li>
                  ))}
                </ul>
              </div>
            )}
            <button
              type="submit"
              className="primary-btn disabled:opacity-50 disabled:cursor-not-allowed"
              disabled={!canSubmit || submitting}
              data-testid="submit-property-button"
            >
              {submitting
                ? t('common.saving', 'Saving...')
                : (editingProperty && editingProperty.id ? t('dashboard.saveChanges') : t('dashboard.addProperty'))}
            </button>
          </div>
          <button type="button" onClick={onClose} className="flex-1 secondary-btn self-start" data-testid="cancel-add-property-button">
            {t('dashboard.cancel')}
          </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default AddPropertyModal;
