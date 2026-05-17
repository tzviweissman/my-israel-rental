import React, { useState, useEffect, useRef } from 'react';
import { useTranslation } from 'react-i18next';
import axios from 'axios';
import { toast } from 'sonner';

import { X } from 'lucide-react';

import DateField from './propertyForm/DateField';
import LocationPicker from './propertyForm/LocationPicker';
import MediaUploadSection from './propertyForm/MediaUploadSection';

const EMPTY_FORM = {
  title: '', description: '', rental_type: 'long-term', property_type: 'apartment',
  bedrooms: 1, bathrooms: 1, area: '', address: '', square_meters: '', porch_square_meters: '',
  floor: 1, has_elevator: false, is_shabbat_elevator: false, is_tama: false,
  has_agent_fee: false, agent_fee_price: '', agent_fee_currency: 'ILS',
  has_cleaning_fee: false, cleaning_fee_price: '', cleaning_fee_currency: 'ILS',
  max_guests: '',
  porches: 0, sukkah_compatible: false, condition: 'good', furniture_option: 'no_furniture',
  amenities: [], monthly_price: '', nightly_price: '', currency: 'ILS',
  images: [], videos: [], cancellation_policy: 'flexible', custom_cancellation_policy: '',
  available_from: '', starting_date: '', minimum_booking_days: '',
  holiday_tags: [],
  holiday_lump_price: '',
  holiday_lump_currency: 'ILS',
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
        condition: editingProperty.condition || 'good',
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
        starting_date: editingProperty.starting_date || '',
        minimum_booking_days: editingProperty.minimum_booking_days ? String(editingProperty.minimum_booking_days) : '',
        holiday_tags: editingProperty.holiday_tags || [],
        holiday_lump_price: editingProperty.holiday_lump_price || '',
        holiday_lump_currency: editingProperty.holiday_lump_currency || 'ILS',
      });
      setUploadedFiles([
        ...(editingProperty.images || []).map((url, i) => ({ url, file_type: 'image', filename: url.split('/').pop(), original_name: `Image ${i + 1}` })),
        ...(editingProperty.videos || []).map((url, i) => ({ url, file_type: 'video', filename: url.split('/').pop(), original_name: `Video ${i + 1}` })),
      ]);
    } else {
      setPropertyForm(EMPTY_FORM);
      setUploadedFiles([]);
    }
  }, [isOpen, editingProperty]);

  const authHeaders = { headers: { Authorization: `Bearer ${token}` } };

  const handleSubmit = async (e) => {
    e.preventDefault();
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
      if (Array.isArray(detail) && detail[0]?.msg) {
        msg = `${msg}: ${detail[0].loc?.slice(1).join('.') || 'field'} — ${detail[0].msg}`;
      } else if (typeof detail === 'string') {
        msg = `${msg}: ${detail}`;
      }
      toast.error(msg);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-[70] p-6" data-testid="add-property-modal">
      <div className="relative bg-white rounded-2xl p-8 max-w-4xl w-full max-h-[90vh] overflow-y-auto">
        <button
          type="button"
          onClick={onClose}
          className="sticky top-0 float-right -mt-3 -mr-3 z-10 p-2 rounded-full bg-white/95 backdrop-blur-sm border border-gray-200 text-gray-500 hover:text-gray-900 hover:bg-gray-50 shadow-sm transition-colors"
          aria-label="Close"
          data-testid="add-property-close-x"
        >
          <X size={18} />
        </button>
        <h2 className="text-3xl font-bold mb-6" style={{ fontFamily: 'Playfair Display' }}>
          {editingProperty && editingProperty.id ? t('dashboard.editProperty') : t('dashboard.addNewProperty')}
        </h2>
        <form onSubmit={handleSubmit} className="space-y-6">
          <div>
            <label className="block text-sm font-medium mb-2">Title</label>
            <input
              type="text"
              value={propertyForm.title}
              onChange={(e) => setPropertyForm({ ...propertyForm, title: e.target.value })}
              className="w-full px-4 py-2 rounded-lg border border-[#E5E5E5] focus:outline-none focus:ring-2 focus:ring-[#1E6A6A]/50"
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
              className="w-full px-4 py-2 rounded-lg border border-[#E5E5E5] focus:outline-none focus:ring-2 focus:ring-[#1E6A6A]/50"
              data-testid="property-description-input"
            ></textarea>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div>
              <label className="block text-sm font-medium mb-2">{t('property.rentalType')}</label>
              <select
                value={propertyForm.rental_type}
                onChange={(e) => setPropertyForm({ ...propertyForm, rental_type: e.target.value })}
                className="w-full px-4 py-2 rounded-lg border border-[#E5E5E5] focus:outline-none focus:ring-2 focus:ring-[#1E6A6A]/50"
                data-testid="property-rental-type-select"
              >
                <option value="long-term">{t('property.longTerm')}</option>
                <option value="short-term">{t('property.shortTerm')}</option>
                <option value="vacation">{t('property.vacationType')}</option>
                <option value="storage">{t('property.storageType')}</option>
              </select>
            </div>
            {propertyForm.rental_type !== 'storage' && (
              <div>
                <label className="block text-sm font-medium mb-2">{t('property.propertyType')}</label>
                <select
                  value={propertyForm.property_type}
                  onChange={(e) => setPropertyForm({ ...propertyForm, property_type: e.target.value })}
                  className="w-full px-4 py-2 rounded-lg border border-[#E5E5E5] focus:outline-none focus:ring-2 focus:ring-[#1E6A6A]/50"
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
                className="w-full px-4 py-2 rounded-lg border border-[#E5E5E5] focus:outline-none focus:ring-2 focus:ring-[#1E6A6A]/50"
                data-testid="property-address-input"
              />
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
                className="w-full px-4 py-2 rounded-lg border border-[#E5E5E5] focus:outline-none focus:ring-2 focus:ring-[#1E6A6A]/50"
                data-testid="property-sqm-input"
              />
            </div>
            {propertyForm.rental_type !== 'storage' && (
              <div>
                <label className="block text-sm font-medium mb-2">{t('property.bedrooms')}</label>
                <select
                  value={propertyForm.bedrooms}
                  onChange={(e) => setPropertyForm({ ...propertyForm, bedrooms: parseFloat(e.target.value) })}
                  className="w-full px-4 py-2 rounded-lg border border-[#E5E5E5] focus:outline-none focus:ring-2 focus:ring-[#1E6A6A]/50"
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
                  className="w-full px-4 py-2 rounded-lg border border-[#E5E5E5] focus:outline-none focus:ring-2 focus:ring-[#1E6A6A]/50"
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
                className="w-full px-4 py-2 rounded-lg border border-[#E5E5E5] focus:outline-none focus:ring-2 focus:ring-[#1E6A6A]/50"
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

            {/* Holiday Categories — vacation rentals only.
                Placed BETWEEN floor and price so owners decide holiday tagging
                first (which can unlock the lump-sum price option below). */}
            {propertyForm.rental_type === 'vacation' && (
              <div className="md:col-span-2 bg-[#FBF8F2] rounded-xl p-4 border border-[#D4AF37]/30">
                <h3 className="text-base font-bold mb-1 text-[#1E6A6A]">Holiday Categories</h3>
                <p className="text-xs text-gray-500 mb-3">
                  Optional — tag this listing so it shows under <span className="font-medium">Sukkot Rentals</span> or <span className="font-medium">Pesach Rentals</span> in the nav and unlocks a one-price-for-the-whole-holiday rate below.
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
                            ? 'border-[#D4AF37] bg-[#D4AF37]/15 text-[#1E6A6A]'
                            : 'bg-white border-gray-200 hover:border-[#D4AF37]/40 text-gray-600'
                        }`}
                        data-testid={`holiday-tag-${key}`}
                      >
                        <input
                          type="checkbox"
                          className="w-4 h-4 accent-[#1E6A6A]"
                          checked={checked}
                          onChange={(e) => {
                            const current = propertyForm.holiday_tags || [];
                            const next = e.target.checked
                              ? [...current, key]
                              : current.filter((tag) => tag !== key);
                            // If clearing all holiday tags, also clear the lump-sum price
                            // so the renter UI doesn't show a stale value.
                            setPropertyForm({
                              ...propertyForm,
                              holiday_tags: next,
                              ...(next.length === 0
                                ? { holiday_lump_price: '', holiday_lump_currency: 'ILS' }
                                : {}),
                            });
                          }}
                        />
                        <span className="font-medium">{label}</span>
                      </label>
                    );
                  })}
                </div>
              </div>
            )}

            {/* Price section.
                - Default: simple "Price (per night)" / "Price (monthly)" input.
                - Vacation + holiday tag selected: switches to a Per-Night /
                  Whole-Holiday toggle so the owner picks ONE pricing mode.
                  Saving in the chosen mode clears the other side's value
                  so only one price ships to the backend. */}
            {(() => {
              // Whole-Holiday pricing toggle is now available for any vacation
              // rental — holiday tags (Sukkot/Pesach) are optional metadata.
              const isVacation = propertyForm.rental_type === 'vacation';
              // Mode is derived from data: a non-empty lump price means
              // we're in "whole holiday" mode.
              const mode = isVacation && propertyForm.holiday_lump_price !== '' &&
                propertyForm.holiday_lump_price != null
                ? 'lump'
                : 'night';

              const tagsLabel = (propertyForm.holiday_tags || [])
                .map((tag) => tag.charAt(0).toUpperCase() + tag.slice(1))
                .join(' / ');
              const labelText =
                isVacation
                  ? mode === 'lump'
                    ? tagsLabel
                      ? `Price for the whole ${tagsLabel} window`
                      : 'Price for the whole holiday'
                    : 'Price (per night)'
                  : 'Price (monthly)';

              const inputValue = mode === 'lump'
                ? propertyForm.holiday_lump_price
                : isVacation
                  ? propertyForm.nightly_price
                  : propertyForm.monthly_price;

              const onPriceChange = (e) => {
                const raw = e.target.value;
                if (mode === 'lump') {
                  setPropertyForm({ ...propertyForm, holiday_lump_price: raw });
                } else if (isVacation) {
                  setPropertyForm({ ...propertyForm, nightly_price: raw === '' ? '' : parseFloat(raw) });
                } else {
                  setPropertyForm({ ...propertyForm, monthly_price: raw === '' ? '' : parseFloat(raw) });
                }
              };

              const currencyValue = mode === 'lump'
                ? propertyForm.holiday_lump_currency
                : propertyForm.currency;
              const onCurrencyChange = (e) => {
                if (mode === 'lump') {
                  setPropertyForm({ ...propertyForm, holiday_lump_currency: e.target.value });
                } else {
                  setPropertyForm({ ...propertyForm, currency: e.target.value });
                }
              };

              return (
                <div className="md:col-span-2">
                  {isVacation && (
                    <div
                      className="flex items-center gap-1 mb-2 p-1 rounded-xl bg-[#FBF8F2] border border-[#D4AF37]/30 w-fit"
                      data-testid="vacation-price-mode-toggle"
                    >
                      <button
                        type="button"
                        onClick={() => {
                          // Switch to per-night: clear lump-sum
                          setPropertyForm({
                            ...propertyForm,
                            holiday_lump_price: '',
                          });
                        }}
                        className="px-4 py-1.5 rounded-lg text-xs font-semibold transition-all"
                        style={{
                          backgroundColor: mode === 'night' ? '#1E6A6A' : 'transparent',
                          color: mode === 'night' ? '#FFFFFF' : '#1E6A6A',
                        }}
                        data-testid="price-mode-night-btn"
                      >
                        Per Night
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          // Switch to whole-holiday: clear nightly,
                          // initialize lump as "0" so the input is editable
                          // and mode resolves to 'lump'.
                          setPropertyForm({
                            ...propertyForm,
                            nightly_price: '',
                            holiday_lump_price: propertyForm.holiday_lump_price || 0,
                          });
                        }}
                        className="px-4 py-1.5 rounded-lg text-xs font-semibold transition-all"
                        style={{
                          backgroundColor: mode === 'lump' ? '#1E6A6A' : 'transparent',
                          color: mode === 'lump' ? '#FFFFFF' : '#1E6A6A',
                        }}
                        data-testid="price-mode-lump-btn"
                      >
                        Whole Holiday
                      </button>
                    </div>
                  )}

                  <label className="block text-sm font-medium mb-2">{labelText}</label>
                  <div className="flex gap-2">
                    <input
                      type="number"
                      value={inputValue}
                      onChange={onPriceChange}
                      min="0"
                      placeholder={mode === 'lump' ? 'e.g. 4500' : ''}
                      className="flex-1 px-4 py-2 rounded-lg border border-[#E5E5E5] focus:outline-none focus:ring-2 focus:ring-[#1E6A6A]/50"
                      required={mode !== 'lump'}
                      data-testid="property-price-input"
                    />
                    <select
                      value={currencyValue}
                      onChange={onCurrencyChange}
                      className="px-4 py-2 rounded-lg border border-[#E5E5E5] focus:outline-none focus:ring-2 focus:ring-[#1E6A6A]/50"
                      data-testid="property-currency-select"
                    >
                      <option value="ILS">₪ ILS</option>
                      <option value="USD">$ USD</option>
                    </select>
                  </div>
                </div>
              );
            })()}
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
            <DateField
              label="Date Available"
              value={propertyForm.available_from}
              onChange={(available_from) => setPropertyForm({ ...propertyForm, available_from })}
              variant="gold"
              emoji="ℹ️"
              helperText="The earliest date this property can be booked from"
              testid="property-available-from"
            />
          )}

          {/* Minimum Booking Length */}
          <div>
            <label className="block text-sm font-medium mb-2">
              {propertyForm.rental_type === 'vacation'
                ? 'Minimum Booking Length (Days)'
                : 'Minimum Booking Length (Months)'}
            </label>
            <input
              type="number"
              value={propertyForm.minimum_booking_days}
              onChange={(e) => setPropertyForm({ ...propertyForm, minimum_booking_days: e.target.value })}
              placeholder={propertyForm.rental_type === 'vacation' ? '7' : '12'}
              className="w-full px-4 py-2 rounded-lg border border-[#E5E5E5] focus:outline-none focus:ring-2 focus:ring-[#1E6A6A]/50"
              min="1"
            />
            <p className="text-xs text-gray-500 mt-1">
              {propertyForm.rental_type === 'vacation'
                ? 'Minimum number of days a renter must book (e.g., 3, 7, 14 days)'
                : 'Minimum number of months a renter must book (e.g., 6, 12, 24 months)'}
            </p>
          </div>

          {/* Cancellation Policy - Vacation + Short-Term Rentals */}
          {(propertyForm.rental_type === 'vacation' || propertyForm.rental_type === 'short-term') && (
            <div className="border-t border-gray-200 pt-6">
              <h3 className="text-lg font-bold mb-4">Cancellation Policy</h3>
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium mb-2">Policy Type</label>
                  <select
                    value={propertyForm.cancellation_policy}
                    onChange={(e) => setPropertyForm({ ...propertyForm, cancellation_policy: e.target.value })}
                    className="w-full px-4 py-2 rounded-lg border border-[#E5E5E5] focus:outline-none focus:ring-2 focus:ring-[#1E6A6A]/50"
                  >
                    <option value="flexible">Flexible - Full refund 7+ days before check-in</option>
                    <option value="moderate">Moderate - 50% refund 14+ days before check-in</option>
                    <option value="strict">Strict - No refunds after booking</option>
                    <option value="custom">Custom - Write your own policy</option>
                  </select>
                </div>
                {propertyForm.cancellation_policy === 'custom' && (
                  <div>
                    <label className="block text-sm font-medium mb-2">Custom Cancellation Policy</label>
                    <textarea
                      ref={customCancelRef}
                      value={propertyForm.custom_cancellation_policy}
                      onChange={(e) => setPropertyForm({ ...propertyForm, custom_cancellation_policy: e.target.value })}
                      placeholder="Describe your cancellation policy in detail..."
                      rows={3}
                      className="w-full px-4 py-2 rounded-lg border-2 border-[#D4AF37] focus:outline-none focus:ring-2 focus:ring-[#1E6A6A]/50"
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
                  className="w-full px-4 py-2 rounded-lg border border-[#E5E5E5] focus:outline-none focus:ring-2 focus:ring-[#1E6A6A]/50"
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
                <input
                  type="number"
                  value={propertyForm.porches}
                  onChange={(e) => {
                    // Preserve an empty string while the user is editing so
                    // they can backspace away the "0" — otherwise React snaps
                    // it back instantly. Final coercion to int happens at
                    // submit (see propertyForm payload below).
                    const raw = e.target.value;
                    const parsed = raw === '' ? '' : parseInt(raw, 10);
                    const safe = Number.isNaN(parsed) ? '' : parsed;
                    setPropertyForm({
                      ...propertyForm,
                      porches: safe,
                      sukkah_compatible: typeof safe === 'number' && safe > 0
                        ? propertyForm.sukkah_compatible
                        : false,
                    });
                  }}
                  onBlur={() => {
                    if (propertyForm.porches === '' || propertyForm.porches == null) {
                      setPropertyForm({ ...propertyForm, porches: 0 });
                    }
                  }}
                  min="0"
                  className="w-full px-4 py-2 rounded-lg border border-[#E5E5E5] focus:outline-none focus:ring-2 focus:ring-[#1E6A6A]/50"
                  data-testid="property-porches-input"
                />
                {typeof propertyForm.porches === 'number' && propertyForm.porches > 0 && (
                  <>
                    <div className="ml-2 mt-2">
                      <label className="block text-sm text-gray-600 mb-1">{t('property.parchSqm')}</label>
                      <input
                        type="number"
                        value={propertyForm.porch_square_meters}
                        onChange={(e) => setPropertyForm({ ...propertyForm, porch_square_meters: parseFloat(e.target.value) || '' })}
                        min="0"
                        step="0.1"
                        className="w-full px-3 py-2 rounded-lg border border-[#E5E5E5] focus:outline-none focus:ring-2 focus:ring-[#1E6A6A]/50 text-sm"
                        data-testid="property-porch-sqm-input"
                      />
                    </div>
                    <label className="flex items-center gap-2 ml-2 mt-2">
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
                  className="w-full px-4 py-2 rounded-lg border border-[#E5E5E5] focus:outline-none focus:ring-2 focus:ring-[#1E6A6A]/50"
                  data-testid="property-furniture-select"
                >
                  <option value="no_furniture">{t('property.noFurniture')}</option>
                  <option value="furniture_package">{t('property.furniturePackage')}</option>
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
                <label className="flex items-center gap-2 ml-7">
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
                    <div className="ml-7">
                      <div className="flex gap-2">
                        <input
                          type="number"
                          value={propertyForm.cleaning_fee_price}
                          onChange={(e) => setPropertyForm({ ...propertyForm, cleaning_fee_price: parseFloat(e.target.value) })}
                          placeholder="Fee amount"
                          min="0"
                          className="flex-1 px-3 py-2 rounded-lg border border-[#E5E5E5] focus:outline-none focus:ring-2 focus:ring-[#1E6A6A]/50 text-sm"
                          data-testid="property-cleaning-fee-input"
                        />
                        <select
                          value={propertyForm.cleaning_fee_currency}
                          onChange={(e) => setPropertyForm({ ...propertyForm, cleaning_fee_currency: e.target.value })}
                          className="px-3 py-2 rounded-lg border border-[#E5E5E5] focus:outline-none focus:ring-2 focus:ring-[#1E6A6A]/50 text-sm"
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
                      placeholder="No limit"
                      className="w-32 px-3 py-2 rounded-lg border border-[#E5E5E5] focus:outline-none focus:ring-2 focus:ring-[#1E6A6A]/50 text-sm"
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
                    <div className="ml-7">
                      <div className="flex gap-2">
                        <input
                          type="number"
                          value={propertyForm.agent_fee_price}
                          onChange={(e) => setPropertyForm({ ...propertyForm, agent_fee_price: parseFloat(e.target.value) })}
                          placeholder="Fee amount"
                          min="0"
                          className="flex-1 px-3 py-2 rounded-lg border border-[#E5E5E5] focus:outline-none focus:ring-2 focus:ring-[#1E6A6A]/50 text-sm"
                          data-testid="property-agent-fee-input"
                        />
                        <select
                          value={propertyForm.agent_fee_currency}
                          onChange={(e) => setPropertyForm({ ...propertyForm, agent_fee_currency: e.target.value })}
                          className="px-3 py-2 rounded-lg border border-[#E5E5E5] focus:outline-none focus:ring-2 focus:ring-[#1E6A6A]/50 text-sm"
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
              <label className="block text-sm font-medium mb-4">{t('property.amenities')}</label>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                {[
                  'Central AC / Heating',
                  'In-unit washer and dryer',
                  'Dishwasher',
                  'Walk in Closets',
                  'High Ceilings',
                  'Ensuite Bathroom',
                  'Storage Space',
                  'Heated Floors',
                  'Gym / Fitness center',
                  'Swimming pool (indoor or outdoor)',
                  'Hot tub / Spa',
                  'On-site parking (garage or lot)',
                  'Wi-Fi included',
                ].map((amenity) => (
                  <label key={amenity} className="flex items-center gap-2">
                    <input
                      type="checkbox"
                      checked={propertyForm.amenities.includes(amenity)}
                      onChange={(e) => {
                        if (e.target.checked) {
                          setPropertyForm({ ...propertyForm, amenities: [...propertyForm.amenities, amenity] });
                        } else {
                          setPropertyForm({ ...propertyForm, amenities: propertyForm.amenities.filter((a) => a !== amenity) });
                        }
                      }}
                      className="w-4 h-4 rounded border-[#E5E5E5]"
                    />
                    <span className="text-sm">{amenity}</span>
                  </label>
                ))}
              </div>
            </div>
          )}

          <MediaUploadSection
            form={propertyForm}
            setForm={setPropertyForm}
            uploadedFiles={uploadedFiles}
            setUploadedFiles={setUploadedFiles}
            API={API}
            token={token}
          />

          <div className="flex gap-4">
            <button type="submit" className="flex-1 primary-btn" data-testid="submit-property-button">
              {editingProperty && editingProperty.id ? t('dashboard.saveChanges') : t('dashboard.addProperty')}
            </button>
            <button type="button" onClick={onClose} className="flex-1 secondary-btn" data-testid="cancel-add-property-button">
              {t('dashboard.cancel')}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default AddPropertyModal;
